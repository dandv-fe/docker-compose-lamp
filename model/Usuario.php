<?php
require "Conexion.php";

class usuario
{
    public function __construct()
    {
    }
    public function getAccederInformacion($userIdEmpresa, $idempleado, $idglobal)
    {
        global $conexion;
        $au = array();
        $infoAcceso = null;
        $listSucursalesPermitidas = array();

        // datos del vendedor de servicios
        if (isset($userIdEmpresa)) {
            if ($_SESSION['typeEmpresa'] === 'servicio') {
               
                $sql = "SELECT
                str_cargo AS cargo,
               ( SELECT COUNT( idglobal ) FROM tbl_global WHERE idglobal <> $userIdEmpresa AND empresaid = $userIdEmpresa ) AS empresas,
               ( SELECT COUNT(s.idsucursal) FROM `tbl_global` g INNER JOIN
                        tbl_sucursal s ON s.idglobal=g.idglobal
                    WHERE g.empresaid=$userIdEmpresa AND 
                g.idglobal<>$userIdEmpresa ) AS actividades,
               ( SELECT COUNT(e.idempleado)
                            FROM `tbl_global` g INNER JOIN
                        tbl_empleado e ON e.idglobal=g.idglobal
                    WHERE g.empresaid=$userIdEmpresa AND 
                g.idglobal<>$userIdEmpresa) AS empleados,
               ( SELECT COUNT(e.idcliente)
                            FROM `tbl_global` g INNER JOIN
                        tbl_clientes e ON e.idglobal=g.idglobal
                    WHERE g.empresaid=$userIdEmpresa AND 
                g.idglobal<>$userIdEmpresa) AS clientes
              
               FROM tbl_empleado WHERE  idempleado = $idempleado AND str_estado<>'inactivo' ";
                $query = $conexion->query($sql);
                
                $infoAcceso = $query->fetch_object();

                $sql = "SELECT refGlobal,
                razonSocial,
                estadoEmpresa,
                logo,
                superadmin,
                foto,
                telefono
                 FROM `view_empresas_publica` 
                WHERE refEmpresa=$userIdEmpresa ORDER BY fecha_atEmpresa DESC";
                $query = $conexion->query($sql);
                while ($reg = $query->fetch_object()) {
                    $listSucursalesPermitidas[] = array(
                        $reg->refGlobal,
                        $reg->razonSocial,
                        $reg->logo,
                        $reg->estadoEmpresa,
                        $reg->superadmin,

                        $reg->telefono,
                        $reg->foto,
                        'namesAuth' => null
                    );
                }
                //$infoAcceso->actividades= count($listSucursalesPermitidas);


            } else {
                 // datos del dueño empresa
                $sql = "SELECT
                str_cargo AS cargo,
               ( SELECT COUNT( idglobal ) FROM tbl_sucursal WHERE idglobal = $userIdEmpresa ) AS actividades,
               ( SELECT COUNT( idglobal ) FROM tbl_empleado WHERE idempleado <> $idempleado AND idglobal = $userIdEmpresa ) AS empleados,
               ( SELECT COUNT( idglobal ) FROM tbl_clientes WHERE idglobal = $userIdEmpresa ) AS clientes
               FROM tbl_empleado WHERE  idempleado = $idempleado";
                $query = $conexion->query($sql);
                $infoAcceso = $query->fetch_object();

                $sql = "SELECT 
                    s.idsucursal AS refSucursal,
                    s.str_tipo AS tipo,
                    s.str_codigo AS codigo,
                    s.str_logo AS logo,
                    s.str_cobro_adicional as adicional,
                    s.str_estado AS estado,
                    CONCAT(p.str_nombres,' ',p.str_apellidos) AS empleado,
                    p.str_tipo_documento AS t_documento,
                    p.str_num_documento AS n_documento,
                    p.str_telefono AS tel,
                    p.str_foto AS foto,
                    '' AS nameAuth
                FROM tbl_sucursal s INNER JOIN 
                    tbl_empleado e ON e.idempleado=s.idempleado INNER JOIN
                    tbl_persona p ON p.idpersona=e.idpersona
                where s.str_estado<>'inactiva' and s.idglobal=$userIdEmpresa order by s.idsucursal desc";
                $query = $conexion->query($sql);
                while ($reg = $query->fetch_object()) {
                    $listSucursalesPermitidas[] = array(
                        $reg->refSucursal,
                        $reg->tipo,
                        $reg->codigo,
                        $reg->logo,
                        $reg->estado,
                        $reg->empleado,
                        $reg->t_documento,
                        $reg->n_documento,
                        $reg->tel,
                        $reg->foto,
                        explode(",", $reg->nameAuth),
                        $reg->adicional
                    );
                }

            }
        } else {
             // datos del empleados
            $_SESSION['AUTHS'] = array();
            $au = array();
            $sql = "SELECT
            str_cargo AS cargo,
            (SELECT COUNT( idsucursal ) FROM `tbl_auth_sucursal` 
            WHERE idempleado=$idempleado) AS actividades
            FROM tbl_empleado WHERE  idempleado = $idempleado";
            $query = $conexion->query($sql);
            $infoAcceso = $query->fetch_object();

            $sql = "SELECT
                s.idsucursal AS refSucursal,
                s.str_tipo AS tipo,
                s.str_codigo AS codigo,
                s.str_logo AS logo,
                 s.str_cobro_adicional as adicional,
                s.str_estado AS estado,
                CONCAT(p.str_nombres,' ',p.str_apellidos) AS empleado,
                p.str_tipo_documento AS t_documento,
                p.str_num_documento AS n_documento,
                p.str_telefono AS tel,
                p.str_foto AS foto,
                (SELECT 
                    GROUP_CONCAT(a.str_nombre SEPARATOR ',') 
                    FROM tbl_auths b INNER JOIN tbl_auth a ON a.idauth=b.idauth
                        WHERE b.idauth_sucursal=au.idauth_sucursal
                                ) AS  nameAuth
             FROM  `tbl_auth_sucursal` au INNER JOIN 
                tbl_sucursal s ON s.idsucursal=au.idsucursal INNER JOIN 
                tbl_empleado e ON e.idempleado=s.idempleado INNER JOIN
                tbl_persona p ON p.idpersona=e.idpersona
             where au.str_estado<>'inactivo' AND au.idempleado=$idempleado order by au.idsucursal desc";
            $query = $conexion->query($sql);

            while ($reg = $query->fetch_object()) {
                $listSucursalesPermitidas[] = array(
                    $reg->refSucursal,
                    $reg->tipo,
                    $reg->codigo,
                    $reg->logo,
                    $reg->estado,
                    $reg->empleado,
                    $reg->t_documento,
                    $reg->n_documento,
                    $reg->tel,
                    $reg->foto,
                    explode(",", $reg->nameAuth),
                    $reg->adicional
                );
                array_push($au, ...explode(",", $reg->nameAuth));
            }
            if ($_SESSION['MYSESSION_idsucursal'] > 0) {
                $idsuc = $_SESSION['MYSESSION_idsucursal'];
                $sql = "SELECT
                        a.str_categoria AS categoria,
                        a.str_nombre AS nombre
                    FROM
                        tbl_auths auths
                        INNER JOIN tbl_auth a ON a.idauth = auths.idauth
                        INNER JOIN tbl_auth_sucursal aus ON aus.idauth_sucursal = auths.idauth_sucursal 
                    WHERE
                        aus.idsucursal = $idsuc
                        AND aus.idempleado = $idempleado";
                $query3 = $conexion->query($sql);
                
                while ($reg = $query3->fetch_object()) {
                    $_SESSION['AUTHS'][] = ["caregoria" => $reg->categoria, "nombre" => $reg->nombre];
                }
            }

        }

        $sql="SELECT date_corte, int_dias_extras FROM `tbl_descripcion_global` WHERE idglobal_accion=$idglobal AND str_estado='actual'";
        $query_ep = $conexion->query($sql);
        $estadoPago = $query_ep->fetch_object();

        return array($infoAcceso, $listSucursalesPermitidas, array_unique($au), $estadoPago);
    }

    // inicio de seccion con password
    public function Auth($user, $pass, $empresa)
    {
        global $conexion;
        $idglobal = intval($empresa);
        $sql = "SELECT idglobal FROM tbl_global WHERE idglobal=$idglobal";
        $query = $conexion->query($sql);
        $res = $query->fetch_object();
        if (empty($res->idglobal)) {
            return $query;
        }
        $idglobal = $res->idglobal;
        $sql = "SELECT 
                    (select idempleado from tbl_empleado where idpersona=p.idpersona) As userEmpleado,
                    (select idcliente from tbl_clientes where idpersona=p.idpersona) AS userCliente,
                    (select idnatillera from tbl_natillera where idpersona=p.idpersona) AS userNatillera,
                   
                    u.idusuario as numeroUsuario,
                    u.idglobal as numeroGlobal,
                    u.idpersona as numeroPersona,
                    u.str_user_name as usuario,
                    u.str_terminos_condiciones as terminosCondiciones,
                    u.str_estado as userEstado,
                    CONCAT(p.str_nombres,' ',p.str_apellidos) AS nombre,
                    p.str_foto as foto,
                    p.str_tipo_documento as typeDocument,
                    p.str_num_documento as document,
                    p.str_sexo as sexo,
                    p.str_telefono as phone,
                    p.str_email as email,
                    p.str_email_verificado as emailVerificado,
                    g.str_razon_social as empresa,
                    g.str_tipo as typeEmpresa,
                    g.superadmin_personaid as userEmpresa,
                    g.str_logo AS logo
                    FROM tbl_usuario u INNER JOIN
                        tbl_persona p ON u.idpersona=p.idpersona INNER JOIN
                        tbl_global g ON g.idglobal=u.idglobal
                    WHERE u.str_user_name = '$user' AND u.str_password = '$pass' AND u.str_estado <> 'inactivo' AND u.idglobal=$idglobal ";
        $query = $conexion->query($sql);
        return $query;
    }
}
