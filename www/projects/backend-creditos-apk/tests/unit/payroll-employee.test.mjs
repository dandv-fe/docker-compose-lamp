import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, validate } from 'graphql';
import { schema } from '../../dist/graphql/schema.js';
import { payrollChangeSchemas, colombiaPayrollDate } from '../../dist/services/payrollEmployee.js';

test('Colombia calendar date is UTC-5 regardless of host timezone or ISO input offset', () => {
  assert.equal(colombiaPayrollDate(Date.parse('2026-10-14T04:59:59Z')), '2026-10-13');
  assert.equal(colombiaPayrollDate(Date.parse('2026-10-14T05:00:00Z')), '2026-10-14');
  assert.equal(colombiaPayrollDate(Date.parse('2026-10-14T00:00:00-05:00')), '2026-10-14');
  assert.equal(colombiaPayrollDate(Date.parse('2026-10-14T06:00:00+02:00')), '2026-10-13');
});

test('payroll separates compensation type from period frequency and requires explicit rates/base', () => {
  const input = { employeeId: 3, effectiveDate: '2026-10-13', type: 'Combinado', frequency: 'Quincenal',
    baseAmount: 100, capitalRate: 10, collectionRate: 5, idempotencyToken: 'contract_token_0001' };
  assert.equal(payrollChangeSchemas.contrato.parse(input).frequency, 'Quincenal');
  for (const change of [{ type: 'Quincenal' }, { frequency: 'Fijo' }, { effectiveDate: '2026-02-30' },
    { capitalRate: -1 }, { collectionRate: 101 }, { baseAmount: -1 }, { idempotencyToken: 'short' }]) {
    assert.equal(payrollChangeSchemas.contrato.safeParse({ ...input, ...change }).success, false);
  }
  const { baseAmount, ...noBase } = input;
  assert.equal(payrollChangeSchemas.contrato.safeParse(noBase).success, false);
});

test('payroll GraphQL online snapshot is self-only and exposes detailed liquidation', () => {
  assert.deepEqual(validate(schema, parse(`query { myPayroll(asOf:"2026-10-13") {
    employeeId asOf periods { configured contractId type frequency startDate endDate
      baseAmount periodBaseAmount agreedBaseAmount capitalCommission collectionCommission commissionAmount bonusAmount earnedAmount paidAmount pendingAmount }
    totals { earnedAmount paidAmount pendingAmount } contracts vacations bonuses routes breakdown
    routeRows { id routeId branchId branchName openedDate openedAt state closed provisional contractId type
      mode sharePercent weight capitalRate collectionRate capitalBasis collectionBasis capitalAmount cashAmount
      capitalCommission collectionCommission } } }`)), []);
  assert.ok(validate(schema, parse('query { myPayroll(employeeId:4) { employeeId } }')).length);
  assert.deepEqual(validate(schema, parse('mutation { changeEmployeePayroll(action:BONUS,input:{}) }')), []);
});

test('new cash bonus requires selected branch/route and cannot specify date; vacations require replacement', () => {
  const common = { employeeId: 3, idempotencyToken: 'new_cash_bonus_0001', reason: 'Meta' };
  const bonus = { ...common, branchId: 1, routeId: 2, amount: 25 };
  assert.equal(payrollChangeSchemas.bono.safeParse(bonus).success, true);
  assert.equal(payrollChangeSchemas.bono.safeParse({ ...bonus, date: '2026-10-13' }).success, false);
  assert.equal(payrollChangeSchemas.bono.safeParse({ ...common, amount: 25 }).success, false);
  assert.equal(payrollChangeSchemas.bono.safeParse({ ...bonus, amount: 0 }).success, false);
  const vacation = { ...common, startDate: '2026-10-13', endDate: '2026-10-15' };
  assert.equal(payrollChangeSchemas.vacacion.safeParse(vacation).success, false);
  assert.equal(payrollChangeSchemas.vacacion.safeParse({ ...vacation, replacementEmployeeId: 4 }).success, true);
  assert.deepEqual(validate(schema, parse('query { payrollBonusContext(branchId:1) }')), []);
});
