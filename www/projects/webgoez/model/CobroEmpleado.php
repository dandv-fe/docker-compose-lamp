<?php
require "Conexion.php";

class CobroDetallado
{


    public function __construct()
    {
    }
   

    public function list()
    {
        global $conexion;
        $sql = "";
        $query = $conexion->query($sql);
        return $query;
    }
   
}
