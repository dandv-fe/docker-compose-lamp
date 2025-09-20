<?php
	require "Conexion.php";

	class Cliente{
	
		
		public function __construct(){
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
			$notaPersona,
			$max_credito, $apodo, $notaCliente, $estadoCliente, $fiador, $created_empleado_id,
			$idglobal
		) {
			global $conexion;
			$sw = true;
			$conexion->autocommit(false);
			$dt = date('Y-m-d H:i:s');
			try {
				$idsucursal = $_SESSION['MYSESSION_idsucursal'];
				$sql = "SELECT
				a.str_nombre
				 FROM  `tbl_auth_sucursal` au INNER JOIN 
						tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal INNER JOIN 
						tbl_auth a ON a.idauth=b.idauth 
				 where au.str_estado<>'inactivo' AND 
						 au.idempleado=$created_empleado_id AND 
						 au.idsucursal=$idsucursal AND 
						 a.str_nombre='crear cliente'";
				$qry = $conexion->query($sql);
				$bloq = $qry->fetch_object();
				if (isset($_SESSION['userEmpresa']) ||isset($bloq->str_nombre)){
	
				}else {
					echo "ERROR: No estas authorizado para esta accion";
					return;
				}
	
				$sql = "SELECT idpersona FROM tbl_persona WHERE idglobal=$idglobal AND str_tipo_documento='$tipo_documento' AND str_num_documento='$num_documento'";
				 $query = $conexion->query($sql);
				 $request= $query->fetch_object();
				 if (isset($request->idpersona)) {
					echo "ERROR: Este Documento ya existe";
					return;
				 }

				 $sql = "SELECT idpersona FROM tbl_persona WHERE idglobal=$idglobal AND str_email='$email'";
				 $query = $conexion->query($sql);
				 $request= $query->fetch_object();
				 if (isset($request->idpersona) && $email!='') {
					echo "ERROR: Este Email ya existe";
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
					 VALUES ($idglobal,'$nombres', '$apellidos', '$sexo', '$fecha_nacimiento', '$tipo_documento', '$num_documento', '$telefono', '$email', '$ruta_carga', '$ocupacion', 'activo', '$notaPersona',
						'$direccion_departamento',
						'$direccion_siudad',
						'$direccion_barrio',
						'$direccion_calle',
							'',
							'$dt',
							'$dt'
							)";
	
				$conexion->query($sql) or throw new Exception('error!');
				$idpersona = $conexion->insert_id;
			   
				$sql = "INSERT INTO `tbl_clientes`(
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
				  VALUES ($idglobal, $idpersona, $max_credito, '$apodo', '$notaCliente', '$estadoCliente','nuevo', $fiador, $created_empleado_id, '$dt', '$dt')";
				$conexion->query($sql) or throw new Exception('error!');
	
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
			$max_credito, $apodo, $notaCliente, $estadoCliente, $fiador, $created_empleado_id,
			$idglobal
		) {
			global $conexion;
			$sw = true;
			$conexion->autocommit(false);
			$dt = date('Y-m-d H:i:s');
			try {

				$idsucursal = $_SESSION['MYSESSION_idsucursal'];
				$sql = "SELECT
				a.str_nombre
				 FROM  `tbl_auth_sucursal` au INNER JOIN 
						tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal INNER JOIN 
						tbl_auth a ON a.idauth=b.idauth 
				 where au.str_estado<>'inactivo' AND 
						 au.idempleado=$created_empleado_id AND 
						 au.idsucursal=$idsucursal AND 
						 a.str_nombre='editar cliente'";
				$qry = $conexion->query($sql);
				$bloq = $qry->fetch_object();
				if (isset($_SESSION['userEmpresa']) ||isset($bloq->str_nombre)){
	
				}else {
					echo "ERROR: No estas authorizado para esta accion";
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
					str_nota='$notaPersona',
					str_direccion_departamento='$direccion_departamento',
					str_direccion_ciudad='$direccion_siudad',
					str_direccion_barrio='$direccion_barrio',
					str_direccion_calle='$direccion_calle',
					update_at='$dt'
					WHERE idpersona=$idpersona";
	
				$conexion->query($sql) or throw new Exception('error!');
			   

				 if (empty($idcliente)) {
					$sql = "INSERT INTO `tbl_clientes`(
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
				  VALUES ($idglobal, $idpersona, $max_credito, '$apodo', '$notaCliente', '$estadoCliente','nuevo', $fiador, $created_empleado_id, '$dt', '$dt')";
				$conexion->query($sql) or throw new Exception('error!');
				 } else {
					$sql = "UPDATE `tbl_clientes` SET
						dec_max_credito=$max_credito,
						str_apodo='$apodo',
						str_nota='$notaCliente',
						str_estado='$estadoCliente',
						fiador_persona_id='$fiador',
						created_empleado_id='$created_empleado_id',
						update_at='$dt'
						WHERE idcliente=$idcliente
				";
			   $conexion->query($sql) or throw new Exception('error!');
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

		public function editarDocumentoPersona($idglobal,$idpersona,$tipo_documento,$num_documento,$created_empleado_id)  {
			global $conexion;
			$conexion->autocommit(false);
			$sw = true;
			$sql = "SELECT idpersona FROM tbl_persona WHERE idglobal=$idglobal AND str_tipo_documento='$tipo_documento' AND str_num_documento='$num_documento'";
				 $query = $conexion->query($sql);
				 $request= $query->fetch_object();
				 if (isset($request->idpersona)) {
					echo "!ERROR:! Este Documento ya existe";
					return;
				 }

				 $idsucursal = $_SESSION['MYSESSION_idsucursal'];
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

				
				if (isset($_SESSION['userEmpresa']) ||isset($bloq->str_nombre)){
	
				}else {
					echo "ERROR: No estas authorizado para esta accion";
					return;
				}



			try {

				$sql="UPDATE tbl_persona SET str_tipo_documento='$tipo_documento', str_num_documento='$num_documento'
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
	
	 

		
		public function ListarClientesDeCartera($idsucursal){
           
			global $conexion;
			$sql = "SELECT * FROM view_list_client WHERE refSucursal=$idsucursal";
			$query = $conexion->query($sql);
			return $query;
		}
		public function ListarClientesMorososDeCartera($idsucursal){
           
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
		public function ListarClientesRetiradosDeCartera($idsucursal){
           
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
		public function createComentario($idcomentario,$comentario,$idusuario,$idcliente,$tipo){
			global $conexion;
			$conexion->autocommit(false);
			$sw = true;
			$fecha = date('Y-m-d H:i:s');
			$idcomentarioVliente=uniqidReal();
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

				 $sql="INSERT INTO tbl_comentarios_cliente (
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

	public function updateComentario($idcomentario,$comentario, $idusuario){
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

	public function listComentarios($idcliente, $idusuario){
			global $conexion;
			$sql="SELECT 
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
			$query= $conexion->query( $sql );
			return $query;
	}

		public function eliminarComentario($refComentario, $idusuario){
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

		public function SearchAlerta($idcliente,$idusuario) {
			global $conexion;
			$sql="SELECT 
			c.idcomentario AS id
			FROM `tbl_comentarios_cliente`  cc INNER JOIN
			tbl_comentarios c ON c.idcomentario=cc.idcomentario INNER JOIN
			tbl_usuario u ON u.idusuario=c.idusuario 
			WHERE cc.idcliente=$idcliente AND c.str_tipo='alerta' AND u.idusuario=$idusuario";
			$query= $conexion->query( $sql );
			return $query;
		}

		public function restaurarMoroso($idtarjeta) {
			global $conexion;
			$sw = true;
			$conexion->autocommit(false);
			try {
				$sql="SELECT str_estado FROM tbl_tarjetas WHERE idtarjeta = '$idtarjeta'";
				$quer=$conexion->query($sql);
				$req=$quer->fetch_object();
				$newEstado='estubo en los '.$req->str_estado;
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
		
		public function searchClientes($search) {
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

		public function isEmpleado($idpersona) {
			global $conexion;
			$sql = "SELECT * FROM tbl_empleado WHERE idpersona = $idpersona";
			$query = $conexion->query($sql);
			return $query;
		}
		public function obligaciones($idpersona) {
			global $conexion;
			$sql = "SELECT * FROM view_ruta WHERE refPersona=$idpersona
				AND estado<>'cancelado'
				";
			$query = $conexion->query($sql);
			return $query;

		}
		public function descuentos($idpersona) {
			global $conexion;
			$sql = "SELECT d.* FROM tbl_descripcion d INNER JOIN 
			tbl_tarjetas t ON t.idtarjeta=d.idtarjeta INNER JOIN 
			tbl_clientes c ON c.idcliente=t.idcliente
			WHERE c.idpersona = $idpersona AND d.str_descripcion like 'Descuento%'";
			$query = $conexion->query($sql);
			return $query;
		}
		public function getPersona($idpersona) {
			global $conexion;
			$sql = "SELECT * FROM tbl_persona WHERE idpersona = $idpersona";
			$query = $conexion->query($sql);
			return $query;
		}
		public function createPersona($res) {
			global $conexion;
			$sw = true;
			$conexion->autocommit(false);
			$dt = date('Y-m-d H:i:s');
			try {
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
					 VALUES ($res->idglobal,'$res->str_nombres', '$res->str_apellidos', '$res->str_sexo', '$res->str_fecha_nacimiento', '$res->str_tipo_documento', '$res->str_num_documento', '$res->str_telefono', '$res->str_email', '$res->str_foto', '$res->str_ocupacion', 'activo', '$res->str_nota',
						'$res->str_direccion_departamento',
						'$res->str_direccion_ciudad',
						'$res->str_direccion_barrio',
						'$res->str_direccion_calle',
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
/*$conexion->autocommit(false);
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
		return;*/