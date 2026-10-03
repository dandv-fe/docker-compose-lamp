import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { receiptLinkManagementOnly } from '../../dist/app.js';
import { schema } from '../../dist/graphql/schema.js';
import {
  RECEIPT_FORMATS, canonicalReceiptFormat, createReceiptToken, publicReceiptOrigin,
  receiptHtmlEscape, receiptMoney, receiptRows, receiptTokenHash,
} from '../../dist/services/receiptLinks.js';
import { renderReceiptPng } from '../../dist/services/receiptImage.js';

const creditSnapshot = {
  version: 1,
  companyName: 'Compañía de prueba',
  branchName: 'Sucursal norte',
  customerName: 'Cliente & <prueba>',
  kind: 'credit',
  format: 'ticket',
  receiptType: 'Ticket',
  receiptSeries: 'T-1',
  receiptNumber: '0042',
  createdAtLocal: '2026-10-02 15:20:00',
  issuedAt: '2026-10-02T20:20:00.000Z',
  timeZone: 'America/Bogota',
  concept: 'Articulo',
  description: 'Nevera con compresor de prueba',
  totalValue: '600000.00',
  term: 10,
  frequency: 'semanas',
  amount: null,
  initialAmount: '100000.00',
  initialBankAmount: '40000.00',
  initialCashAmount: '60000.00',
  bankAmount: null,
  cashAmount: null,
  balanceAtIssue: '500000.00',
};

test('receipt formats are canonical and only allow Ticket, Factura, or Cartulina', () => {
  assert.deepEqual(RECEIPT_FORMATS, ['ticket', 'factura', 'cartulina']);
  assert.equal(canonicalReceiptFormat('  FACTURA '), 'factura');
  for (const invalid of ['', 'electrónica', 'ticket<script>', 'unknown']) {
    assert.throws(() => canonicalReceiptFormat(invalid), { extensions: { code: 'VALIDATION_ERROR' } });
  }
});

test('public origin is strict and requires HTTPS outside development/test', () => {
  assert.equal(publicReceiptOrigin({ NODE_ENV: 'development', PUBLIC_RECEIPT_ORIGIN: 'http://192.168.1.22:3000' }),
    'http://192.168.1.22:3000');
  assert.equal(publicReceiptOrigin({ NODE_ENV: 'production', PUBLIC_RECEIPT_ORIGIN: 'https://receipts.example.com/' }),
    'https://receipts.example.com');
  assert.equal(publicReceiptOrigin({ NODE_ENV: 'production', PUBLIC_RECEIPT_ORIGIN: 'HTTPS://Receipts.example.com:443' }),
    'https://receipts.example.com');
  for (const origin of [
    undefined, 'ftp://receipts.example.com', 'https://user:pass@example.com',
    'https://example.com/base', 'https://example.com?host=evil', 'https://example.com#fragment',
  ]) {
    assert.throws(() => publicReceiptOrigin({ NODE_ENV: 'production', PUBLIC_RECEIPT_ORIGIN: origin }),
      { extensions: { code: 'CONFIGURATION_ERROR' } });
  }
  assert.throws(() => publicReceiptOrigin({
    NODE_ENV: 'production', PUBLIC_RECEIPT_ORIGIN: 'http://192.168.1.22:3000',
  }), { extensions: { code: 'CONFIGURATION_ERROR' } });
});

test('links use unguessable 256-bit bearer tokens and only persist SHA-256 hashes', () => {
  const first = createReceiptToken();
  const second = createReceiptToken();
  assert.match(first.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(Buffer.byteLength(first.hash), 32);
  assert.deepEqual(first.hash, receiptTokenHash(first.token));
  assert.notEqual(first.hash.toString('ascii'), first.token);
  assert.notEqual(first.token, second.token);
  assert.equal(receiptTokenHash('predictable-id'), null);
});

test('receipt content preserves exact decimal values and escapes text for HTML', () => {
  const rows = receiptRows(creditSnapshot);
  assert.ok(rows.some(([label, value]) => label === 'Valor total' && value === '$ 600.000,00 COP'));
  assert.ok(rows.some(([label, value]) => label === 'Cuota inicial recibida' && value === '$ 100.000,00 COP'));
  assert.ok(rows.some(([label, value]) => label === 'Saldo al emitir este comprobante' && value === '$ 500.000,00 COP'));
  assert.doesNotMatch(JSON.stringify(creditSnapshot), /principal|dec_prestamo|userId|documentNumber|phone|address/i);
  assert.equal(receiptMoney('9007199254740993.27'), '$ 9.007.199.254.740.993,27 COP');
  assert.equal(receiptHtmlEscape('<script a="b">&\'</script>'),
    '&lt;script a=&quot;b&quot;&gt;&amp;&#39;&lt;/script&gt;');
});

test('on-demand renderer returns a decodable PNG with bounded dimensions and required fields', async () => {
  const rows = receiptRows(creditSnapshot);
  for (const required of ['Nevera con compresor de prueba', 'Ticket', '0042', '$ 100.000,00 COP']) {
    assert.ok(rows.some(([, value]) => value.includes(required)), required);
  }
  const png = await renderReceiptPng(creditSnapshot);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const metadata = await sharp(png).metadata();
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, 760);
  assert.ok(metadata.height > 500 && metadata.height <= 6000);
  const decoded = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  assert.ok(decoded.data.some(value => value !== decoded.data[0]), 'Image pixels are not a uniform placeholder');
});

test('migration 011 stores only token hashes and immutable snapshots with revocation and expiry', async () => {
  const sql = await readFile(new URL('../../migrations/011_whatsapp_receipt_links.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS `mobile_whatsapp_receipt_link`/);
  assert.match(sql, /`token_hash` BINARY\(32\) NOT NULL/);
  assert.match(sql, /`snapshot_json` JSON NOT NULL/);
  assert.match(sql, /`expires_at` DATETIME NOT NULL/);
  assert.match(sql, /`revoked_at` DATETIME NULL/);
  assert.match(sql, /ENUM\('ticket','factura','cartulina'\)/);
  assert.doesNotMatch(sql, /^\s*(?:DROP|ALTER|UPDATE|DELETE)\b/im);
});

test('receipt link mutations are present in the authenticated GraphQL contract', () => {
  const mutations = schema.getMutationType().getFields();
  assert.ok(mutations.issueReceiptLink);
  assert.ok(mutations.revokeReceiptLink);
  assert.equal(mutations.revokeReceiptLink.type.toString(), 'Boolean!');
  assert.ok(schema.getQueryType().getFields().receiptLinks);
});

test('expired-payment exemption applies only to a single receipt-link list or revocation operation', () => {
  assert.equal(receiptLinkManagementOnly({ query: 'mutation { revokeReceiptLink(branchId: 4, id: "1") }' }), true);
  assert.equal(receiptLinkManagementOnly({ query: 'query { receiptLinks(branchId: 4) { id } }' }), true);
  assert.equal(receiptLinkManagementOnly({ query: 'mutation { issueReceiptLink(branchId: 4) { id } }' }), false);
  assert.equal(receiptLinkManagementOnly({
    query: 'mutation { revokeReceiptLink(branchId: 4, id: "1") issueReceiptLink(branchId: 4) { id } }',
  }), false);
  assert.equal(receiptLinkManagementOnly({
    query: 'mutation Revoke { revokeReceiptLink(branchId: 4, id: "1") } mutation Other { login { token } }',
  }), false);
  assert.equal(receiptLinkManagementOnly({ query: '{ receiptLinks(branchId: 4) { id } }' }), true);
  assert.equal(receiptLinkManagementOnly({ query: '{ portfolio(branchId: 4) { nodes { id } } }' }), false);
  assert.equal(receiptLinkManagementOnly({ query: 'not graphql' }), false);
});
