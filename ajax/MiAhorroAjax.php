<?php
session_start();
require_once "../method.php";
require_once "../model/MiAhorro.php";

$objMiAhorro = new MiAhorro();
$idglobal = $_SESSION['idglobal'];
$superadmin = $_SESSION['userEmpresa'];
$idpersona = $_SESSION['idpersona'];
switch ($_GET['op']) {
}
