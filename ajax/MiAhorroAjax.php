<?php
session_start();
require_once "../method.php";
require_once "../model/MiAhorro.php";

$objMiAhorro = new MiAhorro();
$idglobal = $_SESSION['idglobal'];
$superadmin = $_SESSION['userEmpresa'];
$idpersona = $_SESSION['idpersona'];
switch ($_GET['op']) {
   case 'SaveOrUpdate':
      $idahorro = limpiar_cadena2($_POST['idahorro']);
      #$idpersona = limpiar_cadena2($_POST['str_empleado']);
      $dec_porcentaje  = floatval($_POST['dec_porcentaje']);
      $str_name = limpiar_cadena($_POST['str_name']);

      $str_tipo = 'ahorro'; // enum('principal','ahorro','fondo_emergencia','inversion','corresponsal
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

      if (!$objMiAhorro->empleadoConEmailVerificado(intval($idpersona))) {
         echo json_encode([
            'status' => 'error',
            'mensaje' => 'Debe tener email y estar verificado.'
         ]);
         break;
      }

      if (empty($superadmin)) {
         $idCuentaCorriente = $objMiAhorro->asegurarCuentaCorriente($idglobal, intval($idpersona));
         if (intval($idCuentaCorriente) <= 0) {
            echo json_encode([
               'status' => 'error',
               'mensaje' => 'No se pudo crear o validar la cuenta corriente del empleado.'
            ]);
            break;
         }
      }




      if (empty($idahorro) && $objMiAhorro->tieneCuentasAhorros($idpersona, 3)) {
         echo json_encode([
            'status' => 'error',
            'mensaje' => 'El empleado ya superó la cantidad de registros permitida.'
         ]);
         break;
      }
      // reservar el name ahorro programado para el ahorro del empleado
      $str_nameNormalizado = strtolower(trim(preg_replace('/\s+/', ' ', $str_name)));
      if ($str_nameNormalizado === 'ahorro programado') {
         echo json_encode([
            'status' => 'error',
            'mensaje' => 'El nombre Ahorro Programado está reservado y no se puede usar aquí.'
         ]);
         break;
      }


      if (empty($idahorro)) {
         # registrar
         $objMiAhorro->registrar(
            $idglobal,
            $idpersona,
            $dec_porcentaje,
            $str_name,
            $str_tipo,
            $str_pago_utilidad,
            $bit_auth_movimientos,
            $str_estado,
            $superadmin
         );
      } else {
         # editar
         $ok = $objMiAhorro->actualizar(
            $idglobal,
            intval($idahorro),
            intval($idpersona),
            $dec_porcentaje,
            $str_name,
            $str_pago_utilidad,
            $bit_auth_movimientos,
            $str_estado,
            $superadmin
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
      $query = $objMiAhorro->cboListEmpleado($idglobal, $idahorroRef);
      echo '<option value="">--Seleccione--</option>';
      while ($reg = $query->fetch_object()) {
         $ocupado = intval($reg->ocupado ?? 0) > 0;
         $disabledAttr = $ocupado ? ' disabled="disabled" style="text-decoration: line-through; color:#9aa0a6;"' : '';
         $suffix = $ocupado ? ' (No disponible)' : '';
         echo '<option value="' . $reg->ref . '"' . $disabledAttr . '>' . $reg->empleado . $suffix . '</option>';
      }
      break;
   case 'listMisAhorros':
      $query = $objMiAhorro->listMisAhorros($idpersona);
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
   case 'listMovimientos':
      $idahorro = intval($_REQUEST['idahorro'] ?? 0);
      if ($idahorro <= 0) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Ahorro inválido']);
         break;
      }

      $query = $objMiAhorro->listarMovimientos($idglobal, $idahorro);
      $data = [];
      while ($reg = $query->fetch_object()) {
         $data[] = [
            'idmovimiento' => $reg->idmovimiento,
            'date_movimiento' => $reg->date_movimiento,
            'str_tipo' => $reg->str_tipo,
            'dec_valor' => $reg->dec_valor,
            'str_descripcion' => $reg->str_descripcion,
            'str_estado' => $reg->str_estado
         ];
      }

      echo json_encode(['status' => 'success', 'data' => $data]);
      break;
}
