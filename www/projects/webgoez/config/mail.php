<?php

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

if (!function_exists('load_private_mail_config')) {
   function load_private_mail_config()
   {
      $candidates = [];

      $home = getenv('HOME');
      if ($home) {
         $candidates[] = rtrim($home, '/') . '/config/webgoez-mail.php';
      }

      if (!empty($_SERVER['HOME'])) {
         $candidates[] = rtrim($_SERVER['HOME'], '/') . '/config/webgoez-mail.php';
      }

      $candidates[] = dirname(__DIR__, 4) . '/config/webgoez-mail.php';

      if (!empty($_SERVER['DOCUMENT_ROOT'])) {
         $candidates[] = dirname(rtrim($_SERVER['DOCUMENT_ROOT'], '/'), 1) . '/config/webgoez-mail.php';
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

if (!function_exists('mail_bool_or_default')) {
   function mail_bool_or_default($value, $default = true)
   {
      if (is_bool($value)) {
         return $value;
      }

      if ($value === null || $value === '') {
         return $default;
      }

      $normalized = strtolower(trim((string)$value));
      return !in_array($normalized, ['0', 'false', 'off', 'no'], true);
   }
}

$privateMail = load_private_mail_config();

return [
   'driver'    => $privateMail['driver'] ?? env_or_default('SMTP_DRIVER', 'smtp'),
   'host'      => $privateMail['host'] ?? env_or_default('SMTP_HOST', 'smtp.example.com'),
   'port'      => intval($privateMail['port'] ?? env_or_default('SMTP_PORT', '587')),
   'secure'    => $privateMail['secure'] ?? env_or_default('SMTP_SECURE', 'tls'),
   'auth'      => mail_bool_or_default($privateMail['auth'] ?? env_or_default('SMTP_AUTH', 'true'), true),
   'username'  => $privateMail['username'] ?? env_or_default('SMTP_USER', 'user@example.com'),
   'password'  => $privateMail['password'] ?? env_or_default('SMTP_PASS', 'CHANGE_ME'),
   'from'      => $privateMail['from'] ?? env_or_default('SMTP_FROM', 'no-reply@example.com'),
   'from_name' => $privateMail['from_name'] ?? env_or_default('SMTP_FROM_NAME', 'App'),
];
