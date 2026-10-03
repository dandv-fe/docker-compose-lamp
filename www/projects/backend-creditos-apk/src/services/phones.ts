import { fail } from './errors.js';

export function normalizePhone(raw: string): string | null {
  const text = raw.trim();
  if (!/^(?:\+|00)?[0-9]+(?:[ ()-][0-9]+)*$/.test(text)) return null;
  let digits = text.replace(/[ ()-]/g, '').replace(/^\+/, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (/^3\d{9}$/.test(digits)) return `57${digits}`;
  if (/^573\d{9}$/.test(digits)) return digits;
  if (/^[1-9]\d{10,14}$/.test(digits) && !digits.startsWith('57')) return digits;
  return null;
}

export function requirePhone(raw: string): string {
  const phone = normalizePhone(raw);
  if (!phone) fail('VALIDATION_ERROR', 'Ingresa un solo celular colombiano de 10 dígitos que empiece en 3, o un número internacional válido.');
  return phone;
}

export function phoneForChange(raw: string, current?: string | null): string {
  if (raw === current) return raw;
  return raw.trim() === '' ? '' : requirePhone(raw);
}

type Execute = (sql: string, values?: unknown[]) => Promise<[unknown, unknown]>;

// Call only after authorizing the customer in the requested branch.
export async function customerPhones(execute: Execute, companyId: number, personId: number) {
  const [rows] = await execute(
    `SELECT CAST(idphone AS CHAR) AS id,raw_phone AS phone,normalized_phone AS normalizedPhone,
            CAST(whatsapp_open_count AS CHAR) AS whatsappOpenCount,
            is_invalid AS invalid,CAST(validity_changed_by AS CHAR) AS validityChangedBy,
            DATE_FORMAT(validity_changed_at,'%Y-%m-%dT%H:%i:%s') AS validityChangedAt,
            DATE_FORMAT(whatsapp_last_opened_at,'%Y-%m-%dT%H:%i:%s') AS whatsappLastOpenedAt
     FROM mobile_customer_phone WHERE idglobal=? AND idpersona=? ORDER BY idphone`,
    [companyId, personId],
  );
  return (rows as Record<string, unknown>[]).map(row => ({ ...row, invalid: Number(row.invalid) === 1 }));
}
