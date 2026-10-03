import { createPublicKey, randomBytes, randomUUID, verify } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getConnection, pool } from '../db.js';
import type { AuthContext } from './auth.js';
import { loginWithTrustedUser } from './auth.js';
import { fail, mapTransactionError } from './errors.js';

const CHALLENGE_TTL_SECONDS = 300;

type UserLoginRow = RowDataPacket & {
  idusuario: number;
  idglobal: number;
  str_estado: string;
};

type CredentialRow = RowDataPacket & {
  idcredential: string;
  idusuario: number;
  idglobal: number;
  device_id: string;
  public_key_spki: string;
};

type ChallengeRow = RowDataPacket & {
  idchallenge: string;
  idcredential: string | null;
  idusuario: number;
  idglobal: number;
  device_id: string;
  str_purpose: string;
  challenge_base64: string;
  expires_at: string;
  used_at: string | null;
};

export interface BiometricChallenge {
  challengeId: string;
  challenge: string;
  expiresIn: number;
}

function cleanDeviceId(raw: string): string {
  const deviceId = raw.trim();
  if (!/^[A-Za-z0-9._:-]{8,120}$/.test(deviceId)) {
    fail('VALIDATION_ERROR', 'Invalid biometric device identifier');
  }
  return deviceId;
}

function decodeBase64Strict(value: string, label: string): Buffer {
  const compact = value.trim();
  if (!compact || compact.length > 4096 || !/^[A-Za-z0-9+/=]+$/.test(compact)) {
    fail('VALIDATION_ERROR', `Invalid ${label}`);
  }
  const decoded = Buffer.from(compact, 'base64');
  if (!decoded.length || decoded.toString('base64') !== compact) {
    fail('VALIDATION_ERROR', `Invalid ${label}`);
  }
  return decoded;
}

function verifyChallengeSignature(publicKeySpkiBase64: string, challengeBase64: string, signatureBase64: string): boolean {
  const publicKeyDer = decodeBase64Strict(publicKeySpkiBase64, 'biometric public key');
  const signature = decodeBase64Strict(signatureBase64, 'biometric signature');
  const challenge = decodeBase64Strict(challengeBase64, 'biometric challenge');
  try {
    const key = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
    return verify('sha256', challenge, key, signature);
  } catch {
    fail('VALIDATION_ERROR', 'Invalid biometric public key');
  }
}

async function findActiveUser(companyId: number, username: string): Promise<UserLoginRow | null> {
  const [users] = await pool.execute<UserLoginRow[]>(
    `SELECT idusuario, idglobal, str_estado
     FROM tbl_usuario
     WHERE idglobal=? AND str_user_name=? LIMIT 1`,
    [companyId, username],
  );
  const user = users[0];
  if (!user || user.str_estado === 'inactivo') return null;
  return user;
}

async function createChallenge(args: {
  idglobal: number;
  idusuario: number;
  deviceId: string;
  purpose: 'ENROLL' | 'LOGIN';
  credentialId?: string | null;
}): Promise<BiometricChallenge> {
  const challengeId = randomUUID().replace(/-/g, '');
  const challenge = randomBytes(32).toString('base64');
  await pool.execute(
    `INSERT INTO mobile_biometric_challenge
      (idchallenge,idcredential,idglobal,idusuario,device_id,str_purpose,challenge_base64,expires_at,created_at)
     VALUES (?,?,?,?,?,?,?,DATE_ADD(NOW(), INTERVAL ? SECOND),NOW())`,
    [challengeId, args.credentialId ?? null, args.idglobal, args.idusuario, args.deviceId, args.purpose, challenge, CHALLENGE_TTL_SECONDS],
  );
  await pool.execute(
    `DELETE FROM mobile_biometric_challenge
     WHERE expires_at < NOW() OR used_at IS NOT NULL`,
  );
  return { challengeId, challenge, expiresIn: CHALLENGE_TTL_SECONDS };
}

export async function startBiometricRegistration(auth: AuthContext | null, deviceIdRaw: string): Promise<BiometricChallenge> {
  if (!auth) fail('UNAUTHENTICATED', 'Inicia sesión para activar la biometría');
  const deviceId = cleanDeviceId(deviceIdRaw);
  return createChallenge({
    idglobal: auth.user.companyId,
    idusuario: auth.user.userId,
    deviceId,
    purpose: 'ENROLL',
  });
}

export async function finishBiometricRegistration(
  auth: AuthContext | null,
  args: { challengeId: string; deviceId: string; publicKeySpki: string; signature: string },
): Promise<{ enabled: boolean }> {
  if (!auth) fail('UNAUTHENTICATED', 'Inicia sesión para activar la biometría');
  const challengeId = args.challengeId.trim();
  if (!/^[A-Fa-f0-9]{32}$/.test(challengeId)) fail('VALIDATION_ERROR', 'Invalid biometric challenge id');
  const deviceId = cleanDeviceId(args.deviceId);
  const publicKeySpki = args.publicKeySpki.trim();
  if (publicKeySpki.length > 4096) fail('VALIDATION_ERROR', 'Invalid biometric public key');
  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    const [challengeRows] = await connection.execute<ChallengeRow[]>(
      `SELECT idchallenge,idcredential,idglobal,idusuario,device_id,str_purpose,challenge_base64,expires_at,used_at
       FROM mobile_biometric_challenge
       WHERE idchallenge=? AND str_purpose='ENROLL' AND used_at IS NULL AND expires_at > NOW()
       LIMIT 1 FOR UPDATE`,
      [challengeId],
    );
    const challenge = challengeRows[0];
    if (!challenge) {
      fail('UNAUTHENTICATED', 'El reto biométrico ya venció. Inténtalo de nuevo.');
    }
    if (challenge.idglobal !== auth.user.companyId || challenge.idusuario !== auth.user.userId || challenge.device_id !== deviceId) {
      fail('FORBIDDEN', 'El reto biométrico no coincide con tu sesión.');
    }
    if (!verifyChallengeSignature(publicKeySpki, challenge.challenge_base64, args.signature)) {
      fail('UNAUTHENTICATED', 'La firma biométrica no es válida.');
    }
    const credentialId = randomUUID().replace(/-/g, '');
    await connection.execute<ResultSetHeader>(
      `INSERT INTO mobile_biometric_credential
         (idcredential,idglobal,idusuario,device_id,public_key_spki,str_estado,created_at,updated_at,last_used_at,revoked_at)
       VALUES (?,?,?,?,?,'activo',NOW(),NOW(),NULL,NULL)
       ON DUPLICATE KEY UPDATE
         idcredential=VALUES(idcredential),
         public_key_spki=VALUES(public_key_spki),
         str_estado='activo',
         updated_at=NOW(),
         revoked_at=NULL`,
      [credentialId, auth.user.companyId, auth.user.userId, deviceId, publicKeySpki],
    );
    await connection.execute(
      'UPDATE mobile_biometric_challenge SET used_at=NOW(), idcredential=? WHERE idchallenge=?',
      [credentialId, challengeId],
    );
    await connection.commit();
    return { enabled: true };
  } catch (error) {
    await connection.rollback();
    throw mapTransactionError(error);
  } finally {
    connection.release();
  }
}

export async function startBiometricLogin(companyId: number, usernameRaw: string, deviceIdRaw: string): Promise<BiometricChallenge> {
  const username = usernameRaw.trim();
  if (!username) fail('VALIDATION_ERROR', 'Invalid login input');
  const deviceId = cleanDeviceId(deviceIdRaw);
  const user = await findActiveUser(companyId, username);
  if (!user) fail('UNAUTHENTICATED', 'Invalid credentials');
  const [credentials] = await pool.execute<CredentialRow[]>(
    `SELECT idcredential,idglobal,idusuario,device_id,public_key_spki
     FROM mobile_biometric_credential
     WHERE idglobal=? AND idusuario=? AND device_id=? AND str_estado='activo' AND revoked_at IS NULL
     LIMIT 1`,
    [user.idglobal, user.idusuario, deviceId],
  );
  const credential = credentials[0];
  if (!credential) fail('UNAUTHENTICATED', 'Invalid credentials');
  return createChallenge({
    idglobal: user.idglobal,
    idusuario: user.idusuario,
    deviceId,
    purpose: 'LOGIN',
    credentialId: credential.idcredential,
  });
}

export async function biometricLogin(args: {
  companyId: number;
  username: string;
  deviceId: string;
  challengeId: string;
  signature: string;
}) {
  const challengeId = args.challengeId.trim();
  if (!/^[A-Fa-f0-9]{32}$/.test(challengeId)) fail('VALIDATION_ERROR', 'Invalid biometric challenge id');
  const username = args.username.trim();
  if (!username) fail('VALIDATION_ERROR', 'Invalid login input');
  const deviceId = cleanDeviceId(args.deviceId);
  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    const [userRows] = await connection.execute<UserLoginRow[]>(
      `SELECT idusuario,idglobal,str_estado
       FROM tbl_usuario
       WHERE idglobal=? AND str_user_name=? LIMIT 1 FOR UPDATE`,
      [args.companyId, username],
    );
    const user = userRows[0];
    if (!user || user.str_estado === 'inactivo') fail('UNAUTHENTICATED', 'Invalid credentials');
    const [credentialRows] = await connection.execute<CredentialRow[]>(
      `SELECT idcredential,idglobal,idusuario,device_id,public_key_spki
       FROM mobile_biometric_credential
       WHERE idglobal=? AND idusuario=? AND device_id=? AND str_estado='activo' AND revoked_at IS NULL
       LIMIT 1 FOR UPDATE`,
      [user.idglobal, user.idusuario, deviceId],
    );
    const credential = credentialRows[0];
    if (!credential) fail('UNAUTHENTICATED', 'Invalid credentials');
    const [challengeRows] = await connection.execute<ChallengeRow[]>(
      `SELECT idchallenge,idcredential,idglobal,idusuario,device_id,str_purpose,challenge_base64,expires_at,used_at
       FROM mobile_biometric_challenge
       WHERE idchallenge=? AND idcredential=? AND str_purpose='LOGIN' AND used_at IS NULL AND expires_at > NOW()
       LIMIT 1 FOR UPDATE`,
      [challengeId, credential.idcredential],
    );
    const challenge = challengeRows[0];
    if (!challenge) {
      fail('UNAUTHENTICATED', 'Biometric challenge expired');
    }
    if (challenge.idglobal !== user.idglobal || challenge.idusuario !== user.idusuario || challenge.device_id !== deviceId) {
      fail('UNAUTHENTICATED', 'Invalid credentials');
    }
    if (!verifyChallengeSignature(credential.public_key_spki, challenge.challenge_base64, args.signature)) {
      fail('UNAUTHENTICATED', 'Invalid credentials');
    }
    await connection.execute('UPDATE mobile_biometric_challenge SET used_at=NOW() WHERE idchallenge=?', [challengeId]);
    await connection.execute('UPDATE mobile_biometric_credential SET last_used_at=NOW(), updated_at=NOW() WHERE idcredential=?', [credential.idcredential]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw mapTransactionError(error);
  } finally {
    connection.release();
  }
  return loginWithTrustedUser(args.companyId, username);
}
