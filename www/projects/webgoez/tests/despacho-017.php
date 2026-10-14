<?php
if (PHP_SAPI!=='cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../model/Despachar.php';
if (($argv[1] ?? '')==='--worker') {
   $target=$argv[2] ?? '';
   if (!preg_match('/^payroll_test_dispatch_[A-Za-z0-9_]+$/D',$target)) throw new RuntimeException('Isolated worker database required');
   $conexion->select_db($target);
   try {
      $result=(new Despachar($conexion,['idglobal'=>1,'idusuario'=>1,'idoficina'=>1]))->guardar(
         ['branchId'=>(int)($argv[4] ?? 2),'expectedRouteId'=>0,'expectedVersion'=>0,'employeeIds'=>[3],
          'idempotencyToken'=>$argv[3]]);
      echo json_encode($result,JSON_THROW_ON_ERROR);
   } catch (RuntimeException $e) { echo json_encode(['error'=>$e->getMessage(),'status'=>$e->getCode()],JSON_THROW_ON_ERROR); }
   exit;
}

function dispatchAssert($condition,string $message)
{
   if (!$condition) throw new RuntimeException('FAIL: ' . $message);
}
function dispatchReject(callable $fn,int $status)
{
   try { $fn(); } catch (RuntimeException $e) {
      dispatchAssert($e->getCode()===$status,'expected status ' . $status . ', got ' . $e->getMessage()); return;
   }
   throw new RuntimeException('Expected rejection ' . $status);
}
function dispatchStatements(string $sql): array
{
   $delimiter=';'; $buffer=''; $statements=[];
   foreach (explode("\n",$sql) as $line) {
      if (strpos(trim($line),'--')===0) continue;
      if (strpos($line,'DELIMITER ')===0) { $delimiter=trim(substr($line,10)); continue; }
      $buffer.=$line . "\n"; $trimmed=rtrim($buffer);
      if (substr($trimmed,-strlen($delimiter))===$delimiter) {
         $statements[]=trim(substr($trimmed,0,-strlen($delimiter))); $buffer='';
      }
   }
   if (trim($buffer)) throw new RuntimeException('SQL missing terminator');
   return $statements;
}
function dispatchRequest(array $session,string $method,array $data): array
{
   session_start(); $_SESSION=$session+['csrfDespacho'=>str_repeat('b',64)]; session_write_close();
   $_SERVER['REQUEST_METHOD']=$method; $_SERVER['CONTENT_TYPE']='application/x-www-form-urlencoded';
   $_GET=$method==='GET' ? $data : []; $_POST=$method==='POST' ? $data : [];
   http_response_code(200); ob_start();
   include __DIR__ . '/../ajax/DespacharAjax.php';
   $response=json_decode(ob_get_clean(),true,32,JSON_THROW_ON_ERROR);
   return [http_response_code(),$response];
}
$database='payroll_test_dispatch_' . getmypid() . '_' . bin2hex(random_bytes(4));
$created=false;
try {
   $conexion->query("CREATE DATABASE `$database`"); $created=true; $conexion->select_db($database);
   foreach (['tests/fixtures/employee-payroll.sql','migrations/015_employee_payroll.sql',
      'tests/fixtures/payroll-016-legacy.sql','migrations/016_payroll_replacements_cash_bonus.sql',
      'tests/fixtures/dispatch-017-legacy.sql','migrations/017_dispatch_challenges.sql'] as $file) {
      foreach (dispatchStatements(file_get_contents(__DIR__ . '/../../backend-creditos-apk/' . $file)) as $sql) $conexion->query($sql);
   }
   foreach (dispatchStatements(file_get_contents(__DIR__ . '/../../backend-creditos-apk/migrations/017_dispatch_challenges.sql')) as $sql) $conexion->query($sql);
   dispatchAssert($conexion->query("SELECT COUNT(*) n FROM tbl_auth WHERE str_nombre='poner_retos'")->fetch_assoc()['n']==1,'permission catalog idempotent');
   $challengeAuth=(int)$conexion->query("SELECT idauth FROM tbl_auth WHERE str_nombre='poner_retos'")->fetch_assoc()['idauth'];
   dispatchAssert($conexion->query("SELECT COUNT(*) n FROM tbl_auths WHERE idauth=$challengeAuth")->fetch_assoc()['n']==0,'no grants autoassigned');
   $today=date('Y-m-d');
   $conexion->query("INSERT INTO tbl_employee_payroll_contract
      (idglobal,employee_id,effective_date,salary_type,frequency,base_amount,capital_rate,collection_rate,actor_user_id)
      VALUES(1,3,'2020-01-01','Combinado','Diario',40000,2.5,2.3,1),
            (1,4,'2020-01-01','Combinado','Diario',40000,2.5,2.3,1)");
   $superSession=['idglobal'=>1,'idusuario'=>1,'idempleado'=>999,'idoficina'=>1];
   $regularSession=['idglobal'=>1,'idusuario'=>3,'idempleado'=>1,'userEmpresa'=>1,'idoficina'=>1];
   $adminSession=['idglobal'=>1,'idusuario'=>2,'idempleado'=>2,'idoficina'=>1];
   $super=new Despachar($conexion,$superSession); $regular=new Despachar($conexion,$regularSession);
   $admin=new Despachar($conexion,$adminSession);
   dispatchAssert(count($regular->listar()['branches'])==2,'list fresh despachar scopes, no forged SA');
   dispatchReject(fn()=>$regular->contexto(3),403);
   dispatchReject(fn()=>$admin->contexto(1),403);
   $conexion->query("INSERT INTO tbl_auth_sucursal VALUES(8,1,1,2,'activo'),(9,1,1,1,'activo')");
   $conexion->query("INSERT INTO tbl_auths VALUES(22,8,20),(25,1,$challengeAuth)");
   dispatchAssert($super->contexto(1)['canSetChallenges'],'SA challenges without poner_retos grant');
   dispatchAssert(!$admin->contexto(1)['canSetChallenges'],'office admin without poner_retos denied');
   $conexion->query("INSERT INTO tbl_auths VALUES(23,8,$challengeAuth)");
   dispatchAssert($admin->contexto(1)['canSetChallenges'],'office admin AND exactbranch grant');
   dispatchAssert(!$regular->contexto(1)['canSetChallenges'],'regular challenge grant not manager');
   $initial=$super->contexto(1);
   dispatchAssert($initial['branch']['canDispatch'] && $initial['branch']['canSaveDispatch'],'SA effective capability without own dispatch grant');
   dispatchAssert($initial['employees'][0]['officeName']==='Office' && $initial['employees'][0]['officeId']===1,'employee office metadata');
   dispatchAssert(count(array_filter($initial['employees'],fn($e)=>$e['representative']))===1,'single permanent representative label');
   dispatchAssert($super->listar()['branches'][0]['assignedCount']===0,'new branch assigned count');
   dispatchAssert($super->listar()['branches'][0]['assignedEmployees']===[],'new branch has no assigned names');
   $conexion->query('DELETE FROM tbl_auths WHERE id=20');
   dispatchReject(fn()=>$regular->contexto(1),403);
   $conexion->query('INSERT INTO tbl_auths VALUES(20,1,20)');
   $new=['branchId'=>1,'expectedRouteId'=>0,'expectedVersion'=>0,'employeeIds'=>[3,4],
      'distribution'=>['mode'=>'Igual','weights'=>[]],'idempotencyToken'=>'dispatch_new_token_01'];
   dispatchReject(fn()=>$regular->guardar($new),403);
   dispatchReject(fn()=>$super->guardar($new+['companyId'=>2]),422);
   dispatchReject(fn()=>$regular->guardar(array_replace($new,['employeeIds'=>[5],'distribution'=>null])),403);
   $challenge=['employeeId'=>3,'deadline'=>$today,'incrementPercent'=>20,'capitalGoal'=>1000000,
      'collectionGoal'=>1000000,'description'=>'Meta individual'];
   $withoutDescription=$challenge;
   unset($withoutDescription['description']);
   dispatchAssert(DespachoCore::challengeInput($withoutDescription)['description']==='','description omitted is optional');
   foreach (['','   '] as $description) {
      dispatchAssert(DespachoCore::challengeInput(array_replace($challenge,['description'=>$description]))['description']==='','empty description allowed');
   }
   dispatchAssert(strlen(DespachoCore::challengeInput(array_replace($challenge,['description'=>str_repeat('a',250)]))['description'])===250,'description max250 allowed');
   foreach ([null,1,[],str_repeat('a',251)] as $description) {
      dispatchReject(fn()=>DespachoCore::challengeInput(array_replace($challenge,['description'=>$description])),422);
   }
   $conexion->query('DELETE FROM tbl_auths WHERE id=23');
   dispatchReject(fn()=>$admin->guardar(array_replace($new,['distribution'=>null,'challenges'=>[$challenge],
      'idempotencyToken'=>'admin_no_grant_token'])),403);
   $conexion->query("INSERT INTO tbl_auths VALUES(23,8,$challengeAuth)");
   $conexion->query("INSERT INTO tbl_oficina VALUES(3,1,4,'Another office')");
   $conexion->query("INSERT INTO tbl_sucursal(idglobal,idsucursal,idoficina,idempleado,str_codigo) VALUES(1,5,3,3,'Other office')");
   $conexion->query("INSERT INTO tbl_auth_sucursal VALUES(10,1,5,2,'activo')");
   $conexion->query("INSERT INTO tbl_auths VALUES(26,10,20),(27,10,$challengeAuth)");
   dispatchAssert(!$admin->contexto(5)['canSetChallenges'],'admin of other office despite exactbranch grant denied');
   dispatchAssert(in_array(5,array_column($admin->listar()['branches'],'branchId'),true),'exactbranch dispatch grant visible outside selected office');
   dispatchAssert(!in_array(5,array_column($regular->listar()['branches'],'branchId'),true),'different office branch without grant remains hidden');
   dispatchAssert(!in_array(5,array_column($super->listar()['branches'],'branchId'),true),'SA selected office filter preserved');
   $otherOfficeRegular=new Despachar($conexion,array_replace($regularSession,['idoficina'=>3]));
   dispatchAssert(count($otherOfficeRegular->listar()['branches'])===2,'employee selected office cannot hide granted dispatch branches');
   dispatchReject(fn()=>$admin->guardar(['branchId'=>5,'expectedRouteId'=>0,'expectedVersion'=>0,'employeeIds'=>[3],
      'challenges'=>[$challenge],'idempotencyToken'=>'admin_other_office01']),403);
   foreach ([0,0.09,40.01] as $percent) dispatchReject(fn()=>DespachoCore::challengeInput(array_replace($challenge,['incrementPercent'=>$percent])),422);
   dispatchReject(fn()=>DespachoCore::challengeInput(array_replace($challenge,['deadline'=>'2024-02-30'])),422);
   $saved=$super->guardar($new+['challenges'=>[$challenge]]);
   $route=$saved['routeId'];
   dispatchAssert($saved['version']===1,'new route version');
   $listedBranch=array_values(array_filter($super->listar()['branches'],fn($b)=>$b['branchId']===1))[0];
   dispatchAssert($listedBranch['assignedCount']===2,'assigned count after opening');
   dispatchAssert(array_column($listedBranch['assignedEmployees'],'employeeId')===[3,4],'assigned identities ordered by name');
   dispatchAssert(array_column($listedBranch['assignedEmployees'],'name')===['Employee A','Reviewer B'],'assigned names from real route');
   dispatchAssert($super->guardar($new+['challenges'=>[$challenge]])['duplicate'],'idempotency retry once');
   dispatchAssert($conexion->query("SELECT COUNT(*) n FROM tbl_detalle_ruta WHERE idsucursal=1")->fetch_assoc()['n']==1,'no double route');
   dispatchReject(fn()=>$super->guardar(array_replace($new,['idempotencyToken'=>'dispatch_other_new01'])),409);
   dispatchAssert($conexion->query('SELECT COUNT(*) n FROM tbl_employee_payroll_branch_rule')->fetch_assoc()['n']==0,'dispatch override never branch mutation');
   $snapshot=$conexion->query("SELECT weight,capital_rate,collection_rate FROM tbl_employee_payroll_snapshot WHERE route_id=$route AND employee_id=3")->fetch_assoc();
   dispatchAssert((float)$snapshot['weight']===50.0 && (float)$snapshot['capital_rate']===2.5,'ownrates frozen equal snapshot');
   dispatchAssert(!$super->contexto(1)['canConfigureDistribution'],'existing dispatch capability hides immutable distribution editor');
   $edited=$admin->guardar(['branchId'=>1,'expectedRouteId'=>$route,'expectedVersion'=>1,
      'employeeIds'=>[3],'idempotencyToken'=>'dispatch_edit_token01']);
   dispatchAssert($edited['version']===2 && count($edited['warnings'])===1,'edit operational only with warning');
   dispatchAssert($conexion->query("SELECT COUNT(*) n FROM tbl_employee_payroll_snapshot WHERE route_id=$route")->fetch_assoc()['n']==2,'old snapshot preserved');
   $workers=[];
   for ($i=0;$i<2;$i++) {
      $process=proc_open([PHP_BINARY,__FILE__,'--worker',$database,'dispatch_concurrent01'],
         [1=>['pipe','w'],2=>['pipe','w']],$pipes);
      $workers[]=[$process,$pipes];
   }
   $results=[];
   foreach ($workers as [$process,$pipes]) {
      $output=stream_get_contents($pipes[1]); fclose($pipes[1]);
      $error=stream_get_contents($pipes[2]); fclose($pipes[2]);
      dispatchAssert(proc_close($process)===0,'concurrent worker: ' . $error);
      $results[]=json_decode($output,true,32,JSON_THROW_ON_ERROR);
   }
   dispatchAssert($results[0]['routeId']===$results[1]['routeId'],'concurrent retries same route');
   dispatchAssert((int)$results[0]['duplicate']+(int)$results[1]['duplicate']===1,'one insert one duplicate');
   dispatchAssert($conexion->query('SELECT COUNT(*) n FROM tbl_detalle_ruta WHERE idsucursal=2')->fetch_assoc()['n']==1,'branch lock excludes duplicate routes');
   $conexion->query("INSERT INTO tbl_sucursal(idglobal,idsucursal,idoficina,idempleado,str_codigo) VALUES(1,4,1,3,'Concurrent')");
   $workers=[];
   for ($i=0;$i<2;$i++) {
      $process=proc_open([PHP_BINARY,__FILE__,'--worker',$database,'dispatch_distinct_0' . $i,'4'],
         [1=>['pipe','w'],2=>['pipe','w']],$pipes);
      $workers[]=[$process,$pipes];
   }
   $distinct=[];
   foreach ($workers as [$process,$pipes]) {
      $output=stream_get_contents($pipes[1]); fclose($pipes[1]);
      $error=stream_get_contents($pipes[2]); fclose($pipes[2]);
      dispatchAssert(proc_close($process)===0,'distinct concurrent worker: ' . $error);
      $distinct[]=json_decode($output,true,32,JSON_THROW_ON_ERROR);
   }
   dispatchAssert(count(array_filter($distinct,fn($r)=>($r['ok'] ?? false)))===1,'one independent opening succeeds');
   dispatchAssert(count(array_filter($distinct,fn($r)=>($r['status'] ?? null)===409))===1,'second independent opening conflicts');
   dispatchAssert($conexion->query('SELECT COUNT(*) n FROM tbl_detalle_ruta WHERE idsucursal=4')->fetch_assoc()['n']==1,'distinct tokens cannot double open');
   $c=$challenge+['branchId'=>1,'routeId'=>$route,'expectedVersion'=>2,'idempotencyToken'=>'challenge_save_token01'];
   dispatchReject(fn()=>$regular->reto($c),403);
   dispatchReject(fn()=>$admin->reto(array_replace($c,['employeeId'=>4])),422);
   dispatchAssert($admin->reto($c)['version']===3,'challenge update changes version');
   dispatchReject(fn()=>$admin->reto(array_replace($c,['idempotencyToken'=>'challenge_stale_token01'])),409);
   $salary=['configured'=>true,'type'=>'Combinado','baseAmount'=>40000,'commissionAmount'=>0];
   $part=['weight'=>100,'contractId'=>1,'type'=>'Combinado','capitalRate'=>2.5,'collectionRate'=>2.3];
   $goal=DespachoCore::goal($salary,$part,0,$challenge)['goal'];
   dispatchAssert($goal['projectedCommission']==48000 && $goal['surplusAmount']==8000 && $goal['surplusPercent']==20,'approved ownrates example');
   dispatchAssert($goal['projectedEarnedWithoutBonuses']==48000,'combined max not plus basic');
   $goal=DespachoCore::goal(array_replace($salary,['commissionAmount'=>-1000]),$part,-3000,$challenge)['goal'];
   dispatchAssert($goal['otherCommission']==2000 && $goal['commissionGap']==49000,'signed other route offset once');
   dispatchAssert(DespachoCore::goal($salary,array_replace($part,['capitalRate'=>0]),0,$challenge)['goal']['capitalRequired']===null,'rate0 guard');
   $conexion->query("INSERT INTO tbl_tarjetas(idtarjeta,idglobal,iddetalleruta,dec_prestamo,dec_valor,str_concepto,created_at,dec_resta)
      VALUES('credit',1,$route,1000000,4000000,'Prestamo','$today',4000000)");
   $conexion->query("INSERT INTO tbl_descripcion(iddescripcion,idglobal,iddetalleruta,dec_abono,str_descripcion,created_at,idtarjeta)
      VALUES('cash',1,$route,-1000000,'Abono','$today','credit'),('reverse',1,$route,100000,'Abono reverso','$today','credit')");
   $conexion->query("UPDATE tbl_tarjetas SET dec_resta=3100000 WHERE idtarjeta='credit'");
   $conexion->query("INSERT INTO tbl_descripcion_pago VALUES(1,'cash',200000)");
   $otherRoute=(int)$results[0]['routeId'];
   $conexion->query("INSERT INTO tbl_tarjetas(idtarjeta,idglobal,iddetalleruta,dec_prestamo,dec_valor,str_concepto,created_at,dec_resta,idsucursal)
      VALUES('other-credit',1,$otherRoute,100000,100000,'Prestamo','$today',100000,2)");
   if (getenv('DISPATCH_FORECAST_NODE_BINARY')) {
      $forecast=$super->estimar($challenge+['branchId'=>1,'routeId'=>$route]);
      dispatchAssert($forecast['salary']['baseAmount']==40000,'unique own basic not multiplied by assignments');
      dispatchAssert($forecast['goal']['routeCommission']==20550,'snapshot weighted principal + signed netbank cash');
      dispatchAssert($forecast['goal']['otherCommission']==2500 && $forecast['goal']['commissionGap']==24950,'other route commissions offset gap, no second base');
      dispatchAssert($forecast['collections']['status']==='available','real shared Node schedule bridge');
      $conexion->query('DELETE FROM tbl_auths WHERE id IN (20,21)');
      dispatchReject(fn()=>$regular->contexto(1),403);
      $own=$regular->propios();
      dispatchAssert($own['employeeId']===3 && count($own['items'])===1,'own read uses fresh identity without despachar grant');
      dispatchAssert($own['items'][0]['progress']['creditedCapital']==500000 &&
         $own['items'][0]['progress']['creditedCollection']==350000,'own weighted signed netbank progress');
      dispatchAssert(!isset($own['items'][0]['forecast']['collections']['invalidCards']),'own read never leaks card IDs');
      [$status,$response]=dispatchRequest($regularSession,'GET',['action'=>'own']);
      dispatchAssert($status===200 && $response['employeeId']===3,'self endpoint in Inicio');
      [$status,$alias]=dispatchRequest($regularSession,'GET',['action'=>'myChallenges']);
      dispatchAssert($status===200 && $alias==$response,'myChallenges own-only alias has identical response');
      [$status]=dispatchRequest($regularSession,'GET',['action'=>'own','employeeId'=>4]);
      dispatchAssert($status===422,'own endpoint rejects identity selector');
      [$status]=dispatchRequest($regularSession,'GET',['action'=>'myChallenges','employeeId'=>4]);
      dispatchAssert($status===422,'myChallenges alias rejects identity selector');
      $process=proc_open([getenv('DISPATCH_FORECAST_NODE_BINARY'),__DIR__ . '/../../backend-creditos-apk/tests/dispatch-own-isolated.mjs'],
         [0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);
      fwrite($pipes[0],json_encode(['host'=>$HOST,'user'=>$USER,'password'=>$PASS,'database'=>$database,'routeId'=>$route],JSON_THROW_ON_ERROR));
      fclose($pipes[0]);
      $nodeOwn=stream_get_contents($pipes[1]); fclose($pipes[1]);
      $error=stream_get_contents($pipes[2]); fclose($pipes[2]);
      dispatchAssert(proc_close($process)===0,'Node own GraphQL integration: ' . $error);
      $nodeOwn=json_decode($nodeOwn,true,32,JSON_THROW_ON_ERROR);
      foreach (['allocation','goal','progress','forecast'] as $field) {
         dispatchAssert($nodeOwn['items'][0][$field]==$own['items'][0][$field],'PHP/Node exact shared own ' . $field);
      }
      $conexion->query('INSERT INTO tbl_auths VALUES(20,1,20),(21,2,20)');
   }
   $validBinary=getenv('DISPATCH_FORECAST_NODE_BINARY');
   putenv('DISPATCH_FORECAST_NODE_BINARY=/nonexistent/dispatch-node');
   dispatchReject(fn()=>$super->estimar($challenge+['branchId'=>1,'routeId'=>$route]),503);
   if ($validBinary!==false) putenv('DISPATCH_FORECAST_NODE_BINARY=' . $validBinary);
   else putenv('DISPATCH_FORECAST_NODE_BINARY');
   if (getenv('DISPATCH_FORECAST_TEST_SLOW_BINARY')) {
      putenv('DISPATCH_FORECAST_NODE_BINARY=' . getenv('DISPATCH_FORECAST_TEST_SLOW_BINARY'));
      $started=microtime(true);
      dispatchReject(fn()=>$super->estimar($challenge+['branchId'=>1,'routeId'=>$route]),503);
      dispatchAssert(microtime(true)-$started<18,'hung bridge bounded by timeout');
      if ($validBinary!==false) putenv('DISPATCH_FORECAST_NODE_BINARY=' . $validBinary);
      else putenv('DISPATCH_FORECAST_NODE_BINARY');
   }
   $before=$conexion->query('SELECT COUNT(*) n FROM tbl_employee_payroll_bonus')->fetch_assoc()['n'];
   dispatchAssert($before==0,'challenges never create bonus');
   [$status]=dispatchRequest($superSession,'POST',['action'=>'save','csrfToken'=>'wrong','data'=>$new]);
   dispatchAssert($status===403,'CSRF enforced');
   [$status,$response]=dispatchRequest($superSession,'POST',['action'=>'save','csrfToken'=>str_repeat('b',64),
      'data'=>$new+['challenges'=>[$challenge]]]);
   dispatchAssert($status===200 && $response['duplicate'] && $response['routeId']===$route,'JSON write adapter idempotent');
   [$status,$context]=dispatchRequest($regularSession,'GET',['action'=>'context','branchId'=>1]);
   dispatchAssert($status===200 && $context['route']['version']===3,'structured endpoint fresh context');
   $conexion->query("UPDATE tbl_detalle_ruta SET str_estado='entregando' WHERE iddetalleruta=$route");
   dispatchAssert(!$super->contexto(1)['branch']['canSaveDispatch'],'closed-state save capability false without changing dispatch grant');
   dispatchReject(fn()=>$admin->reto(array_replace($c,['expectedVersion'=>3,'idempotencyToken'=>'challenge_closed_token01'])),409);
   echo "OK Dispatch017: own permissions, eligibility, salary goals, signed snapshot, CSRF, tokens, stale versions, closed route, no payroll mutation\n";
} finally {
   if ($created) $conexion->query("DROP DATABASE `$database`");
   if (session_status()===PHP_SESSION_ACTIVE) session_write_close();
}
