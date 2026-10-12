jQuery(document).ready(init)
function init() {

    $("body").on("keypress", function (e) {
        const keynum = window.event ? window.event.keyCode : e.which;
        if ($("#verInformacionCliente").is(':visible') && keynum === 32) {
            e.preventDefault();
            $("#modal-nuevo-credito").modal('show');
        }
    });
    $("#btnFormNewCredito").click(function (e) {
        e.preventDefault();
        if (banderasavedcredito === 0) {
            banderasavedcredito = 1
            $("form#formSaveNewCredit").submit()
        }
    });

    $("form#formSaveNewCredit").submit(function (e) {
        e.preventDefault();
        if (banderasavedcredito === 1) {
            banderasavedcredito = 2
            const total = Math.round((Number($("#txtValor").val()) || 0) * 100)
            const cost = Math.round((Number($("#txtCosto").val()) || 0) * 100)
            const isSuperAdministrator = Number($("#formSaveNewCredit").data("super-administrator")) === 1
            const pricingIsValid = total > 0 && cost > 0 && total >= cost &&
                (isSuperAdministrator || total * 100 >= cost * 120)
            if (!pricingIsValid) {
                Toast.fire({
                    icon: 'error',
                    title: isSuperAdministrator
                        ? 'El valor total no puede ser menor que el costo.'
                        : 'Mínimo 20% de ganancia.'
                })
                $("#txtValor").focus()
                banderasavedcredito = 0
                return
            }
            const consepto = $("#txtConsepto").val()
            if (consepto === 'Articulo' && Number($("#txtCuotaInicial").val()) > 0 &&
                !/^(0|[1-9]\d*)$/.test($("#cboBancoPagoInicial").val() || '')) {
                Toast.fire({ icon: 'error', title: 'Indique cómo recibió la cuota inicial' })
                $("#cboBancoPagoInicial").focus()
                banderasavedcredito = 0
                return
            }
            const inputs = $("#formSaveNewCredit input")
            const textarea = $("#formSaveNewCredit textarea")
            for (const [i, v] of Object.entries({ ...inputs, ...textarea })) {
                const input = $(v)
                switch (input.attr('id')) {
                    case 'txtObligacion':
                        break;
                    case 'txtdescricion':
                        if (consepto === 'Articulo' && input.val() === '') {
                            $("#txtdescricion").focus();
                            Toast.fire({
                                icon: 'error',
                                title: '¡Complete el Formulario!'
                            })
                            banderasavedcredito = 0;
                            return;
                        }
                        break;
                    case 'txtCuotaInicial':
                        if (consepto === 'Articulo' && input.val() === '') {
                            $("#txtCuotaInicial").focus();
                            Toast.fire({
                                icon: 'error',
                                title: '¡Complete el Formulario!'
                            })
                            banderasavedcredito = 0;
                            return;
                        }
                        break;
                    case 'txtValor':
                        if (input.val() === '') {
                            $("#txtValor").focus();
                            Toast.fire({
                                icon: 'error',
                                title: '¡Complete el Formulario!'
                            })
                            banderasavedcredito = 0;
                            return;
                        }
                        break;
                    case 'txtCosto':
                        if ($("#txtValor").is(':focus')) {
                            $("#txtCosto").focus();
                            Toast.fire({
                                icon: 'error',
                                title: '¡Complete el Formulario!'
                            })
                            banderasavedcredito = 0;
                            return;
                        }
                        break;
                    case 'txtModo':
                        if (input.val() === '') {
                            $("#txtModo").focus();
                            Toast.fire({
                                icon: 'error',
                                title: '¡Complete el Formulario!'
                            })
                            banderasavedcredito = 0;
                            return;
                        }
                        break;
                    case 'txtTiempo':
                        if (input.val() === '') {
                            $("#txtTiempo").focus();
                            Toast.fire({
                                icon: 'error',
                                title: '¡Complete el Formulario!'
                            })
                            banderasavedcredito = 0;
                            return;
                        }
                        break;
                    case 'txtRecaudo':
                        if (consepto != 'Articulo' && input.val() === '') {
                            if ($("#txtHiddenAdicional").val() == 'boleta' || $("#txtHiddenAdicional").val() == 'seguro') {
                                $("#txtRecaudo").focus();
                                Toast.fire({
                                    icon: 'error',
                                    title: '¡Complete el Formulario!'
                                })
                                banderasavedcredito = 0;
                                return;
                            }
                        }
                        break;
                    case 'txtNumBoleta':
                        if (consepto != 'Articulo' && input.val() === '') {
                            if ($("#txtHiddenAdicional").val() == 'boleta') {
                                $("#txtNumBoleta").focus();
                                Toast.fire({
                                    icon: 'error',
                                    title: '¡Complete el Formulario!'
                                })
                                banderasavedcredito = 0;
                                return;
                            }

                        }
                        break;

                    default:
                        break;
                }

            }
            let id = parseInt(sessionStorage.getItem('index')) || 0
            const rdo = sessionStorage.getItem('rdo')

            if (ArrayTarjetas.length === 0 || !ArrayTarjetas) {
                $("#txtitemHidden").val('1');
            } else {
                let item = parseFloat(ArrayTarjetas[id].item)
                if (rdo === 'rdoPrimera') {
                    $("#txtitemHidden").val((item - 1.1))
                } else if (rdo === 'rdoAntes') {
                    id--
                    ArrayTarjetas[id] ? $("#txtitemHidden").val(CrearIten(parseFloat(ArrayTarjetas[id].item), item)) : $("#txtitemHidden").val((item - 1.1));

                }
                else if (rdo === 'rdoDespues') {
                    id++
                    ArrayTarjetas[id] ? $("#txtitemHidden").val(CrearIten(item, parseFloat(ArrayTarjetas[id].item))) : $("#txtitemHidden").val((item + 1.1));
                } else {
                    $("#txtitemHidden").val((item + 1.1))
                }
            }
            $("#formSaveNewCredit button").attr('disabled', true);
            SaveOrUpdate()
        }
    });

    $("#txtCosto").focus(function (e) {
        this.select();
    });

    $("#txtObligacion").focus(function (e) {
        this.select();
    });

    $("#txtConsepto").change(function (e) {
        e.preventDefault();
        if (e.target.value === 'Articulo') {
            $("#divDescipcionArticuloInicial").show();
            $(".divSeguroFormNuevoCredito").hide();
        } else {
            $("#divDescipcionArticuloInicial").hide();
            $(".divSeguroFormNuevoCredito").show();
        }
        $("#txtCuotaInicial").val('')
        $("#cboBancoPagoInicial").val('').trigger('change')
        $("#divMetodoCuotaInicial").addClass('hide')
        $("#txtRecaudo").val('')
        $("#txtObligacion").focus();
    });
    $("#txtCuotaInicial").on('input', function () {
        const tieneInicial = $("#txtConsepto").val() === 'Articulo' && Number($(this).val()) > 0
        $("#divMetodoCuotaInicial").toggleClass('hide', !tieneInicial)
        if (!tieneInicial) $("#cboBancoPagoInicial").val('').trigger('change')
    })
    function SaveOrUpdate() {
        $.post("./ajax/UsuarioAjax.php", function (r) {
            if (r === '0') {
                location.reload(true);
            }
        });
        var formData = new FormData($("#formSaveNewCredit")[0]);
        $.ajax({
            url: "./ajax/CarteraAjax.php?op=SaveOrUpdate",
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
                    $("#formSaveNewCredit button").attr('disabled', false);
                    banderasavedcredito = 0
                } else {
                    $("#modal-nuevo-credito").modal('hide');
                    Toast.fire({
                        icon: 'success',
                        title: datos
                    })
                    verLoadin('Recargando Tarjetas', 'Espere...')
                    listarRuta();
                    enviarSumarRecaudoCreditos()
                }

            }

        });
    };

}

function onKeyupFormNuevoCredit(e, f) {
    if (f) var key = f.keyCode ? f.keyCode : f.which;
    let ele = $(e)
    let name = ele.attr('name');
    let valor = ele.val()
    const consepto = $("#txtConsepto").val()
    switch (name) {
        case 'txtObligacion':
            if (key === 13) {
                if (consepto === 'Articulo') {
                    $("#txtdescricion").focus();

                } else {
                    $("#txtValor").focus();
                }
            }
            break;
        case 'txtCuotaInicial':
            if (key === 13) {
                if (valor != '') $("#txtValor").focus()
            }
            break;
        case 'txtValor':
            if (key === 13) {
                if (valor != '') $("#txtCosto").focus()
            }
            valor = parseFloat(valor) || 0
            var porcentaje = (valor * 16.666667) / 100;
            $("#txtCosto").val((valor - porcentaje).toFixed(0));
            $("#txtTiempo").val('');
            $("#txtRecaudo").val('');
            $("#txtCuota").val('0');
            break;
        case 'txtCosto':
            if (key === 13) {
                if (valor) $("#txtModo").focus()
            }
            return true
        case 'txtModo':
            if (key === 13) {
                if (valor != '') $("#txtTiempo").focus()
                return true
            }
            const l = valor.charAt(valor.length - 1).toLowerCase()
            const modo = {
                d: 'Diario',
                s: 'Semanal',
                q: 'Quincenal',
                m: 'Mensual'
            }
            valor = modo[l] || 'Diario';
            ele.val(valor)
            break;
        case 'txtTiempo':
            if (key === 13) {
                if (consepto === 'Articulo' || $("#txtHiddenAdicional").val() == 'ninguno') {

                    if (banderasavedcredito === 0) {
                        banderasavedcredito = 1
                        $("#formSaveNewCredit").submit()
                    }
                } else {
                    $("#txtRecaudo").focus();
                    $("#txtRecaudo").trigger('focus');;
                }
            }
            const val = parseFloat($("#txtValor").val()) || 0
            const inicial = parseFloat($("#txtCuotaInicial").val()) || 0
            const pla = parseFloat(valor) || 0
            const resul = ((val - inicial) / pla).toFixed(2)
            resul != 'Infinity' ? $("#txtCuota").val(resul) : $("#txtCuota").val($("#txtCuota").val());
            break;
        case 'txtRecaudo':
            if (key === 13) {
                if ($("#txtHiddenAdicional").val() == 'seguro') {
                    if (banderasavedcredito === 0) {
                        banderasavedcredito = 1
                        $("#formSaveNewCredit").submit()
                    }
                }else{
                    if (valor) $("#txtNumBoleta").focus()
                }
                
            }


            break
        case 'txtNumBoleta':
            if (key === 13) {
                if (banderasavedcredito === 0) {
                    banderasavedcredito = 1
                    $("#formSaveNewCredit").submit()
                }
            }


            if (key === 13) {
                if (valor) $("#txtNumBoleta").focus()
            }
            return true

        default:
            break;
    }
}

function onChangeFormNuevoCredit(e) {
    let ele = $(e)
    let name = ele.attr('name');
    let valor = ele.val()
    switch (name) {
        case 'txtValor':
            valor = parseFloat(valor) || 0
            var porcentaje = (valor * 16.666667) / 100;
            $("#txtCosto").val((valor - porcentaje).toFixed(0));
            $("#txtTiempo").val('');
            $("#txtRecaudo").val('');
            $("#txtCuota").val('0');
            break;
        case 'txtModo':
            const l = valor.charAt(valor.length - 1).toLowerCase()
            const modo = {
                d: 'Diario',
                s: 'Semanal',
                q: 'Quincenal',
                m: 'Mensual'
            }
            valor = modo[l] || 'Diario';
            ele.val(valor)
            break;
        case 'txtTiempo':

            const val = parseFloat($("#txtValor").val()) || 0
            const inicial = parseFloat($("#txtCuotaInicial").val()) || 0
            const pla = parseFloat(valor) || 0
            const resul = ((val - inicial) / pla).toFixed(2)
            resul != 'Infinity' ? $("#txtCuota").val(resul) : $("#txtCuota").val($("#txtCuota").val());
            break;
        case 'txtCuota':
            break;
        default:
            break;
    }
}
