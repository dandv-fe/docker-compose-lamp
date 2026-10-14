import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../db.js';
import type { AuthContext } from './auth.js';
import { colombiaPayrollDate, freshEmployee, normalizePayrollPeriod } from './payrollEmployee.js';
import { forecastScheduledCollections, type CardInput } from './ratingEngine.js';
import { fail } from './errors.js';
import { presentOwnChallenge } from './dispatchChallengePresentation.js';

type Row = Record<string, unknown>;

export async function myDispatchChallenges(context: AuthContext | null) {
  const actor = await freshEmployee(context);
  const today = colombiaPayrollDate();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM view_dispatch_challenge_progress WHERE idglobal=? AND employeeId=?
     ORDER BY deadline DESC,challengeId DESC`, [actor.companyId, actor.employeeId]);
  const branchCards = new Map<number, CardInput[]>();
  const items = [];
  for (const row of rows) {
      const deadline = String(row.deadline);
      const [summary] = await pool.query('CALL sp_employee_payroll_summary(?,?,?)',
        [actor.companyId, actor.employeeId, deadline]);
      const salary = normalizePayrollPeriod((summary as Row[][])[0][0]);
      const cutoff = deadline < today ? deadline : today;
      const [creditedRows] = await pool.execute<RowDataPacket[]>(
        `SELECT COALESCE(SUM(capitalCommission+collectionCommission),0) AS total,
         COALESCE(SUM(IF(routeId=?,capitalCommission+collectionCommission,0)),0) AS credited
         FROM view_employee_payroll_breakdown WHERE idglobal=? AND employeeId=? AND movementDate BETWEEN ? AND ?`,
        [row.routeId, actor.companyId, actor.employeeId, salary.startDate, cutoff]);
      salary.commissionAmount = Number(creditedRows[0].total);
      const [parts] = await pool.execute<RowDataPacket[]>(
        `SELECT contract_id AS contractId,salary_type AS type,weight,capital_rate AS capitalRate,
         collection_rate AS collectionRate FROM tbl_employee_payroll_snapshot WHERE idglobal=? AND route_id=? AND employee_id=?`,
        [actor.companyId, row.routeId, actor.employeeId]);
      const [goalRows] = await pool.query('CALL sp_dispatch_challenge_goal(?,?,?,?)',
        [JSON.stringify(salary), JSON.stringify(parts[0] ?? null), creditedRows[0].credited, JSON.stringify(row)]);
      const result = (goalRows as Row[][])[0][0];
      const [cover] = await pool.execute<RowDataPacket[]>(
        `SELECT 1 FROM tbl_employee_payroll_vacation WHERE idglobal=? AND employee_id=?
         AND start_date<=? AND end_date>=GREATEST(?,?) UNION ALL
         SELECT 1 FROM tbl_employee_payroll_coverage WHERE idglobal=? AND branch_id=?
         AND replacement_employee_id=? AND start_date<=? AND end_date>=GREATEST(?,?) LIMIT 1`,
        [actor.companyId, actor.employeeId, deadline, salary.startDate, today,
          actor.companyId, row.branchId, actor.employeeId, deadline, salary.startDate, today]);
      let collections: Row | null = null;
      if (deadline >= today && row.routeState === 'created' && Number(row.assigned)) {
        const branchId = Number(row.branchId);
        const cards = branchCards.get(branchId) ?? await loadBranchCards(actor.companyId, branchId);
        branchCards.set(branchId, cards);
        const result = forecastScheduledCollections(cards, new Date(`${today}T12:00:00-05:00`),
          new Date(`${deadline}T12:00:00-05:00`), 'America/Bogota');
        const { invalidCards, ...aggregate } = result;
        collections = { ...aggregate, invalidReasons: [...new Set(invalidCards.map((c) => c.reason))] };
      }
      items.push(presentOwnChallenge(row, salary, result, today, collections, cover.length > 0));
  }
  return { employeeId: actor.employeeId, asOf: today, items };
}

async function loadBranchCards(companyId: number, branchId: number): Promise<CardInput[]> {
  const [cards] = await pool.execute<RowDataPacket[]>(
    `SELECT idtarjeta AS id,str_estado AS status,str_modo AS mode,int_tiempo AS term,
     ROUND(dec_valor*100) AS valueCents,ROUND(dec_resta*100) AS balanceCents,
     CONCAT(DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s'),'-05:00') AS createdAtUtc
     FROM tbl_tarjetas WHERE idglobal=? AND idsucursal=? AND (str_estado<>'cancelado' OR dec_resta<>0)`,
    [companyId, branchId]);
  if (cards.length > 20000) fail('BUSINESS_RULE', 'Cartera demasiado grande para estimación síncrona.');
  const [payments] = await pool.execute<RowDataPacket[]>(
    `SELECT d.idtarjeta AS cardId,ROUND(d.dec_abono*100) AS amountCents,d.str_descripcion AS description,
     CONCAT(DATE_FORMAT(d.created_at,'%Y-%m-%dT%H:%i:%s'),'-05:00') AS createdAtUtc
     FROM tbl_descripcion d JOIN tbl_tarjetas t ON t.idglobal=d.idglobal AND t.idtarjeta=d.idtarjeta
     WHERE t.idglobal=? AND t.idsucursal=? AND (t.str_estado<>'cancelado' OR t.dec_resta<>0)`, [companyId, branchId]);
  const prepared: CardInput[] = cards.map((c) => ({ id: c.id, status: c.status, mode: c.mode,
    term: c.term == null ? NaN : Number(c.term), valueCents: c.valueCents == null ? NaN : Number(c.valueCents),
    balanceCents: c.balanceCents == null ? NaN : Number(c.balanceCents), createdAtUtc: c.createdAtUtc, payments: [] }));
  const index = new Map(prepared.map((c) => [c.id, c]));
  for (const p of payments) index.get(p.cardId)?.payments.push({ amountCents: p.amountCents == null ? NaN : Number(p.amountCents),
    description: p.description, createdAtUtc: p.createdAtUtc });
  return prepared;
}
