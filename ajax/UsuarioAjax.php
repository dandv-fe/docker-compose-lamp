<?php
// header("Access-Control-Allow-Origin: *"); 
session_start();

require_once "../method.php";

// Autoload de Composer (PHPMailer) si existe
$__autoload = __DIR__ . '/../vendor/autoload.php';
if (file_exists($__autoload)) {
   require_once $__autoload;
}

// Cargar configuración SMTP si existe
$MAIL_CONFIG = [];
$__cfg_mail = __DIR__ . '/../config/mail.php';
if (file_exists($__cfg_mail)) {
   $tmpCfg = include $__cfg_mail;
   if (is_array($tmpCfg)) {
      $MAIL_CONFIG = $tmpCfg;
   }
}

// Cargar nombre del sistema desde info_sistema.php
require_once "../info_sistema.php";
$infoSistemaCuentas = infoSistemaCuentas();

// Helpers verificación por enlace
function _get_base_url()
{
   $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
   $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
   $scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
   return $scheme . '://' . $host . $scriptDir;
}

function _ensure_email_verify_table($conexion)
{
   $sql = "CREATE TABLE IF NOT EXISTS `tbl_email_verificacion` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `idpersona` INT NOT NULL,
      `token_hash` VARCHAR(64) NOT NULL,
      `created_at` DATETIME NOT NULL,
      `expires_at` DATETIME NOT NULL,
      `used_at` DATETIME NULL,
      `ip` VARCHAR(45) NULL,
      INDEX (`idpersona`),
      INDEX (`token_hash`)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
   @$conexion->query($sql);
}

function _get_persona_by_usuario($conexion, $idusuario, $idglobal)
{
   $sql = "SELECT p.idpersona, p.str_email, p.str_email_verificado FROM tbl_usuario u INNER JOIN tbl_persona p ON p.idpersona = u.idpersona WHERE u.idusuario = " . intval($idusuario) . " AND u.idglobal = " . intval($idglobal) . " LIMIT 1";
   $q = $conexion->query($sql);
   return $q ? $q->fetch_object() : null;
}

function _resolve_persona_actual($conexion)
{
   $idpersona = intval($_SESSION['idpersona'] ?? 0);
   if ($idpersona > 0) {
      return $idpersona;
   }

   $idusuario = intval($_SESSION['idusuario'] ?? 0);
   $idglobal = intval($_SESSION['idglobal'] ?? 0);
   if ($idusuario > 0 && $idglobal > 0) {
      $persona = _get_persona_by_usuario($conexion, $idusuario, $idglobal);
      if (!empty($persona->idpersona)) {
         return intval($persona->idpersona);
      }
   }

   $idempleado = intval($_SESSION['idempleado'] ?? 0);
   if ($idempleado > 0) {
      $sql = "SELECT idpersona FROM tbl_empleado WHERE idempleado=" . $idempleado . " LIMIT 1";
      $q = $conexion->query($sql);
      $r = $q ? $q->fetch_object() : null;
      if (!empty($r->idpersona)) {
         return intval($r->idpersona);
      }
   }

   return 0;
}

function _obtener_datos_persona_actual($conexion, $idpersona)
{
   $sql = "SELECT
            idpersona,
            str_email AS email,
            str_email_verificado AS email_verificado,
            str_telefono AS telefono,
            str_direccion_departamento AS departamento,
            str_direccion_ciudad AS ciudad,
            str_direccion_barrio AS barrio,
            str_direccion_calle AS direccion
         FROM tbl_persona
         WHERE idpersona=" . intval($idpersona) . "
         LIMIT 1";
   $q = $conexion->query($sql);
   return $q ? $q->fetch_object() : null;
}

function _send_verification_email($toEmail, $verifyUrl)
{
   global $MAIL_CONFIG;
   global $infoSistemaCuentas;
   $name = isset($infoSistemaCuentas['name']) ? $infoSistemaCuentas['name'] : 'Sistema';
   $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
   $subject = 'Verificación de correo';
   $html = "<html><body style='font-family:Arial,sans-serif'>" .
      "<div style='background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;'>" .
      "<h1 style='color: white; margin: 0; font-size: 32px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);'>" . $name . "</h1>" .
      "</div>" .
      "<div style='padding: 30px; background: #f8f9fa;'>" .
      "<h2>Confirma tu correo</h2>" .
      "<p>Haz clic en el siguiente enlace para verificar tu correo:</p>" .
      "<p><a href='" . htmlspecialchars($verifyUrl, ENT_QUOTES, 'UTF-8') . "' target='_blank'>Verificar correo</a></p>" .
      "<p>Si no solicitaste esto, puedes ignorar este mensaje.</p>" .
      "</body></html>";
   $text = "Confirma tu correo\n\nAbre este enlace: " . $verifyUrl . "\n\nSi no solicitaste esto, ignora el mensaje.";

   if (class_exists('PHPMailer\\PHPMailer\\PHPMailer')) {
      try {
         $mail = new PHPMailer\PHPMailer\PHPMailer(true);
         $smtpDebug = getenv('SMTP_DEBUG');
         if ($smtpDebug === '1' || strtolower((string)$smtpDebug) === 'true') {
            $mail->SMTPDebug = 2; // salida verbose
         }
         // Preferir config por archivo, luego env vars
         $driver     = $MAIL_CONFIG['driver']   ?? null;
         $smtpHost   = $MAIL_CONFIG['host']     ?? (getenv('SMTP_HOST') ?: '');
         $smtpUser   = $MAIL_CONFIG['username'] ?? (getenv('SMTP_USER') ?: '');
         $smtpPass   = $MAIL_CONFIG['password'] ?? (getenv('SMTP_PASS') ?: '');
         $smtpPort   = (string)($MAIL_CONFIG['port'] ?? (getenv('SMTP_PORT') ?: '587'));
         $smtpSecure = $MAIL_CONFIG['secure']   ?? (getenv('SMTP_SECURE') ?: 'tls');
         $smtpAuth   = $MAIL_CONFIG['auth']     ?? getenv('SMTP_AUTH');
         $smtpAuth   = is_bool($smtpAuth) ? $smtpAuth : !(($smtpAuth === '0') || (strtolower((string)$smtpAuth) === 'false'));

         if ($driver === 'smtp' || !empty($smtpHost)) {
            $mail->isSMTP();
            $mail->Host = $smtpHost;
            $mail->SMTPAuth = $smtpAuth;
            if ($smtpAuth) {
               $mail->Username = $smtpUser;
               $mail->Password = $smtpPass;
            }
            $mail->Port = (int)$smtpPort;
            if ($smtpSecure === 'ssl' || $smtpSecure === 'tls') {
               $mail->SMTPSecure = $smtpSecure;
            }
         } else {
            $mail->isMail();
         }

         $fromEmail = $MAIL_CONFIG['from']      ?? (getenv('SMTP_FROM') ?: ('no-reply@' . $host));
         $fromName  = $MAIL_CONFIG['from_name'] ?? (getenv('SMTP_FROM_NAME') ?: 'No Reply');
         $mail->setFrom($fromEmail, $fromName);
         $mail->addAddress($toEmail);
         $mail->Subject = $subject;
         $mail->isHTML(true);
         $mail->Body = $html;
         $mail->AltBody = $text;
         $mail->CharSet = 'UTF-8';
         $mail->send();
         return true;
      } catch (Exception $e) {
         // Si falla PHPMailer, devolver error con detalle para diagnóstico
         // No exponemos credenciales; solo el mensaje del transporte.
         $GLOBALS['__MAIL_LAST_ERROR'] = $e->getMessage();
      }
   }

   $headers = [];
   $headers[] = 'MIME-Version: 1.0';
   $headers[] = 'Content-type: text/html; charset=UTF-8';
   $headers[] = 'From: No Reply <no-reply@' . $host . '>';
   $headers[] = 'X-Mailer: PHP/' . phpversion();
   $ok = @mail($toEmail, $subject, $html, implode("\r\n", $headers));
   if (!$ok) {
      $GLOBALS['__MAIL_LAST_ERROR'] = isset($GLOBALS['__MAIL_LAST_ERROR']) ? $GLOBALS['__MAIL_LAST_ERROR'] : 'mail() fallo al enviar';
   }
   return $ok;
}

function _send_mail_generic($toEmail, $subject, $html, $text)
{
   global $MAIL_CONFIG;
   $host = $_SERVER['HTTP_HOST'] ?? 'localhost';

   if (class_exists('PHPMailer\\PHPMailer\\PHPMailer')) {
      try {
         $mail = new PHPMailer\PHPMailer\PHPMailer(true);
         $smtpDebug = getenv('SMTP_DEBUG');
         if ($smtpDebug === '1' || strtolower((string)$smtpDebug) === 'true') {
            $mail->SMTPDebug = 2;
         }

         $driver     = $MAIL_CONFIG['driver']   ?? null;
         $smtpHost   = $MAIL_CONFIG['host']     ?? (getenv('SMTP_HOST') ?: '');
         $smtpUser   = $MAIL_CONFIG['username'] ?? (getenv('SMTP_USER') ?: '');
         $smtpPass   = $MAIL_CONFIG['password'] ?? (getenv('SMTP_PASS') ?: '');
         $smtpPort   = (string)($MAIL_CONFIG['port'] ?? (getenv('SMTP_PORT') ?: '587'));
         $smtpSecure = $MAIL_CONFIG['secure']   ?? (getenv('SMTP_SECURE') ?: 'tls');
         $smtpAuth   = $MAIL_CONFIG['auth']     ?? getenv('SMTP_AUTH');
         $smtpAuth   = is_bool($smtpAuth) ? $smtpAuth : !(($smtpAuth === '0') || (strtolower((string)$smtpAuth) === 'false'));

         if ($driver === 'smtp' || !empty($smtpHost)) {
            $mail->isSMTP();
            $mail->Host = $smtpHost;
            $mail->SMTPAuth = $smtpAuth;
            if ($smtpAuth) {
               $mail->Username = $smtpUser;
               $mail->Password = $smtpPass;
            }
            $mail->Port = (int)$smtpPort;
            if ($smtpSecure === 'ssl' || $smtpSecure === 'tls') {
               $mail->SMTPSecure = $smtpSecure;
            }
         } else {
            $mail->isMail();
         }

         $fromEmail = $MAIL_CONFIG['from']      ?? (getenv('SMTP_FROM') ?: ('no-reply@' . $host));
         $fromName  = $MAIL_CONFIG['from_name'] ?? (getenv('SMTP_FROM_NAME') ?: 'No Reply');

         $mail->setFrom($fromEmail, $fromName);
         $mail->addAddress($toEmail);
         $mail->Subject = $subject;
         $mail->isHTML(true);
         $mail->Body = $html;
         $mail->AltBody = $text;
         $mail->CharSet = 'UTF-8';
         $mail->send();
         return true;
      } catch (Exception $e) {
         $GLOBALS['__MAIL_LAST_ERROR'] = $e->getMessage();
      }
   }

   $headers = [];
   $headers[] = 'MIME-Version: 1.0';
   $headers[] = 'Content-type: text/html; charset=UTF-8';
   $headers[] = 'From: No Reply <no-reply@' . $host . '>';
   $headers[] = 'X-Mailer: PHP/' . phpversion();
   $ok = @mail($toEmail, $subject, $html, implode("\r\n", $headers));
   if (!$ok) {
      $GLOBALS['__MAIL_LAST_ERROR'] = isset($GLOBALS['__MAIL_LAST_ERROR']) ? $GLOBALS['__MAIL_LAST_ERROR'] : 'mail() fallo al enviar';
   }
   return $ok;
}

function _get_usuario_actual($conexion, $idusuario, $idglobal)
{
   $sql = "SELECT u.idusuario, u.str_user_name, u.str_password, p.idpersona, p.str_email
           FROM tbl_usuario u
           INNER JOIN tbl_persona p ON p.idpersona = u.idpersona
           WHERE u.idusuario=" . intval($idusuario) . " AND u.idglobal=" . intval($idglobal) . "
           LIMIT 1";
   $q = $conexion->query($sql);
   return $q ? $q->fetch_object() : null;
}

function _generate_temp_password($length = 10)
{
   $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%';
   $max = strlen($alphabet) - 1;
   $length = max(8, intval($length));
   $password = '';
   for ($i = 0; $i < $length; $i++) {
      try {
         $idx = random_int(0, $max);
      } catch (Throwable $e) {
         $idx = mt_rand(0, $max);
      }
      $password .= $alphabet[$idx];
   }
   return $password;
}

if (empty($_GET["op"])) {
   if (empty($_SESSION["idusuario"])) {
      echo 0;
   } else {
      echo 1;
   }
   exit;
}
require_once "../model/Usuario.php";
require_once "../model/Conexion.php";

$objusuario = new usuario();

switch ($_GET["op"]) {
   case 'seccionValidarHoja':
      $par = limpiar_cadena($_POST['parametro']);
      $otrop = limpiar_cadena($_POST['otro_parametro']);

      $_SESSION['idsucursal'] = $par;
      $_SESSION['MYSESSION_usuario'] = $otrop;
      echo 'Ok';
      break;

   case "IngresarSistema":
      $encoder = new CustomEncoder();
      $empresa = limpiar_cadena($_REQUEST["empresa"]);
      $user = limpiar_cadena($_REQUEST["user"]);
      $pass = limpiar_cadena2($_REQUEST["pass"]);
      if (!$empresa || !$user || !$pass) {
         echo json_encode(0);
         return;
      }
      $idglobal = intval($empresa);
      $query = $objusuario->SignIn($user, md5($pass), $idglobal);
      $fetch = $query->fetch_object();
      if (isset($fetch)) {
         $_SESSION['idsucursal'] = 0; // Cortera activa
         $_SESSION['idoficina'] = 0; // oficina activa
         $_SESSION['idusuario'] = $fetch->idusuario;
         $_SESSION['idglobal'] = $idglobal;
         $fetch->idusuario = $encoder->encode($fetch->idusuario);
         echo json_encode($fetch);
         return;
      }
      /* // Uso
      $txt = 'Duvan';

      // Codificar
      $key = $encoder->encode($txt);
      echo "Codificado: " . $key . "\n"; // WsuIoPqAjK

      // Descodicar
      $decoded = $encoder->decode($key);
      echo "Descodificado: " . $decoded . "\n"; // Versy
      */
      echo json_encode($fetch);
      break;

   case "Salir":

      session_unset();
      session_destroy();

      echo "<script>
			sessionStorage.removeItem('empleado')
			sessionStorage.removeItem('empresa')
			sessionStorage.removeItem('userNameEmpleado')
			sessionStorage.removeItem('fotoEmpleado')
			sessionStorage.removeItem('index')
			window.name='';
			location.href ='../login.php';
		  </script>";
      break;

   case 'IngresarSistemaActividad':
      $idsucursal = limpiar_cadena($_REQUEST['empresa']);
      //$refSession = limpiar_cadena($_REQUEST['refSession']);
      //$idempleado = $_SESSION['idempleado'];

      //if (empty($_SESSION['userEmpresa'])) {
      //	echo json_encode(array('session'=> $idsucursal));
      //} else {
      $_SESSION['idsucursal'] = $idsucursal;
      echo json_encode(array('session' => $idsucursal));
      //}
      break;
   case 'BajarSistemaActividad':
      $refSession = limpiar_cadena($_REQUEST['refSession']);
      unset($_SESSION[$refSession]);
      $_SESSION['idsucursal'] = '';
      echo json_encode(1);
      break;

   case 'solicitarVerificacionEmail':
      if (empty($_SESSION['idusuario']) || empty($_SESSION['idglobal'])) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Sesión inválida']);
         break;
      }
      global $conexion;
      if (!$conexion) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Sin conexión a BD']);
         break;
      }
      $idusuario = intval($_SESSION['idusuario']);
      $idglobal = intval($_SESSION['idglobal']);
      $persona = _get_persona_by_usuario($conexion, $idusuario, $idglobal);
      if (!$persona || empty($persona->idpersona)) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Persona no encontrada']);
         break;
      }
      if (empty($persona->str_email)) {
         echo json_encode(['status' => 'error', 'mensaje' => 'No hay correo para enviar']);
         break;
      }
      if (!empty($persona->str_email_verificado) && $persona->str_email_verificado !== '0') {
         echo json_encode(['status' => 'success', 'mensaje' => 'El correo ya está verificado']);
         break;
      }
      _ensure_email_verify_table($conexion);
      $token = bin2hex(random_bytes(32));
      $token_hash = hash('sha256', $token);
      $ip = $_SERVER['REMOTE_ADDR'] ?? null;
      $conexion->query("INSERT INTO tbl_email_verificacion (idpersona, token_hash, created_at, expires_at, ip) VALUES (" . intval($persona->idpersona) . ", '" . $conexion->real_escape_string($token_hash) . "', NOW(), DATE_ADD(NOW(), INTERVAL 24 HOUR), " . ($ip ? ("'" . $conexion->real_escape_string($ip) . "'") : 'NULL') . ")");
      $verifyUrl = _get_base_url() . "/UsuarioAjax.php?op=verificarEmail&t=" . urlencode($token);
      $ok = _send_verification_email($persona->str_email, $verifyUrl);
      if ($ok) {
         echo json_encode(['status' => 'success', 'mensaje' => 'Enlace enviado. Revisa tu correo.']);
      } else {
         $err = isset($GLOBALS['__MAIL_LAST_ERROR']) ? $GLOBALS['__MAIL_LAST_ERROR'] : null;
         echo json_encode(['status' => 'error', 'mensaje' => 'No se pudo enviar el correo', 'debug_url' => $verifyUrl, 'error' => $err]);
      }
      break;

   case 'verificarEmail':
      global $conexion;
      $token = isset($_GET['t']) ? trim($_GET['t']) : '';
      if (!$token) {
         echo "<html><body><h3>Token inválido</h3></body></html>";
         break;
      }
      _ensure_email_verify_table($conexion);
      $token_hash = hash('sha256', $token);
      $sql = "SELECT id, idpersona, expires_at, used_at FROM tbl_email_verificacion WHERE token_hash='" . $conexion->real_escape_string($token_hash) . "' LIMIT 1";
      $q = $conexion->query($sql);
      $row = $q ? $q->fetch_object() : null;
      if (!$row) {
         echo "<html><body><h3>Enlace inválido</h3></body></html>";
         break;
      }
      if (!empty($row->used_at)) {
         echo "<html><body><h3>Este enlace ya fue utilizado</h3><a href='../acceder.php'>Volver</a></body></html>";
         break;
      }
      if (strtotime($row->expires_at) < time()) {
         echo "<html><body><h3>El enlace ha expirado</h3><a href='../acceder.php'>Volver</a></body></html>";
         break;
      }
      $conexion->query("UPDATE tbl_persona SET str_email_verificado='1' WHERE idpersona=" . intval($row->idpersona));
      $conexion->query("UPDATE tbl_email_verificacion SET used_at=NOW() WHERE id=" . intval($row->id));
      echo "<html><meta http-equiv='refresh' content='1;url=../acceder.php'><body><h3>Correo verificado correctamente</h3><p>Redirigiendo…</p></body></html>";
      break;

   case 'marcarEmailVerificado':
      // Marca el email del usuario actual como verificado (str_email_verificado = '1')
      if (empty($_SESSION['idusuario']) || empty($_SESSION['idglobal'])) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Sesión inválida']);
         break;
      }
      $idusuario = intval($_SESSION['idusuario']);
      $idglobal = intval($_SESSION['idglobal']);
      global $conexion;
      if (!$conexion) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Sin conexión a BD']);
         break;
      }
      $sql = "SELECT p.idpersona
              FROM tbl_usuario u INNER JOIN tbl_persona p ON p.idpersona = u.idpersona
              WHERE u.idusuario = $idusuario AND u.idglobal = $idglobal LIMIT 1";
      $q = $conexion->query($sql);
      $r = $q ? $q->fetch_object() : null;
      if (!$r || empty($r->idpersona)) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Persona no encontrada']);
         break;
      }
      $upd = $conexion->query("UPDATE tbl_persona SET str_email_verificado='1' WHERE idpersona=" . intval($r->idpersona));
      if ($upd) {
         echo json_encode(['status' => 'success', 'mensaje' => 'Email verificado']);
      } else {
         echo json_encode(['status' => 'error', 'mensaje' => 'No se pudo actualizar']);
      }
      break;

   case 'datosPersonaActual':
      global $conexion;
      $idpersona = _resolve_persona_actual($conexion);
      if ($idpersona <= 0) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Persona no encontrada']);
         break;
      }

      $persona = _obtener_datos_persona_actual($conexion, $idpersona);
      if (!$persona) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Persona no encontrada']);
         break;
      }

      echo json_encode(['status' => 'success', 'data' => $persona]);
      break;

   case 'actualizarDatosPersonaActual':
      global $conexion;
      $idglobal = intval($_SESSION['idglobal'] ?? 0);
      $idpersona = _resolve_persona_actual($conexion);
      if ($idglobal <= 0 || $idpersona <= 0) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Sesión inválida']);
         break;
      }

      $email = trim(limpiar_cadena2($_POST['email'] ?? ''));
      $telefono = trim(limpiar_cadena($_POST['telefono'] ?? ''));
      $departamento = trim(limpiar_cadena($_POST['departamento'] ?? ''));
      $ciudad = trim(limpiar_cadena($_POST['ciudad'] ?? ''));
      $barrio = trim(limpiar_cadena($_POST['barrio'] ?? ''));
      $direccion = trim(limpiar_cadena2($_POST['direccion'] ?? ''));
      $dt = date('Y-m-d H:i:s');

      $personaActual = _obtener_datos_persona_actual($conexion, $idpersona);
      if (!$personaActual) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Persona no encontrada']);
         break;
      }

      if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Email inválido']);
         break;
      }

      if ($email !== '') {
         $sqlExiste = "SELECT idpersona FROM tbl_persona WHERE idglobal=" . $idglobal . " AND str_email='" . $conexion->real_escape_string($email) . "' AND idpersona<>" . $idpersona . " LIMIT 1";
         $qExiste = $conexion->query($sqlExiste);
         $rExiste = $qExiste ? $qExiste->fetch_object() : null;
         if (!empty($rExiste->idpersona)) {
            echo json_encode(['status' => 'error', 'mensaje' => 'Este email ya existe']);
            break;
         }
      }

      $camposExtra = '';
      if (strcasecmp(trim((string)($personaActual->email ?? '')), $email) !== 0) {
         $camposExtra = ", str_email_verificado='0'";
      }

      $sqlUpdate = "UPDATE tbl_persona SET
            str_email='" . $conexion->real_escape_string($email) . "',
            str_telefono='" . $conexion->real_escape_string($telefono) . "',
            str_direccion_departamento='" . $conexion->real_escape_string($departamento) . "',
            str_direccion_ciudad='" . $conexion->real_escape_string($ciudad) . "',
            str_direccion_barrio='" . $conexion->real_escape_string($barrio) . "',
            str_direccion_calle='" . $conexion->real_escape_string($direccion) . "',
            update_at='" . $conexion->real_escape_string($dt) . "'" . $camposExtra . "
         WHERE idpersona=" . $idpersona;

      if (!$conexion->query($sqlUpdate)) {
         echo json_encode(['status' => 'error', 'mensaje' => 'No fue posible actualizar la persona']);
         break;
      }

      $personaActualizada = _obtener_datos_persona_actual($conexion, $idpersona);
      echo json_encode([
         'status' => 'success',
         'mensaje' => 'Datos actualizados correctamente',
         'data' => $personaActualizada
      ]);
      break;

   case 'cambiarPasswordActual':
      try {
         global $conexion;
         if (!$conexion) {
            echo json_encode(['status' => 'error', 'mensaje' => 'Sin conexión a BD']);
            break;
         }

         $idusuario = intval($_SESSION['idusuario'] ?? 0);
         $idglobal = intval($_SESSION['idglobal'] ?? 0);
         if ($idusuario <= 0 || $idglobal <= 0) {
            echo json_encode(['status' => 'error', 'mensaje' => 'Sesión inválida']);
            break;
         }

         $actual = trim(limpiar_cadena2($_POST['password_actual'] ?? ''));
         $nueva = trim(limpiar_cadena2($_POST['password_nueva'] ?? ''));
         $confirmacion = trim(limpiar_cadena2($_POST['password_confirmacion'] ?? ''));

         if ($actual === '' || $nueva === '' || $confirmacion === '') {
            echo json_encode(['status' => 'error', 'mensaje' => 'Todos los campos son obligatorios']);
            break;
         }

         if (strlen($nueva) < 6) {
            echo json_encode(['status' => 'error', 'mensaje' => 'La nueva clave debe tener al menos 6 caracteres']);
            break;
         }

         if ($nueva !== $confirmacion) {
            echo json_encode(['status' => 'error', 'mensaje' => 'La confirmación no coincide']);
            break;
         }

         $usuario = _get_usuario_actual($conexion, $idusuario, $idglobal);
         if (!$usuario) {
            echo json_encode(['status' => 'error', 'mensaje' => 'Usuario no encontrado']);
            break;
         }

         if (md5($actual) !== (string)$usuario->str_password) {
            echo json_encode(['status' => 'error', 'mensaje' => 'La clave actual no es correcta']);
            break;
         }

         if ($actual === $nueva) {
            echo json_encode(['status' => 'error', 'mensaje' => 'La nueva clave no puede ser igual a la actual']);
            break;
         }

         $sqlUpdatePass = "UPDATE tbl_usuario
                        SET str_password='" . $conexion->real_escape_string(md5($nueva)) . "'
                        WHERE idusuario=" . intval($idusuario) . " AND idglobal=" . intval($idglobal) . "
                        LIMIT 1";

         if (!$conexion->query($sqlUpdatePass)) {
            echo json_encode(['status' => 'error', 'mensaje' => 'No fue posible actualizar la clave']);
            break;
         }

         echo json_encode(['status' => 'success', 'mensaje' => 'Clave actualizada correctamente']);
      } catch (Throwable $e) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Error interno al cambiar clave', 'debug' => $e->getMessage()]);
      }
      break;

   case 'resetPasswordPorCorreo':
      try {
         global $conexion;
         if (!$conexion) {
            echo json_encode(['status' => 'error', 'mensaje' => 'Sin conexión a BD']);
            break;
         }

         $idusuario = intval($_SESSION['idusuario'] ?? 0);
         $idglobal = intval($_SESSION['idglobal'] ?? 0);
         if ($idusuario <= 0 || $idglobal <= 0) {
            echo json_encode(['status' => 'error', 'mensaje' => 'Sesión inválida']);
            break;
         }

         $usuario = _get_usuario_actual($conexion, $idusuario, $idglobal);
         if (!$usuario || empty($usuario->str_email)) {
            echo json_encode(['status' => 'error', 'mensaje' => 'No hay correo registrado para recuperar la clave']);
            break;
         }

         if (!filter_var($usuario->str_email, FILTER_VALIDATE_EMAIL)) {
            echo json_encode(['status' => 'error', 'mensaje' => 'El correo registrado no es válido']);
            break;
         }

         $temporal = _generate_temp_password(10);
         $sqlUpdateTmp = "UPDATE tbl_usuario
                       SET str_password='" . $conexion->real_escape_string(md5($temporal)) . "'
                       WHERE idusuario=" . intval($idusuario) . " AND idglobal=" . intval($idglobal) . "
                       LIMIT 1";

         if (!$conexion->query($sqlUpdateTmp)) {
            echo json_encode(['status' => 'error', 'mensaje' => 'No fue posible generar una nueva clave']);
            break;
         }

         $nombreSistema = isset($infoSistemaCuentas['name']) ? $infoSistemaCuentas['name'] : 'Sistema';
         $usuarioTexto = !empty($usuario->str_user_name) ? $usuario->str_user_name : 'usuario';
         $subject = 'Recuperación de clave';
         $html = "<html><body style='font-family:Arial,sans-serif'>"
            . "<h2>Recuperación de clave</h2>"
            . "<p>Hola, se generó una clave temporal para tu acceso a " . htmlspecialchars($nombreSistema, ENT_QUOTES, 'UTF-8') . ".</p>"
            . "<p><b>Usuario:</b> " . htmlspecialchars($usuarioTexto, ENT_QUOTES, 'UTF-8') . "</p>"
            . "<p><b>Clave temporal:</b> " . htmlspecialchars($temporal, ENT_QUOTES, 'UTF-8') . "</p>"
            . "<p>Te recomendamos cambiarla apenas ingreses.</p>"
            . "</body></html>";
         $text = "Recuperación de clave\n\nUsuario: " . $usuarioTexto . "\nClave temporal: " . $temporal . "\n\nTe recomendamos cambiarla apenas ingreses.";

         $ok = _send_mail_generic($usuario->str_email, $subject, $html, $text);
         if (!$ok) {
            $err = isset($GLOBALS['__MAIL_LAST_ERROR']) ? $GLOBALS['__MAIL_LAST_ERROR'] : null;
            echo json_encode(['status' => 'error', 'mensaje' => 'No se pudo enviar el correo', 'error' => $err]);
            break;
         }

         echo json_encode(['status' => 'success', 'mensaje' => 'Se envió una clave temporal a tu correo']);
      } catch (Throwable $e) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Error interno al restablecer clave', 'debug' => $e->getMessage()]);
      }
      break;
}
