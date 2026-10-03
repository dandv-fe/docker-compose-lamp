<?php
session_start();
require_once "../method.php";
require_once "../model/MainAccountCorriente.php";

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

function _send_retiro_code_email($toEmail, $codigo, $venceEn, $monto, $idCuenta)
{
   global $MAIL_CONFIG;
   $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
   $subject = 'Código temporal de retiro';
   $montoFmt = '$' . number_format(floatval($monto), 2, '.', ',');

   $html = "<html><body style='font-family:Arial,sans-serif'>" .
      "<h2>Código temporal de retiro</h2>" .
      "<p>Se ha generado un retiro temporal para la cuenta <strong>" . htmlspecialchars((string)$idCuenta, ENT_QUOTES, 'UTF-8') . "</strong>.</p>" .
      "<p><strong>Código:</strong> " . htmlspecialchars((string)$codigo, ENT_QUOTES, 'UTF-8') . "</p>" .
      "<p><strong>Monto:</strong> " . htmlspecialchars($montoFmt, ENT_QUOTES, 'UTF-8') . "</p>" .
      "<p><strong>Vence:</strong> " . htmlspecialchars((string)$venceEn, ENT_QUOTES, 'UTF-8') . "</p>" .
      "<p>Este código caduca en 30 minutos.</p>" .
      "</body></html>";

   $text = "Código temporal de retiro\n" .
      "Cuenta: " . $idCuenta . "\n" .
      "Código: " . $codigo . "\n" .
      "Monto: " . $montoFmt . "\n" .
      "Vence: " . $venceEn . "\n" .
      "Este código caduca en 30 minutos.";

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
   $fromEmail = $MAIL_CONFIG['from']      ?? (getenv('SMTP_FROM') ?: ('no-reply@' . $host));
   $fromName  = $MAIL_CONFIG['from_name'] ?? (getenv('SMTP_FROM_NAME') ?: 'No Reply');
   $headers[] = 'From: ' . $fromName . ' <' . $fromEmail . '>';
   $headers[] = 'X-Mailer: PHP/' . phpversion();

   $ok = @mail($toEmail, $subject, $html, implode("\r\n", $headers));
   if (!$ok) {
      $GLOBALS['__MAIL_LAST_ERROR'] = isset($GLOBALS['__MAIL_LAST_ERROR'])
         ? $GLOBALS['__MAIL_LAST_ERROR']
         : 'mail() fallo al enviar';
   }

   return $ok;
}

function _parse_money_input($value)
{
   if (is_null($value)) {
      return 0;
   }

   $raw = trim((string)$value);
   if ($raw === '') {
      return 0;
   }

   $raw = preg_replace('/\s+/', '', $raw);
   $raw = preg_replace('/[^\d,\.\-]/', '', $raw);

   if (strpos($raw, ',') !== false) {
      $raw = str_replace('.', '', $raw);
      $raw = str_replace(',', '.', $raw);
   } else {
      if (substr_count($raw, '.') > 1) {
         $raw = str_replace('.', '', $raw);
      } else {
         $parts = explode('.', $raw);
         if (count($parts) === 2 && strlen($parts[1]) === 3) {
            $raw = $parts[0] . $parts[1];
         }
      }
   }

   return is_numeric($raw) ? floatval($raw) : 0;
}

$objMainAccountCorrieneete = new MainAccountCorriente();
$idglobal = $_SESSION['idglobal'];
$superadmin = $_SESSION['userEmpresa'];
$idpersona = $_SESSION['idpersona'];
switch ($_GET['op']) {
   case 'goAccount':
      $query = $objMainAccountCorrieneete->goAccount($idglobal, $idpersona);
      echo json_encode($query->fetch_object());
      break;
   case 'buscarCuentaDestino':
      $id_cuenta = limpiar_cadena2($_REQUEST['id_cuenta'] ?? '');

      if (empty($idglobal) || empty($id_cuenta)) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Número de cuenta inválido']);
         break;
      }

      $query = $objMainAccountCorrieneete->buscarCuentaDestino($idglobal, $id_cuenta);
      $req = $query ? $query->fetch_object() : null;

      if (empty($req) || empty($req->nombres) || empty($req->apellidos)) {
         echo json_encode(['status' => 'error', 'mensaje' => 'La cuenta no existe']);
         break;
      }

      echo json_encode([
         'status' => 'success',
         'idahorro' => $req->idahorro,
         'idpersona' => $req->idpersona,
         'id_cuenta' => $req->id_cuenta,
         'nombres' => $req->nombres,
         'apellidos' => $req->apellidos
      ]);
      break;
   case 'resumenSaldos':
      if (empty($idglobal) || empty($idpersona)) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Sesión no válida']);
         break;
      }

      $resumen = $objMainAccountCorrieneete->obtenerResumenSaldos($idglobal, $idpersona);
      echo json_encode($resumen);
      break;
   case 'listMovimientos':
      $idahorro = intval($_REQUEST['idahorro'] ?? 0);

      if (empty($idglobal) || $idahorro <= 0) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Parámetros inválidos']);
         break;
      }

      $query = $objMainAccountCorrieneete->listarMovimientosPorAhorro($idglobal, $idahorro);
      $data = [];

      if ($query) {
         while ($row = $query->fetch_assoc()) {
            $data[] = $row;
         }
      }

      echo json_encode(['status' => 'success', 'data' => $data]);
      break;
   case 'retiroTemporalVigente':
      $idahorro = intval($_REQUEST['idahorro'] ?? 0);

      if (empty($idglobal) || $idahorro <= 0) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Parámetros inválidos']);
         break;
      }

      $vigente = $objMainAccountCorrieneete->obtenerRetiroTemporalVigente($idglobal, $idahorro);
      if (!$vigente) {
         echo json_encode(['status' => 'success', 'existe' => false]);
         break;
      }

      echo json_encode([
         'status' => 'success',
         'existe' => true,
         'codigo_temporal' => (string)$vigente->int_codigo,
         'vence_en' => (string)$vigente->vence_en,
         'monto' => floatval($vigente->monto ?? 0),
      ]);
      break;
   case 'tprincipal':
      if (empty($idglobal) || empty($superadmin)) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Permisos insuficientes']);
         break;
      }
      $objMainAccountCorrieneete->registrar($idglobal, $idpersona);
      break;
   case 'registrarMovimientosRA':
      $idahorro = limpiar_cadena($_POST['idahorroMovimiento'] ?? '');
      $tipo = limpiar_cadena($_POST['cboTipoMovimiento'] ?? '');
      $valor = _parse_money_input($_POST['txtValorMovimiento'] ?? 0);
      $descripcion = limpiar_cadena2($_POST['txtDescripcionMovimiento'] ?? '');

      if (empty($idahorro) || $valor <= 0 || !$tipo || !$descripcion) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Datos incompletos']);
         break;
      }

      $sql = "SELECT bit_auth_movimientos AS auth
               FROM tbl_ahorros
               WHERE idahorro=$idahorro AND idglobal=$idglobal";
      global $conexion;
      $q = $conexion->query($sql);
      $info = $q ? $q->fetch_object() : null;
      if (!$info) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Ahorro no encontrado']);
         break;
      }

      // Normalizar BIT(1) y valores string/numéricos
      $authRaw = $info->auth;
      if (is_string($authRaw)) {
         if ($authRaw === "\x01") {
            $authFlag = 1;
         } elseif ($authRaw === "\x00" || $authRaw === '') {
            $authFlag = 0;
         } else {
            $authFlag = intval(trim($authRaw));
         }
      } else {
         $authFlag = intval($authRaw);
      }

      if ($authFlag !== 1) {
         echo json_encode([
            'status' => 'error',
            'mensaje' => 'Movimientos no autorizados. Active "Autorizar Movimientos" en Configuración.'
         ]);
         break;
      }

      $tipo = strtolower(trim($tipo));
      if ($tipo !== 'retiro') {
         echo json_encode(['status' => 'error', 'mensaje' => 'En esta cuenta solo aplica retiro.']);
         break;
      }

      $resultado = $objMainAccountCorrieneete->registrarRetiroTemporal(
         $idglobal,
         intval($idahorro),
         intval($_SESSION['idusuario']),
         $valor,
         $descripcion
      );

      if (($resultado['status'] ?? 'error') === 'success') {
         $email = trim((string)($resultado['email'] ?? ''));
         $codigo = (string)($resultado['codigo_temporal'] ?? '');
         $venceEn = (string)($resultado['vence_en'] ?? '');
         $montoRetiro = floatval($resultado['monto'] ?? 0);
         $idCuenta = (string)($resultado['id_cuenta'] ?? '');

         if ($email === '' || $codigo === '' || !_send_retiro_code_email($email, $codigo, $venceEn, $montoRetiro, $idCuenta)) {
            echo json_encode([
               'status' => 'error',
               'mensaje' => 'Se generó el código, pero no se pudo enviar al email. Verifique la configuración SMTP.',
               'codigo_temporal' => $codigo,
               'vence_en' => $venceEn,
               'email_sent' => false
            ]);
            break;
         }
      }

      echo json_encode($resultado);
      break;

   case 'finalizarEnvioPrincipal':
      $idahorroOrigen = intval($_POST['idahorroOrigen'] ?? 0);
      $idahorroDestino = intval($_POST['idahorroDestino'] ?? 0);
      $monto = floatval($_POST['monto'] ?? 0);
      $descripcion = limpiar_cadena2($_POST['descripcion'] ?? '');

      if (empty($idglobal) || empty($_SESSION['idusuario'])) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Sesión no válida']);
         break;
      }

      if ($idahorroOrigen <= 0 || $idahorroDestino <= 0 || $monto <= 0 || $descripcion === '') {
         echo json_encode(['status' => 'error', 'mensaje' => 'Datos incompletos para finalizar el envío']);
         break;
      }

      $resultado = $objMainAccountCorrieneete->finalizarEnvioPrincipal(
         $idglobal,
         $idahorroOrigen,
         $idahorroDestino,
         intval($_SESSION['idusuario']),
         $monto,
         $descripcion
      );

      echo json_encode($resultado);
      break;
}
