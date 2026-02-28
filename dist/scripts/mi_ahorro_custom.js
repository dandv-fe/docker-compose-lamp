
(function ($) {
  'use strict';

  function formatMoney(v) {
    var n = parseFloat(v) || 0;
    return '$' + n.toFixed(2);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDateTime(v) {
    if (!v) return '-';
    return String(v).replace('T', ' ').substring(0, 19);
  }

  function renderMovimientosDetalle(movimientos) {
    var $tbody = $('#tbodyMovimientosCorresponsal');
    if (!$tbody.length) return;

    if (!movimientos || !movimientos.length) {
      $tbody.html('<tr><td colspan="5" class="text-center text-muted">Sin movimientos</td></tr>');
      return;
    }

    var html = movimientos.map(function (m) {
      var valor = parseFloat(m.dec_valor) || 0;
      var valorHtml = valor < 0
        ? '<span class="text-danger font-weight-bold">' + formatMoney(valor) + '</span>'
        : formatMoney(valor);

      return '<tr>' +
        '<td>' + escapeHtml(formatDateTime(m.date_movimiento)) + '</td>' +
        '<td>' + escapeHtml(m.str_tipo || '-') + '</td>' +
        '<td>' + valorHtml + '</td>' +
        '<td>' + escapeHtml(m.str_descripcion || '-') + '</td>' +
        '<td>' + escapeHtml(m.str_estado || '-') + '</td>' +
        '</tr>';
    }).join('');

    $tbody.html(html);
  }

  function cargarMovimientosDetalle(idahorro) {
    $.getJSON('./ajax/MiAhorroAjax.php?op=listMovimientos', { idahorro: idahorro })
      .done(function (resp) {
        if (resp && resp.status === 'success' && Array.isArray(resp.data)) {
          renderMovimientosDetalle(resp.data);
          return;
        }
        renderMovimientosDetalle([]);
      })
      .fail(function () {
        renderMovimientosDetalle([]);
      });
  }

  function verDetalle(row) {
    $('#det_descripcion').text(row.str_name || '-');
    $('#det_numero').text(row.id_cuenta || '-');
    $('#det_saldo').text(formatMoney(row.saldo_real));
    $('#det_estado').text(row.str_estado || '-');
    $('#det_fecha').text(formatDateTime(row.created_at));

    cargarMovimientosDetalle(row.idahorro || 0);

    $('#verFormulario').addClass('hide');
    $('#verLista').addClass('hide');
    $('#btnNuevoCorresponsal').addClass('hide');
    $('#verDetalle').removeClass('hide');
  }

  function capitalizarPalabras(texto) {
    return String(texto || '')
      .toLowerCase()
      .replace(/\b\w/g, function (letra) { return letra.toUpperCase(); })
      .trim();
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



  function init() {
    $("#auth_movimientos").change(function (e) {
      e.preventDefault();
      $("#bit_auth_movimientos").val(e.target.checked ? 'true' : 'false');
    });
    $("#btnNuevoCorresponsal").click(function (e) {
      e.preventDefault();
      Corresponsal.verFormulario();
    });
    $("form#formCorresponsal").submit(function (e) {
      e.preventDefault();
      saveOrUpdate();
    });
    listarCorresponsales();
  }
  function listarCorresponsales() {
    // Aquí iría la lógica para listar los corresponsales
    const tabla = $("#example1").DataTable()
    $.ajax({
      url: './ajax/MiAhorroAjax.php?op=listMisAhorros',
      type: "POST",
      data: {},
      dataType: "json",
      success: function (datos) {
        console.log(datos);

        tabla.clear().draw();
        for (let i = 0; i < datos.length; i++) {
          const val = datos[i];
          var btnVer = '<button type="button" class="btn btn-info btn-sm mr-1 btn-ver-corresponsal" data-idx="' + i + '"><i class="fas fa-eye"></i></button>';
          var btnEditar = '<button type="button" class="btn btn-warning btn-sm btn-editar-corresponsal" data-idx="' + i + '"><i class="fas fa-edit"></i></button>';

          tabla.row
            .add([
              escapeHtml(val['str_name']),
              val['id_cuenta'],
              formatMoney(val['saldo_real']),
              escapeHtml(val['str_estado']),
              formatDateTime(val['created_at']),
              btnVer + btnEditar
            ]).draw(false);
        }

        $('#example1').off('click', '.btn-ver-corresponsal').on('click', '.btn-ver-corresponsal', function () {
          var idx = parseInt($(this).data('idx'), 10);
          var row = datos[idx] || {};
          verDetalle(row);
        });

        $('#example1').off('click', '.btn-editar-corresponsal').on('click', '.btn-editar-corresponsal', function () {
          var idx = parseInt($(this).data('idx'), 10);
          var row = datos[idx] || {};

          $('#idahorro').val(row.idahorro || '');
          $('#dec_porcentaje').val(row.dec_porcentaje || '');
          $('#str_name').val(row.str_name || '');
          $('#str_pago_utilidad').val(row.str_pago_utilidad || 'manual');
          $('#str_estado').val(row.str_estado || 'activo');

          var auth = (row.bit_auth_movimientos == 1 || row.bit_auth_movimientos === '1');
          $('#auth_movimientos').prop('checked', auth);
          $('#bit_auth_movimientos').val(auth ? 'true' : 'false');

          Corresponsal.verFormulario();
          cargarEmpleados(row.idpersona || '');
        });
      },
      error: function (e) {
        console.log(e.responseText);
      }
    });
  }


  function cargarEmpleados(selectedId) {
    var idahorroActual = parseInt($('#idahorro').val() || 0, 10) || 0;
    $.get("./ajax/MiAhorroAjax.php?op=listEmpleados", { idahorro: idahorroActual }, function (html) {
      $("#str_empleado").html(html);
      if (selectedId) {
        $("#str_empleado").val(String(selectedId));
      }
    }).fail(function () {
      $("#str_empleado").html('<option value="">No se pudo cargar</option>');
    });
  }

  // Exponer funciones útiles
  window.Corresponsal = {
    init: init,
    listar: listarCorresponsales,
    cargarEmpleados: cargarEmpleados,
    verFormulario: function () {
      cargarEmpleados();
      $('#verFormulario').removeClass('hide');
      $('#verLista').addClass('hide');
      $('#verDetalle').addClass('hide');
      $('#btnNuevoCorresponsal').addClass('hide');
    },
    verListado: function () {
      $('#verFormulario').addClass('hide');
      $('#verLista').removeClass('hide');
      $('#verDetalle').addClass('hide');
      $('#btnNuevoCorresponsal').removeClass('hide');
    },

  };

  $(document).ready(init);
  function saveOrUpdate() {
    var form = $("#formCorresponsal")[0];
    var formData = new FormData(form);
    $.ajax({
      url: "./ajax/MiAhorroAjax.php?op=SaveOrUpdate",
      type: "POST",
      data: formData,
      contentType: false,
      processData: false,
      success: function (resp) {
        var msg = resp;
        var isError = false;
        try {
          var data = typeof resp === 'string' ? JSON.parse(resp) : resp;
          if (data && data.status) {
            isError = data.status !== 'success';
            msg = data.mensaje || data.msg || resp;
          }
        } catch (e) {
          isError = typeof resp === 'string' && resp.indexOf('ERROR:') !== -1;
        }

        if (isError) {
          Swal.fire({ icon: 'error', title: 'Error', text: msg || 'No se pudo guardar.' });
          return;
        }

        Swal.fire({ icon: 'success', title: 'Correcto', text: msg || 'Guardado correctamente.' });
        $("#formCorresponsal")[0].reset();
        $("#idahorro").val('');
        Corresponsal.verListado();
        listarCorresponsales();
      },
      error: function (e) {
        console.error('Error AJAX corresponsal', e.responseText || e);
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo guardar el corresponsal.' });
      }
    });
  }
})(jQuery);
