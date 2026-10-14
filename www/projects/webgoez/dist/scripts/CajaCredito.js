(function (root) {
    'use strict';

    function avisoCajaCredito(balance, cost, concept) {
        if (concept !== 'Prestamo') return '';
        if (typeof balance !== 'number' || !Number.isFinite(balance)) {
            return 'Caja no disponible para verificar. Actualice la cartera; no se está suponiendo un saldo de cero.';
        }
        if (balance <= 0) {
            return 'La cartera, ruta o punto de venta no tiene dinero disponible. ' +
                'Este aviso no cambia los permisos otorgados para registrar el préstamo.';
        }
        if (typeof cost === 'number' && Number.isFinite(cost) && cost > balance) {
            return 'La caja disponible no alcanza para el capital de este préstamo. ' +
                'Este aviso no cambia los permisos otorgados para registrarlo.';
        }
        return '';
    }

    if (typeof module === 'object' && module.exports) {
        module.exports = { avisoCajaCredito };
        return;
    }

    const $ = root.jQuery;
    let balance = null;
    let generation = 0;
    let request = null;

    function render() {
        const text = avisoCajaCredito(balance, Number($('#txtCosto').val()), $('#txtConsepto').val());
        $('#aviso-caja-nuevo-credito').text(text).prop('hidden', text === '');
        return text;
    }

    root.avisarCajaAntesDeCredito = function () {
        const text = render();
        if (text && root.Toast) root.Toast.fire({ icon: 'warning', title: text });
    };

    $(function () {
        $('#txtCosto, #txtValor').on('input change keyup', render);
        $('#txtConsepto').on('change', render);
        $('#modal-nuevo-credito').on('shown.bs.modal', function () {
            balance = null;
            const current = ++generation;
            if (request) request.abort();
            render();
            request = $.ajax({
                url: './ajax/CarteraAjax.php?op=resumenCajaRuta',
                dataType: 'json', cache: false, timeout: 15000
            }).done(function (data) {
                if (current !== generation) return;
                if (!data || !data.totales || typeof data.totales.efectivo !== 'number' ||
                    !Number.isFinite(data.totales.efectivo)) {
                    balance = null;
                    render();
                    return;
                }
                balance = data.totales.efectivo;
                render();
            }).fail(function (xhr, status) {
                if (current !== generation || status === 'abort') return;
                balance = null;
                render();
            });
        }).on('hidden.bs.modal', function () {
            generation++;
            if (request) request.abort();
            request = null;
            balance = null;
            $('#aviso-caja-nuevo-credito').prop('hidden', true).text('');
        });
    });
})(typeof window !== 'undefined' ? window : globalThis);
