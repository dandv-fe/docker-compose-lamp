<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once __DIR__ . '/../model/TelefonosCliente.php';
$transaccion = false;
try {
   $post = $_SERVER['REQUEST_METHOD'] === 'POST';
   if (!$post && $_SERVER['REQUEST_METHOD'] !== 'GET') {
      throw new RuntimeException('Método no permitido.', 405);
   }
   $datos = $post ? $_POST : $_GET;
   $sucursal = (int)filter_var($datos['idsucursal'] ?? null, FILTER_VALIDATE_INT);
   $tarjeta = $datos['idtarjeta'] ?? '';
   if (!is_string($tarjeta)) {
      throw new RuntimeException('Tarjeta inválida.', 400);
   }
   validarLecturaTelefonosCliente($_SESSION, $sucursal, $tarjeta);
   if ($post) {
      validarCsrfTelefonosCliente($_SESSION, $datos['csrf'] ?? null);
      if (!is_string($datos['telefono'] ?? null) || !is_string($datos['accion'] ?? null)) {
         throw new RuntimeException('Teléfono o acción inválidos.', 400);
      }
   }
   require_once __DIR__ . '/../model/Conexion.php';
   if ($post) {
      $conexion->begin_transaction();
      $transaccion = true;
      mutarTelefonoCliente($conexion, $_SESSION, $sucursal, $tarjeta, $datos['telefono'], $datos['accion']);
   }
   $respuesta = gestionarListaTelefonosCliente($conexion, $_SESSION, $sucursal, $tarjeta);
   if ($post) {
      $conexion->commit();
      $transaccion = false;
   }
   if (!isset($_SESSION['csrfTelefonosCliente'])) {
      $_SESSION['csrfTelefonosCliente'] = bin2hex(random_bytes(32));
   }
   $respuesta['csrf'] = $_SESSION['csrfTelefonosCliente'];
   echo json_encode($respuesta, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
} catch (mysqli_sql_exception $error) {
   if ($transaccion) $conexion->rollback();
   error_log('GestionTelefonosCliente SQL: ' . $error->getMessage());
   http_response_code(500);
   echo json_encode(['error' => 'No se pudo gestionar el teléfono. Verifica las migraciones 007, 008 y 009 y el registro del servidor.']);
} catch (RuntimeException $error) {
   if ($transaccion) $conexion->rollback();
   http_response_code(in_array($error->getCode(), [400, 401, 403, 404, 405, 409], true) ? $error->getCode() : 500);
   echo json_encode(['error' => $error->getMessage()], JSON_UNESCAPED_UNICODE);
}
