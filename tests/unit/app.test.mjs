import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import { pool } from '../../dist/db.js';

process.env.NODE_ENV = 'test';
const { createApp } = await import('../../dist/app.js');

test('Express health and GraphQL validation routes work without a database connection', async () => {
  const server = createApp().listen(0);
  await once(server, 'listening');
  const address = server.address();
  try {
    const health = await fetch(`http://127.0.0.1:${address.port}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });

    const response = await fetch(`http://127.0.0.1:${address.port}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ unknownField }' }),
    });
    const body = await response.json();
    assert.ok(Array.isArray(body.errors));
    assert.equal(body.errors[0].extensions.code, 'VALIDATION_ERROR');
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('production blocks plaintext GraphQL while retaining the internal health endpoint', async () => {
  process.env.NODE_ENV = 'production';
  const server = createApp().listen(0);
  await once(server, 'listening');
  const address = server.address();
  try {
    const health = await fetch(`http://127.0.0.1:${address.port}/health`);
    assert.equal(health.status, 200);
    const response = await fetch(`http://127.0.0.1:${address.port}/graphql`);
    assert.equal(response.status, 426);
    assert.equal((await response.json()).errors[0].extensions.code, 'FORBIDDEN');
  } finally {
    server.close();
    await once(server, 'close');
    process.env.NODE_ENV = 'test';
  }
});

test('expired company payment returns a distinct 403 for authenticated GraphQL requests', async () => {
  const original = pool.execute;
  const secret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-only-secret-at-least-32-characters-long';
  pool.execute = async (sql) => {
    if (sql.includes('FROM tbl_usuario u')) return [[{
      idusuario: 12, idglobal: 7, idpersona: 3, str_user_name: 'collector',
      str_estado: 'activo', idempleado: 4, str_cargo: 'Cobrador',
      str_nombres: 'Test', str_apellidos: 'User', str_razon_social: 'Company',
    }], []];
    if (sql.includes('FROM tbl_descripcion_global')) {
      return [[{ expiresAt: Date.UTC(2026, 9, 12), expired: 1 }], []];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };
  const server = createApp().listen(0);
  try {
    await once(server, 'listening');
    const token = jwt.sign({ sub: '12', companyId: 7 }, process.env.JWT_SECRET, {
      issuer: 'backend-creditos-apk', audience: 'android-client',
    });
    const response = await fetch(`http://127.0.0.1:${server.address().port}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ query: '{ me { userId } }' }),
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).errors[0].extensions.code, 'PAYMENT_REQUIRED');
  } finally {
    server.close();
    await once(server, 'close');
    pool.execute = original;
    if (secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secret;
  }
});
