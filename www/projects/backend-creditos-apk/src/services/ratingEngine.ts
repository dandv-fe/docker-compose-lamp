import { fail } from './errors.js';

// Pure, explainable customer rating math (no external AI). Every rule is documented in README
// ("Calificación automática"). Dates are civil days in the business zone (APP_TIME_ZONE).

export type Mode = 'Diario' | 'Semanal' | 'Quincenal' | 'Mensual';
export type Confidence = 'initial' | 'limited' | 'established';

export interface RatingWeights { punctuality: number; delay: number; consistency: number; load: number }
export interface PaymentInput { amountCents: number; description: string; createdAtUtc: string | null }
export interface CardInput {
  id: string; status: string; mode: string; term: number; valueCents: number; balanceCents: number;
  createdAtUtc: string | null; payments: PaymentInput[];
}

export const DEFAULT_WEIGHTS: RatingWeights = { punctuality: 50, delay: 25, consistency: 15, load: 10 };
export const HORIZON_DAYS = 365;
export const DELAY_ZERO_DAYS = 60;
export const LOAD_WINDOW_DAYS = 90;
export const MIN_INSTALLMENTS = 8;
export const ESTABLISHED_INSTALLMENTS = 30;
export const ESTABLISHED_SPAN_DAYS = 90;
export const LIMITED_CAP = 8;
export const INVALID_DATA_CAP = 6;
export const NEW_HISTORY_DELAY_CAP = 5;
export const INITIAL_SCORE = 5;
export const MAX_TERM = 2000;
// Closed credits older than this cannot have installments inside the horizon for normal terms;
// the loader skips them (documented limit).
export const CLOSED_CREDIT_LOOKBACK_DAYS = 800;

const MODES: Record<Mode, { grace: number; period: number; perDay: number }> = {
  Diario: { grace: 1, period: 1, perDay: 6 / 7 },
  Semanal: { grace: 2, period: 7, perDay: 1 / 7 },
  Quincenal: { grace: 3, period: 15, perDay: 1 / 15 },
  Mensual: { grace: 5, period: 30, perDay: 12 / 365 },
};
const EXCLUDED_STATUSES = new Set(['fallecio', 'discapacitado']);
/** Cash movements as classified by the web (Cartera.js); everything else is an accounting adjustment. */
const CASH_PAYMENT = /^(?:Abono|c-Inicial|Inicial|Cancelad[oa]|Pagado)(?=$|\s|->|:)/i;
/** Refinancing interest (Cartera::saveDescripcionDescuentoOrMasInteres also extends int_tiempo). */
const INTEREST = /^(?:\d{4}\/\d{2}\/\d{2}->)?Inter(?:eses|eces|és)(?=$|\s|->|:)/i;

export function parseRatingWeights(env: NodeJS.ProcessEnv = process.env): RatingWeights {
  const names: Array<[keyof RatingWeights, string]> = [
    ['punctuality', 'RATING_WEIGHT_PUNCTUALITY'], ['delay', 'RATING_WEIGHT_DELAY'],
    ['consistency', 'RATING_WEIGHT_CONSISTENCY'], ['load', 'RATING_WEIGHT_LOAD'],
  ];
  const weights = { ...DEFAULT_WEIGHTS };
  for (const [key, name] of names) {
    const raw = env[name];
    if (raw === undefined || raw === '') continue;
    if (!/^\d{1,3}$/.test(raw.trim()) || Number(raw) > 100) {
      fail('CONFIGURATION_ERROR', `${name} debe ser un entero entre 0 y 100`);
    }
    weights[key] = Number(raw);
  }
  const total = weights.punctuality + weights.delay + weights.consistency + weights.load;
  if (total !== 100) fail('CONFIGURATION_ERROR', `Los pesos de calificación deben sumar 100 (suman ${total})`);
  return weights;
}

// ---- civil-day helpers (day = days since 1970-01-01 of the civil date) ----
const formatters = new Map<string, Intl.DateTimeFormat>();
export function civilDay(utc: Date, zone: string): number {
  let formatter = formatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' });
    formatters.set(zone, formatter);
  }
  const [y, m, d] = formatter.format(utc).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}
const weekday = (day: number) => ((day % 7) + 11) % 7; // 0 = Sunday (1970-01-01 was a Thursday)
const weekIndex = (day: number) => Math.floor((day + 3) / 7); // Monday-based weeks
const dateOf = (day: number) => new Date(day * 86_400_000);
export const dayToIso = (day: number) => dateOf(day).toISOString().slice(0, 10);

function parseUtc(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Due civil days of the first [count] installments, following the legacy web (Cartera.js) rules. */
export function dueDays(mode: Mode, startDay: number, count: number): number[] {
  const days: number[] = [];
  if (mode === 'Diario') {
    for (let day = startDay + 1; days.length < count; day += 1) if (weekday(day) !== 0) days.push(day);
  } else if (mode === 'Semanal' || mode === 'Quincenal') {
    const step = mode === 'Semanal' ? 7 : 15;
    for (let k = 1; k <= count; k += 1) days.push(startDay + k * step);
  } else {
    // Web counts only dates whose day-of-month equals the start's, so months without it are skipped.
    const start = dateOf(startDay);
    const dom = start.getUTCDate();
    for (let month = 1; days.length < count; month += 1) {
      const candidate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + month, dom));
      if (candidate.getUTCDate() === dom) days.push(candidate.getTime() / 86_400_000);
    }
  }
  return days;
}

export interface Evaluation {
  automaticScore: number;
  continuous: number;
  confidence: Confidence;
  explanation: string;
  metrics: Record<string, unknown>;
  hasOpenCredits: boolean;
  hasHistory: boolean;
}

type InvalidReason = 'modo' | 'plazo' | 'valor' | 'fecha' | 'saldo';

interface PreparedCard {
  card: CardInput; mode: Mode; startDay: number; term: number; obligation: number;
  /** Total still demanded by the schedule after discounts/corrections, in cents × term units. */
  owedScaled: number; adjustments: number;
  coverage: Array<{ day: number; cumulative: number }>; open: boolean;
}

function prepare(card: CardInput, zone: string, today: number): PreparedCard | InvalidReason {
  if (!(card.mode in MODES)) return 'modo';
  if (!Number.isInteger(card.term) || card.term < 1 || card.term > MAX_TERM) return 'plazo';
  if (!Number.isFinite(card.valueCents) || card.valueCents <= 0) return 'valor';
  const created = parseUtc(card.createdAtUtc);
  if (!created) return 'fecha';
  const startDay = civilDay(created, zone);
  if (startDay > today) return 'fecha';
  let total = 0;
  let interest = 0;
  let adjustment = 0;
  let adjustments = 0;
  const events: Array<{ day: number; amount: number }> = [];
  for (const payment of card.payments) {
    const at = parseUtc(payment.createdAtUtc);
    if (!at || !Number.isFinite(payment.amountCents)) return 'fecha';
    total += payment.amountCents;
    if (payment.amountCents === 0) continue;
    const description = payment.description.trim();
    // Cash (negative = paid, positive = reversal) is the only thing that covers installments.
    if (CASH_PAYMENT.test(description)) events.push({ day: civilDay(at, zone), amount: -payment.amountCents });
    else if (payment.amountCents > 0 && INTEREST.test(description)) interest += payment.amountCents;
    else { adjustment += payment.amountCents; adjustments += 1; }
  }
  // Legacy invariant (verified on production data): dec_resta = dec_valor + SUM(dec_abono).
  if (Math.abs(card.valueCents + total - card.balanceCents) > 1) return 'saldo';
  events.sort((a, b) => a.day - b.day);
  const coverage: PreparedCard['coverage'] = [];
  let cumulative = 0;
  for (const event of events) {
    cumulative += event.amount;
    const last = coverage[coverage.length - 1];
    if (last && last.day === event.day) last.cumulative = cumulative;
    else coverage.push({ day: event.day, cumulative });
  }
  const obligation = card.valueCents + interest;
  // Discounts/corrections never count as payments: they only waive (or add to) the tail of the schedule.
  const owedScaled = Math.min(obligation, Math.max(0, obligation + adjustment)) * card.term;
  return {
    card, mode: card.mode as Mode, startDay, term: card.term, obligation, owedScaled, adjustments, coverage,
    open: card.status !== 'cancelado' && card.balanceCents > 0,
  };
}

/** First civil day the installment [k] (1-based) was fully covered, or null. */
function coveredOn(prepared: PreparedCard, k: number): number | null {
  const required = Math.min(k * prepared.obligation, prepared.owedScaled);
  for (const point of prepared.coverage) {
    if (point.cumulative * prepared.term >= required) return point.day;
  }
  return null;
}

const pct = (value: number) => `${Math.round(value * 100)}%`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const CONFIDENCE_TEXT: Record<Confidence, string> = {
  initial: 'inicial', limited: 'limitada', established: 'establecida',
};

export function evaluateCustomer(
  cards: CardInput[], now: Date, zone: string, weights: RatingWeights = DEFAULT_WEIGHTS,
): Evaluation {
  const today = civilDay(now, zone);
  const horizonStart = today - HORIZON_DAYS;
  const invalid: Record<InvalidReason, number> = { modo: 0, plazo: 0, valor: 0, fecha: 0, saldo: 0 };
  let invalidOpen = 0;
  let excluded = 0;
  const prepared: PreparedCard[] = [];
  for (const card of cards) {
    if (EXCLUDED_STATUSES.has(card.status)) { excluded += 1; continue; }
    const result = prepare(card, zone, today);
    if (typeof result === 'string') {
      invalid[result] += 1;
      if (card.status !== 'cancelado' && card.balanceCents > 0) invalidOpen += 1;
    } else prepared.push(result);
  }
  const invalidCount = Object.values(invalid).reduce((a, b) => a + b, 0);

  let evaluated = 0;
  let onTime = 0;
  let slightlyLate = 0;
  let firstDue: number | null = null;
  let delayDays = 0;
  let delayedCards = 0;
  const requiredWeeks = new Set<number>();
  const paidWeeks = new Set<number>();
  let loadPerDay = 0;
  let openCards = 0;
  let firstOpenStart: number | null = null;
  let cashInWindow = 0;
  let waived = 0;
  let adjustmentRows = 0;
  const loadWindowStart = today - LOAD_WINDOW_DAYS;

  for (const item of prepared) {
    const { grace, period, perDay } = MODES[item.mode];
    for (const payment of item.card.payments) {
      if (payment.amountCents >= 0 || !CASH_PAYMENT.test(payment.description.trim())) continue;
      const day = civilDay(new Date(payment.createdAtUtc!), zone);
      if (day >= horizonStart && day < today) paidWeeks.add(weekIndex(day));
      if (day >= loadWindowStart && day < today) {
        cashInWindow += -payment.amountCents;
      }
    }
    const due = dueDays(item.mode, item.startDay, item.term);
    let oldestOpen: number | null = null;
    adjustmentRows += item.adjustments;
    due.forEach((dueDay, index) => {
      if (dueDay >= today) return;
      if (index * item.obligation >= item.owedScaled) { waived += 1; return; }
      const covered = coveredOn(item, index + 1);
      if (covered == null && oldestOpen == null) oldestOpen = dueDay;
      if (dueDay < horizonStart) return;
      evaluated += 1;
      firstDue = firstDue == null ? dueDay : Math.min(firstDue, dueDay);
      const late = Math.max(0, (covered ?? today) - dueDay);
      if (late <= grace) onTime += 1;
      else if (late <= grace + period) slightlyLate += 1;
      const week = weekIndex(dueDay);
      const weekStart = week * 7 - 3;
      if (weekStart + 6 < today && (covered == null || covered >= weekStart)) requiredWeeks.add(week);
    });
    if (item.open) {
      openCards += 1;
      loadPerDay += (item.obligation / item.term) * perDay;
      firstOpenStart = firstOpenStart == null ? item.startDay : Math.min(firstOpenStart, item.startDay);
      if (oldestOpen != null) {
        const days = Math.max(0, today - (oldestOpen as number) - grace);
        if (days > 0) delayedCards += 1;
        delayDays = Math.max(delayDays, days);
      }
    }
  }

  const satisfiedWeeks = [...requiredWeeks].filter((week) => paidWeeks.has(week)).length;
  const punctuality = evaluated ? (onTime + slightlyLate * 0.5) / evaluated : 1;
  const delayFactor = Math.max(0, 1 - delayDays / DELAY_ZERO_DAYS);
  const consistency = requiredWeeks.size ? satisfiedWeeks / requiredWeeks.size : 1;
  const loadSpan = firstOpenStart == null ? 0 : Math.min(LOAD_WINDOW_DAYS, today - (firstOpenStart as number));
  let loadFactor = 1;
  let loadNote: string;
  if (openCards === 0) loadNote = 'sin créditos activos';
  else if (delayDays === 0) loadNote = `al día con ${plural(openCards, 'crédito activo', 'créditos activos')}`;
  else if (loadSpan < 7) loadNote = 'créditos activos muy recientes para medir pagos habituales';
  else {
    const habitual = cashInWindow / loadSpan;
    loadFactor = loadPerDay > 0 ? Math.min(1, habitual / loadPerDay) : 1;
    loadNote = `pagos habituales cubren ${pct(loadFactor)} de las cuotas de ${plural(openCards, 'crédito activo', 'créditos activos')}`;
  }

  const weighted = (weights.punctuality * punctuality + weights.delay * delayFactor
    + weights.consistency * consistency + weights.load * loadFactor) / 100;
  let continuous = 1 + 9 * weighted;
  const span = firstDue == null ? 0 : today - (firstDue as number);
  let confidence: Confidence;
  let cap = 10;
  const notes: string[] = [];
  if (evaluated < MIN_INSTALLMENTS && delayDays === 0) {
    confidence = 'initial';
    continuous = INITIAL_SCORE;
    cap = INITIAL_SCORE;
  } else if (evaluated < MIN_INSTALLMENTS) {
    confidence = 'limited';
    cap = NEW_HISTORY_DELAY_CAP;
    notes.push(`poca historia con atraso: máximo ${NEW_HISTORY_DELAY_CAP}`);
  } else if (evaluated < ESTABLISHED_INSTALLMENTS || span < ESTABLISHED_SPAN_DAYS) {
    confidence = 'limited';
    cap = LIMITED_CAP;
  } else confidence = 'established';
  if (invalidOpen > 0 && confidence !== 'initial') {
    if (confidence === 'established') confidence = 'limited';
    cap = Math.min(cap, INVALID_DATA_CAP);
    notes.push(`evidencia insuficiente por datos inválidos: máximo ${INVALID_DATA_CAP}`);
  }
  continuous = Math.min(cap, continuous);
  const automaticScore = Math.min(10, Math.max(1, Math.round(continuous)));

  const parts: string[] = [];
  if (confidence === 'initial') {
    parts.push(`Inicial · poca historia (${INITIAL_SCORE}/10): ${plural(evaluated, 'cuota vencida evaluada', 'cuotas vencidas evaluadas')}; se requieren ${MIN_INSTALLMENTS}.`);
    if (prepared.length === 0 && invalidCount === 0) parts.push('Sin créditos para evaluar.');
  } else {
    parts.push(`Automática ${automaticScore}/10, confianza ${CONFIDENCE_TEXT[confidence]}.`);
    parts.push(`Puntualidad ${pct(punctuality)} (${onTime} de ${evaluated} cuotas a tiempo${slightlyLate ? `, ${slightlyLate} con poco atraso` : ''}, últimos 12 meses).`);
    parts.push(`Atraso actual: ${delayDays ? `${plural(delayDays, 'día', 'días')} en ${plural(delayedCards, 'crédito', 'créditos')}` : 'al día'}.`);
    parts.push(`Constancia: pagó en ${satisfiedWeeks} de ${plural(requiredWeeks.size, 'semana', 'semanas')} con cuota pendiente.`);
    parts.push(`Carga: ${loadNote}.`);
  }
  if (invalidCount) {
    const reasons = Object.entries(invalid).filter(([, n]) => n).map(([reason, n]) => `${reason} ${n}`).join(', ');
    parts.push(`${plural(invalidCount, 'crédito excluido', 'créditos excluidos')} por datos inválidos (${reasons}).`);
  }
  if (adjustmentRows) {
    parts.push(`${plural(adjustmentRows, 'ajuste contable', 'ajustes contables')} (descuentos/correcciones) no cuentan como pago${waived ? `; ${plural(waived, 'cuota condonada', 'cuotas condonadas')} no se evalúan` : ''}.`);
  }
  if (excluded) parts.push(`${plural(excluded, 'crédito', 'créditos')} por fallecimiento/discapacidad no cuentan.`);
  if (notes.length) parts.push(`Límite: ${notes.join('; ')}.`);
  let explanation = parts.join(' ');
  if (Array.from(explanation).length > 500) explanation = `${Array.from(explanation).slice(0, 499).join('')}…`;

  return {
    automaticScore, continuous: Math.round(continuous * 1000) / 1000, confidence, explanation,
    hasOpenCredits: openCards > 0 || invalidOpen > 0,
    hasHistory: evaluated > 0,
    metrics: {
      version: 1, today: dayToIso(today), weights,
      punctuality: { value: punctuality, evaluated, onTime, slightlyLate },
      delay: { value: delayFactor, days: delayDays, cards: delayedCards },
      consistency: { value: consistency, requiredWeeks: requiredWeeks.size, satisfiedWeeks },
      load: { value: loadFactor, openCards, loadPerDayCents: Math.round(loadPerDay), cashInWindowCents: cashInWindow, spanDays: loadSpan },
      confidence, cap, spanDays: span, adjustments: adjustmentRows, waived, invalid, invalidOpen, excluded, cards: prepared.length,
    },
  };
}

/**
 * Keeps the stored automatic score unless the new value moved at least one full point, so day-to-day
 * noise around a rounding boundary never flips the rating (and never floods the history).
 */
export function stableAutomaticScore(
  previous: { score: number | null; confidence: string | null }, evaluation: Evaluation,
): number {
  if (previous.score == null || previous.confidence !== evaluation.confidence) return evaluation.automaticScore;
  return Math.abs(evaluation.continuous - previous.score) >= 1 ? evaluation.automaticScore : previous.score;
}
