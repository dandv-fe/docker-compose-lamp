import type { AuthUser } from './auth.js';

type Execute = (sql: string, values?: unknown[]) => Promise<[unknown, unknown]>;

export interface SyncEventRow {
  cursor: string;
  recordType: string;
  recordId: string;
  relatedId: string | null;
  action: string;
  createdAt: Date | string | null;
}

export interface SyncChange {
  cursor: string;
  recordType: string;
  recordId: string;
  action: string;
  createdAt: Date | string | null;
  payload: unknown;
}

// Equivalent to `EXISTS (SELECT 1 FROM mobile_customer_branch m WHERE m.idglobal=<alias>.idglobal
// AND m.idcliente=<alias>.idcliente AND m.idsucursal=?)`, but written against the three underlying
// indexed tables directly instead of the view. The view is a UNION and MariaDB cannot push the
// EXISTS predicates into it, so it fully re-materializes ~284k rows (full scan of tbl_tarjetas,
// ~5s) on every call. Checking each branch separately keeps identical semantics while letting the
// optimizer use existing indexes, turning a ~5s lookup into a sub-millisecond one.
export function branchScopeExists(alias: string): string {
  return `(
    EXISTS (SELECT 1 FROM tbl_tarjetas t2
      WHERE t2.idglobal=${alias}.idglobal AND t2.idcliente=${alias}.idcliente AND t2.idsucursal=?)
    OR EXISTS (SELECT 1 FROM tbl_auth_sucursal a
      JOIN tbl_sucursal s ON s.idsucursal=a.idsucursal AND s.idglobal=a.idglobal
      WHERE a.idempleado=${alias}.created_empleado_id AND a.idglobal=${alias}.idglobal
        AND a.str_estado<>'inactivo' AND a.idsucursal=?)
    OR EXISTS (SELECT 1 FROM mobile_change_event e
      WHERE e.idglobal=${alias}.idglobal AND e.record_type='customer'
        AND e.record_id=CAST(${alias}.idcliente AS CHAR) COLLATE utf8mb4_general_ci
        AND e.action='INSERT' AND e.idsucursal=?)
  )`;
}

function tombstone(event: SyncEventRow): SyncChange {
  return {
    cursor: String(event.cursor),
    recordType: event.recordType,
    recordId: event.recordId,
    action: 'DELETE',
    createdAt: event.createdAt,
    payload: {
      id: event.recordId,
      ...(event.recordType === 'comment' && event.relatedId
        ? { customerId: Number(event.relatedId) }
        : {}),
      deleted: true,
    },
  };
}

export async function materializeSyncEvent(
  execute: Execute,
  user: AuthUser,
  branchId: number,
  event: SyncEventRow,
): Promise<SyncChange | null> {
  const base = {
    cursor: String(event.cursor),
    recordType: event.recordType,
    recordId: event.recordId,
    action: event.action,
    createdAt: event.createdAt,
  };
  if (event.action === 'DELETE') return tombstone(event);

  let sql: string;
  let params: unknown[];
  switch (event.recordType) {
    case 'customer':
      sql = `SELECT c.idcliente AS id,c.idglobal AS companyId,c.idpersona AS personId,
                    p.str_nombres AS firstName,p.str_apellidos AS lastName,p.str_sexo AS sex,
                    p.str_fecha_nacimiento AS birthDate,p.str_tipo_documento AS documentType,
                    p.str_num_documento AS documentNumber,p.str_telefono AS phone,p.str_email AS email,
                    p.str_foto AS photo,p.str_ocupacion AS occupation,p.str_estado AS personStatus,
                    p.str_nota AS personNote,p.str_direccion_departamento AS department,
                    p.str_direccion_ciudad AS city,p.str_direccion_barrio AS neighborhood,
                    p.str_direccion_calle AS street,c.dec_max_credito AS maxCredit,
                    c.str_apodo AS nickname,c.str_nota AS note,c.str_estado AS status,
                    c.str_calificacion AS rating,c.fiador_persona_id AS guarantorPersonId
             FROM tbl_clientes c
             JOIN tbl_persona p ON p.idpersona=c.idpersona AND p.idglobal=c.idglobal
             WHERE c.idcliente=? AND c.idglobal=? AND ${branchScopeExists('c')} LIMIT 1`;
      params = [event.recordId, user.companyId, branchId, branchId, branchId];
      break;
    case 'credit':
      sql = `SELECT t.idtarjeta AS id,t.idglobal AS companyId,t.idsucursal AS branchId,
                    t.idcliente AS customerId,t.idventa AS saleId,t.iddetalleruta AS routeId,
                    t.str_concepto AS concept,t.dec_valor AS value,t.str_modo AS frequency,
                    t.int_tiempo AS term,t.dec_prestamo AS principal,t.dec_resta AS balance,
                    t.str_descripcion AS description,t.float_item AS sortOrder,t.dec_utilidad AS profit,
                    t.str_c_adicional_numero AS additionalNumber,t.dec_c_adicional_valor AS additionalValue,
                    t.str_tipo_comprobante AS receiptType,t.str_serie AS receiptSeries,
                    t.str_numero AS receiptNumber,t.str_nota AS note,t.str_abono AS paymentSummary,
                    t.str_style AS style,t.str_estado AS status,t.created_empleado_id AS createdEmployeeId,
                    t.date_acuerdo AS agreementDate,t.created_at AS createdAt,t.updated_at AS updatedAt,(SELECT COALESCE(SUM(tp.dec_valor),0) FROM tbl_tarjeta_pago tp WHERE tp.idtarjeta=t.idtarjeta) AS bankFunded
             FROM tbl_tarjetas t
             WHERE t.idtarjeta=? AND t.idglobal=? AND t.idsucursal=? LIMIT 1`;
      params = [event.recordId, user.companyId, branchId];
      break;
    case 'payment':
      sql = `SELECT d.iddescripcion AS id,d.idtarjeta AS creditId,d.dec_abono AS amount,
                    d.str_descripcion AS description,d.str_estado AS state,
                    d.created_at AS createdAt,d.updated_at AS updatedAt,d.iddetalleruta AS routeId,
                    d.idusuario AS createdByUserId,d.str_origen AS origin,
                    (SELECT COALESCE(SUM(dp.dec_valor),0) FROM tbl_descripcion_pago dp WHERE dp.iddescripcion=d.iddescripcion) AS bankAmount,
                    COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.str_nombres, p.str_apellidos)), ''), u.str_user_name)
                        AS createdByUsername
             FROM tbl_descripcion d
             JOIN tbl_tarjetas t ON t.idtarjeta=d.idtarjeta AND t.idglobal=d.idglobal
               AND t.idsucursal=d.idsucursal
             LEFT JOIN tbl_usuario u ON u.idusuario=d.idusuario AND u.idglobal=d.idglobal
             LEFT JOIN tbl_persona p ON p.idpersona=u.idpersona AND p.idglobal=u.idglobal
             WHERE d.iddescripcion=? AND d.idglobal=? AND d.idsucursal=?
               AND t.idglobal=? AND t.idsucursal=? LIMIT 1`;
      params = [event.recordId, user.companyId, branchId, user.companyId, branchId];
      break;
    case 'comment':
      if (!event.relatedId) return tombstone(event);
      sql = `SELECT c.idcomentario AS id,l.idcliente AS customerId,
                    c.str_comentario AS comment,c.str_tipo AS type,
                    c.idusuario AS userId,c.created_at AS createdAt,c.update_at AS updatedAt
             FROM tbl_comentarios c
             JOIN tbl_comentarios_cliente l ON l.idcomentario=c.idcomentario
             JOIN tbl_clientes cl ON cl.idcliente=l.idcliente AND cl.idglobal=?
             WHERE c.idcomentario=? AND l.idcliente=? AND ${branchScopeExists('cl')} LIMIT 1`;
      params = [user.companyId, event.recordId, event.relatedId, branchId, branchId, branchId];
      break;
    case 'route':
      sql = `SELECT r.iddetalleruta AS id,r.str_estado AS status,
                    r.created_at AS createdAt,r.updated_at AS updatedAt
             FROM tbl_detalle_ruta r
             WHERE r.iddetalleruta=? AND r.idglobal=? AND r.idsucursal=? LIMIT 1`;
      params = [event.recordId, user.companyId, branchId];
      break;
    case 'receipt_sequence':
      sql = `SELECT d.iddetalle_documento_sucursal AS id,d.idtipo_documento AS documentTypeId,
                    d.str_ultima_serie AS lastSeries,d.str_ultimo_numero AS lastNumber
             FROM tbl_detalle_documento_sucursal d
             WHERE d.iddetalle_documento_sucursal=? AND d.idglobal=? AND d.idsucursal=? LIMIT 1`;
      params = [event.recordId, user.companyId, branchId];
      break;
    default:
      return null;
  }

  const [rows] = await execute(sql, params) as [Array<Record<string, unknown>>, unknown];
  const record = rows[0];
  if (!record) return tombstone(event);

  if (event.recordType === 'customer') {
    const [credits] = await execute(
      `SELECT t.idtarjeta AS id,t.idglobal AS companyId,t.idsucursal AS branchId,
              t.idcliente AS customerId,t.idventa AS saleId,t.iddetalleruta AS routeId,
              t.str_concepto AS concept,t.dec_valor AS value,t.str_modo AS frequency,
              t.int_tiempo AS term,t.dec_prestamo AS principal,t.dec_resta AS balance,
              t.str_descripcion AS description,t.float_item AS sortOrder,t.dec_utilidad AS profit,
              t.str_c_adicional_numero AS additionalNumber,t.dec_c_adicional_valor AS additionalValue,
              t.str_tipo_comprobante AS receiptType,t.str_serie AS receiptSeries,
              t.str_numero AS receiptNumber,t.str_nota AS note,t.str_abono AS paymentSummary,
              t.str_style AS style,t.str_estado AS status,t.created_empleado_id AS createdEmployeeId,
              t.date_acuerdo AS agreementDate,t.created_at AS createdAt,t.updated_at AS updatedAt,(SELECT COALESCE(SUM(tp.dec_valor),0) FROM tbl_tarjeta_pago tp WHERE tp.idtarjeta=t.idtarjeta) AS bankFunded
       FROM tbl_tarjetas t
       WHERE t.idglobal=? AND t.idsucursal=? AND t.idcliente=?
       ORDER BY t.float_item,t.created_at`,
      [user.companyId, branchId, record.id],
    ) as [Array<Record<string, unknown>>, unknown];
    const [comments] = await execute(
      `SELECT c.idcomentario AS id,l.idcliente AS customerId,c.str_comentario AS comment,
              c.str_tipo AS type,c.idusuario AS userId,c.created_at AS createdAt,
              c.update_at AS updatedAt
       FROM tbl_comentarios_cliente l
       JOIN tbl_comentarios c ON c.idcomentario=l.idcomentario
       WHERE l.idcliente=? ORDER BY c.created_at,c.idcomentario`,
      [record.id],
    ) as [Array<Record<string, unknown>>, unknown];
    record.credits = credits;
    record.comments = comments;
  }

  return { ...base, payload: record };
}
