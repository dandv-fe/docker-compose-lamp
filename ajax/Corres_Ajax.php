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
      $idpersona = limpiar_cadena2($_POST['str_empleado']);
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

      if (empty($idpersona)) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Debe seleccionar un empleado']);
         break;
      }

      if ($objCorresponsal->esSuperAdministrador($idglobal, intval($idpersona))) {
         echo json_encode([
            'status' => 'error',
            'mensaje' => 'Un empleado con cargo Super Administrador no puede tener un corresponsal a cargo.'
         ]);
         break;
      }

      if ($objCorresponsal->tieneCorresponsalAsignado($idglobal, intval($idpersona), intval($idahorro))) {
         echo json_encode([
            'status' => 'error',
            'mensaje' => 'El empleado seleccionado ya tiene un corresponsal a cargo y no puede tener otro.'
         ]);
         break;
      }

      if (empty($idahorro)) {
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
         $ok = $objCorresponsal->actualizar(
            $idglobal,
            intval($idahorro),
            intval($idpersona),
            $dec_porcentaje,
            $str_name,
            $str_pago_utilidad,
            $bit_auth_movimientos,
            $str_estado
         );

         echo json_encode([
            'status' => $ok ? 'success' : 'error',
            'mensaje' => $ok ? 'Corresponsal actualizado correctamente' : 'No se pudo actualizar el corresponsal'
         ]);
      }

      //
      break;
   case 'listEmpleados':
      $idahorroRef = intval($_REQUEST['idahorro'] ?? 0);
      $query = $objCorresponsal->cboListEmpleado($idglobal, $idahorroRef);
      echo '<option value="">--Seleccione--</option>';
      while ($reg = $query->fetch_object()) {
         $ocupado = intval($reg->ocupado ?? 0) > 0;
         $disabledAttr = $ocupado ? ' disabled="disabled" style="text-decoration: line-through; color:#9aa0a6;"' : '';
         $suffix = $ocupado ? ' (No disponible)' : '';
         echo '<option value="' . $reg->ref . '"' . $disabledAttr . '>' . $reg->empleado . $suffix . '</option>';
      }
      break;
   case 'listCorresponsales':
      $query = $objCorresponsal->listCorresponsales($idglobal);
      $data = [];
      while ($reg = $query->fetch_object()) {
         $data[] = [
            "idahorro" => $reg->idahorro,
            "idpersona" => $reg->idpersona,
            "str_name" => $reg->str_name,
            "id_cuenta" => $reg->id_cuenta,
            "dec_porcentaje" => $reg->dec_porcentaje,
            "str_tipo" => $reg->str_tipo,
            "str_pago_utilidad" => $reg->str_pago_utilidad,
            "bit_auth_movimientos" => $reg->bit_auth_movimientos,
            "str_estado" => $reg->str_estado,
            "created_at" => $reg->created_at,
            "str_nombres" => $reg->str_nombres,
            "str_apellidos" => $reg->str_apellidos,
            "str_foto" => $reg->str_foto,
            "saldo_real" => $reg->saldo_real
         ];
      }
      echo json_encode($data);
      break;
}
