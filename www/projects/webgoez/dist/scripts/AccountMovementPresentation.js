(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AccountMovementPresentation = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  function label(movement, accountId) {
    const labels = { aporte: 'Aporte', retiro: 'Retiro', ajuste: 'Interés', salida: 'Salida', entrada: 'Entrada' };
    if (movement.tipo_presentacion) {
      return labels[movement.tipo_presentacion] || movement.tipo_presentacion;
    }
    const via = Number(movement.idahorro_de) === Number(accountId) &&
      Number(movement.idahorro) !== Number(accountId);
    if (via && movement.str_tipo === 'retiro') return 'Transferencia recibida';
    if (via && ['aporte', 'ajuste'].includes(movement.str_tipo)) return 'Transferencia enviada';
    return labels[movement.str_tipo] || movement.str_tipo;
  }
  return { label };
});
