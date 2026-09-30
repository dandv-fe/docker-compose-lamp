import { pool } from '../db.js';
import {
  assertBranchAccess, assertRecordBranch, hasPermission, isOfficeAdministrator, listBranches, requireAnyPermission,
  requirePermission, type AuthContext,
} from './auth.js';
import { fail } from './errors.js';
import { branchScopeExists, materializeSyncEvent, type SyncEventRow } from './sync.js';

function requireAuth(context: AuthContext | null) {
  if (!context) fail('UNAUTHENTICATED', 'Authentication is required');
  return context.user;
}

export async function me(context: AuthContext | null) {
  const user = requireAuth(context);
  return { ...user, branches: await listBranches(user) };
}

export async function branches(context: AuthContext | null) {
  return listBranches(requireAuth(context));
}

// Menu/action permission names read from tbl_auth in webgoez, gating the cartera
// sub-screens (see views/nav.html) and the document-masking checks inside them.
const KNOWN_BRANCH_PERMISSIONS = [
  'ver morosos', 'ver retirados', 'ver canceladas', 'ver clientes',
  'documento', 'ver documento', 'pasar activos', 'pasar activos retirados', 'nueva tarjeta', 'crear cliente',
];

export async function branchPermissions(context: AuthContext | null, branchId: number) {
  const user = requireAuth(context);
  await assertBranchAccess(user, branchId);
  if (user.cargo === 'Super Administrador' || await isOfficeAdministrator(user, branchId)) {
    return KNOWN_BRANCH_PERMISSIONS;
  }
  const granted = new Set(
    context!.permissions.filter((p) => p.branchId === branchId).map((p) => p.name),
  );
  return KNOWN_BRANCH_PERMISSIONS.filter((permission) => granted.has(permission));
}

const CUSTOMER_FIELDS = `
 c.idcliente AS id, c.idglobal AS companyId, p.idpersona AS personId,
 p.str_nombres AS firstName, p.str_apellidos AS lastName, p.str_sexo AS sex,
 p.str_fecha_nacimiento AS birthDate, p.str_tipo_documento AS documentType,
 p.str_num_documento AS documentNumber, p.str_telefono AS phone, p.str_email AS email,
 p.str_foto AS photo, p.str_ocupacion AS occupation, p.str_estado AS personStatus,
 p.str_nota AS personNote, p.str_direccion_departamento AS department,
 p.str_direccion_ciudad AS city, p.str_direccion_barrio AS neighborhood,
 p.str_direccion_calle AS street, c.dec_max_credito AS maxCredit,
 c.str_apodo AS nickname, c.str_nota AS note, c.str_estado AS status,
 c.str_calificacion AS rating, c.fiador_persona_id AS guarantorPersonId`;

const CUSTOMER_FROM = `FROM tbl_clientes c
 JOIN tbl_persona p ON p.idpersona = c.idpersona AND p.idglobal = c.idglobal`;

// Matches model/Cartera.php::listRuta(), which excludes these tbl_tarjetas.str_estado
// values from the main route/portfolio listing (a separate legacy screen handles
// cancelled cards). Detail lookups (customerById/customerByDocument) intentionally
// do not use this list, mirroring buscarTarjetas() which returns every card.
const PORTFOLIO_EXCLUDED_CREDIT_STATUSES = ['cancelado', 'inactiva', 'moroso', 'fallecio', 'discapacitado'];

async function addBranchCredits(
  companyId: number, branchId: number, customers: Array<Record<string, unknown>>,
  options: { excludeInactiveStatuses?: boolean } = {},
) {
  if (!customers.length) return customers;
  const ids = customers.map((customer) => Number(customer.id));
  const placeholders = ids.map(() => '?').join(',');
  const statusFilter = options.excludeInactiveStatuses
    ? ` AND t.str_estado NOT IN (${PORTFOLIO_EXCLUDED_CREDIT_STATUSES.map(() => '?').join(',')})`
    : '';
  const [rows] = await pool.execute(
    `SELECT t.idtarjeta AS id,t.idglobal AS companyId,t.idsucursal AS branchId,
            t.idcliente AS customerId,t.idventa AS saleId,t.iddetalleruta AS routeId,
            t.str_concepto AS concept,t.dec_valor AS value,t.str_modo AS frequency,
            t.int_tiempo AS term,t.dec_prestamo AS principal,t.dec_resta AS balance,
            t.str_descripcion AS description,t.float_item AS sortOrder,t.dec_utilidad AS profit,
            t.str_c_adicional_numero AS additionalNumber,t.dec_c_adicional_valor AS additionalValue,
            t.str_tipo_comprobante AS receiptType,t.str_serie AS receiptSeries,
            t.str_numero AS receiptNumber,t.str_nota AS note,t.str_abono AS paymentSummary,
            t.str_style AS style,t.str_estado AS status,
            t.created_empleado_id AS createdEmployeeId,t.date_acuerdo AS agreementDate,
            t.created_at AS createdAt,t.updated_at AS updatedAt
     FROM tbl_tarjetas t
     WHERE t.idglobal = ? AND t.idsucursal = ? AND t.idcliente IN (${placeholders})${statusFilter}
     ORDER BY t.float_item,t.created_at`,
    [companyId, branchId, ...ids, ...(options.excludeInactiveStatuses ? PORTFOLIO_EXCLUDED_CREDIT_STATUSES : [])],
  );
  const creditsByCustomer = new Map<number, unknown[]>();
  for (const credit of rows as Array<Record<string, unknown>>) {
    const key = Number(credit.customerId);
    const existing = creditsByCustomer.get(key) ?? [];
    existing.push(credit);
    creditsByCustomer.set(key, existing);
  }
  const creditIds = [...new Set((rows as Array<Record<string, unknown>>).map((credit) => String(credit.id)))];
  if (creditIds.length) {
    const paymentPlaceholders = creditIds.map(() => '?').join(',');
    const [paymentRows] = await pool.execute(
      `SELECT id, creditId, amount, description, state, createdAt, updatedAt, routeId,
              createdByUserId, origin, createdByUsername
       FROM (
         SELECT d.iddescripcion AS id, d.idtarjeta AS creditId, d.dec_abono AS amount,
                d.str_descripcion AS description, d.str_estado AS state,
                d.created_at AS createdAt, d.updated_at AS updatedAt,
                d.iddetalleruta AS routeId,
                d.idusuario AS createdByUserId, d.str_origen AS origin,
                COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.str_nombres, p.str_apellidos)), ''), u.str_user_name)
                    AS createdByUsername,
                ROW_NUMBER() OVER (
                  PARTITION BY d.idtarjeta ORDER BY d.created_at DESC, d.iddescripcion DESC
                ) AS paymentRank
         FROM tbl_descripcion d
         LEFT JOIN tbl_usuario u ON u.idusuario = d.idusuario AND u.idglobal = d.idglobal
         LEFT JOIN tbl_persona p ON p.idpersona = u.idpersona AND p.idglobal = u.idglobal
         WHERE d.idglobal = ? AND d.idsucursal = ? AND d.idtarjeta IN (${paymentPlaceholders})
       ) latestPayments
       WHERE paymentRank = 1`,
      [companyId, branchId, ...creditIds],
    );
    const latestPaymentsByCredit = new Map(
      (paymentRows as Array<Record<string, unknown>>).map((payment) => [String(payment.creditId), payment]),
    );
    for (const credit of rows as Array<Record<string, unknown>>) {
      credit.latestPayment = latestPaymentsByCredit.get(String(credit.id)) ?? null;
    }
  }
  for (const customer of customers) customer.credits = creditsByCustomer.get(Number(customer.id)) ?? [];
  return customers;
}

async function addCustomerComments(customers: Array<Record<string, unknown>>) {
  if (!customers.length) return customers;
  const ids = customers.map((customer) => Number(customer.id));
  const [rows] = await pool.execute(
    `SELECT l.idcliente AS customerId,c.idcomentario AS id,
            c.str_comentario AS comment,c.str_tipo AS type,c.idusuario AS userId,
            c.created_at AS createdAt,c.update_at AS updatedAt
     FROM tbl_comentarios_cliente l JOIN tbl_comentarios c ON c.idcomentario=l.idcomentario
     WHERE l.idcliente IN (${ids.map(() => '?').join(',')})
     ORDER BY c.created_at,c.idcomentario`,
    ids,
  );
  const commentsByCustomer = new Map<number, unknown[]>();
  for (const comment of rows as Array<Record<string, unknown>>) {
    const key = Number(comment.customerId);
    const existing = commentsByCustomer.get(key) ?? [];
    existing.push(comment);
    commentsByCustomer.set(key, existing);
  }
  for (const customer of customers) customer.comments = commentsByCustomer.get(Number(customer.id)) ?? [];
  return customers;
}

export async function portfolio(
  context: AuthContext | null,
  branchId: number,
  first = 50,
  after?: string | null,
  snapshotCursor?: string | null,
) {
  const user = requireAuth(context);
  await assertBranchAccess(user, branchId);
  if (!Number.isInteger(first) || first < 1 || first > 100) fail('VALIDATION_ERROR', 'first must be between 1 and 100');
  const [cursorRows] = await pool.execute(
    `SELECT COALESCE(MAX(id), 0) AS max_cursor FROM mobile_change_event
     WHERE idglobal = ? AND idsucursal = ?`,
    [user.companyId, branchId],
  );
  const maxCursor = String((cursorRows as Array<{ max_cursor: string | number }>)[0]?.max_cursor ?? 0);
  if (snapshotCursor != null && !/^\d+$/.test(snapshotCursor)) fail('VALIDATION_ERROR', 'Invalid snapshot cursor');
  if (snapshotCursor != null && BigInt(snapshotCursor) > BigInt(maxCursor)) {
    fail('VALIDATION_ERROR', 'snapshotCursor cannot be ahead of the server cursor');
  }
  const snapshot = snapshotCursor ?? maxCursor;
  const afterId = after ? Number(after) : 0;
  if (after && (!Number.isSafeInteger(afterId) || afterId < 0)) fail('VALIDATION_ERROR', 'Invalid after cursor');
  const [rows] = await pool.execute(
    `SELECT ${CUSTOMER_FIELDS} ${CUSTOMER_FROM}
     WHERE c.idglobal = ? AND c.idcliente > ? AND ${branchScopeExists('c')}
     ORDER BY c.idcliente LIMIT ?`,
    [user.companyId, afterId, branchId, branchId, branchId, first + 1],
  );
  const result = rows as Array<Record<string, unknown>>;
  const hasNextPage = result.length > first;
  const rawNodes = result.slice(0, first);
  // Pagination cursor is derived from the raw (unfiltered) page so that hiding
  // customers with no visible credits below never skips or repeats a customer.
  const nextCursor = hasNextPage ? String(rawNodes[rawNodes.length - 1]?.id) : null;
  await addBranchCredits(user.companyId, branchId, rawNodes, { excludeInactiveStatuses: true });
  await addCustomerComments(rawNodes);
  // Mirrors model/Cartera.php::listRuta(): a customer with no non-excluded credits
  // does not appear in the main portfolio listing, with no exception for customers
  // that have no credits at all yet.
  const nodes = rawNodes.filter(
    (customer) => Array.isArray(customer.credits) && (customer.credits as unknown[]).length > 0,
  );
  return {
    nodes,
    snapshotCursor: snapshot,
    nextCursor,
    hasNextPage,
  };
}

export async function customerById(context: AuthContext | null, branchId: number, id: number) {
  const user = requireAuth(context);
  await assertBranchAccess(user, branchId);
  const [rows] = await pool.execute(
    `SELECT ${CUSTOMER_FIELDS} ${CUSTOMER_FROM}
     WHERE c.idglobal = ? AND c.idcliente = ? AND ${branchScopeExists('c')} LIMIT 1`,
    [user.companyId, id, branchId, branchId, branchId],
  );
  const customer = (rows as Array<Record<string, unknown>>)[0];
  if (!customer) fail('NOT_FOUND', 'Customer not found');
  await addBranchCredits(user.companyId, branchId, [customer]);
  await addCustomerComments([customer]);
  return customer;
}

export async function customerByDocument(
  context: AuthContext | null,
  branchId: number,
  documentType: string,
  documentNumber: string,
) {
  const user = requireAuth(context);
  await assertBranchAccess(user, branchId);
  const canLookUpCompanyCustomer = await hasPermission(user, branchId, 'nueva tarjeta');
  const [rows] = await pool.execute(
    `SELECT ${CUSTOMER_FIELDS} ${CUSTOMER_FROM}
     WHERE c.idglobal = ? AND p.str_tipo_documento = ? AND p.str_num_documento = ?
       ${canLookUpCompanyCustomer ? '' : `AND ${branchScopeExists('c')}`} LIMIT 1`,
    [user.companyId, documentType, documentNumber,
      ...(canLookUpCompanyCustomer ? [] : [branchId, branchId, branchId])],
  );
  const customer = (rows as Array<Record<string, unknown>>)[0];
  if (!customer) fail('NOT_FOUND', 'Customer not found');
  await addBranchCredits(user.companyId, branchId, [customer]);
  await addCustomerComments([customer]);
  return customer;
}

export async function customerCandidate(
  context: AuthContext | null, branchId: number, documentType: string, documentNumber: string,
) {
  const user = requireAuth(context);
  await assertBranchAccess(user, branchId);
  if (!await hasPermission(user, branchId, 'crear cliente') &&
      !await hasPermission(user, branchId, 'nueva tarjeta')) {
    fail('FORBIDDEN', 'No tienes permiso para buscar clientes para una nueva tarjeta o crear clientes.');
  }
  const [rows] = await pool.execute(
    `SELECT p.idpersona AS personId, c.idcliente AS customerId,
            p.str_nombres AS firstName, p.str_apellidos AS lastName,
            p.str_sexo AS sex, p.str_fecha_nacimiento AS birthDate,
            p.str_tipo_documento AS documentType, p.str_num_documento AS documentNumber,
            p.str_telefono AS phone, p.str_email AS email, p.str_ocupacion AS occupation,
            p.str_nota AS personNote, p.str_direccion_departamento AS department,
            p.str_direccion_ciudad AS city, p.str_direccion_barrio AS neighborhood,
            p.str_direccion_calle AS street
     FROM tbl_persona p
     LEFT JOIN tbl_clientes c ON c.idpersona=p.idpersona AND c.idglobal=p.idglobal
     WHERE p.idglobal=? AND p.str_tipo_documento=? AND p.str_num_documento=? LIMIT 1`,
    [user.companyId, documentType, documentNumber],
  );
  return (rows as Array<Record<string, unknown>>)[0] ?? null;
}

export async function personDocumentTypes(context: AuthContext | null, branchId: number) {
  const user = requireAuth(context);
  await assertBranchAccess(user, branchId);
  const [rows] = await pool.execute(
    "SELECT str_nombre AS name FROM tbl_tipo_documento WHERE str_operacion='Persona' ORDER BY str_nombre",
  );
  return rows;
}

// --- Cartera sub-screens (webgoez views/nav.html "Créditos" submenu) ---
// Read directly from the legacy view_ruta / view_list_client views so results stay in
// lockstep with the PHP app; only the branch/status/date filters are parameterized here.

export async function defaultersOfPortfolio(context: AuthContext | null, branchId: number) {
  const user = requireAuth(context);
  await requirePermission(user, branchId, 'ver morosos');
  const [rows] = await pool.execute(
    `SELECT refTarjeta AS id, resta AS balance, costo AS principal, valor AS value,
            ut_adi_valor AS additionalValue, fecha_at AS createdAt, cliente AS customerName,
            t_documento AS documentType, n_documento AS documentNumber, tel AS phone
     FROM view_ruta WHERE refSucursal = ? AND estado = 'moroso'`,
    [branchId],
  );
  return rows;
}

export async function withdrawnOfPortfolio(context: AuthContext | null, branchId: number) {
  const user = requireAuth(context);
  await requirePermission(user, branchId, 'ver retirados');
  const [rows] = await pool.execute(
    `SELECT refTarjeta AS id, resta AS balance, costo AS principal, valor AS value,
            ut_adi_valor AS additionalValue, fecha_at AS createdAt, cliente AS customerName,
            t_documento AS documentType, n_documento AS documentNumber, tel AS phone,
            estado AS status
     FROM view_ruta WHERE refSucursal = ? AND (estado = 'fallecio' OR estado = 'discapacitado')`,
    [branchId],
  );
  return rows;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export async function cancelledCredits(
  context: AuthContext | null, branchId: number, dateFrom: string, dateTo: string,
) {
  const user = requireAuth(context);
  await requirePermission(user, branchId, 'ver canceladas');
  if (!DATE_ONLY.test(dateFrom) || !DATE_ONLY.test(dateTo)) {
    fail('VALIDATION_ERROR', 'dateFrom and dateTo must use YYYY-MM-DD');
  }
  // Matches Cartera.php::listTarjetasCanceladas(): the upper bound is exclusive of time,
  // so it is pushed one day forward to include every timestamp on the "hasta" day.
  const nextDay = new Date(`${dateTo}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const untilNextDay = nextDay.toISOString().slice(0, 10);
  const canSeeDocument = await hasPermission(user, branchId, 'documento');
  const [rows] = await pool.execute(
    `SELECT r.refTarjeta AS id, r.valor AS value, r.costo AS principal,
            r.ut_adi_valor AS additionalValue, r.fecha_at AS createdAt, r.cliente AS customerName,
            r.t_documento AS documentType, r.n_documento AS documentNumber, r.tel AS phone,
            d.dec_abono AS paidAmount, d.str_descripcion AS description,
            d.created_at AS cancelledAt
     FROM view_ruta r INNER JOIN tbl_descripcion d ON d.idtarjeta = r.refTarjeta
     WHERE r.refSucursal = ? AND d.str_descripcion = 'Cancelado' AND r.estado = 'cancelado'
       AND d.created_at >= ? AND d.created_at <= ?`,
    [branchId, dateFrom, untilNextDay],
  );
  if (canSeeDocument) return rows;
  return (rows as Array<Record<string, unknown>>).map((row) => ({ ...row, documentNumber: null }));
}

export async function portfolioClients(context: AuthContext | null, branchId: number) {
  const user = requireAuth(context);
  await requirePermission(user, branchId, 'ver clientes');
  const canSeeDocument = await hasPermission(user, branchId, 'ver documento');
  const [rows] = await pool.execute(
    `SELECT refPersona AS personId, nombres AS firstName, apellidos AS lastName,
            t_documento AS documentType, n_documento AS documentNumber, sexo AS sex,
            f_nacimiento AS birthDate, ocupacion AS occupation, telefono AS phone,
            email, departamento AS department, ciudad AS city, barrio AS neighborhood,
            calle AS street, estado_cliente AS customerStatus, max_credito AS maxCredit,
            apodo AS nickname
     FROM view_list_client WHERE refSucursal = ?`,
    [branchId],
  );
  if (canSeeDocument) return rows;
  return (rows as Array<Record<string, unknown>>).map((row) => ({ ...row, documentNumber: null }));
}

const RESTORABLE_STATES = new Set(['moroso', 'fallecio', 'discapacitado']);

// Mirrors model/Cliente.php::restaurarMoroso(): it does NOT set the credit back to
// 'activa'; it stores the literal string "estubo en los <estado_anterior>" instead.
// Both the Morosos and Retirados "Restaurar" buttons call this same legacy behaviour.
export async function restoreCredit(context: AuthContext | null, branchId: number, creditId: string) {
  const user = requireAuth(context);
  await requireAnyPermission(user, branchId, ['pasar activos', 'pasar activos retirados']);
  const [rows] = await pool.execute(
    `SELECT str_estado AS state FROM tbl_tarjetas WHERE idtarjeta = ? AND idsucursal = ? AND idglobal = ? LIMIT 1`,
    [creditId, branchId, user.companyId],
  );
  const credit = (rows as Array<{ state: string }>)[0];
  if (!credit) fail('NOT_FOUND', 'Credit not found');
  if (!RESTORABLE_STATES.has(credit.state)) {
    fail('VALIDATION_ERROR', 'Only moroso, fallecio or discapacitado credits can be restored');
  }
  const newState = `estubo en los ${credit.state}`;
  await pool.execute(
    `UPDATE tbl_tarjetas SET str_estado = ? WHERE idtarjeta = ? AND idsucursal = ? AND idglobal = ?`,
    [newState, creditId, branchId, user.companyId],
  );
  return { id: creditId, previousState: credit.state, state: newState };
}

export async function paymentHistory(context: AuthContext | null, branchId: number, creditId: string) {
  const user = requireAuth(context);
  await assertRecordBranch(user, branchId, 'tbl_tarjetas', 'idtarjeta', creditId);
  const [rows] = await pool.execute(
    `SELECT d.iddescripcion AS id, d.idtarjeta AS creditId, d.dec_abono AS amount,
            d.str_descripcion AS description, d.str_estado AS state,
            d.created_at AS createdAt, d.updated_at AS updatedAt,
            d.iddetalleruta AS routeId,
            d.idusuario AS createdByUserId, d.str_origen AS origin,
            COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.str_nombres, p.str_apellidos)), ''), u.str_user_name)
                AS createdByUsername
     FROM tbl_descripcion d
     JOIN tbl_tarjetas t ON t.idtarjeta = d.idtarjeta
     LEFT JOIN tbl_usuario u ON u.idusuario = d.idusuario AND u.idglobal = d.idglobal
     LEFT JOIN tbl_persona p ON p.idpersona = u.idpersona AND p.idglobal = u.idglobal
     WHERE d.idtarjeta = ? AND d.idsucursal = ? AND d.idglobal = ?
       AND t.idsucursal = ? AND t.idglobal = ?
     ORDER BY d.created_at, d.iddescripcion`,
    [creditId, branchId, user.companyId, branchId, user.companyId],
  );
  return rows;
}

export async function receiptSequences(context: AuthContext | null, branchId: number) {
  const user = requireAuth(context);
  await assertBranchAccess(user, branchId);
  // Mirrors the legacy Cartera::GetTipoDocSerieNum: the branch's receipt counters feed the
  // "Crear Tarjeta" form, which is why only 'Comprobante' document types are returned.
  const [rows] = await pool.execute(
    `SELECT dds.iddetalle_documento_sucursal AS id, dds.str_ultima_serie AS series,
            dds.str_ultimo_numero AS lastNumber, td.str_nombre AS documentType
     FROM tbl_detalle_documento_sucursal dds
     JOIN tbl_tipo_documento td ON td.idtipo_documento = dds.idtipo_documento
     WHERE td.str_operacion = 'Comprobante' AND dds.idsucursal = ? AND dds.idglobal = ?
     ORDER BY dds.iddetalle_documento_sucursal`,
    [branchId, user.companyId],
  );
  return rows;
}

// Pocket-cash inputs of the branch's open (not yet 'saved') route day, read from the same
// tbl_contabilidad_detalle rows webgoez' "Detalle de cobro" totals. Abonos, seguros and new
// credits are left to the client because it already caches them per card.
// - base: the cash the collector started the day with ('base').
// - otherIncome: entradas other than the recaudo/diferencia the totalizer writes.
// - expenses: every salida except tipo 4 (prestamos/articulos, i.e. the new credits).
export async function openRouteCash(context: AuthContext | null, branchId: number) {
  const user = requireAuth(context);
  await assertBranchAccess(user, branchId);
  const [rows] = await pool.execute(
    `SELECT dr.iddetalleruta AS routeId,
            COALESCE(SUM(CASE WHEN dc.str_nombre = 'base' THEN dc.dec_total END), 0) AS base,
            COALESCE(SUM(CASE WHEN dc.str_operacion LIKE 'entrada-%'
                               AND dc.str_nombre NOT IN ('recaudo', 'diferencia') THEN dc.dec_total END), 0) AS otherIncome,
            COALESCE(-SUM(CASE WHEN dc.str_operacion LIKE 'salida-%'
                                AND dc.idtipo_contabilidad <> 4 THEN dc.dec_total END), 0) AS expenses
     FROM (SELECT iddetalleruta FROM tbl_detalle_ruta
           WHERE idsucursal = ? AND idglobal = ? AND str_estado <> 'saved'
           ORDER BY created_at DESC LIMIT 1) dr
     LEFT JOIN tbl_contabilidad_detalle dc
       ON dc.iddetalleruta = dr.iddetalleruta AND dc.idsucursal = ? AND dc.idglobal = ?
     GROUP BY dr.iddetalleruta`,
    [branchId, user.companyId, branchId, user.companyId],
  );
  const row = (rows as Array<Record<string, unknown>>)[0];
  if (!row) return { routeId: null, base: 0, otherIncome: 0, expenses: 0 };
  return {
    routeId: Number(row.routeId),
    base: Number(row.base),
    otherIncome: Number(row.otherIncome),
    expenses: Number(row.expenses),
  };
}

export async function syncChanges(context: AuthContext | null, branchId: number, after: string, first = 100) {
  const user = requireAuth(context);
  await assertBranchAccess(user, branchId);
  if (!/^\d+$/.test(after) || !Number.isInteger(first) || first < 1 || first > 500) {
    fail('VALIDATION_ERROR', 'Invalid sync cursor or page size');
  }
  const [watermarkRows] = await pool.execute(
    `SELECT CAST(COALESCE(MAX(id),0) AS CHAR) AS watermark
     FROM mobile_change_event WHERE idglobal=? AND idsucursal=?`,
    [user.companyId, branchId],
  );
  const watermark = String((watermarkRows as Array<{ watermark: string | number }>)[0]?.watermark ?? 0);
  if (BigInt(after) > BigInt(watermark)) {
    fail('VALIDATION_ERROR', 'Sync cursor cannot be ahead of the selected branch');
  }
  const [rows] = await pool.execute(
    `SELECT CAST(id AS CHAR) AS \`cursor\`, record_type AS recordType,
            record_id AS recordId, related_id AS relatedId, action, created_at AS createdAt
     FROM mobile_change_event
     WHERE idglobal = ? AND idsucursal = ? AND id > ? AND id <= ?
       AND record_type IN ('customer','credit','payment','comment','route','receipt_sequence')
     ORDER BY id LIMIT ?`,
    [user.companyId, branchId, after, watermark, first + 1],
  );
  const fetched = rows as SyncEventRow[];
  const hasNextPage = fetched.length > first;
  const events = fetched.slice(0, first);
  const execute = async (sql: string, params?: unknown[]): Promise<[unknown, unknown]> =>
    pool.execute(sql, params as never) as Promise<[unknown, unknown]>;
  const changes = [];
  for (let offset = 0; offset < events.length; offset += 10) {
    const batch = events.slice(offset, offset + 10);
    changes.push(...await Promise.all(batch.map((event) =>
      materializeSyncEvent(execute, user, branchId, event))));
  }
  const nodes = changes.filter((change) => change !== null);
  return {
    nodes,
    hasNextPage,
    nextCursor: hasNextPage
      ? String(events[events.length - 1]?.cursor ?? after)
      : watermark,
  };
}
