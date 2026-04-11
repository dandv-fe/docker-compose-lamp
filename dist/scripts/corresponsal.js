(function ($) {
  'use strict';

  var transferenciaState = {
    paso: 1,
    maxPaso: 4,
    cuentaDestino: null,
    cuentaOrigen: null,
    guardando: false
  };

  function formatMoney(value) {
    var n = parseFloat(value) || 0;
    if (typeof window.formatearMonedaPublica === 'function') {
      return '$' + window.formatearMonedaPublica(n, 2);
    }
    return '$' + n.toFixed(2);
  }

  function parseMoneyText(text) {
    var raw = String(text || '').trim();
    if (!raw) return 0;

    raw = raw.replace(/\s+/g, '').replace(/\$/g, '');

    var hasComma = raw.indexOf(',') !== -1;
    var hasDot = raw.indexOf('.') !== -1;

    if (hasComma && hasDot) {
      if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) {
        raw = raw.replace(/\./g, '').replace(',', '.');
      } else {
        raw = raw.replace(/,/g, '');
      }
    } else if (hasComma) {
      raw = raw.replace(/\./g, '').replace(',', '.');
    } else {
      raw = raw.replace(/,/g, '');
    }

    raw = raw.replace(/[^0-9.-]/g, '');
    var n = parseFloat(raw);
    return isNaN(n) ? 0 : n;
  }

  function parseDecimalInput(value) {
    var raw = String(value == null ? '' : value).trim().replace(',', '.');
    var n = parseFloat(raw);
    return isNaN(n) ? 0 : n;
  }

  function formatDateTime(v) {
    if (!v) return '-';
    return String(v).replace('T', ' ').substring(0, 19);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderCuenta(data) {
    transferenciaState.cuentaOrigen = data;
    $('#txt_corresponsal_nombre').val(data.str_name || '-');
    $('#txt_corresponsal_cuenta').val(data.id_cuenta || '-');
    $('#txt_corresponsal_saldo').text(formatMoney(data.saldo_actual));
  }

  function renderMovimientos(rows) {
    var $tbody = $('#tbodyMovimientosCorresponsal');
    if (!$tbody.length) return;

    if (!rows || !rows.length) {
      $tbody.html('<tr><td colspan="6" class="text-center text-muted">Sin movimientos registrados</td></tr>');
      return;
    }

    var html = rows.map(function (m) {
      var valor = parseFloat(m.dec_valor) || 0;
      var saldo = parseFloat(m.saldo_acumulado) || 0;
      var referencia = m.int_codigo == null ? '-' : m.int_codigo;
      var valorHtml = valor < 0
        ? '<span class="text-danger font-weight-bold">' + formatMoney(valor) + '</span>'
        : '<span class="text-success font-weight-bold">' + formatMoney(valor) + '</span>';

      return '<tr>' +
        '<td>' + escapeHtml(formatDateTime(m.date_movimiento)) + '</td>' +
        '<td>' + escapeHtml(m.str_tipo || '-') + '</td>' +
        '<td>' + escapeHtml(m.str_descripcion || '-') + '</td>' +
        '<td>' + escapeHtml(referencia) + '</td>' +
        '<td class="text-right">' + valorHtml + '</td>' +
        '<td class="text-right">' + formatMoney(saldo) + '</td>' +
        '</tr>';
    }).join('');

    $tbody.html(html);
  }

  function cargarMovimientos(idahorro) {
    $.getJSON('./ajax/CorresponsalAjax.php?op=listMovimientos', { idahorro: idahorro })
      .done(function (resp) {
        if (resp && resp.status === 'success' && Array.isArray(resp.data)) {
          renderMovimientos(resp.data);
          return;
        }
        renderMovimientos([]);
      })
      .fail(function () {
        renderMovimientos([]);
      });
  }

  function cargarCuentaCorresponsal() {
    $.getJSON('./ajax/CorresponsalAjax.php?op=getCuentaCorresponsal')
      .done(function (resp) {
        if (!resp || resp.status !== 'success' || !resp.data) {
          renderMovimientos([]);
          return;
        }
        renderCuenta(resp.data);
        cargarMovimientos(resp.data.idahorro);
      })
      .fail(function () {
        renderMovimientos([]);
      });
  }

  function mostrarPasoTransferencia(paso) {
    transferenciaState.paso = paso;
    $('.step-transfer').addClass('d-none');
    $('.step-transfer[data-step="' + paso + '"]').removeClass('d-none');
    $('#txtPasoTransferencia').text('Paso ' + paso + ' de ' + transferenciaState.maxPaso);

    $('#btnPasoAnteriorTransferencia').prop('disabled', paso === 1);
    $('#btnPasoSiguienteTransferencia').text(paso === transferenciaState.maxPaso ? 'Finalizar' : 'Siguiente');
  }

  function abrirModalTransferencia() {
    transferenciaState.paso = 1;
    transferenciaState.cuentaDestino = null;
    transferenciaState.guardando = false;
    $('#formTransferenciaCorresponsal')[0].reset();
    $('#txtResumenValor').text('-');
    $('#txtResumenCuenta').text('-');
    $('#txtResumenTitular').text('Pendiente de validar');
    mostrarPasoTransferencia(1);
    $('#modalTransferenciaCorresponsal').modal('show');
  }

  function guardarTransferencia() {
    if (transferenciaState.guardando) return;

    var valor = parseFloat($('#txtTransferenciaValor').val() || 0);
    var destino = transferenciaState.cuentaDestino || {};
    var origen = transferenciaState.cuentaOrigen || {};

    if (!origen.idahorro) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se encontró la cuenta origen del corresponsal.' });
      return;
    }

    if (!destino.idahorro) {
      Swal.fire({ icon: 'warning', title: 'Validación pendiente', text: 'Debe validar una cuenta destino antes de guardar.' });
      return;
    }

    if (valor <= 0) {
      Swal.fire({ icon: 'warning', title: 'Valor inválido', text: 'Ingrese un valor válido para guardar.' });
      return;
    }

    transferenciaState.guardando = true;
    $('#btnPasoSiguienteTransferencia').prop('disabled', true).text('Guardando...');

    $.ajax({
      url: './ajax/CorresponsalAjax.php?op=finalizarTransferencia',
      type: 'POST',
      dataType: 'json',
      data: {
        idahorroOrigen: origen.idahorro,
        idahorroDestino: destino.idahorro,
        monto: valor
      }
    }).done(function (resp) {
      if (!resp || resp.status !== 'success') {
        Swal.fire({
          icon: 'error',
          title: 'No se pudo guardar',
          text: (resp && resp.mensaje) ? resp.mensaje : 'Ocurrió un error al guardar la transferencia.'
        });
        return;
      }

      Swal.fire({ icon: 'success', title: 'Transferencia exitosa', text: resp.mensaje || 'Se registraron los movimientos.' });
      $('#modalTransferenciaCorresponsal').modal('hide');
      cargarCuentaCorresponsal();
    }).fail(function (xhr) {
      var msg = 'Ocurrió un error al guardar la transferencia.';
      if (xhr && xhr.responseJSON && xhr.responseJSON.mensaje) {
        msg = xhr.responseJSON.mensaje;
      }
      Swal.fire({ icon: 'error', title: 'Error', text: msg });
    }).always(function () {
      transferenciaState.guardando = false;
      $('#btnPasoSiguienteTransferencia').prop('disabled', false);
      $('#btnPasoSiguienteTransferencia').text(transferenciaState.paso === transferenciaState.maxPaso ? 'Finalizar' : 'Siguiente');
    });
  }

  function validarPaso1() {
    var valor = parseFloat($('#txtTransferenciaValor').val() || 0);
    var saldoDisponible = parseMoneyText($('#txt_corresponsal_saldo').text());

    if (valor <= 0) {
      Swal.fire({ icon: 'warning', title: 'Valor inválido', text: 'Ingrese un valor mayor a 0.' });
      return false;
    }

    if (valor > saldoDisponible) {
      Swal.fire({ icon: 'warning', title: 'Saldo insuficiente', text: 'El valor supera el saldo disponible.' });
      return false;
    }

    return true;
  }

  function validarPaso2() {
    var cuenta = String($('#txtTransferenciaCuenta').val() || '').trim();
    if (!cuenta) {
      Swal.fire({ icon: 'warning', title: 'Cuenta requerida', text: 'Ingrese el número de cuenta destino.' });
      return false;
    }
    return true;
  }

  function cargarValidacionPaso3() {
    var valor = parseFloat($('#txtTransferenciaValor').val() || 0);
    var cuenta = String($('#txtTransferenciaCuenta').val() || '').trim();

    $('#txtResumenValor').text(formatMoney(valor));
    $('#txtResumenCuenta').text(cuenta || '-');
    $('#txtResumenTitular').text('Validando...');

    return $.getJSON('./ajax/MainAccountAjax.php?op=buscarCuentaDestino', { id_cuenta: cuenta })
      .done(function (resp) {
        if (!resp || resp.status !== 'success') {
          transferenciaState.cuentaDestino = null;
          $('#txtResumenTitular').text('Cuenta no válida');
          Swal.fire({ icon: 'error', title: 'Cuenta inválida', text: (resp && resp.mensaje) ? resp.mensaje : 'No se pudo validar la cuenta destino.' });
          return;
        }

        transferenciaState.cuentaDestino = resp;
        $('#txtResumenTitular').text((resp.nombres || '') + ' ' + (resp.apellidos || ''));
      })
      .fail(function () {
        transferenciaState.cuentaDestino = null;
        $('#txtResumenTitular').text('Error de validación');
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo validar la cuenta destino.' });
      });
  }

  function siguientePasoTransferencia() {
    var pasoActual = transferenciaState.paso;

    if (pasoActual === 1 && !validarPaso1()) return;
    if (pasoActual === 2 && !validarPaso2()) return;

    if (pasoActual === 2) {
      cargarValidacionPaso3().always(function () {
        mostrarPasoTransferencia(3);
      });
      return;
    }

    if (pasoActual === 3) {
      if (!transferenciaState.cuentaDestino) {
        Swal.fire({ icon: 'warning', title: 'Validación pendiente', text: 'Debe validar una cuenta destino antes de continuar.' });
        return;
      }
      mostrarPasoTransferencia(4);
      return;
    }

    if (pasoActual === 4) {
      guardarTransferencia();
      return;
    }

    mostrarPasoTransferencia(Math.min(pasoActual + 1, transferenciaState.maxPaso));
  }

  function anteriorPasoTransferencia() {
    var pasoActual = transferenciaState.paso;
    if (pasoActual <= 1) return;
    mostrarPasoTransferencia(pasoActual - 1);
  }

  function bindTransferencia() {
    $('#btnAbrirTransferenciaCorresponsal').off('click').on('click', function () {
      abrirModalTransferencia();
    });

    $('#btnPasoSiguienteTransferencia').off('click').on('click', function () {
      siguientePasoTransferencia();
    });

    $('#btnPasoAnteriorTransferencia').off('click').on('click', function () {
      anteriorPasoTransferencia();
    });
  }

  function bindRetiro() {
    $('#btnAbrirRetiroCorresponsal').off('click').on('click', function () {
      $('#formRetiroCorresponsal')[0].reset();
      $('#modalRetiroCorresponsal').modal('show');
    });

    $('#formRetiroCorresponsal').off('submit').on('submit', function (e) {
      e.preventDefault();

      var idCuenta = String($('#txtRetiroCuenta').val() || '').trim();
      var monto = parseDecimalInput($('#txtRetiroValor').val());
      var codigo = String($('#txtRetiroCodigo').val() || '').trim();

      if (!idCuenta || monto <= 0 || !codigo) {
        Swal.fire({ icon: 'warning', title: 'Datos incompletos', text: 'Ingrese número de cuenta, valor y código temporal.' });
        return;
      }

      var $btn = $('#btnConfirmarRetiroCorresponsal');
      $btn.prop('disabled', true).text('Procesando...');

      $.ajax({
        url: './ajax/CorresponsalAjax.php?op=entregarRetiroTemporal',
        type: 'POST',
        dataType: 'json',
        data: {
          id_cuenta: idCuenta,
          monto: monto.toFixed(2),
          codigo_temporal: codigo
        }
      }).done(function (resp) {
        if (!resp || resp.status !== 'success') {
          Swal.fire({
            icon: 'error',
            title: 'No se pudo entregar',
            text: (resp && resp.mensaje) ? resp.mensaje : 'No se pudo validar el retiro temporal.'
          });
          return;
        }

        Swal.fire({
          icon: 'success',
          title: 'Retiro entregado',
          text: resp.mensaje || 'Dinero entregado correctamente.'
        });

        $('#modalRetiroCorresponsal').modal('hide');
        cargarCuentaCorresponsal();
      }).fail(function () {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo procesar la entrega del retiro.' });
      }).always(function () {
        $btn.prop('disabled', false).text('Entregar dinero');
      });
    });
  }

  function init() {
    cargarCuentaCorresponsal();
    bindTransferencia();
    bindRetiro();
  }

  window.Corresponsal = {
    init: init,
    recargar: cargarCuentaCorresponsal
  };

  $(document).ready(function () {
    window.Corresponsal.init();
  });
})(jQuery);
