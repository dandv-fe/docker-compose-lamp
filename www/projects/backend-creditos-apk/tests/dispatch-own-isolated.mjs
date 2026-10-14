// Invoked only by the isolated PHP fixture; credentials arrive privately on stdin.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
assert.match(input.database, /^payroll_test_dispatch_[A-Za-z0-9_]+$/);
Object.assign(process.env, { DB_HOST: input.host, DB_USER: input.user, DB_PASSWORD: input.password,
  DB_NAME: input.database, DB_POOL_SIZE: '1' });
const { pool } = await import('../dist/db.js');
const { schema } = await import('../dist/graphql/schema.js');
const { graphql } = await import('graphql');
try {
  const context = { auth: { user: { userId: 3, companyId: 1, employeeId: 4, cargo: 'Super Administrador' }, permissions: [] } };
  const response = await graphql({ schema, source: '{ myDispatchChallenges }', contextValue: context });
  assert.equal(response.errors, undefined, response.errors?.map((e) => e.message).join(';'));
  const own = response.data.myDispatchChallenges;
  assert.equal(own.employeeId, 3);
  assert.equal(own.items.length, 1);
  assert.equal(own.items[0].routeId, input.routeId);
  assert.equal(own.items[0].progress.creditedCapital, 500000);
  assert.equal(own.items[0].progress.creditedCollection, 350000);
  assert.equal(own.items[0].goal.otherCommission, 2500);
  assert.equal(own.items[0].forecast.collections.invalidCards, undefined);
  assert.equal(own.items[0].salary.baseAmount, 40000);
  assert.equal(own.items[0].goal.projectedCommission, 26500);
  await pool.execute('UPDATE tbl_dispatch_challenge SET deadline=DATE_ADD(deadline,INTERVAL 1 DAY) WHERE route_id=?', [input.routeId]);
  const nextPeriod = await graphql({ schema, source: '{ myDispatchChallenges }', contextValue: context });
  assert.equal(nextPeriod.errors, undefined);
  assert.equal(nextPeriod.data.myDispatchChallenges.items[0].progress.creditedCapital, 0);
  assert.equal(nextPeriod.data.myDispatchChallenges.items[0].progress.commissionAmount, 0);
  assert.equal(nextPeriod.data.myDispatchChallenges.items[0].goal.projectedCommission, 24000);
  assert.equal(nextPeriod.data.myDispatchChallenges.items[0].salary.baseAmount, 40000);
  await pool.execute('UPDATE tbl_dispatch_challenge SET deadline=DATE_SUB(deadline,INTERVAL 1 DAY) WHERE route_id=?', [input.routeId]);
  await pool.execute("UPDATE tbl_detalle_ruta SET str_estado='entregando' WHERE iddetalleruta=?", [input.routeId]);
  const closed = await graphql({ schema, source: '{ myDispatchChallenges }', contextValue: context });
  assert.equal(closed.data.myDispatchChallenges.items[0].status, 'closed');
  assert.equal(closed.data.myDispatchChallenges.items[0].forecast.status, 'not_applicable');
  await pool.execute("UPDATE tbl_detalle_ruta SET str_estado='created' WHERE iddetalleruta=?", [input.routeId]);
  await pool.execute('UPDATE tbl_dispatch_challenge SET deadline=DATE_SUB(deadline,INTERVAL 1 DAY) WHERE route_id=?', [input.routeId]);
  const expired = await graphql({ schema, source: '{ myDispatchChallenges }', contextValue: context });
  assert.equal(expired.data.myDispatchChallenges.items[0].status, 'expired');
  assert.equal(expired.data.myDispatchChallenges.items[0].forecast.status, 'not_applicable');
  await pool.execute('UPDATE tbl_dispatch_challenge SET deadline=DATE_ADD(deadline,INTERVAL 1 DAY) WHERE route_id=?', [input.routeId]);
  const foreign = await graphql({ schema, source: '{ myDispatchChallenges }',
    contextValue: { auth: { user: { userId: 5, companyId: 2, employeeId: 3 }, permissions: [] } } });
  assert.equal(foreign.errors, undefined);
  assert.equal(foreign.data.myDispatchChallenges.items.length, 0);
  const colleague = await graphql({ schema, source: '{ myDispatchChallenges }',
    contextValue: { auth: { user: { userId: 4, companyId: 1, employeeId: 3 }, permissions: [] } } });
  assert.equal(colleague.errors, undefined);
  assert.equal(colleague.data.myDispatchChallenges.employeeId, 4);
  assert.equal(colleague.data.myDispatchChallenges.items.length, 0);
  await pool.execute("UPDATE tbl_usuario SET str_estado='inactivo' WHERE idusuario=3 AND idglobal=1");
  const inactive = await graphql({ schema, source: '{ myDispatchChallenges }', contextValue: context });
  assert.ok(inactive.errors?.length);
  await pool.execute("UPDATE tbl_usuario SET str_estado='activo' WHERE idusuario=3 AND idglobal=1");
  process.stdout.write(JSON.stringify(own));
} finally { await pool.end(); }
