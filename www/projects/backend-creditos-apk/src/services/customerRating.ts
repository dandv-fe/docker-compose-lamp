import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool, getConnection } from '../db.js';
import { assertBranchAccess, isOfficeAdministrator, type AuthContext } from './auth.js';
import { fail } from './errors.js';
import { branchScopeExists } from './sync.js';
import { appTimeZone } from './receipts.js';
import { parseRatingWeights, INITIAL_SCORE } from './ratingEngine.js';
import {
  MANUAL_STATE_UPSERT, evaluateAndPersist, storedSnapshot, ratingAutomationEnabled, ratingScore,
  type RatingSnapshot,
} from './ratingAutomation.js';

export { ratingScore };

type Executor = Pick<PoolConnection, 'execute'> | typeof pool;

const HISTORY_LIMIT = 20;

function requireAuth(context: AuthContext | null) {
  if (!context) fail('UNAUTHENTICATED', 'Authentication is required');
  return context.user;
}

export const INITIAL_LABEL = 'Inicial · poca historia';
export const REVIEW_LABEL = 'Nota por revisar';

export function ratingLabel(score: number | null): string {
  if (score == null) return 'Sin calificar';
  if (score >= 9) return 'Excelente';
  if (score >= 7) return 'Bueno';
  if (score >= 5) return 'Regular';
  return 'Requiere seguimiento';
}

export function parseRatingInput(score: number, reason: string, expectedRating: string) {
  if (!Number.isInteger(score) || score < 1 || score > 10) {
    fail('VALIDATION_ERROR', 'La calificación debe ser un número entero entre 1 y 10.');
  }
  // Same as PHP trim(): only ' ', \t, \n, \r, \0 and \v, so both writers accept identical text.
  const trimmed = reason.replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '');
  const length = Array.from(trimmed).length;
  if (length < 5 || length > 500) {
    fail('VALIDATION_ERROR', 'El motivo debe tener entre 5 y 500 caracteres.');
  }
  if (Array.from(expectedRating).length > 50) fail('VALIDATION_ERROR', 'Calificación esperada inválida.');
  return { score, reason: trimmed, expectedRating };
}

// Only the Super Administrador and the administrator of the branch's office may rate.
async function canRate(user: ReturnType<typeof requireAuth>, branchId: number) {
  return user.cargo === 'Super Administrador' || await isOfficeAdministrator(user, branchId);
}

async function readRating(executor: Executor, companyId: number, branchId: number, customerId: number, lock: boolean) {
  const [rows] = await executor.execute<RowDataPacket[]>(
    `SELECT COALESCE(c.str_calificacion,'') AS rawRating FROM tbl_clientes c
     WHERE c.idglobal = ? AND c.idcliente = ? AND ${branchScopeExists('c')} LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [companyId, customerId, branchId, branchId, branchId],
  );
  if (!rows[0]) fail('NOT_FOUND', 'Customer not found in this branch');
  return String(rows[0].rawRating);
}

/**
 * Display rule shared with PHP/web and Android: raw 'nuevo'/'' is the initial 5/10, any other non-numeric raw is 'Nota por revisar' (score null);
 * 'Inicial · poca historia' also when the confidence is initial and no manual rating is active.
 */
export function displayRating(rawRating: string, confidence?: string | null, source?: string | null) {
  const score = ratingScore(rawRating);
  if (score == null) {
    // Only the legacy "unrated" values are the initial 5/10; anything else is shown for review, never as 5.
    return rawRating === 'nuevo' || rawRating === ''
      ? { score: INITIAL_SCORE, label: INITIAL_LABEL } : { score: null, label: REVIEW_LABEL };
  }
  const initial = confidence === 'initial' && source !== 'manual';
  return { score, label: initial ? INITIAL_LABEL : ratingLabel(score) };
}

async function ratingResult(
  executor: Executor, companyId: number, customerId: number, snapshot: RatingSnapshot, allowed: boolean,
) {
  const [rows] = await executor.execute<RowDataPacket[]>(
    `SELECT id, score, previous_score AS previousScore, reason, source, created_by AS createdBy,
            CONCAT(DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.'),LPAD(FLOOR(MICROSECOND(created_at)/1000),3,'0'),'Z') AS createdAt
     FROM mobile_customer_rating_history WHERE idglobal = ? AND idcliente = ?
     ORDER BY id DESC LIMIT ${HISTORY_LIMIT}`,
    [companyId, customerId],
  );
  const display = displayRating(snapshot.rawRating, snapshot.confidence, snapshot.source);
  if (display.label === REVIEW_LABEL) {
    // Malformed legacy value: reported explicitly (ids only), never shown as the initial 5/10.
    console.warn(`[customer-rating] str_calificacion inválida para cliente ${companyId}/${customerId}: se muestra 'Nota por revisar'`);
  }
  return {
    ...display, ...snapshot, canRate: allowed,
    history: rows.map((row) => ({
      id: String(row.id), score: row.score == null ? null : Number(row.score),
      previousScore: row.previousScore == null ? null : Number(row.previousScore),
      reason: String(row.reason), source: String(row.source), createdAt: String(row.createdAt),
      createdBy: Number(row.createdBy),
    })),
  };
}

function engineSettings() {
  return { zone: appTimeZone(), weights: parseRatingWeights() };
}

/** Enabled: recomputes and persists on demand. Disabled: stored state only (nothing computed or written). */
async function currentSnapshot(conn: PoolConnection, companyId: number, customerId: number, rawRating: string) {
  if (!ratingAutomationEnabled()) return storedSnapshot(conn, companyId, customerId, rawRating);
  const { zone, weights } = engineSettings();
  const snapshot = await evaluateAndPersist(conn, companyId, customerId, { zone, weights });
  if (!snapshot) fail('NOT_FOUND', 'Customer not found in this branch');
  return snapshot;
}

export async function customerRating(context: AuthContext | null, branchId: number, customerId: number) {
  const user = requireAuth(context);
  await assertBranchAccess(user, branchId);
  const allowed = await canRate(user, branchId);
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const raw = await readRating(conn, user.companyId, branchId, customerId, ratingAutomationEnabled());
    const snapshot = await currentSnapshot(conn, user.companyId, customerId, raw);
    const result = await ratingResult(conn, user.companyId, customerId, snapshot, allowed);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function rateCustomer(
  context: AuthContext | null, branchId: number, customerId: number,
  score: number, reason: string, expectedRating: string,
) {
  const user = requireAuth(context);
  await assertBranchAccess(user, branchId);
  if (!await canRate(user, branchId)) {
    fail('FORBIDDEN', 'Solo el Super Administrador o el administrador de la oficina puede calificar clientes.');
  }
  const input = parseRatingInput(score, reason, expectedRating);
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const current = await readRating(conn, user.companyId, branchId, customerId, true);
    if (current !== input.expectedRating) {
      fail('CONFLICT', 'La calificación cambió. Actualiza el cliente e inténtalo de nuevo.');
    }
    await conn.execute(
      `INSERT INTO mobile_customer_rating_history
         (idglobal,idcliente,idsucursal,score,previous_score,reason,source,created_by,created_at)
       VALUES (?,?,?,?,?,?,'manual',?,UTC_TIMESTAMP(3))`,
      [user.companyId, customerId, branchId, input.score, ratingScore(current), input.reason, user.userId],
    );
    // Same order as PHP: customer row locked above, then the 7-day manual state, then the legacy column.
    await conn.execute(MANUAL_STATE_UPSERT, [user.companyId, customerId, input.score]);
    await conn.execute(
      'UPDATE tbl_clientes SET str_calificacion = ?, update_at = NOW() WHERE idglobal = ? AND idcliente = ?',
      [String(input.score), user.companyId, customerId],
    );
    const snapshot = await currentSnapshot(conn, user.companyId, customerId, String(input.score));
    const result = await ratingResult(conn, user.companyId, customerId, snapshot, true);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
