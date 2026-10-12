<?php
require "data.php";
require_once "model/InstalacionesApk.php";

$instalaciones = [];
$errorInstalaciones = null;
$descargaApkLocal = descargaApkLocalDisponible(
   getenv('WEBGOEZ_LOCAL_APK_DOWNLOAD') === '1',
   __DIR__ . '/../backend-creditos-apk/android/app/build/outputs/apk/debug/app-debug.apk'
);
if ($isPagoSistema == -1) {
   include "views/pago_vencido.html";
} else {
   try {
      $instalaciones = listarInstalacionesApk($conexion, $_SESSION);
   } catch (mysqli_sql_exception $error) {
      error_log('Instalaciones APK: ' . $error->getMessage());
      $errorInstalaciones = $error->getCode() === 1146
         ? 'Falta aplicar la migración 012 de instalaciones APK en la base compartida.'
         : 'No se pudieron consultar las instalaciones APK. Revise el registro del servidor.';
   } catch (RuntimeException $error) {
      $errorInstalaciones = $error->getMessage();
   }
   include "views/instalaciones_apk.html";
}
include "views/footer.html";
