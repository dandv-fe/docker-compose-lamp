(function (global, $) {
  'use strict';

  if (!$) return;

  const endpoint = './ajax/NominaEmpleadoAjax.php';
  const helpers = global.PayrollEmpleadoUI;
  let csrfToken = '';
  let activeEmployeeId = 0;
  let payrollBootstrap = null;

  function request(action, method, payload) {
    const data = method === 'GET'
      ? Object.assign({ action }, payload || {})
      : {
        action,
        csrfToken,
        data: JSON.stringify(payload || {})
      };
    return $.ajax({
      url: endpoint,
      method,
      data,
      dataType: 'json',
      cache: false
    }).then(function (response) {
      if (!response || typeof response !== 'object' || response.error || response.ok === false) {
        return $.Deferred().reject({
          responseJSON: {
            error: response && response.error
              ? response.error
              : response && response.ok === false
                ? 'El servicio no confirmó el cambio; consulte la nómina antes de volver a intentar.'
                : 'Respuesta de nómina no válida.'
          },
          status: response && response.ok === false ? 500 : 422
        }).promise();
      }
      if (typeof response.csrfToken === 'string' && response.csrfToken) csrfToken = response.csrfToken;
      return response;
    });
  }

  function errorMessage(xhr) {
    return xhr && xhr.responseJSON && typeof xhr.responseJSON.error === 'string'
      ? xhr.responseJSON.error
      : 'No se pudo consultar nómina. Verifique la conexión e intente de nuevo.';
  }

  function notifyError(xhr) {
    const message = errorMessage(xhr);
    if (global.Swal) global.Swal.fire({ icon: 'error', title: 'Nómina', text: message });
    else $('#payroll-status').text(message);
  }

  function notifySuccess(message) {
    if (global.Swal) global.Swal.fire({ icon: 'success', title: 'Nómina', text: message, timer: 1800, showConfirmButton: false });
    else $('#payroll-status').text(message);
  }

  function newIdempotencyToken() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return global.crypto.randomUUID();
    return `payroll_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
  }

  function currentEmployeeId() {
    return Number($('#txtRefEmpleadoConfig').val() || $('#payroll-managed-employee').val() || 0);
  }

  function setHiddenEmployeeIds(employeeId) {
    $('#payroll-employee-id, #txtRefEmpleado_formPactarSueldo').val(employeeId);
    $('#payroll-csrf-token').val(csrfToken);
  }

  function setStatus(message, state) {
    const $status = $('#payroll-status');
    if (!$status.length) return;
    $status.removeClass('text-danger text-success text-muted')
      .addClass(state === 'error' ? 'text-danger' : state === 'success' ? 'text-success' : 'text-muted')
      .text(message);
  }

  function disablePayrollControls() {
    $('#payroll-manager-controls :input, #btnPayrollVacation, #payroll-save-branch-rule, #payroll-add-share')
      .prop('disabled', true);
  }

  function cell(row, value) {
    $('<td>').text(value == null ? '' : String(value)).appendTo(row);
  }

  function emptyRow($table, count, message) {
    const row = $('<tr>');
    $('<td>').attr('colspan', count).addClass('text-muted').text(message).appendTo(row);
    $table.find('tbody').empty().append(row);
  }

  function clearEmployeeTables(message) {
    [
      ['#tblNomina', 7],
      ['#tblPayrollVacations', 4],
      ['#tblPayrollBonuses', 3]
    ].forEach(function (entry) {
      const $table = $(entry[0]);
      if ($table.length) emptyRow($table, entry[1], message);
    });
  }

  function renderContracts(contracts) {
    const $table = $('#tblNomina');
    if (!$table.length) return;
    const $body = $table.find('tbody').empty();
    if (!Array.isArray(contracts) || contracts.length === 0) {
      emptyRow($table, 7, 'No hay acuerdos de sueldo registrados.');
      return;
    }
    contracts.forEach(function (contract) {
      const row = $('<tr>');
      cell(row, contract.effectiveDate);
      cell(row, contract.type);
      cell(row, contract.frequency);
      cell(row, helpers.formatCop(contract.baseAmount));
      cell(row, `${contract.capitalRate}%`);
      cell(row, `${contract.collectionRate}%`);
      const action = $('<td>');
      if (contract === contracts[0]) {
        $('<button>').attr({ type: 'button', class: 'btn btn-outline-primary btn-sm btnPayrollEditAgreement' })
          .text('Ajustar').appendTo(action);
      }
      row.append(action);
      $body.append(row);
    });
  }

  function renderVacations(vacations) {
    const $table = $('#tblPayrollVacations');
    if (!$table.length) return;
    const $body = $table.find('tbody').empty();
    if (!Array.isArray(vacations) || vacations.length === 0) {
      emptyRow($table, 4, 'No hay vacaciones programadas.');
      return;
    }
    vacations.forEach(function (vacation) {
      const row = $('<tr>');
      cell(row, vacation.startDate);
      cell(row, vacation.endDate);
      const replacement = payrollBootstrap && payrollBootstrap.employees.find(employee =>
        Number(employee.employeeId) === Number(vacation.replacementEmployeeId));
      cell(row, vacation.replacementName || (replacement && replacement.name) || 'Relevo no registrado');
      cell(row, vacation.reason || 'Sin observación');
      $body.append(row);
    });
  }

  function renderBonuses(bonuses) {
    const $table = $('#tblPayrollBonuses');
    if (!$table.length) return;
    const $body = $table.find('tbody').empty();
    if (!Array.isArray(bonuses) || bonuses.length === 0) {
      emptyRow($table, 3, 'No hay bonos manuales registrados.');
      return;
    }
    bonuses.forEach(function (bonus) {
      const row = $('<tr>');
      cell(row, bonus.date);
      cell(row, helpers.formatCop(bonus.amount));
      cell(row, bonus.reason);
      $body.append(row);
    });
  }

  function populateAgreement(contract) {
    const form = document.getElementById('formPactarSueldo');
    if (!form) return;
    form.reset();
    $('#txtRefNomina').val('');
    $('#payroll-employee-id').val(activeEmployeeId);
    $('#txtRefEmpleado_formPactarSueldo').val(activeEmployeeId);
    $('#payroll-csrf-token').val(csrfToken);
    $('#payroll-idempotency-token').val(newIdempotencyToken());
    $('#payroll-effective-date').val(contract && contract.effectiveDate || localDate());
    $('#cboModoSueldo').val(contract && contract.type || 'Fijo');
    $('#payroll-frequency').val(contract && contract.frequency || 'Mensual');
    $('#txtValorSueldo').val(contract && contract.baseAmount != null ? contract.baseAmount : '');
    $('#payroll-credit-rate').val(contract && contract.capitalRate != null ? contract.capitalRate : '0');
    $('#payroll-collection-rate').val(contract && contract.collectionRate != null ? contract.collectionRate : '0');
    const hasCommission = !contract ||
      Number(contract.capitalRate || 0) > 0 ||
      Number(contract.collectionRate || 0) > 0;
    $('#payroll-commissions-enabled').prop('checked', hasCommission).trigger('change');
  }

  function adjustAgreement() {
    const contract = window.payrollCurrentContracts && window.payrollCurrentContracts[0];
    if (!contract) return;
    populateAgreement(contract);
    $('#payroll-effective-date').val(localDate());
    $('#payroll-salary-title').text('Ajustar sueldo pactado');
    $('#modal-pactar-sueldo').modal('show');
  }

  function localDate() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const date = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${date.year}-${date.month}-${date.day}`;
  }

  function loadEmployee() {
    const employeeId = currentEmployeeId();
    if (!Number.isSafeInteger(employeeId) || employeeId <= 0) {
      clearEmployeeTables('Seleccione un empleado para consultar.');
      setStatus('Seleccione un empleado para consultar su nómina.', 'muted');
      $('#verLoadingNomina').addClass('hide');
      $('#verListadoNomina').removeClass('hide');
      return;
    }
    activeEmployeeId = employeeId;
    setHiddenEmployeeIds(employeeId);
    $('#verLoadingNomina').removeClass('hide');
    $('#verListadoNomina').addClass('hide');
    setStatus('Consultando acuerdo, vacaciones y bonos…', 'muted');
    request('resumen', 'GET', { employeeId }).done(function (summary) {
      if (!Array.isArray(summary.contracts) || !Array.isArray(summary.vacations) ||
          !Array.isArray(summary.bonuses) || !Array.isArray(summary.periods)) {
        clearEmployeeTables('No se pudo validar la respuesta.');
        $('#verLoadingNomina').addClass('hide');
        $('#verListadoNomina').removeClass('hide');
        setStatus('La respuesta de nómina está incompleta. No se reemplazaron los datos visibles.', 'error');
        return;
      }
      renderContracts(summary.contracts);
      window.payrollCurrentContracts = summary.contracts;
      renderVacations(summary.vacations);
      renderBonuses(summary.bonuses);
      setHiddenEmployeeIds(employeeId);
      setStatus('Información de nómina actualizada.', 'success');
      $('#verLoadingNomina').addClass('hide');
      $('#verListadoNomina').removeClass('hide');
    }).fail(function (xhr) {
      clearEmployeeTables('No fue posible consultar este registro.');
      setStatus(errorMessage(xhr), 'error');
      $('#verLoadingNomina').addClass('hide');
      $('#verListadoNomina').removeClass('hide');
      notifyError(xhr);
    });
  }

  function postChange(action, payload, $form, onSuccess, onFailure) {
    if (!csrfToken) {
      notifyError({ responseJSON: { error: 'Falta el token de seguridad. Recargue la página.' } });
      return;
    }
    if ($form.data('payroll-saving')) return;
    $form.data('payroll-saving', true);
    const token = $form.data('idempotency-token') || newIdempotencyToken();
    $form.data('idempotency-token', token);
    payload.idempotencyToken = token;
    $form.find(':submit, [data-payroll-submit]').prop('disabled', true);
    request(action, 'POST', payload).done(function (response) {
      $form.removeData('idempotency-token');
      $form.data('payroll-saving', false);
      $form.find(':submit, [data-payroll-submit]').prop('disabled', false);
      onSuccess(response);
    }).fail(function (xhr) {
      const status = Number(xhr && xhr.status || 0);
      if (status >= 500 || status === 0) {
        $form.find(':input').prop('disabled', true);
        $form.find(':submit, [data-payroll-submit]').prop('disabled', true);
        notifyError({
          responseJSON: {
            error: `${errorMessage(xhr)} No reenvíe el cambio hasta volver a consultar; actualice la página para verificar su estado.`
          }
        });
        if (typeof onFailure === 'function') onFailure(xhr);
        return;
      }
      $form.removeData('idempotency-token');
      $form.data('payroll-saving', false);
      $form.find(':submit, [data-payroll-submit]').prop('disabled', false);
      notifyError(xhr);
      if (typeof onFailure === 'function') onFailure(xhr);
    });
  }

  function saveAgreement(event) {
    event.preventDefault();
    const employeeId = currentEmployeeId();
    const config = {
      salaryType: $('#cboModoSueldo').val(),
      frequency: $('#payroll-frequency').val(),
      baseAmount: $('#txtValorSueldo').val(),
      creditRate: $('#payroll-commissions-enabled').prop('checked') ? $('#payroll-credit-rate').val() : 0,
      collectionRate: $('#payroll-commissions-enabled').prop('checked') ? $('#payroll-collection-rate').val() : 0,
      commissionsEnabled: $('#payroll-commissions-enabled').prop('checked')
    };
    const effectiveDate = $('#payroll-effective-date').val();
    if (!Number.isSafeInteger(employeeId) || employeeId <= 0 || !helpers.validPayrollConfig(config) ||
        !helpers.validDate(effectiveDate)) {
      notifyError({ responseJSON: { error: 'Revise el tipo, frecuencia, valor, tasas y fecha de vigencia.' } });
      return;
    }
    const $form = $(event.currentTarget);
    postChange('contrato', {
      employeeId,
      effectiveDate,
      type: config.salaryType,
      frequency: config.frequency,
      baseAmount: Number(config.baseAmount),
      capitalRate: Number(config.creditRate),
      collectionRate: Number(config.collectionRate)
    }, $form, function () {
      $('#modal-pactar-sueldo').modal('hide');
      notifySuccess('El acuerdo de sueldo quedó registrado.');
      loadEmployee();
    });
  }

  function openVacation() {
    const form = document.getElementById('form-payroll-vacation');
    if (!form) return;
    form.reset();
    const employeeId = currentEmployeeId();
    const $select = $('#payroll-vacation-replacement').empty();
    $select.append($('<option>').val('').text('Seleccione un relevo autorizado'));
    const employees = payrollBootstrap ? payrollBootstrap.employees : [];
    employees.filter(employee => Number(employee.employeeId) !== employeeId).forEach(employee => {
      $select.append($('<option>').val(employee.employeeId).text(employee.name));
    });
    $select.prop('disabled', employees.filter(employee => Number(employee.employeeId) !== employeeId).length === 0);
    $('#payroll-vacation-start, #payroll-vacation-end').val(localDate());
  }

  function saveVacation(event) {
    event.preventDefault();
    const employeeId = currentEmployeeId();
    const startDate = $('#payroll-vacation-start').val();
    const endDate = $('#payroll-vacation-end').val();
    const reason = String($('#payroll-vacation-reason').val() || '').trim();
    const replacementEmployeeId = Number($('#payroll-vacation-replacement').val());
    if (!helpers.validVacation({ employeeId, replacementEmployeeId, startDate, endDate, reason }) ||
        !payrollBootstrap || !payrollBootstrap.employees.some(employee =>
          Number(employee.employeeId) === replacementEmployeeId)) {
      notifyError({ responseJSON: { error: 'Indique un rango válido y un empleado de relevo autorizado distinto del titular.' } });
      return;
    }
    const $form = $('#form-payroll-vacation');
    postChange('vacacion', { employeeId, replacementEmployeeId, startDate, endDate, reason }, $form, function () {
      $('#modal-payroll-vacation').modal('hide');
      notifySuccess('El período de vacaciones quedó registrado.');
      loadEmployee();
    });
  }

  function renderOwnStatement(summary) {
    const period = Array.isArray(summary.periods) && summary.periods[0];
    if (!helpers.validPayrollSummary(summary) || !period) {
      setStatus('La respuesta de nómina está incompleta; no se mostrará como liquidación válida.', 'error');
      return;
    }
    $('#payroll-period-range').text(`${period.startDate} – ${period.endDate}`);
    $('#payroll-frequency-label').text(period.frequency || 'Sin frecuencia');
    $('#payroll-current-base').text(helpers.formatCop(period.agreedBaseAmount));
    $('#payroll-accrued-base').text(helpers.formatCop(period.baseAmount));
    $('#payroll-period-base').text(helpers.formatCop(period.periodBaseAmount));
    $('#payroll-credit-commission').text(helpers.formatCop(period.capitalCommission));
    $('#payroll-collection-commission').text(helpers.formatCop(period.collectionCommission));
    $('#payroll-current-bonuses').text(helpers.formatCop(period.bonusAmount));
    $('#payroll-earned-total').text(helpers.formatCop(period.earnedAmount));
    $('#payroll-paid-total').text(helpers.formatCop(period.paidAmount));
    $('#payroll-pending-total').text(helpers.formatCop(period.pendingAmount));
    $('#payroll-total-provisional').toggle(summary.routes.some(route => route.provisional));
    $('#payroll-unconfigured').toggle(!period.configured);
    $('#payroll-own-content').show();

    const routes = summary.routes;
    const $table = $('#payroll-own-routes');
    if (!$table.length) return;
    const $body = $table.find('tbody').empty();
    if (routes.length === 0) {
      emptyRow($table, 8, 'No hay comisiones de ruta en este período.');
      setStatus('', 'muted');
      return;
    }
    routes.forEach(function (route) {
      const row = $('<tr>');
      if (route.provisional) row.addClass('payroll-route-provisional');
      cell(row, route.branchName || route.name || route.routeName || 'Ruta');
      cell(row, route.openedDate || route.date || '');
      cell(row, helpers.formatCop(route.capitalAmount));
      cell(row, helpers.formatCop(route.cashAmount));
      cell(row, `${route.sharePercent}%`);
      cell(row, helpers.formatCop(route.capitalCommission));
      cell(row, helpers.formatCop(route.collectionCommission));
      cell(row, route.provisional ? 'Provisional · despacho abierto' : 'Confirmado');
      $body.append(row);
    });
    setStatus('', 'muted');
  }

  function loadOwnStatement() {
    const asOf = $('#payroll-own-as-of').val() || localDate();
    if (!helpers.validDate(asOf)) {
      notifyError({ responseJSON: { error: 'Seleccione una fecha válida.' } });
      return;
    }
    $('#payroll-own-content, #payroll-unconfigured').hide();
    emptyRow($('#payroll-own-routes'), 8, 'Consultando el período…');
    setStatus('Consultando tu período de nómina…', 'muted');
    request('resumen', 'GET', { asOf }).done(renderOwnStatement).fail(function (xhr) {
      $('#payroll-own-content, #payroll-unconfigured').hide();
      setStatus(errorMessage(xhr), 'error');
      notifyError(xhr);
    });
  }

  function loadBootstrap() {
    request('bootstrap', 'GET').done(function (bootstrap) {
      if (!helpers.validPayrollBootstrap(bootstrap)) {
        disablePayrollControls();
        notifyError({ responseJSON: { error: 'La configuración de nómina está incompleta.' } });
        return;
      }
      if (!bootstrap.canManage) {
        $('#payroll-manager-controls').hide();
        $('#btnPayrollVacation').hide();
        disablePayrollControls();
      } else {
        const hasSelectedEmployee = currentEmployeeId() > 0;
        $('#btnNuevoAcuerdoPago, #btnPayrollVacation').prop('disabled', !hasSelectedEmployee);
      }
      if (!bootstrap.canDistribute) {
        $('#payroll-branch-distribution').hide();
        $('#payroll-save-branch-rule, #payroll-add-share').prop('disabled', true);
      }
      payrollBootstrap = bootstrap;
      if (global.PayrollEmpleado && typeof global.PayrollEmpleado.onBootstrap === 'function') {
        global.PayrollEmpleado.onBootstrap(bootstrap);
      }
      if (!$('#payroll-managed-employee').length && currentEmployeeId() > 0) loadEmployee();
    }).fail(function (xhr) {
      disablePayrollControls();
      notifyError(xhr);
    });
  }

  function employeesForBranch(branchId) {
    if (!payrollBootstrap) return [];
    const branch = payrollBootstrap.branches.find(item => Number(item.branchId) === Number(branchId));
    if (!branch) return [];
    const assigned = Array.isArray(branch.employees)
      ? branch.employees
      : (payrollBootstrap.assignedEmployees && payrollBootstrap.assignedEmployees[String(branchId)]);
    return Array.isArray(assigned) ? assigned : [];
  }

  function updateShareTotal() {
    let total = 0;
    $('#payroll-shares-table tbody input[name="weight"]').each(function () {
      const value = Number($(this).val());
      if (Number.isFinite(value) && value >= 0) total += Math.round(value * 100);
    });
    $('#payroll-shares-total').text(`${(total / 100).toFixed(2).replace(/\.00$/, '')}%`);
    return total === 10000;
  }

  function addShareRow(employeeId, weight) {
    const branchId = Number($('#payroll-branch-select').val());
    const employees = employeesForBranch(branchId);
    if (!employees.length) {
      $('#payroll-branch-status').text('No se recibieron los empleados asignados a esta sucursal desde el servidor.');
      return;
    }
    const row = $('<tr>');
    const select = $('<select>').addClass('form-control form-control-sm').attr('name', 'employeeId');
    select.append($('<option>').val('').text('Seleccione'));
    employees.forEach(function (employee) {
      const option = $('<option>').val(employee.employeeId).text(employee.name);
      select.append(option);
    });
    if (employeeId) select.val(String(employeeId));
    $('<td>').append(select).appendTo(row);
    $('<td>').append($('<input>').attr({
      type: 'number',
      name: 'weight',
      min: '0.01',
      max: '100',
      step: '0.01',
      value: weight == null ? '' : weight,
      class: 'form-control form-control-sm'
    })).appendTo(row);
    const remove = $('<button>').attr({ type: 'button', class: 'btn btn-outline-danger btn-sm', 'aria-label': 'Quitar empleado' })
      .append($('<i>').addClass('fas fa-times'));
    $('<td>').append(remove).appendTo(row);
    remove.on('click', function () {
      row.remove();
      updateShareTotal();
    });
    select.add(row.find('input')).on('change input', updateShareTotal);
    $('#payroll-shares-table tbody').append(row);
    updateShareTotal();
  }

  function renderBranchRule() {
    const branchId = Number($('#payroll-branch-select').val());
    const $custom = $('#payroll-distribution-custom');
    const mode = $('#payroll-distribution-mode').val();
    $custom.toggle(mode === 'Personalizado');
    const config = payrollBootstrap && payrollBootstrap.configs.find(rule => Number(rule.branchId) === branchId);
    const branch = payrollBootstrap && payrollBootstrap.branches.find(item => Number(item.branchId) === branchId);
    const assignedEmployees = employeesForBranch(branchId);
    const $assignedSummary = $('#payroll-assigned-summary').empty();
    if (mode === 'Titular') {
      $('#payroll-add-share').prop('disabled', true);
      $assignedSummary.text(branch && branch.holderName
        ? `Titular único: ${branch.holderName}`
        : 'El titular de esta sucursal no está disponible en la respuesta.');
      $('#payroll-save-branch-rule').prop('disabled', !branchId || !branch || !branch.holderName);
    } else if (assignedEmployees.length) {
      $('#payroll-add-share').prop('disabled', mode !== 'Personalizado');
      $('<strong>').text('Empleados asignados: ').appendTo($assignedSummary);
      $assignedSummary.append(document.createTextNode(assignedEmployees.map(employee => employee.name).join(', ')));
      if (mode === 'Igual') $('#payroll-save-branch-rule').prop('disabled', false);
    } else {
      $('#payroll-add-share').prop('disabled', true);
      $assignedSummary.text('No se recibieron empleados asignados a esta sucursal.');
      if (mode === 'Igual') $('#payroll-save-branch-rule').prop('disabled', true);
    }
    if (mode === 'Personalizado') {
      if (!assignedEmployees.length) {
        $('#payroll-shares-table tbody').empty();
        $('#payroll-branch-status').text('El servicio no entregó la lista actual de empleados asignados a la sucursal.');
        $('#payroll-save-branch-rule').prop('disabled', true);
        return;
      }
      $('#payroll-save-branch-rule').prop('disabled', false);
      $('#payroll-add-share').prop('disabled', false);
      $('#payroll-branch-status').text('');
      $('#payroll-shares-table tbody').empty();
      const weights = config && Array.isArray(config.weights) ? config.weights : [];
      weights.forEach(weight => addShareRow(weight.employeeId, weight.weight));
      if (weights.length === 0) addShareRow();
      updateShareTotal();
    } else {
      if (mode === 'Titular') {
        $('#payroll-save-branch-rule').prop('disabled', !branchId || !branch || !branch.holderName);
      } else if (mode === 'Igual') {
        $('#payroll-save-branch-rule').prop('disabled', !branchId || !assignedEmployees.length);
      }
      $('#payroll-branch-status').text('');
      $('#payroll-shares-table tbody').empty();
    }
  }

  function renderBranchBootstrap(bootstrap) {
    const $select = $('#payroll-branch-select');
    if (!$select.length) return;
    $select.empty().append($('<option>').val('').text('Seleccione una sucursal'));
    bootstrap.branches.forEach(function (branch) {
      $select.append($('<option>').val(branch.branchId).text(branch.name));
    });
    const selected = bootstrap.branches[0];
    if (selected) {
      $select.val(String(selected.branchId));
      const rule = bootstrap.configs.find(item => Number(item.branchId) === Number(selected.branchId));
      $('#payroll-distribution-mode').val(rule && rule.mode || 'Titular');
    }
    renderBranchRule();
  }

  function saveBranchRule() {
    const branchId = Number($('#payroll-branch-select').val());
    const mode = $('#payroll-distribution-mode').val();
    if (!Number.isSafeInteger(branchId) || branchId <= 0 ||
        !['Titular', 'Igual', 'Personalizado'].includes(mode)) {
      $('#payroll-branch-status').text('Seleccione una sucursal y un tipo de reparto.');
      return;
    }
    let weights = [];
    if (mode === 'Personalizado') {
      weights = $('#payroll-shares-table tbody tr').map(function () {
        return {
          employeeId: Number($(this).find('select[name="employeeId"]').val()),
          percent: Number($(this).find('input[name="weight"]').val())
        };
      }).get();
      if (!helpers.validCustomShares(weights)) {
        $('#payroll-branch-status').text('Seleccione empleados distintos y distribuya exactamente el 100%.');
        return;
      }
      weights = weights.map(share => ({ employeeId: share.employeeId, weight: share.percent }));
    }
    $('#payroll-branch-status').text('Guardando reparto…');
    postChange('reparto', { branchId, mode, weights }, $('#payroll-branch-distribution'), function () {
      $('#payroll-branch-status').text('Reparto guardado para próximos despachos.');
      notifySuccess('La configuración de reparto quedó guardada.');
      loadBootstrap();
    }, function (xhr) {
      $('#payroll-branch-status').text(errorMessage(xhr));
    });
  }

  $(function () {
    if ($('#payroll-commissions-enabled').length) {
      $('#payroll-commissions-enabled').on('change', function () {
        const enabled = $(this).prop('checked');
        $('#payroll-commission-fields').toggle(enabled);
        $('#payroll-credit-rate, #payroll-collection-rate').prop('disabled', !enabled);
      });
      $('#payroll-commissions-enabled').trigger('change');
    }
    $('#formPactarSueldo').on('submit.payroll', saveAgreement);
    $('#form-payroll-vacation').on('submit.payroll', saveVacation);
    $('#modal-payroll-vacation').on('show.bs.modal', openVacation);
    $('#btnNuevoAcuerdoPago').on('click.payroll', function () {
      activeEmployeeId = currentEmployeeId();
      populateAgreement(null);
      $('#payroll-salary-title').text('Sueldo pactado');
    });
    $('#tblNomina').on('click.payroll', '.btnPayrollEditAgreement', adjustAgreement);
    $(document).on('payroll:employee-selected', function (event, employeeId) {
      activeEmployeeId = Number(employeeId) || 0;
      const canManage = Boolean(payrollBootstrap && payrollBootstrap.canManage);
      $('#btnNuevoAcuerdoPago, #btnPayrollVacation').prop('disabled', !canManage || activeEmployeeId <= 0);
      if (activeEmployeeId > 0) loadEmployee();
    });
    $('#payroll-own-refresh').on('click.payroll', loadOwnStatement);
    $('#payroll-own-as-of').on('change.payroll', loadOwnStatement);
    $('#payroll-branch-select').on('change.payroll', function () {
      const branchId = Number($(this).val());
      const rule = payrollBootstrap && payrollBootstrap.configs.find(item => Number(item.branchId) === branchId);
      if (rule) $('#payroll-distribution-mode').val(rule.mode);
      renderBranchRule();
    });
    $('#payroll-distribution-mode').on('change.payroll', renderBranchRule);
    $('#payroll-add-share').on('click.payroll', function () { addShareRow(); });
    $('#payroll-shares-table').on('change input', 'select[name="employeeId"], input[name="weight"]', updateShareTotal);
    $('#payroll-save-branch-rule').on('click.payroll', saveBranchRule);
    if ($('#tblPayrollVacations').length || $('#payroll-branch-distribution').length) loadBootstrap();
    if ($('#payroll-own-dashboard').length) {
      $('#payroll-own-as-of').val(localDate());
      loadOwnStatement();
    }
  });

  global.PayrollEmpleado = {
    cargarEmpleado: loadEmployee,
    loadOwnStatement,
    onBootstrap: renderBranchBootstrap
  };
})(window, window.jQuery);
