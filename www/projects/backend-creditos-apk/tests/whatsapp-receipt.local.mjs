// Explicit local-only verification of migration 010 and RECORD_WHATSAPP_RECEIPT. Never part of
// npm test or startup. All fixtures live in an otherwise empty synthetic company and are removed.
// Usage: node tests/whatsapp-receipt.local.mjs <verified-local-container-hostname> [--apply]
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { createApp } from '../dist/app.js';
import { pool } from '../dist/db.js';
import { applyOfflineOperation } from '../dist/services/operations.js';
import { issueReceiptLink, receiptLinks, revokeReceiptLink } from '../dist/services/receiptLinks.js';

const conn = await pool.getConnection();
let fixturesStarted = false;
const company = -2000000010;
const employeeA = company, employeeB = company + 1;
const tables = ['mobile_whatsapp_receipt_link', 'mobile_whatsapp_receipt_open', 'tbl_descripcion', 'tbl_tarjetas', 'tbl_detalle_ruta',
  'tbl_clientes', 'tbl_auth_sucursal', 'tbl_sucursal', 'tbl_empleado', 'tbl_persona',
  'mobile_customer_phone', 'mobile_operation', 'mobile_change_event'];
try {
  const [target] = await conn.query('SELECT DATABASE() AS db,@@hostname AS host');
  assert.equal(target[0].db, 'websdnco_db_webgoez', 'Only the development database is allowed');
  assert.ok(process.argv[2], 'Pass the hostname obtained directly from webgoez-mariadb10');
  assert.equal(target[0].host, process.argv[2], 'Not the verified local MariaDB container');
  if (process.argv.includes('--apply')) {
    for (const version of ['010_whatsapp_receipt_open.sql', '011_whatsapp_receipt_links.sql']) {
      const migration = await readFile(new URL(`../migrations/${version}`, import.meta.url), 'utf8');
      const statements = migration.split('\n').filter(line => !line.startsWith('--')).join('\n')
        .split(';').map(sql => sql.trim()).filter(Boolean);
      for (let run = 0; run < 2; run++) for (const sql of statements) await conn.query(sql);
    }
    console.log('Migrations 010 and 011 applied twice successfully to the verified LOCAL container.');
  }
  const [occupied] = await conn.query(
    `SELECT ${tables.map(table => `(SELECT COUNT(*) FROM ${table} WHERE idglobal=?)`).join('+')}
      + (SELECT COUNT(*) FROM tbl_empleado WHERE idempleado IN (?,?))
      + (SELECT COUNT(*) FROM tbl_persona WHERE idpersona IN (?,?)) AS count`,
    [...Array(tables.length).fill(company), employeeA, employeeB, employeeA, employeeB]);
  assert.equal(Number(occupied[0].count), 0, 'Receipt fixture company is occupied');
  fixturesStarted = true;
  await verify();
} finally {
  if (fixturesStarted) await cleanup();
  conn.release();
  await pool.end();
}

async function cleanup() {
  await conn.rollback().catch(() => undefined);
  await conn.beginTransaction();
  try {
    for (const table of tables) await conn.query(`DELETE FROM ${table} WHERE idglobal=?`, [company]);
    await conn.commit();
  } catch (error) { await conn.rollback(); throw error; }
  const [remaining] = await conn.query(
    `SELECT ${tables.map(table => `(SELECT COUNT(*) FROM ${table} WHERE idglobal=?)`).join('+')} AS count`,
    Array(tables.length).fill(company));
  assert.equal(Number(remaining[0].count), 0, 'Committed fixture cleanup failed');
  console.log('Committed receipt fixtures removed; no customer data retained.');
}

async function verify() {
  const context = (employee, companyId = company) => ({ user: {
    userId: employee, companyId, employeeId: employee, cargo: 'Cobrador', employeeMaxCredit: '0',
    username: 'RECEIPT-TEST', firstName: 'TEST', lastName: 'FIXTURE', companyName: 'FIXTURE',
  }, permissions: [] });
  await conn.beginTransaction();
  for (const employee of [employeeA, employeeB]) {
    await conn.query(
      `INSERT INTO tbl_persona
       (idpersona,idglobal,str_nombres,str_apellidos,str_sexo,str_tipo_documento,str_num_documento,
        str_telefono,str_email,str_foto,str_ocupacion,str_estado,str_nota,str_email_verificado,
        str_direccion_departamento,str_direccion_ciudad,str_direccion_barrio,str_direccion_calle)
       VALUES (?,?,'COLLECTOR TEST','FIXTURE','','TEST',?,'','','','','activo','','','','','','')`,
      [employee, company, `RECEIPT-COLLECTOR-${employee}`]);
    await conn.query(
      `INSERT INTO tbl_empleado
       (idempleado,idglobal,idpersona,str_apodo,str_cargo,str_estado,str_comentarios,date_fecha_inicio,idoficina,dec_max_credito)
       VALUES (?,?,?,'','Cobrador','activo','','2026-10-02',?,0)`, [employee, company, employee, company]);
  }
  const branches = [];
  for (let i = 0; i < 2; i++) {
    const [inserted] = await conn.query(
      `INSERT INTO tbl_sucursal (idglobal,str_tipo,str_codigo,str_telefono,idempleado,str_logo,str_estado,idoficina)
       VALUES (?,'ruta','RECEIPT-TEST','',?,'','activo',?)`, [company, employeeA, company]);
    branches.push(inserted.insertId);
    for (const employee of i === 0 ? [employeeA] : [employeeA, employeeB]) {
      await conn.query(
        `INSERT INTO tbl_auth_sucursal (idglobal,idsucursal,idempleado,tipo_usuario,str_estado)
         VALUES (?,?,?,'empleado','activo')`, [company, inserted.insertId, employee]);
    }
  }
  const customers = [];
  for (const [doc, phone] of [['RECEIPT-010-A', '3000000001'], ['RECEIPT-010-B', '3000000005']]) {
    const [person] = await conn.query(
      `INSERT INTO tbl_persona
       (idglobal,str_nombres,str_apellidos,str_sexo,str_tipo_documento,str_num_documento,
        str_telefono,str_email,str_foto,str_ocupacion,str_estado,str_nota,str_email_verificado,
        str_direccion_departamento,str_direccion_ciudad,str_direccion_barrio,str_direccion_calle)
       VALUES (?,'RECEIPT TEST','FIXTURE','','TEST',?,?,'','','','activo','','','','','','')`, [company, doc, phone]);
    const [customer] = await conn.query(
      `INSERT INTO tbl_clientes
       (idglobal,idpersona,dec_max_credito,str_apodo,str_nota,str_estado,str_calificacion,created_empleado_id)
       VALUES (?,?,0,'','','activo','',?)`, [company, person.insertId, employeeA]);
    customers.push({ id: customer.insertId, person: person.insertId });
  }
  const [mainCustomer, otherCustomer] = customers;
  // Second saved phone, then back to the first primary; mark the second one INCORRECTO.
  await conn.query('UPDATE tbl_persona SET str_telefono=? WHERE idpersona=?', ['3000000002', mainCustomer.person]);
  await conn.query('UPDATE tbl_persona SET str_telefono=? WHERE idpersona=?', ['3000000001', mainCustomer.person]);
  await conn.query('UPDATE tbl_persona SET str_telefono=? WHERE idpersona=?', ['3000000003', mainCustomer.person]);
  await conn.query('UPDATE tbl_persona SET str_telefono=? WHERE idpersona=?', ['3000000001', mainCustomer.person]);
  await conn.query(
    'UPDATE mobile_customer_phone SET is_invalid=1 WHERE idglobal=? AND idpersona=? AND normalized_phone=?',
    [company, mainCustomer.person, '573000000002']);
  const [route] = await conn.query(
    `INSERT INTO tbl_detalle_ruta (idglobal,idsucursal,idempleado_resibe,str_estado,created_at,updated_at)
     VALUES (?,?,?,'created',NOW(),NOW())`, [company, branches[0], employeeA]);
  // Minutes elapsed since midnight in Bogotá; used to build "1 minute before/after" business midnight.
  const [[{ since }]] = await conn.query(
    `SELECT TIMESTAMPDIFF(MINUTE, DATE(UTC_TIMESTAMP() - INTERVAL 300 MINUTE), UTC_TIMESTAMP() - INTERVAL 300 MINUTE) AS since`);
  const card = async (state, minutesAgo, customer = mainCustomer, branch = branches[0], concept = 'Prestamo') => {
    const id = randomUUID();
    await conn.query(
      `INSERT INTO tbl_tarjetas
       (idtarjeta,idglobal,idsucursal,idcliente,iddetalleruta,str_concepto,dec_valor,str_modo,int_tiempo,
        dec_prestamo,dec_resta,str_descripcion,float_item,dec_utilidad,str_c_adicional_numero,dec_c_adicional_valor,
        str_tipo_comprobante,str_serie,str_numero,str_nota,str_abono,str_style,str_estado,created_empleado_id,created_at,updated_at)
       VALUES (?,?,?,?,?,?,120000,'Semanal',4,100000,120000,'',1,20000,'',0,'Ticket','TEST','42','','','',?,?,
               NOW() - INTERVAL ? MINUTE,NOW())`,
      [id, company, branch, customer.id, route.insertId, concept, state, employeeA, minutesAgo]);
    return id;
  };
  const payment = async (creditId, state, minutesAgo, description = 'Abono', branch = branches[0]) => {
    const id = randomUUID();
    await conn.query(
      `INSERT INTO tbl_descripcion
       (iddescripcion,idglobal,idsucursal,idtarjeta,iddetalleruta,dec_abono,str_descripcion,str_estado,idusuario,str_origen,created_at,updated_at)
       VALUES (?,?,?,?,?,-30000,?,?,?,'android',NOW() - INTERVAL ? MINUTE,NOW())`,
      [id, company, branch, creditId, route.insertId, description, state, employeeA, minutesAgo]);
    return id;
  };
  const cards = {
    today: await card('created', 0),
    entregando: await card('entregando', 0),
    saved: await card('saved', 0),
    yesterday: await card('created', 24 * 60),
    beforeBusinessMidnight: await card('created', Number(since) + 1),
    afterBusinessMidnight: Number(since) >= 2 ? await card('created', Number(since) - 1) : null,
    otherCustomer: await card('created', 0, otherCustomer),
    article: await card('created', 0, mainCustomer, branches[0], 'Articulo'),
  };
  const payments = {
    today: await payment(cards.today, 'created', 0),
    entregando: await payment(cards.entregando, 'entregando', 0),
    yesterday: await payment(cards.today, 'created', 24 * 60),
    saved: await payment(cards.saved, 'saved', 0),
    initial: await payment(cards.article, 'created', 0, 'Inicial'),
  };
  await conn.query(
    "UPDATE tbl_tarjetas SET str_descripcion='Nevera de prueba',dec_resta=90000 WHERE idtarjeta=?",
    [cards.article]);
  await conn.commit();

  const counts = async () => {
    const [phones] = await conn.query(
      'SELECT normalized_phone,whatsapp_open_count,is_invalid FROM mobile_customer_phone WHERE idglobal=? AND idpersona=? ORDER BY normalized_phone',
      [company, mainCustomer.person]);
    const [records] = await conn.query(
      'SELECT record_kind,record_id,idsucursal,open_count,last_opened_by FROM mobile_whatsapp_receipt_open WHERE idglobal=? ORDER BY record_kind,record_id',
      [company]);
    const [primary] = await conn.query('SELECT str_telefono FROM tbl_persona WHERE idpersona=?', [mainCustomer.person]);
    return { phones: phones.map(p => `${p.normalized_phone}:${p.whatsapp_open_count}:${p.is_invalid}`), records, primary: primary[0].str_telefono };
  };
  const recordCount = (snapshot, kind, id) =>
    Number(snapshot.records.find(r => r.record_kind === kind && r.record_id === id)?.open_count ?? 0);
  const phoneCount = (snapshot, phone) => Number(snapshot.phones.find(p => p.startsWith(phone)).split(':')[1]);
  const open = (tipo, registroId, telefono, extra = {}, auth = context(employeeA)) => applyOfflineOperation(auth, {
    operationId: randomUUID(), branchId: branches[0], entityId: String(mainCustomer.id), kind: 'RECORD_WHATSAPP_RECEIPT',
    baseVersion: null, payload: { tipo, registroId, ...(telefono === undefined ? {} : { telefono }) }, ...extra,
  });
  const refused = { extensions: { code: 'RECEIPT_NOT_ELIGIBLE' } };

  const start = await counts();
  const firstId = randomUUID();
  const first = await open('credit', cards.today, '573000000001', { operationId: firstId });
  assert.equal(first.status, 'applied');
  assert.deepEqual(Object.keys(first.data).sort(), ['id', 'phone', 'phones'], 'Result never carries the hidden counter');
  assert.doesNotMatch(JSON.stringify(first), /open_count|receipt/i);
  const replay = await open('credit', cards.today, '573000000001', { operationId: firstId });
  assert.equal(replay.replayed, true);
  let now = await counts();
  assert.equal(recordCount(now, 'credit', cards.today), 1, 'Replay of the same operation counts once');
  assert.equal(phoneCount(now, '573000000001'), phoneCount(start, '573000000001') + 1, 'Phone counter moves once too');
  assert.equal(now.records[0].last_opened_by, employeeA);
  await assert.rejects(open('credit', cards.today, '573000000003', { operationId: firstId }),
    { extensions: { code: 'IDEMPOTENCY_MISMATCH' } });

  await open('credit', cards.today, null);
  await open('credit', cards.today);
  now = await counts();
  assert.equal(recordCount(now, 'credit', cards.today), 3, 'External contact pick counts the record only');
  assert.equal(phoneCount(now, '573000000001'), phoneCount(start, '573000000001') + 1);
  await open('credit', cards.entregando, '573000000003');
  await open('payment', payments.today, '573000000001');
  await open('payment', payments.entregando, null);
  if (cards.afterBusinessMidnight) await open('credit', cards.afterBusinessMidnight, null);

  const before = await counts();
  for (const [tipo, id, why] of [
    ['credit', cards.saved, /estado saved/], ['credit', cards.yesterday, /no se creó hoy/],
    ['credit', cards.beforeBusinessMidnight, /no se creó hoy/],
    ['credit', cards.otherCustomer, /no existe/], ['credit', payments.today, /no existe/],
    ['payment', cards.today, /no existe/], ['payment', payments.yesterday, /no se creó hoy/],
    ['payment', payments.saved, /estado saved/], ['payment', payments.initial, /cuota inicial/],
    ['credit', randomUUID(), /no existe/],
  ]) {
    await assert.rejects(open(tipo, id, '573000000001'), { ...refused, message: why }, `${tipo} ${why}`);
  }
  await assert.rejects(open('credit', cards.today, '573000000001', { branchId: branches[1] }), refused,
    'A card from another branch is never counted');
  await assert.rejects(open('credit', cards.today, '573000000002'), { extensions: { code: 'VALIDATION_ERROR' } },
    'INCORRECTO phone is refused, no fallback');
  await assert.rejects(open('credit', cards.today, '573000000009'), { extensions: { code: 'NOT_FOUND' } });
  await assert.rejects(open('credit', cards.today, '573000000001', {}, context(employeeB)),
    { extensions: { code: 'FORBIDDEN' } }, 'Branch access is still mandatory');
  await assert.rejects(open('credit', cards.today, '573000000001', {}, context(employeeA, company - 1)),
    { extensions: { code: 'FORBIDDEN' } });
  await assert.rejects(open('credit', cards.today, '573000000001', { entityId: String(otherCustomer.id) }), refused,
    'Record must belong to the customer in entityId');
  assert.deepEqual(await counts(), before, 'Refused openings change no counter, flag or primary');

  now = await counts();
  assert.equal(recordCount(now, 'credit', cards.entregando), 1);
  assert.equal(recordCount(now, 'payment', payments.today), 1);
  assert.equal(recordCount(now, 'payment', payments.entregando), 1);
  assert.equal(phoneCount(now, '573000000003'), phoneCount(start, '573000000003') + 1);
  assert.equal(phoneCount(now, '573000000001'), phoneCount(start, '573000000001') + 2);
  assert.equal(now.primary, start.primary, 'Opening never changes the primary phone');
  assert.deepEqual(now.phones.map(p => p.split(':')[2]), start.phones.map(p => p.split(':')[2]), 'Validity flags untouched');
  assert.ok(now.records.every(r => r.idsucursal === branches[0]));
  const [events] = await conn.query(
    "SELECT COUNT(*) AS n FROM mobile_change_event WHERE idglobal=? AND action='WA_OPEN' AND record_type<>'customer'", [company]);
  assert.equal(Number(events[0].n), 0, 'Receipt openings only publish customer WA_OPEN events');
  await verifyReceiptLinks();
  console.log(`Receipt openings verified: replay once, phone+record counted together, contact-pick counts record only, ` +
    `entregando/payment allowed, saved/yesterday/business-midnight(${cards.afterBusinessMidnight ? 'both sides' : 'before side'})/` +
    `other customer/other branch/wrong kind/initial/INCORRECTO/unknown phone/forbidden refused with no counter change.`);

  async function verifyReceiptLinks() {
    const previousEnvironment = {
      nodeEnv: process.env.NODE_ENV,
      receiptOrigin: process.env.PUBLIC_RECEIPT_ORIGIN,
    };
    process.env.NODE_ENV = 'test';
    const server = createApp().listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    process.env.PUBLIC_RECEIPT_ORIGIN = `http://127.0.0.1:${address.port}`;
    const testAuth = context(employeeA);
    let committedLinkId;
    try {
      await assert.rejects(issueReceiptLink(context(employeeB), {
        branchId: branches[0], customerId: mainCustomer.id, kind: 'credit',
        recordId: cards.article, format: 'ticket',
      }), { extensions: { code: 'FORBIDDEN' } }, 'A user without branch access cannot issue a public link');

      const issued = await issueReceiptLink(testAuth, {
        branchId: branches[0], customerId: mainCustomer.id, kind: 'credit',
        recordId: cards.article, format: 'cartulina',
      });
      committedLinkId = issued.id;
      assert.match(issued.url, /^http:\/\/127\.0\.0\.1:\d+\/comprobante\/[A-Za-z0-9_-]{43}$/);
      assert.ok(Date.parse(issued.expiresAt) - Date.now() > 29 * 24 * 60 * 60 * 1000);
      assert.ok(Date.parse(issued.expiresAt) - Date.now() < 31 * 24 * 60 * 60 * 1000);
      const token = issued.url.split('/').at(-1);
      const [stored] = await conn.query(
        'SELECT token_hash,snapshot_json,expires_at,revoked_at FROM mobile_whatsapp_receipt_link WHERE id=?',
        [issued.id]);
      assert.equal(Buffer.from(stored[0].token_hash).compare(createHash('sha256').update(token, 'ascii').digest()), 0);
      assert.equal(stored[0].revoked_at, null);
      const snapshot = typeof stored[0].snapshot_json === 'string'
        ? JSON.parse(stored[0].snapshot_json) : stored[0].snapshot_json;
      assert.equal(snapshot.description, 'Nevera de prueba');
      assert.equal(snapshot.initialAmount, '30000.00');
      assert.equal(snapshot.initialBankAmount, '0.00');
      assert.equal(snapshot.initialCashAmount, '30000.00');
      assert.equal(snapshot.balanceAtIssue, '90000.00');
      assert.doesNotMatch(JSON.stringify(snapshot), /documentNumber|phone|address|userId/i);
      await assert.rejects(receiptLinks(context(employeeB), branches[0]),
        { extensions: { code: 'FORBIDDEN' } }, 'Link management is scoped to authorized branches');
      const visibleLinks = await receiptLinks(testAuth, branches[0]);
      const listedLink = visibleLinks.receiptLinks.find(link => link.id === issued.id);
      assert.equal(listedLink.receiptNumber, '42');
      assert.equal(listedLink.format, 'cartulina');
      assert.doesNotMatch(JSON.stringify(listedLink), new RegExp(token));

      const pageResponse = await fetch(issued.url);
      assert.equal(pageResponse.status, 200);
      assert.equal(pageResponse.headers.get('cache-control'), 'no-store, private, max-age=0');
      assert.equal(pageResponse.headers.get('referrer-policy'), 'no-referrer');
      assert.match(pageResponse.headers.get('content-security-policy'), /default-src 'none'/);
      const page = await pageResponse.text();
      assert.match(page, /Nevera de prueba/);
      assert.match(page, /CUOTA inicial recibida|Cuota inicial recibida/);
      assert.match(page, /No es factura electrónica/);
      assert.match(page, /Descargar imagen PNG/);
      assert.doesNotMatch(page, /<script|<img|fonts\.google|analytics/i);

      const imageResponse = await fetch(`${issued.url}/imagen`);
      assert.equal(imageResponse.status, 200);
      assert.match(imageResponse.headers.get('content-type'), /^image\/png/);
      assert.equal(imageResponse.headers.get('content-disposition'), 'attachment; filename="comprobante.png"');
      const png = Buffer.from(await imageResponse.arrayBuffer());
      assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      const image = await sharp(png).metadata();
      assert.equal(image.format, 'png');
      assert.equal(image.width, 760);
      assert.ok(image.height > 500 && image.height <= 6000);

      await conn.query("UPDATE tbl_tarjetas SET str_descripcion='CAMBIO POSTERIOR',dec_resta=1 WHERE idtarjeta=?",
        [cards.article]);
      const unchanged = await (await fetch(issued.url)).text();
      assert.match(unchanged, /Nevera de prueba/);
      assert.match(unchanged, /\$ 90\.000,00 COP/);
      assert.doesNotMatch(unchanged, /CAMBIO POSTERIOR|\$ 1,00 COP/);

      const paymentLink = await issueReceiptLink(testAuth, {
        branchId: branches[0], customerId: mainCustomer.id, kind: 'payment',
        recordId: payments.today, format: 'factura',
      });
      const paymentPage = await (await fetch(paymentLink.url)).text();
      assert.match(paymentPage, /Abono registrado/);
      assert.match(paymentPage, /Saldo al emitir este comprobante/);
      assert.match(paymentPage, /\$ 30\.000,00 COP/);
      await conn.query(
        'UPDATE mobile_whatsapp_receipt_link SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE id=?',
        [paymentLink.id]);
      assert.equal((await fetch(paymentLink.url)).status, 404, 'Expired bearer links are inaccessible');
      assert.ok(!(await receiptLinks(testAuth, branches[0])).receiptLinks.some(link => link.id === paymentLink.id));
      await revokeReceiptLink(testAuth, branches[0], issued.id);
      for (const url of [issued.url, `${issued.url}/imagen`]) {
        const unavailable = await fetch(url);
        assert.equal(unavailable.status, 404);
        assert.match(await unavailable.text(), /Comprobante no disponible/);
      }
      assert.ok(!(await receiptLinks(testAuth, branches[0])).receiptLinks.some(link => link.id === issued.id));
      await revokeReceiptLink(testAuth, branches[0], paymentLink.id);
      console.log('Receipt links verified locally: scoped issuance, SHA-256-only token storage, fixed article/payment snapshots, PNG download, and revocation.');
    } finally {
      if (committedLinkId) await revokeReceiptLink(testAuth, branches[0], committedLinkId).catch(() => undefined);
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      if (previousEnvironment.nodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousEnvironment.nodeEnv;
      if (previousEnvironment.receiptOrigin === undefined) delete process.env.PUBLIC_RECEIPT_ORIGIN;
      else process.env.PUBLIC_RECEIPT_ORIGIN = previousEnvironment.receiptOrigin;
    }
  }
}
