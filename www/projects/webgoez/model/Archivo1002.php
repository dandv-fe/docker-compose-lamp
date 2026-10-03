<?php
require "Conexion_up.php";

class ClassArchivo1002
{


  public function __construct()
  {
  }
  public function Archivo1002($num_documento) {
    global $conexion_up;

    $sql= "SELECT
        a.*,
        s.razon_social 
      FROM
        `archivo_tar` a
        INNER JOIN sucursal s ON s.idsucursal = a.idsucrsal 
      WHERE
        a.cc_cliente = $num_documento ";
  $query = $conexion_up->query($sql);
  return $query;

  }
}