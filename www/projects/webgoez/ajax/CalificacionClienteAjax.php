<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$sesion = $_SESSION;
if (!isset($_SESSION['csrfCalificacionCliente'])) {
   $_SESSION['csrfCalificacionCliente'] = bin2hex(random_bytes(32));
}
$csrf = $_SESSION['csrfCalificacionCliente'];
session_write_close();

try {
   if ((int)($sesion['idusuario'] ?? 0) <= 0) throw new RuntimeException('Inicie sesión.', 401);
   $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
   if (!in_array($method, ['GET', 'POST'], true)) throw new RuntimeException('Método no permitido.', 405);
   $input = $method === 'POST' ? $_POST : $_GET;
   $branch = filter_var($input['idsucursal'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
   $card = $input['idtarjeta'] ?? null;
   if ($branch === false || !is_string($card)) throw new RuntimeException('Tarjeta o sucursal no válida.', 422);
   if ($method === 'POST' && (!is_string($input['csrf'] ?? null) || !hash_equals($csrf, $input['csrf']))) {
      throw new RuntimeException('Solicitud no válida. Abra nuevamente la calificación.', 403);
   }
   require_once __DIR__ . '/../model/CalificacionCliente.php';
   $context = contextoCalificacionCliente($conexion, $sesion, $branch, $card);
   $response = $method === 'POST'
      ? guardarCalificacionCliente($conexion, $context, ...validarCambioCalificacionCliente(
         $input['score'] ?? null, $input['reason'] ?? null, $input['expectedRating'] ?? null))
      : consultarCalificacionCliente($conexion, $context);
   $response['csrf'] = $csrf;
   echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (RuntimeException $error) {
   $status = in_array($error->getCode(), [401, 403, 404, 405, 409, 422], true) ? $error->getCode() : 500;
   http_response_code($status);
   if ($status === 500) error_log('Calificación cliente: ' . $error->getMessage());
   echo json_encode(['error' => $status === 500
      ? 'No se pudo consultar o guardar la calificación. Verifique las migraciones 013 y 014 de clientes y el registro del servidor.'
      : $error->getMessage()], JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
   error_log('Calificación cliente: ' . $error->getMessage());
   http_response_code(500);
   echo json_encode(['error' => 'No se pudo gestionar la calificación. Contacte al administrador.']);
}
