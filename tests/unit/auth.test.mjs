import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { assertBranchAccess, assertPermissionGranted, canAccessBranch, hasPermission, legacyPasswordMatches, listBranches } from '../../dist/services/auth.js';
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
        assert.deepEqual(params, [31, 7, 31]);
        assert.match(sql, /o\.idglobal = s\.idglobal/);
        return [[{ id: 4, name: 'A' }], []];
      }
      if (sql.includes('SELECT b.idglobal AS branchCompanyId')) {
        return [[params[2] === 4
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
