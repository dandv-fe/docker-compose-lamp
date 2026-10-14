const test = require('node:test');
const assert = require('node:assert/strict');
const { avisoCajaCredito } = require('../dist/scripts/CajaCredito.js');

test('caja cero y negativa advierten sin cambiar permisos', () => {
    for (const balance of [0, -0.01, -10000]) {
        const text = avisoCajaCredito(balance, 100, 'Prestamo');
        assert.match(text, /no tiene dinero disponible/);
        assert.match(text, /no cambia los permisos/);
    }
});

test('capital superior a efectivo disponible advierte; igualdad no advierte', () => {
    assert.match(avisoCajaCredito(99.99, 100, 'Prestamo'), /no alcanza/);
    assert.equal(avisoCajaCredito(100, 100, 'Prestamo'), '');
    assert.equal(avisoCajaCredito(100, 50, 'Prestamo'), '');
});

test('saldo desconocido no se convierte en cero ni fondos suficientes', () => {
    for (const balance of [null, undefined, NaN, Infinity, '100']) {
        assert.match(avisoCajaCredito(balance, 100, 'Prestamo'), /Caja no disponible/);
    }
});

test('artículos no usan la advertencia de desembolso de préstamo', () => {
    assert.equal(avisoCajaCredito(-100, 100, 'Articulo'), '');
});
