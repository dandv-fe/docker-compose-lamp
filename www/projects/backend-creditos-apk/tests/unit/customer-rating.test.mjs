import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ratingScore, ratingLabel, displayRating, parseRatingInput, customerRating, rateCustomer } from '../../dist/services/customerRating.js';
import { schema } from '../../dist/graphql/schema.js';

test('raw rating maps to score and category', () => {
  for (const raw of ['nuevo', '', null, '0', '11', '5.5', 'abc', ' 7', '7 ', '07', '10\n']) assert.equal(ratingScore(raw), null);
  assert.equal(ratingScore('7'), 7);
  assert.equal(ratingScore('10'), 10);
  const labels = [[null, 'Sin calificar'], [10, 'Excelente'], [9, 'Excelente'], [8, 'Bueno'], [7, 'Bueno'],
    [6, 'Regular'], [5, 'Regular'], [4, 'Requiere seguimiento'], [1, 'Requiere seguimiento']];
  for (const [score, label] of labels) assert.equal(ratingLabel(score), label);
  for (const raw of ['nuevo', '']) assert.deepEqual(displayRating(raw), { score: 5, label: 'Inicial · poca historia' });
  for (const raw of [' 7', 'abc', 'Nuevo']) assert.deepEqual(displayRating(raw, 'limited', 'automatic'), { score: null, label: 'Nota por revisar' });
  assert.deepEqual(displayRating('4'), { score: 4, label: 'Requiere seguimiento' });
  assert.deepEqual(displayRating('5', 'limited', 'automatic'), { score: 5, label: 'Regular' });
  assert.deepEqual(displayRating('7', 'initial', 'automatic'), { score: 7, label: 'Inicial · poca historia' });
  assert.deepEqual(displayRating('7', 'initial', 'manual'), { score: 7, label: 'Bueno' });
});

test('input validation: integer 1..10 and trimmed reason 5..500', () => {
  for (const score of [0, 11, 1.5, NaN]) {
    assert.throws(() => parseRatingInput(score, 'motivo ok', ''), { extensions: { code: 'VALIDATION_ERROR' } });
  }
  for (const reason of ['    ab   ', '', 'x'.repeat(501)]) {
    assert.throws(() => parseRatingInput(5, reason, ''), { extensions: { code: 'VALIDATION_ERROR' } });
  }
  assert.deepEqual(parseRatingInput(5, '  motivo  ', ' nuevo '), { score: 5, reason: 'motivo', expectedRating: ' nuevo ' });
  assert.throws(() => parseRatingInput(5, 'motivo ok', 'x'.repeat(51)), { extensions: { code: 'VALIDATION_ERROR' } });
  assert.equal(parseRatingInput(10, 'x'.repeat(500), '').reason.length, 500);
  // Code points, not UTF-16 units (PHP mb_strlen): 500 emoji are valid, 4 emoji + space-trim are not.
  assert.equal(Array.from(parseRatingInput(10, '😀'.repeat(500), '').reason).length, 500);
  assert.throws(() => parseRatingInput(10, '😀'.repeat(501), ''), { extensions: { code: 'VALIDATION_ERROR' } });
  assert.throws(() => parseRatingInput(10, ' 😀😀😀😀 ', ''), { extensions: { code: 'VALIDATION_ERROR' } });
  assert.equal(parseRatingInput(10, '\u00a0motivo', '').reason, '\u00a0motivo');
  assert.equal(parseRatingInput(10, 'motivo ok', 'ñ'.repeat(50)).expectedRating.length, 50);
});

test('rating operations require authentication', async () => {
  await assert.rejects(customerRating(null, 1, 1), { extensions: { code: 'UNAUTHENTICATED' } });
  await assert.rejects(rateCustomer(null, 1, 1, 5, 'motivo ok', ''), { extensions: { code: 'UNAUTHENTICATED' } });
});

test('GraphQL contract', () => {
  const query = schema.getQueryType().getFields().customerRating;
  assert.equal(String(query.type), 'CustomerRating!');
  assert.deepEqual(query.args.map((a) => `${a.name}:${a.type}`), ['branchId:Int!', 'customerId:Int!']);
  const mutation = schema.getMutationType().getFields().rateCustomer;
  assert.deepEqual(mutation.args.map((a) => `${a.name}:${a.type}`),
    ['branchId:Int!', 'customerId:Int!', 'score:Int!', 'reason:String!', 'expectedRating:String!']);
  const fields = schema.getType('CustomerRating').getFields();
  assert.deepEqual(Object.entries(fields).map(([n, f]) => `${n}:${f.type}`),
    ['score:Int', 'rawRating:String!', 'label:String!', 'canRate:Boolean!', 'automaticScore:Int!', 'source:String!',
      'manualUntil:String', 'evaluatedAt:String', 'confidence:String!', 'explanation:String!',
      'history:[CustomerRatingEntry!]!']);
  const customer = schema.getType('Customer').getFields();
  assert.deepEqual(['rating', 'ratingSource', 'ratingConfidence'].map((n) => `${n}:${customer[n].type}`),
    ['rating:String', 'ratingSource:String', 'ratingConfidence:String']);
  assert.deepEqual(Object.entries(schema.getType('CustomerRatingEntry').getFields()).map(([n, f]) => `${n}:${f.type}`),
    ['id:ID!', 'score:Int', 'previousScore:Int', 'reason:String!', 'source:String!', 'createdAt:String!', 'createdBy:Int!']);
});

test('migration 013 is additive, idempotent and keeps legacy sync triggers', async () => {
  const sql = await readFile(new URL('../../migrations/013_customer_rating.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS mobile_customer_rating_history/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS mobile_customer_rating_event/);
  assert.match(sql, /  KEY ix_rating_event_source \(idglobal, event_type, source_record_id\)/);
  assert.match(sql, /created_at DATETIME\(3\) NOT NULL/);
  assert.match(sql, /occurred_at DATETIME\(3\) NOT NULL/);
  for (const column of ['old_state VARCHAR(50) NULL', 'new_state VARCHAR(50) NULL',
    'previous_amount DECIMAL(12,2) NULL', 'amount DECIMAL(12,2) NULL']) assert.ok(sql.includes(column), column);
  assert.doesNotMatch(sql, /UNIQUE KEY|INSERT IGNORE|DECLARE[^;]*HANDLER|MD5\(|CONCAT\((?:NEW|OLD)\.id/i);
  for (const name of ['descripcion_ai', 'descripcion_au', 'descripcion_ad', 'tarjeta_ai', 'tarjeta_au']) {
    assert.match(sql, new RegExp(`CREATE OR REPLACE TRIGGER trg_rating_${name}`));
    assert.match(sql, new RegExp(`FOLLOWS trg_mobile_${name}`));
  }
  assert.doesNotMatch(sql, /DROP\s+TRIGGER|trg_mobile_\w+ AFTER|ALTER\s+TABLE|UPDATE\s+tbl_|DELETE\s+FROM/i);
});

test('migration 014 adds state + event detail, replaces only rating triggers', async () => {
  const sql = await readFile(new URL('../../migrations/014_customer_rating_automatic.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS mobile_customer_rating_state/);
  assert.match(sql, /PRIMARY KEY \(idglobal, idcliente\)/);
  for (const column of ['manual_score TINYINT UNSIGNED NULL',
    'manual_until DATETIME(3) NULL', 'evaluated_at DATETIME(3) NULL', "confidence VARCHAR(16) NOT NULL DEFAULT 'initial'",
    'metrics_json LONGTEXT NULL', 'next_evaluation_at DATETIME(3) NULL',
    'ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0']) assert.ok(sql.includes(column), column);
  assert.doesNotMatch(sql, /UNIQUE KEY|INSERT IGNORE|DECLARE[^;]*HANDLER|DROP\s+TRIGGER|UPDATE\s+tbl_|DELETE\s+FROM|INSERT\s+INTO\s+tbl_/i);
  for (const name of ['descripcion_ai', 'descripcion_au', 'descripcion_ad', 'tarjeta_ai', 'tarjeta_au', 'tarjeta_ad']) {
    assert.match(sql, new RegExp(`CREATE OR REPLACE TRIGGER trg_rating_${name}`));
    assert.match(sql, new RegExp(`FOLLOWS trg_mobile_${name}`));
  }
  assert.ok(sql.includes("automatic_score TINYINT UNSIGNED NOT NULL DEFAULT 5"));
  assert.ok(sql.includes("explanation VARCHAR(500) NOT NULL DEFAULT 'Nota inicial neutral; evaluación matemática pendiente.'"));
  for (const name of ['state_ai', 'state_au']) {
    assert.match(sql, new RegExp(`CREATE OR REPLACE TRIGGER trg_rating_${name} AFTER (INSERT|UPDATE) ON mobile_customer_rating_state`));
  }
  assert.match(sql, /INSERT INTO mobile_customer_rating_state \(idglobal,idcliente,manual_score,manual_until,next_evaluation_at\)\nSELECT h\.idglobal,h\.idcliente,h\.score,h\.created_at \+ INTERVAL 7 DAY,UTC_TIMESTAMP\(3\)/);
  assert.match(sql, /AND NOT EXISTS \(SELECT 1 FROM mobile_customer_rating_state s/);
  assert.match(sql, /'payment_moved_out'/);
  assert.match(sql, /'credit_moved_out'/);
});
