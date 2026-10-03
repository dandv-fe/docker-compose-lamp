<?php
require "Conexion.php";

class usuario
{
   public function __construct() {}
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

            $sql = "SELECT DISTINCT
                    s.idsucursal AS refSucursal,
                    s.str_tipo AS tipo,
                    s.str_codigo AS codigo,
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
                  '',
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
             FROM tbl_sucursal s LEFT JOIN tbl_auth_sucursal au
                 ON au.idsucursal=s.idsucursal AND au.idglobal=s.idglobal
                 AND au.idempleado=$idempleado AND au.str_estado<>'inactivo'
                LEFT JOIN tbl_oficina o ON o.idoficina=s.idoficina AND o.idglobal=s.idglobal
                INNER JOIN
                tbl_empleado e ON e.idempleado=s.idempleado INNER JOIN
                tbl_persona p ON p.idpersona=e.idpersona
             WHERE s.idglobal=$userIdEmpresa
                 AND (au.idauth_sucursal IS NOT NULL OR o.idempleado_administrador=$idempleado)
             ORDER BY s.idsucursal DESC";
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
               $reg->nameAuth === null ? [] : explode(",", $reg->nameAuth),
               $reg->adicional
            );
            if ($reg->nameAuth !== null) {
               array_push($au, ...explode(",", $reg->nameAuth));
            }
         }
         $infoAcceso->actividades = count(array_unique(array_column($listSucursalesPermitidas, 0)));
         if ($_SESSION['idsucursal'] > 0) {
            $idsuc = $_SESSION['idsucursal'];
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

      $sql = "SELECT date_corte, int_dias_extras FROM `tbl_descripcion_global` WHERE idglobal_accion=$idglobal AND str_estado='actual'";
      $query_ep = $conexion->query($sql);
      $estadoPago = $query_ep->fetch_object();

      return array($infoAcceso, $listSucursalesPermitidas, array_unique($au), $estadoPago);
   }

   // inicio de seccion con password
   public function SignIn($user, $pass, $idglobal)
   {
      global $conexion;
      $sql = "SELECT idglobal FROM tbl_global WHERE idglobal=$idglobal";
      $query = $conexion->query($sql);
      $res = $query->fetch_object();
      if (empty($res->idglobal)) {
         return $query;
      }
      $sql = "SELECT 
            idusuario 
            FROM tbl_usuario
            WHERE str_user_name = '$user' 
            AND str_password = '$pass' 
            AND idglobal=$idglobal ";
      $query = $conexion->query($sql);
      return $query;
   }

   public function viewUsuarioSession($idusuario)
   {
      global $conexion;
      $oficinas = array();
      // obtener datos del usuario
      $sql = "SELECT 
            *,
            (SELECT idahorro FROM tbl_ahorros WHERE idpersona=view_usuario_session.idpersona AND str_tipo='corriente' OR 
            idpersona=view_usuario_session.idpersona AND str_tipo='principal' LIMIT 1) AS idahorro,
            (SELECT idahorro FROM tbl_ahorros WHERE idpersona=view_usuario_session.idpersona AND str_tipo='corresponsal' LIMIT 1) AS idahorro_corresponsal
            FROM view_usuario_session
            WHERE idusuario=$idusuario ";
      $query = $conexion->query($sql);
      $request = $query->fetch_object();
      // obtener estado de pago se la plataforma
      $sql = "SELECT date_corte, int_dias_extras FROM `tbl_descripcion_global` WHERE idglobal_accion=$request->idglobal AND str_estado='actual'";
      $query_ep = $conexion->query($sql);
      $estadoPago = $query_ep->fetch_object();

      return array(
         "usuario" => $request,
         "estadoPago" => $estadoPago,
      );
   }
   public function oficinas($idglobal)
   {
      global $conexion;

      $sql = "SELECT 
            *,
            (SELECT COUNT( idsucursal ) FROM tbl_sucursal WHERE idoficina=tg.idoficina ) AS totalSucursales
            FROM tbl_oficina tg
            WHERE tg.idglobal=$idglobal ";
      $query = $conexion->query($sql);
      return $query;
   }
}
