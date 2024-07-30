<?php
	require "Conexion.php";

	class Sucursal{


		public function __construct(){
		}

		public function Registrar($useridglobal,$tipo,$razon_social,$tipo_documento,$num_documento,$direccion,$telefono,$email,$idreprecentante,$logo,$estado,$adicional){
			global $conexion;
			$dt = date('Y-m-d H:i:s');
			$sw=true;
			$conexion->autocommit(false);
			try {
				$sql = "SELECT int_maxsucursal,
				(SELECT idsucursal
								 FROM tbl_sucursal where str_codigo='$razon_social' AND  idglobal=$useridglobal) AS idsucursal,
				(SELECT IFNULL(COUNT(idsucursal),0) FROM tbl_sucursal WHERE idglobal=$useridglobal) AS cantSucursal
				 FROM tbl_global WHERE idglobal=$useridglobal";
				$query = $conexion->query($sql);
				$request= $query->fetch_object();
            
			 if (isset($request->idsucursal)) {
				echo "ERROR: (Codigo) Razon social ya esta en uso";
				return;
			 }
			 if ($request->cantSucursal==$request->int_maxsucursal) {
				echo "ERROR: No fue registrado poqur exedio maximo permitido";
				return;
			 }

			$sql = "INSERT INTO tbl_sucursal(
				idglobal, str_tipo, str_codigo, str_tipo_documento,
				str_num_documento, str_direccion, str_telefono,
				str_email, idempleado, str_logo, str_cobro_adicional,
				str_estado, created_at, updated_at
			)
			
			VALUES($useridglobal, '$tipo', '$razon_social', '$tipo_documento',
			'$num_documento','$direccion','$telefono',
			'$email',$idreprecentante,'$logo', '$adicional',
			'$estado', '$dt', '$dt'
			)";
			$conexion->query($sql) or throw new Exception('error!'); 

			$idsucursal= $conexion->insert_id;

			if ($idreprecentante!=$_SESSION['userEmpresa']) {
				$sql = "INSERT INTO tbl_auth_sucursal(
					idglobal, idsucursal, idempleado,
					tipo_usuario, created_at, updated_at, str_estado
				)
				VALUES($useridglobal, $idsucursal, $idreprecentante, 
				'representente','$dt','$dt','activo')";
				$conexion->query($sql) or throw new Exception('error!');
			}
		} catch (Exception $e) {
			$sw=false;
			$conexion->rollback();
		  }
		  $conexion->commit();
		  if ($conexion != null) {
			$conexion->close();
		  }
		  $msg=$sw? '¡Registrada exirosamenre!': 'ERROR: No ha podido ser registada.';
		  echo $msg;
		  return;
		}

		public function Modificar($idsucursal,$useridglobal,$tipo,$razon_social,$tipo_documento,$num_documento,$direccion,$telefono,$email,$idreprecentante,$logo,$estado,$adicional){
			global $conexion;
			$dt = date('Y-m-d H:i:s');
			$sw=true;
			$conexion->autocommit(false);
			try {
				$sql="SELECT idempleado FROM tbl_sucursal WHERE idsucursal=$idsucursal";
				$query = $conexion->query($sql);
				$requestSuc= $query->fetch_object();

				

			$sql = "UPDATE tbl_sucursal SET
				str_tipo='$tipo',
				str_codigo='$razon_social',
				str_tipo_documento='$tipo_documento',
				str_num_documento='$num_documento',
				str_direccion='$direccion',
				str_telefono='$telefono',
				str_email='$email',
				idempleado=$idreprecentante,
				str_logo='$logo',
				str_cobro_adicional='$adicional',
				str_estado='$estado',
				updated_at='$dt'
				WHERE idsucursal=$idsucursal
			";
			$conexion->query($sql) or throw new Exception('error!');

			if ($requestSuc->idempleado!=$idreprecentante) {
				$sql="SELECT * FROM tbl_auth_sucursal WHERE idempleado=$idreprecentante AND  idsucursal=$idsucursal";
				$query = $conexion->query($sql);
				$request= $query->fetch_object();
				if (isset($request->idauth_sucursal)) {
					$sql = "UPDATE tbl_auth_sucursal SET
						str_estado='activo',
						updated_at='$dt'
						WHERE idauth_sucursal=$request->idauth_sucursal
					";
					$conexion->query($sql) or throw new Exception('error!');
				} else {
					$sql = "INSERT INTO tbl_auth_sucursal(
						idglobal, idsucursal, idempleado,
						tipo_usuario, created_at, updated_at, str_estado
					)
					VALUES($useridglobal, $idsucursal, $idreprecentante, 
					'representente','$dt','$dt','activo')";
					$conexion->query($sql) or throw new Exception('error!');

					$sql = "UPDATE tbl_auth_sucursal SET
						str_estado='inactivo',
						updated_at='$dt'
						WHERE idempleado=$requestSuc->idempleado
					";
					$conexion->query($sql) or throw new Exception('error!');
				}
				
			}


		} catch (Exception $e) {
			
			$sw=false;
			$conexion->rollback();
		  }
		  $conexion->commit();
		  if ($conexion != null) {
			$conexion->close();
		  }
		  $msg=$sw? 'Modificada exirosamenre!': 'ERROR: No ha podido ser Modificada.';
		  echo $msg;
		}

		public function Eliminar($idsucursal){
			global $conexion;
			$sql = "DELETE FROM sucursal WHERE idsucursal = $idsucursal";
			$query = $conexion->query($sql);
			return $query;
		}

		public function Listar(){
			global $conexion;
			$idglobal=$_SESSION['userEmpresa'];
			$sql = "SELECT 
			s.idsucursal AS id,
			s.str_tipo AS tipo,
			s.str_codigo AS codigo,
			s.str_logo AS logo,
			s.str_estado AS estado,
			CONCAT(p.str_nombres,' ',p.str_apellidos) AS empleado
			 FROM tbl_sucursal s INNER JOIN 
			 	tbl_empleado e ON e.idempleado=s.idempleado INNER JOIN
				tbl_persona p ON p.idpersona=e.idpersona
			 where s.idglobal=$idglobal order by idsucursal desc";
			$query = $conexion->query($sql);
			return $query;
		}
		public function buscarSucursal($idsucursal){
			global $conexion;
			$sql = "SELECT 
				idsucursal AS ref,
				str_tipo AS tipo,
				str_codigo AS codigo,
				str_tipo_documento AS tDocumento,
				str_num_documento AS nDocumento,
				str_direccion AS direccion,
				str_telefono AS tel,
				str_email AS email,
				idempleado AS refEmpleado,
				str_logo AS logo,
				str_cobro_adicional AS adicional,
				str_estado AS estado,
				created_at AS fecha_at
			 FROM tbl_sucursal where idsucursal=$idsucursal";
			$query = $conexion->query($sql);
			return $query;
		}

		public function Reporte(){
			global $conexion;
			$sql = "SELECT * FROM sucursal order by razon_social asc";
			$query = $conexion->query($sql);
			return $query;
		}

		public function ListarSucursalesEmp($id){
			global $conexion;
			$sql = "select u.*, s.tipo, s.razon_social as razon_social, s.logo as logo, concat(e.nombre, ' ', e.apellidos) as empleado, e.*, e.estado as superadmin
	from usuario u inner join empleado e on u.idempleado = e.idempleado
	inner join sucursal s on u.idsucursal = s.idsucursal
	where u.idempleado = $id and u.estado='A' ";
			$query = $conexion->query($sql);
			return $query;
		}

	}
