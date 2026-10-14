<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../model/Empleado.php';

function employeeOfficeAssert(bool $condition, string $message): void
{
   if (!$condition) throw new RuntimeException('FAIL: ' . $message);
}

$database = 'payroll_test_employee_offices_' . getmypid() . '_' . bin2hex(random_bytes(4));
$original = $conexion->query('SELECT DATABASE() AS name')->fetch_assoc()['name'];
$created = false;
try {
   $conexion->query("CREATE DATABASE `$database`");
   $created = true;
   $conexion->select_db($database);
   $statements = [
      'CREATE TABLE tbl_oficina(idoficina INT PRIMARY KEY,idglobal INT,str_nombre VARCHAR(80))',
      'CREATE TABLE tbl_persona(idpersona INT PRIMARY KEY,idglobal INT,str_nombres VARCHAR(80),str_apellidos VARCHAR(80),
         str_foto VARCHAR(100),str_tipo_documento VARCHAR(20),str_num_documento VARCHAR(20),str_telefono VARCHAR(20))',
      'CREATE TABLE tbl_empleado(idempleado INT PRIMARY KEY,idglobal INT,idpersona INT,idoficina INT,
         str_cargo VARCHAR(50),dec_max_credito DECIMAL(18,2),date_fecha_inicio DATE,str_estado VARCHAR(20))',
      'CREATE TABLE tbl_empleado_despido(idempleado_despido INT PRIMARY KEY,idglobal INT,idempleado INT,
         fecha_despido DATE,tipo_despido VARCHAR(40),monto_fraude_pendiente DECIMAL(18,2),
         monto_fraude VARCHAR(10),entrega_documentos VARCHAR(20),derecho_recontratacion VARCHAR(10),str_estado VARCHAR(20))',
      'CREATE TABLE test_payments(refEmpleado INT,fecha_at DATETIME,valor DECIMAL(18,2),consepto VARCHAR(40))',
      'CREATE VIEW view_detalle_nomina AS SELECT * FROM test_payments',
      "INSERT INTO tbl_oficina VALUES(1,1,'Cali'),(2,1,'Bogotá'),(3,2,'Ajena')",
      "INSERT INTO tbl_persona VALUES(1,1,'Zulu','','','CC','1',''),(2,1,'Ana','','','CC','2',''),
         (3,1,'Beatriz','','','CC','3',''),(4,1,'Pedro','','','CC','4',''),
         (5,2,'Ajeno','','','CC','5',''),(6,1,'Inactivo','','','CC','6','')",
      "INSERT INTO tbl_empleado VALUES(1,1,1,1,'Cobrador',0,'2026-01-01','activo'),
         (2,1,2,2,'Cobrador',0,'2026-01-01','activo'),(3,1,3,1,'Cobrador',0,'2026-01-01','activo'),
         (4,1,4,NULL,'Cobrador',0,'2026-01-01','activo'),(5,2,5,3,'Cobrador',0,'2026-01-01','activo'),
         (6,1,6,1,'Cobrador',0,'2026-01-01','inactivo')",
      "INSERT INTO tbl_empleado_despido VALUES(1,1,1,'2026-10-10','renuncia_voluntaria',0,'no','pendiente','si','activo'),
         (2,1,2,'2026-10-11','despido_justificado',0,'no','pendiente','no','activo'),
         (3,1,3,'2026-10-09','renuncia_voluntaria',0,'no','pendiente','si','activo'),
         (4,1,4,'2026-10-08','renuncia_voluntaria',0,'no','pendiente','si','activo'),
         (5,2,5,'2026-10-12','renuncia_voluntaria',0,'no','pendiente','si','activo')",
      "INSERT INTO test_payments VALUES(1,'2026-10-13 00:00:00',10,'sueldo'),
         (1,'2026-10-13 23:59:59',20,'bono'),(1,'2026-10-14 00:00:00',30,'sueldo'),
         (2,'2026-10-13 12:00:00',99,'sueldo'),
         (1,'2024-02-29 23:59:59',40,'sueldo'),(1,'2024-03-01 00:00:00',50,'sueldo'),
         (1,'2026-12-31 23:59:59',60,'sueldo'),(1,'2027-01-01 00:00:00',70,'sueldo')",
   ];
   foreach ($statements as $sql) $conexion->query($sql);
   $model = new Empleado();
   $active = $model->Listar(1)->fetch_all(MYSQLI_ASSOC);
   employeeOfficeAssert(array_map('intval',array_column($active,'refEmpleado')) === [2,3,1,4],
      'active employees ordered office/name, excluding inactive and other companies');
   employeeOfficeAssert($active[3]['oficinaNombre'] === 'Sin oficina asignada', 'explicit unassigned office');
   $dismissed = $model->listarDespedidos(1)->fetch_all(MYSQLI_ASSOC);
   employeeOfficeAssert(array_map('intval',array_column($dismissed,'refEmpleado')) === [2,3,1,4],
      'dismissed employees ordered office/name and isolated by company');
   employeeOfficeAssert(count($model->listarDespedidos(1,'despido_justificado')->fetch_all(MYSQLI_ASSOC)) === 1,
      'existing dismissal filter preserved');
   $paid = $model->listNomnaDetalle(1,'2026-10-13','2026-10-13')->fetch_all(MYSQLI_ASSOC);
   employeeOfficeAssert(count($paid) === 2 && array_sum(array_column($paid,'valor')) === 30.0,
      'history includes full final day, not next midnight or another employee');
   foreach ([['2024-02-29','2024-02-29',40.0],['2026-12-31','2026-12-31',60.0],
      ['2026-12-31','2027-01-01',130.0]] as [$from,$to,$amount]) {
      $rows = $model->listNomnaDetalle(1,$from,$to)->fetch_all(MYSQLI_ASSOC);
      employeeOfficeAssert(array_sum(array_column($rows,'valor')) === $amount,
         'leap day and year boundaries remain inclusive without next-day leakage');
   }
   foreach ([['2026-02-30','2026-03-01'],['2026-10-14','2026-10-13']] as [$from,$to]) {
      $rejected = false;
      try { $model->listNomnaDetalle(1,$from,$to); }
      catch (RuntimeException $error) { $rejected = $error->getCode() === 422; }
      employeeOfficeAssert($rejected, 'invalid or reversed date range rejected explicitly');
   }
   echo "OK employee offices and paid-history boundaries; no business writes\n";
} finally {
   $conexion->select_db($original);
   if ($created) $conexion->query("DROP DATABASE `$database`");
}
