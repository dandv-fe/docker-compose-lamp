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
   case 'buscarCuentaDestino':
      $id_cuenta = limpiar_cadena($_REQUEST['id_cuenta'] ?? '');

      if (empty($idglobal) || empty($id_cuenta)) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Número de cuenta inválido']);
         break;
      }

      $query = $objMainAccount->buscarCuentaDestino($idglobal, $id_cuenta);
      $req = $query ? $query->fetch_object() : null;

      if (empty($req) || empty($req->nombres) || empty($req->apellidos)) {
         echo json_encode(['status' => 'error', 'mensaje' => 'La cuenta no existe']);
         break;
      }

      echo json_encode([
         'status' => 'success',
         'idahorro' => $req->idahorro,
         'idpersona' => $req->idpersona,
         'id_cuenta' => $req->id_cuenta,
         'nombres' => $req->nombres,
         'apellidos' => $req->apellidos
      ]);
      break;
   case 'tprincipal':
      if (empty($idglobal) || empty($superadmin)) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Permisos insuficientes']);
         break;
      }
      $objMainAccount->registrar($idglobal, $idpersona);
      break;
   case 'registrarMovimientosRA':
      $idahorro = limpiar_cadena($_POST['idahorroMovimiento'] ?? '');
      $tipo = limpiar_cadena($_POST['cboTipoMovimiento'] ?? '');
      $valor = floatval($_POST['txtValorMovimiento'] ?? 0);
      $descripcion = limpiar_cadena2($_POST['txtDescripcionMovimiento'] ?? '');

      if (empty($idahorro) || $valor <= 0 || !$tipo || !$descripcion) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Datos incompletos']);
         break;
      }

      $sql = "SELECT bit_auth_movimientos AS auth
               FROM tbl_ahorros
               WHERE idahorro=$idahorro AND idglobal=$idglobal";
      global $conexion;
      $q = $conexion->query($sql);
      $info = $q ? $q->fetch_object() : null;
      if (!$info) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Ahorro no encontrado']);
         break;
      }

      // Normalizar BIT(1)
      $authFlag = $info->auth;
      if (is_string($authFlag)) {
         $authFlag = ord($authFlag); // "\x01" => 1, "\x00" => 0
      } else {
         $authFlag = intval($authFlag);
      }

      $esSuperAdmin = !empty($_SESSION['userEmpresa']);
      if ($authFlag !== 1 && !$esSuperAdmin) {
         echo json_encode([
            'status' => 'error',
            'mensaje' => 'Movimientos no autorizados. Active "Autorizar Movimientos" en Configuración.'
         ]);
         break;
      }
      $valor = $tipo === 'retiro' ? -$valor : $valor;

      $ok = $objMainAccount->registrarMovimientoRA($idglobal, $idahorro, $_SESSION['idusuario'], $tipo, $valor, $descripcion);
      if (!$ok) {
         echo json_encode(['status' => 'error', 'mensaje' => 'No se pudo registrar el movimiento']);
         break;
      }

      // Ya no se actualiza 'dec_ganancia_acumulada'; saldo se calcula desde movimientos.
      // Actualizamos 'update_at' para reflejar cambios recientes.
      $dt = date('Y-m-d H:i:s');
      $conexion->query("UPDATE tbl_ahorros SET update_at='$dt' WHERE idahorro=$idahorro");

      echo json_encode(['status' => 'success', 'mensaje' => 'Movimiento registrado']);
      break;
}
