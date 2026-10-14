import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, validate } from 'graphql';
import { schema } from '../../dist/graphql/schema.js';
import { presentOwnChallenge } from '../../dist/services/dispatchChallengePresentation.js';

test('own dispatch challenges are read-only and do not accept spoofed identity/scope', () => {
  assert.deepEqual(validate(schema, parse('query { myDispatchChallenges }')), []);
  for (const argument of ['employeeId:4', 'branchId:2', 'asOf:"2030-01-01"']) {
    assert.ok(validate(schema, parse(`query { myDispatchChallenges(${argument}) }`)).length);
  }
  assert.ok(validate(schema, parse('mutation { myDispatchChallenges }')).length);
});

test('own presentation keeps signed progress, single salary and explicit expired/insufficient states', () => {
  const row = { challengeId: 1, routeId: 2, branchId: 3, branchName: 'A', routeState: 'created', assigned: 1,
    deadline: '2026-10-13', invitationDate: '2026-10-13', description: 'Meta', incrementPercent: 20,
    capitalGoal: 1000000, collectionGoal: 1000000, creditedCapital: 500000, creditedCollection: -500 };
  const salary = { baseAmount: 40000, commissionAmount: 48000 };
  const result = { status: 'available', weight: 50, capitalRate: 2.5, collectionRate: 2.3,
    targetCommission: 48000, commissionGap: 0, capitalRequired: null, collectionRequired: 0 };
  const own = presentOwnChallenge(row, salary, result, '2026-10-13', { status: 'available' }, false);
  assert.equal(own.progress.capitalPercent, 100);
  assert.equal(own.progress.collectionPercent, -0.1);
  assert.equal(own.progress.achieved, true);
  assert.equal(own.forecast.status, 'available');
  assert.equal(presentOwnChallenge(row, salary, result, '2026-10-14', null, false).status, 'expired');
  assert.equal(presentOwnChallenge(row, salary, result, '2026-10-13', {}, true).forecast.status, 'insufficient_data');
  assert.equal(presentOwnChallenge({ ...row, assigned: 0 }, salary, result, '2026-10-13', null, false).forecast.status, 'not_applicable');
});
