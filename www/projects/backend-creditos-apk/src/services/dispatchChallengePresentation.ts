type Row = Record<string, unknown>;

export function formatChallengeGoal(row: Row) {
  const allocation = Object.fromEntries(['weight', 'capitalRate', 'collectionRate'].map((k) => [k, Number(row[k])]));
  const goal = Object.fromEntries(['targetCommission', 'otherCommission', 'routeCommission', 'commissionGap',
    'capitalRequired', 'collectionRequired', 'projectedCommission', 'projectedEarnedWithoutBonuses',
    'surplusAmount', 'surplusPercent'].map((k) => [k, row[k] == null ? null : Number(row[k])]));
  return { status: String(row.status), allocation, goal };
}

export function presentOwnChallenge(row: Row, salary: Row, result: Row, today: string, collections: Row | null,
  coverage: boolean) {
  const { allocation, goal } = formatChallengeGoal(result);
  const target = Number(goal.targetCommission);
  const commission = Number(salary.commissionAmount);
  const weight = Number(allocation.weight);
  const capitalTarget = Number(row.capitalGoal) * weight / 100;
  const collectionTarget = Number(row.collectionGoal) * weight / 100;
  const creditedCapital = Number(result.creditedCapital ?? row.creditedCapital);
  const creditedCollection = Number(result.creditedCollection ?? row.creditedCollection);
  const expired = String(row.deadline) < today;
  const assigned = Boolean(Number(row.assigned));
  const closed = row.routeState !== 'created';
  const status = expired ? 'expired' : closed ? 'closed' : !assigned ? 'unassigned' : 'active';
  const warnings = [
    'Invitación y estimación, no garantía de ingresos. El reto no crea bonos ni modifica el sueldo.',
    'Avance capital/recaudo atribuible a su participación desde la invitación dentro del período salarial al corte; la meta salarial usa el período propio completo.',
    ...(coverage ? ['Vacaciones/relevo en el rango: no se proyecta una participación constante.'] : []),
    ...(result.status === 'insufficient_data' ? ['Sin básico o participación comisionable suficiente para estimar el incremento.'] : []),
  ];
  return {
    challengeId: String(row.challengeId), routeId: Number(row.routeId), branchId: Number(row.branchId),
    branchName: String(row.branchName), routeState: String(row.routeState), assigned, status,
    invitationDate: String(row.invitationDate), deadline: String(row.deadline), description: String(row.description),
    incrementPercent: Number(row.incrementPercent), capitalGoal: Number(row.capitalGoal),
    collectionGoal: Number(row.collectionGoal), salary, allocation, goal,
    progress: { creditedCapital, creditedCollection, capitalTarget, collectionTarget,
      capitalPercent: capitalTarget > 0 ? creditedCapital / capitalTarget * 100 : null,
      collectionPercent: collectionTarget > 0 ? creditedCollection / collectionTarget * 100 : null,
      commissionAmount: commission, targetCommission: target,
      commissionPercent: target > 0 ? commission / target * 100 : null,
      achieved: target > 0 && commission >= target },
    forecast: { estimated: true,
      status: expired || closed || !assigned ? 'not_applicable'
        : coverage || result.status === 'insufficient_data' || collections?.status === 'insufficient_data'
          ? 'insufficient_data' : 'available',
      collections, warnings },
  };
}
