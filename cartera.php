<?php
require "data.php";
if ($isPagoSistema == -1) {
   include "views/pago_vencido.html";
} else {
   $sql = "SELECT * FROM tbl_sucursal WHERE idsucursal=$idsucursal";
   $result = $conexion->query($sql);
   $sucursal = $result->fetch_object();
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
