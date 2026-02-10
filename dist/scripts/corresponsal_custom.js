
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
      url: './ajax/Corres_Ajax.php?op=listCorresponsales',
      type: "POST",
      data: {},
      dataType: "json",
      success: function (datos) {
        console.log(datos);

        tabla.clear().draw();
        for (let i = 0; i < datos.length; i++) {
          const val = datos[i];
          tabla.row
            .add([
              capitalizarPalabras(val['str_name']),
              val['id_cuenta'],
              'saldo disponible',
              val['str_estado'],
              '',
              'botones'
            ]).draw(false);
        }
      },
      error: function (e) {
        console.log(e.responseText);
      }
    });
  }


  function cargarEmpleados() {
    $.get("./ajax/Corres_Ajax.php?op=listEmpleados", function (html) {
      $("#str_empleado").html(html);
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
      $('#btnNuevoCorresponsal').addClass('hide');
    },
    verListado: function () {
      $('#verFormulario').addClass('hide');
      $('#verLista').removeClass('hide');
      $('#btnNuevoCorresponsal').removeClass('hide');
    },

  };

  $(document).ready(init);
  function saveOrUpdate() {
    var form = $("#formCorresponsal")[0];
    var formData = new FormData(form);
    $.ajax({
      url: "./ajax/Corres_Ajax.php?op=SaveOrUpdate",
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
        //listarCorresponsales();
      },
      error: function (e) {
        console.error('Error AJAX corresponsal', e.responseText || e);
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo guardar el corresponsal.' });
      }
    });
  }
})(jQuery);
