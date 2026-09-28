import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { assertPermissionGranted, canAccessBranch, legacyPasswordMatches } from '../../dist/services/auth.js';
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
