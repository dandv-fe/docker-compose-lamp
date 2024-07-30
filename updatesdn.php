<?php
session_start();
require_once "info_sistema.php";
$infoSistemaCuentas=infoSistemaCuentas();
require_once "model/Usuario.php";
require_once "method.php";
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

        require_once "model/Up.php";
        $classUp= new ClassUp();


        

    

        if($_SESSION['userEmpresa']==1002 || $_SESSION['userEmpresa']==1004 ){
            include "views/upsadteSdn.html";
        }
        include "views/footer.html";
    }
} else {
    echo "<script>
 location.href ='login.php';
  </script>";
}

