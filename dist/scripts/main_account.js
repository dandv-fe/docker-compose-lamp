
(function ($) {
  'use strict';

  function formatMoney(v) {
    var n = parseFloat(v) || 0;
    return '$' + n.toFixed(2);
  }

  function renderProfile(data) {
    if (!data) return;
    $('#txt_num_cuenta').text(data.id_cuenta || '');
    $('#txt_name_ahorrador').text((data.nombres || '') + ' ' + (data.apellidos || ''));
    $('#txt_tipo_documento_ahorrador').text(data.t_documento || '');
    $('#txt_num_documento_ahorrador').text(data.n_documento || '');
    $('#txt_tel_ahorrador').text(data.telefono || '-');
    $('#txt_porcentaje_ahorrador').text((data.porcentaje || 0) + '%');
    $('#pTextTipoPago').text(data.pagoUtilidad || data.pago_utilidad || '-');
    $('#txt_estado_ahorrador').text(data.estadoAhorro || data.estado || '-');
    $('#txt_fecha_creacion_ahorrador').text(data.fechaCreacion || data.fecha_at || '-');
    var saldo = parseFloat(data.saldoMovimientos || data.saldo_movimientos || 0) || 0;
    $('#txt_saldo_header').text(formatMoney(saldo));
    if (data.idahorro) { $('#idahorro').val(data.idahorro); }
    // guardar refAhorro si viene
    if (data.refAhorro) { $('#txtRefAhorroConfig').val(data.refAhorro); }
    if (data.foto) { $('#img_ahorrador').attr('src', data.foto); }
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
      var title = (tipo === 'retiro') ? 'Registrar retiro' : 'Registrar aporte';
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
        } else {
          var msg = (resp && resp.mensaje) ? resp.mensaje : 'No se pudo registrar el aporte';
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
    $.getJSON('./ajax/MainAccountAjax.php?op=goAccount')
      .done(function (data) {

        if (data?.id_cuenta) {
          console.log('Cuenta principal encontrada:', data);
          renderProfile(data);

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
      Swal.fire({
        icon: 'info',
        title: 'Funcionalidad no disponible',
        text: 'La funcionalidad de envío no está implementada en esta versión.'
      });
    });

    $(".btnCancelarEnvio").click(function (e) {
      e.preventDefault();
      // resetear formulario
      $('#stepperForm')[0].reset();
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
