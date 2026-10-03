
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

  function parseCurrencyFlexible(value) {
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
      var currentIdahorro = parseInt($('#idahorro').val() || 0, 10);
      var idahorroRow = parseInt(r.idahorro, 10);
      var idahorroDeRow = parseInt(r.idahorro_de, 10);
      var esMovVia = (idahorroDeRow === currentIdahorro && idahorroRow !== currentIdahorro);
      var esSalida;
      if (esMovVia) {
        esSalida = (r.str_tipo === 'aporte' || r.str_tipo === 'ajuste');
      } else {
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
    $(document).on('click', '[data-target="#modal-aporte"][data-tipo]', function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();

      var idahorro = parseInt($('#idahorro').val() || 0, 10);
      if (!idahorro) {
        Swal.fire({ icon: 'warning', title: 'Cuenta no disponible', text: 'No fue posible identificar la cuenta principal.' });
        return;
      }

      var tipo = ($(this).data('tipo') || 'retiro').toString().toLowerCase();
      if (tipo !== 'retiro') tipo = 'retiro';
      $('#str_tipo').val(tipo);
      var title = 'Registrar retiro';
      $('#modal-aporte-title').text(title);

      $.getJSON('./ajax/MainAccountCorrienteAjax.php?op=retiroTemporalVigente', { idahorro: idahorro })
        .done(function (resp) {
          if (resp && resp.status === 'success' && resp.existe) {
            var codigo = (resp.codigo_temporal || '').toString();
            var venceEn = (resp.vence_en || '').toString();
            var monto = parseFloat(resp.monto || 0);
            var html = '';
            if (monto > 0) {
              html += '<div><strong>Monto:</strong> ' + escapeHtml(formatMoney(monto)) + '</div>';
            }
            if (codigo) {
              html += '<div><strong>Código temporal:</strong> ' + escapeHtml(codigo) + '</div>';
            }
            if (venceEn) {
              html += '<div><strong>Vence:</strong> ' + escapeHtml(venceEn) + '</div>';
            }

            Swal.fire({
              icon: 'success',
              title: 'Retiro temporal generado correctamente',
              html: html || undefined
            });
            return;
          }

          $('#modal-aporte').modal('show');
        })
        .fail(function () {
          $('#modal-aporte').modal('show');
        });
    });

    $('#form-aporte').on('submit', function (e) {
      e.preventDefault();

      if (isSubmittingAporte) return;

      var idahorro = $('#idahorro').val();
      var tipo = $('#str_tipo').val();
      var valor = parseCurrencyFlexible($('#dec_valor').val());
      var descripcion = $('#str_descripcion').val();

      if (!valor || valor <= 0) {
        Swal.fire({ icon: 'warning', title: 'Ingrese un valor valido para retiro' });
        $('#dec_valor').focus();
        return;
      }

      var $btn = $('#form-aporte button[type="submit"]');
      isSubmittingAporte = true;
      $('#form-aporte').attr('data-submit-locked', 'true');
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
        if (resp && resp.status === 'codigo_ya_vigente') {
          var codigoV = (resp.codigo_temporal || '').toString();
          var venceV = (resp.vence_en || '').toString();
          var montoV = parseFloat(resp.monto || 0);
          var htmlV = '';
          if (montoV > 0) htmlV += '<div><strong>Monto:</strong> ' + escapeHtml(formatMoney(montoV)) + '</div>';
          if (codigoV) htmlV += '<div><strong>Código temporal:</strong> ' + escapeHtml(codigoV) + '</div>';
          if (venceV) htmlV += '<div><strong>Vence:</strong> ' + escapeHtml(venceV) + '</div>';
          $('#modal-aporte').modal('hide');
          Swal.fire({
            icon: 'info',
            title: 'Ya existe un retiro temporal vigente',
            html: htmlV || (resp.mensaje || undefined)
          });
          return;
        }
        if (resp && resp.status === 'success') {
          var codigo = (resp.codigo_temporal || '').toString();
          var venceEn = resp.vence_en || '';
          var montoOk = parseFloat(resp.monto || 0);
          var htmlMsg = '';
          if (montoOk > 0) {
            htmlMsg += '<div><strong>Monto:</strong> ' + escapeHtml(formatMoney(montoOk)) + '</div>';
          }
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
          var errCodigo = (resp && resp.codigo_temporal) ? String(resp.codigo_temporal) : '';
          var errVence = (resp && resp.vence_en) ? String(resp.vence_en) : '';
          var errMonto = parseFloat((resp && resp.monto) || 0);
          var errHtml = '';
          if (errMonto > 0) {
            errHtml += '<div style="color:#198754;"><strong>Monto:</strong> ' + escapeHtml(formatMoney(errMonto)) + '</div>';
          }
          if (errCodigo) {
            errHtml += '<div style="color:#198754;font-weight:700;"><strong>Código temporal:</strong> ' + escapeHtml(errCodigo) + '</div>';
          }
          if (errVence) {
            errHtml += '<div style="color:#198754;"><strong>Vence:</strong> ' + escapeHtml(errVence) + '</div>';
          }

          if (errCodigo || errVence) {
            var infoMail = '';
            if (msg && msg.toLowerCase().indexOf('email') >= 0) {
              infoMail = '<div style="margin-bottom:8px;color:#b58105;"><strong>Atención:</strong> No fue posible enviar el correo, pero el código ya fue generado.</div>';
            }

            $('#modal-aporte').modal('hide');
            $('#form-aporte')[0].reset();
            $('#str_tipo').val('retiro');
            goAccount();
            loadResumenSaldos();
            loadMovimientosPrincipal($('#idahorro').val());

            Swal.fire({
              icon: 'success',
              title: 'Retiro temporal generado correctamente',
              html: '<div style="background:#e9f7ef;border:1px solid #badbcc;border-radius:8px;padding:10px;">' + infoMail + errHtml + '</div>'
            });
            return;
          }

          Swal.fire({
            icon: 'error',
            title: msg,
            html: errHtml || undefined
          });
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

      if (isSubmittingFinalizar) return;

      var idahorroOrigen = parseInt($('#idahorro').val() || 0, 10);
      var idahorroDestino = parseInt($('#stepperForm').data('idahorroDestino') || 0, 10);
      var monto = parseCurrencyFlexible($('#monto').val());
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
