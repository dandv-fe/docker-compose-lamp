import { createHash, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { RowDataPacket } from 'mysql2/promise';
import { getConnection, pool } from '../db.js';
import { fail } from './errors.js';

const TOKEN_TTL_SECONDS = 15 * 60;

export interface AuthUser {
  userId: number;
  companyId: number;
  employeeId: number | null;
  cargo: string | null;
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
};

const USER_SELECT = `
 SELECT u.idusuario, u.idglobal, u.idpersona, u.str_user_name, u.str_password,
        p.str_nombres, p.str_apellidos, g.str_razon_social,
        e.idempleado, e.str_cargo, u.str_estado
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
  const user = asAuthUser(row);
  const token = jwt.sign({ sub: String(user.userId), companyId: user.companyId }, jwtSecret(), {
    expiresIn: TOKEN_TTL_SECONDS,
    issuer: 'backend-creditos-apk',
    audience: 'android-client',
  });
  return { token, expiresIn: TOKEN_TTL_SECONDS, user, branches: await listBranches(user) };
}

export async function authenticateRequest(authorization?: string): Promise<AuthContext | null> {
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
      `SELECT s.idsucursal AS id, s.str_codigo AS name, s.str_tipo AS type
       FROM tbl_sucursal s WHERE s.idglobal = ? ORDER BY s.idsucursal`,
      [user.companyId],
    )
    : user.employeeId == null
      ? [[] as never, [] as never]
      : await pool.execute(
        `SELECT DISTINCT s.idsucursal AS id, s.str_codigo AS name, s.str_tipo AS type
         FROM tbl_auth_sucursal a JOIN tbl_sucursal s ON s.idsucursal = a.idsucursal
         WHERE a.idempleado = ? AND a.idglobal = ? AND a.str_estado <> 'inactivo'
           AND s.idglobal = ? ORDER BY s.idsucursal`,
        [user.employeeId, user.companyId, user.companyId],
      );
  return rows;
}

export async function assertBranchAccess(user: AuthUser, branchId: number): Promise<void> {
  if (user.employeeId == null && user.cargo !== 'Super Administrador') {
    fail('FORBIDDEN', 'Employee branch access is required');
  }
  const [rows] = await pool.execute(
    `SELECT b.idglobal AS branchCompanyId, a.idauth_sucursal
     FROM tbl_sucursal b
     LEFT JOIN tbl_auth_sucursal a ON a.idsucursal = b.idsucursal
       AND a.idglobal = b.idglobal AND a.str_estado <> 'inactivo' AND a.idempleado = ?
     WHERE b.idsucursal = ? LIMIT 1`,
    [user.employeeId ?? -1, branchId],
  );
  const branch = (rows as Array<{ branchCompanyId: number; idauth_sucursal: number | null }>)[0];
  if (!branch || !canAccessBranch(
    user.cargo,
    user.companyId,
    Number(branch.branchCompanyId),
    branch.idauth_sucursal != null,
  )) fail('FORBIDDEN', 'Branch is not available');
}

// Mirrors PHP's `isset($_SESSION['userEmpresa']) || in_array($permission, ...AUTHS)`: a
// Super Administrador always passes, everyone else needs the named branch permission row.
export async function hasPermission(user: AuthUser, branchId: number, permission: string): Promise<boolean> {
  if (user.cargo === 'Super Administrador') return true;
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
