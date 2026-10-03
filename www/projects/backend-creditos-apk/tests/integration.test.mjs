import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const required = ['RUN_DB_INTEGRATION', 'TEST_DB_HOST', 'TEST_DB_NAME', 'TEST_DB_USER', 'TEST_DB_PASSWORD'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  throw new Error(`Refusing database integration test without explicit test DB settings: ${missing.join(', ')}`);
}
if (process.env.RUN_DB_INTEGRATION !== '1') {
  throw new Error('Set RUN_DB_INTEGRATION=1 to permit the explicitly configured test database check');
}

process.env.DB_HOST = process.env.TEST_DB_HOST;
process.env.DB_PORT = process.env.TEST_DB_PORT || '3306';
process.env.DB_USER = process.env.TEST_DB_USER;
process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD;
process.env.DB_NAME = process.env.TEST_DB_NAME;

const { pool } = await import('../dist/db.js');

test('explicit test database has the migration and confirmed legacy tables', async () => {
  const connection = await pool.getConnection();
  try {
      const [databaseRows] = await connection.query('SELECT DATABASE() AS name');
      assert.equal(databaseRows[0].name, process.env.TEST_DB_NAME);
      const [tables] = await connection.execute(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = ? AND table_name IN
          ('tbl_usuario','tbl_persona','tbl_clientes','tbl_tarjetas','tbl_descripcion',
           'tbl_auth_sucursal','mobile_operation','mobile_change_event','mobile_change_lock')`,
        [process.env.TEST_DB_NAME],
      );
      assert.equal(tables.length, 9, 'Test schema must contain the legacy API tables and applied migration');
      const [views] = await connection.execute(
        `SELECT table_name FROM information_schema.views
         WHERE table_schema=? AND table_name IN ('mobile_customer_branch','mobile_comment_branch')`,
        [process.env.TEST_DB_NAME],
      );
      assert.equal(views.length, 2, 'Test schema must contain the scoped materialization views');
      const [triggers] = await connection.execute(
        `SELECT trigger_name FROM information_schema.triggers
         WHERE trigger_schema=? AND trigger_name LIKE 'trg_mobile_%'`,
        [process.env.TEST_DB_NAME],
      );
      assert.equal(triggers.length, 32, 'Test schema must contain the complete change-capture trigger set');
    } finally {
      connection.release();
    }
});

test('concurrent duplicate operation IDs serialize to one committed receipt', async () => {
  const first = await pool.getConnection();
  const second = await pool.getConnection();
  const operationId = randomUUID();
  const userId = 2_147_483_646;
  const companyId = 2_147_483_645;
  let transactionOpen = false;
  try {
    await first.beginTransaction();
    transactionOpen = true;
    await first.execute(
      `INSERT INTO mobile_operation
       (operation_id,idusuario,idglobal,operation_kind,entity_id,payload_hash,state,created_at)
       VALUES (?,?,?,'CREATE_PAYMENT','integration-test',?,'processing',NOW())`,
      [operationId, userId, companyId, 'a'.repeat(64)],
    );
    const competingInsert = second.execute(
      `INSERT INTO mobile_operation
       (operation_id,idusuario,idglobal,operation_kind,entity_id,payload_hash,state,created_at)
       VALUES (?,?,?,'CREATE_PAYMENT','integration-test',?,'processing',NOW())`,
      [operationId, userId, companyId, 'a'.repeat(64)],
    ).then(() => null, (error) => error);
    await first.execute(
      `UPDATE mobile_operation SET result_json=?,state='complete',completed_at=NOW()
       WHERE operation_id=? AND idusuario=? AND idglobal=?`,
      ['{"status":"applied"}', operationId, userId, companyId],
    );
    await first.commit();
    transactionOpen = false;
    const duplicateError = await competingInsert;
    assert.equal(duplicateError?.code, 'ER_DUP_ENTRY');
    const [rows] = await second.execute(
      `SELECT payload_hash,result_json,state FROM mobile_operation
       WHERE operation_id=? AND idusuario=? AND idglobal=?`,
      [operationId, userId, companyId],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].payload_hash, 'a'.repeat(64));
    assert.equal(rows[0].result_json, '{"status":"applied"}');
    assert.equal(rows[0].state, 'complete');
  } finally {
    if (transactionOpen) await first.rollback();
    await first.execute(
      'DELETE FROM mobile_operation WHERE operation_id=? AND idusuario=? AND idglobal=?',
      [operationId, userId, companyId],
    );
    first.release();
    second.release();
  }
});

after(async () => {
  await pool.end();
});
