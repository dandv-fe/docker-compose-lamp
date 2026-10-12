import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../dist/db.js';
import { routeSettlement, settleRoute, routeExpenseCatalog } from '../../dist/services/settlement.js';

const user = {
  userId: 1, companyId: 7, employeeId: 31, cargo: 'Cobrador',
  username: 'operator', firstName: 'Test', lastName: 'User', companyName: 'Company',
};
const context = { user, permissions: [{ branchId: 4, name: 'bloquear' }] };

function withMockedPool(execute, run) {
  const original = pool.execute;
  pool.execute = execute;
  return run().finally(() => { pool.execute = original; });
}

// The branch/permission lookups every service call starts with.
function baseRows(sql) {
  if (sql.includes('FROM tbl_sucursal b')) return [[{ branchCompanyId: 7, idauth_sucursal: 5, administeredOfficeId: null }], []];
  if (sql.includes('FROM tbl_sucursal s')) return [[], []];
  if (sql.includes('FROM tbl_auth_sucursal')) return [[{ str_nombre: 'bloquear' }], []];
  if (sql.includes('SELECT idpersona FROM tbl_usuario')) return [[{ idpersona: 77 }], []];
  return null;
}

// Kept consistent with the movement rows below: the totals are what the SQL aggregates return
// and the rows are the same money listed one by one, exactly as production data behaves.
const totals = {
  base: '50.00', collected: '58.00', collectedBank: '20.00', otherCollected: '33.00',
  credits: '650.00', creditsBank: '100.00', expenses: '8.00',
};

function settlementPool(overrides = {}) {
  const numbers = { ...totals, ...overrides };
  return async (sql) => {
    const base = baseRows(sql);
    if (base) return base;
    if (sql.includes('FROM tbl_detalle_ruta WHERE idglobal')) {
      return [[{ id: 900, state: 'created', createdAt: '2026-09-30 08:00:00' }], []];
    }
    if (sql.includes('AS collectedBank')) return [[numbers], []];
    if (sql.includes('FROM tbl_descripcion d')) {
      return [[
        { id: 'p1', amount: '-58.00', description: 'Abono', state: 'created', createdAt: '2026-09-30 09:00:00', person: 'Ana Ruiz', authorId: 77, author: 'Test User', bankAmount: '20.00' },
        { id: 'p2', amount: '-5.00', description: 'Intereses del mes', state: 'created', createdAt: '2026-09-30 09:30:00', person: 'Ana Ruiz', authorId: 77, author: 'Test User', bankAmount: '0.00' },
      ], []];
    }
    if (sql.includes('FROM tbl_tarjetas t')) {
      return [[{ id: 't1', amount: '650.00', concept: 'Prestamo', extra: '33.00', state: 'created', createdAt: '2026-09-30 10:00:00', person: 'Luis Pena', authorId: 90, author: 'Otro Cobrador', bankAmount: '100.00' }], []];
    }
    if (sql.includes('FROM tbl_contabilidad_detalle dc')) {
      return [[
        { id: 'b1', amount: '50.00', name: 'base', detail: 'entregada en oficina', operation: 'info-totalizar', state: 'created', createdAt: '2026-09-30 06:30:00', authorId: 77, author: 'Test User' },
        { id: 'g1', amount: '-8.00', name: 'gasolina', detail: 'moto', operation: 'salida-totalizar', state: 'created', createdAt: '2026-09-30 07:00:00', authorId: 77, author: 'Test User' },
        { id: 'g2', amount: '-4.00', name: 'papeleria', detail: '', operation: 'salida-contabilidad', state: 'created', createdAt: '2026-09-30 07:30:00', authorId: 77, author: 'Test User' },
      ], []];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };
}

test('route accounts subtract the money that arrived or left through a bank', async () => {
  await withMockedPool(settlementPool(), async () => {
    const summary = await routeSettlement(context, 4);
    assert.equal(summary.routeId, 900);
    assert.equal(summary.state, 'created');
    assert.equal(summary.canSettle, true);
    // 50 + (58 - 20) + 33 - (650 - 100) - 8
    assert.equal(summary.expectedCash, -437);
    assert.equal(summary.collectedBank, 20);
    assert.equal(summary.creditsBank, 100);
  });
});

test('the cash of every movement adds up to the expected cash', async () => {
  await withMockedPool(settlementPool(), async () => {
    const summary = await routeSettlement(context, 4);
    const sum = summary.movements.reduce((total, movement) => total + movement.cashAmount, 0);
    assert.equal(Number(sum.toFixed(2)), summary.expectedCash);
  });
});

test('movements are ordered by time and flag what never touches the cash', async () => {
  await withMockedPool(settlementPool(), async () => {
    const { movements } = await routeSettlement(context, 4);
    assert.deepEqual(movements.map((m) => m.id), ['b1', 'g1', 'g2', 'p1', 'p2', 't1']);
    assert.equal(movements.find((m) => m.id === 'p1').title, 'Abono · Ana Ruiz');
    assert.equal(movements.find((m) => m.id === 'p1').amount, 58);
    // Intereses move the debt, not the pocket, so they stay out of the cuadre.
    assert.equal(movements.find((m) => m.id === 'p2').countsForCash, false);
    assert.equal(movements.find((m) => m.id === 'p2').cashAmount, 0);
    // Office accounting is shown but, like in webgoez, never enters the difference.
    assert.equal(movements.find((m) => m.id === 'g2').countsForCash, false);
    assert.equal(movements.find((m) => m.id === 't1').amount, -617);
    // Bases registered during the day are listed like any other movement and do count.
    const registeredBase = movements.find((m) => m.id === 'b1');
    assert.equal(registeredBase.kind, 'base');
    assert.equal(registeredBase.title, 'Base recibida');
    assert.equal(registeredBase.cashAmount, 50);
  });
});

test('the cash is grouped by whoever moved it, so a missing handover is visible', async () => {
  await withMockedPool(settlementPool(), async () => {
    const { collectors } = await routeSettlement(context, 4);
    assert.deepEqual(collectors, [
      { personId: 77, personName: 'Test User', cash: 80, movements: 3, isMe: true },
      { personId: 90, personName: 'Otro Cobrador', cash: -517, movements: 1, isMe: false },
    ]);
  });
});

test('a route with nothing open reports no settlement instead of failing', async () => {
  await withMockedPool(async (sql) => {
    const base = baseRows(sql);
    if (base) return base;
    if (sql.includes('FROM tbl_detalle_ruta WHERE idglobal')) return [[], []];
    throw new Error(`Unexpected query: ${sql}`);
  }, async () => {
    const summary = await routeSettlement(context, 4);
    assert.equal(summary.routeId, null);
    assert.deepEqual(summary.movements, []);
    assert.deepEqual(summary.collectors, []);
  });
});

test('handing in the accounts is refused when the difference does not match', async () => {
  await withMockedPool(settlementPool(), async () => {
    // Counted 100 against an expected -437, so the only valid difference is 537.
    await assert.rejects(
      settleRoute(context, 4, { cash: 90, coins: 10, difference: 100 }),
      { extensions: { code: 'BUSINESS_RULE' } },
    );
    await assert.rejects(
      settleRoute(context, 4, { cash: -1, coins: 10, difference: 537 }),
      { extensions: { code: 'VALIDATION_ERROR' } },
    );
  });
});

test('a route already handed in cannot be handed in twice', async () => {
  await withMockedPool(async (sql) => {
    const base = baseRows(sql);
    if (base) return base;
    if (sql.includes('FROM tbl_detalle_ruta WHERE idglobal')) {
      return [[{ id: 900, state: 'entregando', createdAt: '2026-09-30 08:00:00' }], []];
    }
    return settlementPool()(sql);
  }, async () => {
    await assert.rejects(
      settleRoute(context, 4, { cash: 90, coins: 10, difference: 537 }),
      { extensions: { code: 'BUSINESS_RULE' } },
    );
  });
});

test('only someone who may block the route can hand the accounts in', async () => {
  await withMockedPool(async (sql) => {
    if (sql.includes('FROM tbl_auth_sucursal')) return [[], []];
    return settlementPool()(sql);
  }, async () => {
    assert.equal((await routeSettlement(context, 4)).canSettle, false);
    await assert.rejects(
      settleRoute(context, 4, { cash: 90, coins: 10, difference: 537 }),
      { extensions: { code: 'FORBIDDEN' } },
    );
  });
});

test('the expense catalog groups the office names under their category', async () => {
  await withMockedPool(async (sql) => {
    const base = baseRows(sql);
    if (base) return base;
    if (sql.includes('FROM tbl_tipo_contabilidad t')) {
      return [[
        { id: 1, category: 'moto', name: 'gasolina' },
        { id: 1, category: 'moto', name: 'lavada' },
        { id: 2, category: 'empleado', name: 'sueldo' },
      ], []];
    }
    if (sql.includes('FROM tbl_nomina n')) return [[{ id: 12, name: 'Ana Ruiz' }], []];
    throw new Error(`Unexpected query: ${sql}`);
  }, async () => {
    const catalog = await routeExpenseCatalog(context, 4);
    assert.deepEqual(catalog.categories, [
      { id: 1, category: 'moto', names: ['gasolina', 'lavada'] },
      { id: 2, category: 'empleado', names: ['sueldo'] },
    ]);
    assert.deepEqual(catalog.payrolls, [{ id: 12, name: 'Ana Ruiz', officeId: null, officeName: null, suggested: false }]);
  });
});
