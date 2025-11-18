<?php
require "Conexion.php";

class Empleado
{


   public function __construct() {}

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
             str_num_documento='$num_documento'
             ";
         $query = $conexion->query($sql);
         $request = $query->fetch_object();

         if (isset($request->idpersona)) {
            echo "ERROR: Documento de Persona existe";
            return;
         }

         $sql = "SELECT idpersona FROM tbl_persona WHERE idglobal=$idglobal AND str_email='$email'";
         $query = $conexion->query($sql);
         $request = $query->fetch_object();
         if (isset($request->idpersona) && $email != '') {
            echo "ERROR: Este Email ya existe";
            return;
         }

         $sql = "SELECT idusuario 
            FROM tbl_usuario 
            WHERE idglobal=$idglobal AND 
            str_user_name='$login' ";
         $query = $conexion->query($sql);
         $res = $query->fetch_object();
         if (isset($res->idusuario) && $email != '') {
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
              VALUES ($idglobal, $idpersona, '$apodo', '$cargo', 'activo', '', '$fechaIngreso', '$dt', '$dt')";
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
      $msg = $sw ? 'Empleado Registrado correctamente.' : 'ERROR: Empleado no ha podido ser registado.';
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
      $idglobal
   ) {
      global $conexion;
      $sw = true;
      $conexion->autocommit(false);
      $dt = date('Y-m-d H:i:s');
      try {

         $sql = "SELECT idusuario 
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
         $request = $query->fetch_object();
         if (isset($request->idpersona) && $email != '') {
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
             VALUES ($idglobal, $idpersona, '$apodo', '$cargo', 'activo', '', '$fechaIngreso', '$dt', '$dt')";
            $conexion->query($sql) or throw new Exception('error!');
         } else {
            $sql = "UPDATE `tbl_empleado` SET
                    str_apodo='$apodo',
                    str_cargo='$cargo',
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
      $msg = $sw ? 'Empleado Actualizado correctamente.' : 'ERROR: Empleado no ha podido ser Actualizado.';
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
            $aql = "UPDATE tbl_nomina SET str_estado='anterior' WHERE idnomina= $res->idnomina";
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

   public function ModificarSueldo($idnomina, $idempleado, $idglobal, $modoSueldo, $valorSueldo) {}



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
         WHERE e.idglobal=$idglobal AND e.str_estado<>'inactivo' ORDER BY e.idempleado DESC";
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
      $fechaHasta = date('Y-m-d', strtotime($hasta . ' +1 day'));
      $sql = "SELECT * FROM view_detalle_nomina 
                    WHERE refEmpleado=$idempleado AND fecha_at>='$desde' AND fecha_at<='$fechaHasta'";
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

      $sql = "SELECT idsucursal AS refSucursal, str_codigo AS codigo, str_tipo AS tipo FROM tbl_sucursal WHERE idglobal=$idglobal";
      $querySucursal = $conexion->query($sql);

      return array($query, $queryAuth, $querySucursal);
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
         $sql = "UPDATE tbl_auth_sucursal SET str_estado='inactivo' WHERE idsucursal= $idsucursal AND idempleado=$idempleado";
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
   public function editUserSuperAdmin($idglobal, $idpersona, $user, $pass)
   {
      global $conexion;
      $conexion->autocommit(false);
      $sw = true;
      try {
         $sql = "SELECT idusuario 
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

         $sql = "UPDATE tbl_usuario SET str_user_name='$user', str_password='$pass' WHERE idpersona=$idpersona";
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

   public function listEmpleadosAsignadoEmpleado($superadmin, $idglobal, $refEmpleado)
   {
      global $conexion;
      $sql = '';
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
            if (in_array($idempleadoAsignado, $empleadosGuardados) == false && $idempleadoAsignado != $idempleado) {
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

   /**
    * Registra el despido de un empleado
    * Utiliza el stored procedure sp_registrar_despido_empleado
    */
   public function registrarDespido(
      $idglobal,
      $idempleado,
      $fecha_despido,
      $tipo_despido,
      $motivo_despido,
      $autorizado_por,
      $cargo_autoriza,
      $observaciones,
      $fecha_ultimo_trabajo,
      $monto_fraude,
      $monto_fraude_pendiente,
      $entrega_documentos,
      $documentos_entregados,
      $acta_firmada,
      $derecho_recontratacion,
      $created_empleado_id
   ) {
      global $conexion;
      $sw = true;
      $conexion->autocommit(false);
      $dt = date('Y-m-d H:i:s');

      try {
         // Verificar que el empleado existe y está activo
         $sql = "SELECT idempleado, str_estado FROM tbl_empleado 
                    WHERE idempleado = $idempleado AND idglobal = $idglobal";
         $query = $conexion->query($sql);
         $empleado = $query->fetch_object();

         if (!isset($empleado->idempleado)) {
            return [
               'status' => 'error',
               'mensaje' => 'El empleado no existe en la empresa especificada'
            ];
         }

         if ($empleado->str_estado === 'inactivo') {
            return [
               'status' => 'error',
               'mensaje' => 'El empleado ya se encuentra inactivo'
            ];
         }

         // Verificar que no tenga un despido previo activo
         $sql = "SELECT idempleado_despido FROM tbl_empleado_despido 
                    WHERE idempleado = $idempleado AND str_estado = 'activo'";
         $query = $conexion->query($sql);
         $despidoExistente = $query->fetch_object();

         if (isset($despidoExistente->idempleado_despido)) {
            return [
               'status' => 'error',
               'mensaje' => 'El empleado ya tiene un registro de despido activo'
            ];
         }

         // Preparar valores para SQL
         $autorizado_por = !empty($autorizado_por) ? "'$autorizado_por'" : "NULL";
         $cargo_autoriza = !empty($cargo_autoriza) ? "'$cargo_autoriza'" : "NULL";
         $observaciones = !empty($observaciones) ? "'$observaciones'" : "NULL";
         $fecha_ultimo_trabajo = !empty($fecha_ultimo_trabajo) ? "'$fecha_ultimo_trabajo'" : "NULL";
         $monto_fraude_pendiente = !empty($monto_fraude_pendiente) ? $monto_fraude_pendiente : "NULL";
         $documentos_entregados = !empty($documentos_entregados) ? "'$documentos_entregados'" : "NULL";

         // Insertar registro de despido
         $sql = "INSERT INTO tbl_empleado_despido (
                idglobal,
                idempleado,
                fecha_despido,
                tipo_despido,
                motivo_despido,
                autorizado_por,
                cargo_autoriza,
                observaciones,
                fecha_ultimo_trabajo,
                monto_fraude,
                monto_fraude_pendiente,
                entrega_documentos,
                documentos_entregados,
                acta_firmada,
                derecho_recontratacion,
                created_empleado_id,
                created_at,
                updated_at
            ) VALUES (
                $idglobal,
                $idempleado,
                '$fecha_despido',
                '$tipo_despido',
                '$motivo_despido',
                $autorizado_por,
                $cargo_autoriza,
                $observaciones,
                $fecha_ultimo_trabajo,
                '$monto_fraude',
                $monto_fraude_pendiente,
                '$entrega_documentos',
                $documentos_entregados,
                '$acta_firmada',
                '$derecho_recontratacion',
                $created_empleado_id,
                '$dt',
                '$dt'
            )";

         $conexion->query($sql) or throw new Exception('Error al registrar el despido');

         // Actualizar estado del empleado a inactivo
         $sql = "UPDATE tbl_empleado 
                    SET str_estado = 'inactivo',
                        str_comentarios = CONCAT(IFNULL(str_comentarios, ''), '\n[DESPIDO $fecha_despido] $motivo_despido'),
                        update_at = '$dt'
                    WHERE idempleado = $idempleado";

         $conexion->query($sql) or throw new Exception('Error al actualizar estado del empleado');

         // eliminar todos los permisos de sucursal del empleado
         $sql = "DELETE FROM tbl_auth_sucursal WHERE idempleado = $idempleado";
         $conexion->query($sql) or throw new Exception('Error al eliminar permisos de sucursal del empleado');

         $conexion->commit();

         return [
            'status' => 'success',
            'mensaje' => 'Despido registrado correctamente. El empleado ha sido marcado como inactivo.'
         ];
      } catch (Exception $e) {
         $sw = false;
         $conexion->rollback();

         return [
            'status' => 'error',
            'mensaje' => 'Error al registrar el despido: ' . $e->getMessage()
         ];
      } finally {
         if ($conexion != null) {
            $conexion->close();
         }
      }
   }

   /**
    * Listar empleados despedidos con filtros
    */
   public function listarDespedidos($idglobal, $tipo_despido = '', $liquidacion = '', $fecha_desde = '', $fecha_hasta = '')
   {
      global $conexion;

      $sql = "SELECT 
            ed.idempleado_despido AS id,
            ed.idempleado AS idEmpleado,
            CONCAT(p.str_nombres, ' ', p.str_apellidos) AS empleado,
            CONCAT(p.str_tipo_documento, ' ', p.str_num_documento) AS documento,
            e.str_cargo AS cargo,
            DATE_FORMAT(ed.fecha_despido, '%d/%m/%Y') AS fechaDespido,
            ed.tipo_despido AS tipoDespido,
            ed.monto_fraude_pendiente AS liquidacion,
            ed.entrega_documentos AS estadoDocs,
            ed.derecho_recontratacion AS recontratacion,
            e.idempleado AS refEmpleado
        FROM tbl_empleado_despido ed
        INNER JOIN tbl_empleado e ON e.idempleado = ed.idempleado
        INNER JOIN tbl_persona p ON p.idpersona = e.idpersona
        WHERE ed.idglobal = $idglobal AND ed.str_estado = 'activo'";

      // Aplicar filtros
      if (!empty($tipo_despido)) {
         $sql .= " AND ed.tipo_despido = '$tipo_despido'";
      }

      if (!empty($liquidacion)) {
         $sql .= " AND ed.monto_fraude = '$liquidacion'";
      }

      if (!empty($fecha_desde)) {
         $sql .= " AND ed.fecha_despido >= '$fecha_desde'";
      }

      if (!empty($fecha_hasta)) {
         $sql .= " AND ed.fecha_despido <= '$fecha_hasta'";
      }

      $sql .= " ORDER BY ed.fecha_despido DESC";

      $query = $conexion->query($sql);
      return $query;
   }

   /**
    * Obtener detalle completo de un despido
    */
   public function obtenerDetalleDespido($id)
   {
      global $conexion;

      $sql = "SELECT 
            ed.idempleado_despido AS id,
            CONCAT(p.str_nombres, ' ', p.str_apellidos) AS empleado,
            CONCAT(p.str_tipo_documento, ' ', p.str_num_documento) AS documento,
            e.str_cargo AS cargo,
            p.str_telefono AS telefono,
            p.str_foto AS foto,
            DATE_FORMAT(e.date_fecha_inicio, '%d/%m/%Y') AS fechaIngreso,
            DATE_FORMAT(ed.fecha_despido, '%d/%m/%Y') AS fechaDespido,
            DATE_FORMAT(ed.fecha_ultimo_trabajo, '%d/%m/%Y') AS fechaUltimoTrabajo,
            DATEDIFF(ed.fecha_despido, e.date_fecha_inicio) AS diasTrabajados,
            ed.tipo_despido AS tipoDespido,
            ed.motivo_despido AS motivo,
            ed.autorizado_por AS autorizadoPor,
            ed.cargo_autoriza AS cargoAutoriza,
            ed.observaciones AS observaciones,
            ed.monto_fraude AS liquidacion,
            ed.monto_fraude_pendiente AS montoLiquidacion,
            ed.entrega_documentos AS entregaDocumentos,
            ed.documentos_entregados AS documentosEntregados,
            ed.acta_firmada AS actaFirmada,
            ed.derecho_recontratacion AS recontratacion
        FROM tbl_empleado_despido ed
        INNER JOIN tbl_empleado e ON e.idempleado = ed.idempleado
        INNER JOIN tbl_persona p ON p.idpersona = e.idpersona
        WHERE ed.idempleado_despido = $id";

      $query = $conexion->query($sql);
      return $query;
   }

   /**
    * Obtener estadísticas de despidos
    */
   public function obtenerEstadisticasDespedidos($idglobal)
   {
      global $conexion;

      $sql = "SELECT 
            COUNT(*) AS total,
            SUM(CASE WHEN MONTH(fecha_despido) = MONTH(CURDATE()) 
                     AND YEAR(fecha_despido) = YEAR(CURDATE()) THEN 1 ELSE 0 END) AS meActual,
            IFNULL(SUM(monto_fraude_pendiente),0) AS liquidacionesPendientes,
            SUM(CASE WHEN entrega_documentos = 'completa' THEN 1 ELSE 0 END) AS documentosCompletos
        FROM tbl_empleado_despido
        WHERE idglobal = $idglobal AND str_estado = 'activo'";

      $query = $conexion->query($sql);
      return $query;
   }

   /**
    * Actualizar estado de un despido (versión mejorada)
    */
   public function actualizarEstadoDespido($id, $montoPendiente, $documentos, $actaFirmada = null, $documentosEntregados = null, $observaciones = null)
   {
      global $conexion;
      $sw = true;
      $conexion->autocommit(false);
      $dt = date('Y-m-d H:i:s');

      try {
         // Validar y limpiar datos
         $montoPendiente = !empty($montoPendiente) ? floatval($montoPendiente) : 0;

         // Obtener observaciones anteriores si existen
         $observacionesFinal = $observaciones;
         if (!empty($observaciones)) {
            $sqlObs = "SELECT observaciones FROM tbl_empleado_despido WHERE idempleado_despido = $id";
            $resultObs = $conexion->query($sqlObs);
            if ($rowObs = $resultObs->fetch_object()) {
               $obsAnteriores = !empty($rowObs->observaciones) ? $rowObs->observaciones . "\n\n" : '';
               $timestamp = date('Y-m-d H:i:s');
               $observacionesFinal = $obsAnteriores . "[$timestamp] " . $observaciones;
            }
         }

         // Construir SQL dinámicamente
         $campos = [];
         $campos[] = "monto_fraude_pendiente = $montoPendiente";
         $campos[] = "entrega_documentos = '$documentos'";
         $campos[] = "updated_at = '$dt'";

         if (!is_null($actaFirmada)) {
            $campos[] = "acta_firmada = '$actaFirmada'";
         }

         if (!is_null($documentosEntregados)) {
            $documentosEntregados = $conexion->real_escape_string($documentosEntregados);
            $campos[] = "documentos_entregados = '$documentosEntregados'";
         }

         if (!empty($observacionesFinal)) {
            $observacionesFinal = $conexion->real_escape_string($observacionesFinal);
            $campos[] = "observaciones = '$observacionesFinal'";
         }

         $sql = "UPDATE tbl_empleado_despido 
                    SET " . implode(", ", $campos) . "
                    WHERE idempleado_despido = $id";

         $conexion->query($sql) or throw new Exception('Error al actualizar estado del despido');

         $conexion->commit();

         return [
            'status' => 'success',
            'mensaje' => 'Estado actualizado correctamente. Los cambios han sido registrados en el historial.'
         ];
      } catch (Exception $e) {
         $sw = false;
         $conexion->rollback();

         return [
            'status' => 'error',
            'mensaje' => 'Error al actualizar: ' . $e->getMessage()
         ];
      } finally {
         if ($conexion != null) {
            $conexion->close();
         }
      }
   }

   /**
    * Recontratar un empleado despedido que tiene derecho a recontratación
    */
   public function recontratarEmpleado($idDespido, $idEmpleado, $fechaReingreso, $cargo, $observaciones, $idUsuarioRegistra)
   {
      global $conexion;
      $sw = true;
      $conexion->autocommit(false);
      $dt = date('Y-m-d H:i:s');

      try {
         // Verificar que el registro de despido existe y tiene derecho a recontratación
         $sqlVerificar = "SELECT ed.idempleado_despido, ed.derecho_recontratacion, 
                                   CONCAT(p.str_nombres, ' ', p.str_apellidos) as nombre_empleado
                            FROM tbl_empleado_despido ed
                            INNER JOIN tbl_empleado e ON e.idempleado = ed.idempleado
                            INNER JOIN tbl_persona p ON p.idpersona = e.idpersona
                            WHERE ed.idempleado_despido = $idDespido 
                            AND ed.idempleado = $idEmpleado
                            AND ed.str_estado = 'activo'";

         $resultVerificar = $conexion->query($sqlVerificar);

         if (!$resultVerificar || $resultVerificar->num_rows == 0) {
            throw new Exception('Registro de despido no encontrado o ya procesado');
         }

         $rowVerificar = $resultVerificar->fetch_object();

         if ($rowVerificar->derecho_recontratacion !== 'si') {
            throw new Exception('Este empleado no tiene derecho a recontratación');
         }

         // Preparar observaciones
         $obsCompletas = "RECONTRATACIÓN [$dt]\n";
         $obsCompletas .= "Reingreso: $fechaReingreso\n";
         $obsCompletas .= "Cargo: $cargo\n";
         if (!empty($observaciones)) {
            $obsCompletas .= "Obs: $observaciones\n";
         }
         $obsCompletas .= "Por: ID $idUsuarioRegistra";
         $obsCompletas = $conexion->real_escape_string($obsCompletas);

         // 1. Actualizar registro de despido
         $sqlDespido = "UPDATE tbl_empleado_despido 
                          SET str_estado = 'recontratado',
                              observaciones = CONCAT(IFNULL(observaciones, ''), '\n\n', '$obsCompletas'),
                              updated_at = '$dt'
                          WHERE idempleado_despido = $idDespido";

         if (!$conexion->query($sqlDespido)) {
            throw new Exception('Error al actualizar despido: ' . $conexion->error);
         }

         // 2. Reactivar empleado
         $cargoEsc = $conexion->real_escape_string($cargo);
         $sqlEmpleado = "UPDATE tbl_empleado 
                           SET str_estado = 'activo',
                               date_fecha_inicio = '$fechaReingreso',
                               str_cargo = '$cargoEsc',
                               str_comentarios = CONCAT(IFNULL(str_comentarios, ''), '\n[RECONTRATADO $dt] Cargo: $cargoEsc'),
                               update_at = '$dt'
                           WHERE idempleado = $idEmpleado";

         if (!$conexion->query($sqlEmpleado)) {
            throw new Exception('Error al actualizar empleado: ' . $conexion->error);
         }

         // 3. Reactivar usuario si está inactivo
         $sqlUsuario = "SELECT u.idusuario, u.str_estado 
                           FROM tbl_usuario u INNER JOIN
                          tbl_persona p on p.idpersona=u.idpersona
                          INNER JOIN tbl_empleado e ON e.idpersona= p.idpersona
                          WHERE e.idempleado = $idEmpleado";

         $resultUsuario = $conexion->query($sqlUsuario);
         if ($resultUsuario && $resultUsuario->num_rows > 0) {
            $rowUsuario = $resultUsuario->fetch_object();
            if ($rowUsuario->str_estado !== 'activo') {
               $sqlUpdateUsr = "UPDATE tbl_usuario 
                                    SET str_estado = 'activo',
                                        update_at = '$dt'
                                    WHERE idusuario = {$rowUsuario->idusuario}";

               if (!$conexion->query($sqlUpdateUsr)) {
                  throw new Exception('Error al reactivar usuario: ' . $conexion->error);
               }
            }
         }

         $conexion->commit();

         return [
            'status' => 'success',
            'mensaje' => 'Empleado recontratado exitosamente',
            'data' => [
               'nombreEmpleado' => $rowVerificar->nombre_empleado,
               'fechaReingreso' => $fechaReingreso,
               'cargo' => $cargo
            ]
         ];
      } catch (Exception $e) {
         $sw = false;
         $conexion->rollback();

         return [
            'status' => 'error',
            'mensaje' => 'Error al recontratar empleado',
            'detalle' => $e->getMessage()
         ];
      } finally {
         if ($conexion != null) {
            $conexion->close();
         }
      }
   }
}
