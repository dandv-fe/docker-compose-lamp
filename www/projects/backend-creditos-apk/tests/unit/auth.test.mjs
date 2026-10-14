import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { assertBranchAccess, assertPermissionGranted, authenticateRequest, canAccessBranch, companyPaymentExpiry, hasPermission, legacyPasswordMatches, listBranches, login, secondsUntilNextMidnight } from '../../dist/services/auth.js';
import { pool } from '../../dist/db.js';
import { assertCompanyScope } from '../../dist/services/validation.js';
import { permissionForOperation } from '../../dist/services/operations.js';

test('legacy login compares the exact lowercase MD5 digest without transforming the password', () => {
  const password = ' legacy pass ';
  const digest = createHash('md5').update(password).digest('hex');
  assert.equal(legacyPasswordMatches(password, digest), true);
  assert.equal(legacyPasswordMatches('legacy pass', digest), false);
  assert.equal(legacyPasswordMatches(password, digest.toUpperCase()), true);
  assert.equal(legacyPasswordMatches(password, 'not-a-digest'), false);
});

test('login token lifetime ends at the next server-local midnight', () => {
  const now = new Date(2026, 8, 30, 21, 15, 30, 250);
  const nextMidnight = new Date(2026, 9, 1, 0, 0, 0, 0);
  assert.equal(
    secondsUntilNextMidnight(now),
    Math.ceil((nextMidnight.getTime() - now.getTime()) / 1000),
  );
});

test('payment guard follows the web cutoff plus extra days and permits companies without a current record', async () => {
  const original = pool.execute;
  const expiry = Date.UTC(2026, 9, 12);
  try {
    pool.execute = async (sql, params) => {
      assert.match(sql, /tbl_descripcion_global/);
      assert.match(sql, /str_estado = 'actual'/);
      assert.match(sql, /CURRENT_DATE\(\)/);
      assert.deepEqual(params, [7]);
      return [[{ expiresAt: expiry, expired: 0 }], []];
    };
    assert.equal(await companyPaymentExpiry(7), expiry);
    pool.execute = async () => [[{ expiresAt: expiry, expired: 1 }], []];
    await assert.rejects(companyPaymentExpiry(7), { extensions: { code: 'PAYMENT_REQUIRED' } });
    pool.execute = async () => [[], []];
    assert.equal(await companyPaymentExpiry(7), null);
    pool.execute = async () => [[{ expiresAt: null, expired: null }], []];
    await assert.rejects(companyPaymentExpiry(7), { extensions: { code: 'CONFIGURATION_ERROR' } });
  } finally {
    pool.execute = original;
  }
});

test('expired company payment blocks both login and existing tokens before accessing portfolio data', async () => {
  const original = pool.execute;
  const secret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-only-secret-at-least-32-characters-long';
  const password = 'test-password';
  const user = {
    idusuario: 12, idglobal: 7, idpersona: 15, str_user_name: 'collector',
    str_password: createHash('md5').update(password).digest('hex'), str_estado: 'activo',
    str_nombres: 'Test', str_apellidos: 'User', str_razon_social: 'Company',
    idempleado: 5, str_cargo: 'Cobrador', employeeMaxCredit: null,
  };
  try {
    pool.execute = async (sql, params) => {
      if (sql.includes('FROM tbl_usuario u')) {
        assert.deepEqual(params, sql.includes('str_user_name = ?') ? [7, 'collector'] : [12, 7]);
        return [[user], []];
      }
      assert.match(sql, /FROM tbl_descripcion_global/);
      assert.deepEqual(params, [7]);
      return [[{ expiresAt: Date.UTC(2026, 9, 12), expired: 1 }], []];
    };
    await assert.rejects(login(7, 'collector', password), { extensions: { code: 'PAYMENT_REQUIRED' } });
    const token = jwt.sign({ sub: '12', companyId: 7 }, process.env.JWT_SECRET, {
      issuer: 'backend-creditos-apk', audience: 'android-client',
    });
    await assert.rejects(authenticateRequest(`Bearer ${token}`), { extensions: { code: 'PAYMENT_REQUIRED' } });
  } finally {
    pool.execute = original;
    if (secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secret;
  }
});

test('branch guard recognizes only the exact company admin title and always checks tenant', () => {
  assert.equal(canAccessBranch('Super Administrador', 7, 7, false), true);
  assert.equal(canAccessBranch('super administrador', 7, 7, true), true);
  assert.equal(canAccessBranch('Super Administrador', 7, 8, false), false);
  assert.equal(canAccessBranch('Cobrador', 7, 7, true), true);
  assert.equal(canAccessBranch('Cobrador', 7, 7, false), false);
});

test('company scope rejects a record from another tenant', () => {
  assert.doesNotThrow(() => assertCompanyScope(4, 4));
  assert.throws(() => assertCompanyScope(4, 5), { extensions: { code: 'FORBIDDEN' } });
});

test('named write permissions map to source permission names and reject missing grants', () => {
  assert.equal(permissionForOperation('CREATE_CUSTOMER', {}), 'crear cliente');
  assert.equal(permissionForOperation('CREATE_CREDIT', {}), 'nueva tarjeta');
  assert.equal(permissionForOperation('DELETE_PAYMENT', {}), 'eliminar cuota');
  assert.equal(permissionForOperation('CHANGE_CREDIT_STATUS', { status: 'moroso' }), 'pasar a morosos');
  assert.equal(permissionForOperation('CHANGE_CREDIT_STATUS', { status: 'fallecio' }), 'pasar a retirados');
  assert.doesNotThrow(() => assertPermissionGranted('Cobrador', true, 'editar cliente'));
  assert.throws(() => assertPermissionGranted('Cobrador', false, 'editar cliente'), {
    extensions: { code: 'FORBIDDEN' },
  });
  assert.doesNotThrow(() => assertPermissionGranted('Super Administrador', false, 'editar cliente'));
});

test('office administration grants branch access and permissions only within the same company and office', async () => {
    const original = pool.execute;
    const user = { companyId: 7, employeeId: 31, cargo: 'Cobrador' };
    const queries = [];
    pool.execute = async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes('SELECT DISTINCT s.idsucursal AS id')) {
        assert.deepEqual(params, [31, 7, 31, 31]);
        assert.match(sql, /o\.idglobal = s\.idglobal/);
        return [[{ id: 4, name: 'A' }], []];
      }
      if (sql.includes('SELECT b.idglobal AS branchCompanyId')) {
        return [[params[3] === 4
          ? { branchCompanyId: 7, idauth_sucursal: null, administeredOfficeId: 2 }
          : { branchCompanyId: 7, idauth_sucursal: null, administeredOfficeId: null }], []];
      }
      if (sql.includes('SELECT 1 FROM tbl_sucursal s')) {
        assert.deepEqual(params.slice(1), [7, 31]);
        return [params[0] === 4 ? [{ 1: 1 }] : [], []];
      }
      if (sql.includes('SELECT a.str_nombre FROM tbl_auth_sucursal')) return [[], []];
      throw new Error(`Unexpected query: ${sql}`);
    };
    try {
      assert.deepEqual(await listBranches(user), [{ id: 4, name: 'A' }]);
      await assertBranchAccess(user, 4);
      assert.equal(await hasPermission(user, 4, 'crear cliente'), true);
      await assert.rejects(assertBranchAccess(user, 5), { extensions: { code: 'FORBIDDEN' } });
      assert.equal(await hasPermission(user, 5, 'crear cliente'), false);
      assert.ok(queries.some(({ sql }) => sql.includes('o.idempleado_administrador = ?')));
    } finally {
      pool.execute = original;
    }
});
