<?php
require_once __DIR__ . '/Conexion.php';

class NominaEmpleado
{
   private $db;

   public function __construct($db = null)
   {
      global $conexion;
      $this->db = $db ?? $conexion;
   }

   private function query($sql, $params = [])
   {
      $statement = $this->db->prepare($sql);
      if (!$statement) throw new RuntimeException('No se pudo preparar nómina.');
      if ($params) {
         $types = '';
         foreach ($params as $value) $types .= is_int($value) ? 'i' : 's';
         $statement->bind_param($types, ...$params);
      }
      try {
         $statement->execute();
      } catch (mysqli_sql_exception $error) {
         $statement->close();
         if (in_array($error->getCode(), [1205,1213], true)) {
            throw new RuntimeException('Conflicto concurrente; reintente con el mismo token de solicitud.', 409);
         }
         $message = $error->getMessage();
         if (strpos($message, 'PAYROLL_') !== false) {
            $code = strpos($message, 'UNAUTHENTICATED') !== false ? 401 :
               (strpos($message, 'FORBIDDEN') !== false ? 403 :
               ((strpos($message, 'CONFLICT') !== false || strpos($message, 'ROUTE_CLOSED') !== false) ? 409 : 422));
            throw new RuntimeException($message, $code);
         }
         throw $error;
      }
      $result = $statement->get_result();
      $rows = $result ? $result->fetch_all(MYSQLI_ASSOC) : [];
      $statement->close();
      while ($this->db->more_results()) {
         $this->db->next_result();
         $remaining = $this->db->store_result();
         if ($remaining) $remaining->free();
      }
      return $rows;
   }

   public function actor($companyId, $actorUserId)
   {
      $rows = $this->query("SELECT e.idempleado AS employeeId,e.str_cargo AS cargo,e.idoficina AS officeId
         FROM tbl_usuario u JOIN tbl_empleado e ON e.idpersona=u.idpersona AND e.idglobal=u.idglobal
         WHERE u.idglobal=? AND u.idusuario=? AND u.str_estado='activo' AND e.str_estado='activo'",
         [(int)$companyId, (int)$actorUserId]);
      if (!$rows) throw new RuntimeException('Inicie sesión con un empleado activo.', 401);
      return $rows[0];
   }

   public function autorizarEmpleado($companyId, $actorUserId, $employeeId)
   {
      $actor = $this->actor($companyId, $actorUserId);
      $rows = $this->query("SELECT e.idempleado FROM tbl_empleado e
         LEFT JOIN tbl_oficina o ON o.idoficina=e.idoficina AND o.idglobal=e.idglobal
         WHERE e.idglobal=? AND e.idempleado=? AND
          (?='Super Administrador' OR e.idempleado=? OR o.idempleado_administrador=?)",
         [(int)$companyId, (int)$employeeId, $actor['cargo'], (int)$actor['employeeId'], (int)$actor['employeeId']]);
      if (!$rows) throw new RuntimeException('No tiene acceso a esta nómina.', 403);
      return $actor;
   }

   public static function validarFecha($value)
   {
      if (!is_string($value)) throw new RuntimeException('Fecha no válida.', 422);
      $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
      if (!$date || $date->format('Y-m-d') !== $value) throw new RuntimeException('Fecha no válida.', 422);
      return $value;
   }

   public static function validarCambio($action, $data)
   {
      if (!is_array($data)) throw new RuntimeException('Datos no válidos.', 422);
      if (!is_string($data['idempotencyToken'] ?? null) ||
         !preg_match('/^[A-Za-z0-9_-]{16,100}$/D', $data['idempotencyToken'])) {
         throw new RuntimeException('Token de solicitud no válido.', 422);
      }
      $required = [
         'contrato' => ['employeeId','effectiveDate','type','frequency','baseAmount','capitalRate','collectionRate'],
         'vacacion' => ['employeeId','startDate','endDate','replacementEmployeeId','reason'],
         'bono' => ['employeeId','branchId','routeId','amount','reason'],
         'reparto' => ['branchId','mode','weights']
      ];
      if ($action === 'vacacion' && !array_key_exists('reason', $data)) $data['reason'] = '';
      if (!isset($required[$action])) throw new RuntimeException('Acción no válida.', 422);
      foreach ($required[$action] as $key) {
         if (!array_key_exists($key, $data)) throw new RuntimeException('Falta campo ' . $key, 422);
      }
      if ($action === 'bono' && array_key_exists('date', $data)) throw new RuntimeException('La fecha del bono es la fecha actual de caja.', 422);
      foreach (['employeeId','branchId','routeId','replacementEmployeeId'] as $key) if (isset($data[$key])) {
         if (!filter_var($data[$key], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]])) {
            throw new RuntimeException('Identificador no válido.', 422);
         }
         $data[$key] = (int)$data[$key];
      }
      foreach (['effectiveDate','startDate','endDate','date'] as $key) if (isset($data[$key])) self::validarFecha($data[$key]);
      foreach (['baseAmount','capitalRate','collectionRate','amount'] as $key) if (isset($data[$key])) {
         if (!is_numeric($data[$key]) || !is_finite((float)$data[$key]) || abs((float)$data[$key]) > 999999999999.99) {
            throw new RuntimeException('Monto o tasa no válido.', 422);
         }
         $data[$key] = (float)$data[$key];
      }
      if ($action === 'contrato' &&
         (!in_array($data['type'], ['Fijo','Porcentaje','Combinado'], true) ||
          !in_array($data['frequency'], ['Diario','Semanal','Quincenal','Mensual'], true) ||
          $data['baseAmount'] < 0 || $data['capitalRate'] < 0 || $data['capitalRate'] > 100 ||
          $data['collectionRate'] < 0 || $data['collectionRate'] > 100)) {
         throw new RuntimeException('Contrato no válido.', 422);
      }
      if (isset($data['reason'])) {
         if (!is_string($data['reason'])) throw new RuntimeException('Motivo obligatorio.', 422);
         $data['reason'] = trim($data['reason']);
         if (($action === 'bono' && $data['reason'] === '') || preg_match_all('/[\s\S]/u', $data['reason']) > 250) throw new RuntimeException('Motivo máximo 250 caracteres y obligatorio para bono.', 422);
      }
      if ($action === 'bono' && $data['amount'] <= 0) throw new RuntimeException('Monto de bono debe ser positivo.', 422);
      if ($action === 'bono' && ($data['amount'] > 99999999.99 ||
         abs($data['amount'] * 100 - round($data['amount'] * 100)) > 0.000001)) {
         throw new RuntimeException('Bono debe ser un monto válido con máximo dos decimales.', 422);
      }
      if ($action === 'vacacion' && $data['endDate'] < $data['startDate']) throw new RuntimeException('Rango no válido.', 422);
      if ($action === 'reparto') {
         if (!in_array($data['mode'], ['Titular','Igual','Personalizado'], true) || !is_array($data['weights'])) {
            throw new RuntimeException('Reparto no válido.', 422);
         }
         $ids = []; $sum = 0;
         foreach ($data['weights'] as &$weight) {
            if (!is_array($weight) || !filter_var($weight['employeeId'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) ||
               !is_numeric($weight['weight'] ?? null) || !is_finite((float)$weight['weight']) ||
               (float)$weight['weight'] <= 0 || (float)$weight['weight'] > 100 || isset($ids[$weight['employeeId']])) {
               throw new RuntimeException('Pesos no válidos.', 422);
            }
            $weight['employeeId'] = (int)$weight['employeeId']; $weight['weight'] = (float)$weight['weight'];
            $ids[$weight['employeeId']] = true; $sum += $weight['weight'];
         }
         unset($weight);
         if ($data['mode'] === 'Personalizado' && abs($sum - 100) > 0.00000001) throw new RuntimeException('Pesos deben sumar 100.', 422);
      }
      // Stable key order makes retries identical across JSON/form submissions.
      $result = [];
      foreach (array_merge(['idempotencyToken'], $required[$action]) as $key) $result[$key] = $data[$key];
      if ($action === 'reparto') {
         $result['weights'] = array_map(function ($weight) {
            return ['employeeId' => $weight['employeeId'], 'weight' => $weight['weight']];
         }, $result['weights']);
      }
      return $result;
   }

   private function cambiar($companyId, $actorUserId, $action, $data)
   {
      $data = self::validarCambio($action, $data);
      try {
         $rows = $this->query('CALL sp_employee_payroll_change_v2(?,?,?,?)',
            [(int)$companyId, (int)$actorUserId, $action, json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);
         return ['ok' => (bool)$rows[0]['ok'], 'id' => (string)$rows[0]['id'], 'duplicate' => (bool)$rows[0]['duplicate'],
            'expenseId' => $rows[0]['expenseId'] ?? null, 'branchId' => isset($rows[0]['branchId']) ? (int)$rows[0]['branchId'] : null,
            'routeId' => isset($rows[0]['routeId']) ? (int)$rows[0]['routeId'] : null];
      } catch (mysqli_sql_exception $error) {
         $message = $error->getMessage();
         if (strpos($message, 'PAYROLL_') !== false) {
            $code = strpos($message, 'FORBIDDEN') !== false ? 403 : (strpos($message, 'CONFLICT') !== false ? 409 : 422);
            throw new RuntimeException($message, $code);
         }
         throw $error;
      }
   }

   public function guardarContrato($companyId, $actorUserId, $data) { return $this->cambiar($companyId, $actorUserId, 'contrato', $data); }
   public function guardarVacacion($companyId, $actorUserId, $data) { return $this->cambiar($companyId, $actorUserId, 'vacacion', $data); }
   public function guardarBono($companyId, $actorUserId, $data) { return $this->cambiar($companyId, $actorUserId, 'bono', $data); }
   public function guardarReparto($companyId, $actorUserId, $data) { return $this->cambiar($companyId, $actorUserId, 'reparto', $data); }

   public function bonoContexto($companyId, $actorUserId, $branchId)
   {
      $rows = $this->query('CALL sp_employee_payroll_bonus_context(?,?,?,NULL)',
         [(int)$companyId, (int)$actorUserId, (int)$branchId]);
      if (!$rows) throw new RuntimeException('No hay empleados autorizados en este despacho.', 403);
      return ['branchId' => (int)$rows[0]['branchId'], 'routeId' => (int)$rows[0]['routeId'], 'state' => 'created',
         'employees' => array_map(function ($row) {
            return ['employeeId' => (int)$row['employeeId'], 'name' => $row['name']];
         }, $rows)];
   }

   public function resumen($companyId, $employeeId, $asOf = null)
   {
      if ($asOf !== null) self::validarFecha($asOf);
      $rows = $this->query('CALL sp_employee_payroll_summary(?,?,?)', [(int)$companyId, (int)$employeeId, $asOf]);
      $period = $rows[0];
      $totals = [];
      foreach (['baseAmount','periodBaseAmount','capitalCommission','collectionCommission','commissionAmount','bonusAmount','earnedAmount','paidAmount','pendingAmount'] as $key) {
         $period[$key] = (float)$period[$key]; $totals[$key] = $period[$key];
      }
      $period['agreedBaseAmount'] = (float)$period['agreedBaseAmount'];
      $period['configured'] = (bool)$period['configured'];
      $cutoff = $asOf ?? date('Y-m-d');
      $args = [(int)$companyId, (int)$employeeId, $period['startDate'], $cutoff];
      $breakdown = $this->query("SELECT routeId,branchId,branchName,state,provisional,movementId,
         movementDate,contractId,type,weight,capitalRate,collectionRate,mode,capitalAmount,cashAmount,
         excludedReason,capitalCommission,collectionCommission,vacationId,coveredEmployeeId FROM view_employee_payroll_breakdown
         WHERE idglobal=? AND employeeId=? AND movementDate BETWEEN ? AND ? ORDER BY movementDate,routeId,movementId", $args);
      foreach ($breakdown as &$row) {
         $row['provisional'] = (bool)$row['provisional'];
         foreach (['weight','capitalRate','collectionRate','capitalAmount','cashAmount','capitalCommission','collectionCommission'] as $key) $row[$key] = (float)$row[$key];
      }
      unset($row);
      $routes = $this->query('CALL sp_employee_payroll_routes(?,?,?,?)', $args);
      foreach ($routes as &$row) {
         $row['provisional'] = (bool)$row['provisional'];
         foreach (['weight','capitalRate','collectionRate','capitalCommission','collectionCommission','capitalAmount','cashAmount'] as $key) $row[$key] = (float)$row[$key];
         $row['id'] = (int)$row['routeId'];
         $row['routeId'] = (int)$row['routeId'];
         $row['branchId'] = (int)$row['branchId'];
         $row['contractId'] = $row['contractId'] === null ? null : (string)$row['contractId'];
         $row['openedDate'] = substr($row['openedAt'], 0, 10);
         $row['closed'] = !$row['provisional'];
         $row['sharePercent'] = $row['weight'];
         $row['capitalBasis'] = $row['capitalAmount'];
         $row['collectionBasis'] = $row['cashAmount'];
      }
      unset($row);
      return [
         'employeeId' => (int)$employeeId, 'asOf' => $asOf ?? date('Y-m-d'), 'periods' => [$period], 'totals' => $totals,
         'routes' => $routes, 'breakdown' => $breakdown,
         'contracts' => $this->query("SELECT id AS contractId,effective_date AS effectiveDate,salary_type AS type,frequency,
            base_amount AS baseAmount,capital_rate AS capitalRate,collection_rate AS collectionRate
            FROM tbl_employee_payroll_contract WHERE idglobal=? AND employee_id=? ORDER BY effective_date DESC",
            [(int)$companyId, (int)$employeeId]),
         'vacations' => $this->query("SELECT v.id,v.start_date AS startDate,v.end_date AS endDate,v.reason,
            v.replacement_employee_id AS replacementEmployeeId,CONCAT_WS(' ',p.str_nombres,p.str_apellidos) AS replacementName
            FROM tbl_employee_payroll_vacation v LEFT JOIN tbl_empleado e ON e.idglobal=v.idglobal AND e.idempleado=v.replacement_employee_id
            LEFT JOIN tbl_persona p ON p.idglobal=e.idglobal AND p.idpersona=e.idpersona
            WHERE v.idglobal=? AND v.employee_id=? ORDER BY v.start_date DESC", [(int)$companyId, (int)$employeeId]),
         'bonuses' => $this->query("SELECT id,movement_date AS date,amount,reason,expense_id AS expenseId,cancelled_at AS cancelledAt FROM tbl_employee_payroll_bonus
            WHERE idglobal=? AND employee_id=? ORDER BY movement_date DESC", [(int)$companyId, (int)$employeeId])
      ];
   }

   public function obtenerBootstrap($companyId, $actorUserId)
   {
      $actor = $this->actor($companyId, $actorUserId);
      $employees = $this->query("SELECT e.idempleado AS employeeId,CONCAT_WS(' ',p.str_nombres,p.str_apellidos) AS name,e.idoficina AS officeId
         FROM tbl_empleado e JOIN tbl_persona p ON p.idpersona=e.idpersona AND p.idglobal=e.idglobal
         LEFT JOIN tbl_oficina o ON o.idoficina=e.idoficina AND o.idglobal=e.idglobal
         WHERE e.idglobal=? AND e.str_estado='activo' AND (?='Super Administrador' OR o.idempleado_administrador=? OR e.idempleado=?)
         ORDER BY name", [(int)$companyId, $actor['cargo'], (int)$actor['employeeId'], (int)$actor['employeeId']]);
      $branches = $this->query("SELECT s.idsucursal AS branchId,s.str_codigo AS name,s.idoficina AS officeId,
         s.idempleado AS titularEmployeeId,s.idempleado AS holderId,
         CONCAT_WS(' ',hp.str_nombres,hp.str_apellidos) AS holderName
         FROM tbl_sucursal s JOIN tbl_oficina o ON o.idoficina=s.idoficina AND o.idglobal=s.idglobal
         LEFT JOIN tbl_empleado he ON he.idempleado=s.idempleado AND he.idglobal=s.idglobal
         LEFT JOIN tbl_persona hp ON hp.idpersona=he.idpersona AND hp.idglobal=he.idglobal
         WHERE s.idglobal=? AND (?='Super Administrador' OR o.idempleado_administrador=?) ORDER BY name",
         [(int)$companyId, $actor['cargo'], (int)$actor['employeeId']]);
      $configs = [];
      foreach ($branches as &$branch) {
         $assigned = $this->query("SELECT DISTINCT ec.idempleado AS employeeId,CONCAT_WS(' ',p.str_nombres,p.str_apellidos) AS name FROM tbl_empleados_cobrando ec
            JOIN tbl_empleado e ON e.idempleado=ec.idempleado AND e.idglobal=?
            JOIN tbl_persona p ON p.idpersona=e.idpersona AND p.idglobal=e.idglobal
            AND e.str_estado='activo'
            WHERE ec.id_detalle_ruta=(SELECT r.iddetalleruta FROM tbl_detalle_ruta r
              WHERE r.idglobal=? AND r.idsucursal=? ORDER BY r.created_at DESC,r.iddetalleruta DESC LIMIT 1)",
            [(int)$companyId, (int)$companyId, (int)$branch['branchId']]);
         $branch['assignedEmployeeIds'] = array_map(function ($row) { return (int)$row['employeeId']; }, $assigned);
         $branch['employees'] = array_map(function ($row) {
            return ['employeeId' => (int)$row['employeeId'], 'name' => $row['name']];
         }, $assigned);
         $rules = $this->query("SELECT id,branch_id AS branchId,mode FROM tbl_employee_payroll_branch_rule
            WHERE idglobal=? AND branch_id=? ORDER BY id DESC LIMIT 1", [(int)$companyId, (int)$branch['branchId']]);
         $rule = $rules ? $rules[0] : ['branchId' => (int)$branch['branchId'], 'mode' => 'Titular'];
         $rule['weights'] = $rules ? $this->query('SELECT employee_id AS employeeId,weight FROM tbl_employee_payroll_weight WHERE rule_id=?', [(int)$rule['id']]) : [];
         $configs[] = $rule;
      }
      unset($branch);
      $offices = $this->query('SELECT idoficina FROM tbl_oficina WHERE idglobal=? AND idempleado_administrador=?',
         [(int)$companyId, (int)$actor['employeeId']]);
      return ['employeeId' => (int)$actor['employeeId'], 'canManage' => $actor['cargo'] === 'Super Administrador' || count($offices) > 0,
         'canDistribute' => $actor['cargo'] === 'Super Administrador', 'employees' => $employees, 'branches' => $branches, 'configs' => $configs];
   }

   public function snapshotDespacho($companyId, $routeId)
   {
      $this->query('CALL sp_employee_payroll_snapshot(?,?)', [(int)$companyId, (int)$routeId]);
   }
}
