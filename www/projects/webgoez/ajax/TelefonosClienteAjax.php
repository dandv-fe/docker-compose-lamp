<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once __DIR__ . '/../model/TelefonosCliente.php';

try {
   $sucursal = filter_var($_GET['idsucursal'] ?? null, FILTER_VALIDATE_INT);
   $tarjeta = $_GET['idtarjeta'] ?? '';
   if (!is_string($tarjeta)) {
      throw new RuntimeException('Tarjeta inválida.', 400);
   }
   validarLecturaTelefonosCliente($_SESSION, (int)$sucursal, $tarjeta);
   require_once __DIR__ . '/../model/Conexion.php';
   echo json_encode(['telefonos' => listarTelefonosCliente($conexion, $_SESSION, (int)$sucursal, $tarjeta)],
      JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
} catch (mysqli_sql_exception $error) {
   error_log('TelefonosCliente SQL: ' . $error->getMessage());
   http_response_code(500);
   $mensaje = in_array($error->getCode(), [1146, 1305, 1054], true)
      ? 'Historial no disponible: verifica las migraciones 007 y 009 (sql/) en esta base de datos.'
      : 'No se pudo consultar el historial de teléfonos. Consulta el registro de errores del servidor.';
   echo json_encode(['error' => $mensaje], JSON_UNESCAPED_UNICODE);
} catch (RuntimeException $error) {
   http_response_code(in_array($error->getCode(), [400, 401, 403, 404], true) ? $error->getCode() : 500);
   echo json_encode(['error' => $error->getMessage()], JSON_UNESCAPED_UNICODE);
}
