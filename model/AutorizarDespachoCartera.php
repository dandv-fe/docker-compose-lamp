<?php

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

function errorDespachoCartera(mysqli $conexion, array $sesion, int $idsucursal, ?int $iddetalleruta = null, array $estados = ['created']): ?string
{
   $idglobal = (int)($sesion['idglobal'] ?? 0);
   $idusuario = (int)($sesion['idusuario'] ?? 0);
   if ($idglobal <= 0 || $idusuario <= 0 || $idsucursal <= 0) {
      return 'ERROR: Inicie sesión y seleccione una sucursal válida';
   }

   if ($iddetalleruta !== null && $iddetalleruta <= 0) {
      return 'ERROR: Ruta inválida';
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
   $consulta = db_prepare_execute(
      $conexion,
      'SELECT idempleadoscobrando FROM tbl_empleados_cobrando WHERE id_detalle_ruta=? AND idempleado=? LIMIT 1',
      'ii',
      [(int)$ruta->iddetalleruta, $idempleado]
   );
   $despachado = $consulta->get_result()->fetch_object();
   $consulta->close();
   return $despachado ? null : 'ERROR: No estás despachado ni administras la oficina de esta sucursal';
}
