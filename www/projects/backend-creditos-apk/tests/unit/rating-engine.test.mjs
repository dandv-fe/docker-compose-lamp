import test from 'node:test';
import assert from 'node:assert/strict';
import {
  civilDay, dueDays, evaluateCustomer, parseRatingWeights, stableAutomaticScore, DEFAULT_WEIGHTS, dayToIso,
} from '../../dist/services/ratingEngine.js';
import { ratingAutomationEnabled, workerSettings, ratingScore } from '../../dist/services/ratingAutomation.js';

const ZONE = 'America/Bogota';
const NOW = new Date('2025-06-10T17:00:00Z'); // Tuesday, noon in Bogotá
const TODAY = civilDay(NOW, ZONE);
const at = (daysAgo, hourUtc = 17) => new Date(Date.UTC(2025, 5, 10 - daysAgo, hourUtc)).toISOString();

/** Builds a card whose balance follows the legacy invariant dec_resta = dec_valor + SUM(dec_abono). */
function card({ id = '1', mode = 'Diario', term, value, startAgo, payments = [], status }) {
  const rows = payments.map(([daysAgo, cents, description = 'Abono']) => ({
    amountCents: cents, description, createdAtUtc: at(daysAgo),
  }));
  const balance = value + rows.reduce((sum, row) => sum + row.amountCents, 0);
  return {
    id, mode, term, valueCents: value, balanceCents: balance, createdAtUtc: at(startAgo),
    status: status ?? (balance === 0 ? 'cancelado' : 'saved'), payments: rows,
  };
}

/** Pays each installment exactly on its due day (dueDays relative to the start). */
function punctualPayments(mode, term, value, startAgo, upto = term) {
  const startDay = TODAY - startAgo;
  return dueDays(mode, startDay, upto).filter((day) => day < TODAY)
    .map((day) => [TODAY - day, -value / term]);
}

test('schedules follow the legacy web calendar per frequency', () => {
  const monday = civilDay(new Date('2025-06-09T17:00:00Z'), ZONE);
  // Saturday start: next due is Monday (Sunday skipped).
  const saturday = monday - 2;
  assert.deepEqual(dueDays('Diario', saturday, 3).map(dayToIso), ['2025-06-09', '2025-06-10', '2025-06-11']);
  assert.deepEqual(dueDays('Semanal', monday, 2).map(dayToIso), ['2025-06-16', '2025-06-23']);
  assert.deepEqual(dueDays('Quincenal', monday, 2).map(dayToIso), ['2025-06-24', '2025-07-09']);
  const jan31 = civilDay(new Date('2025-01-31T17:00:00Z'), ZONE);
  assert.deepEqual(dueDays('Mensual', jan31, 3).map(dayToIso), ['2025-03-31', '2025-05-31', '2025-07-31']);
  // Civil day uses the business zone: 03:00 UTC is still the previous day in Bogotá.
  assert.equal(dayToIso(civilDay(new Date('2025-06-10T03:00:00Z'), ZONE)), '2025-06-09');
});

test('customers without credits or with little history get the initial 5/10, never an invented 10', () => {
  const none = evaluateCustomer([], NOW, ZONE);
  assert.equal(none.automaticScore, 5);
  assert.equal(none.confidence, 'initial');
  assert.equal(none.hasOpenCredits, false);
  assert.match(none.explanation, /Inicial · poca historia/);
  assert.match(none.explanation, /Sin créditos/);
  const fresh = evaluateCustomer([card({ term: 30, value: 300000, startAgo: 3, payments: punctualPayments('Diario', 30, 300000, 3) })], NOW, ZONE);
  assert.equal(fresh.confidence, 'initial');
  assert.equal(fresh.automaticScore, 5);
  assert.equal(fresh.hasOpenCredits, true);
});

test('long punctual history is excellent and established', () => {
  const result = evaluateCustomer([card({ term: 120, value: 1200000, startAgo: 150,
    payments: punctualPayments('Diario', 120, 1200000, 150) })], NOW, ZONE);
  assert.equal(result.confidence, 'established');
  assert.equal(result.automaticScore, 10);
  assert.equal(result.metrics.punctuality.value, 1);
  assert.match(result.explanation, /^Automática 10\/10, confianza establecida\./);
});

test('limited history is capped at 8 even when perfect', () => {
  const result = evaluateCustomer([card({ term: 60, value: 600000, startAgo: 30,
    payments: punctualPayments('Diario', 60, 600000, 30) })], NOW, ZONE);
  assert.equal(result.confidence, 'limited');
  assert.equal(result.automaticScore, 8);
});

test('advances cover future installments: no daily payment is required once covered', () => {
  const daily = card({ term: 60, value: 600000, startAgo: 30, payments: punctualPayments('Diario', 60, 600000, 30) });
  const advance = card({ term: 60, value: 600000, startAgo: 30, payments: [[29, -400000]] }); // 40 installments on day 1
  const a = evaluateCustomer([daily], NOW, ZONE);
  const b = evaluateCustomer([advance], NOW, ZONE);
  assert.equal(b.metrics.delay.days, 0);
  assert.equal(b.metrics.punctuality.value, 1);
  assert.equal(b.metrics.consistency.value, 1);
  assert.equal(b.automaticScore, a.automaticScore);
});

test('discounts and corrections are not cash: they never make installments punctual', () => {
  // 60 daily installments of 10000; 40 days due, only a discount was recorded.
  const discounted = card({ term: 60, value: 600000, startAgo: 45, payments: [[44, -300000, 'Descuento: Pago anticipado']] });
  const result = evaluateCustomer([discounted], NOW, ZONE);
  assert.equal(result.metrics.punctuality.onTime, 0);
  assert.ok(result.metrics.delay.days > 30);
  assert.equal(result.metrics.consistency.satisfiedWeeks, 0);
  assert.equal(result.metrics.load.cashInWindowCents, 0);
  assert.equal(result.metrics.adjustments, 1);
  assert.match(result.explanation, /1 ajuste contable \(descuentos\/correcciones\) no cuentan como pago/);
  // A correction and an interest row do not count as cash either.
  const corrected = evaluateCustomer([card({ term: 60, value: 600000, startAgo: 45,
    payments: [[44, -300000, 'Saldo corregido'], [43, 10000, 'Intereses: arreglar']] })], NOW, ZONE);
  assert.equal(corrected.metrics.punctuality.onTime, 0);
});

test('a discount that settles a credit waives the tail instead of counting it late', () => {
  const startAgo = 150;
  const cash = punctualPayments('Diario', 120, 1200000, startAgo, 100);
  const cashPaid = -cash.reduce((sum, [, cents]) => sum + cents, 0);
  const settled = card({ term: 120, value: 1200000, startAgo,
    payments: [...cash, [cash[cash.length - 1][0], -(1200000 - cashPaid), 'Descuento: Cancelo antes de tiempo']] });
  assert.equal(settled.status, 'cancelado');
  const result = evaluateCustomer([settled], NOW, ZONE);
  assert.equal(result.metrics.delay.days, 0);
  assert.equal(result.metrics.punctuality.value, 1);
  assert.equal(result.metrics.waived, 20);
  assert.match(result.explanation, /20 cuotas condonadas no se evalúan/);
  // Cash variants recognised by the web count as payments (c-Inicial, Cancelado, Abono->n).
  const variants = evaluateCustomer([card({ term: 120, value: 1200000, startAgo,
    payments: punctualPayments('Diario', 120, 1200000, startAgo).map(([d, c], i) => [d, c, ['Abono->3', 'c-Inicial->100', 'Cancelado'][i % 3]]) })], NOW, ZONE);
  assert.equal(variants.metrics.punctuality.onTime, variants.metrics.punctuality.evaluated);
});

test('several healthy credits are not penalized by quantity', () => {
  const one = card({ id: '1', term: 120, value: 1200000, startAgo: 150, payments: punctualPayments('Diario', 120, 1200000, 150) });
  const two = card({ id: '2', mode: 'Semanal', term: 40, value: 800000, startAgo: 200,
    payments: punctualPayments('Semanal', 40, 800000, 200) });
  const single = evaluateCustomer([one], NOW, ZONE);
  const both = evaluateCustomer([one, two], NOW, ZONE);
  assert.equal(both.automaticScore, single.automaticScore);
  assert.equal(both.metrics.load.value, 1);
});

test('current delay and missed installments lower the score and explain why', () => {
  const late = card({ term: 60, value: 600000, startAgo: 50, payments: punctualPayments('Diario', 60, 600000, 50, 10) });
  const result = evaluateCustomer([late], NOW, ZONE);
  assert.ok(result.automaticScore <= 4, `score ${result.automaticScore}`);
  assert.ok(result.metrics.delay.days > 20);
  assert.ok(result.metrics.load.value < 1);
  assert.match(result.explanation, /Atraso actual: \d+ días en 1 crédito/);
  assert.ok(Array.from(result.explanation).length <= 500);
});

test('little history with delay is limited and capped at 5', () => {
  const result = evaluateCustomer([card({ mode: 'Semanal', term: 10, value: 100000, startAgo: 40 })], NOW, ZONE);
  assert.equal(result.confidence, 'limited');
  assert.ok(result.automaticScore <= 5);
  assert.match(result.explanation, /máximo 5/);
});

test('invalid open credit data is explicit insufficient evidence: never approved high', () => {
  const good = card({ term: 120, value: 1200000, startAgo: 150, payments: punctualPayments('Diario', 120, 1200000, 150) });
  for (const broken of [
    card({ id: '9', mode: 'Diario.', term: 30, value: 300000, startAgo: 10 }),
    card({ id: '9', term: 0, value: 300000, startAgo: 10 }),
    { ...card({ id: '9', term: 30, value: 300000, startAgo: 10 }), balanceCents: 1 },
    { ...card({ id: '9', term: 30, value: 300000, startAgo: 10 }), createdAtUtc: null },
  ]) {
    const result = evaluateCustomer([good, broken], NOW, ZONE);
    assert.equal(result.confidence, 'limited');
    assert.ok(result.automaticScore <= 6);
    assert.match(result.explanation, /datos inválidos/);
  }
  const deceased = evaluateCustomer([good, card({ id: '8', term: 30, value: 300000, startAgo: 40, status: 'fallecio' })], NOW, ZONE);
  assert.equal(deceased.automaticScore, 10);
  assert.match(deceased.explanation, /no cuentan/);
});

test('weights come from env, validated explicitly, default 50/25/15/10', () => {
  assert.deepEqual(parseRatingWeights({}), DEFAULT_WEIGHTS);
  assert.deepEqual(parseRatingWeights({ RATING_WEIGHT_PUNCTUALITY: '40', RATING_WEIGHT_LOAD: '20' }),
    { punctuality: 40, delay: 25, consistency: 15, load: 20 });
  for (const env of [{ RATING_WEIGHT_LOAD: '11' }, { RATING_WEIGHT_DELAY: '2.5' }, { RATING_WEIGHT_DELAY: '-1' },
    { RATING_WEIGHT_PUNCTUALITY: '101' }, { RATING_WEIGHT_CONSISTENCY: 'abc' }]) {
    assert.throws(() => parseRatingWeights(env), { extensions: { code: 'CONFIGURATION_ERROR' } });
  }
});

test('automation flag and worker settings are explicit and off by default', () => {
  assert.equal(ratingAutomationEnabled({}), false);
  assert.equal(ratingAutomationEnabled({ CUSTOMER_RATING_AUTOMATION: '0' }), false);
  assert.equal(ratingAutomationEnabled({ CUSTOMER_RATING_AUTOMATION: '1' }), true);
  assert.throws(() => ratingAutomationEnabled({ CUSTOMER_RATING_AUTOMATION: 'yes' }), { extensions: { code: 'CONFIGURATION_ERROR' } });
  assert.deepEqual(workerSettings({}), { intervalMs: 30000, batch: 100, weights: DEFAULT_WEIGHTS, zone: 'America/Bogota' });
  assert.throws(() => workerSettings({ RATING_WORKER_BATCH: '0' }), { extensions: { code: 'CONFIGURATION_ERROR' } });
  assert.throws(() => workerSettings({ RATING_WORKER_INTERVAL_MS: '100' }), { extensions: { code: 'CONFIGURATION_ERROR' } });
  assert.equal(ratingScore(' 7'), null);
});

test('hysteresis avoids flapping and history floods', () => {
  const evaluation = { automaticScore: 8, continuous: 7.6, confidence: 'limited' };
  assert.equal(stableAutomaticScore({ score: 7, confidence: 'limited' }, evaluation), 7);
  assert.equal(stableAutomaticScore({ score: 6, confidence: 'limited' }, evaluation), 8);
  assert.equal(stableAutomaticScore({ score: 7, confidence: 'established' }, evaluation), 8);
  assert.equal(stableAutomaticScore({ score: null, confidence: null }, evaluation), 8);
});
