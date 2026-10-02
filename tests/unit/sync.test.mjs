import test from 'node:test';
import assert from 'node:assert/strict';
import { materializeSyncEvent } from '../../dist/services/sync.js';

const user = {
  userId: 12, companyId: 7, employeeId: 31, cargo: 'Cobrador',
  username: 'operator', firstName: 'Test', lastName: 'User', companyName: 'Company',
};

function event(overrides = {}) {
  return {
    cursor: '30000000001', recordType: 'customer', recordId: '123',
    relatedId: '456', action: 'UPDATE', createdAt: null, ...overrides,
  };
}

test('customer sync materializes only current customer, branch credits, and linked comments', async () => {
  const calls = [];
  const execute = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('FROM tbl_clientes c')) {
      return [[{ id: 123, companyId: 7, personId: 456, email: 'branch-customer@example.invalid' }], []];
    }
    if (sql.includes('FROM tbl_tarjetas t')) return [[{ id: 'credit-1', customerId: 123 }], []];
    if (sql.includes('FROM tbl_comentarios_cliente l')) return [[{ id: 'comment-1', customerId: 123 }], []];
    if (sql.includes('FROM mobile_credit_location')) return [[{ id: 'loc-1', creditId: 'credit-1', name: 'Casa' }], []];
    throw new Error(`Unexpected query: ${sql}`);
  };
  const change = await materializeSyncEvent(execute, user, 4, event());
  assert.equal(change.payload.email, 'branch-customer@example.invalid');
  assert.deepEqual(change.payload.credits, [{ id: 'credit-1', customerId: 123, locations: [{ id: 'loc-1', creditId: 'credit-1', name: 'Casa' }] }]);
  assert.deepEqual(change.payload.comments, [{ id: 'comment-1', customerId: 123 }]);
  assert.match(calls[0].sql, /tbl_auth_sucursal/);
  assert.deepEqual(calls[0].params, ['123', 7, 4, 4, 4]);
  assert.deepEqual(calls[2].params, [123]);
});

test('customer from another branch is returned as a tombstone, never as a null-payload event', async () => {
  const change = await materializeSyncEvent(async () => [[], []], user, 4, event());
  assert.equal(change.action, 'DELETE');
  assert.deepEqual(change.payload, { id: '123', deleted: true });
});

test('physical delete events return tombstones without querying a removed row', async () => {
  let queried = false;
  const change = await materializeSyncEvent(
    async () => { queried = true; return [[], []]; },
    user, 4, event({ recordType: 'comment', recordId: 'comment-7', relatedId: '123', action: 'DELETE' }),
  );
  assert.equal(queried, false);
  assert.deepEqual(change.payload, { id: 'comment-7', customerId: 123, deleted: true });
});

test('location delete tombstones include the related credit id', async () => {
  const change = await materializeSyncEvent(
    async () => { throw new Error('must not query'); },
    user, 4, event({ recordType: 'location', recordId: 'loc-7', relatedId: 'credit-1', action: 'DELETE' }),
  );
  assert.deepEqual(change.payload, { id: 'loc-7', creditId: 'credit-1', deleted: true });
});

test('comment materialization is tied to the event customer and selected branch', async () => {
  let calledWith;
  const change = await materializeSyncEvent(async (sql, params) => {
    calledWith = { sql, params };
    return [[{ id: 'comment-1', customerId: 123, comment: 'Visible in this branch' }], []];
  }, user, 4, event({ recordType: 'comment', recordId: 'comment-1', relatedId: '123' }));
  assert.equal(change.payload.comment, 'Visible in this branch');
  assert.deepEqual(calledWith.params, [7, 'comment-1', '123', 4, 4, 4]);
  assert.match(calledWith.sql, /l\.idcliente=\?/);
  assert.match(calledWith.sql, /tbl_auth_sucursal/);
});

test('events without a supported entity representation are not exposed', async () => {
  const change = await materializeSyncEvent(async () => { throw new Error('must not query'); },
    user, 4, event({ recordType: 'branch_access' }));
  assert.equal(change, null);
});
