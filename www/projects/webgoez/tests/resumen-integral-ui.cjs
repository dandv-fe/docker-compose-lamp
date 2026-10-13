// Pruebas de funciones puras de dist/scripts/ResumenIntegral.js (sin navegador ni librerías).
// Ejecutar: node --test tests/resumen-integral-ui.cjs
// Integración opcional con una respuesta real del backend (JSON de ajax/ResumenIntegralAjax.php?op=resumen):
//   RI_FIXTURE_JSON=/ruta/resumen.json [RI_FIXTURE_EGRESOS_JSON=/ruta/egresos.json] node --test tests/resumen-integral-ui.cjs
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ui = require(path.join(__dirname, '../dist/scripts/ResumenIntegral.js'))
const plain = (s) => s.replace(/\s/g, ' ')
const NOW = new Date(2026, 9, 13, 8, 0, 0) // 13 oct 2026 local

const PERIOD_KEYS = ['recaudo', 'prestamos', 'ventas', 'adicionales', 'diferencia', 'descuento', 'valorCreditos',
    'gastosRuta', 'otrosGastos', 'salidas', 'entradas', 'utilidad', 'utilidadNeta', 'crecimiento', 'rutas', 'rutasPendientes']
const SNAPSHOT_KEYS = ['caja', 'carteraActiva', 'carteraMorosa', 'carteraRetirada', 'tarjetasActivas', 'tarjetasMorosas',
    'tarjetasRetiradas', 'carteraTotal', 'capitalActual', 'riesgoPct']

function periodMetrics(overrides) {
    const base = {}
    for (const k of PERIOD_KEYS) base[k] = 0
    return Object.assign(base, overrides)
}

function metrics(overrides) {
    const base = periodMetrics()
    for (const k of SNAPSHOT_KEYS) base[k] = 0
    base.riesgoPct = null
    return Object.assign(base, overrides)
}

function days(start, end, overrides) {
    const out = []
    for (let t = Date.parse(start + 'T00:00:00Z'); t <= Date.parse(end + 'T00:00:00Z'); t += 86400000) {
        const date = new Date(t).toISOString().slice(0, 10)
        out.push(Object.assign({ date }, periodMetrics((overrides || {})[date])))
    }
    return out
}

function response(overrides) {
    return Object.assign({
        period: { start: '2026-10-01', end: '2026-10-13', previousStart: '2026-09-18', previousEnd: '2026-09-30', snapshotAt: '2026-10-13 07:40:00' },
        scope: { office: 'Oficina Central', branches: [{ id: 1, code: 'A1', office: 'Norte' }, { id: 2, code: 'B2', office: 'Sur' }] },
        totals: metrics({ recaudo: '1500.50', prestamos: 800, ventas: 200, gastosRuta: 50, otrosGastos: 25 }),
        previous: periodMetrics({ recaudo: 1000 }),
        branches: [Object.assign({ id: 1, code: 'A1', office: 'Norte' }, metrics({ recaudo: 1500.5 }))],
        daily: days('2026-10-01', '2026-10-13', { '2026-10-03': { recaudo: 10, prestamos: 5, ventas: 1, gastosRuta: 2, otrosGastos: 1 } }),
        expenses: [],
        expenseDetails: { rows: [], total: 0, page: 1, pageSize: 50 }
    }, overrides)
}

function mutate(fn) {
    const r = JSON.parse(JSON.stringify(response()))
    fn(r)
    return r
}

test('csvCell neutraliza fórmulas pero conserva números negativos', () => {
    assert.equal(ui.csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"')
    assert.equal(ui.csvCell('+1'), '"\'+1"')
    assert.equal(ui.csvCell('-2+3'), '"\'-2+3"')
    assert.equal(ui.csvCell('@SUM(A1)'), '"\'@SUM(A1)"')
    assert.equal(ui.csvCell('  =1'), '"\'  =1"')
    assert.equal(ui.csvCell('\tcmd'), '"\'\tcmd"')
    assert.equal(ui.csvCell('Sucursal; "Norte"'), '"Sucursal; ""Norte"""')
    assert.equal(ui.csvCell(-1234.5), '-1234,5')
    assert.equal(ui.csvCell(null), '')
    assert.equal(ui.csvCell(NaN), '')
    assert.equal(ui.buildCsv([['a', 1], ['b', -2]]), '"a";1\r\n"b";-2')
})

test('rangeFor calcula atajos con fecha local', () => {
    const now = new Date(2026, 2, 15, 10, 0, 0)
    assert.deepEqual(ui.rangeFor('hoy', now), { desde: '2026-03-15', hasta: '2026-03-15' })
    assert.deepEqual(ui.rangeFor('mes', now), { desde: '2026-03-01', hasta: '2026-03-15' })
    assert.deepEqual(ui.rangeFor('mesAnterior', now), { desde: '2026-02-01', hasta: '2026-02-28' })
    assert.deepEqual(ui.rangeFor('mesAnterior', new Date(2026, 0, 5)), { desde: '2025-12-01', hasta: '2025-12-31' })
})

test('validateRange exige fechas válidas, orden, máximo 366 días y no futuro', () => {
    assert.equal(ui.validateRange('2026-10-01', '2026-10-13', NOW).ok, true)
    assert.equal(ui.validateRange('2026-02-30', '2026-03-01', NOW).field, 'desde')
    assert.equal(ui.validateRange('2026-10-13', '2026-10-01', NOW).ok, false)
    assert.equal(ui.validateRange('2024-01-01', '2024-12-31', NOW).ok, true) // 366 días (bisiesto)
    assert.equal(ui.validateRange('2025-01-01', '2026-01-02', NOW).ok, false)
    const futuro = ui.validateRange('2026-10-01', '2026-10-14', NOW)
    assert.equal(futuro.ok, false)
    assert.equal(futuro.field, 'hasta')
    assert.match(futuro.message, /posterior a hoy/)
    assert.equal(ui.validateRange('2026-10-14', '2026-10-14', NOW).ok, false)
    assert.equal(ui.validateRange('2026-10-14', '2026-10-14', new Date(2026, 9, 14, 0, 1)).ok, true)
    assert.equal(ui.daysInclusive('2026-03-28', '2026-03-30'), 3)
})

test('normalizeResumen acepta el contrato completo y deriva colocación/gasto', () => {
    const r = ui.normalizeResumen(response())
    assert.equal(r.ok, true)
    assert.equal(r.data.totals.recaudo, 1500.5)
    assert.equal(r.data.totals.colocacion, 1000)
    assert.equal(r.data.totals.gastoOperativo, 75)
    assert.equal(r.data.totals.riesgoPct, null)
    assert.equal(r.data.previous.caja, undefined)
    assert.equal(r.data.scope.branches[0].id, '1')
    assert.equal(r.data.daily.length, 13)
    assert.equal(r.data.expenseDetails.pages, 1)
    // rutas siguen siendo opcionales
    const sinRutas = mutate((x) => { delete x.totals.rutas; delete x.previous.rutasPendientes; x.daily.forEach((d) => delete d.rutas) })
    assert.equal(ui.normalizeResumen(sinRutas).ok, true)
})

test('normalizeResumen rechaza respuestas malformadas o incompletas sin inventar ceros', () => {
    const casos = [
        ['respuesta nula', null, 'respuesta'],
        ['solo error', { error: 'x' }, 'period'],
        ['totals vacío', mutate((r) => { r.totals = {} }), 'totals.recaudo'],
        ['sin expenseDetails', mutate((r) => { delete r.expenseDetails }), 'expenseDetails'],
        ['expenseDetails sin pageSize', mutate((r) => { delete r.expenseDetails.pageSize }), 'expenseDetails.pageSize'],
        ['sin previous', mutate((r) => { delete r.previous }), 'previous'],
        ['previous incompleto', mutate((r) => { delete r.previous.utilidadNeta }), 'previous.utilidadNeta'],
        ['sin previousStart', mutate((r) => { delete r.period.previousStart }), 'period.previousStart'],
        ['previousEnd inválida', mutate((r) => { r.period.previousEnd = '2026-02-30' }), 'period.previousEnd'],
        ['anterior se solapa', mutate((r) => { r.period.previousEnd = '2026-10-01'; r.period.previousStart = '2026-09-19' }), 'period.previousStart'],
        ['anterior con otra duración', mutate((r) => { r.period.previousStart = '2026-09-17' }), 'period.previousStart'],
        ['snapshot vacío', mutate((r) => { r.period.snapshotAt = '  ' }), 'period.snapshotAt'],
        ['caja nula', mutate((r) => { r.totals.caja = null }), 'totals.caja'],
        ['recaudo texto', mutate((r) => { r.totals.recaudo = 'abc' }), 'totals.recaudo'],
        ['recaudo notación exponencial', mutate((r) => { r.totals.recaudo = '1e3' }), 'totals.recaudo'],
        ['recaudo vacío', mutate((r) => { r.totals.recaudo = '' }), 'totals.recaudo'],
        ['recaudo booleano', mutate((r) => { r.totals.recaudo = true }), 'totals.recaudo'],
        ['riesgoPct ausente', mutate((r) => { delete r.totals.riesgoPct }), 'totals.riesgoPct'],
        ['rutas negativas', mutate((r) => { r.totals.rutas = -1 }), 'totals.rutas'],
        ['rutas decimales', mutate((r) => { r.totals.rutasPendientes = 1.5 }), 'totals.rutasPendientes'],
        ['daily sin ventas', mutate((r) => { delete r.daily[2].ventas }), 'daily[2].ventas'],
        ['daily recaudo nulo', mutate((r) => { r.daily[0].recaudo = null }), 'daily[0].recaudo'],
        ['daily fuera de período', mutate((r) => { r.daily[0].date = '2026-09-30' }), 'daily[0].date'],
        ['daily duplicado', mutate((r) => { r.daily[1].date = r.daily[0].date }), 'daily[1].date'],
        ['daily no es arreglo', mutate((r) => { r.daily = {} }), 'daily'],
        ['sucursal sin id', mutate((r) => { delete r.branches[0].id }), 'branches[0].id'],
        ['sucursal sin métrica', mutate((r) => { delete r.branches[0].carteraMorosa }), 'branches[0].carteraMorosa'],
        ['scope.branches inválido', mutate((r) => { r.scope.branches = null }), 'scope.branches'],
        ['scope sucursal sin id', mutate((r) => { r.scope.branches[1] = { code: 'X' } }), 'scope.branches[1].id'],
        ['egreso sin monto', mutate((r) => { r.expenses = [{ concept: 'a', category: 'b', amount: null, count: 1 }] }), 'expenses[0].amount'],
        ['egreso con conteo negativo', mutate((r) => { r.expenses = [{ concept: 'a', category: 'b', amount: 1, count: -1 }] }), 'expenses[0].count'],
        ['rango mayor a 366', mutate((r) => { r.period.start = '2025-01-01'; r.period.previousStart = '2023-12-29'; r.period.previousEnd = '2024-12-31' }), 'period.end']
    ]
    for (const [nombre, json, campo] of casos) {
        const r = ui.normalizeResumen(json)
        assert.equal(r.ok, false, nombre)
        assert.equal(r.field, campo, nombre)
        assert.match(r.message, /formato esperado/, nombre)
        assert.equal(r.data, undefined, nombre)
    }
    assert.equal(ui.normalizeResumen(mutate((r) => { r.totals.riesgoPct = 12.5 })).data.totals.riesgoPct, 12.5)
})

test('normalizeEgresos valida paginación y filas en lugar de inventar valores', () => {
    const fila = { date: '2026-10-05 10:00:00', branch: 'A1', concept: 'Gasolina', category: 'Ruta', amount: -50, detail: null }
    const ok = ui.normalizeEgresos({ rows: [fila], total: 120, page: 3, pageSize: 50 })
    assert.equal(ok.pages, 3)
    assert.equal(ok.rows[0].amount, -50)
    assert.equal(ok.rows[0].detail, '')
    assert.equal(ui.normalizeEgresos({ rows: [], total: 0, page: 1, pageSize: 50 }).pages, 1)
    const malos = [
        null,
        { rows: [] },
        { rows: [], total: 0, page: 1 },
        { rows: [], total: 0, page: 0, pageSize: 50 },
        { rows: [], total: 10, page: 2, pageSize: 50 },
        { rows: [], total: 1.5, page: 1, pageSize: 50 },
        { rows: [], total: -1, page: 1, pageSize: 50 },
        { rows: [], total: 0, page: 1, pageSize: 0 },
        { rows: [fila, fila], total: 2, page: 1, pageSize: 1 },
        { rows: [fila], total: 0, page: 1, pageSize: 50 },
        { rows: [Object.assign({}, fila, { amount: null })], total: 1, page: 1, pageSize: 50 },
        { rows: [Object.assign({}, fila, { date: '' })], total: 1, page: 1, pageSize: 50 },
        { rows: [Object.assign({}, fila, { concept: { x: 1 } })], total: 1, page: 1, pageSize: 50 },
        { rows: 'x', total: 1, page: 1, pageSize: 50 }
    ]
    malos.forEach((m, i) => assert.equal(ui.normalizeEgresos(m), null, 'caso ' + i))
})

test('fillDaily usa los valores del backend y deja huecos (null) si falta un día', () => {
    const data = ui.normalizeResumen(response()).data
    const series = ui.fillDaily(data.daily, data.period.start, data.period.end)
    assert.equal(series.length, 13)
    assert.deepEqual(series[2], { date: '2026-10-03', recaudo: 10, colocacion: 6, gastoOperativo: 3 })
    assert.equal(series[0].recaudo, 0)
    const incompleto = ui.normalizeResumen(mutate((r) => { r.daily.splice(4, 1) })).data
    const s2 = ui.fillDaily(incompleto.daily, incompleto.period.start, incompleto.period.end)
    assert.equal(s2.length, 13)
    assert.deepEqual(s2[4], { date: '2026-10-05', recaudo: null, colocacion: null, gastoOperativo: null })
})

test('filterBranches ignora tildes y mayúsculas; sortBranches deja nulos al final', () => {
    const list = [{ code: 'A1', office: 'Medellín', caja: null }, { code: 'B2', office: 'Bogotá', caja: -5 }, { code: 'C3', office: 'Cali', caja: 9 }]
    assert.deepEqual(ui.filterBranches(list, 'MEDELLIN').map((b) => b.code), ['A1'])
    assert.deepEqual(ui.filterBranches(list, 'c3').map((b) => b.code), ['C3'])
    assert.equal(ui.filterBranches(list, '  ').length, 3)
    assert.deepEqual(ui.sortBranches(list, 'caja', 'desc').map((b) => b.code), ['C3', 'B2', 'A1'])
    assert.deepEqual(ui.sortBranches(list, 'caja', 'asc').map((b) => b.code), ['B2', 'C3', 'A1'])
})

test('topBranches limita por magnitud y preserva negativos', () => {
    const list = Array.from({ length: 15 }, (_, i) => ({ office: 'S' + i, caja: i === 3 ? -1000 : i }))
    const top = ui.topBranches(list, 'caja', 10)
    assert.equal(top.items.length, 10)
    assert.equal(top.items[0].caja, -1000)
    assert.equal(top.withValue, 14)
    assert.equal(top.total, 15)
})

test('branchChartData distingue sucursales de una misma oficina por código', () => {
    const list = [
        { id: '1', code: 'R01', office: 'Oficina Centro', recaudo: 300 },
        { id: '2', code: 'R02', office: 'Oficina Centro', recaudo: -200 },
        { id: '3', code: 'R03', office: 'Oficina Centro', recaudo: 100 },
        { id: '4', code: 'R03', office: 'Oficina Centro', recaudo: 50 },
        { id: '5', code: '', office: 'Oficina Norte con un nombre bastante largo', recaudo: 10 }
    ]
    const c = ui.branchChartData(list, 'recaudo', 10)
    assert.deepEqual(c.fullLabels.slice(0, 2), ['R01 — Oficina Centro', 'R02 — Oficina Centro'])
    assert.equal(new Set(c.fullLabels).size, c.fullLabels.length)
    assert.deepEqual(c.fullLabels.slice(2, 4), ['R03 — Oficina Centro (id 3)', 'R03 — Oficina Centro (id 4)'])
    assert.equal(c.fullLabels[4], 'Oficina Norte con un nombre bastante largo')
    assert.ok(c.labels[4].length <= 34 && c.labels[4].endsWith('…'))
    assert.deepEqual(c.values, [300, -200, 100, 50, 10])
    assert.match(c.summary, /R02 — Oficina Centro/)
})

test('groupExpensesByCategory soporta categorías con nombres de propiedades de Object', () => {
    const especiales = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf']
    const exp = especiales.map((c, i) => ({ category: c, concept: 'x', amount: (i + 1) * 10, count: 1 }))
    exp.push({ category: '__proto__', concept: 'y', amount: 5, count: 2 })
    const g = ui.groupExpensesByCategory(exp, 10)
    assert.equal(g.categories, 5)
    const proto = g.groups.find((x) => x.label === '__proto__')
    assert.equal(proto.amount, 15)
    assert.equal(proto.count, 3)
    assert.equal(g.groups.find((x) => x.label === 'constructor').amount, 20)
    assert.equal(g.groups.find((x) => x.label === 'toString').amount, 30)
    assert.equal(({}).toString.name, 'toString') // prototipo intacto
})

test('groupExpensesByCategory agrupa el resto en "Otras"', () => {
    const exp = Array.from({ length: 12 }, (_, i) => ({ category: 'C' + i, concept: 'x', amount: i + 1, count: 1 }))
    exp.push({ category: 'C0', concept: 'y', amount: -100, count: 2 })
    const g = ui.groupExpensesByCategory(exp, 10)
    assert.equal(g.groups.length, 10)
    assert.equal(g.groups[0].label, 'C0')
    assert.equal(g.groups[0].amount, -99)
    assert.equal(g.groups[9].isOther, true)
    assert.equal(g.grouped, 3)
})

test('compareInfo describe variación con texto y sin dividir por cero', () => {
    assert.equal(ui.pctChange(150, 100), 50)
    assert.equal(ui.pctChange(10, 0), null)
    const up = ui.compareInfo(150, 100, 'up')
    assert.equal(up.tone, 'good')
    assert.match(plain(up.text), /Sube .*50,0 %/)
    assert.equal(ui.compareInfo(150, 100, 'down').tone, 'bad')
    assert.match(ui.compareInfo(5, 0, 'up').text, /período anterior fue cero/)
    assert.equal(ui.compareInfo(null, 1, 'up').tone, 'muted')
})

test('buildFacts reporta hechos e identifica sucursales con caja negativa por código', () => {
    const data = ui.normalizeResumen(response({
        totals: metrics({ recaudo: 500, caja: -20, carteraMorosa: 300, tarjetasMorosas: 4, carteraTotal: 1000, riesgoPct: 30, utilidadNeta: -10 }),
        previous: periodMetrics({ recaudo: 1000 }),
        branches: [
            Object.assign({ id: 1, code: 'R01', office: 'Centro' }, metrics({ caja: -5 })),
            Object.assign({ id: 2, code: 'R02', office: 'Centro' }, metrics({ caja: -15 })),
            Object.assign({ id: 3, code: 'R03', office: 'Centro' }, metrics({ caja: 0 }))
        ]
    })).data
    const texts = ui.buildFacts(data).map((f) => plain(f.text)).join(' | ')
    assert.match(texts, /Hay cartera en mora/)
    assert.match(texts, /caja vigente es negativa/)
    assert.match(texts, /2 sucursales tienen caja negativa: R01 — Centro, R02 — Centro\./)
    assert.match(texts, /margen neto es negativo/)
    assert.match(texts, /recaudo bajó/)
    assert.doesNotMatch(texts, /No se detectan/)
})

test('buildFacts y hasNoActivity con ceros válidos', () => {
    const data = ui.normalizeResumen(response({ totals: metrics({ carteraTotal: 0 }), previous: periodMetrics() })).data
    assert.equal(ui.hasNoActivity(data), true)
    assert.match(ui.buildFacts(data)[0].text, /No se registran operaciones/)
})

test('buildExportRows incluye todas las sucursales, días del período y nota de paginación', () => {
    const branches = Array.from({ length: 25 }, (_, i) => Object.assign({ id: i + 1, code: '=X' + i, office: 'O' + i }, metrics({ recaudo: i })))
    const data = ui.normalizeResumen(response({ branches, expenseDetails: { rows: [{ date: '2026-10-02', branch: 'O1', concept: '=cmd', category: 'G', amount: -5, detail: '' }], total: 120, page: 1, pageSize: 50 } })).data
    const rows = ui.buildExportRows(data, {}, 'Todas', '13/10/2026')
    const csv = ui.buildCsv(rows)
    assert.equal(rows.filter((r) => /^O\d+$/.test(r[2] || '')).length, 25)
    assert.match(csv, /Detalle diario \(13 días del período\)/)
    assert.doesNotMatch(csv, /días con registros/)
    assert.match(csv, /página 1 de 3 \(120 movimientos/)
    assert.match(csv, /"'=X0"/)
    assert.match(csv, /"'=cmd"/)
    assert.doesNotMatch(csv, /;"=/)
})

test('rutas sin cierre: se normalizan, generan aviso factual y no cuentan como inactividad', () => {
    const data = ui.normalizeResumen(response({
        totals: metrics({ rutas: '5', rutasPendientes: 2 }),
        previous: periodMetrics({ rutas: 3 })
    })).data
    assert.equal(data.totals.rutas, 5)
    assert.equal(data.previous.rutasPendientes, 0)
    assert.equal(ui.hasNoActivity(data), false)
    const text = ui.pendingRoutesText(data.totals)
    assert.match(text, /Hay 2 rutas del período sin cierre definitivo/)
    assert.match(text, /de 5 rutas/)
    assert.ok(ui.buildFacts(data).some((f) => f.tone === 'warn' && /sin cierre definitivo/.test(f.text)))
    const csv = ui.buildCsv(ui.buildExportRows(data, {}, 'Todas', 'hoy'))
    assert.match(csv, /2 sin cierre definitivo/)
    assert.match(csv, /"Rutas sin cierre definitivo";2;0/)
})

test('sin rutas pendientes o sin dato no hay aviso de rutas', () => {
    const sinDato = ui.normalizeResumen(response({ totals: metrics({ rutas: null, rutasPendientes: null }) })).data
    assert.equal(sinDato.totals.rutasPendientes, null)
    assert.ok(!ui.buildFacts(sinDato).some((f) => /sin cierre/.test(f.text)))
    const cero = ui.normalizeResumen(response({ totals: metrics({ rutas: 4, rutasPendientes: 0 }) })).data
    assert.ok(!ui.buildFacts(cero).some((f) => /sin cierre/.test(f.text)))
})

test('canExport solo permite exportar/imprimir con datos completos y egresos cargados', () => {
    const data = ui.normalizeResumen(response()).data
    assert.equal(ui.canExport({ data, loading: false, egresosStatus: 'ok' }), true)
    assert.equal(ui.canExport({ data: null, loading: false, egresosStatus: 'ok' }), false)
    assert.equal(ui.canExport({ data, loading: true, egresosStatus: 'ok' }), false)
    assert.equal(ui.canExport({ data, loading: false, egresosStatus: 'loading' }), false)
    assert.equal(ui.canExport({ data, loading: false, egresosStatus: 'error' }), false)
    assert.equal(ui.canExport(null), false)
})

const fixturePath = process.env.RI_FIXTURE_JSON
test('integración: respuesta real del backend cumple el contrato', { skip: fixturePath ? false : 'defina RI_FIXTURE_JSON con un JSON real de op=resumen' }, () => {
    const json = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
    const r = ui.normalizeResumen(json)
    assert.equal(r.ok, true, r.message)
    const d = r.data
    const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.01, msg + ': ' + a + ' vs ' + b)
    assert.equal(d.daily.length, ui.daysInclusive(d.period.start, d.period.end), 'el backend envía cada día del período')
    for (const k of ['recaudo', 'prestamos', 'ventas', 'gastosRuta', 'otrosGastos', 'utilidad', 'utilidadNeta', 'crecimiento']) {
        close(d.daily.reduce((s, x) => s + x[k], 0), d.totals[k], 'suma diaria de ' + k)
        close(d.branches.reduce((s, x) => s + x[k], 0), d.totals[k], 'suma por sucursal de ' + k)
    }
    for (const k of ['caja', 'carteraActiva', 'carteraMorosa', 'carteraRetirada']) {
        close(d.branches.reduce((s, x) => s + x[k], 0), d.totals[k], 'suma por sucursal de ' + k)
    }
    const t = d.totals
    close(t.utilidadNeta, t.utilidad - t.gastosRuta - t.otrosGastos, 'utilidadNeta')
    close(t.crecimiento, t.utilidadNeta - t.salidas + t.entradas, 'crecimiento')
    close(t.capitalActual, t.caja + t.carteraActiva, 'capitalActual')
    close(t.carteraTotal, t.carteraActiva + t.carteraMorosa + t.carteraRetirada, 'carteraTotal')
    if (t.carteraTotal > 0) close(t.riesgoPct, (t.carteraMorosa + t.carteraRetirada) / t.carteraTotal * 100, 'riesgoPct')
    else assert.equal(t.riesgoPct, null)
    const scopeIds = new Set(d.scope.branches.map((b) => b.id))
    d.branches.forEach((b) => assert.ok(scopeIds.has(b.id), 'sucursal ' + b.id + ' fuera de scope.branches'))
    if (d.totals.rutas !== null && d.totals.rutasPendientes !== null) assert.ok(d.totals.rutasPendientes <= d.totals.rutas)
    assert.ok(d.expenseDetails.rows.length <= d.expenseDetails.pageSize)
    if (process.env.RI_FIXTURE_EGRESOS_JSON) {
        const e = ui.normalizeEgresos(JSON.parse(fs.readFileSync(process.env.RI_FIXTURE_EGRESOS_JSON, 'utf8')))
        assert.notEqual(e, null, 'op=egresos con formato válido')
        assert.equal(e.total, d.expenseDetails.total, 'mismo total de egresos que op=resumen')
    }
})
