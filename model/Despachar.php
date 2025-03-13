<?php
require "Conexion.php";

class Despachar
{


    public function __construct()
    {
    }
    public function registrar($idglobal, $idsucursal, $empleados_ids)
    {
        global $conexion;
        $conexion->autocommit(false);
        $sw = true;
        $dt = date('Y-m-d H:i:s');
        try {
            $sql = "SELECT iddetalleruta FROM tbl_detalle_ruta
            WHERE str_estado='created' AND idsucursal=$idsucursal";
            $queryDR = $conexion->query($sql);
            $resDR = $queryDR->fetch_object();

            if (isset($resDR->iddetalleruta)) {
                echo "ya esta despachada";
                return;
            }
            $sql = "INSERT INTO tbl_detalle_ruta(
                idglobal,
                idsucursal,
                idempleado_resibe,
                str_estado,
                created_at,
                updated_at
                )
                    VALUES ($idglobal, $idsucursal,0,'created','$dt','$dt')
                ";
            $conexion->query($sql) or throw new Exception("error!");
            $iddetalleruta = $conexion->insert_id;

            foreach ($empleados_ids as $indice => $valor) {
                $idemplCobra = uniqidReal();
                $idempleado = limpiar_cadena2($valor);

                $sql = "SELECT idempleadoscobrando FROM tbl_empleados_cobrando
                WHERE idempleado= $idempleado AND id_detalle_ruta=$iddetalleruta";
                $queryif = $conexion->query($sql);
                $resif = $queryif->fetch_object();
                if (!isset($resif->idempleadoscobrando)) {
                    $sql_detalle = "INSERT INTO tbl_empleados_cobrando (
                    idempleadoscobrando,
                    idempleado,
                    id_detalle_ruta,
                    str_estado
                    )
                    VALUES('$idemplCobra',$idempleado,$iddetalleruta,'created')";
                    $conexion->query($sql_detalle) or throw new Exception('error!');
                }
            }
        } catch (Exception $e) {

            $sw = false;
            $conexion->rollback();
        }
        $conexion->commit();
        if ($conexion != null) {
            $conexion->close();
        }
        $mensaje = $sw ? "¡Correctamente!" : "¡ERROR: Inesperado!";
        echo $mensaje;
        return $sw;
    }
    public function modificar($id_detalle_ruta, $empleados_ids)
    {
        global $conexion;
        $conexion->autocommit(false);
        $sw = true;
        try {
            $empleadosGuardados = array();
            $sql = "SELECT idempleadoscobrando, idempleado FROM tbl_empleados_cobrando WHERE id_detalle_ruta=$id_detalle_ruta";
            $query = $conexion->query($sql);
            while ($res = $query->fetch_object()) {
                array_push($empleadosGuardados, $res->idempleado);
                if (in_array($res->idempleado, $empleados_ids) == false) {
                    $sql = "DELETE FROM tbl_empleados_cobrando WHERE idempleadoscobrando='$res->idempleadoscobrando'";
                    $conexion->query($sql) or throw new Exception('error!');
                }
            }


            foreach ($empleados_ids as $indice => $valor) {
                $idemplCobra = uniqidReal();
                $idempleado = limpiar_cadena2($valor);
                $sql = "SELECT idempleadoscobrando FROM tbl_empleados_cobrando
                WHERE idempleado= $idempleado AND id_detalle_ruta=$id_detalle_ruta";
                $queryif = $conexion->query($sql);
                $resif = $queryif->fetch_object();
                if (!isset($resif->idempleadoscobrando)) {

                    if (in_array($idempleado, $empleadosGuardados) == false) {
                        $sql_detalle = "INSERT INTO tbl_empleados_cobrando (
                    idempleadoscobrando,
                    idempleado,
                    id_detalle_ruta,
                    str_estado
                    )
                    VALUES('$idemplCobra',$idempleado,$id_detalle_ruta,'created')";
                        $conexion->query($sql_detalle) or throw new Exception('error!');
                    }
                }
            }
        } catch (Exception $e) {

            $sw = false;
            $conexion->rollback();
        }
        $conexion->commit();
        if ($conexion != null) {
            $conexion->close();
        }
        $mensaje = $sw ? "¡Modificado Correctamente!" : "¡ERROR: Inesperado!";
        echo $mensaje;
        return $sw;
    }


    public function ListarDespachar($idglobal, $superadmin, $userEmpleadoId)
    {
        global $conexion;
        $idsucursals = array();
        $query = null;
        if (empty($superadmin)) {
            $sql = "SELECT refSucursal FROM view_auth_sucursal WHERE refEmpleado=$userEmpleadoId  AND nameAccion='despachar' AND estadoAuthSucursal='activo'";
            $query = $conexion->query($sql);
        } else {
            $sql = "SELECT idsucursal AS refSucursal FROM tbl_sucursal WHERE idglobal=$idglobal";
            $query = $conexion->query($sql);
        }
        
        while ($req = $query->fetch_object()) {
            array_push($idsucursals, $req->refSucursal);
        }
        $sql = "SELECT 
        s.idsucursal AS id,
        s.str_tipo AS tipo,
        s.str_codigo AS codigo,
        s.str_logo AS logo,
        s.str_estado AS estado,
        e.idempleado AS refEmpleado,
        (select iddetalleruta from tbl_detalle_ruta where idsucursal=s.idsucursal and str_estado <> 'saved' order by created_at desc limit 1) AS detalle_ruta
         FROM tbl_sucursal s INNER JOIN 
             tbl_empleado e ON e.idempleado=s.idempleado INNER JOIN
            tbl_persona p ON p.idpersona=e.idpersona
         where s.idsucursal IN (" . implode(",", $idsucursals) . ") AND s.str_estado<>'inactiva' and s.idglobal=$idglobal order by s.idsucursal desc";
        $query = $conexion->query($sql);
        return $query;
    }


    public function listEncargadoDespachar($refEmpleado, $userEmpleadoId)
    {
        global $conexion;

        $sql = "SELECT
             e.idempleado AS refEmpleado,
             CONCAT( p.str_nombres, ' ', p.str_apellidos ) AS empleado 
            FROM `tbl_nomina` n
            INNER JOIN `tbl_empleado` e ON e.idempleado = n.idempleado
            INNER JOIN `tbl_persona` p ON p.idpersona = e.idpersona 
            WHERE e.idempleado=$refEmpleado 
            AND n.str_estado = 'activo' or 
            e.idempleado=$userEmpleadoId 
            AND n.str_estado = 'activo'";


        $query = $conexion->query($sql);
        return $query;
    }

    public function listEmpleadosDespachar($idglobal, $id_detalle_ruta, $superadmin, $userEmpleadoId)
    {
        global $conexion;
        $sql = '';
        if (isset($superadmin)) {
            $sql = "SELECT
             e.idempleado AS refEmpleado,
             (select idempleadoscobrando from tbl_empleados_cobrando where id_detalle_ruta=$id_detalle_ruta and idempleado=e.idempleado) AS refEmpleadoCobrando,
             CONCAT( p.str_nombres, ' ', p.str_apellidos ) AS empleado 
            FROM `tbl_nomina` n
            INNER JOIN `tbl_empleado` e ON e.idempleado = n.idempleado
            INNER JOIN `tbl_persona` p ON p.idpersona = e.idpersona 
            WHERE
            n.idglobal = $idglobal
            AND n.str_estado = 'activo' ORDER BY p.str_nombres";
        } else {
            $sql = "SELECT
            e.idempleado AS refEmpleado,
            ( SELECT idempleadoscobrando FROM tbl_empleados_cobrando WHERE id_detalle_ruta = $id_detalle_ruta AND idempleado = e.idempleado ) AS refEmpleadoCobrando,
            CONCAT( p.str_nombres, ' ', p.str_apellidos ) AS empleado 
        FROM
            `tbl_nomina` n
            INNER JOIN `tbl_empleado` e ON e.idempleado = n.idempleado
            INNER JOIN `tbl_persona` p ON p.idpersona = e.idpersona
            INNER JOIN tbl_empleados_asignado ea ON ea.idempleado_asignado = e.idempleado 
        WHERE
            n.idglobal = $idglobal 
            AND n.str_estado = 'activo' 
            AND ea.idempleado = $userEmpleadoId
        ORDER BY
            p.str_nombres";
        }





        $query = $conexion->query($sql);
        return $query;
    }
    public function getEmpleadosYaDspachados($id_detalle_ruta)
    {
        global $conexion;
        $sql = "SELECT CONCAT( p.str_nombres, ' ', p.str_apellidos ) AS persona 
    FROM
        tbl_empleados_cobrando ec
        INNER JOIN tbl_empleado e ON e.idempleado = ec.idempleado
        INNER JOIN tbl_persona p ON p.idpersona = e.idpersona 
    WHERE
        id_detalle_ruta =$id_detalle_ruta";
        $query = $conexion->query($sql);
        return $query;
    }
}
