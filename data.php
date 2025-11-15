<?php
session_start();
if (!isset($_SESSION["idusuario"])) {
   echo "<script>
 location.href ='login.php';
  </script>";
}
require_once "info_sistema.php";
$infoSistemaCuentas = infoSistemaCuentas();
require_once "model/Usuario.php";
$objusuario = new usuario();
require "model/Conexion.php";
global $conexion;


$userSession = $objusuario->viewUsuarioSession($_SESSION["idusuario"]);
// is empresa Superadmin || si es superadmin o no valor 0 o idglobal de la empresa
$_SESSION['userEmpresa'] = $userSession['usuario']->str_cargo === 'Super Administrador' ? $userSession['usuario']->idglobal : null;
$_SESSION['idempleado'] = $userSession["usuario"]->idempleado;
$idglobal = $userSession['usuario']->idglobal;

// variables de estado de pago
$dias_extras = 10;
$dias_restantes = 10;
$isPagoSistema = 1;
if (isset($userSession["estadoPago"]->date_corte)) {
   $origin = new DateTimeImmutable();
   $target = new DateTimeImmutable($userSession["estadoPago"]->date_corte);
   $interval = $origin->diff($target);
   $dias_extras = $userSession["estadoPago"]->int_dias_extras;
   $dias_restantes = $interval->format("%R%a");

   $isPagoSistema = $dias_restantes + $dias_extras <=> 0;
}
include "views/header.html";
include "views/nav.html";
