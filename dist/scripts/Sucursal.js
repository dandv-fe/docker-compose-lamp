
jQuery(document).ready(function () {
    $("#tblSucursal").DataTable({
        "responsive": true, "lengthChange": false, "autoWidth": false,
        "buttons": ["copy", "csv", "excel", "pdf", "print"]
    }).buttons().container().appendTo('#tblSucursal_wrapper .col-md-6:eq(0)');
    OcultarForm();
    ListadoSucursal()
    ComboEmpleado()
    ComboTipo_Documento()
    $("form#frmSucursal").submit(SaveOrUpdate);
    $("#btnNuevoSucursal").click(VerForm);
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
        var tabla = $('#tblSucursal').dataTable();
        $.ajax({
            url: './ajax/SucursalAjax.php?op=list',
            dataType: 'json',
            success: function (s) {
                tabla.fnClearTable();
                for (var i = 0; i < s.length; i++) {
                    tabla.fnAddData([
                        s[i][0],
                        s[i][1],
                        s[i][2],
                        s[i][3],
                        s[i][4],
                        s[i][5],
                        s[i][6]
                    ]);
                } // End For

            },
            error: function (e) {
                console.log(e.responseText);
            }
        });
    };

    function ComboTipo_Documento() {

        $.get("./ajax/SucursalAjax.php?op=listTipoDoc", function (r) {
            $("#comboTipo_Documento").html(r);

        })
    }
    function ComboEmpleado() {

        $.get("./ajax/EmpleadoAjax.php?op=listEmpleados", function (r) {
            $("#cboRepresentante").html(r);

        })
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
                    $("#comboTipo_Documento").val(data.tDocumento);
                    $("#txtNum_Documento").val(data.nDocumento);
                    $("#txtDireccion").val(data.direccion);
                    $("#txtTelefono").val(data.tel);
                    $("#txtEmail").val(data.email);
                    $("#cboRepresentante").val(data.refEmpleado);
                    //$("#txtLogo").val(logo);
                    $("#txtRutaImgSuc").val(data.logo);
                    $("#txtRutaImgSuc").show();
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