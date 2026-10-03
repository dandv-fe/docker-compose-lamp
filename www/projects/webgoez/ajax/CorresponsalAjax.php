<?php
session_start();
require_once "../method.php";
require_once "../model/Corresponsal.php";

$objCorresponsal = new Corresponsal();
$idglobal = $_SESSION['idglobal'];
$superadmin = $_SESSION['userEmpresa'];
$idpersona = $_SESSION['idpersona'];
switch ($_GET['op']) {
   case 'getCuentaCorresponsal':
      if (empty($idglobal) || empty($idpersona)) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Sesión no válida']);
         break;
      }

      $query = $objCorresponsal->obtenerCuentaCorresponsal($idglobal, $idpersona);
      $cuenta = $query ? $query->fetch_assoc() : null;

      if (empty($cuenta)) {
         echo json_encode(['status' => 'error', 'mensaje' => 'No se encontró cuenta corresponsal']);
         break;
      }

      echo json_encode(['status' => 'success', 'data' => $cuenta]);
      break;

   case 'listMovimientos':
      $idahorro = intval($_REQUEST['idahorro'] ?? 0);

      if (empty($idglobal) || $idahorro <= 0) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Parámetros inválidos']);
         break;
      }

      $query = $objCorresponsal->listarMovimientos($idglobal, $idahorro);
      $data = [];

      if ($query) {
         while ($row = $query->fetch_assoc()) {
            $data[] = $row;
         }
      }

      echo json_encode(['status' => 'success', 'data' => $data]);
      break;

   case 'finalizarTransferencia':
      $idahorroOrigen = intval($_POST['idahorroOrigen'] ?? 0);
      $idahorroDestino = intval($_POST['idahorroDestino'] ?? 0);
      $monto = floatval($_POST['monto'] ?? 0);
      $idusuario = intval($_SESSION['idusuario'] ?? 0);

      if (empty($idglobal) || empty($idpersona) || $idusuario <= 0) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Sesión no válida']);
         break;
      }

      if ($idahorroOrigen <= 0 || $idahorroDestino <= 0 || $monto <= 0) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Parámetros inválidos']);
         break;
      }

      $resultado = $objCorresponsal->finalizarTransferencia(
         $idglobal,
         $idpersona,
         $idahorroOrigen,
         $idahorroDestino,
         $idusuario,
         $monto
      );

      echo json_encode($resultado);
      break;

   case 'entregarRetiroTemporal':
      $idCuentaDestino = limpiar_cadena2($_POST['id_cuenta'] ?? '');
      $monto = floatval($_POST['monto'] ?? 0);
      $codigoTemporal = limpiar_cadena2($_POST['codigo_temporal'] ?? '');
      $idusuario = intval($_SESSION['idusuario'] ?? 0);

      if (empty($idglobal) || empty($idpersona) || $idusuario <= 0) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Sesión no válida']);
         break;
      }

      if ($idCuentaDestino === '' || $monto <= 0 || $codigoTemporal === '') {
         echo json_encode(['status' => 'error', 'mensaje' => 'Debe ingresar cuenta, valor y código temporal']);
         break;
      }

      $resultado = $objCorresponsal->entregarRetiroTemporal(
         $idglobal,
         $idpersona,
         $idCuentaDestino,
         $monto,
         $codigoTemporal,
         $idusuario
      );

      echo json_encode($resultado);
      break;
}
