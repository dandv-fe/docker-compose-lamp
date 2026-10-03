jQuery(document).ready(function () {
    var tabla = $("#tblBancoPago").DataTable({
        "responsive": true,
        "lengthChange": false,
        "autoWidth": false,
        "buttons": ["copy", "csv", "excel", "pdf", "print"]
    });
    tabla.buttons().container().appendTo('#tblBancoPago_wrapper .col-md-6:eq(0)');

    OcultarFormBancoPago();
    CargarOficinasBancoPago();
    ListadoBancoPago();
    $("#btnGuardarSucursalesBanco").click(guardarSucursalesBancoPago);
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
    $("#txtTitularBanco").val("");
    $("#txtDocumentoTitular").val("");
    $("#cboOficinaBanco").prop('selectedIndex', 0);
}

function CargarOficinasBancoPago() {
    $.ajax({
        url: './ajax/BancoAjax.php?op=oficinas',
        dataType: 'json',
        success: function (oficinas) {
            var select = $("#cboOficinaBanco");
            select.empty();
            oficinas.forEach(function (o) {
                select.append($('<option>').val(o.id).text(o.nombre));
            });
        }
    });
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
                tabla.fnAddData(s[i]);
            }
        },
        error: function (e) {
            console.log(e.responseText);
        }
    });
}

function cargarDataBancoPago(datos) {
    VerFormBancoPago();
    $("#txtIdBanco").val(datos.id);
    $("#txtNombreBanco").val(datos.nombre);
    $("#txtTipoBanco").val(datos.tipo);
    $("#txtNumeroCuenta").val(datos.numero);
    $("#txtTitularBanco").val(datos.titular);
    $("#txtDocumentoTitular").val(datos.documento);
    $("#txtOrdenBanco").val(datos.orden);
    $("#cboOficinaBanco").val(String(datos.oficina));
}

function verSucursalesBancoPago(id, etiqueta) {
    $("#txtIdBancoSucursales").val(id);
    $("#lblBancoSucursales").text(etiqueta);
    var lista = $("#listaSucursalesBanco").html('<em>Cargando…</em>');
    $.ajax({
        url: './ajax/BancoAjax.php?op=sucursales&id=' + encodeURIComponent(id),
        dataType: 'json',
        success: function (resp) {
            lista.empty();
            if (!resp.ok) {
                lista.append($('<div class="alert alert-danger">').text(resp.error || 'No autorizado'));
                return;
            }
            if (resp.data.length === 0) {
                lista.append($('<em>').text('No hay sucursales en su alcance.'));
                return;
            }
            var oficinaActual = null;
            resp.data.forEach(function (s) {
                if (s.oficina !== oficinaActual) {
                    oficinaActual = s.oficina;
                    lista.append($('<h6 class="mt-2 mb-1">').text(s.oficina || 'Sin oficina'));
                }
                var idCheck = 'chkSucBanco' + s.id;
                var fila = $('<div class="custom-control custom-checkbox">');
                fila.append($('<input type="checkbox" class="custom-control-input chkSucursalBanco">')
                    .attr('id', idCheck).val(s.id).prop('checked', s.autorizada));
                fila.append($('<label class="custom-control-label">').attr('for', idCheck)
                    .text(s.nombre + (s.estado && s.estado !== 'activo' ? ' (' + s.estado + ')' : '')));
                lista.append(fila);
            });
        }
    });
    $("#modalSucursalesBanco").modal('show');
}

function guardarSucursalesBancoPago() {
    var sucursales = $(".chkSucursalBanco:checked").map(function () { return $(this).val(); }).get();
    $.post("./ajax/BancoAjax.php?op=guardarSucursales", { id: $("#txtIdBancoSucursales").val(), sucursales: sucursales }, function (respuesta) {
        if (respuesta.indexOf("ERROR:") !== -1) {
            ToastBancoPago('error', respuesta);
        } else {
            ToastBancoPago('success', respuesta);
            $("#modalSucursalesBanco").modal('hide');
            ListadoBancoPago();
        }
    });
}

function cambiarEstadoBancoPago(id, estado) {
    var accion = estado === 'activo' ? 'activar' : 'desactivar';
    bootbox.confirm("¿Desea " + accion + " esta cuenta?", function (result) {
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
