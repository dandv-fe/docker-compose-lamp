import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertBaseVersion, assertPayloadMatch, operationPayloadSchemas, parseOperationPayload,
  centsToDecimal, decimalToCents, payloadDigest, stableJson, serializeAlert, rejectExistingAlert,
} from '../../dist/services/validation.js';
import { applyOfflineOperation, saveBankSplits, assertCustomerBranch, assertEmployeeCreditApproval, creditAcceptsAdditionalInterest, ensureCreditLimit, nextReceiptNumber, openRoute, planPositionBesideCard, positionBesideCard } from '../../dist/services/operations.js';
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

test('route writes allow dispatch, matching office administrator, or Super Administrador', async () => {
  for (const authorizedBy of ['office', 'dispatch', 'none']) {
    const calls = [];
    const conn = {
      async execute(sql, params) {
        calls.push({ sql, params });
        if (sql.includes('FROM tbl_detalle_ruta')) return [[{ iddetalleruta: 42 }]];
        assert.match(sql, /o\.idoficina = s\.idoficina AND o\.idglobal = s\.idglobal/);
        assert.match(sql, /id_detalle_ruta = \? AND idempleado = \?/);
        return [authorizedBy === 'none' ? [] : [{ 1: 1 }]];
      },
    };
    if (authorizedBy === 'none') {
      await assert.rejects(openRoute(conn, 7, 9, 11, 'Cobrador'), {
        extensions: { code: 'BUSINESS_RULE' },
      });

    } else {
      assert.equal(await openRoute(conn, 7, 9, 11, 'Cobrador'), 42);
    }
    assert.deepEqual(calls[0].params, [7, 9]);
    assert.deepEqual(calls[1].params, [9, 7, 11, 42, 11]);
  }
  const conn = { async execute(sql, params) {
    assert.deepEqual(params, [7, 9]);
    return [[{ iddetalleruta: 42 }]];
  } };
  assert.equal(await openRoute(conn, 7, 9, null, 'Super Administrador'), 42);
  await assert.rejects(openRoute({
    async execute() { return [[]]; },
  }, 7, 9, null, 'Super Administrador'), { extensions: { code: 'BUSINESS_RULE' } });
});

test('credit creation can reuse a company customer without a card in this branch', async () => {
  const conn = { async execute(sql, params) {
    assert.match(sql, /c\.idcliente = \? AND c\.idglobal = \?/);
    assert.doesNotMatch(sql, /EXISTS \(SELECT 1 FROM tbl_tarjetas t2/);
    assert.deepEqual(params, [55, 7]);
    return [[{ idcliente: 55, idglobal: 7, dec_max_credito: '1000', str_estado: 'activo' }]];
  } };
  assert.equal((await assertCustomerBranch(conn, 7, 4, 55, true)).idcliente, 55);
  await assert.rejects(assertCustomerBranch({
    async execute(sql, params) {
      assert.match(sql, /EXISTS \(SELECT 1 FROM tbl_tarjetas t2/);
      assert.deepEqual(params, [55, 7, 4, 4, 4]);
      return [[]];
    },
  }, 7, 4, 55), { extensions: { code: 'NOT_FOUND' } });
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

test('new cards increase the customer limit for authorized staff only', async () => {
  const customer = { idcliente: 17, dec_max_credito: '100.00', str_estado: 'activo' };
  const user = { companyId: 7, employeeId: 31, cargo: 'Cobrador' };
  for (const permission of ['editar cliente', 'editar maximo del credito', 'office', 'none']) {
    const calls = [];
    const conn = { async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('SUM(dec_resta)')) return [[{ debt: '80.00' }]];
      if (sql.includes('FROM tbl_empleado')) {
        assert.deepEqual(params, [31, 7]);
        return [[{ maxCredit: '150.00' }]];
      }
      if (sql.includes('FROM tbl_sucursal s')) {
        assert.match(sql, /au\.idsucursal=\? AND au\.idglobal=\?/);
        assert.match(sql, /o\.idglobal=s\.idglobal/);
        assert.match(sql, /au\.str_estado<>'inactivo'/);
        assert.match(sql, /'editar cliente','editar maximo del credito'/);
        assert.deepEqual(params, [4, 7, 31, 31, 4, 7]);
        return [permission === 'none' ? [] : [{ 1: 1 }]];
      }
      if (sql.startsWith('UPDATE tbl_clientes')) return [{ affectedRows: 1 }];
      throw new Error(`Unexpected query: ${sql}`);
    } };
    if (permission === 'none') {
      await assert.rejects(ensureCreditLimit(conn, user, 4, customer, 5000n), {
        extensions: { code: 'BUSINESS_RULE' },
      });

      test('additional interest cannot refinance cards still being created or handed over', () => {
        assert.equal(creditAcceptsAdditionalInterest('created'), false);
        assert.equal(creditAcceptsAdditionalInterest('entregando'), false);
        assert.equal(creditAcceptsAdditionalInterest('saved'), true);
        assert.equal(creditAcceptsAdditionalInterest('refinanciada'), true);
      });
      assert.equal(calls.some(({ sql }) => sql.startsWith('UPDATE tbl_clientes')), false);
    } else {
      await ensureCreditLimit(conn, user, 4, customer, 5000n);
      assert.deepEqual(calls.at(-1).params, ['130.00', 17, 7]);
    }
  }
});

test('sufficient cupo needs no extra permission; admin increases it but inactive guard remains', async () => {
  const customer = { idcliente: 17, dec_max_credito: '100.00', str_estado: 'activo' };
  const user = { companyId: 7, employeeId: 31, cargo: 'Cobrador' };
  const calls = [];
  const conn = { async execute(sql, params) {
    calls.push({ sql, params });
    if (sql.includes('SUM(dec_resta)')) return [[{ debt: '80.00' }]];
    if (sql.startsWith('UPDATE tbl_clientes')) return [{ affectedRows: 1 }];
    throw new Error(`Unexpected query: ${sql}`);
  } };
  await ensureCreditLimit(conn, user, 4, customer, 2000n);
  assert.equal(calls.length, 1);
  await ensureCreditLimit(conn, { ...user, cargo: 'Super Administrador' }, 4, customer, 5000n);
  assert.deepEqual(calls.at(-1).params, ['130.00', 17, 7]);
  const before = calls.length;
  await assert.rejects(ensureCreditLimit(conn, { ...user, cargo: 'Super Administrador' }, 4,
    { ...customer, str_estado: 'inactivo' }, 10001n), { extensions: { code: 'BUSINESS_RULE' } });
  assert.equal(calls.length, before);
});

test('new customer and increased card cupo respect employee approval limit', async () => {
  const user = { companyId: 7, employeeId: 31, cargo: 'Cobrador' };
  const conn = { async execute(sql, params) {
    assert.match(sql, /FROM tbl_empleado/);
    assert.deepEqual(params, [31, 7]);
    return [[{ maxCredit: '130.00' }]];
  } };
  await assertEmployeeCreditApproval(conn, user, 13000n);
  await assert.rejects(assertEmployeeCreditApproval(conn, user, 13001n), {
    extensions: { code: 'BUSINESS_RULE' },
  });
  await assert.rejects(assertEmployeeCreditApproval(conn, user, -1n), {
    extensions: { code: 'BUSINESS_RULE' },
  });
  await assertEmployeeCreditApproval(conn, { ...user, cargo: 'Super Administrador' }, 999999n);
  const customer = { idcliente: 17, dec_max_credito: '100.00', str_estado: 'activo' };
  const calls = [];
  const cardConn = { async execute(sql, params) {
    calls.push(sql);
    if (sql.includes('SUM(dec_resta)')) return [[{ debt: '80.00' }]];
    if (sql.includes('FROM tbl_sucursal s')) return [[{ 1: 1 }]];
    if (sql.includes('FROM tbl_empleado')) return [[{ maxCredit: '129.99' }]];
    throw new Error('No se debe aumentar el cupo');
  } };
  await assert.rejects(ensureCreditLimit(cardConn, user, 4, customer, 5000n), {
    extensions: { code: 'BUSINESS_RULE' },
  });
  assert.equal(calls.some((sql) => sql.startsWith('UPDATE tbl_clientes')), false);
});

test('credit payload uses observed Spanish frequency values and rejects client tenant IDs', () => {
  const base = {
    idtarjeta: '123e4567-e89b-42d3-a456-426614174000', idcliente: 1,
    concepto: 'Consumo', valor: 100, modo: 'Semanal', plazo: 4, prestamo: 80,
    descripcion: 'Crédito', item: 1, utilidad: 20, adicionalNumero: '', adicionalValor: 0,
    tipoComprobante: '', serie: '', numero: '10', nota: '', detalleDocumentoSucursalId: 2,
  };
  assert.equal(parseOperationPayload('CREATE_CREDIT', base).modo, 'Semanal');
  assert.equal(parseOperationPayload('CREATE_CREDIT', {
    ...base, tarjetaReferenciaId: 'source-card', ubicacion: 'antes',
  }).ubicacion, 'antes');
  assert.equal(operationPayloadSchemas.CREATE_CREDIT.safeParse({ ...base, ubicacion: 'primera' }).success, false);
  assert.equal(operationPayloadSchemas.CREATE_CREDIT.safeParse({ ...base, modo: 'Weekly' }).success, false);
  assert.equal(operationPayloadSchemas.CREATE_CREDIT.safeParse({ ...base, idglobal: 9 }).success, false);
});

test('server computes float placement from the current locked route instead of a stale device item', () => {
  const cards = [{ id: 'previous', item: 1 }, { id: 'source', item: 2 }, { id: 'next', item: 3 }];
  assert.equal(positionBesideCard(cards, 'source', 'antes'), 1.5);
  assert.equal(positionBesideCard(cards, 'source', 'despues'), 2.5);
  assert.ok(positionBesideCard(cards, 'previous', 'antes') < 1);
  assert.ok(positionBesideCard(cards, 'next', 'despues') > 3);
  assert.throws(() => positionBesideCard(cards, 'missing', 'antes'), { extensions: { code: 'CONFLICT' } });
  assert.deepEqual(planPositionBesideCard([
    { id: 'source', item: 1 }, { id: 'next', item: Math.fround(1 + 2 ** -23) },
  ], 'source', 'despues'), {
    item: 2, moved: [{ id: 'next', item: 3 }],
  });
  assert.deepEqual(planPositionBesideCard([
    { id: 'earlier', item: 1 }, { id: 'source', item: 1 },
    { id: 'next', item: 1 }, { id: 'last', item: 2 },
  ], 'source', 'despues'), {
    item: 3, moved: [
      { id: 'source', item: 2 }, { id: 'next', item: 4 }, { id: 'last', item: 5 },
    ],
  });
  assert.deepEqual(planPositionBesideCard([
    { id: 'duplicate-a', item: 1 }, { id: 'duplicate-b', item: 1 },
    { id: 'source', item: 3 }, { id: 'next', item: 4 },
  ], 'source', 'despues'), { item: 3.5, moved: [] });
});

test('offline card receipts advance from the locked server counter, not the stale device estimate', () => {
  assert.equal(nextReceiptNumber('0007'), '0008');
  assert.equal(nextReceiptNumber('A-0099'), 'A-0100');
  assert.equal(nextReceiptNumber(''), '1');
  assert.throws(() => nextReceiptNumber('INVALID'), { extensions: { code: 'BUSINESS_RULE' } });
  assert.throws(() => nextReceiptNumber('9999999999'), { extensions: { code: 'BUSINESS_RULE' } });
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

test('abonos and credits accept optional bank splits; cash stays the default', () => {
  const payment = { iddescripcion: 'p1', abono: -50000 };
  assert.equal(parseOperationPayload('CREATE_PAYMENT', payment).bancos, undefined);
  assert.equal(parseOperationPayload('CREATE_PAYMENT', {
    ...payment, bancos: [{ idbanco: 3, valor: 30000, referencia: 'M123' }],
  }).bancos[0].valor, 30000);
  assert.equal(operationPayloadSchemas.CREATE_PAYMENT.safeParse({ ...payment, bancos: [{ idbanco: 3, valor: -1 }] }).success, false);
  assert.equal(operationPayloadSchemas.CREATE_PAYMENT.safeParse({ ...payment, bancos: [{ idbanco: 3, valor: 1, idglobal: 9 }] }).success, false);
  assert.equal(operationPayloadSchemas.UPDATE_PAYMENT.safeParse({ abono: -1, descripcion: 'Abono', bancos: [] }).success, true);
  assert.equal(parseOperationPayload('CREATE_PAYMENT', { ...payment, bancos: [{ idbanco: 3, valor: 70000 }], vuelto: 20000 }).vuelto, 20000);
  assert.equal(operationPayloadSchemas.CREATE_PAYMENT.safeParse({ ...payment, vuelto: -1 }).success, false);
  assert.equal(operationPayloadSchemas.CREATE_CREDIT.safeParse({ vuelto: 1 }).success, false);
});

test('bank splits replace previous rows, accept only accounts authorized in the branch and never exceed the amount', async () => {
  const calls = [];
  const conn = { async execute(sql, params) {
    calls.push({ sql, params });
    if (sql.includes('FROM tbl_banco')) return [[{ idbanco: 3 }]];
    return [{ affectedRows: 1 }];
  } };
  await saveBankSplits(conn, 'payment', 'p1', 7, 4, 11, [{ idbanco: 3, valor: 30000, referencia: ' M1 ' }], 5000000n);
  assert.match(calls[0].sql, /DELETE FROM tbl_descripcion_pago WHERE iddescripcion=\? AND idglobal=\?/);
  assert.match(calls[1].sql, /JOIN tbl_banco_sucursal bs ON bs.idbanco=b.idbanco AND bs.idglobal=b.idglobal AND bs.idsucursal=\?/);
  assert.match(calls[1].sql, /b.idglobal=\? AND b.str_estado='activo'/);
  assert.deepEqual(calls[1].params, [4, 7, 3]);
  assert.match(calls[2].sql, /INSERT INTO tbl_descripcion_pago/);
  assert.deepEqual(calls[2].params, [7, 'p1', 3, '30000.00', 'M1', 11]);

  await assert.rejects(saveBankSplits(conn, 'credit', 't1', 7, 4, 11, [{ idbanco: 3, valor: 60 }], 5000n),
    { extensions: { code: 'BUSINESS_RULE' } });
  await assert.rejects(saveBankSplits(conn, 'credit', 't1', 7, 4, 11, [{ idbanco: 3, valor: 1 }, { idbanco: 3, valor: 1 }], 5000n),
    { extensions: { code: 'VALIDATION_ERROR' } });
  // Transfer bigger than the abono: only accepted when the declared cash change matches it.
  await saveBankSplits(conn, 'payment', 'p1', 7, 4, 11, [{ idbanco: 3, valor: 500 }], 30000n, 20000n);
  await assert.rejects(saveBankSplits(conn, 'payment', 'p1', 7, 4, 11, [{ idbanco: 3, valor: 500 }], 30000n),
    { extensions: { code: 'BUSINESS_RULE' } });
  await assert.rejects(saveBankSplits(conn, 'payment', 'p1', 7, 4, 11, [{ idbanco: 3, valor: 500 }], 30000n, 19000n),
    { extensions: { code: 'BUSINESS_RULE' } });
  await assert.rejects(saveBankSplits(conn, 'payment', 'p1', 7, 4, 11, [{ idbanco: 3, valor: 100 }], 30000n, 5n),
    { extensions: { code: 'BUSINESS_RULE' } });
  await assert.rejects(saveBankSplits(conn, 'payment', 'p1', 7, 4, 11, [], 30000n, 5n),
    { extensions: { code: 'BUSINESS_RULE' } });
  const foreign = { async execute(sql) { return sql.includes('FROM tbl_banco') ? [[]] : [{}]; } };
  await assert.rejects(saveBankSplits(foreign, 'credit', 't1', 7, 4, 11, [{ idbanco: 9, valor: 1 }], 5000n),
    { extensions: { code: 'BUSINESS_RULE' } });
});
