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
      $candidates = [];

      $home = getenv('HOME');
      if ($home) {
         $candidates[] = rtrim($home, '/') . '/config/webgoez-db.php';
      }

      if (!empty($_SERVER['HOME'])) {
         $candidates[] = rtrim($_SERVER['HOME'], '/') . '/config/webgoez-db.php';
      }

      $candidates[] = dirname(__DIR__, 4) . '/config/webgoez-db.php';

      if (!empty($_SERVER['DOCUMENT_ROOT'])) {
         $candidates[] = dirname(rtrim($_SERVER['DOCUMENT_ROOT'], '/'), 1) . '/config/webgoez-db.php';
      }

      foreach (array_unique($candidates) as $configPath) {
         if (!$configPath || !file_exists($configPath)) {
            continue;
         }

         $cfg = include $configPath;
         return is_array($cfg) ? $cfg : [];
      }

      return [];
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

if (!function_exists('db_prepare_execute')) {
   function db_prepare_execute(mysqli $conexion, $sql, $types = '', array $params = [])
   {
      $stmt = $conexion->prepare($sql);

      if (($types === '' && !empty($params)) || ($types !== '' && strlen($types) !== count($params))) {
         throw new InvalidArgumentException('ERROR: tipos/parametros invalidos en sentencia preparada');
      }

      if ($types !== '' && !empty($params)) {
         // bind_param requiere referencias; usar call_user_func_array evita errores fatales con arrays desempaquetados.
         $bindValues = [$types];
         foreach ($params as $index => $value) {
            $bindValues[] = &$params[$index];
         }

         call_user_func_array([$stmt, 'bind_param'], $bindValues);
      }

      $stmt->execute();
      return $stmt;
   }
}

if (!function_exists('db_fetch_object')) {
   function db_fetch_object(mysqli $conexion, $sql, $types = '', array $params = [])
   {
      $stmt = db_prepare_execute($conexion, $sql, $types, $params);
      $result = $stmt->get_result();
      $row = $result ? $result->fetch_object() : null;
      $stmt->close();

      return $row;
   }
}

if (!function_exists('db_execute')) {
   function db_execute(mysqli $conexion, $sql, $types = '', array $params = [])
   {
      $stmt = db_prepare_execute($conexion, $sql, $types, $params);
      $stmt->close();

      return true;
   }
}
//4377382