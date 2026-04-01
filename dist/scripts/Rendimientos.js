$(function () {
  function limpiarTextoNumero(valor) {
    return String(valor || '')
      .replace(/<[^>]*>/g, '')
      .trim();
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

    $('#resumenGastos').text(filaTotal ? limpiarTextoNumero(filaTotal[9]) : '0.00');
    $('#resumenSuma').text(filaTotal ? limpiarTextoNumero(filaTotal[13]) : '0.00');
    $('#resumenSaldo').text(filaTotal ? limpiarTextoNumero(filaTotal[14]) : '0.00');
    $('#resumenCrece').text(filaTotal ? limpiarTextoNumero(filaTotal[12]) : '0.00');
  }

  // Activar menú
  $("#li-consultaCobros").addClass('menu-open');
  $("#lia-consultaCobros").addClass('active');
  $("#lia-rendimientos").addClass('active');

  // Cargar datos primero
  $.ajax({
    url: "ajax/RendimientosAjax.php?op=GetCurrentMonth",
    type: "GET",
    dataType: "json",
    success: function (response) {
      actualizarResumen(response);

      // Luego inicializar DataTable CON los datos
      var Tabla = $("#tblRendimientos").DataTable({
        "sort": false,
        "responsive": true,
        "lengthChange": false,
        "autoWidth": false,
        "buttons": ["csv", "excel", "pdf", "colvis"],
        "data": response || [],
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

