<?php
require_once __DIR__ . '/NominaEmpleado.php';

class DespachoCore
{
   private mysqli $db;
   private array $session;
   private array $collectionCards=[];

   public function __construct(mysqli $db, array $session)
   {
      $this->db = $db;
      $this->session = $session;
   }

   private function rows(string $sql, array $params = []): array
   {
      $s = $this->db->prepare($sql);
      try {
         if ($params) {
            $types = '';
            foreach ($params as $p) $types .= is_int($p) ? 'i' : 's';
            $s->bind_param($types, ...$params);
         }
         $s->execute();
         $result = $s->get_result();
         return $result ? $result->fetch_all(MYSQLI_ASSOC) : [];
      } finally { $s->close(); }
   }

   private function actor(): array
   {
      $company = (int)($this->session['idglobal'] ?? 0);
      $user = (int)($this->session['idusuario'] ?? 0);
      if ($company <= 0 || $user <= 0) throw new RuntimeException('Inicie sesión.', 401);
      $actor = (new NominaEmpleado($this->db))->actor($company, $user);
      return ['companyId'=>$company,'userId'=>$user,'employeeId'=>(int)$actor['employeeId'],
         'super'=>$actor['cargo']==='Super Administrador'];
   }

   private function scope(int $branchId, bool $lock = false): array
   {
      $actor = $this->actor();
      $rows = $this->rows("SELECT s.idsucursal AS branchId,s.str_codigo AS name,s.str_tipo AS type,
         s.idempleado AS holderEmployeeId,s.idoficina AS officeId,o.str_nombre AS officeName,
         o.idempleado_administrador,
         EXISTS(SELECT 1 FROM tbl_auth_sucursal g JOIN tbl_auths x ON x.idauth_sucursal=g.idauth_sucursal
           JOIN tbl_auth a ON a.idauth=x.idauth WHERE g.idglobal=s.idglobal AND g.idsucursal=s.idsucursal
           AND g.idempleado=? AND g.str_estado<>'inactivo' AND a.str_nombre='despachar') AS canDispatch,
         EXISTS(SELECT 1 FROM tbl_auth_sucursal g JOIN tbl_auths x ON x.idauth_sucursal=g.idauth_sucursal
           JOIN tbl_auth a ON a.idauth=x.idauth WHERE g.idglobal=s.idglobal AND g.idsucursal=s.idsucursal
           AND g.idempleado=? AND g.str_estado<>'inactivo' AND a.str_nombre='poner_retos') AS challengeGrant
         FROM tbl_sucursal s JOIN tbl_oficina o ON o.idoficina=s.idoficina AND o.idglobal=s.idglobal
         WHERE s.idsucursal=? AND s.idglobal=? AND s.str_estado<>'inactiva'" . ($lock ? ' FOR UPDATE' : ''),
         [$actor['employeeId'],$actor['employeeId'],$branchId,$actor['companyId']]);
      if (!$rows || (!$actor['super'] && !$rows[0]['canDispatch'])) {
         throw new RuntimeException('No tiene permiso despachar en esta sucursal.', 403);
      }
      $branch = $rows[0];
      foreach (['branchId','holderEmployeeId','officeId','idempleado_administrador'] as $key) $branch[$key]=(int)$branch[$key];
      $branch['canDispatch']=$actor['super'] || (bool)$branch['canDispatch'];
      $branch['challengeGrant']=(bool)$branch['challengeGrant'];
      $admin = (int)$branch['idempleado_administrador']===$actor['employeeId'];
      return $actor + ['branch'=>$branch,'canConfigureDistribution'=>$actor['super'],
         'canSetChallenges'=>$actor['super'] || ($admin && (bool)$branch['challengeGrant']),'officeAdmin'=>$admin];
   }

   public function listing(): array
   {
      $actor = $this->actor();
      $office = $actor['super'] ? (int)($this->session['idoficina'] ?? 0) : 0;
      $branches = $this->rows("SELECT s.idsucursal AS branchId,s.str_codigo AS name,s.str_tipo AS type,
         s.idempleado AS holderEmployeeId,o.str_nombre AS officeName,r.iddetalleruta AS routeId,r.str_estado AS state,
         COALESCE(c.version,0) AS version,
         (SELECT COUNT(DISTINCT a.idempleado) FROM tbl_empleados_cobrando a
           WHERE a.id_detalle_ruta=r.iddetalleruta) AS assignedCount
         FROM tbl_sucursal s JOIN tbl_oficina o ON o.idglobal=s.idglobal AND o.idoficina=s.idoficina
         LEFT JOIN tbl_detalle_ruta r ON r.idglobal=s.idglobal AND r.idsucursal=s.idsucursal
           AND r.iddetalleruta=(SELECT MAX(r2.iddetalleruta) FROM tbl_detalle_ruta r2
             WHERE r2.idglobal=s.idglobal AND r2.idsucursal=s.idsucursal AND r2.str_estado<>'saved')
         LEFT JOIN tbl_dispatch_control c ON c.idglobal=r.idglobal AND c.route_id=r.iddetalleruta
         WHERE s.idglobal=? AND s.str_estado<>'inactiva' AND (?=0 OR s.idoficina=?)
           AND (?=1 OR EXISTS(SELECT 1 FROM tbl_auth_sucursal g
             JOIN tbl_auths x ON x.idauth_sucursal=g.idauth_sucursal JOIN tbl_auth a ON a.idauth=x.idauth
             WHERE g.idglobal=s.idglobal AND g.idsucursal=s.idsucursal AND g.idempleado=?
               AND g.str_estado<>'inactivo' AND a.str_nombre='despachar'))
         ORDER BY s.str_codigo,s.idsucursal",
         [$actor['companyId'],$office,$office,(int)$actor['super'],$actor['employeeId']]);
      $assigned = $this->rows("SELECT DISTINCT r.iddetalleruta AS routeId,e.idempleado AS employeeId,
         TRIM(CONCAT_WS(' ',p.str_nombres,p.str_apellidos)) AS name
         FROM tbl_detalle_ruta r JOIN tbl_empleados_cobrando a ON a.id_detalle_ruta=r.iddetalleruta
         JOIN tbl_empleado e ON e.idempleado=a.idempleado AND e.idglobal=r.idglobal
         JOIN tbl_persona p ON p.idpersona=e.idpersona AND p.idglobal=e.idglobal
         WHERE r.idglobal=? AND r.iddetalleruta IN (" .
         ($branches ? implode(',',array_fill(0,count($branches),'?')) : 'NULL') . ")
         ORDER BY name,e.idempleado",
         array_merge([$actor['companyId']],array_map(fn($b)=>(int)($b['routeId'] ?? 0),$branches)));
      $assignedByRoute=[];
      foreach ($assigned as $employee) {
         $assignedByRoute[(int)$employee['routeId']][]=[
            'employeeId'=>(int)$employee['employeeId'],'name'=>$employee['name']];
      }
      return ['branches'=>array_map(function ($b) use ($assignedByRoute) {
         foreach (['branchId','holderEmployeeId','version','assignedCount'] as $key) $b[$key]=(int)$b[$key];
         $b['routeId']=$b['routeId']===null ? null : (int)$b['routeId'];
         $b['assignedEmployees']=$assignedByRoute[$b['routeId']] ?? [];
         return $b;
      },$branches)];
   }

   private function employees(array $scope): array
   {
      return $this->rows("SELECT DISTINCT e.idempleado AS employeeId,
         TRIM(CONCAT_WS(' ',p.str_nombres,p.str_apellidos)) AS name,eo.idoficina AS officeId,eo.str_nombre AS officeName,
         e.idempleado=? AS representative,
         EXISTS(SELECT 1 FROM view_employee_payroll_active_coverage v WHERE v.idglobal=e.idglobal
           AND v.branch_id=? AND v.replacement_employee_id=e.idempleado) AS replacement
         FROM tbl_empleado e JOIN tbl_persona p ON p.idglobal=e.idglobal AND p.idpersona=e.idpersona
         LEFT JOIN tbl_oficina eo ON eo.idglobal=e.idglobal AND eo.idoficina=e.idoficina
         WHERE e.idglobal=? AND e.str_estado='activo'
           AND EXISTS(SELECT 1 FROM tbl_nomina n WHERE n.idglobal=e.idglobal
             AND n.idempleado=e.idempleado AND n.str_estado='activo')
           AND (?=1 OR (?=1 AND e.idoficina=?) OR e.idempleado IN (?,?)
             OR EXISTS(SELECT 1 FROM tbl_empleados_asignado a
               WHERE a.idempleado=? AND a.idempleado_asignado=e.idempleado))
         ORDER BY name,e.idempleado", [(int)$scope['branch']['holderEmployeeId'],(int)$scope['branch']['branchId'],
            $scope['companyId'],(int)$scope['super'],(int)$scope['officeAdmin'],
            (int)$scope['branch']['officeId'],(int)$scope['branch']['holderEmployeeId'],
            $scope['employeeId'],$scope['employeeId']]);
   }

   private function route(array $scope, bool $lock = false): ?array
   {
      $rows = $this->rows("SELECT r.iddetalleruta AS routeId,r.str_estado AS state,
         COALESCE(c.version,0) AS version,
         COALESCE(DATE(r.created_at)>DATE(UTC_TIMESTAMP()-INTERVAL 5 HOUR),0) AS futureOpened FROM tbl_detalle_ruta r
         LEFT JOIN tbl_dispatch_control c ON c.idglobal=r.idglobal AND c.route_id=r.iddetalleruta
         WHERE r.idglobal=? AND r.idsucursal=? AND r.str_estado<>'saved'
         ORDER BY r.iddetalleruta DESC LIMIT 1" . ($lock ? ' FOR UPDATE' : ''),
         [$scope['companyId'],(int)$scope['branch']['branchId']]);
      if (!$rows) return null;
      if ($rows[0]['futureOpened']) throw new RuntimeException('El despacho tiene una apertura futura; revise sus datos antes de operar.',409);
      return ['routeId'=>(int)$rows[0]['routeId'],'state'=>$rows[0]['state'],'version'=>(int)$rows[0]['version']];
   }

   private function distribution(array $scope, ?array $route): array
   {
      if ($route) {
         $header=$this->rows('SELECT mode FROM tbl_employee_payroll_route WHERE idglobal=? AND route_id=?',
            [$scope['companyId'],$route['routeId']]);
         $weights=$this->rows('SELECT employee_id AS employeeId,weight FROM tbl_employee_payroll_snapshot
            WHERE idglobal=? AND route_id=? ORDER BY employee_id',[$scope['companyId'],$route['routeId']]);
         return ['mode'=>$header[0]['mode'] ?? 'Titular','weights'=>self::weightRows($weights),'source'=>'snapshot',
            'snapshotPresent'=>(bool)$header];
      }
      $rules=$this->rows('SELECT id,mode FROM tbl_employee_payroll_branch_rule
         WHERE idglobal=? AND branch_id=? ORDER BY id DESC LIMIT 1',
         [$scope['companyId'],(int)$scope['branch']['branchId']]);
      $weights=$rules ? $this->rows('SELECT employee_id AS employeeId,weight FROM tbl_employee_payroll_weight
         WHERE rule_id=? ORDER BY employee_id',[(int)$rules[0]['id']]) : [];
      return ['mode'=>$rules[0]['mode'] ?? 'Titular','weights'=>self::weightRows($weights),'source'=>'branch'];
   }

   private static function weightRows(array $weights): array
   {
      return array_map(fn($p)=>['employeeId'=>(int)$p['employeeId'],'weight'=>(float)$p['weight']],$weights);
   }

   public function context(int $branchId): array
   {
      $scope=$this->scope($branchId);
      $route=$this->route($scope);
      $assigned=$route ? $this->rows('SELECT idempleado FROM tbl_empleados_cobrando WHERE id_detalle_ruta=?',
         [$route['routeId']]) : [];
      $ids=array_map('intval',array_column($assigned,'idempleado'));
      $employees=$this->employees($scope);
      foreach ($employees as &$e) {
         $e['employeeId']=(int)$e['employeeId'];
         $e['officeId']=$e['officeId']===null ? null : (int)$e['officeId'];
         $e['representative']=(bool)$e['representative'];
         $e['replacement']=(bool)$e['replacement'];
         $e['selected']=in_array($e['employeeId'],$ids,true);
      }
      unset($e);
      $challenges=$route ? $this->rows('SELECT employee_id AS employeeId,deadline,
         increment_percent AS incrementPercent,capital_goal AS capitalGoal,collection_goal AS collectionGoal,description
         FROM tbl_dispatch_challenge WHERE idglobal=? AND route_id=? ORDER BY employee_id',
         [$scope['companyId'],$route['routeId']]) : [];
      foreach ($challenges as &$c) {
         $c['employeeId']=(int)$c['employeeId'];
         foreach (['incrementPercent','capitalGoal','collectionGoal'] as $key) $c[$key]=(float)$c[$key];
         $c['assigned']=in_array($c['employeeId'],$ids,true);
      }
      unset($c);
      $scope['branch']['canSaveDispatch']=$scope['branch']['canDispatch'] && (!$route || $route['state']==='created');
      return ['branch'=>$scope['branch'],'route'=>$route,'employees'=>$employees,
         'distribution'=>$this->distribution($scope,$route),'canConfigureDistribution'=>$scope['canConfigureDistribution'] && !$route,
         'canSetChallenges'=>$scope['canSetChallenges'],'challenges'=>$challenges];
   }

   public static function positiveId($value): int
   {
      $id=filter_var($value,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
      if (!$id) throw new RuntimeException('Identificador no válido.',422);
      return $id;
   }

   private static function version($value): int
   {
      $v=filter_var($value,FILTER_VALIDATE_INT,['options'=>['min_range'=>0]]);
      if ($v===false) throw new RuntimeException('Versión no válida.',422);
      return $v;
   }

   public static function challengeInput(array $data): array
   {
      $deadline=NominaEmpleado::validarFecha($data['deadline'] ?? null);
      $today=date('Y-m-d');
      if ($deadline<$today || $deadline>(new DateTimeImmutable($today))->modify('+366 days')->format('Y-m-d')) {
         throw new RuntimeException('El corte debe estar entre hoy y 366 días.',422);
      }
      $percent=$data['incrementPercent'] ?? null;
      if (!is_numeric($percent) || !is_finite((float)$percent) || $percent<0.1 || $percent>40 ||
          abs($percent*1000-round($percent*1000))>0.000001) {
         throw new RuntimeException('El incremento debe estar entre 0.1 y 40 por ciento.',422);
      }
      $result=['employeeId'=>self::positiveId($data['employeeId'] ?? null),'deadline'=>$deadline,
         'incrementPercent'=>(float)$percent];
      foreach (['capitalGoal','collectionGoal'] as $field) {
         $n=$data[$field] ?? null;
         if (!is_numeric($n) || !is_finite((float)$n) || $n<0 || $n>999999999999.99 ||
             abs($n*100-round($n*100))>0.000001) throw new RuntimeException('Meta monetaria no válida.',422);
         $result[$field]=(float)$n;
      }
      $text=array_key_exists('description',$data) ? $data['description'] : '';
      $length=is_string($text) ? preg_match_all('/[\s\S]/u',$text) : false;
      if ($length===false || $length>250) {
         throw new RuntimeException('Descripción debe ser texto, máximo 250 caracteres.',422);
      }
      $result['description']=trim($text);
      return $result;
   }

   private function selected(array $scope, $ids): array
   {
      if (!is_array($ids) || !$ids || count($ids)>10000) throw new RuntimeException('Seleccione empleados.',422);
      $ids=array_map([self::class,'positiveId'],$ids);
      if (count(array_unique($ids))!==count($ids)) throw new RuntimeException('Empleados repetidos.',422);
      sort($ids);
      $allowed=array_map('intval',array_column($this->employees($scope),'employeeId'));
      foreach ($ids as $id) if (!in_array($id,$allowed,true)) throw new RuntimeException('Empleado no autorizado para este despacho.',403);
      return $ids;
   }

   private function allocation(array $scope,array $ids,?array $override): array
   {
      $rule=$override ?? $this->distribution($scope,null);
      $mode=$rule['mode'] ?? '';
      if (!in_array($mode,['Titular','Igual','Personalizado'],true)) throw new RuntimeException('Reparto no válido.',422);
      $weights=[];
      if ($mode==='Titular') $weights[(int)$scope['branch']['holderEmployeeId']]=100;
      elseif ($mode==='Igual') foreach ($ids as $id) $weights[$id]=100/count($ids);
      else {
         if (!is_array($rule['weights'] ?? null)) throw new RuntimeException('Pesos obligatorios.',422);
         foreach ($rule['weights'] as $part) {
            if (!is_array($part)) throw new RuntimeException('Peso personalizado no válido.',422);
            $id=self::positiveId($part['employeeId'] ?? null);
            $weight=$part['weight'] ?? null;
            if (isset($weights[$id]) || !in_array($id,$ids,true) || !is_numeric($weight) ||
                !is_finite((float)$weight) || $weight<=0 || $weight>100) {
               throw new RuntimeException('Reparto personalizado requiere empleados seleccionados y pesos válidos.',422);
            }
            $weights[$id]=(float)$weight;
         }
         if (abs(array_sum($weights)-100)>0.00000001) throw new RuntimeException('Pesos deben sumar 100.',422);
      }
      $parts=[];
      foreach ($weights as $id=>$weight) {
         $contracts=$this->rows("SELECT id AS contractId,salary_type AS type,capital_rate AS capitalRate,
            collection_rate AS collectionRate FROM tbl_employee_payroll_contract
            WHERE idglobal=? AND employee_id=? AND effective_date<=DATE(UTC_TIMESTAMP()-INTERVAL 5 HOUR)
            ORDER BY effective_date DESC LIMIT 1",[$scope['companyId'],$id]);
         $c=$contracts[0] ?? ['contractId'=>null,'type'=>null,'capitalRate'=>0,'collectionRate'=>0];
         $parts[]=$c+['employeeId'=>$id,'weight'=>$weight];
      }
      return ['mode'=>$mode,'parts'=>$parts];
   }

   private static function canonical($value)
   {
      if (!is_array($value)) return $value;
      if (!array_is_list($value)) ksort($value);
      return array_map([self::class,'canonical'],$value);
   }

   public function write(string $action,array $data): array
   {
      if (!in_array($action,['save','challenge'],true)) throw new RuntimeException('Acción no válida.',422);
      $fields=$action==='save' ? ['branchId','expectedVersion','expectedRouteId','employeeIds','distribution','challenges','idempotencyToken'] :
         ['branchId','routeId','expectedVersion','employeeId','deadline','incrementPercent','capitalGoal','collectionGoal','description','idempotencyToken'];
      if (array_diff(array_keys($data),$fields)) throw new RuntimeException('Campos de despacho no válidos.',422);
      if (isset($data['distribution']) && !is_array($data['distribution'])) throw new RuntimeException('Reparto no válido.',422);
      $branchId=self::positiveId($data['branchId'] ?? null);
      $token=$data['idempotencyToken'] ?? '';
      if (!is_string($token) || !preg_match('/^[A-Za-z0-9_-]{16,100}$/D',$token)) throw new RuntimeException('Token obligatorio.',422);
      $expected=self::version($data['expectedVersion'] ?? null);
      $requested=self::version($data[$action==='save' ? 'expectedRouteId' : 'routeId'] ?? null);
      $hash=hash('sha256',json_encode(self::canonical([$action,$data]),JSON_THROW_ON_ERROR));
      $this->db->begin_transaction();
      try {
         $scope=$this->scope($branchId,true);
         $route=$this->route($scope,true);
         if ($route && $route['state']!=='created') throw new RuntimeException('El despacho está cerrado o entregándose.',409);
         if ($action==='challenge' || !empty($data['challenges'])) {
            if (!$scope['canSetChallenges']) throw new RuntimeException('Requiere SA o administrador de esta oficina con permiso poner_retos en esta sucursal.',403);
         }
         if (isset($data['distribution']) && (!$scope['super'] || $requested!==0)) {
            throw new RuntimeException('Sólo SA configura reparto al crear un despacho nuevo.',403);
         }
         $prior=$this->rows('SELECT actor_user_id,payload_hash,result_json FROM tbl_dispatch_request
            WHERE idglobal=? AND token=? FOR UPDATE',[$scope['companyId'],$token]);
         if ($prior) {
            if ((int)$prior[0]['actor_user_id']!==$scope['userId'] || $prior[0]['payload_hash']!==$hash) {
               throw new RuntimeException('Token reutilizado con otros datos.',409);
            }
            $result=json_decode($prior[0]['result_json'],true,32,JSON_THROW_ON_ERROR);
            $result['duplicate']=true;
            $this->db->commit();
            return $result;
         }
         if (($route['routeId'] ?? 0)!==$requested || ($route['version'] ?? 0)!==$expected) {
            throw new RuntimeException('El despacho cambió; recargue antes de guardar.',409);
         }
         $now=date('Y-m-d H:i:s');
         $warnings=[];
         if ($action==='save') {
            $ids=$this->selected($scope,$data['employeeIds'] ?? null);
            if (!$route) {
               $allocation=$this->allocation($scope,$ids,$data['distribution'] ?? null);
               $this->rows("INSERT INTO tbl_detalle_ruta(idglobal,idsucursal,idempleado_resibe,str_estado,created_at,updated_at)
                  VALUES(?,?,0,'created',?,?)",[$scope['companyId'],$branchId,$now,$now]);
               $route=['routeId'=>(int)$this->db->insert_id,'state'=>'created','version'=>0];
               $this->rows('INSERT INTO tbl_employee_payroll_route(idglobal,route_id,branch_id,rule_id,mode,opened_at)
                  VALUES(?,?,?,NULL,?,?)',[$scope['companyId'],$route['routeId'],$branchId,$allocation['mode'],$now]);
               foreach ($allocation['parts'] as $p) $this->rows('INSERT INTO tbl_employee_payroll_snapshot
                  (idglobal,route_id,employee_id,contract_id,salary_type,weight,capital_rate,collection_rate)
                  VALUES(?,?,?,?,?,?,?,?)',[$scope['companyId'],$route['routeId'],$p['employeeId'],
                     $p['contractId'],$p['type'],$p['weight'],$p['capitalRate'],$p['collectionRate']]);
            } else {
               $warnings[]='Los empleados operativos cambian, pero el reparto y las tasas congelados de nómina NO se modifican.';
               $this->rows('DELETE FROM tbl_empleados_cobrando WHERE id_detalle_ruta=?',[$route['routeId']]);
            }
            foreach ($ids as $id) $this->rows("INSERT INTO tbl_empleados_cobrando
               (idempleadoscobrando,idempleado,id_detalle_ruta,str_estado) VALUES(?,?,?,'created')",
               [bin2hex(random_bytes(16)),$id,$route['routeId']]);
         } else {
            if (!$route) throw new RuntimeException('Despacho no encontrado.',404);
            $ids=array_map('intval',array_column($this->rows('SELECT idempleado FROM tbl_empleados_cobrando
               WHERE id_detalle_ruta=?',[$route['routeId']]),'idempleado'));
         }
         $version=$expected+1;
         $this->rows('INSERT INTO tbl_dispatch_control
            (idglobal,route_id,branch_id,version,distribution_override,actor_user_id,created_at,updated_at)
            VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE version=VALUES(version),updated_at=VALUES(updated_at)',
            [$scope['companyId'],$route['routeId'],$branchId,$version,
               isset($data['distribution']) ? json_encode($data['distribution'],JSON_THROW_ON_ERROR) : null,
               $scope['userId'],$now,$now]);
         $challenges=$action==='challenge' ? [$data] : ($data['challenges'] ?? []);
         if (!is_array($challenges)) throw new RuntimeException('Retos no válidos.',422);
         $seen=[];
         $eligible=array_map('intval',array_column($this->employees($scope),'employeeId'));
         foreach ($challenges as $raw) {
            if (!is_array($raw)) throw new RuntimeException('Reto no válido.',422);
            $c=self::challengeInput($raw);
            if (!in_array($c['employeeId'],$ids,true) || isset($seen[$c['employeeId']])) throw new RuntimeException('Reto sólo para empleado despachado, sin duplicados.',422);
            $seen[$c['employeeId']]=true;
            if (!in_array($c['employeeId'],$eligible,true)) throw new RuntimeException('Empleado del reto no autorizado.',403);
            $this->rows('INSERT INTO tbl_dispatch_challenge
               (idglobal,route_id,employee_id,deadline,increment_percent,capital_goal,collection_goal,description,actor_user_id,created_at,updated_at)
               VALUES(?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE deadline=VALUES(deadline),
               increment_percent=VALUES(increment_percent),capital_goal=VALUES(capital_goal),collection_goal=VALUES(collection_goal),
               description=VALUES(description),actor_user_id=VALUES(actor_user_id),updated_at=VALUES(updated_at)',
               [$scope['companyId'],$route['routeId'],$c['employeeId'],$c['deadline'],$c['incrementPercent'],
                  $c['capitalGoal'],$c['collectionGoal'],$c['description'],$scope['userId'],$now,$now]);
         }
         $result=['ok'=>true,'routeId'=>$route['routeId'],'version'=>$version,'duplicate'=>false,'warnings'=>$warnings];
         $this->rows('INSERT INTO tbl_dispatch_request(idglobal,token,actor_user_id,payload_hash,result_json,created_at)
            VALUES(?,?,?,?,?,?)',[$scope['companyId'],$token,$scope['userId'],$hash,json_encode($result,JSON_THROW_ON_ERROR),$now]);
         $this->db->commit();
         return $result;
      } catch (Throwable $e) {
         $this->db->rollback();
         if ($e instanceof mysqli_sql_exception && in_array($e->getCode(),[1205,1213,1062],true)) {
            throw new RuntimeException('Conflicto concurrente; reintente con el mismo token.',409);
         }
         throw $e;
      }
   }

   public function forecast(array $data): array
   {
      $this->collectionCards=[];
      $branchId=self::positiveId($data['branchId'] ?? null);
      $scope=$this->scope($branchId);
      $input=self::challengeInput($data+['capitalGoal'=>0,'collectionGoal'=>0,'description'=>'Estimación']);
      $route=$this->route($scope);
      $requested=self::version($data['routeId'] ?? 0);
      if (($route['routeId'] ?? 0)!==$requested || ($route && $route['state']!=='created')) {
         throw new RuntimeException('El despacho cambió o está cerrado.',409);
      }
      if ($route) {
         $ids=array_map('intval',array_column($this->rows('SELECT idempleado FROM tbl_empleados_cobrando
            WHERE id_detalle_ruta=?',[$requested]),'idempleado'));
         $allowed=array_map('intval',array_column($this->employees($scope),'employeeId'));
         if (!in_array($input['employeeId'],$allowed,true)) throw new RuntimeException('Empleado no autorizado.',403);
         $parts=$this->rows('SELECT employee_id AS employeeId,contract_id AS contractId,salary_type AS type,
            weight,capital_rate AS capitalRate,collection_rate AS collectionRate FROM tbl_employee_payroll_snapshot
            WHERE idglobal=? AND route_id=?',[$scope['companyId'],$requested]);
      } else {
         $ids=$this->selected($scope,$data['employeeIds'] ?? [$input['employeeId']]);
         if (isset($data['distribution']) && !$scope['super']) throw new RuntimeException('Reparto sólo SA.',403);
         if (isset($data['distribution']) && !is_array($data['distribution'])) throw new RuntimeException('Reparto no válido.',422);
         $parts=$this->allocation($scope,$ids,$data['distribution'] ?? null)['parts'];
      }
      if (!in_array($input['employeeId'],$ids,true)) throw new RuntimeException('Empleado no despachado.',403);
      $part=null;
      foreach ($parts as $p) if ((int)$p['employeeId']===$input['employeeId']) $part=$p;
      $salary=(new NominaEmpleado($this->db))->resumen($scope['companyId'],$input['employeeId'],$input['deadline'])['periods'][0];
      $credited=$this->rows('SELECT COALESCE(SUM(capitalCommission+collectionCommission),0) AS amount
         FROM view_employee_payroll_breakdown WHERE idglobal=? AND employeeId=? AND routeId=?
         AND movementDate BETWEEN ? AND ?',[$scope['companyId'],$input['employeeId'],$requested,
            $salary['startDate'],$input['deadline']])[0]['amount'];
      $calculation=self::goal($salary,$part,(float)$credited,$input,$this->db);
      $coverage=$this->rows("SELECT 1 AS affected FROM tbl_employee_payroll_vacation
         WHERE idglobal=? AND employee_id=? AND start_date<=? AND end_date>=GREATEST(?,DATE(UTC_TIMESTAMP()-INTERVAL 5 HOUR))
         UNION ALL SELECT 1 FROM tbl_employee_payroll_coverage
         WHERE idglobal=? AND branch_id=? AND replacement_employee_id=? AND start_date<=?
           AND end_date>=GREATEST(?,DATE(UTC_TIMESTAMP()-INTERVAL 5 HOUR)) LIMIT 1",
         [$scope['companyId'],$input['employeeId'],$input['deadline'],$salary['startDate'],
            $scope['companyId'],$branchId,$input['employeeId'],$input['deadline'],$salary['startDate']]);
      if ($coverage) {
         $calculation['status']='insufficient_data';
         $calculation['warnings'][]='El rango contiene vacaciones/relevo: la participación futura depende de la fecha de cada movimiento; esta simulación simple no garantiza la comisión.';
      }
      $collections=$this->collections($scope,$input['deadline']);
      return ['estimated'=>true,'status'=>($calculation['status']==='insufficient_data' ||
            $collections['status']==='insufficient_data') ? 'insufficient_data' : 'available',
         'warnings'=>array_merge($calculation['warnings'],$collections['warnings']),'salary'=>$salary,
         'allocation'=>$calculation['allocation'],'goal'=>$calculation['goal'],'collections'=>$collections];
   }

   public static function goal(array $salary,?array $part,float $routeCommission,array $input,?mysqli $db=null): array
   {
      global $conexion;
      $statement=($db ?? $conexion)->prepare('CALL sp_dispatch_challenge_goal(?,?,?,?)');
      $salaryJson=json_encode($salary,JSON_THROW_ON_ERROR);
      $partJson=json_encode($part,JSON_THROW_ON_ERROR);
      $inputJson=json_encode($input,JSON_THROW_ON_ERROR);
      $statement->bind_param('ssds',$salaryJson,$partJson,$routeCommission,$inputJson);
      try {
         $statement->execute();
         $row=$statement->get_result()->fetch_assoc();
         while ($statement->more_results()) { $statement->next_result(); $extra=$statement->get_result(); if ($extra) $extra->free(); }
      } finally { $statement->close(); }
      $capitalRate=(float)$row['capitalRate']; $collectionRate=(float)$row['collectionRate'];
      $base=(float)$salary['baseAmount'];
      $warnings=[];
      if (!$part) $warnings[]='Empleado sin participación en el snapshot; cambiar asignados no reescribe nómina.';
      if (!$salary['configured'] || $base<=0) $warnings[]='Sin sueldo básico positivo al corte: no se puede proponer un incremento porcentual del básico.';
      if ($capitalRate<=0 || (float)$row['weight']<=0) $warnings[]='No hay tasa/participación de capital comisionable; no se puede dividir por cero.';
      if ($collectionRate<=0 || (float)$row['weight']<=0) $warnings[]='No hay tasa/participación de recaudo comisionable; no se puede dividir por cero.';
      $warnings[]='Las metas de capital/recaudo son movimientos adicionales de esta cartera dentro del período salarial al corte, no pagos ni bonos.';
      $allocation=['weight'=>(float)$row['weight'],'capitalRate'=>$capitalRate,'collectionRate'=>$collectionRate];
      $progress=['creditedCapital'=>(float)$row['creditedCapital'],'creditedCollection'=>(float)$row['creditedCollection']];
      $status=$row['status']; unset($row['status'],$row['weight'],$row['capitalRate'],$row['collectionRate'],$row['creditedCapital'],$row['creditedCollection']);
      foreach ($row as &$value) $value=$value===null ? null : (float)$value;
      unset($value);
      return ['status'=>$status,'warnings'=>$warnings,'salary'=>$salary,'allocation'=>$allocation,'goal'=>$row,'progress'=>$progress];
   }

   public function own(): array
   {
      $this->collectionCards=[];
      $actor=$this->actor();
      if ($actor['employeeId']<=0) throw new RuntimeException('No hay empleado activo en esta sesión.',403);
      $today=date('Y-m-d');
      $rows=$this->rows('SELECT * FROM view_dispatch_challenge_progress WHERE idglobal=? AND employeeId=?
         ORDER BY deadline DESC,challengeId DESC',[$actor['companyId'],$actor['employeeId']]);
      $items=[]; $forecasts=[];
      foreach ($rows as $row) {
         $salary=(new NominaEmpleado($this->db))->resumen($actor['companyId'],$actor['employeeId'],$row['deadline'])['periods'][0];
         $credited=$this->rows('SELECT COALESCE(SUM(capitalCommission+collectionCommission),0) AS total,
            COALESCE(SUM(IF(routeId=?,capitalCommission+collectionCommission,0)),0) AS credited
            FROM view_employee_payroll_breakdown WHERE idglobal=? AND employeeId=? AND movementDate BETWEEN ? AND ?',
            [(int)$row['routeId'],$actor['companyId'],$actor['employeeId'],$salary['startDate'],min($today,$row['deadline'])])[0];
         $salary['commissionAmount']=(float)$credited['total'];
         $parts=$this->rows('SELECT contract_id AS contractId,salary_type AS type,weight,
            capital_rate AS capitalRate,collection_rate AS collectionRate FROM tbl_employee_payroll_snapshot
            WHERE idglobal=? AND route_id=? AND employee_id=?',
            [$actor['companyId'],(int)$row['routeId'],$actor['employeeId']]);
         $goal=self::goal($salary,$parts[0] ?? null,(float)$credited['credited'],$row,$this->db);
         $cover=$this->rows('SELECT 1 FROM tbl_employee_payroll_vacation WHERE idglobal=? AND employee_id=?
            AND start_date<=? AND end_date>=GREATEST(?,?) UNION ALL
            SELECT 1 FROM tbl_employee_payroll_coverage WHERE idglobal=? AND branch_id=? AND replacement_employee_id=?
            AND start_date<=? AND end_date>=GREATEST(?,?) LIMIT 1',
            [$actor['companyId'],$actor['employeeId'],$row['deadline'],$salary['startDate'],$today,
             $actor['companyId'],(int)$row['branchId'],$actor['employeeId'],$row['deadline'],$salary['startDate'],$today]);
         $collections=null;
         if ($row['deadline']>=$today && $row['routeState']==='created' && $row['assigned']) {
            $key=$row['branchId'] . ':' . $row['deadline'];
            if (!isset($forecasts[$key])) {
               $forecast=$this->collections($actor+['branch'=>['branchId'=>(int)$row['branchId']]],$row['deadline']);
               $forecast['invalidReasons']=array_values(array_unique(array_column($forecast['invalidCards'],'reason')));
               unset($forecast['invalidCards']);
               $forecasts[$key]=$forecast;
            }
            $collections=$forecasts[$key];
         }
         $items[]=self::bridge(['action'=>'own','row'=>$row,'salary'=>$salary,
            'goal'=>['status'=>$goal['status']]+$goal['allocation']+$goal['goal']+$goal['progress'],
            'today'=>$today,'collections'=>$collections,'coverage'=>(bool)$cover]);
      }
      return ['employeeId'=>$actor['employeeId'],'asOf'=>$today,'items'=>$items];
   }

   private function collections(array $scope,string $deadline): array
   {
      $key=$scope['companyId'] . ':' . $scope['branch']['branchId'];
      if (isset($this->collectionCards[$key])) return self::bridge(
         ['cards'=>$this->collectionCards[$key],'today'=>date('Y-m-d'),'deadline'=>$deadline]);
      $cards=$this->rows("SELECT idtarjeta AS id,str_estado AS status,str_modo AS mode,int_tiempo AS term,
         ROUND(dec_valor*100) AS valueCents,ROUND(dec_resta*100) AS balanceCents,
         CONCAT(DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s'),'-05:00') AS createdAtUtc
         FROM tbl_tarjetas WHERE idglobal=? AND idsucursal=? AND (str_estado<>'cancelado' OR dec_resta<>0)",
         [$scope['companyId'],(int)$scope['branch']['branchId']]);
      if (count($cards)>20000) throw new RuntimeException('Cartera demasiado grande para estimación síncrona.',422);
      $payments=$this->rows("SELECT d.idtarjeta AS cardId,ROUND(d.dec_abono*100) AS amountCents,
         d.str_descripcion AS description,CONCAT(DATE_FORMAT(d.created_at,'%Y-%m-%dT%H:%i:%s'),'-05:00') AS createdAtUtc
         FROM tbl_descripcion d JOIN tbl_tarjetas t ON t.idglobal=d.idglobal AND t.idtarjeta=d.idtarjeta
         WHERE t.idglobal=? AND t.idsucursal=? AND (t.str_estado<>'cancelado' OR t.dec_resta<>0)",
         [$scope['companyId'],(int)$scope['branch']['branchId']]);
      $index=[];
      foreach ($cards as $i=>&$c) {
         foreach (['term','valueCents','balanceCents'] as $field) $c[$field]=$c[$field]===null ? null : (int)$c[$field];
         $c['payments']=[]; $index[$c['id']]=$i;
      }
      unset($c);
      foreach ($payments as $p) {
         $id=$p['cardId']; unset($p['cardId']);
         $p['amountCents']=$p['amountCents']===null ? null : (int)$p['amountCents'];
         $cards[$index[$id]]['payments'][]=$p;
      }
      $this->collectionCards[$key]=$cards;
      return self::bridge(['cards'=>$cards,'today'=>date('Y-m-d'),'deadline'=>$deadline]);
   }

   private static function bridge(array $data): array
   {
      $binary=getenv('DISPATCH_FORECAST_NODE_BINARY') ?: 'node';
      $script=realpath(__DIR__ . '/../../backend-creditos-apk/scripts/dispatch-forecast.mjs');
      if (!$script) throw new RuntimeException('No está instalado el motor compartido de estimación.',503);
      $payload=json_encode($data,JSON_THROW_ON_ERROR);
      if (strlen($payload)>20000000) throw new RuntimeException('Datos de cartera exceden el límite de la estimación.',422);
      $process=proc_open([$binary,$script],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes,
         dirname($script),null,['bypass_shell'=>true]);
      if (!is_resource($process)) throw new RuntimeException('Motor Node de estimación no disponible.',503);
      $offset=0; $out=''; $error=''; $finish=microtime(true)+15;
      foreach ($pipes as $pipe) stream_set_blocking($pipe,false);
      try {
         while (true) {
            $status=proc_get_status($process);
            if (!$status['running']) {
               $out.=stream_get_contents($pipes[1]);
               $error.=stream_get_contents($pipes[2]);
               break;
            }
            if (microtime(true)>$finish) throw new RuntimeException('Tiempo de estimación agotado; reduzca el rango o revise el motor.',503);
            $read=[];
            foreach ([1,2] as $index) if (!feof($pipes[$index])) $read[]=$pipes[$index];
            $write=isset($pipes[0]) ? [$pipes[0]] : [];
            $except=null;
            if (!$read && !$write) { usleep(10000); continue; }
            if (stream_select($read,$write,$except,0,200000)===false) throw new RuntimeException('Error de comunicación con el motor de estimación.',503);
            foreach ($read as $pipe) {
               $chunk=fread($pipe,65536);
               if ($chunk===false) throw new RuntimeException('No se pudo leer la estimación.',503);
               if ($pipe===$pipes[1]) $out.=$chunk; else $error.=$chunk;
            }
            foreach ($write as $pipe) {
               $written=fwrite($pipe,substr($payload,$offset,65536));
               if ($written===false) throw new RuntimeException('No se pudo enviar la cartera al motor de estimación.',503);
               $offset+=$written;
               if ($offset===strlen($payload)) { fclose($pipes[0]); unset($pipes[0]); }
            }
            if (strlen($out)>2000000 || strlen($error)>65536) throw new RuntimeException('Respuesta del motor excede el límite admitido.',503);
         }
      } finally {
         if (proc_get_status($process)['running']) proc_terminate($process,9);
         foreach ($pipes as $pipe) fclose($pipe);
         proc_close($process);
      }
      if ($status['exitcode']!==0 || $offset!==strlen($payload)) {
         error_log('Despacho forecast: ' . $error);
         throw new RuntimeException('No se pudo calcular la estimación; verifique Node y el build del motor compartido.',503);
      }
      try { $result=json_decode($out,true,32,JSON_THROW_ON_ERROR); }
      catch (JsonException $e) {
         error_log('Despacho forecast JSON: ' . $e->getMessage());
         throw new RuntimeException('Respuesta inválida del motor compartido de estimación.',503);
      }
      if (!is_array($result)) throw new RuntimeException('Respuesta inválida del motor compartido de estimación.',503);
      return $result;
   }
}
