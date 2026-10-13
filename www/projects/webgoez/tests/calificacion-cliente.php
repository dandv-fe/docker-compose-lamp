<?php
if (getenv('RUN_CUSTOMER_RATING_TESTS') !== '1') {
   throw new RuntimeException('Set RUN_CUSTOMER_RATING_TESTS=1 to run isolated temporary table tests.');
}
require_once __DIR__ . '/../model/CalificacionCliente.php';
function ratingAssert(bool $condition, string $message): void
{
   if (!$condition) throw new RuntimeException($message);
}
function ratingReject(callable $run, int $expected): void
{
   try {
      $run();
   } catch (RuntimeException $error) {
      ratingAssert($error->getCode() === $expected, 'Unexpected rejection: ' . $error->getMessage());
      return;
   }
   throw new RuntimeException('Expected request rejection.');
}
try {
   foreach ([
      'view_usuario_session' => 'idusuario INT,idglobal INT,idempleado INT,str_cargo VARCHAR(30),
         estado_usuario VARCHAR(20),estado_empleado VARCHAR(20)',
      'tbl_oficina' => 'idoficina INT,idglobal INT,idempleado_administrador INT',
      'tbl_sucursal' => 'idsucursal INT,idglobal INT,idoficina INT',
      'tbl_auth_sucursal' => 'idsucursal INT,idglobal INT,idempleado INT,str_estado VARCHAR(20)',
      'tbl_clientes' => 'idcliente INT,idglobal INT,str_calificacion VARCHAR(50),update_at DATETIME',
      'tbl_tarjetas' => 'idtarjeta VARCHAR(50),idcliente INT,idsucursal INT,idglobal INT',
      'tbl_descripcion_global' => 'idglobal_accion INT,str_estado VARCHAR(20),date_corte DATE,int_dias_extras INT',
      'mobile_customer_rating_history' => 'id BIGINT AUTO_INCREMENT PRIMARY KEY,idglobal INT,idcliente INT,
         idsucursal INT,score TINYINT,previous_score TINYINT,reason VARCHAR(500),source VARCHAR(20),
         created_by INT,created_at DATETIME(3)',
      'mobile_customer_rating_state' => 'idglobal INT,idcliente INT,automatic_score TINYINT NOT NULL,
         manual_score TINYINT NULL,manual_until DATETIME(3) NULL,evaluated_at DATETIME(3) NULL,
         confidence VARCHAR(16) NOT NULL,explanation VARCHAR(500) NOT NULL,metrics_json LONGTEXT,
         next_evaluation_at DATETIME(3) NULL,PRIMARY KEY(idglobal,idcliente)'
   ] as $table => $columns) $conexion->query("CREATE TEMPORARY TABLE $table ($columns)");
   $conexion->query("INSERT INTO view_usuario_session VALUES
      (1,7,11,'Super Administrador','activo','activo'),(2,7,12,'Empleado','activo','activo'),
      (3,7,13,'Administrador','activo','activo'),(4,8,14,'Super Administrador','activo','activo'),
      (5,7,15,'Empleado','activo','inactivo')");
   $conexion->query('INSERT INTO tbl_oficina VALUES (1,7,13),(2,7,99),(3,8,14)');
   $conexion->query('INSERT INTO tbl_sucursal VALUES (10,7,1),(20,7,2),(30,8,3)');
   $conexion->query("INSERT INTO tbl_auth_sucursal VALUES (10,7,12,'activo'),(20,7,12,'inactivo')");
   $conexion->query("INSERT INTO tbl_clientes VALUES (100,7,'nuevo',NULL),(200,7,'',NULL),(300,8,'9',NULL)");
   $conexion->query("INSERT INTO tbl_tarjetas VALUES ('A',100,10,7),('B',100,20,7),('C',300,30,8)");
   foreach ([null,'','nuevo','0','11','07','7.5',' 7 '] as $raw) {
      ratingAssert(notaCalificacionCliente($raw) === null, 'Invalid legacy value became a score.');
   }
   for ($score=1; $score<=10; $score++) {
      ratingAssert(notaCalificacionCliente((string)$score) === $score, 'Valid score rejected.');
   }
   ratingAssert(etiquetaCalificacionCliente(9) === 'Excelente' &&
      etiquetaCalificacionCliente(7) === 'Bueno' && etiquetaCalificacionCliente(5) === 'Regular' &&
      etiquetaCalificacionCliente(1) === 'Requiere seguimiento', 'Category thresholds differ.');
   $admin = contextoCalificacionCliente($conexion, ['idusuario'=>1], 10, 'A');
   $office = contextoCalificacionCliente($conexion, ['idusuario'=>3], 10, 'A');
   $employee = contextoCalificacionCliente($conexion, ['idusuario'=>2,'userEmpresa'=>7], 10, 'A');
   $initial = consultarCalificacionCliente($conexion, $employee);
   ratingAssert($initial['score'] === 5 && $initial['automaticScore'] === 5 &&
      $initial['source'] === 'automatic' && $initial['confidence'] === 'initial' &&
      $initial['label'] === 'Inicial · poca historia' && $initial['evaluatedAt'] === null,
      'Missing evaluation must be identified as a neutral initial reference, not as real evidence.');
   $conexion->query("UPDATE tbl_clientes SET str_calificacion='8' WHERE idglobal=7 AND idcliente=100");
   $oldManual = consultarCalificacionCliente($conexion, $employee);
   ratingAssert($oldManual['score'] === 8 && $oldManual['source'] === 'manual' &&
      $oldManual['automaticScore'] === 5 && $oldManual['manualUntil'] === null &&
      $oldManual['label'] === 'Bueno', 'Pre-014 numeric manual rating must remain visible without invented expiry.');
   $conexion->query("UPDATE tbl_clientes SET str_calificacion='nuevo' WHERE idglobal=7 AND idcliente=100");
   $conexion->query("INSERT INTO mobile_customer_rating_state
      (idglobal,idcliente,automatic_score,confidence,explanation,metrics_json,evaluated_at)
      VALUES (7,100,7,'limited','Puntualidad y constancia con evidencia limitada.','{}',UTC_TIMESTAMP(3))");
   $automatic = consultarCalificacionCliente($conexion, $employee);
   ratingAssert($automatic['score'] === 7 && $automatic['source'] === 'automatic' &&
      $automatic['confidence'] === 'limited' && $automatic['evaluatedAt'] !== null,
      'Persisted automatic assessment must be visible before a manual note exists.');
   ratingAssert($admin['canRate'] && $office['canRate'] && !$employee['canRate'],
      'Fresh role and actual office administrator must govern permission, not session flag.');
   ratingReject(fn()=>contextoCalificacionCliente($conexion, ['idusuario'=>4], 10, 'A'), 403);
   ratingReject(fn()=>contextoCalificacionCliente($conexion, ['idusuario'=>3], 20, 'B'), 403);
   ratingReject(fn()=>contextoCalificacionCliente($conexion, ['idusuario'=>2], 20, 'B'), 403);
   ratingReject(fn()=>contextoCalificacionCliente($conexion, ['idusuario'=>5], 10, 'A'), 403);
   ratingReject(fn()=>contextoCalificacionCliente($conexion, [], 10, 'A'), 401);
   ratingReject(fn()=>contextoCalificacionCliente($conexion, ['idusuario'=>1], 10, 'C'), 404);
   foreach ([[0,'Motivo válido','nuevo'],[11,'Motivo válido','nuevo'],[7,'cort','nuevo'],
      [7,str_repeat('a',501),'nuevo'],[7,'  x  ','nuevo'],['1.5','Motivo válido','nuevo']] as [$score,$reason,$expected]) {
      ratingReject(fn()=>validarCambioCalificacionCliente($score,$reason,$expected), 422);
   }
   ratingReject(fn()=>guardarCalificacionCliente($conexion,$employee,8,'Cumplimiento puntual','nuevo'),403);
   $result = guardarCalificacionCliente($conexion,$office,8,'  Cumplimiento puntual  ','nuevo');
   ratingAssert($result['score'] === 8 && $result['label'] === 'Bueno' && count($result['history']) === 1,
      'Rating/audit missing after manual update.');
   ratingAssert($result['history'][0]['previousScore'] === null &&
      $result['history'][0]['createdBy'] === 3 && $result['history'][0]['reason'] === 'Cumplimiento puntual',
      'Incorrect audit actor, previous score or trimmed reason.');
   ratingAssert($result['source'] === 'manual' && $result['automaticScore'] === 7 &&
      $result['manualUntil'] !== null && $result['confidence'] === 'limited',
      'Manual note must retain automatic evaluation and expose its temporary priority.');
   $window = db_fetch_object($conexion,
      'SELECT TIMESTAMPDIFF(SECOND,UTC_TIMESTAMP(3),manual_until) AS remaining
       FROM mobile_customer_rating_state WHERE idglobal=7 AND idcliente=100');
   ratingAssert((int)$window->remaining >= 604795 && (int)$window->remaining <= 604800,
      'Manual priority must be exactly seven days, not until the next calculation.');
   $conexion->query("UPDATE mobile_customer_rating_state SET automatic_score=6,
      explanation='La evaluación continúa aunque la nota manual tenga prioridad.'
      WHERE idglobal=7 AND idcliente=100");
   $underManual = consultarCalificacionCliente($conexion, $employee);
   ratingAssert($underManual['score'] === 8 && $underManual['automaticScore'] === 6,
      'Ongoing calculation must not overwrite an unexpired manual score.');
   $conexion->query("UPDATE mobile_customer_rating_state SET manual_until=UTC_TIMESTAMP(3)
      WHERE idglobal=7 AND idcliente=100");
   $expired = consultarCalificacionCliente($conexion, $employee);
   ratingAssert($expired['score'] === 6 && $expired['source'] === 'automatic' &&
      $expired['manualUntil'] === null && $expired['rawRating'] === '8',
      'Expired manual priority must expose the automatic score even before the next worker tick.');
   ratingReject(fn()=>guardarCalificacionCliente($conexion,$admin,9,'Otra revisión puntual','nuevo'),409);
   ratingAssert(count(consultarCalificacionCliente($conexion,$admin)['history']) === 1,
      'Conflict inserted an audit or overwrote rating.');
   $result = guardarCalificacionCliente($conexion,$admin,9,'Nueva evaluación puntual','8');
   ratingAssert($result['history'][0]['previousScore'] === 8 && $result['score'] === 9,
      'Successive updates must retain previous score.');
   $otherBranch = contextoCalificacionCliente($conexion, ['idusuario'=>1],20,'B');
   ratingAssert(consultarCalificacionCliente($conexion,$otherBranch)['score'] === 9,
      'Customer score must be shared across own cards, not separate per branch.');
   for($i=0;$i<21;$i++) guardarCalificacionCliente($conexion,$admin,9,'Revisión de cumplimiento '.$i,'9');
   ratingAssert(count(consultarCalificacionCliente($conexion,$employee)['history']) === 20,
      'History must be bounded and visible to authorized readers.');
   $conexion->query("INSERT INTO tbl_descripcion_global VALUES (7,'actual','2000-01-01',10)");
   ratingReject(fn()=>contextoCalificacionCliente($conexion,['idusuario'=>1],10,'A'),403);
   $conexion->query('DELETE FROM tbl_descripcion_global');
   session_id('rating-test-' . bin2hex(random_bytes(8)));
   session_start();
   $_SESSION = ['idusuario'=>3];
   session_write_close();
   $_SERVER['REQUEST_METHOD'] = 'GET';
   $_GET = ['idtarjeta'=>'A','idsucursal'=>10];
   ob_start();
   include __DIR__ . '/../ajax/CalificacionClienteAjax.php';
   $payload = json_decode(ob_get_clean(), true, 512, JSON_THROW_ON_ERROR);
   ratingAssert($payload['score'] === 9 && $payload['canRate'] === true && is_string($payload['csrf']),
      'Read endpoint did not supply current rating and CSRF token.');
   $token = $payload['csrf'];
   foreach ([
      [['score'=>7,'reason'=>'Evaluación actualizada','expectedRating'=>'9','csrf'=>'forged'],403],
      [['score'=>11,'reason'=>'Evaluación actualizada','expectedRating'=>'9','csrf'=>$token],422],
      [['score'=>7,'reason'=>'Evaluación actualizada','expectedRating'=>'nuevo','csrf'=>$token],409],
      [['score'=>7,'reason'=>'Evaluación actualizada','expectedRating'=>'9','csrf'=>$token],200]
   ] as [$input,$status]) {
      $_SERVER['REQUEST_METHOD'] = 'POST';
      $_POST = array_merge(['idtarjeta'=>'A','idsucursal'=>10],$input);
      http_response_code(200);
      ob_start();
      include __DIR__ . '/../ajax/CalificacionClienteAjax.php';
      $payload = json_decode(ob_get_clean(), true, 512, JSON_THROW_ON_ERROR);
      ratingAssert(http_response_code() === $status &&
         ($status === 200 ? $payload['score'] === 7 : isset($payload['error'])),
         'Endpoint validation, CSRF, concurrency or success response failed.');
   }
   session_start();
   session_destroy();
   echo "OK: score boundaries, fresh permissions, company/office/card isolation, audit, concurrency,\n";
   echo "shared customer score, 20-history limit, service expiry and endpoint CSRF/errors.\n";
   echo "OK: initial reference, automatic explanation, continuing evaluation and exact seven-day manual priority.\n";
} finally {
   $conexion->close();
}
