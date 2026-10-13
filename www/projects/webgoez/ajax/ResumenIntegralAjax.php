<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (!isset($_SESSION['idusuario'])) {
   http_response_code(401);
   echo json_encode(['error' => 'Inicie sesión para consultar el resumen integral.']);
   exit;
}
$idusuario = (int)$_SESSION['idusuario'];
$oficina = (int)($_SESSION['idoficina'] ?? 0);
session_write_close();

try {
   require_once __DIR__ . '/../model/ResumenIntegral.php';
   $op = $_GET['op'] ?? 'resumen';
   if (!is_string($op) || !in_array($op, ['resumen', 'egresos'], true)) {
      throw new InvalidArgumentException('Operación de consulta no válida.');
   }
   $desde = $_GET['desde'] ?? date('Y-m-01');
   $hasta = $_GET['hasta'] ?? date('Y-m-d');
   $sucursal = filter_var($_GET['sucursal'] ?? 0, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
   $page = filter_var($_GET['pagina'] ?? 1, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 100000]]);
   if (!is_string($desde) || !is_string($hasta) || $sucursal === false || $page === false) {
      throw new InvalidArgumentException('Los filtros de la consulta no son válidos.');
   }
   $context = resumenIntegralIdentidad($conexion, $idusuario, $oficina);
   $report = new ResumenIntegral($conexion, $context, $desde, $hasta, $sucursal);
   echo json_encode($op === 'resumen' ? $report->report() : $report->expenses($page),
      JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (InvalidArgumentException $error) {
   http_response_code(422);
   echo json_encode(['error' => $error->getMessage()], JSON_UNESCAPED_UNICODE);
} catch (DomainException $error) {
   http_response_code(403);
   echo json_encode(['error' => $error->getMessage()], JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
   error_log('Resumen integral: ' . $error->getMessage());
   http_response_code(500);
   echo json_encode(['error' => 'No se pudo consultar el resumen. Intente nuevamente o contacte al administrador.'],
      JSON_UNESCAPED_UNICODE);
}
