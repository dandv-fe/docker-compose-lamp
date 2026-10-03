const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')

const context = { document: {}, jQuery: () => ({ ready() {} }) }
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist/scripts/Cartera.js'), 'utf8'), context)

test('separates bank receipts from pocket cash', () => {
    assert.equal(context.textoResumenCajaCartera({
        base: 0, recaudo: 130, recaudoBanco: 85, otro: 0,
        creditos: 0, creditosBanco: 0, gastos: 0, efectivo: 45
    }), 'B $0 + Ef $45 + O $0 − C $0 − G $0 = $45 · Banco: +$85 −$0')
})

test('separates bank-funded credits from cash cost', () => {
    assert.equal(context.textoResumenCajaCartera({
        base: 100, recaudo: 130, recaudoBanco: 85, otro: 10,
        creditos: 60, creditosBanco: 40, gastos: 5, efectivo: 130
    }), 'B $100 + Ef $45 + O $10 − C $20 − G $5 = $130 · Banco: +$85 −$40')
})
