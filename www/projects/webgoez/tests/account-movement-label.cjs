const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../views/acceder.html'), 'utf8');

test('account movement labels use account perspective without rewriting original movement', () => {
    const start = source.indexOf('function getTipoLabel(mov)');
    const end = source.indexOf('function cargarMovimientosFicha', start);
    const context = {};
    vm.createContext(context);
    vm.runInContext(source.slice(start, end), context);
    const received = { str_tipo: 'retiro', tipo_presentacion: 'Transferencia recibida', monto_firmado: 45000 };
    assert.equal(context.getTipoLabel(received), 'Transferencia recibida');
    assert.equal(context.getTipoLabel({ str_tipo: 'aporte', tipo_presentacion: 'Transferencia enviada' }),
        'Transferencia enviada');
    assert.equal(context.getTipoLabel({ str_tipo: 'aporte', tipo_presentacion: 'aporte' }), 'Aporte');
    assert.equal(context.getTipoLabel({ str_tipo: 'retiro', tipo_presentacion: 'retiro' }), 'Retiro');
    assert.equal(context.getTipoLabel({ str_tipo: 'ajuste', tipo_presentacion: 'ajuste' }), 'Interés');
    assert.equal(received.str_tipo, 'retiro');
    const render = source.slice(end, source.indexOf('function listarMovimientosUsuario()', end));
    assert.doesNotMatch(render, /mov\.str_tipo\s*=/);
    assert.match(render, /\.text\(getTipoLabel\(mov\)\)/);
});
