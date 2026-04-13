$(function () {
  var COLUMN_COUNT = 16;

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

  function establecerPeriodoActual() {
    if (typeof moment !== 'function') {
      return;
    }

    moment.locale('es');
    var inicio = moment().startOf('month');
    var fin = moment().endOf('month');

    $('#txtMesActual').text(inicio.format('MMMM YYYY'));
    $('#txtFechaDesde').val(inicio.format('YYYY-MM-DD'));
    $('#txtFechaHasta').val(fin.format('YYYY-MM-DD'));
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

  establecerPeriodoActual();

  $('#btnRecargarRendimientos').on('click', function () {
    window.location.reload();
  });

  // Cargar datos primero
  $.ajax({
    url: "ajax/RendimientosAjax.php?op=GetCurrentMonth",
    type: "GET",
    dataType: "json",
    success: function (response) {
      var data = normalizarRespuesta(response);
      actualizarResumen(data);

      // Luego inicializar DataTable CON los datos
      var Tabla = $("#tblRendimientos").DataTable({
        "sort": false,
        "responsive": true,
        "lengthChange": false,
        "autoWidth": false,
        "buttons": ["csv", "excel", "pdf", "colvis"],
        "data": data,
        "columnDefs": [
          {
            "targets": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // Índices de las columnas numéricas
            "className": "text-right"
          }
        ]
      }).buttons().container().appendTo('#tblRendimientos_wrapper .col-md-6:eq(0)');
    },
    error: function (error) {
      console.error("Error al cargar datos:", error);
      actualizarResumen([]);

      // Inicializar DataTable vacio si hay error
      $("#tblRendimientos").DataTable({
        "sort": false,
        "responsive": true,
        "lengthChange": false,
        "autoWidth": false,
        "buttons": ["csv", "excel", "pdf", "colvis"]
      }).buttons().container().appendTo('#tblRendimientos_wrapper .col-md-6:eq(0)');
    }
  });
});

