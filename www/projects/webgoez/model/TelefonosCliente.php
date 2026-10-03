<?php
require_once __DIR__ . '/AutorizarDespachoCartera.php';

function validarLecturaTelefonosCliente(array $sesion, int $idsucursal, string $idtarjeta): void
{
   if ((int)($sesion['idusuario'] ?? 0) <= 0 || (int)($sesion['idglobal'] ?? 0) <= 0) {
      throw new RuntimeException('Inicia sesión para consultar los teléfonos.', 401);
   }
   if ($idsucursal <= 0 || trim($idtarjeta) === '' || strlen($idtarjeta) > 50) {
      throw new RuntimeException('Selecciona una tarjeta y una sucursal válidas.', 400);
   }
}

function telefonosClienteSinDuplicados(array $filas): array
{
   $telefonos = [];
   foreach ($filas as $fila) {
      $raw = trim((string)($fila['raw_phone'] ?? ''));
      if ($raw === '') {
         continue;
      }
      $normalizado = $fila['normalized_phone'] ?? null;
      $clave = $normalizado !== null ? 'phone:' . $normalizado : 'legacy:' . $raw;
      if (!array_key_exists($clave, $telefonos)) {
         $telefonos[$clave] = $raw . (!empty($fila['is_invalid']) ? ' · INCORRECTO' : '');
      }
   }
   return array_values($telefonos);
}

function autorizarPersonaTelefonosCliente(mysqli $conexion, array $sesion, int $idsucursal, string $idtarjeta, bool $bloquear = false): object
{
   validarLecturaTelefonosCliente($sesion, $idsucursal, $idtarjeta);
   if (!puedeVerDetalleCuentasSucursal($conexion, $sesion, $idsucursal)) {
      throw new RuntimeException('No tienes permiso para consultar esta sucursal.', 403);
   }
   $idglobal = (int)$sesion['idglobal'];
   $persona = db_fetch_object(
      $conexion,
      'SELECT p.idpersona, p.str_telefono
       FROM tbl_tarjetas t
       JOIN tbl_sucursal s ON s.idsucursal=t.idsucursal AND s.idglobal=t.idglobal
       JOIN tbl_clientes c ON c.idcliente=t.idcliente AND c.idglobal=t.idglobal
       JOIN tbl_persona p ON p.idpersona=c.idpersona AND p.idglobal=c.idglobal
       WHERE t.idtarjeta=? AND t.idglobal=? AND t.idsucursal=? LIMIT 1' . ($bloquear ? ' FOR UPDATE' : ''),
      'sii',
      [$idtarjeta, $idglobal, $idsucursal]
   );
   if ($persona === null) {
      throw new RuntimeException('La tarjeta no pertenece a esta empresa y sucursal.', 404);
   }
   return $persona;
}

function listarTelefonosCliente(mysqli $conexion, array $sesion, int $idsucursal, string $idtarjeta): array
{
   $persona = autorizarPersonaTelefonosCliente($conexion, $sesion, $idsucursal, $idtarjeta);
   $idglobal = (int)$sesion['idglobal'];
   $consulta = db_prepare_execute(
      $conexion,
      'SELECT raw_phone, normalized_phone,is_invalid FROM mobile_customer_phone
       WHERE idglobal=? AND idpersona=? ORDER BY idphone',
      'ii',
      [$idglobal, (int)$persona->idpersona]
   );
   $filas = $consulta->get_result()->fetch_all(MYSQLI_ASSOC);
   $consulta->close();
   // La función compartida define la misma identidad para el teléfono actual y el historial.
   $actual = db_fetch_object(
      $conexion, 'SELECT ? AS raw_phone, mobile_normalize_phone(?) AS normalized_phone',
      'ss', [(string)$persona->str_telefono, (string)$persona->str_telefono]
   );
   $filas[] = (array)$actual;
   return telefonosClienteSinDuplicados($filas);
}

function gestionarListaTelefonosCliente(mysqli $conexion, array $sesion, int $idsucursal, string $idtarjeta): array
{
   $persona = autorizarPersonaTelefonosCliente($conexion, $sesion, $idsucursal, $idtarjeta);
   $consulta = db_prepare_execute($conexion,
      'SELECT CAST(idphone AS CHAR) AS id,raw_phone AS phone,normalized_phone AS normalizedPhone,
              is_invalid AS invalid,CAST(validity_changed_by AS CHAR) AS validityChangedBy,
              validity_changed_at AS validityChangedAt
       FROM mobile_customer_phone WHERE idglobal=? AND idpersona=? ORDER BY idphone',
      'ii', [(int)$sesion['idglobal'], (int)$persona->idpersona]);
   $filas = $consulta->get_result()->fetch_all(MYSQLI_ASSOC);
   $consulta->close();
   $actual = db_fetch_object($conexion, 'SELECT mobile_normalize_phone(?) AS phone', 's', [(string)$persona->str_telefono]);
   foreach ($filas as &$fila) {
      $fila['invalid'] = (int)$fila['invalid'] === 1;
      $fila['primary'] = $fila['normalizedPhone'] !== null && $fila['normalizedPhone'] === $actual->phone;
   }
   unset($fila);
   return ['telefonos' => $filas, 'principal' => (string)$persona->str_telefono];
}

function validarCsrfTelefonosCliente(array $sesion, $token): void
{
   if (!is_string($token) || !isset($sesion['csrfTelefonosCliente']) ||
       !hash_equals($sesion['csrfTelefonosCliente'], $token)) {
      throw new RuntimeException('Solicitud no válida. Abre nuevamente Gestionar teléfonos.', 403);
   }
}

function mutarTelefonoCliente(mysqli $conexion, array $sesion, int $idsucursal, string $idtarjeta, string $telefono, string $accion): void
{
   if (!in_array($accion, ['incorrecto', 'restaurar', 'principal'], true)) {
      throw new RuntimeException('Acción inválida.', 400);
   }
   $persona = autorizarPersonaTelefonosCliente($conexion, $sesion, $idsucursal, $idtarjeta, true);
   $normalizado = db_fetch_object($conexion, 'SELECT mobile_normalize_phone(?) AS phone', 's', [$telefono]);
   if ($normalizado->phone === null || $normalizado->phone !== $telefono) {
      throw new RuntimeException('Selecciona un teléfono normalizado del historial.', 400);
   }
   $fila = db_fetch_object($conexion,
      'SELECT is_invalid FROM mobile_customer_phone WHERE idglobal=? AND idpersona=? AND normalized_phone=? FOR UPDATE',
      'iis', [(int)$sesion['idglobal'], (int)$persona->idpersona, $telefono]);
   if ($fila === null) {
      throw new RuntimeException('El teléfono no pertenece a este cliente.', 404);
   }
   $principal = db_fetch_object($conexion, 'SELECT mobile_normalize_phone(?) AS phone', 's', [(string)$persona->str_telefono]);
   if ($accion === 'incorrecto' && !(bool)$fila->is_invalid && $principal->phone === $telefono) {
      throw new RuntimeException('Selecciona primero otro teléfono principal antes de marcar este como incorrecto.', 409);
   }
   if ($accion === 'principal') {
      if ((bool)$fila->is_invalid) {
         throw new RuntimeException('Este teléfono está marcado INCORRECTO. Restáuralo primero.', 409);
      }
      db_execute($conexion, 'UPDATE tbl_persona SET str_telefono=? WHERE idglobal=? AND idpersona=?',
         'sii', [$telefono, (int)$sesion['idglobal'], (int)$persona->idpersona]);
   } else {
      $invalid = $accion === 'incorrecto' ? 1 : 0;
      db_execute($conexion,
         'UPDATE mobile_customer_phone SET is_invalid=?,validity_changed_by=?,validity_changed_at=NOW()
          WHERE idglobal=? AND idpersona=? AND normalized_phone=? AND is_invalid<>?',
         'iiiisi', [$invalid, (int)$sesion['idusuario'], (int)$sesion['idglobal'], (int)$persona->idpersona, $telefono, $invalid]);
   }
}
