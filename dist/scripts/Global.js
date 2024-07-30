
jQuery(document).ready(function() {
    ListadoGlobal();
    $("#tblGlobal").DataTable({
        "responsive": true, "lengthChange": false, "autoWidth": false,
        "buttons": ["copy", "csv", "excel", "pdf", "print"]
    }).buttons().container().appendTo('#tblGlobal_wrapper .col-md-6:eq(0)');
    $("form#frmGlobal").submit(SaveOrUpdate);
    $("#btnNuevo").click(VerForm);
    var Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
    });
    function SaveOrUpdate(e){
        e.preventDefault();

        var formData = new FormData($("#frmGlobal")[0]);

        $.ajax({

            url: "./ajax/GlobalAjax.php?op=SaveOrUpdate",
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
                    ListadoGlobal();
                    OcultarForm();
                    Limpiar();
                }

            }

        });
    };
   
   
    function ListadoGlobal(){

        $.getJSON("./ajax/GlobalAjax.php?op=list",
            function (data, textStatus) {
                console.log(data);
                if (textStatus==='success') {
                    
                    $("#txtIdGlobal").val(data.codigo);// recibimos la variable id a la caja de texto txtIdCategoria
                    $("#txtEmpresa").val(data.empresa);
                    $("#txtNombre_Impuesto").val(data.name_impuesto);
                    $("#txtPorcentaje_Impuesto").val(data.porcentaje_impuesto);

                    $("#txtRutaImgLogo").val(data.logo);

                } else {
                   
                }
            }
        );
      

    };


});

function cargarDataGlobal(){// funcion que llamamos del archivo ajax/CategoriaAjax.php linea 52
   /* $("#VerForm").show();// mostramos el formulario
    $("#btnNuevo").hide();// ocultamos el boton nuevo
    $("#VerListado").hide();// ocultamos el listado
    $("#txtIdGlobal").val(id);// recibimos la variable id a la caja de texto txtIdCategoria
    $("#txtEmpresa").val(empresa);
    $("#txtNombre_Impuesto").val(nombre_impuesto);
    $("#txtPorcentaje_Impuesto").val(porcentaje_impuesto);
    $("#txtSimbolo_Moneda").val(simbolo_moneda);*/
}