<?php
	require "Conexion.php";

	class Oficina{


		public function __construct(){
		}

		public function Listar($idglobal){
			global $conexion;
			// Se asume que la tabla se llama tbl_oficina y tiene columnas idoficina, idglobal, str_nombre, idempleado_administrador
			$sql = "SELECT 
				o.idoficina AS refOficina,
				o.str_nombre AS str_nombre,
				o.idempleado_administrador AS idempleado_administrador,
				e.idpersona AS idpersona_representante,
				CONCAT(p.str_nombres,' ',p.str_apellidos) AS representante
			FROM tbl_oficina o
			LEFT JOIN tbl_empleado e ON e.idempleado = o.idempleado_administrador
			LEFT JOIN tbl_persona p ON p.idpersona = e.idpersona
			WHERE o.idglobal=$idglobal";
			$query = $conexion->query($sql);
			return $query;
		}

		public function Registrar($str_nombre, $idempleado_administrador, $idglobal){
			global $conexion;
			$sql = "INSERT INTO tbl_oficina (idglobal, str_nombre, idempleado_administrador) ";
			$sql .= "VALUES ($idglobal, '$str_nombre', ".($idempleado_administrador ? intval($idempleado_administrador) : 'NULL').")";
			$conexion->query($sql) or die('ERROR: No se pudo registrar oficina');
			return $conexion->insert_id;
		}

		public function Modificar($idoficina, $str_nombre, $idempleado_administrador, $idglobal){
			global $conexion;
			$sql = "UPDATE tbl_oficina SET str_nombre='$str_nombre', idempleado_administrador=".($idempleado_administrador?intval($idempleado_administrador):'NULL')." WHERE idoficina=$idoficina AND idglobal=$idglobal";
			$conexion->query($sql) or die('ERROR: No se pudo actualizar oficina');
			return true;
		}

		public function Eliminar($idoficina){
			global $conexion;
			$sql = "DELETE FROM tbl_oficina WHERE idoficina=$idoficina";
			$conexion->query($sql) or die('ERROR: No se pudo eliminar oficina');
			return true;
		}

	}
