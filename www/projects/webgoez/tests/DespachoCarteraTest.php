<?php
require_once __DIR__ . '/../model/Conexion.php';
require_once __DIR__ . '/../model/AutorizarDespachoCartera.php';
require_once __DIR__ . '/../model/Usuario.php';
require_once __DIR__ . '/../model/RecibeCuentas.php';

function verificar($condicion, $mensaje)
{
   if (!$condicion) {
      throw new RuntimeException($mensaje);
   }
}

$consultaDetalle = $conexion->query(
   "SELECT au.idglobal, au.idsucursal, au.idempleado, otra.idsucursal AS sucursal_sesion
    FROM tbl_auth_sucursal au
    JOIN tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal
    JOIN tbl_auth a ON a.idauth=b.idauth
    JOIN tbl_sucursal otra ON otra.idglobal=au.idglobal AND otra.idsucursal<>au.idsucursal
    WHERE au.str_estado<>'inactivo' AND a.str_nombre='ver cuentas detalladas'
    LIMIT 1"
);
$permisoDetalle = $consultaDetalle->fetch_object();
verificar($permisoDetalle !== null, 'Falta permiso de prueba para ver cuentas detalladas');
$sesionDetalle = [
   'idglobal' => (int)$permisoDetalle->idglobal,
   'idempleado' => (int)$permisoDetalle->idempleado,
   'idsucursal' => (int)$permisoDetalle->sucursal_sesion,
   'userEmpresa' => null
];
verificar(
   puedeVerDetalleCuentasSucursal($conexion, $sesionDetalle, (int)$permisoDetalle->idsucursal),
   'Permiso de detalle rechazado cuando la sucursal activa es distinta'
);
$sesionSinPermiso = $sesionDetalle;
$sesionSinPermiso['idempleado'] = 2147483647;
verificar(
   !puedeVerDetalleCuentasSucursal($conexion, $sesionSinPermiso, (int)$permisoDetalle->idsucursal),
   'Empleado sin permiso puede ver el detalle de otra sucursal'
);
$sesionDetalle['userEmpresa'] = (int)$permisoDetalle->idglobal;
verificar(
   puedeVerDetalleCuentasSucursal($conexion, $sesionDetalle, (int)$permisoDetalle->idsucursal),
   'Superadministrador rechazado al ver detalle de una sucursal de su empresa'
);
verificar(
   !puedeVerDetalleCuentasSucursal($conexion, $sesionDetalle, (int)$permisoDetalle->idsucursal + 1000000),
   'Superadministrador puede consultar una sucursal fuera de su empresa'
);

foreach (['created', 'entregando'] as $estado) {
   $consulta = db_prepare_execute(
      $conexion,
      "SELECT r.idglobal, r.idsucursal, r.iddetalleruta, ec.idempleado
       FROM tbl_detalle_ruta r
       JOIN tbl_empleados_cobrando ec ON ec.id_detalle_ruta=r.iddetalleruta
       WHERE r.str_estado=?
         AND r.iddetalleruta=(
            SELECT r2.iddetalleruta FROM tbl_detalle_ruta r2
            WHERE r2.idglobal=r.idglobal AND r2.idsucursal=r.idsucursal
              AND r2.str_estado=r.str_estado
            ORDER BY r2.created_at DESC, r2.iddetalleruta DESC LIMIT 1
         ) LIMIT 1",
      's',
      [$estado]
   );
   $ruta = $consulta->get_result()->fetch_object();
   $consulta->close();
   verificar($ruta !== null, "Falta una ruta despachada de prueba ($estado)");

   $sesion = [
      'idglobal' => (int)$ruta->idglobal, 'idusuario' => 1,
      'idempleado' => (int)$ruta->idempleado, 'userEmpresa' => null
   ];
   $sucursal = (int)$ruta->idsucursal;
   $idRuta = (int)$ruta->iddetalleruta;
   verificar(errorDespachoCartera($conexion, $sesion, $sucursal, $idRuta, [$estado]) === null, 'Despachado rechazado');
   $sesion['idempleado'] = 2147483647;
   verificar(strpos(errorDespachoCartera($conexion, $sesion, $sucursal, $idRuta, [$estado]), 'No estás despachado') !== false, 'No despachado autorizado');
   $sesion['idempleado'] = 0;
   verificar(strpos(errorDespachoCartera($conexion, $sesion, $sucursal, $idRuta, [$estado]), 'empleado asociado') !== false, 'Sin empleado autorizado');
   $sesion['userEmpresa'] = $ruta->idglobal;
   verificar(errorDespachoCartera($conexion, $sesion, $sucursal, $idRuta, [$estado]) === null, 'Superadministrador rechazado');
   verificar(errorDespachoCartera($conexion, $sesion, $sucursal + 1000000, $idRuta, [$estado]) !== null, 'Ruta de otra sucursal autorizada');
   $otroEstado = $estado === 'created' ? 'entregando' : 'created';
   verificar(errorDespachoCartera($conexion, $sesion, $sucursal, $idRuta, [$otroEstado]) !== null, 'Estado de ruta incorrecto autorizado');

   $consulta = db_prepare_execute(
      $conexion,
      "SELECT r.idglobal, r.idsucursal, r.iddetalleruta, o.idempleado_administrador
       FROM tbl_detalle_ruta r
       JOIN tbl_sucursal s ON s.idsucursal=r.idsucursal AND s.idglobal=r.idglobal
       JOIN tbl_oficina o ON o.idoficina=s.idoficina AND o.idglobal=s.idglobal
       LEFT JOIN tbl_empleados_cobrando ec
         ON ec.id_detalle_ruta=r.iddetalleruta AND ec.idempleado=o.idempleado_administrador
       WHERE r.str_estado=? AND o.idempleado_administrador IS NOT NULL
         AND ec.idempleadoscobrando IS NULL
         AND r.iddetalleruta=(
            SELECT r2.iddetalleruta FROM tbl_detalle_ruta r2
            WHERE r2.idglobal=r.idglobal AND r2.idsucursal=r.idsucursal
              AND r2.str_estado=r.str_estado
            ORDER BY r2.created_at DESC, r2.iddetalleruta DESC LIMIT 1
         ) LIMIT 1",
      's',
      [$estado]
   );
   $administrador = $consulta->get_result()->fetch_object();
   $consulta->close();
   verificar($administrador !== null, "Falta oficina con administrador no despachado ($estado)");
   $sesionAdmin = [
      'idglobal' => (int)$administrador->idglobal, 'idusuario' => 1,
      'idempleado' => (int)$administrador->idempleado_administrador, 'userEmpresa' => null
   ];
   verificar(
      errorDespachoCartera($conexion, $sesionAdmin, (int)$administrador->idsucursal, (int)$administrador->iddetalleruta, [$estado]) === null,
      'Administrador de oficina no despachado rechazado'
   );
   verificar(
      errorDespachoCartera($conexion, $sesionAdmin, $sucursal + 1000000, (int)$administrador->iddetalleruta, [$estado]) !== null,
      'Administrador de oficina autorizado en otra sucursal'
   );
   $_SESSION['typeEmpresa'] = 'creditos';
   $_SESSION['idsucursal'] = 0;
   $_SESSION['AUTHS'] = [];
   $acceso = (new usuario())->getAccederInformacion(
      (int)$administrador->idglobal,
      (int)$administrador->idempleado_administrador,
      (int)$administrador->idglobal
   );
   verificar(
      in_array((int)$administrador->idsucursal, array_map('intval', array_column($acceso[1], 0)), true),
      'La sucursal de la oficina no aparece en el selector del administrador'
   );
   (new RecibeCuentas())->ListContabilidadRecibir(
      (int)$administrador->idglobal, null, (int)$administrador->idempleado_administrador
   );
}

$consulta = $conexion->query(
   "SELECT s.idglobal, s.idsucursal, o.idempleado_administrador
    FROM tbl_sucursal s
    JOIN tbl_oficina o ON o.idoficina=s.idoficina AND o.idglobal=s.idglobal
    JOIN tbl_empleado e ON e.idempleado=s.idempleado
    WHERE o.idempleado_administrador IS NOT NULL
      AND NOT EXISTS (
         SELECT 1 FROM tbl_auth_sucursal a WHERE a.idsucursal=s.idsucursal
           AND a.idglobal=s.idglobal AND a.idempleado=o.idempleado_administrador
           AND a.str_estado<>'inactivo'
      ) LIMIT 1"
);
$sinPermiso = $consulta->fetch_object();
verificar($sinPermiso !== null, 'Falta sucursal de oficina sin permiso explícito');
$acceso = (new usuario())->getAccederInformacion(
   (int)$sinPermiso->idglobal, (int)$sinPermiso->idempleado_administrador, (int)$sinPermiso->idglobal
);
verificar(
   in_array((int)$sinPermiso->idsucursal, array_map('intval', array_column($acceso[1], 0)), true),
   'El administrador sin permiso explícito no ve su sucursal'
);

echo "Validación de despacho, administrador de oficina y liquidación correcta (solo lecturas).\n";
