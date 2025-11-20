<?php
require "data.php";
if ($isPagoSistema == -1) {
   include "views/pago_vencido.html";
} else {
   $sql = "SELECT * FROM tbl_sucursal WHERE idsucursal=$idsucursal";
   $result = $conexion->query($sql);
   $sucursal = $result->fetch_object();
   include "views/cartera.html";
}

include "views/footer.html";
