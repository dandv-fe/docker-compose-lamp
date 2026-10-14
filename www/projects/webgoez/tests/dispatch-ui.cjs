const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ui = require('../dist/scripts/DespacharUI.js');
const context = {
    canDispatch: true, canDistribute: true, canSetChallenges: true,
    employees: [{ employeeId: 1 }, { employeeId: 2 }]
};
const draft = {
    employeeIds: [1, 2], distribution: { mode: 'Personalizado', weights: [
        { employeeId: 1, weight: 60 }, { employeeId: 2, weight: 40 }
    ] },
    challenges: [{
        employeeId: 1, capitalGoal: 1000, collectionGoal: 2000,
        deadline: '2026-12-31', incrementPercent: 0.1, description: 'Vamos paso a paso'
    }]
};
test('filters cards by branch office and state from the exact list DTO', () => {
    const branches = [{ name: 'Norte', officeName: 'Medellín', state: 'created' },
        { name: 'Sur', officeName: 'Bogotá', state: 'available' }];
    assert.equal(ui.filterBranches(branches, 'norte', 'created').length, 1);
    assert.equal(ui.filterBranches(branches, 'medell', 'created').length, 1);
    assert.equal(ui.filterBranches(branches, 'sur', 'created').length, 0);
});
test('person names use initial capitals with accents and hyphenated words', () => {
    assert.equal(ui.personName('ANA ISABEL HOYOS NAVARRO'), 'Ana Isabel Hoyos Navarro');
    assert.equal(ui.personName('  josÉ marÍA péREZ-lÓPEZ '), '  José María Pérez-López ');
});
test('people group the branch team first, branch office next and other offices by name', () => {
    const employees = [
        { employeeId: 1, name: 'Zulu', officeId: 2, officeName: 'Bogotá', selected: false },
        { employeeId: 2, name: 'Ana', officeId: 3, officeName: 'Cali', representative: true },
        { employeeId: 3, name: 'Pedro', officeId: 1, officeName: 'Medellín' },
        { employeeId: 4, name: 'Beatriz', officeId: 2, officeName: 'Bogotá' },
        { employeeId: 5, name: 'Carlos', officeId: 3, officeName: 'Cali', selected: true },
        { employeeId: 6, name: 'Daniel', officeId: 3, officeName: 'Cali' },
        { employeeId: 7, name: 'Relevo', officeId: null, officeName: null, replacement: true },
        { employeeId: 8, name: 'Sin oficina', officeId: null, officeName: null }
    ];
    const groups = ui.employeeGroups(employees, { officeId: 1 }, '');
    assert.deepEqual(groups.map(group => group.name),
        ['Equipo de esta cartera', 'Medellín', 'Bogotá', 'Cali', 'Sin oficina registrada']);
    assert.deepEqual(groups[0].employees.map(employee => employee.employeeId), [2, 5, 7]);
    assert.deepEqual(groups[2].employees.map(employee => employee.employeeId), [4, 1]);
    assert.equal(groups.reduce((sum, group) => sum + group.employees.length, 0), employees.length);
    assert.deepEqual(ui.employeeGroups(employees, { officeId: 1 }, 'bogot').map(group => group.name), ['Bogotá']);
    assert.deepEqual(employees.map(employee => employee.employeeId), [1, 2, 3, 4, 5, 6, 7, 8]);
});
test('dispatch preserves normal permissions and guards SA distribution and exact reto authorization', () => {
    assert.equal(ui.validateDraft(draft, context), '');
    assert.match(ui.validateDraft(draft, { ...context, canDispatch: false }), /permiso/);
    assert.match(ui.validateDraft(draft, { ...context, canDistribute: false }), /Super Administrador/);
    assert.match(ui.validateDraft(draft, { ...context, canSetChallenges: false }), /permisos/);
    assert.equal(ui.validateDraft({ employeeIds: [1], challenges: [] }, {
        ...context, canDistribute: false, canSetChallenges: false
    }), '');
});
test('requires authorized unique people and exactly 100% custom shares', () => {
    assert.match(ui.validateDraft({ ...draft, employeeIds: [1, 1] }, context), /duplicados/);
    assert.match(ui.validateDraft({ ...draft, employeeIds: [3] }, context), /autorizada/);
    assert.match(ui.validateDraft({ ...draft, distribution: { mode: 'Personalizado', weights: [{ employeeId: 1, weight: 99.99 }] } }, context), /100%/);
});
test('individual challenges validate real dates and increment boundaries without computing payroll', () => {
    const challenge = draft.challenges[0];
    assert.equal(ui.validChallenge(challenge), true);
    assert.equal(ui.validChallenge({ ...challenge, incrementPercent: 40 }), true);
    for (const incrementPercent of [0, 0.09, 40.01, NaN]) {
        assert.equal(ui.validChallenge({ ...challenge, incrementPercent }), false);
    }
    assert.equal(ui.validChallenge({ ...challenge, deadline: '2026-02-30' }), false);
    assert.equal(ui.validChallenge({ ...challenge, capitalGoal: -1 }), false);
    assert.equal(ui.validChallenge({ ...challenge, capitalGoal: '1.001' }), false);
    for (const description of ['', ' ', undefined, 'x'.repeat(250)]) {
        assert.equal(ui.validChallenge({ ...challenge, description }), true);
        assert.equal(ui.validateDraft({ ...draft, challenges: [{ ...challenge, description }] }, context), '');
    }
    for (const description of [null, 123, 'x'.repeat(251)]) {
        assert.equal(ui.validChallenge({ ...challenge, description }), false);
    }
});
test('fresh context requires matching branch, explicit permissions, employee selections and route version', () => {
    const response = {
        branch: { branchId: 1, name: 'Ruta', officeName: 'Oficina', canDispatch: true, canSaveDispatch: true }, route: null,
        employees: [{ employeeId: 2, name: 'Empleado', selected: true, officeName: null, representative: false, replacement: true }],
        canConfigureDistribution: true, canSetChallenges: false, challenges: [],
        distribution: { mode: 'Igual', weights: [] }, csrfToken: 'mock'
    };
    assert.equal(ui.validContext(response, 1), true);
    assert.equal(ui.validContext(response, 2), false);
    assert.equal(ui.validContext({ ...response, canSetChallenges: undefined }, 1), false);
    assert.equal(ui.validContext({ ...response, branch: { ...response.branch, canSaveDispatch: undefined } }, 1), false);
    assert.equal(ui.validContext({ ...response, branch: { ...response.branch, canDispatch: false } }, 1), false);
    assert.equal(ui.validContext({ ...response, route: { routeId: 9, state: 'entregando', version: 1 } }, 1), false);
    assert.equal(ui.validContext({ ...response, employees: [{ ...response.employees[0], replacement: undefined }] }, 1), false);
    assert.equal(ui.validContext({ ...response, route: { routeId: 9, state: 'created', version: 0 } }, 1), true);
    assert.equal(ui.validContext({ ...response, route: { routeId: 9, state: 'created' } }, 1), false);
    assert.equal(ui.validContext({ ...response, employees: [...response.employees, ...response.employees] }, 1), false);
});
test('invitation animates once per challenge revision and CSV escapes spreadsheet formula prefixes', () => {
    const values = new Map();
    const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
    assert.equal(ui.markInvitationSeen(storage, '1:2:v1'), true);
    assert.equal(ui.markInvitationSeen(storage, '1:2:v1'), false);
    assert.equal(ui.markInvitationSeen(storage, '1:2:v2'), true);
    assert.match(ui.csv([{ name: '=CMD("x")', officeName: 'a,b', state: 'created' }]), /"'\=CMD\(""x""\)"/);
});
test('UI uses accessible wizard, safe text, frozen request and no legacy HTML or dual list', () => {
    const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const script = read('dist/scripts/Despachar.js');
    const modal = read('views/partials/modalPersonalDespachar.html');
    const css = read('dist/css/despachar.css');
    const branch = read('views/sucursal.html');
    assert.doesNotMatch(script, /\.html\(|bootstrapDualListbox|DataTable\(/);
    assert.match(script, /frozenRequest = JSON\.parse\(JSON\.stringify\(data\)\)/);
    assert.match(script, /expectedVersion: Number\(context\.route && context\.route\.version/);
    assert.match(script, /request\('forecast', payload\)/);
    assert.match(script, /uncertain = !xhr\.status \|\| xhr\.status >= 500/);
    assert.match(modal, /aria-live="polite"/);
    assert.match(modal, /data-dispatch-step="4"/);
    assert.match(css, /min-height:44px/);
    assert.match(css, /prefers-reduced-motion:reduce/);
    assert.doesNotMatch(branch, /payroll-branch-distribution|PayrollEmpleado|payroll-empleado\.css/);
    assert.match(branch, /frmSucursal/);
});
