import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { graphql, parse, validate } from 'graphql';
import { pool } from '../../dist/db.js';
import { schema } from '../../dist/graphql/schema.js';
import {
  appInstallations, appInstallationsQuery, mobileAppPolicy, reportAppInstallation,
} from '../../dist/services/mobileApp.js';

const user = { userId: 4, companyId: 7, employeeId: 31, cargo: 'Cobrador' };
const context = { user };
const errorCode = code => ({ extensions: { code } });
async function withPool(execute, run) {
  const original = pool.execute;
  pool.execute = execute;
  try { await run(); } finally { pool.execute = original; }
}

test('mobile policy defaults only missing environment configuration', () => {
  assert.deepEqual(mobileAppPolicy({}), {
    latestVersionCode: 1, minimumVersionCode: 1, latestVersionName: '0.1.0', downloadUrl: '', message: '',
  });
  assert.deepEqual(mobileAppPolicy({
    MOBILE_APP_LATEST_VERSION_CODE: '23', MOBILE_APP_MIN_VERSION_CODE: '12',
    MOBILE_APP_LATEST_VERSION_NAME: '1.2.3', MOBILE_APP_DOWNLOAD_URL: 'https://example.com/app.apk?release=23',
    MOBILE_APP_UPDATE_MESSAGE: 'Actualiza para crear nuevos registros.',
  }), {
    latestVersionCode: 23, minimumVersionCode: 12, latestVersionName: '1.2.3',
    downloadUrl: 'https://example.com/app.apk?release=23', message: 'Actualiza para crear nuevos registros.',
  });
});

test('mandatory updates require an HTTPS download location while staged rollout remains compatible', () => {
  const staged = {
    MOBILE_APP_LATEST_VERSION_CODE: '2', MOBILE_APP_MIN_VERSION_CODE: '1',
    MOBILE_APP_LATEST_VERSION_NAME: '0.2.0',
  };
  assert.equal(mobileAppPolicy(staged).downloadUrl, '');
  assert.equal(mobileAppPolicy({ ...staged, MOBILE_APP_DOWNLOAD_URL: '' }).minimumVersionCode, 1);
  const mandatory = { ...staged, MOBILE_APP_MIN_VERSION_CODE: '2' };
  for (const downloadUrl of [undefined, '', ' ', 'http://example.com/app.apk']) {
    assert.throws(() => mobileAppPolicy({ ...mandatory, MOBILE_APP_DOWNLOAD_URL: downloadUrl }),
      errorCode('CONFIGURATION_ERROR'));
  }
  const policy = mobileAppPolicy({ ...mandatory, MOBILE_APP_DOWNLOAD_URL: 'https://example.com/app.apk' });
  assert.equal(policy.minimumVersionCode, 2);
  assert.equal(policy.downloadUrl, 'https://example.com/app.apk');
});

test('invalid configuration fails explicitly rather than silently falling back', () => {
  for (const key of ['MOBILE_APP_LATEST_VERSION_CODE', 'MOBILE_APP_MIN_VERSION_CODE']) {
    for (const value of ['', '0', '-1', '1.5', '1x', 'NaN', 'Infinity', ' 1', '1 ', '+1', '01', '2147483648']) {
      assert.throws(() => mobileAppPolicy({ [key]: value }), errorCode('CONFIGURATION_ERROR'), `${key}=${value}`);
    }
  }
  assert.throws(() => mobileAppPolicy({
    MOBILE_APP_LATEST_VERSION_CODE: '2', MOBILE_APP_MIN_VERSION_CODE: '3',
  }), errorCode('CONFIGURATION_ERROR'));
  for (const url of [
    'http://example.com/app.apk', 'file:///app.apk', '/app.apk', 'https://', 'invalid',
    'https://name:password@example.com/app.apk', ' https://example.com/app.apk',
    'https://example.com\\app.apk', 'https://example.com/app.apk\n',
  ]) {
    assert.throws(() => mobileAppPolicy({ MOBILE_APP_DOWNLOAD_URL: url }), errorCode('CONFIGURATION_ERROR'));
  }
  for (const name of ['', ' ', 'x'.repeat(81), '1.0\n']) {
    assert.throws(() => mobileAppPolicy({ MOBILE_APP_LATEST_VERSION_NAME: name }), errorCode('CONFIGURATION_ERROR'));
  }
});

test('GraphQL public policy and authenticated installation API have exact bounded contract', async () => {
  assert.deepEqual(validate(schema, parse(`
    query MobilePolicyAndInventory {
      mobileAppPolicy { latestVersionCode minimumVersionCode latestVersionName downloadUrl message }
      appInstallations { installationId userId employeeId employeeName versionCode versionName lastSeenAt }
    }
    mutation ReportInstallation {
      reportAppInstallation(installationId: "test-device", versionCode: 2, versionName: "0.2.0")
    }
  `)), []);
  const queries = schema.getQueryType().getFields();
  const mutation = schema.getMutationType().getFields().reportAppInstallation;
  assert.equal(queries.mobileAppPolicy.type.toString(), 'MobileAppPolicy!');
  assert.equal(queries.appInstallations.type.toString(), '[AppInstallation!]!');
  assert.equal(queries.appInstallations.args.length, 0);
  assert.equal(mutation.type.toString(), 'Boolean!');
  assert.deepEqual(mutation.args.map(arg => [arg.name, String(arg.type)]), [
    ['installationId', 'String!'], ['versionCode', 'Int!'], ['versionName', 'String!'],
  ]);
  const publicResult = await graphql({
    schema, source: '{ mobileAppPolicy { latestVersionCode minimumVersionCode } }', contextValue: { auth: null },
  });
  assert.equal(publicResult.errors, undefined);
  assert.ok(publicResult.data.mobileAppPolicy.latestVersionCode > 0);
  for (const source of [
    '{ appInstallations { userId } }',
    'mutation { reportAppInstallation(installationId: "x", versionCode: 1, versionName: "0.1.0") }',
  ]) {
    const result = await graphql({ schema, source, contextValue: { auth: null } });
    assert.equal(result.errors[0].extensions.code, 'UNAUTHENTICATED');
  }
});

test('installation reports validate input before database access', async () => {
  await withPool(() => { throw new Error('Must not reach database'); }, async () => {
    for (const [id, code, name] of [
      ['', 1, '1'], ['x'.repeat(121), 1, '1'], ['x y', 1, '1'],
      ['x', 0, '1'], ['x', -1, '1'], ['x', 1.5, '1'], ['x', 2147483648, '1'],
      ['x', 1, ''], ['x', 1, ' '], ['x', 1, 'x'.repeat(81)], ['x', 1, '1\n'],
    ]) {
      await assert.rejects(reportAppInstallation(context, id, code, name), errorCode('VALIDATION_ERROR'));
    }
    await assert.rejects(reportAppInstallation(null, 'x', 1, '1'), errorCode('UNAUTHENTICATED'));
    await assert.rejects(appInstallations(null), errorCode('UNAUTHENTICATED'));
  });
});

test('reports are upserts scoped to authenticated company/user and allow old versions and downgrades', async () => {
  const reports = new Map();
  await withPool(async (sql, params) => {
    assert.match(sql, /INSERT INTO mobile_app_installation/);
    assert.match(sql, /ON DUPLICATE KEY UPDATE version_code=VALUES\(version_code\)/);
    assert.match(sql, /last_seen_at=UTC_TIMESTAMP\(3\)/);
    const [company, userId, installationId, versionCode, versionName] = params;
    reports.set(`${company}/${userId}/${installationId}`, { versionCode, versionName });
    return [{ affectedRows: 1 }, []];
  }, async () => {
    assert.equal(await reportAppInstallation(context, 'uuid-1', 3, '0.3.0'), true);
    assert.equal(await reportAppInstallation(context, 'uuid-1', 1, '0.1.0'), true);
    await reportAppInstallation({ user: { ...user, userId: 5 } }, 'uuid-1', 2, '0.2.0');
    await reportAppInstallation({ user: { ...user, companyId: 8 } }, 'uuid-1', 4, '0.4.0');
    assert.equal(reports.size, 3);
    assert.deepEqual(reports.get('7/4/uuid-1'), { versionCode: 1, versionName: '0.1.0' });
  });
});

test('listing reuses company-bound office employee scope; only super administrators bypass user/office filtering', async () => {
  for (const cargo of ['Cobrador', 'Administrador', null]) {
    const query = appInstallationsQuery({ ...user, cargo });
    assert.deepEqual(query.params, [7, 4, 31]);
    assert.match(query.sql, /WHERE i\.idglobal=\?/);
    assert.match(query.sql, /i\.idusuario=\? OR EXISTS/);
    assert.match(query.sql, /o\.idglobal=i\.idglobal AND o\.idoficina=e\.idoficina AND o\.idempleado_administrador=\?/);
    assert.match(query.sql, /e\.idpersona=u\.idpersona AND e\.idglobal=u\.idglobal/);
    assert.match(query.sql, /ORDER BY i\.last_seen_at DESC, i\.idusuario, i\.installation_id\s+LIMIT 100/);
  }
  assert.deepEqual(appInstallationsQuery({ ...user, employeeId: null }).params, [7, 4, -1]);
  const admin = { user: { ...user, cargo: 'Super Administrador' } };
  const query = appInstallationsQuery(admin.user);
  assert.deepEqual(query.params, [7]);
  assert.doesNotMatch(query.sql, /OR EXISTS/);
  const rows = [{ installationId: 'uuid-1', userId: 4, employeeId: null, employeeName: null,
    versionCode: 1, versionName: '0.1.0', lastSeenAt: '2026-10-12T15:00:00.000000Z' }];
  await withPool(async (sql, params) => {
    assert.equal(sql, query.sql);
    assert.deepEqual(params, query.params);
    return [rows, []];
  }, async () => { assert.deepEqual(await appInstallations(admin), rows); });
});

test('both installation endpoints explicitly identify missing manual migration; other failures are not masked', async () => {
  await withPool(async () => { throw Object.assign(new Error('missing table'), { code: 'ER_NO_SUCH_TABLE' }); }, async () => {
    for (const promise of [reportAppInstallation(context, 'uuid', 1, '1'), appInstallations(context)]) {
      await assert.rejects(promise, error => error.extensions.code === 'CONFIGURATION_ERROR'
        && error.message.includes('migrations/012_app_installations.sql'));
    }
  });
  const unexpected = Object.assign(new Error('unavailable'), { code: 'ECONNREFUSED' });
  await withPool(async () => { throw unexpected; }, async () => {
    await assert.rejects(appInstallations(context), error => error === unexpected);
  });
});

test('migration is additive and separates installations across company/user scopes with binary identifiers', async () => {
  const sql = await readFile(new URL('../../migrations/012_app_installations.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS `mobile_app_installation`/);
  assert.match(sql, /PRIMARY KEY \(`idglobal`, `idusuario`, `installation_id`\)/);
  assert.match(sql, /CHARACTER SET ascii COLLATE ascii_bin/);
  assert.match(sql, /`last_seen_at` DATETIME\(3\) NOT NULL/);
  assert.match(sql, /CHECK \(`version_code` > 0\)/);
  assert.doesNotMatch(sql, /^\s*(DROP|ALTER|DELETE|UPDATE)\b/im);
});
