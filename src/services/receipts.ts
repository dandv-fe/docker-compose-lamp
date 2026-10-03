import type { RowDataPacket } from 'mysql2/promise';
import { fail } from './errors.js';

// Business day used for WhatsApp receipt eligibility. Same zone the legacy PHP app pins
// (webgoez model/Conexion.php) and the APK uses; override only if the whole company moves.
export function appTimeZone(env: NodeJS.ProcessEnv = process.env): string {
  const zone = env.APP_TIME_ZONE?.trim() || 'America/Bogota';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
  } catch {
    fail('CONFIGURATION_ERROR', `APP_TIME_ZONE inválida: ${zone}`);
  }
  return zone;
}

/** Minutes east of UTC for [zone] at [at] (Bogotá: -300). */
export function zoneOffsetMinutes(zone: string, at: Date = new Date()): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
    .formatToParts(at).find(part => part.type === 'timeZoneName')?.value ?? 'GMT';
  const match = /^GMT(?:([+-])(\d{2}):?(\d{2})?)?$/.exec(name);
  if (!match) fail('CONFIGURATION_ERROR', `No se pudo leer el desfase de ${zone}`);
  if (!match[1]) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === '-' ? -minutes : minutes;
}

// DATETIME columns are stamped with the database clock (NOW()), whatever its time_zone is. Both
// sides are shifted to the business zone inside the same statement, so "today" never depends on
// the server or container time zone. Params: [offset, offset].
export function sameBusinessDaySql(column: string): string {
  return `DATE(${column} + INTERVAL (? - TIMESTAMPDIFF(MINUTE,UTC_TIMESTAMP(),NOW())) MINUTE)` +
    ' = DATE(UTC_TIMESTAMP() + INTERVAL ? MINUTE)';
}

export const RECEIPT_STATES: ReadonlySet<string> = new Set(['created', 'entregando']);

export type ReceiptKind = 'credit' | 'payment';

type Execute = (
  sql: string, values?: Array<string | number | boolean | bigint | Date | Buffer | null>
) => Promise<[unknown, unknown]>;

/**
 * The card or abono must exist in this company+branch, belong to [customerId], still be
 * 'created'/'entregando' and have been created today in the business zone. Fails explicitly;
 * never falls back to another record.
 */
export async function assertReceiptTarget(
  execute: Execute, companyId: number, branchId: number, customerId: number,
  kind: ReceiptKind, recordId: string, offset = zoneOffsetMinutes(appTimeZone()),
) {
  const [rows] = kind === 'credit'
    ? await execute(
      `SELECT t.str_estado AS state,'' AS description,${sameBusinessDaySql('t.created_at')} AS today
       FROM tbl_tarjetas t
       WHERE t.idtarjeta=? AND t.idglobal=? AND t.idsucursal=? AND t.idcliente=? LIMIT 1`,
      [offset, offset, recordId, companyId, branchId, customerId],
    )
    : await execute(
      `SELECT d.str_estado AS state,d.str_descripcion AS description,${sameBusinessDaySql('d.created_at')} AS today
       FROM tbl_descripcion d
       JOIN tbl_tarjetas t ON t.idtarjeta=d.idtarjeta AND t.idglobal=d.idglobal AND t.idsucursal=d.idsucursal
       WHERE d.iddescripcion=? AND d.idglobal=? AND d.idsucursal=? AND t.idcliente=? LIMIT 1`,
      [offset, offset, recordId, companyId, branchId, customerId],
    );
  const row = (rows as RowDataPacket[])[0];
  const label = kind === 'credit' ? 'La tarjeta' : 'El abono';
  if (!row) fail('RECEIPT_NOT_ELIGIBLE', `${label} del comprobante no existe para este cliente en la sucursal.`);
  if (!RECEIPT_STATES.has(String(row.state))) {
    fail('RECEIPT_NOT_ELIGIBLE', `${label} está en estado ${row.state}; solo se reenvían registros creados o entregando.`);
  }
  if (Number(row.today) !== 1) fail('RECEIPT_NOT_ELIGIBLE', `${label} no se creó hoy; solo se reenvían comprobantes del día.`);
  if (kind === 'payment' && String(row.description).trim().toLowerCase() === 'inicial') {
    fail('RECEIPT_NOT_ELIGIBLE', 'Es la cuota inicial de un artículo: va dentro del comprobante de la tarjeta.');
  }
}

// Idempotency comes from the operation receipt (mobile_operation): a replay never reaches here.
export async function countReceiptOpen(
  execute: Execute, companyId: number, branchId: number, kind: ReceiptKind, recordId: string, userId: number | null,
) {
  await execute(
    `INSERT INTO mobile_whatsapp_receipt_open
     (idglobal,idsucursal,record_kind,record_id,open_count,first_opened_at,last_opened_at,last_opened_by)
     VALUES (?,?,?,?,1,NOW(),NOW(),?)
     ON DUPLICATE KEY UPDATE open_count=open_count+1,last_opened_at=NOW(),last_opened_by=VALUES(last_opened_by)`,
    [companyId, branchId, kind, recordId, userId],
  );
}
