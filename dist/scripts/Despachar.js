
var Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2000
});
jQuery(document).ready(function () {
    ListadoDespachar()
    $("form#formPersonalDespachar").submit(function (e) {
        e.preventDefault();
        $.post("./ajax/UsuarioAjax.php", function (r) {
            if (r === '0') {
                location.reload(true);
            }
        });
        const refEmpleados = document.querySelectorAll("#bootstrap-duallistbox-selected-list_cboEmpleadosDespachar > option")
        const emplsData = []
        refEmpleados.forEach(option => {
            emplsData.push($(option).val())
        })
        const data = {
            refSucursal: $("#txtRefsucursalDespacharHidden").val(),
            refDetalleRuta: $("#txtRefDetalleRutaDespacharHidden").val(),
            empls: emplsData
        }
        $.post("./ajax/DespacharAjax.php?op=SaveOrUpdate", data, function (e) {
            if (e.indexOf("ERROR:") != -1) {
                Toast.fire({
                    icon: 'error',
                    title: e
                })
            } else {
                Toast.fire({
                    icon: 'success',
                    title: e
                })
                $("#modal-personalDespachar").modal('hide')
                ListadoDespachar()
            }
        })
    });
});

function ListadoDespachar() {
    $.post("./ajax/UsuarioAjax.php", function (r) {
        if (r === '0') {
            location.reload(true);
        }
    });
    var tabla = $('#tblDespachar').DataTable();
    $.ajax({
        url: './ajax/DespacharAjax.php?op=list',
        type: "POST",
        //data: { refEmpleado },
        dataType: "json",
        success: function (datos) {
            tabla.clear().draw();
            for (let i = 0; i < datos.length; i++) {
                const val = datos[i];
                tabla.row
                    .add([
                        val[0],
                        val[1],
                        val[2]
                    ]).draw(false);
            }
        },
        error: function (e) {
            console.log(e.responseText);
        }
    });
};

function manejarCambioCheckDespachar(param, refEmpleado, refDetalleRuta) {
    $('.duallistbox').bootstrapDualListbox('refresh', true);
    $.get("./ajax/DespacharAjax.php?op=listEmpleados", { refEmpleado, refDetalleRuta }, function (r) {
        $("#txtRefsucursalDespacharHidden").val(param);
        $("#txtRefDetalleRutaDespacharHidden").val(refDetalleRuta);
        $("#cboEmpleadosDespachar").html(r);
        $('.duallistbox').bootstrapDualListbox('refresh');
    })
    $("#modal-personalDespachar").modal('show')
}
