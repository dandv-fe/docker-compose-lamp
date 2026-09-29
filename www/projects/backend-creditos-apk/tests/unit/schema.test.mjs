import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, validate, assertValidSchema } from 'graphql';
import { schema } from '../../dist/graphql/schema.js';

test('GraphQL exposes the stable login, query, and offline mutation contract', () => {
  assertValidSchema(schema);
  const errors = validate(schema, parse(`
    mutation Login($companyId: Int!, $username: String!, $password: String!) {
      login(companyId: $companyId, username: $username, password: $password) {
        token expiresIn user { userId companyId } company { id name } branches { id name }
      }
    }
    query Sync($branchId: Int!, $after: String!) {
      me { userId }
      branches { id }
      portfolio(branchId: $branchId, first: 10, after: "0") {
        snapshotCursor nextCursor hasNextPage nodes {
          id firstName credits { id latestPayment { id amount description state } }
        }
      }
      customerById(branchId: $branchId, id: 4) { id }
      customerByDocument(branchId: $branchId, documentType: "DNI", documentNumber: "x") { id }
      paymentHistory(branchId: $branchId, creditId: "credit") { id }
      syncChanges(branchId: $branchId, after: $after, first: 50) {
        nodes { cursor recordId action payload } nextCursor hasNextPage
      }
    }
    mutation Offline($input: OfflineOperationInput!) {
      applyOfflineOperation(input: $input) { operationId status entityId eventCursor }
    }
    query Portfolio($branchId: Int!, $desde: String!, $hasta: String!) {
      branchPermissions(branchId: $branchId)
      defaultersOfPortfolio(branchId: $branchId) { id balance customerName documentType documentNumber }
      withdrawnOfPortfolio(branchId: $branchId) { id customerName status }
      cancelledCredits(branchId: $branchId, dateFrom: $desde, dateTo: $hasta) { id customerName paidAmount }
      portfolioClients(branchId: $branchId) { personId firstName documentNumber }
    }
    mutation Restore($branchId: Int!, $creditId: ID!) {
      restoreCredit(branchId: $branchId, creditId: $creditId) { id previousState state }
    }
  `));
  assert.deepEqual(errors, []);
});

test('GraphQL input rejects unknown operation kinds at schema validation', () => {
  const errors = validate(schema, parse(`
    mutation {
      applyOfflineOperation(input: {
        operationId: "id", branchId: 1, kind: UNKNOWN, entityId: "x", payload: {}
      }) { status }
    }
  `));
  assert.ok(errors.some((error) => error.message.includes('UNKNOWN')));
  const kinds = schema.getType('OfflineOperationKind').getValues().map((value) => value.name);
  assert.deepEqual(kinds, [
    'CREATE_CUSTOMER', 'UPDATE_CUSTOMER', 'UPDATE_DOCUMENT', 'CREATE_CREDIT',
    'UPDATE_CREDIT', 'UPDATE_CREDIT_TERMS', 'CREATE_PAYMENT', 'UPDATE_PAYMENT',
    'DELETE_PAYMENT', 'DELETE_CREDIT', 'APPLY_DISCOUNT', 'ADD_INTEREST',
    'CHANGE_CREDIT_STATUS', 'REORDER_CREDIT', 'CREATE_COMMENT', 'UPDATE_COMMENT',
    'DELETE_COMMENT', 'UPSERT_ALERT',
  ]);
});
