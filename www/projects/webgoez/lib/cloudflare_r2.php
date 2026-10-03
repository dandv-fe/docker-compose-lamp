<?php
/**
 * Helper para subir archivos a Cloudflare R2 y generar URLs firmadas.
 * Requisitos:
 *  - Instalar aws/aws-sdk-php v3 via Composer: composer require aws/aws-sdk-php
 *  - Proveer credenciales mediante variables de entorno o un vault seguro.
 *
 * Buenas prácticas incluidas: no hardcodear credenciales, detección de Content-Type,
 * manejo de errores y rutas organizadas por cliente/año/mes.
 */

require __DIR__ . '/../vendor/autoload.php';

use Aws\S3\S3Client;
use Aws\Exception\AwsException;

class CloudflareR2
{
    private S3Client $client;
    private string $bucket;

    /**
     * Constructor.
     * @param string $bucket Nombre del bucket/R2
     * @param string $accessKeyId Placeholder o valor real (mejor desde env)
     * @param string $secretAccessKey Placeholder o valor real (mejor desde env)
     * @param string $endpoint URL del endpoint R2 (por ejemplo: https://<accountid>.r2.cloudflarestorage.com)
     * @param string $region Region (no usada por R2, puede ser cualquier valor)
     */
    public function __construct(string $bucket, string $accessKeyId, string $secretAccessKey, string $endpoint, string $region = 'auto')
    {
        // No dejar credenciales en código en producción: usar vault o variables de entorno
        $this->bucket = $bucket;

        $this->client = new S3Client([
            'version' => 'latest',
            'region'  => $region,
            'endpoint' => $endpoint,
            // Cloudflare R2 suele usar estilo path o virtual; path-style suele funcionar bien
            'use_path_style_endpoint' => true,
            'credentials' => [
                'key'    => $accessKeyId,
                'secret' => $secretAccessKey,
            ],
            // Opciones HTTP: verificar certificado (true) o deshabilitar si usas endpoint local (no recomendado)
            'http' => [ 'verify' => true ],
        ]);
    }

    /**
     * Detecta el Content-Type de un archivo local usando finfo.
     * Retorna 'application/octet-stream' si no puede determinarlo.
     */
    private function detectContentType(string $localPath): string
    {
        if (!file_exists($localPath)) {
            return 'application/octet-stream';
        }
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $localPath);
        finfo_close($finfo);
        return $mime ?: 'application/octet-stream';
    }

    /**
     * Genera la clave (key) dentro del bucket con la estructura solicitada:
     * clientes/{ID_CLIENTE}/{AÑO}/{MES}/{archivo}
     * Si no se proporciona $filename, se usará el basename del localPath.
     * Retorna la key generada.
     */
    private function buildKey(string $clienteId, string $localPath, ?string $filename = null): string
    {
        $year = date('Y');
        $month = date('m');
        $name = $filename ?? basename($localPath);
        // Sanitizar el nombre para evitar caracteres problemáticos
        $name = preg_replace('/[^A-Za-z0-9_\-\.]/', '_', $name);
        return sprintf('clientes/%s/%s/%s/%s', $clienteId, $year, $month, $name);
    }

    /**
     * Sube un archivo local a Cloudflare R2.
     * @param string $localPath Ruta local del archivo que se sube
     * @param string $clienteId Id del cliente para organizar en carpetas
     * @param string|null $filename Nombre de archivo a usar en R2 (opcional)
     * @return array ['ok'=>bool, 'key'=>string|null, 'message'=>string]
     */
    public function uploadFile(string $localPath, string $clienteId, ?string $filename = null): array
    {
        if (!file_exists($localPath) || !is_readable($localPath)) {
            return ['ok' => false, 'key' => null, 'message' => 'Archivo no existe o no es legible'];
        }

        $key = $this->buildKey($clienteId, $localPath, $filename);
        $contentType = $this->detectContentType($localPath);

        try {
            // Abrir en binario
            $body = fopen($localPath, 'rb');

            $result = $this->client->putObject([
                'Bucket' => $this->bucket,
                'Key' => $key,
                'Body' => $body,
                'ContentType' => $contentType,
                // No hacer público por defecto; controlamos accesos con presigned URLs
                'ACL' => 'private'
            ]);

            if (is_resource($body)) {
                fclose($body);
            }

            // $result contiene metadata devuelta por R2/S3
            return ['ok' => true, 'key' => $key, 'message' => 'Subida correcta'];
        } catch (AwsException $e) {
            // Manejo específico de AWS SDK
            $err = $e->getMessage();
            return ['ok' => false, 'key' => null, 'message' => 'AWS error: ' . $err];
        } catch (Exception $e) {
            return ['ok' => false, 'key' => null, 'message' => 'Error inesperado: ' . $e->getMessage()];
        }
    }

    /**
     * Genera una URL firmada (Presigned URL) para descarga válida por $expires (ej. '+15 minutes').
     * @param string $key Key en el bucket
     * @param string $expires Tiempo expiración compatible con strtotime (ej. '+15 minutes')
     * @return array ['ok'=>bool, 'url'=>string|null, 'message'=>string]
     */
    public function getPresignedUrl(string $key, string $expires = '+15 minutes'): array
    {
        try {
            $cmd = $this->client->getCommand('GetObject', [
                'Bucket' => $this->bucket,
                'Key' => $key
            ]);

            // createPresignedRequest acepta un DateTimeInterface o un string relativo
            $request = $this->client->createPresignedRequest($cmd, $expires);
            $presignedUrl = (string) $request->getUri();

            return ['ok' => true, 'url' => $presignedUrl, 'message' => 'URL generada'];
        } catch (AwsException $e) {
            return ['ok' => false, 'url' => null, 'message' => 'AWS error: ' . $e->getMessage()];
        } catch (Exception $e) {
            return ['ok' => false, 'url' => null, 'message' => 'Error inesperado: ' . $e->getMessage()];
        }
    }
}

/**
 * EJEMPLO DE USO (no lo incluyas en producción; usa variables de entorno o vault):
 *
 * $r2 = new CloudflareR2(
 *    'NOMBRE_BUCKET',
 *    getenv('R2_ACCESS_KEY_ID') ?: 'R2_ACCESS_KEY_ID_PLACEHOLDER',
 *    getenv('R2_SECRET_ACCESS_KEY') ?: 'R2_SECRET_ACCESS_KEY_PLACEHOLDER',
 *    'https://<ACCOUNT_ID>.r2.cloudflarestorage.com'
 * );
 *
 * $upload = $r2->uploadFile('/tmp/factura-123.pdf', 'CLIENTE123');
 * if ($upload['ok']) {
 *    $presign = $r2->getPresignedUrl($upload['key'], '+15 minutes');
 *    echo $presign['url'];
 * }
 */

// Fin del archivo
