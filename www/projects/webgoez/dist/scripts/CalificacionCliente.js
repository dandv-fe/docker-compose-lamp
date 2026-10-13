(function (root) {
    'use strict';
    function rating(raw, metadata) {
        const text = raw === null || raw === undefined ? null : String(raw);
        const parsed = text !== null && /^(?:[1-9]|10)$/.test(text) ? Number(text) : null;
        const supplied = metadata && Number(metadata.score);
        const suppliedValid = metadata && metadata.score !== null && metadata.score !== undefined &&
            Number.isInteger(supplied) && supplied >= 1 && supplied <= 10;
        const initial = suppliedValid
            ? metadata.source === 'automatic' && metadata.confidence === 'initial'
            : parsed === null && (text === '' || text === 'nuevo');
        const score = suppliedValid ? supplied : parsed === null && initial ? 5 : parsed;
        const label = initial ? 'Inicial · poca historia' : score === null
            ? (text === null ? 'Nota pendiente de sincronizar' : 'Nota no disponible') : score >= 9 ? 'Excelente'
            : score >= 7 ? 'Bueno' : score >= 5 ? 'Regular' : 'Requiere seguimiento';
        return { score, label, shortLabel: initial ? 'Inicial' : score !== null && score < 5 ? 'Seguimiento'
            : score === null ? 'Pendiente' : label,
            color: initial || score === null ? 'secondary' : score >= 9 ? 'success'
                : score >= 7 ? 'info' : score >= 5 ? 'warning' : 'danger' };
    }
    function validReason(reason) {
        return typeof reason === 'string' && Array.from(reason.trim()).length >= 5 &&
            Array.from(reason.trim()).length <= 500;
    }
    if (typeof module === 'object' && module.exports) {
        module.exports = { rating, validReason, validResponse };
        return;
    }
    const $ = root.jQuery;
    let request = null;
    let generation = 0;
    let selected = null;
    let response = null;
    let saving = false;

    root.pintarCintaCalificacionCliente = function (raw, metadata) {
        const value = rating(raw, metadata);
        $('#txtClienteCalificacion').attr('class', 'ribbon bg-' + value.color)
            .text(value.shortLabel + (value.score === null ? '' : ' ' + value.score + '/10'));
        $('#resumen-calificacion-cliente').text(value.label + (value.score === null ? '' : ' · ' + value.score + '/10'));
    };
    function state(text, error) {
        $('#estado-calificacion-cliente').text(text).toggleClass('text-danger', !!error);
    }
    function setSaving(value) {
        saving = value;
        $('#form-calificacion-cliente :input, #modal-calificacion-cliente [data-dismiss="modal"]').prop('disabled', value);
        $('#form-calificacion-cliente button[type="submit"]').prop('disabled', value || !response);
    }
    function validResponse(data) {
        return data && typeof data.rawRating === 'string' && typeof data.canRate === 'boolean' &&
            Number.isInteger(data.customerId) && data.customerId > 0 &&
            Array.isArray(data.history) && typeof data.csrf === 'string' &&
            Number.isInteger(data.score) && data.score >= 1 && data.score <= 10 &&
            Number.isInteger(data.automaticScore) && data.automaticScore >= 1 && data.automaticScore <= 10 &&
            ['manual', 'automatic'].includes(data.source) &&
            ['initial', 'limited', 'established'].includes(data.confidence) &&
            typeof data.explanation === 'string' && data.explanation.length > 0 &&
            (data.manualUntil === null || validDate(data.manualUntil)) &&
            (data.evaluatedAt === null || validDate(data.evaluatedAt)) &&
            data.history.every(entry => entry && ['manual', 'automatic'].includes(entry.source) &&
                Number.isInteger(entry.createdBy) && typeof entry.reason === 'string' &&
                validDate(entry.createdAt) && [entry.score, entry.previousScore].every(score =>
                    score === null || Number.isInteger(score) && score >= 1 && score <= 10));
    }
    function validDate(value) {
        return typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
    }
    function dateText(value) {
        return new Date(value).toLocaleString('es-CO');
    }
    function updateCards(data) {
        for (const item of Object.values(ArrayTarjetas)) {
            if (Number(item.refCliente) !== data.customerId) continue;
            item.calificacion = data.rawRating;
            item.rating_score = data.score;
            item.rating_source = data.source;
            item.rating_confidence = data.confidence;
        }
        const active = ArrayTarjetas[parseInt(sessionStorage.getItem('index') || '0', 10)];
        if (active && Number(active.refCliente) === data.customerId) {
            root.pintarCintaCalificacionCliente(data.rawRating, data);
        }
    }
    function render(data) {
        if (!validResponse(data)) throw new Error('Respuesta inválida al consultar la calificación.');
        response = data;
        $('#form-calificacion-cliente button[type="submit"]').prop('disabled', saving);
        const value = rating(data.rawRating, data);
        $('#nota-actual-cliente').text(value.label + (value.score === null ? '' : ' · ' + value.score + '/10'));
        $('#nota-automatica-cliente').text(data.automaticScore + '/10 · ' +
            (data.confidence === 'initial' ? 'Inicial · poca historia' : rating(String(data.automaticScore)).label));
        $('#explicacion-automatica-cliente').text(data.explanation);
        $('#vigencia-manual-cliente').text(data.source === 'manual'
            ? (data.manualUntil ? 'Nota manual con prioridad hasta ' + dateText(data.manualUntil) +
                '. La evaluación automática continúa durante este plazo.'
                : 'Nota manual anterior pendiente de incorporarse al motor automático.')
            : 'La nota vigente es automática. Una revisión manual tiene prioridad durante 7 días.');
        $('#fecha-evaluacion-cliente').text(data.evaluatedAt
            ? 'Último cálculo: ' + dateText(data.evaluatedAt) + ' · Evidencia: ' +
                ({ initial: 'inicial', limited: 'limitada', established: 'establecida' })[data.confidence]
            : 'Evaluación matemática pendiente; se muestra la referencia inicial, no un historial inventado.');
        $('#score-calificacion-cliente').val(value.score === null ? '' : String(value.score));
        $('#reason-calificacion-cliente').val('');
        $('#form-calificacion-cliente').prop('hidden', !data.canRate);
        $('#solo-lectura-calificacion-cliente').prop('hidden', data.canRate);
        const list = $('#historial-calificacion-cliente').empty();
        data.history.forEach(function (entry) {
            const old = entry.previousScore === null ? 'Inicial' : entry.previousScore + '/10';
            const current = entry.score === null ? '5/10 · Inicial, poca historia' : entry.score + '/10';
            const item = $('<li>').addClass('list-group-item');
            $('<strong>').text(old + ' → ' + current).appendTo(item);
            const date = new Date(entry.createdAt);
            $('<div>').addClass('small text-muted').text(
                (Number.isNaN(date.getTime()) ? entry.createdAt : date.toLocaleString('es-CO')) +
                (entry.source === 'automatic' ? ' · Automática' : ' · Manual · Usuario #' + entry.createdBy)).appendTo(item);
            $('<div>').addClass('calificacion-historial-motivo').text(entry.reason).appendTo(item);
            item.appendTo(list);
        });
        $('#sin-historial-calificacion-cliente').prop('hidden', data.history.length !== 0);
        updateCards(data);
        state('');
    }
    function open() {
        const card = ArrayTarjetas[parseInt(sessionStorage.getItem('index') || '0', 10)];
        if (!card) return state('Seleccione una tarjeta de la cartera.', true);
        generation++;
        const current = generation;
        if (request) request.abort();
        selected = { idtarjeta: card.refTarjeta, idsucursal: card.refSucursal };
        $('#nombre-calificacion-cliente').text(card.cliente || 'Cliente seleccionado');
        response = null;
        $('#form-calificacion-cliente').prop('hidden', true);
        $('#solo-lectura-calificacion-cliente').prop('hidden', true);
        $('#historial-calificacion-cliente').empty();
        $('#sin-historial-calificacion-cliente').prop('hidden', true);
        $('#nota-actual-cliente').text('Consultando…');
        $('#nota-automatica-cliente, #explicacion-automatica-cliente, #vigencia-manual-cliente, #fecha-evaluacion-cliente').text('');
        $('#modal-calificacion-cliente').modal('show');
        state('Consultando calificación e historial…');
        request = $.ajax({ url: 'ajax/CalificacionClienteAjax.php', data: selected, dataType: 'json', cache: false, timeout: 30000 })
            .done(function (data) {
                if (generation !== current) return;
                try { render(data); } catch (error) { state(error.message, true); }
            }).fail(function (xhr, status) {
                if (generation !== current || status === 'abort') return;
                state(xhr.responseJSON && xhr.responseJSON.error || 'No se pudo consultar. Cierre y vuelva a abrir para reintentar.', true);
            });
    }
    function save(event) {
        event.preventDefault();
        if (saving || !response || !response.canRate || !selected) return;
        const score = Number($('#score-calificacion-cliente').val());
        const reason = $('#reason-calificacion-cliente').val().trim();
        if (!Number.isInteger(score) || score < 1 || score > 10 || !validReason(reason)) {
            state('Seleccione una nota de 1 a 10 y escriba un motivo de 5 a 500 caracteres.', true);
            return;
        }
        const current = generation;
        const card = { ...selected };
        setSaving(true);
        state('Guardando calificación…');
        $.ajax({ url: 'ajax/CalificacionClienteAjax.php', method: 'POST', dataType: 'json', timeout: 30000,
            data: { ...card, score, reason, expectedRating: response.rawRating, csrf: response.csrf } })
            .done(function (data) {
                if (generation !== current) return;
                try {
                    if (!validResponse(data)) throw new Error('El servidor devolvió una respuesta inválida. Reabra para verificar si la nota se guardó.');
                    render(data);
                    state('Nota manual guardada con motivo e historial; tendrá prioridad durante 7 días.');
                } catch (error) {
                    response = null;
                    state(error.message, true);
                }
            }).fail(function (xhr) {
                if (generation !== current) return;
                if (xhr.status === 0 || xhr.status >= 500 || xhr.status === 409) response = null;
                state(xhr.responseJSON && xhr.responseJSON.error ||
                    'No se pudo confirmar el guardado. Cierre y reabra para verificar antes de intentar otra vez.', true);
            }).always(function () { setSaving(false); });
    }
    $(function () {
        $('#abrir-calificacion-cliente').on('click', open);
        $('#form-calificacion-cliente').on('submit', save);
        $('#modal-calificacion-cliente').on('hide.bs.modal', function (event) {
            if (saving) { event.preventDefault(); return; }
            generation++;
            if (request) request.abort();
            request = null;
            response = null;
            selected = null;
        });
    });
})(typeof window !== 'undefined' ? window : globalThis);
