/* Resumen integral: vista de solo lectura. Sin dependencias salvo Chart.js 2.9.4 (opcional). */
(function () {
  'use strict';

  var API_URL = 'ajax/ResumenIntegralAjax.php';
  var MAX_DAYS = 366;
  var REQUEST_TIMEOUT_MS = 60000;
  var CHART_TOP_BRANCHES = 10;
  var CHART_TOP_CATEGORIES = 10;
  var DAY_MS = 86400000;
  var ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
  var MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  var PERIOD_KEYS = ['recaudo', 'prestamos', 'ventas', 'adicionales', 'diferencia', 'descuento', 'valorCreditos',
    'gastosRuta', 'otrosGastos', 'salidas', 'entradas', 'utilidad', 'utilidadNeta', 'crecimiento', 'rutas', 'rutasPendientes'];
  var SNAPSHOT_KEYS = ['caja', 'carteraActiva', 'carteraMorosa', 'carteraRetirada', 'tarjetasActivas',
    'tarjetasMorosas', 'tarjetasRetiradas', 'carteraTotal', 'capitalActual', 'riesgoPct'];

  // type: money | count | pct. better: up | down | neutral (solo para colorear variaciones; siempre va con texto)
  var METRICS = {
    recaudo: { label: 'Recaudo', type: 'money', better: 'up' },
    prestamos: { label: 'Préstamos', type: 'money', better: 'neutral' },
    ventas: { label: 'Ventas', type: 'money', better: 'neutral' },
    colocacion: { label: 'Colocación (préstamos + ventas)', type: 'money', better: 'neutral' },
    adicionales: { label: 'Adicionales', type: 'money', better: 'up' },
    diferencia: { label: 'Diferencia', type: 'money', better: 'neutral' },
    descuento: { label: 'Descuentos', type: 'money', better: 'down' },
    valorCreditos: { label: 'Valor de créditos', type: 'money', better: 'neutral' },
    gastosRuta: { label: 'Gastos de ruta', type: 'money', better: 'down' },
    otrosGastos: { label: 'Otros gastos', type: 'money', better: 'down' },
    gastoOperativo: { label: 'Gasto operativo', type: 'money', better: 'down' },
    salidas: { label: 'Salidas', type: 'money', better: 'neutral' },
    entradas: { label: 'Entradas', type: 'money', better: 'neutral' },
    utilidad: { label: 'Margen generado (utilidad)', type: 'money', better: 'up' },
    utilidadNeta: { label: 'Utilidad neta', type: 'money', better: 'up' },
    crecimiento: { label: 'Crecimiento', type: 'money', better: 'up' },
    caja: { label: 'Caja vigente', type: 'money', better: 'up' },
    carteraActiva: { label: 'Cartera vigente', type: 'money', better: 'up' },
    carteraMorosa: { label: 'Cartera morosa', type: 'money', better: 'down' },
    carteraRetirada: { label: 'Cartera retirada', type: 'money', better: 'down' },
    tarjetasActivas: { label: 'Tarjetas activas', type: 'count', better: 'neutral' },
    tarjetasMorosas: { label: 'Tarjetas morosas', type: 'count', better: 'down' },
    tarjetasRetiradas: { label: 'Tarjetas retiradas', type: 'count', better: 'down' },
    carteraTotal: { label: 'Cartera total', type: 'money', better: 'neutral' },
    capitalActual: { label: 'Capital actual', type: 'money', better: 'up' },
    rutas: { label: 'Rutas del período', type: 'count', better: 'neutral' },
    rutasPendientes: { label: 'Rutas sin cierre definitivo', type: 'count', better: 'neutral' },
    riesgoPct: { label: 'Riesgo de cartera', type: 'pct', better: 'down' }
  };

  var COMPARISON_ROWS = ['rutas', 'rutasPendientes', 'recaudo', 'prestamos', 'ventas', 'colocacion', 'valorCreditos', 'adicionales', 'diferencia',
    'descuento', 'utilidad', 'gastosRuta', 'otrosGastos', 'gastoOperativo', 'utilidadNeta', 'salidas', 'entradas', 'crecimiento'];

  var BRANCH_COLUMNS = ['rutas', 'rutasPendientes', 'recaudo', 'colocacion', 'gastoOperativo', 'utilidad', 'utilidadNeta', 'crecimiento',
    'caja', 'carteraActiva', 'carteraMorosa', 'carteraRetirada', 'riesgoPct'];

  var DAILY_COLUMNS = ['rutas', 'rutasPendientes', 'recaudo', 'prestamos', 'ventas', 'gastosRuta', 'otrosGastos', 'utilidad', 'utilidadNeta',
    'salidas', 'entradas', 'crecimiento'];

  /* ---------------------------------------------------------------- utilidades puras */

  var NUMERIC_TEXT = /^-?\d+(\.\d+)?$/;

  // Acepta números finitos o texto decimal simple (p. ej. DECIMAL serializado como string). Nada más.
  function toNumber(value) {
    if (typeof value === 'number') return isFinite(value) ? value : null;
    if (typeof value === 'string' && NUMERIC_TEXT.test(value.trim())) {
      var n = Number(value.trim());
      return isFinite(n) ? n : null;
    }
    return null;
  }

  function toText(value, fallback) {
    if (value === null || value === undefined) return fallback || '';
    var s = String(value).trim();
    return s === '' ? (fallback || '') : s;
  }

  function sumValues(a, b) {
    return a === null || b === null ? null : a + b;
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function toIsoLocal(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function parseIsoUtc(text) {
    var m = ISO_DATE.exec(String(text || ''));
    if (!m) return null;
    var y = +m[1];
    var mo = +m[2] - 1;
    var d = +m[3];
    var t = Date.UTC(y, mo, d);
    var check = new Date(t);
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo || check.getUTCDate() !== d) return null;
    return t;
  }

  function isoFromUtc(t) {
    var d = new Date(t);
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }

  function rangeFor(kind, now) {
    var y = now.getFullYear();
    var m = now.getMonth();
    if (kind === 'hoy') return { desde: toIsoLocal(now), hasta: toIsoLocal(now) };
    if (kind === 'mesAnterior') {
      return { desde: toIsoLocal(new Date(y, m - 1, 1)), hasta: toIsoLocal(new Date(y, m, 0)) };
    }
    return { desde: toIsoLocal(new Date(y, m, 1)), hasta: toIsoLocal(now) };
  }

  function daysInclusive(desde, hasta) {
    var a = parseIsoUtc(desde);
    var b = parseIsoUtc(hasta);
    if (a === null || b === null) return null;
    return Math.round((b - a) / DAY_MS) + 1;
  }

  function validateRange(desde, hasta, now) {
    if (parseIsoUtc(desde) === null) return { ok: false, field: 'desde', message: 'Indique una fecha inicial válida.' };
    if (parseIsoUtc(hasta) === null) return { ok: false, field: 'hasta', message: 'Indique una fecha final válida.' };
    var today = toIsoLocal(now instanceof Date ? now : new Date());
    if (hasta > today) return { ok: false, field: 'hasta', message: 'La fecha final no puede ser posterior a hoy (' + describeDate(today) + ').' };
    var days = daysInclusive(desde, hasta);
    if (days < 1) return { ok: false, field: 'hasta', message: 'La fecha final no puede ser anterior a la inicial.' };
    if (days > MAX_DAYS) {
      return { ok: false, field: 'hasta', message: 'El rango tiene ' + days + ' días; el máximo permitido es ' + MAX_DAYS + '.' };
    }
    return { ok: true, days: days };
  }

  function describeDate(iso, withYear) {
    var t = parseIsoUtc(iso);
    if (t === null) return toText(iso, '—');
    var d = new Date(t);
    var text = d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()];
    return withYear === false ? text : text + ' ' + d.getUTCFullYear();
  }

  function describeRange(start, end) {
    if (!start || !end) return '—';
    if (start === end) return describeDate(start);
    return describeDate(start) + ' – ' + describeDate(end);
  }

  function describeDateTime(text) {
    var s = toText(text);
    var m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/.exec(s);
    if (m) return describeDate(m[1]) + ', ' + m[2] + ':' + m[3];
    if (ISO_DATE.test(s)) return describeDate(s);
    return s || '—';
  }

  var moneyFormatter = null;
  var numberFormatter = null;
  var decimalFormatter = null;

  function formatMoney(value) {
    var n = toNumber(value);
    if (n === null) return '—';
    if (!moneyFormatter) {
      moneyFormatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    return moneyFormatter.format(n === 0 ? 0 : n);
  }

  function formatCount(value) {
    var n = toNumber(value);
    if (n === null) return '—';
    if (!numberFormatter) numberFormatter = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
    return numberFormatter.format(n);
  }

  function formatPercent(value) {
    var n = toNumber(value);
    if (n === null) return '—';
    if (!decimalFormatter) decimalFormatter = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return decimalFormatter.format(n) + ' %';
  }

  function formatCompact(value) {
    var n = toNumber(value);
    if (n === null) return '';
    var abs = Math.abs(n);
    var sign = n < 0 ? '-' : '';
    if (abs >= 1e9) return sign + (abs / 1e9).toFixed(1).replace('.', ',') + ' mil M';
    if (abs >= 1e6) return sign + (abs / 1e6).toFixed(1).replace('.', ',') + ' M';
    if (abs >= 1e3) return sign + (abs / 1e3).toFixed(0) + ' mil';
    return sign + String(Math.round(abs));
  }

  function formatMetric(key, value) {
    var meta = METRICS[key] || { type: 'money' };
    if (meta.type === 'pct') return formatPercent(value);
    if (meta.type === 'count') return formatCount(value);
    return formatMoney(value);
  }

  function pctChange(current, previous) {
    if (current === null || previous === null || previous === 0) return null;
    return (current - previous) / Math.abs(previous) * 100;
  }

  function compareInfo(current, previous, better) {
    if (current === null || previous === null) return { tone: 'muted', text: 'Sin datos para comparar con el período anterior.' };
    var diff = current - previous;
    if (diff === 0) return { tone: 'muted', text: '= Igual que el período anterior.' };
    var up = diff > 0;
    var pct = pctChange(current, previous);
    var text = (up ? '▲ Sube ' : '▼ Baja ') + formatMoney(Math.abs(diff)) +
      (pct === null ? ' (el período anterior fue cero)' : ' (' + formatPercent(Math.abs(pct)) + ')') +
      ' frente al período anterior.';
    var tone = 'muted';
    if (better === 'up') tone = up ? 'good' : 'bad';
    else if (better === 'down') tone = up ? 'bad' : 'good';
    return { tone: tone, text: text, diff: diff, pct: pct };
  }

  function withDerived(metrics) {
    var m = {};
    var key;
    for (key in metrics) if (Object.prototype.hasOwnProperty.call(metrics, key)) m[key] = metrics[key];
    m.colocacion = sumValues(m.prestamos === undefined ? null : m.prestamos, m.ventas === undefined ? null : m.ventas);
    m.gastoOperativo = sumValues(m.gastosRuta === undefined ? null : m.gastosRuta, m.otrosGastos === undefined ? null : m.otrosGastos);
    return m;
  }

  var OPTIONAL_KEYS = ['rutas', 'rutasPendientes'];
  var NULLABLE_KEYS = ['riesgoPct'];

  function FormatError(path) { this.name = 'FormatError'; this.path = path; }

  function fail(path) { throw new FormatError(path); }

  function isPlainObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

  function reqObject(v, path) { if (!isPlainObject(v)) fail(path); return v; }

  function reqArray(v, path) { if (!Array.isArray(v)) fail(path); return v; }

  function reqNumber(v, path) { var n = toNumber(v); if (n === null) fail(path); return n; }

  function reqInt(v, path, min) {
    var n = reqNumber(v, path);
    if (Math.floor(n) !== n || n < min) fail(path);
    return n;
  }

  function reqDate(v, path) { if (typeof v !== 'string' || parseIsoUtc(v) === null) fail(path); return v; }

  function reqText(v, path) { if (typeof v !== 'string' || v.trim() === '') fail(path); return v.trim(); }

  function optText(v, path, fallback) {
    if (v === null || v === undefined) return fallback;
    if (typeof v !== 'string' && typeof v !== 'number') fail(path);
    return toText(v, fallback);
  }

  function reqId(v, path) {
    if ((typeof v === 'number' && isFinite(v)) || (typeof v === 'string' && v.trim() !== '')) return String(v).trim();
    return fail(path);
  }

  function readMetrics(src, keys, path) {
    reqObject(src, path);
    var out = {};
    keys.forEach(function (k) {
      var v = src[k];
      if (OPTIONAL_KEYS.indexOf(k) !== -1) {
        out[k] = v === undefined || v === null ? null : reqInt(v, path + '.' + k, 0);
      } else if (NULLABLE_KEYS.indexOf(k) !== -1 && v === null) {
        out[k] = null;
      } else {
        out[k] = reqNumber(v, path + '.' + k);
      }
    });
    return out;
  }

  function parseEgresos(json, path) {
    reqObject(json, path);
    var rows = reqArray(json.rows, path + '.rows');
    var total = reqInt(json.total, path + '.total', 0);
    var page = reqInt(json.page, path + '.page', 1);
    var pageSize = reqInt(json.pageSize, path + '.pageSize', 1);
    var pages = Math.max(1, Math.ceil(total / pageSize));
    if (page > pages) fail(path + '.page');
    if (rows.length > pageSize || rows.length > total) fail(path + '.rows');
    return {
      rows: rows.map(function (r, i) {
        var rp = path + '.rows[' + i + ']';
        reqObject(r, rp);
        return {
          date: reqText(r.date, rp + '.date'),
          branch: optText(r.branch, rp + '.branch', '—'),
          concept: optText(r.concept, rp + '.concept', 'Sin concepto'),
          category: optText(r.category, rp + '.category', 'Sin categoría'),
          amount: reqNumber(r.amount, rp + '.amount'),
          detail: optText(r.detail, rp + '.detail', '')
        };
      }),
      total: total,
      page: page,
      pageSize: pageSize,
      pages: pages
    };
  }

  function normalizeEgresos(json) {
    try {
      return parseEgresos(json, 'egresos');
    } catch (err) {
      if (err instanceof FormatError) return null;
      throw err;
    }
  }

  function parseResumen(json) {
    reqObject(json, 'respuesta');
    var p = reqObject(json.period, 'period');
    var start = reqDate(p.start, 'period.start');
    var end = reqDate(p.end, 'period.end');
    var previousStart = reqDate(p.previousStart, 'period.previousStart');
    var previousEnd = reqDate(p.previousEnd, 'period.previousEnd');
    var days = daysInclusive(start, end);
    if (days < 1 || days > MAX_DAYS) fail('period.end');
    if (previousEnd >= start || daysInclusive(previousStart, previousEnd) !== days) fail('period.previousStart');
    var snapshotAt = reqText(p.snapshotAt, 'period.snapshotAt');

    var scope = reqObject(json.scope, 'scope');
    var allKeys = PERIOD_KEYS.concat(SNAPSHOT_KEYS);
    var seenDates = Object.create(null);

    return {
      period: { start: start, end: end, previousStart: previousStart, previousEnd: previousEnd, snapshotAt: snapshotAt },
      scope: {
        office: optText(scope.office, 'scope.office', ''),
        branches: reqArray(scope.branches, 'scope.branches').map(function (b, i) {
          var bp = 'scope.branches[' + i + ']';
          reqObject(b, bp);
          return { id: reqId(b.id, bp + '.id'), code: optText(b.code, bp + '.code', ''), office: optText(b.office, bp + '.office', 'Sin nombre') };
        })
      },
      totals: withDerived(readMetrics(json.totals, allKeys, 'totals')),
      previous: withDerived(readMetrics(json.previous, PERIOD_KEYS, 'previous')),
      branches: reqArray(json.branches, 'branches').map(function (b, i) {
        var bp = 'branches[' + i + ']';
        var m = withDerived(readMetrics(b, allKeys, bp));
        m.id = reqId(b.id, bp + '.id');
        m.code = optText(b.code, bp + '.code', '');
        m.office = optText(b.office, bp + '.office', 'Sin nombre');
        return m;
      }),
      daily: reqArray(json.daily, 'daily').map(function (d, i) {
        var dp = 'daily[' + i + ']';
        reqObject(d, dp);
        var date = reqDate(d.date, dp + '.date');
        if (date < start || date > end || seenDates[date]) fail(dp + '.date');
        seenDates[date] = true;
        var m = withDerived(readMetrics(d, PERIOD_KEYS, dp));
        m.date = date;
        return m;
      }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }),
      expenses: reqArray(json.expenses, 'expenses').map(function (e, i) {
        var ep = 'expenses[' + i + ']';
        reqObject(e, ep);
        return {
          concept: optText(e.concept, ep + '.concept', 'Sin concepto'),
          category: optText(e.category, ep + '.category', 'Sin categoría'),
          amount: reqNumber(e.amount, ep + '.amount'),
          count: reqInt(e.count, ep + '.count', 0)
        };
      }),
      expenseDetails: parseEgresos(json.expenseDetails, 'expenseDetails')
    };
  }

  function normalizeResumen(json) {
    try {
      return { ok: true, data: parseResumen(json) };
    } catch (err) {
      if (!(err instanceof FormatError)) throw err;
      return { ok: false, field: err.path, message: 'La respuesta del servidor no tiene el formato esperado (campo «' + err.path + '»).' };
    }
  }

  function hasNoActivity(data) {
    for (var i = 0; i < PERIOD_KEYS.length; i++) {
      var v = data.totals[PERIOD_KEYS[i]];
      if (v !== null && v !== 0) return false;
    }
    return data.expenses.length === 0 && data.expenseDetails.total === 0;
  }

  function fillDaily(daily, start, end) {
    var byDate = Object.create(null);
    daily.forEach(function (d) { byDate[d.date] = d; });
    var a = parseIsoUtc(start);
    var b = parseIsoUtc(end);
    var out = [];
    if (a === null || b === null || b < a || (b - a) / DAY_MS > MAX_DAYS) return out;
    for (var t = a; t <= b; t += DAY_MS) {
      var iso = isoFromUtc(t);
      var d = byDate[iso];
      out.push({
        date: iso,
        // Un día ausente queda como hueco (null), no como cero inventado.
        recaudo: d ? d.recaudo : null,
        colocacion: d ? d.colocacion : null,
        gastoOperativo: d ? d.gastoOperativo : null
      });
    }
    return out;
  }

  function normalizeSearch(text) {
    var s = String(text || '').toLowerCase();
    if (s.normalize) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return s.trim();
  }

  function filterBranches(branches, query) {
    var q = normalizeSearch(query);
    if (!q) return branches.slice();
    return branches.filter(function (b) {
      return normalizeSearch(b.code + ' ' + b.office).indexOf(q) !== -1;
    });
  }

  function sortBranches(branches, key, dir) {
    var factor = dir === 'asc' ? 1 : -1;
    return branches.slice().sort(function (a, b) {
      var va = key === 'office' || key === 'code' ? normalizeSearch(a[key]) : a[key];
      var vb = key === 'office' || key === 'code' ? normalizeSearch(b[key]) : b[key];
      if (va === null || va === undefined) return (vb === null || vb === undefined) ? 0 : 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === 'string') return va.localeCompare(vb, 'es', { numeric: true }) * factor;
      if (va < vb) return -1 * factor;
      if (va > vb) return 1 * factor;
      return 0;
    });
  }

  function topBranches(branches, key, limit) {
    var withValue = branches.filter(function (b) { return b[key] !== null && b[key] !== undefined && b[key] !== 0; });
    withValue.sort(function (a, b) { return Math.abs(b[key]) - Math.abs(a[key]); });
    return { items: withValue.slice(0, limit), withValue: withValue.length, total: branches.length };
  }

  function groupExpensesByCategory(expenses, limit) {
    var map = Object.create(null);
    var order = [];
    expenses.forEach(function (e) {
      var label = e.category || 'Sin categoría';
      if (!(label in map)) { map[label] = { label: label, amount: 0, count: 0 }; order.push(label); }
      map[label].amount += e.amount || 0;
      map[label].count += e.count || 0;
    });
    var groups = order.map(function (k) { return map[k]; });
    groups.sort(function (a, b) { return Math.abs(b.amount) - Math.abs(a.amount); });
    if (groups.length <= limit) return { groups: groups, grouped: 0, categories: groups.length };
    var kept = groups.slice(0, limit - 1);
    var rest = groups.slice(limit - 1);
    var other = { label: 'Otras ' + rest.length + ' categorías', amount: 0, count: 0, isOther: true };
    rest.forEach(function (g) { other.amount += g.amount; other.count += g.count; });
    kept.push(other);
    return { groups: kept, grouped: rest.length, categories: groups.length };
  }

  function pendingRoutesText(t) {
    var n = t.rutasPendientes;
    return (n === 1 ? 'Hay 1 ruta' : 'Hay ' + formatCount(n) + ' rutas') + ' del período sin cierre definitivo (abiertas o en entrega)' +
      (t.rutas !== null && t.rutas > 0 ? ' de ' + formatCount(t.rutas) + ' rutas' : '') +
      '. Las cifras del período las incluyen y pueden cambiar al cerrarlas.';
  }

  function buildFacts(data) {
    var t = data.totals;
    var prev = data.previous;
    var facts = [];

    if (hasNoActivity(data)) facts.push({ tone: 'info', text: 'No se registran operaciones ni egresos en el período consultado.' });
    if (t.rutasPendientes !== null && t.rutasPendientes > 0) facts.push({ tone: 'warn', text: pendingRoutesText(t) });

    if (t.recaudo !== null && prev.recaudo !== null && t.recaudo !== prev.recaudo) {
      var cmp = compareInfo(t.recaudo, prev.recaudo, 'up');
      facts.push({ tone: cmp.tone === 'good' ? 'good' : 'warn', text: 'El recaudo ' + (cmp.diff > 0 ? 'subió ' : 'bajó ') +
        formatMoney(Math.abs(cmp.diff)) + (cmp.pct === null ? '' : ' (' + formatPercent(Math.abs(cmp.pct)) + ')') +
        ' frente al período anterior de igual duración.' });
    }
    if (t.carteraMorosa !== null && t.carteraMorosa > 0) {
      facts.push({ tone: 'bad', text: 'Hay cartera en mora: ' + formatMoney(t.carteraMorosa) +
        (t.tarjetasMorosas ? ' en ' + formatCount(t.tarjetasMorosas) + ' tarjetas' : '') + '.' });
    }
    if (t.carteraRetirada !== null && t.carteraRetirada > 0) {
      facts.push({ tone: 'warn', text: 'Hay cartera retirada (falleció o discapacitado): ' + formatMoney(t.carteraRetirada) +
        (t.tarjetasRetiradas ? ' en ' + formatCount(t.tarjetasRetiradas) + ' tarjetas' : '') + '.' });
    }
    if (t.riesgoPct !== null && t.riesgoPct > 0) {
      facts.push({ tone: 'warn', text: 'El ' + formatPercent(t.riesgoPct) + ' de la cartera total está en mora o retirada.' });
    }
    if (t.caja !== null && t.caja < 0) facts.push({ tone: 'bad', text: 'La caja vigente es negativa: ' + formatMoney(t.caja) + '.' });

    var negativeBranches = data.branches.filter(function (b) { return b.caja !== null && b.caja < 0; });
    if (negativeBranches.length > 0 && data.branches.length > 1) {
      var names = negativeBranches.slice(0, 5).map(branchLabel).join(', ');
      facts.push({ tone: 'bad', text: negativeBranches.length + (negativeBranches.length === 1 ? ' sucursal tiene' : ' sucursales tienen') +
        ' caja negativa: ' + names + (negativeBranches.length > 5 ? ' y otras ' + (negativeBranches.length - 5) : '') + '.' });
    }
    if (t.utilidad !== null && t.utilidad < 0) facts.push({ tone: 'bad', text: 'El margen generado del período es negativo: ' + formatMoney(t.utilidad) + '.' });
    if (t.utilidadNeta !== null && t.utilidadNeta < 0) {
      facts.push({ tone: 'bad', text: 'El margen neto es negativo: los gastos operativos superan el margen generado en ' + formatMoney(Math.abs(t.utilidadNeta)) + '.' });
    }
    if (t.crecimiento !== null && t.crecimiento < 0) {
      facts.push({ tone: 'warn', text: 'El crecimiento del período es negativo (' + formatMoney(t.crecimiento) + ') después de salidas y entradas.' });
    }
    if (t.carteraTotal !== null && t.carteraTotal <= 0) facts.push({ tone: 'info', text: 'No hay saldo de cartera en el alcance consultado.' });

    var negatives = facts.filter(function (f) { return f.tone === 'bad'; }).length;
    if (negatives === 0 && !hasNoActivity(data)) {
      facts.push({ tone: 'good', text: 'No se detectan cajas negativas ni márgenes negativos en el alcance consultado.' });
    }
    return facts;
  }

  function csvCell(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return isFinite(value) ? String(value).replace('.', ',') : '';
    var s = String(value);
    // Evita inyección de fórmulas en hojas de cálculo.
    if (/^[=+\-@\t\r]/.test(s) || /^\s+[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function buildCsv(rows) {
    return rows.map(function (row) { return row.map(csvCell).join(';'); }).join('\r\n');
  }

  function branchLabel(branch) {
    if (!branch) return '';
    return branch.code ? branch.code + ' — ' + branch.office : branch.office;
  }

  function truncateLabel(text, max) {
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }

  // Etiquetas con código + oficina: varias sucursales de una misma oficina deben distinguirse.
  function branchChartData(branches, key, limit) {
    var top = topBranches(branches, key, limit);
    var full = top.items.map(branchLabel);
    var seen = Object.create(null);
    full.forEach(function (label) { seen[label] = (seen[label] || 0) + 1; });
    full = full.map(function (label, i) { return seen[label] > 1 ? label + ' (id ' + top.items[i].id + ')' : label; });
    return {
      fullLabels: full,
      labels: full.map(function (label) { return truncateLabel(label, 34); }),
      values: top.items.map(function (b) { return b[key]; }),
      withValue: top.withValue,
      total: top.total,
      summary: top.items.map(function (b, i) { return full[i] + ' ' + formatMetric(key, b[key]); }).join('; ')
    };
  }

  // Exportar/imprimir solo con una consulta completa y el detalle de egresos visible y válido.
  function canExport(st) {
    return !!(st && st.data && !st.loading && st.egresosStatus === 'ok');
  }

  function buildExportRows(data, applied, branchName, generatedAt) {
    var rows = [];
    var p = data.period;
    var expDetail = data.expenseDetails;
    rows.push(['Resumen integral']);
    rows.push(['Generado', generatedAt]);
    rows.push(['Alcance', data.scope.office || 'Sucursales autorizadas']);
    rows.push(['Sucursal', branchName]);
    rows.push(['Período desde', p.start, 'hasta', p.end]);
    rows.push(['Período anterior desde', p.previousStart || '', 'hasta', p.previousEnd || '']);
    rows.push(['Caja y cartera (situación actual) al', p.snapshotAt || '']);
    rows.push(['Nota', 'Operaciones por fecha de apertura de ruta, incluidas rutas abiertas o en entrega (' +
      (data.totals.rutasPendientes === null ? 'sin dato' : data.totals.rutasPendientes) + ' sin cierre definitivo). Egresos por fecha del movimiento; no sumar con gasto operativo.']);
    rows.push(['Nota', 'Caja vigente excluye movimientos en estado created. Cartera vigente excluye tarjetas inactivas, canceladas, morosas y retiradas.']);
    rows.push([]);
    rows.push(['Indicador', 'Período actual', 'Período anterior', 'Diferencia']);
    COMPARISON_ROWS.forEach(function (k) {
      var cur = data.totals[k];
      var prev = data.previous[k];
      rows.push([METRICS[k].label, cur, prev, cur === null || prev === null ? null : cur - prev]);
    });
    SNAPSHOT_KEYS.forEach(function (k) { rows.push([METRICS[k].label, data.totals[k], 'No aplica (situación actual)']); });
    rows.push([]);

    var branchKeys = ['colocacion', 'gastoOperativo'].concat(PERIOD_KEYS, SNAPSHOT_KEYS);
    rows.push(['Sucursales (' + data.branches.length + ')']);
    rows.push(['Id', 'Código', 'Oficina'].concat(branchKeys.map(function (k) { return METRICS[k].label; })));
    data.branches.forEach(function (b) {
      rows.push([b.id, b.code, b.office].concat(branchKeys.map(function (k) { return b[k]; })));
    });
    rows.push([]);

    var dailyKeys = ['colocacion', 'gastoOperativo'].concat(PERIOD_KEYS);
    rows.push(['Detalle diario (' + daysInclusive(p.start, p.end) + ' días del período)']);
    rows.push(['Fecha'].concat(dailyKeys.map(function (k) { return METRICS[k].label; })));
    data.daily.forEach(function (d) { rows.push([d.date].concat(dailyKeys.map(function (k) { return d[k]; }))); });
    rows.push([]);

    rows.push(['Egresos agrupados (fecha del movimiento, todos los egresos)']);
    rows.push(['Categoría', 'Concepto', 'Movimientos', 'Monto']);
    data.expenses.forEach(function (e) { rows.push([e.category, e.concept, e.count, e.amount]); });
    rows.push([]);

    rows.push(['Movimientos de egreso: página ' + expDetail.page + ' de ' + expDetail.pages + ' (' + expDetail.total +
      ' movimientos en total). Para el resto use la paginación de la vista o el reporte Egresos.']);
    rows.push(['Fecha', 'Sucursal', 'Concepto', 'Categoría', 'Monto', 'Detalle']);
    expDetail.rows.forEach(function (r) { rows.push([r.date, r.branch, r.concept, r.category, r.amount, r.detail]); });
    return rows;
  }

  var api = {
    toNumber: toNumber,
    toIsoLocal: toIsoLocal,
    rangeFor: rangeFor,
    daysInclusive: daysInclusive,
    validateRange: validateRange,
    describeDate: describeDate,
    describeRange: describeRange,
    formatMoney: formatMoney,
    formatPercent: formatPercent,
    formatCompact: formatCompact,
    pctChange: pctChange,
    compareInfo: compareInfo,
    normalizeResumen: normalizeResumen,
    normalizeEgresos: normalizeEgresos,
    hasNoActivity: hasNoActivity,
    fillDaily: fillDaily,
    filterBranches: filterBranches,
    sortBranches: sortBranches,
    topBranches: topBranches,
    groupExpensesByCategory: groupExpensesByCategory,
    branchLabel: branchLabel,
    branchChartData: branchChartData,
    buildFacts: buildFacts,
    pendingRoutesText: pendingRoutesText,
    csvCell: csvCell,
    buildCsv: buildCsv,
    buildExportRows: buildExportRows,
    canExport: canExport
  };

  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
    return;
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  /* ---------------------------------------------------------------- interfaz */

  var doc = document;
  var charts = {};
  var state = {
    data: null,
    applied: null,
    lastParams: null,
    branchSort: { key: 'recaudo', dir: 'desc' },
    loading: false,
    egresosStatus: 'ok'
  };
  var mainReq = { seq: 0, controller: null };
  var egresosReq = { seq: 0, controller: null };

  function $(id) { return doc.getElementById(id); }

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  function el(tag, opts, children) {
    var node = doc.createElement(tag);
    opts = opts || {};
    if (opts.className) node.className = opts.className;
    if (opts.text !== undefined) node.textContent = opts.text;
    if (opts.attrs) for (var k in opts.attrs) if (Object.prototype.hasOwnProperty.call(opts.attrs, k)) node.setAttribute(k, opts.attrs[k]);
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  function show(node, visible) { if (node) node.hidden = !visible; }

  function setText(id, text) { var n = $(id); if (n) n.textContent = text; }

  function numberClass(value) {
    return value !== null && value !== undefined && value < 0 ? 'text-right ri-num ri-negative' : 'text-right ri-num';
  }

  function metricCell(key, value, tag) {
    return el(tag || 'td', { className: numberClass(value), text: formatMetric(key, value) });
  }

  function activateMenu() {
    var li = $('li-consultaCobros');
    if (li) li.classList.add('menu-open');
    ['lia-consultaCobros', 'lia-resumenIntegral'].forEach(function (id) {
      var a = $(id);
      if (a) { a.classList.add('active'); if (id === 'lia-resumenIntegral') a.setAttribute('aria-current', 'page'); }
    });
  }

  /* ---------- red */

  function RequestError(message) { this.name = 'RequestError'; this.message = message; }
  RequestError.prototype = Object.create(Error.prototype);

  function messageForStatus(status, body) {
    if (body && typeof body.error === 'string' && body.error.trim() !== '') return body.error.trim().slice(0, 300);
    if (status === 401) return 'Su sesión expiró. Inicie sesión de nuevo.';
    if (status === 403) return 'No tiene permiso para consultar este resumen.';
    if (status === 422) return 'Los filtros enviados no son válidos.';
    if (status >= 500) return 'El servidor no pudo generar el resumen. Intente más tarde.';
    return 'Respuesta inesperada del servidor (HTTP ' + status + ').';
  }

  function requestJson(url, tracker) {
    if (tracker.controller) tracker.controller.abort();
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var seq = ++tracker.seq;
    var timedOut = false;
    tracker.controller = controller;
    var timer = setTimeout(function () { timedOut = true; if (controller) controller.abort(); }, REQUEST_TIMEOUT_MS);

    var promise = fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      return res.text().then(function (text) {
        var body = null;
        try { body = text ? JSON.parse(text) : null; } catch (e) { body = null; }
        if (!res.ok) throw new RequestError(messageForStatus(res.status, body));
        if (!body || typeof body !== 'object') throw new RequestError('El servidor respondió con un formato no válido.');
        if (typeof body.error === 'string' && body.error.trim() !== '') throw new RequestError(body.error.trim().slice(0, 300));
        return body;
      });
    }).catch(function (err) {
      if (err && err.name === 'AbortError') {
        if (timedOut) throw new RequestError('La consulta tardó demasiado. Reduzca el rango o intente de nuevo.');
        var aborted = new Error('superseded');
        aborted.superseded = true;
        throw aborted;
      }
      if (err instanceof RequestError) throw err;
      throw new RequestError('No fue posible conectar con el servidor. Verifique su conexión e intente de nuevo.');
    });

    return {
      seq: seq,
      promise: promise.then(function (v) { clearTimeout(timer); return v; }, function (e) { clearTimeout(timer); throw e; })
    };
  }

  function buildUrl(params) {
    if (!params) return API_URL;
    var q = [];
    for (var k in params) if (Object.prototype.hasOwnProperty.call(params, k)) q.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
    return API_URL + '?' + q.join('&');
  }

  /* ---------- estado visual */

  function updateActions() {
    var enabled = canExport(state);
    $('riBtnExportar').disabled = !enabled;
    $('riBtnImprimir').disabled = !enabled;
  }

  function setLoading(loading, message) {
    state.loading = loading;
    var results = $('riResultados');
    show($('riCargando'), loading);
    setText('riCargandoTexto', message || 'Consultando el resumen…');
    setText('riBtnConsultarTexto', loading ? 'Consultando…' : 'Consultar');
    if (results) {
      results.setAttribute('aria-busy', loading ? 'true' : 'false');
      results.classList.toggle('ri-is-stale', loading);
    }
    updateActions();
    if (loading) {
      $('riEgresosAnterior').disabled = true;
      $('riEgresosSiguiente').disabled = true;
    } else if (state.data) {
      var d = state.data.expenseDetails;
      $('riEgresosAnterior').disabled = d.page <= 1;
      $('riEgresosSiguiente').disabled = d.page >= d.pages;
    }
  }

  function hideResults() {
    state.data = null;
    show($('riResultados'), false);
    updateActions();
    // Vacía cifras para que no queden valores de una consulta anterior en el DOM.
    ['riKpiRecaudo', 'riKpiColocacion', 'riKpiGasto', 'riKpiUtilidad', 'riKpiCaja', 'riKpiCartera', 'riKpiRiesgo', 'riKpiCrecimiento']
      .forEach(function (id) { setText(id, '—'); setText(id + 'Detalle', ''); setText(id + 'Comparacion', ''); });
    ['riTablaComparativo', 'riTablaSucursales', 'riTablaDiaria', 'riTablaEgresos', 'riTablaEgresosDetalle'].forEach(function (id) {
      var t = $(id);
      if (!t) return;
      clear(t.tBodies[0]);
      if (t.tFoot) clear(t.tFoot);
    });
    clear($('riHechos'));
    Object.keys(charts).forEach(destroyChart);
  }

  function showError(message) {
    hideResults();
    show($('riVacio'), false);
    setText('riErrorTexto', message);
    show($('riError'), true);
  }

  function showEmpty(message) {
    hideResults();
    show($('riError'), false);
    setText('riVacioTexto', message);
    show($('riVacio'), true);
  }

  /* ---------- filtros */

  function readFilters() {
    return { desde: $('riDesde').value, hasta: $('riHasta').value, sucursal: $('riSucursal').value || '0' };
  }

  function setFilterError(message, field) {
    var box = $('riFiltroMensaje');
    ['riDesde', 'riHasta'].forEach(function (id) { $(id).removeAttribute('aria-invalid'); });
    if (!message) { show(box, false); box.textContent = ''; return; }
    box.textContent = message;
    show(box, true);
    if (field) {
      var input = $(field === 'desde' ? 'riDesde' : 'riHasta');
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    }
  }

  function fillBranchSelect(branches, selected) {
    var select = $('riSucursal');
    clear(select);
    select.appendChild(el('option', { text: 'Todas las sucursales autorizadas', attrs: { value: '0' } }));
    var sorted = branches.slice().sort(function (a, b) {
      return normalizeSearch(a.office).localeCompare(normalizeSearch(b.office), 'es', { numeric: true });
    });
    var found = false;
    sorted.forEach(function (b) {
      select.appendChild(el('option', { text: branchLabel(b), attrs: { value: b.id } }));
      if (b.id === selected) found = true;
    });
    select.value = found ? selected : '0';
  }

  function selectedBranchName(sucursal) {
    if (!state.data || !sucursal || sucursal === '0') return 'Todas las sucursales autorizadas';
    var match = state.data.scope.branches.filter(function (b) { return b.id === sucursal; })[0];
    return match ? branchLabel(match) : 'Sucursal ' + sucursal;
  }

  /* ---------- consulta principal */

  function consult(params) {
    state.lastParams = params;
    if (egresosReq.controller) egresosReq.controller.abort();
    egresosReq.seq++;
    show($('riError'), false);
    show($('riVacio'), false);
    setLoading(true);

    var req = requestJson(buildUrl(params), mainReq);
    req.promise.then(function (json) {
      if (req.seq !== mainReq.seq) return;
      var parsed = normalizeResumen(json);
      if (!parsed.ok) throw new RequestError(parsed.message);
      setLoading(false);
      applyResumen(parsed.data, params ? params.sucursal : '0');
    }).catch(function (err) {
      if (req.seq !== mainReq.seq || (err && err.superseded)) return;
      setLoading(false);
      showError(err && err.message ? err.message : 'Error inesperado al procesar el resumen.');
      if (window.console && err && !(err instanceof RequestError)) window.console.error(err);
    });
  }

  function setDateLimits(now) {
    var today = toIsoLocal(now);
    $('riDesde').max = today;
    $('riHasta').max = today;
  }

  function consultFromForm() {
    var now = new Date();
    setDateLimits(now);
    var f = readFilters();
    var v = validateRange(f.desde, f.hasta, now);
    if (!v.ok) { setFilterError(v.message, v.field); return; }
    setFilterError('');
    consult({ op: 'resumen', desde: f.desde, hasta: f.hasta, sucursal: f.sucursal });
  }

  function applyResumen(data, sucursal) {
    // Invalida cualquier página de egresos pedida con los filtros anteriores.
    if (egresosReq.controller) egresosReq.controller.abort();
    egresosReq.seq++;
    state.data = data;
    state.applied = { desde: data.period.start, hasta: data.period.end, sucursal: String(sucursal || '0') };
    $('riDesde').value = data.period.start;
    $('riHasta').value = data.period.end;
    fillBranchSelect(data.scope.branches, state.applied.sucursal);
    state.applied.sucursal = $('riSucursal').value;

    if (data.scope.branches.length === 0) { showEmpty('Su usuario no tiene sucursales autorizadas para este resumen.'); return; }
    if (data.branches.length === 0) { showEmpty('La sucursal seleccionada no tiene información disponible en su alcance.'); return; }

    show($('riError'), false);
    show($('riVacio'), false);
    renderContext(data);
    renderKpis(data);
    renderFacts(data);
    renderComparison(data);
    renderBranchTable();
    renderDaily(data);
    renderExpenses(data);
    renderExpenseDetails(data.expenseDetails);
    show($('riSinMovimientos'), hasNoActivity(data));
    var pending = data.totals.rutasPendientes !== null && data.totals.rutasPendientes > 0;
    setText('riAvisoPendientesTexto', pending ? pendingRoutesText(data.totals) +
      ' La caja vigente, en cambio, excluye los movimientos en estado «created».' : '');
    show($('riAvisoPendientes'), pending);
    show($('riResultados'), true);
    state.egresosStatus = 'ok';
    updateActions();
    // Los gráficos se dibujan con el contenedor visible para que Chart.js mida bien.
    renderCharts(data);
    updatePrintHeader();
  }

  /* ---------- render */

  function renderContext(data) {
    var p = data.period;
    var days = daysInclusive(p.start, p.end);
    setText('riPeriodoTexto', describeRange(p.start, p.end) + ' (' + days + (days === 1 ? ' día)' : ' días)'));
    setText('riAnteriorTexto', p.previousStart && p.previousEnd ? describeRange(p.previousStart, p.previousEnd) : 'Sin período anterior');
    setText('riSnapshotTexto', p.snapshotAt ? describeDateTime(p.snapshotAt) + ' (situación actual)' : 'Momento de la consulta');
    var branchText = state.applied.sucursal === '0'
      ? data.branches.length + (data.branches.length === 1 ? ' sucursal autorizada' : ' sucursales autorizadas')
      : selectedBranchName(state.applied.sucursal);
    // Superadmin: oficina seleccionada. Empleados: sus sucursales autorizadas, que pueden ser de varias oficinas.
    setText('riAlcanceTexto', data.scope.office ? data.scope.office + ' · ' + branchText
      : (state.applied.sucursal === '0' ? branchText : 'Sucursales autorizadas · ' + branchText));
  }

  function setKpi(base, value, key, detail, compare) {
    var node = $(base);
    node.textContent = formatMetric(key, value);
    node.classList.toggle('ri-negative', value !== null && value < 0);
    setText(base + 'Detalle', detail);
    var cmpNode = $(base + 'Comparacion');
    cmpNode.className = 'ri-kpi-compare ri-tone-' + (compare ? compare.tone : 'muted');
    cmpNode.textContent = compare ? compare.text : 'Situación actual; no se compara con el período anterior.';
  }

  function renderKpis(data) {
    var t = data.totals;
    var prev = data.previous;
    setKpi('riKpiRecaudo', t.recaudo, 'recaudo', 'Cobros por fecha de apertura de ruta' +
      (t.rutas !== null ? ' (' + formatCount(t.rutas) + (t.rutas === 1 ? ' ruta' : ' rutas') +
        (t.rutasPendientes ? ', ' + formatCount(t.rutasPendientes) + ' sin cierre' : '') + ')' : '') + '.', compareInfo(t.recaudo, prev.recaudo, 'up'));
    setKpi('riKpiColocacion', t.colocacion, 'colocacion',
      'Préstamos ' + formatMoney(t.prestamos) + ' · Ventas ' + formatMoney(t.ventas) + '.',
      compareInfo(t.colocacion, prev.colocacion, 'neutral'));
    setKpi('riKpiGasto', t.gastoOperativo, 'gastoOperativo',
      'Ruta ' + formatMoney(t.gastosRuta) + ' · Otros ' + formatMoney(t.otrosGastos) + '. Sin préstamos, ventas ni salidas tipo 6.',
      compareInfo(t.gastoOperativo, prev.gastoOperativo, 'down'));
    setKpi('riKpiUtilidad', t.utilidadNeta, 'utilidadNeta',
      'Margen generado ' + formatMoney(t.utilidad) + ' − gasto operativo ' + formatMoney(t.gastoOperativo) + '. No es ganancia cobrada.',
      compareInfo(t.utilidadNeta, prev.utilidadNeta, 'up'));
    setKpi('riKpiCaja', t.caja, 'caja', (t.caja !== null && t.caja < 0 ? 'Caja negativa. ' : '') +
      'Saldo contable actual; excluye movimientos en estado «created».', null);
    setKpi('riKpiCartera', t.carteraActiva, 'carteraActiva',
      formatCount(t.tarjetasActivas) + ' tarjetas activas (sin inactivas, morosas ni retiradas) · Capital actual ' + formatMoney(t.capitalActual) + '.', null);
    setKpi('riKpiRiesgo', t.riesgoPct, 'riesgoPct',
      t.riesgoPct === null ? 'Sin cartera para calcular el riesgo.'
        : 'Morosa ' + formatMoney(t.carteraMorosa) + ' + retirada ' + formatMoney(t.carteraRetirada) + ' de ' + formatMoney(t.carteraTotal) + '.',
      null);
    if (t.riesgoPct === null) setText('riKpiRiesgo', 'Sin dato');
    setKpi('riKpiCrecimiento', t.crecimiento, 'crecimiento',
      'Utilidad neta − salidas ' + formatMoney(t.salidas) + ' + entradas ' + formatMoney(t.entradas) + '. No es flujo de caja.',
      compareInfo(t.crecimiento, prev.crecimiento, 'up'));
  }

  function renderFacts(data) {
    var list = $('riHechos');
    clear(list);
    var icons = { bad: '⚠', warn: '!', good: '✓', info: 'i' };
    var words = { bad: 'Atención', warn: 'Aviso', good: 'Bien', info: 'Dato' };
    buildFacts(data).forEach(function (f) {
      list.appendChild(el('li', { className: 'ri-fact ri-fact-' + f.tone }, [
        el('span', { className: 'ri-fact-badge', text: icons[f.tone] + ' ' + words[f.tone] }),
        el('span', { text: f.text })
      ]));
    });
  }

  function renderComparison(data) {
    var body = $('riTablaComparativo').tBodies[0];
    clear(body);
    COMPARISON_ROWS.forEach(function (k) {
      var cur = data.totals[k];
      var prev = data.previous[k];
      var diff = cur === null || prev === null ? null : cur - prev;
      var pct = pctChange(cur, prev);
      var strong = k === 'utilidadNeta' || k === 'crecimiento' || k === 'colocacion' || k === 'gastoOperativo';
      body.appendChild(el('tr', { className: strong ? 'ri-row-strong' : '' }, [
        el('th', { text: METRICS[k].label, attrs: { scope: 'row' } }),
        metricCell(k, cur), metricCell(k, prev), metricCell(k, diff),
        el('td', { className: numberClass(pct), text: pct === null ? (diff === 0 ? '0,0 %' : 'Sin base') : formatPercent(pct) })
      ]));
    });
  }

  function buildBranchHead() {
    var head = $('riTablaSucursales').tHead;
    clear(head);
    var row = el('tr');
    var columns = [{ key: 'code', label: 'Código', num: false }, { key: 'office', label: 'Oficina', num: false }]
      .concat(BRANCH_COLUMNS.map(function (k) { return { key: k, label: METRICS[k].label, num: true }; }));
    columns.forEach(function (c) {
      var active = state.branchSort.key === c.key;
      var th = el('th', { className: c.num ? 'text-right' : '', attrs: { scope: 'col', 'aria-sort': active ? (state.branchSort.dir === 'asc' ? 'ascending' : 'descending') : 'none' } });
      var btn = el('button', { className: 'ri-sort' + (active ? ' ri-sort-active' : ''), text: c.label, attrs: { type: 'button', 'data-ri-sort': c.key, title: 'Ordenar por ' + c.label } });
      btn.appendChild(el('span', { className: 'ri-sort-icon', text: active ? (state.branchSort.dir === 'asc' ? ' ▲' : ' ▼') : ' ↕', attrs: { 'aria-hidden': 'true' } }));
      th.appendChild(btn);
      row.appendChild(th);
    });
    head.appendChild(row);
  }

  function renderBranchTable() {
    var data = state.data;
    if (!data) return;
    buildBranchHead();
    var table = $('riTablaSucursales');
    var body = table.tBodies[0];
    clear(body);
    var query = $('riBuscarSucursal').value;
    var rows = sortBranches(filterBranches(data.branches, query), state.branchSort.key, state.branchSort.dir);
    rows.forEach(function (b) {
      var tr = el('tr', {}, [el('td', { text: b.code || '—' }), el('th', { text: b.office, attrs: { scope: 'row' } })]);
      BRANCH_COLUMNS.forEach(function (k) { tr.appendChild(metricCell(k, b[k])); });
      body.appendChild(tr);
    });
    if (rows.length === 0) {
      body.appendChild(el('tr', {}, [el('td', { className: 'text-center text-muted', text: 'Ninguna sucursal coincide con la búsqueda.', attrs: { colspan: String(BRANCH_COLUMNS.length + 2) } })]));
    }
    var foot = table.tFoot;
    clear(foot);
    var totalRow = el('tr', { className: 'ri-total-row' }, [el('th', { text: 'Total', attrs: { scope: 'row', colspan: '2' } })]);
    BRANCH_COLUMNS.forEach(function (k) { totalRow.appendChild(metricCell(k, data.totals[k], 'td')); });
    foot.appendChild(totalRow);
    setText('riSucursalesConteo', (query.trim() ? 'Mostrando ' + rows.length + ' de ' + data.branches.length + ' sucursales. ' : data.branches.length + (data.branches.length === 1 ? ' sucursal. ' : ' sucursales. ')) +
      'El total corresponde a todo el alcance, no solo a la búsqueda.');
  }

  function renderDaily(data) {
    var table = $('riTablaDiaria');
    clear(table.tHead);
    clear(table.tBodies[0]);
    var head = el('tr', {}, [el('th', { text: 'Fecha', attrs: { scope: 'col' } })]);
    DAILY_COLUMNS.forEach(function (k) { head.appendChild(el('th', { className: 'text-right', text: METRICS[k].label, attrs: { scope: 'col' } })); });
    table.tHead.appendChild(head);
    if (data.daily.length === 0) {
      table.tBodies[0].appendChild(el('tr', {}, [el('td', { className: 'text-center text-muted', text: 'Sin operaciones diarias en el período.', attrs: { colspan: String(DAILY_COLUMNS.length + 1) } })]));
      return;
    }
    data.daily.forEach(function (d) {
      var tr = el('tr', {}, [el('th', { text: describeDate(d.date), attrs: { scope: 'row' } })]);
      DAILY_COLUMNS.forEach(function (k) { tr.appendChild(metricCell(k, d[k])); });
      table.tBodies[0].appendChild(tr);
    });
  }

  function renderExpenses(data) {
    var table = $('riTablaEgresos');
    var body = table.tBodies[0];
    clear(body);
    clear(table.tFoot);
    var rows = data.expenses.slice().sort(function (a, b) {
      var c = normalizeSearch(a.category).localeCompare(normalizeSearch(b.category));
      return c !== 0 ? c : Math.abs(b.amount || 0) - Math.abs(a.amount || 0);
    });
    if (rows.length === 0) {
      body.appendChild(el('tr', {}, [el('td', { className: 'text-center text-muted', text: 'No hay egresos en el período.', attrs: { colspan: '4' } })]));
      return;
    }
    var total = 0;
    var count = 0;
    rows.forEach(function (e) {
      total += e.amount || 0;
      count += e.count || 0;
      body.appendChild(el('tr', {}, [
        el('td', { text: e.category }), el('td', { text: e.concept }),
        el('td', { className: 'text-right ri-num', text: formatCount(e.count) }), metricCell('amount', e.amount)
      ]));
    });
    table.tFoot.appendChild(el('tr', { className: 'ri-total-row' }, [
      el('th', { text: 'Total egresos', attrs: { scope: 'row', colspan: '2' } }),
      el('td', { className: 'text-right ri-num', text: formatCount(count) }), metricCell('amount', total)
    ]));
  }

  function renderExpenseDetails(details) {
    var table = $('riTablaEgresosDetalle');
    var body = table.tBodies[0];
    clear(body);
    table.setAttribute('aria-busy', 'false');
    table.classList.remove('ri-is-stale');
    show($('riEgresosError'), false);
    if (state.data) state.data.expenseDetails = details;
    if (details.rows.length === 0) {
      body.appendChild(el('tr', {}, [el('td', { className: 'text-center text-muted', text: 'No hay movimientos de egreso en esta página.', attrs: { colspan: '6' } })]));
    }
    details.rows.forEach(function (r) {
      body.appendChild(el('tr', {}, [
        el('td', { className: 'text-nowrap', text: describeDateTime(r.date) }), el('td', { text: r.branch }),
        el('td', { text: r.concept }), el('td', { text: r.category }), metricCell('amount', r.amount),
        el('td', { className: 'ri-detail-cell', text: r.detail || '—' })
      ]));
    });
    setText('riEgresosPagina', 'Página ' + details.page + ' de ' + details.pages + ' · ' + formatCount(details.total) +
      (details.total === 1 ? ' movimiento' : ' movimientos'));
    $('riEgresosAnterior').disabled = details.page <= 1;
    $('riEgresosSiguiente').disabled = details.page >= details.pages;
  }

  function loadExpensePage(page) {
    if (!state.applied || !state.data || state.loading) return;
    var table = $('riTablaEgresosDetalle');
    table.setAttribute('aria-busy', 'true');
    table.classList.add('ri-is-stale');
    $('riEgresosAnterior').disabled = true;
    $('riEgresosSiguiente').disabled = true;
    setText('riEgresosPagina', 'Cargando página ' + page + '…');
    state.egresosStatus = 'loading';
    updateActions();
    var a = state.applied;
    var req = requestJson(buildUrl({ op: 'egresos', desde: a.desde, hasta: a.hasta, sucursal: a.sucursal, pagina: page }), egresosReq);
    function done() { table.setAttribute('aria-busy', 'false'); table.classList.remove('ri-is-stale'); }
    req.promise.then(function (json) {
      if (req.seq !== egresosReq.seq) return;
      var parsed = normalizeEgresos(json);
      if (!parsed) throw new RequestError('La respuesta de egresos no tiene el formato esperado.');
      done();
      renderExpenseDetails(parsed);
      state.egresosStatus = 'ok';
      updateActions();
    }).catch(function (err) {
      if (req.seq !== egresosReq.seq || (err && err.superseded)) return;
      done();
      clear(table.tBodies[0]);
      state.egresosStatus = 'error';
      updateActions();
      var box = $('riEgresosError');
      box.textContent = 'No se pudieron cargar los movimientos de egreso: ' + (err && err.message ? err.message : 'error inesperado.') +
        ' Exportar e imprimir quedan deshabilitados hasta cargar una página correctamente.';
      show(box, true);
      var d = state.data.expenseDetails;
      setText('riEgresosPagina', 'Sin datos. Última página cargada: ' + d.page + ' de ' + d.pages);
      $('riEgresosAnterior').disabled = d.page <= 1;
      $('riEgresosSiguiente').disabled = d.page >= d.pages;
    });
  }

  /* ---------- gráficos */

  function chartsAvailable() {
    return typeof window.Chart === 'function';
  }

  function destroyChart(key) {
    if (charts[key]) { charts[key].destroy(); delete charts[key]; }
  }

  function drawChart(key, canvasId, emptyId, config, summary) {
    var canvas = $(canvasId);
    var empty = !config;
    show(canvas.parentNode, !empty);
    show($(emptyId), empty);
    if (empty) { destroyChart(key); return; }
    canvas.setAttribute('aria-label', summary);
    var existing = charts[key];
    if (existing && existing.config.type === config.type) {
      existing.data = config.data;
      existing.options = config.options;
      existing.update();
      return;
    }
    destroyChart(key);
    charts[key] = new window.Chart(canvas.getContext('2d'), config);
  }

  function moneyAxis() {
    return { ticks: { beginAtZero: true, callback: function (v) { return formatCompact(v); } } };
  }

  function baseOptions(extra) {
    var opts = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      legend: { position: 'bottom', labels: { boxWidth: 12 } },
      tooltips: {
        callbacks: {
          label: function (item, data) {
            var ds = data.datasets[item.datasetIndex];
            var value = ds.data[item.index];
            var name = ds.label || data.labels[item.index];
            return name + ': ' + formatMoney(value);
          }
        }
      }
    };
    for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) opts[k] = extra[k];
    return opts;
  }

  function fullTitleTooltips(fullLabels) {
    return {
      callbacks: {
        title: function (items) { return items.length ? fullLabels[items[0].index] : ''; },
        label: function (item, data) { return data.datasets[item.datasetIndex].label + ': ' + formatMoney(data.datasets[item.datasetIndex].data[item.index]); }
      }
    };
  }

  function signedColors(values, positive) {
    return values.map(function (v) { return v < 0 ? '#dc3545' : positive; });
  }

  function trendConfig(data) {
    var series = fillDaily(data.daily, data.period.start, data.period.end);
    if (series.length === 0) return null;
    var many = series.length > 31;
    function ds(label, key, color) {
      return { label: label, data: series.map(function (d) { return d[key]; }), borderColor: color, backgroundColor: color,
        fill: false, lineTension: 0.2, borderWidth: 2, pointRadius: many ? 0 : 3, pointHitRadius: 6 };
    }
    return {
      type: 'line',
      data: {
        labels: series.map(function (d) { return describeDate(d.date, false); }),
        datasets: [ds('Recaudo', 'recaudo', '#17a2b8'), ds('Colocación', 'colocacion', '#3d5a99'), ds('Gasto operativo', 'gastoOperativo', '#e8590c')]
      },
      options: baseOptions({
        tooltips: { mode: 'index', intersect: false, callbacks: { label: function (item, d) { return d.datasets[item.datasetIndex].label + ': ' + formatMoney(item.yLabel); } } },
        scales: { xAxes: [{ ticks: { autoSkip: true, maxTicksLimit: 12, maxRotation: 0 } }], yAxes: [moneyAxis()] }
      })
    };
  }

  function carteraConfig(data) {
    var t = data.totals;
    var items = [
      { label: 'Vigente (activa)', value: t.carteraActiva, color: '#28a745' },
      { label: 'Morosa', value: t.carteraMorosa, color: '#dc3545' },
      { label: 'Retirada', value: t.carteraRetirada, color: '#6c757d' }
    ].filter(function (i) { return i.value !== null && i.value !== 0; });
    if (items.length === 0) return null;
    var hasNegative = items.some(function (i) { return i.value < 0; });
    var labels = items.map(function (i) { return i.label; });
    var values = items.map(function (i) { return i.value; });
    if (!hasNegative) {
      return {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: values, backgroundColor: items.map(function (i) { return i.color; }), borderWidth: 1 }] },
        options: baseOptions({ cutoutPercentage: 55 })
      };
    }
    // Con saldos negativos un anillo sería engañoso: se usan barras con signo.
    return {
      type: 'horizontalBar',
      data: { labels: labels, datasets: [{ label: 'Saldo', data: values, backgroundColor: items.map(function (i) { return i.value < 0 ? '#dc3545' : i.color; }) }] },
      options: baseOptions({ legend: { display: false }, scales: { xAxes: [moneyAxis()] } })
    };
  }

  function branchesConfig(data, key) {
    var chart = branchChartData(data.branches, key, CHART_TOP_BRANCHES);
    var note = $('riNotaSucursalesChart');
    if (chart.values.length === 0) { note.textContent = ''; return { config: null, summary: '' }; }
    note.textContent = (chart.withValue > CHART_TOP_BRANCHES
      ? 'Se muestran las ' + CHART_TOP_BRANCHES + ' sucursales de mayor magnitud de ' + chart.withValue + ' con valor distinto de cero.'
      : 'Se muestran ' + chart.values.length + ' sucursales con valor distinto de cero.') +
      ' La tabla y el CSV incluyen las ' + chart.total + '. Barras rojas = valores negativos.';
    return {
      summary: 'Comparación de sucursales por ' + METRICS[key].label + ': ' + chart.summary,
      config: {
        type: 'horizontalBar',
        data: {
          labels: chart.labels,
          datasets: [{ label: METRICS[key].label, data: chart.values, backgroundColor: signedColors(chart.values, '#3d8bfd') }]
        },
        options: baseOptions({ legend: { display: false }, tooltips: fullTitleTooltips(chart.fullLabels),
          scales: { xAxes: [moneyAxis()], yAxes: [{ ticks: { autoSkip: false } }] } })
      }
    };
  }

  function expensesConfig(data) {
    var grouped = groupExpensesByCategory(data.expenses, CHART_TOP_CATEGORIES);
    var note = $('riNotaEgresosChart');
    var groups = grouped.groups.filter(function (g) { return g.amount !== 0; });
    if (groups.length === 0) { note.textContent = ''; return { config: null, summary: '' }; }
    note.textContent = (grouped.grouped > 0
      ? 'Se muestran ' + (CHART_TOP_CATEGORIES - 1) + ' categorías y las ' + grouped.grouped + ' restantes se agrupan. '
      : '') + 'Incluye todos los egresos por fecha del movimiento. Barras rojas = montos negativos.';
    var values = groups.map(function (g) { return g.amount; });
    return {
      summary: 'Egresos por categoría: ' + groups.map(function (g) { return g.label + ' ' + formatMoney(g.amount); }).join('; '),
      config: {
        type: 'horizontalBar',
        data: {
          labels: groups.map(function (g) { return truncateLabel(g.label, 32); }),
          datasets: [{ label: 'Egresos', data: values, backgroundColor: signedColors(values, '#fd7e14') }]
        },
        options: baseOptions({ legend: { display: false }, tooltips: fullTitleTooltips(groups.map(function (g) { return g.label; })), scales: { xAxes: [moneyAxis()], yAxes: [{ ticks: { autoSkip: false } }] } })
      }
    };
  }

  function renderBranchChart() {
    if (!state.data || !chartsAvailable()) return;
    var key = $('riMetricaSucursales').value;
    var b = branchesConfig(state.data, key);
    drawChart('sucursales', 'riChartSucursales', 'riChartSucursalesVacio', b.config, b.summary);
  }

  function renderCharts(data) {
    var available = chartsAvailable();
    show($('riChartsError'), !available);
    var grid = doc.querySelector('.ri-chart-grid');
    show(grid, available);
    if (!available) return;
    try {
      var t = data.totals;
      drawChart('tendencia', 'riChartTendencia', 'riChartTendenciaVacio', trendConfig(data),
        'Tendencia diaria entre ' + describeRange(data.period.start, data.period.end) + '. Recaudo total ' + formatMoney(t.recaudo) +
        ', colocación ' + formatMoney(t.colocacion) + ', gasto operativo ' + formatMoney(t.gastoOperativo) + '.');
      drawChart('cartera', 'riChartCartera', 'riChartCarteraVacio', carteraConfig(data),
        'Cartera actual: vigente ' + formatMoney(t.carteraActiva) + ', morosa ' + formatMoney(t.carteraMorosa) + ', retirada ' + formatMoney(t.carteraRetirada) + '.');
      renderBranchChart();
      var e = expensesConfig(data);
      drawChart('egresos', 'riChartEgresos', 'riChartEgresosVacio', e.config, e.summary);
    } catch (err) {
      Object.keys(charts).forEach(destroyChart);
      show(grid, false);
      show($('riChartsError'), true);
      if (window.console) window.console.error(err);
    }
  }

  /* ---------- exportar e imprimir */

  function updatePrintHeader() {
    if (!state.data) return;
    var p = state.data.period;
    setText('riPrintAlcance', 'Alcance: ' + (state.data.scope.office || 'Sucursales autorizadas') + ' · ' + selectedBranchName(state.applied.sucursal));
    setText('riPrintPeriodo', 'Período: ' + describeRange(p.start, p.end) + ' · Comparado con: ' +
      (p.previousStart ? describeRange(p.previousStart, p.previousEnd) : '—') + ' · Caja y cartera al: ' + describeDateTime(p.snapshotAt));
    setText('riPrintGenerado', 'Impreso: ' + new Date().toLocaleString('es-CO'));
  }

  function exportCsv() {
    if (!canExport(state)) return;
    var a = state.applied;
    var rows = buildExportRows(state.data, a, selectedBranchName(a.sucursal), new Date().toLocaleString('es-CO'));
    var blob = new Blob(['\ufeff' + buildCsv(rows)], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = el('a', { attrs: { href: url, download: 'resumen-integral_' + a.desde + '_' + a.hasta + '_suc-' + a.sucursal.replace(/[^0-9A-Za-z]/g, '') + '.csv' } });
    link.style.display = 'none';
    doc.body.appendChild(link);
    link.click();
    setTimeout(function () { URL.revokeObjectURL(url); link.parentNode.removeChild(link); }, 1000);
  }

  /* ---------- eventos */

  function bind() {
    $('riFiltros').addEventListener('submit', function (ev) { ev.preventDefault(); consultFromForm(); });
    Array.prototype.forEach.call(doc.querySelectorAll('[data-ri-rango]'), function (btn) {
      btn.addEventListener('click', function () {
        var r = rangeFor(btn.getAttribute('data-ri-rango'), new Date());
        $('riDesde').value = r.desde;
        $('riHasta').value = r.hasta;
        consultFromForm();
      });
    });
    $('riBtnReintentar').addEventListener('click', function () { consult(state.lastParams); });
    $('riBtnExportar').addEventListener('click', exportCsv);
    $('riBtnImprimir').addEventListener('click', function () {
      if (!canExport(state)) return;
      updatePrintHeader();
      window.print();
    });
    window.addEventListener('beforeprint', updatePrintHeader);
    $('riMetricaSucursales').addEventListener('change', renderBranchChart);
    $('riBuscarSucursal').addEventListener('input', renderBranchTable);
    $('riTablaSucursales').tHead.addEventListener('click', function (ev) {
      var btn = ev.target.closest ? ev.target.closest('[data-ri-sort]') : null;
      if (!btn) return;
      var key = btn.getAttribute('data-ri-sort');
      var textual = key === 'code' || key === 'office';
      state.branchSort = state.branchSort.key === key
        ? { key: key, dir: state.branchSort.dir === 'asc' ? 'desc' : 'asc' }
        : { key: key, dir: textual ? 'asc' : 'desc' };
      renderBranchTable();
      var again = doc.querySelector('#riTablaSucursales [data-ri-sort="' + key + '"]');
      if (again) again.focus();
    });
    $('riEgresosAnterior').addEventListener('click', function () {
      if (state.data) loadExpensePage(state.data.expenseDetails.page - 1);
    });
    $('riEgresosSiguiente').addEventListener('click', function () {
      if (state.data) loadExpensePage(state.data.expenseDetails.page + 1);
    });
  }

  function init() {
    if (!$('riFiltros')) return;
    activateMenu();
    var now = new Date();
    setDateLimits(now);
    var r = rangeFor('mes', now);
    $('riDesde').value = r.desde;
    $('riHasta').value = r.hasta;
    bind();
    if (typeof fetch !== 'function') {
      showError('Este navegador no es compatible con la consulta. Actualícelo para continuar.');
      return;
    }
    consult(null);
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
