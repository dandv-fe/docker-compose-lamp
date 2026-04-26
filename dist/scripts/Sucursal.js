
jQuery(document).ready(function () {

  OcultarForm();
  ListadoSucursal()
  ComboEmpleado()
  ComboOficina()
  $("form#frmSucursal").submit(SaveOrUpdate);
  $("#btnNuevoSucursal").click(checkAndShowForm);
  var Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2000
  });
  function SaveOrUpdate(e) {
    e.preventDefault();
    $.post("./ajax/UsuarioAjax.php", function (r) {
      if (r === '0') {
        location.reload(true);
      }
    });
    var formData = new FormData($("#frmSucursal")[0]);

    $.ajax({

      url: "./ajax/SucursalAjax.php?op=SaveOrUpdate",
      type: "POST",
      data: formData,
      contentType: false,
      processData: false,
      success: function (datos) {
        if (datos.indexOf("ERROR:") != -1) {
          Toast.fire({
            icon: 'error',
            title: datos
          })
        } else {
          Toast.fire({
            icon: 'success',
            title: datos
          })
          ListadoSucursal();
          OcultarForm();
          Limpiar();
        }

      }

    });
  };
  function Limpiar() {
    // Limpiamos las cajas de texto
    $("#frmSucursal").trigger('reset')
    $("#frmSucursal input:hidden").val('')
  }

  function ListadoSucursal() {
    $.post("./ajax/UsuarioAjax.php", function (r) {
      if (r === '0') {
        location.reload(true);
      }
    });
    var tabla = $('#tblSucursal').DataTable();
    $.ajax({
      url: './ajax/SucursalAjax.php?op=list',
      dataType: 'json',
      success: function (s) {
        tabla.clear().draw();
        for (var i = 0; i < s.length; i++) {
          const val = s[i];
          tabla.row.add([
            i + 1,
            val[0], // Codigo
            val[2], // Oficina
            val[1],
            '<button class="btn btn-warning" data-toggle="tooltip" title="Editar" onclick="cargarDataSucursal(\'' + val[3] + '\')"><i class="fa fa-pencil"></i> </button>&nbsp;'
          ]).draw(false);
        } // End For


      },
      error: function (e) {
        console.log(e.responseText);
      }
    });
  };


  function ComboEmpleado() {

    $.get("./ajax/EmpleadoAjax.php?op=listEmpleados", function (r) {
      $("#cboRepresentante").html(r);

    })
  }

  function ComboOficina(callback) {
    $.getJSON("./ajax/OficinaAjax.php?op=list", function (resp) {
      if (!resp || !resp.ok) {
        if (typeof callback === 'function') callback(false);
        return;
      }
      var html = '';
      for (var i = 0; i < resp.data.length; i++) {
        var it = resp.data[i];
        html += '<option value="' + it.id + '">' + it.str_nombre + '</option>';
      }
      $("#cboOficina").html(html);
      if (typeof callback === 'function') callback(resp.data.length > 0);
    }).fail(function () {
      if (typeof callback === 'function') callback(false);
    });
  }

  function checkAndShowForm() {
    ComboOficina(function (has) {
      if (!has) {
        Swal.fire({
          icon: 'warning',
          title: 'No hay oficinas',
          text: 'Debe crear una oficina antes de registrar una sucursal. Será redirigido a la página de oficinas.'
        }).then(function () {
          window.location.href = 'oficinas.php';
        });
        return;
      }
      VerForm();
    });
  }
});

function VerForm() {
  $("#VerConfiguracion").hide();
  $("#VerForm").show();// Mostramos el formulario
  $("#btnNuevoSucursal").hide();// ocultamos el boton nuevo
  $("#VerListado").hide();// ocultamos el listado
}
function OcultarForm() {
  $("#VerConfiguracion").hide();
  $("#VerForm").hide();// Mostramos el formulario
  $("#btnNuevoSucursal").show();// ocultamos el boton nuevo
  $("#VerListado").show();// ocultamos el listado
}
function verconfiguracion() {
  $("#VerForm").hide();// Mostramos el formulario
  $("#btnNuevoSucursal").hide();// ocultamos el boton nuevo
  $("#VerListado").hide();// ocultamos el listado
  $("#VerConfiguracion").show();
}

function cargarDataSucursal(id) {// funcion que llamamos del archivo ajax/CategoriaAjax.php linea 52

  $.post("./ajax/UsuarioAjax.php", function (r) {
    if (r === '0') {
      location.reload(true);
    }
  });
  $.getJSON("./ajax/SucursalAjax.php?op=buscarSucursal", { id },
    function (data, textStatus) {


      if (textStatus === 'success') {

        if (data) {
          $("#txtIdSucursal").val(data.ref);// recibimos la variable id a la caja de texto txtIdCategoria
          $("#txtRazon_Social").val(data.codigo);
          $("#txtTelefono").val(data.tel);
          $("#cboRepresentante").val(data.refEmpleado);
          $("#cboOficina").val(data.refOficina);
          $("#txtEstado").val(data.estado);
          $("#txtTipo").val(data.tipo);
          $("#cboAdicional").val(data.adicional)

          $("#VerForm").show();// mostramos el formulario
          $("#btnNuevoSucursal").hide();// ocultamos el boton nuevo
          $("#VerListado").hide();// ocultamos el listado
        } else {
          Toast.fire({
            icon: 'error',
            title: 'Error incompleto'
          })
          location.reload(true);

        }
      } else {
        Toast.fire({
          icon: 'error',
          title: 'Error Inesperado'
        })
      }

    }
  );



  /**/
}

function cambiarConfiguracion(fef) {
  console.log(fef);
  verconfiguracion()
}