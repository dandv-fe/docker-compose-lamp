import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  appTimeZone, zoneOffsetMinutes, sameBusinessDaySql, assertReceiptTarget, countReceiptOpen,
} from '../../dist/services/receipts.js';
import { permissionForOperation, applyOfflineOperation, isRouteBoundKind } from '../../dist/services/operations.js';
import { parseOperationPayload, payloadDigest } from '../../dist/services/validation.js';
import { schema } from '../../dist/graphql/schema.js';

const kind = 'RECORD_WHATSAPP_RECEIPT';

test('receipt opening payload is strict: normalized optional phone, record kind and id only', () => {
  const base = { tipo: 'credit', registroId: '5f0c1f8e-1111-4111-8111-111111111111' };
  assert.deepEqual(parseOperationPayload(kind, base), base);
  assert.deepEqual(parseOperationPayload(kind, { ...base, telefono: null }), { ...base, telefono: null });
  assert.deepEqual(parseOperationPayload(kind, { ...base, tipo: 'payment', telefono: '573001234567' }),
    { ...base, tipo: 'payment', telefono: '573001234567' });
  for (const payload of [
    {}, { tipo: 'credit' }, { registroId: 'x' }, { ...base, tipo: 'customer' }, { ...base, registroId: '' },
    { ...base, registroId: 'x'.repeat(51) }, { ...base, telefono: '3001234567' }, { ...base, telefono: 'a / b' },
    { ...base, count: 3 }, { ...base, idglobal: 1 }, { ...base, idsucursal: 2 }, { ...base, idcliente: 3 },
  ]) assert.throws(() => parseOperationPayload(kind, payload), JSON.stringify(payload));
});

test('receipt opening is additive: no named permission, not route-bound, auth required', async () => {
  assert.equal(permissionForOperation(kind, {}), undefined);
  assert.equal(isRouteBoundKind(kind), false);
  await assert.rejects(applyOfflineOperation(null, { kind }), { extensions: { code: 'UNAUTHENTICATED' } });
  const values = schema.getType('OfflineOperationKind').getValues().map(v => v.name);
  assert.ok(values.includes(kind));
  // No GraphQL type exposes the hidden per-record counter.
  for (const type of Object.values(schema.getTypeMap())) {
    if (typeof type.getFields !== 'function' || type.name.startsWith('__')) continue;
    for (const field of Object.keys(type.getFields())) assert.doesNotMatch(field, /receiptOpen|recordOpen|lastOpenedBy|openCount$(?<!whatsappOpenCount)/i);
  }
});

test('the same receipt request digests identically so a replay is recognized and counted once', () => {
  const request = (payload) => ({ kind, branchId: 4, entityId: '12', baseVersion: null, payload });
  assert.equal(payloadDigest(request({ tipo: 'credit', registroId: 'a', telefono: '573001234567' })),
    payloadDigest(request({ telefono: '573001234567', registroId: 'a', tipo: 'credit' })));
  assert.notEqual(payloadDigest(request({ tipo: 'credit', registroId: 'a' })),
    payloadDigest(request({ tipo: 'credit', registroId: 'b' })));
});

test('business day is computed in APP_TIME_ZONE (default Bogotá) independent of the DB clock', () => {
  assert.equal(appTimeZone({}), 'America/Bogota');
  assert.equal(appTimeZone({ APP_TIME_ZONE: 'UTC' }), 'UTC');
  assert.throws(() => appTimeZone({ APP_TIME_ZONE: 'Mars/Base' }), { extensions: { code: 'CONFIGURATION_ERROR' } });
  assert.equal(zoneOffsetMinutes('America/Bogota', new Date('2026-10-02T23:30:00Z')), -300);
  assert.equal(zoneOffsetMinutes('UTC'), 0);
  assert.equal(zoneOffsetMinutes('Asia/Kolkata'), 330);
  const sql = sameBusinessDaySql('t.created_at');
  assert.match(sql, /TIMESTAMPDIFF\(MINUTE,UTC_TIMESTAMP\(\),NOW\(\)\)/);
  assert.match(sql, /DATE\(UTC_TIMESTAMP\(\) \+ INTERVAL \? MINUTE\)/);
});

function fakeExecute(row, seen = []) {
  return async (sql, params) => { seen.push({ sql, params }); return [row ? [row] : [], []]; };
}

test('receipt target must exist for the customer in company+branch, be created/entregando and from today', async () => {
  const seen = [];
  await assertReceiptTarget(fakeExecute({ state: 'created', description: '', today: 1 }, seen), 7, 4, 12, 'credit', 'card', -300);
  assert.match(seen[0].sql, /FROM tbl_tarjetas t\s+WHERE t\.idtarjeta=\? AND t\.idglobal=\? AND t\.idsucursal=\? AND t\.idcliente=\?/);
  assert.deepEqual(seen[0].params, [-300, -300, 'card', 7, 4, 12]);
  await assertReceiptTarget(fakeExecute({ state: 'entregando', description: 'Abono', today: '1' }, seen), 7, 4, 12, 'payment', 'pay', -300);
  assert.match(seen[1].sql, /FROM tbl_descripcion d\s+JOIN tbl_tarjetas t ON t\.idtarjeta=d\.idtarjeta AND t\.idglobal=d\.idglobal AND t\.idsucursal=d\.idsucursal/);
  assert.match(seen[1].sql, /d\.idglobal=\? AND d\.idsucursal=\? AND t\.idcliente=\?/);
  const refused = { extensions: { code: 'RECEIPT_NOT_ELIGIBLE' } };
  await assert.rejects(assertReceiptTarget(fakeExecute(null), 7, 4, 12, 'credit', 'gone', -300), refused);
  for (const state of ['saved', 'moroso', 'pagado', 'refinanciada', '']) {
    await assert.rejects(assertReceiptTarget(fakeExecute({ state, today: 1 }), 7, 4, 12, 'credit', 'c', -300), refused);
  }
  await assert.rejects(assertReceiptTarget(fakeExecute({ state: 'created', today: 0 }), 7, 4, 12, 'credit', 'c', -300),
    { extensions: { code: 'RECEIPT_NOT_ELIGIBLE' }, message: /no se creó hoy/ });
  await assert.rejects(assertReceiptTarget(fakeExecute({ state: 'created', description: ' Inicial ', today: 1 }),
    7, 4, 12, 'payment', 'p', -300), { message: /cuota inicial/ });
});

test('receipt counter upserts per company/branch/kind/record and records the actor', async () => {
  const seen = [];
  await countReceiptOpen(fakeExecute(null, seen), 7, 4, 'payment', 'p1', 33);
  assert.match(seen[0].sql, /INSERT INTO mobile_whatsapp_receipt_open/);
  assert.match(seen[0].sql, /ON DUPLICATE KEY UPDATE open_count=open_count\+1,last_opened_at=NOW\(\)/);
  assert.deepEqual(seen[0].params, [7, 4, 'payment', 'p1', 33]);
});

test('migration 010 is additive, re-runnable and scoped by company/branch/kind/record', async () => {
  const sql = await readFile(new URL('../../migrations/010_whatsapp_receipt_open.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS `mobile_whatsapp_receipt_open`/);
  assert.match(sql, /PRIMARY KEY \(`idglobal`,`idsucursal`,`record_kind`,`record_id`\)/);
  assert.match(sql, /`record_kind` ENUM\('credit','payment'\)/);
  assert.doesNotMatch(sql, /^\s*(?:DROP|ALTER|UPDATE|DELETE)\b/im);
});
