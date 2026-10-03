// Explicit local-only migration/verification. Never part of npm test or startup.
// Usage: node tests/customer-phones.local.mjs <verified-local-container-hostname> [--apply] [--apply-usage] [--apply-validity]
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pool } from '../dist/db.js';
import { normalizePhone } from '../dist/services/phones.js';
import { randomUUID } from 'node:crypto';
import { applyOfflineOperation } from '../dist/services/operations.js';
import { customerById, syncChanges } from '../dist/services/queries.js';

const conn = await pool.getConnection();
try {
  const [target] = await conn.query('SELECT DATABASE() AS db,@@hostname AS host');
  assert.equal(target[0].db, 'websdnco_db_webgoez', 'Only the development database is allowed');
  assert.ok(process.argv[2], 'Pass the hostname obtained directly from webgoez-mariadb10');
  assert.equal(target[0].host, process.argv[2], 'Not the verified local MariaDB container');
  if (process.argv.includes('--apply-validity')) {
    const migration = await readFile(new URL('../migrations/009_customer_phone_validity.sql', import.meta.url), 'utf8');
    for (let run = 0; run < 2; run++) {
      let delimiter = ';', buffer = '';
      for (const line of migration.split('\n')) {
        if (line.startsWith('--')) continue;
        if (line.startsWith('DELIMITER ')) { delimiter = line.slice(10).trim(); continue; }
        buffer += line + '\n';
        if (buffer.trimEnd().endsWith(delimiter)) {
          await conn.query(buffer.trimEnd().slice(0, -delimiter.length));
          buffer = '';
        }
      }
      assert.equal(buffer.trim(), '');
    }
    console.log('Migration 009 applied twice successfully to the verified LOCAL container.');
  }
  if (process.argv.includes('--apply-usage')) {
    const migration = await readFile(new URL('../migrations/008_whatsapp_open_usage.sql', import.meta.url), 'utf8');
    const statements = migration.split('\n').filter(line => !line.startsWith('--')).join('\n')
      .split(';').map(sql => sql.trim()).filter(Boolean);
    for (let run = 0; run < 2; run++) for (const sql of statements) await conn.query(sql);
    console.log('Migration 008 applied twice successfully to the verified LOCAL container.');
  }
  if (process.argv.includes('--apply')) {
    const migration = await readFile(new URL('../migrations/007_customer_phones.sql', import.meta.url), 'utf8');
    async function apply() {
      let delimiter = ';';
      let buffer = '';
      for (const line of migration.split('\n')) {
        if (line.startsWith('--')) continue;
        if (line.startsWith('DELIMITER ')) { delimiter = line.slice(10).trim(); continue; }
        buffer += line + '\n';
        if (buffer.trimEnd().endsWith(delimiter)) {
          await conn.query(buffer.trimEnd().slice(0, -delimiter.length));
          buffer = '';
        }
      }
      assert.equal(buffer.trim(), '');
    }
    await apply();
    await apply();
    console.log('Migration 007 applied twice successfully to the verified LOCAL container.');
  }
  const [triggers] = await conn.query(
    `SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE()
     AND TRIGGER_NAME IN ('trg_mobile_phone_ai','trg_mobile_phone_au','trg_mobile_persona_ai','trg_mobile_persona_au')`
  );
  assert.equal(triggers.length, 4, 'Phone and existing sync triggers must coexist');
  for (const raw of ['3000000001', '+57 300 000 0001', '00573000000001',
    '+1 202 555 0100', '300123 / 310123', 'abc3000000001', '570000000001', '']) {
    const [normalized] = await conn.query('SELECT mobile_normalize_phone(?) AS phone', [raw]);
    assert.equal(normalized[0].phone, normalizePhone(raw), 'SQL and Node normalization differ');
  }
  const fixture = -2000000007;
  const [before] = await conn.query(
    `SELECT (SELECT COUNT(*) FROM tbl_persona WHERE idpersona=?) +
            (SELECT COUNT(*) FROM mobile_customer_phone WHERE idglobal=?) AS count`,
    [fixture, fixture]
  );
  assert.equal(Number(before[0].count), 0, 'Fixture ID is occupied; refusing to touch existing data');
  await conn.beginTransaction();
  try {
    await conn.query(
      `INSERT INTO tbl_persona
       (idpersona,idglobal,str_nombres,str_apellidos,str_sexo,str_tipo_documento,str_num_documento,
        str_telefono,str_email,str_foto,str_ocupacion,str_estado,str_nota,str_email_verificado,
        str_direccion_departamento,str_direccion_ciudad,str_direccion_barrio,str_direccion_calle)
       VALUES (?,?,'PHONE TEST','FIXTURE','','TEST','PHONE-MIGRATION-007',
               '300123 / 310123','','','','activo','','','','','','')`,
      [fixture, fixture]
    );
    for (const raw of ['3000000001', '573000000002', '573000000001']) {
      await conn.query('UPDATE tbl_persona SET str_telefono=? WHERE idglobal=? AND idpersona=?', [raw, fixture, fixture]);
    }
    const [history] = await conn.query(
      'SELECT raw_phone,normalized_phone FROM mobile_customer_phone WHERE idglobal=? AND idpersona=?',
      [fixture, fixture]
    );
    assert.equal(history.length, 3, 'Old, new, and legacy values must be retained without duplicates');
    assert.ok(history.some(p => p.normalized_phone === null));
    assert.ok(history.some(p => p.normalized_phone === '573000000001'));
    assert.ok(history.some(p => p.normalized_phone === '573000000002'));
    const [primary] = await conn.query('SELECT str_telefono FROM tbl_persona WHERE idglobal=? AND idpersona=?', [fixture, fixture]);
    assert.equal(primary[0].str_telefono, '573000000001');
  } finally {
    await conn.rollback();
  }
  const [remaining] = await conn.query(
    `SELECT (SELECT COUNT(*) FROM tbl_persona WHERE idpersona=?) +
            (SELECT COUNT(*) FROM mobile_customer_phone WHERE idglobal=?) AS count`,
    [fixture, fixture]
  );
  assert.equal(Number(remaining[0].count), 0, 'Fixture cleanup failed');
  console.log('Triggers, legacy retention, normalized uniqueness, primary switching, and rollback verified.');
  await verifyUsage();
} finally {
  conn.release();
  await pool.end();
}

async function verifyUsage() {
  // These fixtures must commit so real operations using independent connections can see them.
  // All belong to an otherwise empty synthetic company, and are removed in finally.
  const company = -2000000008;
  const employeeA = company, employeeB = company + 1;
  const [occupied] = await conn.query(
    `SELECT (SELECT COUNT(*) FROM tbl_persona WHERE idglobal=?) +
            (SELECT COUNT(*) FROM tbl_clientes WHERE idglobal=?) +
            (SELECT COUNT(*) FROM tbl_sucursal WHERE idglobal=?) +
            (SELECT COUNT(*) FROM tbl_auth_sucursal WHERE idglobal=?) +
            (SELECT COUNT(*) FROM mobile_customer_phone WHERE idglobal=?) +
            (SELECT COUNT(*) FROM mobile_change_event WHERE idglobal=?) +
            (SELECT COUNT(*) FROM mobile_operation WHERE idglobal=?) +
            (SELECT COUNT(*) FROM tbl_empleado WHERE idglobal=? OR idempleado IN (?,?)) +
            (SELECT COUNT(*) FROM tbl_persona WHERE idpersona IN (?,?)) AS count`,
    [...Array(8).fill(company), employeeA, employeeB, employeeA, employeeB]
  );
  assert.equal(Number(occupied[0].count), 0, 'Usage fixture company is occupied');
  const context = employee => ({ user: {
    userId: employee, companyId: company, employeeId: employee, cargo: 'Cobrador',
    employeeMaxCredit: '0', username: 'PHONE-TEST', firstName: 'TEST', lastName: 'FIXTURE', companyName: 'FIXTURE'
  }, permissions: [] });
  try {
    await conn.beginTransaction();
    for (const employee of [employeeA, employeeB]) {
      await conn.query(
        `INSERT INTO tbl_persona
         (idpersona,idglobal,str_nombres,str_apellidos,str_sexo,str_tipo_documento,str_num_documento,
          str_telefono,str_email,str_foto,str_ocupacion,str_estado,str_nota,str_email_verificado,
          str_direccion_departamento,str_direccion_ciudad,str_direccion_barrio,str_direccion_calle)
         VALUES (?,?,'COLLECTOR TEST','FIXTURE','','TEST',?,'','','','','activo','','','','','','')`,
        [employee, company, `PHONE-COLLECTOR-${employee}`]
      );
      await conn.query(
        `INSERT INTO tbl_empleado
         (idempleado,idglobal,idpersona,str_apodo,str_cargo,str_estado,str_comentarios,date_fecha_inicio,idoficina,dec_max_credito)
         VALUES (?,?,?,'','Cobrador','activo','','2026-10-02',?,0)`, [employee, company, employee, company]
      );
    }
    const branches = [];
    for (let i = 0; i < 3; i++) {
      const [inserted] = await conn.query(
        `INSERT INTO tbl_sucursal
         (idglobal,str_tipo,str_codigo,str_telefono,idempleado,str_logo,str_estado,idoficina)
         VALUES (?,'ruta','PHONE-TEST','',?,'','activo',?)`, [company, employeeA, company]
      );
      branches.push(inserted.insertId);
      for (const employee of i === 2 ? [employeeB] : [employeeA, employeeB]) {
        await conn.query(
          `INSERT INTO tbl_auth_sucursal (idglobal,idsucursal,idempleado,tipo_usuario,str_estado)
           VALUES (?,?,?,'empleado','activo')`, [company, inserted.insertId, employee]
        );
      }
    }
    const [person] = await conn.query(
      `INSERT INTO tbl_persona
       (idglobal,str_nombres,str_apellidos,str_sexo,str_tipo_documento,str_num_documento,
        str_telefono,str_email,str_foto,str_ocupacion,str_estado,str_nota,str_email_verificado,
        str_direccion_departamento,str_direccion_ciudad,str_direccion_barrio,str_direccion_calle)
       VALUES (?,'PHONE TEST','FIXTURE','','TEST','PHONE-USAGE-008',
               '3000000001','','','','activo','','','','','','')`, [company]
    );
    const [customer] = await conn.query(
      `INSERT INTO tbl_clientes
       (idglobal,idpersona,dec_max_credito,str_apodo,str_nota,str_estado,str_calificacion,created_empleado_id)
       VALUES (?,?,0,'','','activo','',?)`, [company, person.insertId, employeeA]
    );
    await conn.commit();
    const id = String(customer.insertId), branchId = branches[0];
    const [cursor] = await conn.query(
      'SELECT CAST(COALESCE(MAX(id),0) AS CHAR) AS `cursor` FROM mobile_change_event WHERE idglobal=? AND idsucursal=?',
      [company, branchId]
    );
    const apply = (kind, telefono, options = {}, auth = context(employeeA)) => applyOfflineOperation(auth, {
      operationId: randomUUID(), branchId, entityId: id, kind,
      baseVersion: cursor[0].cursor, payload: { telefono }, ...options
    });
    const added = await apply('ADD_CUSTOMER_PHONE', '573000000002');
    assert.equal(added.data.phone, '573000000002', 'Phone addition must work with no named permission');
    const selected = await apply('SELECT_CUSTOMER_PHONE', '573000000001', { baseVersion: added.eventCursor });
    assert.equal(selected.data.phone, '573000000001', 'Phone selection must work with no named permission');
    const firstOpenId = randomUUID();
    const opened = await apply('RECORD_WHATSAPP_OPEN', '573000000002', {
      operationId: firstOpenId, baseVersion: null
    });
    const replay = await apply('RECORD_WHATSAPP_OPEN', '573000000002', {
      operationId: firstOpenId, baseVersion: null
    });
    assert.equal(replay.replayed, true);
    assert.deepEqual(replay.data, opened.data);
    assert.equal(replay.data.phones.find(p => p.normalizedPhone === '573000000002').whatsappOpenCount, '1');
    await apply('RECORD_WHATSAPP_OPEN', '573000000002', { baseVersion: '0', branchId: branches[1] }, context(employeeB));
    const shared = await customerById(context(employeeB), branches[1], customer.insertId);
    const ranked = shared.phones.find(p => p.normalizedPhone === '573000000002');
    assert.equal(ranked.whatsappOpenCount, '2', 'Both collectors and branches must share the counter');
    assert.ok(ranked.whatsappLastOpenedAt);
    assert.equal(shared.phone, '573000000001', 'Recipient selection must not change primary');
    const sync = await syncChanges(context(employeeB), branches[1], '0', 100);
    assert.ok(sync.nodes.some(event => event.recordType === 'customer' &&
      event.payload.phones?.some(p => p.normalizedPhone === '573000000002' && p.whatsappOpenCount === '2')));
    // Usage events must not invalidate a subsequent phone edit's previous edit version.
    const lastSelection = await apply('SELECT_CUSTOMER_PHONE', '573000000002', { baseVersion: selected.eventCursor });
    const validity = (phone, invalid, baseVersion, auth = context(employeeB), extra = {}) =>
      apply('SET_CUSTOMER_PHONE_VALIDITY', phone, {
        branchId: branches[1], baseVersion, payload: { telefono: phone, invalid }, ...extra
      }, auth);
    await assert.rejects(validity('573000000002', true, lastSelection.eventCursor),
      error => error.extensions?.code === 'VALIDATION_ERROR' && /Selecciona primero otro teléfono principal/.test(error.message));
    const incorrect = await validity('573000000001', true, lastSelection.eventCursor);
    const archived = incorrect.data.phones.find(p => p.normalizedPhone === '573000000001');
    assert.equal(archived.invalid, true);
    assert.equal(archived.validityChangedBy, String(employeeB), 'Any authorized user can correct, including a different collector');
    assert.ok(archived.validityChangedAt);
    const repeat = await validity('573000000001', true, incorrect.eventCursor, context(employeeA));
    assert.deepEqual(repeat.data.phones.find(p => p.normalizedPhone === '573000000001'), archived,
      'Idempotent assignments must not change audit actor or timestamp');
    for (const kind of ['ADD_CUSTOMER_PHONE', 'SELECT_CUSTOMER_PHONE', 'RECORD_WHATSAPP_OPEN']) {
      await assert.rejects(apply(kind, '573000000001', { baseVersion: repeat.eventCursor }),
        { extensions: { code: 'VALIDATION_ERROR' } });
    }
    // A legacy form may choose an incorrect primary. Its trigger must not restore validity.
    await conn.query('UPDATE tbl_persona SET str_telefono=? WHERE idglobal=? AND idpersona=?',
      ['3000000001', company, person.insertId]);
    const legacy = await customerById(context(employeeB), branches[1], customer.insertId);
    assert.equal(legacy.phones.find(p => p.normalizedPhone === '573000000001').invalid, true);
    const [newCursor] = await conn.query(
      'SELECT CAST(MAX(id) AS CHAR) AS `cursor` FROM mobile_change_event WHERE idglobal=?', [company]);
    const restorationId = randomUUID();
    const restored = await validity('573000000001', false, newCursor[0].cursor, context(employeeA),
      { operationId: restorationId });
    assert.equal(restored.data.phones.find(p => p.normalizedPhone === '573000000001').invalid, false);
    assert.equal(restored.data.phones.find(p => p.normalizedPhone === '573000000001').validityChangedBy, String(employeeA));
    const restoredReplay = await validity('573000000001', false, newCursor[0].cursor, context(employeeA),
      { operationId: restorationId });
    assert.equal(restoredReplay.replayed, true);
    await assert.rejects(validity('573000000009', true, restored.eventCursor),
      { extensions: { code: 'NOT_FOUND' } });
    await assert.rejects(validity('573000000002', true, restored.eventCursor, context(employeeA),
      { branchId: branches[2] }), { extensions: { code: 'FORBIDDEN' } });
    await assert.rejects(validity('573000000002', true, restored.eventCursor, context(employeeB),
      { branchId: branches[2] }), { extensions: { code: 'NOT_FOUND' } });
    await assert.rejects(validity('573000000002', true, '0'),
      error => error.extensions?.code === 'CONFLICT' &&
        error.extensions.currentRecord.phones.every(p => !p.invalid));
    const phoneSync = await syncChanges(context(employeeB), branches[1], '0', 100);
    assert.ok(phoneSync.nodes.some(e => e.payload?.phones?.some(p => p.validityChangedBy === String(employeeA))));
    console.log('Validity: authorized non-creator mark/restore, audit/idempotency/receipt, primary guard, legacy trigger retention, archived add/select/usage rejection, unknown phone, conflict and cross-branch sync verified.');
    for (const kind of ['ADD_CUSTOMER_PHONE', 'SELECT_CUSTOMER_PHONE', 'RECORD_WHATSAPP_OPEN']) {
      await assert.rejects(apply(kind, '573000000001', { branchId: branches[2] }),
        { extensions: { code: 'FORBIDDEN' } });
      await assert.rejects(apply(kind, '573000000001', { branchId: branches[2] }, context(employeeB)),
        { extensions: { code: 'NOT_FOUND' } });
      await assert.rejects(apply(kind, '573000000001', {}, {
        ...context(employeeA), user: { ...context(employeeA).user, companyId: company - 1 }
      }), { extensions: { code: 'FORBIDDEN' } });
    }
    await assert.rejects(apply('RECORD_WHATSAPP_OPEN', '573000000009', { baseVersion: null }),
      { extensions: { code: 'NOT_FOUND' } });
    await assert.rejects(applyOfflineOperation(context(employeeA), {
      operationId: randomUUID(), branchId, entityId: id, kind: 'UPDATE_DOCUMENT',
      baseVersion: selected.eventCursor, payload: { tipoDocumento: 'TEST', numeroDocumento: 'BLOCKED' }
    }), { extensions: { code: 'FORBIDDEN' } });
    console.log('Real operations: permission exception, shared usage, replay increments once, branch/company isolation, sync, primary independence and edit-version isolation verified.');
  } finally {
    await conn.rollback();
    await conn.beginTransaction();
    try {
      for (const table of ['tbl_clientes', 'tbl_auth_sucursal', 'tbl_sucursal', 'tbl_empleado', 'tbl_persona',
        'mobile_customer_phone', 'mobile_operation', 'mobile_change_event']) {
        await conn.query(`DELETE FROM ${table} WHERE idglobal=?`, [company]);
      }
      await conn.commit();
    } catch (error) { await conn.rollback(); throw error; }
    const [remaining] = await conn.query(
      `SELECT ${['tbl_clientes', 'tbl_persona', 'tbl_auth_sucursal', 'tbl_sucursal', 'tbl_empleado',
        'mobile_customer_phone', 'mobile_operation', 'mobile_change_event']
        .map(table => `(SELECT COUNT(*) FROM ${table} WHERE idglobal=?)`).join('+')} AS count`,
      Array(8).fill(company)
    );
    assert.equal(Number(remaining[0].count), 0, 'Committed fixture cleanup failed');
    console.log('Committed operation fixtures removed; no customer data retained.');
  }
}
