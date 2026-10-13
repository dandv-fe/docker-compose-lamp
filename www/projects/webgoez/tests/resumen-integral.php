<?php
if (getenv('RUN_INTEGRAL_REPORT_TESTS') !== '1') {
   throw new RuntimeException('Set RUN_INTEGRAL_REPORT_TESTS=1 to use isolated temporary tables.');
}
require_once __DIR__ . '/../model/ResumenIntegral.php';

function integralAssert(bool $condition, string $message): void
{
   if (!$condition) {
      throw new RuntimeException($message);
   }
}

function integralReject(callable $run, string $class): void
{
   try {
      $run();
   } catch (Throwable $error) {
      integralAssert($error instanceof $class, 'Unexpected rejection: ' . $error->getMessage());
      return;
   }
   throw new RuntimeException('Expected rejection: ' . $class);
}

try {
   foreach ([
      'tbl_oficina' => 'idoficina INT, idglobal INT, str_nombre VARCHAR(50)',
      'tbl_sucursal' => 'idsucursal INT, idglobal INT, idoficina INT, str_codigo VARCHAR(100), str_estado VARCHAR(20)',
      'tbl_auth_sucursal' => 'idauth_sucursal INT, idglobal INT, idsucursal INT, idempleado INT, str_estado VARCHAR(20)',
      'tbl_auths' => 'idauth_sucursal INT, idauth INT',
      'tbl_auth' => 'idauth INT, str_nombre VARCHAR(50)',
      'tbl_detalle_ruta' => 'iddetalleruta INT, idglobal INT, idsucursal INT, created_at DATETIME, str_estado VARCHAR(20)',
      'tbl_contabilidad_detalle' => 'idcontabilidad_detalle VARCHAR(50), idglobal INT, idsucursal INT,
         iddetalleruta INT, idtipo_contabilidad INT, dec_total DECIMAL(12,2), str_nombre VARCHAR(50),
         str_estado VARCHAR(20), str_operacion VARCHAR(50), created_at DATETIME, str_detalle VARCHAR(250)',
      'tbl_tarjetas' => 'idglobal INT, idsucursal INT, dec_resta DECIMAL(12,2), str_estado VARCHAR(20)',
      'tbl_detalle_nomina' => 'idglobal INT, idnomina INT, idcontabilidad_detalle VARCHAR(50)',
      'tbl_nomina' => 'idnomina INT, idglobal INT, idempleado INT',
      'tbl_empleado' => 'idempleado INT, idglobal INT, idpersona INT',
      'tbl_persona' => 'idpersona INT, idglobal INT, str_nombres VARCHAR(100), str_apellidos VARCHAR(100)',
      'tbl_tipo_contabilidad' => 'idtipo_contabilidad INT, str_categoria VARCHAR(50), str_operacion VARCHAR(20)',
      'view_usuario_session' => 'idusuario INT, idglobal INT, idempleado INT, str_cargo VARCHAR(30),
         idoficina INT, estado_usuario VARCHAR(20), estado_empleado VARCHAR(20)',
      'tbl_descripcion_global' => 'idglobal_accion INT, str_estado VARCHAR(20), date_corte DATE, int_dias_extras INT'
   ] as $table => $columns) {
      $conexion->query("CREATE TEMPORARY TABLE $table ($columns)");
   }
   $conexion->query("INSERT INTO tbl_oficina VALUES (1,7,'Centro'),(2,7,'Norte'),(3,8,'Otra empresa')");
   $conexion->query("INSERT INTO tbl_sucursal VALUES
      (10,7,1,'Ruta A','disponible'),(11,7,1,'Ruta sin datos','disponible'),
      (20,7,2,'Ruta B','disponible'),(30,8,3,'Ajena','disponible'),(12,7,1,'Inactiva','inactiva')");
   foreach (resumenIntegralPermisos() as $index => $permission) {
      db_execute($conexion, 'INSERT INTO tbl_auth VALUES (?,?)', 'is', [$index + 1, $permission]);
   }
   $conexion->query("INSERT INTO tbl_auth_sucursal VALUES
      (1,7,10,100,'activo'),(2,7,20,100,'activo'),(3,7,11,100,'inactivo'),
      (4,8,30,100,'activo'),(5,7,10,200,'activo'),(6,7,20,200,'activo')");
   $conexion->query('INSERT INTO tbl_auths VALUES
      (1,1),(1,2),(1,3),(1,4),(1,4),(2,1),(2,2),(2,3),(3,1),(3,2),(3,3),(3,4),
      (4,1),(4,2),(4,3),(4,4),(5,1),(5,2),(6,3),(6,4)');
   $conexion->query("INSERT INTO view_usuario_session VALUES
      (1,7,100,'Empleado',1,'activo','activo'),(2,7,200,'Empleado',1,'activo','inactivo'),
      (3,7,300,'Super Administrador',1,'activo','activo')");
   $context = ['idglobal' => 7, 'idempleado' => 100, 'superadmin' => false, 'idoficina' => 1];
   integralAssert(array_column(resumenIntegralSucursales($conexion, $context), 'id') === [10],
      'Scope must intersect all four permissions per branch and tenant; ignore inactive auths.');
   integralReject(fn() => new ResumenIntegral($conexion, array_merge($context, ['idempleado' => 200]),
      '2026-01-10', '2026-01-11'), DomainException::class);
   integralReject(fn() => new ResumenIntegral($conexion, $context,
      '2026-01-10', '2026-01-11', 20), DomainException::class);
   $admin = array_merge($context, ['superadmin' => true]);
   integralAssert(array_column(resumenIntegralSucursales($conexion, $admin), 'id') === [10,11],
      'Super administrator must remain in selected office, active branches and own company.');
   integralAssert(resumenIntegralIdentidad($conexion, 1, 0)['superadmin'] === false,
      'Read role from database, not stale session flags.');
   integralReject(fn() => resumenIntegralIdentidad($conexion, 2, 1), DomainException::class);
   $conexion->query("INSERT INTO tbl_descripcion_global VALUES (7,'actual','2000-01-01',10)");
   integralReject(fn() => resumenIntegralIdentidad($conexion, 3, 1), DomainException::class);
   $conexion->query('DELETE FROM tbl_descripcion_global');

   $conexion->query("INSERT INTO tbl_detalle_ruta VALUES
      (1,7,10,'2026-01-10 08:00:00','saved'),(2,7,10,'2026-01-11 23:59:59','created'),
      (3,7,10,'2026-01-12 00:00:00','saved'),(4,7,10,'2026-01-08 00:00:00','saved'),
      (5,7,10,'2026-01-09 23:59:59','saved'),(6,7,20,'2026-01-10 12:00:00','saved'),
      (7,8,30,'2026-01-10 12:00:00','saved'),(8,7,10,'2026-01-07 23:59:59','saved')");
   $conexion->query("INSERT INTO tbl_tipo_contabilidad VALUES
      (1,'operacion','entrada'),(2,'empleado','salida'),(3,'credito','salida'),
      (6,'traslado','salida'),(8,'informacion','info'),(9,'aporte','entrada')");
   $counter = 0;
   $insert = static function (int $route, int $type, float $amount, string $name, string $operation,
      string $date = '2026-01-10 12:00:00', string $state = 'saved', int $branch = 10, int $company = 7)
      use ($conexion, &$counter): void {
      db_execute($conexion, 'INSERT INTO tbl_contabilidad_detalle VALUES (?,?,?,?,?,?,?,?,?,?,?)',
         'siiiidsssss', ['test-' . ++$counter, $company, $branch, $route, $type,
            $amount, $name, $state, $operation, $date, '<script>alert(1)</script>']);
   };
   $insert(1, 1, 100, 'recaudo', 'entrada-totalizar');
   $insert(1, 3, -80, 'prestamos', 'salida-totalizar');
   $insert(1, 3, -20, 'articulos', 'salida-totalizar');
   $insert(1, 8, 140, 'valorTotalCreditos', 'info');
   $insert(1, 1, 5, 'efectivo-otra-utilidad', 'entrada-totalizar');
   $insert(1, 1, 2, 'diferencia', 'entrada-totalizar');
   $insert(1, 8, 3, 'descuento', 'info');
   $insert(1, 2, -10, 'sueldo', 'salida-totalizar');
   $conexion->query("INSERT INTO tbl_persona VALUES (100,7,'Ana','Prueba'),(200,8,'Persona','Ajena')");
   $conexion->query('INSERT INTO tbl_empleado VALUES (100,7,100),(200,8,200)');
   $conexion->query('INSERT INTO tbl_nomina VALUES (1,7,100),(2,8,200)');
   $conexion->query("INSERT INTO tbl_detalle_nomina VALUES (7,1,'test-8'),(8,2,'test-8')");
   $insert(1, 2, -4, 'transporte', 'salida-contabilidad');
   $insert(1, 6, -7, 'traslado', 'salida-contabilidad');
   $insert(1, 9, 6, 'aporte', 'entrada-contabilidad');
   $insert(2, 1, 50, 'recaudo', 'entrada-totalizar', '2026-01-11 23:59:59', 'created');
   $insert(3, 1, 900, 'recaudo', 'entrada-totalizar', '2026-01-12 00:00:00');
   $insert(4, 1, 20, 'recaudo', 'entrada-totalizar', '2026-01-08 00:00:00');
   $insert(5, 1, 30, 'recaudo', 'entrada-totalizar', '2026-01-09 23:59:59');
   $insert(6, 1, 9999, 'recaudo', 'entrada-totalizar', '2026-01-10 12:00:00', 'saved', 20);
   $insert(7, 1, 9999, 'recaudo', 'entrada-totalizar', '2026-01-10 12:00:00', 'saved', 30, 8);
   $insert(8, 1, 1000, 'recaudo', 'entrada-totalizar', '2026-01-07 23:59:59');
   // Fecha del movimiento distinta de apertura: Egresos conserva su propia base de fecha.
   $insert(8, 2, -2, 'reembolso', 'salida-contabilidad', '2026-01-10 18:00:00');
   $insert(8, 2, 1, 'reembolso', 'salida-contabilidad', '2026-01-11 18:00:00');
   $conexion->query("INSERT INTO tbl_tarjetas VALUES
      (7,10,400,'activa'),(7,10,50,'moroso'),(7,10,20,'fallecio'),(7,10,30,'discapacitado'),
      (7,10,900,'inactiva'),(7,10,800,'cancelado'),(7,20,9999,'activa'),(8,30,9999,'activa')");
   $model = new ResumenIntegral($conexion, $context, '2026-01-10', '2026-01-11');
   $report = $model->report();
   foreach ([
      'recaudo' => 150, 'prestamos' => 80, 'ventas' => 20, 'utilidad' => 44,
      'gastosRuta' => 10, 'otrosGastos' => 4, 'utilidadNeta' => 30, 'crecimiento' => 29,
      'rutas' => 2, 'rutasPendientes' => 1, 'caja' => 1941,
      'carteraActiva' => 400, 'carteraMorosa' => 50, 'carteraRetirada' => 50,
      'carteraTotal' => 500, 'capitalActual' => 2341, 'riesgoPct' => 20
   ] as $key => $expected) {
      integralAssert(abs($report['totals'][$key] - $expected) < 0.001,
         "Incorrect $key: " . $report['totals'][$key] . " expected $expected");
   }
   integralAssert($report['previous']['recaudo'] === 50.0 &&
      $report['period']['previousStart'] === '2026-01-08' &&
      $report['period']['previousEnd'] === '2026-01-09', 'Equal-duration previous period boundaries.');
   integralAssert(count($report['daily']) === 2 && $report['daily'][1]['recaudo'] === 50.0,
      'Include last second of period, exclude next midnight, zero-fill dates.');
   integralAssert(array_sum(array_column($report['expenses'], 'amount')) === 122.0 &&
      $report['expenseDetails']['total'] === 7, 'All egresos, including placement, transfers and signed reversals.');
   integralAssert($report['expenseDetails']['rows'][0]['detail'] === '<script>alert(1)</script>',
      'API must return plain data without HTML interpretation; UI escapes via textContent.');
   $salary = array_values(array_filter($report['expenseDetails']['rows'],
      fn($row) => $row['concept'] === 'sueldo'))[0];
   integralAssert(strpos($salary['detail'], 'Ana Prueba') !== false &&
      strpos($salary['detail'], 'Persona Ajena') === false, 'Payroll names must respect company scope.');
   $empty = (new ResumenIntegral($conexion, $admin, '2026-01-10', '2026-01-11', 11))->report();
   integralAssert($empty['totals']['recaudo'] === 0.0 && $empty['totals']['riesgoPct'] === null &&
      count($empty['daily']) === 2, 'Empty allowed branch is a valid empty report, risk is not a fabricated percentage.');
   for ($i = 0; $i < 60; $i++) {
      $insert(1, 2, -0.1, 'pequeño gasto', 'salida-totalizar');
   }
   $first = $model->expenses();
   $second = $model->expenses(2);
   integralAssert($first['total'] === 67 && count($first['rows']) === 50 &&
      count($second['rows']) === 17 && $second['page'] === 2, 'Bounded, deterministic expense pagination.');
   integralAssert(count(array_unique(array_merge(
      array_map(fn($r) => $r['concept'] . $r['amount'] . $r['date'], $first['rows']),
      array_map(fn($r) => $r['concept'] . $r['amount'] . $r['date'], $second['rows'])
   ))) > 1, 'Both detail pages have data.');
   foreach ([
      ['2026-02-30', '2026-03-01'], ['2026-01-11', '2026-01-10'],
      ['2024-01-01', '2025-01-01'], ['2026-01-01', '2099-01-01'],
      ["2026-01-01' OR 1=1", '2026-01-02']
   ] as [$start, $end]) {
      integralReject(fn() => resumenIntegralPeriodo($start, $end), InvalidArgumentException::class);
   }
   integralAssert(resumenIntegralPeriodo('2024-01-01', '2024-12-31')['endExclusive'] === '2025-01-01',
      'Exact maximum: leap-year 366-day range must be accepted.');
   integralReject(fn() => $model->expenses(0), InvalidArgumentException::class);
   session_id('integral-report-test-' . bin2hex(random_bytes(8)));
   session_start();
   $_SESSION = ['idusuario' => 1, 'idoficina' => 1, 'userEmpresa' => 7];
   session_write_close();
   $filters = ['desde' => '2026-01-10', 'hasta' => '2026-01-11'];
   foreach ([
      [$filters, 200, 'totals'],
      [array_merge($filters, ['op' => 'egresos', 'pagina' => 2]), 200, 'rows'],
      [array_merge($filters, ['sucursal' => 20]), 403, 'error'],
      [array_merge($filters, ['desde' => ['2026-01-10']]), 422, 'error'],
      [array_merge($filters, ['hasta' => '2026-02-30']), 422, 'error'],
      [array_merge($filters, ['sucursal' => '10 OR 1=1']), 422, 'error'],
      [array_merge($filters, ['pagina' => 0]), 422, 'error'],
      [array_merge($filters, ['op' => 'delete']), 422, 'error']
   ] as [$query, $status, $key]) {
      $_GET = $query;
      http_response_code(200);
      ob_start();
      include __DIR__ . '/../ajax/ResumenIntegralAjax.php';
      $payload = json_decode(ob_get_clean(), true, 512, JSON_THROW_ON_ERROR);
      integralAssert(http_response_code() === $status && array_key_exists($key, $payload),
         'Endpoint returned incorrect status or payload shape.');
   }
   session_start();
   session_destroy();
   echo "OK: scope intersection, office/company isolation, fresh identity, service expiry, period boundaries,\n";
   echo "formulas, signed egresos, current snapshots, empty data, risk, 50-row pagination and endpoint responses.\n";
} finally {
   $conexion->close();
}
