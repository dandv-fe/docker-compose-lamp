<?php
require "Conexion.php";

class CobroDetallado
{


    public function __construct()
    {
    }


    public function list($idsucursal, $desde, $hasta, $ultimo)
    {
        global $conexion;
        $cajaInit = 0;
        $query=null;
        if ($ultimo == 'true') {
            $sql = "SELECT IFNULL( sum( efectivoCaja ), 0 ) as efectivoCaja FROM view_cobro_detallado WHERE refSucursal=$idsucursal ";
            $query = $conexion->query($sql);
            $cajaInitval = $query->fetch_object();
            $cajaInit = floatval($cajaInitval->efectivoCaja);
            $sql = "SELECT * FROM `view_cobro_detallado` WHERE refSucursal=$idsucursal ORDER BY fecha_at DESC LIMIT 1";
            $query = $conexion->query($sql);
        } else {
            $fechaPreCaja=date('Y-m-d', strtotime($hasta . ' +1 day'));
            $sql = "SELECT IFNULL( sum( efectivoCaja ), 0 ) as efectivoCaja FROM view_cobro_detallado WHERE refSucursal=$idsucursal AND fecha_at<'$desde'";
            $query = $conexion->query($sql);
            $cajaInitval = $query->fetch_object();
            $cajaInit = floatval($cajaInitval->efectivoCaja);
            $sql = "SELECT *  FROM `view_cobro_detallado` WHERE refSucursal=$idsucursal AND fecha_at>='$desde' AND fecha_at<='$fechaPreCaja'";
            $query = $conexion->query($sql);
        }
        return array($query, $cajaInit);
    }
    public function listTblDetalleRuta($iddetalleruta, $userEmpleadoId)
    {
        global $conexion;
        $caja = 0;
        $sql = "SELECT 
        iddetalleruta AS refDetalle_ruta,
       
        str_estado AS estado
         FROM tbl_detalle_ruta WHERE iddetalleruta=$iddetalleruta ";
        $query = $conexion->query($sql);




        return array($query, $caja);
    }

    public function listDetalleCobrado($iddetalleruta)
    {
        global $conexion;
        $sql = "SELECT 
        d.dec_abono AS abono,
        d.str_descripcion As descripcion,
        d.created_at AS fecha_at,
        CONCAT(p.str_nombres,' ',p.str_apellidos ) AS nombre,
        p.str_tipo_documento AS t_documento,
        p.str_num_documento AS n_documento,
		p.str_telefono AS tel,
		p.str_foto as foto,
        t.str_concepto AS consepto,
        t.dec_valor AS valor,
        t.dec_prestamo AS costo,
        t.dec_c_adicional_valor AS ut_adi_valor
        
        
         FROM tbl_descripcion d
		INNER JOIN tbl_tarjetas t ON t.idtarjeta=d.idtarjeta 
		INNER JOIN tbl_clientes c ON c.idcliente=t.idcliente
        INNER JOIN tbl_persona p ON p.idpersona = c.idpersona
		 WHERE d.iddetalleruta=$iddetalleruta ORDER BY d.created_at ASC ";
        $query = $conexion->query($sql);
        return $query;
    }
    public function listDetalleTblTergetas($iddetalleruta)
    {
        global $conexion;
        $sql = "SELECT 
        t.idtarjeta AS refTarjeta,
        CONCAT(p.str_nombres,' ',p.str_apellidos ) AS nombre,
        p.str_tipo_documento AS t_documento,
        p.str_num_documento AS n_documento,
		p.str_telefono AS tel,
		p.str_foto as foto,
        t.str_concepto AS consepto,
        t.dec_valor AS valor,
        t.dec_prestamo AS costo,
        t.dec_c_adicional_valor AS ut_adi_valor
        
        FROM tbl_tarjetas t
		INNER JOIN tbl_clientes c ON c.idcliente=t.idcliente
        INNER JOIN tbl_persona p ON p.idpersona = c.idpersona
		 WHERE t.iddetalleruta=$iddetalleruta 
         ORDER BY t.created_at ASC";
        $query = $conexion->query($sql);
        return $query;
    }

    public function listDetalleTblContabilidad($iddetalleruta)
    {
        global $conexion;
$str_de=array('efectivo','base','efectivoMonedas');
        $sql= "SELECT str_de FROM tbl_de_contabilidad";
        $query = $conexion->query($sql);
        while ($fetch=$query->fetch_object()) {
           array_push($str_de, $fetch->str_de);
        }



        $sql = "SELECT
        dc.idcontabilidad_detalle AS refContabilidad_detalle,
        dc.idtipo_contabilidad AS refCategoria_contabilidad,
        dc.iddetalleruta AS refDetalleRuta,
        dc.dec_total AS valor,
        dc.str_detalle AS descripcion,
        dc.str_nombre AS nombre,
        dc.str_estado AS estado,
        dc.str_operacion AS op,
        dc.created_empleado_id AS createdEmpleado,
        dc.created_at AS fecha_at,
        ( SELECT CONCAT(p.str_nombres,' ',p.str_apellidos) FROM tbl_detalle_nomina dn INNER JOIN
        tbl_nomina n ON n.idnomina=dn.idnomina INNER JOIN
        tbl_empleado e ON e.idempleado=n.idempleado INNER JOIN
        tbl_persona p ON p.idpersona=e.idpersona
         WHERE dn.idcontabilidad_detalle = dc.idcontabilidad_detalle ) AS nombreEmpleado ,
         ( SELECT p.str_foto FROM tbl_detalle_nomina dn INNER JOIN
        tbl_nomina n ON n.idnomina=dn.idnomina INNER JOIN
        tbl_empleado e ON e.idempleado=n.idempleado INNER JOIN
        tbl_persona p ON p.idpersona=e.idpersona
         WHERE dn.idcontabilidad_detalle = dc.idcontabilidad_detalle ) AS fotoEmpleado 
    FROM
        tbl_contabilidad_detalle dc 
    WHERE
        dc.iddetalleruta = $iddetalleruta
        AND dc.str_operacion LIKE '%-totalizar'";
        $query = $conexion->query($sql);
        return array($query, $str_de);
    }

}
