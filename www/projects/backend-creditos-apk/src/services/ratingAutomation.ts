import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getConnection } from '../db.js';
import { fail } from './errors.js';
import { appTimeZone } from './receipts.js';
import { PENDING_EXPLANATION, PREVIOUS_NOTE_EXPLANATION } from './ratingState.js';
import {
  CLOSED_CREDIT_LOOKBACK_DAYS, INITIAL_SCORE, evaluateCustomer, parseRatingWeights, stableAutomaticScore,
  type CardInput, type RatingWeights,
} from './ratingEngine.js';

type Conn = Pick<PoolConnection, 'execute' | 'query'>;

export const MANUAL_WINDOW_DAYS = 7;
const MAX_EVENT_ATTEMPTS = 5;
const WORKER_LOCK = 'mobile_customer_rating_worker';

export function ratingAutomationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env.CUSTOMER_RATING_AUTOMATION ?? '').trim();
  if (raw === '' || raw === '0') return false;
  if (raw === '1') return true;
  fail('CONFIGURATION_ERROR', 'CUSTOMER_RATING_AUTOMATION debe ser 0 o 1');
}

function intSetting(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number, max: number) {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  if (!/^\d+$/.test(raw.trim()) || Number(raw) < min || Number(raw) > max) {
    fail('CONFIGURATION_ERROR', `${name} debe ser un entero entre ${min} y ${max}`);
  }
  return Number(raw);
}

export interface WorkerSettings { intervalMs: number; batch: number; weights: RatingWeights; zone: string }
export function workerSettings(env: NodeJS.ProcessEnv = process.env): WorkerSettings {
  return {
    intervalMs: intSetting(env, 'RATING_WORKER_INTERVAL_MS', 30_000, 5_000, 3_600_000),
    batch: intSetting(env, 'RATING_WORKER_BATCH', 100, 1, 1_000),
    weights: parseRatingWeights(env),
    zone: appTimeZone(env),
  };
}

// Valid '1'..'10' only, exactly like PHP/Android; anything else ('nuevo', '') is the initial state.
export function ratingScore(raw: string | null | undefined): number | null {
  return raw != null && /^(?:[1-9]|10)$/.test(raw) ? Number(raw) : null;
}

/** Manual save shared with PHP (CalificacionCliente.php): run after locking tbl_clientes FOR UPDATE. */
export const MANUAL_STATE_UPSERT = `INSERT INTO mobile_customer_rating_state
  (idglobal,idcliente,manual_score,manual_until,next_evaluation_at)
  VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL ${MANUAL_WINDOW_DAYS} DAY),UTC_TIMESTAMP(3))
  ON DUPLICATE KEY UPDATE manual_score=VALUES(manual_score), manual_until=VALUES(manual_until),
    next_evaluation_at=VALUES(next_evaluation_at)`;

const DB_TEXT = (column: string) => `DATE_FORMAT(${column},'%Y-%m-%d %H:%i:%s')`;
const UTC_ISO = (column: string) =>
  `IF(${column} IS NULL,NULL,CONCAT(DATE_FORMAT(${column},'%Y-%m-%dT%H:%i:%s.'),LPAD(FLOOR(MICROSECOND(${column})/1000),3,'0'),'Z'))`;

/** Legacy DATETIME columns use the database clock (NOW()); convert them to UTC explicitly. */
async function dbClockOffsetMs(conn: Conn): Promise<number> {
  const [rows] = await conn.query<RowDataPacket[]>('SELECT TIMESTAMPDIFF(SECOND,UTC_TIMESTAMP(),NOW()) AS s');
  return Math.round(Number(rows[0].s) / 60) * 60_000;
}
function dbToUtc(value: unknown, offsetMs: number): string | null {
  if (value == null) return null;
  const ms = Date.parse(`${String(value).replace(' ', 'T')}Z`);
  return Number.isNaN(ms) ? null : new Date(ms - offsetMs).toISOString();
}

export async function loadCustomerCards(conn: Conn, companyId: number, customerId: number): Promise<CardInput[]> {
  const offset = await dbClockOffsetMs(conn);
  const [cards] = await conn.execute<RowDataPacket[]>(
    `SELECT idtarjeta AS id, COALESCE(str_estado,'') AS status, COALESCE(str_modo,'') AS mode,
            int_tiempo AS term, CAST(ROUND(dec_valor*100) AS SIGNED) AS valueCents,
            CAST(ROUND(dec_resta*100) AS SIGNED) AS balanceCents, ${DB_TEXT('created_at')} AS createdAt
     FROM tbl_tarjetas
     WHERE idglobal=? AND idcliente=?
       AND (str_estado<>'cancelado' OR dec_resta<>0 OR created_at >= NOW() - INTERVAL ${CLOSED_CREDIT_LOOKBACK_DAYS} DAY)
     ORDER BY created_at, idtarjeta`,
    [companyId, customerId],
  );
  const result = new Map<string, CardInput>();
  for (const row of cards) {
    result.set(String(row.id), {
      id: String(row.id), status: String(row.status), mode: String(row.mode),
      term: row.term == null ? NaN : Number(row.term),
      valueCents: row.valueCents == null ? NaN : Number(row.valueCents),
      balanceCents: row.balanceCents == null ? NaN : Number(row.balanceCents),
      createdAtUtc: dbToUtc(row.createdAt, offset), payments: [],
    });
  }
  const ids = [...result.keys()];
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const [payments] = await conn.execute<RowDataPacket[]>(
      `SELECT idtarjeta AS cardId, CAST(ROUND(dec_abono*100) AS SIGNED) AS cents,
              COALESCE(str_descripcion,'') AS description, ${DB_TEXT('created_at')} AS createdAt
       FROM tbl_descripcion WHERE idglobal=? AND idtarjeta IN (${chunk.map(() => '?').join(',')})`,
      [companyId, ...chunk],
    );
    for (const row of payments) {
      result.get(String(row.cardId))?.payments.push({
        amountCents: row.cents == null ? NaN : Number(row.cents), description: String(row.description),
        createdAtUtc: dbToUtc(row.createdAt, offset),
      });
    }
  }
  return [...result.values()];
}

function nextMidnightUtc(now: Date, zone: string): Date {
  // Business zones used here have whole-hour offsets; probe forward for the next civil date change.
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const today = formatter.format(now);
  let probe = new Date(Math.floor(now.getTime() / 900_000) * 900_000);
  while (formatter.format(probe) === today) probe = new Date(probe.getTime() + 900_000);
  return new Date(probe.getTime() + 5 * 60_000);
}
const sqlUtc = (date: Date) => date.toISOString().replace('T', ' ').replace('Z', '');

export interface RatingSnapshot {
  rawRating: string; automaticScore: number; source: 'manual' | 'automatic'; manualUntil: string | null;
  evaluatedAt: string | null; confidence: string; explanation: string;
}

interface PersistOptions {
  zone: string; weights: RatingWeights; now?: Date;
}

/**
 * Manual rating saved before migration 014 (history only, no state row): it keeps its priority until
 * its own created_at + 7 days, never extended. Only valid while it is still the stored rating.
 */
async function legacyManual(conn: Conn, companyId: number, customerId: number, rawRating: string) {
  const [rows] = await conn.execute<RowDataPacket[]>(
    `SELECT score, created_at + INTERVAL ${MANUAL_WINDOW_DAYS} DAY > UTC_TIMESTAMP(3) AS active,
            DATE_FORMAT(created_at + INTERVAL ${MANUAL_WINDOW_DAYS} DAY,'%Y-%m-%d %H:%i:%s.%f') AS until,
            ${UTC_ISO(`created_at + INTERVAL ${MANUAL_WINDOW_DAYS} DAY`)} AS untilIso
     FROM mobile_customer_rating_history
     WHERE idglobal=? AND idcliente=? AND source='manual' ORDER BY id DESC LIMIT 1`,
    [companyId, customerId],
  );
  const row = rows[0];
  if (!row || row.score == null || Number(row.active) !== 1 || ratingScore(rawRating) !== Number(row.score)) return null;
  return { score: Number(row.score), until: String(row.until), untilIso: String(row.untilIso) };
}

/**
 * Re-evaluates one customer and stores state + effective rating. Must run inside a transaction:
 * locks tbl_clientes first, then the state row (same order as the PHP manual save).
 * Returns null when the customer does not exist.
 */
export async function evaluateAndPersist(
  conn: Conn, companyId: number, customerId: number, options: PersistOptions,
): Promise<RatingSnapshot | null> {
  const now = options.now ?? new Date();
  const [customers] = await conn.execute<RowDataPacket[]>(
    "SELECT COALESCE(str_calificacion,'') AS raw FROM tbl_clientes WHERE idglobal=? AND idcliente=? FOR UPDATE",
    [companyId, customerId],
  );
  if (!customers[0]) return null;
  const currentRaw = String(customers[0].raw);
  const [states] = await conn.execute<RowDataPacket[]>(
    `SELECT automatic_score AS automaticScore, confidence, evaluated_at IS NULL AS pending,
            manual_score AS manualScore, manual_until > UTC_TIMESTAMP(3) AS manualActive
     FROM mobile_customer_rating_state WHERE idglobal=? AND idcliente=? FOR UPDATE`,
    [companyId, customerId],
  );
  const previous = states[0];
  const evaluation = evaluateCustomer(await loadCustomerCards(conn, companyId, customerId), now, options.zone, options.weights);
  const evaluatedBefore = previous != null && Number(previous.pending) === 0;
  const automaticScore = stableAutomaticScore({
    score: evaluatedBefore ? Number(previous.automaticScore) : null,
    confidence: evaluatedBefore ? String(previous.confidence) : null,
  }, evaluation);
  const legacy = previous ? null : await legacyManual(conn, companyId, customerId, currentRaw);
  const manualActive = legacy != null || (previous?.manualScore != null && Number(previous.manualActive) === 1);
  const manualScore = legacy ? legacy.score : manualActive ? Number(previous!.manualScore) : null;
  const source = manualActive ? 'manual' : 'automatic';
  const effectiveRaw = manualActive ? String(manualScore)
    : evaluation.confidence === 'initial' ? 'nuevo' : String(automaticScore);

  const next: Date | null = evaluation.hasOpenCredits ? nextMidnightUtc(now, options.zone)
    : evaluation.hasHistory ? new Date(now.getTime() + 7 * 86_400_000) : null;
  const metrics = JSON.stringify(evaluation.metrics);
  const nextSql = next ? sqlUtc(next) : null;
  await conn.execute(
    `INSERT INTO mobile_customer_rating_state
       (idglobal,idcliente,automatic_score,evaluated_at,confidence,explanation,metrics_json,next_evaluation_at,
        manual_score,manual_until)
     VALUES (?,?,?,UTC_TIMESTAMP(3),?,?,?,IF(? IS NULL,?,LEAST(COALESCE(?,?),?)),?,?)
     ON DUPLICATE KEY UPDATE automatic_score=VALUES(automatic_score), evaluated_at=VALUES(evaluated_at),
       confidence=VALUES(confidence), explanation=VALUES(explanation), metrics_json=VALUES(metrics_json),
       next_evaluation_at=IF(?, LEAST(COALESCE(VALUES(next_evaluation_at),manual_until),manual_until),
         VALUES(next_evaluation_at)),
       manual_score=IF(?, manual_score, NULL), manual_until=IF(?, manual_until, NULL)`,
    [companyId, customerId, automaticScore, evaluation.confidence, evaluation.explanation, metrics,
      legacy?.until ?? null, nextSql, nextSql, legacy?.until ?? null, legacy?.until ?? null,
      legacy?.score ?? null, legacy?.until ?? null,
      manualActive ? 1 : 0, manualActive ? 1 : 0, manualActive ? 1 : 0],
  );

  const legacyUnrated = currentRaw === 'nuevo' || currentRaw === '';
  const sameEffective = currentRaw === effectiveRaw || (effectiveRaw === 'nuevo' && legacyUnrated);
  if (ratingScore(currentRaw) == null && !legacyUnrated) {
    // Malformed legacy value (shown as 'Nota por revisar'): replaced explicitly and audited, never kept.
    console.warn(`[customer-rating] str_calificacion inválida reemplazada para cliente ${companyId}/${customerId}`);
  }
  if (!sameEffective) {
    await conn.execute('UPDATE tbl_clientes SET str_calificacion=? WHERE idglobal=? AND idcliente=?',
      [effectiveRaw, companyId, customerId]);
  }
  // An expired manual rating (state or pre-014 numeric note) hands over to the engine once; that hand-over
  // is audited even if the score is equal (the state triggers sync the new source to APK/web).
  const sourceTakeover = !manualActive
    && (previous ? previous.manualScore != null : ratingScore(currentRaw) != null);
  if (source === 'automatic' && (!sameEffective || sourceTakeover)) {
    const [branches] = await conn.execute<RowDataPacket[]>(
      'SELECT idsucursal FROM tbl_tarjetas WHERE idglobal=? AND idcliente=? ORDER BY created_at DESC LIMIT 1',
      [companyId, customerId],
    );
    await conn.execute(
      `INSERT INTO mobile_customer_rating_history
         (idglobal,idcliente,idsucursal,score,previous_score,reason,source,created_by,created_at)
       VALUES (?,?,?,?,?,?,'automatic',0,UTC_TIMESTAMP(3))`,
      [companyId, customerId, branches[0] ? Number(branches[0].idsucursal) : 0, ratingScore(effectiveRaw),
        ratingScore(currentRaw), evaluation.explanation],
    );
  }
  const [stored] = await conn.execute<RowDataPacket[]>(
    `SELECT ${UTC_ISO('IF(manual_until > UTC_TIMESTAMP(3),manual_until,NULL)')} AS manualUntil,
            ${UTC_ISO('evaluated_at')} AS evaluatedAt
     FROM mobile_customer_rating_state WHERE idglobal=? AND idcliente=?`,
    [companyId, customerId],
  );
  return {
    rawRating: sameEffective ? currentRaw : effectiveRaw, automaticScore, source,
    manualUntil: stored[0].manualUntil == null ? null : String(stored[0].manualUntil),
    evaluatedAt: stored[0].evaluatedAt == null ? null : String(stored[0].evaluatedAt),
    confidence: evaluation.confidence, explanation: evaluation.explanation,
  };
}

/** Stored state only (automation disabled, same as the PHP reader): no engine run, no writes. */
export async function storedSnapshot(conn: Conn, companyId: number, customerId: number, rawRating: string): Promise<RatingSnapshot> {
  const [states] = await conn.execute<RowDataPacket[]>(
    `SELECT automatic_score AS automaticScore, confidence, explanation, evaluated_at IS NULL AS pending,
            manual_score IS NOT NULL AND manual_until > UTC_TIMESTAMP(3) AS manualActive,
            ${UTC_ISO('IF(manual_score IS NOT NULL AND manual_until > UTC_TIMESTAMP(3),manual_until,NULL)')} AS manualUntil,
            ${UTC_ISO('evaluated_at')} AS evaluatedAt
     FROM mobile_customer_rating_state WHERE idglobal=? AND idcliente=?`,
    [companyId, customerId],
  );
  const state = states[0];
  if (!state && ratingScore(rawRating) != null) {
    // Pre-014 numeric note without state: shown as the previous (manual) note until the first evaluation.
    const legacy = await legacyManual(conn, companyId, customerId, rawRating);
    return {
      rawRating, automaticScore: INITIAL_SCORE, source: 'manual', manualUntil: legacy?.untilIso ?? null,
      evaluatedAt: null, confidence: 'initial', explanation: PREVIOUS_NOTE_EXPLANATION,
    };
  }
  const evaluated = state != null && Number(state.pending) === 0;
  return {
    rawRating,
    automaticScore: evaluated ? Number(state.automaticScore) : INITIAL_SCORE,
    source: state != null && Number(state.manualActive) === 1 ? 'manual' : 'automatic',
    manualUntil: state?.manualUntil == null ? null : String(state.manualUntil),
    evaluatedAt: evaluated ? String(state.evaluatedAt) : null,
    confidence: evaluated ? String(state.confidence) : 'initial',
    explanation: evaluated ? String(state.explanation) : PENDING_EXPLANATION,
  };
}

async function inTransaction<T>(conn: PoolConnection, work: () => Promise<T>): Promise<T> {
  await conn.beginTransaction();
  try {
    const result = await work();
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  }
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 500);

export interface TickStats { events: number; processed: number; failed: number; due: number; bootstrapped: number; errors: number }

/** One bounded worker pass: pending events, due re-evaluations (daily/manual expiry), bootstrap. */
export async function runRatingTick(
  settings: WorkerSettings, cursor: { bootstrapAfter: number | null }, log: (message: string) => void = console.error,
): Promise<TickStats | null> {
  const conn = await getConnection();
  const stats: TickStats = { events: 0, processed: 0, failed: 0, due: 0, bootstrapped: 0, errors: 0 };
  try {
    const [locks] = await conn.query<RowDataPacket[]>('SELECT GET_LOCK(?,0) AS ok', [WORKER_LOCK]);
    if (Number(locks[0].ok) !== 1) return null;
    try {
      const options = { zone: settings.zone, weights: settings.weights };
      const [events] = await conn.query<RowDataPacket[]>(
        `SELECT id, idglobal, idcliente FROM mobile_customer_rating_event
         WHERE state='pending' ORDER BY id LIMIT ${settings.batch}`,
      );
      stats.events = events.length;
      const groups = new Map<string, { company: number; customer: number; ids: string[] }>();
      for (const event of events) {
        const key = `${event.idglobal}:${event.idcliente}`;
        const group = groups.get(key) ?? { company: Number(event.idglobal), customer: Number(event.idcliente), ids: [] };
        group.ids.push(String(event.id));
        groups.set(key, group);
      }
      for (const group of groups.values()) {
        const marks = group.ids.map(() => '?').join(',');
        try {
          await inTransaction(conn, async () => {
            const snapshot = await evaluateAndPersist(conn, group.company, group.customer, options);
            await conn.execute(
              `UPDATE mobile_customer_rating_event SET state=?, processed_at=UTC_TIMESTAMP(3), last_error=?
               WHERE id IN (${marks}) AND state='pending'`,
              [snapshot ? 'processed' : 'ignored', snapshot ? null : 'Cliente inexistente', ...group.ids],
            );
          });
          stats.processed += group.ids.length;
        } catch (error) {
          stats.errors += 1;
          log(`[customer-rating] evento cliente ${group.company}/${group.customer} falló: ${errorText(error)}`);
          await conn.execute(
            `UPDATE mobile_customer_rating_event SET attempts=attempts+1, last_error=?,
               state=IF(attempts>=${MAX_EVENT_ATTEMPTS},'failed','pending')
             WHERE id IN (${marks}) AND state='pending'`,
            [errorText(error), ...group.ids],
          );
          const [failed] = await conn.execute<RowDataPacket[]>(
            `SELECT COUNT(*) AS n FROM mobile_customer_rating_event WHERE id IN (${marks}) AND state='failed'`, group.ids);
          stats.failed += Number(failed[0].n);
        }
      }

      const [due] = await conn.query<RowDataPacket[]>(
        `SELECT idglobal, idcliente FROM mobile_customer_rating_state
         WHERE next_evaluation_at <= UTC_TIMESTAMP(3) ORDER BY next_evaluation_at LIMIT ${settings.batch}`,
      );
      for (const row of due) {
        try {
          await inTransaction(conn, async () => {
            const snapshot = await evaluateAndPersist(conn, Number(row.idglobal), Number(row.idcliente), options);
            if (!snapshot) {
              await conn.execute('UPDATE mobile_customer_rating_state SET next_evaluation_at=NULL WHERE idglobal=? AND idcliente=?',
                [row.idglobal, row.idcliente]);
            }
          });
          stats.due += 1;
        } catch (error) {
          stats.errors += 1;
          log(`[customer-rating] reevaluación ${row.idglobal}/${row.idcliente} falló: ${errorText(error)}`);
          await conn.execute(
            'UPDATE mobile_customer_rating_state SET next_evaluation_at=UTC_TIMESTAMP(3) + INTERVAL 1 HOUR WHERE idglobal=? AND idcliente=?',
            [row.idglobal, row.idcliente]);
        }
      }

      if (cursor.bootstrapAfter != null) {
        const [pending] = await conn.query<RowDataPacket[]>(
          `SELECT c.idglobal, c.idcliente FROM tbl_clientes c
           WHERE c.idcliente > ? AND EXISTS (SELECT 1 FROM tbl_tarjetas t WHERE t.idcliente=c.idcliente AND t.idglobal=c.idglobal)
             AND NOT EXISTS (SELECT 1 FROM mobile_customer_rating_state s WHERE s.idglobal=c.idglobal AND s.idcliente=c.idcliente)
           ORDER BY c.idcliente LIMIT ${settings.batch}`,
          [cursor.bootstrapAfter],
        );
        if (pending.length === 0) cursor.bootstrapAfter = null;
        for (const row of pending) {
          cursor.bootstrapAfter = Number(row.idcliente);
          try {
            await inTransaction(conn, () => evaluateAndPersist(conn, Number(row.idglobal), Number(row.idcliente), options));
            stats.bootstrapped += 1;
          } catch (error) {
            stats.errors += 1;
            log(`[customer-rating] arranque ${row.idglobal}/${row.idcliente} falló (se reintenta al reiniciar): ${errorText(error)}`);
          }
        }
      }
    } finally {
      await conn.query('SELECT RELEASE_LOCK(?)', [WORKER_LOCK]);
    }
    return stats;
  } finally {
    conn.release();
  }
}

export interface RatingWorker { stop(): Promise<void> }

/** Starts the in-process worker when CUSTOMER_RATING_AUTOMATION=1; invalid settings throw at startup. */
export function startRatingWorker(env: NodeJS.ProcessEnv = process.env): RatingWorker | null {
  parseRatingWeights(env);
  if (!ratingAutomationEnabled(env)) return null;
  const settings = workerSettings(env);
  const cursor = { bootstrapAfter: 0 as number | null };
  let running: Promise<unknown> | null = null;
  let stopped = false;
  const tick = () => {
    if (running || stopped) return;
    running = runRatingTick(settings, cursor)
      .then((stats) => {
        if (stats && stats.errors) console.error(`[customer-rating] pasada con ${stats.errors} errores`, stats);
      })
      .catch((error) => console.error(`[customer-rating] pasada falló: ${errorText(error)}`))
      .finally(() => { running = null; });
  };
  const timer = setInterval(tick, settings.intervalMs);
  timer.unref();
  setImmediate(tick);
  console.info(`[customer-rating] worker activo cada ${settings.intervalMs} ms, lote ${settings.batch}`);
  return {
    async stop() {
      stopped = true;
      clearInterval(timer);
      if (running) await running;
    },
  };
}
