import { RATING_STATE_FIELDS, RATING_STATE_JOIN } from './ratingState.js';
import { unlink } from 'node:fs/promises';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { GraphQLError } from 'graphql';
import { getConnection } from '../db.js';
import { assertBranchAccess, requirePermission, requireTemporaryCashPermission, type AuthContext } from './auth.js';
import { fail, mapTransactionError } from './errors.js';
import { savePhoto } from './files.js';
import { branchScopeExists } from './sync.js';
import { customerPhones, normalizePhone, phoneForChange, requirePhone } from './phones.js';
import { assertReceiptTarget, countReceiptOpen, type ReceiptKind } from './receipts.js';
import { authorizedPayrollQuery } from './payroll.js';
import {
  assertBaseVersion, assertPayloadDigestMatch, centsToDecimal, decimalToCents,
  parseOperationPayload, payloadDigest, rejectExistingAlert, serializeAlert,
} from './validation.js';

const operationKinds = [
  'ADD_CUSTOMER_PHONE', 'SELECT_CUSTOMER_PHONE', 'SET_CUSTOMER_PHONE_VALIDITY', 'RECORD_WHATSAPP_OPEN',
  'RECORD_WHATSAPP_RECEIPT', 'CREATE_CUSTOMER', 'UPDATE_CUSTOMER', 'UPDATE_DOCUMENT', 'CREATE_CREDIT', 'UPDATE_CREDIT',
  'UPDATE_CREDIT_TERMS', 'CREATE_PAYMENT', 'UPDATE_PAYMENT', 'DELETE_PAYMENT', 'DELETE_CREDIT',
  'APPLY_DISCOUNT', 'ADD_INTEREST', 'CHANGE_CREDIT_STATUS', 'REORDER_CREDIT', 'CREATE_COMMENT',
  'UPDATE_COMMENT', 'DELETE_COMMENT', 'CREATE_LOCATION', 'DELETE_LOCATION', 'UPSERT_ALERT',
  'CREATE_EXPENSE', 'UPDATE_EXPENSE', 'DELETE_EXPENSE',
  'CREATE_BASE', 'UPDATE_BASE', 'DELETE_BASE',
] as const;
type Kind = typeof operationKinds[number];

// Records that live inside a route day (tbl_detalle_ruta). They only make sense while that exact
// route is still 'created': once it is handed over ('entregando'), settled ('saved') or gone,
// the record can never be applied and the device must drop it from its queue.
export const routeBoundKinds: ReadonlySet<Kind> = new Set<Kind>([
  'CREATE_CREDIT', 'DELETE_CREDIT', 'CREATE_PAYMENT', 'UPDATE_PAYMENT', 'DELETE_PAYMENT',
  'APPLY_DISCOUNT', 'ADD_INTEREST',
  'CREATE_EXPENSE', 'UPDATE_EXPENSE', 'DELETE_EXPENSE', 'CREATE_BASE', 'UPDATE_BASE', 'DELETE_BASE',
]);

export function isRouteBoundKind(kind: string): boolean {
  return routeBoundKinds.has(kind as Kind);
}

// The route the device queued against must still exist in this branch and still be 'created'.
// 'entregando' is recoverable: the office can unlock the day back to 'created' from webgoez, so the
// record keeps its place in the queue and may be resent. Anything else is final.
export async function assertQueuedRouteOpen(
  conn: SqlConnection, companyId: number, branchId: number, routeId: number,
) {
  const [rows] = await conn.execute<RowDataPacket[]>(
    `SELECT str_estado FROM tbl_detalle_ruta
     WHERE iddetalleruta = ? AND idglobal = ? AND idsucursal = ? FOR UPDATE`,
    [routeId, companyId, branchId],
  );
  if (!rows[0]) fail('ROUTE_CLOSED', 'La ruta de este registro ya no existe en la sucursal.');
  if (rows[0].str_estado === 'entregando') {
    fail('ROUTE_REOPENABLE', 'La ruta ya se entregó. Si la oficina la desbloquea, este registro se puede volver a enviar.');
  }
  if (rows[0].str_estado !== 'created') {
    fail('ROUTE_CLOSED', `La ruta de este registro ya está en estado ${rows[0].str_estado}; no se puede aplicar.`);
  }
}

export interface OfflineInput {
  operationId: string;
  branchId: number;
  kind: Kind;
  entityId: string;
  baseVersion?: string | null;
  // iddetalleruta the device saw open when it queued the record. Optional only so operations
  // queued by older app versions still go through; new ones always carry it.
  routeId?: number | null;
  payload: unknown;
}

type OperationResult = {
  operationId: string;
  status: string;
  entityId: string;
  data: unknown;
  eventCursor: string;
  replayed?: boolean;
};
type CustomerRow = RowDataPacket & {
  idcliente: number; idpersona: number; idglobal: number; dec_max_credito: number | string;
  str_estado: string; str_email: string; str_num_documento: string; str_tipo_documento: string;
};
type CreditRow = RowDataPacket & {
  idtarjeta: string; idglobal: number; idsucursal: number; idcliente: number;
  iddetalleruta: number; dec_valor: number | string; dec_resta: number | string;
  dec_prestamo: number | string; str_estado: string; int_tiempo: number;
  dec_utilidad: number | string;
};
type LocationRow = RowDataPacket & {
  idlocation: string; idglobal: number; idsucursal: number; idtarjeta: string;
  str_nombre: string; dec_latitud: number | string; dec_longitud: number | string;
  int_precision_m: number | null; idusuario: number; created_at: Date | string | null;
};
type SqlConnection = Omit<PoolConnection, 'execute'> & {
  execute<T = unknown>(sql: string, values?: unknown[]): Promise<[T, unknown]>;
};

const permissions: Partial<Record<Kind, string>> = {
  // Phone-only operations are an explicit exception: branch/customer access is still required.
  CREATE_CUSTOMER: 'crear cliente',
  UPDATE_CUSTOMER: 'editar cliente',
  UPDATE_DOCUMENT: 'editar cliente',
  CREATE_CREDIT: 'nueva tarjeta',
  UPDATE_CREDIT: 'editar cuota',
  UPDATE_CREDIT_TERMS: 'editar cuota',
  CREATE_PAYMENT: 'editar cuota',
  UPDATE_PAYMENT: 'editar cuota',
  DELETE_PAYMENT: 'eliminar cuota',
  DELETE_CREDIT: 'eliminar credito',
  APPLY_DISCOUNT: 'descuento',
  ADD_INTEREST: 'cobrar intereser',
  CHANGE_CREDIT_STATUS: 'pasar a morosos',
  REORDER_CREDIT: 'ordenar',
};

export function permissionForOperation(kind: Kind, payload: Record<string, unknown>) {
  if (kind === 'CHANGE_CREDIT_STATUS') {
    return payload.status === 'moroso' ? 'pasar a morosos' : 'pasar a retirados';
  }
  return permissions[kind];
}

// Requires migrations/002_payment_author.sql (tbl_descripcion.idusuario/str_origen).
const PAYMENT_ORIGIN = 'android';

// webgoez publishes the shared expense catalog under company 1001 and lets each company add
// its own rows (model/RecibeCuentas.php: listTipoContabilidadS / listDeContabilidad).
const SHARED_CATALOG_COMPANY = 1001;

function requireAuth(context: AuthContext | null) {
  if (!context) fail('UNAUTHENTICATED', 'Authentication is required');
  return context.user;
}

function conflict(message: string, currentRecord: unknown): never {
  throw new GraphQLError(message, { extensions: { code: 'CONFLICT', currentRecord } });
}

function values(payload: Record<string, unknown>, ...keys: string[]) {
  return keys.map((key) => payload[key]);
}

function decimal(value: unknown) {
  return centsToDecimal(decimalToCents(value as number | string));
}

export function creditPricingAllowed(
  total: number | string | null | undefined,
  cost: number | string | null | undefined,
  isSuperAdministrator: boolean,
) {
  const totalCents = decimalToCents(String(total ?? 0));
  const costCents = decimalToCents(String(cost ?? 0));
  if (totalCents <= 0n || costCents <= 0n || totalCents < costCents) return false;
  return isSuperAdministrator || totalCents * 100n >= costCents * 120n;
}

export function nextReceiptNumber(lastNumber: string): string {
  const match = /^(.*?)(\d+)$/.exec(lastNumber.trim());
  if (!match && lastNumber.trim()) fail('BUSINESS_RULE', 'Receipt counter has no numeric suffix');
  if (!match) return '1';
  const next = match[1] + (BigInt(match[2]) + 1n).toString().padStart(match[2].length, '0');
  if (next.length > 10) fail('BUSINESS_RULE', 'Receipt counter has reached its column limit');
  return next;
}

export function planPositionBesideCard(
  cards: Array<{ id: string; item: number }>, anchorId: string, placement: 'antes' | 'despues',
): { item: number; moved: Array<{ id: string; item: number }> } {
  const index = cards.findIndex((card) => card.id === anchorId);
  if (index < 0) fail('CONFLICT', 'The selected card is no longer in this branch; synchronize the portfolio');
  if (cards.some((card) => !Number.isFinite(card.item))) {
    fail('BUSINESS_RULE', 'The route contains an invalid position');
  }
  const anchor = cards[index].item;
  const neighbor = cards[index + (placement === 'antes' ? -1 : 1)]?.item;
  const value = Math.fround(neighbor === undefined
    ? anchor + (placement === 'antes' ? -1.1 : 1.1)
    : (anchor + neighbor) / 2);
  const lower = placement === 'antes' ? neighbor : anchor;
  const upper = placement === 'antes' ? anchor : neighbor;
  if (Number.isFinite(value) && (lower === undefined || value > lower) &&
      (upper === undefined || value < upper) && !cards.some((card) => card.item === value)) {
    return { item: value, moved: [] };
  }
  const insertAt = index + (placement === 'despues' ? 1 : 0);
  // Every integer up to 2^24 is exactly representable by MariaDB FLOAT.
  if (cards.length + 1 > 2 ** 24) fail('BUSINESS_RULE', 'The route exceeds FLOAT precision');
  return {
    item: insertAt + 1,
    moved: cards.flatMap((card, position) => {
      const item = position + 1 + (position >= insertAt ? 1 : 0);
      return card.item === item ? [] : [{ id: card.id, item }];
    }),
  };
}

export function positionBesideCard(
  cards: Array<{ id: string; item: number }>, anchorId: string, placement: 'antes' | 'despues',
): number {
  return planPositionBesideCard(cards, anchorId, placement).item;
}

function asMoneyNumber(cents: bigint) {
  return Number(centsToDecimal(cents));
}

// A valid open route is required; a dispatched employee, the branch office's
// administrator, or the company Super Administrador can write against it.
export async function openRoute(
  conn: SqlConnection, companyId: number, branchId: number, employeeId: number | null, cargo: string | null,
  expectedRouteId: number | null = null,
) {
  const [routes] = await conn.execute<RowDataPacket[]>(
    `SELECT iddetalleruta FROM tbl_detalle_ruta
     WHERE idglobal = ? AND idsucursal = ? AND str_estado = 'created'
     ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
    [companyId, branchId],
  );
  const route = routes[0];
  if (!route) fail('BUSINESS_RULE', 'An open route is required');
  const routeId = Number(route.iddetalleruta);
  if (expectedRouteId != null && routeId !== expectedRouteId) {
    fail('ROUTE_REOPENABLE', 'El registro pertenece a otra ruta distinta de la que está abierta.');
  }
  if (cargo !== 'Super Administrador') {
    if (employeeId == null) fail('FORBIDDEN', 'An employee identity is required for this action');
    const [authorized] = await conn.execute<RowDataPacket[]>(
      `SELECT 1 FROM tbl_sucursal s
       JOIN tbl_oficina o ON o.idoficina = s.idoficina AND o.idglobal = s.idglobal
       WHERE s.idsucursal = ? AND s.idglobal = ? AND o.idempleado_administrador = ?
       UNION ALL
       SELECT 1 FROM tbl_empleados_cobrando
       WHERE id_detalle_ruta = ? AND idempleado = ?
       UNION ALL SELECT 1 FROM view_employee_payroll_active_coverage
       WHERE idglobal=? AND branch_id=? AND replacement_employee_id=?
       LIMIT 1`,
      [branchId, companyId, employeeId, routeId, employeeId, companyId, branchId, employeeId],
    );
    if (!authorized.length) fail('BUSINESS_RULE', 'You are neither dispatched on the open route nor the branch office administrator');
  }
  return routeId;
}

export async function assertCanChangePayrollBonus(
  conn: SqlConnection, user: AuthContext['user'], branchId: number, expenseId: string,
) {
  const [rows] = await conn.execute<RowDataPacket[]>(
    `SELECT b.id FROM tbl_employee_payroll_bonus b WHERE b.idglobal=? AND b.expense_id=?
       AND NOT EXISTS(SELECT 1 FROM view_employee_payroll_bonus_manager m
         WHERE m.idglobal=b.idglobal AND m.actor_user_id=? AND m.branch_id=?) LIMIT 1`,
    [user.companyId, expenseId, user.userId, branchId]);
  if (rows.length) fail('FORBIDDEN', 'Sólo el administrador de oficina o Super Administrador puede gestionar bonos.');
}

async function loadCredit(
  conn: SqlConnection, companyId: number, branchId: number, creditId: string,
): Promise<CreditRow> {
  const [rows] = await conn.execute<CreditRow[]>(
    `SELECT idtarjeta, idglobal, idsucursal, idcliente, iddetalleruta, dec_valor,
            dec_resta, dec_prestamo, str_estado, int_tiempo, dec_utilidad
     FROM tbl_tarjetas WHERE idtarjeta = ? AND idglobal = ? AND idsucursal = ? FOR UPDATE`,
    [creditId, companyId, branchId],
  );
  if (!rows[0]) fail('NOT_FOUND', 'Credit not found');
  return rows[0];
}

// The legacy PHP (model/Cartera.php: saveCuota()) never checks the credit's own str_estado
// before recording a payment — it only requires the branch's route to be open. Real data
// confirms 'saved' is the normal, steady-state status a credit sits in for the rest of its
// term after its first day ('created') and settlement ('entregando'): the vast majority of
// active credits with an outstanding balance are 'saved'. The only status that should ever
// block a payment is 'cancelado', which means the credit is fully paid off (dec_resta = 0
// for every 'cancelado' row in production) and therefore closed for good.
function creditAcceptsPayments(credit: CreditRow): boolean {
  return credit.str_estado !== 'cancelado';
}

export function creditAcceptsAdditionalInterest(status: string): boolean {
  return status !== 'created' && status !== 'entregando';
}

export async function assertCustomerBranch(
  conn: SqlConnection, companyId: number, branchId: number, customerId: number,
  allowCompanyCustomer = false,
): Promise<CustomerRow> {
  const [rows] = await conn.execute<CustomerRow[]>(
    `SELECT c.idcliente, c.idpersona, c.idglobal, c.dec_max_credito, c.str_estado,
            p.str_email, p.str_num_documento, p.str_tipo_documento, p.str_telefono
     FROM tbl_clientes c JOIN tbl_persona p ON p.idpersona = c.idpersona AND p.idglobal = c.idglobal
     WHERE c.idcliente = ? AND c.idglobal = ?
       ${allowCompanyCustomer ? '' : `AND ${branchScopeExists('c')}`} FOR UPDATE`,
    [customerId, companyId, ...(allowCompanyCustomer ? [] : [branchId, branchId, branchId])],
  );
  const customer = rows[0];
  if (!customer) fail('NOT_FOUND', allowCompanyCustomer
    ? 'Customer not found in this company' : 'Customer not found in this branch');
  return customer;
}

export async function assertEmployeeCreditApproval(
  conn: SqlConnection, user: ReturnType<typeof requireAuth>, requestedCents: bigint,
) {
  if (requestedCents < 0n) fail('BUSINESS_RULE', 'El máximo cupo aprobado no puede ser negativo.');
  if (user.cargo === 'Super Administrador') return;
  if (user.employeeId == null) fail('FORBIDDEN', 'Tu usuario no tiene un empleado asociado.');
  const [rows] = await conn.execute<RowDataPacket[]>(
    'SELECT dec_max_credito AS maxCredit FROM tbl_empleado WHERE idempleado=? AND idglobal=? LIMIT 1 FOR UPDATE',
    [user.employeeId, user.companyId],
  );
  if (!rows.length) fail('FORBIDDEN', 'No se encontró el cupo autorizado del empleado.');
  if (requestedCents > decimalToCents(rows[0].maxCredit)) {
    fail('BUSINESS_RULE', 'El máximo cupo aprobado supera el cupo que puede otorgar el empleado.');
  }
}

export async function ensureCreditLimit(
  conn: SqlConnection, user: ReturnType<typeof requireAuth>, branchId: number,
  customer: CustomerRow, loanCents: bigint,
) {
  const maxCreditCents = decimalToCents(customer.dec_max_credito);
  if (customer.str_estado === 'inactivo' && loanCents > maxCreditCents) {
    fail('BUSINESS_RULE', 'El cliente inactivo supera su límite de crédito; edita el cliente antes de crear la tarjeta.');
  }
  const [debtRows] = await conn.execute<RowDataPacket[]>(
    'SELECT COALESCE(SUM(dec_resta),0) AS debt FROM tbl_tarjetas WHERE idcliente = ? AND idglobal = ?',
    [customer.idcliente, user.companyId],
  );
  const debtCents = decimalToCents(String(debtRows[0]?.debt ?? 0));
  if (loanCents <= maxCreditCents - debtCents) return;

  if (user.cargo !== 'Super Administrador') {
    if (user.employeeId == null) fail('FORBIDDEN', 'No tienes permiso para aumentar el cupo de este cliente.');
    const [grants] = await conn.execute<RowDataPacket[]>(
      `SELECT 1 FROM tbl_sucursal s
       JOIN tbl_oficina o ON o.idoficina=s.idoficina AND o.idglobal=s.idglobal
       WHERE s.idsucursal=? AND s.idglobal=? AND o.idempleado_administrador=?
       UNION ALL
       SELECT 1 FROM tbl_auth_sucursal au
       JOIN tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal
       JOIN tbl_auth a ON a.idauth=b.idauth
       WHERE au.idempleado=? AND au.idsucursal=? AND au.idglobal=?
         AND au.str_estado<>'inactivo'
         AND a.str_nombre IN ('editar cliente','editar maximo del credito')
       LIMIT 1`,
      [branchId, user.companyId, user.employeeId, user.employeeId, branchId, user.companyId],
    );
    if (!grants.length) {
      fail('BUSINESS_RULE', 'El crédito supera el cupo disponible. Solicita a un administrador o a un empleado autorizado que lo aumente.');
    }
  }
  const approvedCents = loanCents + debtCents;
  await assertEmployeeCreditApproval(conn, user, approvedCents);
  await conn.execute(
    'UPDATE tbl_clientes SET dec_max_credito=?,update_at=NOW() WHERE idcliente=? AND idglobal=?',
    [centsToDecimal(approvedCents), customer.idcliente, user.companyId],
  );
}

async function ensureUniquePerson(
  conn: SqlConnection, companyId: number, numberDocument: string, email: string, exceptPersonId?: number,
) {
  const [docRows] = await conn.execute<RowDataPacket[]>(
    `SELECT idpersona FROM tbl_persona WHERE idglobal = ? AND str_num_documento = ?
     AND (? IS NULL OR idpersona <> ?) LIMIT 1 FOR UPDATE`,
    [companyId, numberDocument, exceptPersonId ?? null, exceptPersonId ?? null],
  );
  if (docRows.length) fail('CONFLICT', 'Document already exists for this company');
  if (email !== '') {
    const [emailRows] = await conn.execute<RowDataPacket[]>(
      `SELECT idpersona FROM tbl_persona WHERE idglobal = ? AND str_email = ?
       AND (? IS NULL OR idpersona <> ?) LIMIT 1 FOR UPDATE`,
      [companyId, email, exceptPersonId ?? null, exceptPersonId ?? null],
    );
    if (emailRows.length) fail('CONFLICT', 'Email already exists for this company');
  }
}

async function assertPersonInCompany(
  conn: SqlConnection, companyId: number, personId: number | null | undefined,
) {
  if (personId == null) return;
  const [rows] = await conn.execute<RowDataPacket[]>(
    'SELECT idpersona FROM tbl_persona WHERE idpersona=? AND idglobal=? LIMIT 1',
    [personId, companyId],
  );
  if (!rows.length) fail('FORBIDDEN', 'Related person is outside the authenticated company');
}

function personValues(payload: Record<string, unknown>, photo: string, companyId: number) {
  return [
    companyId, payload.nombres, payload.apellidos, payload.sexo, payload.fechaNacimiento ?? null,
    payload.tipoDocumento, payload.numeroDocumento, payload.telefono, payload.email, photo,
    payload.ocupacion, 'activo', payload.notaPersona, payload.departamento, payload.ciudad,
    payload.barrio, payload.calle, '0',
  ];
}

async function countPhoneOpen(conn: SqlConnection, companyId: number, personId: number, phone: string) {
  const [saved] = await conn.execute<RowDataPacket[]>(
    'SELECT is_invalid FROM mobile_customer_phone WHERE idglobal=? AND idpersona=? AND normalized_phone=? FOR UPDATE',
    [companyId, personId, phone],
  );
  if (!saved.length) fail('NOT_FOUND', 'El teléfono no pertenece al historial de este cliente.');
  if (Number(saved[0].is_invalid) === 1) fail('VALIDATION_ERROR', 'Este teléfono está marcado INCORRECTO. Restáuralo primero.');
  const [updated] = await conn.execute<ResultSetHeader>(
    `UPDATE mobile_customer_phone
     SET whatsapp_open_count=whatsapp_open_count+1,whatsapp_last_opened_at=NOW()
     WHERE idglobal=? AND idpersona=? AND normalized_phone=?`,
    [companyId, personId, phone],
  );
  if (updated.affectedRows !== 1) fail('NOT_FOUND', 'El teléfono no pertenece al historial de este cliente.');
}

async function executeOperation(
  conn: SqlConnection, user: ReturnType<typeof requireAuth>, input: OfflineInput,
  payload: Record<string, unknown>, createdFiles: string[],
): Promise<{
  entityId: string; data: unknown; recordType: string; action: string;
  branchId: number | null; relatedId?: string;
}> {
  const { companyId, employeeId, userId, cargo } = user;
  switch (input.kind) {
    case 'RECORD_WHATSAPP_OPEN':
    case 'RECORD_WHATSAPP_RECEIPT': {
      const customer = await assertCustomerBranch(conn, companyId, input.branchId, Number(input.entityId));
      const receipt = input.kind === 'RECORD_WHATSAPP_RECEIPT';
      // Eligibility first: an ineligible receipt must not move the phone counter either.
      if (receipt) {
        await assertReceiptTarget(conn.execute.bind(conn), companyId, input.branchId, customer.idcliente,
          payload.tipo as ReceiptKind, String(payload.registroId));
      }
      if (!receipt || payload.telefono != null) {
        await countPhoneOpen(conn, companyId, customer.idpersona, requirePhone(String(payload.telefono)));
      }
      if (receipt) {
        await countReceiptOpen(conn.execute.bind(conn), companyId, input.branchId,
          payload.tipo as ReceiptKind, String(payload.registroId), userId);
      }
      // Same customer/phones shape for both kinds; the per-record count is never returned.
      return { entityId: input.entityId, data: { id: Number(input.entityId), phone: customer.str_telefono,
        phones: await customerPhones(conn.execute.bind(conn), companyId, customer.idpersona) },
        recordType: 'customer', action: 'WA_OPEN', branchId: input.branchId,
        relatedId: String(customer.idpersona) };
    }
    case 'ADD_CUSTOMER_PHONE':
    case 'SELECT_CUSTOMER_PHONE': {
      const customer = await assertCustomerBranch(conn, companyId, input.branchId, Number(input.entityId));
      const phone = requirePhone(String(payload.telefono));
      const [saved] = await conn.execute<RowDataPacket[]>(
        'SELECT idphone,is_invalid FROM mobile_customer_phone WHERE idglobal=? AND idpersona=? AND normalized_phone=? FOR UPDATE',
        [companyId, customer.idpersona, phone],
      );
      if (saved.length && Number(saved[0].is_invalid) === 1) {
        fail('VALIDATION_ERROR', 'Este teléfono está marcado INCORRECTO. Usa Restaurar antes de agregarlo o seleccionarlo.');
      }
      if (input.kind === 'SELECT_CUSTOMER_PHONE' && !saved.length) fail('NOT_FOUND', 'El teléfono no pertenece a este cliente.');
      await conn.execute(
        'UPDATE tbl_persona SET str_telefono=? WHERE idglobal=? AND idpersona=?',
        [phone, companyId, customer.idpersona],
      );
      return { entityId: input.entityId, data: { id: Number(input.entityId), phone,
        phones: await customerPhones(conn.execute.bind(conn), companyId, customer.idpersona) },
        recordType: 'customer', action: 'UPDATE', branchId: input.branchId, relatedId: String(customer.idpersona) };
    }
    case 'SET_CUSTOMER_PHONE_VALIDITY': {
      const customer = await assertCustomerBranch(conn, companyId, input.branchId, Number(input.entityId));
      const phone = requirePhone(String(payload.telefono));
      const [saved] = await conn.execute<RowDataPacket[]>(
        'SELECT is_invalid FROM mobile_customer_phone WHERE idglobal=? AND idpersona=? AND normalized_phone=? FOR UPDATE',
        [companyId, customer.idpersona, phone],
      );
      if (!saved.length) fail('NOT_FOUND', 'El teléfono no pertenece al historial de este cliente.');
      const invalid = payload.invalid === true;
      if (invalid && Number(saved[0].is_invalid) === 0 && normalizePhone(customer.str_telefono ?? '') === phone) {
        fail('VALIDATION_ERROR', 'Selecciona primero otro teléfono principal antes de marcar este como incorrecto.');
      }
      await conn.execute(
        `UPDATE mobile_customer_phone SET is_invalid=?,validity_changed_by=?,validity_changed_at=NOW()
         WHERE idglobal=? AND idpersona=? AND normalized_phone=? AND is_invalid<>?`,
        [invalid ? 1 : 0, userId, companyId, customer.idpersona, phone, invalid ? 1 : 0],
      );
      return { entityId: input.entityId, data: { id: Number(input.entityId), phone: customer.str_telefono,
        phones: await customerPhones(conn.execute.bind(conn), companyId, customer.idpersona) },
        recordType: 'customer', action: 'UPDATE', branchId: input.branchId, relatedId: String(customer.idpersona) };
    }
    case 'CREATE_CUSTOMER': {
      if (employeeId == null) fail('FORBIDDEN', 'An employee identity is required for this action');
      await assertEmployeeCreditApproval(conn, user, decimalToCents(payload.maxCredito as number));
      await assertPersonInCompany(conn, companyId, payload.fiadorPersonaId as number | null | undefined);
      const [existingPeople] = await conn.execute<RowDataPacket[]>(
        `SELECT p.idpersona, p.str_email, p.str_telefono, c.idcliente FROM tbl_persona p
         LEFT JOIN tbl_clientes c ON c.idpersona=p.idpersona AND c.idglobal=p.idglobal
         WHERE p.idglobal=? AND p.str_num_documento=? LIMIT 1 FOR UPDATE`,
        [companyId, payload.numeroDocumento],
      );
      if (existingPeople[0]?.idcliente != null) {
        fail('CONFLICT', 'Ya existe un cliente con este documento en la empresa.');
      }
      let personId: number;
      let photo = '';
      const phone = phoneForChange(String(payload.telefono), existingPeople[0]?.str_telefono);
      if (existingPeople.length) {
        personId = Number(existingPeople[0].idpersona);
        await ensureUniquePerson(conn, companyId, String(payload.numeroDocumento), String(payload.email), personId);
        await conn.execute(
          `UPDATE tbl_persona SET str_nombres=?,str_apellidos=?,str_sexo=?,str_fecha_nacimiento=?,
           str_tipo_documento=?,str_num_documento=?,str_telefono=?,str_email=?,str_ocupacion=?,
           str_nota=?,str_direccion_departamento=?,str_direccion_ciudad=?,str_direccion_barrio=?,
           str_direccion_calle=?,str_email_verificado=IF(?,'0',str_email_verificado),
           update_at=NOW() WHERE idpersona=? AND idglobal=?`,
          [payload.nombres, payload.apellidos, payload.sexo, payload.fechaNacimiento ?? null,
            payload.tipoDocumento, payload.numeroDocumento, phone, payload.email,
            payload.ocupacion, payload.notaPersona, payload.departamento, payload.ciudad,
            payload.barrio, payload.calle, existingPeople[0].str_email !== payload.email ? 1 : 0,
            personId, companyId],
        );
      } else {
        photo = await savePhoto(payload.fotoBase64 as string | undefined);
        if (photo) createdFiles.push(photo);
        await ensureUniquePerson(conn, companyId, String(payload.numeroDocumento), String(payload.email));
        const [personResult] = await conn.execute<ResultSetHeader>(
          `INSERT INTO tbl_persona
           (idglobal,str_nombres,str_apellidos,str_sexo,str_fecha_nacimiento,str_tipo_documento,
            str_num_documento,str_telefono,str_email,str_foto,str_ocupacion,str_estado,str_nota,
            str_direccion_departamento,str_direccion_ciudad,str_direccion_barrio,str_direccion_calle,
            str_email_verificado,created_at,update_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
          personValues({ ...payload, telefono: phone }, photo, companyId),
        );
        personId = personResult.insertId;
      }
      const [clientResult] = await conn.execute<ResultSetHeader>(
        `INSERT INTO tbl_clientes
         (idglobal,idpersona,dec_max_credito,str_apodo,str_nota,str_estado,str_calificacion,
          fiador_persona_id,created_empleado_id,create_at,update_at)
         VALUES (?,?,?,?,?,?,'nuevo',?,?,NOW(),NOW())`,
        [companyId, personId, decimal(payload.maxCredito), payload.apodo, payload.notaCliente,
          payload.estadoCliente, payload.fiadorPersonaId ?? null, employeeId],
      );
      return { entityId: String(clientResult.insertId), data: { id: clientResult.insertId, personId, photo }, recordType: 'customer', action: 'INSERT', branchId: input.branchId, relatedId: String(personId) };
    }
    case 'UPDATE_CUSTOMER': {
      await assertPersonInCompany(conn, companyId, payload.fiadorPersonaId as number | null | undefined);
      const customer = await assertCustomerBranch(conn, companyId, input.branchId, Number(input.entityId));
      const phone = phoneForChange(String(payload.telefono), customer.str_telefono);
      const proposedMax = decimalToCents(payload.maxCredito as number);
      if (proposedMax > decimalToCents(customer.dec_max_credito)) {
        await assertEmployeeCreditApproval(conn, user, proposedMax);
      }
      await ensureUniquePerson(conn, companyId, String(payload.numeroDocumento), String(payload.email), customer.idpersona);
      const photo = await savePhoto(payload.fotoBase64 as string | undefined);
      if (photo) createdFiles.push(photo);
      const fields = [
        'str_nombres','str_apellidos','str_sexo','str_fecha_nacimiento','str_tipo_documento',
        'str_num_documento','str_telefono','str_email','str_ocupacion','str_nota',
        'str_direccion_departamento','str_direccion_ciudad','str_direccion_barrio','str_direccion_calle',
      ];
      const personData = [
        payload.nombres,payload.apellidos,payload.sexo,payload.fechaNacimiento ?? null,
        payload.tipoDocumento,payload.numeroDocumento,phone,payload.email,payload.ocupacion,
        payload.notaPersona,payload.departamento,payload.ciudad,payload.barrio,payload.calle,
      ];
      if (photo) { fields.push('str_foto'); personData.push(photo); }
      const [current] = await conn.execute<RowDataPacket[]>(
        'SELECT str_email FROM tbl_persona WHERE idpersona = ? AND idglobal = ? FOR UPDATE',
        [customer.idpersona, companyId],
      );
      const emailChanged = current[0]?.str_email !== payload.email;
      await conn.execute(
        `UPDATE tbl_persona SET ${fields.map((field) => `${field} = ?`).join(', ')},
         str_email_verificado = IF(?, '0', str_email_verificado),
         update_at = NOW() WHERE idpersona = ? AND idglobal = ?`,
        [...personData, emailChanged ? 1 : 0, customer.idpersona, companyId],
      );
      await conn.execute(
        `UPDATE tbl_clientes SET dec_max_credito=?,str_apodo=?,str_nota=?,str_estado=?,
         fiador_persona_id=?,update_at=NOW() WHERE idcliente=? AND idglobal=?`,
        [decimal(payload.maxCredito), payload.apodo, payload.notaCliente, payload.estadoCliente,
          payload.fiadorPersonaId ?? null, customer.idcliente, companyId],
      );
      return { entityId: String(customer.idcliente), data: { id: customer.idcliente, personId: customer.idpersona, photo: photo || undefined, emailChanged: current[0]?.str_email !== payload.email }, recordType: 'customer', action: 'UPDATE', branchId: input.branchId, relatedId: String(customer.idpersona) };
    }
    case 'UPDATE_DOCUMENT': {
      const customer = await assertCustomerBranch(conn, companyId, input.branchId, Number(input.entityId));
      await ensureUniquePerson(conn, companyId, String(payload.numeroDocumento), customer.str_email, customer.idpersona);
      await conn.execute(
        `UPDATE tbl_persona SET str_tipo_documento=?,str_num_documento=?,update_at=NOW()
         WHERE idpersona=? AND idglobal=?`,
        [payload.tipoDocumento, payload.numeroDocumento, customer.idpersona, companyId],
      );
      return { entityId: String(customer.idcliente), data: { id: customer.idcliente }, recordType: 'customer', action: 'UPDATE', branchId: input.branchId, relatedId: String(customer.idpersona) };
    }
    case 'CREATE_CREDIT': {
      if (!creditPricingAllowed(payload.valor as number, payload.prestamo as number,
        user.cargo === 'Super Administrador')) {
        fail('BUSINESS_RULE', 'No cumple la regla mínima');
      }
      if (employeeId == null) fail('FORBIDDEN', 'An employee identity is required for this action');
      if (input.entityId !== payload.idtarjeta) fail('VALIDATION_ERROR', 'entityId must match the new credit ID');
      if (payload.idventa != null) {
        const [saleRows] = await conn.execute<RowDataPacket[]>(
          'SELECT idventa FROM tbl_venta WHERE idventa=? AND idglobal=? LIMIT 1',
          [payload.idventa, companyId],
        );
        if (!saleRows.length) fail('FORBIDDEN', 'Sale is outside the authenticated company');
      }
      const routeId = await openRoute(conn, companyId, input.branchId, employeeId, cargo, input.routeId ?? null);
      const customer = await assertCustomerBranch(conn, companyId, input.branchId, Number(payload.idcliente), true);
      await ensureCreditLimit(conn, user, input.branchId, customer, decimalToCents(payload.prestamo as number));
      const [sequenceRows] = await conn.execute<RowDataPacket[]>(
        `SELECT str_ultimo_numero AS lastNumber FROM tbl_detalle_documento_sucursal
         WHERE iddetalle_documento_sucursal = ? AND idglobal = ? AND idsucursal = ? FOR UPDATE`,
        [payload.detalleDocumentoSucursalId, companyId, input.branchId],
      );
      if (!sequenceRows.length) fail('BUSINESS_RULE', 'Receipt sequence is not configured for this branch');
      const issuedNumber = nextReceiptNumber(String(sequenceRows[0].lastNumber));
      const receiptNumber = payload.obligacion || issuedNumber;
      let item = payload.item;
      const referenceCardId = payload.tarjetaReferenciaId;
      const placement = payload.ubicacion;
      if (referenceCardId !== undefined || placement !== undefined) {
        if (typeof referenceCardId !== 'string' || !referenceCardId ||
            (placement !== 'antes' && placement !== 'despues')) {
          fail('VALIDATION_ERROR', 'Both card reference and placement are required');
        }
        const [positionRows] = await conn.execute<RowDataPacket[]>(
          `SELECT idtarjeta AS id, float_item AS item FROM tbl_tarjetas
           WHERE idglobal=? AND idsucursal=? ORDER BY float_item,idtarjeta FOR UPDATE`,
          [companyId, input.branchId],
        );
        const plan = planPositionBesideCard(
          positionRows.map((row) => ({ id: String(row.id), item: Number(row.item) })),
          referenceCardId, placement,
        );
        item = plan.item;
        for (const moved of plan.moved) {
          await conn.execute(
            'UPDATE tbl_tarjetas SET float_item=?,updated_at=NOW() WHERE idtarjeta=? AND idglobal=? AND idsucursal=?',
            [moved.item, moved.id, companyId, input.branchId],
          );
        }
      }
      await conn.execute(
        `INSERT INTO tbl_tarjetas
         (idtarjeta,idglobal,idsucursal,idcliente,idventa,iddetalleruta,str_concepto,dec_valor,
          str_modo,int_tiempo,dec_prestamo,dec_resta,str_descripcion,float_item,dec_utilidad,
          str_c_adicional_numero,dec_c_adicional_valor,str_tipo_comprobante,str_serie,str_numero,
          str_nota,str_abono,str_style,str_estado,created_empleado_id,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'','', 'created',?,NOW(),NOW())`,
        [payload.idtarjeta, companyId, input.branchId, customer.idcliente, payload.idventa ?? null,
          routeId, payload.concepto, decimal(payload.valor), payload.modo, payload.plazo, decimal(payload.prestamo),
          decimal(payload.valor), payload.descripcion, item, decimal(payload.utilidad), payload.adicionalNumero,
          decimal(payload.adicionalValor), payload.tipoComprobante, payload.serie, receiptNumber, payload.nota,
          employeeId],
      );
      await saveBankSplits(conn, 'credit', String(payload.idtarjeta), companyId, input.branchId, userId,
        payload.bancos as BankSplit[] | undefined, decimalToCents(payload.prestamo as number));
      await conn.execute(
        `UPDATE tbl_detalle_documento_sucursal SET str_ultimo_numero = ?
         WHERE iddetalle_documento_sucursal = ? AND idglobal = ? AND idsucursal = ?`,
        [issuedNumber, payload.detalleDocumentoSucursalId, companyId, input.branchId],
      );
      const valueCents = decimalToCents(payload.valor as number);
      const initialCents = decimalToCents((payload.cuotaInicial ?? 0) as number);
      if (initialCents < 0n || initialCents > valueCents) fail('BUSINESS_RULE', 'Initial payment must be between zero and the credit value');
      if (initialCents === 0n && ((payload.bancosInicial as BankSplit[] | undefined)?.length || payload.cuotaInicialId)) {
        fail('VALIDATION_ERROR', 'A bank account for the initial payment requires an initial payment');
      }
      if (initialCents > 0n) {
        const initialPaymentId = (payload.cuotaInicialId as string | undefined) ?? cryptoRandomId();
        await conn.execute(
          `INSERT INTO tbl_descripcion
           (iddescripcion,idglobal,idsucursal,idtarjeta,iddetalleruta,dec_abono,str_descripcion,
            str_estado,idusuario,str_origen,created_at,updated_at)
           VALUES (?,?,?,?,?,?,'Inicial','created',?,?,NOW(),NOW())`,
          [initialPaymentId, companyId, input.branchId, payload.idtarjeta, routeId, centsToDecimal(-initialCents),
            userId, PAYMENT_ORIGIN],
        );
        await saveBankSplits(conn, 'payment', initialPaymentId, companyId, input.branchId, userId,
          payload.bancosInicial as BankSplit[] | undefined, initialCents);
        await conn.execute(
          'UPDATE tbl_tarjetas SET dec_resta = ? WHERE idtarjeta = ? AND idglobal = ? AND idsucursal = ?',
          [centsToDecimal(valueCents - initialCents), payload.idtarjeta, companyId, input.branchId],
        );
      }
      return { entityId: String(payload.idtarjeta), data: { id: payload.idtarjeta, remaining: asMoneyNumber(valueCents - initialCents) }, recordType: 'credit', action: 'INSERT', branchId: input.branchId, relatedId: String(customer.idcliente) };
    }
    case 'UPDATE_CREDIT':
    case 'UPDATE_CREDIT_TERMS': {
      if (input.kind === 'UPDATE_CREDIT' &&
          !creditPricingAllowed(payload.valor as number, payload.prestamo as number,
            user.cargo === 'Super Administrador')) {
        fail('BUSINESS_RULE', 'No cumple la regla mínima');
      }
      const credit = await loadCredit(conn, companyId, input.branchId, input.entityId);
      if (input.kind === 'UPDATE_CREDIT') {
        const updateValues = values(
          payload,'concepto','valor','modo','plazo','prestamo','descripcion','item','utilidad',
          'adicionalNumero','adicionalValor','tipoComprobante','serie','numero','nota',
        );
        updateValues[1] = decimal(payload.valor);
        updateValues[4] = decimal(payload.prestamo);
        updateValues[7] = decimal(payload.utilidad);
        updateValues[9] = decimal(payload.adicionalValor);
        await conn.execute(
          `UPDATE tbl_tarjetas SET str_concepto=?,dec_valor=?,str_modo=?,int_tiempo=?,dec_prestamo=?,
           str_descripcion=?,float_item=?,dec_utilidad=?,str_c_adicional_numero=?,dec_c_adicional_valor=?,
           str_tipo_comprobante=?,str_serie=?,str_numero=?,str_nota=?,updated_at=NOW()
           WHERE idtarjeta=? AND idglobal=? AND idsucursal=?`,
          [...updateValues, input.entityId, companyId, input.branchId],
        );
      } else {
        await conn.execute(
          `UPDATE tbl_tarjetas SET str_modo=?,int_tiempo=?,str_numero=?,created_at=?,updated_at=NOW()
           WHERE idtarjeta=? AND idglobal=? AND idsucursal=?`,
          [payload.modo, payload.plazo, payload.numero, payload.createdAt, input.entityId, companyId, input.branchId],
        );
      }
      return { entityId: credit.idtarjeta, data: { id: credit.idtarjeta }, recordType: 'credit', action: 'UPDATE', branchId: input.branchId, relatedId: String(credit.idcliente) };
    }
    case 'CREATE_PAYMENT': {
      const routeId = await openRoute(conn, companyId, input.branchId, employeeId, cargo, input.routeId ?? null);
      const credit = await loadCredit(conn, companyId, input.branchId, input.entityId);
      if (!creditAcceptsPayments(credit)) fail('BUSINESS_RULE', 'Payments require an open credit');
      // Mirrors the legacy PHP rule (model/Cartera.php: saveCuota() -> "ERROR: No puede
      // duplicar la Cuota"): a credit may only have one open (not yet settled) payment at a
      // time. Once a payment is registered it stays 'created' until the route/day is closed
      // and every payment row is flipped to 'saved'; only then can a new payment be added.
      // This is what actually enforces "one payment per dispatch/day per client", not the
      // credit's own status.
      const [existingPaymentRows] = await conn.execute<RowDataPacket[]>(
        `SELECT iddescripcion FROM tbl_descripcion
         WHERE idtarjeta=? AND idglobal=? AND idsucursal=? AND str_estado<>'saved' LIMIT 1`,
        [credit.idtarjeta, companyId, input.branchId],
      );
      if (existingPaymentRows[0]) {
        fail('BUSINESS_RULE', 'This credit already has an open payment for the current cycle; edit the existing payment instead of creating a new one');
      }
      const amount = decimalToCents(payload.abono as number);
      const [currentRows] = await conn.execute<RowDataPacket[]>(
        `SELECT COALESCE(SUM(dec_abono),0) AS total FROM tbl_descripcion
         WHERE idtarjeta=? AND idglobal=? AND idsucursal=?`,
        [credit.idtarjeta, companyId, input.branchId],
      );
      const balance = decimalToCents(credit.dec_valor)
        + decimalToCents(String(currentRows[0]?.total ?? 0));
      if (amount >= 0n || balance + amount < 0n) {
        fail('BUSINESS_RULE', 'Payment must reduce the current authoritative balance without overpaying');
      }
      await conn.execute(
        `INSERT INTO tbl_descripcion
         (iddescripcion,idglobal,idsucursal,idtarjeta,iddetalleruta,dec_abono,str_descripcion,
          str_estado,idusuario,str_origen,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,'created',?,?,NOW(),NOW())`,
        [payload.iddescripcion, companyId, input.branchId, credit.idtarjeta, routeId, centsToDecimal(amount),
          payload.descripcion || 'Abono', userId, PAYMENT_ORIGIN],
      );
      await saveBankSplits(conn, 'payment', String(payload.iddescripcion), companyId, input.branchId, userId,
        payload.bancos as BankSplit[] | undefined, -amount, decimalToCents((payload.vuelto as number) ?? 0));
      await conn.execute(
        `UPDATE tbl_tarjetas SET dec_resta=?,updated_at=NOW()
         WHERE idtarjeta=? AND idglobal=? AND idsucursal=?`,
        [centsToDecimal(balance + amount), credit.idtarjeta, companyId, input.branchId],
      );
      return { entityId: String(payload.iddescripcion), data: { id: payload.iddescripcion, creditId: credit.idtarjeta, remaining: asMoneyNumber(balance + amount) }, recordType: 'payment', action: 'INSERT', branchId: input.branchId, relatedId: credit.idtarjeta };
    }
    case 'UPDATE_PAYMENT': {
      await openRoute(conn, companyId, input.branchId, employeeId, cargo, input.routeId ?? null);
      const [rows] = await conn.execute<RowDataPacket[]>(
        `SELECT d.iddescripcion,d.idtarjeta,d.str_estado FROM tbl_descripcion d
         WHERE d.iddescripcion=? AND d.idglobal=? AND d.idsucursal=? FOR UPDATE`,
        [input.entityId, companyId, input.branchId],
      );
      const payment = rows[0];
      if (!payment) fail('NOT_FOUND', 'Payment not found');
      // Same rule DELETE_PAYMENT already enforces: once a payment is handed over or settled it
      // belongs to a closed route and can no longer be rewritten.
      if (payment.str_estado !== 'created') fail('BUSINESS_RULE', 'Only created payments can be edited');
      const credit = await loadCredit(conn, companyId, input.branchId, String(payment.idtarjeta));
      if (!creditAcceptsPayments(credit)) fail('BUSINESS_RULE', 'Payments require an open credit');
      const amount = decimalToCents(payload.abono as number);
      if (amount >= 0n) fail('BUSINESS_RULE', 'Payment amount must be a negative balance adjustment');
      const [priorRows] = await conn.execute<RowDataPacket[]>(
        `SELECT COALESCE(SUM(dec_abono),0) AS total FROM tbl_descripcion
         WHERE idtarjeta=? AND idglobal=? AND idsucursal=? AND iddescripcion<>?`,
        [credit.idtarjeta, companyId, input.branchId, input.entityId],
      );
      if (decimalToCents(credit.dec_valor)
          + decimalToCents(String(priorRows[0]?.total ?? 0)) + amount < 0n) {
        fail('BUSINESS_RULE', 'Payment exceeds the authoritative credit balance');
      }
      await conn.execute(
        'UPDATE tbl_descripcion SET dec_abono=?,str_descripcion=?,updated_at=NOW() WHERE iddescripcion=? AND idglobal=? AND idsucursal=?',
        [centsToDecimal(amount), payload.descripcion, input.entityId, companyId, input.branchId],
      );
      if (payload.bancos !== undefined) {
        await saveBankSplits(conn, 'payment', input.entityId, companyId, input.branchId, userId,
          payload.bancos as BankSplit[], -amount, decimalToCents((payload.vuelto as number) ?? 0));
      } else {
        // An edit that does not mention banks keeps them, but can never leave more money
        // "in the bank" than the abono itself.
        const [bankRows] = await conn.execute<RowDataPacket[]>(
          'SELECT COALESCE(SUM(dec_valor),0) AS total FROM tbl_descripcion_pago WHERE iddescripcion=? AND idglobal=?',
          [input.entityId, companyId],
        );
        if (decimalToCents(String(bankRows[0]?.total ?? 0)) > -amount) {
          fail('BUSINESS_RULE', 'Send the bank split again to declare the cash change for this abono');
        }
      }
      const balance = await recalculateBalance(conn, credit);
      return { entityId: input.entityId, data: { id: input.entityId, creditId: credit.idtarjeta, remaining: balance }, recordType: 'payment', action: 'UPDATE', branchId: input.branchId, relatedId: credit.idtarjeta };
    }
    case 'DELETE_PAYMENT': {
      await openRoute(conn, companyId, input.branchId, employeeId, cargo, input.routeId ?? null);
      const [rows] = await conn.execute<RowDataPacket[]>(
        `SELECT idtarjeta,str_estado FROM tbl_descripcion WHERE iddescripcion=?
         AND idglobal=? AND idsucursal=? FOR UPDATE`,
        [input.entityId, companyId, input.branchId],
      );
      const payment = rows[0];
      if (!payment) fail('NOT_FOUND', 'Payment not found');
      if (payment.str_estado !== 'created') fail('BUSINESS_RULE', 'Only created payments can be deleted');
      const credit = await loadCredit(conn, companyId, input.branchId, String(payment.idtarjeta));
      if (!creditAcceptsPayments(credit)) fail('BUSINESS_RULE', 'Payments require an open credit');
      await conn.execute(
        'DELETE FROM tbl_descripcion WHERE iddescripcion=? AND idglobal=? AND idsucursal=? AND str_estado=?',
        [input.entityId, companyId, input.branchId, 'created'],
      );
      const balance = await recalculateBalance(conn, credit);
      return { entityId: input.entityId, data: { id: input.entityId, creditId: credit.idtarjeta, remaining: balance }, recordType: 'payment', action: 'DELETE', branchId: input.branchId, relatedId: credit.idtarjeta };
    }
    case 'DELETE_CREDIT': {
      const credit = await loadCredit(conn, companyId, input.branchId, input.entityId);
      if (credit.str_estado !== 'created') fail('BUSINESS_RULE', 'Only created credits can be deleted');
      const [rows] = await conn.execute<RowDataPacket[]>(
        `SELECT iddescripcion,str_estado FROM tbl_descripcion WHERE idtarjeta=?
         AND idglobal=? AND idsucursal=? FOR UPDATE`,
        [input.entityId, companyId, input.branchId],
      );
      if ((rows as Array<{ str_estado: string }>).some((row) => row.str_estado !== 'created')) {
        fail('BUSINESS_RULE', 'Credit contains records that cannot be deleted');
      }
      await conn.execute('DELETE FROM tbl_descripcion WHERE idtarjeta=? AND idglobal=? AND idsucursal=? AND str_estado=?', [input.entityId, companyId, input.branchId, 'created']);
      await conn.execute('DELETE FROM tbl_tarjetas WHERE idtarjeta=? AND idglobal=? AND idsucursal=? AND str_estado=?', [input.entityId, companyId, input.branchId, 'created']);
      return { entityId: input.entityId, data: { id: input.entityId }, recordType: 'credit', action: 'DELETE', branchId: input.branchId, relatedId: String(credit.idcliente) };
    }
    case 'APPLY_DISCOUNT':
    case 'ADD_INTEREST': {
      const routeId = await openRoute(conn, companyId, input.branchId, employeeId, cargo, input.routeId ?? null);
      const credit = await loadCredit(conn, companyId, input.branchId, input.entityId);
      if (input.kind === 'ADD_INTEREST' && !creditAcceptsAdditionalInterest(credit.str_estado)) {
        fail('BUSINESS_RULE', 'No se pueden cobrar más intereses mientras la tarjeta esté en estado created o entregando');
      }
      const label = input.kind === 'APPLY_DISCOUNT' ? 'Descuento' : 'Intereses';
      const [duplicates] = await conn.execute<RowDataPacket[]>(
        `SELECT iddescripcion FROM tbl_descripcion WHERE idtarjeta=? AND idglobal=? AND idsucursal=?
         AND str_descripcion LIKE ? ${input.kind === 'ADD_INTEREST' ? "AND str_estado <> 'saved'" : ''} LIMIT 1`,
        [input.entityId, companyId, input.branchId, `${label}%`],
      );
      if (duplicates.length) fail('BUSINESS_RULE', `Only one ${label.toLowerCase()} operation is allowed per credit`);
      const amount = decimalToCents(payload.amount as number);
      const newBalance = decimalToCents(credit.dec_resta) + amount;
      await conn.execute(
        `UPDATE tbl_tarjetas SET dec_utilidad=dec_utilidad+?,dec_resta=?,
         ${input.kind === 'ADD_INTEREST' ? "str_estado='refinanciada',int_tiempo=int_tiempo+?" : 'updated_at=NOW()'}
         WHERE idtarjeta=? AND idglobal=? AND idsucursal=?`,
        input.kind === 'ADD_INTEREST'
          ? [centsToDecimal(amount), centsToDecimal(newBalance), payload.plazo, input.entityId, companyId, input.branchId]
          : [centsToDecimal(amount), centsToDecimal(newBalance), input.entityId, companyId, input.branchId],
      );
      await conn.execute(
        `INSERT INTO tbl_descripcion
         (iddescripcion,idglobal,idsucursal,idtarjeta,iddetalleruta,dec_abono,str_descripcion,
          str_estado,idusuario,str_origen,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,'created',?,?,NOW(),NOW())`,
        [cryptoRandomId(), companyId, input.branchId, input.entityId, routeId, centsToDecimal(amount),
          `${label}: ${payload.descripcion ?? ''}`, userId, PAYMENT_ORIGIN],
      );
      return { entityId: input.entityId, data: { id: input.entityId, remaining: asMoneyNumber(newBalance) }, recordType: 'credit', action: 'UPDATE', branchId: input.branchId, relatedId: String(credit.idcliente) };
    }
    case 'CHANGE_CREDIT_STATUS': {
      const status = String(payload.status);
      const credit = await loadCredit(conn, companyId, input.branchId, input.entityId);
      if (credit.str_estado === 'created' || credit.str_estado === 'entregando') {
        fail('BUSINESS_RULE', 'This credit cannot change status while it is being created or dispatched');
      }
      if (status === 'moroso' || status === 'fallecio' || status === 'discapacitado') {
        const [pending] = await conn.execute<RowDataPacket[]>(
          `SELECT iddescripcion FROM tbl_descripcion
           WHERE idtarjeta=? AND idglobal=? AND idsucursal=?
             AND str_estado IN ('created','entregando')
             AND (str_descripcion LIKE 'Abono%' OR str_descripcion LIKE 'Cancelado%'
               OR str_descripcion LIKE 'Inicial%') LIMIT 1`,
          [input.entityId, companyId, input.branchId],
        );
        if (pending.length) fail('BUSINESS_RULE', 'Save pending route payments before changing credit status');
      }
      await conn.execute(
        'UPDATE tbl_tarjetas SET str_estado=?,updated_at=NOW() WHERE idtarjeta=? AND idglobal=? AND idsucursal=?',
        [status, input.entityId, companyId, input.branchId],
      );
      if (status === 'fallecio' || status === 'discapacitado') {
        await conn.execute(
          `UPDATE tbl_persona p JOIN tbl_clientes c ON c.idpersona=p.idpersona
           SET p.str_estado=?,p.update_at=NOW() WHERE c.idcliente=? AND c.idglobal=?`,
          [status, credit.idcliente, companyId],
        );
      }
      return { entityId: credit.idtarjeta, data: { id: credit.idtarjeta, status }, recordType: 'credit', action: 'UPDATE', branchId: input.branchId, relatedId: String(credit.idcliente) };
    }
    case 'REORDER_CREDIT': {
      const credit = await loadCredit(conn, companyId, input.branchId, input.entityId);
      await conn.execute(
        'UPDATE tbl_tarjetas SET float_item=?,updated_at=NOW() WHERE idtarjeta=? AND idglobal=? AND idsucursal=?',
        [payload.item, input.entityId, companyId, input.branchId],
      );
      return { entityId: credit.idtarjeta, data: { id: credit.idtarjeta, item: payload.item }, recordType: 'credit', action: 'UPDATE', branchId: input.branchId, relatedId: String(credit.idcliente) };
    }
    case 'CREATE_COMMENT': {
      const customer = await assertCustomerBranch(conn, companyId, input.branchId, Number(payload.idcliente));
      await conn.execute(
        `INSERT INTO tbl_comentarios (idcomentario,str_comentario,str_tipo,idusuario,created_at,update_at)
         VALUES (?,?,?,?,NOW(),NOW())`,
        [input.entityId, payload.comentario, payload.tipo, userId],
      );
      await conn.execute(
        'INSERT INTO tbl_comentarios_cliente (idcomentariocliente,idcliente,idcomentario) VALUES (?,?,?)',
        [cryptoRandomId(), customer.idcliente, input.entityId],
      );
      return { entityId: input.entityId, data: { id: input.entityId, customerId: customer.idcliente }, recordType: 'comment', action: 'INSERT', branchId: input.branchId, relatedId: String(customer.idcliente) };
    }
    case 'UPDATE_COMMENT':
    case 'DELETE_COMMENT': {
      const [rows] = await conn.execute<RowDataPacket[]>(
        `SELECT c.idusuario,l.idcliente,cl.idglobal FROM tbl_comentarios c
         JOIN tbl_comentarios_cliente l ON l.idcomentario=c.idcomentario
         JOIN tbl_clientes cl ON cl.idcliente=l.idcliente
         WHERE c.idcomentario=? FOR UPDATE`,
        [input.entityId],
      );
      const comment = rows[0] as (RowDataPacket & { idusuario: number; idcliente: number; idglobal: number }) | undefined;
      if (!comment) fail('NOT_FOUND', 'Comment not found');
      if (Number(comment.idusuario) !== userId) fail('FORBIDDEN', 'Comments can only be edited by their creator');
      if (rows.length !== 1 || Number(comment.idglobal) !== companyId) {
        fail('FORBIDDEN', 'Comments linked outside this customer scope cannot be modified');
      }
      await assertCustomerBranch(conn, companyId, input.branchId, Number(comment.idcliente));
      if (input.kind === 'UPDATE_COMMENT') {
        await conn.execute('UPDATE tbl_comentarios SET str_comentario=?,update_at=NOW() WHERE idcomentario=? AND idusuario=?', [payload.comentario, input.entityId, userId]);
        return { entityId: input.entityId, data: { id: input.entityId }, recordType: 'comment', action: 'UPDATE', branchId: input.branchId, relatedId: String(comment.idcliente) };
      }
      await conn.execute('DELETE FROM tbl_comentarios_cliente WHERE idcomentario=?', [input.entityId]);
      await conn.execute('DELETE FROM tbl_comentarios WHERE idcomentario=? AND idusuario=?', [input.entityId, userId]);
      return { entityId: input.entityId, data: { id: input.entityId }, recordType: 'comment', action: 'DELETE', branchId: input.branchId, relatedId: String(comment.idcliente) };
    }
    case 'CREATE_LOCATION': {
      const credit = await loadCredit(conn, companyId, input.branchId, String(payload.idtarjeta));
      const [existing] = await conn.execute<RowDataPacket[]>(
        `SELECT idlocation FROM mobile_credit_location
         WHERE idglobal=? AND idsucursal=? AND idtarjeta=? FOR UPDATE`,
        [companyId, input.branchId, credit.idtarjeta],
      );
      if (existing.length >= 10) {
        fail('VALIDATION_ERROR', 'Cada tarjeta admite máximo 10 ubicaciones de cobro');
      }
      await conn.execute(
        `INSERT INTO mobile_credit_location
         (idlocation,idglobal,idsucursal,idtarjeta,str_nombre,dec_latitud,dec_longitud,int_precision_m,idusuario,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,NOW())`,
        [
          input.entityId, companyId, input.branchId, credit.idtarjeta, payload.nombre,
          payload.latitud, payload.longitud, payload.precision ?? null, userId,
        ],
      );
      return {
        entityId: input.entityId,
        data: {
          id: input.entityId, creditId: credit.idtarjeta, name: payload.nombre,
          latitude: payload.latitud, longitude: payload.longitud, accuracy: payload.precision ?? null,
          userId, createdAt: new Date().toISOString(),
        },
        recordType: 'location', action: 'INSERT', branchId: input.branchId, relatedId: credit.idtarjeta,
      };
    }
    case 'DELETE_LOCATION': {
      const [rows] = await conn.execute<LocationRow[]>(
        `SELECT idlocation,idglobal,idsucursal,idtarjeta,str_nombre,dec_latitud,dec_longitud,
                int_precision_m,idusuario,created_at
         FROM mobile_credit_location
         WHERE idlocation=? AND idglobal=? AND idsucursal=? FOR UPDATE`,
        [input.entityId, companyId, input.branchId],
      );
      const location = rows[0];
      if (!location) {
        return { entityId: input.entityId, data: { id: input.entityId }, recordType: 'location', action: 'DELETE', branchId: input.branchId };
      }
      await conn.execute(
        'DELETE FROM mobile_credit_location WHERE idlocation=? AND idglobal=? AND idsucursal=?',
        [input.entityId, companyId, input.branchId],
      );
      return { entityId: input.entityId, data: { id: input.entityId }, recordType: 'location', action: 'DELETE', branchId: input.branchId, relatedId: location.idtarjeta };
    }
    case 'UPSERT_ALERT': {
      const customer = await assertCustomerBranch(
        conn, companyId, input.branchId, Number(payload.idcliente),
      );
      await conn.execute<RowDataPacket[]>(
        'SELECT idcliente FROM tbl_clientes WHERE idcliente=? AND idglobal=? FOR UPDATE',
        [customer.idcliente, companyId],
      );
      const [alerts] = await conn.execute<RowDataPacket[]>(
        `SELECT c.idcomentario,c.str_comentario FROM tbl_comentarios c
         JOIN tbl_comentarios_cliente l ON l.idcomentario=c.idcomentario
         WHERE l.idcliente=? AND c.idusuario=? AND c.str_tipo='alerta' FOR UPDATE`,
        [customer.idcliente, userId],
      );
      const existing = alerts[0];
      rejectExistingAlert(Boolean(existing));
      const alerta = serializeAlert(payload);
      await conn.execute(
        `INSERT INTO tbl_comentarios (idcomentario,str_comentario,str_tipo,idusuario,created_at,update_at)
         VALUES (?,?, 'alerta', ?,NOW(),NOW())`,
        [input.entityId, alerta, userId],
      );
      await conn.execute(
        'INSERT INTO tbl_comentarios_cliente (idcomentariocliente,idcliente,idcomentario) VALUES (?,?,?)',
        [cryptoRandomId(), customer.idcliente, input.entityId],
      );
      return {
        entityId: input.entityId,
        data: { id: input.entityId, customerId: customer.idcliente, alerta },
        recordType: 'comment',
        action: 'INSERT',
        branchId: input.branchId,
        relatedId: String(customer.idcliente),
      };
    }
    case 'CREATE_EXPENSE':
    case 'UPDATE_EXPENSE': {
      const routeId = await openRoute(conn, companyId, input.branchId, employeeId, cargo, input.routeId ?? null);
      const accountingType = Number(payload.idtipo_contabilidad);
      const name = String(payload.nombre);
      const [bonusRows] = input.kind === 'UPDATE_EXPENSE'
        ? await conn.execute<RowDataPacket[]>('SELECT employee_id FROM tbl_employee_payroll_bonus WHERE idglobal=? AND expense_id=?',
          [companyId, input.entityId])
        : [[] as RowDataPacket[]];
      if (bonusRows.length) {
        await assertCanChangePayrollBonus(conn, user, input.branchId, input.entityId);
        if (accountingType !== 2 || name !== 'Bono') fail('VALIDATION_ERROR', 'El gasto de bono conserva su categoría y concepto.');
      } else {
        await assertExpenseCatalog(conn, companyId, accountingType, name);
      }
      const payrollId = payload.idnomina == null ? null : Number(payload.idnomina);
      if (accountingType === 2 && payrollId === null) {
        fail('VALIDATION_ERROR', 'Seleccione el empleado del gasto de sueldo.');
      }
      if (payrollId !== null) await assertPayroll(conn, user, input.branchId, payrollId, routeId);
      // webgoez stores route expenses as a negative amount (model/RecibeCuentas.php:
      // RegistrarContabilidad), which is what view_contabilidad_detalle_ruta then adds up.
      const amount = -decimalToCents(payload.valor as number);
      const detail = String(payload.detalle ?? '');
      if (input.kind === 'CREATE_EXPENSE') {
        await conn.execute(
          `INSERT INTO tbl_contabilidad_detalle (idcontabilidad_detalle,idglobal,idsucursal,
             idtipo_contabilidad,iddetalleruta,dec_total,str_detalle,str_nombre,str_estado,
             str_operacion,created_empleado_id,created_at,update_at)
           VALUES (?,?,?,?,?,?,?,?,'created','salida-totalizar',?,NOW(),NOW())`,
          [input.entityId, companyId, input.branchId, accountingType, routeId,
            centsToDecimal(amount), detail, name, employeeId],
        );
      } else {
        await loadRouteEntry(conn, companyId, input.branchId, input.entityId, 'salida-totalizar');
        await conn.execute(
          `UPDATE tbl_contabilidad_detalle SET idtipo_contabilidad=?,dec_total=?,str_detalle=?,
             str_nombre=?,update_at=NOW()
           WHERE idcontabilidad_detalle=? AND idglobal=? AND idsucursal=?`,
          [accountingType, centsToDecimal(amount), detail, name, input.entityId, companyId, input.branchId],
        );
      }
      await savePayrollLink(conn, companyId, input.entityId, payrollId, name);
      return {
        entityId: input.entityId,
        data: { id: input.entityId, routeId, amount: asMoneyNumber(amount), name, detail, accountingType, payrollId },
        recordType: 'accounting',
        action: input.kind === 'CREATE_EXPENSE' ? 'INSERT' : 'UPDATE',
        branchId: input.branchId,
      };
    }
    case 'CREATE_BASE':
    case 'UPDATE_BASE': {
      const routeId = await openRoute(conn, companyId, input.branchId, employeeId, cargo, input.routeId ?? null);
      const amount = decimalToCents(payload.valor as number);
      const detail = String(payload.detalle ?? '');
      if (input.kind === 'CREATE_BASE') {
        await conn.execute(
          `INSERT INTO tbl_contabilidad_detalle (idcontabilidad_detalle,idglobal,idsucursal,
             idtipo_contabilidad,iddetalleruta,dec_total,str_detalle,str_nombre,str_estado,
             str_operacion,created_empleado_id,created_at,update_at)
           VALUES (?,?,?,8,?,?,?,'base','created','info-totalizar',?,NOW(),NOW())`,
          [input.entityId, companyId, input.branchId, routeId,
            centsToDecimal(amount), detail, employeeId],
        );
      } else {
        await loadRouteEntry(conn, companyId, input.branchId, input.entityId, 'info-totalizar');
        await conn.execute(
          `UPDATE tbl_contabilidad_detalle SET dec_total=?,str_detalle=?,update_at=NOW()
           WHERE idcontabilidad_detalle=? AND idglobal=? AND idsucursal=?`,
          [centsToDecimal(amount), detail, input.entityId, companyId, input.branchId],
        );
      }
      return {
        entityId: input.entityId,
        data: { id: input.entityId, routeId, amount: asMoneyNumber(amount), name: 'base', detail },
        recordType: 'accounting',
        action: input.kind === 'CREATE_BASE' ? 'INSERT' : 'UPDATE',
        branchId: input.branchId,
      };
    }
    case 'DELETE_EXPENSE':
    case 'DELETE_BASE': {
      await openRoute(conn, companyId, input.branchId, employeeId, cargo, input.routeId ?? null);
      const operation = input.kind === 'DELETE_EXPENSE' ? 'salida-totalizar' : 'info-totalizar';
      await loadRouteEntry(conn, companyId, input.branchId, input.entityId, operation);
      if (input.kind === 'DELETE_EXPENSE') await assertCanChangePayrollBonus(conn, user, input.branchId, input.entityId);
      await conn.execute(
        `DELETE FROM tbl_contabilidad_detalle
         WHERE idcontabilidad_detalle=? AND idglobal=? AND idsucursal=? AND str_estado='created'`,
        [input.entityId, companyId, input.branchId],
      );
      await conn.execute(
        'DELETE FROM tbl_detalle_nomina WHERE idcontabilidad_detalle=? AND idglobal=?',
        [input.entityId, companyId],
      );
      return {
        entityId: input.entityId,
        data: { id: input.entityId, deleted: true },
        recordType: 'accounting',
        action: 'DELETE',
        branchId: input.branchId,
      };
    }
  }
}

// Only the categories and names the branch office publishes (tbl_tipo_contabilidad /
// tbl_de_contabilidad, shared catalog 1001 plus the company's own) can be written, so a
// queued expense can never invent a concept the office does not recognize.
async function assertExpenseCatalog(
  conn: SqlConnection, companyId: number, accountingType: number, name: string,
) {
  const [rows] = await conn.execute<RowDataPacket[]>(
    `SELECT 1 FROM tbl_de_contabilidad d
     JOIN tbl_tipo_contabilidad t ON t.idtipo_contabilidad=d.idtipo_contabilidad
     WHERE d.idtipo_contabilidad=? AND d.str_de=? AND d.idglobal IN (?, ?)
       AND t.idglobal IN (?, ?) AND t.str_operacion='salida'
       AND t.str_categoria NOT IN ('contabilidad','salida') LIMIT 1`,
    [accountingType, name, SHARED_CATALOG_COMPANY, companyId, SHARED_CATALOG_COMPANY, companyId],
  );
  if (!rows[0]) fail('VALIDATION_ERROR', 'That expense concept is not in the branch catalog');
}

export async function assertPayroll(
  conn: SqlConnection, user: AuthContext['user'], branchId: number, payrollId: number, routeId: number,
) {
  const query = authorizedPayrollQuery(user, branchId, payrollId, routeId);
  const [rows] = await conn.execute<RowDataPacket[]>(query.sql, query.params);
  if (!rows[0]) fail('FORBIDDEN', 'No puede registrar sueldo para este empleado.');
}

async function savePayrollLink(
  conn: SqlConnection, companyId: number, entryId: string, payrollId: number | null, name: string,
) {
  const [bonus] = await conn.execute<RowDataPacket[]>(
    `SELECT b.employee_id FROM tbl_employee_payroll_bonus b
     LEFT JOIN tbl_nomina n ON n.idglobal=b.idglobal AND n.idnomina=?
     WHERE b.idglobal=? AND b.expense_id=? AND (n.idempleado=b.employee_id)`,
    [payrollId, companyId, entryId]);
  if (bonus.length) return;
  const [isBonus] = await conn.execute<RowDataPacket[]>(
    'SELECT 1 FROM tbl_employee_payroll_bonus WHERE idglobal=? AND expense_id=?', [companyId, entryId]);
  if (isBonus.length) fail('FORBIDDEN', 'El beneficiario del bono no puede cambiar.');
  await conn.execute(
    'DELETE FROM tbl_detalle_nomina WHERE idcontabilidad_detalle=? AND idglobal=?',
    [entryId, companyId],
  );
  if (payrollId === null) return;
  await conn.execute(
    `INSERT INTO tbl_detalle_nomina (idglobal,idnomina,idcontabilidad_detalle,str_tipo,str_estado)
     VALUES (?,?,?,?,'entregando')`,
    [companyId, payrollId, entryId, name],
  );
}

// An entry can only be rewritten while it is still 'created': once the day is handed over it
// belongs to a closed route, the same rule payments already follow.
async function loadRouteEntry(
  conn: SqlConnection, companyId: number, branchId: number, entryId: string, operation: string,
) {
  const [rows] = await conn.execute<RowDataPacket[]>(
    `SELECT str_estado,str_operacion,str_nombre FROM tbl_contabilidad_detalle
     WHERE idcontabilidad_detalle=? AND idglobal=? AND idsucursal=? FOR UPDATE`,
    [entryId, companyId, branchId],
  );
  const entry = rows[0];
  if (!entry) fail('NOT_FOUND', 'Accounting entry not found');
  if (entry.str_operacion !== operation || (operation === 'info-totalizar' && entry.str_nombre !== 'base')) {
    fail('BUSINESS_RULE', 'That entry is not a route expense or base');
  }
  if (entry.str_estado !== 'created') fail('BUSINESS_RULE', 'Only created entries can be edited or deleted');
  return entry;
}

type BankSplit = { idbanco: number; valor: number; referencia?: string };

// Stores how much of an abono (tbl_descripcion_pago) or of a new credit (tbl_tarjeta_pago) went
// through company bank accounts. Replaces any previous rows, so it also serves payment edits.
// The rest of the amount is cash, which is what the collector must carry in the pocket.
export async function saveBankSplits(
  conn: SqlConnection, target: 'payment' | 'credit', id: string, companyId: number, branchId: number,
  userId: number, splits: BankSplit[] | undefined, maxCents: bigint, changeCents = 0n,
) {
  const table = target === 'payment' ? 'tbl_descripcion_pago' : 'tbl_tarjeta_pago';
  const column = target === 'payment' ? 'iddescripcion' : 'idtarjeta';
  await conn.execute(`DELETE FROM ${table} WHERE ${column}=? AND idglobal=?`, [id, companyId]);
  if (!splits?.length) {
    if (changeCents !== 0n) fail('BUSINESS_RULE', 'Cash change requires a bank transfer');
    return;
  }
  const bankIds = splits.map((split) => split.idbanco);
  if (new Set(bankIds).size !== bankIds.length) fail('VALIDATION_ERROR', 'Each bank account can appear only once');
  const total = splits.reduce((sum, split) => sum + decimalToCents(split.valor), 0n);
  // A transfer larger than the abono is valid only when the operator declared the cash change
  // they handed back; the excess then leaves the collector's pocket instead of being ignored.
  const excess = total > maxCents ? total - maxCents : 0n;
  if (changeCents !== excess) {
    fail('BUSINESS_RULE', excess > 0n
      ? 'Declare the cash change to accept a transfer larger than the operation amount'
      : 'Cash change is only possible when the bank amount exceeds the operation amount');
  }
  const [banks] = await conn.execute<RowDataPacket[]>(
    `SELECT b.idbanco FROM tbl_banco b
     JOIN tbl_banco_sucursal bs ON bs.idbanco=b.idbanco AND bs.idglobal=b.idglobal AND bs.idsucursal=?
     WHERE b.idglobal=? AND b.str_estado='activo'
     AND b.idbanco IN (${bankIds.map(() => '?').join(',')})`,
    [branchId, companyId, ...bankIds],
  );
  if (banks.length !== bankIds.length) fail('BUSINESS_RULE', 'Bank account is inactive or not authorized in this branch');
  for (const split of splits) {
    await conn.execute(
      `INSERT INTO ${table} (idglobal,${column},idbanco,dec_valor,str_referencia,idusuario,created_at)
       VALUES (?,?,?,?,?,?,NOW())`,
      [companyId, id, split.idbanco, decimal(split.valor), split.referencia?.trim() || null, userId],
    );
  }
}

async function recalculateBalance(conn: SqlConnection, credit: CreditRow) {
  const [rows] = await conn.execute<RowDataPacket[]>(
    'SELECT COALESCE(SUM(dec_abono),0) AS total FROM tbl_descripcion WHERE idtarjeta=? AND idglobal=? AND idsucursal=?',
    [credit.idtarjeta, credit.idglobal, credit.idsucursal],
  );
  const balance = decimalToCents(credit.dec_valor)
    + decimalToCents(String(rows[0]?.total ?? 0));
  await conn.execute(
    'UPDATE tbl_tarjetas SET dec_resta=?,updated_at=NOW() WHERE idtarjeta=? AND idglobal=? AND idsucursal=?',
    [centsToDecimal(balance), credit.idtarjeta, credit.idglobal, credit.idsucursal],
  );
  return asMoneyNumber(balance);
}

function cryptoRandomId() {
  return globalThis.crypto.randomUUID();
}

export async function applyOfflineOperation(context: AuthContext | null, input: OfflineInput): Promise<OperationResult> {
  const user = requireAuth(context);
  if (!operationKinds.includes(input.kind)) fail('VALIDATION_ERROR', 'Unsupported operation kind');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.operationId)) {
    fail('VALIDATION_ERROR', 'operationId must be a UUID');
  }
  if (!Number.isSafeInteger(input.branchId) || input.branchId < 1) fail('VALIDATION_ERROR', 'Invalid branchId');
  const routeId = input.routeId ?? null;
  if (routeId !== null && (!Number.isSafeInteger(routeId) || routeId < 1)) fail('VALIDATION_ERROR', 'Invalid routeId');
  const entityIdMax = input.kind.includes('COMMENT') || input.kind.includes('CREDIT') || input.kind.includes('LOCATION')
    || input.kind.includes('PAYMENT') || input.kind.includes('EXPENSE')
    || input.kind.includes('BASE') || input.kind === 'UPSERT_ALERT' ? 50 : 100;
  if (input.entityId.length < 1 || input.entityId.length > entityIdMax) {
    fail('VALIDATION_ERROR', `entityId must contain between 1 and ${entityIdMax} characters`);
  }
  if ((input.kind === 'UPDATE_CUSTOMER' || input.kind === 'UPDATE_DOCUMENT' || input.kind.includes('CUSTOMER_PHONE')
      || input.kind === 'RECORD_WHATSAPP_OPEN' || input.kind === 'RECORD_WHATSAPP_RECEIPT')
      && !/^[1-9]\d*$/.test(input.entityId)) {
    fail('VALIDATION_ERROR', 'Customer entityId must be a positive customer ID');
  }
  input = { ...input, baseVersion: input.baseVersion ?? null };
  if (input.baseVersion != null && !/^\d+$/.test(input.baseVersion)) {
    fail('VALIDATION_ERROR', 'baseVersion must be a non-negative event cursor');
  }
  const payload = parseOperationPayload(input.kind, input.payload);
  if (input.kind === 'CHANGE_CREDIT_STATUS'
      && !['moroso', 'fallecio', 'discapacitado'].includes(String(payload.status))) {
    fail('VALIDATION_ERROR', 'Reserved or unsupported credit status');
  }
  const createsNewEntity = input.kind === 'CREATE_CUSTOMER' || input.kind === 'CREATE_CREDIT'
    || input.kind === 'CREATE_COMMENT' || input.kind === 'CREATE_EXPENSE'
    || input.kind === 'CREATE_BASE' || input.kind === 'CREATE_LOCATION';
  const noBaseVersionNeeded = createsNewEntity || input.kind === 'DELETE_LOCATION'
    || input.kind === 'RECORD_WHATSAPP_OPEN' || input.kind === 'RECORD_WHATSAPP_RECEIPT';
  if (!noBaseVersionNeeded && input.baseVersion === null) {
    fail('VALIDATION_ERROR', 'baseVersion is required when mutating an existing record');
  }
  const permission = permissionForOperation(input.kind, payload);
  if (permission) await requirePermission(user, input.branchId, permission);
  else await assertBranchAccess(user, input.branchId);
  if (['CREATE_EXPENSE', 'UPDATE_EXPENSE', 'DELETE_EXPENSE', 'CREATE_BASE', 'UPDATE_BASE', 'DELETE_BASE'].includes(input.kind)) {
    await requireTemporaryCashPermission(user, input.branchId);
  }

  const conn = await getConnection() as SqlConnection;
  const createdFiles: string[] = [];
  try {
    await conn.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
    await conn.beginTransaction();
    const normalizedRequest = {
      kind: input.kind, branchId: input.branchId, entityId: input.entityId,
      baseVersion: input.baseVersion, payload,
      // Left out when absent so receipts stored before routeId existed keep the same digest.
      ...(routeId !== null ? { routeId } : {}),
    };
    const payloadHash = payloadDigest(normalizedRequest);
    try {
      await conn.execute(
        `INSERT INTO mobile_operation
         (operation_id,idusuario,idglobal,operation_kind,entity_id,payload_hash,state,created_at)
         VALUES (?,?,?,?,?,?,'processing',NOW())`,
        [input.operationId, user.userId, user.companyId, input.kind, input.entityId, payloadHash],
      );
    } catch (error) {
      if ((error as { code?: string }).code !== 'ER_DUP_ENTRY') throw error;
      const [existingRows] = await conn.execute<RowDataPacket[]>(
        `SELECT payload_hash,result_json,state FROM mobile_operation
         WHERE operation_id=? AND idusuario=? AND idglobal=? FOR UPDATE`,
        [input.operationId, user.userId, user.companyId],
      );
      const existing = existingRows[0];
      if (!existing) fail('INTERNAL_SERVER_ERROR', 'Unable to resolve duplicate operation receipt');
      assertPayloadDigestMatch(String(existing.payload_hash), normalizedRequest);
      if (existing.state !== 'complete' || !existing.result_json) {
        fail('CONFLICT', 'The operation receipt is incomplete; retry with a new operation ID');
      }
      const replay = JSON.parse(String(existing.result_json)) as OperationResult;
      await conn.commit();
      return { ...replay, replayed: true };
    }

    // Checked before the version check: a record whose route already closed can never live,
    // so it must not stop the queue as a conflict.
    if (routeId !== null && isRouteBoundKind(input.kind)) {
      await assertQueuedRouteOpen(conn, user.companyId, input.branchId, routeId);
    }

    const isCreate = createsNewEntity;
    if (!noBaseVersionNeeded) {
      let events: RowDataPacket[];
      if (eventRecordType(input.kind) === 'customer') {
        const [customerRows] = await conn.execute<RowDataPacket[]>(
          'SELECT idpersona FROM tbl_clientes WHERE idcliente=? AND idglobal=? LIMIT 1',
          [input.entityId, user.companyId],
        );
        const personId = customerRows[0]?.idpersona;
        const [eventRows] = await conn.execute<RowDataPacket[]>(
          `SELECT COALESCE(MAX(id),0) AS version FROM mobile_change_event
           WHERE idglobal=? AND idsucursal=? AND action<>'WA_OPEN' AND
             ((record_type='customer' AND record_id=?) OR (record_type='person' AND record_id=?))`,
          [user.companyId, input.branchId, input.entityId, personId == null ? '' : String(personId)],
        );
        events = eventRows;
      } else {
        const [eventRows] = await conn.execute<RowDataPacket[]>(
          `SELECT COALESCE(MAX(id),0) AS version FROM mobile_change_event
           WHERE idglobal=? AND record_type=? AND record_id=? AND idsucursal=?`,
          [user.companyId, eventRecordType(input.kind), input.entityId, input.branchId],
        );
        events = eventRows;
      }
      const latest = String(events[0]?.version ?? 0);
      try { assertBaseVersion(latest, input.baseVersion ?? null); }
      catch (error) {
        if ((error as { extensions?: { code?: string } }).extensions?.code === 'CONFLICT') {
          const currentRecord = await loadCurrentRecord(
            conn, user.companyId, input.branchId, user.userId, input.kind, input.entityId,
          );
          conflict('Record changed after the supplied base version',
            currentRecord ?? { id: input.entityId, deleted: true });
        }
        throw error;
      }
    }
    const result = await executeOperation(conn, user, input, payload, createdFiles);
    const [eventResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO mobile_change_event
       (idglobal,idsucursal,record_type,record_id,action,related_id,payload_json,created_at)
       VALUES (?,?,?,?,?,?,?,NOW())`,
      [user.companyId, result.branchId, result.recordType, result.entityId, result.action,
        result.relatedId ?? null, JSON.stringify(result.data)],
    );
    const response: OperationResult = {
      operationId: input.operationId,
      status: 'applied',
      entityId: result.entityId,
      data: result.data,
      eventCursor: String(eventResult.insertId),
    };
    if (input.kind === 'RECORD_WHATSAPP_OPEN' || (input.kind === 'RECORD_WHATSAPP_RECEIPT' && payload.telefono != null)) {
      // Fan out by person, without materializing the large UNION view used by legacy triggers.
      await conn.execute(
        `INSERT INTO mobile_change_event
         (idglobal,idsucursal,record_type,record_id,action,related_id,payload_json,created_at)
         SELECT ?,s.idsucursal,'customer',CAST(c.idcliente AS CHAR),'WA_OPEN',?,
                JSON_SET(?,'$.id',c.idcliente),NOW()
         FROM tbl_clientes c JOIN tbl_sucursal s ON s.idglobal=c.idglobal
         WHERE c.idglobal=? AND c.idpersona=?
           AND ${branchScopeExists('c').replaceAll('?', 's.idsucursal')}
           AND NOT (s.idsucursal=? AND c.idcliente=?)`,
        [user.companyId, result.relatedId, JSON.stringify(result.data),
          user.companyId, result.relatedId, input.branchId, input.entityId],
      );
    }
    await conn.execute(
      `UPDATE mobile_operation SET entity_id=?,result_json=?,state='complete',completed_at=NOW()
       WHERE operation_id=? AND idusuario=? AND idglobal=?`,
      [result.entityId, JSON.stringify(response), input.operationId, user.userId, user.companyId],
    );
    await conn.commit();
    return response;
  } catch (error) {
    await conn.rollback();
    if (process.env.FILES_ROOT) {
      await Promise.all(createdFiles.map((filename) =>
        unlink(`${process.env.FILES_ROOT}/${filename}`).catch(() => undefined)));
    }
    throw mapTransactionError(error);
  } finally {
    conn.release();
  }
}

function eventRecordType(kind: Kind) {
  if (kind.includes('EXPENSE') || kind.includes('BASE')) return 'accounting';
  if (kind.includes('CUSTOMER') || kind === 'UPDATE_DOCUMENT' || kind === 'RECORD_WHATSAPP_OPEN'
    || kind === 'RECORD_WHATSAPP_RECEIPT') return 'customer';
  if (kind === 'CREATE_PAYMENT') return 'credit';
  if (kind.includes('PAYMENT')) return 'payment';
  if (kind.includes('COMMENT') || kind === 'UPSERT_ALERT') return 'comment';
  if (kind.includes('LOCATION')) return 'location';
  return 'credit';
}

async function loadCurrentRecord(
  conn: SqlConnection, companyId: number, branchId: number,
  userId: number, kind: Kind, id: string,
) {
  if (kind.includes('EXPENSE') || kind.includes('BASE')) {
    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT idcontabilidad_detalle AS id,dec_total AS amount,str_nombre AS name,
              str_detalle AS detail,str_operacion AS operation,str_estado AS state,
              idtipo_contabilidad AS accountingType,iddetalleruta AS routeId
       FROM tbl_contabilidad_detalle
       WHERE idcontabilidad_detalle=? AND idglobal=? AND idsucursal=? LIMIT 1`,
      [id, companyId, branchId],
    );
    return rows[0] ?? null;
  }
  if (kind.includes('CUSTOMER') || kind === 'UPDATE_DOCUMENT' || kind === 'RECORD_WHATSAPP_OPEN'
    || kind === 'RECORD_WHATSAPP_RECEIPT') {
    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT c.idcliente AS id,c.idpersona AS personId,c.idglobal AS companyId,
              c.dec_max_credito AS maxCredit,c.str_apodo AS nickname,c.str_nota AS note,
              c.str_estado AS customerStatus,COALESCE(c.str_calificacion,'') AS rating,
              p.str_nombres AS firstName,p.str_apellidos AS lastName,p.str_sexo AS sex,
              p.str_fecha_nacimiento AS birthDate,p.str_tipo_documento AS documentType,
              p.str_num_documento AS documentNumber,p.str_telefono AS phone,p.str_email AS email,
              p.str_foto AS photo,p.str_ocupacion AS occupation,p.str_estado AS personStatus,
              p.str_nota AS personNote,p.str_direccion_departamento AS department,
              p.str_direccion_ciudad AS city,p.str_direccion_barrio AS neighborhood,
              p.str_direccion_calle AS street,c.fiador_persona_id AS guarantorPersonId,
              ${RATING_STATE_FIELDS}
       FROM tbl_clientes c JOIN tbl_persona p ON p.idpersona=c.idpersona AND p.idglobal=c.idglobal
       ${RATING_STATE_JOIN}
       WHERE c.idcliente=? AND c.idglobal=? AND ${branchScopeExists('c')}
       LIMIT 1`,
      [id, companyId, branchId, branchId, branchId],
    );
    if (rows[0]) rows[0].phones = await customerPhones(conn.execute.bind(conn), companyId, Number(rows[0].personId));
    return rows[0] ?? null;
  }
  if (kind.includes('LOCATION')) {
    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT idlocation AS id,idtarjeta AS creditId,str_nombre AS name,
              (dec_latitud + 0E0) AS latitude,(dec_longitud + 0E0) AS longitude,int_precision_m AS accuracy,
              idusuario AS userId,created_at AS createdAt
       FROM mobile_credit_location
       WHERE idlocation=? AND idglobal=? AND idsucursal=? LIMIT 1`,
      [id, companyId, branchId],
    );
    return rows[0] ?? null;
  }
  const table = kind === 'CREATE_PAYMENT'
    ? 'tbl_tarjetas WHERE idtarjeta=? AND idglobal=? AND idsucursal=?'
    : kind.includes('PAYMENT')
      ? 'tbl_descripcion WHERE iddescripcion=? AND idglobal=? AND idsucursal=?'
      : kind.includes('COMMENT') || kind === 'UPSERT_ALERT'
        ? `tbl_comentarios WHERE idcomentario=? AND idusuario=? AND EXISTS
          (SELECT 1 FROM tbl_comentarios_cliente l JOIN tbl_clientes c ON c.idcliente=l.idcliente
           WHERE l.idcomentario=tbl_comentarios.idcomentario AND c.idglobal=?
             AND ${branchScopeExists('c')})`
        : 'tbl_tarjetas WHERE idtarjeta=? AND idglobal=? AND idsucursal=?';
  const params = kind.includes('COMMENT') || kind === 'UPSERT_ALERT'
    ? [id, userId, companyId, branchId, branchId, branchId]
    : [id, companyId, branchId];
  const [rows] = await conn.execute<RowDataPacket[]>(`SELECT * FROM ${table} LIMIT 1`, params);
  return rows[0] ?? null;
}
