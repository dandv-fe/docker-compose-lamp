<?php
require "data.php";
if ($isPagoSistema == -1) {
   include "views/pago_vencido.html";
} else {
   $sql = "SELECT * FROM tbl_sucursal WHERE idsucursal=$idsucursal";
   $result = $conexion->query($sql);
   $sucursal = $result->fetch_object();
   $gestorBonoCartera = db_fetch_object(
      $conexion,
      "SELECT e.idempleado
       FROM tbl_usuario u
       JOIN tbl_empleado e ON e.idpersona=u.idpersona AND e.idglobal=u.idglobal
       JOIN tbl_sucursal s ON s.idglobal=e.idglobal AND s.idsucursal=?
       LEFT JOIN tbl_oficina o ON o.idoficina=s.idoficina AND o.idglobal=s.idglobal
       WHERE u.idglobal=? AND u.idusuario=? AND u.str_estado='activo'
         AND e.str_estado='activo'
         AND (e.str_cargo='Super Administrador' OR o.idempleado_administrador=e.idempleado)
       LIMIT 1",
      "iii",
      [(int)$idsucursal, (int)$idglobal, (int)($_SESSION['idusuario'] ?? 0)]
   );
   $puedeGestionarBonoCartera = $gestorBonoCartera !== null;
   if (!isset($_SESSION['userEmpresa'])) {
      $empleadoCupo = db_fetch_object(
         $conexion,
         "SELECT dec_max_credito FROM tbl_empleado WHERE idempleado=? AND idglobal=? LIMIT 1",
         "ii",
         [(int)($_SESSION['idempleado'] ?? 0), (int)$idglobal]
      );
      $maxCupoEmpleado = $empleadoCupo->dec_max_credito ?? null;
   }
   include "views/cartera.html";
}

include "views/footer.html";
