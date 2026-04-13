
(function ($) {
  'use strict';

  var ahorroDetalleActual = 0;
  var ahorroDetallePermiteMovimientos = false;
  var movimientoEnProceso = false;
  var guardandoFormulario = false;

  function setAccionesMovimientoDisabled(disabled) {
    $('#btnRecargarMiAhorro').prop('disabled', disabled);
    $('#btnRetirarMiAhorro').prop('disabled', disabled);
  }

  function cuentaPermiteMovimientos(row) {
    return parseInt((row && row.bit_auth_movimientos) || 0, 10) === 1;
  }

  function syncAccionesMovimiento() {
    var disabled = movimientoEnProceso || !ahorroDetallePermiteMovimientos;
    setAccionesMovimientoDisabled(disabled);

    var mensaje = ahorroDetallePermiteMovimientos
      ? 'Movimientos habilitados para este ahorro.'
      : 'Este ahorro no tiene autorización para recargar o retirar.';

    $('#btnRecargarMiAhorro').attr('title', mensaje);
    $('#btnRetirarMiAhorro').attr('title', mensaje);
  }

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

  function normalizeMoneyText(value) {
    var text = String(value || '').replace(/[^\d,\.]/g, '');
    if (!text) return '';

    var hasComma = text.indexOf(',') !== -1;
    var hasDot = text.indexOf('.') !== -1;
    var decimalSep = '';

    if (hasComma && hasDot) {
      decimalSep = text.lastIndexOf(',') > text.lastIndexOf('.') ? ',' : '.';
    } else if (hasComma || hasDot) {
      var sep = hasComma ? ',' : '.';
      var sepIdx = text.lastIndexOf(sep);
      var decLen = text.length - sepIdx - 1;
      var sepCount = (text.match(new RegExp('\\' + sep, 'g')) || []).length;

      if (sepCount === 1 && decLen > 0 && decLen <= 2) {
        decimalSep = sep;
      }
    }

    if (!decimalSep) {
      return text.replace(/\D/g, '');
    }

    var decimalIdx = text.lastIndexOf(decimalSep);
    var intPart = text.slice(0, decimalIdx).replace(/\D/g, '');
    var decPart = text.slice(decimalIdx + 1).replace(/\D/g, '').slice(0, 2);
    if (!intPart && decPart) intPart = '0';
    return intPart + (decPart ? '.' + decPart : '');
  }

  function parseMoneyInput(value) {
    var normalized = normalizeMoneyText(value);
    return parseFloat(normalized) || 0;
  }

  function formatMoneyInput(value, forceTwoDecimals) {
    var raw = String(value || '');
    var normalized = normalizeMoneyText(value);
    if (!normalized) return '';

    if (forceTwoDecimals) {
      var n = parseMoneyInput(normalized);
      if (typeof window.formatearMonedaPublica === 'function') {
        return window.formatearMonedaPublica(n, 2);
      }
      return n.toLocaleString('es-CO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    var parts = normalized.split('.');
    var intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (parts.length > 1) {
      return intPart + ',' + parts[1];
    }

    return /[\.,]$/.test(raw) ? intPart + ',' : intPart;
  }

  function renderMovimientosDetalle(movimientos) {
    var $tbody = $('#tbodyMovimientosCorresponsal');
    if (!$tbody.length) return;

    if (!movimientos || !movimientos.length) {
      $tbody.html('<tr><td colspan="5" class="text-center text-muted">Sin movimientos</td></tr>');
      return;
    }
    console.log(movimientos);

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
    ahorroDetalleActual = parseInt(row.idahorro || 0, 10) || 0;
    ahorroDetallePermiteMovimientos = cuentaPermiteMovimientos(row);
    $('#det_descripcion').text(row.str_name || '-');
    $('#det_numero').text(row.id_cuenta || '-');
    $('#det_saldo').text(formatMoney(row.saldo_real));
    $('#det_estado').text(row.str_estado || '-');
    $('#det_fecha').text(formatDateTime(row.created_at));
    syncAccionesMovimiento();

    cargarMovimientosDetalle(ahorroDetalleActual);

    $('#verFormulario').addClass('hide');
    $('#verLista').addClass('hide');
    $('#btnNuevoCorresponsal').addClass('hide');
    $('#verDetalle').removeClass('hide');
  }

  function solicitarMovimiento(tipo) {
    if (movimientoEnProceso) {
      return;
    }

    if (!ahorroDetalleActual) {
      Swal.fire({ icon: 'warning', title: 'Ahorro no disponible', text: 'Seleccione un ahorro válido.' });
      return;
    }

    if (!ahorroDetallePermiteMovimientos) {
      Swal.fire({
        icon: 'warning',
        title: 'Movimientos bloqueados',
        text: 'Este ahorro no tiene autorización para recargar o retirar.'
      });
      return;
    }

    var titulo = tipo === 'retiro' ? 'Retirar saldo' : 'Recargar saldo';
    var etiqueta = tipo === 'retiro' ? 'Valor a retirar' : 'Valor a recargar';
    var placeholder = tipo === 'retiro' ? 'Ej: 50.000,00' : 'Ej: 100.000,00';

    Swal.fire({
      title: titulo,
      html: '' +
        '<input id="swal-mov-valor" type="text" inputmode="decimal" autocomplete="off" class="swal2-input" placeholder="' + placeholder + '">' +
        '<textarea id="swal-mov-descripcion" class="swal2-textarea" placeholder="Descripción del movimiento"></textarea>',
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      didOpen: function () {
        var inputValor = document.getElementById('swal-mov-valor');
        if (!inputValor) return;

        inputValor.addEventListener('input', function () {
          var formatted = formatMoneyInput(inputValor.value, false);
          if (inputValor.value !== formatted) {
            inputValor.value = formatted;
          }
        });
      },
      preConfirm: function () {
        var valor = parseMoneyInput(document.getElementById('swal-mov-valor').value || 0);
        var descripcion = (document.getElementById('swal-mov-descripcion').value || '').trim();

        if (!valor || valor <= 0) {
          Swal.showValidationMessage(etiqueta + ' es obligatorio.');
          return false;
        }

        if (!descripcion) {
          Swal.showValidationMessage('La descripción es obligatoria.');
          return false;
        }

        return { valor: valor, descripcion: descripcion };
      }
    }).then(function (result) {
      if (!result.isConfirmed || !result.value) return;
      registrarMovimiento(tipo, result.value.valor, result.value.descripcion);
    });
  }

  function registrarMovimiento(tipo, valor, descripcion) {
    if (movimientoEnProceso) {
      return;
    }

    movimientoEnProceso = true;
    syncAccionesMovimiento();

    $.ajax({
      url: './ajax/MiAhorroAjax.php?op=registrarMovimiento',
      type: 'POST',
      dataType: 'json',
      data: {
        idahorro: ahorroDetalleActual,
        tipo: tipo,
        valor: valor,
        descripcion: descripcion
      },
      success: function (resp) {
        if (!resp || resp.status !== 'success') {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: (resp && (resp.mensaje || resp.msg)) || 'No se pudo registrar el movimiento.'
          });
          return;
        }

        Swal.fire({ icon: 'success', title: 'Correcto', text: resp.mensaje || 'Movimiento registrado.' });
        listarCorresponsales();
        cargarMovimientosDetalle(ahorroDetalleActual);
        $.getJSON('./ajax/MiAhorroAjax.php?op=listMisAhorros')
          .done(function (datos) {
            if (!Array.isArray(datos)) return;
            var row = datos.find(function (item) {
              return parseInt(item.idahorro || 0, 10) === ahorroDetalleActual;
            });
            if (row) {
              ahorroDetallePermiteMovimientos = cuentaPermiteMovimientos(row);
              $('#det_saldo').text(formatMoney(row.saldo_real));
              $('#det_estado').text(row.str_estado || '-');
              $('#det_fecha').text(formatDateTime(row.created_at));
              syncAccionesMovimiento();
            }
          });
      },
      error: function (e) {
        console.error('Error AJAX movimiento mi ahorro', e.responseText || e);
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo registrar el movimiento.' });
      },
      complete: function () {
        movimientoEnProceso = false;
        syncAccionesMovimiento();
      }
    });
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
    $('#btnRecargarMiAhorro').click(function () {
      solicitarMovimiento('aporte');
    });
    $('#btnRetirarMiAhorro').click(function () {
      solicitarMovimiento('retiro');
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
        //console.log(datos);

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
          $('#str_name').val(row.str_name || '');

          Corresponsal.verFormulario();
        });
      },
      error: function (e) {
        console.log(e.responseText);
      }
    });
  }
  // Exponer funciones útiles
  window.Corresponsal = {
    init: init,
    listar: listarCorresponsales,
    verFormulario: function () {
      $('#verFormulario').removeClass('hide');
      $('#verLista').addClass('hide');
      $('#verDetalle').addClass('hide');
      $('#btnNuevoCorresponsal').addClass('hide');
    },
    verListado: function () {
      ahorroDetalleActual = 0;
      $('#verFormulario').addClass('hide');
      $('#verLista').removeClass('hide');
      $('#verDetalle').addClass('hide');
      $('#btnNuevoCorresponsal').removeClass('hide');
    },

  };

  $(document).ready(init);
  function saveOrUpdate() {
    if (guardandoFormulario) {
      return;
    }

    var form = $("#formCorresponsal")[0];
    var formData = new FormData(form);
    var $btnSubmit = $("#formCorresponsal button[type='submit']");
    var textoOriginalBtn = $btnSubmit.html();

    guardandoFormulario = true;
    $("#formCorresponsal").attr('data-submit-locked', 'true');
    $btnSubmit.prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Guardando...');

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
      },
      complete: function () {
        guardandoFormulario = false;
        $("#formCorresponsal").removeAttr('data-submit-locked');
        $btnSubmit.prop('disabled', false).html(textoOriginalBtn);
      }
    });
  }
})(jQuery);
