<?php
require "Conexion.php";

class RecibeCuentas
{

	public function __construct()
	{
	}
	// Registras guardado para los archivos de la contabilidad
	public function registrarDetalleruta($iddetalleruta, $created_empleado_id)
	{
		global $conexion;
		$sw = true;
		$conexion->autocommit(false);
		$fecha = date('Y-m-d H:i:s');
		try {
			$sql = "SELECT idsucursal FROM tbl_detalle_ruta WHERE iddetalleruta=$iddetalleruta";
			$qry = $conexion->query($sql);
			$idsucursal = $qry->fetch_object()->idsucursal;

			$sql = "SELECT
			a.str_nombre
			 FROM  `tbl_auth_sucursal` au INNER JOIN 
					tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal INNER JOIN 
					tbl_auth a ON a.idauth=b.idauth 
			 where au.str_estado<>'inactivo' AND 
					 au.idempleado=$created_empleado_id AND 
					 au.idsucursal=$idsucursal AND 
					 a.str_nombre='guardado permanente'";
			$qry = $conexion->query($sql);
			$bloq = $qry->fetch_object();

			if (isset($_SESSION['userEmpresa']) || isset($bloq->str_nombre)) {

			} else {
				echo "ERROR: No estas authorizado para esta accion";
				return;
			}




			$sql = "SELECT refDetalle_ruta, refGlobal, refSucursal, valorTotalCreditos, cantidadTotalRecaudos, masUtilidad, descuento, recaudo, prestamo, articulo, efectivoOtraUtilidad, estado FROM view_contabilidad_detalle_ruta WHERE refDetalle_ruta=$iddetalleruta AND estado='entregando'";
			$querySelecAbono = $conexion->query($sql);
			$res = $querySelecAbono->fetch_object();



			if ($res->masUtilidad > 0) {
				// cobros de mas utilidad o mas intereses por mora por ejemplo
				$idcontabilidad_detalle = uniqidReal();
				$sql = "INSERT INTO tbl_contabilidad_detalle (
				idcontabilidad_detalle,
				idglobal, idsucursal, idtipo_contabilidad, iddetalleruta,
				dec_total,
				str_detalle,
				str_nombre,
				str_estado,
				str_operacion,
				created_empleado_id,
				created_at,
				update_at
				)
				VALUES ('$idcontabilidad_detalle',$res->refGlobal, $res->refSucursal, 8, $iddetalleruta,
				$res->masUtilidad, 'no totaliza', 'mas-utilidad', 'saved', 
				'info-totalizar', $created_empleado_id, '$fecha','$fecha' )";
				$conexion->query($sql) or throw new Exception('error!');
			}

			if ($res->descuento > 0) {
				// Descuento 
				$idcontabilidad_detalle = uniqidReal();
				$sql = "INSERT INTO tbl_contabilidad_detalle (
				idcontabilidad_detalle,
				idglobal, idsucursal, idtipo_contabilidad, iddetalleruta,
				dec_total,
				str_detalle,
				str_nombre,
				str_estado,
				str_operacion,
				created_empleado_id,
				created_at,
				update_at
				)
				VALUES ('$idcontabilidad_detalle',$res->refGlobal, $res->refSucursal, 8, $iddetalleruta,
				$res->descuento, 'no totaliza', 'descuento', 'saved', 
				'info-totalizar', $created_empleado_id, '$fecha','$fecha' )";
				$conexion->query($sql) or throw new Exception('error!');
			}

			if ($res->valorTotalCreditos > 0) {
				// valor total creditos valor que los clientes van apagar o pagaron => resumiendo aumento en cartesa
				$idcontabilidad_detalle = uniqidReal();
				$sql = "INSERT INTO tbl_contabilidad_detalle (idcontabilidad_detalle,
				idglobal, idsucursal, idtipo_contabilidad, iddetalleruta,
				dec_total,
				str_detalle,
				str_nombre,
				str_estado,
				str_operacion,
				created_empleado_id,
				created_at,
				update_at
				)
				VALUES ('$idcontabilidad_detalle',$res->refGlobal, $res->refSucursal, 8, $iddetalleruta,
				$res->valorTotalCreditos, 'no totaliza', 'valorTotalCreditos', 'saved', 
				'info-totalizar', $created_empleado_id, '$fecha','$fecha' )";
				$conexion->query($sql) or throw new Exception('error!');
			}

			if ($res->cantidadTotalRecaudos > 0) {
				// la cantidad de tarjetas que realizaron un pago (Abono, Canselado, Inicial)
				$idcontabilidad_detalle = uniqidReal();
				$sql = "INSERT INTO tbl_contabilidad_detalle (idcontabilidad_detalle,
					idglobal, idsucursal, idtipo_contabilidad, iddetalleruta,
					dec_total,
					str_detalle,
					str_nombre,
					str_estado,
					str_operacion,
					created_empleado_id, 
					created_at,
					update_at
					)
					VALUES ('$idcontabilidad_detalle',$res->refGlobal, $res->refSucursal, 8, $iddetalleruta,
					$res->cantidadTotalRecaudos, 'no totaliza', 'cantidad-abonos', 'saved', 
					'info-totalizar', $created_empleado_id, '$fecha','$fecha' )";
				$conexion->query($sql) or throw new Exception('error!');
			}

			if ($res->prestamo > 0) {
				// el valor costo que se realisan en consepto de Prestamo
				$idcontabilidad_detalle = uniqidReal();
				$sql = "INSERT INTO tbl_contabilidad_detalle (idcontabilidad_detalle,
					idglobal, idsucursal, idtipo_contabilidad, iddetalleruta,
					dec_total,
					str_detalle,
					str_nombre,
					str_estado,
					str_operacion,
					created_empleado_id,
					created_at,
					update_at
					)
					VALUES ('$idcontabilidad_detalle',$res->refGlobal, $res->refSucursal, 4, $iddetalleruta,
					$res->prestamo*-1, '', 'prestamos', 'saved', 
					'salida-totalizar', $created_empleado_id, '$fecha','$fecha' )";
				$conexion->query($sql) or throw new Exception('error!');
			}
			if ($res->articulo > 0) {
				// el valor costo que se realisan en consepto de Articulo
				$idcontabilidad_detalle = uniqidReal();
				$sql = "INSERT INTO tbl_contabilidad_detalle (idcontabilidad_detalle,
					idglobal, idsucursal, idtipo_contabilidad, iddetalleruta,
					dec_total,
					str_detalle,
					str_nombre,
					str_estado,
					str_operacion,
					created_empleado_id,
					created_at,
					update_at
					)
					VALUES ('$idcontabilidad_detalle',$res->refGlobal, $res->refSucursal, 4, $iddetalleruta,
					$res->articulo*-1, '', 'articulos', 'saved', 
					'salida-totalizar', $created_empleado_id, '$fecha','$fecha' )";
				$conexion->query($sql) or throw new Exception('error!');
			}
			if ($res->recaudo > 0) {
				// el valor del recaudo o cobrado
				$idcontabilidad_detalle = uniqidReal();
				$sql = "INSERT INTO tbl_contabilidad_detalle (idcontabilidad_detalle,
					idglobal, idsucursal, idtipo_contabilidad, iddetalleruta,
					dec_total,
					str_detalle,
					str_nombre,
					str_estado,
					str_operacion,
					created_empleado_id,
					created_at,
					update_at
					)
					VALUES ('$idcontabilidad_detalle',$res->refGlobal, $res->refSucursal, 7, $iddetalleruta,
					$res->recaudo, '', 'recaudo', 'saved', 
					'entrada-totalizar', $created_empleado_id, '$fecha','$fecha' )";
				$conexion->query($sql) or throw new Exception('error!');
			}
			if ($res->efectivoOtraUtilidad > 0) {
				// el recaudo de seguro, boletas u otros
				$idcontabilidad_detalle = uniqidReal();
				$sql = "INSERT INTO tbl_contabilidad_detalle (idcontabilidad_detalle,
					idglobal, idsucursal, idtipo_contabilidad, iddetalleruta,
					dec_total,
					str_detalle,
					str_nombre,
					str_estado,
					str_operacion,
					created_empleado_id,
					created_at,
					update_at
					)
					VALUES ('$idcontabilidad_detalle',$res->refGlobal, $res->refSucursal, 7, $iddetalleruta,
					$res->efectivoOtraUtilidad, '', 'efectivo-otra-utilidad', 'saved', 
					'entrada-totalizar', $created_empleado_id, '$fecha','$fecha' )";
				$conexion->query($sql) or throw new Exception('error!');
			}

			$sql = "UPDATE tbl_descripcion SET str_estado='saved' WHERE iddetalleruta=$iddetalleruta AND str_estado='entregando'";
			$conexion->query($sql) or throw new Exception('error!');
			$sql = "UPDATE tbl_tarjetas SET str_estado='saved' WHERE iddetalleruta=$iddetalleruta AND str_estado='entregando'";
			$conexion->query($sql) or throw new Exception('error!');
			$sql = "UPDATE tbl_tarjetas SET str_estado='cancelado' WHERE dec_resta=0.00 AND idsucursal=$res->refSucursal";
			$conexion->query($sql) or throw new Exception('error!');
			$sql = "UPDATE tbl_contabilidad_detalle SET str_estado='saved' WHERE iddetalleruta=$iddetalleruta AND str_estado='entregando'";
			$conexion->query($sql) or throw new Exception('error!');
			$sql = "UPDATE tbl_detalle_ruta SET str_estado='saved' WHERE iddetalleruta=$iddetalleruta AND str_estado='entregando'";
			$conexion->query($sql) or throw new Exception('error!');
			$sql = "DELETE FROM tbl_contabilidad_detalle  WHERE iddetalleruta=$iddetalleruta AND dec_total=0.00";
			$conexion->query($sql) or throw new Exception('error!');




			$sql = "SELECT idcontabilidad_detalle FROM `tbl_contabilidad_detalle` WHERE iddetalleruta=$iddetalleruta ";
			$query = $conexion->query($sql);

			if (mysqli_num_rows($query) == 0) {
				$sql = "DELETE FROM tbl_empleados_cobrando WHERE id_detalle_ruta=$iddetalleruta";
				$conexion->query($sql) or throw new Exception('error!');

				$sql = "DELETE FROM tbl_detalle_ruta WHERE iddetalleruta=$iddetalleruta";
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
		$msg = $sw ? '¡Correcto!' : 'ERROR: Inesperado';
		echo $msg;
		return;
	}



	public function RegistrarContabilidadDetalle($iddetalleruta, $base, $efectivo, $efectivoMoneda, $diferencia, $created_empleado_id)
	{
		global $conexion;
		$sw = true;
		$conexion->autocommit(false);
		$fecha = date('Y-m-d H:i:s');

		try {

			$sql = "SELECT refDetalle_ruta, refGlobal, refSucursal, gastos, creditos,
			recaudo, efectivoOtraUtilidad, estado
			FROM view_contabilidad_detalle_ruta WHERE refDetalle_ruta=$iddetalleruta"; //, base, efectivo, efectivoMonedas, diferencia
			$querySelecAbono = $conexion->query($sql);
			$res = $querySelecAbono->fetch_object();
			$idsucursal = intval($res->refSucursal);

			$diferenciaVerificada =
				$res->creditos +
				($res->gastos * -1) +
				$efectivoMoneda +
				$efectivo -
				$base -
				$res->recaudo -
				$res->efectivoOtraUtilidad;


			$sql = "SELECT
				a.str_nombre
				 FROM  `tbl_auth_sucursal` au INNER JOIN 
						tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal INNER JOIN 
						tbl_auth a ON a.idauth=b.idauth 
				 where au.str_estado<>'inactivo' AND 
						 au.idempleado=$created_empleado_id AND 
						 au.idsucursal=$idsucursal AND 
						 a.str_nombre='bloquear'";
			$qry = $conexion->query($sql);
			$bloq = $qry->fetch_object();
			if (isset($_SESSION['userEmpresa']) || isset($bloq->str_nombre)) {

			} else {
				echo "ERROR: No estas authorizado para esta accion";
				return;
			}

			if (empty($res->refDetalle_ruta) || $res->estado != "created" || $diferenciaVerificada != $diferencia) {
				echo "ERROR: No registrado ";
				return;
			}

			// saber si hay guardado base
			$sql = "SELECT idcontabilidad_detalle FROM `tbl_contabilidad_detalle` WHERE iddetalleruta=$iddetalleruta AND str_nombre='base'";
			$querybase = $conexion->query($sql);
			$resbase = $querybase->fetch_object();

			// saber si hay guardado efectivo
			$sql = "SELECT idcontabilidad_detalle FROM `tbl_contabilidad_detalle` WHERE iddetalleruta=$iddetalleruta AND str_nombre='efectivo'";
			$queryefectivo = $conexion->query($sql);
			$resefectivo = $queryefectivo->fetch_object();

			// saber si hay guardado efectivoMnedas
			$sql = "SELECT idcontabilidad_detalle FROM `tbl_contabilidad_detalle` WHERE iddetalleruta=$iddetalleruta AND str_nombre='efectivoMonedas'";
			$queryefectivoMonedas = $conexion->query($sql);
			$resefectivoMonedas = $queryefectivoMonedas->fetch_object();

			// saber si hay guardado diferencia
			$sql = "SELECT idcontabilidad_detalle FROM `tbl_contabilidad_detalle` WHERE iddetalleruta=$iddetalleruta AND str_nombre='diferencia'";
			$querydiferencia = $conexion->query($sql);
			$resdiferencia = $querydiferencia->fetch_object();

			// la Base
			if (isset($resbase->idcontabilidad_detalle)) {
				$sql = "UPDATE tbl_contabilidad_detalle SET dec_total=$base, str_estado='entregando' 
				WHERE idcontabilidad_detalle='$resbase->idcontabilidad_detalle'";
				$conexion->query($sql) or throw new Exception('error!');
			} else if ($base > 0) {

				$idcontabilidad_detalle = uniqidReal();
				$sql = "INSERT INTO tbl_contabilidad_detalle (idcontabilidad_detalle,
				idglobal, idsucursal, idtipo_contabilidad, iddetalleruta,
				dec_total,
				str_detalle,
				str_nombre,
				str_estado,
				str_operacion,
				created_empleado_id,
				created_at,
				update_at
				)
				VALUES ('$idcontabilidad_detalle',$res->refGlobal, $idsucursal, 8, $iddetalleruta,
				$base, '', 'base', 'entregando', 
				'info-totalizar', $created_empleado_id, '$fecha','$fecha' )";
				$conexion->query($sql) or throw new Exception('error!');
			}
			// el efectivo
			if (isset($resefectivo->idcontabilidad_detalle)) {
				$sql = "UPDATE tbl_contabilidad_detalle SET dec_total=$efectivo, str_estado='entregando'
				 WHERE  idcontabilidad_detalle='$resefectivo->idcontabilidad_detalle'";
				$conexion->query($sql) or throw new Exception('error!');
			} else if ($efectivo > 0) {
				$idcontabilidad_detalle = uniqidReal();
				$sql = "INSERT INTO tbl_contabilidad_detalle (idcontabilidad_detalle,
				idglobal, idsucursal, idtipo_contabilidad, iddetalleruta,
				dec_total,
				str_detalle,
				str_nombre,
				str_estado,
				str_operacion,
				created_empleado_id,
				created_at,
				update_at
				)
				VALUES ('$idcontabilidad_detalle',$res->refGlobal, $idsucursal, 8, $iddetalleruta,
				$efectivo, '', 'efectivo', 'entregando', 
				'info-totalizar', $created_empleado_id, '$fecha','$fecha' )";
				$conexion->query($sql) or throw new Exception('error!');
			}
			// las monedas
			if (isset($resefectivoMonedas->idcontabilidad_detalle)) {
				$sql = "UPDATE tbl_contabilidad_detalle SET dec_total=$efectivoMoneda, str_estado='entregando' 
				WHERE  idcontabilidad_detalle='$resefectivoMonedas->idcontabilidad_detalle'";
				$conexion->query($sql) or throw new Exception('error!');
			} else if ($efectivoMoneda > 0) {
				$idcontabilidad_detalle = uniqidReal();
				$sql = "INSERT INTO tbl_contabilidad_detalle (idcontabilidad_detalle,
					idglobal, idsucursal, idtipo_contabilidad, iddetalleruta,
					dec_total,
					str_detalle,
					str_nombre,
					str_estado,
					str_operacion,
					created_empleado_id,
					created_at,
					update_at
					)
					VALUES ('$idcontabilidad_detalle',$res->refGlobal, $idsucursal, 8, $iddetalleruta,
					$efectivoMoneda, '', 'efectivoMonedas', 'entregando', 
					'info-totalizar', $created_empleado_id, '$fecha','$fecha' )";
				$conexion->query($sql) or throw new Exception('error!');
			}
			// la Diferencia
			if (isset($resdiferencia->idcontabilidad_detalle)) {
				$sql = "UPDATE tbl_contabilidad_detalle SET dec_total=$diferenciaVerificada, str_estado='entregando' 
				WHERE idcontabilidad_detalle='$resdiferencia->idcontabilidad_detalle'";
				$conexion->query($sql) or throw new Exception('error!');
			} else {
				if ($diferencia != 0) {
					$idcontabilidad_detalle = uniqidReal();
					$sql = "INSERT INTO tbl_contabilidad_detalle (idcontabilidad_detalle,
					idglobal, idsucursal, idtipo_contabilidad, iddetalleruta,
					dec_total,
					str_detalle,
					str_nombre,
					str_estado,
					str_operacion,
					created_empleado_id,
					created_at,
					update_at
					)
					VALUES ('$idcontabilidad_detalle',$res->refGlobal, $idsucursal, 7, $iddetalleruta,
					$diferenciaVerificada, '', 'diferencia', 'entregando', 
					'entrada-totalizar', $created_empleado_id, '$fecha','$fecha' )";
					$conexion->query($sql) or throw new Exception('error!');
				}

				if ($res->creditos > 0) {
					// ordenamos la rutas de decimal a enteros si es primer ves que guardamos lo totalizado  totalizamos 
					$sql = "SELECT refTarjeta FROM `view_ruta`  WHERE estado<>'cancelado' AND refSucursal=$idsucursal";
					$query = $conexion->query($sql);
					$i = 0;
					while ($res = $query->fetch_object()) {
						$i++;
						$sqlt = "UPDATE tbl_tarjetas SET float_item=$i WHERE idtarjeta='$res->refTarjeta'";
						$conexion->query($sqlt) or throw new Exception('error!');
					}
				}
			}

			$sql = "UPDATE tbl_descripcion SET str_estado='entregando' WHERE idsucursal=$idsucursal AND str_estado='created'";
			$conexion->query($sql) or throw new Exception('error!');

			$sql = "UPDATE tbl_tarjetas SET str_estado='entregando' WHERE idsucursal=$idsucursal AND str_estado='created'";
			$conexion->query($sql) or throw new Exception('error!');
			$sql = "UPDATE tbl_contabilidad_detalle SET str_estado='entregando' WHERE idsucursal=$idsucursal AND str_estado='created'";
			$conexion->query($sql) or throw new Exception('error!');
			$sql = "UPDATE tbl_detalle_ruta SET str_estado='entregando' WHERE idsucursal=$idsucursal AND str_estado='created'";
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
		$msg = $sw ? '¡Correcto!' : 'ERROR: Inesperado';
		echo $msg;
		return;
	}
	// gastos al totalizar ruta cartera
	public function RegistrarContabilidad(
		$idglobal,
		$idsucursal,
		$idtipo_contabilidad,
		$dec_total,
		$str_detalle,
		$str_nombre,
		$str_operacion,
		$created_empleado_id,
		$idnomina
	) {
		global $conexion;
		$sw = true;
		$conexion->autocommit(false);
		$fecha = date('Y-m-d H:i:s');
		try {


			if ($str_operacion == 'salida-contabilidad') {
				$sql = "SELECT
				a.str_nombre
				 FROM  `tbl_auth_sucursal` au INNER JOIN 
						tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal INNER JOIN 
						tbl_auth a ON a.idauth=b.idauth 
				 WHERE au.str_estado<>'inactivo' AND 
				 	au.idempleado=$created_empleado_id AND 
					au.idsucursal=$idsucursal AND 
					a.str_nombre='crear otros gastos'
					 GROUP BY au.idsucursal";
				$query = $conexion->query($sql);
				$res = $query->fetch_object();
				if (isset($_SESSION['userEmpresa']) || isset($res->str_nombre)) {

				} else {
					echo "ERROR: No estas authorizado para esta accion ot";
					return;
				}
			}
			if ($str_operacion == 'salida') {
				$sql = "SELECT
				a.str_nombre
				 FROM  `tbl_auth_sucursal` au INNER JOIN 
						tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal INNER JOIN 
						tbl_auth a ON a.idauth=b.idauth 
				 WHERE au.str_estado<>'inactivo' AND 
				 	au.idempleado=$created_empleado_id AND 
					au.idsucursal=$idsucursal AND 
					a.str_nombre='crear salida'
					 GROUP BY au.idsucursal";
				$query = $conexion->query($sql);
				$res = $query->fetch_object();
				if (isset($_SESSION['userEmpresa']) || isset($res->str_nombre)) {

				} else {
					echo "ERROR: No estas authorizado para esta accions";
					return;
				}
			}
			if ($str_operacion == 'entrada-contabilidad') {
				$sql = "SELECT
				a.str_nombre
				 FROM  `tbl_auth_sucursal` au INNER JOIN 
						tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal INNER JOIN 
						tbl_auth a ON a.idauth=b.idauth 
				 WHERE au.str_estado<>'inactivo' AND 
				 	au.idempleado=$created_empleado_id AND 
					au.idsucursal=$idsucursal AND 
					a.str_nombre='crear entrada'
					 GROUP BY au.idsucursal";
				$query = $conexion->query($sql);
				$res = $query->fetch_object();
				if (isset($_SESSION['userEmpresa']) || isset($res->str_nombre)) {

				} else {
					echo "ERROR: No estas authorizado para esta accion";
					return;
				}
			}



			$sql = "SELECT iddetalleruta FROM tbl_detalle_ruta WHERE idsucursal=$idsucursal AND str_estado='created' ORDER BY created_at DESC LIMIT 1";
			$querySelecAbono = $conexion->query($sql);
			$res = $querySelecAbono->fetch_object();
			$iddetalleruta = $res->iddetalleruta;
			if (empty($iddetalleruta)) {
				echo "ERROR: Falta Despachar";
				return;
			}

			$str_operacion = $str_operacion == 'salida' ? 'salida-contabilidad' : $str_operacion;
			if ($str_operacion == 'salida-totalizar' || $str_operacion == 'salida-contabilidad') {
					$dec_total = $dec_total * -1;
			}





			$idcontabilidad_detalle = uniqidReal();

			$sql = "INSERT INTO tbl_contabilidad_detalle (
					idcontabilidad_detalle,
					idglobal, idsucursal, idtipo_contabilidad, iddetalleruta,
					dec_total,
					str_detalle,
					str_nombre,
					str_estado,
					str_operacion,
					created_empleado_id,
					created_at,
					update_at
					)
					VALUES ('$idcontabilidad_detalle',$idglobal, $idsucursal, $idtipo_contabilidad, $iddetalleruta,
					$dec_total, '$str_detalle', '$str_nombre', 'created', 
					'$str_operacion', $created_empleado_id, '$fecha','$fecha' )";
			$conexion->query($sql) or throw new Exception('error!');
			//$idcontabilidad_detalle= $conexion->insert_id;
			if (!empty($idnomina)) {
				$sql = "INSERT INTO tbl_detalle_nomina (
					idglobal,
					idnomina,
					idcontabilidad_detalle,
					str_tipo,
					str_estado
					)
					VALUES ($idglobal,$idnomina,'$idcontabilidad_detalle','$str_nombre','entregando' )";
				$conexion->query($sql) or throw new Exception("error!");
			}
		} catch (Exception $e) {

			$sw = false;
			$conexion->rollback();
		}
		$conexion->commit();
		if ($conexion != null) {
			$conexion->close();
		}
		$msg = $sw ? '¡Correcto!' : 'ERROR: Inesperado';
		echo $msg;
		return;
	}



	public function ListContabilidadRecibir($idglobal, $superadmin, $userEmpleadoId)
	{
		global $conexion;
		$idsucursals = array();
		$query = null;
		if (empty($superadmin)) {
			$sql = "SELECT refSucursal FROM view_auth_sucursal WHERE refEmpleado=$userEmpleadoId  AND nameAccion='ver recibir' AND estadoAuthSucursal='activo'";
			$query = $conexion->query($sql);
		} else {
			$sql = "SELECT idsucursal AS refSucursal FROM tbl_sucursal WHERE idglobal=$idglobal";
			$query = $conexion->query($sql);
		}
		while ($req = $query->fetch_object()) {
			array_push($idsucursals, $req->refSucursal);
		}

		$sql = "SELECT 
		refDetalle_ruta,
		refSucursal,
		logo,
		codigo,
		tipo,
		recaudo,
		cantidadTotalRecaudos,
		prestamo,
		articulo,
		creditos,
		descuento,
		gastos,
		descripcion_gastos,
		otros_gastos,
		descripcion_otros_gastos,
		base,
		efectivo,
		efectivoMonedas,
		efectivoOtraUtilidad,
		diferencia,
		estado,
		salida,
		descripcion_salida,
		entrada,
		descripcion_entrada,
		(SELECT
			a.str_nombre
			 FROM  `tbl_auth_sucursal` au INNER JOIN 
					tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal INNER JOIN 
					tbl_auth a ON a.idauth=b.idauth 
			 where au.str_estado<>'inactivo' AND 
					 au.idempleado=$userEmpleadoId AND 
					 au.idsucursal=refSucursal AND 
					 a.str_nombre='ver cuentas detalladas') AS verCuentasDetalladas
		 FROM view_contabilidad_detalle_ruta 
		 WHERE refSucursal IN (" . implode(",", $idsucursals) . ") AND  estado<>'saved' AND refGlobal=$idglobal";
		$query = $conexion->query($sql);
		return $query;
	}
	public function manejarDesbEditarDetalleRuta($iddetalleruta, $createdEmpleadoId)
	{
		global $conexion;
		$sw = true;
		$conexion->autocommit(false);
		try {
			$sql = "SELECT idsucursal FROM tbl_detalle_ruta WHERE iddetalleruta=$iddetalleruta";
			$qry = $conexion->query($sql);
			$idsucursal = $qry->fetch_object()->idsucursal;

			$sql = "SELECT
			a.str_nombre
			 FROM  `tbl_auth_sucursal` au INNER JOIN 
					tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal INNER JOIN 
					tbl_auth a ON a.idauth=b.idauth 
			 where au.str_estado<>'inactivo' AND 
					 au.idempleado=$createdEmpleadoId AND 
					 au.idsucursal=$idsucursal AND 
					 a.str_nombre='desbloquear'";
			$qry = $conexion->query($sql);
			$bloq = $qry->fetch_object();
			if (isset($_SESSION['userEmpresa']) || isset($bloq->str_nombre)) {

			} else {
				echo "ERROR: No estas authorizado para esta accion";
				return;
			}






			$sql = "UPDATE tbl_descripcion SET str_estado='created' WHERE iddetalleruta=$iddetalleruta AND str_estado='entregando'";
			$conexion->query($sql) or throw new Exception('error!');
			$sql = "UPDATE tbl_tarjetas SET str_estado='created' WHERE iddetalleruta=$iddetalleruta AND str_estado='entregando'";
			$conexion->query($sql) or throw new Exception('error!');
			$sql = "UPDATE tbl_contabilidad_detalle SET str_estado='created' WHERE iddetalleruta=$iddetalleruta AND str_estado='entregando'";
			$conexion->query($sql) or throw new Exception('error!');
			$sql = "UPDATE tbl_detalle_ruta SET str_estado='created' WHERE iddetalleruta=$iddetalleruta AND str_estado='entregando'";
			$conexion->query($sql) or throw new Exception('error!');


		} catch (Exception $e) {

			$sw = false;
			$conexion->rollback();
		}
		$conexion->commit();
		if ($conexion != null) {
			$conexion->close();
		}
		$msg = $sw ? '¡Correcto!' : 'ERROR: Inesperado';
		echo $msg;
		return;
	}

	public function listTipoContabilidadS($idglobal, $operacion)
	{
		global $conexion;
		switch ($operacion) {
			case 'salida-totalizar':
				$sql = "SELECT
				idtipo_contabilidad AS refTopoContabilidad,
				str_categoria AS categoria
				 FROM tbl_tipo_contabilidad 
				 WHERE idglobal=1001 AND 
							str_operacion='salida' AND 
							str_categoria<>'contabilidad' AND 
							str_categoria<>'salida' 
							
							OR

							idglobal=$idglobal  AND  
							str_operacion='salida' AND
							str_categoria<>'contabilidad'AND 
							str_categoria<>'salida' 
							
							
							";
				$query = $conexion->query($sql);
				return $query;
			case 'salida-contabilidad':
				$sql = "SELECT
				idtipo_contabilidad AS refTopoContabilidad,
				str_categoria AS categoria
				 FROM tbl_tipo_contabilidad WHERE idglobal=1001 AND  str_operacion='salida' AND str_categoria<>'salida'  OR
							 idglobal=$idglobal  AND  str_operacion='salida'";
				$query = $conexion->query($sql);
				return $query;

			case 'entrada-contabilidad':
				$sql = "SELECT
        idtipo_contabilidad AS refTopoContabilidad,
        str_categoria AS categoria
         FROM tbl_tipo_contabilidad WHERE idglobal=1001 AND  str_categoria='entrada' OR
                     idglobal=$idglobal  AND  str_categoria='entrada'";
				$query = $conexion->query($sql);
				return $query;
			case 'salida':
				$sql = "SELECT
					idtipo_contabilidad AS refTopoContabilidad,
					str_categoria AS categoria
					 FROM tbl_tipo_contabilidad WHERE 
					 idglobal=1001 AND  str_operacion='salida' 
					 AND str_categoria='salida' ";
				$query = $conexion->query($sql);
				return $query;
		}
	}

	public function listNomina($idglobal, $superadmin, $refSucursal)
	{
		global $conexion;
		$sql = '';


		if (isset($superadmin)) {
			$sql = "SELECT
	n.idnomina AS refNomina,
	CONCAT( p.str_nombres, ' ', p.str_apellidos ) AS nombre 
FROM
	`tbl_nomina` n
	INNER JOIN `tbl_empleado` e ON e.idempleado = n.idempleado
	INNER JOIN `tbl_persona` p ON p.idpersona = e.idpersona 
WHERE
	n.idglobal = $idglobal
	AND n.str_estado = 'activo' ORDER BY p.str_nombres";
		} else {
			$sql = "SELECT 
	n.idnomina AS refNomina,
	CONCAT( p.str_nombres, ' ', p.str_apellidos ) AS nombre 
	FROM tbl_detalle_ruta dr INNER JOIN
	tbl_empleados_cobrando ec ON ec.id_detalle_ruta=dr.iddetalleruta INNER JOIN
	tbl_empleado e ON e.idempleado=ec.idempleado INNER JOIN
	tbl_persona p ON p.idpersona=e.idpersona INNER JOIN
  	tbl_nomina n ON n.idempleado=e.idempleado
	WHERE dr.idsucursal=$refSucursal AND dr.str_estado='created' AND n.str_estado='activo' ";
		}

		$query = $conexion->query($sql);
		return $query;
	}


	public function noIncludeContabilidad($iddetalleruta)
	{
		global $conexion;
		$sw = true;
		$conexion->autocommit(false);
		try {
			$sql = "SELECT idsucursal FROM tbl_detalle_ruta WHERE iddetalleruta=$iddetalleruta";
			$query = $conexion->query($sql);
			$reg = $query->fetch_object();

			$sql = "UPDATE tbl_descripcion SET str_estado='saved' WHERE iddetalleruta=$iddetalleruta ";
			$conexion->query($sql) or throw new Exception('error!');
			$sql = "UPDATE tbl_tarjetas SET str_estado='saved' WHERE iddetalleruta=$iddetalleruta ";
			$conexion->query($sql) or throw new Exception('error!');
			$sql = "UPDATE tbl_tarjetas SET str_estado='cancelado' WHERE dec_resta=0.00 AND idsucursal=$reg->idsucursal";
			$conexion->query($sql) or throw new Exception('error!');
			$sql = "UPDATE tbl_contabilidad_detalle SET str_estado='saved' WHERE iddetalleruta=$iddetalleruta ";
			$conexion->query($sql) or throw new Exception('error!');
			$sql = "UPDATE tbl_detalle_ruta SET str_estado='saved' WHERE iddetalleruta=$iddetalleruta ";
			$conexion->query($sql) or throw new Exception('error!');
			$sql = "DELETE FROM tbl_contabilidad_detalle  WHERE iddetalleruta=$iddetalleruta AND dec_total=0.00";
			$conexion->query($sql) or throw new Exception('error!');


		} catch (Exception $e) {
			$sw = false;
			$conexion->rollback();
		}
		$conexion->commit();
		if ($conexion != null) {
			$conexion->close();
		}
		$msg = $sw ? '¡Correcto!' : 'ERROR: Inesperado';
		echo $msg;
		return;
	}


	public function listDeContabilidad($idglobal, $idtipo_contabilidad)
	{
		global $conexion;
		$sql = "SELECT * FROM `tbl_de_contabilidad` WHERE 
		idglobal=1001 AND idtipo_contabilidad=$idtipo_contabilidad

		OR 
		idglobal=$idglobal AND idtipo_contabilidad=$idtipo_contabilidad";
		$query = $conexion->query($sql);
		return $query;
	}


}
