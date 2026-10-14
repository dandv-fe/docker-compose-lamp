(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.PayrollEmpleadoUI = api;
  }
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const salaryTypes = new Set(['Fijo', 'Porcentaje', 'Combinado']);
  const frequencies = new Set(['Diario', 'Semanal', 'Quincenal', 'Mensual']);

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day;
  }

  function validMoney(value) {
    return validAmount(value) && Number(value) >= 0;
  }

  function validAmount(value) {
    if (value === null || value === undefined || typeof value === 'boolean') return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    const amount = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(amount);
  }

  function validPayrollConfig(config) {
    if (!config || !salaryTypes.has(config.salaryType) || !frequencies.has(config.frequency)) return false;
    if (!validMoney(config.baseAmount)) return false;
    if (config.commissionsEnabled !== false &&
        (!validMoney(config.creditRate) || !validMoney(config.collectionRate) ||
          Number(config.creditRate) > 100 || Number(config.collectionRate) > 100)) return false;
    return true;
  }

  function validCustomShares(shares) {
    if (!Array.isArray(shares) || shares.length === 0) return false;
    const ids = new Set();
    let totalBasisPoints = 0;
    for (const share of shares) {
      const id = Number(share && share.employeeId);
      const percent = Number(share && share.percent);
      if (!Number.isSafeInteger(id) || id <= 0 || ids.has(id) ||
          !Number.isFinite(percent) || percent <= 0 || percent > 100) return false;
      ids.add(id);
      totalBasisPoints += Math.round(percent * 100);
    }
    return totalBasisPoints === 10000;
  }

  function validVacation(vacation) {
    return Boolean(vacation &&
      Number.isSafeInteger(vacation.employeeId) && vacation.employeeId > 0 &&
      Number.isSafeInteger(vacation.replacementEmployeeId) && vacation.replacementEmployeeId > 0 &&
      vacation.employeeId !== vacation.replacementEmployeeId &&
      validDate(vacation.startDate) && validDate(vacation.endDate) &&
      vacation.startDate <= vacation.endDate &&
      typeof vacation.reason === 'string' && Array.from(vacation.reason).length <= 250);
  }

  function validBonusContext(context, branchId) {
    return Boolean(context && Number.isSafeInteger(Number(context.branchId)) &&
      Number(context.branchId) === Number(branchId) && Number(branchId) > 0 &&
      Number.isSafeInteger(Number(context.routeId)) && Number(context.routeId) > 0 &&
      context.state === 'created' && Array.isArray(context.employees) &&
      context.employees.every(employee => employee &&
        Number.isSafeInteger(Number(employee.employeeId)) && Number(employee.employeeId) > 0 &&
        typeof employee.name === 'string'));
  }

  function validLedgerBonus(data, context) {
    return Boolean(data && validBonusContext(context, data.branchId) &&
      Number(data.routeId) === Number(context.routeId) &&
      context.employees.some(employee => Number(employee.employeeId) === Number(data.employeeId)) &&
      validMoney(data.amount) && Number(data.amount) > 0 &&
      Number(data.amount) <= 99999999.99 &&
      /^\d+(?:\.\d{1,2})?$/.test(String(data.amount)) &&
      typeof data.reason === 'string' && data.reason.trim() &&
      Array.from(data.reason).length <= 250);
  }

  function validPayrollSummary(summary) {
    if (!summary || !Number.isSafeInteger(Number(summary.employeeId)) ||
        !validDate(summary.asOf) || !Array.isArray(summary.periods) || summary.periods.length !== 1 ||
        !summary.totals || !Array.isArray(summary.contracts) || !Array.isArray(summary.vacations) ||
        !Array.isArray(summary.bonuses) || !Array.isArray(summary.routes)) return false;
    const period = summary.periods[0];
    const amountFields = ['baseAmount', 'periodBaseAmount', 'capitalCommission', 'collectionCommission', 'commissionAmount',
      'bonusAmount', 'earnedAmount', 'paidAmount', 'pendingAmount'];
    if (!period || !validDate(period.startDate) || !validDate(period.endDate) ||
        period.startDate > period.endDate || typeof period.configured !== 'boolean' ||
        (period.frequency != null && !frequencies.has(period.frequency)) ||
        !validMoney(period.agreedBaseAmount) ||
        !amountFields.every(key => validAmount(period[key]) && validAmount(summary.totals[key]))) return false;
    return summary.routes.every(route => route &&
      (typeof route.branchName === 'string' || typeof route.name === 'string' ||
        typeof route.routeName === 'string') &&
      validAmount(route.capitalAmount) &&
      validAmount(route.cashAmount) &&
      validAmount(route.capitalCommission) &&
      validAmount(route.collectionCommission) &&
      validMoney(route.sharePercent) && Number(route.sharePercent) <= 100 &&
      typeof route.provisional === 'boolean' &&
      validDate(route.openedDate || route.date));
  }

  function validPayrollBootstrap(bootstrap) {
    const distributionModes = new Set(['Titular', 'Igual', 'Personalizado']);
    return Boolean(bootstrap &&
      Number.isSafeInteger(Number(bootstrap.employeeId)) &&
      typeof bootstrap.canManage === 'boolean' &&
      typeof bootstrap.canDistribute === 'boolean' &&
      Array.isArray(bootstrap.employees) &&
      bootstrap.employees.every(employee =>
        employee && Number.isSafeInteger(Number(employee.employeeId)) &&
        Number(employee.employeeId) > 0 && typeof employee.name === 'string') &&
      Array.isArray(bootstrap.branches) &&
      bootstrap.branches.every(branch =>
        branch && Number.isSafeInteger(Number(branch.branchId)) &&
        Number(branch.branchId) > 0 && typeof branch.name === 'string' &&
        (typeof branch.holderName === 'string' || branch.holderName === null) &&
        Array.isArray(branch.employees) &&
        branch.employees.every(employee =>
          employee && Number.isSafeInteger(Number(employee.employeeId)) &&
          Number(employee.employeeId) > 0 && typeof employee.name === 'string')) &&
      Array.isArray(bootstrap.configs) &&
      bootstrap.configs.every(config =>
        config && Number.isSafeInteger(Number(config.branchId)) &&
        Number(config.branchId) > 0 &&
        distributionModes.has(config.mode) && Array.isArray(config.weights) &&
        config.weights.every(weight =>
          weight && Number.isSafeInteger(Number(weight.employeeId)) &&
          Number(weight.employeeId) > 0 && validMoney(weight.weight) &&
          Number(weight.weight) > 0 && Number(weight.weight) <= 100)));
  }

  function formatCop(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '—';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(amount);
  }

  return {
    validDate,
    validMoney,
    validPayrollConfig,
    validCustomShares,
    validVacation,
    validBonusContext,
    validLedgerBonus,
    validPayrollSummary,
    validPayrollBootstrap,
    formatCop
  };
});
