const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const dates = require('../dist/scripts/PayrollHistoryDates.js');

test('history dates strictly validate both fields without changing inclusive same-day ranges', () => {
    for (const [from, to] of [
        ['2026-10-14', '2026-10-14'], ['2024-02-29', '2024-03-01'],
        ['2026-01-31', '2026-02-01'], ['2026-12-31', '2027-01-01']
    ]) assert.equal(dates.rangeError(from, to), '');
    for (const invalid of ['', undefined, '2026-02-29', '2026-04-31', '14/10/2026', '2026-1-01']) {
        assert.match(dates.rangeError(invalid, '2026-10-14'), /fechas válidas/);
        assert.match(dates.rangeError('2026-10-14', invalid), /fechas válidas/);
    }
    assert.match(dates.rangeError('2026-10-15', '2026-10-14'), /posterior/);
});

test('both calendars initialize once with independent month bounds and existing dates preserved', () => {
    const elements = new Map();
    const calls = [];
    const $ = selector => {
        if (!elements.has(selector)) elements.set(selector, {
            length: 1, value: '', val() { return this.value; },
            datetimepicker(options) { calls.push({ selector, options }); return this; },
            off() { return this; }, on() { return this; }
        });
        return elements.get(selector);
    };
    const moment = (value, format, strict) => value
        ? { value, format, strict }
        : { clone: () => ({ startOf: () => 'month-start', endOf: () => 'month-end' }) };
    $('#txtFechaDesde').value = '2024-02-29';
    dates.initialize($, moment);
    assert.deepEqual(calls.map(call => call.selector), ['#dateDeste', '#dateHasta']);
    assert.deepEqual(calls[0].options.date, { value: '2024-02-29', format: 'YYYY-MM-DD', strict: true });
    assert.equal(calls[1].options.date, 'month-end');
    assert.ok(calls.every(call => call.options.useCurrent === false && call.options.format === 'YYYY-MM-DD'));
});

test('invalid range displays explicit status and does not silently correct user dates', () => {
    let message;
    const $ = selector => ({
        val: () => selector === '#txtFechaDesde' ? '2026-10-15' : '2026-10-14',
        text(value) { message = value; }
    });
    assert.equal(dates.validate($), false);
    assert.match(message, /No se ha actualizado/);
});

test('both views share initialization, explicit submit and stale response protection', () => {
    const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    for (const file of ['views/acceder.html', 'views/empleado.html']) {
        const html = read(file);
        assert.match(html, /PayrollHistoryDates\.js/);
        assert.match(html, /PayrollHistoryDates\.initialize\(jQuery, moment\)/);
        assert.match(html, /Consultar pagos/);
        assert.match(html, /id="payroll-history-date-status"/);
        assert.doesNotMatch(html, /hide\.datetimepicker/);
    }
    for (const file of ['views/acceder.html', 'dist/scripts/Empleado.js']) {
        const script = read(file);
        assert.match(script, /if \(!PayrollHistoryDates\.validate\(jQuery\)\)/);
        assert.equal((script.match(/sequence !== payrollHistoryRequestSequence/g) || []).length, 2);
    }
});
test('older history responses cannot clear or overwrite the newest date query', () => {
    const script = fs.readFileSync(path.join(__dirname, '../dist/scripts/Empleado.js'), 'utf8');
    const source = script.slice(script.indexOf('let payrollHistoryRequestSequence'),
        script.indexOf('function AuthorizacionEmpleado'));
    const requests = [];
    let clears = 0;
    let notifications = 0;
    let valid = true;
    const table = { clear() { clears++; return this; }, draw() { return this; }, row: { add: () => table } };
    const element = { 0: {}, removeClass() { return this; }, addClass() { return this; },
        html() { return this; }, empty() { return this; }, DataTable: () => table };
    const $ = () => element;
    $.post = () => {};
    $.ajax = options => requests.push(options);
    const context = { $, jQuery: $, PayrollHistoryDates: { validate: () => valid },
        FormData: class {}, Swal: { fire: () => notifications++ },
        capitalizarPalabras: value => value, location: { reload() {} } };
    vm.createContext(context);
    vm.runInContext(source, context);
    context.listarNominaDetalle();
    context.listarNominaDetalle();
    requests[1].success([]);
    assert.equal(clears, 1);
    requests[0].success([]);
    requests[0].error({ responseJSON: { error: 'Antigua' } });
    assert.equal(clears, 1);
    assert.equal(notifications, 0);
    valid = false;
    context.listarNominaDetalle();
    assert.equal(requests.length, 2);
    requests[1].success([]);
    assert.equal(clears, 1);
});
