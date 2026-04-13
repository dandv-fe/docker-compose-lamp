<?php
	require "Conexion.php";

	class Oficina{


		public function __construct(){
		}

		public function Listar($idglobal){
			global $conexion;
			$sql = "SELECT 
				o.idoficina AS refOficina,
				o.str_nombre AS str_nombre,
				o.idempleado_administrador AS idempleado_administrador,
				e.idpersona AS idpersona_representante,
				CONCAT(p.str_nombres,' ',p.str_apellidos) AS representante,
				p.str_telefono AS telefono_representante,
				(SELECT COUNT(*) FROM tbl_sucursal s WHERE s.idoficina = o.idoficina) AS cantidad_carteras,
				(SELECT COUNT(*) FROM tbl_empleado e WHERE e.idoficina = o.idoficina AND e.str_estado <> 'inactivo') AS cantidad_empleados,
				(SELECT COUNT(*) FROM tbl_empleado e WHERE e.idoficina = o.idoficina AND e.str_estado = 'inactivo') AS cantidad_despedidos
			FROM tbl_oficina o
			LEFT JOIN tbl_empleado e ON e.idempleado = o.idempleado_administrador
			LEFT JOIN tbl_persona p ON p.idpersona = e.idpersona
			WHERE o.idglobal=?";
			$stmt = db_prepare_execute($conexion, $sql, "i", [intval($idglobal)]);
			return $stmt->get_result();
		}
		public function Obtener($idoficina){
			global $conexion;
			$sql = "SELECT 
				o.idoficina AS refOficina,
				o.str_nombre AS str_nombre,
				o.idempleado_administrador AS idempleado_administrador,
				e.idpersona AS idpersona_representante,
				CONCAT(p.str_nombres,' ',p.str_apellidos) AS representante,
				p.str_telefono AS telefono_representante,
				(SELECT COUNT(*) FROM tbl_sucursal s WHERE s.idoficina = o.idoficina) AS cantidad_carteras,
				(SELECT COUNT(*) FROM tbl_empleado e WHERE e.idoficina = o.idoficina AND e.str_estado <> 'inactivo') AS cantidad_empleados,
				(SELECT COUNT(*) FROM tbl_empleado e WHERE e.idoficina = o.idoficina AND e.str_estado = 'inactivo') AS cantidad_despedidos
			FROM tbl_oficina o
			LEFT JOIN tbl_empleado e ON e.idempleado = o.idempleado_administrador
			LEFT JOIN tbl_persona p ON p.idpersona = e.idpersona
			WHERE o.idoficina=?";
			$stmt = db_prepare_execute($conexion, $sql, "i", [intval($idoficina)]);
			$query = $stmt->get_result();
			if ($row = $query->fetch_object()) {
				$stmt->close();
				return $row;
			} else {
				$stmt->close();
				return null;
			}
		}
		public function Registrar($str_nombre, $idempleado_administrador, $idglobal){
			global $conexion;
			// Estas operaciones usan sentencias preparadas para conservar el flujo y evitar SQL concatenado.
			$sql = "INSERT INTO tbl_oficina (idglobal, str_nombre, idempleado_administrador) VALUES (?, ?, ?)";
			db_execute(
				$conexion,
				$sql,
				"isi",
				[intval($idglobal), $str_nombre, $idempleado_administrador ? intval($idempleado_administrador) : null]
			) or die('ERROR: No se pudo registrar oficina');
			return $conexion->insert_id;
		}

		public function Modificar($idoficina, $str_nombre, $idempleado_administrador, $idglobal){
			global $conexion;
			$sql = "UPDATE tbl_oficina SET str_nombre=?, idempleado_administrador=? WHERE idoficina=? AND idglobal=?";
			db_execute(
				$conexion,
				$sql,
				"siii",
				[$str_nombre, $idempleado_administrador ? intval($idempleado_administrador) : null, intval($idoficina), intval($idglobal)]
			) or die('ERROR: No se pudo actualizar oficina');
			return true;
		}

		public function Eliminar($idoficina){
			global $conexion;
			$sql = "DELETE FROM tbl_oficina WHERE idoficina=?";
			db_execute($conexion, $sql, "i", [intval($idoficina)]) or die('ERROR: No se pudo eliminar oficina');
			return true;
		}

	}
