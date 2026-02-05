<?php
session_start();
require_once "../method.php";
require_once "../model/MainAccount.php";

$objMainAccount = new MainAccount();
$idglobal = $_SESSION['idglobal'];
$superadmin = $_SESSION['userEmpresa'];
$idpersona = $_SESSION['idpersona'];
switch ($_GET['op']) {
   case 'goAccount':
      if (empty($superadmin)) {
         echo json_encode('no encontrado');
         break;
      }
      $query = $objMainAccount->goAccount($idglobal, $idpersona);
      echo json_encode($query->fetch_object());
      break;
   case 'tprincipal':
      if (empty($idglobal) || empty($superadmin)) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Permisos insuficientes']);
         break;
      }
      $objMainAccount->registrar($idglobal, $idpersona);
      break;
   default:
      # code...
      break;
}
