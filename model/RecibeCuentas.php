<?php
require "Conexion.php";
require_once "AutorizarDespachoCartera.php";
require_once __DIR__ . "/Cartera.php";

class RecibeCuentas
{

   public function __construct() {}
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

         if (isset($_SESSION['userEmpresa']) || administraOficinaCartera($conexion, $_SESSION, (int)$idsucursal) || isset($bloq->str_nombre)) {
         } else {
            echo "ERROR: No estas authorizado para esta accion";
            return;
         }




         $sql = "SELECT refDetalle_ruta, refGlobal, refSucursal, valorTotalCreditos, cantidadTotalRecaudos, masUtilidad, descuento, recaudo, prestamo, articulo, efectivoOtraUtilidad, estado FROM view_contabilidad_detalle_ruta WHERE refDetalle_ruta=$iddetalleruta AND estado='entregando'";
         $querySelecAbono = $conexion->query($sql);
         $res = $querySelecAbono->fetch_object();
         if (!$res) {
            throw new Exception('Ruta no disponible para guardar');
         }
         $caja = (new ClassCartera())->cajaBolsilloRuta((int)$res->refGlobal, (int)$res->refSucursal, 0, (int)$iddetalleruta);
         if (!$caja['totales']) {
            throw new Exception('No se pudo calcular la caja de la ruta');
         }
         $prestamoEfectivo = round((float)$res->prestamo - $caja['totales']['prestamoBanco'], 2);
         $articuloEfectivo = round((float)$res->articulo - $caja['totales']['articuloBanco'], 2);
         $recaudoEfectivo = round((float)$res->recaudo - $caja['totales']['recaudoBanco'], 2);
         foreach ([
            'recaudo-banco' => $caja['totales']['recaudoBanco'],
            'prestamos-banco' => $caja['totales']['prestamoBanco'],
            'articulos-banco' => $caja['totales']['articuloBanco']
         ] as $nombre => $importe) {
            if ($importe == 0) {
               continue;
            }
            $idcontabilidad_detalle = uniqidReal();
            $sql = "INSERT INTO tbl_contabilidad_detalle (
               idcontabilidad_detalle, idglobal, idsucursal, idtipo_contabilidad, iddetalleruta,
               dec_total, str_detalle, str_nombre, str_estado, str_operacion,
               created_empleado_id, created_at, update_at
            ) VALUES (
               '$idcontabilidad_detalle', $res->refGlobal, $res->refSucursal, 8, $iddetalleruta,
               $importe, 'no totaliza', '$nombre', 'saved', 'info-totalizar',
               $created_empleado_id, '$fecha', '$fecha'
            )";
            $conexion->query($sql) or throw new Exception('error!');
         }



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

         if ($prestamoEfectivo != 0) {
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
					$prestamoEfectivo*-1, '', 'prestamos', 'saved',
					'salida-totalizar', $created_empleado_id, '$fecha','$fecha' )";
            $conexion->query($sql) or throw new Exception('error!');
         }
         if ($articuloEfectivo != 0) {
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
					$articuloEfectivo*-1, '', 'articulos', 'saved',
					'salida-totalizar', $created_empleado_id, '$fecha','$fecha' )";
            $conexion->query($sql) or throw new Exception('error!');
         }
         if ($recaudoEfectivo != 0) {
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
					$recaudoEfectivo, '', 'recaudo', 'saved',
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



   public function RegistrarContabilidadDetalle($iddetalleruta, $efectivo, $efectivoMoneda, $diferencia, $created_empleado_id)
   {
      global $conexion;
      $sw = true;
      $conexion->autocommit(false);
      $fecha = date('Y-m-d H:i:s');

      try {

         $sql = "SELECT refDetalle_ruta, refGlobal, refSucursal, gastos, creditos,
			recaudo, efectivoOtraUtilidad, base, estado
			FROM view_contabilidad_detalle_ruta WHERE refDetalle_ruta=$iddetalleruta"; //, efectivo, efectivoMonedas, diferencia
         $querySelecAbono = $conexion->query($sql);
         $res = $querySelecAbono->fetch_object();
         if (!$res || $res->estado !== 'created') {
            $conexion->rollback();
            $conexion->autocommit(true);
            echo "ERROR: No hay una ruta abierta para entregar";
            return;
         }
         $idsucursal = intval($res->refSucursal);

         $caja = (new ClassCartera())->cajaBolsilloRuta(
            (int)$res->refGlobal, $idsucursal, (int)($_SESSION['idusuario'] ?? 0)
         );
         if ($caja['ruta'] !== (int)$iddetalleruta || $caja['totales'] === null) {
            $conexion->rollback();
            $conexion->autocommit(true);
            echo "ERROR: La ruta cambió; vuelve a totalizar";
            return;
         }
         $diferenciaVerificada = round($efectivoMoneda + $efectivo - $caja['totales']['efectivo'], 2);


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
         if (isset($_SESSION['userEmpresa']) || administraOficinaCartera($conexion, $_SESSION, (int)$idsucursal) || isset($bloq->str_nombre)) {
         } else {
            echo "ERROR: No estas authorizado para esta accion";
            return;
         }

         if (round($diferenciaVerificada * 100) !== round($diferencia * 100)) {
            $conexion->rollback();
            $conexion->autocommit(true);
            echo "ERROR: No registrado ";
            return;
         }

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
   /**
    * Anota o corrige una base de la ruta abierta de la sucursal. La base ya no se escribe al
    * cerrar las cuentas: se anota durante el día, una o varias veces, igual que en la APK
    * (CREATE_BASE / UPDATE_BASE). El valor siempre se guarda positivo y la fila solo se puede
    * tocar mientras la ruta y la fila sigan en 'created'.
    */
   public function RegistrarBase(
      $idglobal,
      $idsucursal,
      $idcontabilidad_detalle,
      $dec_total,
      $str_detalle,
      $created_empleado_id
   ) {
      global $conexion;
      $idglobal = intval($idglobal);
      $idsucursal = intval($idsucursal);
      $created_empleado_id = intval($created_empleado_id);
      $dec_total = abs(floatval($dec_total));
      $fecha = date('Y-m-d H:i:s');

      if ($dec_total <= 0) {
         echo 'ERROR: El valor de la base tiene que ser mayor que cero';
         return;
      }

      $consulta = db_prepare_execute(
         $conexion,
         "SELECT iddetalleruta FROM tbl_detalle_ruta
           WHERE idsucursal=? AND idglobal=? AND str_estado='created'
           ORDER BY created_at DESC LIMIT 1",
         'ii',
         [$idsucursal, $idglobal]
      );
      $ruta = $consulta->get_result()->fetch_object();
      $consulta->close();
      if (!isset($ruta->iddetalleruta)) {
         echo 'ERROR: Falta Despachar';
         return;
      }

      if ($idcontabilidad_detalle === '') {
         $consulta = db_prepare_execute(
            $conexion,
            "INSERT INTO tbl_contabilidad_detalle (idcontabilidad_detalle,idglobal,idsucursal,
               idtipo_contabilidad,iddetalleruta,dec_total,str_detalle,str_nombre,str_estado,
               str_operacion,created_empleado_id,created_at,update_at)
             VALUES (?,?,?,8,?,?,?,'base','created','info-totalizar',?,?,?)",
            'siiidsiss',
            [uniqidReal(), $idglobal, $idsucursal, intval($ruta->iddetalleruta), $dec_total,
               $str_detalle, $created_empleado_id, $fecha, $fecha]
         );
         $consulta->close();
         echo '¡Correcto!';
         return;
      }

      $consulta = db_prepare_execute(
         $conexion,
         "UPDATE tbl_contabilidad_detalle SET dec_total=?, str_detalle=?, update_at=?
           WHERE idcontabilidad_detalle=? AND idglobal=? AND iddetalleruta=?
             AND str_nombre='base' AND str_estado='created'",
         'dsssii',
         [$dec_total, $str_detalle, $fecha, $idcontabilidad_detalle, $idglobal,
            intval($ruta->iddetalleruta)]
      );
      $cambiadas = $consulta->affected_rows;
      $consulta->close();
      if ($cambiadas < 1) {
         echo 'ERROR: Esa base ya no se puede corregir';
         return;
      }
      echo '¡Correcto!';
      return;
   }

   /** Borra una base mientras la ruta siga abierta; después queda como historia del día. */
   public function EliminarBase($idglobal, $idcontabilidad_detalle)
   {
      global $conexion;
      $consulta = db_prepare_execute(
         $conexion,
         "DELETE FROM tbl_contabilidad_detalle
           WHERE idcontabilidad_detalle=? AND idglobal=? AND str_nombre='base'
             AND str_estado='created'",
         'si',
         [$idcontabilidad_detalle, intval($idglobal)]
      );
      $borradas = $consulta->affected_rows;
      $consulta->close();
      echo $borradas > 0 ? ' ¡Eliminado Correctamente!' : 'ERROR: Esa base ya no se puede borrar';
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
            if (isset($_SESSION['userEmpresa']) || administraOficinaCartera($conexion, $_SESSION, (int)$idsucursal) || isset($res->str_nombre)) {
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
            if (isset($_SESSION['userEmpresa']) || administraOficinaCartera($conexion, $_SESSION, (int)$idsucursal) || isset($res->str_nombre)) {
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
            if (isset($_SESSION['userEmpresa']) || administraOficinaCartera($conexion, $_SESSION, (int)$idsucursal) || isset($res->str_nombre)) {
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
      $idglobal = intval($idglobal);
      $userEmpleadoId = intval($userEmpleadoId);
      // Solo se listan las carteras de la oficina elegida en la sesión, igual que en despachar.
      $idoficina = intval($_SESSION['idoficina'] ?? 0);
      $filtroOficina = $idoficina > 0 ? " AND s.idoficina=$idoficina" : '';
      $idsucursals = array();
      $query = null;
      if (empty($superadmin)) {
         $sql = "SELECT v.refSucursal FROM view_auth_sucursal v
            INNER JOIN tbl_sucursal s ON s.idsucursal=v.refSucursal AND s.idglobal=$idglobal
            WHERE v.refEmpleado=$userEmpleadoId AND v.nameAccion='ver recibir' AND v.estadoAuthSucursal='activo'$filtroOficina
            UNION SELECT s.idsucursal AS refSucursal FROM tbl_sucursal s
            INNER JOIN tbl_oficina o ON o.idoficina=s.idoficina AND o.idglobal=s.idglobal
            WHERE s.idglobal=$idglobal AND o.idempleado_administrador=$userEmpleadoId$filtroOficina";
         $query = $conexion->query($sql);
      } else {
         $sql = "SELECT s.idsucursal AS refSucursal FROM tbl_sucursal s WHERE s.idglobal=$idglobal$filtroOficina";
         $query = $conexion->query($sql);
      }
      while ($req = $query->fetch_object()) {
         array_push($idsucursals, $req->refSucursal);
      }
      if (!$idsucursals) {
         return $conexion->query("SELECT * FROM view_contabilidad_detalle_ruta WHERE 1=0");
      }

      $sql = "SELECT 
		refDetalle_ruta,
		refSucursal,
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
		CASE WHEN EXISTS (SELECT 1 FROM tbl_sucursal s
                 INNER JOIN tbl_oficina o ON o.idoficina=s.idoficina AND o.idglobal=s.idglobal
                 WHERE s.idsucursal=refSucursal AND s.idglobal=$idglobal AND o.idempleado_administrador=$userEmpleadoId)
            THEN 'ver cuentas detalladas' ELSE (SELECT
			a.str_nombre
			 FROM  `tbl_auth_sucursal` au INNER JOIN 
					tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal INNER JOIN 
					tbl_auth a ON a.idauth=b.idauth 
			 where au.str_estado<>'inactivo' AND 
					 au.idempleado=$userEmpleadoId AND 
					 au.idsucursal=refSucursal AND 
					 a.str_nombre='ver cuentas detalladas') END AS verCuentasDetalladas
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
         if (isset($_SESSION['userEmpresa']) || administraOficinaCartera($conexion, $_SESSION, (int)$idsucursal) || isset($bloq->str_nombre)) {
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
