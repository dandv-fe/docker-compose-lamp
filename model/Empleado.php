<?php
require "Conexion.php";

class Empleado
{


    public function __construct()
    {
    }

    public function Registrar(
        $nombres,
        $apellidos,
        $sexo,
        $fecha_nacimiento,
        $tipo_documento,
        $num_documento,
        $direccion_departamento,
        $direccion_siudad,
        $direccion_barrio,
        $direccion_calle,
        $telefono,
        $email,
        $ruta_carga,
        $ocupacion,
        $nota,
        //$estado,
        $login,
        $password,
        $fechaIngreso,
        $apodo,
        $cargo,
        $estadoEmpleado,
        $idglobal
    ) {
        global $conexion;
        $sw = true;
        $conexion->autocommit(false);
        $dt = date('Y-m-d H:i:s');
        try {
            $sql = "SELECT idpersona 
            FROM tbl_persona
             WHERE idglobal=$idglobal AND 
             str_tipo_documento='$tipo_documento' AND 
             str_num_documento='$num_documento'";
            $query = $conexion->query($sql);
            $request = $query->fetch_object();

            if (isset($request->idpersona)) {
                echo "ERROR: Documento de Persona existe";
                return;
            }

            $sql = "SELECT idpersona FROM tbl_persona WHERE idglobal=$idglobal AND str_email='$email'";
            $query = $conexion->query($sql);
            $request= $query->fetch_object();
            if (isset($request->idpersona) && $email!='') {
               echo "ERROR: Este Email ya existe";
               return;
            }

            $sql="SELECT idusuario 
            FROM tbl_usuario 
            WHERE idglobal=$idglobal AND 
            str_user_name='$login' ";
            $query = $conexion->query($sql);
            $res = $query->fetch_object();
            if (isset($res->idusuario) && $email!='') {
                echo "ERROR: Este Nombre usuario esta en uso busque otro";
                return;
            }



            $sql = "INSERT INTO `tbl_persona`(idglobal, str_nombres, str_apellidos,
                str_sexo, str_fecha_nacimiento, str_tipo_documento, str_num_documento,
                str_telefono, str_email, str_foto, str_ocupacion, str_estado,
                str_nota, str_direccion_departamento, str_direccion_ciudad, 
                str_direccion_barrio,  str_direccion_calle, str_email_verificado,
                created_at, update_at
                )
                 VALUES ($idglobal,'$nombres', '$apellidos', 
                 '$sexo', '$fecha_nacimiento', '$tipo_documento', '$num_documento', 
                 '$telefono', '$email', '$ruta_carga', '$ocupacion', 'activo', 
                 '$nota', '$direccion_departamento',  '$direccion_siudad',
                    '$direccion_barrio', '$direccion_calle', '', '$dt', '$dt'
                        )";
            $conexion->query($sql) or throw new Exception('error!');
            $idpersona = $conexion->insert_id;

            $sql = "INSERT INTO `tbl_empleado`(
                     idglobal,
                     idpersona,
                     str_apodo,
                     str_cargo,
                     str_estado,
                     str_comentarios,
                     date_fecha_inicio,
                     created_at,
                     update_at
             )
              VALUES ($idglobal, $idpersona, '$apodo', '$cargo', '$estadoEmpleado', '', '$fechaIngreso', '$dt', '$dt')";
            $conexion->query($sql) or throw new Exception('error!');

            $sql = "INSERT INTO `tbl_usuario`(
                idglobal,idpersona,str_user_name,
                str_password,str_terminos_condiciones,str_estado
          )
          VALUES ($idglobal, $idpersona, '$login', '$password', 'pendiente', 'activo')";
            $conexion->query($sql) or throw new Exception('error!');
        } catch (Exception $e) {

            $sw = false;
            $conexion->rollback();
        }
        $conexion->commit();
        if ($conexion != null) {
            $conexion->close();
        }
        $msg =$sw? 'Empleado Registrado correctamente.': 'ERROR: Empleado no ha podido ser registado.';
        echo $msg;
        return $sw;
    }

    public function Modificar(
        $idpersona,
        $nombres,
        $apellidos,
        $sexo,
        $fecha_nacimiento,
        $tipo_documento,
        $num_documento,
        $direccion_departamento,
        $direccion_siudad,
        $direccion_barrio,
        $direccion_calle,
        $telefono,
        $email,
        $ruta_carga,
        $ocupacion,
        $nota,
        //$estado,
        $idusuario,
        $login,
        $password,
        $idempleado,
        $fechaIngreso,
        $apodo,
        $cargo,
        $estadoEmpleado,
        $idglobal
    ) {
        global $conexion;
        $sw = true;
        $conexion->autocommit(false);
        $dt = date('Y-m-d H:i:s');
        try {

            $sql="SELECT idusuario 
            FROM tbl_usuario 
            WHERE idglobal=$idglobal AND 
            str_user_name='$login' AND 
            idpersona<>$idpersona ";
            $query = $conexion->query($sql);
            $res = $query->fetch_object();
            if (isset($res->idusuario)) {
                echo "ERROR: Este Nombre usuario esta en uso busque otro";
                return;
            }

            $sql = "SELECT idpersona FROM tbl_persona
				 WHERE idglobal=$idglobal 
				 AND str_email='$email' 
				 AND  idpersona<>$idpersona";
				$query = $conexion->query($sql);
				$request= $query->fetch_object();
				if (isset($request->idpersona) && $email!='') {
				   echo "ERROR: Este Email ya existe";
				   return;
				}


    
            $sql = "UPDATE `tbl_persona` SET	
                str_nombres='$nombres',
                str_apellidos='$apellidos',
                str_sexo='$sexo',
                str_fecha_nacimiento='$fecha_nacimiento',
                str_tipo_documento='$tipo_documento',
                str_num_documento='$num_documento',
                str_telefono='$telefono',
                str_email='$email',
                str_foto='$ruta_carga',
                str_ocupacion='$ocupacion',
                str_nota='$nota',
                str_direccion_departamento='$direccion_departamento',
                str_direccion_ciudad='$direccion_siudad',
                str_direccion_barrio='$direccion_barrio',
                str_direccion_calle='$direccion_calle',
                update_at='$dt'
                WHERE idpersona=$idpersona";

            $conexion->query($sql) or throw new Exception('error!');

            $sql = "SELECT idempleado FROM tbl_empleado WHERE idglobal=$idglobal AND idpersona=$idpersona";
            $query = $conexion->query($sql);
            $request = $query->fetch_object();

            if (empty($request->idempleado)) {
                $sql = "INSERT INTO `tbl_empleado`(
                    idglobal,
                    idpersona,
                    str_apodo,
                    str_cargo,
                    str_estado,
                    str_comentarios,
                    date_fecha_inicio,
                    created_at,
                    update_at
            )
             VALUES ($idglobal, $idpersona, '$apodo', '$cargo', '$estadoEmpleado', '', '$fechaIngreso', '$dt', '$dt')";
                $conexion->query($sql) or throw new Exception('error!');
            } else {
                $sql = "UPDATE `tbl_empleado` SET
                    str_apodo='$apodo',
                    str_cargo='$cargo',
                    str_estado='$estadoEmpleado',
                    str_comentarios='',
                    date_fecha_inicio='$fechaIngreso',
                    update_at='$dt'
                    WHERE idempleado=$idempleado
            ";
                $conexion->query($sql) or throw new Exception('error!');
            }

            $sql = "SELECT idusuario FROM tbl_usuario WHERE idglobal=$idglobal AND idpersona=$idpersona";
            $query = $conexion->query($sql);
            $request = $query->fetch_object();

            if (empty($request->idusuario)) {
                $sql = "INSERT INTO `tbl_usuario`(
                        idglobal,
                        idpersona,
                        str_user_name,
                        str_password,
                        str_terminos_condiciones,
                        str_estado
                  
                  )
                  VALUES ($idglobal, $idpersona, '$login', '$password', 'pendiente', 'activo')";
                $conexion->query($sql) or throw new Exception('error!');
            } else {
                $sql = "UPDATE `tbl_usuario` SET
                        str_user_name='$login',
                        str_password='$password'
                        WHERE idusuario=$idusuario
                  ";
                $conexion->query($sql) or throw new Exception('error!');
            }
        } catch (Exception $e) {

            $sw = false;
            $conexion->rollback();
        }
        $conexion->commit();
        if ($conexion != null) {

            $conexion->close();
        }
        $msg =$sw? 'Empleado Actualizado correctamente.': 'ERROR: Empleado no ha podido ser Actualizado.';
        echo $msg;
        return $sw;
    }
    /*
     */
    public function RegistrarSueldo($idempleado, $idglobal, $modoSueldo, $valorSueldo)
    {
        global $conexion;
        $sw = true;
        $conexion->autocommit(false);
        $dt = date('Y-m-d H:i:s');
        try {
            $sql = "SELECT idnomina FROM `tbl_nomina` WHERE idempleado= $idempleado AND str_estado='activo'";
            $querry = $conexion->query($sql);
            $res = $querry->fetch_object();
            if (isset($res->idnomina)) {
                $aql="UPDATE tbl_nomina SET str_estado='anterior' WHERE idnomina= $res->idnomina";
                $conexion->query($aql) or throw new Exception('error!');
            }

            $sql = "INSERT INTO `tbl_nomina`(
                idglobal, idempleado, str_modo_sueldo, dec_sueldo,
                str_estado, created_at, updated_at
          )
          VALUES ($idglobal, $idempleado, '$modoSueldo', $valorSueldo, 
          'activo', '$dt', '$dt')";
            $conexion->query($sql) or throw new Exception('error!');
        } catch (Exception $e) {
            print_r($e);
            $sw = false;
            $conexion->rollback();
        }

        $conexion->commit();
        if ($conexion != null) {
            $conexion->close();
        }
        $msg = $sw ? "Se a Registrado un dato" : "ERROR: ¡No se guardo!";
        echo $msg;
        return;
    }

    public function ModificarSueldo($idnomina, $idempleado, $idglobal, $modoSueldo, $valorSueldo)
    {
    }



    public function Listar($idglobal)
    {
        global $conexion;
        $sql = "SELECT 
        e.idempleado AS refEmpleado,
            e.str_cargo AS cargo,
            e.date_fecha_inicio AS fecha_init,
            p.idpersona AS refPersona,
            CONCAT(p.str_nombres,' ',p.str_apellidos) AS empleado,
            p.str_foto AS foto,
            p.str_tipo_documento AS tDocumento,
            p.str_num_documento AS nDocumento,
            p.str_telefono AS tel,
            e.str_estado as estado

         FROM tbl_empleado e INNER JOIN
            tbl_persona p ON p.idpersona=e.idpersona
         WHERE e.idglobal=$idglobal ORDER BY e.idempleado DESC";
        $query = $conexion->query($sql);
        return $query;
    }

    public function cboListEmpleado($idglobal)
    {
        global $conexion;
        $sql = "SELECT 
            e.idempleado AS ref,
            CONCAT(p.str_nombres,' ',p.str_apellidos) AS empleado
            

         FROM tbl_empleado e INNER JOIN
            tbl_persona p ON p.idpersona=e.idpersona
         WHERE e.idglobal=$idglobal AND e.str_estado<>'inactivo' ORDER BY e.idempleado DESC";
        $query = $conexion->query($sql);
        return $query;
    }




    public function AddAuthSucursalEmpleado($idsucursal, $idglobal)
    {
        global $conexion;
        $sw = true;
        $conexion->autocommit(false);
        try {
            $sql = "INSERT INTO authsucursal(idsucursal,idauthotizacion)
						VALUES($idsucursal,$idglobal)";
            $conexion->query($sql) or $sw = false;

            $sw ? $conexion->commit() : $conexion->rollback();
            if ($conexion != null) {
                $conexion->close();
            }
        } catch (Exception $e) {
            $conexion->rollback();
        }
        $message = $sw ? "Permiso de cartera agregado correctamente" : "ERROR: Permiso no agregado";
        echo $message;
        return $sw;
    }


    public function buscarEmpleado($idpersona)
    {
        global $conexion;
        $sql = "SELECT 
            e.idempleado AS refEmpleado,
            e.str_apodo AS apodo,
            e.str_cargo AS cargo,
            e.str_estado AS estadoEmpleado,
            e.str_comentarios AS comentarios,
            e.date_fecha_inicio AS fecha_inicio,
            e.created_at AS fecha_at,
            u.idusuario AS refUsuario,
            u.str_user_name AS username,
            u.str_password AS id,
            u.str_terminos_condiciones AS t_condiciones
         FROM tbl_empleado e INNER JOIN 
         tbl_usuario u ON u.idpersona=e.idpersona WHERE e.idpersona=$idpersona";
        $query = $conexion->query($sql);
        return $query;
    }
    public function buscarPersona($idglobal, $tipo_documento, $num_documento)
    {
        global $conexion;

        $sql = "SELECT 
            idpersona AS refPersona,
            idglobal AS refGlobal,
            str_nombres AS nombres,
            str_apellidos AS apellidos,
            str_sexo AS sexo,
            str_fecha_nacimiento AS f_nacimiento,
            str_tipo_documento AS t_documento,
            str_num_documento AS n_documento,
            str_telefono AS telefono,
            str_email AS email,
            str_foto AS foto,
            str_ocupacion AS ocupacion,
            str_estado AS estado,
            str_nota AS nota,
            str_email_verificado AS e_verificado,
            str_direccion_departamento AS departamento,
            str_direccion_ciudad AS ciudad,
            str_direccion_barrio AS barrio,
            str_direccion_calle AS calle,
            created_at AS fecha_at

         FROM tbl_persona WHERE idglobal=$idglobal AND str_tipo_documento='$tipo_documento' AND str_num_documento='$num_documento'";
        $query = $conexion->query($sql);


        return $query;
    }

    public function listNomna($idempleado)
    {
        global $conexion;
        $sql = "SELECT
        refNomina,
        m_sueldo,
        sueldo,
        estado,
        fecha_at
        FROM view_nomina WHERE refEmpleado=$idempleado";
        $query = $conexion->query($sql);
        return $query;
    }
    public function listNomnaDetalle($idempleado, $desde, $hasta)
    {
        global $conexion;
        $fechaHasta=date('Y-m-d', strtotime($hasta . ' +1 day'));
        $sql = "SELECT *
        FROM view_detalle_nomina WHERE refEmpleado=$idempleado AND fecha_at>='$desde' AND fecha_at<='$fechaHasta'";
        $query = $conexion->query($sql);
        return $query;
    }
    public function listAuths($idempleado, $idglobal)
    {
        global $conexion;
        $sql = "SELECT *
        FROM view_auth_sucursal WHERE refEmpleado=$idempleado AND estadoAuthSucursal='activo'";
        $query = $conexion->query($sql);

        $sql = "SELECT 
        idauth AS refAuth,
        str_categoria AS categoria,
        str_nombre AS nameAccion,
        str_descripcion AS descripcion,
        dec_item AS item
         FROM tbl_auth WHERE dec_item>0 ORDER BY dec_item";
        $queryAuth = $conexion->query($sql);

       

        return array($query, $queryAuth);
    }
    public function inicializarPermisos($idglobal, $idempleado, $idsucursal, $tipoUser, $ope)
    {
        global $conexion;
        $conexion->autocommit(false);
        $sw = true;
        $dt = date('Y-m-d H:i:s');

        $sql = "SELECT *
        FROM tbl_auth_sucursal WHERE idsucursal=$idsucursal AND idempleado=$idempleado";
        $query = $conexion->query($sql);
        $res = $query->fetch_object();
        if (isset($res->idauth_sucursal)) {
            $estado = $ope == 'true' ? 'activo' : 'inactivo';
            $sql = "UPDATE tbl_auth_sucursal SET str_estado='$estado', tipo_usuario='$tipoUser'
             WHERE idauth_sucursal= $res->idauth_sucursal ";
            $conexion->query($sql) or throw new Exception('error!');
        } else {
            try {
                $sql = "INSERT INTO tbl_auth_sucursal(
                    idglobal,idsucursal, idempleado, tipo_usuario,
                    created_at, updated_at, str_estado
                )
                VALUES($idglobal, $idsucursal, $idempleado, '$tipoUser',
                    '$dt','$dt','activo'
                )";
                $conexion->query($sql) or throw new Exception('error!');
            } catch (Exception $e) {
                print_r($e);
                $sw = false;
                $conexion->rollback();
            }
        }
        $conexion->commit();
        if ($conexion != null) {
            $conexion->close();
        }

        $message = $sw ? "Permisos inicializado Correctamente" : "ERROR: Permisos Quitados";
        echo $message;
        return true;
    }

    public function quitarPermisos($idglobal, $idempleado, $idsucursal)
    {
        global $conexion;
        $conexion->autocommit(false);
        $sw = true;
        $dt = date('Y-m-d H:i:s');
        try {
            $sql = "UPDATE tbl_auth_sucursal SET str_estado='inactivo' WHERE idsucursal= $idsucursal AND idempleado=$idempleado AND idglobal=$idglobal";
            $conexion->query($sql) or throw new Exception('error!');
        } catch (Exception $e) {
            print_r($e);
            $sw = false;
            $conexion->rollback();
        }
        
        $conexion->commit();
        if ($conexion != null) {
            $conexion->close();
        }

        $message = $sw ? "Permisos Qutados Correctamente" : "ERROR: intente mas tarde";
        echo $message;
        return true;
    }


    public function manejarAuths($idauth, $idauthsucursal)
    {
        global $conexion;
        $conexion->autocommit(false);
        $sw = true;
        $sql = "SELECT *
        FROM tbl_auths WHERE idauth=$idauth AND idauth_sucursal=$idauthsucursal";
        $query = $conexion->query($sql);
        $res = $query->fetch_object();

        if (isset($res->id)) {
            $sql = "DELETE FROM tbl_auths WHERE  idauth=$idauth AND idauth_sucursal = $idauthsucursal ";
            $conexion->query($sql) or throw new Exception('error!');
        } else {
            try {
                $sql = "INSERT INTO tbl_auths(idauth,idauth_sucursal)
                            VALUES($idauth,$idauthsucursal)";
                $conexion->query($sql) or throw new Exception('error!');
            } catch (Exception $e) {
                $sw = false;
                $conexion->rollback();
            }
        }
        $conexion->commit();
        if ($conexion != null) {
            $conexion->close();
        }

        $message = $sw ? "Permiso Cambiado Correctamente" : "ERROR: Permiso No Cambiado";
        echo $message;
        return true;
    }
    public function editUserSuperAdmin($idglobal,$idpersona, $user, $pass)
    {
        global $conexion;
        $conexion->autocommit(false);
        $sw = true;
        try {
            $sql="SELECT idusuario 
            FROM tbl_usuario 
            WHERE idglobal=$idglobal AND 
            str_user_name='$user' AND 
            idpersona<>$idpersona ";
            $query = $conexion->query($sql);
            $res = $query->fetch_object();
            if (isset($res->idusuario)) {
                echo "ERROR: Este Nombre usuario esta en uso busque otro";
                return;
            }

           $sql="UPDATE tbl_usuario SET str_user_name='$user', str_password='$pass' WHERE idpersona=$idpersona";
           $conexion->query($sql) or throw new Exception('error!');
        } catch (Exception $e) {
            $sw = false;
            $conexion->rollback();
        }
        $conexion->commit();
        if ($conexion != null) {
            $conexion->close();
        }

        $message = $sw ? "Usuario Cambiado Correctamente" : "ERROR: Usuario No Cambiado";
        echo $message;
        return true;
    }

    public function listEmpleadosAsignadoEmpleado($superadmin,$idglobal, $refEmpleado)
    {
        global $conexion;
        $sql='';
        if (isset($superadmin)) {
            $sql = "SELECT
            e.idempleado AS refEmpleado,
            (select idempleado from tbl_empleados_asignado where idempleado=$refEmpleado AND idempleado_asignado=e.idempleado) AS refEmpleadoAsignado,
            CONCAT( p.str_nombres, ' ', p.str_apellidos ) AS empleado 
            FROM  `tbl_empleado` e 
            INNER JOIN `tbl_persona` p ON p.idpersona = e.idpersona 
            WHERE
            e.idglobal = $idglobal
            AND e.str_estado <> 'inactivo'  ORDER BY p.str_nombres";

        } else {
            # code...
        }
        
        $query = $conexion->query($sql);
        return $query;
    }

   public function registrarEmpleadosAsignado($idempleado, $empleados_ids)
    {
        global $conexion;
        $conexion->autocommit(false);
        $sw = true;
        try {


           
            $empleadosGuardados = array();
            $sql = "SELECT id, idempleado_asignado FROM tbl_empleados_asignado WHERE idempleado=$idempleado";
            $query = $conexion->query($sql);
           
            while ($res = $query->fetch_object()) {
                array_push($empleadosGuardados, $res->idempleado_asignado);
                if (in_array($res->idempleado_asignado, $empleados_ids) == false) {
                    $sql = "DELETE FROM tbl_empleados_asignado WHERE id=$res->id";
                    $conexion->query($sql) or throw new Exception('error!');
                }
            }
            
                foreach ($empleados_ids as $indice => $valor) {
                    $idempleadoAsignado = limpiar_cadena2($valor);
                    if (in_array($idempleadoAsignado, $empleadosGuardados) == false && $idempleadoAsignado!=$idempleado) {
                        $sql_detalle = "INSERT INTO tbl_empleados_asignado (
                        idempleado,
                        idempleado_asignado
                        
                        )
                        VALUES($idempleado,$idempleadoAsignado)";
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

  
}
