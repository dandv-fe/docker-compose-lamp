<?php
require "Conexion.php";

class Consultas
{


    public function __construct()
    {
    }
    public function listEgresos($idSucursal, $desde, $hasta)
    {
        global $conexion;
        $fechaHasta=date('Y-m-d', strtotime($hasta . ' +1 day'));
        $sql = "SELECT *
        FROM view_egresos WHERE refSucursal=$idSucursal AND fecha_at>='$desde' AND fecha_at<='$fechaHasta'";
        $query = $conexion->query($sql);
        return $query;
    }

    

}
