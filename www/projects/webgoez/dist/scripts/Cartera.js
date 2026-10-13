let ArrayTarjetas = new Object()
let nombre
let banderaListComentarios
let solicitudTelefonosCliente = null
let versionTelefonosCliente = 0
let solicitudGestionTelefonos = null
let versionGestionTelefonos = 0
let tarjetaGestionTelefonos = null
let csrfGestionTelefonos = null
let guardandoGestionTelefonos = false

function cerrarGestionTelefonosCliente() {
    versionGestionTelefonos++
    if (solicitudGestionTelefonos) solicitudGestionTelefonos.abort()
    solicitudGestionTelefonos = null
    tarjetaGestionTelefonos = null
    csrfGestionTelefonos = null
    guardandoGestionTelefonos = false
    $("#lista-gestion-telefonos-cliente").empty()
    $("#estado-gestion-telefonos-cliente").text('')
}

function gestionTelefonosSigueSeleccionada(version, tarjeta) {
    const actual = ArrayTarjetas[parseInt(sessionStorage.getItem('index') || '0', 10)]
    return version === versionGestionTelefonos && actual && tarjeta &&
        actual.refTarjeta === tarjeta.refTarjeta && actual.refSucursal === tarjeta.refSucursal
}

function pintarGestionTelefonosCliente(respuesta) {
    if (!Array.isArray(respuesta.telefonos) || typeof respuesta.csrf !== 'string') {
        $("#estado-gestion-telefonos-cliente").text('Respuesta inválida al gestionar teléfonos.')
        return
    }
    csrfGestionTelefonos = respuesta.csrf
    if (typeof respuesta.principal === 'string' && tarjetaGestionTelefonos) {
        if (tarjetaGestionTelefonos.refCliente) {
            Object.values(ArrayTarjetas).forEach(tarjeta => {
                if (tarjeta.refCliente === tarjetaGestionTelefonos.refCliente) tarjeta.tel = respuesta.principal
            })
        }
        $("#telefono-cliente-panel").text(respuesta.principal)
    }
    $("#lista-gestion-telefonos-cliente").empty()
    const principalIncorrecto = respuesta.telefonos.some(t => t.primary && t.invalid)
    $("#estado-gestion-telefonos-cliente").text(principalIncorrecto
        ? 'El principal está marcado INCORRECTO por una edición antigua. No se usará en WhatsApp. Selecciona otro principal válido o restáuralo deliberadamente.'
        : respuesta.telefonos.length ? '' : 'Sin teléfonos registrados.')
    respuesta.telefonos.forEach(telefono => {
        const fila = $('<li>').addClass('mb-3')
        $('<div>').text(telefono.phone + (telefono.primary ? ' · PRINCIPAL' : '') +
            (telefono.invalid ? ' · INCORRECTO' : '')).appendTo(fila)
        if (telefono.validityChangedAt) {
            $('<small>').text('Última corrección: ' + telefono.validityChangedAt +
                ' · usuario ' + telefono.validityChangedBy).appendTo(fila)
        }
        if (telefono.normalizedPhone) {
            $('<button>').attr('type', 'button').addClass('btn btn-sm btn-outline-warning ml-2')
                .text(telefono.invalid ? 'Restaurar' : 'Marcar incorrecto')
                .on('click', () => mutarGestionTelefonoCliente(telefono, telefono.invalid ? 'restaurar' : 'incorrecto'))
                .appendTo(fila)
            if (!telefono.invalid && !telefono.primary) {
                $('<button>').attr('type', 'button').addClass('btn btn-sm btn-outline-primary ml-2')
                    .text('Seleccionar principal').on('click', () => mutarGestionTelefonoCliente(telefono, 'principal'))
                    .appendTo(fila)
            }
        } else {
            $('<div>').text('Histórico sin formato válido para WhatsApp.').appendTo(fila)
        }
        fila.appendTo('#lista-gestion-telefonos-cliente')
    })
}

function mostrarGestionTelefonosCliente() {
    const tarjeta = ArrayTarjetas[parseInt(sessionStorage.getItem('index') || '0', 10)]
    cerrarGestionTelefonosCliente()
    tarjetaGestionTelefonos = tarjeta
    const version = versionGestionTelefonos
    const consulta = $("#modal-telefonos-cliente")
    const abrirGestion = () => {
        if (gestionTelefonosSigueSeleccionada(version, tarjeta)) {
            $("#modal-gestion-telefonos-cliente").modal('show')
        }
    }
    if (consulta.hasClass('show')) {
        consulta.off('hidden.bs.modal.abrirGestionTelefonos')
            .one('hidden.bs.modal.abrirGestionTelefonos', abrirGestion)
            .modal('hide')
    } else {
        abrirGestion()
    }
    if (!tarjeta) {
        $("#estado-gestion-telefonos-cliente").text('Selecciona un cliente en la cartera.')
        return
    }
    $("#estado-gestion-telefonos-cliente").text('Cargando teléfonos…')
    solicitudGestionTelefonos = $.getJSON('./ajax/GestionTelefonosClienteAjax.php', {
        idtarjeta: tarjeta.refTarjeta, idsucursal: tarjeta.refSucursal
    }).done(respuesta => {
        if (gestionTelefonosSigueSeleccionada(version, tarjeta)) pintarGestionTelefonosCliente(respuesta)
    }).fail((xhr, estado) => {
        if (estado !== 'abort' && gestionTelefonosSigueSeleccionada(version, tarjeta)) {
            $("#estado-gestion-telefonos-cliente").text(xhr.responseJSON && xhr.responseJSON.error ||
                'No se pudo cargar la gestión de teléfonos.')
        }
    })
}

function mutarGestionTelefonoCliente(telefono, accion) {
    const tarjeta = tarjetaGestionTelefonos
    const version = versionGestionTelefonos
    if (guardandoGestionTelefonos || !csrfGestionTelefonos || !gestionTelefonosSigueSeleccionada(version, tarjeta)) return
    if (accion === 'incorrecto' && telefono.primary) {
        $("#estado-gestion-telefonos-cliente").text('Selecciona primero otro teléfono principal antes de marcar este como incorrecto.')
        return
    }
    const mensaje = accion === 'incorrecto' ? '¿Marcar este teléfono INCORRECTO? Se conserva el historial y se excluye de WhatsApp.'
        : accion === 'restaurar' ? '¿Restaurar este teléfono como válido? Volverá a estar disponible para WhatsApp.'
            : '¿Usar este teléfono como principal en todas las tarjetas del cliente?'
    if (!confirm(mensaje + '\n' + telefono.phone)) return
    guardandoGestionTelefonos = true
    $("#estado-gestion-telefonos-cliente").text('Guardando…')
    solicitudGestionTelefonos = $.ajax({
        url: './ajax/GestionTelefonosClienteAjax.php', method: 'POST', dataType: 'json',
        data: { idtarjeta: tarjeta.refTarjeta, idsucursal: tarjeta.refSucursal,
            telefono: telefono.normalizedPhone, accion, csrf: csrfGestionTelefonos }
    }).done(respuesta => {
        if (gestionTelefonosSigueSeleccionada(version, tarjeta)) pintarGestionTelefonosCliente(respuesta)
    }).fail((xhr, estado) => {
        if (estado !== 'abort' && gestionTelefonosSigueSeleccionada(version, tarjeta)) {
            $("#estado-gestion-telefonos-cliente").text(xhr.responseJSON && xhr.responseJSON.error ||
                'No se pudo guardar. Abre nuevamente Gestionar teléfonos para verificar el estado.')
        }
    }).always(() => {
        if (gestionTelefonosSigueSeleccionada(version, tarjeta)) guardandoGestionTelefonos = false
    })
}

function cerrarTelefonosCliente() {
    versionTelefonosCliente++
    if (solicitudTelefonosCliente) solicitudTelefonosCliente.abort()
    solicitudTelefonosCliente = null
    $("#lista-telefonos-cliente").empty()
    $("#estado-telefonos-cliente").text('')
}

function mostrarTelefonosCliente() {
    const tarjeta = ArrayTarjetas[parseInt(sessionStorage.getItem('index') || '0', 10)]
    cerrarTelefonosCliente()
    const version = versionTelefonosCliente
    $("#modal-telefonos-cliente").modal('show')
    if (!tarjeta) {
        $("#estado-telefonos-cliente").text('Selecciona un cliente en la cartera.')
        return
    }
    $("#estado-telefonos-cliente").text('Cargando teléfonos…')
    const sigueSeleccionado = () => {
        const actual = ArrayTarjetas[parseInt(sessionStorage.getItem('index') || '0', 10)]
        return version === versionTelefonosCliente && actual &&
            actual.refTarjeta === tarjeta.refTarjeta && actual.refSucursal === tarjeta.refSucursal
    }
    solicitudTelefonosCliente = $.getJSON('./ajax/TelefonosClienteAjax.php', {
        idtarjeta: tarjeta.refTarjeta,
        idsucursal: tarjeta.refSucursal
    }).done(function (respuesta) {
        if (!sigueSeleccionado()) return
        if (!Array.isArray(respuesta.telefonos)) {
            $("#estado-telefonos-cliente").text('Respuesta inválida al consultar los teléfonos.')
            return
        }
        $("#estado-telefonos-cliente").text(respuesta.telefonos.length ? '' : 'Sin teléfonos registrados.')
        respuesta.telefonos.forEach(telefono => {
            $('<li>').text(telefono).appendTo('#lista-telefonos-cliente')
        })
    }).fail(function (xhr, estado) {
        if (estado === 'abort' || !sigueSeleccionado()) return
        $("#estado-telefonos-cliente").text(xhr.responseJSON && xhr.responseJSON.error ||
            'No se pudieron cargar los teléfonos. Inténtalo de nuevo.')
    })
}
const getDiaSemana = x => {
    const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    return diasSemana[x];
}
var sleepES5 = function (ms) {
    var esperarHasta = new Date().getTime() + ms;
    while (new Date().getTime() < esperarHasta) continue;
};
jQuery(document).ready(function () {
    $("#telefono-cliente-panel").off('.telefonosCliente')
        .on('click.telefonosCliente', mostrarTelefonosCliente)
        .on('keydown.telefonosCliente', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                mostrarTelefonosCliente()
            }
        })
    $("#modal-telefonos-cliente").off('.telefonosCliente')
        .on('hide.bs.modal.telefonosCliente', cerrarTelefonosCliente)
    $("#gestionar-telefonos-cliente").off('.telefonosCliente')
        .on('click.telefonosCliente', mostrarGestionTelefonosCliente)
    $("#modal-gestion-telefonos-cliente").off('.telefonosCliente')
        .on('hide.bs.modal.telefonosCliente', cerrarGestionTelefonosCliente)
    $("#editarDocumentoCliente").click(function (e) {
        $("#titleModalBuscarPersona").text("Editar Documento");

        var dd = $("#txt-tipo-documento-cliente").text();


        $("#refBuscarPersona").val($(this).data('editDocument'));

        $("#cboBusTipo_Documento").val(dd)

        $("#txtbusNum_Documento").val($("#txt-num-documento-cliente").text());
        $("#btnSubmitFormBuscarPersona").text("Editar");

        $("#modal-xl").modal('show');
    });
    $("#loadinSavedAdd").hide()
    verLoadin('Buscando Tarjetas', 'Espere...')
    if (typeof (Worker) !== "undefined") {
        trabajador = new Worker(`dist/scripts/workers/sumRecaudoCreditos.js?v=${versionDelsistema}`);
        trabajador.addEventListener('message', recibidoSumaRecaudoCreditos, false);
        trabajador.addEventListener('error', errores, false);

    } else {
        // Sorry! No Web Worker support..
        alert("Lo siento navegador no compatible");
        return;
    }

    getDifefencia()
    listarRuta();

    cargarBancosPagoCartera()
    $("#cboBancoPagoAbono").on('change', function (e) {
        const usaBanco = parseInt($(this).val() || '0') > 0
        $(".divDetallePagoBancoAbono").toggleClass('hide', !usaBanco)
        if (!usaBanco) {
            $("#txtValorBancoPagoAbono").val('')
            $("#txtReferenciaBancoPagoAbono").val('')
        }
        revisarVueltoAbono()
        if (e.originalEvent && $(this).val() !== '') {
            (usaBanco ? $("#txtValorBancoPagoAbono") : $("#txtconfirma-credito")).focus()
        }
    })
    $("#cboBancoPagoAbono, #txtValorBancoPagoAbono, #txtReferenciaBancoPagoAbono").on('keydown', function (e) {
        if (e.key !== 'Enter') return
        e.preventDefault()
        if ($("#cboBancoPagoAbono").val() === '') {
            Toast.fire({ icon: 'warning', title: 'Seleccione efectivo o la cuenta que recibió el abono' })
            $("#cboBancoPagoAbono").focus()
            return
        }
        $("#txtconfirma-credito").focus()
    })
    $(document).on('input', "#txtValorBancoPagoAbono, #txtAbono-credito", revisarVueltoAbono)
    $(document).on('change', "#cboBancoPagoCredito", function () {
        const usaBanco = parseInt($(this).val() || '0') > 0
        $(".divDetallePagoBancoCredito").toggleClass('hide', !usaBanco)
        if (!usaBanco) {
            $("#txtValorBancoPagoCredito").val('')
            $("#txtReferenciaBancoPagoCredito").val('')
        }
    })
    $(document).on('change', "#cboBancoPagoInicial", function () {
        const usaBanco = Number($(this).val()) > 0
        $(".divDetallePagoBancoInicial").toggleClass('hide', !usaBanco)
        if (!usaBanco) {
            $("#txtValorBancoPagoInicial, #txtReferenciaBancoPagoInicial").val('')
        }
    })


    $("#btnCancelarForm").click(function (e) {
        e.preventDefault();
        $("#frmCliente").trigger('reset')
        $("#frmCliente input:hidden").val('')
        verInformacionCliente()

    });

    //  nombre= $("#nombre-cliente-panel")

    $("form#frmCliente").submit(SaveOrUpdateCliente);
    $("form#formBuscarPersona").submit(buscarPersona);
    $("form#formtxtValor").submit((e) => {
        e.preventDefault()
    });
    $("form#formAddAbono").submit((e) => {
        e.preventDefault()
        let abono = $("#txtAbono-credito").val()
        if (abono === '') {
            ditetion('nex')
            return false
        }
        let id = parseInt(sessionStorage.getItem('index'))
        $("#txtCuotaHidden").val(abono)
        $("#resta-cliente-panel").text((parseFloat(ArrayTarjetas[id].resta) - parseFloat(abono)).toFixed(2))
        Toast.fire({ icon: 'info', title: 'Seleccione cómo recibió el abono' })
        $("#cboBancoPagoAbono").focus()
    });

    // Cuando por banco entra más que el abono, el cobrador devuelve la diferencia en efectivo.
    function vueltoAbono() {
        if (parseInt($("#cboBancoPagoAbono").val() || '0') <= 0) return 0
        const abono = parseFloat($("#txtAbono-credito").val() || '0') || 0
        const porBanco = parseFloat($("#txtValorBancoPagoAbono").val() || '0') || (abono || 0)
        const vuelto = Math.round((porBanco - abono) * 100) / 100
        return vuelto > 0 ? vuelto : 0
    }

    function revisarVueltoAbono() {
        const vuelto = vueltoAbono()
        $("#divVueltoBancoAbono").toggleClass('hide', vuelto <= 0)
        $("#txtVueltoBancoAbonoTexto").text(vuelto.toFixed(2))
        if (vuelto <= 0) $("#chkVueltoBancoAbono").prop('checked', false)
        $("#txtVueltoBancoPagoAbono").val(vuelto.toFixed(2))
    }

    $("form#formAddAbonoConfirma").submit((e) => {
        e.preventDefault()
        const medioAbono = $("#cboBancoPagoAbono").val()
        if (medioAbono === '' || !/^(0|[1-9]\d*)$/.test(medioAbono || '')) {
            Toast.fire({ icon: 'error', title: 'Seleccione el medio de pago antes de confirmar cuánto resta' })
            $("#cboBancoPagoAbono").focus()
            return false
        }
        $("#loadinSavedAdd").show()
        $("#btnsubmitAddAbono").attr('disabled', true)
        let abono = $("#txtAbono-credito").val()
        let confirma = $("#txtconfirma-credito").val()
        confirma = parseFloat(confirma)
        abono = parseFloat(abono)
        if (confirma === '' || !abono || abono === 0 || confirma < 0) {
            Toast.fire({
                icon: 'error',
                title: 'Complta el formulario'
            })
            $("#loadinSavedAdd").hide()
            $("#btnsubmitAddAbono").attr('disabled', false)
            $("#txtAbono-credito").focus()
            changeEstadoRestaStylo('normal')
            return false
        }

        revisarVueltoAbono()
        if (vueltoAbono() > 0 && !$("#chkVueltoBancoAbono").is(':checked')) {
            Toast.fire({
                icon: 'error',
                title: 'Confirme el efectivo que devuelve'
            })
            $("#loadinSavedAdd").hide()
            $("#btnsubmitAddAbono").attr('disabled', false)
            return false
        }

        let id = parseInt(sessionStorage.getItem('index'))
        if ((parseFloat(ArrayTarjetas[id].resta) - abono).toFixed(2) == parseFloat(confirma)) {
            addAbono()
        } else {
            Toast.fire({
                icon: 'error',
                title: 'Verifique el formulario'
            })
            $("#loadinSavedAdd").hide()
            $("#btnsubmitAddAbono").attr('disabled', false)
        }

    });

    /* var Toast = Swal.mixin({
         toast: true,
         position: 'top-end',
         showConfirmButton: false,
         timer: 2000
     });*/


    function addAbono() {

        $.post("./ajax/UsuarioAjax.php", function (r) {
            if (r === '0') {
                location.reload(true);
            }
        });
        var formData = new FormData($("#formAddAbonoConfirma")[0]);

        $.ajax({

            url: "./ajax/CarteraAjax.php?op=SaveOrUpdateAbono",
            type: "POST",
            data: formData,
            contentType: false,
            processData: false,
            success: function (datos) {

                if (datos.indexOf("ERROR:") !== -1) {
                    Toast.fire({
                        icon: 'error',
                        title: datos,
                        position: 'top',
                    })
                    $("#loadinSavedAdd").hide()
                    $("#btnsubmitAddAbono").attr('disabled', false)
                    changeEstadoRestaStylo('normal')
                } else {

                    $("#formAddAbono").trigger('reset')
                    $("#formAddAbonoConfirma").trigger('reset')
                    $("#cboBancoPagoAbono").val('').trigger('change')
                    $("#txtAbono-credito").focus()
                    Toast.fire({
                        icon: 'success',
                        title: datos,
                        position: 'top',
                    })
                    let id = parseInt(sessionStorage.getItem('index')) || 0
                    if (datos.indexOf("Cancelado") === -1) {
                        id = Math.min(id + 1, ArrayTarjetas.length - 1)
                    }
                    listarRuta(id)
                }

            }

        });
    }

    function buscarPersona(e) {
        e.preventDefault()
        let refPersona = $("#refBuscarPersona").val();
        let tipo_documento = $("#cboBusTipo_Documento").val()
        let num_documento = $("#txtbusNum_Documento").val()

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
                        })
                    } else {

                        Toast.fire({
                            icon: 'success',
                            title: datos
                        })
                        $("#frmCliente").trigger('reset')
                        $("#frmCliente input:hidden").val('')
                        cargarDataCliente(tipo_documento, num_documento);
                    }
                }
            });

        } else {
            cargarDataCliente(tipo_documento, num_documento);
        }
    }
    // crea tarjeta 

    function SaveOrUpdateCliente(e) {
        e.preventDefault();
        $.post("./ajax/UsuarioAjax.php", function (r) {
            if (r === '0') {
                location.reload(true);
            }
        });
        var formData = new FormData($("form#frmCliente")[0]);

        $.ajax({

            url: "./ajax/ClienteAjax.php?op=SaveOrUpdate",
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
                    let tipo_documento = $("#txt_tipo_documentoHidden").val()
                    let num_documento = $("#txt_num_DocumentoHidden").val()
                    Toast.fire({
                        icon: 'success',
                        title: datos
                    })
                    $("#frmCliente").trigger('reset')
                    $("#frmCliente input:hidden").val('')
                    cargarDataCliente(tipo_documento, num_documento);
                }

            }

        });
    };
    $("#buscarClientePannel").focus(function (event) {
        var clientes = [];
        $.each(ArrayTarjetas, function (index, val) {

            clientes.push(
                index +
                1 +
                " ° " +
                val.n_documento +
                " " +
                val.cliente +
                " V$" +
                val.valor +
                " R$ " +
                (val.resta) +
                " ||"
            ); //cedula
        });

        $("#buscarClientePannel").autocomplete({
            source: clientes,
        });
    });



    function recibidoSumaRecaudoCreditos(e) {


        if (e.data.cantidadAbonos >= 10 && e.data.cantidadAbonos < 100) {
            $("#canpanaAbonos").css({ 'margin-right': '0.5rem' })
        }
        if (e.data.cantidadAbonos >= 100 && e.data.cantidadAbonos < 1000) {
            $("#canpanaAbonos").css({ 'margin-right': '0.9rem' })
        }

        if (e.data.cantidadAbonos < 10) {
            $("#canpanaAbonos").css({ 'margin-right': '0' })
        }

        $("#txtCantidadAbonos").text(e.data.cantidadAbonos);

        $(".txtRecaudoSuma").text(e.data.recaudo);
        $(".txtCreditosSuma").text(e.data.creditos);
        $(".txtSegurosSuma").text(e.data.seguros);
        $(".txtCarteraSuma").text(e.data.cartera);
    }

    function errores(e) {
        console.log('ERROR: ' + e.message);
        console.log('Archivo: ' + e.filename);
        console.log('Línea: ' + e.lineno);
    }


    $("#formBuscarClienteEditar").submit(function (e) {
        e.preventDefault();
        let tipo_documento = $("#txt-tipo-documento-cliente").text()
        let num_documento = $("#txt-num-documento-cliente").text()

        cargarDataCliente(tipo_documento, num_documento, 'editar');

    });

    function getDifefencia() {
        $.getJSON("./ajax/CarteraAjax.php?op=getDiferencia",
            function (data) {
                let htmltext = '';
                if (data < 0) {
                    if (data * -1 > 30) {
                        htmltext = `<h3 class="card-title text-danger">
                        Ojo faltando <b>$${data}</b> y estamos sancionando
                        </h3>`
                    } else {
                        htmltext = `<h3 class="card-title text-danger">
                        Faltando <b>$${data} </b>
                        </h3>`
                    }
                } else if (data > 0) {
                    htmltext = `<h3 class="card-title text-warning">
                        Sobrando <b>$${data} </b>
                    </h3>`
                } else {
                    htmltext = `<h3 class="card-title text-success">
                        Diferencia 0
                    </h3>`
                }
                $("#txth3Diferenciapanel").html(htmltext);
            });
    }

    $("#txtmodalFormEstado").change(function (e) {
        if (e.target.value === 'otro') {
            $("#divOtroEstado").removeClass('hide');
            $("#ptxtInformacion1").addClass('hide');
        } else {
            $("#divOtroEstado").addClass('hide');
            $("#ptxtInformacion1").removeClass('hide');
        }
        $("#txtmodalnuevoestado").text(e.target.value);
    });

});//.ready

function presionoAbono(f, e) {
    const keynum = window.event ? window.event.keyCode : e.which;
    let id = parseInt(sessionStorage.getItem('index'))
    if (keynum != 32) {
        changeEstadoRestaStylo('normal')
        let abono = parseFloat($(f).val());

        if (!abono) {
            abono = 0
            $("#txtAbono-credito").val('')
            $("#txtCuotaHidden").val('')
            $("#resta-cliente-panel").text((parseFloat(ArrayTarjetas[id].resta) - abono).toFixed(2))
        } else {
            abono = parseFloat(abono)
            $("#txtCuotaHidden").val(abono)
            $("#resta-cliente-panel").text((parseFloat(ArrayTarjetas[id].resta) - abono).toFixed(2))
        }
    } else {
        if (parseFloat(ArrayTarjetas[id].resta) === 0) {
            searchInfoEsteCliente()
        }
    }
}


function presionoConfirmar(f) {
    changeEstadoRestaStylo('normal')
    let abono = parseFloat($("#txtAbono-credito").val());
    let id = parseInt(sessionStorage.getItem('index'))
    if (abono) {
        let resta = '' + (parseFloat(ArrayTarjetas[id].resta) - abono).toFixed(2).split('')
        const a = $(f).val();
        resta = resta.split(',')
        for (const key in a) {
            if (Object.hasOwnProperty.call(a, key)) {
                const element = a[key];
                if (element != resta[key]) {
                    changeEstadoRestaStylo('error')
                    break
                }

            }
        }
        if ((parseFloat(ArrayTarjetas[id].resta) - abono).toFixed(2) == parseFloat(a) && !parseFloat(ArrayTarjetas[id].recaudo)) {
            changeEstadoRestaStylo('success')
        }
    } else {
        changeEstadoRestaStylo('error')
    }

    //  alert(key)
}

function changeEstadoRestaStylo(op) {
    if (ArrayTarjetas.length === 0) return;
    if (parseFloat(ArrayTarjetas[parseInt(sessionStorage.getItem('index'))].recaudo) < 0) {

        return
    }
    switch (op) {
        case 'normal':
            $("#styloResta").attr('class', 'card card-outline card-primary m-0')
            break;
        case 'success':
            $("#styloResta").attr('class', 'card bg-gradient-success m-0')
            break;

        default:
            $("#styloResta").attr('class', 'card bg-gradient-danger  m-0')
            break;
    }
}

// listar la ruta
function listarRuta(nextIndex) {
    cerrarTelefonosCliente()
    $("#modal-telefonos-cliente").modal('hide')
    $.post("./ajax/UsuarioAjax.php", function (r) {
        if (r === '0') {
            location.reload(true);
        }
    });

    $.getJSON("./ajax/CarteraAjax.php?op=listarRuta",
        function (data, textStatus,) {
            if (textStatus === 'success') {
                ArrayTarjetas = data

                if (Number.isInteger(nextIndex)) {
                    sessionStorage.setItem('index', Math.min(nextIndex, Math.max(data.length - 1, 0)))
                }
                verFormPanel()
                enviarSumarRecaudoCreditos()
                actualizarResumenCajaCartera()
            } else {
                Toast.fire({
                    icon: 'error',
                    title: "Error Inesperado intente mas tarde"
                })
            }

        }
    ).fail(function () {
        Toast.fire({
            icon: 'error',
            title: 'No se pudo actualizar la cartera; inténtelo de nuevo'
        })
    });

}

function textoResumenCajaCartera(t) {
    const dinero = valor => '$' + Number(valor).toLocaleString('es-CO', { maximumFractionDigits: 2 })
    return `B ${dinero(t.base)} + Ef ${dinero(t.recaudo - t.recaudoBanco)}` +
        ` + O ${dinero(t.otro)} − C ${dinero(t.creditos - t.creditosBanco)}` +
        ` − G ${dinero(t.gastos)} = ${dinero(t.efectivo)}` +
        ` · Banco: +${dinero(t.recaudoBanco)} −${dinero(t.creditosBanco)}`
}

function actualizarResumenCajaCartera() {
    const linea = $("#resumenCajaCartera")
    if (!linea.length) return
    $.getJSON("./ajax/CarteraAjax.php?op=resumenCajaRuta", function (respuesta) {
        if (!respuesta.totales) {
            linea.text("Caja: Sin ruta abierta")
            return
        }
        linea.text(textoResumenCajaCartera(respuesta.totales))
    }).fail(function () {
        linea.text("Caja: No disponible; actualice la cartera")
    })
}

function ditetion(op) {
    if (ArrayTarjetas.length === 0) {
        verFormPanel()
        return
    }
    let id = sessionStorage.getItem('index');
    id = parseInt(id)
    let efecto = ''
    switch (op) {
        case 'one':
            id = 0
            break;

        case 'back':
            id--
            if (!ArrayTarjetas[id])
                id = 0;

            efecto = 'slide'
            break;
        case 'nex':
            id++
            if (!ArrayTarjetas[id])
                id = ArrayTarjetas.length - 1;
            efecto = 'drop'
            break;

        default:
            id = ArrayTarjetas.length - 1;
            break;
    }
    $("#panelVewDatos").effect('fade', 50, () => {
        // $("#panelVewDatos")..removeAttr( "style" ).hide().fadeIn();
    });
    sessionStorage.setItem('index', id)
    cargarDatosEnPanel()


}


function cargarBancosPagoCartera() {
    function mostrarSoloEfectivo() {
        $("#cboBancoPagoAbono").find("option:not([value='']):not([value='0'])").remove()
        $("#cboBancoPagoAbono").val('').trigger('change')
        $('#cboBancoPagoCredito').prop('disabled', true)
        Toast.fire({ icon: 'error', title: 'No se pudieron cargar las cuentas bancarias; solo puede elegir efectivo' })
    }
    $.ajax({
        url: './ajax/CarteraAjax.php?op=listarBancosPago',
        dataType: 'json',
        success: function (resp) {
            if (!resp || !resp.ok || !Array.isArray(resp.data)) {
                mostrarSoloEfectivo()
                return
            }
            const bancos = resp.data
            llenarSelectBancoPago('#cboBancoPagoAbono', bancos)
            llenarSelectBancoPago('#cboBancoPagoCredito', bancos)
            llenarSelectBancoPago('#cboBancoPagoInicial', bancos)
        },
        error: mostrarSoloEfectivo
    })
}

function llenarSelectBancoPago(selector, bancos) {
    const select = $(selector)
    if (!select.length) return
    const requiereEleccion = selector === '#cboBancoPagoInicial' || selector === '#cboBancoPagoAbono'
    const actual = requiereEleccion ? select.val() : (select.val() || '0')
    const opciones = selector === '#cboBancoPagoInicial'
        ? ['<option value="">Seleccione el medio</option>', '<option value="0">Efectivo (lo tiene quien registra)</option>']
        : selector === '#cboBancoPagoAbono'
            ? ['<option value="">Seleccione el medio de pago</option>', '<option value="0">Efectivo</option>']
            : ['<option value="0">Efectivo</option>']
    bancos.forEach(function (banco) {
        const titular = banco.titular ? ' · Titular: ' + banco.titular : ''
        const documento = banco.documento ? ' · NIT/CC ' + banco.documento : ''
        const texto = $('<div>').text(banco.nombre + ' - ' + banco.tipo + ' (' + banco.numero + ')' + titular + documento).html()
        opciones.push('<option value="' + banco.idbanco + '">' + texto + '</option>')
    })
    select.html(opciones.join(''))
    select.val(actual)
    if (select.val() === null) select.val(requiereEleccion ? '' : '0')
    select.trigger('change')
    if (selector === '#cboBancoPagoCredito') {
        select.find('option').first().text('Efectivo')
        select.find('option:not(:first)').each(function () {
            $(this).text('Consignación desde ' + $(this).text())
        })
    }
}

function clasificarUltimoRegistro(descripcion, estado, esPropio = false) {
    const texto = (descripcion || '').trim()
    const activo = estado === 'created' || estado === 'entregando'
    const verde = activo && esPropio ? (estado === 'entregando' ? '#1f5b2c' : '#4b965b') : '#343A40'
    const fechaIntereses = texto.match(/^(\d{4}\/\d{2}\/\d{2})->Intereces$/i)
    if (fechaIntereses) {
        return { tipo: 'Intereses', detalle: fechaIntereses[1], fondo: '#6F42C1', color: '#FFFFFF' }
    }

    const tipos = [
        [/^c-Inicial(?=$|\s|->|:)/i, 'c-Inicial', verde, '#FFFFFF'],
        [/^Abono(?=$|\s|->|:)/i, 'Abono', verde, '#FFFFFF'],
        [/^Inicial(?=$|\s|->|:)/i, 'Cuota inicial', '#FD7E14', '#000000'],
        [/^Descuento(?=$|\s|->|:)/i, 'Descuento', '#FFC107', '#000000'],
        [/^Inter(?:eses|eces|és)(?=$|\s|->|:)/i, 'Intereses', '#6F42C1', '#FFFFFF'],
        [/^Saldo corregido(?=$|\s|->|:)/i, 'Saldo corregido', '#343A40', '#FFFFFF'],
        [/^Pagado(?=$|\s|->|:)/i, 'Pagado', '#212529', '#FFFFFF'],
        [/^Cancelado(?=$|\s|->|:)/i, 'Cancelado', '#DC3545', '#FFFFFF'],
        [/^Cancelada(?=$|\s|->|:)/i, 'Cancelada', '#DC3545', '#FFFFFF']
    ]
    for (const [patron, tipo, fondo, color] of tipos) {
        const coincidencia = texto.match(patron)
        if (coincidencia) {
            const detalle = texto.slice(coincidencia[0].length).replace(/^\s*(?:->|:)\s*/, '').trim()
            return { tipo, detalle, fondo, color }
        }
    }
    return { tipo: 'Movimiento', detalle: texto, fondo: '#DC3545', color: '#FFFFFF' }
}

function formatearNombrePersona(nombre) {
    return (nombre || '').trim().toLocaleLowerCase('es')
        .replace(/(^|[\s-])(\p{L})/gu, (_, separador, letra) => separador + letra.toLocaleUpperCase('es'))
}

function cargarDatosEnPanel() {
    cerrarTelefonosCliente()
    $("#modal-telefonos-cliente").modal('hide')
    $("#usuario_quien_creo").html('');
    if (ArrayTarjetas.length === 0) return

    $("#collapseNine").collapse('hide')
    setTimeout(pasarfocoAbono, 300)
    $("#loadinSavedAdd").hide()
    $("#btnsubmitAddAbono").attr('disabled', false)

    $("#formAddAbono").trigger('reset')
    $("#formAddAbonoConfirma").trigger('reset')
    $("#cboBancoPagoAbono").val('').trigger('change')
    $("#chkVueltoBancoAbono").prop('checked', false)
    let id = sessionStorage.getItem('index');

    if (!id) {
        sessionStorage.setItem('index', 0);
        id = 0;
    } else if (!ArrayTarjetas[id]) {
        id = ArrayTarjetas.length - 1
        sessionStorage.setItem('index', id);
    }

    id = parseInt(id)
    changeEstadoRestaStylo('normal')
    if (parseFloat(ArrayTarjetas[id].recaudo) < 0) {
        $("#styloResta").attr('class', 'card bg-gradient-warning  m-0')
        $("#resta-cliente-panel").css({
            width: '50%'
        });
        $("#recaudo-cliente-panel").text(ArrayTarjetas[id].recaudo * -1)
        $("#recaudo-cliente-panel").removeClass('hide')

    } else {
        $("#recaudo-cliente-panel").addClass('hide')
        $("#resta-cliente-panel").css({
            width: '100%'
        });
    }
    const fechaEstado = cunatoTiempotranscurrido(ArrayTarjetas[id])
    //.name ? 'hace ' + cunatoTiempotranscurrido(ArrayTarjetas[id].modo, ArrayTarjetas[id].fecha_at).name : 
    // moment(element[4]).locale("es").fromNow(true)
    // console.log(moment().format('L'));
    //cunatoTiempotranscurrido(ArrayTarjetas[id].modo, ArrayTarjetas[id].fecha_at).name ? 'hace ' + cunatoTiempotranscurrido(ArrayTarjetas[id].modo, ArrayTarjetas[id].fecha_at).name : moment(ArrayTarjetas[id].fecha_at).locale("es").fromNow()
    $("#txtposition").text((id + 1) + '/' + ArrayTarjetas.length)
    $("#txtrefTarjetaHidden").val(ArrayTarjetas[id].refTarjeta)
    $("#foto-cliente-panel").attr('src', ArrayTarjetas[id].foto || 'https://res.cloudinary.com/dbxjlydih/image/upload/v1670536297/persona/silueta-otro.png')
    $("#txtInformacion-info").text(fechaEstado.info);
    $("#txtConseptoCredito-info").text(ArrayTarjetas[id].consepto);
    $("#txtfecha-at-credito-info2").text(getDiaSemana(moment(ArrayTarjetas[id].fecha_at).day()) + ' ' + moment(ArrayTarjetas[id].fecha_at).format('ll'))
    // $("#txtfecha-at-credito-info").text(moment(ArrayTarjetas[id].fecha_at).locale("es").fromNow())

    $("#txtfecha-at-credito-info").text(fechaEstado.name ? 'hace ' + fechaEstado.tiempo + fechaEstado.name : moment(ArrayTarjetas[id].fecha_at).locale("es").fromNow())


    $("#txtValorCuota-info").text('$ ' + fechaEstado.valorCuota);
    $("#txtCuotasPagas-info").text(fechaEstado.cuotasPagas + fechaEstado.cuotasPagasPicos);
    $("#txtDescripcionCredito-info").text(ArrayTarjetas[id].descripcion);
    $("#txtSerieCredito-info").text(ArrayTarjetas[id].serie)
    $("#txtObligacioncredito-info").text(ArrayTarjetas[id].numero)
    $("#txtModoCredito-info").text(ArrayTarjetas[id].modo)
    $("#txtPlazo-info").text(ArrayTarjetas[id].plazo)
    $("#txtAcuerdo-info").text(ArrayTarjetas[id].acuerdo)
    $("#txtEstado-info").text(ArrayTarjetas[id].estado)
    $("#txtNumBoleta-info").text(ArrayTarjetas[id].ut_adi_num)
    $("#nombre-cliente-panel").text(capitalizarPalabras(ArrayTarjetas[id].cliente))
    $("#apodo-cliente-panel").text(capitalizarPalabras(ArrayTarjetas[id].apodo))
    $("#ocupacion-cliente-panel").text(capitalizarPalabras(ArrayTarjetas[id].ocupacion))
    $("#t_documento-cliente-panel").text(ArrayTarjetas[id].t_documento)
    $("#documento-cliente-panel").text(ArrayTarjetas[id].n_documento)
    $("#telefono-cliente-panel").text(ArrayTarjetas[id].tel)

    $("#bResultadoValoresValor").text(ArrayTarjetas[id].valor)
    $("#bResultadoValoresCosto").text(ArrayTarjetas[id].costo)
    ArrayTarjetas[id].ut_adi_valor == "0.00" ? $("#divPanelAdicional").hide() : $("#divPanelAdicional").show()
    $("#bResultadoValoresSeguro").text(ArrayTarjetas[id].ut_adi_valor)
    $("#resta-cliente-panel").text(parseFloat(ArrayTarjetas[id].resta).toFixed(2))
    pintarCintaCalificacionCliente(ArrayTarjetas[id].calificacion, {
        score: ArrayTarjetas[id].rating_score,
        source: ArrayTarjetas[id].rating_source,
        confidence: ArrayTarjetas[id].rating_confidence
    });

    const ultimoAbono = ArrayTarjetas[id]
    if (ultimoAbono.ultimo_abono === null || ultimoAbono.ultimo_abono === undefined) {
        $("#ultimo-abono-panel").hide()
    } else {
        const idVisor = Number($("#ultimo-abono-panel").attr('data-viewer-user-id'))
        const esPropio = idVisor > 0 && Number(ultimoAbono.ultimo_abono_idusuario) === idVisor
        const registro = clasificarUltimoRegistro(
            ultimoAbono.ultimo_abono_descripcion, ultimoAbono.ultimo_abono_estado, esPropio
        )
        $("#ultimo-abono-panel").css({ 'background-color': registro.fondo, color: registro.color })
        $("#ultimo-abono-tipo").text(registro.tipo)
        $("#ultimo-abono-descripcion").text(registro.detalle)
        $("#ultimo-abono-detalle").toggle(Boolean(registro.detalle))
        const origen = ultimoAbono.ultimo_abono_origen === 'android'
            ? 'Registrado desde la app'
            : ultimoAbono.ultimo_abono_origen === 'web'
                ? 'Registrado desde la web'
                : 'No registrado (abono anterior a este control)'
        const estado = ultimoAbono.ultimo_abono_estado === 'saved'
            ? 'Guardado'
            : ultimoAbono.ultimo_abono_estado === 'created'
                ? 'Creado'
                : ultimoAbono.ultimo_abono_estado === 'entregando'
                    ? 'Entregando'
                : ultimoAbono.ultimo_abono_estado || 'No registrado'
        $("#ultimo-abono-importe").text('$ ' + Math.abs(Number(ultimoAbono.ultimo_abono)).toFixed(2))
        $("#ultimo-abono-origen").text(origen)
        $("#ultimo-abono-sincronizacion").text('Guardado en el servidor')
        $("#ultimo-abono-usuario").text(formatearNombrePersona(ultimoAbono.ultimo_abono_usuario) || 'No registrado')
        $("#ultimo-abono-estado").text(estado)
        $("#ultimo-abono-fecha").text(ultimoAbono.ultimo_abono_fecha || '')
        $("#ultimo-abono-panel").show()
    }

    if (screen.width < 700) {
        const textVal = 'V $'
        const textCos = 'C $'
        const textSeg = 'S $'
        $("#txtValorViewPanel").text(textVal);
        $("#txtCostoViewPanel").text(textCos);
        $("#txtSeguroViewPanel").text(textSeg);


        $(".bResultadoValores").prev().css({
            'font-size': '1rem'
        });
        $(".bResultadoValores").css({
            'font-size': '1.2rem'
        });


    }
    $("#alertaDelCliente").attr('class', 'hide')
    $("#iconDeAlertaDelCliente").attr('class', '')
    $("#tituloDeAlertaDelCliente").text('');
    $("#txtDeAlertaDelCliente").text('');
    $("#divcomentarios").html('');
    $("#divcomentariosloading").show();
    banderaListComentarios = ArrayTarjetas[id].refCliente
    setTimeout(listComentarios, 2000, ArrayTarjetas[id].refCliente)
    setTimeout(listCreated, 4000, ArrayTarjetas[id])


}
function listCreated(tar) {
    if (banderaListComentarios === tar.refCliente) {
        $.getJSON("./ajax/CarteraAjax.php?op=usercreated", {ref:tar.refTarjeta},
            function (data, textStatus, jqXHR) {
                if (textStatus==='success') {
                   // console.log(moment(data.fecha).format('hh:mm A'));
                    
                   $("#usuario_quien_creo").html(`
        <b class="ml-2">Lo registro: <mark>${capitalizarPalabras(data.str_nombres)} ${capitalizarPalabras(data.str_apellidos)  }</mark></b>
    <b class="ml-2"> <mark>${moment(data.fecha).format('hh:mm A')}</mark></b>`);

                }

                
            }
        );
        
    }

}
// dias semanas quincenas meses
function cunatoTiempotranscurrido(tarjeta) {
    let name = ''
    let info = 'al dia'
    let infoValor = 0
    let cuotasPagasPicos = 0
    const valorCuota = parseFloat((parseFloat(tarjeta.valor) + parseFloat(tarjeta.inicial)) / parseInt(tarjeta.plazo)).toFixed(2);
    const cuotas = (parseFloat(tarjeta.valor) + parseFloat(tarjeta.inicial) - parseFloat(tarjeta.resta)) / valorCuota
    let cuotasPagas = Math.floor(cuotas)


    const manejoPicos = (parseFloat(tarjeta.valor) + parseFloat(tarjeta.inicial) - parseFloat(tarjeta.resta)) - (cuotasPagas * valorCuota)
    cuotasPagasPicos = manejoPicos ? ' mas $ ' + manejoPicos.toFixed(2) : '';




    // Crea dos objetos de momento con las fechas para comparar
    const hoy = new moment()
    let days
    if (hoy.format('L') == new moment(tarjeta.fecha_at).format('L')) {
        name = false
    } else {
        var diasEntreFechas = function (desde, hasta) {
            var dia_actual = desde;
            var fechas = [];
            while (dia_actual.isSameOrBefore(hasta)) {
                fechas.push(dia_actual.format('YYYY-MM-DD'));
                dia_actual.add(1, 'days');
            }
            return fechas;
        };

        var desde = moment(tarjeta.fecha_at);
        var hasta = moment();
        var results = diasEntreFechas(desde.add(1, 'days'), hasta);

        //console.log(results);
        days = results.length
        switch (tarjeta.modo) {
            case 'Semanal':
                let contador_semanas = 0


                const fecha_init_semanal = moment(tarjeta.fecha_at.slice(0, 10));
                var daySemanal = fecha_init_semanal.day();

                for (let clave in results) {
                    var date_sem = moment(results[clave]);
                    var dow_sem = date_sem.day();
                    if (daySemanal === dow_sem) {
                        contador_semanas++
                    }
                }
                days = contador_semanas
                name = contador_semanas > 1 ? ' semanas' : ' semana'
                const real_sem = days
                if (real_sem > tarjeta.plazo) {

                    info = `vencida ${real_sem - tarjeta.plazo} ${real_sem - tarjeta.plazo === 1 ? ' semanas' : ' semana'}`
                } else {
                    const sem_info = real_sem - cuotasPagas
                    if (sem_info < 0) {
                        info = `adelantada ${sem_info * -1} ${sem_info * -1 > 1 ? ' semanas' : ' semana'}`
                    } else if (sem_info > 0) {
                        info = `atrasada ${sem_info} ${sem_info > 1 ? ' semanas' : ' semana'}`
                    }

                }

                break;
            case 'Quincenal':
                let contador_quinsenas = 0
                let init_quin = 0
                for (let clave in results) {
                    init_quin++
                    if (init_quin === 15) {
                        contador_quinsenas++
                        init_quin = 0
                    }
                }

                days = contador_quinsenas
                name = contador_quinsenas > 1 ? ' quincenas' : ' quincena'
                const real_quin = days
                if (real_quin > tarjeta.plazo) {
                    info = `vencida ${real_quin - tarjeta.plazo} ${real_quin - tarjeta.plazo === 1 ? ' quincena' : ' quincenas'}`

                } else {
                    const quin_info = real_quin - cuotasPagas
                    if (quin_info < 0) {
                        info = `adelantada ${quin_info * -1} ${quin_info * -1 > 1 ? ' quincenas' : ' quincena'}`
                    } else if (quin_info > 0) {
                        info = `atrasada ${quin_info} ${quin_info > 1 ? ' quincenas' : ' quincena'}`
                    }

                }

                break;
            case 'Mensual':
                let contador_mes = 0
                const fecha_init_mes = tarjeta.fecha_at.slice(8, 10);
                for (let clave in results) {
                    var date_mes = results[clave].slice(8, 10);

                    if (fecha_init_mes === date_mes) {
                        contador_mes++
                    }
                }

                days = contador_mes
                name = contador_mes > 1 ? ' meses' : ' mes'
                const real_mes = days
                if (real_mes > tarjeta.plazo) {
                    info = `vencida ${real_mes - tarjeta.plazo} ${real_mes - tarjeta.plazo === 1 ? ' mes' : ' meses'}`
                } else {
                    const mes_info = real_mes - cuotasPagas
                    if (mes_info < 0) {
                        info = `adelantada ${mes_info * -1} ${mes_info * -1 > 1 ? ' meses' : ' mes'}`
                    } else if (mes_info > 0) {
                        info = `atrasada ${mes_info} ${mes_info > 1 ? ' meses' : ' mes'}`
                    }

                }

                break;
            default:
                let contador_domingos = 0
                name = days === 1 ? ' dia' : ' dias'
                for (let clave in results) {

                    var date = moment(results[clave]);
                    var dow = date.day();
                    if (!dow) {
                        contador_domingos++
                    }

                }
                const real_dias = days - contador_domingos

                if (real_dias > tarjeta.plazo) {
                    info = `vencida ${real_dias - tarjeta.plazo} ${real_dias - tarjeta.plazo === 1 ? ' dia' : ' dias'}`
                } else {
                    const diasinfo = real_dias - cuotasPagas
                    if (diasinfo < 0) {
                        info = `adelantada ${diasinfo * -1} ${diasinfo * -1 === 1 ? ' dia' : ' dias'}`
                    } else if (diasinfo > 0) {
                        info = `atrasada ${diasinfo} ${diasinfo === 1 ? ' dia' : ' dias'}`
                    }

                }


                break;
        }
    }
    return {
        tiempo: days,
        name,
        info,
        infoValor,
        cuotasPagas,
        cuotasPagasPicos,
        valorCuota
    }
}

function listComentarios(refCliente) {
    if (banderaListComentarios === refCliente) {

        $.getJSON("./ajax/ClienteAjax.php?op=lisComentarios", { refCliente },
            function (data, textStatus) {
                if (textStatus === 'success') {
                    const comentarios = data.filter(c => c[5] === 'comentario')
                    const alertaData = data.find(c => c[5] === 'alerta')
                    if (alertaData) {


                        const alerta = alertaData[1].split('/,')

                        $("#smallBottonEliminarAlert").html(
                            `<button onclick="eliminarComentario('${alertaData[0]}')" type="button" class="close">×</button>`
                        );
                        $("#alertaDelCliente").attr('class', 'alert alert-' + alerta[1] + ' alert-dismissible m-0 ')
                        $("#iconDeAlertaDelCliente").attr('class', 'icon fas ' + alerta[0])
                        $("#tituloDeAlertaDelCliente").text(alerta[2]);
                        $("#txtDeAlertaDelCliente").text(alerta[3]);


                    }
                    const eles = []
                    for (let i = 0; i < comentarios.length; i++) {
                        const element = comentarios[i];
                        eles.push(`
                        <div class="card-comment">
         
                            <img class="img-circle img-sm" src="${element[3]}" alt="User Image">

                            <div class="comment-text">
                                <span class="username">
                                ${element[2]}
                                <span class="text-muted float-right">${moment(element[4]).locale("es").fromNow(true)}</span>
                                   
                                </span>
                        
                                    
                                        
                                    
                                ${element[1]}
                            </div>
                            <i onclick="eliminarComentario('${element[0]}')" class="fa-regular fa-square-minus fa-lg mr-1" style="cursor:pointer;"></i>
                            
                            <i onclick="editComentario('${element[0]}', '${element[1]}')" class="fa-sharp fa-solid fa-pen-to-square fa-lg ml-1" style="cursor:pointer;"></i>
                        </div>
                        `)
                    }

                    $("#txtCantidadComentarios").text(`${comentarios.length} ${comentarios.length === 1 ? 'Comentario' : 'Comentarios'}`);
                    $("#divcomentariosloading").hide();
                    $("#divcomentarios").html(eles.join(''));
                }



            }
        );
    }
}




function pasarfocoAbono() {

    $("#txtAbono-credito").focus()
}

//Viestas

function verLoadin(title, body) {
    $("#verSubirTarjetasEcxel").hide();
    $("#inputBuscarClienteRuta").hide();
    $("#verEcabezado").hide();
    $("#verOrdenarMultiple").hide();
    $("#verformRecibirCuentas").hide();
    $("#verInformacionCliente").hide()
    $("#verFormCliente").hide();
    $("#verFormNuevoCredito").hide();
    $("#verPanel").hide();
    $("#verImprimir").hide();
    $("#txtTitleLoading").text(title);
    $("#txtinfoLoading").text(body);

    $("#verLoadin").show();
}



function verFormPanel() {
    $("#verSubirTarjetasEcxel").hide();
    $("#inputBuscarClienteRuta").show();
    $("#verEcabezado").show();
    $("#verLoadin").hide();
    $("#verOrdenarMultiple").hide();
    $("#verformRecibirCuentas").hide();
    $("#verInformacionCliente").hide()
    $("#verFormCliente").hide();
    $("#verFormNuevoCredito").hide();
    $("#verImprimir").hide();
    $("#verPanel").show();
    if (ArrayTarjetas.length > 0) {
        $("#panelVewNoDatos").hide();
        $("#panelVewDatos").show();

    } else {
        $("#panelVewNoDatos").show();
        $("#panelVewDatos").hide();

    }
    cargarDatosEnPanel()
}
function verFormCliente() {
    const nuevoCliente = !$("#txtRefCliente").val();
    const limiteEmpleado = $("#limiteCupoEmpleado");
    const max = nuevoCliente ? limiteEmpleado.attr("data-max") : null;
    if (max !== undefined && max !== null) {
        $("#txt_max_credito").attr("max", max);
    } else {
        $("#txt_max_credito").removeAttr("max");
    }
    limiteEmpleado.toggle(nuevoCliente);
    $("#verSubirTarjetasEcxel").hide();
    $("#inputBuscarClienteRuta").hide();
    $("#verEcabezado").show();
    $("#verPanel").hide();
    $("#verOrdenarMultiple").hide();
    $("#verformRecibirCuentas").hide();
    $("#verInformacionCliente").hide()
    $("#verFormNuevoCredito").hide();
    $("#verImprimir").hide();
    $("#verFormCliente").show();
}
function verInformacionCliente() {
    $("#verSubirTarjetasEcxel").hide();
    $("#inputBuscarClienteRuta").hide();
    $("#verEcabezado").show();
    $("#verPanel").hide();
    $("#verOrdenarMultiple").hide();
    $("#verformRecibirCuentas").hide();
    $("#verFormCliente").hide();
    $("#verFormNuevoCredito").hide();
    $("#verImprimir").hide();
    $("#verInformacionCliente").show()
}
function verformRecibirCuentas() {
    $("#verSubirTarjetasEcxel").hide();
    $("#inputBuscarClienteRuta").hide();
    $.getJSON("./ajax/CarteraAjax.php?op=valid",
        function (data, textStatus) {
            if (textStatus === 'success') {
                $("#txtrefSucursalContabiliddHidden").val(data)
                DatosCobro(false)
                $("#verEcabezado").show();
                $("#verPanel").hide();
                $("#verOrdenarMultiple").hide();
                $("#verInformacionCliente").hide()
                $("#verFormCliente").hide();
                $("#verFormNuevoCredito").hide();
                $("#verImprimir").hide();
                $("#verformRecibirCuentas").show();
            }

        }
    );

}
function verOrdenarMultiple() {
    $("#verSubirTarjetasEcxel").hide();
    $("#inputBuscarClienteRuta").hide();
    $("#verEcabezado").show();
    $("#verPanel").hide();
    $("#verformRecibirCuentas").hide();
    $("#verInformacionCliente").hide()
    $("#verFormCliente").hide();
    $("#verFormNuevoCredito").hide();
    $("#verImprimir").hide();
    $("#verOrdenarMultiple").show();
}
function verFormNuevoCredito() {
    $("#verSubirTarjetasEcxel").hide();
    $("#inputBuscarClienteRuta").hide();
    $("#txtviewSerie").text($("#txt_ultima_serieHidden").val())
    $("#txtObligacion").attr('placeholder', $("#txt_ultimo_numeroHidden").val())
    $("#verPanel").hide();
    $("#verformRecibirCuentas").hide();
    $("#verInformacionCliente").hide()
    $("#verFormCliente").hide();
    $("#verOrdenarMultiple").hide();
    $("#verEcabezado").hide();
    $("#verImprimir").hide();
    $("#verFormNuevoCredito").show();
    $("#txtValor").focus()
}

function verImprimir() {
    $("#verSubirTarjetasEcxel").hide();
    $("#inputBuscarClienteRuta").hide();
    $("#verEcabezado").show();
    $("#verPanel").hide();
    $("#verOrdenarMultiple").hide();
    $("#verformRecibirCuentas").hide();
    $("#verFormCliente").hide();
    $("#verFormNuevoCredito").hide();
    $("#verInformacionCliente").hide();
    $("#verImprimir").show();
    listarParaImprimir(ArrayTarjetas);
}

function verSubirTarjetasEcxel() {
    $("#inputBuscarClienteRuta").hide();
    $("#verEcabezado").show();
    $("#verPanel").hide();
    $("#verOrdenarMultiple").hide();
    $("#verformRecibirCuentas").hide();
    $("#verFormCliente").hide();
    $("#verFormNuevoCredito").hide();
    $("#verInformacionCliente").hide();
    $("#verImprimir").hide();
    $("#verSubirTarjetasEcxel").show();
}

function cargarDataCliente(tipo_documento, num_documento, editar) {// funcion que llamamos del archivo ajax/CategoriaAjax.php linea 52
    $.post("./ajax/UsuarioAjax.php", function (r) {
        if (r === '0') {
            location.reload(true);
        }
    });



    $.getJSON("./ajax/CarteraAjax.php?op=buscarCliente", { tipo_documento, num_documento },
        function (data, textStatus) {

            if (textStatus === 'success') {
                if (!editar && (data === null || (data && typeof data === 'object' && !data.refCliente))) {
                    $("#frmCliente").trigger('reset');
                    $("#frmCliente input:hidden").val('');
                }
                $("#txt_tipo_documento").val(tipo_documento)
                $("#txt_tipo_documentoHidden").val(tipo_documento)
                $("#txt_num_DocumentoHidden").val(num_documento)
                $("#txt_num_Documento").val(num_documento)
                if (data === 0) {
                    Toast.fire({
                        icon: 'error',
                        title: 'Error incompleto'
                    })
                    location.reload(true);
                } else if (data === 1) {
                    Swal.fire({
                        title: 'Falta configurar comprobante?',
                        text: "Si lo deceas puedes configurar comprobantes de obligacion!",
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

                } else if (data === null) {
                    $("#modal-xl").modal('hide');
                    //   $("#modal-xl").css('display',)
                    verFormCliente()
                } else {
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


                        $("#txt_tipo_comprobanteHidden").val(data.tipo_comprobante)


                        $("#txt_ultima_serieHidden").val(data.ultima_serie)
                        $("#txt_ultimo_numeroHidden").val(data.ultimo_numero)
                        $("#referencia-cliente").val(data.refCliente)
                        $("#img-cliente").attr('src', data.foto);
                        $("#txt-name-cliente").text(capitalizarPalabras(data.nombres + ' ' + data.apellidos));
                        $("#txt-apodo-cliente").text(capitalizarPalabras(data.apodo));
                        $("#txt-sexo-cliente").text(data.sexo);
                        $("#txt-tipo-documento-cliente").text(data.t_documento);
                        $("#txt-num-documento-cliente").text(data.n_documento);
                        $("#editarDocumentoCliente").data("editDocument", data.refPersona);

                        $("#txt-tel-cliente").text(data.telefono);
                        $("#txt-maxcredi-cliente").text(data.max_credito);
                        $("#txt-cupo-cliente").text(parseFloat(data.max_credito - data.total_deuda_actual).toFixed(2));

                        $("#pTxtDireccionCliente").text(data.departamento + ', ' + data.ciudad + ', ' + data.barrio + ', ' + data.calle);




                        // falta boton nuevo credito
                        let trActivas = []
                        let trCanceladas = []
                        let nactivas = 0
                        let ncanceladas = 0

                        for (const [key, value] of Object.entries(data.tarjetas)) {

                            if (value.id) {
                                const tar = value.targeta.split(';')
                                let abonos = ''
                                if (value.datos) {
                                    // console.log(value.datos);
                                    const allAbns = value.datos//.substring(1, value.datos.length - 1)

                                    const abns = allAbns.split(';')

                                    for (const [key, cuota] of Object.entries(abns.filter(Boolean))) {
                                        const a = cuota.split(',')
                                        const xx = parseFloat(a[1]) * -1
                                        abonos += `${xx},,,${a[3]},,,${a[0]}<=>`;


                                    }




                                }


                                ncanceladas++
                                trCanceladas.push(`
                                <tr>
                                    <td>${ncanceladas}</td>
                                    <td>${tar[6]}</td>
                                    <td>${value.razon_social}</td>
                                    <td>${tar[tar.length - 1]}</td>
                                    <td>${parseFloat(tar[1]).toFixed(2)}</td>
                                    <td>${parseFloat(tar[5]).toFixed(2)}</td>
                                    <td>${value.fecha}</td>
                                    <td>${parseFloat(value.val_can).toFixed(2)}</td>
                                    <td onclick="verDescripcionAbonos(\'${abonos}\',${parseFloat(tar[1])})">Como Pago</td>
                                </tr>
                                `)

                            } else {
                                var cancelo = 0
                                var fechaFin = ''
                                if (value.abonos) {

                                    var allAbonos = value.abonos?.split('<=>')

                                    cancelo = allAbonos[allAbonos.length - 1].split(',,,')[0]
                                    fechaFin = allAbonos[allAbonos.length - 1].split(',,,')[2]

                                }

                                if (value.estado === 'cancelado') {
                                    ncanceladas++
                                    trCanceladas.push(`
                                    <tr>
                                        <td>${ncanceladas}</td>
                                        <td>${value.fecha_at}</td>
                                        <td>${value.codigo}</td>
                                        <td>${value.concepto}</td>
                                        <td>${value.valor}</td>
                                        <td>${value.costo}</td>
                                        <td>${fechaFin}</td>
                                        <td>${cancelo}</td>
                                        <td onclick="verDescripcionAbonos(\'${value.abonos}\',${parseFloat(value.valor)})">Como Pago</td>
                                    </tr>
                                    `)
                                } else {
                                    nactivas++
                                    trActivas.push(`
                                    <tr>
                                        <td>${nactivas}</td>
                                        <td>${value.fecha_at}</td>
                                        <td>${value.codigo}</td>
                                        <td>${value.concepto}</td>
                                        <td>${value.valor}</td>
                                        <td>${value.costo}</td>
                                        <td>${value.resta}</td>
                                        <td>${value.estado}</td>
                                        <td onclick="verDescripcionAbonos(\'${value.abonos}\',${parseFloat(value.valor)})">como va pagando</td>
                                    </tr>
                                    `)
                                }


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
            } else {
                Toast.fire({
                    icon: 'error',
                    title: 'Error Inesperado'
                })
            }

        }
    );
}
function verDescripcionAbonos(allAbonos, valo) {
    var tabla = $("#tblDescripcionHistorialPagos").DataTable();
    tabla.clear().draw();
    if (allAbonos) {
        let pagado = 0
        var abs = allAbonos.split('<=>')
        abs = abs.filter(Boolean);

        for (let i = 0; i < abs.length; i++) {
            const strAbono = abs[i];
            const abono = strAbono.split(',,,');
            const dec_cuota = parseFloat(abono[0])
            pagado += dec_cuota
            tabla.row
                .add([
                    (i + 1),
                    abono[0],
                    valo + pagado,
                    moment(abono[2]).format('ll'),
                    abono[1],

                ])
                .draw(false);

        }
        $("#modal-historial-pagos").modal('show');
    }

}

function searchInfoEsteCliente() {
    const id = parseInt(sessionStorage.getItem('index')) || 0;
    const tipo_documento = ArrayTarjetas[id].t_documento;
    const num_documento = ArrayTarjetas[id].n_documento;
    cargarDataCliente(tipo_documento, num_documento)
}

function buscarClienteRuta(e) {
    e.preventDefault();
    let valor = $("#buscarClientePannel").val();
    if (valor === "") return false;
    let es = valor.split(" ", 1);
    es[0]--;
    if (isNaN(es[0])) return 0;
    if (ArrayTarjetas[es[0]] === undefined) {
        return 0;
    } else {
        sessionStorage.setItem("index", es[0]);
    }
    cargarDatosEnPanel();
    $("#buscarClientePannel").val("");
    $("input#txtAbono-credito").focus();
}

function enviarSumarRecaudoCreditos() {
    trabajador.postMessage(ArrayTarjetas);
}