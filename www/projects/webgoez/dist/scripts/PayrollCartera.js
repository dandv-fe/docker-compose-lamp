(function (global, $) {
  'use strict';
  if (!$) return;
  const endpoint = './ajax/NominaEmpleadoAjax.php';
  const helpers = global.PayrollEmpleadoUI;
  let context = null;
  let csrfToken = '';
  let saving = false;
  let uncertain = false;
  let retryToken = '';
  let loadingVersion = 0;
  const normalDisabled = new Map();

  function selectedBranchId() {
    return Number($('#payroll-cartera-bonus').attr('data-branch-id'));
  }

  function message(text, error) {
    $('#payroll-ledger-bonus-status').toggleClass('text-danger', Boolean(error)).text(text);
  }

  function errorText(xhr) {
    return xhr && xhr.responseJSON && typeof xhr.responseJSON.error === 'string'
      ? xhr.responseJSON.error : 'No se pudo gestionar el bono. Verifique la conexión.';
  }

  function token() {
    return global.crypto && typeof global.crypto.randomUUID === 'function'
      ? global.crypto.randomUUID() : `bono_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
  }

  function changeMode() {
    const enabled = $('#payroll-ledger-bonus').prop('checked');
    $('#payroll-ledger-bonus-fields').toggle(enabled);
    $('#gasto-contabilidad-normal').toggle(!enabled);
    $('#gasto-contabilidad-normal :input').each(function () {
      if (enabled) {
        if (!normalDisabled.has(this)) normalDisabled.set(this, this.disabled);
        this.disabled = true;
      } else if (normalDisabled.has(this)) {
        this.disabled = normalDisabled.get(this);
        normalDisabled.delete(this);
      }
    });
    $('#payroll-ledger-bonus-fields :input').prop('disabled', !enabled || saving || uncertain || !context);
    if (enabled) loadContext();
  }

  function loadContext() {
    const branchId = selectedBranchId();
    const formBranch = Number($('#txtrefSucursalHidden').val());
    const version = ++loadingVersion;
    context = null;
    $('#payroll-ledger-bonus-fields :input').prop('disabled', true);
    $('#payroll-ledger-bonus-employee').empty();
    if (!Number.isSafeInteger(branchId) || branchId <= 0 || formBranch !== branchId) {
      message('El bono sólo se registra en Gastos de la Cartera seleccionada. Abra sus cuentas y vuelva a intentar.', true);
      return;
    }
    message('Consultando despacho y empleados autorizados…', false);
    $.ajax({ url: endpoint, method: 'GET', dataType: 'json', cache: false,
      data: { action: 'bonoContexto', branchId }
    }).done(function (response) {
      if (version !== loadingVersion || !$('#payroll-ledger-bonus').prop('checked')) return;
      if (!helpers.validBonusContext(response, branchId) || typeof response.csrfToken !== 'string' || !response.csrfToken) {
        message('No hay un despacho abierto válido o la respuesta de autorización está incompleta.', true);
        return;
      }
      context = response;
      csrfToken = response.csrfToken;
      const $select = $('#payroll-ledger-bonus-employee').empty();
      $select.append($('<option>').val('').text('Seleccione empleado'));
      response.employees.forEach(employee => $select.append($('<option>').val(employee.employeeId).text(employee.name)));
      $('#payroll-ledger-bonus-fields :input').prop('disabled', saving || uncertain || !response.employees.length);
      message(response.employees.length ? 'Despacho abierto verificado. El pago afecta el efectivo de caja.' : 'No hay empleados autorizados para este gasto.', !response.employees.length);
    }).fail(function (xhr) {
      if (version === loadingVersion) message(errorText(xhr), true);
    });
  }

  function refreshPayroll(employeeId) {
    $('#payroll-cartera-result').removeClass('text-danger').text('Bono y pago registrados. Actualizando nómina…');
    $.ajax({ url: endpoint, method: 'GET', dataType: 'json', cache: false,
      data: { action: 'resumen', employeeId }
    }).done(function (summary) {
      if (!helpers.validPayrollSummary(summary)) {
        $('#payroll-cartera-result').addClass('text-danger').text('Bono guardado, pero no se pudo validar el resumen de nómina. Consulte Mi nómina.');
        return;
      }
      const period = summary.periods[0];
      $('#payroll-cartera-result').text(`Bono y pago registrados. Devengado: ${helpers.formatCop(period.earnedAmount)} · Pagado: ${helpers.formatCop(period.paidAmount)} · Pendiente: ${helpers.formatCop(period.pendingAmount)}.`);
      $(document).trigger('payroll:bonus-saved', [employeeId]);
    }).fail(function (xhr) {
      $('#payroll-cartera-result').addClass('text-danger').text(`Bono guardado; no se pudo actualizar nómina: ${errorText(xhr)}`);
    });
  }

  function submitBonus(form) {
    if (uncertain || saving) return true;
    if (!$('#payroll-ledger-bonus').prop('checked')) return false;
    const data = {
      branchId: selectedBranchId(),
      routeId: context && Number(context.routeId),
      employeeId: Number($('#payroll-ledger-bonus-employee').val()),
      amount: $('#payroll-ledger-bonus-amount').val(),
      reason: String($('#payroll-ledger-bonus-reason').val() || '').trim()
    };
    if (!helpers.validLedgerBonus(data, context) || Number($('#txtrefSucursalHidden').val()) !== data.branchId || !csrfToken) {
      message('Seleccione un empleado autorizado, un monto positivo de hasta 99.999.999,99 con máximo dos decimales y un motivo, con el despacho en estado abierto.', true);
      return true;
    }
    retryToken = retryToken || token();
    data.amount = Number(data.amount);
    data.idempotencyToken = retryToken;
    saving = true;
    $(form).find(':submit').prop('disabled', true);
    $('#payroll-ledger-bonus, #payroll-ledger-bonus-fields :input').prop('disabled', true);
    $.ajax({ url: endpoint, method: 'POST', dataType: 'json',
      data: { action: 'bono', csrfToken, data: JSON.stringify(data) }
    }).done(function (response) {
      if (!response || response.ok !== true || !response.id || !response.expenseId ||
          Number(response.branchId) !== data.branchId || Number(response.routeId) !== data.routeId) {
        saving = false;
        uncertain = true;
        message('No se confirmó el guardado. No reenvíe: consulte caja y nómina antes de recargar.', true);
        return;
      }
      retryToken = '';
      saving = false;
      $('#modal-NuevaContabilidad').modal('hide');
      if (typeof global.actualizarResumenCajaCartera === 'function') global.actualizarResumenCajaCartera();
      if (typeof global.DatosCobro === 'function') global.DatosCobro(false);
      refreshPayroll(data.employeeId);
    }).fail(function (xhr) {
      saving = false;
      uncertain = !xhr.status || xhr.status >= 500;
      message(`${errorText(xhr)}${uncertain ? ' No reenvíe: consulte caja y nómina antes de recargar.' : ''}`, true);
      if (!uncertain) {
        retryToken = '';
        $(form).find(':submit').prop('disabled', false);
        $('#payroll-ledger-bonus').prop('disabled', false);
        $('#payroll-ledger-bonus-fields :input').prop('disabled', false);
        if (xhr.status === 403 || xhr.status === 409) {
          context = null;
          $('#payroll-ledger-bonus-fields :input').prop('disabled', true);
          message(`${errorText(xhr)} Vuelva a abrir Gastos para consultar el despacho y los permisos actuales.`, true);
        }
      }
    });
    return true;
  }

  $(function () {
    if (!$('#payroll-cartera-bonus').length) return;
    $('#payroll-ledger-bonus').on('change', changeMode);
    $('#modal-NuevaContabilidad').on('hide.bs.modal.payroll', function (event) {
      if (saving) event.preventDefault();
    });
    $('#modal-NuevaContabilidad').on('hidden.bs.modal.payroll', function () {
      ++loadingVersion;
      context = null;
      if (uncertain) return;
      saving = false;
      retryToken = '';
      $('#payroll-ledger-bonus').prop('checked', false).prop('disabled', false);
      $('#formNuevaContabilidad :submit').prop('disabled', false);
      changeMode();
      message('', false);
    });
    $('#modal-NuevaContabilidad').on('show.bs.modal.payroll', function () {
      if (uncertain) {
        $('#payroll-ledger-bonus').prop('checked', true).prop('disabled', true);
        $('#payroll-ledger-bonus-fields').show();
        $('#gasto-contabilidad-normal').hide();
        $('#formNuevaContabilidad :submit').prop('disabled', true);
        message('Estado del pago sin confirmar. Consulte caja y nómina y recargue antes de registrar otro bono.', true);
      }
    });
  });
  global.PayrollCartera = { submitBonus };
})(window, window.jQuery);
