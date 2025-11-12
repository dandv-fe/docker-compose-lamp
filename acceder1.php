<?php
session_start();
require_once "info_sistema.php";
$infoSistemaCuentas=infoSistemaCuentas();
require_once "model/Usuario.php";
$objusuario = new usuario();
if (isset($_SESSION["idusuario"])) {

    

}else {
     echo "<script>
 location.href ='login.php';
  </script>";
}