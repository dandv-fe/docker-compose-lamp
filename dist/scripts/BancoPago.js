jQuery(document).ready(function () {
    var tabla = $("#tblBancoPago").DataTable({
        "responsive": true,
        "lengthChange": false,
        "autoWidth": false,
        "buttons": ["copy", "csv", "excel", "pdf", "print"]
    });
    tabla.buttons().container().appendTo('#tblBancoPago_wrapper .col-md-6:eq(0)');

    OcultarFormBancoPago();
    ListadoBancoPago();
    $("form#frmBancoPago").submit(SaveOrUpdateBancoPago);
    $("#btnNuevoBancoPago").click(VerFormBancoPago);
    $("#btnCancelarBancoPago").click(function () {
        LimpiarBancoPago();
        OcultarFormBancoPago();
    });
});

function ToastBancoPago(icon, title) {
    Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2500 }).fire({ icon: icon, title: title });
}

function SaveOrUpdateBancoPago(e) {
    e.preventDefault();
    var formData = new FormData($("#frmBancoPago")[0]);
    $.ajax({
        url: "./ajax/BancoAjax.php?op=SaveOrUpdate",
        type: "POST",
        data: formData,
        contentType: false,
        processData: false,
        success: function (datos) {
            if (datos.indexOf("ERROR:") !== -1) {
                ToastBancoPago('error', datos);
            } else {
                ToastBancoPago('success', datos);
                ListadoBancoPago();
                OcultarFormBancoPago();
                LimpiarBancoPago();
            }
        }
    });
}

function LimpiarBancoPago() {
    $("#txtIdBanco").val("");
    $("#txtNombreBanco").val("");
    $("#txtTipoBanco").val("");
    $("#txtNumeroCuenta").val("");
    $("#txtOrdenBanco").val("0");
}

function VerFormBancoPago() {
    $("#VerFormBancoPago").show();
    $("#btnNuevoBancoPago").hide();
    $("#VerListadoBancoPago").hide();
}

function OcultarFormBancoPago() {
    $("#VerFormBancoPago").hide();
    $("#btnNuevoBancoPago").show();
    $("#VerListadoBancoPago").show();
}

function ListadoBancoPago() {
    var tabla = $('#tblBancoPago').dataTable();
    $.ajax({
        url: './ajax/BancoAjax.php?op=list',
        dataType: 'json',
        success: function (s) {
            tabla.fnClearTable();
            for (var i = 0; i < s.length; i++) {
                tabla.fnAddData([s[i][0], s[i][1], s[i][2], s[i][3], s[i][4], s[i][5], s[i][6]]);
            }
        },
        error: function (e) {
            console.log(e.responseText);
        }
    });
}

function cargarDataBancoPago(id, nombre, tipo, numero, orden) {
    VerFormBancoPago();
    $("#txtIdBanco").val(id);
    $("#txtNombreBanco").val(nombre);
    $("#txtTipoBanco").val(tipo);
    $("#txtNumeroCuenta").val(numero);
    $("#txtOrdenBanco").val(orden);
}

function cambiarEstadoBancoPago(id, estado) {
    var accion = estado === 'activo' ? 'activar' : 'desactivar';
    bootbox.confirm("¿Desea " + accion + " este método de pago?", function (result) {
        if (!result) return;
        $.post("./ajax/BancoAjax.php?op=cambiarEstado", { id: id, estado: estado }, function (respuesta) {
            if (respuesta.indexOf("ERROR:") !== -1) {
                ToastBancoPago('error', respuesta);
            } else {
                ToastBancoPago('success', respuesta);
                ListadoBancoPago();
            }
        });
    });
}
