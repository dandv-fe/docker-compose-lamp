<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if (!isset($_SESSION['csrfNominaEmpleado'])) $_SESSION['csrfNominaEmpleado'] = bin2hex(random_bytes(32));
$session = $_SESSION;
$csrf = $_SESSION['csrfNominaEmpleado'];
session_write_close();
try {
   $companyId = (int)($session['idglobal'] ?? 0);
   $userId = (int)($session['idusuario'] ?? 0);
   if ($companyId <= 0 || $userId <= 0) throw new RuntimeException('Inicie sesión.', 401);
   $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
   if (!in_array($method, ['GET','POST'], true)) throw new RuntimeException('Método no permitido.', 405);
   $input = $method === 'GET' ? $_GET : $_POST;
   if ($method === 'POST' && stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') === 0) {
      $input = json_decode(file_get_contents('php://input'), true, 32, JSON_THROW_ON_ERROR);
   }
   if (!is_array($input)) throw new RuntimeException('Datos no válidos.', 422);
   $action = $input['action'] ?? ($method === 'GET' ? 'resumen' : '');
   if ($method === 'POST' && (!is_string($input['csrfToken'] ?? null) || !hash_equals($csrf, $input['csrfToken']))) {
      throw new RuntimeException('Solicitud no válida; abra nuevamente la nómina.', 403);
   }
   require_once __DIR__ . '/../model/NominaEmpleado.php';
   $model = new NominaEmpleado();
   $actor = $model->actor($companyId, $userId);
   if ($method === 'GET') {
      if ($action === 'bootstrap') $response = $model->obtenerBootstrap($companyId, $userId);
      elseif ($action === 'bonoContexto') {
         $branchId = filter_var($input['branchId'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
         if (!$branchId || $branchId !== (int)($session['idsucursal'] ?? 0)) throw new RuntimeException('Seleccione la cartera actual.', 403);
         $response = $model->bonoContexto($companyId, $userId, $branchId);
      }
      elseif ($action === 'resumen') {
         $employeeId = isset($input['employeeId']) ? filter_var($input['employeeId'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) : (int)$actor['employeeId'];
         if (!$employeeId) throw new RuntimeException('Empleado no válido.', 422);
         $model->autorizarEmpleado($companyId, $userId, $employeeId);
         $response = $model->resumen($companyId, $employeeId, $input['asOf'] ?? null);
      } else throw new RuntimeException('Acción no válida.', 422);
   } else {
      $methods = ['contrato' => 'guardarContrato', 'vacacion' => 'guardarVacacion', 'bono' => 'guardarBono', 'reparto' => 'guardarReparto'];
      if (!isset($methods[$action])) throw new RuntimeException('Acción no válida.', 422);
      $data = $input['data'] ?? $input;
      if (is_string($data)) $data = json_decode($data, true, 32, JSON_THROW_ON_ERROR);
      if ($action === 'bono') {
         $branchId = is_array($data) ? filter_var($data['branchId'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) : false;
         $routeId = is_array($data) ? filter_var($data['routeId'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) : false;
         if (!$branchId || !$routeId || $branchId !== (int)($session['idsucursal'] ?? 0)) {
            throw new RuntimeException('El bono requiere la cartera seleccionada en caja.', 403);
         }
         $scope = $model->bonoContexto($companyId, $userId, (int)$session['idsucursal']);
         if ($routeId !== $scope['routeId']) throw new RuntimeException('El despacho cambió; recargue la caja.', 409);
         $data['branchId'] = $scope['branchId'];
         $data['routeId'] = $scope['routeId'];
      }
      $response = $model->{$methods[$action]}($companyId, $userId, $data);
   }
   $response['csrfToken'] = $csrf;
   echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
   $status = in_array($error->getCode(), [401,403,404,405,409,422], true) ? $error->getCode() : 500;
   if ($error instanceof JsonException) $status = 422;
   http_response_code($status);
   if ($status === 500) error_log('Nómina empleado: ' . $error->getMessage());
   echo json_encode(['error' => $status === 500 ? 'No se pudo gestionar nómina. Verifique migraciones 015/016 y registro del servidor.' : $error->getMessage()], JSON_UNESCAPED_UNICODE);
}
