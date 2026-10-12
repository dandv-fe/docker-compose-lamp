import { randomBytes } from 'node:crypto';
import { pool, getConnection } from '../db.js';
import { assertBranchAccess, hasPermission, isOfficeAdministrator, type AuthContext } from './auth.js';
import { fail } from './errors.js';
import { centsToDecimal, decimalToCents } from './validation.js';
import { authorizedPayrollQuery } from './payroll.js';

type Row = Record<string, unknown>;

function requireAuth(context: AuthContext | null) {
  if (!context) fail('UNAUTHENTICATED', 'Authentication is required');
  return context.user;
}

const money = (value: unknown) => Number(centsToDecimal(decimalToCents(String(value ?? 0))));

// webgoez publishes the shared expense catalog under company 1001 and lets each company add
// its own rows (model/RecibeCuentas.php: listTipoContabilidadS / listDeContabilidad).
const SHARED_CATALOG_COMPANY = 1001;

// webgoez counts an abono in the route totals only when its description starts with one of
// these words (see view_contabilidad_detalle_ruta.recaudo); "Intereses" and "Descuento"
// move the debt but no cash, so they are listed apart and never enter the cuadre.
const COLLECTED_DESCRIPTIONS = "(d.str_descripcion LIKE 'Abono%' OR d.str_descripcion LIKE 'Inicial%' OR d.str_descripcion LIKE 'Cancelado%')";

// Closing the day is the "bloquear" action in webgoez (model/RecibeCuentas.php), also open to
// the super administrator and to the office administrator of the branch.
async function canSettle(user: ReturnType<typeof requireAuth>, branchId: number) {
  return user.cargo === 'Super Administrador'
    || await isOfficeAdministrator(user, branchId)
    || await hasPermission(user, branchId, 'bloquear');
}

async function openRoute(companyId: number, branchId: number) {
  const [rows] = await pool.execute(
    `SELECT iddetalleruta AS id, str_estado AS state, created_at AS createdAt
     FROM tbl_detalle_ruta WHERE idglobal = ? AND idsucursal = ? AND str_estado <> 'saved'
     ORDER BY created_at DESC LIMIT 1`,
    [companyId, branchId],
  );
  return (rows as Row[])[0] ?? null;
}

/**
 * Everything the collector did on the open route day, plus the totals webgoez uses to decide
 * whether the cash adds up. The abonos and credits already paid through a bank are reported
 * apart, because that money never reached the collector's pocket.
 */
export async function routeSettlement(context: AuthContext | null, branchId: number) {
  const user = requireAuth(context);
  await assertBranchAccess(user, branchId);
  const route = await openRoute(user.companyId, branchId);
  const empty = {
    routeId: null, state: null, canSettle: await canSettle(user, branchId),
    base: 0, collected: 0, collectedBank: 0, otherCollected: 0,
    credits: 0, creditsBank: 0, expenses: 0, cashChange: 0, expectedCash: 0,
    movements: [], collectors: [],
  };
  if (!route) return empty;
  const routeId = Number(route.id);
  const args = [routeId, user.companyId];

  const [totalRows] = await pool.execute(
    `SELECT
       (SELECT COALESCE(SUM(dc.dec_total),0) FROM tbl_contabilidad_detalle dc
         WHERE dc.iddetalleruta = ? AND dc.idglobal = ? AND dc.str_nombre = 'base') AS base,
       (SELECT COALESCE(-SUM(d.dec_abono),0) FROM tbl_descripcion d
         WHERE d.iddetalleruta = ? AND d.idglobal = ? AND ${COLLECTED_DESCRIPTIONS}) AS collected,
       (SELECT COALESCE(SUM(dp.dec_valor),0) FROM tbl_descripcion_pago dp
         JOIN tbl_descripcion d ON d.iddescripcion = dp.iddescripcion AND d.idglobal = dp.idglobal
         WHERE d.iddetalleruta = ? AND d.idglobal = ? AND ${COLLECTED_DESCRIPTIONS}) AS collectedBank,
       (SELECT COALESCE(SUM(t.dec_c_adicional_valor),0) FROM tbl_tarjetas t
         WHERE t.iddetalleruta = ? AND t.idglobal = ?) AS otherCollected,
       (SELECT COALESCE(SUM(t.dec_prestamo),0) FROM tbl_tarjetas t
         WHERE t.iddetalleruta = ? AND t.idglobal = ?
           AND t.str_concepto IN ('Prestamo','Articulo')) AS credits,
       (SELECT COALESCE(SUM(tp.dec_valor),0) FROM tbl_tarjeta_pago tp
         JOIN tbl_tarjetas t ON t.idtarjeta = tp.idtarjeta AND t.idglobal = tp.idglobal
         WHERE t.iddetalleruta = ? AND t.idglobal = ?) AS creditsBank,
       (SELECT COALESCE(-SUM(dc.dec_total),0) FROM tbl_contabilidad_detalle dc
         WHERE dc.iddetalleruta = ? AND dc.idglobal = ?
           AND dc.str_operacion LIKE 'salida-totalizar%') AS expenses`,
    [...args, ...args, ...args, ...args, ...args, ...args, ...args],
  );
  const totals = (totalRows as Row[])[0] ?? {};
  const base = money(totals.base);
  const collected = money(totals.collected);
  const collectedBank = money(totals.collectedBank);
  const otherCollected = money(totals.otherCollected);
  const credits = money(totals.credits);
  const creditsBank = money(totals.creditsBank);
  const expenses = money(totals.expenses);
  // Transfers bigger than the abono were handed back in cash, so that excess leaves the pocket
  // too: it is already inside `collected - collectedBank` as a negative amount.
  const expectedCash = Number(
    (base + (collected - collectedBank) + otherCollected - (credits - creditsBank) - expenses).toFixed(2),
  );

  const [paymentRows] = await pool.execute(
    `SELECT d.iddescripcion AS id, d.dec_abono AS amount, d.str_descripcion AS description,
            d.str_estado AS state, d.created_at AS createdAt, d.str_origen AS origin,
            COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.str_nombres, p.str_apellidos)), ''), '') AS person,
            ap.idpersona AS authorId,
            COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ap.str_nombres, ap.str_apellidos)), ''), u.str_user_name) AS author,
            (SELECT COALESCE(SUM(dp.dec_valor),0) FROM tbl_descripcion_pago dp
              WHERE dp.iddescripcion = d.iddescripcion) AS bankAmount
     FROM tbl_descripcion d
     JOIN tbl_tarjetas t ON t.idtarjeta = d.idtarjeta AND t.idglobal = d.idglobal
     JOIN tbl_clientes c ON c.idcliente = t.idcliente AND c.idglobal = t.idglobal
     JOIN tbl_persona p ON p.idpersona = c.idpersona AND p.idglobal = c.idglobal
     LEFT JOIN tbl_usuario u ON u.idusuario = d.idusuario AND u.idglobal = d.idglobal
     LEFT JOIN tbl_persona ap ON ap.idpersona = u.idpersona AND ap.idglobal = u.idglobal
     WHERE d.iddetalleruta = ? AND d.idglobal = ?
     ORDER BY d.created_at, d.iddescripcion`,
    args,
  );
  const [creditRows] = await pool.execute(
    `SELECT t.idtarjeta AS id, t.dec_prestamo AS amount, t.str_concepto AS concept,
            t.dec_c_adicional_valor AS extra, t.str_estado AS state, t.created_at AS createdAt,
            COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.str_nombres, p.str_apellidos)), ''), '') AS person,
            e.idpersona AS authorId,
            COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ap.str_nombres, ap.str_apellidos)), ''), '') AS author,
            (SELECT COALESCE(SUM(tp.dec_valor),0) FROM tbl_tarjeta_pago tp
              WHERE tp.idtarjeta = t.idtarjeta) AS bankAmount
     FROM tbl_tarjetas t
     JOIN tbl_clientes c ON c.idcliente = t.idcliente AND c.idglobal = t.idglobal
     JOIN tbl_persona p ON p.idpersona = c.idpersona AND p.idglobal = c.idglobal
     LEFT JOIN tbl_empleado e ON e.idempleado = t.created_empleado_id AND e.idglobal = t.idglobal
     LEFT JOIN tbl_persona ap ON ap.idpersona = e.idpersona AND ap.idglobal = e.idglobal
     WHERE t.iddetalleruta = ? AND t.idglobal = ?
     ORDER BY t.created_at, t.idtarjeta`,
    args,
  );
  const [accountingRows] = await pool.execute(
    `SELECT dc.idcontabilidad_detalle AS id, dc.dec_total AS amount, dc.str_nombre AS name,
            dc.str_detalle AS detail, dc.str_operacion AS operation, dc.str_estado AS state,
            dc.created_at AS createdAt,
            e.idpersona AS authorId,
            COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ap.str_nombres, ap.str_apellidos)), ''), '') AS author
     FROM tbl_contabilidad_detalle dc
     LEFT JOIN tbl_empleado e ON e.idempleado = dc.created_empleado_id AND e.idglobal = dc.idglobal
     LEFT JOIN tbl_persona ap ON ap.idpersona = e.idpersona AND ap.idglobal = e.idglobal
     WHERE dc.iddetalleruta = ? AND dc.idglobal = ?
       AND dc.str_nombre NOT IN ('efectivo','efectivoMonedas','diferencia','recaudo')
     ORDER BY dc.created_at, dc.idcontabilidad_detalle`,
    args,
  );

  // The signed-in user is identified by their person, the only id shared by an abono
  // (tbl_descripcion.idusuario) and a credit or expense (created_empleado_id).
  const [meRows] = await pool.execute(
    'SELECT idpersona FROM tbl_usuario WHERE idusuario = ? AND idglobal = ? LIMIT 1',
    [user.userId, user.companyId],
  );
  const myPersonId = (meRows as Row[])[0]?.idpersona;
  const author = (row: Row) => ({
    personId: row.authorId == null ? null : Number(row.authorId),
    personName: String(row.author ?? '') || null,
  });
  const movements = [
    ...(paymentRows as Row[]).map((row) => {
      const amount = -money(row.amount);
      const description = String(row.description ?? '');
      const counts = /^(abono|inicial|cancelado)/i.test(description);
      const bankAmount = money(row.bankAmount);
      return {
        id: String(row.id), kind: counts ? 'payment' : 'adjustment',
        title: `${description || 'Abono'}${row.person ? ` · ${row.person}` : ''}`,
        detail: counts ? null : 'No mueve efectivo',
        amount, bankAmount, countsForCash: counts,
        cashAmount: counts ? Number((amount - bankAmount).toFixed(2)) : 0,
        state: (row.state as string) ?? null, createdAt: row.createdAt ?? null, ...author(row),
      };
    }),
    ...(creditRows as Row[]).map((row) => {
      const amount = -money(row.amount) + money(row.extra);
      const bankAmount = money(row.bankAmount);
      return {
        id: String(row.id), kind: 'credit',
        title: `${row.concept ?? 'Prestamo'}${row.person ? ` · ${row.person}` : ''}`,
        detail: money(row.extra) > 0 ? `Cobro adicional ${money(row.extra)}` : null,
        amount, bankAmount, countsForCash: true,
        // Whatever the office paid out by transfer never left the collector's pocket.
        cashAmount: Number((amount + bankAmount).toFixed(2)),
        state: (row.state as string) ?? null, createdAt: row.createdAt ?? null, ...author(row),
      };
    }),
    ...(accountingRows as Row[]).map((row) => {
      const operation = String(row.operation ?? '');
      const name = String(row.name ?? 'Movimiento');
      const isBase = name === 'base';
      const counts = isBase || operation.startsWith('salida-totalizar');
      const amount = money(row.amount);
      return {
        id: String(row.id), kind: isBase ? 'base' : amount < 0 ? 'expense' : 'income',
        title: isBase ? 'Base recibida' : name,
        detail: counts ? (row.detail ? String(row.detail) : null)
          : `${row.detail ? `${row.detail} · ` : ''}Lo maneja la oficina, no entra en el cuadre`,
        amount, bankAmount: 0, countsForCash: counts, cashAmount: counts ? amount : 0,
        state: (row.state as string) ?? null, createdAt: row.createdAt ?? null, ...author(row),
      };
    }),
  ].sort((a, b) => Number(new Date(a.createdAt as string)) - Number(new Date(b.createdAt as string)));

  // Who is holding the money. If somebody else collected on this route, the cash they took is
  // not in my pocket: I only cuadro once they hand it over.
  const collectors: Array<{
    personId: number | null; personName: string | null; cash: number; movements: number; isMe: boolean;
  }> = [];
  for (const movement of movements) {
    if (!movement.countsForCash) continue;
    const current = collectors.find((item) => item.personId === movement.personId);
    const entry = current ?? {
      personId: movement.personId, personName: movement.personName,
      cash: 0, movements: 0, isMe: movement.personId != null && movement.personId === Number(myPersonId),
    };
    entry.cash = Number((entry.cash + movement.cashAmount).toFixed(2));
    entry.movements += 1;
    if (!current) collectors.push(entry);
  }
  collectors.sort((a, b) => Number(b.isMe) - Number(a.isMe) || b.cash - a.cash);

  return {
    routeId, state: (route.state as string) ?? null, canSettle: await canSettle(user, branchId),
    base, collected, collectedBank, otherCollected, credits, creditsBank, expenses,
    expectedCash, movements, collectors,
  };
}

/**
 * What the branch office lets the collector write as a route expense: the categories and the
 * "De" names webgoez publishes (shared catalog 1001 plus the company's own), and the employees
 * allowed by the user's payroll scope, so a sueldo can be tied to the right person.
 */
export async function routeExpenseCatalog(context: AuthContext | null, branchId: number) {
  const user = requireAuth(context);
  await assertBranchAccess(user, branchId);
  const [categoryRows] = await pool.execute(
    `SELECT t.idtipo_contabilidad AS id, t.str_categoria AS category, d.str_de AS name
     FROM tbl_tipo_contabilidad t
     JOIN tbl_de_contabilidad d ON d.idtipo_contabilidad = t.idtipo_contabilidad
       AND d.idglobal IN (?, ?)
     WHERE t.idglobal IN (?, ?) AND t.str_operacion = 'salida'
       AND t.str_categoria NOT IN ('contabilidad','salida')
     ORDER BY t.str_categoria, d.str_de`,
    [SHARED_CATALOG_COMPANY, user.companyId, SHARED_CATALOG_COMPANY, user.companyId],
  );
  const categories: Array<{ id: number; category: string; names: string[] }> = [];
  for (const row of categoryRows as Row[]) {
    const id = Number(row.id);
    const current = categories.find((item) => item.id === id);
    if (current) current.names.push(String(row.name));
    else categories.push({ id, category: String(row.category), names: [String(row.name)] });
  }
  const payrollQuery = authorizedPayrollQuery(user, branchId);
  const [payrollRows] = await pool.execute(payrollQuery.sql, payrollQuery.params);
  const payrolls = (payrollRows as Row[]).map((row) => ({
    id: Number(row.id), name: String(row.name),
    officeId: row.officeId == null ? null : Number(row.officeId),
    officeName: row.officeName == null ? null : String(row.officeName),
    suggested: Number(row.suggested) === 1,
  }));
  return { categories, payrolls };
}

/**
 * The route expenses and bases of the open day, on their own so the phone can keep the list
 * cached and work on it offline without asking for the whole settlement.
 */
export async function routeEntries(context: AuthContext | null, branchId: number) {
  const user = requireAuth(context);
  await assertBranchAccess(user, branchId);
  const route = await openRoute(user.companyId, branchId);
  if (!route) return [];
  const [rows] = await pool.execute(
    `SELECT dc.idcontabilidad_detalle AS id, dc.dec_total AS amount, dc.str_nombre AS name,
            dc.str_detalle AS detail, dc.str_operacion AS operation, dc.str_estado AS state,
            dc.idtipo_contabilidad AS accountingType, dc.created_at AS createdAt,
            COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.str_nombres, p.str_apellidos)), ''), '') AS personName,
            (SELECT dn.idnomina FROM tbl_detalle_nomina dn
              WHERE dn.idcontabilidad_detalle = dc.idcontabilidad_detalle
                AND dn.idglobal = dc.idglobal LIMIT 1) AS payrollId
     FROM tbl_contabilidad_detalle dc
     LEFT JOIN tbl_empleado e ON e.idempleado = dc.created_empleado_id AND e.idglobal = dc.idglobal
     LEFT JOIN tbl_persona p ON p.idpersona = e.idpersona AND p.idglobal = e.idglobal
     WHERE dc.iddetalleruta = ? AND dc.idglobal = ?
       AND (dc.str_operacion LIKE 'salida-totalizar%' OR dc.str_nombre = 'base')
     ORDER BY dc.created_at, dc.idcontabilidad_detalle`,
    [Number(route.id), user.companyId],
  );
  return (rows as Row[]).map((row) => ({
    id: String(row.id),
    kind: row.name === 'base' ? 'base' : 'expense',
    name: String(row.name ?? ''),
    detail: String(row.detail ?? ''),
    // Expenses are stored negative; the phone always works with the amount the collector typed.
    amount: Math.abs(money(row.amount)),
    accountingType: row.accountingType == null ? null : Number(row.accountingType),
    payrollId: row.payrollId == null ? null : Number(row.payrollId),
    personName: String(row.personName ?? '') || null,
    state: (row.state as string) ?? null,
    createdAt: row.createdAt ?? null,
  }));
}

const NAMED_TOTALS = [
  ['efectivo', 8, 'info-totalizar'],
  ['efectivoMonedas', 8, 'info-totalizar'],
  ['diferencia', 7, 'entrada-totalizar'],
] as const;

/**
 * Hands the day in: stores the counted cash and passes every 'created' row of the branch to
 * 'entregando', exactly like model/RecibeCuentas.php::RegistrarContabilidadDetalle. The base is
 * no longer typed here: it is whatever the bases registered during the day add up to, so the
 * money the office handed out can never be rewritten at closing time. The client must send the
 * difference it showed the collector; if the server computes another one the settlement is
 * rejected, so nobody closes a day whose numbers moved underneath them.
 */
export async function settleRoute(
  context: AuthContext | null, branchId: number,
  input: { cash: number; coins: number; difference: number },
) {
  const user = requireAuth(context);
  await assertBranchAccess(user, branchId);
  if (!await canSettle(user, branchId)) fail('FORBIDDEN', 'You are not allowed to hand in the route accounts');
  for (const [name, value] of Object.entries(input)) {
    if (!Number.isFinite(value)) fail('VALIDATION_ERROR', `Invalid ${name}`);
    if (name !== 'difference' && value < 0) fail('VALIDATION_ERROR', `${name} cannot be negative`);
  }

  const summary = await routeSettlement(context, branchId);
  if (summary.routeId == null) fail('BUSINESS_RULE', 'There is no open route to hand in');
  if (summary.state !== 'created') fail('BUSINESS_RULE', 'The route accounts were already handed in');
  const counted = decimalToCents(input.cash.toFixed(2)) + decimalToCents(input.coins.toFixed(2));
  const difference = counted - decimalToCents(summary.expectedCash.toFixed(2));
  if (difference !== decimalToCents(input.difference.toFixed(2))) {
    fail('BUSINESS_RULE', 'The difference does not match the movements; refresh the accounts');
  }

  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const values: Record<string, bigint> = {
      efectivo: decimalToCents(input.cash.toFixed(2)),
      efectivoMonedas: decimalToCents(input.coins.toFixed(2)),
      diferencia: difference,
    };
    for (const [name, accountingType, operation] of NAMED_TOTALS) {
      const amount = values[name];
      const [existing] = await conn.execute(
        `SELECT idcontabilidad_detalle AS id FROM tbl_contabilidad_detalle
         WHERE iddetalleruta = ? AND idglobal = ? AND str_nombre = ? LIMIT 1`,
        [summary.routeId, user.companyId, name],
      );
      const row = (existing as Row[])[0];
      if (row) {
        await conn.execute(
          `UPDATE tbl_contabilidad_detalle SET dec_total = ?, str_estado = 'entregando', update_at = NOW()
           WHERE idcontabilidad_detalle = ? AND idglobal = ?`,
          [centsToDecimal(amount), String(row.id), user.companyId],
        );
      } else if (amount !== 0n) {
        await conn.execute(
          `INSERT INTO tbl_contabilidad_detalle (idcontabilidad_detalle, idglobal, idsucursal,
             idtipo_contabilidad, iddetalleruta, dec_total, str_detalle, str_nombre, str_estado,
             str_operacion, created_empleado_id, created_at, update_at)
           VALUES (?, ?, ?, ?, ?, ?, '', ?, 'entregando', ?, ?, NOW(), NOW())`,
          [randomOperationId(), user.companyId, branchId, accountingType, summary.routeId,
            centsToDecimal(amount), name, operation, user.employeeId],
        );
      }
    }
    for (const table of ['tbl_descripcion', 'tbl_tarjetas', 'tbl_contabilidad_detalle', 'tbl_detalle_ruta']) {
      await conn.execute(
        `UPDATE ${table} SET str_estado = 'entregando'
         WHERE idsucursal = ? AND idglobal = ? AND str_estado = 'created'`,
        [branchId, user.companyId],
      );
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
  return { ...await routeSettlement(context, branchId), difference: Number(centsToDecimal(difference)) };
}

// webgoez' uniqidReal(): 13 random hex chars, matching the legacy CHAR primary keys.
function randomOperationId() {
  return randomBytes(7).toString('hex').slice(0, 13);
}
