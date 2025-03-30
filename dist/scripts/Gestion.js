jQuery(document).ready(function () {

    OcultarGestion();
    ListadoGlobal()
   
    var Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
    });


   
    $("#formGestionPago").submit(function (e) { 
        e.preventDefault();


        var formData = new FormData($("#formGestionPago")[0]);
        $.post("./ajax/UsuarioAjax.php", function (r) {
            if (r === '0') {
                location.reload(true);
            }
        });

        $.ajax({

            url: "./ajax/EmpresaAjax.php?op=SaveOrUpdateGestion",
            type: "POST",
            data: formData,
            contentType: false,
            processData: false,
            success: function (datos) {

                if (datos.indexOf("ERROR:") !== -1) {
                    Toast.fire({
                        icon: 'error',
                        title: datos
                    })
                } else {
                    Toast.fire({
                        icon: 'success',
                        title: datos
                    })
                    $("#modal-sm").modal('hide');
                }
                ListadoGlobal()
            }

        });
    });





    function ListadoGlobal() {


        var tabla = $('#tblEmpresa').DataTable();
        $.ajax({
            url: './ajax/EmpresaAjax.php?op=listGestion',
            dataType: 'json',
            success: function (s) {
                tabla.clear().draw();
                for (var i = 0; i < s.length; i++) {
                    var result='';
                    if (s[i][2]) {
                       
                        

                        var hasta = moment(s[i][2]);
                        var desde = moment();
                        var fechas = diasEntreFechas(desde.add(1, 'days'), hasta);
                         result=fechas.length
                     





                    } 
                    tabla.row.add([
                        s[i][0],
                        s[i][1],
                        s[i][2],
                        s[i][3]?result+' + extras '+ s[i][3]:'',
                        s[i][4]
                    ]).draw(false);
                } // End For
                OcultarGestion()

            },
            error: function (e) {
                console.log(e.responseText);
            }
        });

    };

    $("#h1-btn-gestion").on('click',ListadoGlobal)
    $("#cuerpo-table-empresas").on('click', 'tr td:nth-child(2)', veForGestionPago);
    $("#cuerpo-table-empresas").on('click', 'tr td:nth-child(3)', veForGestionPago);
    $("#cuerpo-table-empresas").on('click', 'tr td:nth-child(4)', veForGestionPago);
    


});
function formGestionPago(params) {
    $("#hrefGlobal").val(params);
    $("#txtValor").val("")
    $("#txtFechaDesde").val("")
    $("#modal-sm").modal('show');
}
function veForGestionPago(e) {
    
}
function Limpiar() {
    // Limpiamos las cajas de texto
    $("form#frmEmpresa").trigger('reset');
    $("form#frmEmpresa input:hidden").val('');
}
function VerGestion() {
    $("#VerGestion").show();// Mostramos el formulario
    $("#VerListado").hide();// ocultamos el listado
}
function OcultarGestion() {
    $("#VerGestion").hide();// Mostramos el formulario
    $("#VerListado").show();// ocultamos el listado
}





function gestionarEmpresa(tipo_documento, num_documento, accion) {
    $.post("./ajax/UsuarioAjax.php", function (r) {
        if (r === '0') {
            location.reload(true);
        }
    });

    VerGestion()
    return
    $.getJSON("./ajax/EmpresaAjax.php?op=buscarClienteEmpresa", { tipo_documento, num_documento },
        function (data, textStatus) {

            if (textStatus === 'success') {
                if (data === 0) {
                    Toast.fire({
                        icon: 'error',
                        title: 'Error incompleto'
                    })
                    location.reload(true);
                } else if (data === null) {
                    $("#modal-xl").modal('hide');
                    nuevo()
                    verFormCliente()
                } else {
                    $("#modal-xl").modal('hide');
                    Swal.fire({
                        title: "¡Ya Existe!",
                        icon: "info",
                        text: "Si estas de acuerdo hacer click. Si, editar ahora!: De lo contrario Cancelar ",
                        showCancelButton: true,
                        confirmButtonColor: "#3085d6",
                        cancelButtonColor: "#d33",
                        confirmButtonText: "Si, editar ahora!",
                        
                    }).then((result) => {
                        if (result.isConfirmed) {
                            editar(data)
                            verFormCliente()
                        }
                    });
                }

            } else {
                Toast.fire({
                    icon: 'error',
                    title: 'Error Inesperado'
                })
            }

        }
    );
   

}


function cargarDataGlobal(id, empresa, nombre_impuesto, porcentaje_impuesto, simbolo_moneda, logo) {// funcion que llamamos del archivo ajax/CategoriaAjax.php linea 52
    $("#VerForm").show();// mostramos el formulario
    $("#btnNuevo").hide();// ocultamos el boton nuevo
    $("#VerListado").hide();// ocultamos el listado
    $("#txtIdGlobal").val(id);// recibimos la variable id a la caja de texto txtIdCategoria
    $("#txtEmpresa").val(empresa);
    $("#txtNombre_Impuesto").val(nombre_impuesto);
    $("#txtPorcentaje_Impuesto").val(porcentaje_impuesto);
    $("#txtSimbolo_Moneda").val(simbolo_moneda);
}

var diasEntreFechas = function (desde, hasta) {
    var dia_actual = desde;
    var fechas = [];
    while (dia_actual.isSameOrBefore(hasta)) {
        fechas.push(dia_actual.format('YYYY-MM-DD'));
        dia_actual.add(1, 'days');
    }
    return fechas;
};