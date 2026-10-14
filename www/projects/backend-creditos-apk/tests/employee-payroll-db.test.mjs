import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import mysql from 'mysql2/promise';
import 'dotenv/config';
import { spawnSync } from 'node:child_process';

export function sqlStatements(text) {
  let delimiter = ';', buffer = '', statements = [];
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('--')) continue;
    if (/^DELIMITER /i.test(line)) { delimiter = line.trim().slice(10); continue; }
    buffer += line + '\n';
    if (buffer.trimEnd().endsWith(delimiter)) {
      statements.push(buffer.trimEnd().slice(0, -delimiter.length).trim()); buffer = '';
    }
  }
  if (buffer.trim()) throw new Error('Unterminated SQL');
  return statements;
}

test('isolated shared SQL payroll: periods, snapshots, payments, vacation, actors and idempotency', async (t) => {
  for (const key of ['PAYROLL_TEST_DB_HOST', 'PAYROLL_TEST_DB_USER', 'PAYROLL_TEST_DB_PASSWORD']) {
    if (process.env[key] === undefined) throw new Error(`Explicit isolated DB credentials required: ${key}`);
  }
  const connection = await mysql.createConnection({
    host: process.env.PAYROLL_TEST_DB_HOST, port: Number(process.env.PAYROLL_TEST_DB_PORT ?? 3306),
    user: process.env.PAYROLL_TEST_DB_USER, password: process.env.PAYROLL_TEST_DB_PASSWORD,
    dateStrings: true, decimalNumbers: true,
  });
  const db = `payroll_test_${process.pid}_${Date.now()}`;
  let created = false;
  try {
    await connection.query(`CREATE DATABASE \`${db}\``); created = true;
    await connection.query(`USE \`${db}\``);
    for (const path of ['tests/fixtures/employee-payroll.sql', 'migrations/015_employee_payroll.sql']) {
      for (const statement of sqlStatements(await fs.readFile(path, 'utf8'))) await connection.query(statement);
    }
    const today = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
    const contract = (employeeId, effectiveDate = '2026-01-01', type = 'Combinado', frequency = 'Mensual', base = 100) =>
      connection.execute(`INSERT INTO tbl_employee_payroll_contract
        (idglobal,employee_id,effective_date,salary_type,frequency,base_amount,capital_rate,collection_rate,actor_user_id)
        VALUES(1,?,?,?,?,?,10,20,1)`, [employeeId, effectiveDate, type, frequency, base]);
    const summary = async (employeeId, date) => (await connection.query('CALL sp_employee_payroll_summary(1,?,?)', [employeeId, date]))[0][0][0];
    const change = async (actor, action, input, company = 1) =>
      (await connection.query('CALL sp_employee_payroll_change(?,?,?,?)', [company, actor, action, JSON.stringify(input)]))[0][0][0];
    await contract(3); await contract(4, '2026-01-01', 'Porcentaje', 'Mensual', 0);
    await connection.query("INSERT INTO tbl_detalle_ruta(iddetalleruta,idglobal,idsucursal,created_at) VALUES(1,1,1,'2026-02-01'),(2,1,2,'2026-02-02')");
    await connection.query("INSERT INTO tbl_empleados_cobrando VALUES(3,1),(4,1),(3,2)");
    await connection.query('CALL sp_employee_payroll_snapshot(1,1)');
    await connection.query('CALL sp_employee_payroll_snapshot(1,2)');
    await connection.query('CALL sp_employee_payroll_snapshot(1,1)');
    await connection.query(`INSERT INTO tbl_tarjetas VALUES
      ('principal',1,1,1000,1400,'Prestamo','2026-02-02'),
      ('route2',1,2,500,700,'Prestamo','2026-02-04'),
      ('reverse',1,1,-100,0,'Prestamo','2026-02-05')`);
    await connection.query(`INSERT INTO tbl_descripcion VALUES
      ('cash',1,1,-500,'Abono','2026-02-03'),
      ('reverse',1,1,50,'Abono reverso','2026-02-04'),
      ('discount',1,1,-200,'Descuento','2026-02-03'),
      ('adjustment',1,1,-200,'Intereses ajuste','2026-02-03')`);
    await connection.query("INSERT INTO tbl_descripcion_pago VALUES(1,'cash',50),(1,'cash',50),(2,'cash',999)");
    await connection.query("INSERT INTO tbl_contabilidad_detalle VALUES('payment',1,'2026-02-05',-80,2),('refund',1,'2026-02-06',10,2),('unlinked',1,'2026-02-06',-900,2)");
    await connection.query("INSERT INTO tbl_detalle_nomina VALUES(1,1,'payment'),(1,1,'payment'),(1,1,'refund'),(2,1,'payment')");
    await t.test('two routes, principal not interest, cash excluding bank, signs and duplicate payments', async () => {
      const s = await summary(3, '2026-02-28');
      assert.equal(s.baseAmount, 100); assert.equal(s.capitalCommission, 140);
      assert.equal(s.collectionCommission, 70); assert.equal(s.earnedAmount, 210);
      assert.equal(s.paidAmount, 70); assert.equal(s.pendingAmount, 140);
      assert.equal((await summary(4, '2026-02-28')).earnedAmount, 0);
      assert.equal((await connection.query('SELECT COUNT(*) n FROM tbl_employee_payroll_snapshot'))[0][0].n, 2);
    });
    await t.test('vacation keeps base but excludes only dated movements; no reassignment', async () => {
      await connection.query("INSERT INTO tbl_employee_payroll_vacation(idglobal,employee_id,start_date,end_date,reason,actor_user_id) VALUES(1,3,'2026-02-02','2026-02-03','test',1)");
      const s = await summary(3, '2026-02-28');
      assert.equal(s.capitalCommission, 40); assert.equal(s.collectionCommission, -10);
      const [detail] = await connection.query("SELECT * FROM view_employee_payroll_breakdown WHERE employeeId=3 AND movementDate='2026-02-02'");
      assert.equal(detail[0].excludedReason, 'VACATION');
      assert.equal(detail[0].capitalCommission, 0);
      assert.equal(detail[0].rawCapitalCommission, 100);
      assert.equal(s.earnedAmount, 100);
      assert.equal((await summary(4, '2026-02-28')).earnedAmount, 0);
      await connection.query('DELETE FROM tbl_employee_payroll_vacation');
    });
    await t.test('calendar boundaries and leap February', async () => {
      for (const [frequency, asOf, start, end] of [
        ['Diario', '2026-02-28', '2026-02-28', '2026-02-28'],
        ['Semanal', '2026-03-01', '2026-02-23', '2026-03-01'],
        ['Quincenal', '2026-02-15', '2026-02-01', '2026-02-15'],
        ['Quincenal', '2026-02-16', '2026-02-16', '2026-02-28'],
        ['Mensual', '2028-02-29', '2028-02-01', '2028-02-29'],
      ]) {
        await connection.execute('UPDATE tbl_employee_payroll_contract SET frequency=? WHERE employee_id=4', [frequency]);
        const s = await summary(4, asOf); assert.equal(s.startDate, start); assert.equal(s.endDate, end);
      }
    });
    await t.test('prospective date versions, mid-period base, frequency changes and fixed snapshots', async () => {
      await contract(1, '2026-02-01', 'Fijo', 'Mensual', 280);
      await contract(1, '2026-02-16', 'Fijo', 'Mensual', 560);
      assert.equal((await summary(1, '2026-02-15')).baseAmount, 150);
      assert.equal((await summary(1, '2026-02-15')).periodBaseAmount, 280);
      assert.equal((await summary(1, '2026-02-15')).agreedBaseAmount, 280);
      assert.equal((await summary(1, '2026-02-16')).baseAmount, 170);
      assert.equal((await summary(3, '2026-02-01')).baseAmount, 3.57);
      assert.equal((await summary(3, '2026-02-01')).earnedAmount, 3.57);
      assert.equal((await summary(3, '2026-02-02')).baseAmount, 7.14);
      assert.equal((await summary(3, '2026-02-02')).earnedAmount, 100);
      // Vacation suspends only newly dated commissions, not calendar accrual.
      await connection.query("INSERT INTO tbl_employee_payroll_vacation(idglobal,employee_id,start_date,end_date,reason,actor_user_id) VALUES(1,1,'2026-02-01','2026-02-15','test',1)");
      assert.equal((await summary(1, '2026-02-10')).baseAmount, 100);
      assert.equal((await summary(1, '2026-02-28')).baseAmount, 410);
      await contract(2, '2026-02-16', 'Fijo', 'Mensual', 280);
      assert.equal((await summary(2, '2026-02-28')).baseAmount, 130);
      await contract(1, '2026-03-04', 'Fijo', 'Semanal', 70);
      // Mon/Tue use the former monthly contract, Wed-Sun the weekly one.
      assert.equal((await summary(1, '2026-03-08')).baseAmount, 86.13);
      await contract(1, '2026-03-12', 'Fijo', 'Quincenal', 150);
      assert.equal((await summary(1, '2026-03-12')).baseAmount, 144.19);
      assert.equal((await summary(1, '2026-03-15')).baseAmount, 174.19);
      assert.equal((await summary(1, '2026-03-16')).baseAmount, 9.38);
      await connection.query("INSERT INTO tbl_detalle_ruta(iddetalleruta,idglobal,idsucursal,created_at) VALUES(9,1,1,'2026-04-01')");
      await connection.query("INSERT INTO tbl_employee_payroll_contract(idglobal,employee_id,effective_date,salary_type,frequency,base_amount,capital_rate,collection_rate,actor_user_id) VALUES(1,3,'2026-04-01','Fijo','Mensual',100,99,99,1)");
      await connection.query('CALL sp_employee_payroll_snapshot(1,9)');
      await connection.query("INSERT INTO tbl_tarjetas VALUES('fixed',1,9,9999,99999,'Prestamo','2026-04-02')");
      assert.equal((await summary(3, '2026-04-30')).earnedAmount, 100);
    });
    await t.test('frozen equal and custom distribution, reviewer, multiple routes, no retroactivity', async () => {
      await connection.query("INSERT INTO tbl_employee_payroll_branch_rule(idglobal,branch_id,mode,actor_user_id) VALUES(1,1,'Igual',1)");
      await connection.query("INSERT INTO tbl_detalle_ruta(iddetalleruta,idglobal,idsucursal,created_at) VALUES(3,1,1,'2026-03-01')");
      await connection.query("INSERT INTO tbl_empleados_cobrando VALUES(3,3),(4,3),(4,3)");
      await connection.query('CALL sp_employee_payroll_snapshot(1,3)');
      await connection.query("INSERT INTO tbl_tarjetas VALUES('equal',1,3,1000,2000,'Prestamo','2026-03-02')");
      assert.equal((await summary(3, '2026-03-31')).capitalCommission, 50);
      assert.equal((await summary(4, '2026-03-31')).capitalCommission, 50);
      await connection.query("INSERT INTO tbl_employee_payroll_branch_rule(idglobal,branch_id,mode,actor_user_id) VALUES(1,1,'Personalizado',1)");
      const rule = (await connection.query('SELECT MAX(id) id FROM tbl_employee_payroll_branch_rule'))[0][0].id;
      await connection.execute('INSERT INTO tbl_employee_payroll_weight VALUES(?,3,25),(?,4,75)', [rule, rule]);
      await connection.query("INSERT INTO tbl_detalle_ruta(iddetalleruta,idglobal,idsucursal,created_at) VALUES(4,1,1,'2026-03-03')");
      await connection.query('CALL sp_employee_payroll_snapshot(1,4)');
      await connection.query("INSERT INTO tbl_tarjetas VALUES('custom',1,4,1000,9000,'Prestamo','2026-03-04')");
      assert.equal((await summary(3, '2026-03-31')).capitalCommission, 75);
      assert.equal((await summary(4, '2026-03-31')).capitalCommission, 125);
      // A later contract does not change already open route rates.
      await connection.query("UPDATE tbl_employee_payroll_contract SET capital_rate=99 WHERE employee_id=3");
      assert.equal((await summary(3, '2026-03-31')).capitalCommission, 75);
      await connection.query("UPDATE tbl_employee_payroll_contract SET capital_rate=10 WHERE employee_id=3");
    });
    await t.test('fresh permissions, tenant isolation, prospective versions and request conflicts', async () => {
      const bonus = { employeeId: 3, date: today, amount: 25, reason: 'Manual', idempotencyToken: 'bonus_token_00000001' };
      const r = await change(2, 'bono', bonus); assert.equal(r.duplicate, 0);
      assert.equal((await change(2, 'bono', bonus)).duplicate, 1);
      await assert.rejects(change(2, 'bono', { ...bonus, amount: 26 }), /CONFLICT/);
      await assert.rejects(change(3, 'bono', { ...bonus, idempotencyToken: 'bonus_token_00000002' }), /FORBIDDEN/);
      await assert.rejects(change(5, 'bono', bonus, 2), /EMPLOYEE_NOT_FOUND/);
      await connection.query("UPDATE tbl_usuario SET str_estado='inactivo' WHERE idusuario=2");
      await assert.rejects(change(2, 'bono', bonus), /UNAUTHENTICATED/);
      await connection.query("UPDATE tbl_usuario SET str_estado='activo' WHERE idusuario=2");
      await connection.query('UPDATE tbl_oficina SET idempleado_administrador=1 WHERE idoficina=1');
      await assert.rejects(change(2, 'bono', bonus), /FORBIDDEN/);
      await connection.query('UPDATE tbl_oficina SET idempleado_administrador=2 WHERE idoficina=1');
      await assert.rejects(change(2, 'reparto', { branchId: 1, mode: 'Igual', weights: [], idempotencyToken: 'rule_token_00000001' }), /FORBIDDEN/);
      await assert.rejects(change(1, 'reparto', { branchId: 1, mode: 'Personalizado', weights: [{ employeeId: 3, weight: 70 }], idempotencyToken: 'rule_token_00000002' }), /SUM_100/);
      await assert.rejects(change(1, 'contrato', { employeeId: 3, effectiveDate: '2020-01-01', type: 'Fijo',
        frequency: 'Diario', baseAmount: 100, capitalRate: 0, collectionRate: 0, idempotencyToken: 'contract_token_00001' }), /INVALID_CONTRACT/);
      assert.equal((await connection.query("SELECT COUNT(*) n FROM tbl_employee_payroll_bonus WHERE employee_id=3"))[0][0].n, 1);
      const newContract = { employeeId: 2, effectiveDate: today, type: 'Porcentaje', frequency: 'Mensual',
        baseAmount: 0, capitalRate: 3, collectionRate: 4, idempotencyToken: 'contract_token_00002' };
      assert.equal((await change(2, 'contrato', newContract)).ok, 1);
      assert.equal((await change(2, 'contrato', newContract)).duplicate, 1);
      await assert.rejects(change(2, 'contrato', { ...newContract, idempotencyToken: 'contract_token_00003' }), /DATE_CONFLICT/);
    });
    // Exercise the public Node service against the same isolated database.
    for (const path of ['tests/fixtures/payroll-016-legacy.sql', 'migrations/016_payroll_replacements_cash_bonus.sql']) {
      for (const statement of sqlStatements(await fs.readFile(path, 'utf8'))) await connection.query(statement);
    }
    await connection.execute("INSERT INTO tbl_detalle_ruta(iddetalleruta,idglobal,idsucursal,created_at) VALUES(20,1,1,?)", [today]);
    await connection.query("INSERT INTO tbl_empleados_cobrando VALUES(4,20)");
    process.env.DB_NAME = db;
    process.env.DB_HOST = process.env.PAYROLL_TEST_DB_HOST;
    process.env.DB_PORT = process.env.PAYROLL_TEST_DB_PORT ?? '3306';
    process.env.DB_USER = process.env.PAYROLL_TEST_DB_USER;
    process.env.DB_PASSWORD = process.env.PAYROLL_TEST_DB_PASSWORD;
    const { myPayroll, changeEmployeePayroll } = await import('../dist/services/payrollEmployee.js');
    const { pool } = await import('../dist/db.js');
    try {
      await t.test('Node self identity comes from fresh DB, never a supplied/stale employeeId', async () => {
        const result = await myPayroll({ user: { companyId: 1, userId: 3, employeeId: 4 }, permissions: [] }, '2026-02-28');
        assert.equal(result.employeeId, 3); assert.equal(result.totals.earnedAmount, 210);
        assert.equal(result.routes.length, 2);
        assert.equal(result.routes[0].provisional, true);
        assert.equal(result.routes[0].weight, 100);
        assert.equal(result.routes[0].capitalAmount, 900);
        assert.equal(result.routes[0].cashAmount, 350);
        assert.equal(result.routes[0].capitalBasis, 900);
        assert.equal(result.routes[0].sharePercent, 100);
        assert.equal(result.routes[0].closed, false);
        assert.equal(result.routes[0].openedDate, '2026-02-01');
        assert.equal(result.routes[0].id, result.routes[0].routeId);
        await connection.query("UPDATE tbl_detalle_ruta SET str_estado='saved' WHERE iddetalleruta=1");
        const closed = await myPayroll({ user: { companyId: 1, userId: 3 }, permissions: [] }, '2026-02-28');
        assert.equal(closed.routes[0].closed, true);
        assert.equal(closed.routes[0].provisional, false);
        const other = await myPayroll({ user: { companyId: 1, userId: 4 }, permissions: [] }, '2026-02-28');
        assert.deepEqual(other.routes, []);
        assert.deepEqual(other.breakdown, []);
        assert.equal(result.breakdown.length, 5);
        assert.equal(result.breakdown.reduce((sum, row) => sum + row.capitalCommission, 0), 140);
        assert.equal(result.breakdown.reduce((sum, row) => sum + row.collectionCommission, 0), 70);
        await assert.rejects(myPayroll(null), /Authentication/);
        await assert.rejects(myPayroll({ user: { companyId: 2, userId: 3, employeeId: 3 }, permissions: [] }), /empleado activo/);
      });
      await t.test('public Node writes use shared authorization and idempotency', async () => {
        const context = { user: { companyId: 1, userId: 2, employeeId: 999, cargo: 'Cobrador' }, permissions: [] };
        const input = { employeeId: 4, branchId: 1, routeId: 20, amount: 5, reason: 'Bono manual', idempotencyToken: 'node_bonus_token_001' };
        assert.equal((await changeEmployeePayroll(context, 'bono', input)).duplicate, false);
        assert.equal((await changeEmployeePayroll(context, 'bono', input)).duplicate, true);
        assert.equal((await myPayroll({ user: { companyId: 1, userId: 4 }, permissions: [] }, today)).totals.bonusAmount, 5);
        await assert.rejects(changeEmployeePayroll(context, 'bono', { ...input, amount: -5 }), /Datos de nómina/);
        assert.equal((await changeEmployeePayroll(context, 'vacacion', { employeeId: 4, replacementEmployeeId: 1, startDate: today, endDate: today,
          idempotencyToken: 'node_vacation_token_01' })).ok, true);
        await assert.rejects(changeEmployeePayroll({ user: { companyId: 1, userId: 3, cargo: 'Super Administrador' }, permissions: [] }, 'bono',
          { ...input, idempotencyToken: 'node_bonus_token_002' }), /no autorizado/);
        await assert.rejects(changeEmployeePayroll(context, 'bono', { ...input, amount: 'invalid' }), /Datos de nómina/);
      });
    } finally { await pool.end(); }
    await t.test('manual local migration script dry run, guards and repeat application in isolated DB', async () => {
      const env = { ...process.env, DB_HOST: process.env.PAYROLL_TEST_DB_HOST,
        DB_PORT: process.env.PAYROLL_TEST_DB_PORT ?? '3306', DB_USER: process.env.PAYROLL_TEST_DB_USER,
        DB_PASSWORD: process.env.PAYROLL_TEST_DB_PASSWORD, DB_NAME: db };
      const run = (args, overrides = {}) => spawnSync(process.execPath,
        ['scripts/apply-payroll-local.mjs', '--database', db, ...args],
        { env: { ...env, ...overrides }, encoding: 'utf8' });
      assert.notEqual(run(['--apply']).status, 0);
      assert.notEqual(run([], { DB_HOST: 'remote.invalid' }).status, 0);
      const dry = run(['--migration', '016']);
      assert.equal(dry.status, 0, dry.stderr);
      assert.match(dry.stdout, /no changes applied/);
      const apply = run(['--migration', '016', '--apply', '--confirm', db, '--backup-confirmed', '--writers-stopped', '--isolated-tests-confirmed']);
      assert.equal(apply.status, 0, apply.stderr);
      assert.match(apply.stdout, /migration 016 applied/);
      assert.equal((await summary(3, '2026-02-28')).paidAmount, 70);
    });
  } finally {
    if (created) await connection.query(`DROP DATABASE \`${db}\``);
    await connection.end();
  }
});
