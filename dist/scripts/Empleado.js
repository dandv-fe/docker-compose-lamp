jQuery(document).ready(function () {
    ListadoEmpleado();

    OcultarForm();

    $("#dateDeste").on("hide.datetimepicker", function (e) {
        $("form#formSearchNominaDetallado").trigger('submit');
    });
    $("#dateHasta").on("hide.datetimepicker", function (e) {
        $("form#formSearchNominaDetallado").trigger('submit');
    });



    $("form#formSearchNominaDetallado").submit(function (e) {
        e.preventDefault();
        $("#txtUltimo").val($("#txtRefEmpleadoConfig").val());

        listarNominaDetalle();
    });

    $('a[data-toggle="pill"]').on('shown.bs.tab', function (e) {
        if ($(e.target).attr('id') === 'custom-tabs-nomina-tab') {
            listarNomina();
        } else if ($(e.target).attr('id') === 'custom-tabs-liquidar-tab') {
            $("form#formSearchNominaDetallado").submit()
        } else if ($(e.target).attr('id') === 'custom-tabs-authorizations-tab') {
            AuthorizacionEmpleado();
        }else if ($(e.target).attr('id') === 'custom-tabs-asignarEmpleados-tab') {
           manejrTabsEmpleadoAsignado()
        }
    })

    $("form#frmEmpleado").submit(SaveOrUpdate);

    $("form#formPactarSueldo").submit(SaveOrUpdateSueldoPactado);

    $("form#formEmpleadoEditar").submit(function (e) {
        e.preventDefault()
        let num_documento = $("#txt_n_documento_em").val();
        let tipo_documento = $("#txt_t_documento_em").val();
        let accion = 'editar'
        let cargo = $("#txt_cargo_en").val();
        if (cargo != '') {
            tipo_documento = cargo;
            accion = 'editarUser'
        }
        cargarDataEmpleado(tipo_documento, num_documento, accion);
    });

    function SaveOrUpdateSueldoPactado(e) {
        e.preventDefault()
        $("#txtRefEmpleado_formPactarSueldo").val($("#txtRefEmpleadoConfig").val());
        $.post("./ajax/UsuarioAjax.php", function (r) {
            if (r === '0') {
                location.reload(true);
            }
        });
        var formData = new FormData($("#formPactarSueldo")[0]);
        $.ajax({
            url: "./ajax/EmpleadoAjax.php?op=SaveOrUpdateSueldoPactado",
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
                    $("#modal-pactar-sueldo").modal('hide');
                    listarNomina()
                }
            }
        });
    }

    $("form#formBuscarPersona").submit(buscarPersona);

    $("#btnCancelarForm").on('click', () => {
        OcultarForm();
    })

    var Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
    });

    function buscarPersona(e) {
        e.preventDefault()
        let tipo_documento = $("#cboBusTipo_Documento").val()
        let num_documento = $("#txtbusNum_Documento").val()
        cargarDataEmpleado(tipo_documento, num_documento, 'nuevo');
    }

    function SaveOrUpdate(e) {
        e.preventDefault();
        $.post("./ajax/UsuarioAjax.php", function (r) {
            if (r === '0') {
                location.reload(true);
            }
        });
        var formData = new FormData($("#frmEmpleado")[0]);
        $.ajax({
            url: "./ajax/EmpleadoAjax.php?op=SaveOrUpdate",
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
                    ListadoEmpleado();
                    OcultarForm();
                }
            }
        });
    };

    function ListadoEmpleado() {
        const tabla = $("#example1").DataTable()
        $.ajax({
            url: './ajax/EmpleadoAjax.php?op=list',
            type: "POST",
            data: {},
            dataType: "json",
            success: function (datos) {
                tabla.clear().draw();
                for (let i = 0; i < datos.length; i++) {
                    const val = datos[i];
                    tabla.row
                        .add([
                            val[0],
                            capitalizarPalabras(val[1]),
                            
                            val[7],
                            
                            val[2],
                            val[3],
                            val[4],
                            val[5],
                            val[6]
                        ]).draw(false);
                }
            },
            error: function (e) {
                console.log(e.responseText);
            }
        });
    };

    $("#formAsignarEmpleado").submit(function (e) { 
        e.preventDefault();
        $.post("./ajax/UsuarioAjax.php", function (r) {
            if (r === '0') {
                location.reload(true);
            }
        });

        const refEmpleados = document.querySelectorAll("#bootstrap-duallistbox-selected-list_cboEmpleadosAsignadosEmpleado > option")

        const emplsData = []
        refEmpleados.forEach(option => {
            emplsData.push($(option).val())
        })

        const data = {
            refEmpleado: $("#txtRefEmpleadoConfig").val(),
            empls: emplsData
        }
        console.log(data);

        $.post("./ajax/EmpleadoAjax.php?op=SaveEmpleadosAsignados", data, function (e) {
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
                manejrTabsEmpleadoAsignado()
            }
           
        })
    });

}); // ./ready

function VerForm() {
    $("#VerConfiguracion").hide();
    $("#VerForm").show();// Mostramos el formulario
    $("#btnNuevoEmpleado").hide();// ocultamos el boton nuevo
    $("#VerListado").hide();// ocultamos el listado
}

function OcultarForm() {
    $("#VerConfiguracion").hide();
    $("form#frmEmpleado").trigger('reset');
    $("#VerForm").hide();// Mostramos el formulario
    $("#btnNuevoEmpleado").show();// ocultamos el boton nuevo
    $("#VerListado").show();// ocultamos el listado
}

function VerConfiguracion(ref) {
    $("#txtRefEmpleadoConfig").val(ref);
    $("#VerForm").hide();// Mostramos el formulario
    $("#VerConfiguracion").show();// Mostramos el formulario
    $("#btnNuevoEmpleado").hide();// ocultamos el boton nuevo
    $("#VerListado").hide();// ocultamos el listado
}

function listarNomina() {
    $("#verLoadingNomina").removeClass('hide')
    $("#verListadoNomina").addClass('hide')
    $.post("./ajax/UsuarioAjax.php", function (r) {
        if (r === '0') {
            location.reload(true);
        }
    });
    const refEmpleado = $("#txtRefEmpleadoConfig").val();
    var tabla = $('#tblNomina').DataTable();
    $.ajax({
        url: './ajax/EmpleadoAjax.php?op=listNomina',
        type: "POST",
        data: { refEmpleado },
        dataType: "json",
        success: function (datos) {
            tabla.clear().draw();
            for (let i = 0; i < datos.length; i++) {
                const val = datos[i];
                tabla.row
                    .add([
                        val[0],
                        val[1],
                        val[2],
                        val[3]
                    ]).draw(false);
            }
            $("#verLoadingNomina").addClass('hide')
            $("#verListadoNomina").removeClass('hide')
        },
        error: function (e) {
            console.log(e.responseText);
        }
    });
}

function listarNominaDetalle() {

    $("#verLoadingNominaDetalle").removeClass('hide')
    $("#verListadoNominaDetlles").addClass('hide')
    $.post("./ajax/UsuarioAjax.php", function (r) {
      if (r === '0') {
        location.reload(true);
      }
    });
    var formData = new FormData($("form#formSearchNominaDetallado")[0]);

    var tabla = $('#tblDetalleNomina').DataTable();
    //console.log('bbb');
    $.ajax({
      url: './ajax/EmpleadoAjax.php?op=listNominaDetalle',
      type: "POST",
      data: formData,
      contentType: false,
      processData: false,
      dataType: "json",
      success: function (datos) {
        const conseptos = Array.from(new Set(datos.map(x => capitalizarPalabras(x[2]))));
        const trTableconsepto = conseptos.map(n => {
          return `<tr>
                    <td>
                        ${n}
                    </td>
                    <td>
                        $${datos.filter(x => capitalizarPalabras(x[2]) === n).map(m => m[1]).reduce((a, b) => parseFloat(a) + parseFloat(b), 0)}
                    </td>
                </tr>`
        })
        $("#trTableconsepto").html(trTableconsepto.join(''));

        tabla.clear().draw();
        for (let i = 0; i < datos.length; i++) {
          const val = datos[i];
          tabla.row
            .add([
              val[0],
              val[1],
              capitalizarPalabras(val[2]),
              val[3]
            ]).draw(false);
        }
        $("#verLoadingNominaDetalle").addClass('hide')
        $("#verListadoNominaDetlles").removeClass('hide')
      },
      error: function (e) {
        console.log(e.responseText);
      }
    });
  }

function AuthorizacionEmpleado() {
    $("#verLoadingPermisos").removeClass('hide')
    $("#verListadoPermisos").addClass('hide')
    $.post("./ajax/UsuarioAjax.php", function (r) {
        if (r === '0') {
            location.reload(true);
        }
    });
    const refEmpleado = $("#txtRefEmpleadoConfig").val();
    $.ajax({
        url: './ajax/EmpleadoAjax.php?op=listPermisos',
        type: "POST",
        data: { refEmpleado },
        dataType: "json",
        success: function (datos) {
            const misSucursalesDisponiblesHtml = []
            let autoIncrementPorCadaAuth = 0;
            const categorias = Array.from(new Set(datos.auth.map(x => x.categoria)));
            for (let i = 0; i < datos['sucurlales'].length; i++) {
                const suc = datos['sucurlales'][i];
                const isThisSucursalAuth = datos['authSucursal'].find(x => x.refSucursal === suc[0])
                if (!isThisSucursalAuth) {
                    misSucursalesDisponiblesHtml.push(`
                    <div class="col-12">
                        <div class="card card-danger card-outline">
                            <div class="card-header">
                                <h3 class="card-title">${suc[1]}: ${suc[2]}</h3>
                            </div>
                            <div class="card-body">
                                <div class="icheck-success d-inline">
                                    <input onchange="inicializarPermisosSucursal('checkbox_${suc[2]}' ,${suc[0]})" type="checkbox" id="checkbox_${suc[2]}" />
                                    <label for="checkbox_${suc[2]}">
                                        Otorgar Permisos
                                    </label>
                                    <p class="m-0">
                                        Para este empleado poder realizar cambios ovisualisar informacion 
                                        confidencial de la <b>${suc[1]}: ${suc[2]}</b> tiene que tener 
                                        algunos permisos 
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    `);
                } else {
                    const authCategoriasHtml = []
                    for (let iCategoria = 0; iCategoria < categorias.length; iCategoria++) {
                        const categoria = categorias[iCategoria];
                        const auth = datos['auth'].filter(a => a.categoria === categoria);
                        const authHtml = []
                        for (let iAuth = 0; iAuth < auth.length; iAuth++) {
                            const aut = auth[iAuth];
                            const checkbox = datos['authSucursal'].find(x => x.refSucursal === isThisSucursalAuth.refSucursal && x.refAuth === aut.refAuth);
                            authHtml.push(`
                            <div class="icheck-success d-inline">
                                <input onchange="otorgarPermisoSucursal('checkbox_${autoIncrementPorCadaAuth}_${aut.refAuth}' ,${aut.refAuth},${isThisSucursalAuth.refAuthSucursal})"
                                 ${(!checkbox) ? '' : 'checked'} 
                                 type="checkbox" id="checkbox_${autoIncrementPorCadaAuth}_${aut.refAuth}" />
                                <label for="checkbox_${autoIncrementPorCadaAuth}_${aut.refAuth}">
                                    ${aut.nameAccion}
                                </label>
                                <p class="m-0">
                                ${aut.descripcion} 
                                </p>
                            </div>
                        `);
                        }

                        authCategoriasHtml.push(`
                        <div class="col-md-6">
                            <div class="card card-warning">
                                <div class="card-header">
                                    <h3 class="card-title">${categoria}</h3>
                                </div>
                                <div class=" bg-warning card-body px-1 py-2 ">
                                    ${authHtml.join('')}
                                </div>
                            </div>
                        </div>
                    `);
                    }

                    misSucursalesDisponiblesHtml.push(`
                        <div class="col-12" id="accordion_${suc[2]}">
                            <div class="card card-warning card-outline">
                                <a class="d-block w-100" data-toggle="collapse" href="#collapseFour_${suc[2]}">
                                    <div class="card-header">
                                        <h4 class="card-title w-100">
                                            ${suc[1]}: ${suc[2]}
                                        </h4>
                                    </div>
                                </a>
                                <div id="collapseFour_${suc[2]}" class="collapse" data-parent="#accordion_${suc[2]}">
                                    <div class="card-body p-0">
                                        <div class="row">
                                            ${authCategoriasHtml.join('')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `);
                }
                autoIncrementPorCadaAuth++;
            }
            $("#verListadoPermisos").html('');
            $("#verListadoPermisos").html(misSucursalesDisponiblesHtml.join(''));
            $("#verLoadingPermisos").addClass('hide')
            $("#verListadoPermisos").removeClass('hide')
        },
        error: function (e) {
            console.log(e.responseText);
        }
    });
}


function inicializarPermisosSucursal(ele, refSucursal) {
    Swal.fire({
        title: "Iniciar Permisos?",
        text: "Para iniciar escriba Tipo De Usuario",
        icon: "info",
        input: "text",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Si, Permitir ahora!",
        preConfirm: (login) => {
            if (login.toLowerCase() != '') {
                return;
            }
            Swal.showValidationMessage(`
                    Imposible continuar : \r Escribe Tipo De Usuario
                `);
        },
    }).then((result) => {
        if (result.isConfirmed) {
            $("#verLoadingPermisos").removeClass('hide')
            $("#verListadoPermisos").addClass('hide')
            $.post("./ajax/UsuarioAjax.php", function (r) {
                if (r === '0') {
                    location.reload(true);
                }
            });
            const refEmpleado = $("#txtRefEmpleadoConfig").val();
            const tipoUser = result.value
            const ope = $("#" + ele).prop('checked');
            $.post("./ajax/EmpleadoAjax.php?op=inicializarPermiso", { refSucursal, refEmpleado, tipoUser, ope }, function (r) {
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
                    AuthorizacionEmpleado()
                }
                $("#verLoadingPermisos").addClass('hide')
                $("#verListadoPermisos").removeClass('hide')
            });
        }
    });
}


function otorgarPermisoSucursal(ele, refAuth, refAuthSucursal) {
    Swal.fire({
        title: "Otorgar Permisos?",
        text: "Si estas de acuerdo hacer click. Si, aceptar ahora!: De lo contrario Cancelar ",
        icon: "info",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Si, aceptar hora!",
    }).then((result) => {
        if (result.isConfirmed) {
            $.post("./ajax/UsuarioAjax.php", function (r) {
                if (r === '0') {
                    location.reload(true);
                }
            });
            $.post("./ajax/EmpleadoAjax.php?op=otorgarPermiso", { refAuth, refAuthSucursal }, function (r) {
                if (r.indexOf("ERROR:") !== -1) {
                    Toast.fire({
                        icon: 'error',
                        title: r
                    })
                    $("#" + ele).prop('checked', !$("#" + ele).prop('checked'));
                } else {
                    Toast.fire({
                        icon: 'success',
                        title: r
                    })
                }
            });
        } else {
            $("#" + ele).prop('checked', !$("#" + ele).prop('checked'));
        }
    });

}

function cargarDataEmpleado(tipo_documento, num_documento, accion) {// funcion que llamamos del archivo ajax/CategoriaAjax.php linea 52
    if (accion === 'editarUser') {
        Swal.fire({
            title: "Editar Usuario?",
            icon: "info",
            html: `<br>
                <label class="labelForNuevoCredito top" for="txtNameUser">
                    <span class="spanForNuevoCredito badge-success top">Usuario</span>
                    <input value="" type="text" id="txtNameUser"
                        class="form-control inputForNuevoCredito inputForEdit" maxlength="12"
                        autocomplete="new-password" />
                </label>
                <br>
                <label class="labelForNuevoCredito top" for="taxtPassUser">
                    <span class="spanForNuevoCredito badge-success top">Contraseña</span>
                    <input value="" type="password" id="taxtPassUser"
                         class="form-control inputForNuevoCredito inputForEdit" maxlength="12"
                        autocomplete="new-password" />
                </label>
                <br>
                <label class="labelForNuevoCredito top" for="txtPassRep">
                    <span class="spanForNuevoCredito badge-success top">Repetir Contraseña</span>
                    <input value="" type="password" id="txtPassRep"
                         class="form-control inputForNuevoCredito inputForEdit" maxlength="12"
                            autocomplete="new-password" />
                </label>
            `,
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Si, editar ahora!",
            preConfirm: (login) => {
                const nameuser = document.getElementById("txtNameUser").value
                const pass = document.getElementById("taxtPassUser").value
                const passrep = document.getElementById("txtPassRep").value
                const err = []
                if (nameuser === '' || pass === '' || passrep === '') err.push('Todos los campos son requeridos!')
                if (pass != passrep) err.push('Las contraceñas no considen!')
                if (err.length > 0) {
                    err.map(e => {
                        return Swal.showValidationMessage(e);
                    })
                }
                return [
                    nameuser,
                    pass
                ];

            },
        }).then((result) => {
            if (result.isConfirmed) {

                $.post("./ajax/UsuarioAjax.php", function (r) {
                    if (r === '0') {
                        location.reload(true);
                    }
                });

                $.post("./ajax/EmpleadoAjax.php?op=edit-super-a", {
                    tipo_documento,
                    nameuser: result.value[0],
                    pass: result.value[1]
                }, function (r) {
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

                        ListadoEmpleado()
                    }

                });

            }
        });
        return;
    }





    $.post("./ajax/UsuarioAjax.php", function (r) {
        if (r === '0') {
            location.reload(true);
        }
    });


    $.getJSON("./ajax/EmpleadoAjax.php?op=buscarPersona", { tipo_documento, num_documento },
        function (data, textStatus) {
            if (textStatus === 'success') {
                if (data === 0) {
                    Toast.fire({
                        icon: 'error',
                        title: 'Error incompleto'
                    })
                } else {
                    $("#modal-xl").modal('hide');
                    if (accion === 'editar') {
                        editar(data)
                        VerForm()
                    } else if (accion === 'perfil') {
                        perfil(data)
                        VerConfiguracion(data.refEmpleado)

                        $("#custom-tabs-liquidar-tab").tab('show')
                        $("form#formSearchNominaDetallado").submit()
                    } else if (accion === 'nuevo') {
                        if (data === null) {
                            nuevo()
                            VerForm()
                        } else {
                            perfil(data)
                            VerConfiguracion(data.refEmpleado)
                            $("#custom-tabs-liquidar-tab").tab('show')
                        }
                    }
                }
            } else {
                Toast.fire({
                    icon: 'error',
                    title: 'Error Inesperado'
                })
            }
        });

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

    }
    function perfil(data) {
        $("#img_empleado").text(data.foto)
        $("#txt_name_empleado").text(data.nombres + ' ' + data.apellidos)
        $("#txt_apodo_empleado").text(data.apodo)
        $("#txt_sexo_empleado").text(data.sexo)
        $("#txt_tipo_documento_empleado").text(data.t_documento)
        $("#txt_num_documento_empleado").text(data.n_documento)
        $("#txt_tel_empleado").text(data.telefono)
        $("#pTextDireccionEmpleado").text(data.departamento+', '+data.ciudad+', '+data.barrio+', '+data.calle);
        // para editar
        $("#txt_t_documento_em").val(data.t_documento);
        $("#txt_cargo_en").val(data.refUsuario);
        $("#txt_n_documento_em").val(data.n_documento);
    }
    function nuevo() {
        $("#txt_tipo_documento").val(tipo_documento)
        $("#txt_tipo_documentoHidden").val(tipo_documento)
        $("#txt_num_DocumentoHidden").val(num_documento)
        $("#txt_num_Documento").val(num_documento)

    }

}



function manejrTabsEmpleadoAsignado() {
    $("#verLoadingAsignarEmpleados").removeClass('hide')
    $("#verListadoAsignarEmpleados").addClass('hide')
    $.post("./ajax/UsuarioAjax.php", function (r) {
        if (r === '0') {
            location.reload(true);
        }
    });
    const refEmpleado = $("#txtRefEmpleadoConfig").val();
    $("#txtrefEmpleadoFormAsignarEmpleadoHidden").val(refEmpleado);
    $('.duallistbox').bootstrapDualListbox('refresh', true);
    $.get("./ajax/EmpleadoAjax.php?op=listEmpleadosAsignadosEmpleado", { refEmpleado }, function (r) {
        $("#cboEmpleadosAsignadosEmpleado").html(r);
        $("#verLoadingAsignarEmpleados").addClass('hide')
        $("#verListadoAsignarEmpleados").removeClass('hide')
        $('.duallistbox').bootstrapDualListbox('refresh');

    })


   
   
}


function listarNomina3244445() {
    $("#verLoadingAsignarEmpleados").removeClass('hide')
    $("#verListadoNomina").addClass('hide')
    $.post("./ajax/UsuarioAjax.php", function (r) {
        if (r === '0') {
            location.reload(true);
        }
    });
    const refEmpleado = $("#txtRefEmpleadoConfig").val();
    var tabla = $('#tblNomina').DataTable();
    $.ajax({
        url: './ajax/EmpleadoAjax.php?op=listNomina',
        type: "POST",
        data: { refEmpleado },
        dataType: "json",
        success: function (datos) {
            tabla.clear().draw();
            for (let i = 0; i < datos.length; i++) {
                const val = datos[i];
                tabla.row
                    .add([
                        val[0],
                        val[1],
                        val[2],
                        val[3]
                    ]).draw(false);
            }
            $("#verLoadingNomina").addClass('hide')
            $("#verListadoNomina").removeClass('hide')
        },
        error: function (e) {
            console.log(e.responseText);
        }
    });
}