<?php
require "Conexion.php";

class KardexValorizado
{


	public function __construct()
	{
	}
	public function listKardex($idglobal, $superadmin, $createdEmpleadoId)
	{
		global $conexion;
		$sql = '';
		if (isset($superadmin)) {


			$sql = "SELECT
	s.idsucursal AS refSucursal,
	s.str_tipo AS tipo,
	s.str_codigo AS codigo,
	( SELECT IFNULL( SUM( dec_total ), 0 ) FROM tbl_contabilidad_detalle WHERE idsucursal = s.idsucursal AND idtipo_contabilidad <> 8 AND str_estado <> 'created' ) AS caja,
	(
	SELECT
		IFNULL( COUNT( idtarjeta ), 0 ) 
	FROM
		tbl_tarjetas 
	WHERE
		idsucursal = s.idsucursal 
		AND str_estado <> 'fallecio' 
		AND str_estado <> 'moroso' 
		AND str_estado <> 'discapacitado' 
		AND str_estado <> 'cancelado' 
	) AS n_at,
	(
	SELECT
		IFNULL( SUM( dec_resta ), 0 ) 
	FROM
		tbl_tarjetas 
	WHERE
		idsucursal = s.idsucursal 
		AND str_estado <> 'fallecio' 
		AND str_estado <> 'moroso' 
		AND str_estado <> 'discapacitado' 
		AND str_estado <> 'cancelado' 
	) AS suma_at,
	( SELECT IFNULL( COUNT( idtarjeta ), 0 ) FROM tbl_tarjetas WHERE idsucursal = s.idsucursal AND str_estado = 'moroso' ) AS n_mo,
	( SELECT IFNULL( SUM( dec_resta ), 0 ) FROM tbl_tarjetas WHERE idsucursal = s.idsucursal AND str_estado = 'moroso' ) AS suma_mo,
	(
	SELECT
		IFNULL( COUNT( idtarjeta ), 0 ) 
	FROM
		tbl_tarjetas 
	WHERE
		idsucursal = s.idsucursal 
		AND str_estado = 'fallecio' 
		OR idsucursal = s.idsucursal 
		AND str_estado = 'discapacitado' 
	) AS n_re,
	(
	SELECT
		IFNULL( SUM( dec_resta ), 0 ) 
	FROM
		tbl_tarjetas 
	WHERE
		idsucursal = s.idsucursal 
		AND str_estado = 'fallecio' 
		OR idsucursal = s.idsucursal 
		AND str_estado = 'discapacitado' 
	) AS suma_re,
	( SELECT COUNT(*) FROM `view_list_client` WHERE refSucursal = s.idsucursal ) AS n_cli 
FROM
	tbl_sucursal s WHERE s.idglobal=$idglobal AND str_estado='disponible'";

		} else {
			$sql = "SELECT
				au.idsucursal 
			FROM
				tbl_auth_sucursal au
				INNER JOIN tbl_auths b ON b.idauth_sucursal = au.idauth_sucursal
				INNER JOIN tbl_auth a ON a.idauth = b.idauth 
			WHERE
				au.idempleado = $createdEmpleadoId
				AND au.str_estado <> 'inactivo' 
				AND a.str_nombre = 'kardex valorizado' 
			GROUP BY
				au.idauth_sucursal";
				$query = $conexion->query($sql);
				$refSucursals=array();

				while ($reqSuc=$query->fetch_object()) {
					array_push($refSucursals,$reqSuc->idsucursal);
				}

				$sql = "SELECT
	s.idsucursal AS refSucursal,
	s.str_tipo AS tipo,
	s.str_codigo AS codigo,
	( SELECT IFNULL( SUM( dec_total ), 0 ) FROM tbl_contabilidad_detalle WHERE idsucursal = s.idsucursal AND idtipo_contabilidad <> 8 AND str_estado <> 'created' ) AS caja,
	(
	SELECT
		IFNULL( COUNT( idtarjeta ), 0 ) 
	FROM
		tbl_tarjetas 
	WHERE
		idsucursal = s.idsucursal 
		AND str_estado <> 'fallecio' 
		AND str_estado <> 'moroso' 
		AND str_estado <> 'discapacitado' 
		AND str_estado <> 'cancelado' 
	) AS n_at,
	(
	SELECT
		IFNULL( SUM( dec_resta ), 0 ) 
	FROM
		tbl_tarjetas 
	WHERE
		idsucursal = s.idsucursal 
		AND str_estado <> 'fallecio' 
		AND str_estado <> 'moroso' 
		AND str_estado <> 'discapacitado' 
		AND str_estado <> 'cancelado' 
	) AS suma_at,
	( SELECT IFNULL( COUNT( idtarjeta ), 0 ) FROM tbl_tarjetas WHERE idsucursal = s.idsucursal AND str_estado = 'moroso' ) AS n_mo,
	( SELECT IFNULL( SUM( dec_resta ), 0 ) FROM tbl_tarjetas WHERE idsucursal = s.idsucursal AND str_estado = 'moroso' ) AS suma_mo,
	(
	SELECT
		IFNULL( COUNT( idtarjeta ), 0 ) 
	FROM
		tbl_tarjetas 
	WHERE
		idsucursal = s.idsucursal 
		AND str_estado = 'fallecio' 
		OR idsucursal = s.idsucursal 
		AND str_estado = 'discapacitado' 
	) AS n_re,
	(
	SELECT
		IFNULL( SUM( dec_resta ), 0 ) 
	FROM
		tbl_tarjetas 
	WHERE
		idsucursal = s.idsucursal 
		AND str_estado = 'fallecio' 
		OR idsucursal = s.idsucursal 
		AND str_estado = 'discapacitado' 
	) AS suma_re,
	( SELECT COUNT(*) FROM `view_list_client` WHERE refSucursal = s.idsucursal ) AS n_cli 
FROM
	tbl_sucursal s WHERE s.idsucursal IN (" . implode(",", $refSucursals) . ") AND s.str_estado='Disponible'";


		}

		$query = $conexion->query($sql);
		return $query;


	}


}
