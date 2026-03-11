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
}
/*
1

*/
