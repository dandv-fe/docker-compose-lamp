<?php
session_start();
require_once "../method.php";
require_once "../model/AhorrosProgramado.php";

$objAhorrosProgramado = new AhorrosProgramado();
$idglobal = $_SESSION['idglobal'];
$superadmin = $_SESSION['userEmpresa'];
$idpersona = $_SESSION['idpersona'];
switch ($_GET['op']) {
   case 'SaveOrUpdate':
      $idahorro = limpiar_cadena2($_POST['idahorro']);
      $idpersona = limpiar_cadena2($_POST['str_empleado']);
      $dec_porcentaje  = floatval($_POST['dec_porcentaje']);
      $str_name = 'Ahorro Programado';

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

      if (!$objAhorrosProgramado->empleadoConEmailVerificado($idglobal, intval($idpersona))) {
         echo json_encode([
            'status' => 'error',
            'mensaje' => 'El empleado seleccionado debe tener email y estar verificado.'
         ]);
         break;
      }

      $idCuentaCorriente = $objAhorrosProgramado->asegurarCuentaCorriente($idglobal, intval($idpersona));
      if (intval($idCuentaCorriente) <= 0) {
         echo json_encode([
            'status' => 'error',
            'mensaje' => 'No se pudo crear o validar la cuenta corriente del empleado.'
         ]);
         break;
      }

      if ($objAhorrosProgramado->esSuperAdministrador($idglobal, intval($idpersona))) {
         echo json_encode([
            'status' => 'error',
            'mensaje' => 'Un empleado con cargo Super Administrador no puede tener un corresponsal a cargo.'
         ]);
         break;
      }


      if ($objAhorrosProgramado->existeAhorroProgramadoPorPersona($idglobal, intval($idpersona), intval($idahorro))) {
         echo json_encode([
            'status' => 'error',
            'mensaje' => 'El empleado seleccionado ya tiene un Ahorro Programado registrado.'
         ]);
         break;
      }

      if (empty($idahorro)) {
         # registrar
         $objAhorrosProgramado->registrar(
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
         $ok = $objAhorrosProgramado->actualizar(
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
      $query = $objAhorrosProgramado->cboListEmpleado($idglobal, $idahorroRef);
      echo '<option value="">--Seleccione--</option>';
      while ($reg = $query->fetch_object()) {
         $ocupado = intval($reg->ocupado ?? 0) > 0;
         $tieneEmail = intval($reg->tiene_email ?? 0) === 1;
         $emailVerificado = intval($reg->email_verificado ?? 0) === 1;
         $esSuperAdmin = intval($reg->es_super_admin ?? 0) === 1;

         $motivos = [];
         if ($ocupado) {
            $motivos[] = 'Ya tiene Ahorro Programado';
         }
         if (!$tieneEmail) {
            $motivos[] = 'Sin email';
         }
         if (!$emailVerificado) {
            $motivos[] = 'Email no verificado';
         }
         if ($esSuperAdmin) {
            $motivos[] = 'Super Administrador';
         }

         $noDisponible = !empty($motivos);
         $disabledAttr = $noDisponible ? ' disabled="disabled" style="text-decoration: line-through; color:#9aa0a6;"' : '';
         $suffix = $noDisponible ? ' (' . implode(' | ', $motivos) . ')' : '';
         echo '<option value="' . $reg->ref . '"' . $disabledAttr . '>' . $reg->empleado . $suffix . '</option>';
      }
      break;
   case 'listCorresponsales':
      $query = $objAhorrosProgramado->listCorresponsales($idpersona);
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

      $query = $objAhorrosProgramado->listarMovimientos($idglobal, $idahorro);
      $data = [];
      while ($reg = $query->fetch_object()) {
         $tipo = strtolower(trim((string)$reg->str_tipo));
         $tipoLabel = 'Movimiento';
         if ($tipo === 'aporte') {
            $tipoLabel = 'Aporte';
         } elseif ($tipo === 'retiro') {
            $tipoLabel = 'Retiro';
         } elseif ($tipo === 'ajuste') {
            $tipoLabel = 'Interés';
         }

         $data[] = [
            'idmovimiento' => $reg->idmovimiento,
            'idahorro' => $reg->idahorro,
            'idahorro_de' => $reg->idahorro_de,
            'date_movimiento' => $reg->date_movimiento,
            'str_tipo' => $reg->str_tipo,
            'tipo_label' => $tipoLabel,
            'dec_valor' => $reg->dec_valor,
            'str_descripcion' => $reg->str_descripcion,
            'str_estado' => $reg->str_estado
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

      if (!in_array($tipo, ['aporte', 'retiro', 'ajuste'], true)) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Tipo de movimiento inválido']);
         break;
      }

      global $conexion;
      $sql = "SELECT bit_auth_movimientos AS auth
                FROM tbl_ahorros
                WHERE idahorro=$idahorro
                  AND idglobal=$idglobal
                  AND str_name='Ahorro Programado'
                LIMIT 1";
      $query = $conexion->query($sql);
      $info = $query ? $query->fetch_object() : null;
      if (!$info) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Ahorro programado no encontrado']);
         break;
      }

      $authFlag = normalize_bit($info->auth ?? 0);
      $esSuperAdmin = !empty($_SESSION['userEmpresa']);
      if ($authFlag !== 1 && !$esSuperAdmin) {
         echo json_encode([
            'status' => 'error',
            'mensaje' => 'Movimientos no autorizados. Active "Autorizar Movimientos" en la configuración.'
         ]);
         break;
      }

      if ($tipo === 'ajuste') {
         $resultado = $objAhorrosProgramado->registrarAjusteInteresesConPrincipalActual(
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

      if ($tipo === 'retiro') {
         $resultado = $objAhorrosProgramado->transferirHaciaPrincipalActual(
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

      $resultado = $objAhorrosProgramado->transferirDesdePrincipalActual(
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

function normalize_bit($value)
{
   if ($value === null || $value === '') return 0;
   if (is_int($value)) return $value === 1 ? 1 : 0;
   if (is_bool($value)) return $value ? 1 : 0;
   if (is_string($value)) {
      if (strlen($value) === 1) {
         $ord = ord($value);
         if ($ord === 0 || $ord === 1) return $ord;
      }
      return intval($value) === 1 ? 1 : 0;
   }
   return 0;
}
