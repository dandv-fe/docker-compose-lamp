<?php
require_once __DIR__ . '/../model/TelefonosCliente.php';

function verificarTelefonos($condicion, string $mensaje): void
{
   if (!$condicion) {
      throw new RuntimeException($mensaje);
   }
   $GLOBALS['asercionesTelefonos'] = ($GLOBALS['asercionesTelefonos'] ?? 0) + 1;
}

function esperarErrorTelefonos(callable $consulta, int $codigo): void
{
   try {
      $consulta();
   } catch (RuntimeException $error) {
      verificarTelefonos($error->getCode() === $codigo, 'Código de rechazo incorrecto: ' . $error->getMessage());
      return;
   }
   throw new RuntimeException('La consulta debía ser rechazada.');
}

$sesion = ['idusuario' => 1, 'idglobal' => 1002];
esperarErrorTelefonos(fn() => validarLecturaTelefonosCliente([], 1, 'tarjeta'), 401);
esperarErrorTelefonos(fn() => validarLecturaTelefonosCliente(['idusuario' => 1], 1, 'tarjeta'), 401);
esperarErrorTelefonos(fn() => validarLecturaTelefonosCliente($sesion, 0, 'tarjeta'), 400);
esperarErrorTelefonos(fn() => validarLecturaTelefonosCliente($sesion, 1, ''), 400);
esperarErrorTelefonos(fn() => validarLecturaTelefonosCliente($sesion, 1, str_repeat('x', 51)), 400);
validarLecturaTelefonosCliente($sesion, 1, 'tarjeta'); // No exige sucursal de sesión ni editar cliente.

$filas = [
   ['raw_phone' => '3000000001', 'normalized_phone' => '573000000001'],
   ['raw_phone' => '+57 3000000001', 'normalized_phone' => '573000000001'],
   ['raw_phone' => '00573000000001', 'normalized_phone' => '573000000001'],
   ['raw_phone' => '300123 / 310123', 'normalized_phone' => null],
   ['raw_phone' => ' 300123 / 310123 ', 'normalized_phone' => null],
   ['raw_phone' => '<b>legacy</b>', 'normalized_phone' => null],
   ['raw_phone' => '   ', 'normalized_phone' => null],
   ['raw_phone' => '3000000002', 'normalized_phone' => '573000000002']
];
verificarTelefonos(
   telefonosClienteSinDuplicados($filas) === ['3000000001', '300123 / 310123', '<b>legacy</b>', '3000000002'],
   'Deduplicación, conservación literal de legacy o respaldo del principal incorrectos.'
);
verificarTelefonos(telefonosClienteSinDuplicados([]) === [], 'Lista vacía incorrecta.');
verificarTelefonos(telefonosClienteSinDuplicados([
   ['raw_phone' => '3000000001', 'normalized_phone' => '573000000001', 'is_invalid' => 1],
   ['raw_phone' => '+57 3000000001', 'normalized_phone' => '573000000001']
]) === ['3000000001 · INCORRECTO'], 'El principal no debe ocultar la marca del historial.');
esperarErrorTelefonos(fn() => validarCsrfTelefonosCliente([], 'x'), 403);
esperarErrorTelefonos(fn() => validarCsrfTelefonosCliente(['csrfTelefonosCliente' => 'a'], 'b'), 403);
esperarErrorTelefonos(fn() => validarCsrfTelefonosCliente(['csrfTelefonosCliente' => 'a'], ['a']), 403);
validarCsrfTelefonosCliente(['csrfTelefonosCliente' => 'a'], 'a');
echo "OK: validación de sesión/entrada y deduplicación pura (formatos compartidos, legacy y principal).\n";

if (($argv[1] ?? '') !== '--local') {
   echo 'OK: ' . $GLOBALS['asercionesTelefonos'] . " comprobaciones.\n";
   exit(0);
}
require_once __DIR__ . '/../model/Conexion.php';
$destino = $conexion->query('SELECT DATABASE() AS db, @@hostname AS host')->fetch_object();
verificarTelefonos($destino->db === 'websdnco_db_webgoez', 'Solo se permite la base local de desarrollo.');
verificarTelefonos(!empty($argv[2]) && $destino->host === $argv[2], 'Hostname no coincide con el contenedor local verificado.');

$base = $conexion->query(
   'SELECT t.idtarjeta, t.idglobal, t.idsucursal FROM tbl_tarjetas t
    JOIN tbl_clientes c ON c.idcliente=t.idcliente AND c.idglobal=t.idglobal
    JOIN tbl_persona p ON p.idpersona=c.idpersona AND p.idglobal=c.idglobal
    JOIN tbl_sucursal s ON s.idsucursal=t.idsucursal AND s.idglobal=t.idglobal LIMIT 1'
)->fetch_object();
verificarTelefonos($base !== null, 'Falta una tarjeta local como plantilla de estructura.');
$fixture = -2000000017;
$tarjeta = 'PHONE-PHP-TEST-' . bin2hex(random_bytes(8));
$ocupado = db_fetch_object(
   $conexion,
   'SELECT (SELECT COUNT(*) FROM tbl_persona WHERE idpersona=?) +
           (SELECT COUNT(*) FROM tbl_clientes WHERE idcliente=?) +
           (SELECT COUNT(*) FROM mobile_customer_phone WHERE idglobal=? AND idpersona=?) AS total',
   'iiii', [$fixture, $fixture, (int)$base->idglobal, $fixture]
);
verificarTelefonos((int)$ocupado->total === 0, 'Fixture ocupado: no se modificará ningún registro existente.');
$sesionLocal = [
   'idusuario' => 1, 'idglobal' => (int)$base->idglobal,
   'userEmpresa' => (int)$base->idglobal
];

$conexion->begin_transaction();
try {
   db_execute(
      $conexion,
      "INSERT INTO tbl_persona
       (idpersona,idglobal,str_nombres,str_apellidos,str_sexo,str_tipo_documento,str_num_documento,
        str_telefono,str_email,str_foto,str_ocupacion,str_estado,str_nota,str_email_verificado,
        str_direccion_departamento,str_direccion_ciudad,str_direccion_barrio,str_direccion_calle)
       VALUES (?,?,'PHONE PHP TEST','FIXTURE','','TEST','PHONE-PHP-007',
               '300123 / 310123','','','','activo','','','','','','')",
      'ii', [$fixture, (int)$base->idglobal]
   );
   db_execute(
      $conexion,
      "INSERT INTO tbl_clientes
       (idcliente,idglobal,idpersona,dec_max_credito,str_apodo,str_nota,str_estado,str_calificacion,created_empleado_id)
       VALUES (?,?,?,0,'','','activo','',0)",
      'iii', [$fixture, (int)$base->idglobal, $fixture]
   );
   db_execute(
      $conexion,
      'INSERT INTO tbl_tarjetas
       (idtarjeta,idglobal,idsucursal,idcliente,idventa,iddetalleruta,str_concepto,dec_valor,str_modo,
        int_tiempo,dec_prestamo,dec_resta,str_descripcion,float_item,dec_utilidad,str_c_adicional_numero,
        dec_c_adicional_valor,str_tipo_comprobante,str_serie,str_numero,str_nota,str_abono,str_style,
        str_estado,created_empleado_id,date_acuerdo,created_at,updated_at)
       SELECT ?,idglobal,idsucursal,?,idventa,iddetalleruta,str_concepto,dec_valor,str_modo,
        int_tiempo,dec_prestamo,dec_resta,str_descripcion,float_item,dec_utilidad,str_c_adicional_numero,
        dec_c_adicional_valor,str_tipo_comprobante,str_serie,str_numero,str_nota,str_abono,str_style,
        str_estado,created_empleado_id,date_acuerdo,created_at,updated_at
       FROM tbl_tarjetas WHERE idtarjeta=? AND idglobal=?',
      'sisi', [$tarjeta, $fixture, $base->idtarjeta, (int)$base->idglobal]
   );
   foreach (['3000000001', '3000000002', '3000000001', '+57 3000000001', '00573000000001', '300123 / 310123'] as $index => $raw) {
      db_execute(
         $conexion, 'UPDATE tbl_persona SET str_telefono=? WHERE idpersona=? AND idglobal=?',
         'sii', [$raw, $fixture, (int)$base->idglobal]
      );
      verificarTelefonos(
         count(listarTelefonosCliente($conexion, $sesionLocal, (int)$base->idsucursal, $tarjeta)) === ($index === 0 ? 2 : 3),
         'El principal actual no se deduplicó con el historial compartido.'
      );
   }
   $lista = listarTelefonosCliente($conexion, $sesionLocal, (int)$base->idsucursal, $tarjeta);
   verificarTelefonos(
      $lista === ['300123 / 310123', '3000000001', '3000000002'],
      'El historial perdió OLD/NEW, duplicó formatos o concatenó valores inválidos.'
   );
   $cantidad = db_fetch_object(
      $conexion, 'SELECT COUNT(*) AS total FROM mobile_customer_phone WHERE idglobal=? AND idpersona=?',
      'ii', [(int)$base->idglobal, $fixture]
   );
   verificarTelefonos((int)$cantidad->total === 3, 'La base duplicó los teléfonos.');
   $primary = db_fetch_object($conexion, 'SELECT str_telefono FROM tbl_persona WHERE idpersona=?', 'i', [$fixture]);
   verificarTelefonos($primary->str_telefono === '300123 / 310123', 'Se alteró el contrato del principal.');
   esperarErrorTelefonos(
      fn() => listarTelefonosCliente($conexion, [], (int)$base->idsucursal, $tarjeta), 401
   );
   $sinPermiso = ['idusuario' => 1, 'idglobal' => (int)$base->idglobal, 'idempleado' => 2147483647];
   esperarErrorTelefonos(
      fn() => listarTelefonosCliente($conexion, $sinPermiso, (int)$base->idsucursal, $tarjeta), 403
   );
   esperarErrorTelefonos(
      fn() => listarTelefonosCliente($conexion, $sesionLocal, (int)$base->idsucursal, 'NO-PHONE-PHP-CARD'), 404
   );
   $otraEmpresa = ['idusuario' => 1, 'idglobal' => 2147483647, 'idsucursal' => (int)$base->idsucursal];
   esperarErrorTelefonos(
      fn() => listarTelefonosCliente($conexion, $otraEmpresa, (int)$base->idsucursal, $tarjeta), 404
   );
   $otraSucursal = db_fetch_object(
      $conexion, 'SELECT idsucursal FROM tbl_sucursal WHERE idglobal=? AND idsucursal<>? LIMIT 1',
      'ii', [(int)$base->idglobal, (int)$base->idsucursal]
   );
   verificarTelefonos($otraSucursal !== null, 'Falta otra sucursal local para verificar aislamiento.');
   esperarErrorTelefonos(
      fn() => listarTelefonosCliente($conexion, $sesionLocal, (int)$otraSucursal->idsucursal, $tarjeta), 404
   );
   $empleadoActivo = ['idusuario' => 1, 'idglobal' => (int)$base->idglobal, 'idsucursal' => (int)$base->idsucursal];
   mutarTelefonoCliente($conexion, $empleadoActivo, (int)$base->idsucursal, $tarjeta, '573000000001', 'principal');
   esperarErrorTelefonos(
      fn() => mutarTelefonoCliente($conexion, $empleadoActivo, (int)$base->idsucursal, $tarjeta, '573000000001', 'incorrecto'), 409);
   mutarTelefonoCliente($conexion, $empleadoActivo, (int)$base->idsucursal, $tarjeta, '573000000002', 'incorrecto');
   $gestion = gestionarListaTelefonosCliente($conexion, $empleadoActivo, (int)$base->idsucursal, $tarjeta);
   $incorrecto = array_values(array_filter($gestion['telefonos'], fn($t) => $t['normalizedPhone'] === '573000000002'))[0];
   verificarTelefonos($incorrecto['invalid'] && $incorrecto['validityChangedBy'] === '1' && $incorrecto['validityChangedAt'] !== null,
      'Marca y auditoría no persistieron para usuario autorizado sin editar cliente.');
   $otroActor = array_merge($empleadoActivo, ['idusuario' => 2]);
   mutarTelefonoCliente($conexion, $otroActor, (int)$base->idsucursal, $tarjeta, '573000000002', 'incorrecto');
   $repetido = gestionarListaTelefonosCliente($conexion, $otroActor, (int)$base->idsucursal, $tarjeta);
   verificarTelefonos($repetido === $gestion, 'Reasignar la misma marca cambió la auditoría.');
   esperarErrorTelefonos(
      fn() => mutarTelefonoCliente($conexion, $empleadoActivo, (int)$base->idsucursal, $tarjeta, '573000000002', 'principal'), 409);
   esperarErrorTelefonos(
      fn() => mutarTelefonoCliente($conexion, $sinPermiso, (int)$base->idsucursal, $tarjeta, '573000000002', 'restaurar'), 403);
   esperarErrorTelefonos(
      fn() => mutarTelefonoCliente($conexion, $empleadoActivo, (int)$base->idsucursal, $tarjeta, '573000000009', 'restaurar'), 404);
   db_execute($conexion, 'UPDATE tbl_persona SET str_telefono=? WHERE idpersona=? AND idglobal=?',
      'sii', ['3000000002', $fixture, (int)$base->idglobal]);
   verificarTelefonos(in_array('3000000002 · INCORRECTO', listarTelefonosCliente($conexion, $empleadoActivo, (int)$base->idsucursal, $tarjeta)),
      'Una actualización antigua del principal restauró el teléfono o escondió su marca.');
   mutarTelefonoCliente($conexion, $otroActor, (int)$base->idsucursal, $tarjeta, '573000000002', 'restaurar');
   $restaurado = gestionarListaTelefonosCliente($conexion, $otroActor, (int)$base->idsucursal, $tarjeta);
   $valido = array_values(array_filter($restaurado['telefonos'], fn($t) => $t['normalizedPhone'] === '573000000002'))[0];
   verificarTelefonos(!$valido['invalid'] && $valido['validityChangedBy'] === '2', 'Restauración deliberada sin autor histórico falló.');
   db_execute($conexion, 'UPDATE tbl_persona SET str_telefono=? WHERE idpersona=? AND idglobal=?',
      'sii', ['300123 / 310123', $fixture, (int)$base->idglobal]);
   echo "OK: gestión reversible, guardia del principal, autorización sin editar cliente, auditoría idempotente y compatibilidad de triggers.\n";
   verificarTelefonos(
      listarTelefonosCliente($conexion, $empleadoActivo, (int)$base->idsucursal, $tarjeta) === $lista,
      'Lectura de sucursal activa exige permisos de edición.'
   );
   db_execute($conexion, 'UPDATE tbl_persona SET str_telefono=? WHERE idpersona=? AND idglobal=?',
      'sii', ['', $fixture, (int)$base->idglobal]);
   verificarTelefonos(
      listarTelefonosCliente($conexion, $sesionLocal, (int)$base->idsucursal, $tarjeta) === $lista,
      'Vaciar el principal borró los teléfonos anteriores.'
   );
   echo "OK: lectura por empresa/sucursal/tarjeta; rechazo 401/403/404; sin editar cliente ni sucursal de sesión obligatoria.\n";
   echo "OK: triggers locales OLD/NEW, A → B → A, +57/0057, legacy intacto y unicidad en BD.\n";
} finally {
   $conexion->rollback();
}
$restos = db_fetch_object(
   $conexion,
   'SELECT (SELECT COUNT(*) FROM tbl_persona WHERE idpersona=?) +
           (SELECT COUNT(*) FROM tbl_clientes WHERE idcliente=?) +
           (SELECT COUNT(*) FROM tbl_tarjetas WHERE idtarjeta=?) +
           (SELECT COUNT(*) FROM mobile_customer_phone WHERE idglobal=? AND idpersona=?) AS total',
   'iisii', [$fixture, $fixture, $tarjeta, (int)$base->idglobal, $fixture]
);
verificarTelefonos((int)$restos->total === 0, 'La reversión dejó filas de prueba.');
echo "OK: rollback verificado; ningún registro de negocio modificado.\n";
echo 'OK: ' . $GLOBALS['asercionesTelefonos'] . " comprobaciones.\n";
