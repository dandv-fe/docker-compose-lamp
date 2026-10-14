const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const helpers = require('../dist/scripts/DespacharUI.js');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
function setup(response, reject = false, storage = new Map()) {
    const elements = new Map();
    const calls = [];
    const rendered = [];
    const classes = [];
    const handlers = new Map();
    const $ = selector => {
        if (typeof selector === 'function') { selector(); return; }
        if (!elements.has(selector) || selector.startsWith('<')) elements.set(selector, {
            length: 1, value: '', props: {}, children: [],
            prop(name, value) { this.props[name] = value; return this; },
            text(value) { this.value = value; rendered.push(value); return this; },
            addClass(value) { classes.push(value); return this; }, removeClass() { return this; },
            append(value) { this.children.push(value); return this; },
            prependTo() { return this; }, appendTo() { return this; },
            empty() { this.children = []; return this; },
            on(event, callback) { handlers.set(`${selector}:${event}`, callback); return this; }
        });
        return elements.get(selector);
    };
    $.ajax = options => {
        calls.push(options);
        return {
            done(fn) { if (!reject) fn(response); return this; },
            fail(fn) { if (reject) fn({ responseJSON: { error: 'Sesión no válida' } }); return this; },
            always(fn) { fn(); return this; }
        };
    };
    const window = { jQuery: $, DespacharUI: helpers, sessionStorage: {
        getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)
    } };
    vm.runInNewContext(read('dist/scripts/RetoCards.js'), { window, Intl, Number, String });
    vm.runInNewContext(read('dist/scripts/MisRetos.js'), { window });
    return { window, elements, calls, rendered, classes, refresh: () => handlers.get('#own-challenges-refresh:click')() };
}
const forecast = {
    status: 'available', warnings: ['Estimación, no garantía.'],
    salary: { baseAmount: 100 }, goal: {
        targetCommission: 120, otherCommission: 10, routeCommission: 20,
        commissionGap: 90, capitalRequired: 900, collectionRequired: null
    }, collections: { dueAmount: 200, arrearsAmount: 10, advanceAmount: 5 }
};
const item = {
    challengeId: '9', routeId: 2, branchId: 3, branchName: '<script>not executable</script>',
    routeState: 'created', assigned: true, status: 'active', invitationDate: '2026-10-13',
    deadline: '2026-12-31', description: 'Un paso a la vez', incrementPercent: 20,
    capitalGoal: 1000, collectionGoal: 500,
    salary: { configured: true, baseAmount: 100 },
    allocation: { weight: 50, capitalRate: 10, collectionRate: 5 },
    goal: { ...forecast.goal, projectedCommission: 130, projectedEarnedWithoutBonuses: 130,
        surplusAmount: 30, surplusPercent: 30 },
    progress: { creditedCapital: -50, creditedCollection: 600, capitalTarget: 500, collectionTarget: 250,
        capitalPercent: -10, collectionPercent: 240, commissionAmount: 30, targetCommission: 120,
        commissionPercent: 25, achieved: false },
    forecast: { estimated: true, status: 'available', warnings: ['Estimación, no garantía.'],
        collections: { estimated: true, status: 'available', dueAmount: 200, arrearsAmount: 10,
            advanceAmount: 5, cardCount: 2, invalidCardCount: 0, invalidReasons: [], warnings: [] } }
};
const ownResponse = items => ({ employeeId: 1, asOf: '2026-10-13', items });
test('own challenges query is readonly without employeeId or dispatch grant and uses server forecast', () => {
    const h = setup(ownResponse([item]));
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].method, 'GET');
    assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0].data)), { action: 'own' });
    assert.match(h.elements.get('#own-challenges-status').value, /cálculo actual del servidor/);
    assert.equal(h.elements.get('#own-challenges-list').children.length, 1);
    assert.equal(h.window.RetoCards.validForecast(forecast), true);
    assert.equal(h.window.RetoCards.validForecast({ ...forecast, goal: {} }), false);
    assert.equal(h.window.RetoCards.validOwn(ownResponse([item])), true);
    assert.ok(h.rendered.includes(item.branchName));
    assert.match(h.rendered.join('\n'), /-10%/);
    assert.match(h.rendered.join('\n'), /240%/);
    assert.match(h.rendered.join('\n'), /todas las carteras/);
});
test('own challenges handles empty, denied and incomplete responses explicitly', () => {
    assert.match(setup(ownResponse([])).elements.get('#own-challenges-status').value, /Todavía no tienes retos/);
    assert.match(setup({}, true).elements.get('#own-challenges-status').value, /Sesión no válida/);
    for (const response of [{ challenges: [] }, ownResponse([{ ...item, forecast: {} }]),
        ownResponse([item, item]), { ...ownResponse([item]), employeeId: 0 },
        ownResponse([{ ...item, progress: { ...item.progress, capitalPercent: '10' } }])]) {
        const h = setup(response);
        assert.match(h.elements.get('#own-challenges-status').value, /incompleta/);
        assert.equal(h.elements.get('#own-challenges-list').children.length, 0);
    }
});
test('expired closed unassigned and insufficient forecasts preserve signed progress without a prediction', () => {
    for (const status of ['expired', 'closed', 'unassigned', 'active']) {
        const h = setup(ownResponse([{ ...item, status, assigned: status !== 'unassigned',
            progress: { ...item.progress, capitalPercent: null, commissionPercent: null },
            forecast: { estimated: true, status: status === 'active' ? 'insufficient_data' : 'not_applicable',
                collections: null, warnings: ['Revisa cobertura temporal'] } }]));
        assert.equal(h.elements.get('#own-challenges-list').children.length, 1);
        assert.match(h.rendered.join('\n'), /Sin porcentaje calculable/);
        assert.match(h.rendered.join('\n'), /Revisa cobertura temporal/);
        assert.doesNotMatch(h.rendered.join('\n'), /Devengado proyectado/);
    }
});
test('invitations animate once per identity and revision, not per progress refresh', () => {
    const storage = new Map();
    const h = setup(ownResponse([item]), false, storage);
    assert.equal(h.classes.filter(value => value === 'dispatch-invitation').length, 1);
    h.refresh();
    assert.equal(h.classes.filter(value => value === 'dispatch-invitation').length, 1);
    const changed = setup(ownResponse([{ ...item, description: 'Nueva invitación' }]), false, storage);
    assert.ok(changed.classes.includes('dispatch-invitation'));
    const otherEmployee = setup({ ...ownResponse([item]), employeeId: 2 }, false, storage);
    assert.ok(otherEmployee.classes.includes('dispatch-invitation'));
});
test('own collections show invalid reasons and insufficient status without fake expected cuotas', () => {
    const h = setup(ownResponse([{ ...item, forecast: { ...item.forecast,
        collections: { ...item.forecast.collections, status: 'insufficient_data',
            invalidReasons: ['Calendario inválido <seguro>'], invalidCardCount: 1 } } }]));
    assert.match(h.rendered.join('\n'), /Cronograma insuficiente/);
    assert.ok(h.rendered.includes('Calendario inválido <seguro>'));
    assert.doesNotMatch(h.rendered.join('\n'), /Cuotas esperadas/);
});
test('optional empty or omitted description renders a static invitation without rejecting the own challenge', () => {
    for (const description of ['', ' ', undefined]) {
        const h = setup(ownResponse([{ ...item, description }]));
        assert.equal(h.elements.get('#own-challenges-list').children.length, 1);
        assert.ok(h.rendered.includes('Tu próximo reto: un paso a la vez.'));
        assert.doesNotMatch(h.elements.get('#own-challenges-status').value, /incompleta/);
    }
    const script = read('dist/scripts/Despachar.js');
    assert.match(script, /descripción \(opcional, máximo 250 caracteres\)/);
    assert.doesNotMatch(script, /if \(challenge\.description\) invitation/);
});
test('shared cards render text only, preserve separate advances and arrears, and never calculate salary goals', () => {
    const component = read('dist/scripts/RetoCards.js');
    assert.doesNotMatch(component, /\.html\(|innerHTML|targetCommission\s*=/);
    assert.match(component, /response\.goal\.commissionGap/);
    assert.match(component, /response\.collections\.advanceAmount/);
    assert.match(component, /response\.collections\.arrearsAmount/);
    assert.match(component, /No genera bonos ni cambia tu sueldo/);
    assert.match(read('views/acceder.html'), /id="own-challenges"/);
    assert.match(read('views/despachar.html'), /RetoCards\.js/);
});
