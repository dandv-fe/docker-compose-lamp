// Opt-in DB test for migrations 013/014, the rating service and the automatic worker. It clones only
// the SCHEMA of an explicit source database into a freshly created, uniquely named database, applies
// 013 and 014 there (twice each), uses fixture rows that exist only in that temporary database and
// always drops it.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';

const required = ['RUN_CUSTOMER_RATING_DB_TESTS', 'RATING_TEST_DB_HOST', 'RATING_TEST_DB_USER',
  'RATING_TEST_DB_PASSWORD', 'RATING_TEST_SOURCE_DB'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Refusing customer rating DB test; missing: ${missing.join(', ')}`);
if (process.env.RUN_CUSTOMER_RATING_DB_TESTS !== '1') {
  throw new Error('Set RUN_CUSTOMER_RATING_DB_TESTS=1 to permit creating and dropping a temporary database');
}
const sourceDb = process.env.RATING_TEST_SOURCE_DB;
if (!/^\w+$/.test(sourceDb)) throw new Error('RATING_TEST_SOURCE_DB must be a plain database name');
const tempDb = `tmp_rating_test_${Date.now()}_${randomBytes(4).toString('hex')}`;
const server = {
  host: process.env.RATING_TEST_DB_HOST, port: Number(process.env.RATING_TEST_DB_PORT || 3306),
  user: process.env.RATING_TEST_DB_USER, password: process.env.RATING_TEST_DB_PASSWORD,
  charset: 'utf8mb4', decimalNumbers: false,
};
const migrationSql = await readFile(new URL('../migrations/013_customer_rating.sql', import.meta.url), 'utf8');
const automaticSql = await readFile(new URL('../migrations/014_customer_rating_automatic.sql', import.meta.url), 'utf8');

const COMPANY = 1;
const BRANCH = 5;
const OTHER_BRANCH = 6;
const ADMIN_EMPLOYEE = 77;
let admin;
let source;
let db;
let service;
let automation;
let engine;
let queries;
let appPool;

// Same splitting the mariadb CLI does: '--' comment lines are dropped, DELIMITER switches the
// terminator and a terminator inside a quoted string (e.g. the explanation default) does not split.
function migrationStatements(sql) {
  const statements = [];
  let delimiter = ';';
  let buffer = '';
  let quote = null;
  for (const line of sql.split('\n')) {
    if (!quote) {
      const directive = line.match(/^\s*DELIMITER\s+(\S+)\s*$/i);
      if (directive) { delimiter = directive[1]; continue; }
      if (/^\s*--/.test(line)) continue;
    }
    const text = `${line}\n`;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (quote) {
        buffer += ch;
        if (ch === '\\') { buffer += text[i + 1] ?? ''; i += 1; } else if (ch === quote) quote = null;
      } else if (ch === "'" || ch === '"' || ch === '`') {
        quote = ch;
        buffer += ch;
      } else if (text.startsWith(delimiter, i)) {
        const statement = buffer.trim();
        if (statement) statements.push(statement);
        buffer = '';
        i += delimiter.length - 1;
      } else buffer += ch;
    }
  }
  if (quote || buffer.trim()) throw new Error('Migration has an unterminated statement');
  return statements;
}

async function applyMigration(sql = migrationSql, names = null) {
  const statements = migrationStatements(sql);
  // The mariadb CLI connects as utf8mb3_general_ci; legacy columns are utf8mb3_spanish2_ci.
  if (names) await db.query(`SET NAMES ${names}`);
  try {
    for (const statement of statements) await db.query(statement);
  } finally {
    if (names) await db.query('SET NAMES utf8mb4');
  }
  return statements.length;
}

const stripDefiner = (sql) => sql.replace(/\sDEFINER=`[^`]*`@`[^`]*`/, '');

// DDL is read with the source as default schema so it comes back unqualified; any DDL that still
// names the source schema is refused, so the clone can never create or replace a source object.
async function createInTemp(sql) {
  if (sql.includes(sourceDb)) throw new Error('Refusing cloned DDL that references the source schema');
  await db.query(sql);
}

// Pre-013 schema: every table, view, routine and trigger of the source except the objects 013 creates.
async function cloneSchema() {
  await admin.query(`CREATE DATABASE \`${tempDb}\` CHARACTER SET utf8mb4`);
  db = await mysql.createConnection({ ...server, database: tempDb });
  await db.query('SET SESSION foreign_key_checks=0');
  const [objects] = await admin.execute(
    `SELECT table_name AS name, table_type AS type FROM information_schema.tables
     WHERE table_schema=? AND table_name NOT LIKE 'mobile\\_customer\\_rating\\_%'`, [sourceDb]);
  for (const { name } of objects.filter((o) => o.type === 'BASE TABLE')) {
    const [[row]] = await source.query(`SHOW CREATE TABLE \`${name}\``);
    await createInTemp(row['Create Table'].replace(/ AUTO_INCREMENT=\d+/, ''));
  }
  let views = objects.filter((o) => o.type === 'VIEW').map((o) => o.name);
  while (views.length) {
    const pending = [];
    const errors = [];
    for (const name of views) {
      const [[row]] = await source.query(`SHOW CREATE VIEW \`${name}\``);
      try { await createInTemp(stripDefiner(row['Create View'])); } catch (error) {
        pending.push(name);
        errors.push(`${name}: ${error.code}`);
      }
    }
    if (pending.length === views.length) throw new Error(`Could not clone views: ${errors.join(', ')}`);
    views = pending;
  }
  const [routines] = await admin.execute(
    `SELECT routine_name AS name, routine_type AS type FROM information_schema.routines WHERE routine_schema=?`, [sourceDb]);
  for (const { name, type } of routines) {
    const [[row]] = await source.query(`SHOW CREATE ${type} \`${name}\``);
    await createInTemp(stripDefiner(row[type === 'PROCEDURE' ? 'Create Procedure' : 'Create Function']));
  }
  const [triggers] = await admin.execute(
    `SELECT trigger_name AS name FROM information_schema.triggers
     WHERE trigger_schema=? AND trigger_name NOT LIKE 'trg\\_rating\\_%' ORDER BY event_object_table, action_order`,
    [sourceDb]);
  for (const { name } of triggers) {
    const [[row]] = await source.query(`SHOW CREATE TRIGGER \`${name}\``);
    await createInTemp(stripDefiner(row['SQL Original Statement']));
  }
  await db.query("SET SESSION sql_mode=''");
}

before(async () => {
  admin = await mysql.createConnection(server);
  source = await mysql.createConnection({ ...server, database: sourceDb });
  await cloneSchema();
  process.env.DB_HOST = server.host;
  process.env.DB_PORT = String(server.port);
  process.env.DB_USER = server.user;
  process.env.DB_PASSWORD = server.password;
  process.env.DB_NAME = tempDb;
  // dotenv (loaded by dist/db.js) never overrides existing variables: pin the test's own settings.
  process.env.CUSTOMER_RATING_AUTOMATION = '0';
  process.env.APP_TIME_ZONE = 'America/Bogota';
  service = await import('../dist/services/customerRating.js');
  automation = await import('../dist/services/ratingAutomation.js');
  engine = await import('../dist/services/ratingEngine.js');
  queries = await import('../dist/services/queries.js');
  ({ pool: appPool } = await import('../dist/db.js'));
});

after(async () => {
  await appPool?.end();
  await db?.end();
  await source?.end();
  try {
    if (admin) await admin.query(`DROP DATABASE IF EXISTS \`${tempDb}\``);
  } finally {
    await admin?.end();
  }
});

const ratingEvents = async (sourceId) => (await db.execute(
  `SELECT idglobal, idcliente, idsucursal, event_type AS type, source_record_id AS sourceId,
          old_state AS oldState, new_state AS newState, previous_amount AS previousAmount, amount, state,
          processed_at AS processedAt, CAST(occurred_at AS CHAR) AS occurredAt
   FROM mobile_customer_rating_event WHERE source_record_id=? ORDER BY id`, [sourceId]))[0];
const syncCount = async (recordType, recordId, action) => (await db.execute(
  'SELECT COUNT(*) AS n FROM mobile_change_event WHERE record_type=? AND record_id=? AND action=?',
  [recordType, recordId, action]))[0][0].n;
const ctx = (cargo, employeeId, userId = 9) => ({
  user: { userId, companyId: COMPANY, employeeId, cargo }, permissions: [] });
const code = (promise) => promise.then(() => 'ok', (error) => error.extensions?.code ?? error.code ?? error.message);

test('migration 013 applies to the pre-013 schema, is re-runnable and inserts no rows', async () => {
  assert.equal(await applyMigration(), 7);
  assert.equal(await applyMigration(), 7);
  const [counts] = await db.query(`SELECT (SELECT COUNT(*) FROM mobile_customer_rating_history) AS history,
    (SELECT COUNT(*) FROM mobile_customer_rating_event) AS events`);
  assert.deepEqual(counts[0], { history: 0, events: 0 });
  const [triggers] = await db.execute(
    `SELECT trigger_name AS name, action_order AS ord FROM information_schema.triggers
     WHERE trigger_schema=? AND event_object_table IN ('tbl_descripcion','tbl_tarjetas') ORDER BY name`, [tempDb]);
  assert.deepEqual(triggers.map((t) => `${t.name}:${t.ord}`), [
    'trg_mobile_descripcion_ad:1', 'trg_mobile_descripcion_ai:1', 'trg_mobile_descripcion_au:1',
    'trg_mobile_tarjeta_ad:1', 'trg_mobile_tarjeta_ai:1', 'trg_mobile_tarjeta_au:1',
    'trg_rating_descripcion_ad:2', 'trg_rating_descripcion_ai:2', 'trg_rating_descripcion_au:2',
    'trg_rating_tarjeta_ai:2', 'trg_rating_tarjeta_au:2']);
  const [indexes] = await db.execute(
    `SELECT index_name AS name, non_unique AS nonUnique FROM information_schema.statistics
     WHERE table_schema=? AND table_name='mobile_customer_rating_event' AND seq_in_index=1`, [tempDb]);
  assert.deepEqual(indexes.filter((i) => i.name !== 'PRIMARY').map((i) => Number(i.nonUnique)), [1, 1, 1]);
  // Fixture rows live only in this temporary database.
  await db.query(`INSERT INTO tbl_oficina (idoficina,idglobal,idempleado_administrador) VALUES (1,${COMPANY},${ADMIN_EMPLOYEE}),(2,${COMPANY},88)`);
  await db.query(`INSERT INTO tbl_sucursal (idsucursal,idglobal,idoficina) VALUES (${BRANCH},${COMPANY},1),(${OTHER_BRANCH},${COMPANY},2)`);
  await db.query(`INSERT INTO tbl_clientes (idcliente,idglobal,idpersona,str_calificacion) VALUES (10,${COMPANY},1,'nuevo'),(11,${COMPANY},2,'')`);
});

test('credit triggers record creation and every real status change with old/new values', async () => {
  await db.query(`INSERT INTO tbl_tarjetas (idtarjeta,idglobal,idsucursal,idcliente,dec_valor,dec_resta,str_estado,created_at,updated_at)
    VALUES ('T1',${COMPANY},${BRANCH},10,120.00,120.00,'created',NOW(),NOW())`);
  await db.query("UPDATE tbl_tarjetas SET dec_resta=100.00 WHERE idtarjeta='T1'");
  await db.query("UPDATE tbl_tarjetas SET str_estado='activo', dec_resta=90.00 WHERE idtarjeta='T1'");
  await db.query("UPDATE tbl_tarjetas SET str_estado='cancelado', dec_resta=0.00 WHERE idtarjeta='T1'");
  await db.query("UPDATE tbl_tarjetas SET str_estado='activo', dec_resta=90.00 WHERE idtarjeta='T1'");
  const events = await ratingEvents('T1');
  assert.deepEqual(events.map(({ type, oldState, newState, previousAmount, amount }) =>
    [type, oldState, newState, previousAmount, amount]), [
    ['credit_created', null, 'created', null, '120.00'],
    ['credit_status_changed', 'created', 'activo', '100.00', '90.00'],
    ['credit_status_changed', 'activo', 'cancelado', '90.00', '0.00'],
    ['credit_status_changed', 'cancelado', 'activo', '0.00', '90.00'],
  ]);
  for (const event of events) {
    assert.equal(event.sourceId, 'T1');
    assert.deepEqual([event.idglobal, event.idcliente, event.idsucursal, event.state, event.processedAt],
      [COMPANY, 10, BRANCH, 'pending', null]);
    assert.match(String(event.occurredAt), /\.\d{3}$/);
  }
  assert.equal(await syncCount('credit', 'T1', 'UPDATE'), 4, 'legacy sync trigger still fires on every update');
});

test('payment triggers: create, no-op update, real update, delete and re-insert keep the original id', async () => {
  await db.query(`INSERT INTO tbl_descripcion (iddescripcion,idglobal,idsucursal,idtarjeta,dec_abono,str_estado,created_at,updated_at)
    VALUES ('D1',${COMPANY},${BRANCH},'T1',10.00,'created',NOW(),NOW())`);
  await db.query("UPDATE tbl_descripcion SET updated_at=NOW() + INTERVAL 1 SECOND WHERE iddescripcion='D1'");
  await db.query("UPDATE tbl_descripcion SET dec_abono=15.00 WHERE iddescripcion='D1'");
  await db.query("UPDATE tbl_descripcion SET str_estado='entregando' WHERE iddescripcion='D1'");
  await db.query("DELETE FROM tbl_descripcion WHERE iddescripcion='D1'");
  await db.query(`INSERT INTO tbl_descripcion (iddescripcion,idglobal,idsucursal,idtarjeta,dec_abono,str_estado,created_at,updated_at)
    VALUES ('D1',${COMPANY},${BRANCH},'T1',15.00,'created',NOW(),NOW())`);
  const events = await ratingEvents('D1');
  assert.deepEqual(events.map(({ type, oldState, newState, previousAmount, amount, idcliente, sourceId }) =>
    [type, oldState, newState, previousAmount, amount, idcliente, sourceId]), [
    ['payment_created', null, 'created', null, '10.00', 10, 'D1'],
    ['payment_updated', 'created', 'created', '10.00', '15.00', 10, 'D1'],
    ['payment_updated', 'created', 'entregando', '15.00', '15.00', 10, 'D1'],
    ['payment_deleted', 'entregando', null, '15.00', null, 10, 'D1'],
    ['payment_created', null, 'created', null, '15.00', 10, 'D1'],
  ]);
  assert.equal(await syncCount('payment', 'D1', 'UPDATE'), 3, 'no-op update still syncs but is not a rating event');
  assert.equal(await syncCount('payment', 'D1', 'DELETE'), 1);
});

test('an orphan payment fails explicitly and rolls back the legacy row and both event tables', async () => {
  const before = (await db.query('SELECT COUNT(*) AS n FROM mobile_change_event'))[0][0].n;
  await assert.rejects(db.query(`INSERT INTO tbl_descripcion (iddescripcion,idglobal,idsucursal,idtarjeta,dec_abono,str_estado,created_at,updated_at)
    VALUES ('DX',${COMPANY},${BRANCH},'NO_CREDIT',1.00,'created',NOW(),NOW())`), { code: 'ER_BAD_NULL_ERROR' });
  const [[row]] = await db.query(`SELECT (SELECT COUNT(*) FROM tbl_descripcion WHERE iddescripcion='DX') AS payments,
    (SELECT COUNT(*) FROM mobile_change_event) AS sync, (SELECT COUNT(*) FROM mobile_customer_rating_event WHERE source_record_id='DX') AS events`);
  assert.deepEqual(row, { payments: 0, sync: before, events: 0 });
});

// Customers rated under 013 (history only): 30 still inside its 7 days, 31 expired, 32 changed afterwards,
// 33 numeric note without any history. Each has a fresh credit (initial confidence, branch scope).
async function seedLegacyManualRatings() {
  await db.query(`INSERT INTO tbl_clientes (idcliente,idglobal,idpersona,str_calificacion) VALUES
    (30,${COMPANY},30,'7'),(31,${COMPANY},31,'8'),(32,${COMPANY},32,'9'),(33,${COMPANY},33,'9')`);
  for (const customer of [30, 31, 32, 33]) {
    await db.query(`INSERT INTO tbl_tarjetas (idtarjeta,idglobal,idsucursal,idcliente,dec_valor,dec_resta,int_tiempo,str_modo,str_estado,created_at,updated_at)
      VALUES (?,?,?,?,100.00,100.00,10,'Diario','saved',NOW() - INTERVAL 1 DAY,NOW())`, [`C${customer}`, COMPANY, BRANCH, customer]);
  }
  await db.query(`INSERT INTO mobile_customer_rating_history (idglobal,idcliente,idsucursal,score,previous_score,reason,source,created_by,created_at) VALUES
    (${COMPANY},30,${BRANCH},3,NULL,'primera nota','manual',21,UTC_TIMESTAMP(3) - INTERVAL 3 DAY),
    (${COMPANY},30,${BRANCH},7,3,'nota vigente','manual',21,UTC_TIMESTAMP(3) - INTERVAL 2 DAY),
    (${COMPANY},31,${BRANCH},8,NULL,'nota vencida','manual',21,UTC_TIMESTAMP(3) - INTERVAL 8 DAY),
    (${COMPANY},32,${BRANCH},6,NULL,'nota reemplazada','manual',21,UTC_TIMESTAMP(3) - INTERVAL 1 DAY)`);
}

test('migration 014 applies on top of 013, is re-runnable and only preserves active 013 manual ratings', async () => {
  await seedLegacyManualRatings();
  const before = (await db.query('SELECT COUNT(*) AS n FROM mobile_customer_rating_event'))[0][0].n;
  const sync30 = await syncCount('customer', '30', 'UPDATE');
  assert.equal(await applyMigration(automaticSql, 'utf8mb3'), 11);
  const [[firstState]] = await db.query(`SELECT CAST(manual_until AS CHAR) AS until FROM mobile_customer_rating_state WHERE idcliente=30`);
  assert.equal(await applyMigration(automaticSql), 11);
  const [[row]] = await db.query(`SELECT (SELECT COUNT(*) FROM mobile_customer_rating_state) AS states,
    (SELECT COUNT(*) FROM mobile_customer_rating_event) AS events,
    (SELECT COUNT(*) FROM mobile_customer_rating_event WHERE attempts<>0) AS attempts`);
  assert.deepEqual(row, { states: 1, events: before, attempts: 0 });
  const [[seeded]] = await db.query(`SELECT idcliente, manual_score AS m, automatic_score AS a, evaluated_at AS e, confidence,
      explanation, metrics_json AS metrics, CAST(manual_until AS CHAR) AS until,
      manual_until = (SELECT created_at + INTERVAL 7 DAY FROM mobile_customer_rating_history WHERE reason='nota vigente') AS exact,
      next_evaluation_at <= UTC_TIMESTAMP(3) AS due
    FROM mobile_customer_rating_state`);
  assert.deepEqual([seeded.idcliente, seeded.m, seeded.a, seeded.e, seeded.confidence, seeded.explanation, seeded.metrics,
    Number(seeded.exact), Number(seeded.due)],
    [30, 7, 5, null, 'initial', 'Nota inicial neutral; evaluación matemática pendiente.', null, 1, 1]);
  assert.equal(seeded.until, firstState.until, 're-running never extends the manual window');
  assert.equal(await syncCount('customer', '30', 'UPDATE'), sync30 + 1, 'seeded source reaches APK/web sync once');
  assert.deepEqual((await db.query("SELECT str_calificacion AS r FROM tbl_clientes WHERE idcliente IN (30,31,32,33) ORDER BY idcliente"))[0]
    .map((r) => r.r), ['7', '8', '9', '9'], 'no business rows touched');
  const [triggers] = await db.execute(
    `SELECT trigger_name AS name, action_order AS ord FROM information_schema.triggers
     WHERE trigger_schema=? AND trigger_name LIKE 'trg\\_rating\\_%' ORDER BY name`, [tempDb]);
  assert.deepEqual(triggers.map((t) => `${t.name}:${t.ord}`), [
    'trg_rating_descripcion_ad:2', 'trg_rating_descripcion_ai:2', 'trg_rating_descripcion_au:2',
    'trg_rating_state_ai:1', 'trg_rating_state_au:1',
    'trg_rating_tarjeta_ad:2', 'trg_rating_tarjeta_ai:2', 'trg_rating_tarjeta_au:2']);
});

const detailEvents = async (sourceId) => (await db.execute(
  `SELECT event_type AS type, idcliente, previous_amount AS previousAmount, amount, old_value AS oldValue,
          new_value AS newValue, old_term AS oldTerm, new_term AS newTerm, old_mode AS oldMode, new_mode AS newMode,
          old_parent_id AS oldParent, new_parent_id AS newParent,
          old_record_at IS NOT NULL AS hasOldAt, new_record_at IS NOT NULL AS hasNewAt
   FROM mobile_customer_rating_event WHERE source_record_id=? ORDER BY id`, [sourceId]))[0];

test('014 triggers: credit terms/balance, reparenting both customers, payment moves and deletions', async () => {
  await db.query(`INSERT INTO tbl_clientes (idcliente,idglobal,idpersona,str_calificacion) VALUES (12,${COMPANY},3,'nuevo'),(13,${COMPANY},4,'nuevo')`);
  await db.query(`INSERT INTO tbl_tarjetas (idtarjeta,idglobal,idsucursal,idcliente,dec_valor,dec_resta,int_tiempo,str_modo,str_estado,created_at,updated_at)
    VALUES ('T2',${COMPANY},${BRANCH},12,200.00,200.00,20,'Diario','saved',NOW(),NOW()),
           ('T3',${COMPANY},${BRANCH},13,50.00,50.00,5,'Semanal','saved',NOW(),NOW())`);
  await db.query("UPDATE tbl_tarjetas SET dec_resta=180.00 WHERE idtarjeta='T2'");
  await db.query("UPDATE tbl_tarjetas SET int_tiempo=24, str_modo='Semanal', dec_valor=240.00 WHERE idtarjeta='T2'");
  await db.query("UPDATE tbl_tarjetas SET updated_at=NOW() + INTERVAL 1 SECOND WHERE idtarjeta='T2'");
  await db.query("UPDATE tbl_tarjetas SET idcliente=13 WHERE idtarjeta='T2'");
  assert.deepEqual((await detailEvents('T2')).map((e) => [e.type, e.idcliente, e.previousAmount, e.amount,
    e.oldValue, e.newValue, e.oldTerm, e.newTerm, e.oldMode, e.newMode, e.oldParent, e.newParent]), [
    ['credit_created', 12, null, '200.00', null, '200.00', null, 20, null, 'Diario', null, '12'],
    ['credit_changed', 12, '200.00', '180.00', '200.00', '200.00', 20, 20, 'Diario', 'Diario', '12', '12'],
    ['credit_changed', 12, '180.00', '180.00', '200.00', '240.00', 20, 24, 'Diario', 'Semanal', '12', '12'],
    ['credit_changed', 13, '180.00', '180.00', '240.00', '240.00', 24, 24, 'Semanal', 'Semanal', '12', '13'],
    ['credit_moved_out', 12, '180.00', '180.00', '240.00', '240.00', 24, 24, 'Semanal', 'Semanal', '12', '13'],
  ]);

  await db.query(`INSERT INTO tbl_descripcion (iddescripcion,idglobal,idsucursal,idtarjeta,dec_abono,str_descripcion,str_estado,created_at,updated_at)
    VALUES ('D2',${COMPANY},${BRANCH},'T2',-20.00,'Abono','created',NOW(),NOW())`);
  await db.query("UPDATE tbl_descripcion SET created_at=created_at - INTERVAL 1 DAY WHERE iddescripcion='D2'");
  await db.query("UPDATE tbl_descripcion SET str_descripcion='Abono corregido' WHERE iddescripcion='D2'");
  await db.query("UPDATE tbl_descripcion SET idtarjeta='T3' WHERE iddescripcion='D2'");
  await db.query("UPDATE tbl_tarjetas SET idcliente=12 WHERE idtarjeta='T3'");
  await db.query("UPDATE tbl_descripcion SET idtarjeta='T2' WHERE iddescripcion='D2'");
  await db.query("DELETE FROM tbl_descripcion WHERE iddescripcion='D2'");
  assert.deepEqual((await detailEvents('D2')).map((e) => [e.type, e.idcliente, e.oldParent, e.newParent,
    Number(e.hasOldAt), Number(e.hasNewAt)]), [
    ['payment_created', 13, null, 'T2', 0, 1],
    ['payment_updated', 13, 'T2', 'T2', 1, 1],
    ['payment_updated', 13, 'T2', 'T2', 1, 1],
    ['payment_updated', 13, 'T2', 'T3', 1, 1], // T3 still belongs to 13
    ['payment_moved_out', 13, 'T2', 'T3', 1, 1],
    ['payment_updated', 13, 'T3', 'T2', 1, 1],
    ['payment_moved_out', 12, 'T3', 'T2', 1, 1], // T3 was re-parented to 12 meanwhile
    ['payment_deleted', 13, 'T2', null, 1, 0],
  ]);
  await db.query("DELETE FROM tbl_tarjetas WHERE idtarjeta='T3'");
  assert.deepEqual((await detailEvents('T3')).at(-1).type, 'credit_deleted');
  assert.equal((await detailEvents('T3')).at(-1).idcliente, 12);
});

test('rating service: scope, office/super guards, exact stale check, same score allowed, audit and sync', async () => {
  const superAdmin = ctx('Super Administrador', null);
  const officeAdmin = ctx('Administrador', ADMIN_EMPLOYEE, 21);
  const otherOfficeAdmin = ctx('Administrador', 88, 22);
  const collector = ctx('Cobrador', 55, 23);
  await db.query(`INSERT INTO tbl_auth_sucursal (idglobal,idsucursal,idempleado,str_estado) VALUES (${COMPANY},${BRANCH},55,'activo')`);
  await db.query(`INSERT INTO tbl_persona (idpersona,idglobal,str_nombres,str_apellidos) VALUES (1,${COMPANY},'Ana','Prueba'),(20,${COMPANY},'Beto','Prueba')`);

  assert.deepEqual(await service.customerRating(superAdmin, BRANCH, 10), {
    score: 5, rawRating: 'nuevo', label: 'Inicial · poca historia', canRate: true, automaticScore: 5,
    source: 'automatic', manualUntil: null, evaluatedAt: null, confidence: 'initial',
    explanation: 'Nota inicial neutral; evaluación matemática pendiente.', history: [] });
  const listed = await queries.customerById(superAdmin, BRANCH, 10);
  assert.deepEqual([listed.rating, listed.ratingSource, listed.ratingConfidence], ['nuevo', null, null]);
  assert.equal((await db.query('SELECT COUNT(*) AS n FROM mobile_customer_rating_state WHERE idcliente=10'))[0][0].n, 0,
    'reads persist nothing while automation is disabled');
  // Pre-014 numeric notes: active one (seeded state), expired one and one without history.
  const legacy30 = await service.customerRating(superAdmin, BRANCH, 30);
  assert.deepEqual([legacy30.score, legacy30.label, legacy30.source, legacy30.evaluatedAt],
    [7, 'Bueno', 'manual', null]);
  assert.match(legacy30.manualUntil, /Z$/);
  for (const customer of [31, 33]) {
    const legacy = await service.customerRating(superAdmin, BRANCH, customer);
    assert.deepEqual([legacy.rawRating, legacy.label, legacy.source, legacy.manualUntil, legacy.confidence, legacy.explanation],
      [String(customer === 31 ? 8 : 9), customer === 31 ? 'Bueno' : 'Excelente', 'manual', null, 'initial',
        'Nota anterior; evaluación matemática pendiente.']);
  }
  assert.equal((await service.customerRating(collector, BRANCH, 10)).canRate, false);
  assert.equal(await code(service.customerRating(superAdmin, OTHER_BRANCH, 10)), 'NOT_FOUND');
  assert.equal(await code(service.customerRating(collector, OTHER_BRANCH, 10)), 'FORBIDDEN');
  assert.equal(await code(service.customerRating(superAdmin, BRANCH, 11)), 'NOT_FOUND', 'customer without branch scope');
  assert.equal(await code(service.rateCustomer(collector, BRANCH, 10, 8, 'motivo válido', 'nuevo')), 'FORBIDDEN');
  assert.equal(await code(service.rateCustomer(otherOfficeAdmin, BRANCH, 10, 8, 'motivo válido', 'nuevo')), 'FORBIDDEN');
  assert.equal(await code(service.rateCustomer(superAdmin, BRANCH, 10, 8, 'motivo válido', 'nuevo ')), 'CONFLICT');
  assert.equal(await code(service.rateCustomer(superAdmin, BRANCH, 10, 11, 'motivo válido', 'nuevo')), 'VALIDATION_ERROR');
  assert.equal((await db.query('SELECT COUNT(*) AS n FROM mobile_customer_rating_history WHERE idcliente=10'))[0][0].n, 0);

  const syncBefore = await syncCount('customer', '10', 'UPDATE');
  const first = await service.rateCustomer(superAdmin, BRANCH, 10, 8, '  buen pagador  ', 'nuevo');
  assert.deepEqual([first.score, first.rawRating, first.label, first.canRate, first.source],
    [8, '8', 'Bueno', true, 'manual']);
  const until = Date.parse(first.manualUntil) - Date.now();
  assert.ok(until > 7 * 86400000 - 60000 && until <= 7 * 86400000, 'manual window is exactly 7 UTC days');
  const same = await service.rateCustomer(officeAdmin, BRANCH, 10, 8, 'confirmo la nota', '8');
  const last = await service.rateCustomer(officeAdmin, BRANCH, 10, 3, 'atrasos recientes', '8');
  assert.equal(same.history.length, 2);
  assert.equal(last.label, 'Requiere seguimiento');
  assert.deepEqual(last.history.map((h) => [h.score, h.previousScore, h.reason, h.source, h.createdBy]), [
    [3, 8, 'atrasos recientes', 'manual', 21], [8, 8, 'confirmo la nota', 'manual', 21],
    [8, null, 'buen pagador', 'manual', 9]]);
  for (const entry of last.history) assert.match(entry.createdAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  const [[stored]] = await db.query("SELECT str_calificacion AS rating FROM tbl_clientes WHERE idcliente=10");
  assert.equal(stored.rating, '3');
  const [[audit]] = await db.query('SELECT idglobal, idsucursal, COUNT(*) AS n FROM mobile_customer_rating_history WHERE idcliente=10 GROUP BY idglobal, idsucursal');
  assert.deepEqual(audit, { idglobal: COMPANY, idsucursal: BRANCH, n: 3 });
  // Each save: trg_mobile_cliente_au (str_calificacion) + trg_rating_state_* (manual_until changed).
  assert.equal(await syncCount('customer', '10', 'UPDATE'), syncBefore + 6, 'Node writes sync through both triggers');
  const manualListed = await queries.customerById(collector, BRANCH, 10);
  assert.deepEqual([manualListed.rating, manualListed.ratingSource, manualListed.ratingConfidence], ['3', 'manual', null]);
  assert.equal(last.evaluatedAt, null, 'pending evaluation stays explicit while automation is disabled');
  assert.equal(await code(service.rateCustomer(superAdmin, BRANCH, 10, 9, 'nota vieja del editor', '8')), 'CONFLICT');

  // A PHP-style manual save (same contract SQL, same lock order) also emits the customer sync event.
  await db.beginTransaction();
  await db.query('SELECT idcliente FROM tbl_clientes WHERE idglobal=1 AND idcliente=10 FOR UPDATE');
  await db.query(`INSERT INTO mobile_customer_rating_history (idglobal,idcliente,idsucursal,score,previous_score,reason,source,created_by,created_at)
    VALUES (1,10,${BRANCH},6,3,'ajuste desde la web','manual',21,UTC_TIMESTAMP(3))`);
  await db.execute(automation.MANUAL_STATE_UPSERT, [1, 10, 6]);
  await db.query("UPDATE tbl_clientes SET str_calificacion='6', update_at=NOW() WHERE idglobal=1 AND idcliente=10");
  await db.commit();
  assert.equal(await syncCount('customer', '10', 'UPDATE'), syncBefore + 8);
  const [[pending]] = await db.query(`SELECT automatic_score AS a, confidence, evaluated_at AS e, metrics_json AS m,
    next_evaluation_at <= UTC_TIMESTAMP(3) AS due FROM mobile_customer_rating_state WHERE idcliente=10`);
  assert.deepEqual([pending.a, pending.confidence, pending.e, pending.m, Number(pending.due)], [5, 'initial', null, null, 1],
    'manual save schedules an immediate evaluation');
  const php = await service.customerRating(collector, BRANCH, 10);
  assert.deepEqual([php.rawRating, php.score, php.source, php.canRate], ['6', 6, 'manual', false]);
  assert.equal((await db.query("SELECT COUNT(*) AS n FROM mobile_customer_rating_event WHERE event_type LIKE 'rating%'"))[0][0].n, 0);
});

const SETTINGS = () => ({ intervalMs: 5000, batch: 1000, weights: engine.DEFAULT_WEIGHTS, zone: 'America/Bogota' });
const ratingOf = async (customer) => (await db.execute(
  'SELECT str_calificacion AS raw FROM tbl_clientes WHERE idglobal=? AND idcliente=?', [COMPANY, customer]))[0][0].raw;
const autoHistory = async (customer) => (await db.execute(
  `SELECT score, previous_score AS previousScore, source, created_by AS createdBy, idsucursal
   FROM mobile_customer_rating_history WHERE idglobal=? AND idcliente=? AND source='automatic' ORDER BY id`,
  [COMPANY, customer]))[0];
const dbNowCivilDay = async () => {
  const [[row]] = await db.query("SELECT DATE_FORMAT(UTC_TIMESTAMP(),'%Y-%m-%dT%H:%i:%sZ') AS now");
  return engine.civilDay(new Date(row.now), 'America/Bogota');
};

// Inserts a credit created [startAgo] days ago, paid installment by installment on its due day.
async function seedCredit(id, customer, { mode, term, cents, startAgo, paidInstallments, close }) {
  await db.query(`INSERT INTO tbl_tarjetas (idtarjeta,idglobal,idsucursal,idcliente,dec_valor,dec_resta,int_tiempo,str_modo,str_estado,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,'saved',NOW() - INTERVAL ? DAY,NOW())`,
    [id, COMPANY, BRANCH, customer, (cents / 100).toFixed(2), (cents / 100).toFixed(2), term, mode, startAgo]);
  const today = await dbNowCivilDay();
  const due = engine.dueDays(mode, today - startAgo, paidInstallments).filter((day) => day < today);
  const each = cents / term;
  let index = 0;
  for (const day of due) {
    index += 1;
    await db.query(`INSERT INTO tbl_descripcion (iddescripcion,idglobal,idsucursal,idtarjeta,dec_abono,str_descripcion,str_estado,created_at,updated_at)
      VALUES (?,?,?,?,?,'Abono','created',NOW() - INTERVAL ? DAY,NOW())`,
      [`${id}-P${index}`, COMPANY, BRANCH, id, (-each / 100).toFixed(2), today - day]);
  }
  const balance = cents - Math.round(each) * due.length;
  await db.query('UPDATE tbl_tarjetas SET dec_resta=?, str_estado=? WHERE idtarjeta=?',
    [(balance / 100).toFixed(2), close && balance === 0 ? 'cancelado' : 'saved', id]);
}

test('worker: events, bootstrap of customers with credits, effective rating, audit without flood', async () => {
  await db.query(`INSERT INTO tbl_clientes (idcliente,idglobal,idpersona,str_calificacion) VALUES
    (20,${COMPANY},20,'nuevo'),(21,${COMPANY},21,'nuevo'),(22,${COMPANY},22,'')`);
  await seedCredit('G1', 20, { mode: 'Diario', term: 120, cents: 1200000, startAgo: 150, paidInstallments: 120, close: true });
  await seedCredit('L1', 22, { mode: 'Diario', term: 60, cents: 600000, startAgo: 50, paidInstallments: 10 });
  // 013-style manual note written without state after 014 (e.g. an old PHP build): bootstrap keeps it.
  await db.query(`INSERT INTO tbl_clientes (idcliente,idglobal,idpersona,str_calificacion) VALUES (34,${COMPANY},34,'6')`);
  await db.query(`INSERT INTO tbl_tarjetas (idtarjeta,idglobal,idsucursal,idcliente,dec_valor,dec_resta,int_tiempo,str_modo,str_estado,created_at,updated_at)
    VALUES ('C34',${COMPANY},${BRANCH},34,100.00,100.00,10,'Diario','saved',NOW() - INTERVAL 1 DAY,NOW())`);
  await db.query(`INSERT INTO mobile_customer_rating_history (idglobal,idcliente,idsucursal,score,previous_score,reason,source,created_by,created_at)
    VALUES (${COMPANY},34,${BRANCH},6,NULL,'nota sin estado','manual',21,UTC_TIMESTAMP(3) - INTERVAL 1 DAY)`);
  // Malformed legacy raw (' 7'): the engine replaces it explicitly instead of keeping it as "unrated".
  await db.query(`INSERT INTO tbl_clientes (idcliente,idglobal,idpersona,str_calificacion) VALUES (35,${COMPANY},35,' 7')`);
  await db.query(`INSERT INTO tbl_tarjetas (idtarjeta,idglobal,idsucursal,idcliente,dec_valor,dec_resta,int_tiempo,str_modo,str_estado,created_at,updated_at)
    VALUES ('C35',${COMPANY},${BRANCH},35,100.00,100.00,10,'Diario','saved',NOW() - INTERVAL 1 DAY,NOW())`);
  const sync20 = await syncCount('customer', '20', 'UPDATE');
  const messages = [];
  const first = await automation.runRatingTick(SETTINGS(), { bootstrapAfter: 0 }, (m) => messages.push(m));
  assert.deepEqual(messages, []);
  assert.equal(first.errors, 0);
  assert.ok(first.processed > 0);
  assert.equal((await db.query("SELECT COUNT(*) AS n FROM mobile_customer_rating_event WHERE state='pending'"))[0][0].n, 0);
  assert.equal(await ratingOf(20), '10');
  assert.ok(Number(await ratingOf(22)) <= 4, 'late customer requires follow-up');
  assert.equal(await ratingOf(21), 'nuevo', 'customer without credits stays initial, never an invented 10');
  assert.equal(await ratingOf(10), '6', 'active manual rating has priority over the engine');
  assert.equal(await ratingOf(30), '7', 'active 013 manual rating keeps its priority');
  const [[kept30]] = await db.query(`SELECT manual_score AS m, evaluated_at IS NOT NULL AS evaluated,
    manual_until = (SELECT created_at + INTERVAL 7 DAY FROM mobile_customer_rating_history WHERE reason='nota vigente') AS exact
    FROM mobile_customer_rating_state WHERE idcliente=30`);
  assert.deepEqual([kept30.m, Number(kept30.evaluated), Number(kept30.exact)], [7, 1, 1]);
  assert.equal((await autoHistory(30)).length, 0);
  assert.equal(await ratingOf(34), '6');
  const [[kept34]] = await db.query(`SELECT manual_score AS m, next_evaluation_at <= manual_until AS bounded,
    manual_until = (SELECT created_at + INTERVAL 7 DAY FROM mobile_customer_rating_history WHERE reason='nota sin estado') AS exact
    FROM mobile_customer_rating_state WHERE idcliente=34`);
  assert.deepEqual([kept34.m, Number(kept34.exact), Number(kept34.bounded)], [6, 1, 1]);
  assert.equal((await autoHistory(34)).length, 0);
  assert.equal(await ratingOf(35), 'nuevo');
  assert.deepEqual((await autoHistory(35)).map((h) => [h.score, h.previousScore, h.createdBy]), [[null, null, 0]]);
  for (const customer of [31, 32, 33]) {
    assert.equal(await ratingOf(customer), 'nuevo', `expired/replaced/historyless note ${customer} hands over`);
    assert.deepEqual((await autoHistory(customer)).map((h) => [h.score, h.createdBy]), [[null, 0]]);
  }
  assert.deepEqual((await autoHistory(20)).map((h) => [h.score, h.previousScore, h.createdBy, h.idsucursal]),
    [[10, null, 0, BRANCH]]);
  assert.equal((await autoHistory(10)).length, 0);
  assert.equal(await syncCount('customer', '20', 'UPDATE'), sync20 + 2, 'APK/web sync sees rating + source/confidence');
  const listed20 = await queries.customerById(ctx('Super Administrador', null), BRANCH, 20);
  assert.deepEqual([listed20.rating, listed20.ratingSource, listed20.ratingConfidence], ['10', 'automatic', 'established']);
  const sync = await queries.syncChanges(ctx('Super Administrador', null), BRANCH, '0', 500);
  const payload20 = sync.nodes.filter((n) => n.recordType === 'customer' && n.recordId === '20').at(-1).payload;
  assert.deepEqual([payload20.rating, payload20.ratingSource, payload20.ratingConfidence], ['10', 'automatic', 'established']);
  const sync21 = await syncCount('customer', '21', 'UPDATE');
  const [[state]] = await db.query(`SELECT automatic_score AS a, manual_score AS m, confidence, explanation,
    JSON_VALUE(metrics_json,'$.version') AS version, next_evaluation_at > UTC_TIMESTAMP(3) AS future
    FROM mobile_customer_rating_state WHERE idcliente=20`);
  assert.deepEqual([state.a, state.m, state.confidence, state.version, Number(state.future)], [10, null, 'established', '1', 1]);
  assert.match(state.explanation, /^Automática 10\/10, confianza establecida\. Puntualidad 100%/);

  const second = await automation.runRatingTick(SETTINGS(), { bootstrapAfter: 0 }, (m) => messages.push(m));
  assert.deepEqual([second.events, second.due, second.bootstrapped, second.errors], [0, 0, 0, 0]);
  assert.equal((await autoHistory(20)).length, 1, 'no history flood when nothing changed');
  assert.equal(await syncCount('customer', '20', 'UPDATE'), sync20 + 2, 'no sync flood when nothing visible changed');
  assert.equal(await syncCount('customer', '21', 'UPDATE'), sync21);

  // GraphQL read with automation enabled recomputes and returns the persisted explanation.
  process.env.CUSTOMER_RATING_AUTOMATION = '1';
  try {
    const read = await service.customerRating(ctx('Super Administrador', null), BRANCH, 20);
    assert.deepEqual([read.score, read.rawRating, read.label, read.source, read.automaticScore, read.confidence],
      [10, '10', 'Excelente', 'automatic', 10, 'established']);
    assert.match(read.evaluatedAt, /Z$/);
    // Manual priority for 7 days; the engine keeps evaluating underneath.
    const manual = await service.rateCustomer(ctx('Super Administrador', null), BRANCH, 20, 4, 'decisión de cartera', '10');
    assert.deepEqual([manual.score, manual.rawRating, manual.source, manual.automaticScore], [4, '4', 'manual', 10]);
    await db.query("UPDATE mobile_customer_rating_state SET next_evaluation_at=UTC_TIMESTAMP(3) - INTERVAL 1 SECOND WHERE idcliente=20");
    await automation.runRatingTick(SETTINGS(), { bootstrapAfter: null }, (m) => messages.push(m));
    assert.equal(await ratingOf(20), '4');
  } finally {
    delete process.env.CUSTOMER_RATING_AUTOMATION;
  }

  // Manual window expires (test-only clock shift): the engine takes over once, audited as automatic.
  await db.query(`UPDATE mobile_customer_rating_state SET manual_until=UTC_TIMESTAMP(3) - INTERVAL 1 SECOND,
    next_evaluation_at=UTC_TIMESTAMP(3) - INTERVAL 1 SECOND WHERE idcliente IN (10,20)`);
  const expiry = await automation.runRatingTick(SETTINGS(), { bootstrapAfter: null }, (m) => messages.push(m));
  assert.equal(expiry.due, 2);
  assert.equal(await ratingOf(20), '10');
  assert.deepEqual((await autoHistory(20)).map((h) => [h.score, h.previousScore, h.createdBy]), [[10, null, 0], [10, 4, 0]]);
  const expired = await queries.customerById(ctx('Super Administrador', null), BRANCH, 20);
  assert.deepEqual([expired.ratingSource, expired.ratingConfidence], ['automatic', 'established']);
  assert.equal(await ratingOf(10), 'nuevo', 'invalid credit data gives no automatic approval');
  assert.deepEqual((await autoHistory(10)).map((h) => [h.score, h.previousScore]), [[null, 6]]);
  const [[cleared]] = await db.query('SELECT manual_score AS m, manual_until AS u FROM mobile_customer_rating_state WHERE idcliente=20');
  assert.deepEqual(cleared, { m: null, u: null });
  const again = await automation.runRatingTick(SETTINGS(), { bootstrapAfter: null }, (m) => messages.push(m));
  assert.equal(again.due, 0);
  assert.equal((await autoHistory(20)).length, 2);

  // Same score, different source: manual 10 expires into automatic 10. str_calificacion does not
  // change, but the source switch is audited and synced (state trigger) so APK/web update the badge.
  process.env.CUSTOMER_RATING_AUTOMATION = '1';
  try {
    await service.rateCustomer(ctx('Super Administrador', null), BRANCH, 20, 10, 'confirmo excelente', '10');
  } finally {
    delete process.env.CUSTOMER_RATING_AUTOMATION;
  }
  assert.equal((await queries.customerById(ctx('Super Administrador', null), BRANCH, 20)).ratingSource, 'manual');
  const syncSwitch = await syncCount('customer', '20', 'UPDATE');
  await db.query(`UPDATE mobile_customer_rating_state SET manual_until=UTC_TIMESTAMP(3) - INTERVAL 1 SECOND,
    next_evaluation_at=UTC_TIMESTAMP(3) - INTERVAL 1 SECOND WHERE idcliente=20`);
  const syncExpired = await syncCount('customer', '20', 'UPDATE');
  await automation.runRatingTick(SETTINGS(), { bootstrapAfter: null }, (m) => messages.push(m));
  assert.equal(await ratingOf(20), '10');
  assert.equal(await syncCount('customer', '20', 'UPDATE'), syncExpired + 1, 'source switch with the same score syncs');
  assert.ok(syncExpired >= syncSwitch);
  assert.deepEqual((await autoHistory(20)).at(-1), { score: 10, previousScore: 10, source: 'automatic', createdBy: 0, idsucursal: BRANCH });
  const switched = await queries.customerById(ctx('Super Administrador', null), BRANCH, 20);
  assert.deepEqual([switched.rating, switched.ratingSource, switched.ratingConfidence], ['10', 'automatic', 'established']);
  const latest = (await queries.syncChanges(ctx('Super Administrador', null), BRANCH, '0', 500)).nodes
    .filter((n) => n.recordType === 'customer' && n.recordId === '20').at(-1).payload;
  assert.deepEqual([latest.rating, latest.ratingSource], ['10', 'automatic']);

  // A confidence change alone (same stored rating) also emits the customer sync event.
  const syncConfidence = await syncCount('customer', '20', 'UPDATE');
  await db.query("UPDATE mobile_customer_rating_state SET confidence='limited' WHERE idcliente=20");
  assert.equal(await syncCount('customer', '20', 'UPDATE'), syncConfidence + 1);
  await db.query("UPDATE mobile_customer_rating_state SET evaluated_at=UTC_TIMESTAMP(3) WHERE idcliente=20");
  assert.equal(await syncCount('customer', '20', 'UPDATE'), syncConfidence + 1, 'refresh without visible change: no sync');
  assert.deepEqual(messages, []);
});

test('worker failures are explicit: rollback, attempts, last_error, failed after 5 attempts', async () => {
  await db.query(`INSERT INTO tbl_clientes (idcliente,idglobal,idpersona,str_calificacion) VALUES (23,${COMPANY},23,'nuevo')`);
  // Test-only trigger in the temporary database to force a failure while persisting customer 23.
  await db.query(`CREATE TRIGGER tmp_fail_state BEFORE INSERT ON mobile_customer_rating_state FOR EACH ROW
    IF NEW.idcliente=23 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='fallo forzado de prueba'; END IF`);
  await db.query(`INSERT INTO mobile_customer_rating_event (idglobal,idcliente,idsucursal,event_type,source_record_id,occurred_at)
    VALUES (${COMPANY},23,${BRANCH},'credit_changed','TX',UTC_TIMESTAMP(3))`);
  const messages = [];
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const stats = await automation.runRatingTick(SETTINGS(), { bootstrapAfter: null }, (m) => messages.push(m));
    assert.equal(stats.errors, 1);
    const [[event]] = await db.query("SELECT state, attempts, last_error AS error FROM mobile_customer_rating_event WHERE source_record_id='TX'");
    assert.deepEqual([event.state, event.attempts, event.error], [attempt < 5 ? 'pending' : 'failed', attempt, 'fallo forzado de prueba']);
  }
  assert.equal(messages.length, 5);
  for (const message of messages) {
    assert.match(message, /fallo forzado de prueba/);
    assert.ok(!message.includes(server.password));
  }
  const [[row]] = await db.query(`SELECT (SELECT COUNT(*) FROM mobile_customer_rating_state WHERE idcliente=23) AS states,
    (SELECT str_calificacion FROM tbl_clientes WHERE idcliente=23) AS raw`);
  assert.deepEqual(row, { states: 0, raw: 'nuevo' });
  await db.query('DROP TRIGGER tmp_fail_state');
});
