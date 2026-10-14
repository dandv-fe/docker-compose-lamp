const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const helper = require('../dist/scripts/DespacharUI.js');

function harness(overrides = {}) {
    const elements = new Map();
    const handlers = new Map();
    const requests = [];
    const rendered = [];
    let pending = null;
    const response = {
        branch: { branchId: 1, name: '<script>safe</script>', officeName: 'Oficina <segura>', canDispatch: true, canSaveDispatch: true },
        route: null, employees: [{ employeeId: 1, name: 'Ana', selected: true, officeName: null, representative: true, replacement: false }],
        canConfigureDistribution: true, canSetChallenges: false,
        distribution: { mode: 'Igual', weights: [] }, challenges: [], csrfToken: 'csrf',
        ...overrides
    };
    function $(selector) {
        if (typeof selector === 'function') { selector(); return; }
        if (typeof selector !== 'string') return selector;
        if (!elements.has(selector)) {
            const element = {
                length: 1, values: {}, value: '', content: '',
                text(value) { this.content = value; rendered.push(value); return this; },
                addClass() { return this; }, toggleClass() { return this; },
                empty() { this.content = ''; return this; },
                append() { return this; }, appendTo() { return this; },
                attr() { return this; }, removeAttr() { return this; },
                filter() { return this; }, each() { return this; },
                prop(name, value) {
                    if (value === undefined) return this.values[name];
                    this.values[name] = value; return this;
                },
                val(value) { if (value === undefined) return this.value; this.value = value; return this; },
                modal() { return this; },
                on(event, fn) { handlers.set(`${selector}:${event}`, fn); return this; },
                trigger(event) { const handler = handlers.get(`${selector}:${event}`); if (handler) handler({ preventDefault() {} }); return this; }
            };
            elements.set(selector, element);
        }
        return elements.get(selector);
    }
    $.ajax = options => {
        requests.push(options);
        const action = options.data.action;
        const callbacks = {};
        const promise = {
            done(fn) { callbacks.done = fn; if (action !== 'save') fn(action === 'list' ? { branches: [{
                branchId: 1, name: 'Ruta', officeName: 'Oficina', state: 'created', assignedCount: 1,
                assignedEmployees: [{ employeeId: 1, name: 'ANA MARÍA <SEGURA>' }]
            }] } : response); return this; },
            fail(fn) { callbacks.fail = fn; return this; },
            always(fn) { callbacks.always = fn; if (action !== 'save') fn(); return this; }
        };
        if (action === 'save') pending = callbacks;
        return promise;
    };
    const window = {
        jQuery: $, DespacharUI: helper,
        RetoCards: { invitation: () => $('<p>') },
        crypto: { randomUUID: () => '12345678-1234-1234-1234-123456789012' },
        sessionStorage: { getItem() { return 'seen'; }, setItem() {} }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist/scripts/Despachar.js'), 'utf8'), {
        window, document: { createTextNode: value => value }, console, Intl, Number, String, Date, Set, Map, JSON, Math
    });
    return {
        window, $, requests, response, rendered,
        advance() { for (let i = 0; i < 3; i++) $('#dispatch-next').trigger('click'); },
        submit() { $('#formPersonalDespachar').trigger('submit'); },
        reject(status) { pending.fail({ status, responseJSON: { error: 'Contexto cambió' } }); pending.always(); }
    };
}

test('save freezes an exact CSRF/idempotent payload, blocks double submit and stale draft replay', () => {
    const h = harness();
    h.window.manejarCambioCheckDespachar(1);
    h.advance(); h.submit(); h.submit();
    const saves = h.requests.filter(request => request.data.action === 'save');
    assert.equal(saves.length, 1);
    assert.equal(saves[0].data.csrfToken, 'csrf');
    const payload = JSON.parse(saves[0].data.data);
    assert.deepEqual(payload, {
        branchId: 1, expectedRouteId: 0, expectedVersion: 0, employeeIds: [1],
        challenges: [], distribution: { mode: 'Igual', weights: [] },
        idempotencyToken: '12345678-1234-1234-1234-123456789012'
    });
    h.reject(409); h.submit();
    assert.equal(h.requests.filter(request => request.data.action === 'save').length, 1);
    assert.match(h.$('#dispatch-wizard-status').content, /Cierra y abre/);
});

test('branch cards display assigned names in title case using safe text', () => {
    const h = harness();
    assert.ok(h.rendered.includes('1 personas asignadas'));
    assert.ok(h.rendered.includes('Ana María <segura>'));
    h.window.manejarCambioCheckDespachar(1);
    assert.ok(h.rendered.includes('Equipo de esta cartera'));
});

test('normal dispatch cannot send distribution override on an existing snapshot or unauthorized challenges', () => {
    const h = harness({ canConfigureDistribution: false, route: { routeId: 9, state: 'created', version: 2 } });
    h.window.manejarCambioCheckDespachar(1); h.advance(); h.submit();
    const payload = JSON.parse(h.requests.find(request => request.data.action === 'save').data.data);
    assert.equal(payload.expectedRouteId, 9);
    assert.equal(payload.expectedVersion, 2);
    assert.equal('distribution' in payload, false);
    assert.deepEqual(payload.challenges, []);
    assert.equal(h.$('#dispatch-distribution').values.hidden, true);
});

test('uncertain response keeps request frozen and prevents opening another branch or automatic retry', () => {
    const h = harness();
    h.window.manejarCambioCheckDespachar(1); h.advance(); h.submit(); h.reject(500);
    const count = h.requests.length;
    h.submit(); h.window.manejarCambioCheckDespachar(2);
    assert.equal(h.requests.length, count);
    assert.match(h.$('#dispatch-wizard-status').content, /no reenvíes/);
});

test('closed route remains read-only without losing ordinary list access', () => {
    const h = harness({ route: { routeId: 9, state: 'entregando', version: 2 },
        branch: { branchId: 1, name: 'Ruta', officeName: 'Oficina', canDispatch: true, canSaveDispatch: false } });
    h.window.manejarCambioCheckDespachar(1); h.advance(); h.submit();
    assert.equal(h.requests.some(request => request.data.action === 'save'), false);
    assert.equal(h.$('#dispatch-confirm').values.disabled, true);
    assert.match(h.$('#dispatch-wizard-status').content, /Sólo consulta/);
});

test('effective read permission cannot override explicit server save denial or incomplete permission shape', () => {
    for (const canSaveDispatch of [false, undefined]) {
        const h = harness({ branch: { branchId: 1, name: 'Ruta', officeName: 'Oficina',
            canDispatch: true, canSaveDispatch } });
        h.window.manejarCambioCheckDespachar(1); h.advance(); h.submit();
        assert.equal(h.requests.some(request => request.data.action === 'save'), false);
        assert.equal(h.$('#dispatch-confirm').values.disabled, true);
        assert.match(h.$('#dispatch-wizard-status').content, canSaveDispatch === false ? /Sólo consulta/ : /incompleto/);
    }
});

test('office and operational holder replacement labels render as text without changing dispatch authority', () => {
    const h = harness({ employees: [
        { employeeId: 1, name: '<img src=x onerror=unsafe>', selected: true,
            officeName: 'Oficina <segura>', representative: true, replacement: false },
        { employeeId: 2, name: 'Relevo', selected: false,
            officeName: null, representative: false, replacement: true }
    ] });
    h.window.manejarCambioCheckDespachar(1);
    for (const text of ['<img src=x onerror=unsafe>', 'Oficina <segura>', 'Sin oficina registrada',
        'Titular permanente de cartera', 'Relevo temporal vigente · permisos propios']) {
        assert.ok(h.rendered.includes(text), text);
    }
    h.advance(); h.submit();
    const payload = JSON.parse(h.requests.find(request => request.data.action === 'save').data.data);
    assert.deepEqual(payload.employeeIds, [1]);
    assert.equal('representative' in payload, false);
    assert.equal('replacement' in payload, false);
});
