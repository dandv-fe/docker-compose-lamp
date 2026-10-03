import { createHash, randomBytes } from 'node:crypto';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getConnection, pool } from '../db.js';
import type { AuthContext } from './auth.js';
import { assertBranchAccess } from './auth.js';
import { fail } from './errors.js';
import { appTimeZone, assertReceiptTarget, type ReceiptKind, zoneOffsetMinutes } from './receipts.js';

export const RECEIPT_FORMATS = ['ticket', 'factura', 'cartulina'] as const;
export type ReceiptFormat = typeof RECEIPT_FORMATS[number];

export interface ReceiptSnapshot {
  version: 1;
  companyName: string;
  branchName: string;
  customerName: string;
  kind: ReceiptKind;
  format: ReceiptFormat;
  receiptType: string;
  receiptSeries: string;
  receiptNumber: string;
  createdAtLocal: string;
  issuedAt: string;
  timeZone: string;
  concept: string;
  description: string;
  totalValue: string | null;
  term: number | null;
  frequency: string | null;
  amount: string | null;
  initialAmount: string | null;
  initialBankAmount: string | null;
  initialCashAmount: string | null;
  bankAmount: string | null;
  cashAmount: string | null;
  balanceAtIssue: string | null;
}

export interface ReceiptLinkSummary {
  id: string;
  kind: ReceiptKind;
  receiptType: string;
  receiptSeries: string;
  receiptNumber: string;
  format: ReceiptFormat;
  createdAt: string;
  expiresAt: string;
}

type SnapshotRow = RowDataPacket & {
  companyName: string; branchName: string; customerName: string;
  receiptType: string | null; receiptSeries: string | null; receiptNumber: string | null;
  createdAtLocal: string; concept: string | null; description: string | null;
  totalValue: string | null; term: number | string | null;
  frequency: string | null; balanceAtIssue: string | null; amount?: string | null;
  bankAmount?: string | null;
};

function requiredText(value: unknown, name: string, maxLength = 1000): string {
  const text = String(value ?? '').trim();
  if (!text || text.length > maxLength) fail('RECEIPT_DATA_INVALID', `El comprobante no tiene un ${name} válido.`);
  return text;
}

function optionalText(value: unknown, maxLength = 1000): string {
  const text = String(value ?? '').trim();
  if (text.length > maxLength) fail('RECEIPT_DATA_INVALID', 'Un campo del comprobante supera el tamaño permitido.');
  return text;
}

export function canonicalReceiptFormat(value: string): ReceiptFormat {
  const format = value.trim().toLocaleLowerCase('es-CO');
  if ((RECEIPT_FORMATS as readonly string[]).includes(format)) return format as ReceiptFormat;
  fail('VALIDATION_ERROR', 'Formato de comprobante inválido. Elige Ticket, Factura o Cartulina.');
}

export function publicReceiptOrigin(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env.PUBLIC_RECEIPT_ORIGIN?.trim();
  if (!configured) fail('CONFIGURATION_ERROR', 'Configura PUBLIC_RECEIPT_ORIGIN con el dominio/IP accesible desde el teléfono.');
  let parsed: URL;
  try { parsed = new URL(configured); } catch {
    fail('CONFIGURATION_ERROR', 'PUBLIC_RECEIPT_ORIGIN debe ser una URL absoluta de origen.');
  }
  const secureEnvironment = !['development', 'test'].includes(env.NODE_ENV ?? '');
  if (
    !['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password ||
    parsed.pathname !== '/' || parsed.search || parsed.hash ||
    (secureEnvironment && parsed.protocol !== 'https:')
  ) {
    fail('CONFIGURATION_ERROR', secureEnvironment
      ? 'PUBLIC_RECEIPT_ORIGIN debe ser solo el origen HTTPS público, sin ruta, credenciales ni parámetros.'
      : 'PUBLIC_RECEIPT_ORIGIN debe ser solo el origen HTTP/HTTPS, sin ruta, credenciales ni parámetros.');
  }
  return parsed.origin;
}

export function createReceiptToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: createHash('sha256').update(token, 'ascii').digest() };
}

export function receiptTokenHash(token: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return createHash('sha256').update(token, 'ascii').digest();
}

function cents(value: string | null | undefined): bigint {
  const text = String(value ?? '0').trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) fail('RECEIPT_DATA_INVALID', 'Un valor monetario del comprobante no es válido.');
  const scale = (match[3] ?? '').padEnd(2, '0');
  const absolute = BigInt(match[2]) * 100n + BigInt(scale || '0');
  return match[1] ? -absolute : absolute;
}

function decimalFromCents(value: bigint): string {
  const sign = value < 0 ? '-' : '';
  const absolute = value < 0 ? -value : value;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

async function loadSnapshot(
  conn: PoolConnection, companyId: number, companyName: string, branchId: number, customerId: number,
  kind: ReceiptKind, recordId: string, format: ReceiptFormat,
): Promise<ReceiptSnapshot> {
  const offset = zoneOffsetMinutes(appTimeZone());
  await assertReceiptTarget(conn.execute.bind(conn), companyId, branchId, customerId, kind, recordId, offset);
  const createdAtSql = `DATE_FORMAT(t.created_at + INTERVAL (? - TIMESTAMPDIFF(MINUTE,UTC_TIMESTAMP(),NOW())) MINUTE,'%Y-%m-%d %H:%i:%s')`;
  const [rows] = kind === 'credit'
    ? await conn.execute<SnapshotRow[]>(
      `SELECT s.str_codigo AS branchName,
              TRIM(CONCAT_WS(' ',p.str_nombres,p.str_apellidos)) AS customerName,
              t.str_tipo_comprobante AS receiptType,t.str_serie AS receiptSeries,t.str_numero AS receiptNumber,
              ${createdAtSql} AS createdAtLocal,t.str_concepto AS concept,t.str_descripcion AS description,
              CAST(t.dec_valor AS CHAR) AS totalValue,
              t.int_tiempo AS term,t.str_modo AS frequency,CAST(t.dec_resta AS CHAR) AS balanceAtIssue
       FROM tbl_tarjetas t
       JOIN tbl_clientes c ON c.idcliente=t.idcliente AND c.idglobal=t.idglobal
       JOIN tbl_persona p ON p.idpersona=c.idpersona AND p.idglobal=c.idglobal
       JOIN tbl_sucursal s ON s.idsucursal=t.idsucursal AND s.idglobal=t.idglobal
       WHERE t.idtarjeta=? AND t.idglobal=? AND t.idsucursal=? AND t.idcliente=? LIMIT 1 FOR UPDATE`,
      [offset, recordId, companyId, branchId, customerId],
    )
    : await conn.execute<SnapshotRow[]>(
      `SELECT s.str_codigo AS branchName,
              TRIM(CONCAT_WS(' ',p.str_nombres,p.str_apellidos)) AS customerName,
              t.str_tipo_comprobante AS receiptType,t.str_serie AS receiptSeries,t.str_numero AS receiptNumber,
              ${createdAtSql} AS createdAtLocal,t.str_concepto AS concept,
              d.str_descripcion AS description,CAST(ABS(d.dec_abono) AS CHAR) AS amount,
              CAST(t.dec_resta AS CHAR) AS balanceAtIssue
       FROM tbl_descripcion d
       JOIN tbl_tarjetas t ON t.idtarjeta=d.idtarjeta AND t.idglobal=d.idglobal AND t.idsucursal=d.idsucursal
       JOIN tbl_clientes c ON c.idcliente=t.idcliente AND c.idglobal=t.idglobal
       JOIN tbl_persona p ON p.idpersona=c.idpersona AND p.idglobal=c.idglobal
       JOIN tbl_sucursal s ON s.idsucursal=t.idsucursal AND s.idglobal=t.idglobal
       WHERE d.iddescripcion=? AND d.idglobal=? AND d.idsucursal=? AND t.idcliente=? LIMIT 1 FOR UPDATE`,
      [offset, recordId, companyId, branchId, customerId],
    );
  const row = rows[0];
  if (!row) fail('RECEIPT_NOT_ELIGIBLE', 'No se pudo leer el registro autorizado del comprobante.');

  const bankSql = kind === 'payment'
    ? `SELECT CAST(COALESCE(SUM(dec_valor),0) AS CHAR) AS bankAmount
       FROM tbl_descripcion_pago WHERE iddescripcion=? AND idglobal=?`
    : `SELECT CAST(COALESCE(SUM(dec_valor),0) AS CHAR) AS bankAmount
       FROM tbl_descripcion_pago WHERE iddescripcion=(
         SELECT iddescripcion FROM tbl_descripcion WHERE idtarjeta=? AND idglobal=? AND idsucursal=?
           AND TRIM(LOWER(str_descripcion))='inicial' ORDER BY created_at,iddescripcion LIMIT 1
       ) AND idglobal=?`;
  const bankParams = kind === 'payment' ? [recordId, companyId] : [recordId, companyId, branchId, companyId];
  const [bankRows] = await conn.execute<RowDataPacket[]>(bankSql, bankParams);
  const bankAmount = String(bankRows[0]?.bankAmount ?? '0.00');
  let initialAmount: string | null = null;
  let initialBankAmount: string | null = null;
  let initialCashAmount: string | null = null;
  let amount: string | null = null;
  let paymentBankAmount: string | null = null;
  let paymentCashAmount: string | null = null;

  if (kind === 'credit') {
    const [initialRows] = await conn.execute<RowDataPacket[]>(
      `SELECT CAST(ABS(d.dec_abono) AS CHAR) AS amount
       FROM tbl_descripcion d WHERE d.idtarjeta=? AND d.idglobal=? AND d.idsucursal=?
         AND TRIM(LOWER(d.str_descripcion))='inicial'
       ORDER BY d.created_at,d.iddescripcion LIMIT 1`,
      [recordId, companyId, branchId],
    );
    if (initialRows[0]) {
      initialAmount = String(initialRows[0].amount);
      initialBankAmount = bankAmount;
      initialCashAmount = decimalFromCents(cents(initialAmount) - cents(initialBankAmount));
      if (cents(initialCashAmount) < 0n) fail('RECEIPT_DATA_INVALID', 'El valor bancario inicial supera el pago registrado.');
    }
  } else {
    amount = requiredText(row.amount, 'valor del abono', 40);
    paymentBankAmount = bankAmount;
    paymentCashAmount = decimalFromCents(cents(amount) - cents(bankAmount));
    if (cents(paymentCashAmount) < 0n) fail('RECEIPT_DATA_INVALID', 'El valor bancario supera el abono registrado.');
  }

  const timeZone = appTimeZone();
  const snapshot: ReceiptSnapshot = {
    version: 1,
    companyName: requiredText(companyName, 'nombre de empresa', 200),
    branchName: requiredText(row.branchName, 'sucursal', 100),
    customerName: requiredText(row.customerName, 'nombre de cliente', 200),
    kind,
    format,
    receiptType: requiredText(row.receiptType, 'tipo de comprobante', 100),
    receiptSeries: optionalText(row.receiptSeries, 100),
    receiptNumber: requiredText(row.receiptNumber, 'número de comprobante', 100),
    createdAtLocal: requiredText(row.createdAtLocal, 'fecha de registro', 40),
    issuedAt: new Date().toISOString(),
    timeZone,
    concept: optionalText(row.concept, 100),
    description: optionalText(row.description, 1000),
    totalValue: row.totalValue == null ? null : requiredText(row.totalValue, 'valor total', 40),
    term: row.term == null ? null : Number(row.term),
    frequency: optionalText(row.frequency, 50) || null,
    amount,
    initialAmount,
    initialBankAmount,
    initialCashAmount,
    bankAmount: paymentBankAmount,
    cashAmount: paymentCashAmount,
    balanceAtIssue: row.balanceAtIssue == null ? null : requiredText(row.balanceAtIssue, 'saldo al emitir', 40),
  };
  if (snapshot.term != null && (!Number.isSafeInteger(snapshot.term) || snapshot.term < 0)) {
    fail('RECEIPT_DATA_INVALID', 'El plazo guardado para el comprobante no es válido.');
  }
  return snapshot;
}

function requireAuth(context: AuthContext | null): AuthContext {
  if (!context) fail('UNAUTHENTICATED', 'Authentication is required');
  return context;
}

function decodeSnapshot(raw: unknown, version: unknown): ReceiptSnapshot {
  if (Number(version) !== 1) fail('INTERNAL_SERVER_ERROR', 'Unsupported receipt snapshot version');
  const snapshot = typeof raw === 'string' ? JSON.parse(raw) as ReceiptSnapshot : raw as ReceiptSnapshot;
  if (!snapshot || snapshot.version !== 1 || !RECEIPT_FORMATS.includes(snapshot.format)) {
    fail('INTERNAL_SERVER_ERROR', 'Stored receipt snapshot is invalid');
  }
  return snapshot;
}

export async function receiptLinks(
  context: AuthContext | null, branchId: number, afterId?: string | null,
): Promise<{ receiptLinks: ReceiptLinkSummary[]; hasMore: boolean }> {
  const { user } = requireAuth(context);
  await assertBranchAccess(user, branchId);
  if (afterId != null && !/^[1-9]\d{0,19}$/.test(afterId)) {
    fail('VALIDATION_ERROR', 'Cursor de enlaces inválido.');
  }
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id,record_kind AS kind,receipt_format AS format,snapshot_version,snapshot_json,
            DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%sZ') AS createdAt,
            DATE_FORMAT(expires_at,'%Y-%m-%dT%H:%i:%sZ') AS expiresAt
     FROM mobile_whatsapp_receipt_link
     WHERE idglobal=? AND idsucursal=? AND expires_at>UTC_TIMESTAMP() AND revoked_at IS NULL
       AND (? IS NULL OR id<?)
     ORDER BY id DESC LIMIT 51`,
    [user.companyId, branchId, afterId ?? null, afterId ?? null],
  );
  const hasMore = rows.length > 50;
  const receiptLinks = rows.slice(0, 50).map(row => {
    const snapshot = decodeSnapshot(row.snapshot_json, row.snapshot_version);
    return {
      id: String(row.id),
      kind: row.kind as ReceiptKind,
      receiptType: snapshot.receiptType,
      receiptSeries: snapshot.receiptSeries,
      receiptNumber: snapshot.receiptNumber,
      format: row.format as ReceiptFormat,
      createdAt: String(row.createdAt),
      expiresAt: String(row.expiresAt),
    };
  });
  return { receiptLinks, hasMore };
}

export async function issueReceiptLink(
  context: AuthContext | null,
  args: { branchId: number; customerId: number; kind: ReceiptKind; recordId: string; format: string },
) {
  const { user } = requireAuth(context);
  const format = canonicalReceiptFormat(args.format);
  const origin = publicReceiptOrigin();
  await assertBranchAccess(user, args.branchId);

  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const snapshot = await loadSnapshot(
      conn, user.companyId, user.companyName, args.branchId, args.customerId, args.kind, args.recordId, format,
    );
    const { token, hash } = createReceiptToken();
    const [result] = await conn.execute(
      `INSERT INTO mobile_whatsapp_receipt_link
       (token_hash,idglobal,idsucursal,record_kind,record_id,idcliente,issued_by,receipt_format,
        snapshot_version,snapshot_json,created_at,expires_at)
       VALUES (?,?,?,?,?,?,?,?,1,?,UTC_TIMESTAMP(),DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 DAY))`,
      [hash, user.companyId, args.branchId, args.kind, args.recordId, args.customerId, user.userId,
        format, JSON.stringify(snapshot)],
    );
    const id = String((result as { insertId: number | bigint }).insertId);
    const [expiryRows] = await conn.execute<RowDataPacket[]>(
      'SELECT DATE_FORMAT(expires_at,\'%Y-%m-%dT%H:%i:%sZ\') AS expiresAt FROM mobile_whatsapp_receipt_link WHERE id=?',
      [id],
    );
    if (!expiryRows[0]?.expiresAt) fail('INTERNAL_SERVER_ERROR', 'No se pudo confirmar la vigencia del enlace.');
    await conn.commit();
    return {
      id,
      url: `${origin}/comprobante/${token}`,
      expiresAt: String(expiryRows[0].expiresAt),
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function revokeReceiptLink(context: AuthContext | null, branchId: number, id: string) {
  const { user } = requireAuth(context);
  if (!/^[1-9]\d{0,19}$/.test(id)) fail('VALIDATION_ERROR', 'Identificador de enlace inválido.');
  await assertBranchAccess(user, branchId);
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM mobile_whatsapp_receipt_link
     WHERE id=? AND idglobal=? AND idsucursal=? LIMIT 1`,
    [id, user.companyId, branchId],
  );
  if (!rows.length) fail('NOT_FOUND', 'Enlace de comprobante no encontrado en esta sucursal.');
  await pool.execute(
    `UPDATE mobile_whatsapp_receipt_link SET revoked_at=COALESCE(revoked_at,UTC_TIMESTAMP())
     WHERE id=? AND idglobal=? AND idsucursal=?`,
    [id, user.companyId, branchId],
  );
  return true;
}

export async function publicReceiptSnapshot(token: string): Promise<ReceiptSnapshot | null> {
  const hash = receiptTokenHash(token);
  if (!hash) return null;
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT snapshot_version,snapshot_json FROM mobile_whatsapp_receipt_link
     WHERE token_hash=? AND expires_at>UTC_TIMESTAMP() AND revoked_at IS NULL LIMIT 1`,
    [hash],
  );
  if (!rows.length) return null;
  return decodeSnapshot(rows[0].snapshot_json, rows[0].snapshot_version);
}

export function receiptHtmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]!);
}

export function receiptMoney(value: string | null): string | null {
  if (value == null) return null;
  const totalCents = cents(value);
  const negative = totalCents < 0 ? '-' : '';
  const absolute = totalCents < 0 ? -totalCents : totalCents;
  const whole = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(absolute / 100n);
  return `${negative}$ ${whole},${String(absolute % 100n).padStart(2, '0')} COP`;
}

export function receiptRows(snapshot: ReceiptSnapshot): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ['Tipo', snapshot.receiptType],
    ['Serie y número', [snapshot.receiptSeries, snapshot.receiptNumber].filter(Boolean).join(' · ')],
    ['Fecha', `${snapshot.createdAtLocal} (${snapshot.timeZone})`],
    ['Cliente', snapshot.customerName],
  ];
  if (snapshot.concept) rows.push(['Concepto', snapshot.concept]);
  if (snapshot.description) rows.push(['Descripción', snapshot.description]);
  if (snapshot.kind === 'payment') {
    rows.push(['Abono registrado', receiptMoney(snapshot.amount)!]);
    if (snapshot.bankAmount != null) rows.push(['Transferencia / banco', receiptMoney(snapshot.bankAmount)!]);
    if (snapshot.cashAmount != null) rows.push(['Efectivo', receiptMoney(snapshot.cashAmount)!]);
    if (snapshot.balanceAtIssue != null) rows.push(['Saldo al emitir este comprobante', receiptMoney(snapshot.balanceAtIssue)!]);
  } else {
    if (snapshot.totalValue != null) rows.push(['Valor total', receiptMoney(snapshot.totalValue)!]);
    if (snapshot.term != null) rows.push(['Plazo', `${snapshot.term} ${snapshot.frequency ?? 'cuotas'}`]);
    if (snapshot.initialAmount != null) {
      rows.push(['Cuota inicial recibida', receiptMoney(snapshot.initialAmount)!]);
      rows.push(['Inicial por transferencia / banco', receiptMoney(snapshot.initialBankAmount ?? '0')!]);
      rows.push(['Inicial en efectivo', receiptMoney(snapshot.initialCashAmount ?? '0')!]);
    }
    if (snapshot.balanceAtIssue != null) rows.push(['Saldo al emitir este comprobante', receiptMoney(snapshot.balanceAtIssue)!]);
  }
  return rows;
}
