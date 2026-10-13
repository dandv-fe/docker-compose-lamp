const test = require('node:test');
const assert = require('node:assert/strict');
const { rating, validReason, validResponse } = require('../dist/scripts/CalificacionCliente.js');

test('categorías y cintas cubren exactamente las notas de 1 a 10', () => {
    for (let score = 1; score <= 10; score++) {
        const result = rating(String(score));
        assert.equal(result.score, score);
        assert.equal(result.label, score >= 9 ? 'Excelente' : score >= 7 ? 'Bueno'
            : score >= 5 ? 'Regular' : 'Requiere seguimiento');
        assert.equal(result.color, score >= 9 ? 'success' : score >= 7 ? 'info'
            : score >= 5 ? 'warning' : 'danger');
    }
});

test('nuevos y vacíos reciben referencia neutral, no historial inventado', () => {
    for (const raw of ['', 'nuevo']) {
        assert.equal(rating(raw).score, 5);
        assert.equal(rating(raw).label, 'Inicial · poca historia');
        assert.equal(rating(raw).shortLabel, 'Inicial');
    }
});

test('datos no descargados o inválidos no se disfrazan de calificaciones', () => {
    for (const raw of [null, undefined, '0', '11', '1.5', '07', '-1', ' 7 ', '<script>']) {
        assert.equal(rating(raw).score, null);
        assert.notEqual(rating(raw).label, 'Sin calificar');
        assert.notEqual(rating(raw).label, 'Excelente');
    }
});

test('cinta distingue inicial de regular y respeta vigencia efectiva enviada por servidor', () => {
    assert.equal(rating('5', { score: 5, source: 'automatic', confidence: 'initial' }).label,
        'Inicial · poca historia');
    assert.equal(rating('5', { score: 5, source: 'manual', confidence: 'initial' }).label, 'Regular');
    assert.equal(rating('9', { score: 4, source: 'automatic', confidence: 'established' }).score, 4);
    assert.equal(rating('9', { score: 4, source: 'automatic', confidence: 'established' }).label,
        'Requiere seguimiento');
    assert.equal(rating('9', { score: null, source: 'automatic', confidence: null }).score, 9);
});

test('respuesta exige nota automática, origen, evidencia y fechas válidas', () => {
    const result = { customerId: 10, rawRating: '8', score: 8, canRate: true, csrf: 'token',
        automaticScore: 6, source: 'manual', manualUntil: '2026-10-20T10:00:00.000Z',
        evaluatedAt: '2026-10-13T10:00:00.000Z', confidence: 'limited',
        explanation: 'Constancia con evidencia limitada.', history: [] };
    assert.equal(validResponse(result), true);
    for (const change of [{ automaticScore: null }, { automaticScore: 11 }, { score: null },
        { source: 'invented' }, { confidence: 'excellent' }, { explanation: '' },
        { manualUntil: 'wrong' }, { evaluatedAt: undefined },
        { history: [{ score: 8, previousScore: null, source: 'automatic', createdBy: 0,
            reason: 'Cálculo', createdAt: 'wrong' }] }]) {
        assert.equal(validResponse({ ...result, ...change }), false);
    }
    assert.equal(validResponse({ ...result, score: 5, automaticScore: 5, source: 'automatic',
        confidence: 'initial', manualUntil: null, evaluatedAt: null }), true);
});

test('motivo validado por caracteres y sin espacios de relleno', () => {
    assert.equal(validReason('  abc  '), false);
    assert.equal(validReason('  motivo válido  '), true);
    assert.equal(validReason('a'.repeat(500)), true);
    assert.equal(validReason('a'.repeat(501)), false);
    assert.equal(validReason('😀'.repeat(500)), true);
    assert.equal(validReason(null), false);
});
