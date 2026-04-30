<?php
session_start();
require_once "../method.php";
require_once "../model/MiAhorro.php";

$objMiAhorro = new MiAhorro();
$idglobal = intval($_SESSION['idglobal']);
$superadmin = intval($_SESSION['userEmpresa']);
$idpersona = intval($_SESSION['idpersona']);
switch ($_GET['op']) {
   case 'SaveOrUpdate':
      $idahorro = limpiar_cadena2($_POST['idahorro']);
      $str_name = limpiar_cadena($_POST['str_name']);

      if (empty($str_name)) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Debe ingresar un nombre para el ahorro']);
         break;
      }

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
            'mensaje' => 'El empleado ya superó la cantidad de ahorros permitida.'
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
            $str_name
         );
      } else {
         # editar
         $respuesta = $objMiAhorro->actualizar(
            $idglobal,
            intval($idahorro),
            intval($idpersona),
            $str_name
         );

         echo json_encode($respuesta);
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
            'idahorro' => $reg->idahorro,
            'idahorro_de' => $reg->idahorro_de,
            'date_movimiento' => $reg->date_movimiento,
            'str_tipo' => $reg->str_tipo,
            'dec_valor' => $reg->dec_valor,
            'monto_firmado' => $reg->monto_firmado,
            'str_descripcion' => $reg->str_descripcion,
            'str_estado' => $reg->str_estado,
            'id_cuenta' => $reg->id_cuenta,
            'str_name' => $reg->str_name,
            'ahorrador' => trim((string)($reg->ahorrador ?? '')) !== '' ? $reg->ahorrador : 'No definido',
            'str_tipo_documento' => $reg->str_tipo_documento,
            'str_num_documento' => $reg->str_num_documento
         ];
      }

      echo json_encode(['status' => 'success', 'data' => $data]);
      break;
   case 'listMovimientosPersona':
      if (intval($idpersona) <= 0) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Persona inválida']);
         break;
      }

      $query = $objMiAhorro->listarMovimientosPersona($idglobal, intval($idpersona));
      $data = [];
      while ($reg = $query->fetch_object()) {
         $data[] = [
            'idmovimiento' => $reg->idmovimiento,
            'date_movimiento' => $reg->date_movimiento,
            'str_tipo' => $reg->str_tipo,
            'dec_valor' => $reg->dec_valor,
            'monto_firmado' => $reg->monto_firmado,
            'str_descripcion' => $reg->str_descripcion,
            'str_estado' => $reg->str_estado,
            'idahorro' => $reg->idahorro,
            'id_cuenta' => $reg->id_cuenta,
            'str_name' => $reg->str_name,
            'ahorrador' => trim((string)($reg->ahorrador ?? '')) !== '' ? $reg->ahorrador : 'No definido',
            'str_tipo_documento' => $reg->str_tipo_documento,
            'str_num_documento' => $reg->str_num_documento
         ];
      }

      echo json_encode(['status' => 'success', 'data' => $data]);
      break;
   case 'registrarMovimiento':
      $idahorro = intval($_POST['idahorro'] ?? 0);
      $tipo = strtolower(trim(limpiar_cadena($_POST['tipo'] ?? '')));
      $valor = floatval($_POST['valor'] ?? 0);
      $descripcion = limpiar_cadena2($_POST['descripcion'] ?? '');

      if ($idahorro <= 0 || $valor <= 0 || empty($descripcion)) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Datos incompletos']);
         break;
      }

      if (!in_array($tipo, ['aporte', 'retiro'], true)) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Tipo de movimiento inválido']);
         break;
      }

      if ($tipo === 'retiro') {
         $resultado = $objMiAhorro->transferirHaciaCuentaBaseActual(
            $idglobal,
            intval($_SESSION['idpersona'] ?? 0),
            $idahorro,
            intval($_SESSION['idusuario'] ?? 0),
            $valor,
            $descripcion
         );
         echo json_encode($resultado);
         break;
      }

      $resultado = $objMiAhorro->transferirDesdeCuentaBaseActual(
         $idglobal,
         intval($_SESSION['idpersona'] ?? 0),
         $idahorro,
         intval($_SESSION['idusuario'] ?? 0),
         $valor,
         $descripcion
      );
      echo json_encode($resultado);
      break;
}
