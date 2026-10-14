const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const groups = require('../dist/scripts/EmployeeOfficeGroups.js');

test('office grouping stays fixed when sorting people and separates same-named offices', () => {
    const $ = tag => ({ tag, text(value) { this.value = value; return this; } });
    $.fn = { dataTable: { render: { text: () => 'escaped-text-renderer' } } };
    const options = groups.options($);
    assert.deepEqual(options.orderFixed.pre, [[9, 'asc'], [10, 'asc']]);
    assert.deepEqual(options.order, [[1, 'asc']]);
    assert.equal(options.rowGroup.dataSrc, 10);
    assert.deepEqual(options.columnDefs[1], { targets: 10, visible: false, searchable: false });
    const rows = { data: () => [Array(9).fill('').concat(['Oficina <segura>', '1'])], count: () => 3 };
    const heading = options.rowGroup.startRender(rows);
    assert.equal(heading.tag, '<span>');
    assert.equal(heading.value, 'Oficina <segura> · 3 empleados en esta página');
    assert.equal(options.columnDefs[0].render, 'escaped-text-renderer');
});

test('employees and dismissed wire the same office grouping and preserve export names', () => {
    const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    for (const file of ['views/empleado.html', 'views/despedidos.html']) {
        const html = read(file);
        assert.match(html, /dataTables\.rowGroup\.min\.js/);
        assert.match(html, /EmployeeOfficeGroups\.js/);
        assert.equal((html.match(/<th>Grupo de oficina<\/th>/g) || []).length, 2);
    }
    assert.match(read('views/empleado.html'), /EmployeeOfficeGroups\.options\(jQuery\)/);
    assert.match(read('dist/scripts/Despedidos.js'), /EmployeeOfficeGroups\.options\(jQuery\)/);
    assert.match(read('dist/scripts/Despedidos.js'), /item\.oficinaNombre/);
    assert.match(read('dist/scripts/Empleado.js'), /val\[9\],\s+val\[10\]/);
});
test('office headers span only columns visible on responsive mobile tables', () => {
    let colspan;
    let events;
    const cell = { attr(name, value) { assert.equal(name, 'colspan'); colspan = value; return this; },
        css() { return this; } };
    const $ = () => ({ find: () => cell });
    $.fn = { dataTable: { render: { text: () => 'escaped' } } };
    const api = {
        columns: () => ({
            responsiveHidden: () => ({ toArray: () => [true, true, false, true] }),
            visible: () => ({ toArray: () => [true, true, true, false] })
        }),
        table: () => ({ body: () => 'body' }),
        on(names, callback) { events = names; callback(); }
    };
    groups.options($).initComplete.call({ api: () => api });
    assert.equal(colspan, 2);
    assert.match(events, /responsive-resize/);
    assert.match(events, /draw/);
});

test('paid history and payroll remain separate, explicit and read-only', () => {
    const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const home = read('views/acceder.html');
    assert.match(home, />PAGOS RECIBIDOS<\/a>/);
    assert.match(home, />MI NÓMINA<\/a>/);
    assert.match(home, /no reemplaza este historial ni paga automáticamente/);
    assert.match(home, /incluidos\s+otros conceptos como viáticos/);
    assert.match(read('views/empleado.html'), /Acuerdo y nómina/);
});
