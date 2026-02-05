<?php
session_start();
require_once "../method.php";
require_once "../model/Corres_.php";

$objCorresponsal = new Corresponsal();
$idglobal = $_SESSION['idglobal'];
$superadmin = $_SESSION['userEmpresa'];
$idpersona = $_SESSION['idpersona'];
switch ($_GET['op']) {
   case 'SaveOrUpdate':
      $idahorro = limpiar_cadena2($_POST['idahorro']);
      $dec_porcentaje  = floatval($_POST['dec_porcentaje']);
      $str_name = limpiar_cadena($_POST['str_name']);

      $str_tipo = 'corresponsal'; // enum('principal','ahorro','fondo_emergencia','inversion','corresponsal
      $str_pago_utilidad = limpiar_cadena($_POST['str_pago_utilidad']); // enum('manual','automatico')
      $str_pago_utilidad = strtolower(trim($str_pago_utilidad));
      if ($str_pago_utilidad === 'no aplica' || $str_pago_utilidad === 'no_aplica' || $str_pago_utilidad === '') {
         $str_pago_utilidad = 'manual';
      }
      if (!in_array($str_pago_utilidad, ['manual', 'automatico'], true)) {
         $str_pago_utilidad = 'manual';
      }
      $bit_auth_movimientos = limpiar_cadena($_POST['bit_auth_movimientos']); // tinyint(1)
      $bit_auth_movimientos = ($bit_auth_movimientos === 'true' || $bit_auth_movimientos === '1') ? 1 : 0;
      $str_estado = limpiar_cadena($_POST['str_estado']); // enum('activo','inactivo')
      if (isset($idahorro)) {
         # registrar
         $objCorresponsal->registrar(
            $idglobal,
            $idpersona,
            $dec_porcentaje,
            $str_name,
            $str_tipo,
            $str_pago_utilidad,
            $bit_auth_movimientos,
            $str_estado
         );
      } else {
         # editar
      }

      //
      break;
   case 'goAccount':
      if (empty($superadmin)) {
         echo json_encode('no encontrado');
         break;
      }
      $query = $objCorresponsal->goAccount($idglobal, $idpersona);
      echo json_encode($query->fetch_object());
      break;
   default:
      # code...
      break;
}
