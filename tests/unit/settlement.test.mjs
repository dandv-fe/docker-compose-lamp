import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../dist/db.js';
import { routeSettlement, settleRoute } from '../../dist/services/settlement.js';

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
  return null;
}

const totals = {
  base: '50.00', collected: '458.00', collectedBank: '20.00', otherCollected: '33.00',
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
        { id: 'p1', amount: '-58.00', description: 'Abono', state: 'created', createdAt: '2026-09-30 09:00:00', person: 'Ana Ruiz', bankAmount: '20.00' },
        { id: 'p2', amount: '-5.00', description: 'Intereses del mes', state: 'created', createdAt: '2026-09-30 09:30:00', person: 'Ana Ruiz', bankAmount: '0.00' },
      ], []];
    }
    if (sql.includes('FROM tbl_tarjetas t')) {
      return [[{ id: 't1', amount: '650.00', concept: 'Prestamo', extra: '33.00', state: 'created', createdAt: '2026-09-30 10:00:00', person: 'Luis Pena', bankAmount: '100.00' }], []];
    }
    if (sql.includes('FROM tbl_contabilidad_detalle dc')) {
      return [[
        { id: 'g1', amount: '-8.00', name: 'gasolina', detail: 'moto', operation: 'salida-totalizar', state: 'created', createdAt: '2026-09-30 07:00:00' },
        { id: 'g2', amount: '-4.00', name: 'papeleria', detail: '', operation: 'salida-contabilidad', state: 'created', createdAt: '2026-09-30 07:30:00' },
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
    // 50 + (458 - 20) + 33 - (650 - 100) - 8
    assert.equal(summary.expectedCash, -37);
    assert.equal(summary.collectedBank, 20);
    assert.equal(summary.creditsBank, 100);
  });
});

test('movements are ordered by time and flag what never touches the cash', async () => {
  await withMockedPool(settlementPool(), async () => {
    const { movements } = await routeSettlement(context, 4);
    assert.deepEqual(movements.map((m) => m.id), ['g1', 'g2', 'p1', 'p2', 't1']);
    assert.equal(movements.find((m) => m.id === 'p1').title, 'Abono · Ana Ruiz');
    assert.equal(movements.find((m) => m.id === 'p1').amount, 58);
    // Intereses move the debt, not the pocket, so they stay out of the cuadre.
    assert.equal(movements.find((m) => m.id === 'p2').countsForCash, false);
    // Office accounting is shown but, like in webgoez, never enters the difference.
    assert.equal(movements.find((m) => m.id === 'g2').countsForCash, false);
    assert.equal(movements.find((m) => m.id === 't1').amount, -617);
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
  });
});

test('handing in the accounts is refused when the difference does not match', async () => {
  await withMockedPool(settlementPool(), async () => {
    // Counted 100 with a base of 50: expected is -37 - 50 + 50, so the difference is 137.
    await assert.rejects(
      settleRoute(context, 4, { base: 50, cash: 90, coins: 10, difference: 100 }),
      { extensions: { code: 'BUSINESS_RULE' } },
    );
    await assert.rejects(
      settleRoute(context, 4, { base: -1, cash: 90, coins: 10, difference: 137 }),
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
      settleRoute(context, 4, { base: 50, cash: 90, coins: 10, difference: 137 }),
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
      settleRoute(context, 4, { base: 50, cash: 90, coins: 10, difference: 137 }),
      { extensions: { code: 'FORBIDDEN' } },
    );
  });
});
