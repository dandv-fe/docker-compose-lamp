(function (global, $) {
  'use strict';
  const ui = global.DespacharUI;
  function text(tag, value, className) {
    return $(tag).text(value == null ? '' : String(value)).addClass(className || '');
  }
  function money(value) {
    return value != null && Number.isFinite(Number(value))
      ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
      : 'No calculable';
  }
  function invitation(key, description, onStorageError) {
    const $message = text('<p>', typeof description === 'string' && description.trim()
      ? description : 'Tu próximo reto: un paso a la vez.', 'dispatch-note');
    try {
      if (ui.markInvitationSeen(global.sessionStorage, key)) $message.addClass('dispatch-invitation');
    } catch (error) {
      if (onStorageError) onStorageError('No se pudo guardar el estado de la invitación; se muestra sin animación.');
    }
    return $message;
  }
  function validForecast(response) {
    const numeric = value => typeof value === 'number' && Number.isFinite(value);
    return Boolean(response && ['available', 'insufficient_data'].includes(response.status) &&
      response.salary && numeric(response.salary.baseAmount) && response.goal && response.collections &&
      ['targetCommission', 'otherCommission', 'routeCommission', 'commissionGap'].every(key => numeric(response.goal[key])) &&
      ['capitalRequired', 'collectionRequired'].every(key => response.goal[key] === null || numeric(response.goal[key])) &&
      ['dueAmount', 'arrearsAmount', 'advanceAmount'].every(key => numeric(response.collections[key])) &&
      Array.isArray(response.warnings) && response.warnings.every(warning => typeof warning === 'string'));
  }
  function forecast(response, name) {
    const $card = $('<article>').addClass('dispatch-card mt-3');
    text('<h4>', name).appendTo($card);
    [['Sueldo básico hasta la fecha', response.salary.baseAmount],
      ['Comisiones de otras carteras', response.goal.otherCommission],
      ['Comisión de esta cartera', response.goal.routeCommission],
      ['Comisión objetivo', response.goal.targetCommission],
      ['Comisión que falta', response.goal.commissionGap],
      ['Capital adicional estimado', response.goal.capitalRequired],
      ['Recaudo adicional estimado', response.goal.collectionRequired],
      ['Cuotas esperadas netas de anticipos', response.collections.dueAmount],
      ['Anticipos', response.collections.advanceAmount],
      ['Atrasos (separados)', response.collections.arrearsAmount]].forEach(([label, value]) =>
      text('<p>', `${label}: ${money(value)}`, 'small mb-1').appendTo($card));
    text('<p>', response.status === 'insufficient_data'
      ? 'Datos insuficientes: revise las advertencias antes de fijar metas.'
      : 'Previsión orientativa del servidor.', 'dispatch-tag').appendTo($card);
    response.warnings.forEach(warning => text('<p>', warning, 'dispatch-note mt-3').appendTo($card));
    text('<p>', 'Estimación, no garantía de recaudo ni de ganancias. No genera bonos ni cambia tu sueldo.', 'small text-muted').appendTo($card);
    return $card;
  }
  const numeric = value => typeof value === 'number' && Number.isFinite(value);
  const nullableNumeric = value => value === null || numeric(value);
  const strings = value => Array.isArray(value) && value.every(item => typeof item === 'string');
  const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  function validOwn(response) {
    return Boolean(response && Number.isSafeInteger(response.employeeId) && response.employeeId > 0 &&
      date(response.asOf) && Array.isArray(response.items) &&
      new Set(response.items.map(item => item && item.challengeId)).size === response.items.length &&
      response.items.every(item => item && typeof item.challengeId === 'string' && item.challengeId &&
        ['routeId', 'branchId'].every(key => Number.isSafeInteger(item[key]) && item[key] > 0) &&
        typeof item.branchName === 'string' && typeof item.routeState === 'string' &&
        typeof item.assigned === 'boolean' && ['active', 'expired', 'closed', 'unassigned'].includes(item.status) &&
        date(item.invitationDate) && date(item.deadline) &&
        (item.description === undefined || typeof item.description === 'string' && Array.from(item.description).length <= 250) &&
        ['incrementPercent', 'capitalGoal', 'collectionGoal'].every(key => numeric(item[key])) &&
        item.salary && typeof item.salary.configured === 'boolean' && numeric(item.salary.baseAmount) &&
        item.allocation && ['weight', 'capitalRate', 'collectionRate'].every(key => numeric(item.allocation[key])) &&
        item.goal && ['targetCommission', 'otherCommission', 'routeCommission', 'commissionGap',
          'projectedCommission', 'projectedEarnedWithoutBonuses', 'surplusAmount'].every(key => numeric(item.goal[key])) &&
        ['capitalRequired', 'collectionRequired', 'surplusPercent'].every(key => nullableNumeric(item.goal[key])) &&
        item.progress && ['creditedCapital', 'creditedCollection', 'capitalTarget', 'collectionTarget',
          'commissionAmount', 'targetCommission'].every(key => numeric(item.progress[key])) &&
        ['capitalPercent', 'collectionPercent', 'commissionPercent'].every(key => nullableNumeric(item.progress[key])) &&
        typeof item.progress.achieved === 'boolean' && item.forecast && item.forecast.estimated === true &&
        ['available', 'insufficient_data', 'not_applicable'].includes(item.forecast.status) &&
        strings(item.forecast.warnings) && (item.forecast.collections === null ||
          item.forecast.collections && item.forecast.collections.estimated === true &&
          ['available', 'insufficient_data'].includes(item.forecast.collections.status) &&
          ['dueAmount', 'arrearsAmount', 'advanceAmount', 'cardCount', 'invalidCardCount'].every(key => numeric(item.forecast.collections[key])) &&
          strings(item.forecast.collections.invalidReasons) && strings(item.forecast.collections.warnings))));
  }
  function percent(value) {
    return value === null ? 'Sin porcentaje calculable' : `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 }).format(value)}%`;
  }
  function own(item) {
    const $card = $('<article>').addClass('dispatch-card');
    const states = { active: 'En marcha', expired: 'Fecha cumplida', closed: 'Despacho cerrado', unassigned: 'Ya no asignado' };
    text('<span>', states[item.status], 'dispatch-tag').appendTo($card);
    text('<h3>', item.branchName).appendTo($card);
    text('<p>', `Invitación: ${item.invitationDate} · Fecha objetivo: ${item.deadline}`, 'small').appendTo($card);
    text('<h4>', 'Tu avance realizado').appendTo($card);
    [['Capital acreditado', item.progress.creditedCapital, item.progress.capitalTarget, item.progress.capitalPercent],
      ['Recaudo acreditado', item.progress.creditedCollection, item.progress.collectionTarget, item.progress.collectionPercent],
      ['Comisiones del período · todas las carteras', item.progress.commissionAmount, item.progress.targetCommission, item.progress.commissionPercent]
    ].forEach(([label, value, target, percentage]) => {
      const $metric = $('<div>').addClass('dispatch-note mb-2');
      text('<strong>', label).appendTo($metric);
      text('<p>', `${money(value)} de ${money(target)} · ${percent(percentage)}`, 'mb-0').appendTo($metric);
      $card.append($metric);
    });
    text('<p>', 'Avance neto firmado: los reversos pueden reducirlo, incluso por debajo de cero; puede superar el 100%.', 'small text-muted').appendTo($card);
    text('<p>', item.progress.achieved ? 'Objetivo de comisión alcanzado al corte del servidor.' : 'Sigue paso a paso; el avance no garantiza ganancias futuras.', 'small').appendTo($card);
    text('<p>', `Sueldo básico acumulado al corte: ${money(item.salary.baseAmount)}`, 'small').appendTo($card);
    if (!item.salary.configured) text('<p>', 'Sin contrato salarial configurado al corte. Revisa las advertencias.', 'dispatch-note').appendTo($card);
    if (item.forecast.status === 'available') {
      text('<h4>', 'Estimación con actividad objetivo restante').appendTo($card);
      [['Comisión que falta', item.goal.commissionGap],
        ['Capital adicional estimado', item.goal.capitalRequired],
        ['Recaudo adicional estimado', item.goal.collectionRequired],
        ['Devengado proyectado sin bonos', item.goal.projectedEarnedWithoutBonuses]
      ].forEach(([label, value]) => text('<p>', `${label}: ${money(value)}`, 'small mb-1').appendTo($card));
    } else {
      text('<p>', item.forecast.status === 'not_applicable'
        ? 'La previsión ya no aplica a este reto; se conserva el avance realizado.'
        : 'Datos insuficientes para estimar: no se muestra una promesa salarial.', 'dispatch-note').appendTo($card);
    }
    const collections = item.forecast.collections;
    if (collections && item.forecast.status !== 'not_applicable') {
      if (collections.status === 'available') {
        [['Cuotas esperadas netas de anticipos', collections.dueAmount],
          ['Anticipos', collections.advanceAmount], ['Atrasos (separados)', collections.arrearsAmount]]
          .forEach(([label, value]) => text('<p>', `${label}: ${money(value)}`, 'small mb-1').appendTo($card));
      } else text('<p>', 'Cronograma insuficiente para estimar cuotas.', 'dispatch-note').appendTo($card);
    }
    const warnings = item.forecast.warnings.concat(collections ? collections.warnings.concat(collections.invalidReasons) : []);
    Array.from(new Set(warnings)).forEach(warning => text('<p>', warning, 'dispatch-note').appendTo($card));
    text('<p>', 'Estimación, no garantía de recaudo ni de ganancias. No genera bonos ni cambia tu sueldo. El sueldo básico es único por período, no por cartera.', 'small text-muted').appendTo($card);
    return $card;
  }
  global.RetoCards = { invitation, validForecast, forecast, validOwn, own };
})(window, window.jQuery);
