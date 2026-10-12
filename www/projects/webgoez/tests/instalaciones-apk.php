<?php
if (getenv('RUN_APP_INSTALLATION_TESTS') !== '1') {
   throw new RuntimeException('Set RUN_APP_INSTALLATION_TESTS=1 to use isolated temporary tables.');
}
require_once __DIR__ . '/../model/Conexion.php';
require_once __DIR__ . '/../model/InstalacionesApk.php';

try {
   $backend = __DIR__ . '/../../backend-creditos-apk/';
   $fixture = file_get_contents($backend . 'tests/fixtures/payroll-scope.sql');
   foreach (array_filter(array_map('trim', explode(';', $fixture))) as $sql) {
      $conexion->query($sql);
   }
   $migration = file_get_contents($backend . 'migrations/012_app_installations.sql');
   $conexion->query(str_replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMPORARY TABLE', $migration));
   $conexion->query('CREATE TEMPORARY TABLE tbl_usuario (
      idusuario INT, idglobal INT, idpersona INT, str_user_name VARCHAR(50)
   )');
   $conexion->query("INSERT INTO tbl_usuario VALUES
      (111,7,11,'ana'),(112,7,12,'beto'),(121,7,21,'eva'),(131,7,31,'admin'),
      (190,7,90,'usuario'),(181,8,81,'otra-empresa')");
   foreach ([[111,7],[112,7],[121,7],[131,7],[190,7],[181,8]] as [$user, $company]) {
      db_execute($conexion, 'INSERT INTO mobile_app_installation VALUES (?,?,?,?,?,UTC_TIMESTAMP(3))',
         'iisis', [$company, $user, "installation-$user", 2, '<script>test</script>']);
   }
   foreach ([
      [['idglobal'=>7,'idusuario'=>111,'idempleado'=>11], [111]],
      [['idglobal'=>7,'idusuario'=>131,'idempleado'=>31], [111,112,131]],
      [['idglobal'=>7,'idusuario'=>190], [190]],
      [['idglobal'=>7,'idusuario'=>111,'userEmpresa'=>7], [111,112,121,131,190]]
   ] as [$session, $expectedUsers]) {
      $rows = listarInstalacionesApk($conexion, $session);
      $ids = array_map(fn($row) => (int)substr($row['installation_id'], 13), $rows);
      sort($ids);
      if ($ids !== $expectedUsers) {
         throw new RuntimeException('Installation listing leaked or omitted reports.');
      }
   }
   $instalaciones = listarInstalacionesApk($conexion, ['idglobal'=>7,'idusuario'=>111,'idempleado'=>11]);
   $errorInstalaciones = null;
   $descargaApkLocal = true;
   ob_start();
   include __DIR__ . '/../views/instalaciones_apk.html';
   $html = ob_get_clean();
   if (strpos($html, 'Descargar APK de prueba') === false ||
       strpos($html, 'href="../backend-creditos-apk/android/app/build/outputs/apk/debug/app-debug.apk"') === false) {
      throw new RuntimeException('Local APK download button is missing or has an incorrect URL.');
   }
   $descargaApkLocal = false;
   ob_start();
   include __DIR__ . '/../views/instalaciones_apk.html';
   $disabledHtml = ob_get_clean();
   if (strpos($disabledHtml, 'Descargar APK de prueba') !== false ||
       descargaApkLocalDisponible(false, __FILE__) ||
       descargaApkLocalDisponible(true, __DIR__ . '/missing.apk') ||
       !descargaApkLocalDisponible(true, __FILE__)) {
      throw new RuntimeException('Local APK download must be explicitly enabled and have a readable file.');
   }
   if (strpos($html, '<script>test</script>') !== false ||
       strpos($html, '&lt;script&gt;test&lt;/script&gt;') === false) {
      throw new RuntimeException('Reported version was not escaped.');
   }
   for ($index = 0; $index < 110; $index++) {
      db_execute($conexion, 'INSERT INTO mobile_app_installation VALUES (7,111,?,2,?,UTC_TIMESTAMP(3))',
         'ss', ["extra-$index", '0.2.0']);
   }
   if (count(listarInstalacionesApk($conexion, ['idglobal'=>7,'idusuario'=>111,'idempleado'=>11])) !== 100) {
      throw new RuntimeException('Installation listing is not bounded to 100.');
   }
   echo "OK: company, office, own-user scope, escaped output and 100-report limit\n";
} finally {
   $conexion->close();
}
