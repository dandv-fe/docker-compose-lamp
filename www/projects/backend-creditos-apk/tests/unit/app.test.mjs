import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

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
