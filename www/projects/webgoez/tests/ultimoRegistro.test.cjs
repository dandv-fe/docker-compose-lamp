const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')

const script = fs.readFileSync(path.join(__dirname, '../dist/scripts/Cartera.js'), 'utf8')
const template = fs.readFileSync(path.join(__dirname, '../views/cartera.html'), 'utf8')
const context = {
    document: {},
    jQuery: () => ({ ready() {} })
}
vm.runInNewContext(script, context)
const clasificar = (descripcion, estado, esPropio) =>
    JSON.parse(JSON.stringify(context.clasificarUltimoRegistro(descripcion, estado, esPropio)))

test('only own active Abono and c-Inicial use green backgrounds', () => {
    assert.equal(clasificar('Abono->99', 'created', true).fondo, '#4b965b')
    assert.equal(clasificar('Abono', 'entregando', true).fondo, '#1f5b2c')
    assert.equal(clasificar('c-Inicial->80', 'created', true).fondo, '#4b965b')
    assert.equal(clasificar('c-Inicial->80', 'entregando', true).fondo, '#1f5b2c')
    assert.equal(clasificar('Abono', 'created', false).fondo, '#343A40')
    assert.equal(clasificar('c-Inicial->80', 'entregando', false).fondo, '#343A40')
    for (const descripcion of ['Abono', 'c-Inicial->80']) {
        assert.equal(clasificar(descripcion, 'saved', true).fondo, '#343A40')
    }
    assert.doesNotMatch(clasificar('Inicial', 'created', true).fondo, /^#(?:4b965b|1f5b2c)$/)
    assert.doesNotMatch(clasificar('Descuento: prueba', 'created', true).fondo, /^#(?:4b965b|1f5b2c)$/)
})

test('formats first and last names word by word', () => {
    assert.equal(context.formatearNombrePersona('  MARÍA DE LOS ÁNGELES PÉREZ-GARCÍA  '), 'María De Los Ángeles Pérez-García')
})

test('identifies movements and removes the repeated prefix from detail', () => {
    const examples = [
        ['Abono', 'Abono', ''],
        ['Abono->99', 'Abono', '99'],
        ['c-Inicial->80', 'c-Inicial', '80'],
        ['Inicial', 'Cuota inicial', ''],
        ['Descuento: sdfsfsd sgsdsdf', 'Descuento', 'sdfsfsd sgsdsdf'],
        ['Intereses: Ya esta vencida', 'Intereses', 'Ya esta vencida'],
        ['2024/04/08->Intereces', 'Intereses', '2024/04/08'],
        ['Saldo corregido-> un asunto util', 'Saldo corregido', 'un asunto util'],
        ['Pagado->1200', 'Pagado', '1200'],
        ['Cancelado', 'Cancelado', ''],
        ['Cancelada->68', 'Cancelada', '68'],
        ['texto sin tipo', 'Movimiento', 'texto sin tipo']
    ]
    for (const [descripcion, tipo, detalle] of examples) {
        const registro = clasificar(descripcion, 'created')
        assert.equal(registro.tipo, tipo, descripcion)
        assert.equal(registro.detalle, detalle, descripcion)
    }
})

test('card separates movement, amount and optional detail', () => {
    assert.match(template, /<strong>Último registro<\/strong>/)
    assert.match(template, /id="ultimo-abono-tipo"/)
    assert.match(template, /id="ultimo-abono-importe"/)
    assert.match(template, /id="ultimo-abono-detalle"/)
    assert.doesNotMatch(template, /<div>Abono:.*ultimo-abono-importe/)
})
