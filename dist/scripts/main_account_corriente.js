
(function ($) {
  'use strict';

  function formatMoney(v) {
    var n = parseFloat(v) || 0;
    return '$' + n.toFixed(2);
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
    $.getJSON('./ajax/MainAccountCorrienteAjax.php?op=resumenSaldos')
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

    var html = rows.map(function (r) {
      var valor = parseFloat(r.dec_valor) || 0;
      var valorHtml = valor < 0
        ? '<span class="text-danger font-weight-bold">' + formatMoney(valor) + '</span>'
        : formatMoney(valor);

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

    $.getJSON('./ajax/MainAccountCorrienteAjax.php?op=listMovimientos', { idahorro: ahorro })
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
    $.post('./ajax/MainAccountCorrienteAjax.php?op=listMovimientos', { refAhorro: refAhorro }, function (resp) {
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
        if (tipo === 'aporte' || tipo === 'ajuste') total += monto;
        if (tipo === 'retiro') total -= monto;
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
    $.post('./ajax/MainAccountCorrienteAjax.php?op=listGanancias', { refAhorro: refAhorro }, function (resp) {
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
        url: './ajax/MainAccountCorrienteAjax.php?op=registrarMovimiento',
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
      var tipo = ($(this).data('tipo') || 'retiro').toString().toLowerCase();
      if (tipo !== 'retiro') tipo = 'retiro';
      $('#str_tipo').val(tipo);
      var title = 'Registrar retiro';
      $('#modal-aporte-title').text(title);
    });

    $('#form-aporte').on('submit', function (e) {
      e.preventDefault();

      var idahorro = $('#idahorro').val();
      var tipo = $('#str_tipo').val();
      var valor = $('#dec_valor').val();
      var descripcion = $('#str_descripcion').val();

      var $btn = $('#form-aporte button[type="submit"]');
      $btn.prop('disabled', true);

      $.ajax({
        url: './ajax/MainAccountCorrienteAjax.php?op=registrarMovimientosRA',
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
          var codigo = (resp.codigo_temporal || '').toString();
          var venceEn = resp.vence_en || '';
          var htmlMsg = '';
          if (codigo) {
            htmlMsg += '<div><strong>Código temporal:</strong> ' + escapeHtml(codigo) + '</div>';
          }
          if (venceEn) {
            htmlMsg += '<div><strong>Vence:</strong> ' + escapeHtml(venceEn) + '</div>';
          }

          Swal.fire({
            icon: 'success',
            title: resp.mensaje || 'Retiro temporal generado',
            html: htmlMsg || undefined,
            text: htmlMsg ? undefined : 'Se generó un código temporal de retiro.'
          });
          $('#modal-aporte').modal('hide');
          $('#form-aporte')[0].reset();
          $('#str_tipo').val('retiro');
          goAccount();
          loadResumenSaldos();
          loadMovimientosPrincipal($('#idahorro').val());
        } else {
          var msg = (resp && resp.mensaje) ? resp.mensaje : 'No se pudo registrar el retiro';
          Swal.fire({ icon: 'error', title: msg });
        }
      }).fail(function (e) {
        console.error('Error AJAX aporte', e.responseText || e);
        Swal.fire({ icon: 'error', title: 'Error de comunicación con el servidor' });
      }).always(function () {
        $btn.prop('disabled', false);
      });
    });
  }

  function goAccount() {
    // $.post("./ajax/MainAccountAjax.php?op=goAccount", function (account) {
    // console.log(account);
    //if (!num) return;
    $.getJSON('./ajax/MainAccountCorrienteAjax.php?op=goAccount')
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

      var idahorroOrigen = parseInt($('#idahorro').val() || 0, 10);
      var idahorroDestino = parseInt($('#stepperForm').data('idahorroDestino') || 0, 10);
      var monto = parseFloat($('#monto').val() || 0);
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
      $btnFinalizar.prop('disabled', true);

      $.ajax({
        url: './ajax/MainAccountCorrienteAjax.php?op=finalizarEnvioPrincipal',
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
        $btnFinalizar.prop('disabled', false);
      });
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
