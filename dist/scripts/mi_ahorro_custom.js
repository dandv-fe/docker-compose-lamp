/* Archivo: dist/scripts/mi_ahorro_custom.js
   JS personalizado para la vista Mi Ahorro
*/
(function ($) {
  'use strict';

  function formatMoney(v) {
    var n = parseFloat(v) || 0;
    return '$' + n.toFixed(2);
  }

  function renderProfile(data) {
    if (!data) return;
    $('#txt_num_cuenta').text(data.n_documento || '');
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
    $('#formMovimientoAhorro').on('submit', function (e) {
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
    });
  }

  function init() {
    // inicializar DataTable (si no lo hizo la vista)
    if (!$.fn.DataTable.isDataTable('#tblMovimientos')) {
      $('#tblMovimientos').DataTable({ responsive: true, lengthChange: false, autoWidth: false });
    }

    // bind nuevo movimiento
    $('#btnNuevoMovimiento').on('click', function () {
      $('#formMovimientoAhorro')[0].reset();
      var ref = $('#txtRefAhorroConfig').val();
      $('#idahorroMovimiento').val(ref || '');
      $('#modalMovimiento').modal('show');
    });

    submitMovimientoForm();

    // cargar perfil automáticamente desde sesión (si existe)
    var tipo = window.MI_AHORRO_SESSION && window.MI_AHORRO_SESSION.tipo || '';
    var num = window.MI_AHORRO_SESSION && window.MI_AHORRO_SESSION.num || '';
    if (num) { fetchProfileByDocument(tipo, num); }

    // listeners para tabs
    $('a[data-toggle="tab"][href="#tabMovimientos"]').on('shown.bs.tab', function () {
      var ref = $('#txtRefAhorroConfig').val();
      if (ref) loadMovements(ref);
    });
    $('a[data-toggle="tab"][href="#tabGanancias"]').on('shown.bs.tab', function () {
      var ref = $('#txtRefAhorroConfig').val();
      if (ref) loadGanancias(ref);
    });
  }

  // Exponer funciones útiles
  window.MiAhorro = {
    init: init,
    fetchProfileByDocument: fetchProfileByDocument,
    loadMovements: loadMovements,
    loadGanancias: loadGanancias
  };

  $(document).ready(init);
})(jQuery);
