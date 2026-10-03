<?php
require "Conexion.php";

class AhorrosProgramado
{
   public function __construct() {}
   public function registrar(
      $idglobal,
      $idpersonaE,
      $dec_porcentaje,
      $str_name,
      $str_tipo,
      $str_pago_utilidad,
      $bit_auth_movimientos,
      $str_estado
   ) {
      global $conexion;
      $sw = true;
      $conexion->autocommit(false);
      $dt = date('Y-m-d H:i:s');
      $idahorro = null;
      $str_name = 'Ahorro Programado';
      try {
         // buscar el último id_cuenta para el ahorro principal de la persona
         $sqlUltimoIdCuenta = "SELECT id_cuenta FROM tbl_ahorros 
            WHERE idpersona=$idpersonaE
            ORDER BY idahorro DESC LIMIT 1";
         $qUltimoIdCuenta = $conexion->query($sqlUltimoIdCuenta);
         $rUltimoIdCuenta = $qUltimoIdCuenta ? $qUltimoIdCuenta->fetch_object() : null;
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




         $sqlIns = "INSERT INTO tbl_ahorros (
                   idglobal,idpersona,dec_porcentaje,
                   str_name,
                   id_cuenta,
                   str_tipo,
                   str_pago_utilidad,
                   bit_auth_movimientos, str_estado, created_at, update_at
                 ) VALUES (
                   $idglobal,$idpersonaE,$dec_porcentaje,
                   '$str_name',
                   '$idCuenta',
                   '$str_tipo',
                   '$str_pago_utilidad',
                  $bit_auth_movimientos,'$str_estado','$dt','$dt'
                 )";
         $conexion->query($sqlIns) or throw new Exception('error!');
      } catch (Exception $e) {
         //print_r($e);
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
      $idglobal = intval($idglobal);
      $idahorroExcluir = intval($idahorroExcluir);

      $filtroExcluir = '';
      if ($idahorroExcluir > 0) {
         $filtroExcluir = " AND a.idahorro<>$idahorroExcluir ";
      }

      $sql = "SELECT 
            e.idpersona AS ref,
            CONCAT(p.str_nombres,' ',p.str_apellidos) AS empleado,
            e.str_cargo AS cargo,
            CASE WHEN TRIM(IFNULL(p.str_email, '')) <> '' THEN 1 ELSE 0 END AS tiene_email,
            CAST(IFNULL(p.str_email_verificado, '0') AS UNSIGNED) AS email_verificado,
            CASE
               WHEN UPPER(TRIM(IFNULL(e.str_cargo, ''))) = 'SUPER ADMINISTRADOR' THEN 1
               ELSE 0
            END AS es_super_admin,
            (
               SELECT COUNT(1)
               FROM tbl_ahorros a
               WHERE a.idglobal=e.idglobal
                 AND a.idpersona=e.idpersona
                 AND a.str_tipo='ahorro'
                 AND a.str_name='Ahorro Programado'
                 $filtroExcluir
            ) AS ocupado
         FROM tbl_empleado e INNER JOIN
            tbl_persona p ON p.idpersona=e.idpersona
         WHERE e.idglobal=$idglobal
           AND e.str_estado<>'inactivo'
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


   public function empleadoConEmailVerificado($idglobal, $idpersona)
   {
      global $conexion;
      $sql = "SELECT e.idempleado
              FROM tbl_empleado e
              INNER JOIN tbl_persona p ON p.idpersona = e.idpersona
              WHERE e.idglobal=$idglobal
                AND e.idpersona=$idpersona
                AND e.str_estado<>'inactivo'
                AND TRIM(IFNULL(p.str_email, '')) <> ''
                AND CAST(IFNULL(p.str_email_verificado, '0') AS UNSIGNED) = 1
              LIMIT 1";
      $query = $conexion->query($sql);
      $reg = $query ? $query->fetch_object() : null;
      return !empty($reg);
   }

   public function asegurarCuentaCorriente($idglobal, $idpersona)
   {
      global $conexion;
      $idglobal = intval($idglobal);
      $idpersona = intval($idpersona);

      $sqlExist = "SELECT id_cuenta
                   FROM tbl_ahorros
                   WHERE idpersona=$idpersona
                     AND str_tipo='corriente'
                   LIMIT 1";
      $qExist = $conexion->query($sqlExist);
      $rExist = $qExist ? $qExist->fetch_object() : null;
      if (!empty($rExist->id_cuenta)) {
         return (string)$rExist->id_cuenta;
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
                    'corriente',
                    'manual',
                    1,
                    'autorizada',
                    '$dt',
                    '$dt'
                 )";

      $ok = $conexion->query($sqlIns);

      if (!$ok) {
         return '0';
      }

      $idahorroNuevo = intval($conexion->insert_id);
      if ($idahorroNuevo <= 0) {
         return '0';
      }
      return (string)$idcuentatemp;
   }

   public function listCorresponsales($idpersona)
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
         WHERE  a.str_tipo='ahorro'
           AND a.str_name='Ahorro Programado'
         ORDER BY a.idahorro DESC";
      $query = $conexion->query($sql);
      return $query;
   }

   public function actualizar(
      $idglobal,
      $idahorro,
      $idpersona,
      $dec_porcentaje,
      $str_name,
      $str_pago_utilidad,
      $bit_auth_movimientos,
      $str_estado
   ) {
      global $conexion;
      $dt = date('Y-m-d H:i:s');
      $str_name = 'Ahorro Programado';

      $sql = "UPDATE tbl_ahorros SET
               idpersona=$idpersona,
               dec_porcentaje=$dec_porcentaje,
               str_name='$str_name',
               str_pago_utilidad='$str_pago_utilidad',
               bit_auth_movimientos=$bit_auth_movimientos,
               str_estado='$str_estado',
               update_at='$dt'
              WHERE idglobal=$idglobal
                AND idahorro=$idahorro
                AND str_tipo='ahorro'";

      return $conexion->query($sql);
   }

   public function existeAhorroProgramadoPorPersona($idglobal, $idpersona, $idahorroExcluir = 0)
   {
      global $conexion;
      $idglobal = intval($idglobal);
      $idpersona = intval($idpersona);
      $idahorroExcluir = intval($idahorroExcluir);

      $sql = "SELECT idahorro
              FROM tbl_ahorros
              WHERE idglobal=$idglobal
                AND idpersona=$idpersona
                AND str_name='Ahorro Programado'";

      if ($idahorroExcluir > 0) {
         $sql .= " AND idahorro<>$idahorroExcluir";
      }

      $sql .= " LIMIT 1";

      $query = $conexion->query($sql);
      $reg = $query ? $query->fetch_object() : null;
      return !empty($reg);
   }

   public function listarMovimientos($idglobal, $idahorro)
   {
      global $conexion;
      $sql = "SELECT
                idmovimiento,
                idahorro,
                idahorro_de,
                date_movimiento,
                str_tipo,
                dec_valor,
                str_descripcion,
                str_estado
              FROM tbl_movimientos
              WHERE idglobal=$idglobal
                AND (idahorro=$idahorro OR idahorro_de=$idahorro)
              ORDER BY date_movimiento DESC, idmovimiento DESC";
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

   public function registrarMovimiento($idglobal, $idahorro, $idusuarioCreated, $tipo, $valor, $descripcion, $estado = 'activo')
   {
      global $conexion;
      $dt = date('Y-m-d H:i:s');
      $valor = floatval($valor);
      if ($tipo === 'retiro' && $valor > 0) {
         $valor = -$valor;
      }
      if ($tipo !== 'retiro' && $valor < 0) {
         $valor = abs($valor);
      }

      $descripcion = mysqli_real_escape_string($conexion, $descripcion);
      $valorSql = number_format($valor, 2, '.', '');

      $sql = "INSERT INTO tbl_movimientos(
                idglobal,idahorro,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
              ) VALUES (
                $idglobal,$idahorro,$idusuarioCreated,'$tipo',$valorSql,'$descripcion',NULL,'$estado','$dt','$dt'
              )";

      $ok = $conexion->query($sql);
      if ($ok) {
         $conexion->query("UPDATE tbl_ahorros SET update_at='$dt' WHERE idahorro=$idahorro AND idglobal=$idglobal");
      }

      return $ok;
   }

   public function transferirDesdePrincipalActual($idglobal, $idpersonaActual, $idahorroDestino, $idusuarioCreated, $monto, $descripcion = '')
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

      $sw = true;
      $conexion->autocommit(false);
      $dt = date('Y-m-d H:i:s');

      try {
         $sqlOrigen = "SELECT idahorro, id_cuenta, str_tipo, str_estado
                                  FROM tbl_ahorros
                                  WHERE idglobal=$idglobal
                                     AND idpersona=$idpersonaActual
                                     AND LOWER(IFNULL(str_tipo, '')) IN ('principal','corriente')
                                  ORDER BY CASE WHEN LOWER(IFNULL(str_tipo, ''))='principal' THEN 0 ELSE 1 END, idahorro ASC
                                  LIMIT 1";
         $qOrigen = $conexion->query($sqlOrigen);
         $origen = $qOrigen ? $qOrigen->fetch_object() : null;

         if (!$origen) {
            throw new Exception('No se encontró la cuenta principal actual');
         }

         if (strtoupper($origen->str_estado) === 'INACTIVO') {
            throw new Exception('La cuenta principal actual está inactiva');
         }

         if (intval($origen->idahorro) === $idahorroDestino) {
            throw new Exception('La cuenta destino no puede ser la misma cuenta principal');
         }

         $sqlDestino = "SELECT idahorro, id_cuenta, str_estado
                        FROM tbl_ahorros
                        WHERE idglobal=$idglobal
                          AND idahorro=$idahorroDestino
                          AND str_name='Ahorro Programado'
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
            throw new Exception('Saldo insuficiente en la cuenta principal');
         }

         $montoSql = number_format($monto, 2, '.', '');
         $descripcion = mysqli_real_escape_string($conexion, trim((string)$descripcion));

         $sqlAporte = "INSERT INTO tbl_movimientos(
                        idglobal,idahorro,idahorro_de,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
                     ) VALUES (
                        $idglobal,{$destino->idahorro},{$origen->idahorro},$idusuarioCreated,'aporte',$montoSql,'$descripcion',NULL,'activo','$dt','$dt'
                     )";
         $conexion->query($sqlAporte) or throw new Exception('No se pudo registrar el aporte en ahorro programado');
         /*
         $sqlAporte = "INSERT INTO tbl_movimientos(
                        idglobal,idahorro,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
                     ) VALUES (
                        $idglobal,$idahorroDestino,$idusuarioCreated,'aporte',$montoSql,'$descAporte',NULL,'activo','$dt','$dt'
                     )";
         $conexion->query($sqlAporte) or throw new Exception('No se pudo registrar el aporte en ahorro programado');
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
         'mensaje' => 'Recarga realizada desde la cuenta principal',
         'monto' => $monto
      ];
   }

   public function transferirHaciaPrincipalActual($idglobal, $idpersonaActual, $idahorroOrigen, $idusuarioCreated, $monto, $descripcion = '')
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

      $sw = true;
      $conexion->autocommit(false);
      $dt = date('Y-m-d H:i:s');

      try {
         $sqlOrigen = "SELECT idahorro, id_cuenta, str_estado
                       FROM tbl_ahorros
                       WHERE idglobal=$idglobal
                         AND idahorro=$idahorroOrigen
                         AND str_name='Ahorro Programado'
                       LIMIT 1";
         $qOrigen = $conexion->query($sqlOrigen);
         $origen = $qOrigen ? $qOrigen->fetch_object() : null;

         if (!$origen) {
            throw new Exception('No se encontró el ahorro programado origen');
         }

         if (strtoupper($origen->str_estado) === 'INACTIVO') {
            throw new Exception('El ahorro programado origen está inactivo');
         }

         $sqlDestino = "SELECT idahorro, id_cuenta, str_tipo, str_estado
                                    FROM tbl_ahorros
                                    WHERE idglobal=$idglobal
                                       AND idpersona=$idpersonaActual
                                       AND LOWER(IFNULL(str_tipo, '')) IN ('principal','corriente')
                                    ORDER BY CASE WHEN LOWER(IFNULL(str_tipo, ''))='principal' THEN 0 ELSE 1 END, idahorro ASC
                                    LIMIT 1";
         $qDestino = $conexion->query($sqlDestino);
         $destino = $qDestino ? $qDestino->fetch_object() : null;

         if (!$destino) {
            throw new Exception('No se encontró la cuenta principal actual');
         }

         if (strtoupper($destino->str_estado) === 'INACTIVO') {
            throw new Exception('La cuenta principal actual está inactiva');
         }

         if (intval($origen->idahorro) === intval($destino->idahorro)) {
            throw new Exception('La cuenta destino no puede ser la misma cuenta origen');
         }

         $saldoOrigen = $this->obtenerSaldoDisponible($idglobal, intval($origen->idahorro));
         if ($saldoOrigen < $monto) {
            throw new Exception('Saldo insuficiente para realizar el retiro');
         }

         $montoSql = number_format($monto, 2, '.', '');
         $descripcion = mysqli_real_escape_string($conexion, trim((string)$descripcion));

         $sqlRetiro = "INSERT INTO tbl_movimientos(
                        idglobal,idahorro,idahorro_de,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
                     ) VALUES (
                        $idglobal,{$origen->idahorro},{$destino->idahorro},$idusuarioCreated,'retiro',$montoSql,'$descripcion',NULL,'activo','$dt','$dt'
                     )";
         $conexion->query($sqlRetiro) or throw new Exception('No se pudo registrar el retiro en ahorro programado');

         /*
         $sqlAporte = "INSERT INTO tbl_movimientos(
                        idglobal,idahorro,idahorro_de,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
                     ) VALUES (
                        $idglobal,{$destino->idahorro},{$origen->idahorro},$idusuarioCreated,'aporte',$montoSql,'$descripcion',NULL,'activo','$dt','$dt'
                     )";
         $conexion->query($sqlAporte) or throw new Exception('No se pudo registrar el aporte en cuenta principal');
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
         'mensaje' => 'Retiro enviado a la cuenta principal',
         'monto' => $monto
      ];
   }

   public function registrarAjusteInteresesConPrincipalActual($idglobal, $idpersonaActual, $idahorroDestino, $idusuarioCreated, $monto, $descripcion = '')
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

      $sw = true;
      $conexion->autocommit(false);
      $dt = date('Y-m-d H:i:s');

      try {
         $sqlOrigen = "SELECT idahorro, id_cuenta, str_tipo, str_estado
                       FROM tbl_ahorros
                       WHERE idglobal=$idglobal
                         AND idpersona=$idpersonaActual
                         AND LOWER(IFNULL(str_tipo, '')) IN ('principal','corriente')
                       ORDER BY CASE WHEN LOWER(IFNULL(str_tipo, ''))='principal' THEN 0 ELSE 1 END, idahorro ASC
                       LIMIT 1";
         $qOrigen = $conexion->query($sqlOrigen);
         $origen = $qOrigen ? $qOrigen->fetch_object() : null;

         if (!$origen) {
            throw new Exception('No se encontró la cuenta principal actual');
         }

         if (strtoupper($origen->str_estado) === 'INACTIVO') {
            throw new Exception('La cuenta principal actual está inactiva');
         }

         if (intval($origen->idahorro) === $idahorroDestino) {
            throw new Exception('La cuenta destino no puede ser la misma cuenta principal');
         }

         $sqlDestino = "SELECT idahorro, id_cuenta, str_estado
                        FROM tbl_ahorros
                        WHERE idglobal=$idglobal
                          AND idahorro=$idahorroDestino
                          AND str_name='Ahorro Programado'
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
            throw new Exception('Saldo insuficiente en la cuenta principal');
         }

         $montoSql = number_format($monto, 2, '.', '');
         $descripcion = mysqli_real_escape_string($conexion, trim((string)$descripcion));
         /*
         $sqlRetiro = "INSERT INTO tbl_movimientos(
                        idglobal,idahorro,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
                     ) VALUES (
                        $idglobal,{$origen->idahorro},$idusuarioCreated,'ajuste',-$montoSql,'$descRetiro',NULL,'activo','$dt','$dt'
                     )";
         $conexion->query($sqlRetiro) or throw new Exception('No se pudo registrar el ajuste en cuenta principal');
*/
         $sqlAjuste = "INSERT INTO tbl_movimientos(
                        idglobal,idahorro,idahorro_de,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
                     ) VALUES (
                        $idglobal,$idahorroDestino,{$origen->idahorro},$idusuarioCreated,'ajuste',$montoSql,'$descripcion',NULL,'activo','$dt','$dt'
                     )";
         $conexion->query($sqlAjuste) or throw new Exception('No se pudo registrar el ajuste en ahorro programado');

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
         'mensaje' => 'Intereses aportados correctamente',
         'monto' => $monto
      ];
   }
}
/*
1

*/
