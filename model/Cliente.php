<?php
require "Conexion.php";

class Cliente
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
      $notaPersona,
      $max_credito,
      $apodo,
      $notaCliente,
      $estadoCliente,
      $fiador,
      $created_empleado_id,
      $idglobal
   ) {
      global $conexion;
      $sw = true;
      $conexion->autocommit(false);
      $dt = date('Y-m-d H:i:s');
      try {
         $idsucursal = $_SESSION['idsucursal'];
         // Se migra a sentencias preparadas sin alterar mensajes ni flujo de retorno.
         $bloq = db_fetch_object(
            $conexion,
            "SELECT
            a.str_nombre
             FROM  `tbl_auth_sucursal` au INNER JOIN 
                  tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal INNER JOIN 
                  tbl_auth a ON a.idauth=b.idauth 
             where au.str_estado<>'inactivo' AND 
                   au.idempleado=? AND 
                   au.idsucursal=? AND 
                   a.str_nombre=?",
            "iis",
            [intval($created_empleado_id), intval($idsucursal), 'crear cliente']
         );
         if (isset($_SESSION['userEmpresa']) || isset($bloq->str_nombre)) {
         } else {
            echo "ERROR: No estas authorizado para esta accion";
            return;
         }

         $request = db_fetch_object(
            $conexion,
            "SELECT idpersona FROM tbl_persona WHERE idglobal=? AND str_tipo_documento=? AND str_num_documento=?",
            "iss",
            [intval($idglobal), $tipo_documento, $num_documento]
         );
         if (isset($request->idpersona)) {
            echo "ERROR: Este Documento ya existe";
            return;
         }

         $request = db_fetch_object(
            $conexion,
            "SELECT idpersona FROM tbl_persona WHERE idglobal=? AND str_email=?",
            "is",
            [intval($idglobal), $email]
         );
         if (isset($request->idpersona) && $email != '') {
            echo "ERROR: Este Email ya existe";
            return;
         }

         db_execute(
            $conexion,
            "INSERT INTO `tbl_persona`(
               idglobal,
               str_nombres,
               str_apellidos,
               str_sexo,
               str_fecha_nacimiento,
               str_tipo_documento,
               str_num_documento,
               str_telefono,
               str_email,
               str_foto,
               str_ocupacion,
               str_estado,
               str_nota,
               str_direccion_departamento,
               str_direccion_ciudad,
               str_direccion_barrio,
               str_direccion_calle,
               str_email_verificado,
               created_at,
               update_at
               )
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            'i' . str_repeat('s', 19),
            [
               intval($idglobal),
               $nombres,
               $apellidos,
               $sexo,
               $fecha_nacimiento,
               $tipo_documento,
               $num_documento,
               $telefono,
               $email,
               $ruta_carga,
               $ocupacion,
               'activo',
               $notaPersona,
               $direccion_departamento,
               $direccion_siudad,
               $direccion_barrio,
               $direccion_calle,
               '',
               $dt,
               $dt
            ]
         );
         $idpersona = $conexion->insert_id;

         db_execute(
            $conexion,
            "INSERT INTO `tbl_clientes`(
                  idglobal,
                  idpersona,
                  dec_max_credito,
                  str_apodo,
                  str_nota,
                  str_estado,
                  str_calificacion,
                  fiador_persona_id,
                  created_empleado_id,
                  create_at,
                  update_at
                )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            "iidssssiiss",
            [intval($idglobal), intval($idpersona), floatval($max_credito), $apodo, $notaCliente, $estadoCliente, 'nuevo', intval($fiador), intval($created_empleado_id), $dt, $dt]
         );
      } catch (Exception $e) {
         //
         $sw = false;
         $conexion->rollback();
      }
      $conexion->commit();
      if ($conexion != null) {

         $conexion->close();
      }
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
      $notaPersona,
      $idcliente,
      $max_credito,
      $apodo,
      $notaCliente,
      $estadoCliente,
      $fiador,
      $created_empleado_id,
      $idglobal
   ) {
      global $conexion;
      $sw = true;
      $conexion->autocommit(false);
      $dt = date('Y-m-d H:i:s');
      try {

         $idsucursal = $_SESSION['idsucursal'];
         $bloq = db_fetch_object(
            $conexion,
            "SELECT
            a.str_nombre
             FROM  `tbl_auth_sucursal` au INNER JOIN 
                  tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal INNER JOIN 
                  tbl_auth a ON a.idauth=b.idauth 
             where au.str_estado<>'inactivo' AND 
                   au.idempleado=? AND 
                   au.idsucursal=? AND 
                   a.str_nombre=?",
            "iis",
            [intval($created_empleado_id), intval($idsucursal), 'editar cliente']
         );
         if (isset($_SESSION['userEmpresa']) || isset($bloq->str_nombre)) {
         } else {
            echo "ERROR: No estas authorizado para esta accion";
            return;
         }

         $request = db_fetch_object(
            $conexion,
            "SELECT idpersona FROM tbl_persona WHERE idglobal=? AND str_email=? AND idpersona<>?",
            "isi",
            [intval($idglobal), $email, intval($idpersona)]
         );
         if (isset($request->idpersona) && $email != '') {
            echo "ERROR: Este Email ya existe";
            return;
         }

         db_execute(
            $conexion,
            "UPDATE `tbl_persona` SET	
               str_nombres=?,
               str_apellidos=?,
               str_sexo=?,
               str_fecha_nacimiento=?,
               str_tipo_documento=?,
               str_num_documento=?,
               str_telefono=?,
               str_email=?,
               str_foto=?,
               str_ocupacion=?,
               str_nota=?,
               str_direccion_departamento=?,
               str_direccion_ciudad=?,
               str_direccion_barrio=?,
               str_direccion_calle=?,
               update_at=?
               WHERE idpersona=?",
            str_repeat('s', 16) . 'i',
            [$nombres, $apellidos, $sexo, $fecha_nacimiento, $tipo_documento, $num_documento, $telefono, $email, $ruta_carga, $ocupacion, $notaPersona, $direccion_departamento, $direccion_siudad, $direccion_barrio, $direccion_calle, $dt, intval($idpersona)]
         );


         if (empty($idcliente)) {
            db_execute(
               $conexion,
               "INSERT INTO `tbl_clientes`(
                  idglobal,
                  idpersona,
                  dec_max_credito,
                  str_apodo,
                  str_nota,
                  str_estado,
                  str_calificacion,
                  fiador_persona_id,
                  created_empleado_id,
                  create_at,
                  update_at

                )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
               "iidssssiiss",
               [intval($idglobal), intval($idpersona), floatval($max_credito), $apodo, $notaCliente, $estadoCliente, 'nuevo', intval($fiador), intval($created_empleado_id), $dt, $dt]
            );
         } else {
            db_execute(
               $conexion,
               "UPDATE `tbl_clientes` SET
                  dec_max_credito=?,
                  str_apodo=?,
                  str_nota=?,
                  str_estado=?,
                  fiador_persona_id=?,
                  created_empleado_id=?,
                  update_at=?
                  WHERE idcliente=?",
               "dsssiisi",
               [floatval($max_credito), $apodo, $notaCliente, $estadoCliente, intval($fiador), intval($created_empleado_id), $dt, intval($idcliente)]
            );
         }
      } catch (Exception $e) {
         print_r($e);
         $sw = false;
         $conexion->rollback();
      }
      $conexion->commit();
      if ($conexion != null) {

         $conexion->close();
      }
      return $sw;
   }

   public function editarDocumentoPersona($idglobal, $idpersona, $tipo_documento, $num_documento, $created_empleado_id)
   {
      global $conexion;
      $conexion->autocommit(false);
      $sw = true;
      $sql = "SELECT idpersona FROM tbl_persona WHERE idglobal=$idglobal AND str_tipo_documento='$tipo_documento' AND str_num_documento='$num_documento'";
      $query = $conexion->query($sql);
      $request = $query->fetch_object();
      if (isset($request->idpersona)) {
         echo "!ERROR:! Este Documento ya existe";
         return;
      }

      $idsucursal = $_SESSION['idsucursal'];
      $sql = "SELECT
				a.str_nombre
				 FROM  `tbl_auth_sucursal` au INNER JOIN 
						tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal INNER JOIN 
						tbl_auth a ON a.idauth=b.idauth 
				 where au.str_estado<>'inactivo' AND 
						 au.idempleado=$created_empleado_id AND 
						 au.idsucursal=$idsucursal AND 
						 a.str_nombre='editar documento'";
      $qry = $conexion->query($sql);
      $bloq = $qry->fetch_object();


      if (isset($_SESSION['userEmpresa']) || isset($bloq->str_nombre)) {
      } else {
         echo "ERROR: No estas authorizado para esta accion";
         return;
      }



      try {

         $sql = "UPDATE tbl_persona SET str_tipo_documento='$tipo_documento', str_num_documento='$num_documento'
						WHERE idpersona=$idpersona";
         $conexion->query($sql) or throw new Exception('error!');
      } catch (Exception $e) {
         $sw = false;
         $conexion->rollback();
      }
      $conexion->commit();
      if ($conexion != null) {
         $conexion->close();
      }
      $mensaje = $sw ? "Documento de Persona editado ¡Correctamente!" : "¡ERROR: Inesperado!";
      echo $mensaje;
      return $sw;
   }




   public function ListarClientesDeCartera($idsucursal)
   {

      global $conexion;
      $sql = "SELECT * FROM view_list_client WHERE refSucursal=$idsucursal";
      $query = $conexion->query($sql);
      return $query;
   }
   public function ListarClientesMorososDeCartera($idsucursal)
   {

      global $conexion;
      $sql = "SELECT 
				refTarjeta,
				resta,
				costo,
				valor,
				ut_adi_valor,
				fecha_at,
				cliente,
				t_documento,
				n_documento,
				tel,
				foto
			
			
			 FROM view_ruta WHERE refSucursal=$idsucursal AND estado='moroso'";

      $query = $conexion->query($sql);
      return $query;
   }
   public function ListarClientesRetiradosDeCartera($idsucursal)
   {

      global $conexion;
      $sql = "SELECT 
				refTarjeta,
				resta,
				costo,
				valor,
				ut_adi_valor,
				fecha_at,
				cliente,
				t_documento,
				n_documento,
				tel,
				foto,
				estado
			
			
			 FROM view_ruta WHERE refSucursal=$idsucursal AND estado='fallecio' OR 
			 refSucursal=$idsucursal AND estado='discapacitado' ";

      $query = $conexion->query($sql);
      return $query;
   }
   public function createComentario($idcomentario, $comentario, $idusuario, $idcliente, $tipo)
   {
      global $conexion;
      $conexion->autocommit(false);
      $sw = true;
      $fecha = date('Y-m-d H:i:s');
      $idcomentarioVliente = uniqidReal();
      try {
         $sql = "INSERT INTO tbl_comentarios(
							idcomentario,
							str_comentario,
							str_tipo,
							idusuario,
							created_at,
							update_at
					)
					VALUES (
							'$idcomentario',
							'$comentario',
							'$tipo',
							$idusuario,
							'$fecha',
							'$fecha'
					)";
         $conexion->query($sql) or throw new Exception("error!");

         $sql = "INSERT INTO tbl_comentarios_cliente (
							idcomentariocliente,
							idcliente,
							idcomentario
				 )
				 VALUES ( '$idcomentarioVliente', $idcliente, '$idcomentario')";
         $conexion->query($sql) or throw new Exception("error!");
      } catch (Exception $e) {

         $sw = false;
         $conexion->rollback();
      }
      $conexion->commit();
      if ($conexion != null) {
         $conexion->close();
      }
      $mensaje = $sw ? "¡Creado Correctamente!" : "¡ERROR: Inesperado!";
      echo $mensaje;
      return;
   }

   public function updateComentario($idcomentario, $comentario, $idusuario)
   {
      global $conexion;
      $conexion->autocommit(false);
      $sw = true;
      try {
         $sql = "UPDATE tbl_comentarios SET	str_comentario='$comentario' 
				WHERE idcomentario='$idcomentario' AND idusuario=$idusuario";
         $conexion->query($sql) or throw new Exception("error!");
      } catch (Exception $e) {
         $sw = false;
         $conexion->rollback();
      }
      $conexion->commit();
      if ($conexion != null) {
         $conexion->close();
      }
      $mensaje = $sw ? "¡Editado Correctamente!" : "¡ERROR: Inesperado!";
      echo $mensaje;
      return;
   }

   public function listComentarios($idcliente, $idusuario)
   {
      global $conexion;
      $sql = "SELECT 
			cc.idcomentariocliente AS refComentarioCliente,
			c.idcomentario AS refComentario,
			c.str_comentario AS comentario,
			c.str_tipo AS tipo,
			c.idusuario AS refUsuarioCreated,
			c.created_at AS fecha_at,
			c.update_at AS fecha_up,
			CONCAT(p.str_nombres,' ',p.str_apellidos) AS persona,
			p.str_foto AS foto
			
			FROM `tbl_comentarios_cliente`  cc INNER JOIN
			tbl_comentarios c ON c.idcomentario=cc.idcomentario INNER JOIN
			tbl_usuario u ON u.idusuario=c.idusuario INNER JOIN
			tbl_persona p ON p.idpersona=u.idpersona
			WHERE c.str_tipo='comentario' AND cc.idcliente=$idcliente OR
			u.idusuario=$idusuario AND c.str_tipo='alerta' AND cc.idcliente=$idcliente
			
			ORDER BY c.created_at DESC";
      $query = $conexion->query($sql);
      return $query;
   }

   public function eliminarComentario($refComentario, $idusuario)
   {
      global $conexion;
      $sw = true;
      $conexion->autocommit(false);
      try {
         $sql = "DELETE FROM tbl_comentarios WHERE idcomentario = '$refComentario' AND idusuario=$idusuario";
         $conexion->query($sql) or throw new Exception('error!');
      } catch (Exception $e) {
         $sw = false;
         $conexion->rollback();
      }
      $conexion->commit();
      if ($conexion != null) {
         $conexion->close();
      }
      $mensaje = $sw ? "¡Eliminado Correctamente!" : "¡ERROR: Inesperado!";
      echo $mensaje;
      return;
   }

   public function SearchAlerta($idcliente, $idusuario)
   {
      global $conexion;
      $sql = "SELECT 
			c.idcomentario AS id
			FROM `tbl_comentarios_cliente`  cc INNER JOIN
			tbl_comentarios c ON c.idcomentario=cc.idcomentario INNER JOIN
			tbl_usuario u ON u.idusuario=c.idusuario 
			WHERE cc.idcliente=$idcliente AND c.str_tipo='alerta' AND u.idusuario=$idusuario";
      $query = $conexion->query($sql);
      return $query;
   }

   public function restaurarMoroso($idtarjeta)
   {
      global $conexion;
      $sw = true;
      $conexion->autocommit(false);
      try {
         $sql = "SELECT str_estado FROM tbl_tarjetas WHERE idtarjeta = '$idtarjeta'";
         $quer = $conexion->query($sql);
         $req = $quer->fetch_object();
         $newEstado = 'estubo en los ' . $req->str_estado;
         $sql = "UPDATE tbl_tarjetas SET str_estado='$newEstado' WHERE idtarjeta = '$idtarjeta'";
         $conexion->query($sql) or throw new Exception('error!');
      } catch (Exception $e) {
         $sw = false;
         $conexion->rollback();
      }
      $conexion->commit();
      if ($conexion != null) {
         $conexion->close();
      }
      $mensaje = $sw ? "¡restaurada Correctamente!" : "¡ERROR: Inesperado!";
      echo $mensaje;
      return;
   }

   public function searchClientes($search)
   {
      global $conexion;
      $sql = "SELECT p.idpersona,
				g.idglobal,
				g.str_razon_social,
				CONCAT(p.str_nombres,' ',p.str_apellidos) AS nombre,
				p.str_sexo,
				p.str_tipo_documento,
				p.str_num_documento,
				p.str_telefono,
				p.str_email,
				p.str_foto,
				p.str_ocupacion,
				p.str_direccion_departamento,
				p.str_direccion_ciudad,
				p.str_direccion_barrio,
				p.str_direccion_calle,
				p.str_nota,
				p.created_at

			FROM tbl_persona p INNER JOIN tbl_global g ON g.idglobal=p.idglobal
			
			WHERE str_num_documento = '$search'";
      $query = $conexion->query($sql);
      return $query;
   }

   public function isEmpleado($idpersona)
   {
      global $conexion;
      $sql = "SELECT * FROM tbl_empleado WHERE idpersona = $idpersona";
      $query = $conexion->query($sql);
      return $query;
   }
   public function obligaciones($idpersona)
   {
      global $conexion;
      $sql = "SELECT * FROM view_ruta WHERE refPersona=$idpersona
				AND estado<>'cancelado'
				";
      $query = $conexion->query($sql);
      return $query;
   }
   public function descuentos($idpersona)
   {
      global $conexion;
      $sql = "SELECT d.* FROM tbl_descripcion d INNER JOIN 
			tbl_tarjetas t ON t.idtarjeta=d.idtarjeta INNER JOIN 
			tbl_clientes c ON c.idcliente=t.idcliente
			WHERE c.idpersona = $idpersona AND d.str_descripcion like 'Descuento%'";
      $query = $conexion->query($sql);
      return $query;
   }
   public function getPersona($idpersona)
   {
      global $conexion;
      $sql = "SELECT * FROM tbl_persona WHERE idpersona = $idpersona";
      $query = $conexion->query($sql);
      return $query;
   }
   public function createPersona($reg)
   {
      global $conexion;
      $sw = true;
      $conexion->autocommit(false);
      $dt = date('Y-m-d H:i:s');
      try {

         $sql = "SELECT idpersona FROM tbl_persona WHERE idglobal=$reg->idglobal AND 
					str_tipo_documento='$reg->str_tipo_documento' AND str_num_documento='$reg->str_num_documento'";
         $query = $conexion->query($sql);
         $request = $query->fetch_object();
         if (isset($request->idpersona)) {
            echo "ERROR: Este Documento ya existe";
            return;
         }

         $sql = "SELECT idpersona FROM tbl_persona WHERE idglobal=$reg->idglobal AND str_email='$reg->str_email'";
         $query = $conexion->query($sql);
         $request = $query->fetch_object();
         if (isset($request->idpersona) && $reg->str_email != '') {
            echo "ERROR: Este Email ya existe";
            return;
         }

         $sql = "SELECT idpersona FROM tbl_persona WHERE idglobal=$reg->idglobal AND str_telefono='$reg->str_telefono'";
         $query = $conexion->query($sql);
         $request = $query->fetch_object();
         if (isset($request->idpersona) && $reg->str_telefono != '') {
            echo "ERROR: Este telefono ya existe";
            return;
         }



         $sql = "INSERT INTO `tbl_persona`(	
					idglobal,
					str_nombres,
					str_apellidos,
					str_sexo,
					str_fecha_nacimiento,
					str_tipo_documento,
					str_num_documento,
					str_telefono,
					str_email,
					str_foto,
					str_ocupacion,
					str_estado,
					str_nota,
					str_direccion_departamento,
					str_direccion_ciudad,
					str_direccion_barrio,
					str_direccion_calle,
					str_email_verificado,
					created_at,
					update_at
	
					)
					 VALUES ($reg->idglobal,'$reg->str_nombres', '$reg->str_apellidos', '$reg->str_sexo', '$reg->str_fecha_nacimiento', '$reg->str_tipo_documento', '$reg->str_num_documento', '$reg->str_telefono', '$reg->str_email', '$reg->str_foto', '$reg->str_ocupacion', 'activo', '$reg->str_nota',
						'$reg->str_direccion_departamento',
						'$reg->str_direccion_ciudad',
						'$reg->str_direccion_barrio',
						'$reg->str_direccion_calle',
							'',
							'$dt',
							'$dt'
							)";

         $conexion->query($sql) or throw new Exception('error!');
      } catch (Exception $e) {
         $sw = false;
         $conexion->rollback();
      }
      $conexion->commit();
      if ($conexion != null) {
         $conexion->close();
      }
      $mensaje = $sw ? "¡Registrado Correctamente!" : "¡ERROR: Inesperado!";
      echo $mensaje;
      return;
   }
}
