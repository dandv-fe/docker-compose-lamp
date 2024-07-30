var Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 2000
});
jQuery(document).ready(function () {
  ListadoRecibir()
});

function verFormContabilibadAdd(refSucursal, op) {
  $("#txtOperacionContabilidad").val(op);
  $("#txtrefSucursalHidden").val(refSucursal);
  $("#modal-NuevaContabilidad").modal('show')
}

function verFormContabilibad(params, codigo, tipo) {
  $("#txtrefSucursalContabiliddHidden").val(params)
  DatosCobro(false)
  $("#VerListado").hide()
  $("#VerformContabilidad").show()
  $("#txtTituloRecibir").text(tipo + ': ' + codigo);
}

function ListadoRecibir() {
  $.post("./ajax/UsuarioAjax.php", function (r) {
    if (r === '0') {
      location.reload(true);
    }
  });
  var tabla = $('#tblRecibir').DataTable();
  $.ajax({
    url: './ajax/RecibirCuentasAjax.php?op=list',
    type: "POST",
    //data: { refEmpleado },
    dataType: "json",
    success: function (datos) {
      let base = 0
      let gastos = 0
      let diferencias = 0
      let efectivo = 0
      tabla.clear().draw();
      for (let i = 0; i < datos[0].length; i++) {
        const val = datos[0][i];
        tabla.row
          .add([
            val[0],
            val[1],
            val[2],
            val[3],
            val[4],
            val[5],
            val[6],
            val[7],
            val[8],
            val[9],
            val[10],
            val[11],
            val[12],
            val[13],
            val[14],
            val[15],
            val[16],
            val[17],
            val[18]
          ]).draw(false);
        base += parseFloat(val[5]);
        gastos += parseFloat(val[10]);
        diferencias += parseFloat(val[9]);
        efectivo += parseFloat(val[6]) + parseFloat(val[7]);
      }
      $("#txtBaseCuentasRecibir").text(base.toFixed(2));
      $("#txtGastosCuentasRecibir").text(gastos.toFixed(2));
      $("#txtDiferenciasCuentasRecibir").text(diferencias.toFixed(2));
      $("#txtEfectivoCuentasRecibir").text(efectivo.toFixed(2));
    },
    error: function (e) {
      console.log(e.responseText);
    }
  });
};