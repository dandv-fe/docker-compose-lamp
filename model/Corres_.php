<?php
require "Conexion.php";

class Corresponsal
{
   public function __construct() {}
   public function registrar(
      $idglobal,
      $idpersona,
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
      try {
         // Verificar si ya tiene ahorro
         $sqlExist = "SELECT idahorro FROM tbl_ahorros 
          WHERE idglobal=$idglobal AND idpersona=$idpersona AND str_tipo='$str_tipo'";
         $qExist = $conexion->query($sqlExist);
         $rExist = $qExist ? $qExist->fetch_object() : null;
         if ($rExist && !empty($rExist->idahorro)) {
            echo json_encode(['status' => 'error', 'mensaje' => 'El empleado seleccionado ya tiene un corresponsal a cargo']);
            return false;
         }

         $idCuenta = uniqidReal(); // Asignar el valor adecuado para idCuenta


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
         $idahorro = $conexion->insert_id;
         $this->asegurarCuentaCorriente($idglobal, $idpersona);
         // Buscar el id_cuenta principal y el último consecutivo usado por prefijo
         $maxIntentos = 5;
         $actualizado = false;

         for ($intento = 1; $intento <= $maxIntentos; $intento++) {
            $qr_idCuentaPrincipal = "SELECT a.id_cuenta,
            (SELECT IFNULL(MAX(CAST(SUBSTRING_INDEX(b.id_cuenta,'-',-1) AS UNSIGNED)),0)
               FROM tbl_ahorros b
               WHERE b.idglobal=a.idglobal
                 AND b.id_cuenta LIKE CONCAT(REPLACE(a.id_cuenta,'-00',''), '-%')
                 AND b.id_cuenta<>a.id_cuenta) AS ultimo_consecutivo
            FROM tbl_ahorros a
             WHERE a.idglobal=$idglobal
               AND a.str_tipo='principal'
             LIMIT 1";
            $q_idCuentaPrincipal = $conexion->query($qr_idCuentaPrincipal);
            $r_idCuentaPrincipal = $q_idCuentaPrincipal ? $q_idCuentaPrincipal->fetch_object() : null;

            if (empty($r_idCuentaPrincipal) || empty($r_idCuentaPrincipal->id_cuenta)) {
               throw new Exception('No se encontró cuenta corriente principal');
            }

            $can = intval($r_idCuentaPrincipal->ultimo_consecutivo) + 1;
            $canFormateado = str_pad((string)$can, 2, '0', STR_PAD_LEFT);
            $qr_upd = "UPDATE tbl_ahorros SET id_cuenta=CONCAT(REPLACE('$r_idCuentaPrincipal->id_cuenta','-00',''), '-', '$canFormateado') WHERE idahorro=$idahorro";

            try {
               $conexion->query($qr_upd);
               $actualizado = true;
               break;
            } catch (mysqli_sql_exception $e) {
               if (intval($e->getCode()) !== 1062 || $intento >= $maxIntentos) {
                  throw $e;
               }
            }
         }

         if (!$actualizado) {
            throw new Exception('No fue posible asignar un número de cuenta único');
         }
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
                 AND a.str_tipo='corresponsal'
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

   public function tieneCorresponsalAsignado($idglobal, $idpersona, $idahorroExcluir = 0)
   {
      global $conexion;
      $idahorroExcluir = intval($idahorroExcluir);

      $sql = "SELECT idahorro
              FROM tbl_ahorros
              WHERE idglobal=$idglobal
                AND idpersona=$idpersona
                AND str_tipo='corresponsal'";

      if ($idahorroExcluir > 0) {
         $sql .= " AND idahorro<>$idahorroExcluir";
      }

      $sql .= " LIMIT 1";

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
      $idcuentatemp = uniqidReal();
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
         return 0;
      }

      $idahorroNuevo = intval($conexion->insert_id);
      if ($idahorroNuevo <= 0) {
         return 0;
      }

      $sqlUpdCuenta = "UPDATE tbl_ahorros
                       SET id_cuenta=CONCAT('$idahorroNuevo', '-00'), update_at='$dt'
                       WHERE idahorro=$idahorroNuevo";
      $conexion->query($sqlUpdCuenta);

      return $idahorroNuevo;
   }

   public function listCorresponsales($idglobal)
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
                     WHEN 'retiro' THEN m.dec_valor
                     ELSE 0 END
               ),0)
               FROM tbl_movimientos m
               WHERE m.idglobal=$idglobal
                 AND m.idahorro=a.idahorro
                 AND UPPER(m.str_estado) <> 'INACTIVO'
            ) AS saldo_real
         FROM tbl_ahorros a
         LEFT JOIN tbl_persona p ON p.idpersona = a.idpersona
         WHERE a.idglobal=$idglobal AND a.str_tipo='corresponsal'
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
                AND str_tipo='corresponsal'";

      return $conexion->query($sql);
   }

   public function listarMovimientos($idglobal, $idahorro)
   {
      global $conexion;
      $sql = "SELECT
                idmovimiento,
                date_movimiento,
                str_tipo,
                dec_valor,
                str_descripcion,
                str_estado
              FROM tbl_movimientos
              WHERE idglobal=$idglobal
                AND idahorro=$idahorro
              ORDER BY date_movimiento DESC, idmovimiento DESC";
      return $conexion->query($sql);
   }

   public function obtenerSaldoDisponible($idglobal, $idahorro)
   {
      global $conexion;
      $sql = "SELECT IFNULL(SUM(
                  CASE str_tipo
                     WHEN 'aporte' THEN dec_valor
                     WHEN 'ajuste' THEN dec_valor
                     WHEN 'retiro' THEN dec_valor
                     ELSE 0 END
               ), 0) AS saldo
              FROM tbl_movimientos
              WHERE idglobal=$idglobal
                AND idahorro=$idahorro
                AND UPPER(str_estado) <> 'INACTIVO'";
      $query = $conexion->query($sql);
      $reg = $query ? $query->fetch_object() : null;
      return $reg ? floatval($reg->saldo ?? 0) : 0;
   }

   private function obtenerCuentaPrincipalActual($idglobal, $idpersonaActual)
   {
      global $conexion;
      $idglobal = intval($idglobal);
      $idpersonaActual = intval($idpersonaActual);

      $sql = "SELECT idahorro, id_cuenta, str_estado
              FROM tbl_ahorros
              WHERE idglobal=$idglobal
                AND idpersona=$idpersonaActual
                AND str_tipo='principal'
              LIMIT 1";
      $query = $conexion->query($sql);
      return $query ? $query->fetch_object() : null;
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
         $origen = $this->obtenerCuentaPrincipalActual($idglobal, $idpersonaActual);
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
                          AND str_tipo='corresponsal'
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
         $descripcion = trim((string)$descripcion);
         $extra = $descripcion !== '' ? ' - ' . $descripcion : '';
         $descRetiro = mysqli_real_escape_string($conexion, "Transferencia enviada a cuenta {$destino->id_cuenta}{$extra}");
         $descAporte = mysqli_real_escape_string($conexion, "Transferencia recibida desde cuenta {$origen->id_cuenta}{$extra}");

         $sqlRetiro = "INSERT INTO tbl_movimientos(
                        idglobal,idahorro,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
                     ) VALUES (
                        $idglobal,{$origen->idahorro},$idusuarioCreated,'retiro',-$montoSql,'$descRetiro',NULL,'activo','$dt','$dt'
                     )";
         $conexion->query($sqlRetiro) or throw new Exception('No se pudo registrar el retiro en cuenta principal');

         $sqlAporte = "INSERT INTO tbl_movimientos(
                        idglobal,idahorro,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
                     ) VALUES (
                        $idglobal,$idahorroDestino,$idusuarioCreated,'aporte',$montoSql,'$descAporte',NULL,'activo','$dt','$dt'
                     )";
         $conexion->query($sqlAporte) or throw new Exception('No se pudo registrar la recarga del corresponsal');

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
                         AND str_tipo='corresponsal'
                       LIMIT 1";
         $qOrigen = $conexion->query($sqlOrigen);
         $origen = $qOrigen ? $qOrigen->fetch_object() : null;

         if (!$origen) {
            throw new Exception('No se encontró la cuenta corresponsal origen');
         }

         if (strtoupper($origen->str_estado) === 'INACTIVO') {
            throw new Exception('La cuenta corresponsal origen está inactiva');
         }

         $destino = $this->obtenerCuentaPrincipalActual($idglobal, $idpersonaActual);
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
         $descripcion = trim((string)$descripcion);
         $extra = $descripcion !== '' ? ' - ' . $descripcion : '';
         $descRetiro = mysqli_real_escape_string($conexion, "Transferencia enviada a cuenta {$destino->id_cuenta}{$extra}");
         $descAporte = mysqli_real_escape_string($conexion, "Transferencia recibida desde cuenta {$origen->id_cuenta}{$extra}");

         $sqlRetiro = "INSERT INTO tbl_movimientos(
                        idglobal,idahorro,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
                     ) VALUES (
                        $idglobal,{$origen->idahorro},$idusuarioCreated,'retiro',-$montoSql,'$descRetiro',NULL,'activo','$dt','$dt'
                     )";
         $conexion->query($sqlRetiro) or throw new Exception('No se pudo registrar el retiro del corresponsal');

         $sqlAporte = "INSERT INTO tbl_movimientos(
                        idglobal,idahorro,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
                     ) VALUES (
                        $idglobal,{$destino->idahorro},$idusuarioCreated,'aporte',$montoSql,'$descAporte',NULL,'activo','$dt','$dt'
                     )";
         $conexion->query($sqlAporte) or throw new Exception('No se pudo registrar el aporte en cuenta principal');

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
}
/*
1

*/
