import { z } from 'zod';
import { createHash } from 'node:crypto';
import { fail } from './errors.js';

const text = (max: number) => z.string().max(max);
const number = z.number().finite();
const nullableText = (max: number) => text(max).nullable().optional();
const personFields = {
  nombres: text(100), apellidos: text(100), sexo: text(20),
  fechaNacimiento: nullableText(11), tipoDocumento: text(45), numeroDocumento: text(45),
  telefono: text(15), email: text(100), ocupacion: text(100), notaPersona: text(255),
  departamento: text(50), ciudad: text(50), barrio: text(50), calle: text(50),
  fotoBase64: text(15_000_000).optional(),
};
const clientFields = {
  maxCredito: number.nonnegative(), apodo: text(20), notaCliente: text(255),
  estadoCliente: text(15), fiadorPersonaId: z.number().int().nullable().optional(),
};
// Part of an abono received, or of a new credit paid out, through a company bank account
// (tbl_banco). Whatever is not covered by these rows is cash.
const bankSplits = z.array(z.object({
  idbanco: z.number().int().positive(), valor: number.positive(), referencia: text(50).optional(),
}).strict()).max(5).optional();
const creditFields = {
  idtarjeta: z.string().min(1).max(50), idcliente: z.number().int(), idventa: z.number().int().nullable().optional(),
  concepto: text(30), valor: number, modo: z.enum(['Diario', 'Semanal', 'Quincenal', 'Mensual']),
  plazo: z.number().int(), prestamo: number, descripcion: z.string().max(65_535), cuotaInicial: number.optional(),
  item: number, utilidad: number, adicionalNumero: text(11), adicionalValor: number,
  tipoComprobante: text(30), serie: text(11), numero: text(11), nota: z.string().max(65_535),
  obligacion: nullableText(11), detalleDocumentoSucursalId: z.number().int(),
  tarjetaReferenciaId: text(50).optional(), ubicacion: z.enum(['antes', 'despues']).optional(),
  bancos: bankSplits,
};
// When the transfer is bigger than the abono the collector hands the difference back in cash;
// `vuelto` is that difference, sent on purpose so a mistyped transfer can never drain the pocket.
const cashChange = number.nonnegative().optional();
const paymentFields = {
  iddescripcion: z.string().min(1).max(50), abono: number, descripcion: text(255).optional(),
  bancos: bankSplits, vuelto: cashChange,
};
const commentFields = {
  idcliente: z.number().int(), comentario: text(255), tipo: text(30),
};

export const operationPayloadSchemas: Record<string, z.ZodTypeAny> = {
  CREATE_CUSTOMER: z.object({ ...personFields, ...clientFields }).strict(),
  UPDATE_CUSTOMER: z.object({ ...personFields, ...clientFields }).strict(),
  UPDATE_DOCUMENT: z.object({ tipoDocumento: text(45), numeroDocumento: text(45) }).strict(),
  CREATE_CREDIT: z.object(creditFields).strict(),
  UPDATE_CREDIT: z.object({
    concepto: text(30), valor: number, modo: z.enum(['Diario', 'Semanal', 'Quincenal', 'Mensual']),
    plazo: z.number().int(), prestamo: number, descripcion: z.string().max(65_535), item: number,
    utilidad: number, adicionalNumero: text(11), adicionalValor: number,
    tipoComprobante: text(30), serie: text(11), numero: text(11), nota: z.string(),
  }).strict(),
  UPDATE_CREDIT_TERMS: z.object({
    modo: z.enum(['Diario', 'Semanal', 'Quincenal', 'Mensual']), plazo: z.number().int(),
    numero: text(11), createdAt: text(19),
  }).strict(),
  CREATE_PAYMENT: z.object(paymentFields).strict(),
  UPDATE_PAYMENT: z.object({ abono: number, descripcion: text(255), bancos: bankSplits, vuelto: cashChange }).strict(),
  DELETE_PAYMENT: z.object({}).strict(),
  DELETE_CREDIT: z.object({}).strict(),
  APPLY_DISCOUNT: z.object({ amount: number, descripcion: text(255).optional() }).strict(),
  ADD_INTEREST: z.object({ amount: number, plazo: z.number().int(), descripcion: text(255).optional() }).strict(),
  CHANGE_CREDIT_STATUS: z.object({ status: text(50) }).strict(),
  REORDER_CREDIT: z.object({ item: number }).strict(),
  CREATE_COMMENT: z.object(commentFields).strict(),
  UPDATE_COMMENT: z.object({ comentario: text(255) }).strict(),
  DELETE_COMMENT: z.object({}).strict(),
  UPSERT_ALERT: z.object({
    idcliente: z.number().int(),
    icon: text(255),
    color: text(255),
    subject: text(255),
    text: text(255),
  }).strict(),
};

export function parseOperationPayload(kind: string, value: unknown): Record<string, unknown> {
  const schema = operationPayloadSchemas[kind];
  if (!schema) fail('VALIDATION_ERROR', 'Unsupported operation kind');
  const parsed = schema.safeParse(value);
  if (!parsed.success) fail('VALIDATION_ERROR', 'Invalid operation payload');
  if (parsed.data === null || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
    fail('VALIDATION_ERROR', 'Payload must be an object');
  }
  return parsed.data as Record<string, unknown>;
}

export function assertCompanyScope(authenticatedCompanyId: number, recordCompanyId: number) {
  if (authenticatedCompanyId !== recordCompanyId) fail('FORBIDDEN', 'Record is outside authenticated company');
}

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(',')}}`;
}

export function assertPayloadMatch(stored: unknown, incoming: unknown) {
  if (stableJson(stored) !== stableJson(incoming)) fail('IDEMPOTENCY_MISMATCH', 'Operation ID was already used with a different payload');
}

export function payloadDigest(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

export function assertPayloadDigestMatch(storedDigest: string, incoming: unknown) {
  if (storedDigest !== payloadDigest(incoming)) {
    fail('IDEMPOTENCY_MISMATCH', 'Operation ID was already used with a different payload');
  }
}

export function assertBaseVersion(latestEventId: number | string, baseVersion: number | string | null) {
  if (baseVersion !== null && BigInt(latestEventId) > BigInt(baseVersion)) {
    fail('CONFLICT', 'Record changed after the supplied base version');
  }
}

export function decimalToCents(value: number | string): bigint {
  const textValue = String(value);
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(textValue);
  if (!match) fail('VALIDATION_ERROR', 'Invalid monetary value');
  const whole = BigInt(match[2]);
  const fraction = match[3] ?? '';
  let cents = whole * 100n + BigInt((fraction + '00').slice(0, 2));
  if (Number(fraction[2] ?? '0') >= 5) cents += 1n;
  return match[1] === '-' ? -cents : cents;
}

export function centsToDecimal(cents: bigint): string {
  const sign = cents < 0n ? '-' : '';
  const absolute = cents < 0n ? -cents : cents;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

export function serializeAlert(payload: Record<string, unknown>): string {
  const clean = (value: unknown) => String(value).replace(/\/,/gi, '');
  const serialized = [
    String(payload.icon), String(payload.color), clean(payload.subject), clean(payload.text),
  ].join('/,');
  if (serialized.length > 255) fail('VALIDATION_ERROR', 'Combined alert content exceeds the legacy 255-character limit');
  return serialized;
}

export function rejectExistingAlert(existing: boolean): void {
  if (existing) {
    fail('CONFLICT', 'An alert already exists; updating alert content requires a product decision');
  }
}
