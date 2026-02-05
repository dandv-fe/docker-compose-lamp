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
         $sqlExist = "SELECT idahorro FROM tbl_ahorros WHERE idglobal=$idglobal AND idpersona=$idpersona AND str_tipo='$str_tipo'";
         $qExist = $conexion->query($sqlExist);
         $rExist = $qExist ? $qExist->fetch_object() : null;
         if ($rExist && !empty($rExist->idahorro)) {
            echo json_encode(['status' => 'error', 'mensaje' => 'Ya existe una cuenta de principal para esta empresa']);
            return false;
         }

         $idCuenta = '15'; // Asignar el valor adecuado para idCuenta

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
   public function goAccount($idglobal, $idpersona)
   {
      global $conexion;
      $sql = "SELECT * FROM `tbl_ahorros` 
      WHERE idglobal=$idglobal AND idpersona=$idpersona AND str_tipo='principal'";
      $query = $conexion->query($sql);
      return $query;
   }
}
/*
1

*/
