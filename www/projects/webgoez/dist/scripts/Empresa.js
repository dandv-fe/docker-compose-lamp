
jQuery(document).ready(function () {

    OcultarForm();
    ListadoGlobal()
    $("form#frmEmpresa").submit(SaveOrUpdate);
    $("form#formBuscarPersona").submit(SearchPersonaClienteEmpresa);
    // $("#btnNuevo").click(VerForm);formBuscarPersona
    var Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
    });


    function SearchPersonaClienteEmpresa(e) {
        e.preventDefault()
        let tipo_documento = $("#cboBusTipo_Documento").val()
        let num_documento = $("#txtbusNum_Documento").val()

        cargarEmpresaCliente(tipo_documento, num_documento, false);


    }


    function SaveOrUpdate(e) {
        e.preventDefault();

        var formData = new FormData($("#frmEmpresa")[0]);
        $.post("./ajax/UsuarioAjax.php", function (r) {
            if (r === '0') {
                location.reload(true);
            }
        });

        $.ajax({

            url: "./ajax/EmpresaAjax.php?op=SaveOrUpdate",
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
                    ListadoGlobal();
                    OcultarForm();
                    Limpiar();
                }

            }

        });
    };





    function ListadoGlobal() {

        var tabla = $('#tblEmpresa').DataTable();
        $.ajax({
            url: './ajax/EmpresaAjax.php?op=list',
            dataType: 'json',
            success: function (s) {
                tabla.clear().draw();
                for (var i = 0; i < s.length; i++) {
                    tabla.row.add([
                        s[i][0],
                        s[i][1],
                        s[i][2],
                        s[i][3],
                        s[i][4],
                        s[i][5],
                        s[i][6],
                        s[i][7]
                    ]).draw(false);
                } // End For

            },
            error: function (e) {
                console.log(e.responseText);
            }
        });

    };


});

function Limpiar() {
    // Limpiamos las cajas de texto
    $("form#frmEmpresa").trigger('reset');
    $("form#frmEmpresa input:hidden").val('');
}
function verFormCliente() {
    $("#VerForm").show();// Mostramos el formulario
    $("#btnNuevo").hide();// ocultamos el boton nuevo
    $("#VerListado").hide();// ocultamos el listado
}
function OcultarForm() {
    $("#VerForm").hide();// Mostramos el formulario
    $("#btnNuevo").show();// ocultamos el boton nuevo
    $("#VerListado").show();// ocultamos el listado
}





function cargarEmpresaCliente(tipo_documento, num_documento, accion) {
    $.post("./ajax/UsuarioAjax.php", function (r) {
        if (r === '0') {
            location.reload(true);
        }
    });


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
    function editar(data) {
        $("#txtRefPersona").val(data.refPersona)

        $("#txt_Nombre").val(data.nombres)
        $("#txt_Apellido").val(data.apellidos)
        $("#txt_Sexo").val(data.sexo)
        $("#txt_fechaNacimiento").val(data.f_nacimiento)
        $("#txt_tipo_documentoHidden").val(data.t_documento)
        $("#txt_tipo_documento").val(data.t_documento)
        $("#txt_num_DocumentoHidden").val(data.n_documento)
        $("#txt_num_Documento").val(data.n_documento)
        $("#txt_Telefono").val(data.telefono)
        $("#txt_Email").val(data.email)
        $("#txt_RutaImgCli").val(data.foto)
        $("#txt_Ocupacion").val(data.ocupacion)
        // $("#").val(data.estado)
        $("#txt_Nota_Cliente").val(data.nota)
        // $("#").val(data.e_verificado)
        $("#txt_Direccion_Departamento").val(data.departamento)
        $("#txt_Direccion_Provincia").val(data.ciudad)
        $("#txt_Direccion_Distrito").val(data.barrio)
        $("#txt_Direccion_Calle").val(data.calle)
        // $("#").val(data.fecha_at)
        $("#txtRefEmpleado").val(data.refEmpleado)
        $("#txtApodo").val(data.apodo)
        $("#txtCargo").val(data.cargo)
        $("#txtEstadoEmpleado").val(data.estadoEmpleado)
        $("#txt_Comentario").val(data.comentarios)
        $("#txtRefUsuario").val(data.refUsuario)
        $("#txt_Login").val(data.username)
        $("#txtidPublica").val(data.id)

        $("#txtRefEmpresa").val(data.refGlobal)
        $("#txtEmpresa").val(data.razonSocial)
        $("#txt_Maxsucursal").val(data.mex_sucursal)
        $("#txt_estado").val(data.estadoEmpresa)
    }
    /*function perfil(data) {
        $("#img_empleado").text(data.foto)
        $("#txt_name_empleado").text(data.nombres + ' ' + data.apellidos)
        $("#txt_apodo_empleado").text(data.apodo)
        $("#txt_sexo_empleado").text(data.sexo)
        $("#txt_tipo_documento_empleado").text(data.t_documento)
        $("#txt_num_documento_empleado").text(data.n_documento)
        $("#txt_tel_empleado").text(data.telefono)
        // para editar
        $("#txt_t_documento_em").val(data.t_documento);
        $("#txt_cargo_en").val(data.refUsuario);
        $("#txt_n_documento_em").val(data.n_documento);
    }*/
    function nuevo() {
        $("#txt_tipo_documento").val(tipo_documento)
        $("#txt_tipo_documentoHidden").val(tipo_documento)
        $("#txt_num_DocumentoHidden").val(num_documento)
        $("#txt_num_Documento").val(num_documento)

    }

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

/**
 * 
                
                 else if (data === 1) {
                    Swal.fire({
                        title: 'Falta configurar comprobante?',
                        text: "Si lo deas puedes configurar conprobantes de obligacion!",
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#3085d6',
                        cancelButtonColor: '#d33',
                        confirmButtonText: 'Si, Configurar ahora!'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            $(location).attr("href", "confComprobante.php");
                        }
                    })

                } 
                
                
                
                else {
                    if (data.refCliente) {
                        if (editar) {
                            $("#txtRefPersona").val(data.refPersona)
                            $("#txt_Nombre").val(data.nombres)
                            $("#txt_Apellido").val(data.apellidos)
                            $("#txt_Sexo").val(data.sexo)
                            $("#txt_fechaNacimiento").val(data.f_nacimiento)
                            $("#txt_tipo_documentoHidden").val(data.t_documento)
                            $("#txt_tipo_documento").val(data.t_documento)
                            $("#txt_num_DocumentoHidden").val(data.n_documento)
                            $("#txt_num_Documento").val(data.n_documento)
                            $("#txt_Telefono").val(data.telefono)
                            $("#txt_Email").val(data.email)
                            $("#txt_RutaImgCli").val(data.foto)
                            $("#txt_Ocupacion").val(data.ocupacion)
                            $("#txt_Nota_Persona").val(data.nota)
                            $("#txt_Direccion_Departamento").val(data.departamento)
                            $("#txt_Direccion_Provincia").val(data.ciudad)
                            $("#txt_Direccion_Distrito").val(data.barrio)
                            $("#txt_Direccion_Calle").val(data.calle)


                            $("#txtRefCliente").val(data.refCliente)
                            $("#txt_max_credito").val(data.max_credito)
                            $("#txtApodo").val(data.apodo)
                            $("#txtEstadoCliente").val(data.estadoCliente)
                            $("#txt_Nota_Cliente").val(data.notaCliente)


                            $("#modal-xl").modal('hide');
                            verFormCliente()


                            return
                        }
                        $("#txt_refDetalle_documento_sucursalfHidden").val(data.refDetalle_documento_sucursal)
                        $("#txt_ultima_serieHidden").val(data.ultima_serie)
                        $("#txt_ultimo_numeroHidden").val(data.ultimo_numero)
                        $("#referencia-cliente").val(data.refCliente)
                        $("#img-cliente").attr('src', data.foto);
                        $("#txt-name-cliente").text(data.nombres + ' ' + data.apellidos);
                        $("#txt-sexo-cliente").text(data.sexo);
                        $("#txt-tipo-documento-cliente").text(data.t_documento);
                        $("#txt-num-documento-cliente").text(data.n_documento);
                        $("#txt-tel-cliente").text(data.telefono);
                        // falta boton nuevo credito
                        let trActivas = []
                        let trCanceladas = []
                        let nactivas = 0
                        let ncanceladas = 0
                        for (let i = 0; i < data.tarjetas.length; i++) {
                            const targeta = data.tarjetas[i];
                            if (targeta.estado === 'cancelado') {
                                ncanceladas++
                                trCanceladas.push(`
                                <tr>
                                    <td>${ncanceladas}</td>
                                    <td>${targeta.fecha_at}</td>
                                    <td>${targeta.codigo}</td>
                                    <td>${targeta.valor}</td>
                                    <td>${targeta.costo}</td>
                                    <td>0</td>
                                    <td>Como Pago</td>
                                </tr>
                                `)
                            } else {
                                nactivas++
                                trActivas.push(`
                                <tr>
                                    <td>${nactivas}</td>
                                    <td>${targeta.fecha_at}</td>
                                    <td>${targeta.codigo}</td>
                                    <td>${targeta.valor}</td>
                                    <td>${targeta.costo}</td>
                                    <td>Resta</td>
                                    <td>Estado</td>
                                    <td>Abonos</td>
                                </tr>
                                `)
                            }

                        }

                        if (JSON.stringify(trActivas) === '[]') {
                            trActivas.push(`
                            <tr>
                                <td colspan="8"> SIN TARGETAS </td>
                                
                            </tr>
                            `)
                        }
                        if (JSON.stringify(trCanceladas) === '[]') {
                            trCanceladas.push(`
                            <tr>
                                <td colspan="7"> SIN TARGETAS </td>
                                
                            </tr>
                            `)
                        }
                        $("#tbody-tarjetas-activas-cliente").html("");
                        $("#tbody-tarjetas-activas-cliente").html(trActivas.join(''));
                        $("#tbody-tarjetas-canceladas-cliente").html("");
                        $("#tbody-tarjetas-canceladas-cliente").html(trCanceladas.join(''));
                        $("#modal-xl").modal('hide');
                        verInformacionCliente()
                    } else {
                        $("#txtRefPersona").val(data.refPersona)
                        $("#txt_Nombre").val(data.nombres)
                        $("#txt_Apellido").val(data.apellidos)
                        $("#txt_Sexo").val(data.sexo)
                        $("#txt_fechaNacimiento").val(data.f_nacimiento)
                        $("#txt_tipo_documentoHidden").val(data.t_documento)
                        $("#txt_tipo_documento").val(data.t_documento)
                        $("#txt_num_DocumentoHidden").val(data.n_documento)
                        $("#txt_num_Documento").val(data.n_documento)
                        $("#txt_Telefono").val(data.telefono)
                        $("#txt_Email").val(data.email)
                        $("#txt_RutaImgCli").val(data.foto)
                        $("#txt_Ocupacion").val(data.ocupacion)
                        $("#txt_Nota_Persona").val(data.nota)
                        $("#txt_Direccion_Departamento").val(data.departamento)
                        $("#txt_Direccion_Provincia").val(data.ciudad)
                        $("#txt_Direccion_Distrito").val(data.barrio)
                        $("#txt_Direccion_Calle").val(data.calle)
                        $("#modal-xl").modal('hide');
                        verFormCliente()
                    }



                }
 */