import test from 'node:test';
import assert from 'node:assert/strict';
import { forecastScheduledCollections } from '../../dist/services/ratingEngine.js';
const date = (s) => new Date(`${s}T12:00:00-05:00`);
function card(mode, start, term, value, payments = []) {
  return { id: 'card', status: 'saved', mode, term, valueCents: value,
    balanceCents: value + payments.reduce((s,p) => s + p.amountCents, 0),
    createdAtUtc: date(start).toISOString(), payments };
}
const paid = (day, amount, description = 'Abono') =>
  ({ createdAtUtc: date(day).toISOString(), amountCents: amount, description });
const forecast = (cards, today, deadline) => forecastScheduledCollections(cards, date(today), date(deadline), 'America/Bogota');

test('forecast shares rating schedules: Sunday, month31 skipped, leap day, fortnight and weekly', () => {
  assert.equal(forecast([card('Diario','2026-10-10',3,30000)],'2026-10-11','2026-10-12').dueAmount, 100);
  assert.equal(forecast([card('Mensual','2024-01-31',3,30000)],'2024-02-01','2024-02-29').dueAmount, 0);
  assert.equal(forecast([card('Mensual','2024-01-29',3,30000)],'2024-02-01','2024-02-29').dueAmount, 100);
  assert.equal(forecast([card('Quincenal','2026-10-01',2,20000)],'2026-10-02','2026-10-16').dueAmount, 100);
  assert.equal(forecast([card('Semanal','2026-10-01',2,20000)],'2026-10-02','2026-10-08').dueAmount, 100);
});
test('advances and partial payments satisfy future dues, arrears separate, signs and waivers preserved', () => {
  let r = forecast([card('Semanal','2026-10-01',4,40000,[paid('2026-10-02',-25000)])],'2026-10-10','2026-10-22');
  assert.equal(r.arrearsAmount, 0); assert.equal(r.dueAmount, 50); assert.equal(r.advanceAmount,150);
  r = forecast([card('Semanal','2026-10-01',4,40000,[paid('2026-10-02',-5000)])],'2026-10-10','2026-10-22');
  assert.equal(r.arrearsAmount, 50); assert.equal(r.dueAmount, 200);
  r = forecast([card('Semanal','2026-10-01',4,40000,[paid('2026-10-02',-20000),paid('2026-10-03',10000,'Abono reverso')])],'2026-10-10','2026-10-22');
  assert.equal(r.dueAmount,200); assert.equal(r.arrearsAmount,0);
  r = forecast([card('Semanal','2026-10-01',4,40000,[paid('2026-10-02',-30000,'Descuento')])],'2026-10-10','2026-10-29');
  assert.equal(r.arrearsAmount,100); assert.equal(r.dueAmount,0);
});
test('invalid data and future payments never produce a success-shaped forecast', () => {
  const bad = card('Semanal','2026-10-01',4,40000);
  bad.balanceCents = 1;
  const r = forecast([bad],'2026-10-10','2026-10-22');
  assert.equal(r.status,'insufficient_data'); assert.equal(r.invalidCardCount,1);
  assert.equal(forecast([card('Diario','2026-10-01',3,30000,[paid('2026-10-11',-10000)])],
    '2026-10-10','2026-10-22').status,'insufficient_data');
  assert.throws(() => forecast([],'2026-10-10','2026-10-09'),/corte/);
});
