<?php

require "model/Conexion.php";

global $conexion;

$sql="SELECT * FROM tbl_empleado";
$qry = $conexion->query($sql);
while ($req=$qry->fetch_object()) {
    $sql= "UPDATE tbl_empleado SET date_fecha_inicio='$req->created_at' 
        WHERE idempleado=$req->idempleado
     ";
$conexion->query($sql);

}
			