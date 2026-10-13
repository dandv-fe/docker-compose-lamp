<?php
session_start();
if (!isset($_SESSION['idusuario'])) {
   header('Location: login.php');
   exit;
}
session_write_close();
ob_start();
require 'data.php';
if ($isPagoSistema == -1) {
   include 'views/pago_vencido.html';
} elseif (!($puedeVerResumenIntegral ?? false)) {
   http_response_code(403);
   include 'views/resumen_integral_denegado.html';
} else {
   include 'views/resumen_integral.html';
}
include 'views/footer.html';
ob_end_flush();
