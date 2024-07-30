<?php
session_start();
require_once "info_sistema.php";
$infoSistemaCuentas=infoSistemaCuentas();
require_once "model/Usuario.php";
$objusuario = new usuario();
$_SESSION['authSucursal']=null;
if (isset($_SESSION["idusuario"])) {
        $query = $objusuario->getAccederInformacion($_SESSION['userEmpresa'], $_SESSION['userEmpleado']);
        $fetch=$query[0];
        $allSucursal=$query[1];
        $auths=$query[2];
        include "views/header.html";
        include "views/nav.html";
        if(isset($_SESSION['userEmpresa']) || in_array('ver morosos', array_column($_SESSION['AUTHS'], 'nombre'))){
            include "views/morosos.html";
        }
        include "views/footer.html";
} else {
    echo "<script>
 location.href ='login.php';
  </script>";
}