import type { AuthUser } from './auth.js';

export function authorizedPayrollQuery(
  user: Pick<AuthUser, 'companyId' | 'employeeId' | 'cargo'>,
  branchId: number,
  payrollId?: number,
  routeId?: number,
) {
  const params: Array<number | string> = [branchId, user.companyId];
  let scope: string;
  if (user.cargo === 'Super Administrador') {
    scope = '1=1';
  } else {
    scope = `(o.idempleado_administrador=? AND e.idoficina=s.idoficina)
      OR (e.idempleado=? AND EXISTS (
        SELECT 1 FROM tbl_detalle_ruta dr
        JOIN tbl_empleados_cobrando ec ON ec.id_detalle_ruta=dr.iddetalleruta
        WHERE dr.idglobal=s.idglobal AND dr.idsucursal=s.idsucursal
          AND dr.str_estado='created' AND ec.idempleado=e.idempleado
          ${routeId === undefined ? '' : 'AND dr.iddetalleruta=?'}
      ))`;
    params.push(user.employeeId ?? -1, user.employeeId ?? -1);
    if (routeId !== undefined) params.push(routeId);
  }
  if (payrollId !== undefined) params.push(payrollId);
  return {
    sql: `SELECT n.idnomina AS id,
          TRIM(CONCAT_WS(' ', p.str_nombres, p.str_apellidos)) AS name,
          employeeOffice.idoficina AS officeId, employeeOffice.str_nombre AS officeName,
          COALESCE(employeeOffice.idoficina=s.idoficina, 0) AS suggested
      FROM tbl_nomina n
      JOIN tbl_empleado e ON e.idempleado=n.idempleado AND e.idglobal=n.idglobal
      JOIN tbl_persona p ON p.idpersona=e.idpersona AND p.idglobal=e.idglobal
      JOIN tbl_sucursal s ON s.idsucursal=? AND s.idglobal=n.idglobal
      LEFT JOIN tbl_oficina o ON o.idoficina=s.idoficina AND o.idglobal=s.idglobal
      LEFT JOIN tbl_oficina employeeOffice ON employeeOffice.idoficina=e.idoficina AND employeeOffice.idglobal=e.idglobal
      WHERE n.idglobal=? AND n.str_estado='activo' AND (${scope})
        ${payrollId === undefined ? '' : 'AND n.idnomina=?'}
      ORDER BY suggested DESC, employeeOffice.idoficina IS NULL, officeName, officeId, name, n.idnomina`,
    params,
  };
}
