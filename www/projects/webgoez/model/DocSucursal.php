<?php
require "Conexion.php";

class DocSucursal
{

   public function __construct() {}


   public function Registrar($idglobal, $idsucursal, $detalle)
   {
      global $conexion;
      $conexion->autocommit(false);
      $sw = true;


      try {
         foreach ($detalle as $indice => $valor) {
            // $valor estructura esperada: [nombre_tipo, id_tipo_opcional, serie, numero]
            // Si el índice 0 no es numérico, obtener el idtipo_documento por nombre.
            $idtipo_documento_val = null;
            if (isset($valor[0]) && !is_numeric($valor[0])) {
               $nombreTipo = $conexion->real_escape_string($valor[0]);
               $sql_get_id = "SELECT idtipo_documento FROM tbl_tipo_documento WHERE str_nombre = '$nombreTipo' LIMIT 1";
               $res_get_id = $conexion->query($sql_get_id);
               if ($res_get_id && $row = $res_get_id->fetch_assoc()) {
                  $idtipo_documento_val = (int)$row['idtipo_documento'];
               } else {
                  throw new Exception('Tipo de documento no encontrado: ' . $valor[0]);
               }
            } else {
               // Si ya viene numérico, usarlo directamente
               $idtipo_documento_val = (int)$valor[0];
            }

            $ultima_serie = isset($valor[2]) ? $conexion->real_escape_string($valor[2]) : '';
            $ultimo_numero = isset($valor[3]) ? $conexion->real_escape_string($valor[3]) : '';

            $sql_detalle = "INSERT INTO tbl_detalle_documento_sucursal(
							idglobal,
							idsucursal,
							idtipo_documento,
							str_ultima_serie,
							str_ultimo_numero
					)
					VALUES($idglobal, $idsucursal, $idtipo_documento_val, '$ultima_serie',  '$ultimo_numero' )";
            $conexion->query($sql_detalle)  or throw new Exception('error!');
         }
      } catch (Exception $e) {
         print_r($e);
         $sw = false;
         $conexion->rollback();
      }
      $conexion->commit();
      if ($conexion != null) {

         $conexion->close();
      }
      return $sw;
   }

   public function Modificar($iddetalle_documento_sucursal, $idsucursal, $idtipo_documento, $serie, $numero)
   {
      global $conexion;
      $conexion->autocommit(false);
      $sw = true;


      try {
         $sql = "UPDATE tbl_detalle_documento_sucursal set idsucursal = $idsucursal, idtipo_documento = $idtipo_documento,
						str_ultima_serie = '$serie', str_ultimo_numero = '$numero'
						where iddetalle_documento_sucursal = $iddetalle_documento_sucursal";
         $conexion->query($sql) or throw new Exception('error!');
      } catch (Exception $e) {
         //
         $sw = false;
         $conexion->rollback();
      }
      $conexion->commit();
      if ($conexion != null) {

         $conexion->close();
      }
      return $sw;
   }

   public function Eliminar($iddetalle_documento_sucursal)
   {
      global $conexion;
      $sql = "DELETE FROM tbl_detalle_documento_sucursal
						where iddetalle_documento_sucursal = $iddetalle_documento_sucursal";
      $query = $conexion->query($sql);
      return $query;
   }

   public function ListarTipoDocumento($tipo)
   {
      global $conexion;
      $sql = "select * from tbl_tipo_documento where str_operacion = '$tipo'";
      $query = $conexion->query($sql);
      return $query;
   }

   public function ListarTipoAsunto($getAsunto)
   {
      global $conexion;
      $sql = "select * from tipo_documento where nombre = '$getAsunto'";
      $query = $conexion->query($sql);
      return $query;
   }

   public function ListarDetalleDocSuc($idsucursal)
   {
      global $conexion;
      $sql = "SELECT dds.*, td.str_nombre 
			FROM tbl_detalle_documento_sucursal dds INNER JOIN tbl_tipo_documento td ON dds.idtipo_documento = td.idtipo_documento
			WHERE dds.idsucursal = $idsucursal";
      $query = $conexion->query($sql);
      return $query;
   }
}
