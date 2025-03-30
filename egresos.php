<?php
session_start();
require_once "info_sistema.php";
$infoSistemaCuentas=infoSistemaCuentas();
require_once "model/Usuario.php";
$objusuario = new usuario();
$_SESSION['authSucursal']=null;
if (isset($_SESSION["idusuario"])) {
    if (isset($_SESSION['userEmpleado'])) {
       $userIdEmpresa = $_SESSION['userEmpresa'];
        $idglobal=$_SESSION['idglobal'];

        $query = $objusuario->getAccederInformacion($userIdEmpresa, $_SESSION['userEmpleado'], $idglobal);
        $fetch = $query[0];
        $allSucursal = $query[1];
        $auths = $query[2];
        $estado_pago =  $query[3];
        $dias_extras=10;
        $dias_restantes=10;
        $decicion=1;
        
        if(isset($estado_pago->date_corte)){
            $origin = new DateTimeImmutable();
            $target = new DateTimeImmutable($estado_pago->date_corte);
            $interval = $origin->diff($target);
            $dias_extras= $estado_pago->int_dias_extras;
            $dias_restantes = $interval->format("%R%a");
    
            $decicion = $dias_restantes+ $dias_extras <=> 0;
        }
        include "views/header.html";
        include "views/nav.html";
        if(isset($_SESSION['userEmpresa']) || in_array('egresos', $auths)){                  
            
            $decicion!=-1?include "views/egresos.html": include "views/pago_vencido.html";
        }
        include "views/footer.html";
    } elseif (isset($_SESSION['userCliente'])) {
    } elseif (isset($_SESSION['userNatillera'])) {
    }
} else {
    echo "<script>
 location.href ='login.php';
  </script>";
}


