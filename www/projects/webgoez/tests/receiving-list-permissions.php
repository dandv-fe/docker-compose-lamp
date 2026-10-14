<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../model/RecibeCuentas.php';

function receivingAssert(bool $condition, string $message): void
{
   if (!$condition) throw new RuntimeException('FAIL: ' . $message);
}

$database = 'payroll_test_receiving_' . getmypid() . '_' . bin2hex(random_bytes(4));
$originalDatabase = $conexion->query('SELECT DATABASE() AS name')->fetch_assoc()['name'];
$created = false;
$originalSession = $_SESSION ?? [];
try {
   $conexion->query("CREATE DATABASE `$database`");
   $created = true;
   $conexion->select_db($database);
   $statements = [
      'CREATE TABLE tbl_oficina(idoficina INT PRIMARY KEY,idglobal INT,idempleado_administrador INT)',
      'CREATE TABLE tbl_sucursal(idsucursal INT PRIMARY KEY,idglobal INT,idoficina INT)',
      'CREATE TABLE tbl_auth(idauth INT PRIMARY KEY,str_nombre VARCHAR(50))',
      'CREATE TABLE tbl_auth_sucursal(idauth_sucursal INT PRIMARY KEY,idglobal INT,idsucursal INT,idempleado INT,str_estado VARCHAR(20))',
      'CREATE TABLE tbl_auths(id INT PRIMARY KEY,idauth_sucursal INT,idauth INT)',
      'CREATE TABLE tbl_detalle_ruta(iddetalleruta INT PRIMARY KEY,idglobal INT,idsucursal INT,str_estado VARCHAR(20))',
      "INSERT INTO tbl_oficina VALUES(1,1,10),(2,1,20),(3,2,30)",
      'INSERT INTO tbl_sucursal VALUES(1,1,1),(2,1,2),(3,2,3)',
      "INSERT INTO tbl_auth VALUES(1,'ver recibir'),(2,'ver cuentas detalladas')",
      "INSERT INTO tbl_auth_sucursal VALUES(1,1,2,40,'activo'),(2,2,3,40,'activo'),(3,1,1,50,'inactivo')",
      'INSERT INTO tbl_auths VALUES(1,1,1),(2,2,1),(3,3,1)',
      "INSERT INTO tbl_detalle_ruta VALUES(1,1,1,'created'),(2,1,2,'entregando'),(3,2,3,'created'),(4,1,2,'saved')",
      "CREATE VIEW view_auth_sucursal AS SELECT g.idsucursal AS refSucursal,g.idempleado AS refEmpleado,
         g.str_estado AS estadoAuthSucursal,a.str_nombre AS nameAccion
         FROM tbl_auth_sucursal g JOIN tbl_auths x ON x.idauth_sucursal=g.idauth_sucursal
         JOIN tbl_auth a ON a.idauth=x.idauth",
   ];
   foreach ($statements as $sql) $conexion->query($sql);
   $amountFields = ['recaudo','cantidadTotalRecaudos','prestamo','articulo','creditos','descuento',
      'gastos','descripcion_gastos','otros_gastos','descripcion_otros_gastos','base','efectivo',
      'efectivoMonedas','efectivoOtraUtilidad','diferencia','salida','descripcion_salida',
      'entrada','descripcion_entrada'];
   $conexion->query('CREATE VIEW view_contabilidad_detalle_ruta AS SELECT
      iddetalleruta AS refDetalle_ruta,idsucursal AS refSucursal,idglobal AS refGlobal,
      idsucursal AS codigo,\'Cartera\' AS tipo,str_estado AS estado,' .
      implode(',', array_map(fn($field) => '0 AS ' . $field, $amountFields)) . ' FROM tbl_detalle_ruta');
   $model = new RecibeCuentas();
   $listed = function (int $employee, $super = null) use ($model): array {
      return array_map('intval', array_column(
         $model->ListContabilidadRecibir(1, $super, $employee)->fetch_all(MYSQLI_ASSOC), 'refSucursal'));
   };
   $_SESSION = ['idoficina'=>1];
   receivingAssert($listed(40) === [2], 'active receive grant outside selected office remains visible');
   receivingAssert($listed(50) === [], 'inactive grant rejected');
   receivingAssert($listed(60) === [], 'no grant does not list other branches');
   receivingAssert($listed(10) === [1], 'office administrator retains own office access');
   receivingAssert($listed(40, 1) === [1], 'SA selected office filter preserved');
   $_SESSION['idoficina'] = 2;
   receivingAssert($listed(10) === [1], 'employee session office cannot hide own administered office');
   receivingAssert($listed(40, 1) === [2], 'SA can select another office, saved routes excluded');
   $conexion->query("UPDATE tbl_auth_sucursal SET str_estado='inactivo' WHERE idauth_sucursal=1");
   receivingAssert($listed(40) === [], 'receive grant revocation immediately removes access');
   echo "OK receiving list: employee grants, office admin, SA filter, inactive/revoked, tenant isolation, saved routes\n";
} finally {
   $_SESSION = $originalSession;
   $conexion->select_db($originalDatabase);
   if ($created) $conexion->query("DROP DATABASE `$database`");
}
