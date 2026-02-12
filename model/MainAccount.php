<?php
require "Conexion.php";

class MainAccount
{
   public function __construct() {}
   public function registrar($idglobal, $idpersona)
   {
      global $conexion;
      $sw = true;
      $conexion->autocommit(false);
      $dt = date('Y-m-d H:i:s');
      $idahorro = null;
      try {
         // Verificar si ya tiene ahorro
         $sqlExist = "SELECT idahorro FROM tbl_ahorros WHERE idglobal=$idglobal AND idpersona=$idpersona AND str_tipo='principal'";
         $qExist = $conexion->query($sqlExist);
         $rExist = $qExist ? $qExist->fetch_object() : null;
         if ($rExist && !empty($rExist->idahorro)) {
            echo json_encode(['status' => 'error', 'mensaje' => 'Ya existe una cuenta de principal para esta empresa']);
            return false;
         }

         $idCuenta = '6'; // Asignar el valor adecuado para idCuenta

         $sqlIns = "INSERT INTO tbl_ahorros (
                   idglobal,idpersona,dec_porcentaje,
                   str_name,
                   id_cuenta,
                   str_tipo,
                   str_pago_utilidad,
                   bit_auth_movimientos, str_estado, created_at, update_at
                 ) VALUES (
                   $idglobal,$idpersona,0,
                   'Cuenta Principal',
                   '$idCuenta',
                   'principal',
                   'manual',
                  1,'activo','$dt','$dt'
                 )";
         $conexion->query($sqlIns) or throw new Exception('error!');
         $idahorro = $conexion->insert_id;
      } catch (Exception $e) {
         $sw = false;
         $conexion->rollback();
      }

      if ($sw) {
         $conexion->commit();
      }

      if ($conexion != null) {
         $conexion->close();
      }

      $msg = $sw ? ['status' => 'success', 'idahorro' => $idahorro, 'mensaje' => 'Cuenta principal creada'] : ['status' => 'error', 'mensaje' => 'ERROR: Cuenta principal no ha podido ser creada.'];
      echo json_encode($msg);
   }
   public function goAccount($idglobal, $idpersona)
   {
      global $conexion;
      $sql = "SELECT * FROM `tbl_ahorros` 
      WHERE idglobal=$idglobal AND idpersona=$idpersona AND str_tipo='principal'";
      $query = $conexion->query($sql);
      return $query;
   }
   public function registrarMovimientoRA($idglobal, $idahorro, $idusuario_created, $tipo, $valor, $descripcion, $estado = 'activo')
   {
      // Inserta movimiento; actualización de acumulado se realiza en AhorrosAjax.php
      global $conexion;
      $dt = date('Y-m-d H:i:s');
      $sql = "INSERT INTO tbl_movimientos(
                idglobal,idahorro,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
              ) VALUES (
                $idglobal,$idahorro,$idusuario_created,'$tipo',$valor,'$descripcion',NULL,'$estado','$dt','$dt'
              )";
      return $conexion->query($sql);
   }
}
/*
1

*/
