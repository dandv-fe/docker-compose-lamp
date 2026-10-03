<?php
require "Conexion.php";

class Configuracion
{


    public function __construct()
    {
    }

    public function Registrar($empresa, $nombre_impuesto, $porcentaje_impuesto, $logo)
    {
        global $conexion;
        $sql = "INSERT INTO global(empresa,nombre_impuesto,porcentaje_impuesto, logo)
						VALUES('$empresa','$nombre_impuesto','$porcentaje_impuesto', '$logo')";
        $query = $conexion->query($sql);
        return $query;
    }

    public function Modificar($idglobal, $empresa, $nombre_impuesto, $porcentaje_impuesto, $logo)
    {
        global $conexion;
        $sql = "UPDATE tbl_global set 
                str_razon_social = '$empresa', 
                str_nombre_impuesto='$nombre_impuesto', 
                dec_porcentaje_impuesto='$porcentaje_impuesto', 
                str_logo = '$logo'
						WHERE idglobal = $idglobal";
        $query = $conexion->query($sql);
        return $query;
    }

    public function GuardarApp($idglobal, $rutaApp)
    {
        global $conexion;
        $sql = "UPDATE global set applicacion_windows = '$rutaApp'
						WHERE idglobal = $idglobal";
        $query = $conexion->query($sql);
        return $query;
    }

    public function Eliminar($idglobal)
    {
        global $conexion;
        $sql = "DELETE FROM global WHERE idglobal = $idglobal";
        $query = $conexion->query($sql);
        return $query;
    }

    public function Listar()
    {
        global $conexion;
        $idglobal=$_SESSION['userEmpresa'];
        $sql = "SELECT
        g.idglobal AS codigo,
        g.str_razon_social AS empresa,
        g.str_email AS email,
        g.str_nombre_impuesto AS name_impuesto,
        g.dec_porcentaje_impuesto AS porcentaje_impuesto,
        g.str_logo AS logo,
        g.str_telefono AS telefono,
        g.bool_writemiles AS writemiles,
        g.bool_viewmiles AS viewmiles,
        g.created_at AS fecha_at,
        d.iddivisa AS refDivisa,
        d.divisa AS nomreMoneda 
    FROM
        tbl_global g
        INNER JOIN tbl_divisa d ON d.iddivisa = g.divisaid 
    WHERE
        idglobal =$idglobal";
        $query = $conexion->query($sql);
        return $query;
    }




}
