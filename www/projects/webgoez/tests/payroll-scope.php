<?php

if (getenv('RUN_PAYROLL_SCOPE_TESTS') !== '1') {
   throw new RuntimeException('Set RUN_PAYROLL_SCOPE_TESTS=1 to run payroll checks using isolated temporary tables.');
}

require_once __DIR__ . '/../model/Conexion.php';
require_once __DIR__ . '/../model/SueldoCartera.php';

$fixtures = __DIR__ . '/../../backend-creditos-apk/tests/fixtures/';
try {
   $sql = file_get_contents($fixtures . 'payroll-scope.sql');
   foreach (array_filter(array_map('trim', explode(';', $sql))) as $consulta) {
      $conexion->query($consulta);
   }
   $casos = json_decode(file_get_contents($fixtures . 'payroll-scope.json'), true, 512, JSON_THROW_ON_ERROR);
   foreach ($casos as $caso) {
      $sesion = ['idglobal' => 7, 'idempleado' => $caso['employeeId']];
      if (!empty($caso['superAdministrator'])) {
         $sesion['userEmpresa'] = 7;
      }
      $resultado = nominasAutorizadasCartera($conexion, $sesion, $caso['branchId'], $caso['payrollId'] ?? null);
      $ids = array_map(fn($fila) => (int)$fila['refNomina'], $resultado->fetch_all(MYSQLI_ASSOC));
      sort($ids);
      if ($ids !== $caso['expected']) {
         throw new RuntimeException($caso['name'] . ': unexpected authorized payrolls');
      }
      foreach ($caso['expected'] as $id) {
         if (errorNominaGastoCartera($conexion, $sesion, $caso['branchId'], 2, $id) !== null) {
            throw new RuntimeException($caso['name'] . ': authorized salary rejected');
         }
      }
      if (isset($caso['payrollId']) &&
          errorNominaGastoCartera($conexion, $sesion, $caso['branchId'], 2, $caso['payrollId']) === null) {
         throw new RuntimeException($caso['name'] . ': unauthorized salary accepted');
      }
      echo 'OK: ' . $caso['name'] . PHP_EOL;
   }
   $empleado = ['idglobal' => 7, 'idempleado' => 11];
   foreach (['', '101invalid', -1] as $invalido) {
      if (errorNominaGastoCartera($conexion, $empleado, 4, 2, $invalido) === null) {
         throw new RuntimeException('Missing or invalid salary payroll accepted');
      }
   }
   if (errorNominaGastoCartera($conexion, $empleado, 4, 1, '') !== null) {
      throw new RuntimeException('Ordinary expense without payroll rejected');
   }
   echo 'OK: required salary payroll and ordinary expense compatibility' . PHP_EOL;
} finally {
   $conexion->close();
}
