(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PayrollHistoryDates = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function rangeError(from, to) {
    if (!validDate(from) || !validDate(to)) return 'Complete Desde y Hasta con fechas válidas en formato AAAA-MM-DD.';
    if (from > to) return 'La fecha Desde no puede ser posterior a Hasta.';
    return '';
  }
  function validate($) {
    const error = rangeError($('#txtFechaDesde').val(), $('#txtFechaHasta').val());
    $('#payroll-history-date-status').text(error ? `${error} No se ha actualizado el historial.` : '');
    return !error;
  }
  function initialize($, moment) {
    if (!$('#formSearchNominaDetallado').length) return;
    const today = moment();
    [['#dateDeste', '#txtFechaDesde', today.clone().startOf('month')],
      ['#dateHasta', '#txtFechaHasta', today.clone().endOf('month')]].forEach(([picker, input, defaultDate]) => {
        const existing = $(input).val();
        $(picker).datetimepicker({
          format: 'YYYY-MM-DD', locale: 'es', useCurrent: false,
          date: validDate(existing) ? moment(existing, 'YYYY-MM-DD', true) : defaultDate
        });
      });
    let timer;
    function refresh() {
      clearTimeout(timer);
      timer = setTimeout(() => $('#formSearchNominaDetallado').trigger('submit'), 150);
    }
    $('#dateDeste, #dateHasta').off('.payrollHistory').on('change.datetimepicker.payrollHistory', refresh);
    $('#txtFechaDesde, #txtFechaHasta').off('.payrollHistory').on('change.payrollHistory', refresh);
  }
  return { validDate, rangeError, validate, initialize };
});
