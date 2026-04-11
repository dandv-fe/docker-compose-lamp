<?php
date_default_timezone_set("America/Bogota");

if (!function_exists('env_or_default')) {
   function env_or_default($key, $default = '')
   {
      if (isset($_ENV[$key]) && $_ENV[$key] !== '') {
         return $_ENV[$key];
      }

      $value = getenv($key);
      if ($value !== false && $value !== '') {
         return $value;
      }

      return $default;
   }
}

if (!function_exists('load_private_db_config')) {
   function load_private_db_config()
   {
      $home = getenv('HOME');
      if (!$home && isset($_SERVER['HOME'])) {
         $home = $_SERVER['HOME'];
      }

      if (!$home) {
         return [];
      }

      $configPath = rtrim($home, '/') . '/config/webgoez-db.php';
      if (!file_exists($configPath)) {
         return [];
      }

      $cfg = include $configPath;
      return is_array($cfg) ? $cfg : [];
   }
}

$isDocker = file_exists('/.dockerenv');
$privateDb = load_private_db_config();

$HOST = $privateDb['host'] ?? env_or_default('DB_HOST', $isDocker ? 'database' : 'localhost');
$USER = $privateDb['user'] ?? env_or_default('DB_USER', $isDocker ? 'root' : 'websdnco_user_webgoez');
$PASS = $privateDb['pass'] ?? env_or_default('DB_PASS', env_or_default('MYSQL_ROOT_PASSWORD', $isDocker ? '' : ''));
$DB = $privateDb['name'] ?? env_or_default('DB_NAME', 'websdnco_pro');

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$conexion = new mysqli($HOST, $USER, $PASS, $DB);
mysqli_set_charset($conexion, "utf8mb4");
if (mysqli_connect_errno()) {
   printf("Connect failed: %s\n", mysqli_connect_error());
   exit();
}
//4377382