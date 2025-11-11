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

	}
