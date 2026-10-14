(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DespacharUI = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const positiveId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
  const money = value => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') &&
    Number.isFinite(Number(value)) && Number(value) >= 0;
  function date(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }
  function filterBranches(branches, search, state) {
    const query = String(search || '').toLocaleLowerCase('es');
    return branches.filter(branch => (!state || branch.state === state) &&
      `${branch.name} ${branch.officeName}`.toLocaleLowerCase('es').includes(query));
  }
  function personName(value) {
    return String(value).toLocaleLowerCase('es').replace(/(^|[\s-])(\p{L})/gu,
      (_, prefix, letter) => prefix + letter.toLocaleUpperCase('es'));
  }
  function employeeGroups(employees, branch, search) {
    const query = String(search || '').toLocaleLowerCase('es');
    const groups = new Map();
    employees.filter(employee => `${employee.name} ${employee.officeName || ''}`.toLocaleLowerCase('es').includes(query))
      .forEach(employee => {
        const team = employee.selected || employee.representative || employee.replacement;
        const sameOffice = Number(employee.officeId) === Number(branch.officeId) && Number(branch.officeId) > 0;
        const key = team ? 'team' : `office:${employee.officeId == null ? 'none' : employee.officeId}`;
        if (!groups.has(key)) groups.set(key, { key, name: team ? 'Equipo de esta cartera'
          : employee.officeName === null ? 'Sin oficina registrada' : employee.officeName,
          priority: team ? 0 : sameOffice ? 1 : 2, employees: [] });
        groups.get(key).employees.push(employee);
      });
    return Array.from(groups.values()).sort((a, b) => a.priority - b.priority ||
      a.name.localeCompare(b.name, 'es') || a.key.localeCompare(b.key)).map(group => ({
        ...group, employees: group.employees.slice().sort((a, b) =>
          a.name.localeCompare(b.name, 'es') || Number(a.employeeId) - Number(b.employeeId))
      }));
  }
  function validChallenge(challenge) {
    return challenge && positiveId(challenge.employeeId) && money(challenge.capitalGoal) &&
      money(challenge.collectionGoal) && date(challenge.deadline) &&
      [challenge.capitalGoal, challenge.collectionGoal].every(value =>
        Number(value) <= 999999999999.99 && Math.abs(Number(value) * 100 - Math.round(Number(value) * 100)) < 0.000001) &&
      Number(challenge.incrementPercent) >= 0.1 && Number(challenge.incrementPercent) <= 40 &&
      (challenge.description === undefined || typeof challenge.description === 'string' &&
        Array.from(challenge.description).length <= 250);
  }
  function validContext(response, branchId) {
    return Boolean(response && response.branch && Number(response.branch.branchId) === Number(branchId) &&
      typeof response.branch.name === 'string' && typeof response.branch.officeName === 'string' &&
      typeof response.branch.canDispatch === 'boolean' && typeof response.branch.canSaveDispatch === 'boolean' &&
      (!response.branch.canSaveDispatch || response.branch.canDispatch && (!response.route || response.route.state === 'created')) &&
      typeof response.canConfigureDistribution === 'boolean' && typeof response.canSetChallenges === 'boolean' &&
      typeof response.csrfToken === 'string' && response.csrfToken &&
      (response.route === null || response.route && positiveId(response.route.routeId) &&
        Number.isSafeInteger(response.route.version) && response.route.version >= 0 &&
        ['created', 'entregando', 'saved'].includes(response.route.state)) &&
      Array.isArray(response.employees) && response.employees.every(employee => employee &&
        positiveId(employee.employeeId) && typeof employee.name === 'string' && typeof employee.selected === 'boolean' &&
        (employee.officeName === null || typeof employee.officeName === 'string') &&
        typeof employee.representative === 'boolean' && typeof employee.replacement === 'boolean') &&
      new Set(response.employees.map(employee => Number(employee.employeeId))).size === response.employees.length &&
      Array.isArray(response.challenges) && response.distribution &&
      ['Titular', 'Igual', 'Personalizado'].includes(response.distribution.mode) && Array.isArray(response.distribution.weights));
  }
  function validateDraft(draft, context) {
    if (!context || !context.canDispatch) return 'No tiene permiso vigente para despachar esta cartera.';
    if (!draft.employeeIds.length || new Set(draft.employeeIds).size !== draft.employeeIds.length ||
        !draft.employeeIds.every(id => positiveId(id) && context.employees.some(employee => Number(employee.employeeId) === id))) {
      return 'Seleccione al menos una persona autorizada, sin duplicados.';
    }
    if (draft.distribution) {
      if (!context.canDistribute) return 'Sólo el Super Administrador puede configurar el reparto.';
      if (!['Titular', 'Igual', 'Personalizado'].includes(draft.distribution.mode)) return 'Seleccione un reparto válido.';
      if (draft.distribution.mode === 'Personalizado') {
        const weights = draft.distribution.weights;
        if (!weights.length || new Set(weights.map(weight => weight.employeeId)).size !== weights.length ||
            weights.some(weight => !draft.employeeIds.includes(weight.employeeId) || !money(weight.weight) || Number(weight.weight) <= 0) ||
            Math.abs(weights.reduce((total, weight) => total + Number(weight.weight), 0) - 100) > 0.000001) {
          return 'El reparto personalizado debe sumar 100% entre personas seleccionadas.';
        }
      }
    }
    if (draft.challenges.length && (!context.canSetChallenges ||
        !draft.challenges.every(challenge => draft.employeeIds.includes(challenge.employeeId) && validChallenge(challenge)))) {
      return 'Revise permisos, metas, fecha y porcentaje de los retos (0,1 a 40%).';
    }
    return '';
  }
  function csv(branches) {
    const cell = value => `"${String(value == null ? '' : value).replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""')}"`;
    return [['Cartera', 'Oficina', 'Estado', 'Personas'], ...branches.map(branch =>
      [branch.name, branch.officeName, branch.state, branch.assignedCount])].map(row => row.map(cell).join(',')).join('\r\n');
  }
  function markInvitationSeen(storage, key) {
    const cacheKey = `dispatch-challenge:${key}`;
    if (storage.getItem(cacheKey)) return false;
    storage.setItem(cacheKey, '1');
    return true;
  }
  return { positiveId, filterBranches, personName, employeeGroups, validChallenge, validContext, validateDraft, csv, markInvitationSeen };
});
