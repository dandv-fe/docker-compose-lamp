import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pool } from '../dist/db.js';
import { authorizedPayrollQuery } from '../dist/services/payroll.js';
import { assertPayroll } from '../dist/services/operations.js';

if (process.env.RUN_PAYROLL_SCOPE_TESTS !== '1') {
  throw new Error('Set RUN_PAYROLL_SCOPE_TESTS=1 to run payroll checks using isolated temporary tables.');
}

after(() => pool.end());

test('payroll listing and write validation enforce employee, office and company scopes', async () => {
  const connection = await pool.getConnection();
  try {
    const fixture = await readFile(new URL('./fixtures/payroll-scope.sql', import.meta.url), 'utf8');
    for (const sql of fixture.split(';').map((part) => part.trim()).filter(Boolean)) {
      await connection.query(sql);
    }
    const cases = JSON.parse(await readFile(new URL('./fixtures/payroll-scope.json', import.meta.url), 'utf8'));
    for (const scenario of cases) {
      const user = {
        companyId: 7, employeeId: scenario.employeeId,
        cargo: scenario.superAdministrator ? 'Super Administrador' : 'Cobrador',
      };
      const query = authorizedPayrollQuery(user, scenario.branchId, scenario.payrollId);
      const [rows] = await connection.execute(query.sql, query.params);
      assert.deepEqual(rows.map((row) => row.id).sort((a, b) => a - b), scenario.expected, scenario.name);
      if (scenario.payrollId !== undefined) {
        await assert.rejects(
          assertPayroll(connection, user, scenario.branchId, scenario.payrollId, 900),
          { extensions: { code: 'FORBIDDEN' } }, scenario.name,
        );
      } else {
        for (const payrollId of scenario.expected) {
          await assert.doesNotReject(assertPayroll(connection, user, scenario.branchId, payrollId, 900), scenario.name);
        }
      }
    }
    await assert.rejects(
      assertPayroll(connection, { companyId: 7, employeeId: 11, cargo: 'Cobrador' }, 4, 101, 902),
      { extensions: { code: 'FORBIDDEN' } },
    );
    const grouped = authorizedPayrollQuery({ companyId: 7, employeeId: null, cargo: 'Super Administrador' }, 4);
    const [ordered] = await connection.execute(grouped.sql, grouped.params);
    assert.deepEqual(ordered.map((row) => row.id), [101, 102, 103, 131, 121, 141]);
    assert.deepEqual(ordered.map((row) => [row.officeId, row.officeName, row.suggested]), [
      [10, 'Norte', 1], [10, 'Norte', 1], [10, 'Norte', 1], [10, 'Norte', 1],
      [20, 'Centro', 0], [20, 'Centro', 0],
    ]);
  } finally {
    // Closing the connection drops every fixture; no permanent tables are written.
    connection.destroy();
  }
});
