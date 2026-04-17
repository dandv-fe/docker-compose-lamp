<?php
/**
 * Cargador de configuración para Cloudflare R2 (s3 compatible).
 * Busca credenciales en variables de entorno o en un archivo privado
 * (webgoez-r2.php) en rutas comunes (HOME/config, ../config, etc.).
 * Retorna la configuración lista para instanciar `CloudflareR2`.
 */

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

if (!function_exists('load_private_r2_config')) {
    function load_private_r2_config()
    {
        $candidates = [];
        $home = getenv('HOME');
        if ($home) {
            $candidates[] = rtrim($home, '/') . '/config/webgoez-r2.php';
        }
        if (!empty($_SERVER['HOME'])) {
            $candidates[] = rtrim($_SERVER['HOME'], '/') . '/config/webgoez-r2.php';
        }
        // Ruta relativa fuera del directorio del proyecto
        $candidates[] = dirname(__DIR__, 2) . '/config/webgoez-r2.php';
        if (!empty($_SERVER['DOCUMENT_ROOT'])) {
            $candidates[] = dirname(rtrim($_SERVER['DOCUMENT_ROOT'], '/'), 1) . '/config/webgoez-r2.php';
        }

        foreach (array_unique($candidates) as $path) {
            if ($path && file_exists($path)) {
                $cfg = include $path;
                return is_array($cfg) ? $cfg : [];
            }
        }
        return [];
    }
}

/**
 * Obtiene la configuración efectiva para R2 usando (por orden):
 *  - variables de entorno
 *  - archivo privado `webgoez-r2.php`
 *  - valores por defecto (placeholders)
 *
 * Devuelve un array con keys: bucket, access_key_id, secret_access_key, endpoint, region
 */
function getR2Config(): array
{
    $private = load_private_r2_config();

    $bucket = $private['bucket'] ?? env_or_default('R2_BUCKET', 'R2_BUCKET_PLACEHOLDER');
    $access = $private['access_key_id'] ?? env_or_default('R2_ACCESS_KEY_ID', 'R2_ACCESS_KEY_ID_PLACEHOLDER');
    $secret = $private['secret_access_key'] ?? env_or_default('R2_SECRET_ACCESS_KEY', 'R2_SECRET_ACCESS_KEY_PLACEHOLDER');
    $endpoint = $private['endpoint'] ?? env_or_default('R2_ENDPOINT', 'https://<ACCOUNT_ID>.r2.cloudflarestorage.com');
    $region = $private['region'] ?? env_or_default('R2_REGION', 'auto');

    return [
        'bucket' => $bucket,
        'access_key_id' => $access,
        'secret_access_key' => $secret,
        'endpoint' => $endpoint,
        'region' => $region,
    ];
}

/**
 * Crea y retorna una instancia de la clase CloudflareR2 definida en lib/cloudflare_r2.php
 * @return \CloudflareR2
 */
function createR2ClientFromConfig()
{
    $cfg = getR2Config();
    require_once __DIR__ . '/cloudflare_r2.php';
    return new CloudflareR2(
        $cfg['bucket'],
        $cfg['access_key_id'],
        $cfg['secret_access_key'],
        $cfg['endpoint'],
        $cfg['region']
    );
}

// Fin
