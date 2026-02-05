<?php
require "Conexion.php";

class Corres_
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
}
/*
1

*/
