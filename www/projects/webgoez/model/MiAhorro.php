<?php
require "Conexion.php";

class MiAhorro
{
   public function __construct() {}
   public function registrar(
      int $idglobal,
      int $idpersona,
      string $str_name,
   ) {
      global $conexion;
      $sw = true;
      $conexion->autocommit(false);
      $dt = date('Y-m-d H:i:s');
      $idahorro = null;
      $dec_porcentaje = 0;
      $str_tipo = 'ahorro';
      $str_pago_utilidad = 'manual';
      $bit_auth_movimientos = 0;
      $str_estado = 'activo';
      $idCuenta = '';
      try {
         // buscar el último id_cuenta para el ahorro principal de la persona
         $sqlUltimoIdCuenta = "SELECT id_cuenta FROM tbl_ahorros 
            WHERE idpersona=$idpersona 
            ORDER BY idahorro DESC LIMIT 1";
         $qUltimoIdCuenta = $conexion->query($sqlUltimoIdCuenta);
         $rUltimoIdCuenta = $qUltimoIdCuenta ? $qUltimoIdCuenta->fetch_object() : null;

         if (!$rUltimoIdCuenta) {
            echo json_encode(['status' => 'error', 'mensaje' => 'No existe cuenta previa para generar id_cuenta']);
            $conexion->rollback();
            if ($conexion != null) {
               $conexion->close();
            }
            return false;
         } else {
            // Generar nuevo id_cuenta a partir del último: incrementar último dígito (0-8)
            $strUltimo = isset($rUltimoIdCuenta->id_cuenta) ? (string)$rUltimoIdCuenta->id_cuenta : '';
            if ($strUltimo === '') {
               echo json_encode(['status' => 'error', 'mensaje' => 'Formato inválido de id_cuenta previo']);
               $conexion->rollback();
               if ($conexion != null) {
                  $conexion->close();
               }
               return false;
            }

            $lastChar = substr($strUltimo, -1);
            if (!ctype_digit($lastChar)) {
               echo json_encode(['status' => 'error', 'mensaje' => 'Formato inválido de id_cuenta previo']);
               $conexion->rollback();
               if ($conexion != null) {
                  $conexion->close();
               }
               return false;
            }

            $digit = intval($lastChar);
            if ($digit >= 0 && $digit <= 8) {
               $prefix = substr($strUltimo, 0, -1);
               $idCuenta = $prefix . (string)($digit + 1);
            } else {
               // Si el último dígito es 9 -> devolver error
               echo json_encode(['status' => 'error', 'mensaje' => 'No se puede generar id_cuenta: último dígito es 9']);
               $conexion->rollback();
               if ($conexion != null) {
                  $conexion->close();
               }
               return false;
            }
         }




         $sqlIns = "INSERT INTO tbl_ahorros (
                   idglobal,idpersona,dec_porcentaje,
                   str_name,
                   id_cuenta,
                   str_tipo,
                   str_pago_utilidad,
                   bit_auth_movimientos, str_estado, created_at, update_at
                 ) VALUES (
                   $idglobal,$idpersona,$dec_porcentaje,
                   '$str_name',
                   '$idCuenta',
                   '$str_tipo',
                   '$str_pago_utilidad',
                  $bit_auth_movimientos,'$str_estado','$dt','$dt'
                 )";
         $conexion->query($sqlIns) or throw new Exception('error!');
      } catch (Exception $e) {
         print_r($e);
         $sw = false;
         $conexion->rollback();
      }

      if ($sw) {
         $conexion->commit();
      }

      if ($conexion != null) {
         $conexion->close();
      }

      $msg = $sw ? ['status' => 'success', 'idahorro' => $idahorro, 'mensaje' => 'Cuenta correctamente creada'] : ['status' => 'error', 'mensaje' => 'ERROR: Cuenta Corresponsal no ha podido ser creada.'];
      echo json_encode($msg);
   }
   public function cboListEmpleado($idglobal, $idahorroExcluir = 0)
   {
      global $conexion;
      $idahorroExcluir = intval($idahorroExcluir);

      $filtroExcluir = '';
      if ($idahorroExcluir > 0) {
         $filtroExcluir = " AND a.idahorro<>$idahorroExcluir ";
      }

      $sql = "SELECT 
            e.idpersona AS ref,
            CONCAT(p.str_nombres,' ',p.str_apellidos) AS empleado,
            e.str_cargo AS cargo,
            (
               SELECT COUNT(1)
               FROM tbl_ahorros a
               WHERE a.idglobal=e.idglobal
                 AND a.idpersona=e.idpersona
                 AND a.str_tipo='corresponsal'
                 $filtroExcluir
            ) AS ocupado
         FROM tbl_empleado e INNER JOIN
            tbl_persona p ON p.idpersona=e.idpersona
         WHERE e.idglobal=$idglobal
           AND e.str_estado<>'inactivo'
           AND TRIM(IFNULL(p.str_email, '')) <> ''
           AND CAST(IFNULL(p.str_email_verificado, '0') AS UNSIGNED) = 1
           AND UPPER(TRIM(IFNULL(e.str_cargo, ''))) <> 'SUPER ADMINISTRADOR'
         ORDER BY e.idempleado DESC";
      $query = $conexion->query($sql);
      return $query;
   }

   public function esSuperAdministrador($idglobal, $idpersona)
   {
      global $conexion;
      $sql = "SELECT e.idempleado
              FROM tbl_empleado e
              WHERE e.idglobal=$idglobal
                AND e.idpersona=$idpersona
                AND UPPER(TRIM(IFNULL(e.str_cargo, ''))) = 'SUPER ADMINISTRADOR'
              LIMIT 1";
      $query = $conexion->query($sql);
      $reg = $query ? $query->fetch_object() : null;
      return !empty($reg);
   }

   public function tieneCuentasAhorros($idpersona, $cantidadAprobada)
   {
      global $conexion;

      $idpersona = intval($idpersona);
      $cantidadAprobada = intval($cantidadAprobada);

      if ($cantidadAprobada <= 0) {
         return false;
      }

      $sql = "SELECT IFNULL(COUNT(1),0) AS cantidad
              FROM tbl_ahorros
              WHERE idpersona=$idpersona
                        AND str_tipo='ahorro'
                        AND LOWER(TRIM(IFNULL(str_name, ''))) <> 'ahorro programado'";

      $query = $conexion->query($sql);
      $reg = $query ? $query->fetch_object() : null;
      $cantidadActual = $reg ? intval($reg->cantidad) : 0;
      return $cantidadActual >= $cantidadAprobada;
   }

   public function empleadoConEmailVerificado($idpersona)
   {
      global $conexion;
      $sql = "SELECT p.idpersona
              FROM tbl_persona p
             
              WHERE p.idpersona=$idpersona
                AND p.str_estado<>'inactivo'
                AND TRIM(IFNULL(p.str_email, '')) <> ''
                AND CAST(IFNULL(p.str_email_verificado, '0') AS UNSIGNED) = 1
              LIMIT 1";
      $query = $conexion->query($sql);
      $reg = $query ? $query->fetch_object() : null;
      return !empty($reg);
   }

   public function asegurarCuentaCorriente(int $idglobal, int $idpersona)
   {
      global $conexion;
      $idglobal = intval($idglobal);
      $idpersona = intval($idpersona);

      $sqlExist = "SELECT idahorro
                   FROM tbl_ahorros
                   WHERE idglobal=$idglobal
                     AND idpersona=$idpersona
                     AND str_tipo='corriente'
                   LIMIT 1";
      $qExist = $conexion->query($sqlExist);
      $rExist = $qExist ? $qExist->fetch_object() : null;
      if (!empty($rExist->idahorro)) {
         return intval($rExist->idahorro);
      }

      $dt = date('Y-m-d H:i:s');

      $idcuentatemp = 0;


      $sqlIdCuenta = "SELECT id_cuenta FROM tbl_ahorros where id_cuenta like '%0' ORDER BY idahorro DESC LIMIT 1";
      $qIdCuenta = $conexion->query($sqlIdCuenta);
      $ultimoIdCuenta = $qIdCuenta ? $qIdCuenta->fetch_object()->id_cuenta : null;


      // Generar nuevo id_cuenta a partir del último: quitar último dígito, sumar 1, añadir '0'
      $strUltimo = intval($ultimoIdCuenta);
      if ($strUltimo === 0) {
         // No existe cuenta previa -> devolver error
         echo json_encode(['status' => 'error', 'mensaje' => 'No existe cuenta previa para generar id_cuenta']);
         $conexion->rollback();
         if ($conexion != null) {
            $conexion->close();
         }
         return '0';
      }

      $idcuentatemp = $strUltimo + 10;
      $idcuentatemp = (string)$idcuentatemp;

      $sqlIns = "INSERT INTO tbl_ahorros (
                    idglobal,
                    idpersona,
                    dec_porcentaje,
                    str_name,
                    id_cuenta,
                    str_tipo,
                    str_pago_utilidad,
                    bit_auth_movimientos,
                    str_estado,
                    created_at,
                    update_at
                 ) VALUES (
                    $idglobal,
                    $idpersona,
                    0.1,
                    'Cuenta Principal',
                     '$idcuentatemp',
                    'ahorro',
                    'manual',
                    1,
                    'autorizada',
                    '$dt',
                    '$dt'
                 )";

      $ok = $conexion->query($sqlIns);

      if (!$ok) {
         return 0;
      }

      $idahorroNuevo = intval($conexion->insert_id);
      if ($idahorroNuevo <= 0) {
         return 0;
      }
      return $idahorroNuevo;
   }

   public function listMisAhorros($idpersona)
   {
      global $conexion;
      $sql = "SELECT 
            a.idahorro,
            a.idpersona,
            a.str_name,
            a.dec_porcentaje,
            a.id_cuenta,
            a.str_tipo,
            a.str_pago_utilidad,
            a.bit_auth_movimientos,
            a.str_estado,
            a.created_at,
            p.str_nombres,
            p.str_apellidos,
            p.str_foto,
            (
               SELECT IFNULL(SUM(
                  CASE m.str_tipo
                     WHEN 'aporte' THEN m.dec_valor
                     WHEN 'ajuste' THEN m.dec_valor
                     WHEN 'retiro' THEN -m.dec_valor
                     WHEN 'entrada' THEN m.dec_valor
                     WHEN 'salida' THEN -m.dec_valor
                     ELSE 0 END
               ),0)
               +(SELECT IFNULL(SUM(
                  CASE m2.str_tipo
                     WHEN 'aporte' THEN -m2.dec_valor
                     WHEN 'ajuste' THEN -m2.dec_valor
                     WHEN 'retiro' THEN m2.dec_valor
                     ELSE 0 END
               ),0)
               FROM tbl_movimientos m2
               WHERE m2.idahorro_de=a.idahorro
                 AND UPPER(IFNULL(m2.str_estado, '')) <> 'INACTIVO')
               FROM tbl_movimientos m
               WHERE m.idahorro=a.idahorro
                 AND UPPER(IFNULL(m.str_estado, '')) <> 'INACTIVO'
            ) AS saldo_real
         FROM tbl_ahorros a
         LEFT JOIN tbl_persona p ON p.idpersona = a.idpersona
             WHERE a.idpersona=$idpersona
                AND a.str_tipo IN ('ahorro')
         ORDER BY a.idahorro DESC";
      $query = $conexion->query($sql);
      return $query;
   }

   public function actualizar(
      int $idglobal,
      int $idahorro,
      int $idpersona,
      string $str_name
   ) {
      global $conexion;
      $dt = date('Y-m-d H:i:s');
      $sqlExist = "SELECT idahorro, str_name FROM tbl_ahorros 
           WHERE idahorro=$idahorro";
      $qExist = $conexion->query($sqlExist);
      $rExist = $qExist ? $qExist->fetch_object() : null;

      if (empty($rExist->idahorro)) {
         return ['status' => 'error', 'mensaje' => 'La cuenta no existe'];
      }

      $nombreCuenta = trim((string)$rExist->str_name);
      if (
         strcasecmp($nombreCuenta, 'Ahorro Programado') === 0 ||
         strcasecmp($nombreCuenta, 'Cuenta Programada') === 0
      ) {
         return ['status' => 'error', 'mensaje' => 'No se puede editar la cuenta'];
      }


      $sql = "UPDATE tbl_ahorros SET
               idpersona=$idpersona,
               str_name='$str_name',
               update_at='$dt'
              WHERE idglobal=$idglobal
                AND idahorro=$idahorro
                AND str_tipo='ahorro'";

      $ok = $conexion->query($sql);
      return [
         'status' => $ok ? 'success' : 'error',
         'mensaje' => $ok ? 'Ahorro actualizado correctamente' : 'No se pudo actualizar el ahorro'
      ];
   }

   public function listarMovimientos(int $idglobal, int $idahorro)
   {
      global $conexion;
      $idglobal = intval($idglobal);
      $idahorro = intval($idahorro);

      $sql = "SELECT
                        m.idmovimiento,
                        m.idahorro_de,
                        m.date_movimiento,
                        m.str_tipo,
                        CASE WHEN m.idahorro=$idahorro THEN m.str_tipo
                           WHEN m.str_tipo='retiro' THEN 'Transferencia recibida'
                           WHEN m.str_tipo IN ('aporte','ajuste') THEN 'Transferencia enviada'
                           ELSE m.str_tipo
                        END AS tipo_presentacion,
                        m.dec_valor,
                        CASE
                           WHEN m.idahorro = $idahorro THEN
                              CASE m.str_tipo
                                 WHEN 'retiro' THEN -m.dec_valor
                                 WHEN 'salida' THEN -m.dec_valor
                                 ELSE m.dec_valor
                              END
                           WHEN m.idahorro_de = $idahorro THEN
                              CASE m.str_tipo
                                 WHEN 'aporte' THEN -m.dec_valor
                                 WHEN 'ajuste' THEN -m.dec_valor
                                 WHEN 'retiro' THEN m.dec_valor
                                 ELSE 0
                              END
                           ELSE 0
                        END AS monto_firmado,
                        m.str_descripcion,
                        m.str_estado,
                        a.idahorro,
                        IFNULL(NULLIF(TRIM(a.id_cuenta), ''), CONCAT('Ahorro #', a.idahorro)) AS id_cuenta,
                        IFNULL(NULLIF(TRIM(a.str_name), ''), CONCAT('Ahorro #', a.idahorro)) AS str_name,
                        TRIM(CONCAT(IFNULL(p.str_nombres, ''), ' ', IFNULL(p.str_apellidos, ''))) AS ahorrador,
                        IFNULL(NULLIF(TRIM(p.str_tipo_documento), ''), '-') AS str_tipo_documento,
                        IFNULL(NULLIF(TRIM(p.str_num_documento), ''), '-') AS str_num_documento
                     FROM tbl_movimientos m
                     INNER JOIN tbl_ahorros a ON a.idahorro = $idahorro AND a.idglobal = m.idglobal
                     LEFT JOIN tbl_persona p ON p.idpersona = a.idpersona AND p.idglobal=a.idglobal
                     WHERE m.idglobal=$idglobal
                        AND (m.idahorro=$idahorro OR m.idahorro_de=$idahorro)
                        AND UPPER(IFNULL(m.str_estado, '')) <> 'INACTIVO'
                     ORDER BY m.date_movimiento DESC, m.idmovimiento DESC";
      return $conexion->query($sql);
   }

   public function listarMovimientosPersona($idglobal, $idpersona)
   {
      global $conexion;
      $idglobal = intval($idglobal);
      $idpersona = intval($idpersona);

      // Incluir movimientos donde la cuenta del usuario esté en idahorro OR en idahorro_de
      $sql = "SELECT
                        m.idmovimiento,
                        m.date_movimiento,
                        m.str_tipo,
                        m.dec_valor,
                        (CASE WHEN a1.idpersona=$idpersona THEN
                           CASE WHEN m.str_tipo IN ('retiro','salida') THEN -m.dec_valor ELSE m.dec_valor END
                           ELSE 0 END)
                        + (CASE WHEN a2.idpersona=$idpersona AND m.idahorro_de<>m.idahorro THEN
                           CASE WHEN m.str_tipo IN ('aporte','ajuste') THEN -m.dec_valor
                                WHEN m.str_tipo='retiro' THEN m.dec_valor ELSE 0 END
                           ELSE 0 END) AS monto_firmado,
                        CASE
                           WHEN a1.idpersona=$idpersona AND a2.idpersona=$idpersona
                             AND m.idahorro_de<>m.idahorro AND m.str_tipo IN ('aporte','ajuste','retiro')
                             THEN 'Transferencia entre mis cuentas'
                           WHEN a1.idpersona=$idpersona THEN m.str_tipo
                           WHEN m.str_tipo='retiro' THEN 'Transferencia recibida'
                           WHEN m.str_tipo IN ('aporte','ajuste') THEN 'Transferencia enviada'
                           ELSE m.str_tipo
                        END AS tipo_presentacion,
                        m.str_descripcion,
                        m.str_estado,
                        CASE WHEN a1.idpersona=$idpersona THEN a1.idahorro ELSE a2.idahorro END AS idahorro,
                        CASE WHEN a1.idpersona=$idpersona THEN a1.id_cuenta ELSE a2.id_cuenta END AS id_cuenta,
                        CASE WHEN a1.idpersona=$idpersona THEN a1.str_name ELSE a2.str_name END AS str_name,
                        TRIM(CONCAT(IFNULL(p.str_nombres, ''), ' ', IFNULL(p.str_apellidos, ''))) AS ahorrador,
                        IFNULL(NULLIF(TRIM(p.str_tipo_documento), ''), '-') AS str_tipo_documento,
                        IFNULL(NULLIF(TRIM(p.str_num_documento), ''), '-') AS str_num_documento
                     FROM tbl_movimientos m
                     LEFT JOIN tbl_ahorros a1 ON a1.idahorro = m.idahorro AND a1.idglobal = m.idglobal
                     LEFT JOIN tbl_ahorros a2 ON a2.idahorro = m.idahorro_de AND a2.idglobal = m.idglobal
                     LEFT JOIN tbl_persona p ON p.idpersona = CASE WHEN a1.idpersona=$idpersona
                        THEN a1.idpersona ELSE a2.idpersona END AND p.idglobal=m.idglobal
                     WHERE m.idglobal=$idglobal
                        AND (
                           (a1.idpersona IS NOT NULL AND a1.idpersona=$idpersona)
                           OR (a2.idpersona IS NOT NULL AND a2.idpersona=$idpersona)
                        )
                        AND UPPER(IFNULL(m.str_estado, '')) <> 'INACTIVO'
                        AND (
                           (a1.str_tipo IS NOT NULL AND a1.str_tipo IN ('ahorro','corriente','principal'))
                           OR (a2.str_tipo IS NOT NULL AND a2.str_tipo IN ('ahorro','corriente','principal'))
                        )
                     ORDER BY m.date_movimiento DESC, m.idmovimiento DESC";

      return $conexion->query($sql);
   }

   public function obtenerSaldoDisponible($idglobal, $idahorro)
   {
      global $conexion;
      $idglobal = intval($idglobal);
      $idahorro = intval($idahorro);

      $sql = "SELECT IFNULL(SUM(
                  CASE m.str_tipo
                     WHEN 'aporte' THEN m.dec_valor
                     WHEN 'ajuste' THEN m.dec_valor
                     WHEN 'retiro' THEN -m.dec_valor
                     WHEN 'entrada' THEN m.dec_valor
                     WHEN 'salida' THEN -m.dec_valor
                     ELSE 0 END
               ), 0)
               +(SELECT IFNULL(SUM(
                  CASE m2.str_tipo
                     WHEN 'aporte' THEN -m2.dec_valor
                     WHEN 'ajuste' THEN -m2.dec_valor
                     WHEN 'retiro' THEN m2.dec_valor
                     ELSE 0 END
               ), 0)
               FROM tbl_movimientos m2
               WHERE m2.idglobal=$idglobal
                 AND m2.idahorro_de=$idahorro
                 AND UPPER(IFNULL(m2.str_estado, '')) <> 'INACTIVO') AS saldo
              FROM tbl_movimientos m
              WHERE m.idglobal=$idglobal
                AND m.idahorro=$idahorro
                AND UPPER(IFNULL(m.str_estado, '')) <> 'INACTIVO'";
      $query = $conexion->query($sql);
      $reg = $query ? $query->fetch_object() : null;
      return $reg ? floatval($reg->saldo ?? 0) : 0;
   }

   private function obtenerCuentaBaseActual($idglobal, $idpersonaActual)
   {
      global $conexion;
      $idglobal = intval($idglobal);
      $idpersonaActual = intval($idpersonaActual);

      $sqlBase = "SELECT idahorro, id_cuenta, str_tipo, str_estado
                  FROM tbl_ahorros
                  WHERE idglobal=$idglobal
                    AND idpersona=$idpersonaActual
                    AND str_tipo IN ('corriente','principal')
                  ORDER BY CASE str_tipo WHEN 'corriente' THEN 0 ELSE 1 END, idahorro ASC
                  LIMIT 1";
      $qBase = $conexion->query($sqlBase);
      return $qBase ? $qBase->fetch_object() : null;
   }

   private function ahorroPermiteMovimientos($idglobal, $idpersonaActual, $idahorro)
   {
      global $conexion;
      $idglobal = intval($idglobal);
      $idpersonaActual = intval($idpersonaActual);
      $idahorro = intval($idahorro);

      if ($idglobal <= 0 || $idpersonaActual <= 0 || $idahorro <= 0) {
         return false;
      }

      $sql = "SELECT bit_auth_movimientos
              FROM tbl_ahorros
              WHERE idglobal=$idglobal
                AND idpersona=$idpersonaActual
                AND idahorro=$idahorro
                AND str_tipo='ahorro'
              LIMIT 1";
      $query = $conexion->query($sql);
      $reg = $query ? $query->fetch_object() : null;

      return !empty($reg) && intval($reg->bit_auth_movimientos ?? 0) === 1;
   }

   public function transferirDesdeCuentaBaseActual($idglobal, $idpersonaActual, $idahorroDestino, $idusuarioCreated, $monto, $descripcion = '')
   {
      global $conexion;

      $idglobal = intval($idglobal);
      $idpersonaActual = intval($idpersonaActual);
      $idahorroDestino = intval($idahorroDestino);
      $idusuarioCreated = intval($idusuarioCreated);
      $monto = floatval($monto);

      if ($idglobal <= 0 || $idpersonaActual <= 0 || $idahorroDestino <= 0 || $idusuarioCreated <= 0 || $monto <= 0) {
         return ['status' => 'error', 'mensaje' => 'Parámetros inválidos'];
      }

      if (!$this->ahorroPermiteMovimientos($idglobal, $idpersonaActual, $idahorroDestino)) {
         return ['status' => 'error', 'mensaje' => 'Este ahorro no está autorizado para recargar o retirar movimientos'];
      }

      $sw = true;
      $conexion->autocommit(false);
      $dt = date('Y-m-d H:i:s');

      try {
         $origen = $this->obtenerCuentaBaseActual($idglobal, $idpersonaActual);
         if (!$origen) {
            throw new Exception('No se encontró la cuenta base actual (corriente o principal)');
         }

         if (strtoupper($origen->str_estado) === 'INACTIVO') {
            throw new Exception('La cuenta base actual está inactiva');
         }

         if (intval($origen->idahorro) === $idahorroDestino) {
            throw new Exception('La cuenta destino no puede ser la misma cuenta base');
         }

         $sqlDestino = "SELECT idahorro, id_cuenta, str_estado
                        FROM tbl_ahorros
                        WHERE idglobal=$idglobal
                          AND idahorro=$idahorroDestino
                          AND idpersona=$idpersonaActual
                          AND str_tipo='ahorro'
                        LIMIT 1";
         $qDestino = $conexion->query($sqlDestino);
         $destino = $qDestino ? $qDestino->fetch_object() : null;

         if (!$destino) {
            throw new Exception('Cuenta destino no encontrada');
         }

         if (strtoupper($destino->str_estado) === 'INACTIVO') {
            throw new Exception('La cuenta destino está inactiva');
         }

         $saldoOrigen = $this->obtenerSaldoDisponible($idglobal, intval($origen->idahorro));
         if ($saldoOrigen < $monto) {
            throw new Exception('Saldo insuficiente en la cuenta base');
         }

         $montoSql = number_format($monto, 2, '.', '');
         $descripcion = trim((string)$descripcion);
         //$extra = $descripcion !== '' ? ' - ' . $descripcion : '';
         // $descRetiro = mysqli_real_escape_string($conexion, "Transferencia re a cuenta {$destino->id_cuenta}{$extra}");
         //$descAporte = mysqli_real_escape_string($conexion, "Transferencia recibida desde cuenta {$origen->id_cuenta}{$extra}");

         $sqlRetiro = "INSERT INTO tbl_movimientos(
                        idglobal,idahorro,idahorro_de,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
                     ) VALUES (
                        $idglobal,$idahorroDestino,{$origen->idahorro},$idusuarioCreated,'aporte',$montoSql,'$descripcion',NULL,'activo','$dt','$dt'
                     )";
         $conexion->query($sqlRetiro) or throw new Exception('No se pudo registrar el retiro en cuenta base');
         /*
         $sqlAporte = "INSERT INTO tbl_movimientos(
                        idglobal,idahorro,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
                     ) VALUES (
                        $idglobal,$idahorroDestino,$idusuarioCreated,'aporte',$montoSql,'$descAporte',NULL,'activo','$dt','$dt'
                     )";
         $conexion->query($sqlAporte) or throw new Exception('No se pudo registrar el aporte en mi ahorro');
*/
         $sqlUpd = "UPDATE tbl_ahorros SET update_at='$dt' WHERE idahorro IN ({$origen->idahorro}, $idahorroDestino)";
         $conexion->query($sqlUpd) or throw new Exception('No se pudo actualizar la fecha de las cuentas');
      } catch (Exception $e) {
         $sw = false;
         $conexion->rollback();
         return ['status' => 'error', 'mensaje' => $e->getMessage()];
      }

      if ($sw) {
         $conexion->commit();
      }

      return [
         'status' => 'success',
         'mensaje' => 'Recarga realizada desde la cuenta base actual',
         'monto' => $monto
      ];
   }

   public function transferirHaciaCuentaBaseActual($idglobal, $idpersonaActual, $idahorroOrigen, $idusuarioCreated, $monto, $descripcion = '')
   {
      global $conexion;

      $idglobal = intval($idglobal);
      $idpersonaActual = intval($idpersonaActual);
      $idahorroOrigen = intval($idahorroOrigen);
      $idusuarioCreated = intval($idusuarioCreated);
      $monto = floatval($monto);

      if ($idglobal <= 0 || $idpersonaActual <= 0 || $idahorroOrigen <= 0 || $idusuarioCreated <= 0 || $monto <= 0) {
         return ['status' => 'error', 'mensaje' => 'Parámetros inválidos'];
      }

      if (!$this->ahorroPermiteMovimientos($idglobal, $idpersonaActual, $idahorroOrigen)) {
         return ['status' => 'error', 'mensaje' => 'Este ahorro no está autorizado para recargar o retirar movimientos'];
      }

      $sw = true;
      $conexion->autocommit(false);
      $dt = date('Y-m-d H:i:s');

      try {
         $sqlOrigen = "SELECT idahorro, id_cuenta, str_estado
                       FROM tbl_ahorros
                       WHERE idglobal=$idglobal
                         AND idahorro=$idahorroOrigen
                         AND idpersona=$idpersonaActual
                         AND str_tipo='ahorro'
                       LIMIT 1";
         $qOrigen = $conexion->query($sqlOrigen);
         $origen = $qOrigen ? $qOrigen->fetch_object() : null;

         if (!$origen) {
            throw new Exception('No se encontró la cuenta de ahorro origen');
         }

         if (strtoupper($origen->str_estado) === 'INACTIVO') {
            throw new Exception('La cuenta de ahorro origen está inactiva');
         }

         $destino = $this->obtenerCuentaBaseActual($idglobal, $idpersonaActual);
         if (!$destino) {
            throw new Exception('No se encontró la cuenta base actual (corriente o principal)');
         }

         if (strtoupper($destino->str_estado) === 'INACTIVO') {
            throw new Exception('La cuenta base actual está inactiva');
         }

         if (intval($origen->idahorro) === intval($destino->idahorro)) {
            throw new Exception('La cuenta destino no puede ser la misma cuenta origen');
         }

         $saldoOrigen = $this->obtenerSaldoDisponible($idglobal, intval($origen->idahorro));
         if ($saldoOrigen < $monto) {
            throw new Exception('Saldo insuficiente para realizar el retiro');
         }

         $montoSql = number_format($monto, 2, '.', '');
         $descripcion = trim((string)$descripcion);

         $sqlRetiro = "INSERT INTO tbl_movimientos(
                        idglobal,idahorro,idahorro_de,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
                     ) VALUES (
                        $idglobal,$idahorroOrigen,{$destino->idahorro},$idusuarioCreated,'retiro',$montoSql,'$descripcion',NULL,'activo','$dt','$dt'
                     )";
         $conexion->query($sqlRetiro) or throw new Exception('No se pudo registrar el retiro en mi ahorro');
         /*
         $sqlAporte = "INSERT INTO tbl_movimientos(
                        idglobal,idahorro,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
                     ) VALUES (
                        $idglobal,{$destino->idahorro},$idusuarioCreated,'aporte',$montoSql,'$descAporte',NULL,'activo','$dt','$dt'
                     )";
         $conexion->query($sqlAporte) or throw new Exception('No se pudo registrar el aporte en cuenta base');
*/
         $sqlUpd = "UPDATE tbl_ahorros SET update_at='$dt' WHERE idahorro IN ({$origen->idahorro}, {$destino->idahorro})";
         $conexion->query($sqlUpd) or throw new Exception('No se pudo actualizar la fecha de las cuentas');
      } catch (Exception $e) {
         $sw = false;
         $conexion->rollback();
         return ['status' => 'error', 'mensaje' => $e->getMessage()];
      }

      if ($sw) {
         $conexion->commit();
      }

      return [
         'status' => 'success',
         'mensaje' => 'Retiro enviado a la cuenta base actual',
         'monto' => $monto
      ];
   }
}
/*
1

*/
