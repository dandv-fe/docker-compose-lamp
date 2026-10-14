import { z } from 'zod';
import { pool } from '../db.js';
import type { AuthContext } from './auth.js';
import { fail, mapTransactionError } from './errors.js';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) =>
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value, 'Invalid calendar date');
const amount = z.coerce.number().finite().min(-999999999999.99).max(999999999999.99);
const rate = z.coerce.number().finite().min(0).max(100);
const common = { idempotencyToken: z.string().regex(/^[A-Za-z0-9_-]{16,100}$/) };
const employee = { ...common, employeeId: z.coerce.number().int().positive() };
export const payrollChangeSchemas = {
  contrato: z.object({ ...employee, effectiveDate: date, type: z.enum(['Fijo', 'Porcentaje', 'Combinado']),
    frequency: z.enum(['Diario', 'Semanal', 'Quincenal', 'Mensual']),
    baseAmount: amount.min(0), capitalRate: rate, collectionRate: rate }).strict(),
  vacacion: z.object({ ...employee, startDate: date, endDate: date,
    replacementEmployeeId: z.coerce.number().int().positive(),
    reason: z.string().trim().max(250).default('') }).strict(),
  bono: z.object({ ...employee, branchId: z.coerce.number().int().positive(),
    routeId: z.coerce.number().int().positive(), amount: amount.positive().max(99999999.99)
      .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.000001, 'Use currency cents'),
    reason: z.string().trim().min(1).max(250) }).strict(),
  reparto: z.object({ ...common, branchId: z.coerce.number().int().positive(),
    mode: z.enum(['Titular', 'Igual', 'Personalizado']),
    weights: z.array(z.object({ employeeId: z.coerce.number().int().positive(), weight: rate.refine((v) => v > 0) }).strict())
      .max(10000).default([]) }).strict(),
};
type Row = Record<string, unknown>;
export interface EmployeePayrollRoute {
  id: number;
  routeId: number;
  branchId: number;
  branchName: string;
  openedAt: string;
  openedDate: string;
  state: string;
  closed: boolean;
  provisional: boolean;
  contractId: string | null;
  type: string | null;
  mode: string;
  weight: number;
  sharePercent: number;
  capitalRate: number;
  collectionRate: number;
  capitalAmount: number;
  cashAmount: number;
  capitalBasis: number;
  collectionBasis: number;
  capitalCommission: number;
  collectionCommission: number;
  vacationId: string | null;
  coveredEmployeeId: number | null;
}
const numericFields = ['baseAmount', 'periodBaseAmount', 'capitalCommission', 'collectionCommission', 'commissionAmount',
  'bonusAmount', 'earnedAmount', 'paidAmount', 'pendingAmount'] as const;

export function colombiaPayrollDate(now = Date.now()) {
  return new Date(now - 5 * 3600000).toISOString().slice(0, 10);
}

export function normalizePayrollPeriod(period: Row): Row {
  const normalized: Row = { ...period, configured: Boolean(Number(period.configured)) };
  for (const field of numericFields) normalized[field] = Number(period[field] ?? 0);
  normalized.agreedBaseAmount = Number(period.agreedBaseAmount ?? 0);
  for (const field of ['startDate', 'endDate']) {
    const value = period[field];
    normalized[field] = value instanceof Date
      ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
      : String(value).slice(0, 10);
  }
  return normalized;
}

function databaseError(error: unknown): never {
  const message = (error as { sqlMessage?: string }).sqlMessage ?? '';
  if (message.includes('PAYROLL_ROUTE_CLOSED') || message.includes('PAYROLL_EXPENSE_ROUTE_CLOSED')) {
    fail('ROUTE_CLOSED', 'El gasto requiere un despacho abierto en estado created.');
  }
  if (/PAYROLL_(UNAUTHENTICATED|FORBIDDEN)/.test(message)) fail('FORBIDDEN', 'Acceso a nómina no autorizado.');
  if (/PAYROLL_.*(CONFLICT|SUM_100)/.test(message)) fail('CONFLICT', message);
  if (message.startsWith('PAYROLL_')) fail('VALIDATION_ERROR', message);
  throw mapTransactionError(error);
}

export async function freshEmployee(context: AuthContext | null) {
  if (!context) fail('UNAUTHENTICATED', 'Authentication is required');
  const [rows] = await pool.execute(
    `SELECT e.idempleado AS employeeId FROM tbl_usuario u
     JOIN tbl_empleado e ON e.idpersona=u.idpersona AND e.idglobal=u.idglobal
     WHERE u.idusuario=? AND u.idglobal=? AND u.str_estado='activo' AND e.str_estado='activo'`,
    [context.user.userId, context.user.companyId],
  );
  const row = (rows as Row[])[0];
  if (!row) fail('FORBIDDEN', 'No hay empleado activo en esta sesión.');
  return { companyId: context.user.companyId, employeeId: Number(row.employeeId), userId: context.user.userId };
}

/** Online employee view: deliberately has no employeeId argument. */
export async function myPayroll(context: AuthContext | null, asOf?: string | null) {
  const actor = await freshEmployee(context);
  const parsedDate = asOf == null ? null : date.safeParse(asOf);
  if (parsedDate && !parsedDate.success) fail('VALIDATION_ERROR', 'Fecha de nómina no válida.');
  const selectedDate = parsedDate?.success ? parsedDate.data : null;
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.query('CALL sp_employee_payroll_summary(?,?,?)',
      [actor.companyId, actor.employeeId, selectedDate]);
    const period = (result as unknown as Row[][])[0][0];
    const normalized = normalizePayrollPeriod(period);
    const [contracts] = await conn.execute(
      `SELECT id AS contractId,DATE_FORMAT(effective_date,'%Y-%m-%d') AS effectiveDate,salary_type AS type,frequency,
       base_amount AS baseAmount,capital_rate AS capitalRate,collection_rate AS collectionRate
       FROM tbl_employee_payroll_contract WHERE idglobal=? AND employee_id=? ORDER BY effective_date DESC`,
      [actor.companyId, actor.employeeId]);
    const [vacations] = await conn.execute(
      `SELECT v.id,DATE_FORMAT(v.start_date,'%Y-%m-%d') AS startDate,
       DATE_FORMAT(v.end_date,'%Y-%m-%d') AS endDate,v.reason,v.replacement_employee_id AS replacementEmployeeId,
       CONCAT_WS(' ',p.str_nombres,p.str_apellidos) AS replacementName
       FROM tbl_employee_payroll_vacation v LEFT JOIN tbl_empleado e
       ON e.idglobal=v.idglobal AND e.idempleado=v.replacement_employee_id
       LEFT JOIN tbl_persona p ON p.idglobal=e.idglobal AND p.idpersona=e.idpersona
       WHERE v.idglobal=? AND v.employee_id=? ORDER BY v.start_date DESC`, [actor.companyId, actor.employeeId]);
    const [bonuses] = await conn.execute(
      `SELECT id,DATE_FORMAT(movement_date,'%Y-%m-%d') AS date,amount,reason,expense_id AS expenseId,cancelled_at AS cancelledAt FROM tbl_employee_payroll_bonus
       WHERE idglobal=? AND employee_id=? ORDER BY movement_date DESC`, [actor.companyId, actor.employeeId]);
    const startDate = String(normalized.startDate);
    const detailArgs = [actor.companyId, actor.employeeId, startDate,
      selectedDate ?? colombiaPayrollDate()];
    const [breakdownRows] = await conn.execute(
      `SELECT routeId,branchId,branchName,state,provisional,movementId,
       DATE_FORMAT(movementDate,'%Y-%m-%d') AS movementDate,contractId,type,weight,capitalRate,collectionRate,mode,
       capitalAmount,cashAmount,excludedReason,capitalCommission,collectionCommission,vacationId,coveredEmployeeId
       FROM view_employee_payroll_breakdown
       WHERE idglobal=? AND employeeId=? AND movementDate BETWEEN ? AND ?
       ORDER BY movementDate,routeId,movementId`, detailArgs);
    const breakdown = (breakdownRows as Row[]).map((row) => ({ ...row,
      provisional: Boolean(Number(row.provisional)),
      ...Object.fromEntries(['weight', 'capitalRate', 'collectionRate', 'capitalAmount', 'cashAmount',
        'capitalCommission', 'collectionCommission'].map((key) => [key, Number(row[key])])) }));
    const [routeResult] = await conn.query('CALL sp_employee_payroll_routes(?,?,?,?)', detailArgs);
    const routes: EmployeePayrollRoute[] = (routeResult as unknown as Row[][])[0].map((row) => ({
      id: Number(row.routeId), routeId: Number(row.routeId), branchId: Number(row.branchId),
      branchName: String(row.branchName), state: String(row.state),
      openedAt: String(row.openedAt), openedDate: String(row.openedAt).slice(0, 10),
      provisional: Boolean(Number(row.provisional)), closed: !Boolean(Number(row.provisional)),
      contractId: row.contractId == null ? null : String(row.contractId), type: row.type == null ? null : String(row.type),
      mode: String(row.mode), weight: Number(row.weight), sharePercent: Number(row.weight),
      capitalRate: Number(row.capitalRate), collectionRate: Number(row.collectionRate),
      capitalCommission: Number(row.capitalCommission), collectionCommission: Number(row.collectionCommission),
      capitalAmount: Number(row.capitalAmount), cashAmount: Number(row.cashAmount),
      capitalBasis: Number(row.capitalAmount), collectionBasis: Number(row.cashAmount),
      vacationId: row.vacationId == null ? null : String(row.vacationId),
      coveredEmployeeId: row.coveredEmployeeId == null ? null : Number(row.coveredEmployeeId),
    }));
    return { employeeId: actor.employeeId, asOf: selectedDate ?? colombiaPayrollDate(),
      periods: [normalized], totals: Object.fromEntries(numericFields.map((key) => [key, normalized[key]])),
      contracts, vacations, bonuses, routes, breakdown };
  } catch (error) { return databaseError(error); }
  finally { conn.release(); }
}

/** The shared SQL routine re-reads the actor and owns the complete transaction. */
export async function changeEmployeePayroll(context: AuthContext | null, action: keyof typeof payrollChangeSchemas, input: unknown) {
  const actor = await freshEmployee(context);
  const parsed = payrollChangeSchemas[action].safeParse(input);
  if (!parsed.success) fail('VALIDATION_ERROR', 'Datos de nómina no válidos.');
  const data = parsed.data;
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('CALL sp_employee_payroll_change_v2(?,?,?,?)',
      [actor.companyId, actor.userId, action, JSON.stringify(data)]);
    const result = (rows as unknown as Row[][])[0][0];
    return { ok: Boolean(Number(result.ok)), id: String(result.id), duplicate: Boolean(Number(result.duplicate)),
      expenseId: result.expenseId == null ? null : String(result.expenseId),
      branchId: result.branchId == null ? null : Number(result.branchId),
      routeId: result.routeId == null ? null : Number(result.routeId) };
  } catch (error) { return databaseError(error); }
  finally { conn.release(); }
}

export async function payrollBonusContext(context: AuthContext | null, branchId: number) {
  const actor = await freshEmployee(context);
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.query('CALL sp_employee_payroll_bonus_context(?,?,?,NULL)',
      [actor.companyId, actor.userId, branchId]);
    const rows = (result as unknown as Row[][])[0];
    if (!rows.length) fail('FORBIDDEN', 'No hay beneficiarios autorizados en este despacho.');
    return { branchId: Number(rows[0].branchId), routeId: Number(rows[0].routeId), state: 'created',
      employees: rows.map((row) => ({ employeeId: Number(row.employeeId), name: String(row.name) })) };
  } catch (error) { return databaseError(error); }
  finally { conn.release(); }
}
