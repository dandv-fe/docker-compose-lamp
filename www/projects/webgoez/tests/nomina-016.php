<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../model/NominaEmpleado.php';
require_once __DIR__ . '/../model/AutorizarDespachoCartera.php';
require_once __DIR__ . '/../model/Cartera.php';
require_once __DIR__ . '/../method.php';

function nomina016Assert($value, $message)
{
   if (!$value) throw new RuntimeException('FAIL: ' . $message);
}
function nomina016Statements($sql)
{
   $delimiter = ';'; $buffer = ''; $statements = [];
   foreach (explode("\n", $sql) as $line) {
      if (strpos(trim($line), '--') === 0) continue;
      if (strpos($line, 'DELIMITER ') === 0) { $delimiter = trim(substr($line, 10)); continue; }
      $buffer .= $line . "\n"; $trimmed = rtrim($buffer);
      if (substr($trimmed, -strlen($delimiter)) === $delimiter) {
         $statements[] = trim(substr($trimmed, 0, -strlen($delimiter))); $buffer = '';
      }
   }
   if (trim($buffer)) throw new RuntimeException('SQL terminator missing');
   return $statements;
}
function nomina016Request($method, $data, $branch = 1)
{
   session_start();
   $_SESSION = ['idglobal'=>1,'idusuario'=>2,'idempleado'=>2,'idsucursal'=>$branch,'csrfNominaEmpleado'=>str_repeat('a',64)];
   session_write_close();
   $_SERVER['REQUEST_METHOD'] = $method;
   $_SERVER['CONTENT_TYPE'] = 'application/x-www-form-urlencoded';
   $_POST = $method === 'POST' ? $data : [];
   $_GET = $method === 'GET' ? $data : [];
   http_response_code(200);
   ob_start();
   include __DIR__ . '/../ajax/NominaEmpleadoAjax.php';
   $payload = json_decode(ob_get_clean(), true, 32, JSON_THROW_ON_ERROR);
   return [http_response_code(), $payload];
}
$database = 'payroll_test_php016_' . getmypid() . '_' . bin2hex(random_bytes(4));
$created = false;
try {
   $conexion->query("CREATE DATABASE `$database`"); $created = true; $conexion->select_db($database);
   foreach (['tests/fixtures/employee-payroll.sql','migrations/015_employee_payroll.sql',
      'tests/fixtures/payroll-016-legacy.sql','migrations/016_payroll_replacements_cash_bonus.sql'] as $path) {
      foreach (nomina016Statements(file_get_contents(__DIR__ . '/../../backend-creditos-apk/' . $path)) as $statement) $conexion->query($statement);
   }
   $today = date('Y-m-d');
   $conexion->query("INSERT INTO tbl_employee_payroll_contract
      (idglobal,employee_id,effective_date,salary_type,frequency,base_amount,capital_rate,collection_rate,actor_user_id)
      VALUES(1,3,'2020-01-01','Combinado','Mensual',100,10,20,1),(1,4,'2020-01-01','Porcentaje','Mensual',0,5,10,1)");
   $conexion->query("INSERT INTO tbl_detalle_ruta(iddetalleruta,idglobal,idsucursal,created_at) VALUES(1,1,1,'$today'),(2,1,2,'$today')");
   $conexion->query("INSERT INTO tbl_empleados_cobrando VALUES(3,1),(3,2)");
   $model = new NominaEmpleado($conexion);
   $model->snapshotDespacho(1,1); $model->snapshotDespacho(1,2);
   $vacation = ['employeeId'=>3,'replacementEmployeeId'=>4,'startDate'=>$today,'endDate'=>$today,'idempotencyToken'=>'php_016_vacation_0001'];
   nomina016Assert($model->guardarVacacion(1,2,$vacation)['ok'], 'independent vacation replacement');
   $conexion->query("INSERT INTO tbl_tarjetas VALUES('principal',1,1,1000,2000,'Prestamo','$today')");
   nomina016Assert($model->resumen(1,4,$today)['totals']['capitalCommission'] == 50, 'own replacement commission rates');
   nomina016Assert($model->resumen(1,3,$today)['totals']['capitalCommission'] == 0, 'holder excluded');
   nomina016Assert($model->resumen(1,3,$today)['vacations'][0]['replacementName'] === 'Reviewer B', 'replacement read label');
   $session = ['idglobal'=>1,'idusuario'=>4,'idempleado'=>4];
   nomina016Assert(esRepresentanteTemporalCartera($conexion,$session,1), 'fresh active representative');
   nomina016Assert(!administraOficinaCartera($conexion,$session,1), 'not office admin');
   $_SERVER['SCRIPT_NAME'] = '/ajax/CarteraAjax.php'; $_GET['op'] = 'SaveOrUpdateAbono'; $_POST = ['textRefDexcripcionHidden'=>''];
   nomina016Assert(errorDespachoCartera($conexion,$session,1) !== null, 'holder grant never authorizes replacement');
   $conexion->query("INSERT INTO tbl_sucursal VALUES(10,1,4,1,'Own grants')");
   $conexion->query("INSERT INTO tbl_auth_sucursal VALUES(4,1,10,4,'activo')");
   $conexion->query("INSERT INTO tbl_auths VALUES(11,4,1),(12,4,2),(13,4,5),(14,4,6)");
   nomina016Assert(errorDespachoCartera($conexion,$session,1) !== null, 'own permission in another branch cannot transfer');
   $conexion->query("INSERT INTO tbl_auth_sucursal VALUES(7,1,1,4,'activo')");
   $conexion->query("INSERT INTO tbl_auths VALUES(20,7,1),(21,7,2),(22,7,5),(23,7,6)");
   nomina016Assert(errorDespachoCartera($conexion,$session,1) === null, 'essential new payment');
   $_GET['op'] = 'eliminarAbono';
   nomina016Assert(errorDespachoCartera($conexion,$session,1) !== null, 'holder delete grant not inherited');
   $conexion->query("INSERT INTO tbl_auths VALUES(15,7,3)");
   nomina016Assert(errorDespachoCartera($conexion,$session,1) === null, 'own delete grant authorizes action, no new admin');
   $conexion->query("DELETE FROM tbl_auths WHERE id=15");
   nomina016Assert(errorDespachoCartera($conexion,$session,1) !== null, 'own revocation immediate');
   $_SERVER['SCRIPT_NAME'] = '/ajax/ClienteAjax.php'; $_GET['op'] = 'SaveOrUpdate';
   $_POST = ['txtRefCliente'=>''];
   nomina016Assert(errorDespachoCartera($conexion,$session,1) === null, 'create client exact POST field');
   $_POST = ['txtRefCliente'=>'existing'];
   nomina016Assert(errorDespachoCartera($conexion,$session,1) !== null, 'holder edit grant not inherited');
   $conexion->query("INSERT INTO tbl_auths VALUES(16,7,7)");
   nomina016Assert(errorDespachoCartera($conexion,$session,1) === null, 'own edit grant authorized');
   $_POST = ['txtRefCliente'=>'existing'];
   nomina016Assert(errorDespachoCartera($conexion,$session,2) !== null, 'own grant in branch1 cannot edit in covered branch2');
   $_SERVER['SCRIPT_NAME'] = '/ajax/RecibirCuentasAjax.php'; $_GET['op'] = 'SaveOrUpdateDtaCobro';
   nomina016Assert(errorDespachoCartera($conexion,$session,1) !== null, 'scope alone cannot deliver route');
   $conexion->query("INSERT INTO tbl_auth VALUES(8,'bloquear')");
   $conexion->query("INSERT INTO tbl_auths VALUES(17,7,8)");
   nomina016Assert(errorDespachoCartera($conexion,$session,1) === null, 'explicit own delivery grant allowed without admin');
   $conexion->query("DELETE FROM tbl_auths WHERE id=17");
   nomina016Assert(errorDespachoCartera($conexion,$session,1) !== null, 'delivery revocation immediate');
   $_SERVER['SCRIPT_NAME'] = '/ajax/ClienteAjax.php'; $_GET['op'] = 'SaveOrUpdate';
   $selectedSession = $session + ['idsucursal'=>1];
   nomina016Assert(puedeVerDetalleCuentasSucursal($conexion,$selectedSession,1), 'selected temporary branch authorized');
   $conexion->query("UPDATE tbl_auth_sucursal SET str_estado='inactivo' WHERE idauth_sucursal=7");
   $conexion->query("UPDATE tbl_employee_payroll_coverage SET end_date=DATE_ADD('$today',INTERVAL 1 DAY),start_date=DATE_ADD('$today',INTERVAL 1 DAY)");
   nomina016Assert(!esRepresentanteTemporalCartera($conexion,$session,1), 'future coverage gives no access today');
   nomina016Assert(!puedeVerDetalleCuentasSucursal($conexion,$selectedSession,1), 'future scope not activated by selection');
   $conexion->query("UPDATE tbl_employee_payroll_coverage SET start_date='$today',end_date='$today'");
   $conexion->query("UPDATE tbl_employee_payroll_coverage SET end_date=DATE_SUB('$today',INTERVAL 1 DAY)");
   nomina016Assert(!puedeVerDetalleCuentasSucursal($conexion,$selectedSession,1), 'selected stale branch expires');
   nomina016Assert(errorDespachoCartera($conexion,$selectedSession,1) !== null, 'expired representative write denied');
   $conexion->query("UPDATE tbl_employee_payroll_coverage SET end_date='$today'");
   $conexion->query("UPDATE tbl_usuario SET str_estado='inactivo' WHERE idusuario=4");
   nomina016Assert(!puedeVerDetalleCuentasSucursal($conexion,$selectedSession,1), 'fresh inactive actor denied');
   $conexion->query("UPDATE tbl_usuario SET str_estado='activo' WHERE idusuario=4");
   [$status,$context] = nomina016Request('GET',['action'=>'bonoContexto','branchId'=>1]);
   nomina016Assert($status===200 && $context['routeId']===1 && count($context['employees'])===2, 'session cash context');
   [$status] = nomina016Request('GET',['action'=>'bonoContexto','branchId'=>2]);
   nomina016Assert($status===403, 'selected branch mismatch');
   $data = ['employeeId'=>4,'branchId'=>1,'routeId'=>1,'amount'=>25,'reason'=>'Meta','idempotencyToken'=>'php_016_cash_bonus_01'];
   [$status] = nomina016Request('POST',['action'=>'bono','csrfToken'=>'wrong','data'=>$data]);
   nomina016Assert($status===403, 'CSRF required');
   [$status,$saved] = nomina016Request('POST',['action'=>'bono','csrfToken'=>str_repeat('a',64),'data'=>$data]);
   nomina016Assert($status===200 && $saved['ok'] && isset($saved['expenseId']), 'cash-linked endpoint transaction');
   nomina016Assert(limpiar_cadena($saved['expenseId']) === $saved['expenseId'], 'legacy expense ID sanitization compatible');
   $conexion->query("INSERT INTO tbl_empleados_cobrando VALUES(4,1)");
   nomina016Assert(!esGestorBonoCartera($conexion,$session,1), 'own dispatched employee cannot grant own bonus');
   $_SERVER['SCRIPT_NAME'] = '/ajax/CarteraAjax.php'; $_GET['op'] = 'deleteGastoDetalleRuta'; $_POST = ['id'=>$saved['expenseId']];
   nomina016Assert(errorDespachoCartera($conexion,$session,1) !== null, 'regular employee cannot delete earned bonus');
   nomina016Assert(errorDespachoCartera($conexion,['idglobal'=>1,'idusuario'=>2,'idempleado'=>2],1) === null, 'office admin can reverse cash bonus');
   [$status,$retry] = nomina016Request('POST',['action'=>'bono','csrfToken'=>str_repeat('a',64),'data'=>$data]);
   nomina016Assert($status===200 && $retry['duplicate'], 'endpoint idempotent');
   $summary = $model->resumen(1,4,$today);
   nomina016Assert($summary['totals']['bonusAmount']==25 && $summary['totals']['paidAmount']==25, 'earned and paid exactly once');
   [$status] = nomina016Request('POST',['action'=>'bono','csrfToken'=>str_repeat('a',64),
      'data'=>array_diff_key($data,array_flip(['branchId','routeId']))]);
   nomina016Assert($status===403, 'standalone bonus rejected');
   $conexion->query("UPDATE tbl_contabilidad_detalle SET dec_total=0 WHERE idcontabilidad_detalle='" . $saved['expenseId'] . "'");
   nomina016Assert($model->resumen(1,4,$today)['totals']['bonusAmount']==0, 'expense cancellation follows bonus');
   ob_start();
   (new ClassCartera())->deleteGastoDetalleRuta(limpiar_cadena($saved['expenseId']), 2);
   $deleted = ob_get_clean();
   nomina016Assert(strpos($deleted,'Eliminado Correctamente') !== false, 'real legacy PHP expense delete');
   nomina016Assert($conexion->query("SELECT COUNT(*) n FROM tbl_detalle_nomina WHERE idcontabilidad_detalle='" .
      $saved['expenseId'] . "'")->fetch_assoc()['n'] == 0, 'legacy delete removes payroll link');
   $conexion->query("UPDATE tbl_detalle_ruta SET str_estado='saved' WHERE iddetalleruta=1");
   [$status] = nomina016Request('POST',['action'=>'bono','csrfToken'=>str_repeat('a',64),'data'=>$data]);
   nomina016Assert($status!==200, 'closed route rejects even retry');
   echo "OK PHP016: replacement rates/base, temporary scope, own labels, selected branch, CSRF, ledger, duplicate, cancellation, closed route\n";
} finally {
   if ($created) $conexion->query("DROP DATABASE `$database`");
   if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
}
