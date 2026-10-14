(function (global, $) {
  'use strict';
  const ui = global.DespacharUI;
  const endpoint = './ajax/DespacharAjax.php';
  let branches = [];
  let context = null;
  let step = 1;
  let saving = false;
  let uncertain = false;
  let frozenRequest = null;
  let contextSequence = 0;
  let previewSequence = 0;
  const selected = new Set();
  const challengeDrafts = new Map();
  const weights = new Map();

  function status(text, error, wizard) {
    $(wizard ? '#dispatch-wizard-status' : '#dispatch-status').toggleClass('text-danger', Boolean(error)).text(text);
  }
  function errorText(xhr) {
    return xhr && xhr.responseJSON && xhr.responseJSON.error || 'No se pudo consultar el despacho. Verifique la conexión.';
  }
  function request(action, data, post) {
    return $.ajax({ url: endpoint, method: post ? 'POST' : 'GET', dataType: 'json', cache: false,
      data: post ? { action, csrfToken: context.csrfToken, data: JSON.stringify(data) } : Object.assign({ action }, data || {})
    });
  }
  function text(tag, value, className) {
    return $(tag).text(value == null ? '' : String(value)).addClass(className || '');
  }
  function formatMoney(value) {
    return Number.isFinite(Number(value)) ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value) : 'No disponible';
  }
  function visibleBranches() {
    return ui.filterBranches(branches, $('#dispatch-search').val(), $('#dispatch-state').val());
  }
  function renderList() {
    const $cards = $('#dispatch-cards').empty();
    const visible = visibleBranches();
    visible.forEach(branch => {
      const $card = $('<article>').addClass('dispatch-card');
      text('<span>', branch.state === 'created' ? 'Despacho abierto' : branch.state === 'entregando' ? 'Entregando' : 'Por despachar', 'dispatch-tag').appendTo($card);
      text('<h3>', branch.name).appendTo($card);
      text('<p>', branch.officeName).appendTo($card);
      text('<p>', `${branch.assignedCount} personas asignadas`, 'small text-muted').appendTo($card);
      const $names = $('<ul>').addClass('dispatch-assigned');
      branch.assignedEmployees.forEach(employee => text('<li>', ui.personName(employee.name)).appendTo($names));
      $names.appendTo($card);
      $('<button>').attr({ type: 'button', class: 'btn btn-outline-primary' }).text(branch.state === 'entregando' ? 'Ver equipo' : 'Preparar despacho')
        .on('click', () => openBranch(branch.branchId)).appendTo($card);
      $cards.append($card);
    });
    $('#dispatch-empty').prop('hidden', visible.length !== 0);
    const $summary = $('#dispatch-summary').empty();
    [['Carteras', branches.length], ['Abiertas', branches.filter(branch => branch.state === 'created').length],
      ['Por despachar', branches.filter(branch => branch.state === 'available').length]].forEach(([label, count]) => {
      const $stat = $('<div>').addClass('dispatch-stat');
      text('<strong>', count).appendTo($stat); text('<span>', label).appendTo($stat); $summary.append($stat);
    });
  }
  function loadList(resultMessage) {
    status('Consultando carteras autorizadas…');
    $('#dispatch-refresh').prop('disabled', true);
    request('list').done(response => {
      if (!response || !Array.isArray(response.branches) || !response.branches.every(branch =>
        ui.positiveId(branch.branchId) && typeof branch.name === 'string' && typeof branch.officeName === 'string' &&
        Number.isSafeInteger(branch.assignedCount) && branch.assignedCount >= 0 &&
        Array.isArray(branch.assignedEmployees) && branch.assignedEmployees.every(employee =>
          ui.positiveId(employee.employeeId) && typeof employee.name === 'string'))) {
        status('El servidor devolvió un listado incompleto; no se mostrará como despacho válido.', true);
        return;
      }
      branches = response.branches.map(branch => Object.assign({}, branch, { state: branch.state || 'available' }));
      renderList();
      status(typeof resultMessage === 'string' ? resultMessage : branches.length ? 'Elige una cartera para empezar.' : 'No hay carteras autorizadas disponibles.');
    }).fail(xhr => status(errorText(xhr), true)).always(() => $('#dispatch-refresh').prop('disabled', false));
  }
  function setStep(value) {
    step = value;
    $('[data-dispatch-step]').each(function () { $(this).prop('hidden', Number($(this).attr('data-dispatch-step')) !== step); });
    $('[data-step-marker]').removeAttr('aria-current').filter(`[data-step-marker="${step}"]`).attr('aria-current', 'step');
    $('#dispatch-back').prop('disabled', step === 1 || saving || uncertain);
    $('#dispatch-next').prop('hidden', step === 4).prop('disabled', !context || saving || uncertain);
    $('#dispatch-confirm').prop('hidden', step !== 4).prop('disabled', !context || !context.canDispatch || saving || uncertain);
    $('#dispatch-step-label').text(`Paso ${step} de 4`);
    $(`[data-dispatch-step="${step}"] h3`).trigger('focus');
  }
  function draft() {
    const data = {
      branchId: Number(context.branch.branchId), expectedRouteId: Number(context.route && context.route.routeId || 0),
      expectedVersion: Number(context.route && context.route.version || 0), employeeIds: Array.from(selected),
      challenges: context.canSetChallenges && context.canDispatch ? Array.from(challengeDrafts.values()).filter(challenge => challenge.enabled && selected.has(challenge.employeeId)).map(challenge => ({
        employeeId: challenge.employeeId, capitalGoal: challenge.capitalGoal,
        collectionGoal: challenge.collectionGoal, deadline: challenge.deadline,
        incrementPercent: challenge.incrementPercent, description: challenge.description
      })) : []
    };
    if (context.canDistribute) data.distribution = {
      mode: $('#dispatch-mode').val(),
      weights: $('#dispatch-mode').val() === 'Personalizado'
        ? Array.from(selected).map(employeeId => ({ employeeId, weight: Number(weights.get(employeeId) || 0) })) : []
    };
    return data;
  }
  function clearPreview() {
    ++previewSequence;
    $('#dispatch-forecast').empty();
    $('#dispatch-preview').prop('disabled', !context || selected.size === 0 || saving || uncertain);
    status('', false, true);
  }
  function renderPeople() {
    const search = String($('#dispatch-person-search').val() || '').toLowerCase();
    const $people = $('#dispatch-people').empty();
    ui.employeeGroups(context.employees, context.branch, search).forEach(group => {
      const $group = $('<section>').addClass('dispatch-person-group');
      text('<h4>', group.name, 'dispatch-office-heading').appendTo($group);
      const $grid = $('<div>').addClass('dispatch-grid').appendTo($group);
      group.employees.forEach(employee => {
      const id = Number(employee.employeeId);
      const $label = $('<label>').addClass('dispatch-card dispatch-person');
      $('<input>').attr({ type: 'checkbox', 'aria-label': `Despachar a ${ui.personName(employee.name)}` }).prop('checked', selected.has(id))
        .prop('disabled', !context.canDispatch || saving || uncertain).on('change', function () {
          if (this.checked) selected.add(id); else selected.delete(id);
          clearPreview(); renderSelectedCount(); renderRules();
        }).appendTo($label);
      const $name = $('<div>');
      text('<strong>', ui.personName(employee.name)).appendTo($name);
      text('<small>', employee.officeName === null ? 'Sin oficina registrada' : employee.officeName).appendTo($name);
      if (employee.representative) text('<small>', 'Titular permanente de cartera').appendTo($name);
      if (employee.replacement) text('<small>', 'Relevo temporal vigente · permisos propios').appendTo($name);
      $name.appendTo($label); $grid.append($label);
      });
      $people.append($group);
    });
    renderSelectedCount();
  }
  function renderSelectedCount() {
    $('#dispatch-selected-count').text(`${selected.size} personas seleccionadas`);
  }
  function renderRules() {
    $('#dispatch-distribution').prop('hidden', !context.canDistribute);
    $('#dispatch-rule-readonly').text(context.canDistribute
      ? 'Sólo el Super Administrador edita esta instantánea de reparto.'
      : `Reparto de consulta: ${context.distribution && context.distribution.mode || 'No informado'}. La instantánea existente no se modifica al cambiar el equipo.`);
    if (!context.canDistribute && context.distribution.weights.length) {
      const shares = context.distribution.weights.map(weight => {
        const employee = context.employees.find(employee => Number(employee.employeeId) === Number(weight.employeeId));
        return `${employee ? employee.name : 'Empleado de la instantánea'}: ${weight.weight}%`;
      });
      $('#dispatch-rule-readonly').append(document.createTextNode(' ' + shares.join(' · ')));
    }
    const $weights = $('#dispatch-weights').empty();
    Array.from(selected).forEach(id => {
      const employee = context.employees.find(employee => Number(employee.employeeId) === id);
      const $label = $('<label>').addClass('dispatch-card');
      text('<span>', employee.name).appendTo($label);
      $('<input>').attr({ type: 'number', min: '0.01', max: '100', step: '0.01', class: 'form-control', 'aria-label': `Participación de ${employee.name} (%)` })
        .val(weights.get(id) || '').on('input', function () { weights.set(id, this.value); clearPreview(); renderWeightTotal(); }).appendTo($label);
      $weights.append($label);
    });
    $weights.prop('hidden', !context.canDistribute || $('#dispatch-mode').val() !== 'Personalizado');
    renderWeightTotal(); renderChallenges();
  }
  function renderWeightTotal() {
    const total = Array.from(selected).reduce((sum, id) => sum + Number(weights.get(id) || 0), 0);
    $('#dispatch-weight-total').text(`Total de participación: ${total.toFixed(2)}%`).prop('hidden', !context.canDistribute || $('#dispatch-mode').val() !== 'Personalizado');
  }
  function challengeInput($card, challenge, key, label, attrs) {
    const $label = $('<label>');
    text('<span>', label).appendTo($label);
    $('<input>').attr(Object.assign({ class: 'form-control' }, attrs)).val(challenge[key] == null ? '' : challenge[key])
      .on('input', function () { challenge[key] = this.value; clearPreview(); }).appendTo($label);
    $card.append($label);
  }
  function invitation(employeeId, challenge) {
    const revision = JSON.stringify([challenge.deadline, challenge.incrementPercent, challenge.capitalGoal, challenge.collectionGoal, challenge.description]);
    return global.RetoCards.invitation(`${context.branch.branchId}:${employeeId}:${revision}`, challenge.description,
      message => status(message, false, true));
  }
  function renderChallenges() {
    const $container = $('#dispatch-challenges').empty();
    Array.from(selected).forEach(id => {
      const employee = context.employees.find(employee => Number(employee.employeeId) === id);
      const challenge = challengeDrafts.get(id) || {
        employeeId: id, enabled: false, capitalGoal: '', collectionGoal: '', deadline: '', incrementPercent: '', description: ''
      };
      challengeDrafts.set(id, challenge);
      const $card = $('<article>').addClass('dispatch-card dispatch-challenge');
      text('<h4>', employee.name).appendTo($card);
      if (!context.canSetChallenges || !context.canDispatch) {
        text('<p>', 'Retos en consulta. Sólo el Super Administrador o el administrador real de esta oficina con permiso poner_retos de esta cartera pueden editarlos en un despacho abierto.', 'small').appendTo($card);
        if (challenge.enabled) {
          invitation(id, challenge).appendTo($card);
          text('<p>', `Hasta ${challenge.deadline} · incremento ${challenge.incrementPercent}%`, 'small').appendTo($card);
          text('<p>', `Capital: ${formatMoney(challenge.capitalGoal)} · Recaudo: ${formatMoney(challenge.collectionGoal)}`, 'small').appendTo($card);
        }
      } else {
        const $toggle = $('<label>').addClass('dispatch-person');
        $('<input>').attr({ type: 'checkbox' }).prop('checked', challenge.enabled).on('change', function () {
          challenge.enabled = this.checked; clearPreview(); renderChallenges();
        }).appendTo($toggle);
        text('<span>', 'Proponer reto individual').appendTo($toggle); $toggle.appendTo($card);
        if (challenge.enabled) {
          invitation(id, challenge).appendTo($card);
          challengeInput($card, challenge, 'capitalGoal', 'Meta de capital de créditos (COP)', { type: 'number', min: '0', step: '0.01' });
          challengeInput($card, challenge, 'collectionGoal', 'Meta de recaudo (COP)', { type: 'number', min: '0', step: '0.01' });
          challengeInput($card, challenge, 'deadline', 'Hasta la fecha', { type: 'date' });
          challengeInput($card, challenge, 'incrementPercent', 'Incremento sobre sueldo básico (%)', { type: 'number', min: '0.1', max: '40', step: '0.1' });
          const $label = $('<label>'); text('<span>', 'Invitación o descripción (opcional, máximo 250 caracteres)').appendTo($label);
          $('<textarea>').attr({ class: 'form-control', maxlength: '250', rows: '2' }).val(challenge.description).on('input', function () {
            challenge.description = this.value; clearPreview();
          }).appendTo($label); $label.appendTo($card);
        }
      }
      $container.append($card);
    });
    $('#dispatch-preview').prop('disabled', selected.size === 0 || saving || uncertain);
  }
  function openBranch(branchId) {
    if (saving || uncertain) return;
    context = null; frozenRequest = null; selected.clear(); weights.clear(); challengeDrafts.clear();
    const sequence = ++contextSequence;
    clearPreview(); setStep(1); status('Consultando equipo y permisos vigentes…', false, true);
    $('#dispatch-branch-detail, #dispatch-people, #dispatch-review, #dispatch-challenges').empty();
    $('#modal-personalDespachar').modal('show');
    request('context', { branchId }).done(response => {
      if (sequence !== contextSequence) return;
      if (!ui.validContext(response, branchId)) {
        status('Contexto incompleto. Cierre y vuelva a consultar; no se habilitó guardar.', true, true); return;
      }
      context = Object.assign({}, response, {
        canDispatch: response.branch.canSaveDispatch,
        canDistribute: response.canConfigureDistribution && !response.route
      });
      response.employees.forEach(employee => { if (employee.selected) selected.add(Number(employee.employeeId)); });
      (response.challenges || []).forEach(challenge => challengeDrafts.set(Number(challenge.employeeId), Object.assign({}, challenge, { enabled: true })));
      (response.distribution && response.distribution.weights || []).forEach(weight => weights.set(Number(weight.employeeId), weight.weight));
      $('#dispatch-mode').val(response.distribution && response.distribution.mode || 'Titular');
      text('<h4>', response.branch.name).appendTo('#dispatch-branch-detail');
      text('<p>', response.branch.officeName).appendTo('#dispatch-branch-detail');
      $('#dispatch-person-search').val(''); renderPeople(); renderRules(); setStep(1);
      status(context.canDispatch ? 'Contexto verificado. Puedes preparar el despacho.' : 'Sólo consulta: despacho cerrado, entregándose o sin permiso de escritura.', false, true);
    }).fail(xhr => { if (sequence === contextSequence) status(errorText(xhr), true, true); });
  }
  function preview() {
    const data = draft();
    const error = context.canDispatch ? ui.validateDraft(data, context) : '';
    if (error) { status(error, true, true); return; }
    const sequence = ++previewSequence;
    const challenges = data.challenges.length ? data.challenges : Array.from(challengeDrafts.values())
      .filter(challenge => challenge.enabled && selected.has(challenge.employeeId) && ui.validChallenge(challenge));
    if (!challenges.length) { status('Active al menos un reto válido para consultar su previsión.', true, true); return; }
    $('#dispatch-preview').prop('disabled', true);
    const $forecast = $('#dispatch-forecast').empty();
    const calls = challenges.map(challenge => {
      const payload = Object.assign({}, challenge, {
        branchId: data.branchId, routeId: data.expectedRouteId,
        employeeIds: JSON.stringify(data.employeeIds)
      });
      if (data.distribution) payload.distribution = JSON.stringify(data.distribution);
      return request('forecast', payload).done(response => {
        if (sequence !== previewSequence) return;
        if (!global.RetoCards.validForecast(response)) {
          status('La previsión del servidor está incompleta.', true, true); return;
        }
        const employee = context.employees.find(employee => Number(employee.employeeId) === Number(challenge.employeeId));
        const $card = global.RetoCards.forecast(response, employee.name);
        $card.append(invitation(Number(employee.employeeId), challenge));
        $forecast.append($card);
      }).fail(xhr => { if (sequence === previewSequence) status(errorText(xhr), true, true); });
    });
    $.when.apply($, calls).always(() => { if (sequence === previewSequence) $('#dispatch-preview').prop('disabled', saving || uncertain); });
  }
  function review() {
    const $review = $('#dispatch-review').empty();
    text('<h4>', context.branch.name).appendTo($review);
    const $list = $('<ul>');
    Array.from(selected).forEach(id => text('<li>', context.employees.find(employee => Number(employee.employeeId) === id).name).appendTo($list));
    $review.append($list);
    const data = draft();
    text('<p>', `Reparto: ${data.distribution ? data.distribution.mode : context.distribution && context.distribution.mode || 'Instantánea existente'}`).appendTo($review);
    text('<p>', `${data.challenges.length} retos individuales propuestos. Sin cambios de sueldo ni bonos automáticos.`).appendTo($review);
  }
  function save(event) {
    event.preventDefault();
    if (saving || uncertain || !context || !context.canDispatch || step !== 4) return;
    const data = draft(); const error = ui.validateDraft(data, context);
    if (error) { status(error, true, true); return; }
    if (!frozenRequest) {
      data.idempotencyToken = global.crypto && global.crypto.randomUUID ? global.crypto.randomUUID() : `dispatch_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      frozenRequest = JSON.parse(JSON.stringify(data));
    }
    saving = true; $('#formPersonalDespachar :input').prop('disabled', true);
    status('Confirmando despacho. No cierres esta ventana…', false, true);
    request('save', frozenRequest, true).done(response => {
      if (!response || response.ok !== true || !ui.positiveId(response.routeId)) { uncertain = true; status('No se confirmó el guardado. Consulta el estado antes de volver a enviar.', true, true); return; }
      saving = false; frozenRequest = null;
      $('#modal-personalDespachar').modal('hide');
      loadList(`Despacho confirmado correctamente.${Array.isArray(response.warnings) && response.warnings.length ? ' ' + response.warnings.join(' ') : ''}`);
    }).fail(xhr => {
      uncertain = !xhr.status || xhr.status >= 500;
      if (uncertain) {
        status(`${errorText(xhr)} Estado sin confirmar: recarga para consultar, no reenvíes el borrador.`, true, true);
      } else {
        frozenRequest = null;
        context = null;
        status(`${errorText(xhr)} El borrador no se envió de nuevo. Cierra y abre la cartera para actualizar permisos y contexto.`, true, true);
      }
    }).always(() => { saving = false; });
  }
  $(function () {
    $('#dispatch-search').on('input', renderList); $('#dispatch-state').on('change', renderList);
    $('#dispatch-refresh').on('click', loadList);
    $('#dispatch-person-search').on('input', () => { if (context) renderPeople(); });
    $('#dispatch-mode').on('change', () => { if (context) { clearPreview(); renderRules(); } });
    $('#dispatch-back').on('click', () => setStep(Math.max(1, step - 1)));
    $('#dispatch-next').on('click', () => {
      if (!context) return;
      if (step >= 2 && context.canDispatch) { const error = ui.validateDraft(draft(), context); if (error) { status(error, true, true); return; } }
      if (step === 3) review(); setStep(Math.min(4, step + 1));
    });
    $('#dispatch-preview').on('click', preview); $('#formPersonalDespachar').on('submit', save);
    $('#modal-personalDespachar').on('hide.bs.modal', event => { if (saving) event.preventDefault(); })
      .on('hidden.bs.modal', () => { ++contextSequence; ++previewSequence; if (!uncertain) { $('#formPersonalDespachar :input').prop('disabled', false); context = null; } });
    $('#dispatch-export').on('click', () => {
      const url = URL.createObjectURL(new Blob(['\uFEFF', ui.csv(visibleBranches())], { type: 'text/csv;charset=utf-8' }));
      const link = $('<a>').attr({ href: url, download: 'despachos.csv' }).appendTo('body'); link[0].click(); link.remove(); URL.revokeObjectURL(url);
    });
    loadList();
  });
  global.ListadoDespachar = loadList;
  global.manejarCambioCheckDespachar = branchId => openBranch(branchId);
})(window, window.jQuery);
