import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../dist/db.js';
import {
  portfolio, customerById, defaultersOfPortfolio, withdrawnOfPortfolio, cancelledCredits,
  portfolioClients, restoreCredit, branchPermissions, receiptSequences,
} from '../../dist/services/queries.js';

const user = {
  userId: 1, companyId: 7, employeeId: 31, cargo: 'Cobrador',
  username: 'operator', firstName: 'Test', lastName: 'User', companyName: 'Company',
};
const context = { user };

function withMockedPool(execute, run) {
  const original = pool.execute;
  pool.execute = execute;
  return run().finally(() => { pool.execute = original; });
}

// Matches model/Cartera.php::listRuta(), the legacy query behind the main cartera listing.
const EXCLUDED_STATUSES = ['cancelado', 'inactiva', 'moroso', 'fallecio', 'discapacitado'];

test('portfolio excludes credits with legacy-excluded statuses and hides customers left with none', async () => {
  const calls = [];
  await withMockedPool(async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('FROM tbl_sucursal b')) return [[{ branchCompanyId: 7, idauth_sucursal: 1 }], []];
    if (sql.includes('SELECT COALESCE(MAX(id)')) return [[{ max_cursor: 0 }], []];
    if (sql.includes('FROM tbl_clientes c')) {
      return [[
        { id: 100, companyId: 7 },
        { id: 101, companyId: 7 },
      ], []];
    }
    if (sql.includes('FROM tbl_tarjetas t')) {
      assert.match(sql, /str_estado NOT IN \(\?,\?,\?,\?,\?\)/);
      assert.deepEqual(params.slice(-5), EXCLUDED_STATUSES);
      // Customer 100 only has an excluded-status credit -> should disappear entirely.
      // Customer 101 keeps one active credit alongside an excluded one.
      // The WHERE clause would drop excluded statuses on a real database, so the
      // mock filters here too instead of relying on the app to re-filter rows.
      const allCredits = [
        { id: 'credit-100-moroso', customerId: 100, status: 'moroso' },
        { id: 'credit-101-active', customerId: 101, status: 'activa' },
        { id: 'credit-101-cancelado', customerId: 101, status: 'cancelado' },
      ];
      return [allCredits.filter((credit) => !EXCLUDED_STATUSES.includes(credit.status)), []];
    }
    if (sql.includes('FROM tbl_descripcion d')) {
      assert.match(sql, /ROW_NUMBER\(\) OVER/);
      return [[{
        id: 'payment-1', creditId: 'credit-101-active', amount: -15,
        description: 'Abono', state: 'created', createdAt: '2026-09-28 10:00:00',
      }], []];
    }
    if (sql.includes('FROM tbl_comentarios_cliente')) return [[], []];
    throw new Error(`Unexpected query: ${sql}`);
  }, async () => {
    const result = await portfolio(context, 4, 10, null, null);
    assert.deepEqual(result.nodes.map((node) => node.id), [101]);
    assert.deepEqual(result.nodes[0].credits.map((c) => c.id), ['credit-101-active']);
    assert.deepEqual(result.nodes[0].credits[0].latestPayment, {
      id: 'payment-1', creditId: 'credit-101-active', amount: -15,
      description: 'Abono', state: 'created', createdAt: '2026-09-28 10:00:00',
    });
  });

  const creditQuery = calls.find((call) => call.sql.includes('FROM tbl_tarjetas t'));
  assert.ok(creditQuery, 'expected a tbl_tarjetas query to run');
});

test('customerById keeps every credit regardless of status, mirroring buscarTarjetas()', async () => {
  await withMockedPool(async (sql, params) => {
    if (sql.includes('FROM tbl_sucursal b')) return [[{ branchCompanyId: 7, idauth_sucursal: 1 }], []];
    if (sql.includes('FROM tbl_clientes c')) return [[{ id: 100, companyId: 7 }], []];
    if (sql.includes('FROM tbl_tarjetas t')) {
      assert.doesNotMatch(sql, /str_estado NOT IN/);
      return [[
        { id: 'credit-100-active', customerId: 100, status: 'activa' },
        { id: 'credit-100-cancelado', customerId: 100, status: 'cancelado' },
      ], []];
    }
    if (sql.includes('FROM tbl_descripcion d')) return [[], []];
    if (sql.includes('FROM tbl_comentarios_cliente')) return [[], []];
    throw new Error(`Unexpected query: ${sql}`);
  }, async () => {
    const customer = await customerById(context, 4, 100);
    assert.deepEqual(customer.credits.map((c) => c.id), ['credit-100-active', 'credit-100-cancelado']);
  });
});

// --- Cartera sub-screens: Morosos, Retirados, Canceladas, Clientes De Cartera ---

function mockBranchAccess(sql) {
  if (sql.includes('FROM tbl_sucursal b')) return [[{ branchCompanyId: 7, idauth_sucursal: 1 }], []];
  if (sql.includes('SELECT 1 FROM tbl_sucursal s')) return [[], []];
  return undefined;
}

// Simulates tbl_auth_sucursal/tbl_auth lookups, granting only the given permission names.
function mockPermissions(sql, params, granted) {
  if (!sql.includes('FROM tbl_auth_sucursal s')) return undefined;
  const permission = params[params.length - 1];
  return granted.includes(permission) ? [[{ str_nombre: permission }], []] : [[], []];
}

test('defaultersOfPortfolio requires "ver morosos" and reads view_ruta filtered to moroso', async () => {
  const calls = [];
  await withMockedPool(async (sql, params) => {
    calls.push({ sql, params });
    const branchRow = mockBranchAccess(sql);
    if (branchRow) return branchRow;
    const perm = mockPermissions(sql, params, ['ver morosos']);
    if (perm) return perm;
    if (sql.includes('FROM view_ruta')) {
      assert.match(sql, /estado = 'moroso'/);
      return [[{ id: 1, customerName: 'Ana' }], []];
    }
    throw new Error(`Unexpected query: ${sql}`);
  }, async () => {
    const rows = await defaultersOfPortfolio(context, 4);
    assert.deepEqual(rows, [{ id: 1, customerName: 'Ana' }]);
  });
  const viewQuery = calls.find((call) => call.sql.includes('FROM view_ruta'));
  assert.deepEqual(viewQuery.params, [4]);
});

test('defaultersOfPortfolio rejects users without "ver morosos"', async () => {
  await withMockedPool(async (sql, params) => {
    const branchRow = mockBranchAccess(sql);
    if (branchRow) return branchRow;
    const perm = mockPermissions(sql, params, []);
    if (perm) return perm;
    throw new Error(`Unexpected query: ${sql}`);
  }, async () => {
    await assert.rejects(() => defaultersOfPortfolio(context, 4));
  });
});

test('withdrawnOfPortfolio requires "ver retirados" and matches fallecio or discapacitado', async () => {
  await withMockedPool(async (sql, params) => {
    const branchRow = mockBranchAccess(sql);
    if (branchRow) return branchRow;
    const perm = mockPermissions(sql, params, ['ver retirados']);
    if (perm) return perm;
    if (sql.includes('FROM view_ruta')) {
      assert.match(sql, /estado = 'fallecio' OR estado = 'discapacitado'/);
      return [[{ id: 2, status: 'fallecio' }], []];
    }
    throw new Error(`Unexpected query: ${sql}`);
  }, async () => {
    const rows = await withdrawnOfPortfolio(context, 4);
    assert.deepEqual(rows, [{ id: 2, status: 'fallecio' }]);
  });
});

test('cancelledCredits extends the "hasta" bound by one day and masks document without "documento" permission', async () => {
  const calls = [];
  await withMockedPool(async (sql, params) => {
    calls.push({ sql, params });
    const branchRow = mockBranchAccess(sql);
    if (branchRow) return branchRow;
    const perm = mockPermissions(sql, params, ['ver canceladas']); // 'documento' withheld
    if (perm) return perm;
    if (sql.includes('FROM view_ruta r INNER JOIN tbl_descripcion d')) {
      return [[{ id: 9, customerName: 'Luis', documentNumber: '12345', paidAmount: 100 }], []];
    }
    throw new Error(`Unexpected query: ${sql}`);
  }, async () => {
    const rows = await cancelledCredits(context, 4, '2024-01-15', '2024-01-15');
    assert.deepEqual(rows, [{ id: 9, customerName: 'Luis', documentNumber: null, paidAmount: 100 }]);
  });
  const listQuery = calls.find((call) => call.sql.includes('tbl_descripcion d'));
  assert.deepEqual(listQuery.params, [4, '2024-01-15', '2024-01-16']);
});

test('cancelledCredits keeps the document when the "documento" permission is granted', async () => {
  await withMockedPool(async (sql, params) => {
    const branchRow = mockBranchAccess(sql);
    if (branchRow) return branchRow;
    const perm = mockPermissions(sql, params, ['ver canceladas', 'documento']);
    if (perm) return perm;
    if (sql.includes('FROM view_ruta r INNER JOIN tbl_descripcion d')) {
      return [[{ id: 9, documentNumber: '12345' }], []];
    }
    throw new Error(`Unexpected query: ${sql}`);
  }, async () => {
    const rows = await cancelledCredits(context, 4, '2024-01-15', '2024-01-31');
    assert.deepEqual(rows, [{ id: 9, documentNumber: '12345' }]);
  });
});

test('cancelledCredits rejects malformed dates before querying', async () => {
  await withMockedPool(async (sql, params) => {
    const branchRow = mockBranchAccess(sql);
    if (branchRow) return branchRow;
    const perm = mockPermissions(sql, params, ['ver canceladas']);
    if (perm) return perm;
    throw new Error(`Unexpected query: ${sql}`);
  }, async () => {
    await assert.rejects(() => cancelledCredits(context, 4, '01/15/2024', '2024-01-31'));
  });
});

test('portfolioClients requires "ver clientes" and masks document number without "ver documento"', async () => {
  await withMockedPool(async (sql, params) => {
    const branchRow = mockBranchAccess(sql);
    if (branchRow) return branchRow;
    const perm = mockPermissions(sql, params, ['ver clientes']); // 'ver documento' withheld
    if (perm) return perm;
    if (sql.includes('FROM view_list_client')) {
      return [[{ personId: 1, documentType: 'CC', documentNumber: '999' }], []];
    }
    throw new Error(`Unexpected query: ${sql}`);
  }, async () => {
    const rows = await portfolioClients(context, 4);
    assert.deepEqual(rows, [{ personId: 1, documentType: 'CC', documentNumber: null }]);
  });
});

test('restoreCredit replicates the legacy "estubo en los <estado>" string instead of reactivating', async () => {
  const calls = [];
  await withMockedPool(async (sql, params) => {
    calls.push({ sql, params });
    const branchRow = mockBranchAccess(sql);
    if (branchRow) return branchRow;
    if (sql.includes('FROM tbl_auth_sucursal s')) return [[{ str_nombre: 'pasar activos' }], []];
    if (sql.includes('SELECT str_estado AS state FROM tbl_tarjetas')) return [[{ state: 'moroso' }], []];
    if (sql.startsWith('UPDATE tbl_tarjetas')) return [{}, []];
    throw new Error(`Unexpected query: ${sql}`);
  }, async () => {
    const result = await restoreCredit(context, 4, 'credit-1');
    assert.deepEqual(result, { id: 'credit-1', previousState: 'moroso', state: 'estubo en los moroso' });
  });
  const update = calls.find((call) => call.sql.startsWith('UPDATE tbl_tarjetas'));
  assert.deepEqual(update.params, ['estubo en los moroso', 'credit-1', 4, 7]);
});

test('restoreCredit rejects credits that are not moroso/fallecio/discapacitado', async () => {
  await withMockedPool(async (sql) => {
    const branchRow = mockBranchAccess(sql);
    if (branchRow) return branchRow;
    if (sql.includes('FROM tbl_auth_sucursal s')) return [[{ str_nombre: 'pasar activos' }], []];
    if (sql.includes('SELECT str_estado AS state FROM tbl_tarjetas')) return [[{ state: 'activa' }], []];
    throw new Error(`Unexpected query: ${sql}`);
  }, async () => {
    await assert.rejects(() => restoreCredit(context, 4, 'credit-1'));
  });
});

test('branchPermissions filters the known cartera-menu permissions to the ones the user actually holds', async () => {
  await withMockedPool(async (sql) => mockBranchAccess(sql) ?? (() => { throw new Error(`Unexpected query: ${sql}`); })(), async () => {
    const scoped = {
      user,
      permissions: [
        { branchId: 4, name: 'ver morosos' },
        { branchId: 4, name: 'ver clientes' },
        { branchId: 4, name: 'nueva tarjeta' },
        { branchId: 9, name: 'ver retirados' }, // different branch, must not leak in
      ],
    };
    const granted = await branchPermissions(scoped, 4);
    assert.deepEqual(granted.sort(), ['nueva tarjeta', 'ver clientes', 'ver morosos']);
  });
});

test('branchPermissions grants every known permission to a Super Administrador', async () => {
  await withMockedPool(async (sql) => mockBranchAccess(sql) ?? (() => { throw new Error(`Unexpected query: ${sql}`); })(), async () => {
    const admin = { user: { ...user, cargo: 'Super Administrador' }, permissions: [] };
    const granted = await branchPermissions(admin, 4);
    assert.ok(granted.includes('ver morosos') && granted.includes('pasar activos retirados'));
  });
});

test('branchPermissions grants the office administrator menu access without explicit permissions', async () => {
    await withMockedPool(async (sql, params) => {
      if (sql.includes('FROM tbl_sucursal b')) {
        return [[{ branchCompanyId: 7, idauth_sucursal: null, administeredOfficeId: params[2] === 4 ? 2 : null }], []];
      }
      if (sql.includes('SELECT 1 FROM tbl_sucursal s')) {
        assert.deepEqual(params.slice(1), [7, 31]);
        return [params[0] === 4 ? [{ 1: 1 }] : [], []];
      }
      throw new Error(`Unexpected query: ${sql}`);
    }, async () => {
      const scoped = { user, permissions: [] };
      const granted = await branchPermissions(scoped, 4);
      assert.ok(granted.includes('ver morosos') && granted.includes('pasar activos retirados'));
      await assert.rejects(branchPermissions(scoped, 5), { extensions: { code: 'FORBIDDEN' } });
  });
});

test('receiptSequences returns only the branch Comprobante counters that feed the new-card form', async () => {
  const calls = [];
  await withMockedPool(async (sql, params) => {
    const branchRow = mockBranchAccess(sql);
    if (branchRow) return branchRow;
    if (sql.includes('FROM tbl_detalle_documento_sucursal')) {
      calls.push({ sql, params });
      // Mirrors Cartera::GetTipoDocSerieNum: scoped to the branch and to the company.
      assert.match(sql, /str_operacion = 'Comprobante'/);
      assert.deepEqual(params, [4, 7]);
      return [[{ id: 8, series: '2024', lastNumber: '7168', documentType: 'TICKET' }], []];
    }
    throw new Error(`Unexpected query: ${sql}`);
  }, async () => {
    const sequences = await receiptSequences(context, 4);
    assert.deepEqual(sequences, [{ id: 8, series: '2024', lastNumber: '7168', documentType: 'TICKET' }]);
    assert.equal(calls.length, 1);
  });
});

test('receiptSequences refuses a branch the user cannot reach', async () => {
  await withMockedPool(async (sql) => {
    if (sql.includes('FROM tbl_sucursal b')) return [[{ branchCompanyId: 99, idauth_sucursal: null }], []];
    if (sql.includes('SELECT 1 FROM tbl_sucursal s')) return [[], []];
    throw new Error(`Unexpected query: ${sql}`);
  }, async () => {
    await assert.rejects(receiptSequences(context, 4), { extensions: { code: 'FORBIDDEN' } });
  });
});
