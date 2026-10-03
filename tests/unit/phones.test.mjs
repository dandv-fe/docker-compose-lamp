import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, requirePhone, customerPhones, phoneForChange } from '../../dist/services/phones.js';
import { permissionForOperation, assertCustomerBranch, applyOfflineOperation, isRouteBoundKind } from '../../dist/services/operations.js';
import { parseOperationPayload } from '../../dist/services/validation.js';
import { schema } from '../../dist/graphql/schema.js';

test('phone validation accepts one Colombian mobile or international number', () => {
  assert.equal(phoneForChange('300 / 310', '300 / 310'), '300 / 310');
  assert.equal(phoneForChange('', '300 / 310'), '');
  assert.equal(phoneForChange('3000000001', '300 / 310'), '573000000001');
  assert.throws(() => phoneForChange('300 / 310', '3000000001'));
  for (const raw of ['3001234567', '+57 300 123 4567', '00573001234567']) {
    assert.equal(requirePhone(raw), '573001234567');
  }
  assert.equal(requirePhone('+1 202 555 0123'), '12025550123');
  for (const raw of ['3001234567 / 3101234567', '3001234567 3101234567', '3001234567,3101234567',
    '3001234567 ext 2', 'abc3001234567', '1234567890', '570012345678', '', '00000000000']) {
    assert.equal(normalizePhone(raw), null);
    assert.throws(() => requirePhone(raw), { extensions: { code: 'VALIDATION_ERROR' } });
  }
});

test('phone-only operations require access, not editar cliente; full editing stays protected', async () => {
  await customerPhones(async (sql, params) => {
    assert.match(sql, /WHERE idglobal=\? AND idpersona=\?/);
    assert.deepEqual(params, [7, 12]);
    return [[], []];
  }, 7, 12);
  assert.equal(permissionForOperation('UPDATE_CUSTOMER', {}), 'editar cliente');
  assert.equal(permissionForOperation('UPDATE_DOCUMENT', {}), 'editar cliente');
  for (const kind of ['ADD_CUSTOMER_PHONE', 'SELECT_CUSTOMER_PHONE', 'RECORD_WHATSAPP_OPEN']) {
    assert.equal(permissionForOperation(kind, {}), undefined);
    assert.equal(isRouteBoundKind(kind), false);
    assert.deepEqual(parseOperationPayload(kind, { telefono: '573001234567' }), { telefono: '573001234567' });
    assert.throws(() => parseOperationPayload(kind, { telefono: '573001234567', idpersona: 999 }));
    await assert.rejects(applyOfflineOperation(null, { kind }), { extensions: { code: 'UNAUTHENTICATED' } });
  }
  await assert.rejects(assertCustomerBranch({ execute: async (sql, params) => {
    assert.match(sql, /c\.idglobal = \?/);
    assert.match(sql, /tbl_auth_sucursal/);
    assert.deepEqual(params, [99, 7, 4, 4, 4]);
    return [[], []];
  } }, 7, 4, 99), { extensions: { code: 'NOT_FOUND' } });
});

test('usage only accepts normalized valid history candidate and no arbitrary counters', () => {
  for (const telefono of ['', '3001234567', '+573001234567', 'legacy / phone', '00000000000']) {
    assert.throws(() => parseOperationPayload('RECORD_WHATSAPP_OPEN', { telefono }));
  }
  assert.throws(() => parseOperationPayload('RECORD_WHATSAPP_OPEN', { telefono: '573001234567', count: 50 }));
});

test('phone validity is normalized, boolean, scoped and available without editar cliente', async () => {
  const kind = 'SET_CUSTOMER_PHONE_VALIDITY';
  assert.equal(permissionForOperation(kind, {}), undefined);
  assert.equal(isRouteBoundKind(kind), false);
  for (const invalid of [true, false]) {
    assert.deepEqual(parseOperationPayload(kind, { telefono: '573001234567', invalid }), { telefono: '573001234567', invalid });
  }
  for (const payload of [{ telefono: '3001234567', invalid: true },
    { telefono: '573001234567', invalid: 'false' }, { telefono: '573001234567' },
    { telefono: '573001234567', invalid: true, userId: 2 }]) {
    assert.throws(() => parseOperationPayload(kind, payload));
  }
  await assert.rejects(applyOfflineOperation(null, { kind }), { extensions: { code: 'UNAUTHENTICATED' } });
  const phones = await customerPhones(async () => [[{ id: '1', invalid: 1, validityChangedBy: '9' },
    { id: '2', invalid: 0 }], []], 7, 12);
  assert.equal(phones[0].invalid, true);
  assert.equal(phones[1].invalid, false);
  assert.ok(schema.getType('CustomerPhone').getFields().invalid);
});

test('schema exposes history and both queue operation kinds', () => {
  assert.ok(schema.getType('Customer').getFields().phones);
  assert.ok(schema.getType('CustomerPhone').getFields().whatsappOpenCount);
  assert.ok(schema.getType('CustomerPhone').getFields().whatsappLastOpenedAt);
  const enums = Object.values(schema.getTypeMap()).filter(t => typeof t.getValues === 'function');
  assert.ok(enums.some(t => t.getValues().some(v => v.name === 'ADD_CUSTOMER_PHONE')));
  assert.ok(enums.some(t => t.getValues().some(v => v.name === 'SELECT_CUSTOMER_PHONE')));
  assert.ok(enums.some(t => t.getValues().some(v => v.name === 'RECORD_WHATSAPP_OPEN')));
});
