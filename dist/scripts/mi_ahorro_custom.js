/* Archivo: dist/scripts/mi_ahorro_custom.js
   JS personalizado para la vista Mi Ahorro
*/
// Definir variable global "bandera" si no existe
if (typeof window !== 'undefined' && !('bandera' in window)) {
  window.bandera = false;
}
(function ($) {
  'use strict';

  function formatMoney(v) {
    var n = parseFloat(v) || 0;
    return '$' + n.toFixed(2);
  }

  function renderProfile(data) {
    if (!data) return;
    $('#txt_num_cuenta').text(data.n_documento || '');
    $('#txt_name_ahorrador').text((data.nombres || '') + ' ' + (data.apellidos || ''));
    $('#txt_tipo_documento_ahorrador').text(data.t_documento || '');
    $('#txt_num_documento_ahorrador').text(data.n_documento || '');
    $('#txt_tel_ahorrador').text(data.telefono || '-');
    $('#txt_porcentaje_ahorrador').text((data.porcentaje || 0) + '%');
    $('#pTextTipoPago').text(data.pagoUtilidad || data.pago_utilidad || '-');
    $('#txt_estado_ahorrador').text(data.estadoAhorro || data.estado || '-');
    $('#txt_fecha_creacion_ahorrador').text(data.fechaCreacion || data.fecha_at || '-');
    var saldo = parseFloat(data.saldoMovimientos || data.saldo_movimientos || 0) || 0;
    $('#txt_saldo_header').text(formatMoney(saldo));
    // guardar refAhorro si viene
    if (data.refAhorro) { $('#txtRefAhorroConfig').val(data.refAhorro); }
    if (data.foto) { $('#img_ahorrador').attr('src', data.foto); }
  }







  function init() {

  }

  // Exponer funciones útiles
  window.MiAhorro = {
    init: init,
    fetchProfileByDocument: fetchProfileByDocument,
    loadMovements: loadMovements,
    loadGanancias: loadGanancias
  };

  $(document).ready(init);
})(jQuery);
