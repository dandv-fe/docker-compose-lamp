const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const presentation = require('../dist/scripts/AccountMovementPresentation.js');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const extract = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const escapeHtml = value => String(value ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

test('Mi ahorro uses server sign and label even when metadata identifies selected account', () => {
  const source = read('dist/scripts/mi_ahorro_custom.js');
  let output;
  const context = {
    $: () => ({ length: 1, html(value) { output = value; } }),
    AccountMovementPresentation: presentation, ahorroDetalleActual: 20,
    escapeHtml, formatMoney: value => '$' + value, formatDateTime: value => value
  };
  vm.createContext(context);
  vm.runInContext(extract(source, 'function renderMovimientosDetalle', 'function cargarMovimientosDetalle'), context);
  const base = { idahorro: 20, idahorro_de: 20, dec_valor: 45000,
    str_descripcion: '<segura>', str_estado: 'activo' };
  for (const [type, label, amount, visible] of [
    ['retiro', 'Transferencia recibida', 45000, 'Transferencia recibida'],
    ['aporte', 'Transferencia enviada', -10000, 'Transferencia enviada'],
    ['retiro', 'retiro', -3000, 'Retiro'],
    ['ajuste', 'ajuste', 5000, 'Interés'],
    ['entrada', 'entrada', 0, 'Entrada']
  ]) {
    const movement = Object.freeze({ ...base, str_tipo: type, tipo_presentacion: label, monto_firmado: amount });
    context.renderMovimientosDetalle([movement]);
    assert.ok(output.includes('>' + visible + '<'));
    assert.ok(output.includes((amount < 0 ? '-' : '+') + '$' + Math.abs(amount)));
    assert.match(output, /&lt;segura&gt;/);
    assert.equal(movement.str_tipo, type);
  }
});

for (const script of ['corresponsales', 'ahorrosProgramado']) {
test(`${script} renders transfer sides and interest without mutation or relying on origin labels`, () => {
  let output;
  const context = {
    $: () => ({ length: 1, html(value) { output = value; } }),
    AccountMovementPresentation: presentation, ahorroDetalleActual: 20,
    escapeHtml, formatMoney: value => '$' + value, formatDateTime: value => value
  };
  vm.createContext(context);
  vm.runInContext(extract(read(`dist/scripts/${script}.js`),
    'function renderMovimientosDetalle', 'function cargarMovimientosDetalle'), context);
  for (const [origin, type, label, sign] of [
    [10, 'retiro', 'Transferencia recibida', '+'],
    [10, 'aporte', 'Transferencia enviada', '-'],
    [10, 'ajuste', 'Transferencia enviada', '-'],
    [20, 'retiro', 'Retiro', '-'],
    [20, 'aporte', 'Aporte', '+'],
    [20, 'ajuste', 'Interés', '+'],
    [10, 'entrada', 'Entrada', script === 'corresponsales' ? '-' : '+'],
    [10, 'salida', 'Salida', '+']
  ]) {
    const movement = Object.freeze({ idahorro: origin, idahorro_de: 20,
      str_tipo: type, tipo_label: type === 'retiro' ? 'Retiro' : 'Aporte',
      dec_valor: 45000, str_descripcion: '<segura>' });
    context.renderMovimientosDetalle([movement]);
    assert.ok(output.includes('>' + label + '<'));
    assert.ok(output.includes(sign + '$45000'));
    assert.match(output, /&lt;segura&gt;/);
    assert.equal(movement.str_tipo, type);
  }
});
}

function ahorradoresContext() {
  const elements = new Map();
  const rows = [];
  let data = [];
  function node() {
    return {
      children: [], value: '',
      addClass() { return this; }, removeClass() { return this; },
      text(value) { this.value = value; return this; },
      empty() { this.children = []; return this; },
      append(...children) { this.children.push(...children); return this; },
      DataTable() { return table; }
    };
  }
  const table = { clear() { rows.length = 0; return this; }, draw() { return this; },
    row: { add(value) { rows.push(value); return table; } } };
  const $ = selector => {
    if (selector.startsWith('<')) return node();
    if (!elements.has(selector)) elements.set(selector, node());
    return elements.get(selector);
  };
  $.ajax = options => options.success(data);
  const context = { $, AccountMovementPresentation: presentation, window: {},
    limpiarHtmlTexto: value => String(value ?? ''), formatearMoneda: value => '$' + value };
  vm.createContext(context);
  const source = read('dist/scripts/Ahorradores.js');
  vm.runInContext(extract(source, 'function cargarMovimientosFicha', 'function listarAhorrosPersona'), context);
  vm.runInContext(extract(source, 'function listarMovimientosPersona', "$(document).on('click', '#ahorroSlideTrack"), context);
  return { context, elements, rows, setData(value) { data = value; } };
}

test('Ahorradores account card keeps original types and safely displays interest and transfers', () => {
  const fixture = ahorradoresContext();
  for (const [type, origin, label, sign] of [
    ['retiro', 10, 'Transferencia recibida', '+'],
    ['aporte', 10, 'Transferencia enviada', '-'],
    ['retiro', 20, 'Retiro', '-'],
    ['aporte', 20, 'Aporte', '+'],
    ['ajuste', 20, 'Interés', '+']
  ]) {
    const row = Object.freeze(['fecha', type, 45000, '<descripción>', 'activo', origin, 20]);
    fixture.setData([row]);
    fixture.context.cargarMovimientosFicha(20);
    const item = fixture.elements.get('#fichaMovimientosLista').children[0];
    assert.equal(item.children[0].children[0].value, label);
    assert.equal(item.children[0].children[1].value, sign + '$45000');
    assert.equal(item.children[2].value, '<descripción>');
    assert.equal(row[1], type);
  }
});

test('Ahorradores personal history displays signs for each selected account, including both own accounts', () => {
  const fixture = ahorradoresContext();
  const row = (type, via, account, number) =>
    Object.freeze(['fecha', number, type, 45000, 'descripción', 'activo', 10, 20, via, account]);
  fixture.setData([row('retiro', 0, 10, '100'), row('retiro', 1, 20, '200'),
    row('aporte', 1, 20, '200'), row('ajuste', 0, 10, '100')]);
  fixture.context.listarMovimientosPersona(2);
  assert.equal(fixture.rows.length, 4);
  for (const [index, number, label, sign] of [
    [0, '100', 'Retiro', '-'], [1, '200', 'Transferencia recibida', '+'],
    [2, '200', 'Transferencia enviada', '-'], [3, '100', 'Interés', '+']
  ]) {
    assert.equal(fixture.rows[index][1], number);
    assert.equal(fixture.rows[index][2], label);
    assert.ok(fixture.rows[index][3].includes('>' + sign));
  }
});

test('savings views load shared helper before renderers and personal DTO appends account perspective', () => {
  for (const [view, script] of [
    ['mi_ahorro', 'mi_ahorro_custom'], ['corresponsales', 'corresponsales'], ['ahorradores', 'Ahorradores'],
    ['ahorrosProgramado', 'ahorrosProgramado']
  ]) {
    const html = read('views/' + view + '.html');
    assert.ok(html.indexOf('AccountMovementPresentation.js') >= 0);
    assert.ok(html.indexOf('AccountMovementPresentation.js') < html.indexOf(script + '.js'));
  }
  const ajax = extract(read('ajax/AhorradoresAjax.php'), "case 'listMovimientosPersona':", "case 'listAhorrosPersona':");
  assert.match(ajax, /intval\(\$r->idahorro_de \?\? 0\),\s+intval\(\$r->isvia\),\s+intval\(\$r->cuentaSeleccionada\)/);
});
