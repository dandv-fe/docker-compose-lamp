<?php
// CLI only. Fixtures and migration are applied exclusively in this new database.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../model/NominaEmpleado.php';

function payrollAssert($condition, $message)
{
   if (!$condition) throw new RuntimeException('FAIL: ' . $message);
}

function payrollStatements($text)
{
   $delimiter = ';'; $buffer = ''; $result = [];
   foreach (explode("\n", $text) as $line) {
      if (strpos(trim($line), '--') === 0) continue;
      if (strpos($line, 'DELIMITER ') === 0) { $delimiter = trim(substr($line, 10)); continue; }
      $buffer .= $line . "\n";
      $trimmed = rtrim($buffer);
      if (substr($trimmed, -strlen($delimiter)) === $delimiter) {
         $result[] = trim(substr($trimmed, 0, -strlen($delimiter))); $buffer = '';
      }
   }
   if (trim($buffer)) throw new RuntimeException('Unterminated SQL');
   return $result;
}

$dbName = 'payroll_test_php_' . getmypid() . '_' . bin2hex(random_bytes(4));
$created = false;
try {
   $conexion->query("CREATE DATABASE `$dbName`");
   $created = true;
   $conexion->select_db($dbName);
   foreach (['tests/fixtures/employee-payroll.sql','migrations/015_employee_payroll.sql'] as $path) {
      $sql = file_get_contents(__DIR__ . '/../../backend-creditos-apk/' . $path);
      foreach (payrollStatements($sql) as $statement) $conexion->query($statement);
   }
   // Reapplying the manual migration is safe and preserves rows.
   foreach (payrollStatements(file_get_contents(__DIR__ . '/../../backend-creditos-apk/migrations/015_employee_payroll.sql')) as $statement) {
      $conexion->query($statement);
   }
   foreach (['tests/fixtures/payroll-016-legacy.sql', 'migrations/016_payroll_replacements_cash_bonus.sql'] as $path) {
      foreach (payrollStatements(file_get_contents(__DIR__ . '/../../backend-creditos-apk/' . $path)) as $statement) $conexion->query($statement);
   }
   $model = new NominaEmpleado($conexion);
   $conexion->query("INSERT INTO tbl_employee_payroll_contract
      (idglobal,employee_id,effective_date,salary_type,frequency,base_amount,capital_rate,collection_rate,actor_user_id)
      VALUES(1,3,'2026-01-01','Combinado','Mensual',100,10,20,1),(1,4,'2026-01-01','Porcentaje','Mensual',0,10,20,1)");
   $conexion->query("INSERT INTO tbl_detalle_ruta(iddetalleruta,idglobal,idsucursal,created_at) VALUES(1,1,1,'2026-02-01'),(2,1,2,'2026-02-02')");
   $model->snapshotDespacho(1,1); $model->snapshotDespacho(1,2); $model->snapshotDespacho(1,1);
   $conexion->query("INSERT INTO tbl_empleados_cobrando VALUES(3,1),(4,1),(3,1)");
   $conexion->query("INSERT INTO tbl_tarjetas VALUES
      ('principal',1,1,1000,1400,'Prestamo','2026-02-02'),('route2',1,2,500,700,'Prestamo','2026-02-04'),
      ('reverse',1,1,-100,0,'Prestamo','2026-02-05')");
   $conexion->query("INSERT INTO tbl_descripcion VALUES
      ('cash',1,1,-500,'Abono','2026-02-03'),('reverse',1,1,50,'Abono reverso','2026-02-04'),
      ('discount',1,1,-200,'Descuento','2026-02-03'),('adjustment',1,1,-200,'Intereses ajuste','2026-02-03')");
   $conexion->query("INSERT INTO tbl_descripcion_pago VALUES(1,'cash',50),(1,'cash',50),(2,'cash',999)");
   $conexion->query("INSERT INTO tbl_contabilidad_detalle(idcontabilidad_detalle,idglobal,created_at,dec_total,idtipo_contabilidad) VALUES('payment',1,'2026-02-05',-80,2),('refund',1,'2026-02-06',10,2)");
   $conexion->query("INSERT INTO tbl_detalle_nomina(idglobal,idnomina,idcontabilidad_detalle) VALUES(1,1,'payment'),(1,1,'payment'),(1,1,'refund')");
   $summary = $model->resumen(1,3,'2026-02-28');
   payrollAssert(count($summary['routes']) === 2 && $summary['routes'][0]['provisional'], 'provisional routes');
   payrollAssert($summary['routes'][0]['capitalCommission'] == 90, 'route capital commissions');
   payrollAssert($summary['routes'][0]['collectionCommission'] == 70, 'route cash commissions');
   payrollAssert($summary['routes'][0]['capitalAmount'] == 900 && $summary['routes'][0]['cashAmount'] == 350, 'route movement bases');
   payrollAssert(count($summary['breakdown']) === 5, 'unique attributed movements');
   payrollAssert(array_sum(array_column($summary['breakdown'], 'capitalCommission')) == 140, 'breakdown matches totals');
   foreach (['baseAmount'=>100,'capitalCommission'=>140,'collectionCommission'=>70,'earnedAmount'=>210,'paidAmount'=>70,'pendingAmount'=>140] as $key=>$expected) {
      payrollAssert($summary['totals'][$key] == $expected, 'shared Node/PHP golden ' . $key);
   }
   payrollAssert($model->resumen(1,4,'2026-02-28')['totals']['baseAmount'] == 0, 'percentage no invented base');
   payrollAssert($model->obtenerBootstrap(1,1)['canDistribute'], 'fresh super admin');
   payrollAssert(!$model->obtenerBootstrap(1,3)['canManage'], 'self cannot manage');
   payrollAssert($model->obtenerBootstrap(1,1)['branches'][0]['titularEmployeeId'] == 3, 'branch owner');
   payrollAssert($model->obtenerBootstrap(1,1)['branches'][0]['holderId'] == 3, 'branch holder ID');
   payrollAssert($model->obtenerBootstrap(1,1)['branches'][0]['holderName'] === 'Employee A', 'company-scoped holder name');
   payrollAssert(count($model->obtenerBootstrap(1,1)['branches'][0]['employees']) === 2, 'distinct active branch assignments');
   try { $model->autorizarEmpleado(1,3,4); throw new LogicException('scope should fail'); }
   catch (RuntimeException $error) { payrollAssert($error->getCode()===403, 'self scope'); }
   $scope = $model->bonoContexto(1,2,1);
   payrollAssert($scope['state'] === 'created' && count($scope['employees']) === 2, 'fresh cash bonus context');
   $bonus = ['employeeId'=>3,'branchId'=>1,'routeId'=>$scope['routeId'],'amount'=>25,'reason'=>'Manual','idempotencyToken'=>'php_bonus_token_0001'];
   payrollAssert(!$model->guardarBono(1,2,$bonus)['duplicate'], 'first request');
   payrollAssert($model->guardarBono(1,2,$bonus)['duplicate'], 'idempotent retry');
   payrollAssert($model->guardarVacacion(1,2,['employeeId'=>4,'replacementEmployeeId'=>3,'startDate'=>date('Y-m-d'),'endDate'=>date('Y-m-d'),
      'idempotencyToken'=>'php_vacation_token_01'])['ok'], 'vacation needs no reason');
   try { $model->guardarBono(1,2,array_replace($bonus,['amount'=>-1])); throw new LogicException('negative manual bonus should fail'); }
   catch (RuntimeException $error) { payrollAssert($error->getCode()===422, 'positive manual bonus'); }
   try { $model->guardarBono(1,4,array_replace($bonus,['idempotencyToken'=>'php_bonus_token_0002'])); throw new LogicException('write should fail'); }
   catch (RuntimeException $error) { payrollAssert($error->getCode()===403, 'fresh write scope'); }
   foreach (['2026-02-30','2026-2-03','x'] as $invalid) {
      try { NominaEmpleado::validarFecha($invalid); throw new LogicException('date should fail'); }
      catch (RuntimeException $error) { payrollAssert($error->getCode()===422, 'date validation'); }
   }
   echo "OK PHP shared SQL: golden amounts, base, snapshot retry, migration retry, fresh permissions, idempotency, dates\n";
} finally {
   if ($created) $conexion->query("DROP DATABASE `$dbName`");
}
