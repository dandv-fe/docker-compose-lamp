const test = require('node:test');
const assert = require('node:assert/strict');
const {
    validDate,
    validMoney,
    validPayrollConfig,
    validCustomShares,
    validPayrollSummary,
    validPayrollBootstrap,
    validVacation,
    validBonusContext,
    validLedgerBonus,
    formatCop
} = require('../dist/scripts/PayrollEmpleadoUI.js');

test('salary types and frequency are independent validated selections', () => {
    for (const salaryType of ['Fijo', 'Porcentaje', 'Combinado']) {
        for (const frequency of ['Diario', 'Semanal', 'Quincenal', 'Mensual']) {
            assert.equal(validPayrollConfig({
                salaryType, frequency, baseAmount: 500000,
                creditRate: 1.5, collectionRate: 2, commissionsEnabled: true,
                vacations: []
            }), true);
        }
    }
    assert.equal(validPayrollConfig({
        salaryType: 'Diario', frequency: 'Fijo', baseAmount: 500000
    }), false);
});

test('vacations with mandatory replacement are independent from salary validation', () => {
    const base = {
        salaryType: 'Fijo', frequency: 'Mensual', baseAmount: '1300000',
        commissionsEnabled: false
    };
    assert.equal(validPayrollConfig(base), true);
    const vacation = {
        employeeId: 1, replacementEmployeeId: 2,
        startDate: '2026-12-20', endDate: '2027-01-05', reason: ''
    };
    assert.equal(validVacation(vacation), true);
    assert.equal(validVacation({ ...vacation, replacementEmployeeId: 1 }), false);
    assert.equal(validVacation({ ...vacation, replacementEmployeeId: 0 }), false);
    assert.equal(validVacation({ ...vacation, startDate: '2026-02-30' }), false);
    assert.equal(validVacation({ ...vacation, endDate: '2026-12-01' }), false);
    assert.equal(validPayrollConfig({ ...base, vacations: [{ startDate: 'bad' }] }), true);
});

test('rejects invalid monetary values and malformed calendar dates', () => {
    for (const amount of [-1, Infinity, NaN, 'not-money']) assert.equal(validMoney(amount), false);
    for (const date of ['2026-2-01', '2026-02-29', '2026-13-01', '2026-01-01x']) {
        assert.equal(validDate(date), false);
    }
    assert.equal(validDate('2024-02-29'), true);
});

test('custom reparto accepts unlimited employees only when shares sum exactly to 100%', () => {
    const shares = Array.from({ length: 25 }, (_, index) => ({
        employeeId: index + 1,
        percent: 4
    }));
    assert.equal(validCustomShares(shares), true);
    assert.equal(validCustomShares([{ employeeId: 1, percent: 60 }, { employeeId: 2, percent: 39.99 }]), false);
    assert.equal(validCustomShares([{ employeeId: 1, percent: 50 }, { employeeId: 1, percent: 50 }]), false);
    assert.equal(validCustomShares([{ employeeId: 1, percent: 100.01 }]), false);
});

test('summary keeps the two commission streams, paid/pending and provisional routes distinct', () => {
    const summary = {
        employeeId: 17,
        asOf: '2026-10-13',
        periods: [{
            startDate: '2026-10-01', endDate: '2026-10-15',
            configured: true, frequency: 'Quincenal',
            baseAmount: 200000, periodBaseAmount: 600000, agreedBaseAmount: 600000,
            capitalCommission: 10000, collectionCommission: 30000,
            commissionAmount: 40000, bonusAmount: 25000, earnedAmount: 225000,
            paidAmount: 200000, pendingAmount: 25000
        }],
        totals: {
            baseAmount: 200000, periodBaseAmount: 600000,
            capitalCommission: 10000, collectionCommission: 30000,
            commissionAmount: 40000, bonusAmount: 25000, earnedAmount: 225000,
            paidAmount: 200000, pendingAmount: 25000
        },
        contracts: [], vacations: [], bonuses: [],
        routes: [{
            branchName: 'Ruta norte',
            openedDate: '2026-10-03',
            capitalAmount: 100000,
            cashAmount: 300000,
            sharePercent: 50,
            capitalCommission: 4000,
            collectionCommission: 12000,
            provisional: true
        }]
    };
    assert.equal(validPayrollSummary(summary), true);
    assert.equal(validPayrollSummary({ ...summary, totals: { ...summary.totals, capitalCommission: -1 } }), true);
    assert.equal(validPayrollSummary({ ...summary, totals: { ...summary.totals, capitalCommission: null } }), false);
    assert.equal(validPayrollSummary({
        ...summary,
        routes: [{ ...summary.routes[0], capitalAmount: -100, cashAmount: -50, capitalCommission: -4, collectionCommission: -2 }]
    }), true);
    assert.equal(validPayrollSummary({ ...summary, routes: [{ ...summary.routes[0], provisional: 'open' }] }), false);
    assert.equal(validPayrollSummary({ ...summary, routes: undefined }), false);
});

test('bootstrap confines employee selection to the authorized employee list and validates assigned branches', () => {
    const bootstrap = {
        employeeId: 1,
        canManage: true,
        canDistribute: true,
        employees: [{ employeeId: 1, name: 'Admin' }, { employeeId: 2, name: 'Empleado' }],
        branches: [{
            branchId: 9, name: 'Ruta norte', holderName: 'Admin',
            employees: [{ employeeId: 2, name: 'Empleado' }]
        }],
        configs: [{ branchId: 9, mode: 'Personalizado', weights: [{ employeeId: 2, weight: 100 }] }]
    };
    assert.equal(validPayrollBootstrap(bootstrap), true);
    assert.equal(validPayrollBootstrap({
        ...bootstrap,
        branches: [{ ...bootstrap.branches[0], employees: undefined }]
    }), false);
    assert.equal(validPayrollBootstrap({
        ...bootstrap,
        configs: [{ ...bootstrap.configs[0], mode: 'invented' }]
    }), false);
    assert.equal(validPayrollBootstrap({
        ...bootstrap,
        configs: [{ ...bootstrap.configs[0], weights: [{ employeeId: 2, weight: 0 }] }]
    }), false);
});

test('personal statement renders accrued base separately and trusts server earned and pending totals', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const view = fs.readFileSync(path.join(__dirname, '../views/acceder.html'), 'utf8');
    const script = fs.readFileSync(path.join(__dirname, '../dist/scripts/PayrollEmpleado.js'), 'utf8');
    assert.match(view, /Sueldo básico acumulado<\/div><div id="payroll-accrued-base"/);
    assert.match(view, /Sueldo básico pactado: <span id="payroll-current-base"/);
    assert.match(script, /#payroll-accrued-base'\)\.text\(helpers\.formatCop\(period\.baseAmount\)\)/);
    assert.match(script, /#payroll-current-base'\)\.text\(helpers\.formatCop\(period\.agreedBaseAmount\)\)/);
    assert.match(script, /#payroll-earned-total'\)\.text\(helpers\.formatCop\(period\.earnedAmount\)\)/);
    assert.match(script, /#payroll-pending-total'\)\.text\(helpers\.formatCop\(period\.pendingAmount\)\)/);
    assert.match(script, /#payroll-total-provisional'\)\.toggle\(summary\.routes\.some\(route => route\.provisional\)\)/);
});

test('unconfigured statement still renders bonuses and signed payments without a real session', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const vm = require('node:vm');
    const script = fs.readFileSync(path.join(__dirname, '../dist/scripts/PayrollEmpleado.js'), 'utf8');
    const start = script.indexOf('function renderOwnStatement(summary)');
    const end = script.indexOf('function loadOwnStatement()', start);
    assert.ok(start >= 0 && end > start);
    const elements = new Map();
    const $ = selector => {
        if (!elements.has(selector)) {
            elements.set(selector, {
                length: 1,
                text(value) { this.value = value; return this; },
                toggle(value) { this.visible = value; return this; },
                show() { this.visible = true; return this; },
                find() { return this; },
                empty() { return this; }
            });
        }
        return elements.get(selector);
    };
    const amounts = {
        baseAmount: 0, periodBaseAmount: 0, capitalCommission: 0,
        collectionCommission: 0, commissionAmount: 0, bonusAmount: 100,
        earnedAmount: 100, paidAmount: -25, pendingAmount: 125
    };
    const context = {
        $, helpers: { validPayrollSummary, formatCop },
        emptyRow() {}, setStatus() {},
        summary: {
            employeeId: 17, asOf: '2026-10-13',
            periods: [{
                ...amounts, configured: false, frequency: 'Mensual',
                agreedBaseAmount: 0, startDate: '2026-10-01', endDate: '2026-10-31'
            }],
            totals: amounts, contracts: [], vacations: [], bonuses: [], routes: []
        }
    };
    vm.runInNewContext(`${script.slice(start, end)}; renderOwnStatement(summary);`, context);
    assert.equal(elements.get('#payroll-unconfigured').visible, true);
    assert.equal(elements.get('#payroll-own-content').visible, true);
    assert.equal(elements.get('#payroll-current-bonuses').value, formatCop(100));
    assert.equal(elements.get('#payroll-paid-total').value, formatCop(-25));
    assert.equal(elements.get('#payroll-pending-total').value, formatCop(125));
    assert.equal(elements.get('#payroll-total-provisional').visible, false);
});

test('formats Colombian pesos without fabricating values for malformed amounts', () => {
    assert.match(formatCop(250000), /250\.000/);
    assert.equal(formatCop('invalid'), '—');
});

test('salary form has no vacation or bonus mutation and vacation uses a separate required replacement', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const salary = read('views/partials/modalSueldoPactado.html');
    const vacation = read('views/partials/modalVacacionesNomina.html');
    const employee = read('views/empleado.html');
    const script = read('dist/scripts/PayrollEmpleado.js');
    assert.doesNotMatch(salary, /payroll-vacation|form-payroll-bonus|modal-payroll-bonus/);
    assert.match(salary, /Sueldo básico del período/);
    assert.match(vacation, /form id="form-payroll-vacation"/);
    assert.match(vacation, /select required id="payroll-vacation-replacement"/);
    assert.match(vacation, /únicamente sus propios permisos existentes/);
    assert.match(vacation, /no obtiene acceso de administrador ni hereda acciones especiales del titular/);
    assert.doesNotMatch(employee, /btnPayrollBonus|modalBonoNomina/);
    assert.doesNotMatch(script, /postChange\('bono'/);
    assert.match(script, /postChange\('vacacion', \{ employeeId, replacementEmployeeId, startDate, endDate, reason \}, \$form/);
    assert.match(read('bonosNomina.php'), /http_response_code\(410\)/);
    assert.doesNotMatch(read('views/nav.html'), /href="bonosNomina.php"/);
    assert.match(read('views/partials/modalNuevaContabilidad.html'), /!empty\(\$puedeGestionarBonoCartera\)/);
    assert.match(read('cartera.php'), /e\.str_cargo='Super Administrador' OR o\.idempleado_administrador=e\.idempleado/);
});

test('ledger bonus requires the selected branch, created route and authorized employee', () => {
    const context = {
        branchId: 8, routeId: 91, state: 'created',
        employees: [{ employeeId: 2, name: 'Empleado autorizado' }]
    };
    const bonus = { branchId: 8, routeId: 91, employeeId: 2, amount: 100, reason: 'Reconocimiento' };
    assert.equal(validBonusContext(context, 8), true);
    assert.equal(validLedgerBonus(bonus, context), true);
    assert.equal(validLedgerBonus(bonus, { ...context, state: 'entregando' }), false);
    assert.equal(validLedgerBonus(bonus, { ...context, state: 'saved' }), false);
    assert.equal(validLedgerBonus({ ...bonus, branchId: 9 }, context), false);
    assert.equal(validLedgerBonus({ ...bonus, routeId: 92 }, context), false);
    assert.equal(validLedgerBonus({ ...bonus, employeeId: 3 }, context), false);
    assert.equal(validLedgerBonus({ ...bonus, amount: 0 }, context), false);
    assert.equal(validLedgerBonus({ ...bonus, amount: '99999999.99' }, context), true);
    assert.equal(validLedgerBonus({ ...bonus, amount: '100000000' }, context), false);
    assert.equal(validLedgerBonus({ ...bonus, amount: '1.001' }, context), false);
    assert.equal(validLedgerBonus({ ...bonus, amount: '1e2' }, context), false);
    assert.equal(validLedgerBonus({ ...bonus, reason: ' ' }, context), false);
    assert.equal(validLedgerBonus({ ...bonus, reason: 'x'.repeat(251) }, context), false);
});

test('direct bonus modal rejects closed context then posts one guarded ledger payment and refreshes cash', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const vm = require('node:vm');
    const source = fs.readFileSync(path.join(__dirname, '../dist/scripts/PayrollCartera.js'), 'utf8');
    const elements = new Map();
    const handlers = new Map();
    let posts = 0;
    let routeState = 'saved';
    let postedPayload = null;
    let cashRefreshes = 0;
    let accountRefreshes = 0;
    let confirmed = true;
    const $ = selector => {
        if (typeof selector === 'function') { selector(); return; }
        if (!elements.has(selector)) elements.set(selector, {
            length: 1, checked: false, value: '', disabled: false,
            attr() { return '8'; },
            prop(name, value) {
                if (value === undefined) return this[name];
                this[name] = value; return this;
            },
            val(value) { if (value === undefined) return this.value; this.value = value; return this; },
            on(event, handler) { handlers.set(`${selector}:${event}`, handler); return this; },
            toggle() { return this; }, toggleClass() { return this; },
            text(value) { this.message = value; return this; },
            empty() { return this; }, each() { return this; }, append() { return this; },
            find() { return this; }, modal() { return this; },
            removeClass() { return this; }, addClass() { return this; }
        });
        return elements.get(selector);
    };
    $.ajax = options => {
        if (options.method === 'POST') { posts++; postedPayload = options.data; }
        return {
            done(callback) {
                callback(options.method === 'POST' ? (confirmed
                    ? { ok: true, id: 'bonus-1', expenseId: 'expense-1', branchId: 8, routeId: 91 }
                    : { ok: true }) :
                    { branchId: 8, routeId: 91, state: routeState,
                        employees: [{ employeeId: 2, name: 'Empleado autorizado' }], csrfToken: 'token' });
                return this;
            },
            fail() { return this; }
        };
    };
    const window = {
        jQuery: $, crypto: { randomUUID: () => '12345678-1234-1234-1234-123456789012' },
        PayrollEmpleadoUI: { validBonusContext, validLedgerBonus, validPayrollSummary, formatCop },
        actualizarResumenCajaCartera() { cashRefreshes++; },
        DatosCobro() { accountRefreshes++; }
    };
    vm.runInNewContext(source, { window, document: {}, Map, Number, String, Date, Math });
    assert.equal(window.PayrollCartera.submitBonus({}), false);
    $('#payroll-ledger-bonus').checked = true;
    $('#txtrefSucursalHidden').value = '8';
    handlers.get('#payroll-ledger-bonus:change')();
    assert.match($('#payroll-ledger-bonus-status').message, /No hay un despacho abierto válido/);
    assert.equal(window.PayrollCartera.submitBonus({}), true);
    assert.match($('#payroll-ledger-bonus-status').message, /despacho en estado abierto/);
    assert.equal(posts, 0);
    routeState = 'created';
    handlers.get('#payroll-ledger-bonus:change')();
    $('#payroll-ledger-bonus-employee').value = '2';
    $('#payroll-ledger-bonus-amount').value = '100';
    $('#payroll-ledger-bonus-reason').value = 'Reconocimiento';
    assert.equal(window.PayrollCartera.submitBonus({}), true);
    assert.equal(posts, 1);
    assert.equal(postedPayload.action, 'bono');
    assert.equal(postedPayload.csrfToken, 'token');
    assert.deepEqual(JSON.parse(postedPayload.data), {
        branchId: 8, routeId: 91, employeeId: 2, amount: 100, reason: 'Reconocimiento',
        idempotencyToken: '12345678-1234-1234-1234-123456789012'
    });
    assert.equal(cashRefreshes, 1);
    assert.equal(accountRefreshes, 1);
    assert.match($('#payroll-cartera-result').message, /Bono guardado, pero no se pudo validar/);
    confirmed = false;
    assert.equal(window.PayrollCartera.submitBonus({}), true);
    assert.equal(posts, 2);
    assert.match($('#payroll-ledger-bonus-status').message, /No se confirmó el guardado/);
    $('#payroll-ledger-bonus').checked = false;
    assert.equal(window.PayrollCartera.submitBonus({}), true);
    assert.equal(posts, 2);
    assert.equal(cashRefreshes, 1);
});
