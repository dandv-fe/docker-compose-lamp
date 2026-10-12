<?php

function descargaApkLocalDisponible(bool $habilitada, string $archivo): bool
{
   return $habilitada && is_file($archivo) && is_readable($archivo);
}

function listarInstalacionesApk(mysqli $conexion, array $sesion): array
{
   $idglobal = (int)($sesion['idglobal'] ?? 0);
   $idusuario = (int)($sesion['idusuario'] ?? 0);
   $idempleado = (int)($sesion['idempleado'] ?? 0);
   if ($idglobal <= 0 || $idusuario <= 0) {
      throw new RuntimeException('Inicie sesión para consultar las instalaciones.');
   }
   $parametros = [$idglobal];
   $tipos = 'i';
   $alcance = '';
   if ((int)($sesion['userEmpresa'] ?? 0) !== $idglobal) {
      $alcance = ' AND (i.idusuario=? OR EXISTS (
         SELECT 1 FROM tbl_oficina o
         WHERE o.idglobal=i.idglobal AND o.idoficina=e.idoficina
           AND o.idempleado_administrador=?
      ))';
      $parametros[] = $idusuario;
      $parametros[] = $idempleado > 0 ? $idempleado : -1;
      $tipos .= 'ii';
   }
   $consulta = db_prepare_execute(
      $conexion,
      "SELECT i.installation_id, i.version_code, i.version_name, i.last_seen_at,
              COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.str_nombres, p.str_apellidos)), ''), u.str_user_name) AS empleado
       FROM mobile_app_installation i
       JOIN tbl_usuario u ON u.idusuario=i.idusuario AND u.idglobal=i.idglobal
       LEFT JOIN tbl_empleado e ON e.idpersona=u.idpersona AND e.idglobal=u.idglobal
       LEFT JOIN tbl_persona p ON p.idpersona=u.idpersona AND p.idglobal=u.idglobal
       WHERE i.idglobal=?$alcance
       ORDER BY i.last_seen_at DESC, i.installation_id LIMIT 100",
      $tipos, $parametros
   );
   $filas = $consulta->get_result()->fetch_all(MYSQLI_ASSOC);
   $consulta->close();
   return $filas;
}
