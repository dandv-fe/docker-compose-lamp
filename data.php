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
//si solo es ahorrador

// is empresa Superadmin || si es superadmin o no valor 0 o idglobal de la empresa
$_SESSION['idpersona'] = $userSession['usuario']->idpersona;
$_SESSION['userEmpresa'] = $userSession['usuario']->str_cargo === 'Super Administrador' ? $userSession['usuario']->idglobal : null;
$_SESSION['idempleado'] = $userSession["usuario"]->idempleado ?? null;
$idglobal = $userSession['usuario']->idglobal;
$idoficina = $_SESSION['idoficina'] ?? 0;
$idsucursal = $_SESSION['idsucursal'] ?? 0;

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
$_SESSION['AUTHS'] = array();

if ($userSession['usuario']->str_tipo === 'publica') {
   $sql = "SELECT * 
                    FROM tbl_oficina 
                    WHERE idoficina = COALESCE(
                        (SELECT idoficina FROM tbl_oficina WHERE idoficina = $idoficina),
                        (SELECT idoficina FROM tbl_oficina WHERE idglobal = $idglobal ORDER BY idoficina LIMIT 1)
                    )";
   $query_oficina_seleccionada = $conexion->query($sql);
   $oficina_seleccionada = $query_oficina_seleccionada->fetch_object();
   $_SESSION['idoficina'] = $oficina_seleccionada->idoficina;
   $idoficina = $_SESSION['idoficina'];
}

if ($_SESSION['idsucursal'] > 0) {
   $idsuc = $_SESSION['idsucursal'];
   $idempleado = $userSession["usuario"]->idempleado;
   $sql = "SELECT
                        a.str_categoria AS categoria,
                        a.str_nombre AS nombre
                    FROM
                        tbl_auths auths
                        INNER JOIN tbl_auth a ON a.idauth = auths.idauth
                        INNER JOIN tbl_auth_sucursal aus ON aus.idauth_sucursal = auths.idauth_sucursal 
                    WHERE
                        aus.idsucursal = $idsuc
                        AND aus.idempleado = $idempleado";
   $query3 = $conexion->query($sql);

   while ($reg = $query3->fetch_object()) {
      $_SESSION['AUTHS'][] = ["caregoria" => $reg->categoria, "nombre" => $reg->nombre];
   }
}


include "views/header.html";
include "views/nav.html";
