<?php
require_once __DIR__ . '/Conexion.php';

function notaCalificacionCliente(?string $raw): ?int
{
   return $raw !== null && preg_match('/^(?:[1-9]|10)$/D', $raw) ? (int)$raw : null;
}

function etiquetaCalificacionCliente(?int $score): string
{
   if ($score === null) return 'Inicial · poca historia';
   if ($score >= 9) return 'Excelente';
   if ($score >= 7) return 'Bueno';
   if ($score >= 5) return 'Regular';
   return 'Requiere seguimiento';
}

function contextoCalificacionCliente(mysqli $conexion, array $sesion, int $branch, string $card): array
{
   $user = (int)($sesion['idusuario'] ?? 0);
   if ($user <= 0) throw new RuntimeException('Inicie sesión para consultar la calificación.', 401);
   if ($branch <= 0 || trim($card) === '' || strlen($card) > 50) {
      throw new RuntimeException('Seleccione una tarjeta válida.', 422);
   }
   $identity = db_fetch_object($conexion,
      'SELECT idglobal, idempleado, str_cargo, estado_usuario, estado_empleado
       FROM view_usuario_session WHERE idusuario=? LIMIT 1', 'i', [$user]);
   if (!$identity || (int)$identity->idempleado <= 0 ||
       $identity->estado_usuario === 'inactivo' || $identity->estado_empleado === 'inactivo') {
      throw new RuntimeException('Su usuario no tiene acceso a esta consulta.', 403);
   }
   $company = (int)$identity->idglobal;
   $employee = (int)$identity->idempleado;
   $scope = db_fetch_object($conexion,
      "SELECT s.idsucursal, o.idempleado_administrador,
         EXISTS (SELECT 1 FROM tbl_auth_sucursal a
            WHERE a.idsucursal=s.idsucursal AND a.idglobal=s.idglobal
              AND a.idempleado=? AND a.str_estado<>'inactivo') AS authorized
       FROM tbl_sucursal s JOIN tbl_oficina o ON o.idoficina=s.idoficina AND o.idglobal=s.idglobal
       WHERE s.idsucursal=? AND s.idglobal=? LIMIT 1", 'iii', [$employee, $branch, $company]);
   $canRate = $identity->str_cargo === 'Super Administrador' ||
      ($scope && (int)$scope->idempleado_administrador === $employee);
   if (!$scope || (!$canRate && !(bool)$scope->authorized)) {
      throw new RuntimeException('No tiene acceso a esta sucursal.', 403);
   }
   $customer = db_fetch_object($conexion,
      'SELECT c.idcliente FROM tbl_tarjetas t
       JOIN tbl_clientes c ON c.idcliente=t.idcliente AND c.idglobal=t.idglobal
       WHERE t.idtarjeta=? AND t.idsucursal=? AND t.idglobal=? LIMIT 1', 'sii',
      [$card, $branch, $company]);
   if (!$customer) throw new RuntimeException('La tarjeta no pertenece a esta empresa y sucursal.', 404);
   $payment = db_fetch_object($conexion,
      "SELECT date_corte,int_dias_extras FROM tbl_descripcion_global
       WHERE idglobal_accion=? AND str_estado='actual' LIMIT 1", 'i', [$company]);
   if ($payment && $payment->date_corte &&
       (int)(new DateTimeImmutable())->diff(new DateTimeImmutable($payment->date_corte))->format('%r%a') +
          (int)$payment->int_dias_extras < 0) {
      throw new RuntimeException('El servicio está vencido. Revise el pago de la plataforma.', 403);
   }
   return ['company' => $company, 'customer' => (int)$customer->idcliente,
      'branch' => $branch, 'user' => $user, 'canRate' => $canRate];
}

function consultarCalificacionCliente(mysqli $conexion, array $context): array
{
   $customer = db_fetch_object($conexion,
      "SELECT COALESCE(c.str_calificacion,'') AS rating, s.idcliente AS state_customer,
         s.automatic_score, s.manual_score,
         s.manual_until, s.evaluated_at, s.confidence, s.explanation,
         (s.manual_score IS NOT NULL AND s.manual_until > UTC_TIMESTAMP(3)) AS manual_active
       FROM tbl_clientes c LEFT JOIN mobile_customer_rating_state s
         ON s.idglobal=c.idglobal AND s.idcliente=c.idcliente
       WHERE c.idglobal=? AND c.idcliente=?",
      'ii', [$context['company'], $context['customer']]);
   if (!$customer) throw new RuntimeException('El cliente ya no está disponible.', 404);
   $stmt = db_prepare_execute($conexion,
      'SELECT CAST(id AS CHAR) AS id, score, previous_score AS previousScore, reason, source,
         created_by AS createdBy, created_at AS createdAt
       FROM mobile_customer_rating_history WHERE idglobal=? AND idcliente=?
       ORDER BY id DESC LIMIT 20', 'ii', [$context['company'], $context['customer']]);
   try {
      $history = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
   } finally {
      $stmt->close();
   }
   foreach ($history as &$entry) {
      $entry['score'] = $entry['score'] === null ? null : (int)$entry['score'];
      $entry['previousScore'] = $entry['previousScore'] === null ? null : (int)$entry['previousScore'];
      $entry['createdBy'] = (int)$entry['createdBy'];
      $entry['createdAt'] = str_replace(' ', 'T', $entry['createdAt']) . 'Z';
   }
   unset($entry);
   $legacyScore = notaCalificacionCliente($customer->rating);
   if ($customer->automatic_score === null && $legacyScore === null &&
       !in_array($customer->rating, ['', 'nuevo'], true)) {
      throw new RuntimeException('La calificación guardada contiene un valor inválido.');
   }
   $automaticScore = $customer->automatic_score === null ? 5 : (int)$customer->automatic_score;
   $confidence = $customer->confidence ?? 'initial';
   if ($automaticScore < 1 || $automaticScore > 10 ||
       !in_array($confidence, ['initial', 'limited', 'established'], true)) {
      throw new RuntimeException('El estado de evaluación automática es inválido.');
   }
   if ($customer->evaluated_at === null) {
      $automaticScore = 5;
      $confidence = 'initial';
   }
   $manual = (bool)$customer->manual_active;
   $score = $manual ? (int)$customer->manual_score : $automaticScore;
   $manualUntil = $manual ? $customer->manual_until : null;
   if ($customer->state_customer === null && $legacyScore !== null) {
      $previousManual = db_fetch_object($conexion,
         "SELECT score, DATE_ADD(created_at,INTERVAL 7 DAY) AS manual_until,
            (DATE_ADD(created_at,INTERVAL 7 DAY) > UTC_TIMESTAMP(3)) AS active
          FROM mobile_customer_rating_history
          WHERE idglobal=? AND idcliente=? AND source='manual' ORDER BY id DESC LIMIT 1",
         'ii', [$context['company'], $context['customer']]);
      $score = $legacyScore;
      $manual = true;
      $manualUntil = $previousManual && (int)$previousManual->score === $legacyScore &&
         (bool)$previousManual->active ? $previousManual->manual_until : null;
   }
   if ($score < 1 || $score > 10) throw new RuntimeException('La nota vigente es inválida.');
   $explanation = $customer->explanation ??
      'Nota inicial neutral de 5/10. La evaluación matemática de pagos y tarjetas está pendiente.';
   if ($customer->evaluated_at === null) {
      $explanation = $manual ? 'Nota manual; evaluación matemática pendiente.'
         : 'Nota inicial neutral de 5/10. La evaluación matemática de pagos y tarjetas está pendiente.';
   } elseif (trim($explanation) === '') {
      throw new RuntimeException('La evaluación automática no contiene una explicación.');
   }
   return ['customerId' => $context['customer'], 'rawRating' => $customer->rating, 'score' => $score,
      'label' => !$manual && $confidence === 'initial' ? 'Inicial · poca historia' : etiquetaCalificacionCliente($score),
      'automaticScore' => $automaticScore, 'source' => $manual ? 'manual' : 'automatic',
      'manualUntil' => $manualUntil === null ? null : str_replace(' ', 'T', $manualUntil) . 'Z',
      'evaluatedAt' => $customer->evaluated_at === null
         ? null : str_replace(' ', 'T', $customer->evaluated_at) . 'Z',
      'confidence' => $confidence, 'explanation' => $explanation,
      'canRate' => $context['canRate'], 'history' => $history];
}

function validarCambioCalificacionCliente($score, $reason, $expected): array
{
   $number = filter_var($score, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 10]]);
   if ($number === false || !is_string($reason) || !is_string($expected)) {
      throw new RuntimeException('Indique una nota entera de 1 a 10 y un motivo válido.', 422);
   }
   $reason = trim($reason);
   $length = mb_strlen($reason, 'UTF-8');
   if ($length < 5 || $length > 500 || mb_strlen($expected, 'UTF-8') > 50) {
      throw new RuntimeException('El motivo debe tener entre 5 y 500 caracteres.', 422);
   }
   return [$number, $reason, $expected];
}

function guardarCalificacionCliente(mysqli $conexion, array $context, int $score, string $reason, string $expected): array
{
   [$score, $reason, $expected] = validarCambioCalificacionCliente($score, $reason, $expected);
   if (!$context['canRate']) {
      throw new RuntimeException('Solo el Super Administrador o administrador de esta oficina puede calificar.', 403);
   }
   $conexion->begin_transaction();
   try {
      $customer = db_fetch_object($conexion,
         "SELECT COALESCE(str_calificacion,'') AS rating FROM tbl_clientes
          WHERE idglobal=? AND idcliente=? FOR UPDATE", 'ii', [$context['company'], $context['customer']]);
      if (!$customer) throw new RuntimeException('El cliente ya no está disponible.', 404);
      if ($customer->rating !== $expected) {
         throw new RuntimeException('La calificación cambió desde que abrió el editor. Cierre y vuelva a abrir para revisar la nota actual.', 409);
      }
      db_execute($conexion,
         "INSERT INTO mobile_customer_rating_history
          (idglobal,idcliente,idsucursal,score,previous_score,reason,source,created_by,created_at)
          VALUES (?,?,?,?,?,?,'manual',?,UTC_TIMESTAMP(3))", 'iiiiisi',
         [$context['company'], $context['customer'], $context['branch'], $score,
            notaCalificacionCliente($customer->rating), $reason, $context['user']]);
      db_execute($conexion,
         "INSERT INTO mobile_customer_rating_state
            (idglobal,idcliente,automatic_score,manual_score,manual_until,confidence,explanation,
             metrics_json,next_evaluation_at)
          VALUES (?,?,5,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 7 DAY),'initial',
             'Nota inicial neutral de 5/10. Evaluación matemática pendiente.','{}',UTC_TIMESTAMP(3))
          ON DUPLICATE KEY UPDATE manual_score=VALUES(manual_score),manual_until=VALUES(manual_until),
             next_evaluation_at=UTC_TIMESTAMP(3)", 'iii',
         [$context['company'], $context['customer'], $score]);
      db_execute($conexion,
         'UPDATE tbl_clientes SET str_calificacion=?, update_at=NOW() WHERE idglobal=? AND idcliente=?',
         'sii', [(string)$score, $context['company'], $context['customer']]);
      $result = consultarCalificacionCliente($conexion, $context);
      $conexion->commit();
      return $result;
   } catch (Throwable $error) {
      $conexion->rollback();
      throw $error;
   }
}
