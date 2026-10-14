<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../model/MiAhorro.php';
require_once __DIR__ . '/../model/Ahorradores.php';
require_once __DIR__ . '/../model/Corres_.php';
require_once __DIR__ . '/../model/AhorrosProgramado.php';

function perspectiveAssert(bool $condition, string $message): void
{
   if (!$condition) throw new RuntimeException('FAIL: ' . $message);
}
$original = $conexion->query('SELECT DATABASE() AS name')->fetch_assoc()['name'];
$database = 'payroll_test_movement_perspective_' . getmypid() . '_' . bin2hex(random_bytes(4));
$created = false;
try {
   $conexion->query("CREATE DATABASE `$database`");
   $created = true;
   $conexion->select_db($database);
   $statements = [
      'CREATE TABLE tbl_persona(idpersona INT PRIMARY KEY,idglobal INT,str_nombres VARCHAR(80),
         str_apellidos VARCHAR(80),str_tipo_documento VARCHAR(40),str_num_documento VARCHAR(30))',
      'CREATE TABLE tbl_ahorros(idahorro INT PRIMARY KEY,idglobal INT,idpersona INT,id_cuenta VARCHAR(40),
         str_name VARCHAR(80),str_tipo VARCHAR(20))',
      'CREATE TABLE tbl_movimientos(idmovimiento INT PRIMARY KEY,idglobal INT,idahorro INT,idahorro_de INT NULL,
         date_movimiento DATETIME,str_tipo VARCHAR(20),dec_valor DECIMAL(18,2),
         str_descripcion VARCHAR(250),str_estado VARCHAR(20))',
      "INSERT INTO tbl_persona VALUES(1,1,'Origen','Prueba','CC','1'),(2,1,'Destino','Prueba','CC','2'),
         (3,2,'Ajeno','Prueba','CC','3')",
      "INSERT INTO tbl_ahorros VALUES(10,1,1,'100','Cuenta origen','principal'),
         (20,1,2,'200','Cuenta destino','principal'),(21,1,2,'201','Otra cuenta propia','corriente'),
         (30,2,3,'300','Cuenta ajena','principal')",
      "INSERT INTO tbl_movimientos VALUES
         (1,1,10,20,'2026-07-29 08:22:00','retiro',45000,'Que estaban pendientes','activo'),
         (2,1,10,20,'2026-07-30 08:22:00','aporte',10000,'Transferencia','activo'),
         (3,1,10,20,'2026-07-31 08:22:00','ajuste',5000,'Ajuste','activo'),
         (4,1,20,21,'2026-08-01 08:22:00','retiro',7000,'Entre propias','activo'),
         (5,1,20,NULL,'2026-08-02 08:22:00','retiro',3000,'Efectivo','activo'),
         (6,1,20,NULL,'2026-08-03 08:22:00','aporte',2000,'Depósito','activo'),
         (7,1,20,20,'2026-08-04 08:22:00','retiro',1000,'Misma referencia','activo'),
         (8,1,10,20,'2026-08-05 08:22:00','retiro',999,'Anulado','inactivo'),
         (9,2,30,NULL,'2026-08-06 08:22:00','aporte',999,'Ajeno','activo'),
         (10,1,20,NULL,'2026-08-07 08:22:00','salida',500,'Salida','activo'),
         (11,2,30,20,'2026-08-08 08:22:00','retiro',999,'Ajeno referenciado','activo')",
   ];
   foreach ($statements as $sql) $conexion->query($sql);
   $model = new MiAhorro();
   $rows = $model->listarMovimientosPersona(1,2)->fetch_all(MYSQLI_ASSOC);
   $byId = array_column($rows,null,'idmovimiento');
   perspectiveAssert((float)$byId[1]['monto_firmado'] === 45000.0, 'recipient sees positive received withdrawal');
   perspectiveAssert($byId[1]['tipo_presentacion'] === 'Transferencia recibida', 'recipient sees received label');
   perspectiveAssert((int)$byId[1]['idahorro'] === 20 && $byId[1]['id_cuenta'] === '200'
      && $byId[1]['ahorrador'] === 'Destino Prueba', 'recipient sees own account and owner');
   perspectiveAssert($byId[1]['str_tipo'] === 'retiro', 'original movement type remains intact');
   foreach ([2=>-10000.0,3=>-5000.0,4=>0.0,5=>-3000.0,6=>2000.0,7=>-1000.0,10=>-500.0] as $id=>$amount) {
      perspectiveAssert((float)$byId[$id]['monto_firmado'] === $amount, 'correct recipient sign for movement ' . $id);
   }
   perspectiveAssert($byId[2]['tipo_presentacion'] === 'Transferencia enviada', 'outgoing transfer label');
   perspectiveAssert($byId[4]['tipo_presentacion'] === 'Transferencia entre mis cuentas', 'internal transfer net zero');
   perspectiveAssert(!isset($byId[8]) && !isset($byId[9]) && !isset($byId[11]),
      'inactive and other-company movements excluded');
   $origin = array_column($model->listarMovimientosPersona(1,1)->fetch_all(MYSQLI_ASSOC),null,'idmovimiento');
   perspectiveAssert((float)$origin[1]['monto_firmado'] === -45000.0
      && $origin[1]['tipo_presentacion'] === 'retiro', 'origin still sees original negative withdrawal');
   foreach ([10,20,21] as $account) {
      foreach ($model->listarMovimientos(1,$account)->fetch_all(MYSQLI_ASSOC) as $movement) {
         if ((int)$movement['idmovimiento'] === 1) {
            perspectiveAssert((float)$movement['monto_firmado'] === ($account === 10 ? -45000.0 : 45000.0),
               'individual account behavior unchanged');
            perspectiveAssert((int)$movement['idahorro'] === $account,
               'individual account identifies selected account, not origin account');
            perspectiveAssert($movement['tipo_presentacion'] === ($account === 10 ? 'retiro' : 'Transferencia recibida'),
               'selected account perspective label');
         }
         if ((int)$movement['idmovimiento'] === 2 && $account === 20) {
            perspectiveAssert($movement['tipo_presentacion'] === 'Transferencia enviada'
               && (float)$movement['monto_firmado'] === -10000.0, 'selected funding account sends aporte');
         }
         if ((int)$movement['idmovimiento'] === 4) {
            perspectiveAssert((float)$movement['monto_firmado'] === ($account === 20 ? -7000.0 : 7000.0),
               'own transfer keeps each individual account signed, not personal net zero');
         }
      }
   }
   perspectiveAssert($conexion->query('SELECT dec_valor FROM tbl_movimientos WHERE idmovimiento=1')
      ->fetch_assoc()['dec_valor'] === '45000.00', 'stored movement value unchanged');
   $savers = new Ahorradores();
   $personalRows = $savers->listarMovimientosPersona(1,2)->fetch_all(MYSQLI_ASSOC);
   $received = array_values(array_filter($personalRows, fn($r) => $r['descripcion'] === 'Que estaban pendientes'));
   perspectiveAssert(count($received) === 1 && (int)$received[0]['isvia'] === 1
      && (int)$received[0]['cuentaSeleccionada'] === 20, 'Ahorradores recipient row has selected account and via flag');
   $own = array_values(array_filter($personalRows, fn($r) => $r['descripcion'] === 'Entre propias'));
   perspectiveAssert(count($own) === 2, 'Ahorradores preserves two account rows for own transfers');
   $ownByAccount = array_column($own,null,'cuentaSeleccionada');
   perspectiveAssert((int)$ownByAccount[20]['isvia'] === 0 && (int)$ownByAccount[21]['isvia'] === 1,
      'own transfer account rows have opposite sides');
   perspectiveAssert(!in_array('Ajeno referenciado', array_column($personalRows,'descripcion'), true),
      'Ahorradores excludes cross-company counterpart rows');
   $correspondent = new Corresponsal();
   $correspondentRows = $correspondent->listarMovimientos(1,20)->fetch_all(MYSQLI_ASSOC);
   $correspondentById = array_column($correspondentRows,null,'idmovimiento');
   perspectiveAssert(isset($correspondentById[1]) && !isset($correspondentById[11]),
      'Corresponsales includes own recipient movements but not cross-company rows');
   perspectiveAssert($correspondentById[1]['str_tipo'] === 'retiro'
      && (int)$correspondentById[1]['idahorro'] === 10 && (int)$correspondentById[1]['idahorro_de'] === 20,
      'Corresponsales preserves original identifiers and type');
   $scheduled = new AhorrosProgramado();
   $scheduledById = array_column($scheduled->listarMovimientos(1,20)->fetch_all(MYSQLI_ASSOC),null,'idmovimiento');
   perspectiveAssert(isset($scheduledById[1]) && !isset($scheduledById[11]),
      'scheduled savings includes received movements and respects company boundaries');
   perspectiveAssert($scheduledById[1]['str_tipo'] === 'retiro'
      && (int)$scheduledById[1]['idahorro'] === 10 && (int)$scheduledById[1]['idahorro_de'] === 20,
      'scheduled savings exposes original type and both account identifiers for presentation');
   echo "OK savings perspective: Mi ahorro, Ahorradores, Corresponsales, account sides, company boundaries, unchanged storage\n";
} finally {
   $conexion->select_db($original);
   if ($created) $conexion->query("DROP DATABASE `$database`");
}
