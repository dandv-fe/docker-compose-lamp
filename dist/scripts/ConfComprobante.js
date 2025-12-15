
jQuery(document).ready(init)
var bandera = 1;
const elementos = new Array();

const consultar = function () {
  return JSON.stringify(elementos);
};
const eliminar = function (pos) {
  pos > -1 && elementos.splice(parseInt(pos), 1);

};
function init() {
  $("#tblDetalleDocList").DataTable({
    "responsive": true, "lengthChange": false, "autoWidth": false,
    "buttons": ["copy", "csv", "excel", "pdf", "print"]
  }).buttons().container().appendTo('#tblDetalleDocList_wrapper .col-md-6:eq(0)');
  var Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2000
  });
  ComboTipoDoc();
  OcultarForm()

  $("#btnAgregar").click(AgregarDetalleDocumentoSucursal);
  $("form#frmDocSuc").submit(GuardarDocSucursal);

  function AgregarDetalleDocumentoSucursal() {
    var idtipo_doc = $("#cboTipoDocumento").val(),
      tipo_doc = $("#cboTipoDocumento option:selected").html(),
      serie = $("#txtSerie").val(),
      numero = $("#txtNumero").val();


    if (idtipo_doc != "" && serie != "" && numero != "") {
      AgregarDetalleDocSuc(idtipo_doc, tipo_doc, serie, numero);
    }
    //  ConsultarDetallesDocSuc();
    $("#txtSerie").val("");
    $("#txtNumero").val("");
  }
  function GuardarDocSucursal(e) {
    e.preventDefault();

    var detalle = JSON.parse(consultar());

    var data = [];

    if (bandera == 1) {
      data = {
        idDocSucursal: $("#txtRefDocSucursalHidden").val(),
        idTipoDocm: $("#cboTipoDocumento").val(),
        detalle: detalle
      };
    } else {
      data = {
        idDocSucursal: $("#txtRefDocSucursalHidden").val(),
        idTipoDoc: $("#cboTipoDocumento").val(),
        serie: $("#txtSerie").val(),
        numero: $("#txtNumero").val()
      };
    }
    $.post("./ajax/DocSucursalAjax.php?op=Save", data, function (r) {

      if (r.indexOf("ERROR:") !== -1) {
        Toast.fire({
          icon: 'error',
          title: r
        })
      } else {
        Toast.fire({
          icon: 'success',
          title: r
        })
        $("table#tblDetalleDoc tbody").html("");
        OcultarForm();
      }

    });

  }

  function ComboTipoDoc() {

    $.get("./ajax/DocSucursalAjax.php?op=listTipoDoc", { tipo: 'Comprobante' }, function (r) {
      $("#cboTipoDocumento").html(r);

    })
  }

  function AgregarDetalleDocSuc(idtipo_doc, tipo_doc, serie, numero) {

    var detalles = new Array(idtipo_doc, tipo_doc, serie, numero);

    elementos.push(detalles);
    ConsultarDetallesDocSuc();
  }





}

function ListadoDocSuc() {
  var tabla = $('#tblDetalleDocList').dataTable();
  $.ajax({
    url: './ajax/DocSucursalAjax.php?op=list',
    dataType: 'json',
    success: function (s) {
      tabla.fnClearTable();
      for (var i = 0; i < s.length; i++) {
        tabla.fnAddData([
          s[i][0],
          s[i][1],
          s[i][2],
          s[i][3]
        ]);
      } // End For

    },
    error: function (e) {
      console.log(e.responseText);
    }
  });



}


function VerForm() {
  bandera = 1;

  $("#VerFormulario").show();
  $("#btnNuevoTipoDocumento").hide();
  $("#VerListado").hide();
  $("#txtIdDocSucursal").val("");
  $("#cboTipoDocumento").val("");
  $("#txtSerie").val("");
  $("#txtNumero").val("");
  $("#btnAgregarSN").show();
  $("#tblDetalleDoc").show();

}

function OcultarForm() {
  ListadoDocSuc();
  $("#VerFormulario").hide();
  $("#btnNuevoTipoDocumento").show();
  $("#VerListado").show();
}
function eliminarDetalleDocSuc(ele) {
  eliminar(ele);
  ConsultarDetallesDocSuc();
}

function ConsultarDetallesDocSuc() {

  $("table#tblDetalleDoc tbody").html("");
  var data = JSON.parse(consultar());
  for (var pos in data) {
    $("table#tblDetalleDoc").append("<tr><td>" + data[pos][1] + "</td><td>" + data[pos][2] + "</td><td>" + data[pos][3] + "</td><td><button type='button' onclick='eliminarDetalleDocSuc(" + pos + ")' class='btn btn-danger'><i class='fa fa-remove' ></i> </button></td></tr>");
  }
  //calcularIgvPed();
  //calcularSubTotalPed();
  //calcularTotalPed();
}
function cargarDataDocSucursal(iddetalle_documento_sucursal, idtipo_documento, ultima_serie, ultimo_numero) {
  bandera = 2;
  $("#VerFormulario").show();
  $("#btnNuevoTipoDocumento").hide();
  $("#VerListado").hide();
  // $("#VerMod").show();
  $("#txtRefDocSucursalHidden").val(iddetalle_documento_sucursal);
  $("#cboTipoDocumento").val(idtipo_documento);
  $("#txtSerie").val(ultima_serie);
  $("#txtNumero").val(ultimo_numero);
  $("#btnAgregar").hide();
  $("#tblDetalleDoc").hide();
}
function eliminarDocSucursal(idDocSucursal) {
  bootbox.confirm("¿Esta Seguro de Eliminar el registro?", function (result) {
    if (result) {
      $.post("./ajax/DocSucursalAjax.php?op=delete", { idDocSucursal: idDocSucursal }, function (r) {
        var Toast = Swal.mixin({
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000
        });

        if (r.indexOf("ERROR:") !== -1) {
          Toast.fire({
            icon: 'error',
            title: r
          })
        } else {
          Toast.fire({
            icon: 'success',
            title: r
          })
          OcultarForm();
        }

      });
    }

  })
}
