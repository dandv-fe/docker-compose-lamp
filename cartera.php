<?php
session_start();
require_once "info_sistema.php";
$infoSistemaCuentas=infoSistemaCuentas();
require_once "model/Usuario.php";
$objusuario = new usuario();
$_SESSION['authSucursal']=null;
if (isset($_SESSION["idusuario"])) {
    if (isset($_SESSION['userEmpleado'])) {
        $query = $objusuario->getAccederInformacion($_SESSION['userEmpresa'], $_SESSION['userEmpleado']);
        $fetch = $query[0];
        $allSucursal = $query[1];
        $auths = $query[2];
        include "views/header.html";
        include "views/nav.html";
        include "views/cartera.html";
        include "views/footer.html";
    } elseif (isset($_SESSION['userCliente'])) {
    } elseif (isset($_SESSION['userNatillera'])) {
    }
} else {
    echo "<script>
 location.href ='login.php';
  </script>";
}
