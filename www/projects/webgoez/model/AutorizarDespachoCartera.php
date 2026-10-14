<?php

function esRepresentanteTemporalCartera(mysqli $conexion, array $sesion, int $idsucursal): bool
{
   $row = db_fetch_object($conexion, "SELECT 1 AS authorized FROM view_employee_payroll_active_coverage c
      JOIN tbl_usuario u ON u.idglobal=c.idglobal AND u.idusuario=?
      JOIN tbl_empleado e ON e.idglobal=u.idglobal AND e.idpersona=u.idpersona AND e.str_estado='activo'
      WHERE c.idglobal=? AND c.branch_id=? AND c.replacement_employee_id=e.idempleado
        AND u.str_estado='activo' LIMIT 1", 'iii',
      [(int)($sesion['idusuario'] ?? 0), (int)($sesion['idglobal'] ?? 0), $idsucursal]);
   return $row !== null;
}

function tienePermisoTemporalCartera(mysqli $conexion, array $sesion, int $idsucursal, string $permiso): bool
{
   return db_fetch_object($conexion, "SELECT 1 AS authorized FROM view_employee_payroll_temporary_permission t
      JOIN tbl_usuario u ON u.idglobal=t.idglobal AND u.idusuario=?
      JOIN tbl_empleado e ON e.idglobal=u.idglobal AND e.idpersona=u.idpersona AND e.idempleado=t.employee_id
      WHERE t.idglobal=? AND t.branch_id=? AND t.permission=? AND u.str_estado='activo' AND e.str_estado='activo' LIMIT 1",
      'iiis', [(int)($sesion['idusuario'] ?? 0), (int)($sesion['idglobal'] ?? 0), $idsucursal, $permiso]) !== null;
}

function esGestorBonoCartera(mysqli $conexion, array $sesion, int $idsucursal): bool
{
   return db_fetch_object($conexion, "SELECT 1 AS authorized FROM view_employee_payroll_bonus_manager
      WHERE idglobal=? AND actor_user_id=? AND branch_id=? LIMIT 1", 'iii',
      [(int)($sesion['idglobal'] ?? 0), (int)($sesion['idusuario'] ?? 0), $idsucursal]) !== null;
}

function scopeRelevoCartera(mysqli $conexion, array $sesion, int $idsucursal): ?object
{
   return db_fetch_object($conexion, "SELECT
      (u.str_estado='activo' AND e.str_estado='activo' AND
       (e.str_cargo='Super Administrador' OR o.idempleado_administrador=e.idempleado OR EXISTS(
         SELECT 1 FROM tbl_auth_sucursal g WHERE g.idglobal=c.idglobal AND g.idsucursal=c.branch_id
         AND g.idempleado=e.idempleado AND g.str_estado<>'inactivo'))) AS independentAccess,
      (u.str_estado='activo' AND EXISTS(SELECT 1 FROM view_employee_payroll_active_coverage a WHERE a.idglobal=c.idglobal
         AND a.branch_id=c.branch_id AND a.replacement_employee_id=e.idempleado)) AS activeCoverage
      FROM tbl_employee_payroll_coverage c
      JOIN tbl_empleado e ON e.idglobal=c.idglobal AND e.idempleado=c.replacement_employee_id AND e.idempleado=?
      LEFT JOIN tbl_usuario u ON u.idglobal=e.idglobal AND u.idpersona=e.idpersona AND u.idusuario=?
      JOIN tbl_sucursal s ON s.idglobal=c.idglobal AND s.idsucursal=c.branch_id
      JOIN tbl_oficina o ON o.idglobal=s.idglobal AND o.idoficina=s.idoficina
      WHERE c.idglobal=? AND c.branch_id=? LIMIT 1",
      'iiii', [(int)($sesion['idempleado'] ?? 0), (int)($sesion['idusuario'] ?? 0),
         (int)($sesion['idglobal'] ?? 0), $idsucursal]);
}

function errorCupoAprobadoCartera(mysqli $conexion, array $sesion, $maxCredito, int $idempleado, int $idglobal): ?string
{
   if (!is_numeric($maxCredito) || !is_finite((float)$maxCredito) || (float)$maxCredito < 0) {
      return 'ERROR: El máximo cupo que apruebo debe ser un valor válido mayor o igual a cero.';
   }
   if ((int)($sesion['userEmpresa'] ?? 0) === $idglobal) {
      return null;
   }
   $empleado = db_fetch_object(
      $conexion,
      'SELECT dec_max_credito FROM tbl_empleado WHERE idempleado=? AND idglobal=? LIMIT 1 FOR UPDATE',
      'ii',
      [$idempleado, $idglobal]
   );
   if ($empleado === null) {
      return 'ERROR: No se encontró el cupo autorizado del empleado.';
   }
   return (float)$maxCredito > (float)$empleado->dec_max_credito
      ? 'ERROR: El máximo cupo aprobado supera el cupo que puede otorgar el empleado.'
      : null;
}

function administraOficinaCartera(mysqli $conexion, array $sesion, int $idsucursal): bool
{
   $idglobal = (int)($sesion['idglobal'] ?? 0);
   $idempleado = (int)($sesion['idempleado'] ?? 0);
   if ($idglobal <= 0 || $idempleado <= 0 || $idsucursal <= 0) {
      return false;
   }
   $consulta = db_prepare_execute(
      $conexion,
      'SELECT o.idoficina FROM tbl_sucursal s
       JOIN tbl_oficina o ON o.idoficina=s.idoficina AND o.idglobal=s.idglobal
       WHERE s.idsucursal=? AND s.idglobal=? AND o.idempleado_administrador=? LIMIT 1',
      'iii',
      [$idsucursal, $idglobal, $idempleado]
   );
   $administra = $consulta->get_result()->fetch_object() !== null;
   $consulta->close();
   return $administra;
}

function puedeVerDetalleCuentasSucursal(mysqli $conexion, array $sesion, int $idsucursal): bool
{
   $idglobal = (int)($sesion['idglobal'] ?? 0);
   $idempleado = (int)($sesion['idempleado'] ?? 0);
   if ($idglobal <= 0 || $idsucursal <= 0) {
      return false;
   }

   if ((int)($sesion['userEmpresa'] ?? 0) === $idglobal) {
      $consulta = db_prepare_execute(
         $conexion,
         'SELECT 1 FROM tbl_sucursal WHERE idsucursal=? AND idglobal=? LIMIT 1',
         'ii',
         [$idsucursal, $idglobal]
      );
      $autorizado = $consulta->get_result()->fetch_object() !== null;
      $consulta->close();
      return $autorizado;
   }

   $coverage = scopeRelevoCartera($conexion, $sesion, $idsucursal);
   if ($coverage !== null && !$coverage->independentAccess) {
      return (bool)$coverage->activeCoverage &&
         tienePermisoTemporalCartera($conexion, $sesion, $idsucursal, 'ver cuentas detalladas');
   }
   if ($idsucursal === (int)($sesion['idsucursal'] ?? 0)) return true;

   if ($idempleado <= 0) {
      return false;
   }

   if (administraOficinaCartera($conexion, $sesion, $idsucursal)) {
      return true;
   }
   if (esRepresentanteTemporalCartera($conexion, $sesion, $idsucursal)) {
      $row = db_fetch_object($conexion, "SELECT 1 AS authorized FROM view_employee_payroll_temporary_permission
         WHERE idglobal=? AND branch_id=? AND employee_id=? AND permission='ver cuentas detalladas' LIMIT 1",
         'iii', [$idglobal, $idsucursal, $idempleado]);
      if ($row !== null) return true;
   }

   $consulta = db_prepare_execute(
      $conexion,
      "SELECT 1
       FROM tbl_auth_sucursal au
       INNER JOIN tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal
       INNER JOIN tbl_auth a ON a.idauth=b.idauth
       INNER JOIN tbl_sucursal s ON s.idsucursal=au.idsucursal AND s.idglobal=au.idglobal
       WHERE au.idglobal=? AND au.idsucursal=? AND au.idempleado=?
         AND au.str_estado<>'inactivo' AND a.str_nombre='ver cuentas detalladas'
       LIMIT 1",
      'iii',
      [$idglobal, $idsucursal, $idempleado]
   );
   $autorizado = $consulta->get_result()->fetch_object() !== null;
   $consulta->close();
   return $autorizado;
}

function errorDespachoCartera(mysqli $conexion, array $sesion, int $idsucursal, ?int $iddetalleruta = null, array $estados = ['created']): ?string
{
   if (basename($_SERVER['SCRIPT_NAME'] ?? '') === 'CarteraAjax.php' && ($_GET['op'] ?? '') === 'deleteGastoDetalleRuta') {
      $estados = ['created'];
   }
   $idglobal = (int)($sesion['idglobal'] ?? 0);
   $idusuario = (int)($sesion['idusuario'] ?? 0);
   if ($idglobal <= 0 || $idusuario <= 0 || $idsucursal <= 0) {
      return 'ERROR: Inicie sesión y seleccione una sucursal válida';
   }

   if ($iddetalleruta !== null && $iddetalleruta <= 0) {
      return 'ERROR: Ruta inválida';
   }
   if (basename($_SERVER['SCRIPT_NAME'] ?? '') === 'CarteraAjax.php' && ($_GET['op'] ?? '') === 'deleteGastoDetalleRuta') {
      $bonus = db_fetch_object($conexion, "SELECT id FROM tbl_employee_payroll_bonus
         WHERE idglobal=? AND expense_id=? LIMIT 1", 'is', [$idglobal, (string)($_POST['id'] ?? '')]);
      if ($bonus !== null && !esGestorBonoCartera($conexion, $sesion, $idsucursal)) {
         return 'ERROR: Sólo el administrador de oficina o Super Administrador puede gestionar bonos';
      }
   }

   $marcadores = implode(',', array_fill(0, count($estados), '?'));
   $sql = "SELECT iddetalleruta FROM tbl_detalle_ruta
           WHERE idglobal=? AND idsucursal=? AND str_estado IN ($marcadores)";
   $tipos = 'ii' . str_repeat('s', count($estados));
   $parametros = array_merge([$idglobal, $idsucursal], $estados);
   if ($iddetalleruta !== null) {
      $sql .= ' AND iddetalleruta=?';
      $tipos .= 'i';
      $parametros[] = $iddetalleruta;
   }
   $sql .= ' ORDER BY created_at DESC, iddetalleruta DESC LIMIT 1';
   $consulta = db_prepare_execute($conexion, $sql, $tipos, $parametros);
   $ruta = $consulta->get_result()->fetch_object();
   $consulta->close();
   if (!$ruta) {
      return 'ERROR: No hay una ruta válida para esta sucursal y operación';
   }

   if ((int)($sesion['userEmpresa'] ?? 0) === $idglobal) {
      return null;
   }
   $idempleado = (int)($sesion['idempleado'] ?? 0);
   if ($idempleado <= 0) {
      return 'ERROR: Tu usuario no tiene un empleado asociado';
   }
   if (administraOficinaCartera($conexion, $sesion, $idsucursal)) {
      return null;
   }
   $coverage = scopeRelevoCartera($conexion, $sesion, $idsucursal);
   if ($coverage !== null && !$coverage->independentAccess && !$coverage->activeCoverage) {
      return 'ERROR: La representación temporal de esta sucursal no está vigente';
   }
   if (esRepresentanteTemporalCartera($conexion, $sesion, $idsucursal)) {
      $script = basename($_SERVER['SCRIPT_NAME'] ?? '');
      $action = $_GET['op'] ?? '';
      $permission = null;
      if ($script === 'CarteraAjax.php') {
         $permission = [
            'SaveOrUpdate' => 'nueva tarjeta', 'SaveOrUpdateAbono' => 'editar cuota',
            'SaveOrUpdateCredito' => 'editar cuota', 'ordenarMover' => 'ordenar',
            'eliminarAbono' => 'eliminar cuota', 'eliminarCredito' => 'eliminar credito'
         ][$action] ?? null;
         if ($action === 'SaveOrUpdate' && !empty($_POST['txtrefTarjetaHidden'])) $permission = 'editar cuota';
         if ($action === 'SaveDescuentoMaxInteres') {
            $permission = ($_POST['txtFormTipo'] ?? '') === 'Descuento' ? 'descuento' : 'cobrar intereser';
         }
         if ($action === 'UpdateEstado') {
            $permission = ($_POST['txtmodalFormEstado'] ?? '') === 'moroso' ? 'pasar a morosos' : 'pasar a retirados';
         }
         if ($action === 'deleteGastoDetalleRuta') {
            $entry = db_fetch_object($conexion, "SELECT str_operacion FROM tbl_contabilidad_detalle
               WHERE idglobal=? AND idsucursal=? AND idcontabilidad_detalle=? LIMIT 1", 'iis',
               [$idglobal,$idsucursal,(string)($_POST['id'] ?? '')]);
            $permission = [
               'salida-totalizar'=>'totalizar', 'salida-contabilidad'=>'crear otros gastos',
               'salida'=>'crear salida', 'entrada-contabilidad'=>'crear entrada'
            ][$entry->str_operacion ?? ''] ?? null;
         }
      } elseif ($script === 'ClienteAjax.php') {
         $permission = $action === 'SaveOrUpdate' ?
            (!empty($_POST['txtRefCliente']) ? 'editar cliente' : 'crear cliente') : null;
         if ($action === 'updateDocumentoPersona') $permission = 'editar documento';
         if ($action === 'restaurarMoroso' &&
            (tienePermisoTemporalCartera($conexion,$sesion,$idsucursal,'pasar activos') ||
             tienePermisoTemporalCartera($conexion,$sesion,$idsucursal,'pasar activos retirados'))) return null;
      } elseif ($script === 'RecibirCuentasAjax.php') {
         $permission = [
            'saveContabilidad'=>'guardado permanente', 'SaveOrUpdateDtaCobro'=>'bloquear',
            'manejarDesbEditarDetalleRuta'=>'desbloquear', 'manejarNotIncludeDetalleRuta'=>'guardado permanente'
         ][$action] ?? null;
         if ($action === 'SaveOrUpdateGastos') {
            $permission = [
               'salida-contabilidad'=>'crear otros gastos', 'salida'=>'crear salida',
               'entrada-contabilidad'=>'crear entrada', 'salida-totalizar'=>'totalizar'
            ][$_POST['txtOperacionContabilidad'] ?? ''] ?? null;
         }
         if (in_array($action,['SaveOrUpdateBase','deleteBase'],true)) $permission = 'totalizar';
      }
      if ($permission !== null) {
         if (tienePermisoTemporalCartera($conexion, $sesion, $idsucursal, $permission)) return null;
      }
      return 'ERROR: Esta acción requiere un permiso propio en esta sucursal; solicítelo al Super Administrador por el flujo normal';
   }
   $consulta = db_prepare_execute(
      $conexion,
      'SELECT 1 AS dispatched FROM tbl_empleados_cobrando WHERE id_detalle_ruta=? AND idempleado=? LIMIT 1',
      'ii',
      [(int)$ruta->iddetalleruta, $idempleado]
   );
   $despachado = $consulta->get_result()->fetch_object();
   $consulta->close();
   return $despachado ? null : 'ERROR: No estás despachado ni administras la oficina de esta sucursal';
}
