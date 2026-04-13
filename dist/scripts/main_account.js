
(function ($) {
  'use strict';

  var isSubmittingAporte = false;
  var isSubmittingFinalizar = false;

  function formatMoney(v) {
    var n = parseFloat(v);
    if (!Number.isFinite(n)) n = 0;

    var moneda;
    if (typeof window.formatearMonedaPublica === 'function') {
      moneda = window.formatearMonedaPublica(n, 2);
    } else {
      moneda = n.toLocaleString('es-CO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    return '$' + moneda;
  }

  function parseCurrencyInput(value) {
    if (value == null) return 0;

    var raw = String(value).trim();
    if (!raw) return 0;

    raw = raw.replace(/\s+/g, '').replace(/[^\d.,-]/g, '');

    if (raw.indexOf(',') >= 0) {
      raw = raw.replace(/\./g, '').replace(',', '.');
    } else if (raw.indexOf('.') >= 0) {
      var dotCount = (raw.match(/\./g) || []).length;
      if (dotCount > 1) {
        raw = raw.replace(/\./g, '');
      } else {
        var parts = raw.split('.');
        if (parts[1] && parts[1].length === 3) {
          raw = parts[0] + parts[1];
        }
      }
    }

    var num = Number(raw);
    return Number.isFinite(num) ? num : 0;
  }

  function formatCurrencyTypingValue(value) {
    var raw = String(value == null ? '' : value)
      .replace(/\s+/g, '')
      .replace(/[^\d,]/g, '');

    if (!raw) return '';

    var chunks = raw.split(',');
    var integerPart = chunks[0] || '0';
    var decimalPart = chunks.slice(1).join('').substring(0, 2);

    integerPart = integerPart.replace(/^0+(?=\d)/, '');
    if (!integerPart) integerPart = '0';
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    return decimalPart ? (integerPart + ',' + decimalPart) : integerPart;
  }

  function bindCurrencyInput(selector) {
    var $input = $(selector);
    if (!$input.length) return;

    $input.off('input.currencyMask').on('input.currencyMask', function () {
      var cursorAtEnd = this.selectionStart === this.value.length;
      this.value = formatCurrencyTypingValue(this.value);

      if (cursorAtEnd && this.setSelectionRange) {
        this.setSelectionRange(this.value.length, this.value.length);
      }
    });

    $input.off('blur.currencyMask').on('blur.currencyMask', function () {
      var n = parseCurrencyInput(this.value);
      this.value = n.toLocaleString('es-CO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    });
  }

  function renderProfile(data) {
    if (!data) return;
    $('#txt_account_name').text((data.str_name || '').trim() || 'Cuenta Principal');
    $('#txt_account_created').text('Creación: ' + ((data.created_at || '').trim() || '-'));
    $('#txt_num_cuenta').text(data.id_cuenta || '');
    $('#txt_name_ahorrador').text((data.nombres || '') + ' ' + (data.apellidos || ''));
    $('#txt_tipo_documento_ahorrador').text(data.t_documento || '');
    $('#txt_num_documento_ahorrador').text(data.n_documento || '');
    $('#txt_tel_ahorrador').text(data.telefono || '-');
    $('#txt_porcentaje_ahorrador').text((data.porcentaje || 0) + '%');
    $('#pTextTipoPago').text(data.pagoUtilidad || data.pago_utilidad || '-');
    $('#txt_estado_ahorrador').text(data.estadoAhorro || data.estado || '-');
    $('#txt_fecha_creacion_ahorrador').text(data.fechaCreacion || data.fecha_at || '-');
    var saldo = parseFloat(data.saldo || 0) || 0;
    $('#txt_saldo_header').text(formatMoney(saldo));
    if (data.idahorro) { $('#idahorro').val(data.idahorro); }
    // guardar refAhorro si viene
    if (data.refAhorro) { $('#txtRefAhorroConfig').val(data.refAhorro); }
    if (data.foto) { $('#img_ahorrador').attr('src', data.foto); }
  }

  function renderResumenSaldos(data) {
    var corresponsales = parseFloat(data && data.corresponsales) || 0;
    var ahorradores = parseFloat(data && data.ahorradores) || 0;
    var miAhorros = parseFloat(data && data.mi_ahorros) || 0;
    var subtotal = parseFloat(data && data.subtotal);
    var saldo_disponible = parseFloat(data && data.saldo_disponible);

    if (isNaN(subtotal)) subtotal = corresponsales + ahorradores + miAhorros;

    function setSummaryRowValue(cellSelector, value) {
      var $cell = $(cellSelector);
      $cell.text(formatMoney(value));
      $cell.closest('tr').toggle(value > 0);
    }

    setSummaryRowValue('#tbl_corresponsales', corresponsales);
    setSummaryRowValue('#tbl_ahorradores', ahorradores);
    setSummaryRowValue('#tbl_mi_ahorros', miAhorros);
    $('#tbl_subtotal').text(formatMoney(subtotal));
    $('#tbl_saldo_disponible').text(formatMoney(saldo_disponible));
    $('#tbl_total').text(formatMoney(saldo_disponible + subtotal));
  }

  function loadResumenSaldos() {
    $.getJSON('./ajax/MainAccountAjax.php?op=resumenSaldos')
      .done(function (resp) {
        if (resp && resp.status === 'success') {
          renderResumenSaldos(resp);
          return;
        }
        renderResumenSaldos(null);
      })
      .fail(function () {
        renderResumenSaldos(null);
      });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderMovimientosPrincipal(rows) {
    var $tbody = $('#tbodyMovimientosPrincipal');
    if (!$tbody.length) return;

    if (!rows || !rows.length) {
      $tbody.html('<tr><td colspan="5" class="text-center text-muted">Sin movimientos</td></tr>');
      return;
    }

    var currentIdahorro = parseInt($('#idahorro').val() || 0, 10);

    var html = rows.map(function (r) {
      var valor = parseFloat(r.dec_valor) || 0;
      // Determinar si el movimiento llega vía idahorro_de (esta cuenta es el destino/origen referenciado)
      var idahorroRow = parseInt(r.idahorro, 10);
      var idahorroDeRow = parseInt(r.idahorro_de, 10);
      var esMovVia = (idahorroDeRow === currentIdahorro && idahorroRow !== currentIdahorro);
      var esSalida;
      if (esMovVia) {
        // idahorro_de = esta cuenta:
        //   retiro  → +dec_valor (transferencia recibida, dinero que llega)
        //   aporte/ajuste → -dec_valor (cede saldo a esta cuenta, reduce saldo de origen)
        esSalida = (r.str_tipo === 'aporte' || r.str_tipo === 'ajuste');
      } else {
        // Movimiento directo sobre esta cuenta (idahorro = currentIdahorro):
        //   retiro/salida → -dec_valor
        //   aporte/ajuste/entrada → +dec_valor
        esSalida = (r.str_tipo === 'retiro' || r.str_tipo === 'salida');
      }
      var valorHtml = esSalida
        ? '<span class="text-danger font-weight-bold">-' + formatMoney(valor) + '</span>'
        : '<span class="text-success font-weight-bold">+' + formatMoney(valor) + '</span>';

      return '<tr ' +
        'data-idmovimiento="' + escapeHtml(r.idmovimiento) + '" ' +
        'data-idglobal="' + escapeHtml(r.idglobal) + '" ' +
        'data-idahorro="' + escapeHtml(r.idahorro) + '" ' +
        'data-idusuario-created="' + escapeHtml(r.idusuario_created) + '" ' +
        'data-int-codigo="' + escapeHtml(r.int_codigo || '') + '" ' +
        'data-update-at="' + escapeHtml(r.update_at || '') + '">' +
        '<td>' + escapeHtml(r.date_movimiento) + '</td>' +
        '<td>' + escapeHtml(r.str_tipo) + '</td>' +
        '<td>' + valorHtml + '</td>' +
        '<td>' + escapeHtml(r.str_descripcion) + '</td>' +
        '<td>' + escapeHtml(r.str_estado) + '</td>' +
        '</tr>';
    }).join('');

    $tbody.html(html);
  }

  function loadMovimientosPrincipal(idahorro) {
    var ahorro = parseInt(idahorro || 0, 10);
    if (!ahorro) {
      renderMovimientosPrincipal([]);
      return;
    }

    $.getJSON('./ajax/MainAccountAjax.php?op=listMovimientos', { idahorro: ahorro })
      .done(function (resp) {
        if (resp && resp.status === 'success' && Array.isArray(resp.data)) {
          renderMovimientosPrincipal(resp.data);
          return;
        }
        renderMovimientosPrincipal([]);
      })
      .fail(function () {
        renderMovimientosPrincipal([]);
      });
  }

  function loadMovements(refAhorro) {
    if (!refAhorro) return;
    var table = $('#tblMovimientos').DataTable();
    $.post('./ajax/AhorrosAjax.php?op=listMovimientos', { refAhorro: refAhorro }, function (resp) {
      try {
        var datos = typeof resp === 'string' ? JSON.parse(resp) : resp;
      } catch (e) {
        console.error('Respuesta movimientos inválida', resp);
        return;
      }
      table.clear();
      var total = 0;
      datos.forEach(function (r) {
        var fecha = r[0] || '';
        var tipo = r[1] || '';
        var monto = parseFloat(r[2]) || 0;
        var desc = r[3] || '';
        var estado = r[4] || '';
        if (tipo === 'aporte' || tipo === 'ajuste' || tipo === 'entrada') total += monto;
        if (tipo === 'retiro' || tipo === 'salida') total -= monto;
        table.row.add([fecha, tipo, formatMoney(monto), desc, estado]);
      });
      table.draw();
      $('#txt_saldo_header').text(formatMoney(total));
      if (datos.length === 0) {
        $('#msgSinMovimientos').removeClass('d-none');
      } else {
        $('#msgSinMovimientos').addClass('d-none');
      }
    }).fail(function (e) {
      console.error('Error AJAX movimientos', e.responseText || e);
    });
  }

  function loadGanancias(refAhorro) {
    if (!refAhorro) return;
    var table;
    if ($.fn.DataTable.isDataTable('#tblGanancias')) {
      table = $('#tblGanancias').DataTable();
    } else {
      table = $('#tblGanancias').DataTable({ responsive: true, lengthChange: false, autoWidth: false });
    }
    $.post('./ajax/AhorrosAjax.php?op=listGanancias', { refAhorro: refAhorro }, function (resp) {
      var datos;
      try { datos = typeof resp === 'string' ? JSON.parse(resp) : resp; } catch (e) { console.error('Ganancias inválidas', resp); return; }
      table.clear();
      datos.forEach(function (r) {
        table.row.add([r[0] || '', (r[1] || 0) + '%', formatMoney(r[2] || 0), formatMoney(r[3] || 0)]);
      });
      table.draw();
      if (datos.length === 0) {
        $('#msgSinGanancias').removeClass('d-none');
      } else {
        $('#msgSinGanancias').addClass('d-none');
      }
    }).fail(function (e) { console.error('Error AJAX ganancias', e.responseText || e); });
  }

  function fetchProfileByDocument(tipo, num) {
    if (!num) return;
    $.getJSON('./ajax/AhorrosAjax.php?op=buscarPersona', { tipo_documento: tipo, num_documento: num })
      .done(function (data) {
        if (data === 0) {
          Swal.fire({ icon: 'error', title: 'Perfil no encontrado' });
          return;
        }
        renderProfile(data);
        var ref = data.refAhorro || $('#txtRefAhorroConfig').val();
        if (ref) loadMovements(ref);
        // mostrar/ocultar botón de nuevo movimiento según auth
        var puede = (data.authMovimientos == 1 || data.auth_movimientos == 1 || data.isSuperAdmin == 1);
        if (puede) {
          $('#btnNuevoMovimiento').show();
        } else {
          $('#btnNuevoMovimiento').hide();
        }
      })
      .fail(function (e) { console.error('Error AJAX perfil', e.responseText || e); });
  }

  function submitMovimientoForm() {
    /*$('#formMovimientoAhorro').on('submit', function (e) {
      e.preventDefault();
      var fd = $(this).serialize();
      $.ajax({
        url: './ajax/AhorrosAjax.php?op=registrarMovimiento',
        method: 'POST',
        data: fd,
        success: function (r) {
          var res;
          try { res = typeof r === 'string' ? JSON.parse(r) : r; } catch (err) { res = null; }
          if (res && res.status === 'success') {
            Swal.fire({ icon: 'success', title: res.mensaje });
            $('#modalMovimiento').modal('hide');
            var ref = $('#txtRefAhorroConfig').val();
            loadMovements(ref);
            // volver a solicitar perfil para actualizar saldo
            var tipo = window.MI_AHORRO_SESSION && window.MI_AHORRO_SESSION.tipo || '';
            var num = window.MI_AHORRO_SESSION && window.MI_AHORRO_SESSION.num || '';
            fetchProfileByDocument(tipo, num);
          } else {
            Swal.fire({ icon: 'error', title: res && res.mensaje ? res.mensaje : 'Error al registrar movimiento' });
          }
        },
        error: function (e) {
          console.error('Error registrar movimiento', e.responseText || e);
          Swal.fire({ icon: 'error', title: 'Error servidor' });
        }
      });
    });*/
  }

  function bindRAForm() {
    $(document).on('click', '[data-target="#modal-aporte"][data-tipo]', function () {
      var tipo = ($(this).data('tipo') || 'aporte').toString().toLowerCase();
      $('#str_tipo').val(tipo);
      var title = 'Registrar movimiento';
      if (tipo === 'salida') title = 'Registrar salida';
      if (tipo === 'entrada') title = 'Registrar entrada';
      $('#modal-aporte-title').text(title);
    });

    $('#form-aporte').on('submit', function (e) {
      e.preventDefault();

      if (isSubmittingAporte) return;

      var idahorro = $('#idahorro').val();
      var tipo = $('#str_tipo').val();
      var valorNumero = parseCurrencyInput($('#dec_valor').val());
      var valor = valorNumero.toFixed(2);
      var descripcion = $('#str_descripcion').val();

      if (!valorNumero || valorNumero <= 0) {
        Swal.fire({ icon: 'warning', title: 'Ingrese un valor valido' });
        $('#dec_valor').focus();
        return;
      }

      var $btn = $('#form-aporte button[type="submit"]');
      isSubmittingAporte = true;
      $('#form-aporte').attr('data-submit-locked', 'true');
      $btn.prop('disabled', true);

      $.ajax({
        url: './ajax/MainAccountAjax.php?op=registrarMovimientosRA',
        method: 'POST',
        dataType: 'json',
        data: {
          idahorroMovimiento: idahorro,
          cboTipoMovimiento: tipo,
          txtValorMovimiento: valor,
          txtDescripcionMovimiento: descripcion
        }
      }).done(function (resp) {
        if (resp && resp.status === 'success') {
          Swal.fire({ icon: 'success', title: resp.mensaje || 'Aporte registrado' });
          $('#modal-aporte').modal('hide');
          $('#form-aporte')[0].reset();
          goAccount();
          loadResumenSaldos();
          loadMovimientosPrincipal($('#idahorro').val());
        } else {
          var msg = (resp && resp.mensaje) ? resp.mensaje : 'No se pudo registrar el aporte';
          Swal.fire({ icon: 'error', title: msg });
        }
      }).fail(function (e) {
        console.error('Error AJAX aporte', e.responseText || e);
        Swal.fire({ icon: 'error', title: 'Error de comunicación con el servidor' });
      }).always(function () {
        isSubmittingAporte = false;
        $('#form-aporte').removeAttr('data-submit-locked');
        $btn.prop('disabled', false);
      });
    });

    // Evita repetir submit con Enter cuando ya hay una petición en curso.
    $('#form-aporte').on('keydown', function (e) {
      if (e.key === 'Enter' && isSubmittingAporte) {
        e.preventDefault();
      }
    });

    bindCurrencyInput('#dec_valor');
  }

  function goAccount() {
    // $.post("./ajax/MainAccountAjax.php?op=goAccount", function (account) {
    // console.log(account);
    //if (!num) return;
    $.getJSON('./ajax/MainAccountAjax.php?op=goAccount')
      .done(function (data) {

        if (data?.id_cuenta) {
          console.log('Cuenta principal encontrada:', data);
          renderProfile(data);
          loadResumenSaldos();
          loadMovimientosPrincipal(data.idahorro || $('#idahorro').val());

        } else {
          Swal.fire({
            icon: 'warning',
            title: 'Crear cuenta principal',
            text: 'Se creará una cuenta de ahorro principal para su empresa. ¿Desea continuar?',
            showCancelButton: true,
            confirmButtonText: 'Sí, crear',
            cancelButtonText: 'Cancelar'
          }).then(function (result) {
            if (!result.isConfirmed) return;
            Swal.fire({ title: 'Creando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            $.ajax({
              url: './ajax/MainAccountAjax.php?op=tprincipal',
              method: 'POST',
              dataType: 'json',
            }).done(function (resp) {
              if (resp && resp.status === 'success') {
                Swal.fire({ icon: 'success', title: 'Cuenta creada', text: resp.mensaje || 'Cuenta principal creada.' });
                // Refrescar listado de ahorros del usuario
                goAccount()
              } else {
                var msg = (resp && resp.mensaje) ? resp.mensaje : 'No se pudo crear la cuenta.';
                Swal.fire({ icon: 'error', title: 'Error', text: msg });
              }
            }).fail(function () {
              Swal.fire({ icon: 'error', title: 'Error', text: 'Error de comunicación con el servidor.' });
            });
          });
        }


      }).fail(function (e) {
        console.error('Error AJAX cuenta principal', e.responseText || e);
      });
  }

  function init() {
    verCuenta();
    bindRAForm();
    goAccount();
    loadResumenSaldos();

    $("#aEnviarVer").click(function (e) {
      e.preventDefault();
      verFormEnviar();
    });

    // Prevenir envío del formulario por defecto
    $("#stepperForm").submit(function (e) {
      e.preventDefault();
      return false;
    });

    // Solo enviar desde el botón finalizar
    $(document).on('click', '#btnFinalizar, [data-action="finalizar"]', function (e) {
      e.preventDefault();

      if (isSubmittingFinalizar) return;

      var idahorroOrigen = parseInt($('#idahorro').val() || 0, 10);
      var idahorroDestino = parseInt($('#stepperForm').data('idahorroDestino') || 0, 10);
      var monto = parseCurrencyInput($('#monto').val());
      var descripcion = ($('#str_descripcion_envio').val() || '').trim();

      if (!idahorroOrigen || !idahorroDestino || !monto || monto <= 0 || !descripcion) {
        Swal.fire({
          icon: 'warning',
          title: 'Datos incompletos',
          text: 'Valide cuenta destino, monto y descripción antes de finalizar.'
        });
        return;
      }

      if (idahorroOrigen === idahorroDestino) {
        Swal.fire({
          icon: 'warning',
          title: 'Cuenta inválida',
          text: 'La cuenta destino no puede ser la misma cuenta origen.'
        });
        return;
      }

      var $btnFinalizar = $('#btnFinalizar');
      isSubmittingFinalizar = true;
      $('#stepperForm').attr('data-submit-locked', 'true');
      $btnFinalizar.prop('disabled', true);

      $.ajax({
        url: './ajax/MainAccountAjax.php?op=finalizarEnvioPrincipal',
        method: 'POST',
        dataType: 'json',
        data: {
          idahorroOrigen: idahorroOrigen,
          idahorroDestino: idahorroDestino,
          monto: monto,
          descripcion: descripcion
        }
      }).done(function (resp) {
        if (resp && resp.status === 'success') {
          Swal.fire({
            icon: 'success',
            title: 'Transferencia realizada',
            text: resp.mensaje || 'El envío fue registrado correctamente.'
          });

          $('#stepperForm')[0].reset();
          $('#stepperForm').removeData('idahorroDestino');
          if (typeof stepper !== 'undefined' && stepper) {
            stepper.reset();
          }

          verCuenta();
          goAccount();
          loadResumenSaldos();
          loadMovimientosPrincipal($('#idahorro').val());
        } else {
          Swal.fire({
            icon: 'error',
            title: 'No fue posible finalizar',
            text: (resp && resp.mensaje) ? resp.mensaje : 'No se pudo registrar la transferencia.'
          });
        }
      }).fail(function () {
        Swal.fire({
          icon: 'error',
          title: 'Error de comunicación',
          text: 'No se pudo contactar el servidor.'
        });
      }).always(function () {
        isSubmittingFinalizar = false;
        $('#stepperForm').removeAttr('data-submit-locked');
        $btnFinalizar.prop('disabled', false);
      });
    });

    // Evita finalizar múltiples veces por Enter repetido en el stepper.
    $('#stepperForm').on('keydown', function (e) {
      if (e.key === 'Enter' && isSubmittingFinalizar) {
        e.preventDefault();
      }
    });

    $(".btnCancelarEnvio").click(function (e) {
      e.preventDefault();
      // resetear formulario
      $('#stepperForm')[0].reset();
      $('#stepperForm').removeData('idahorroDestino');
      stepper.reset();
      verCuenta();
    });
  }

  function verCuenta() {
    $('#verCuentaPrincipal').removeClass('hide');
    $("#verFormEnviar").addClass('hide');
  };

  function verFormEnviar() {
    $('#verFormEnviar').removeClass('hide');
    $("#verCuentaPrincipal").addClass('hide');
  }

  // Exponer funciones útiles
  window.Account = {
    init: init,
    verFormEnviar: verFormEnviar,
    verCuenta: verCuenta,

  };

  $(document).ready(init);
})(jQuery);
