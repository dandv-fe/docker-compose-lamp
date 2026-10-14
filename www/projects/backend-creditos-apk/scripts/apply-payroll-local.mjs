// Manual local-only migration. DDL implicitly commits; stop writers and back up first.
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const database = args[args.indexOf('--database') + 1];
const apply = args.includes('--apply');
const migration = args.includes('--migration') ? args[args.indexOf('--migration') + 1] : '015';
if (!['015', '016'].includes(migration)) throw new Error('Only payroll migration 015 or 016 is permitted.');
if (!args.includes('--database') || !/^[a-zA-Z0-9_]+$/.test(database ?? '')
    || database !== process.env.DB_NAME) {
  throw new Error('Use --database NAME matching DB_NAME explicitly. No default target is permitted.');
}
if (!['localhost', '127.0.0.1', '::1', 'database', 'webgoez-mariadb10'].includes(process.env.DB_HOST)) {
  throw new Error('Only explicit local/compose database hosts are permitted.');
}
if (apply && (!args.includes('--backup-confirmed') || !args.includes('--writers-stopped')
    || !args.includes('--isolated-tests-confirmed')
    || args[args.indexOf('--confirm') + 1] !== database || !args.includes('--confirm'))) {
  throw new Error('Applying requires --confirm NAME --backup-confirmed --writers-stopped --isolated-tests-confirmed.');
}
const build = spawnSync('npm', ['run', 'build'], { stdio: 'inherit' });
if (build.error) throw build.error;
if (build.status !== 0) throw new Error('Payroll build failed; no migration applied.');
const validation = spawnSync(process.execPath,
  ['--test', 'tests/unit/payroll-employee.test.mjs', 'tests/unit/schema.test.mjs'], { stdio: 'inherit' });
if (validation.error) throw validation.error;
if (validation.status !== 0) throw new Error('Build and pass payroll/schema tests before applying.');
const sql = await readFile(new URL(migration === '015' ? '../migrations/015_employee_payroll.sql'
  : '../migrations/016_payroll_replacements_cash_bonus.sql', import.meta.url), 'utf8');
const statements = [];
let delimiter = ';', buffer = '';
for (const line of sql.split('\n')) {
  if (line.trim().startsWith('--')) continue;
  if (line.startsWith('DELIMITER ')) { delimiter = line.trim().slice(10); continue; }
  buffer += line + '\n';
  if (buffer.trimEnd().endsWith(delimiter)) {
    statements.push(buffer.trimEnd().slice(0, -delimiter.length).trim()); buffer = '';
  }
}
if (buffer.trim()) throw new Error('Unterminated migration SQL.');
const connection = await mysql.createConnection({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, database,
});
try {
  const [[server]] = await connection.query('SELECT DATABASE() AS name,VERSION() AS version');
  if (server.name !== database) throw new Error('Database identity mismatch.');
  const maria = server.version.includes('MariaDB');
  const [major, minor] = server.version.split('.').map(Number);
  if ((maria && (major < 10 || (major === 10 && minor < 11))) || (!maria && major < 8)) {
    throw new Error('Payroll requires MariaDB 10.11+ or MySQL 8+.');
  }
  if (migration === '016' && !maria) throw new Error('Forward 016 currently requires MariaDB 10.11+ (repeatable ALTER/INDEX syntax).');
  const [[upgraded]] = await connection.query(`SELECT COUNT(*) AS n FROM information_schema.TABLES
    WHERE TABLE_SCHEMA=? AND TABLE_NAME='tbl_employee_payroll_coverage'`, [database]);
  if (migration === '015' && Number(upgraded.n) > 0) throw new Error('016 is installed; refusing to downgrade payroll views/routines with 015.');
  const requiredColumns = [['tbl_detalle_ruta', 'str_estado'], ['tbl_descripcion', 'dec_abono'],
    ['tbl_tarjetas', 'dec_prestamo'], ['tbl_nomina', 'idempleado']];
  if (migration === '016') requiredColumns.push(
    ['tbl_employee_payroll_vacation', 'employee_id'], ['tbl_employee_payroll_bonus', 'amount'],
    ['tbl_employee_payroll_contract', 'effective_date'], ['tbl_employee_payroll_snapshot', 'weight'],
    ['tbl_employee_payroll_request', 'payload_hash'], ['tbl_employee_payroll_route', 'branch_id'],
    ...['idsucursal', 'iddetalleruta', 'str_detalle', 'str_nombre', 'str_estado', 'str_operacion',
      'created_empleado_id', 'update_at'].map((column) => ['tbl_contabilidad_detalle', column]),
    ['tbl_detalle_nomina', 'str_tipo'], ['tbl_detalle_nomina', 'str_estado'],
    ['tbl_auth', 'str_nombre'], ['tbl_auths', 'idauth_sucursal'], ['tbl_auth_sucursal', 'str_estado']);
  const tables = [...new Set(requiredColumns.map(([table]) => table))];
  const [columns] = await connection.query(`SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=? AND TABLE_NAME IN (${tables.map(() => '?').join(',')})`, [database, ...tables]);
  for (const [table, column] of requiredColumns) {
    if (!columns.some((row) => row.TABLE_NAME === table && row.COLUMN_NAME === column)) {
      throw new Error(`Missing required legacy column: ${table}.${column}`);
    }
  }
  if (migration === '016') {
    const [routines] = await connection.query(`SELECT ROUTINE_NAME FROM information_schema.ROUTINES
      WHERE ROUTINE_SCHEMA=?`, [database]);
    for (const name of ['sp_employee_payroll_summary', 'sp_employee_payroll_snapshot', 'sp_employee_payroll_change']) {
      if (!routines.some((row) => row.ROUTINE_NAME === name)) {
        throw new Error(`Cannot verify prerequisite routine ${name}: it is absent or not visible to this database account in information_schema.ROUTINES. No migration applied. Use explicit administrative migrator credentials with routine metadata visibility and required DDL privileges; have that administrator verify 015 installation before retrying. Do not reapply 015 solely because of this visibility failure.`);
      }
    }
  }
  if (!apply) {
    console.log(`Dry run OK: ${statements.length} statements; no changes applied. Review migration and use explicit confirmations to apply.`);
  } else {
    for (let index = 0; index < statements.length; index++) {
      try { await connection.query(statements[index]); }
      catch (error) {
        console.error(`Stopped at statement ${index + 1}; prior DDL may be committed. Fix cause, then rerun the idempotent migration.`);
        throw error;
      }
    }
    console.log(`Payroll migration ${migration} applied. Configure prospective contracts before new dispatches; no history was backfilled.`);
  }
} finally { await connection.end(); }
