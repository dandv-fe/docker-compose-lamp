jQuery(document).ready(function () {
  $("#editarDocumentoAhorrador").click(function (e) {
    $("#titleModalBuscarPersona").text("Editar Documento");

    var dd = $("#txt_tipo_documento_ahorrador").text();

    $("#refBuscarPersona").val($(this).data('editDocument'));
    $("#cboBusTipo_Documento").val(dd);
    $("#txtbusNum_Documento").val($("#txt_num_documento_ahorrador").text());
    $("#btnSubmitFormBuscarPersona").text("Editar");

    $("#modal-xl").modal('show');
  });

  ListadoAhorradores();

  OcultarForm();

  // Event listeners para tabs de ahorros
  $('a[data-toggle="pill"]').on('shown.bs.tab', function (e) {
    if ($(e.target).attr('id') === 'custom-tabs-productos-tab') {
      const refPersona = $("#txt_idpersona_ah").val();
      listarAhorrosPersona(refPersona);

    } else if ($(e.target).attr('id') === 'custom-tabs-configuracion-tab') {
      const ref = $("#txtRefAhorroConfig").val();
      // console.log(ref);

      if (ref) { actualizarPerfilAhorrador(ref); }
    }
  });

  // Submit del formulario principal de ahorro
  $("form#frmAhorro").submit(SaveOrUpdate);

  // Submit del formulario de configuración
  $("form#formConfiguracionAhorro").submit(SaveOrUpdateConfiguracion);

  // Submit del formulario de edición de ahorrador
  $("form#formAhorroEditar").submit(function (e) {
    e.preventDefault();
    let num_documento = $("#txt_n_documento_ah").val();
    let tipo_documento = $("#txt_t_documento_ah").val();
    let accion = 'editar';
    cargarDataAhorrador(tipo_documento, num_documento, accion);
  });




  function SaveOrUpdateConfiguracion(e) {
    e.preventDefault();
    $("#txtIdAhorroConfig").val($("#txtRefAhorroConfig").val());

    $.post("./ajax/UsuarioAjax.php", function (r) {
      if (r === '0') {
        location.reload(true);
      }
    });

    var formData = new FormData($("#formConfiguracionAhorro")[0]);
    $.ajax({
      url: "./ajax/AhorradoresAjax.php?op=SaveOrUpdateConfiguracion",
      type: "POST",
      data: formData,
      contentType: false,
      processData: false,
      success: function (datos) {
        if (datos.indexOf("ERROR:") !== -1) {
          Toast.fire({
            icon: 'error',
            title: datos
          });
        } else {
          Toast.fire({
            icon: 'success',
            title: datos
          });
          // Actualizar la vista del perfil
          const refAhorro = $("#txtRefAhorroConfig").val();
          actualizarPerfilAhorrador(refAhorro);
        }
      }
    });
  }

  // Submit del formulario de búsqueda de persona
  $("form#formBuscarPersona").submit(buscarPersona);

  // Botón cancelar
  $("#btnCancelarForm").on('click', () => {
    OcultarForm();
  });

  // Configuración de Toast (igual que empleados)
  var Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2000
  });

  function buscarPersona(e) {
    e.preventDefault();
    let refPersona = $("#refBuscarPersona").val();
    let tipo_documento = $("#cboBusTipo_Documento").val();
    let num_documento = $("#txtbusNum_Documento").val();

    if (refPersona) {
      var formData = new FormData($("form#formBuscarPersona")[0]);

      $.ajax({
        url: "./ajax/ClienteAjax.php?op=updateDocumentoPersona",
        type: "POST",
        data: formData,
        contentType: false,
        processData: false,
        success: function (datos) {
          if (datos.indexOf("ERROR:") !== -1) {
            Toast.fire({
              icon: 'error',
              title: datos
            });
          } else {
            Toast.fire({
              icon: 'success',
              title: datos
            });
            $("#frmAhorro").trigger('reset');
            $("#frmAhorro input:hidden").val('');
            cargarDataAhorrador(tipo_documento, num_documento, 'perfil');
          }
        }
      });
    } else {
      cargarDataAhorrador(tipo_documento, num_documento, 'nuevo');
    }
  }

  function SaveOrUpdate(e) {
    e.preventDefault();
    $.post("./ajax/UsuarioAjax.php", function (r) {
      if (r === '0') {
        location.reload(true);
      }
    });

    var formData = new FormData($("#frmAhorro")[0]);
    $.ajax({
      url: "./ajax/AhorradoresAjax.php?op=SaveOrUpdate",
      type: "POST",
      data: formData,
      contentType: false,
      processData: false,
      success: function (datos) {
        if (datos.indexOf("ERROR:") !== -1) {
          Toast.fire({
            icon: 'error',
            title: datos
          });
        } else {
          Toast.fire({
            icon: 'success',
            title: datos
          });
          ListadoAhorradores();
          OcultarForm();
        }
      }
    });
  }

}); // ./ready

// Funciones auxiliares (iguales a empleados pero adaptadas)
function VerForm() {
  $("#VerConfiguracion").hide();
  $("#VerForm").show();
  $("#btnNuevoAhorrador").hide();
  $("#VerListado").hide();
}

function OcultarForm() {
  $("#VerConfiguracion").hide();
  $("form#frmAhorro").trigger('reset');
  $("#VerForm").hide();
  $("#btnNuevoAhorrador").show();
  $("#VerListado").show();
}

function VerConfiguracion(ref) {
  $("#txtRefAhorroConfig").val(ref);
  $("#VerForm").hide();
  $("#VerConfiguracion").show();
  $("#btnNuevoAhorrador").hide();
  $("#VerListado").hide();
  //console.log(ref);

  if (ref) { actualizarPerfilAhorrador(ref); } // cargar configuración inmediata
}

// Función principal de listado (adaptada de ListadoEmpleado)
function ListadoAhorradores() {
  OcultarForm();
  const tabla = $("#example1").DataTable();

  $.ajax({
    url: './ajax/AhorradoresAjax.php?op=list',
    type: "POST",
    data: {},
    dataType: "json",
    success: function (datos) {
      tabla.clear().draw();
      for (let i = 0; i < datos.length; i++) {
        const val = datos[i];
        tabla.row.add([
          val[0], // Nombre (con foto/inicial)
          val[1], // Documento
          val[2], // Teléfono
          val[3], // Email
          val[4], // Dirección
          val[5], // Fecha Creación
          val[6]  // Opciones
        ]).draw(false);
      }
    },
    error: function (e) {
      console.log(e.responseText);
    }
  });
}


// Función para listar ganancias
function listarGanancias() {
  $("#verLoadingGanancias").removeClass('hide');
  $("#verListadoGanancias").addClass('hide');

  $.post("./ajax/UsuarioAjax.php", function (r) {
    if (r === '0') {
      location.reload(true);
    }
  });

  const refAhorro = $("#txtRefAhorroConfig").val();
  var tabla = $('#tblGanancias').DataTable();

  $.ajax({
    url: './ajax/AhorradoresAjax.php?op=listGanancias',
    type: "POST",
    data: { refAhorro },
    dataType: "json",
    success: function (datos) {
      tabla.clear().draw();
      for (let i = 0; i < datos.length; i++) {
        const val = datos[i];
        tabla.row.add([
          val[0], // Fecha
          val[1], // Porcentaje
          val[2], // Ganancia
          val[3]  // Total Acumulado
        ]).draw(false);
      }
      $("#verLoadingGanancias").addClass('hide');
      $("#verListadoGanancias").removeClass('hide');
    },
    error: function (e) {
      console.log(e.responseText);
    }
  });
}

function listarAhorrosPersona(refPersona) {
  $("#verLoadingProductos").removeClass('hide');
  $("#verListadoAhorros").addClass('hide');

  const tabla = $('#tblAhorros').DataTable();
  if (!refPersona) {
    tabla.clear().draw();
    $("#verLoadingProductos").addClass('hide');
    $("#verListadoAhorros").removeClass('hide');
    return;
  }

  $.ajax({
    url: './ajax/AhorradoresAjax.php?op=listAhorrosPersona',
    type: "POST",
    data: { refPersona },
    dataType: "json",
    success: function (datos) {
      tabla.clear().draw();
      for (let i = 0; i < datos.length; i++) {
        const val = datos[i];
        tabla.row.add([
          val[0],
          val[1],
          val[2],
          val[3],
          val[4],
          val[5],
          val[6],
          val[7]
        ]).draw(false);
      }
      $("#verLoadingProductos").addClass('hide');
      $("#verListadoAhorros").removeClass('hide');
    },
    error: function (e) {
      console.log(e.responseText);
      tabla.clear().draw();
      $("#verLoadingProductos").addClass('hide');
      $("#verListadoAhorros").removeClass('hide');
    }
  });
}

// Función principal para cargar datos del ahorrador (adaptada de cargarDataEmpleado)
function cargarDataAhorrador(tipo_documento, num_documento, accion) {
  $.post("./ajax/UsuarioAjax.php", function (r) {
    if (r === '0') {
      location.reload(true);
    }
  });

  $.getJSON("./ajax/AhorradoresAjax.php?op=buscarPersona", { tipo_documento, num_documento },
    function (data, textStatus) {
      if (textStatus === 'success') {
        if (data === 0) {
          Toast.fire({
            icon: 'error',
            title: 'Error incompleto'
          });
        } else {
          $("#modal-xl").modal('hide');

          if (accion === 'editar') {
            $("#btn-submit-ahorro").text("ACTUALIZAR AHORRO");
            editar(data);
            VerForm();
          } else if (accion === 'perfil') {
            perfil(data);
            VerConfiguracion(data.refAhorro);
            listarAhorrosPersona(data.refPersona);
            //$("#custom-tabs-movimientos-tab").tab('show');
          } else if (accion === 'nuevo') {
            $("#btn-submit-ahorro").text("GUARDAR AHORRO");

            if (data === null) {
              // No existe la persona - crear todo nuevo
              nuevo();
              VerForm();
            } else {
              if (data.isAhorrador) {
                // Ya tiene ahorro - mostrar perfil
                if (data.estadoAhorro === 'inactivo') {
                  alert('El ahorrador se encuentra inactivo.');
                  return;
                }
                perfil(data);
                VerConfiguracion(data.refAhorro);
                listarAhorrosPersona(data.refPersona);
                $("#custom-tabs-movimientos-tab").tab('show');
              } else {
                // Existe persona pero no tiene ahorro
                let mensaje = "Persona encontrada. ";
                if (data.tieneUsuario) {
                  mensaje += "Ya tiene usuario. Se creará solo el ahorro.";
                } else {
                  mensaje += "Se creará usuario y ahorro.";
                }

                Toast.fire({
                  icon: 'info',
                  title: mensaje
                });

                editar(data);
                VerForm();
              }
            }
          }
        }
      } else {
        Toast.fire({
          icon: 'error',
          title: 'Error Inesperado'
        });
      }
    });

  // Función interna para editar (adaptada de empleados)
  function editar(data) {
    $("#txtRefPersona").val(data.refPersona);
    $("#txt_Nombre").val(data.nombres);
    $("#txt_Apellido").val(data.apellidos);
    $("#txt_Sexo").val(data.sexo);
    $("#txt_fechaNacimiento").val(data.f_nacimiento);
    $("#txt_tipo_documentoHidden").val(data.t_documento);
    $("#txt_tipo_documento").val(data.t_documento);
    $("#txt_num_DocumentoHidden").val(data.n_documento);
    $("#txt_num_Documento").val(data.n_documento);
    $("#txt_Telefono").val(data.telefono);
    $("#txt_Email").val(data.email);
    $("#txt_RutaImgCli").val(data.foto);
    $("#txt_Ocupacion").val(data.ocupacion);
    $("#txt_Nota_Cliente").val(data.nota);
    $("#txt_Direccion_Departamento").val(data.departamento);
    $("#txt_Direccion_Provincia").val(data.ciudad);
    $("#txt_Direccion_Distrito").val(data.barrio);
    $("#txt_Direccion_Calle").val(data.calle);

    // Datos específicos del ahorro
    $("#txtRefAhorro").val(data.refAhorro);
    $("#txtPorcentaje").val(data.porcentaje || 0);
    $("#cboPagoUtilidad").val(data.pagoUtilidad || '');
    $("#chkAuthMovimientos").prop('checked', data.authMovimientos == 1);
    $("#cboEstado").val(data.estadoAhorro || 'ACTIVO');

    // Datos de usuario
    $("#txtRefUsuario").val(data.refUsuario);
    $("#txt_Login").val(data.username);
    $("#txtidPublica").val(data.id);
  }

  // Función interna para perfil (adaptada de empleados)
  function perfil(data) {
    $("#img_ahorrador").attr('src', data.foto || '');
    $("#txt_name_ahorrador").text(data.nombres + ' ' + data.apellidos);
    $("#txt_apodo_ahorrador").text('Ahorrador');
    $("#txt_sexo_ahorrador").text(data.sexo);
    $("#txt_tipo_documento_ahorrador").text(data.t_documento);
    $("#txt_num_documento_ahorrador").text(data.n_documento);
    $("#editarDocumentoAhorrador").data("editDocument", data.refPersona);
    $("#txt_tel_ahorrador").text(data.telefono);
    const direccionPartes = [
      { titulo: 'Departamento', valor: data.departamento },
      { titulo: 'Ciudad', valor: data.ciudad },
      { titulo: 'Barrio', valor: data.barrio },
      { titulo: 'Calle', valor: data.calle }
    ].filter(function (item) { return item.valor && String(item.valor).trim() !== ''; });
    const $direccion = $("#txt_direccion_ahorrador");
    $direccion.empty();
    if (!direccionPartes.length) {
      $direccion.append($("<li>").text('No definido'));
    } else {
      direccionPartes.forEach(function (item) {
        const $li = $("<li>");
        const $label = $("<span>").addClass('text-dark font-weight-bold').text(item.titulo + ': ');
        const $value = $("<span>").text(item.valor);
        $li.append($label).append($value);
        $direccion.append($li);
      });
    }

    // Formatear y mostrar el porcentaje
    const porcentaje = parseFloat(data.porcentaje || 0);
    $("#txt_porcentaje_ahorrador").text(porcentaje + '%');
    $("#pTextPorcentajeAhorro").text(porcentaje + '%');
    const tipoPago = data.pagoUtilidad || data.pago_utilidad || 'No definido';
    $("#pTextTipoPago").text(tipoPago);
    const puedeMover = (data.authMovimientos == 1 || data.auth_movimientos == 1 || data.isSuperAdmin == 1);
    if (puedeMover) {
      $("#btnNuevoMovimiento").show();
      $("#msgMovNoAuth").addClass('d-none');
    } else {
      $("#btnNuevoMovimiento").hide();
      $("#msgMovNoAuth").removeClass('d-none');
    }

    // Para editar
    $("#txt_t_documento_ah").val(data.t_documento);
    $("#txt_n_documento_ah").val(data.n_documento);
    $("#txt_idglobal_ah").val(data.idglobal);
    $("#txt_idpersona_ah").val(data.refPersona);

    renderSaldosTiposAhorrador(data.saldosTipos || [], data);
  }

  // Función interna para nuevo (adaptada de empleados)
  function nuevo() {
    $("#txt_tipo_documento").val(tipo_documento);
    $("#txt_tipo_documentoHidden").val(tipo_documento);
    $("#txt_num_DocumentoHidden").val(num_documento);
    $("#txt_num_Documento").val(num_documento);
    $("#cboEstado").val('ACTIVO');
    $("#txtPorcentaje").val(0);
  }
}

// Función utilitaria para capitalizar palabras (igual que empleados)
function capitalizarPalabras(str) {
  if (!str) return '';
  return str.replace(/\w\S*/g, function (txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

// Función para actualizar perfil del ahorrador
function actualizarPerfilAhorrador(refAhorro) {
  //console.log(refAhorro);

  $.post("./ajax/AhorradoresAjax.php?op=obtenerPerfil", { refAhorro }, function (data) {
    if (data) {
      const ah = typeof data === 'string' ? JSON.parse(data) : data;
      // texto resumen
      $("#pTextPorcentajeAhorro").text(ah.porcentaje + '%');
      const tipoPago = ah.pagoUtilidad || ah.pago_utilidad || 'No definido';
      $("#pTextTipoPago").text(tipoPago);
      $("#txt_porcentaje_ahorrador").text(ah.porcentaje + '%');
      $("#cboEstadoConfig").val(ah.estado || 'ACTIVO');
      // normalizar bit
      const authMov = parseBit(ah.auth_movimientos);
      // habilitar botón movimientos
      const puedeMover = (authMov === 1 || parseBit(ah.isSuperAdmin) === 1);
      if (puedeMover) {
        $("#btnNuevoMovimiento").show();
        $("#msgMovNoAuth").addClass('d-none');
      } else {
        $("#btnNuevoMovimiento").hide();
        $("#msgMovNoAuth").removeClass('d-none');
      }
      // poblar formulario configuración
      $("#txtIdAhorroConfig").val(refAhorro);
      $("#txtPorcentajeConfig").val(ah.porcentaje);

      // Normalizar y asignar correctamente el select cboPagoUtilidadConfig
      const pagoValRaw = ah.pagoUtilidad || ah.pago_utilidad || '';
      const pagoVal = (typeof pagoValRaw === 'string') ? pagoValRaw.toLowerCase() : '';
      if (pagoVal === 'automatico' || pagoVal === 'manual') {
        $("#cboPagoUtilidadConfig").val(pagoVal);
      } else {
        $("#cboPagoUtilidadConfig").val('');
      }

      // Reflect also the main form select if visible (keeps consistency)
      if ($("#cboPagoUtilidad").length) {
        if (pagoVal === 'automatico' || pagoVal === 'manual') {
          $("#cboPagoUtilidad").val(pagoVal);
        } else {
          $("#cboPagoUtilidad").val('');
        }
      }
      // console.log(ah.estado);

      $("#chkAuthMovimientosConfig")
        .prop('checked', authMov === 1)
        .trigger('change'); // asegura indicador

      renderSaldosTiposAhorrador(ah.saldosTipos || [], ah);

    }
  });
}

// Utilidad para normalizar bits (0/1, '0'/'1', caracteres binarios)
function parseBit(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v === 1 ? 1 : 0;
  if (typeof v === 'string') {
    if (v.length === 1 && v.charCodeAt(0) <= 1) {
      // viene como carácter de bit
      return v.charCodeAt(0) === 1 ? 1 : 0;
    }
    return v === '1' ? 1 : 0;
  }
  return 0;
}

function actualizarIndicadorAuthMov(autorizado) {
  const $btn = $("#btnNuevoMovimiento");
  const $msg = $("#msgMovNoAuth");

  if (!$btn.length && !$msg.length) return;

  if (autorizado) {
    $btn.show();
    $msg.addClass('d-none');
  } else {
    $btn.hide();
    $msg.removeClass('d-none');
  }
}

function renderSaldosTiposAhorrador(saldosTipos, data) {
  /// console.log(saldosTipos, data);

  const $contenedor = $("#saldos_tipos_ahorrador");
  if (!$contenedor.length) return;

  const items = Array.isArray(saldosTipos) ? saldosTipos : [];
  $contenedor.empty();

  let total = 0;

  if (items.length > 0) {
    items.forEach(function (item) {


      const tipoRaw = (item && item.tipo != null) ? String(item.tipo).trim() : '';
      const tipo = tipoRaw !== '' ? tipoRaw : 'corriente';
      const saldo = item && item.saldo != null ? parseFloat(item.saldo) : 0;
      const saldoSeguro = Number.isFinite(saldo) ? saldo : 0;
      // console.log(saldoSeguro);
      total += saldoSeguro;
      //console.log(total);


      const $li = $("<li>").addClass("list-group-item d-flex justify-content-between align-items-center saldo-tipo-item");
      const $label = $("<b>").text('Saldo ' + capitalizarPalabras(tipo));
      const $valor = $("<a>").addClass("float-right txt-saldo-tipo-ahorrador").text('$' + saldoSeguro.toFixed(2));
      $li.append($label).append($valor);
      $contenedor.append($li);
    });
  } else {


    const saldoBase = data && data.saldoMovimientos != null ? parseFloat(data.saldoMovimientos) : 0;
    total = Number.isFinite(saldoBase) ? saldoBase : 0;
    const $li = $("<li>").addClass("list-group-item d-flex justify-content-between align-items-center saldo-tipo-item");
    const $label = $("<b>").text('Saldo Corriente');
    const $valor = $("<a>").addClass("float-right txt-saldo-tipo-ahorrador").text('$' + total.toFixed(2));
    $li.append($label).append($valor);
    $contenedor.append($li);
  }
  console.log(total);
  $("#txt_saldo_ahorrador").text('$' + total.toFixed(2));
}

// Al cambiar manualmente el checkbox reflejar indicador
$(document).on('change', '#chkAuthMovimientosConfig', function () {
  actualizarIndicadorAuthMov($(this).is(':checked'));
});

// listGanancias ya consume: [fecha, porcentaje, ganancia, acumulado] de movimientos tipo 'ajuste'