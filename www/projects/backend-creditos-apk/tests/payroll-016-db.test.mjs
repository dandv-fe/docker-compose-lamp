import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { spawnSync } from 'node:child_process';
import 'dotenv/config';

function statements(text) {
  let delimiter = ';', buffer = '', rows = [];
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('--')) continue;
    if (line.startsWith('DELIMITER ')) { delimiter = line.trim().slice(10); continue; }
    buffer += line + '\n';
    if (buffer.trimEnd().endsWith(delimiter)) {
      rows.push(buffer.trimEnd().slice(0, -delimiter.length).trim()); buffer = '';
    }
  }
  if (buffer.trim()) throw new Error('Unterminated SQL');
  return rows;
}

test('016 deployed upgrade: vacation coverage, own contracts, cash bonus and bounded temporary auth', async (t) => {
  for (const key of ['PAYROLL_TEST_DB_HOST', 'PAYROLL_TEST_DB_USER', 'PAYROLL_TEST_DB_PASSWORD']) {
    if (process.env[key] === undefined) throw new Error(`Explicit test credentials required: ${key}`);
  }
  const server = { host: process.env.PAYROLL_TEST_DB_HOST, port: Number(process.env.PAYROLL_TEST_DB_PORT ?? 3306),
    user: process.env.PAYROLL_TEST_DB_USER, password: process.env.PAYROLL_TEST_DB_PASSWORD, decimalNumbers: true, dateStrings: true };
  const c = await mysql.createConnection(server);
  const db = `payroll_test_016_${process.pid}_${Date.now()}`;
  let created = false;
  try {
    await c.query(`CREATE DATABASE \`${db}\``); created = true; await c.query(`USE \`${db}\``);
    for (const path of ['tests/fixtures/employee-payroll.sql', 'migrations/015_employee_payroll.sql',
      'tests/fixtures/payroll-016-legacy.sql', 'migrations/016_payroll_replacements_cash_bonus.sql']) {
      for (const sql of statements(await fs.readFile(path, 'utf8'))) await c.query(sql);
    }
    const today = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
    const plus = (days) => new Date(Date.parse(today + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
    const daysInMonth = new Date(Date.parse(today + 'T00:00:00Z')).getUTCDate();
    const calendarDate = new Date(today + 'T00:00:00Z');
    const monthLength = new Date(Date.UTC(calendarDate.getUTCFullYear(), calendarDate.getUTCMonth() + 1, 0)).getUTCDate();
    await c.query(`INSERT INTO tbl_employee_payroll_contract
      (idglobal,employee_id,effective_date,salary_type,frequency,base_amount,capital_rate,collection_rate,actor_user_id)
      VALUES(1,3,'2020-01-01','Combinado','Mensual',310,10,20,1),
            (1,4,'2020-01-01','Porcentaje','Mensual',155,5,10,1)`);
    await c.execute("INSERT INTO tbl_detalle_ruta(iddetalleruta,idglobal,idsucursal,created_at) VALUES(1,1,1,?),(2,1,2,?)",
      [today + ' 00:00:00', today + ' 00:00:00']);
    await c.query("INSERT INTO tbl_empleados_cobrando VALUES(3,1),(4,1),(3,2)");
    await c.query('CALL sp_employee_payroll_snapshot(1,1)'); await c.query('CALL sp_employee_payroll_snapshot(1,2)');
    const change = async (action, data, actor = 2, company = 1) =>
      (await c.query('CALL sp_employee_payroll_change_v2(?,?,?,?)', [company, actor, action, JSON.stringify(data)]))[0][0][0];
    const summary = async (employeeId, asOf = today) =>
      (await c.query('CALL sp_employee_payroll_summary(1,?,?)', [employeeId, asOf]))[0][0][0];
    const vacation = { employeeId: 3, replacementEmployeeId: 4, startDate: today, endDate: plus(2),
      idempotencyToken: 'replacement_token_0001' };
    await t.test('replacement required, own live contract, authorization and atomic rejection', async () => {
      await assert.rejects(change('vacacion', { ...vacation, replacementEmployeeId: 3 }), /INVALID_REPLACEMENT/);
      await assert.rejects(change('vacacion', { ...vacation, replacementEmployeeId: 5 }), /INVALID_REPLACEMENT/);
      await assert.rejects(change('vacacion', { ...vacation, replacementEmployeeId: 1 }), /CONTRACT_REQUIRED/);
      await c.query("INSERT INTO tbl_persona VALUES(6,1,'Other','Office')");
      await c.query("INSERT INTO tbl_empleado VALUES(6,1,6,22,'Cobrador','activo')");
      await c.query("INSERT INTO tbl_oficina VALUES(22,1,1,'Other company office')");
      await c.query("INSERT INTO tbl_employee_payroll_contract(idglobal,employee_id,effective_date,salary_type,frequency,base_amount,capital_rate,collection_rate,actor_user_id) VALUES(1,6,'2020-01-01','Fijo','Diario',10,0,0,1)");
      await assert.rejects(change('vacacion', { ...vacation, replacementEmployeeId: 6 }), /FORBIDDEN/);
      await c.query("UPDATE tbl_empleado SET str_estado='inactivo' WHERE idempleado=4");
      await assert.rejects(change('vacacion', vacation), /INVALID_REPLACEMENT/);
      await c.query("UPDATE tbl_empleado SET str_estado='activo' WHERE idempleado=4");
      await assert.rejects(change('vacacion', vacation, 3), /FORBIDDEN/);
      const saved = await change('vacacion', vacation); assert.equal(saved.ok, 1);
      assert.equal((await change('vacacion', vacation)).duplicate, 1);
      assert.equal((await c.query('SELECT COUNT(*) n FROM tbl_employee_payroll_coverage'))[0][0].n, 2);
      assert.equal((await c.query('SELECT COUNT(*) n FROM tbl_employee_payroll_contract WHERE employee_id IN (3,4)'))[0][0].n, 2);
      await assert.rejects(change('vacacion', { ...vacation, employeeId: 4, replacementEmployeeId: 3,
        idempotencyToken: 'replacement_token_0002' }), /OVERLAP/);
      await assert.rejects(c.query('CALL sp_employee_payroll_change(1,2,?,?)',
        ['vacacion', JSON.stringify({ ...vacation, employeeId: 4, idempotencyToken: 'legacy_vacation_0001' })]), /REPLACEMENT_REQUIRED/);
    });
    await t.test('both portfolios transfer titular share with replacement rates, titular keeps basic, no extra base', async () => {
      await c.execute("INSERT INTO tbl_tarjetas VALUES('cap1',1,1,1000,9000,'Prestamo',?),('cap2',1,2,2000,8000,'Prestamo',?)",
        [today, today]);
      await c.execute("INSERT INTO tbl_descripcion VALUES('cash1',1,1,-500,'Abono',?),('discount',1,1,-999,'Descuento',?)", [today, today]);
      await c.query("INSERT INTO tbl_descripcion_pago VALUES(1,'cash1',100)");
      const holder = await summary(3), replacement = await summary(4);
      assert.equal(holder.capitalCommission, 0); assert.equal(holder.collectionCommission, 0);
      assert.ok(Math.abs(holder.baseAmount - 310 * daysInMonth / monthLength) < 0.0001);
      assert.equal(replacement.capitalCommission, 150); assert.equal(replacement.collectionCommission, 40);
      assert.ok(Math.abs(replacement.baseAmount - 155 * daysInMonth / monthLength) < 0.0001);
      assert.equal(replacement.earnedAmount, replacement.baseAmount + 190);
      const routes = (await c.query('CALL sp_employee_payroll_routes(1,4,?,?)', [today, today]))[0][0];
      assert.equal(routes.filter((r) => r.mode === 'Relevo').length, 2);
      assert.ok(routes.filter((r) => r.mode === 'Relevo').every((r) => r.capitalRate === 5 && r.weight === 100));
      await c.execute("INSERT INTO tbl_tarjetas VALUES('after',1,1,1000,9000,'Prestamo',?)", [plus(3)]);
      assert.equal((await summary(3, plus(3))).capitalCommission, 100);
      assert.equal((await summary(4, plus(3))).capitalCommission, plus(3).slice(0, 7) === today.slice(0, 7) ? 150 : 0);
    });
    await t.test('cash bonus creates exactly one expense/link/earned bonus, signed update/delete stays balanced', async () => {
      const bonus = { employeeId: 4, branchId: 1, routeId: 1, amount: 25, reason: 'Meta lograda',
        idempotencyToken: 'cash_bonus_token_0001' };
      await assert.rejects(change('bono', { ...bonus, date: today }), /DATE_NOT_ALLOWED/);
      await assert.rejects(change('bono', { ...bonus, routeId: 999 }), /ROUTE_CLOSED/);
      await assert.rejects(change('bono', { ...bonus, branchId: 3 }), /ROUTE_CLOSED/);
      await assert.rejects(change('bono', bonus, 3), /FORBIDDEN/);
      await assert.rejects(change('bono', { ...bonus, employeeId: 3 }, 3), /FORBIDDEN/);
      await assert.rejects(c.query('CALL sp_employee_payroll_bonus_context(1,3,1,NULL)'), /FORBIDDEN/);
      const saved = await change('bono', bonus); assert.ok(saved.expenseId);
      assert.match(saved.expenseId, /^[A-Za-z0-9]+$/);
      assert.equal((await change('bono', bonus)).duplicate, 1);
      const [[cash]] = await c.execute('SELECT dec_total,created_at FROM tbl_contabilidad_detalle WHERE idcontabilidad_detalle=?', [saved.expenseId]);
      assert.equal(cash.dec_total, -25); assert.equal(cash.created_at.slice(0, 10), today);
      assert.equal((await summary(4)).bonusAmount, 25); assert.equal((await summary(4)).paidAmount, 25);
      assert.equal((await c.query('SELECT COUNT(*) n FROM tbl_employee_payroll_bonus'))[0][0].n, 1);
      await c.execute('INSERT INTO tbl_detalle_nomina(idglobal,idnomina,idcontabilidad_detalle) VALUES(1,2,?)', [saved.expenseId]);
      assert.equal((await summary(4)).paidAmount, 25);
      await c.execute('UPDATE tbl_contabilidad_detalle SET dec_total=5 WHERE idcontabilidad_detalle=?', [saved.expenseId]);
      assert.equal((await summary(4)).bonusAmount, -5); assert.equal((await summary(4)).paidAmount, -5);
      await assert.rejects(c.execute('UPDATE tbl_contabilidad_detalle SET idsucursal=2 WHERE idcontabilidad_detalle=?', [saved.expenseId]), /IMMUTABLE/);
      await assert.rejects(c.execute('INSERT INTO tbl_detalle_nomina(idglobal,idnomina,idcontabilidad_detalle) VALUES(1,1,?)', [saved.expenseId]), /BENEFICIARY/);
      await assert.rejects(c.execute('DELETE FROM tbl_detalle_nomina WHERE idcontabilidad_detalle=?', [saved.expenseId]), /LINK_REQUIRED/);
      await c.execute('DELETE FROM tbl_contabilidad_detalle WHERE idcontabilidad_detalle=?', [saved.expenseId]);
      assert.equal((await summary(4)).bonusAmount, 0); assert.equal((await summary(4)).paidAmount, 0);
      assert.ok((await c.query('SELECT cancelled_at FROM tbl_employee_payroll_bonus'))[0][0].cancelled_at);
      await c.query("UPDATE tbl_detalle_ruta SET str_estado='entregando' WHERE iddetalleruta=1");
      await assert.rejects(change('bono', { ...bonus, idempotencyToken: 'cash_bonus_token_0002' }), /ROUTE_CLOSED/);
      await c.query("UPDATE tbl_detalle_ruta SET str_estado='created' WHERE iddetalleruta=1");
      await assert.rejects(c.query('CALL sp_employee_payroll_change(1,2,?,?)', ['bono', JSON.stringify({
        ...bonus, date: today, idempotencyToken: 'legacy_bonus_token_01' })]), /CASH_SCOPE_REQUIRED/);
      const cancelled = await change('bono', { ...bonus, idempotencyToken: 'cash_bonus_cleanup_01' });
      await c.execute('UPDATE tbl_contabilidad_detalle SET dec_total=0 WHERE idcontabilidad_detalle=?', [cancelled.expenseId]);
      await c.query("UPDATE tbl_contabilidad_detalle SET str_estado='saved' WHERE iddetalleruta=1");
      await c.query("UPDATE tbl_detalle_ruta SET str_estado='saved' WHERE iddetalleruta=1");
      await c.query('DELETE FROM tbl_contabilidad_detalle WHERE iddetalleruta=1 AND dec_total=0');
      assert.equal((await summary(4)).bonusAmount, 0); assert.equal((await summary(4)).paidAmount, 0);
      assert.equal((await c.execute('SELECT COUNT(*) n FROM tbl_detalle_nomina WHERE idcontabilidad_detalle=?',
        [cancelled.expenseId]))[0][0].n, 0);
      await c.query("UPDATE tbl_detalle_ruta SET str_estado='created' WHERE iddetalleruta=1");
    });
    await t.test('equal sharing plus the replacement own share never duplicates commissions or calendar base', async () => {
      await c.query("INSERT INTO tbl_employee_payroll_branch_rule(idglobal,branch_id,mode,actor_user_id) VALUES(1,1,'Igual',1)");
      await c.execute("INSERT INTO tbl_detalle_ruta(iddetalleruta,idglobal,idsucursal,created_at) VALUES(3,1,1,?)", [today]);
      await c.query("INSERT INTO tbl_empleados_cobrando VALUES(3,3),(4,3),(4,3)");
      await c.query('CALL sp_employee_payroll_snapshot(1,3)');
      await c.execute("INSERT INTO tbl_tarjetas VALUES('shared',1,3,1000,9000,'Prestamo',?)", [today]);
      const replacement = await summary(4);
      assert.equal(replacement.capitalCommission, 200);
      assert.ok(Math.abs(replacement.baseAmount - 155 * daysInMonth / monthLength) < 0.0001);
      const [parts] = await c.query("SELECT employeeId,vacationId,weight,capitalCommission,excludedReason FROM view_employee_payroll_breakdown WHERE movementId='capital:shared'");
      assert.equal(parts.filter((p) => p.employeeId === 4).length, 2);
      assert.equal(parts.filter((p) => p.employeeId === 4).reduce((sum, p) => sum + p.weight, 0), 100);
      assert.equal(parts.filter((p) => p.employeeId === 4).reduce((sum, p) => sum + p.capitalCommission, 0), 50);
      assert.equal(parts.find((p) => p.employeeId === 3).excludedReason, 'VACATION');
    });
    await t.test('concurrent bonus token has one committed cash movement; corrections require created route', async () => {
      const payload = { employeeId: 4, branchId: 1, routeId: 3, amount: 7.5, reason: 'Concurrent',
        idempotencyToken: 'concurrent_bonus_0001' };
      await assert.rejects(change('bono', { ...payload, routeId: 1 }), /ROUTE_CLOSED/);
      await c.execute('INSERT INTO tbl_detalle_ruta(iddetalleruta,idglobal,idsucursal,created_at) VALUES(9,1,1,?)', [plus(1)]);
      await assert.rejects(change('bono', { ...payload, routeId: 9 }), /ROUTE_CLOSED/);
      await assert.rejects(c.query('CALL sp_employee_payroll_bonus_context(1,2,1,NULL)'), /ROUTE_CLOSED/);
      await c.query('DELETE FROM tbl_detalle_ruta WHERE iddetalleruta=9');
      const other = await mysql.createConnection({ ...server, database: db });
      try {
        const results = await Promise.all([
          change('bono', payload),
          other.query('CALL sp_employee_payroll_change_v2(1,2,?,?)', ['bono', JSON.stringify(payload)]).then((r) => r[0][0][0]),
        ]);
        assert.equal(results.reduce((n,r) => n+r.duplicate,0), 1);
        assert.equal(new Set(results.map((r) => r.expenseId)).size, 1);
        assert.equal((await summary(4)).bonusAmount, 7.5); assert.equal((await summary(4)).paidAmount, 7.5);
        await c.query("UPDATE tbl_detalle_ruta SET str_estado='entregando' WHERE iddetalleruta=3");
        await assert.rejects(c.execute('UPDATE tbl_contabilidad_detalle SET dec_total=0 WHERE idcontabilidad_detalle=?',
          [results[0].expenseId]), /ROUTE_CLOSED/);
        await assert.rejects(c.execute('DELETE FROM tbl_contabilidad_detalle WHERE idcontabilidad_detalle=?',
          [results[0].expenseId]), /ROUTE_CLOSED/);
        await c.query("UPDATE tbl_detalle_ruta SET str_estado='created' WHERE iddetalleruta=3");
        await c.execute('DELETE FROM tbl_contabilidad_detalle WHERE idcontabilidad_detalle=?', [results[0].expenseId]);
        assert.equal((await summary(4)).bonusAmount, 0); assert.equal((await summary(4)).paidAmount, 0);
      } finally { await other.end(); }
    });
    for (const [key, value] of Object.entries({ DB_HOST: server.host, DB_PORT: String(server.port),
      DB_USER: server.user, DB_PASSWORD: server.password, DB_NAME: db })) process.env[key] = value;
    const { pool } = await import('../dist/db.js');
    const payroll = await import('../dist/services/payrollEmployee.js');
    const auth = await import('../dist/services/auth.js');
    try {
      await t.test('temporary scope requires own fresh grants, never holder grants or admin, starts and expires in Bogota', async () => {
        const user = { userId: 4, companyId: 1, employeeId: 4, cargo: 'Revisador' };
        assert.equal(await auth.isOfficeAdministrator(user, 1), false);
        await auth.assertBranchAccess(user, 1);
        assert.equal(await auth.hasPermission(user, 1, 'nueva tarjeta'), false);
        await assert.rejects(auth.requirePermission(user, 1, 'nueva tarjeta'), /permission|permiso/i);
        await c.query("INSERT INTO tbl_sucursal VALUES(10,1,4,1,'Own grants')");
        await c.query("INSERT INTO tbl_auth_sucursal VALUES(4,1,10,4,'activo')");
        await c.query("INSERT INTO tbl_auths VALUES(11,4,1),(12,4,2),(13,4,5),(14,4,6)");
        await c.query("INSERT INTO tbl_auth_sucursal VALUES(5,2,3,4,'activo'),(6,1,3,4,'activo')");
        await c.query("INSERT INTO tbl_auths VALUES(17,5,4),(18,6,4)");
        assert.equal(await auth.hasPermission(user, 1, 'nueva tarjeta'), false);
        await assert.rejects(auth.requirePermission(user, 2, 'editar cuota'), /permission|permiso/i);
        await c.query("INSERT INTO tbl_auth_sucursal VALUES(7,1,1,4,'activo'),(8,1,2,4,'activo')");
        await c.query("INSERT INTO tbl_auths VALUES(20,7,1),(21,7,2),(22,8,2)");
        assert.equal(await auth.hasPermission(user, 1, 'nueva tarjeta'), true);
        assert.equal(await auth.hasPermission(user, 1, 'totalizar'), false);
        await assert.rejects(auth.requireTemporaryCashPermission(user, 1), /permission|permiso/i);
        await c.query("INSERT INTO tbl_auths VALUES(19,7,4)");
        await auth.requireTemporaryCashPermission(user, 1);
        assert.equal(await auth.isOfficeAdministrator(user, 1), false);
        await c.query('DELETE FROM tbl_auths WHERE id=19');
        assert.equal(await auth.hasPermission(user, 1, 'eliminar cuota'), false);
        await auth.requirePermission(user, 2, 'editar cuota');
        await assert.rejects(auth.requirePermission(user, 2, 'eliminar cuota'), /permission|permiso/i);
        await assert.rejects(auth.requirePermission(user, 1, 'editar cliente'), /permission|permiso/i);
        await c.query("INSERT INTO tbl_auths VALUES(15,8,3)");
        await auth.requirePermission(user, 2, 'eliminar cuota');
        await c.query('DELETE FROM tbl_auths WHERE id=15');
        await assert.rejects(auth.requirePermission(user, 2, 'eliminar cuota'), /permission|permiso/i);
        await c.query("UPDATE tbl_auth_sucursal SET str_estado='inactivo' WHERE idauth_sucursal=7");
        assert.equal(await auth.hasPermission(user, 1, 'nueva tarjeta'), false);
        await c.query("UPDATE tbl_auth_sucursal SET str_estado='activo' WHERE idauth_sucursal=7");
        await c.query("UPDATE tbl_auth_sucursal SET str_estado='inactivo' WHERE idauth_sucursal=8");
        await c.execute('UPDATE tbl_employee_payroll_coverage SET start_date=?', [plus(1)]);
        await assert.rejects(auth.assertBranchAccess(user, 2), /not available/);
        assert.equal(await auth.hasPermission(user, 2, 'editar cuota'), false);
        await c.execute('UPDATE tbl_employee_payroll_coverage SET start_date=?', [today]);
        const result = await payroll.myPayroll({ user, permissions: [] }, today);
        assert.equal(result.routes.filter((r) => r.mode === 'Relevo').length, 3);
        assert.equal(result.totals.capitalCommission, 200);
        await assert.rejects(payroll.payrollBonusContext({ user, permissions: [] }, 2), /autorizado/);
        await assert.rejects(payroll.changeEmployeePayroll({ user, permissions: [] }, 'bono', {
          employeeId: 4, branchId: 1, routeId: 3, amount: 1, reason: 'Self bonus',
          idempotencyToken: 'forbidden_self_bonus_01'
        }), /autorizado/);
        const managed = await change('bono', { employeeId: 4, branchId: 2, routeId: 2, amount: 1,
          reason: 'Manager only', idempotencyToken: 'manager_only_bonus_01' });
        const { assertCanChangePayrollBonus } = await import('../dist/services/operations.js');
        await assert.rejects(assertCanChangePayrollBonus(c, user, 2, managed.expenseId), /administrador/);
        await assertCanChangePayrollBonus(c, { ...user, userId: 2, employeeId: 2 }, 2, managed.expenseId);
        await c.execute('DELETE FROM tbl_contabilidad_detalle WHERE idcontabilidad_detalle=?', [managed.expenseId]);
        await c.execute('UPDATE tbl_employee_payroll_coverage SET end_date=?', [plus(-1)]);
        await assert.rejects(auth.assertBranchAccess(user, 2), /not available/);
        assert.equal(await auth.hasPermission(user, 2, 'nueva tarjeta'), false);
        await c.execute('UPDATE tbl_employee_payroll_coverage SET end_date=?', [plus(2)]);
        await c.query("UPDATE tbl_empleado SET str_estado='inactivo' WHERE idempleado=4");
        await assert.rejects(auth.assertBranchAccess(user, 2), /not available/);
        await c.query("UPDATE tbl_empleado SET str_estado='activo' WHERE idempleado=4");
      });
    } finally { await pool.end(); }
    await t.test('016 is repeatable and leaves 015 history plus no permanent grants', async () => {
      const args = ['scripts/apply-payroll-local.mjs', '--migration', '016', '--database', db];
      const dryRun = spawnSync(process.execPath, args, { env: process.env, encoding: 'utf8' });
      assert.equal(dryRun.status, 0, dryRun.stdout + dryRun.stderr);
      assert.match(dryRun.stdout, /Dry run OK.*no changes applied/);
      const applied = spawnSync(process.execPath, [...args, '--apply', '--confirm', db,
        '--backup-confirmed', '--writers-stopped', '--isolated-tests-confirmed'], { env: process.env, encoding: 'utf8' });
      assert.equal(applied.status, 0, applied.stdout + applied.stderr);
      assert.match(applied.stdout, /migration 016 applied/);
      const downgrade = spawnSync(process.execPath, ['scripts/apply-payroll-local.mjs', '--database', db],
        { env: process.env, encoding: 'utf8' });
      assert.notEqual(downgrade.status, 0);
      assert.match(downgrade.stderr, /refusing to downgrade/);
      assert.equal((await c.query('SELECT COUNT(*) n FROM tbl_employee_payroll_vacation'))[0][0].n, 1);
      assert.equal((await c.query('SELECT COUNT(*) n FROM tbl_auth_sucursal WHERE idempleado=4 AND idsucursal IN (1,2)'))[0][0].n, 2);
      assert.equal((await c.query('SELECT COUNT(*) n FROM tbl_auth_sucursal WHERE idempleado=4'))[0][0].n, 5);
      assert.equal((await summary(4)).capitalCommission, 200);
    });
    await t.test('replacement contract starts at coverage, keeps one prorated basic and snapshots known future terms', async () => {
      await c.query("INSERT INTO tbl_persona VALUES(7,1,'Holder','Future'),(8,1,'Replacement','Future')");
      await c.query("INSERT INTO tbl_empleado VALUES(7,1,7,1,'Cobrador','activo'),(8,1,8,1,'Revisador','activo')");
      await c.query("INSERT INTO tbl_sucursal VALUES(4,1,7,1,'Future')");
      await c.query(`INSERT INTO tbl_employee_payroll_contract
        (idglobal,employee_id,effective_date,salary_type,frequency,base_amount,capital_rate,collection_rate,actor_user_id)
        VALUES(1,7,'2020-01-01','Porcentaje','Mensual',0,10,20,2)`);
      await c.execute(`INSERT INTO tbl_employee_payroll_contract
        (idglobal,employee_id,effective_date,salary_type,frequency,base_amount,capital_rate,collection_rate,actor_user_id)
        VALUES(1,8,?,'Fijo','Mensual',310,0,0,2),(1,8,?,'Combinado','Mensual',310,5,10,2)`, [today, plus(1)]);
      await c.execute('INSERT INTO tbl_detalle_ruta(iddetalleruta,idglobal,idsucursal,created_at) VALUES(4,1,4,?)', [today]);
      await c.query('INSERT INTO tbl_empleados_cobrando VALUES(7,4)');
      await c.query('CALL sp_employee_payroll_snapshot(1,4)');
      const saved = await change('vacacion', { employeeId: 7, replacementEmployeeId: 8,
        startDate: today, endDate: plus(2), idempotencyToken: 'replacement_future_01' });
      assert.equal((await c.execute('SELECT COUNT(*) n FROM tbl_employee_payroll_coverage_contract WHERE vacation_id=?',
        [saved.id]))[0][0].n, 2);
      assert.equal((await c.query('SELECT COUNT(*) n FROM tbl_employee_payroll_contract WHERE employee_id=8'))[0][0].n, 2);
      for (let day = 0; day <= 2; day++) await c.execute(
        "INSERT INTO tbl_tarjetas VALUES(?,1,4,1000,9000,'Prestamo',?)", [`future${day}`, plus(day)]);
      assert.equal((await summary(8)).capitalCommission, 0);
      const cutoff = plus(2), result = await summary(8, cutoff);
      const selectedMonth = cutoff.slice(0, 7);
      const elapsedDays = [today, plus(1), cutoff].filter((day) => day.slice(0, 7) === selectedMonth).length;
      const end = new Date(cutoff + 'T00:00:00Z');
      const denominator = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
      assert.ok(Math.abs(result.baseAmount - 310 * elapsedDays / denominator) < 0.0001);
      assert.equal(result.capitalCommission, [plus(1), cutoff].filter((day) => day.slice(0, 7) === selectedMonth).length * 50);
      assert.equal((await summary(7, cutoff)).capitalCommission, 0);
      await change('contrato', { employeeId: 8, effectiveDate: cutoff, type: 'Porcentaje', frequency: 'Mensual',
        baseAmount: 0, capitalRate: 99, collectionRate: 99, idempotencyToken: 'replacement_later_contract_01' });
      assert.equal((await summary(8, cutoff)).capitalCommission, result.capitalCommission);
      assert.equal((await c.execute('SELECT COUNT(*) n FROM tbl_employee_payroll_coverage_contract WHERE vacation_id=?',
        [saved.id]))[0][0].n, 2);
    });
    await t.test('migrator refuses unverifiable routines without claiming 015 must be reapplied', async () => {
      await c.query('DROP PROCEDURE sp_employee_payroll_summary');
      const result = spawnSync(process.execPath,
        ['scripts/apply-payroll-local.mjs', '--migration', '016', '--database', db],
        { env: process.env, encoding: 'utf8' });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /absent or not visible.*information_schema\.ROUTINES/);
      assert.match(result.stderr, /explicit administrative migrator credentials/);
      assert.match(result.stderr, /No migration applied/);
      assert.doesNotMatch(result.stderr, /Apply 015 first/);
      assert.equal((await c.query('SELECT COUNT(*) n FROM tbl_employee_payroll_coverage'))[0][0].n, 3);
    });
  } finally { if (created) await c.query(`DROP DATABASE \`${db}\``); await c.end(); }
});
