import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../db.js';
import type { AuthContext, AuthUser } from './auth.js';
import { fail } from './errors.js';

const MAX_VERSION_CODE = 2147483647;

export function mobileAppPolicy(env: NodeJS.ProcessEnv = process.env) {
  const versionCode = (key: string) => {
    const raw = env[key] ?? '1';
    const value = Number(raw);
    if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(value) || value > MAX_VERSION_CODE) {
      fail('CONFIGURATION_ERROR', `${key} must be a positive GraphQL Int`);
    }
    return value;
  };
  const latestVersionCode = versionCode('MOBILE_APP_LATEST_VERSION_CODE');
  const minimumVersionCode = versionCode('MOBILE_APP_MIN_VERSION_CODE');
  if (latestVersionCode < minimumVersionCode) {
    fail('CONFIGURATION_ERROR', 'MOBILE_APP_LATEST_VERSION_CODE must be >= MOBILE_APP_MIN_VERSION_CODE');
  }
  const latestVersionName = env.MOBILE_APP_LATEST_VERSION_NAME ?? '0.1.0';
  if (!latestVersionName.trim() || latestVersionName.length > 80 || /[\u0000-\u001f\u007f]/.test(latestVersionName)) {
    fail('CONFIGURATION_ERROR', 'MOBILE_APP_LATEST_VERSION_NAME must contain 1..80 printable characters');
  }
  const downloadUrl = env.MOBILE_APP_DOWNLOAD_URL ?? '';
  if (downloadUrl !== '') {
    let url: URL;
    try { url = new URL(downloadUrl); } catch {
      fail('CONFIGURATION_ERROR', 'MOBILE_APP_DOWNLOAD_URL must be an absolute HTTPS URL or empty');
    }
    if (
      !/^https:\/\//i.test(downloadUrl) || /[\s\u0000-\u001f\u007f\\]/.test(downloadUrl) ||
      url.protocol !== 'https:' || !url.hostname || url.username || url.password
    ) {
      fail('CONFIGURATION_ERROR', 'MOBILE_APP_DOWNLOAD_URL must be an absolute HTTPS URL without credentials or empty');
    }
  }
  if (minimumVersionCode > 1 && downloadUrl === '') {
    fail('CONFIGURATION_ERROR', 'MOBILE_APP_DOWNLOAD_URL must provide an HTTPS download location when MOBILE_APP_MIN_VERSION_CODE > 1');
  }
  return {
    latestVersionCode, minimumVersionCode, latestVersionName, downloadUrl,
    message: env.MOBILE_APP_UPDATE_MESSAGE ?? '',
  };
}

function requireUser(context: AuthContext | null): AuthUser {
  if (!context) fail('UNAUTHENTICATED', 'Authentication is required');
  return context.user;
}

function migrationError(error: unknown): never {
  if ((error as { code?: string })?.code === 'ER_NO_SUCH_TABLE') {
    fail('CONFIGURATION_ERROR', 'App installation reporting requires manually applying migrations/012_app_installations.sql');
  }
  throw error;
}

export async function reportAppInstallation(
  context: AuthContext | null, installationId: string, versionCode: number, versionName: string,
): Promise<boolean> {
  const user = requireUser(context);
  if (
    typeof installationId !== 'string' || !/^[A-Za-z0-9._:-]{1,120}$/.test(installationId) ||
    !Number.isInteger(versionCode) || versionCode <= 0 || versionCode > MAX_VERSION_CODE ||
    typeof versionName !== 'string' || !versionName.trim() || versionName.length > 80 ||
    /[\u0000-\u001f\u007f]/.test(versionName)
  ) {
    fail('VALIDATION_ERROR', 'Invalid app installation: ID must be 1..120 ASCII identifier characters, versionCode a positive Int, versionName 1..80 printable characters');
  }
  try {
    await pool.execute(
      `INSERT INTO mobile_app_installation (idglobal, idusuario, installation_id, version_code, version_name, last_seen_at)
       VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE version_code=VALUES(version_code), version_name=VALUES(version_name),
         last_seen_at=UTC_TIMESTAMP(3)`,
      [user.companyId, user.userId, installationId, versionCode, versionName],
    );
    return true;
  } catch (error) { return migrationError(error); }
}

export function appInstallationsQuery(user: Pick<AuthUser, 'companyId' | 'userId' | 'employeeId' | 'cargo'>) {
  const params: number[] = [user.companyId];
  let scope = '';
  if (user.cargo !== 'Super Administrador') {
    // Match payroll/branch scope: office administration is a company-bound DB association,
    // not a client-supplied office or a role-name shortcut.
    scope = `AND (i.idusuario=? OR EXISTS (
      SELECT 1 FROM tbl_oficina o
      WHERE o.idglobal=i.idglobal AND o.idoficina=e.idoficina AND o.idempleado_administrador=?
    ))`;
    params.push(user.userId, user.employeeId ?? -1);
  }
  return {
    sql: `SELECT i.installation_id AS installationId, i.idusuario AS userId,
        e.idempleado AS employeeId,
        CASE WHEN e.idempleado IS NULL THEN NULL
          ELSE TRIM(CONCAT_WS(' ', p.str_nombres, p.str_apellidos)) END AS employeeName,
        i.version_code AS versionCode, i.version_name AS versionName,
        DATE_FORMAT(i.last_seen_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS lastSeenAt
      FROM mobile_app_installation i
      JOIN tbl_usuario u ON u.idusuario=i.idusuario AND u.idglobal=i.idglobal
      LEFT JOIN tbl_empleado e ON e.idpersona=u.idpersona AND e.idglobal=u.idglobal
      LEFT JOIN tbl_persona p ON p.idpersona=e.idpersona AND p.idglobal=e.idglobal
      WHERE i.idglobal=? ${scope}
      ORDER BY i.last_seen_at DESC, i.idusuario, i.installation_id
      LIMIT 100`,
    params,
  };
}

export async function appInstallations(context: AuthContext | null) {
  const query = appInstallationsQuery(requireUser(context));
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(query.sql, query.params);
    return rows;
  } catch (error) { return migrationError(error); }
}
