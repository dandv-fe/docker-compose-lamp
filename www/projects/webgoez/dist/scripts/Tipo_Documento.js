
jQuery(document).ready(function() {
    $("#tblTipo_Documento").DataTable({
        "responsive": true, "lengthChange": false, "autoWidth": false,
        "buttons": ["copy", "csv", "excel", "pdf", "print"]
    }).buttons().container().appendTo('#tblTipo_Documento_wrapper .col-md-6:eq(0)');
    OcultarForm();
    ListadoTipo_Documento()
    $("form#frmTipo_Documento").submit(SaveOrUpdate);
    $("#btnNuevoTipoDocumento").click(VerForm);
    var Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
    });
    function SaveOrUpdate(e){
        e.preventDefault();

        var formData = new FormData($("#frmTipo_Documento")[0]);

        $.ajax({

            url: "./ajax/Tipo_DocumentoAjax.php?op=SaveOrUpdate",
            type: "POST",
            data: formData,
            contentType: false,
            processData: false,
            success: function(datos){
                if (datos.indexOf("ERROR:")!==-1){
                    Toast.fire({
                        icon: 'error',
                        title: datos
                    })
                }else {
                    Toast.fire({
                        icon: 'success',
                        title: datos
                    })
                    ListadoTipo_Documento();
                    OcultarForm();
                    Limpiar();
                }

            }

        });
    };
    function Limpiar(){
        // Limpiamos las cajas de texto
        $("#txtIdTipo_Documento").val("");
        $("#txtNombre").val("");
        $("#txtOperacion").val("");
    }
    function VerForm(){
        $("#VerForm").show();// Mostramos el formulario
        $("#btnNuevoTipoDocumento").hide();// ocultamos el boton nuevo
        $("#VerListado").hide();// ocultamos el listado
    }
    function OcultarForm(){
        $("#VerForm").hide();// Mostramos el formulario
        $("#btnNuevoTipoDocumento").show();// ocultamos el boton nuevo
        $("#VerListado").show();// ocultamos el listado
    }



});
function ListadoTipo_Documento(){
    var tabla = $('#tblTipo_Documento').dataTable();
    $.ajax({
        url: './ajax/Tipo_DocumentoAjax.php?op=list',
        dataType: 'json',
        success: function(s){
            tabla.fnClearTable();
            for(var i = 0; i < s.length; i++) {
                tabla.fnAddData([
                    s[i][0],
                    s[i][1],
                    s[i][2],
                    s[i][3],
                    s[i][4]
                ]);
            } // End For

        },
        error: function(e){
            console.log(e.responseText);
        }
    });
};
function eliminarTipo_Documento(id){// funcion que llamamos del archivo ajax/CategoriaAjax.php?op=delete linea 53
    var Toas = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
    });
    bootbox.confirm("¿Esta Seguro de eliminar el tipo de documento?", function(result){ // confirmamos con una pregunta si queremos eliminar
        if(result){// si el result es true
            $.post("./ajax/Tipo_DocumentoAjax.php?op=delete", {id : id}, function(e){// llamamos la url de eliminar por post. y mandamos por parametro el id
                if (e.indexOf("ERROR:")!==-1){
                    Toas.fire({
                        icon: 'error',
                        title: e
                    })
                }else {
                    Toas.fire({
                        icon: 'success',
                        title: e
                    })
                    ListadoTipo_Documento();
                }


            });
        }

    })
}
function cargarDataTipo_Documento(id, nombre,operacion){// funcion que llamamos del archivo ajax/CategoriaAjax.php linea 52
    $("#VerForm").show();// mostramos el formulario
    $("#btnNuevoTipoDocumento").hide();// ocultamos el boton nuevo
    $("#VerListado").hide();

    $("#txtIdTipo_Documento").val(id);// recibimos la variable id a la caja de texto txtIdCategoria
    $("#txtNombre").val(nombre);// recibimos la variable nombre a la caja de texto txtNombre
    $("#txtOperacion").val(operacion);
}