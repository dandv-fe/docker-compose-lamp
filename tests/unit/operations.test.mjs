import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertBaseVersion, assertPayloadMatch, operationPayloadSchemas, parseOperationPayload,
  centsToDecimal, decimalToCents, payloadDigest, stableJson, serializeAlert, rejectExistingAlert,
} from '../../dist/services/validation.js';
import { applyOfflineOperation } from '../../dist/services/operations.js';
import { mapTransactionError } from '../../dist/services/errors.js';

test('idempotency payload comparison is key-order independent and rejects changed input', () => {
  assert.equal(stableJson({ b: 2, a: { y: 1, x: 0 } }), stableJson({ a: { x: 0, y: 1 }, b: 2 }));
  assert.doesNotThrow(() => assertPayloadMatch({ amount: 12, id: 'x' }, { id: 'x', amount: 12 }));
  assert.throws(
    () => assertPayloadMatch({ amount: 12 }, { amount: 13 }),
    { extensions: { code: 'IDEMPOTENCY_MISMATCH' } },
  );
  assert.equal(payloadDigest({ a: 1, b: 2 }), payloadDigest({ b: 2, a: 1 }));
  assert.notEqual(payloadDigest({ amount: 12 }), payloadDigest({ amount: 13 }));
});

test('base versions allow current records and report stale mutations as conflicts', () => {
  assert.doesNotThrow(() => assertBaseVersion(9, 9));
  assert.doesNotThrow(() => assertBaseVersion(9, null));
  assert.throws(() => assertBaseVersion(10, 9), { extensions: { code: 'CONFLICT' } });
});

test('monetary calculations use decimal cents without floating-point accumulation', () => {
  assert.equal(decimalToCents('10.10'), 1010n);
  assert.equal(decimalToCents(0.1 + 0.2), 30n);
  assert.equal(decimalToCents('-2.345'), -235n);
  assert.equal(centsToDecimal(999999n), '9999.99');
});

test('reserved credit states are rejected before any database access', async () => {
  const context = { user: { userId: 1, companyId: 1, employeeId: 1, cargo: 'Cobrador' } };
  await assert.rejects(
    applyOfflineOperation(context, {
      operationId: '123e4567-e89b-42d3-a456-426614174000',
      branchId: 1, kind: 'CHANGE_CREDIT_STATUS', entityId: 'credit-1',
      baseVersion: '0', payload: { status: 'created' },
    }),
    { extensions: { code: 'VALIDATION_ERROR' } },
  );
});

test('deadlocked or timed-out transactions return a retryable conflict for the same operation ID', () => {
  for (const code of ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']) {
    const error = mapTransactionError({ code });
    assert.equal(error.extensions.code, 'CONFLICT');
    assert.equal(error.extensions.retryable, true);
    assert.match(error.message, /same operationId/);
  }
  assert.equal(mapTransactionError(new Error('other')).message, 'other');
});

test('credit payload uses observed Spanish frequency values and rejects client tenant IDs', () => {
  const base = {
    idtarjeta: '123e4567-e89b-42d3-a456-426614174000', idcliente: 1,
    concepto: 'Consumo', valor: 100, modo: 'Semanal', plazo: 4, prestamo: 80,
    descripcion: 'Crédito', item: 1, utilidad: 20, adicionalNumero: '', adicionalValor: 0,
    tipoComprobante: '', serie: '', numero: '10', nota: '', detalleDocumentoSucursalId: 2,
  };
  assert.equal(parseOperationPayload('CREATE_CREDIT', base).modo, 'Semanal');
  assert.equal(operationPayloadSchemas.CREATE_CREDIT.safeParse({ ...base, modo: 'Weekly' }).success, false);
  assert.equal(operationPayloadSchemas.CREATE_CREDIT.safeParse({ ...base, idglobal: 9 }).success, false);
});

test('alert payloads preserve observed fields and serialize in PHP representation', () => {
  const payload = {
    idcliente: 4, icon: 'warning', color: '#f00', subject: 'sub/,ject', text: 'body/,text',
  };
  assert.equal(parseOperationPayload('UPSERT_ALERT', payload).idcliente, 4);
  assert.equal(serializeAlert(payload), 'warning/,#f00/,subject/,bodytext');
  assert.equal(operationPayloadSchemas.UPSERT_ALERT.safeParse({ ...payload, userId: 8 }).success, false);
  assert.throws(
    () => serializeAlert({ icon: 'i'.repeat(250), color: 'c', subject: 's', text: 't' }),
    { extensions: { code: 'VALIDATION_ERROR' } },
  );
});

test('existing alerts conflict rather than update', () => {
  assert.doesNotThrow(() => rejectExistingAlert(false));
  assert.throws(
    () => rejectExistingAlert(true),
    { extensions: { code: 'CONFLICT' } },
  );
});
