import { createHash, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { RowDataPacket } from 'mysql2/promise';
import { getConnection, pool } from '../db.js';
import { fail } from './errors.js';

export function secondsUntilNextMidnight(now = new Date()): number {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.max(1, Math.ceil((midnight.getTime() - now.getTime()) / 1000));
}

export interface AuthUser {
  userId: number;
  companyId: number;
  employeeId: number | null;
  cargo: string | null;
  employeeMaxCredit: number | string | null;
  username: string;
  firstName: string;
  lastName: string;
  companyName: string;
}
export interface AuthContext {
  user: AuthUser;
  permissions: Array<{ branchId: number; name: string }>;
}

export function canAccessBranch(
  cargo: string | null,
  authenticatedCompanyId: number,
  branchCompanyId: number,
  hasActiveEmployeeAssociation: boolean,
) {
  return authenticatedCompanyId === branchCompanyId
    && (cargo === 'Super Administrador' || hasActiveEmployeeAssociation);
}

export function assertPermissionGranted(cargo: string | null, granted: boolean, permission: string) {
  if (cargo !== 'Super Administrador' && !granted) {
    fail('FORBIDDEN', `Missing permission: ${permission}`);
  }
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) fail('CONFIGURATION_ERROR', 'JWT_SECRET must contain at least 32 characters');
  return secret;
}

export function legacyPasswordMatches(plainText: string, storedDigest: string): boolean {
  if (!/^[a-f\d]{32}$/i.test(storedDigest)) return false;
  const actual = createHash('md5').update(plainText, 'utf8').digest();
  const expected = Buffer.from(storedDigest, 'hex');
  return timingSafeEqual(actual, expected);
}

type UserRow = RowDataPacket & {
  idusuario: number; idglobal: number; idpersona: number; str_user_name: string;
  str_password: string; str_nombres: string; str_apellidos: string; str_razon_social: string;
  idempleado: number | null; str_cargo: string | null; str_estado: string;
  employeeMaxCredit: number | string | null;
};

type PaymentRow = RowDataPacket & { expiresAt: number | string; expired: number };

export async function companyPaymentExpiry(companyId: number): Promise<number | null> {
  const [rows] = await pool.execute<PaymentRow[]>(
    `SELECT UNIX_TIMESTAMP(DATE_ADD(date_corte, INTERVAL (int_dias_extras + 1) DAY)) * 1000 AS expiresAt,
            DATE_ADD(date_corte, INTERVAL int_dias_extras DAY) < CURRENT_DATE() AS expired
     FROM tbl_descripcion_global
     WHERE idglobal_accion = ? AND str_estado = 'actual'
     LIMIT 1`,
    [companyId],
  );
  // The web allows access when there is no current payment record.
  if (!rows.length) return null;
  const expiry = Number(rows[0].expiresAt);
  if (rows[0].expiresAt == null || !Number.isFinite(expiry) || ![0, 1].includes(Number(rows[0].expired))) {
    fail('CONFIGURATION_ERROR', 'Invalid company payment date');
  }
  if (Number(rows[0].expired) === 1) {
    fail('PAYMENT_REQUIRED', 'No hemos registrado su pago. Servicio no disponible; comuníquese con el administrador.');
  }
  return expiry;
}

const USER_SELECT = `
 SELECT u.idusuario, u.idglobal, u.idpersona, u.str_user_name, u.str_password,
        p.str_nombres, p.str_apellidos, g.str_razon_social,
        e.idempleado, e.str_cargo, e.dec_max_credito AS employeeMaxCredit, u.str_estado
 FROM tbl_usuario u
 JOIN tbl_persona p ON p.idpersona = u.idpersona AND p.idglobal = u.idglobal
 JOIN tbl_global g ON g.idglobal = u.idglobal
 LEFT JOIN tbl_empleado e ON e.idpersona = u.idpersona AND e.idglobal = u.idglobal`;

function asAuthUser(row: UserRow): AuthUser {
  return {
    userId: Number(row.idusuario),
    companyId: Number(row.idglobal),
    employeeId: row.idempleado == null ? null : Number(row.idempleado),
    cargo: row.str_cargo,
    employeeMaxCredit: row.employeeMaxCredit,
    username: row.str_user_name,
    firstName: row.str_nombres,
    lastName: row.str_apellidos,
    companyName: row.str_razon_social,
  };
}

export async function login(companyId: number, username: string, password: string) {
  const [rows] = await pool.execute<UserRow[]>(
    `${USER_SELECT} WHERE u.idglobal = ? AND u.str_user_name = ? LIMIT 1`,
    [companyId, username],
  );
  const row = rows[0];
  if (!row || row.str_estado === 'inactivo' || !legacyPasswordMatches(password, row.str_password)) {
    fail('UNAUTHENTICATED', 'Invalid credentials');
  }
  return issueLoginPayload(row);
}

export async function loginWithTrustedUser(companyId: number, username: string) {
  const [rows] = await pool.execute<UserRow[]>(
    `${USER_SELECT} WHERE u.idglobal = ? AND u.str_user_name = ? LIMIT 1`,
    [companyId, username],
  );
  const row = rows[0];
  if (!row || row.str_estado === 'inactivo') {
    fail('UNAUTHENTICATED', 'Invalid credentials');
  }
  return issueLoginPayload(row);
}

async function issueLoginPayload(row: UserRow) {
  const user = asAuthUser(row);
  const paymentExpiresAt = await companyPaymentExpiry(user.companyId);
  const expiresIn = secondsUntilNextMidnight();
  const token = jwt.sign({ sub: String(user.userId), companyId: user.companyId }, jwtSecret(), {
    expiresIn,
    issuer: 'backend-creditos-apk',
    audience: 'android-client',
  });
  return { token, expiresIn, user, paymentExpiresAt, branches: await listBranches(user) };
}

export async function authenticateRequest(
  authorization?: string, options: { allowExpiredPayment?: boolean } = {},
): Promise<AuthContext | null> {
  if (!authorization) return null;
  const [scheme, token, extra] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token || extra) fail('UNAUTHENTICATED', 'Bearer token required');
  let claims: jwt.JwtPayload;
  try {
    const result = jwt.verify(token, jwtSecret(), {
      issuer: 'backend-creditos-apk', audience: 'android-client',
    });
    if (typeof result === 'string') fail('UNAUTHENTICATED', 'Invalid token');
    claims = result;
  } catch {
    fail('UNAUTHENTICATED', 'Invalid or expired token');
  }
  const userId = Number(claims.sub);
  const companyId = Number(claims.companyId);
  if (!Number.isSafeInteger(userId) || !Number.isSafeInteger(companyId)) fail('UNAUTHENTICATED', 'Invalid token');
  const [rows] = await pool.execute<UserRow[]>(
    `${USER_SELECT} WHERE u.idusuario = ? AND u.idglobal = ? LIMIT 1`,
    [userId, companyId],
  );
  const row = rows[0];
  if (!row || row.str_estado === 'inactivo' || (row.idempleado != null && row.str_estado === 'inactivo')) {
    fail('UNAUTHENTICATED', 'User is not active');
  }
  const user = asAuthUser(row);
  if (!options.allowExpiredPayment) await companyPaymentExpiry(user.companyId);
  const permissions: Array<{ branchId: number; name: string }> = [];
  if (user.employeeId != null) {
    const [permissionRows] = await pool.execute(
      `SELECT DISTINCT s.idsucursal AS branchId, a.str_nombre AS name
       FROM tbl_auth_sucursal s
       JOIN tbl_sucursal b ON b.idsucursal = s.idsucursal AND b.idglobal = s.idglobal
       JOIN tbl_auths x ON x.idauth_sucursal = s.idauth_sucursal
       JOIN tbl_auth a ON a.idauth = x.idauth
       WHERE s.idempleado = ? AND s.idglobal = ? AND s.str_estado <> 'inactivo'`,
      [user.employeeId, user.companyId],
    );
    permissions.push(...permissionRows as Array<{ branchId: number; name: string }>);
  }
  return { user, permissions };
}

export async function listBranches(user: AuthUser) {
  const admin = user.cargo === 'Super Administrador';
  const [rows] = admin
    ? await pool.execute(
      `SELECT s.idsucursal AS id, s.str_codigo AS name, s.str_tipo AS type,
              s.str_cobro_adicional AS extraCharge, o.idoficina AS officeId, o.str_nombre AS officeName
       FROM tbl_sucursal s
       LEFT JOIN tbl_oficina o ON o.idoficina = s.idoficina AND o.idglobal = s.idglobal
       WHERE s.idglobal = ? ORDER BY s.idsucursal`,
      [user.companyId],
    )
    : user.employeeId == null
      ? [[] as never, [] as never]
      : await pool.execute(
        `SELECT DISTINCT s.idsucursal AS id, s.str_codigo AS name, s.str_tipo AS type,
                s.str_cobro_adicional AS extraCharge, o.idoficina AS officeId, o.str_nombre AS officeName
         FROM tbl_sucursal s
         LEFT JOIN tbl_auth_sucursal a ON a.idsucursal = s.idsucursal
           AND a.idglobal = s.idglobal AND a.idempleado = ? AND a.str_estado <> 'inactivo'
         LEFT JOIN tbl_oficina o ON o.idoficina = s.idoficina AND o.idglobal = s.idglobal
         WHERE s.idglobal = ? AND (a.idauth_sucursal IS NOT NULL OR o.idempleado_administrador = ?)
         ORDER BY s.idsucursal`,
        [user.employeeId, user.companyId, user.employeeId],
      );
  return rows;
}

export async function isOfficeAdministrator(user: AuthUser, branchId: number): Promise<boolean> {
  if (user.employeeId == null) return false;
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 FROM tbl_sucursal s
     JOIN tbl_oficina o ON o.idoficina = s.idoficina AND o.idglobal = s.idglobal
     WHERE s.idsucursal = ? AND s.idglobal = ? AND o.idempleado_administrador = ? LIMIT 1`,
    [branchId, user.companyId, user.employeeId],
  );
  return rows.length > 0;
}

export async function assertBranchAccess(user: AuthUser, branchId: number): Promise<void> {
  if (user.employeeId == null && user.cargo !== 'Super Administrador') {
    fail('FORBIDDEN', 'Employee branch access is required');
  }
  const [rows] = await pool.execute(
    `SELECT b.idglobal AS branchCompanyId, a.idauth_sucursal, o.idoficina AS administeredOfficeId
     FROM tbl_sucursal b
     LEFT JOIN tbl_auth_sucursal a ON a.idsucursal = b.idsucursal
       AND a.idglobal = b.idglobal AND a.str_estado <> 'inactivo' AND a.idempleado = ?
     LEFT JOIN tbl_oficina o ON o.idoficina = b.idoficina AND o.idglobal = b.idglobal
       AND o.idempleado_administrador = ?
     WHERE b.idsucursal = ? LIMIT 1`,
    [user.employeeId ?? -1, user.employeeId ?? -1, branchId],
  );
  const branch = (rows as Array<{
    branchCompanyId: number; idauth_sucursal: number | null; administeredOfficeId: number | null;
  }>)[0];
  if (!branch || !canAccessBranch(
    user.cargo,
    user.companyId,
    Number(branch.branchCompanyId),
    branch.idauth_sucursal != null || branch.administeredOfficeId != null,
  )) fail('FORBIDDEN', 'Branch is not available');
}

// Office administrators also bypass named permissions, limited to their office's branches.
export async function hasPermission(user: AuthUser, branchId: number, permission: string): Promise<boolean> {
  if (user.cargo === 'Super Administrador') return true;
  if (await isOfficeAdministrator(user, branchId)) return true;
  const [rows] = await pool.execute(
    `SELECT a.str_nombre FROM tbl_auth_sucursal s
     JOIN tbl_auths x ON x.idauth_sucursal = s.idauth_sucursal
     JOIN tbl_auth a ON a.idauth = x.idauth
     WHERE s.idempleado = ? AND s.idsucursal = ? AND s.idglobal = ?
       AND s.str_estado <> 'inactivo' AND a.str_nombre = ? LIMIT 1`,
    [user.employeeId, branchId, user.companyId, permission],
  );
  return Array.isArray(rows) && rows.length > 0;
}

export async function requirePermission(user: AuthUser, branchId: number, permission: string): Promise<void> {
  await assertBranchAccess(user, branchId);
  assertPermissionGranted(user.cargo, await hasPermission(user, branchId, permission), permission);
}

// Legacy restore actions (see model/Cliente.php::restaurarMoroso) accept either of two
// permission names interchangeably, unlike other operations that require one exact match.
export async function requireAnyPermission(user: AuthUser, branchId: number, permissions: string[]): Promise<void> {
  await assertBranchAccess(user, branchId);
  let granted = false;
  for (const permission of permissions) {
    if (await hasPermission(user, branchId, permission)) { granted = true; break; }
  }
  assertPermissionGranted(user.cargo, granted, permissions.join(' or '));
}

export async function assertRecordBranch(
  user: AuthUser,
  branchId: number,
  table: 'tbl_clientes' | 'tbl_tarjetas' | 'tbl_descripcion',
  idColumn: string,
  recordId: string | number,
) {
  await assertBranchAccess(user, branchId);
  const [rows] = await pool.execute(
    `SELECT ${idColumn} FROM ${table} WHERE ${idColumn} = ? AND idsucursal = ? AND idglobal = ? LIMIT 1`,
    [recordId, branchId, user.companyId],
  );
  if (!Array.isArray(rows) || rows.length === 0) fail('NOT_FOUND', 'Record not found');
}

export async function withAuthConnection<T>(callback: (conn: Awaited<ReturnType<typeof getConnection>>) => Promise<T>) {
  const conn = await getConnection();
  try { return await callback(conn); } finally { conn.release(); }
}
