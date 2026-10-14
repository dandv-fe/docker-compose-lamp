const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const presentation = require('../dist/scripts/AccountMovementPresentation.js');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('both account views render transfers from selected account without changing movement type', () => {
    for (const script of ['main_account.js', 'main_account_corriente.js']) {
        const source = read('dist/scripts/' + script);
        const start = source.indexOf('function renderMovimientosPrincipal(rows)');
        const end = source.indexOf('function loadMovimientosPrincipal', start);
        let output = '';
        let account = 20;
        const $ = selector => selector === '#idahorro' ? { val: () => account } :
            { length: 1, html(value) { output = value; } };
        const context = { $, AccountMovementPresentation: presentation,
            escapeHtml: value => String(value ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
            formatMoney: value => '$' + value };
        vm.createContext(context);
        vm.runInContext(source.slice(start, end), context);
        const movement = { idahorro: 10, idahorro_de: 20, str_tipo: 'retiro',
            dec_valor: '45000', str_descripcion: '<segura>' };
        context.renderMovimientosPrincipal([movement]);
        assert.match(output, /Transferencia recibida/);
        assert.match(output, /text-success[^>]*>\+\$45000/);
        assert.match(output, /&lt;segura&gt;/);
        account = 10;
        context.renderMovimientosPrincipal([movement]);
        assert.match(output, />Retiro</);
        assert.match(output, /text-danger[^>]*>-\$45000/);
        account = 20;
        context.renderMovimientosPrincipal([{ ...movement, str_tipo: 'aporte' }]);
        assert.match(output, /Transferencia enviada/);
        assert.match(output, /text-danger[^>]*>-\$45000/);
        context.renderMovimientosPrincipal([{ ...movement, idahorro: 20, str_tipo: 'ajuste' }]);
        assert.match(output, />Interés</);
        assert.match(output, /text-success[^>]*>\+\$45000/);
        assert.equal(movement.str_tipo, 'retiro');
    }
});

test('both views load shared labels first and both models include transfer reference', () => {
    for (const suffix of ['', '_corriente']) {
        const html = read(`views/main_account${suffix}.html`);
        assert.ok(html.indexOf('AccountMovementPresentation.js') < html.indexOf(`main_account${suffix}.js`));
    }
    for (const model of ['MainAccount.php', 'MainAccountCorriente.php']) {
        const source = read('model/' + model);
        const start = source.indexOf('public function listarMovimientosPorAhorro');
        const end = source.indexOf('return $conexion->query($sql)', start);
        assert.match(source.slice(start, end), /idahorro,\s+idahorro_de,/);
    }
    assert.equal(presentation.label({ idahorro: 20, idahorro_de: 20, str_tipo: 'retiro' }, 20), 'Retiro');
});
