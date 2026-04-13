$(function () {
  var COLUMN_COUNT = 16;
  var tabla = null;

  function limpiarTextoNumero(valor) {
    return String(valor || '')
      .replace(/<[^>]*>/g, '')
      .trim();
  }

  function formatearNumeroSeguro(valor) {
    var limpio = limpiarTextoNumero(valor).replace(/,/g, '');
    var n = parseFloat(limpio);

    if (!isFinite(n)) {
      n = 0;
    }

    return n.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function normalizarFila(fila) {
    var source = Array.isArray(fila) ? fila : [];
    var normalized = [];
    var firstCell = String(source[0] || '-');
    var isTotal = /<b>/i.test(firstCell) || limpiarTextoNumero(firstCell).toUpperCase() === 'TOTAL';

    normalized[0] = firstCell || '-';

    for (var i = 1; i < COLUMN_COUNT; i++) {
      var value = formatearNumeroSeguro(source[i]);
      normalized[i] = isTotal ? ('<b>' + value + '</b>') : value;
    }

    return normalized;
  }

  function normalizarRespuesta(response) {
    var filas = Array.isArray(response) ? response : [];
    return filas.map(normalizarFila);
  }

  function establecerPeriodoUI(periodo) {
    if (typeof moment !== 'function') {
      return;
    }

    moment.locale('es');
    var inicio = moment((periodo || '') + '-01', 'YYYY-MM-DD', true);
    if (!inicio.isValid()) {
      inicio = moment().startOf('month');
    }
    var fin = moment().endOf('month');
    if (inicio.isValid()) {
      fin = inicio.clone().endOf('month');
    }

    $('#txtMesActual').text(inicio.format('MMMM YYYY'));
    $('#txtFechaDesde').val(inicio.format('YYYY-MM-DD'));
    $('#txtFechaHasta').val(fin.format('YYYY-MM-DD'));
  }

  function obtenerPeriodoSeleccionado() {
    var periodo = String($('#txtPeriodoMes').val() || '').trim();
    if (/^\d{4}-\d{2}$/.test(periodo)) {
      return periodo;
    }

    return moment().format('YYYY-MM');
  }

  function renderTabla(data) {
    if ($.fn.DataTable.isDataTable('#tblRendimientos')) {
      $('#tblRendimientos').DataTable().clear().destroy();
      $('#tblRendimientos tbody').empty();
    }

    tabla = $("#tblRendimientos").DataTable({
      "sort": false,
      "responsive": true,
      "lengthChange": false,
      "autoWidth": false,
      "buttons": ["csv", "excel", "pdf", "colvis"],
      "data": data || [],
      "columnDefs": [
        {
          "targets": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
          "className": "text-right"
        }
      ]
    });

    tabla.buttons().container().appendTo('#tblRendimientos_wrapper .col-md-6:eq(0)');
  }

  function cargarRendimientos(periodo) {
    establecerPeriodoUI(periodo);

    $.ajax({
      url: "ajax/RendimientosAjax.php",
      type: "GET",
      dataType: "json",
      data: {
        op: "GetCurrentMonth",
        periodo: periodo
      },
      success: function (response) {
        var data = normalizarRespuesta(response);
        actualizarResumen(data);
        renderTabla(data);
      },
      error: function (error) {
        console.error("Error al cargar datos:", error);
        actualizarResumen([]);
        renderTabla([]);
      }
    });
  }

  function actualizarResumen(response) {
    var filas = Array.isArray(response) ? response : [];
    var filaTotal = null;

    for (var i = 0; i < filas.length; i++) {
      if (limpiarTextoNumero(filas[i][0]).toUpperCase() === 'TOTAL') {
        filaTotal = filas[i];
        break;
      }
    }

    if (!filaTotal && filas.length > 0) {
      filaTotal = filas[filas.length - 1];
    }

    $('#resumenGastos').text(filaTotal ? formatearNumeroSeguro(filaTotal[9]) : '0.00');
    $('#resumenSuma').text(filaTotal ? formatearNumeroSeguro(filaTotal[13]) : '0.00');
    $('#resumenSaldo').text(filaTotal ? formatearNumeroSeguro(filaTotal[14]) : '0.00');
    $('#resumenCrece').text(filaTotal ? formatearNumeroSeguro(filaTotal[12]) : '0.00');
  }

  // Activar menú
  $("#li-consultaCobros").addClass('menu-open');
  $("#lia-consultaCobros").addClass('active');
  $("#lia-rendimientos").addClass('active');

  var periodoInicial = moment().format('YYYY-MM');
  $('#txtPeriodoMes').val(periodoInicial);
  establecerPeriodoUI(periodoInicial);

  $('#btnRecargarRendimientos').on('click', function () {
    cargarRendimientos(obtenerPeriodoSeleccionado());
  });

  cargarRendimientos(periodoInicial);
});

