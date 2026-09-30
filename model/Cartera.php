<?php
require "Conexion.php";
require_once "AutorizarDespachoCartera.php";

class ClassCartera
{


    public function __construct()
    {
    }

    public function Registrar(
        $idtarjeta,
        $idglobal,
        $idsucursal,
        $idcliente,
        $idventa,
        $consepto,
        $valor,
        $modo,
        $plazo,
        $prestamo,
        $descripcion,
        $cutaInicial,
        $item,
        $utilidad,
        $c_adicional_numero,
        $c_adicional_valor,
        $str_tipo_comprobante,
        $str_serie,
        $str_numero,
        $str_nota,
        $createdEmpleadoId,
        $obligacion,
        $iddetalle_documento_socursal,
        int $idusuario,
        array $pagosBanco = array()

    ) {
        global $conexion;
        $sw = true;
        $conexion->autocommit(false);
        $dt = date('Y-m-d H:i:s');
        $deudatotal = 0;
        $realnumero = $obligacion ? $obligacion : $str_numero;
        $errorMensaje = '';

        try {
            $sql = "SELECT 
            dec_max_credito AS max_credito,
            str_estado AS estadoCliente, 
            (select iddetalleruta from tbl_detalle_ruta where idsucursal=$idsucursal and str_estado='created' order by created_at desc limit 1) as iddetalleruta,
            (SELECT IFNULL(SUM(dec_resta),0) FROM tbl_tarjetas WHERE idcliente=tbl_clientes.idcliente) AS total_deuda_actual
                FROM tbl_clientes WHERE idcliente=$idcliente";
            $cliente = $conexion->query($sql);
            $res = $cliente->fetch_object();

            $iddetalleruta = $res->iddetalleruta;
            if (empty($iddetalleruta)) {
                echo "ERROR: Falta Despachar";
                return;
            }
            if ($res->estadoCliente == 'inactivo') {
                if ($prestamo > $res->max_credito) {
                    echo "ERROR: Cliente no disponible esta bloqueado intente editar cliente i intente de nuevo";
                    return;
                }
            }

            $sql = "SELECT
			a.str_nombre
			 FROM  `tbl_auth_sucursal` au INNER JOIN 
					tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal INNER JOIN 
					tbl_auth a ON a.idauth=b.idauth 
			 where au.str_estado<>'inactivo' AND 
					 au.idempleado=$createdEmpleadoId AND 
					 au.idsucursal=$idsucursal AND 
					 a.str_nombre='editar cliente' OR 
                     au.str_estado<>'inactivo' AND 
					 au.idempleado=$createdEmpleadoId AND 
					 au.idsucursal=$idsucursal AND 
					 a.str_nombre='editar maximo del credito'  LIMIT 1";
            $qry = $conexion->query($sql);
            $bloq = $qry->fetch_object();


            if (isset($_SESSION['userEmpresa']) || administraOficinaCartera($conexion, $_SESSION, (int)$idsucursal) || isset($bloq->str_nombre)) {
                if ($prestamo > $res->max_credito - $res->total_deuda_actual) {
                    $nuevoCupo = (float)$prestamo + (float)$res->total_deuda_actual;
                    $errorCupo = errorCupoAprobadoCartera(
                        $conexion, $_SESSION, $nuevoCupo, (int)$createdEmpleadoId, (int)$idglobal
                    );
                    if ($errorCupo !== null) {
                        echo $errorCupo;
                        return false;
                    }
                    db_execute(
                        $conexion,
                        "UPDATE tbl_clientes SET dec_max_credito=?,update_at=NOW() WHERE idcliente=? AND idglobal=?",
                        "dii",
                        [$nuevoCupo, (int)$idcliente, (int)$idglobal]
                    );
                }
            } else {
                if ($prestamo > $res->max_credito - $res->total_deuda_actual) {
                    echo "ERROR: Excede el monto maximo del credito acignado";
                    return;
                }
            }

            $os = array("Diario", "Semanal", "Quincenal", "Mensual");
            if (!in_array($modo, $os)) {
                echo "ERROR: Revisar el Formulario del credito!";
                return;
            }

            $sql = "INSERT INTO `tbl_tarjetas`(	
                idtarjeta,
                idglobal, idsucursal, idcliente, idventa, iddetalleruta,
                str_concepto, dec_valor, str_modo, int_tiempo,
                 dec_prestamo, dec_resta,str_descripcion, float_item,
                dec_utilidad, str_c_adicional_numero, dec_c_adicional_valor,
                str_tipo_comprobante, str_serie, str_numero,
                str_nota, str_abono, str_style, str_estado, created_empleado_id,
                created_at, updated_at
                )
                 VALUES (
                    '$idtarjeta',
                    $idglobal,$idsucursal, $idcliente, $idventa, $iddetalleruta,
                    '$consepto', $valor, '$modo', $plazo, 
                     $prestamo, $valor, '$descripcion', $item, 
                    $utilidad, '$c_adicional_numero', $c_adicional_valor,
                    '$str_tipo_comprobante','$str_serie', '$realnumero',
                    '$str_nota', '', '', 'created', $createdEmpleadoId,'$dt','$dt'
                        )";

            $conexion->query($sql) or throw new Exception('error!');
            $this->guardarPagosBanco('tbl_tarjeta_pago', 'idtarjeta', $idtarjeta, $idglobal, $idsucursal, $idusuario, $pagosBanco, $prestamo);

            if ($cutaInicial > 0) {
                $iddescripcion = uniqidReal();
                $sql = "INSERT INTO tbl_descripcion(
                iddescripcion,
                idglobal,
                idsucursal,
                idtarjeta,
                iddetalleruta,
                dec_abono,
                str_descripcion,
                str_estado,
                idusuario,
                str_origen,
                created_at,
                updated_at

            )
				VALUES ('$iddescripcion',$idglobal, $idsucursal, '$idtarjeta', $iddetalleruta, $cutaInicial*-1, 'Inicial', 'created', $idusuario, 'web','$dt','$dt')";
                $conexion->query($sql) or throw new Exception('error!');
                $resta = $valor - $cutaInicial;
                $sql = "UPDATE tbl_tarjetas SET dec_resta=$resta WHERE idtarjeta='$idtarjeta'";
                $conexion->query($sql) or throw new Exception("error!");

            }
            $sql_detalle_doc = "UPDATE tbl_detalle_documento_sucursal set str_ultimo_numero = '$str_numero' where iddetalle_documento_sucursal = $iddetalle_documento_socursal";
            $conexion->query($sql_detalle_doc) or throw new Exception('error!');
        } catch (Exception $e) {
            $sw = false;
            $errorMensaje = $e->getMessage();
            $conexion->rollback();
        }
        $conexion->commit();
        if ($conexion != null) {

            $conexion->close();
        }
        $mensaje = $sw ? "Tarjeta Registrada" : ($errorMensaje && strpos($errorMensaje, 'ERROR:') === 0 ? $errorMensaje : "ERROR: Tarjeta no registrada");
        echo $mensaje;
        return $sw;
    }

    public function Modificar(
        $idtarjeta,
        $idglobal,
        $idsucursal,
        $idcliente,
        $idventa,
        $consepto,
        $valor,
        $modo,
        $plazo,
        $prestamo,
        $descripcion,
        $item,
        $utilidad,
        $c_adicional_numero,
        $c_adicional_valor,
        $str_tipo_comprobante,
        $str_serie,
        $str_numero,
        $str_nota,
        $createdEmpleadoId
    ) {
        global $conexion;
        $sw = true;
        $conexion->autocommit(false);
        $dt = date('Y-m-d H:i:s');
        try {


            $sql = "UPDATE `tbl_tarjetas` SET
                                str_concepto='$consepto',
                                dec_valor= $valor,
                                str_modo='$modo',
                                int_tiempo=$plazo,
                                dec_prestamo= $prestamo,
                                str_descripcion='$descripcion',
                                float_item= $item,
                                dec_utilidad=$utilidad,
                                str_c_adicional_numero='$c_adicional_numero',
                                dec_c_adicional_valor=$c_adicional_valor,
                                str_tipo_comprobante='$str_tipo_comprobante',
                                str_serie='$str_serie',
                                str_numero='$str_numero',
                                str_nota='$str_nota',
                                updated_at='$dt'
                        WHERE idtarjeta=$idtarjeta";
            $conexion->query($sql) or throw new Exception('error!');
        } catch (Exception $e) {

            $sw = false;
            $conexion->rollback();
        }
        $conexion->commit();
        if ($conexion != null) {

            $conexion->close();
        }
        return $sw;
    }

    public function ModificarCredito(
        $idtarjeta,
        $created_at,
        $numero,
        $modo,
        $plazo
    ) {
        global $conexion;
        $sw = true;
        $conexion->autocommit(false);
        $dt = date('Y-m-d H:i:s');
        try {
            $os = array("Diario", "Semanal", "Quincenal", "Mensual");
            if (!in_array($modo, $os)) {
                echo "ERROR: Revisar el Formulario del crédito!";
                return;
            }
            $sql = "UPDATE `tbl_tarjetas` SET
                    str_modo='$modo',
                    int_tiempo=$plazo,
                    str_numero='$numero',
                    created_at='$created_at',
                    updated_at='$dt'
            WHERE idtarjeta='$idtarjeta'";
            $conexion->query($sql) or throw new Exception('error!');
        } catch (Exception $e) {

            $sw = false;
            $conexion->rollback();
        }
        $conexion->commit();
        if ($conexion != null) {

            $conexion->close();
        }
        $mensaje = $sw ? " ¡Modificado Correctamente!" : "¡ERROR: Inesperado!";
        echo $mensaje;
        return $sw;
    }

    public function saveCuota($iddescripcion, $idglobal, $idsucursal, $idtarjeta, $abono, $resta, int $idusuario, array $pagosBanco = array(), $vueltoBanco = 0)
    {
        global $conexion;
        $conexion->autocommit(false);
        $fecha = date('Y-m-d H:i:s');
        $sw = true;
        $accion = 'Abono';
        $errorMensaje = '';
        try {
            $sqlSelectAbono = "SELECT iddescripcion FROM tbl_descripcion 
            WHERE 
            idtarjeta='$idtarjeta' AND str_estado<>'saved' AND str_descripcion LIKE 'Abono%' OR
            idtarjeta='$idtarjeta' AND str_estado<>'saved' AND str_descripcion LIKE 'Cancelado%' OR
            idtarjeta='$idtarjeta' AND str_estado<>'saved' AND str_descripcion LIKE 'Inicial%'";
            $querySelecAbono = $conexion->query($sqlSelectAbono);



            $res = $querySelecAbono->fetch_object();
            // empty($res->iddescripcion) or throw new Exception('error!');
            if (isset($res->iddescripcion)) {
                echo "ERROR: No puede duplicar la Cuota";
                return;
            }


            $sqlSelectAbono = "SELECT t.dec_resta, dr.iddetalleruta, t.idsucursal
            FROM tbl_tarjetas t INNER JOIN
             tbl_detalle_ruta dr ON dr.idsucursal=t.idsucursal 
             WHERE dr.str_estado='created' AND t.idtarjeta='$idtarjeta'";



            $querySelecAbono = $conexion->query($sqlSelectAbono);
            $res = $querySelecAbono->fetch_object();

            if ($idsucursal!=$res->idsucursal) {
                echo "ERROR: Intente Mas tarde ";
                return;
            }




            $iddetalleruta = $res->iddetalleruta;
            if (empty($iddetalleruta)) {

                echo "ERROR: Falta Despachar ";
                return;
            }

            if ($res->dec_resta + $abono != $resta) {

                echo "ERROR: Esta cuota ya existe O es mayor que la deuda?";
                return;
            }

            if (!$resta)
                $accion = 'Cancelado';
            $sql = "INSERT INTO tbl_descripcion(
                iddescripcion,
                idglobal,
                idsucursal,
                idtarjeta,
                iddetalleruta,
                dec_abono,
                str_descripcion,
                str_estado,
                idusuario,
                str_origen,
                created_at,
                updated_at

            )
				VALUES ('$iddescripcion',$idglobal, $idsucursal, '$idtarjeta', $iddetalleruta, $abono, '$accion', 'created', $idusuario, 'web','$fecha','$fecha')";
            $conexion->query($sql) or throw new Exception('error!');
            $this->guardarPagosBanco('tbl_descripcion_pago', 'iddescripcion', $iddescripcion, $idglobal, $idsucursal, $idusuario, $pagosBanco, abs($abono), $vueltoBanco);

            $sql = "UPDATE tbl_tarjetas SET dec_resta=$resta WHERE idtarjeta='$idtarjeta'";
            $conexion->query($sql) or throw new Exception("error!");
        } catch (Exception $e) {

            $sw = false;
            $errorMensaje = $e->getMessage();
            $conexion->rollback();
        }
        $conexion->commit();
        if ($conexion != null) {
            $conexion->close();
        }
        $mensaje = $sw ? $accion . " ¡Correctamente!" : ($errorMensaje && strpos($errorMensaje, 'ERROR:') === 0 ? $errorMensaje : "¡ERROR: Inesperado!");
        echo $mensaje;
        return $sw;
    }
    public function updateCuota($iddescripcion, $idsucursal, $abono, $resta)
    {
        global $conexion;
        $conexion->autocommit(false);
        $fecha = date('Y-m-d H:i:s');
        $sw = true;
        $accion = 'Abono';
        try {
            $sqlSelectAbono = "SELECT idtarjeta, dec_abono FROM tbl_descripcion 
            WHERE iddescripcion='$iddescripcion'";
            $querySelecAbono = $conexion->query($sqlSelectAbono);
            $res = $querySelecAbono->fetch_object();
            $idtarjeta = $res->idtarjeta;
            $abnAnterior = $res->dec_abono;

            $sqlSelectAbono = "SELECT ifnull(SUM(d.dec_abono),0) AS pagado, 
            (select dec_valor from tbl_tarjetas where idtarjeta=t.idtarjeta) AS credito,
            (select iddetalleruta from tbl_detalle_ruta where idsucursal=$idsucursal and str_estado='created' order by created_at desc limit 1) as iddetalleruta
        FROM tbl_descripcion d INNER JOIN
            tbl_tarjetas t ON t.idtarjeta=d.idtarjeta
         WHERE d.idtarjeta='$idtarjeta'";
            $querySelecAbono = $conexion->query($sqlSelectAbono);
            $res = $querySelecAbono->fetch_object();

            if (($res->credito + ($res->pagado - $abnAnterior) + $abono) != $resta) {

                echo "ERROR: Esta cuota ya existe O es mayor que la deuda?";
                return;
            }

            if (!$resta)
                $accion = 'Cancelado';
            $sql = "UPDATE tbl_descripcion SET dec_abono=$abono, str_descripcion='$accion', updated_at='$fecha' WHERE iddescripcion='$iddescripcion'";
            $conexion->query($sql) or throw new Exception('error!');

            $sql = "UPDATE tbl_tarjetas SET dec_resta=$resta WHERE idtarjeta='$idtarjeta'";
            $conexion->query($sql) or throw new Exception("error!");
        } catch (Exception $e) {
            $sw = false;
            $conexion->rollback();
        }
        $conexion->commit();
        if ($conexion != null) {
            $conexion->close();
        }
        $mensaje = $sw ? $accion . " ¡Correctamente!" : "¡ERROR: Inesperado!";
        echo $mensaje;
        return $sw;
    }


    private function dineroACentavos($valor)
    {
        return (int)round(floatval($valor) * 100);
    }

    private function guardarPagosBanco($tabla, $columna, $id, $idglobal, $idsucursal, $idusuario, array $pagosBanco, $maximo, $vuelto = 0)
    {
        global $conexion;
        if (!in_array($tabla, array('tbl_descripcion_pago', 'tbl_tarjeta_pago'), true) || !in_array($columna, array('iddescripcion', 'idtarjeta'), true)) {
            throw new Exception('ERROR: Configuración de pago inválida');
        }

        db_execute($conexion, "DELETE FROM $tabla WHERE $columna=? AND idglobal=?", "si", [(string)$id, intval($idglobal)]);
        $vueltoCentavos = $this->dineroACentavos($vuelto);
        if (count($pagosBanco) === 0) {
            if ($vueltoCentavos !== 0) {
                throw new Exception('ERROR: No hay transferencia para devolver efectivo');
            }
            return true;
        }
        if (count($pagosBanco) > 5) {
            throw new Exception('ERROR: Máximo 5 métodos de pago por operación');
        }

        $idsBanco = array();
        $totalCentavos = 0;
        foreach ($pagosBanco as $pago) {
            $idbanco = intval($pago['idbanco'] ?? 0);
            $valor = floatval($pago['valor'] ?? 0);
            $referencia = trim((string)($pago['referencia'] ?? ''));
            if ($idbanco <= 0) {
                throw new Exception('ERROR: Método de pago inválido');
            }
            if ($valor <= 0) {
                throw new Exception('ERROR: El valor por banco debe ser mayor que cero');
            }
            if (strlen($referencia) > 50) {
                throw new Exception('ERROR: La referencia no puede superar 50 caracteres');
            }
            $idsBanco[] = $idbanco;
            $totalCentavos += $this->dineroACentavos($valor);
        }

        if (count(array_unique($idsBanco)) !== count($idsBanco)) {
            throw new Exception('ERROR: No repita el mismo banco en la operación');
        }
        // Si por banco entra más que el abono, el cobrador devuelve la diferencia en efectivo;
        // se exige declararla para que un error al digitar no le vacíe el bolsillo sin avisar.
        $excesoCentavos = max(0, $totalCentavos - $this->dineroACentavos($maximo));
        if ($vueltoCentavos !== $excesoCentavos) {
            throw new Exception($excesoCentavos > 0
                ? 'ERROR: Confirme la devolución en efectivo por el excedente de la transferencia'
                : 'ERROR: Solo hay devolución cuando la transferencia supera el valor de la operación');
        }

        $placeholders = implode(',', array_fill(0, count($idsBanco), '?'));
        $params = array_merge([intval($idsucursal), intval($idglobal)], $idsBanco);
        $stmt = db_prepare_execute(
            $conexion,
            "SELECT b.idbanco FROM tbl_banco b
             JOIN tbl_banco_sucursal bs ON bs.idbanco=b.idbanco AND bs.idglobal=b.idglobal AND bs.idsucursal=?
             WHERE b.idglobal=? AND b.str_estado='activo' AND b.idbanco IN ($placeholders)",
            str_repeat('i', count($params)),
            $params
        );
        $bancosValidos = $stmt->get_result()->num_rows;
        $stmt->close();
        if ($bancosValidos !== count($idsBanco)) {
            throw new Exception('ERROR: La cuenta está inactiva o no está autorizada en esta sucursal');
        }

        foreach ($pagosBanco as $pago) {
            $referencia = trim((string)($pago['referencia'] ?? ''));
            db_execute(
                $conexion,
                "INSERT INTO $tabla (idglobal, $columna, idbanco, dec_valor, str_referencia, idusuario, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())",
                "isidsi",
                [intval($idglobal), (string)$id, intval($pago['idbanco']), floatval($pago['valor']), $referencia === '' ? null : $referencia, intval($idusuario)]
            );
        }
        return true;
    }

    public function buscarCliente($idpersona)
    {
        global $conexion;
        $sql = "SELECT 
            idcliente AS refCliente,
            dec_max_credito AS max_credito,
            str_apodo AS apodo,
            str_nota AS notaCliente,
            str_estado AS estadoCliente,
            fiador_persona_id AS fiadorId,
            (SELECT IFNULL(SUM(dec_resta),0) FROM tbl_tarjetas WHERE idcliente=tbl_clientes.idcliente) AS total_deuda_actual
         FROM tbl_clientes WHERE idpersona=$idpersona";
        $query = $conexion->query($sql);
        return $query;
    }
    public function buscarTarjetas($idcliente)
    {
        global $conexion;
        $sql = "SELECT 
            t.idcliente AS refCliente,
            t.str_concepto AS concepto,
            t.dec_valor AS valor,
            t.str_modo AS modo,
            t.int_tiempo AS tiempo,
            t.dec_prestamo AS costo,
            t.dec_c_adicional_valor AS adicional,
            t.str_estado AS estado,
            t.dec_resta as resta,
            t.created_at AS fecha_at,
            (SELECT IFNULL(GROUP_CONCAT(dec_abono,',,,',str_descripcion,',,,',created_at SEPARATOR '<=>'),'')
            FROM tbl_descripcion 
            WHERE idtarjeta=t.idtarjeta ORDER BY created_at ) AS abonos,
            s.str_codigo AS codigo
         FROM tbl_tarjetas t INNER JOIN
         tbl_sucursal s ON s.idsucursal=t.idsucursal
         
          WHERE t.idcliente=$idcliente";
        $query = $conexion->query($sql);
        return $query;
    }
    public function getDiferencias($idsucursal)
    {
        global $conexion;
        $sql = "SELECT 
        IFNULL(SUM(dec_total),0) As diferencia
        FROM tbl_contabilidad_detalle 
        WHERE idsucursal=$idsucursal and str_nombre='diferencia'";
        $query = $conexion->query($sql);
        return $query;
    }

    public function listRuta($idsucursal)
    {
        global $conexion;
        $sql = "SELECT r.*, d.dec_abono AS ultimo_abono, d.str_descripcion AS ultimo_abono_descripcion,
            d.str_estado AS ultimo_abono_estado, d.str_origen AS ultimo_abono_origen,
            d.created_at AS ultimo_abono_fecha, d.idusuario AS ultimo_abono_idusuario,
            COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.str_nombres, p.str_apellidos)), ''), u.str_user_name)
                AS ultimo_abono_usuario
        FROM view_ruta r
        LEFT JOIN tbl_descripcion d ON d.iddescripcion = (
            SELECT pago.iddescripcion FROM tbl_descripcion pago
            WHERE pago.idtarjeta = r.refTarjeta AND pago.idglobal = r.refGlobal
              AND pago.idsucursal = r.refSucursal
            ORDER BY pago.created_at DESC, pago.iddescripcion DESC LIMIT 1
        )
        LEFT JOIN tbl_usuario u ON u.idusuario = d.idusuario AND u.idglobal = d.idglobal
        LEFT JOIN tbl_persona p ON p.idpersona = u.idpersona AND p.idglobal = u.idglobal
        WHERE r.refSucursal=$idsucursal
        AND r.estado NOT IN ('cancelado', 'inactiva', 'moroso', 'fallecio', 'discapacitado')
        ";
        $query = $conexion->query($sql);
        return $query;
    }

    public function GetTipoDocSerieNum($idsucursal)
    {
        global $conexion;
        $sql = "SELECT dds.iddetalle_documento_sucursal AS refDetalle_documento_sucursal,
         dds.str_ultima_serie AS ultima_serie, 
        dds.str_ultimo_numero AS ultimo_numero,
        td.str_nombre AS tipo_comprobante
            FROM tbl_detalle_documento_sucursal dds INNER JOIN tbl_tipo_documento td ON dds.idtipo_documento = td.idtipo_documento
            WHERE td.str_operacion = 'Comprobante' AND dds.idsucursal='$idsucursal' ";
        $query = $conexion->query($sql);
        return $query;
    }
    public function moverOrdenar($idtarjeta, $item)
    {
        global $conexion;
        $sw = true;
        try {
            $sql = "UPDATE tbl_tarjetas SET float_item=$item WHERE idtarjeta='$idtarjeta'";
            $conexion->query($sql) or throw new Exception('error!');
        } catch (Exception $e) {

            $sw = false;
            $conexion->rollback();
        }
        $conexion->commit();
        if ($conexion != null) {
            $conexion->close();
        }
        $mensaje = $sw ? " ¡Movida Correctamente!" : "¡ERROR: Inesperado!";
        echo $mensaje;
        return $sw;
    }

    public function saveDescripcionDescuentoOrMasInteres($operacion, $iddescripcion, $idglobal, $idsucursal, $idtarjeta, $abono, $descripcion, $plazo, int $idusuario)
    {
        global $conexion;
        $conexion->autocommit(false);
        $sw = true;
        $fecha = date('Y-m-d H:i:s');

        try {
            $sql = "SELECT iddetalleruta FROM tbl_detalle_ruta
            WHERE str_estado='created' AND idsucursal=$idsucursal";
            $queryDR = $conexion->query($sql);
            $resDR = $queryDR->fetch_object();
            $iddetalleruta = $resDR->iddetalleruta;
            if ($operacion === 'Intereses') {
                $sqlEstado = "SELECT str_estado FROM tbl_tarjetas
                    WHERE idtarjeta='$idtarjeta' AND idglobal=$idglobal AND idsucursal=$idsucursal
                    FOR UPDATE";
                $queryEstado = $conexion->query($sqlEstado) or throw new Exception('error!');
                $tarjetaEstado = $queryEstado->fetch_object();
                if (!$tarjetaEstado) {
                    $conexion->rollback();
                    echo "ERROR: Tarjeta no encontrada en esta sucursal";
                    return false;
                }
                if (in_array($tarjetaEstado->str_estado, ['created', 'entregando'], true)) {
                    $conexion->rollback();
                    echo "ERROR: No se pueden cobrar más intereses mientras la tarjeta esté en estado created o entregando";
                    return false;
                }
                
                $sqlSelectAbono = "SELECT iddescripcion FROM tbl_descripcion 
                WHERE 
                idtarjeta='$idtarjeta' AND str_estado<>'saved' AND str_descripcion LIKE '$operacion%' ";
                $querySelecAbono = $conexion->query($sqlSelectAbono);
                $res = $querySelecAbono->fetch_object();
                // empty($res->iddescripcion) or throw new Exception('error!');
                if (isset($res->iddescripcion)) {
                    echo "ERROR: No puede duplicar" . $operacion;
                    return;
                }


                $sql = "UPDATE tbl_tarjetas SET 
                    str_estado= 'refinanciada', 
                    int_tiempo=int_tiempo+$plazo,
                    dec_utilidad=dec_utilidad+$abono,
                    dec_resta=dec_resta+$abono
                 WHERE idtarjeta='$idtarjeta'";
                $conexion->query($sql) or throw new Exception("error!");
            } else {
                if ($operacion === 'Descuento') {
                    $sql = "SELECT dec_valor-dec_prestamo as intereses FROM tbl_tarjetas WHERE idtarjeta='$idtarjeta'";
                    $tar = $conexion->query($sql);
                    $result = $tar->fetch_object();


                    /*  if ($abono * -1 > $result->intereses) {
                          echo "ERROR: El Descuento tiene que ser menor que la utilidad de la tarjeta";
                          return;
                      }*/
                    $sqlSelectAbono = "SELECT iddescripcion FROM tbl_descripcion 
                    WHERE 
                    idtarjeta='$idtarjeta' AND str_descripcion LIKE '$operacion%' ";
                    $querySelecAbono = $conexion->query($sqlSelectAbono);
                    $res = $querySelecAbono->fetch_object();
                    // empty($res->iddescripcion) or throw new Exception('error!');
                    if (isset($res->iddescripcion)) {
                        echo "ERROR: No puede duplicar" . $operacion;
                        return;
                    }
                }

                $sql = "UPDATE tbl_tarjetas SET dec_utilidad=dec_utilidad+$abono, dec_resta=dec_resta+$abono WHERE idtarjeta='$idtarjeta'";
                $conexion->query($sql) or throw new Exception("error!");
            }

            $sql = "INSERT INTO tbl_descripcion (
                iddescripcion,
                idglobal,
                idsucursal,
                idtarjeta,
                iddetalleruta,
                dec_abono,
                str_descripcion,
                str_estado,
                idusuario,
                str_origen,
                created_at,
                updated_at
                )
               VALUES ('$iddescripcion', $idglobal, $idsucursal, '$idtarjeta', $iddetalleruta, $abono, CONCAT('$operacion',': ','$descripcion'), 'created', $idusuario, 'web', '$fecha','$fecha')";
            $conexion->query($sql) or throw new Exception("error!");


        } catch (Exception $e) {
            //print_r($e);
            $sw = false;
            $conexion->rollback();
        }
        $conexion->commit();
        if ($conexion != null) {
            $conexion->close();
        }
        $mensaje = $sw ? $operacion . " ¡Correctamente!" : "¡ERROR: Inesperado!";
        echo $mensaje;
        return $sw;
    }
    public function listarDescripcion($idtarjeta)
    {
        global $conexion;
        $sql = "SELECT
            d.iddescripcion AS refDescripcion,
            d.dec_abono AS abono,
            d.str_descripcion AS descripcion,
            d.str_estado AS estado,
            d.created_at AS fecha_at 
        FROM
            tbl_descripcion d
            INNER JOIN tbl_tarjetas t ON t.idtarjeta = d.idtarjeta 
        WHERE
          d.idtarjeta='$idtarjeta' 
        ORDER BY
            d.created_at ASC;";
        return $conexion->query($sql);
    }
    public function listTblDetalleRutaDespachada($idsucursal, $userEmpleadoId)
    {
        global $conexion;
        $caja = 0;
        $sql = "SELECT 
        iddetalleruta AS refDetalle_ruta,
        (SELECT  iddetalleruta FROM tbl_detalle_ruta WHERE idsucursal=$idsucursal AND str_estado='saved' LIMIT 1 ) AS reg,
        str_estado AS estado
         FROM tbl_detalle_ruta WHERE idsucursal=$idsucursal AND str_estado<>'saved' ORDER BY created_at DESC LIMIT 1 ";
        $query = $conexion->query($sql);

        $sql = "SELECT
        a.str_nombre
         FROM  `tbl_auth_sucursal` au INNER JOIN 
                tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal INNER JOIN 
                tbl_auth a ON a.idauth=b.idauth 
         where au.str_estado<>'inactivo' AND 
                 au.idempleado=$userEmpleadoId AND 
                 au.idsucursal=$idsucursal AND 
                 a.str_nombre='ver caja'";
                 
        $qry = $conexion->query($sql);
        $vercaja = $qry->fetch_object();

        if (isset($_SESSION['userEmpresa']) || administraOficinaCartera($conexion, $_SESSION, (int)$idsucursal) || isset($vercaja->str_nombre)) {
            $sql = "SELECT 
            IFNULL(SUM(dec_total),0) As caja
            FROM tbl_contabilidad_detalle 
            WHERE idsucursal=$idsucursal and idtipo_contabilidad<>8 AND str_estado<>'created'";
            $qry = $conexion->query($sql);
            $caja = $qry->fetch_object()->caja;
        }

        $sql = "SELECT
        a.str_nombre
         FROM  `tbl_auth_sucursal` au INNER JOIN 
                tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal INNER JOIN 
                tbl_auth a ON a.idauth=b.idauth 
         where au.str_estado<>'inactivo' AND 
                 au.idempleado=$userEmpleadoId AND 
                 au.idsucursal=$idsucursal AND 
                 a.str_nombre='totalizar'";
        $qry = $conexion->query($sql);
        $btn = $qry->fetch_object();
        $bool_ = false;
        if (isset($_SESSION['userEmpresa']) || administraOficinaCartera($conexion, $_SESSION, (int)$idsucursal) || isset($btn->str_nombre)) {
            $bool_ = true;
        }


        return array($query, $caja, $bool_);
    }
    public function listDescripcionNoGuardada($idsucursal)
    {
        global $conexion;
        $sql = "SELECT 
        d.dec_abono AS abono,
        d.str_descripcion As descripcion,
        d.created_at AS fecha_at,
        CONCAT(p.str_nombres,' ',p.str_apellidos ) AS nombre,
        p.str_tipo_documento AS t_documento,
        p.str_num_documento AS n_documento,
		p.str_telefono AS tel,
		p.str_foto as foto,
        t.str_concepto AS consepto,
        t.dec_valor AS valor,
        t.dec_prestamo AS costo,
        t.dec_c_adicional_valor AS ut_adi_valor
        
        
         FROM tbl_descripcion d
		INNER JOIN tbl_tarjetas t ON t.idtarjeta=d.idtarjeta 
		INNER JOIN tbl_clientes c ON c.idcliente=t.idcliente
        INNER JOIN tbl_persona p ON p.idpersona = c.idpersona
		 WHERE d.idsucursal=$idsucursal AND d.str_estado<>'saved' ORDER BY d.created_at ASC ";
        $query = $conexion->query($sql);
        return $query;
    }
    public function listTblTergetasNoGuardada($idsucursal)
    {
        global $conexion;
        $sql = "SELECT 
        t.idtarjeta AS refTarjeta,
        CONCAT(p.str_nombres,' ',p.str_apellidos ) AS nombre,
        p.str_tipo_documento AS t_documento,
        p.str_num_documento AS n_documento,
		p.str_telefono AS tel,
		p.str_foto as foto,
        t.str_concepto AS consepto,
        t.dec_valor AS valor,
        t.dec_prestamo AS costo,
        t.dec_c_adicional_valor AS ut_adi_valor
        
        FROM tbl_tarjetas t
		INNER JOIN tbl_clientes c ON c.idcliente=t.idcliente
        INNER JOIN tbl_persona p ON p.idpersona = c.idpersona
		 WHERE t.idsucursal=$idsucursal AND t.str_estado='created' or 
         t.idsucursal=$idsucursal AND t.str_estado='entregando' ORDER BY t.created_at ASC";
        $query = $conexion->query($sql);
        return $query;
    }

    public function listTblContabilidadNoGuardada($iddetalleruta)
    {
        global $conexion;
        $sql = "SELECT
        dc.idcontabilidad_detalle AS refContabilidad_detalle,
        dc.idtipo_contabilidad AS refCategoria_contabilidad,
        dc.iddetalleruta AS refDetalleRuta,
        dc.dec_total AS valor,
        dc.str_detalle AS descripcion,
        dc.str_nombre AS nombre,
        dc.str_estado AS estado,
        dc.str_operacion AS op,
        dc.created_empleado_id AS createdEmpleado,
        dc.created_at AS fecha_at,
        ( SELECT CONCAT(p.str_nombres,' ',p.str_apellidos) FROM tbl_detalle_nomina dn INNER JOIN
        tbl_nomina n ON n.idnomina=dn.idnomina INNER JOIN
        tbl_empleado e ON e.idempleado=n.idempleado INNER JOIN
        tbl_persona p ON p.idpersona=e.idpersona
         WHERE dn.idcontabilidad_detalle = dc.idcontabilidad_detalle ) AS nombreEmpleado ,
         ( SELECT p.str_foto FROM tbl_detalle_nomina dn INNER JOIN
        tbl_nomina n ON n.idnomina=dn.idnomina INNER JOIN
        tbl_empleado e ON e.idempleado=n.idempleado INNER JOIN
        tbl_persona p ON p.idpersona=e.idpersona
         WHERE dn.idcontabilidad_detalle = dc.idcontabilidad_detalle ) AS fotoEmpleado 
    FROM
        tbl_contabilidad_detalle dc 
    WHERE
        dc.iddetalleruta = $iddetalleruta
        AND dc.str_operacion LIKE '%-totalizar'";
        $query = $conexion->query($sql);
        return $query;
    }
    public function listTblContabilidadNoGuardadaOtrosGastos($iddetalleruta, $createdEmpleadoId)
    {
        global $conexion;
        $sql = "SELECT * FROM tbl_detalle_ruta WHERE iddetalleruta=$iddetalleruta";
        $query = $conexion->query($sql);
        $res = $query->fetch_object();

        $sql = "SELECT
            a.str_nombre
             FROM  `tbl_auth_sucursal` au INNER JOIN 
                    tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal INNER JOIN 
                    tbl_auth a ON a.idauth=b.idauth 
             WHERE au.str_estado<>'inactivo' AND 
                 au.idempleado=$createdEmpleadoId AND 
                au.idsucursal=$res->idsucursal AND 
                a.str_nombre='crear otros gastos'
                 GROUP BY au.idsucursal";
        $query = $conexion->query($sql);
        $reso = $query->fetch_object();
        if (isset($_SESSION['userEmpresa']) || administraOficinaCartera($conexion, $_SESSION, (int)$res->idsucursal) || isset($reso->str_nombre)) {
            $sql = "SELECT
                    dc.idcontabilidad_detalle AS refContabilidad_detalle,
                    dc.idtipo_contabilidad AS refCategoria_contabilidad,
                    dc.iddetalleruta AS refDetalleRuta,
                    dc.dec_total AS valor,
                    dc.str_detalle AS descripcion,
                    dc.str_nombre AS nombre,
                    dc.str_estado AS estado,
                    dc.str_operacion AS op,
                    dc.created_empleado_id AS createdEmpleado,
                    dc.created_at AS fecha_at,
                    ( SELECT CONCAT(p.str_nombres,' ',p.str_apellidos) FROM tbl_detalle_nomina dn INNER JOIN
                    tbl_nomina n ON n.idnomina=dn.idnomina INNER JOIN
                    tbl_empleado e ON e.idempleado=n.idempleado INNER JOIN
                    tbl_persona p ON p.idpersona=e.idpersona
                    WHERE dn.idcontabilidad_detalle = dc.idcontabilidad_detalle ) AS nombreEmpleado,
                    ( SELECT p.str_foto FROM tbl_detalle_nomina dn INNER JOIN
                    tbl_nomina n ON n.idnomina=dn.idnomina INNER JOIN
                    tbl_empleado e ON e.idempleado=n.idempleado INNER JOIN
                    tbl_persona p ON p.idpersona=e.idpersona
                    WHERE dn.idcontabilidad_detalle = dc.idcontabilidad_detalle ) AS fotoEmpleado 
                FROM
                    tbl_contabilidad_detalle dc 
                WHERE
                    dc.iddetalleruta = $iddetalleruta
                    and idtipo_contabilidad <> 6 
                    AND dc.str_operacion LIKE 'salida-contabilidad%'";
            $query = $conexion->query($sql);
            return $query;
        } else {

            $sql = "SELECT
                    dc.idcontabilidad_detalle
                FROM
                    tbl_contabilidad_detalle dc 
                WHERE
                    dc.iddetalleruta = 0
                    and idtipo_contabilidad =0  
                    AND dc.str_operacion LIKE '0'";
            $query = $conexion->query($sql);
            return $query;
        }



    }

    public function listTblContabilidadNoGuardadaSalida($iddetalleruta, $createdEmpleadoId)
    {
        global $conexion;
        $sql = "SELECT * FROM tbl_detalle_ruta WHERE iddetalleruta=$iddetalleruta";
        $query = $conexion->query($sql);
        $res = $query->fetch_object();


        $sql = "SELECT
            a.str_nombre
             FROM  `tbl_auth_sucursal` au INNER JOIN 
                    tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal INNER JOIN 
                    tbl_auth a ON a.idauth=b.idauth 
             WHERE au.str_estado<>'inactivo' AND 
                 au.idempleado=$createdEmpleadoId AND 
                au.idsucursal=$res->idsucursal AND 
                a.str_nombre='crear salida'
                 GROUP BY au.idsucursal";
        $query = $conexion->query($sql);
        $ress = $query->fetch_object();
        if (isset($_SESSION['userEmpresa']) || administraOficinaCartera($conexion, $_SESSION, (int)$res->idsucursal) || isset($ress->str_nombre)) {
            $sql = "SELECT
            dc.idcontabilidad_detalle AS refContabilidad_detalle,
            dc.idtipo_contabilidad AS refCategoria_contabilidad,
            dc.iddetalleruta AS refDetalleRuta,
            dc.dec_total AS valor,
            dc.str_detalle AS descripcion,
            dc.str_nombre AS nombre,
            dc.str_estado AS estado,
            dc.str_operacion AS op,
            dc.created_empleado_id AS createdEmpleado,
            dc.created_at AS fecha_at
        FROM
            tbl_contabilidad_detalle dc 
        WHERE
            dc.iddetalleruta = $iddetalleruta AND 
            idtipo_contabilidad = 6 ";
            $query = $conexion->query($sql);
            return $query;
        } else {

            $sql = "SELECT
            dc.idcontabilidad_detalle
        FROM
            tbl_contabilidad_detalle dc 
        WHERE
            dc.iddetalleruta = -0
            and idtipo_contabilidad =-0  
            AND dc.str_operacion LIKE '0'";
            $query = $conexion->query($sql);
            return $query;
        }

    }

    public function listTblContabilidadNoGuardadaEntradas($iddetalleruta, $createdEmpleadoId)
    {
        global $conexion;
        $sql = "SELECT * FROM tbl_detalle_ruta WHERE iddetalleruta=$iddetalleruta";
        $query = $conexion->query($sql);
        $res = $query->fetch_object();


        $sql = "SELECT
            a.str_nombre
             FROM  `tbl_auth_sucursal` au INNER JOIN 
                    tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal INNER JOIN 
                    tbl_auth a ON a.idauth=b.idauth 
             WHERE au.str_estado<>'inactivo' AND 
                 au.idempleado=$createdEmpleadoId AND 
                au.idsucursal=$res->idsucursal AND 
                a.str_nombre='crear entrada'
                 GROUP BY au.idsucursal";
        $query = $conexion->query($sql);
        $rese = $query->fetch_object();
        if (isset($_SESSION['userEmpresa']) || administraOficinaCartera($conexion, $_SESSION, (int)$res->idsucursal) || isset($rese->str_nombre)) {
            $sql = "SELECT
            dc.idcontabilidad_detalle AS refContabilidad_detalle,
            dc.idtipo_contabilidad AS refCategoria_contabilidad,
            dc.iddetalleruta AS refDetalleRuta,
            dc.dec_total AS valor,
            dc.str_detalle AS descripcion,
            dc.str_nombre AS nombre,
            dc.str_estado AS estado,
            dc.str_operacion AS op,
            dc.created_empleado_id AS createdEmpleado,
            dc.created_at AS fecha_at
        FROM
            tbl_contabilidad_detalle dc 
        WHERE
            dc.iddetalleruta = $iddetalleruta
            AND idtipo_contabilidad = 9 ";
            $query = $conexion->query($sql);
            return $query;
        } else {

            $sql = "SELECT
            dc.idcontabilidad_detalle
        FROM
            tbl_contabilidad_detalle dc 
        WHERE
            dc.iddetalleruta = 0
            and idtipo_contabilidad =0  
            AND dc.str_operacion LIKE '0'";
            $query = $conexion->query($sql);
            return $query;
        }




       
    }



    public function deleteGastoDetalleRuta($idcontabilidad_detalle, $createdEmpleadoId)
    {
        global $conexion;
        $sql = "SELECT * FROM tbl_contabilidad_detalle WHERE idcontabilidad_detalle='$idcontabilidad_detalle'";
        $query = $conexion->query($sql);
        $res = $query->fetch_object();





        if ($res->str_operacion == 'salida-contabilidad') {
            $sql = "SELECT
            a.str_nombre
             FROM  `tbl_auth_sucursal` au INNER JOIN 
                    tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal INNER JOIN 
                    tbl_auth a ON a.idauth=b.idauth 
             WHERE au.str_estado<>'inactivo' AND 
                 au.idempleado=$createdEmpleadoId AND 
                au.idsucursal=$res->idsucursal AND 
                a.str_nombre='crear otros gastos'
                 GROUP BY au.idsucursal";
            $query = $conexion->query($sql);
            $resg = $query->fetch_object();
            if (isset($_SESSION['userEmpresa']) || administraOficinaCartera($conexion, $_SESSION, (int)$res->idsucursal) || isset($resg->str_nombre)) {

            } else {
                echo "ERROR: No estas authorizado para esta accion";
                return;
            }
        }



        if ($res->idtipo_contabilidad == 6) {
            $sql = "SELECT
            a.str_nombre
             FROM  `tbl_auth_sucursal` au INNER JOIN 
                    tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal INNER JOIN 
                    tbl_auth a ON a.idauth=b.idauth 
             WHERE au.str_estado<>'inactivo' AND 
                 au.idempleado=$createdEmpleadoId AND 
                au.idsucursal=$res->idsucursal AND 
                a.str_nombre='crear salida'
                 GROUP BY au.idsucursal";
            $query = $conexion->query($sql);
            $ress = $query->fetch_object();
            if (isset($_SESSION['userEmpresa']) || administraOficinaCartera($conexion, $_SESSION, (int)$res->idsucursal) || isset($ress->str_nombre)) {

            } else {
                echo "ERROR: No estas authorizado para esta accion";
                return;
            }
        }
        if ($res->idtipo_contabilidad == 9) {
            $sql = "SELECT
            a.str_nombre
             FROM  `tbl_auth_sucursal` au INNER JOIN 
                    tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal INNER JOIN 
                    tbl_auth a ON a.idauth=b.idauth 
             WHERE au.str_estado<>'inactivo' AND 
                 au.idempleado=$createdEmpleadoId AND 
                au.idsucursal=$res->idsucursal AND 
                a.str_nombre='crear entrada'
                 GROUP BY au.idsucursal";
            $query = $conexion->query($sql);
            $rese = $query->fetch_object();
            if (isset($_SESSION['userEmpresa']) || administraOficinaCartera($conexion, $_SESSION, (int)$res->idsucursal) || isset($rese->str_nombre)) {

            } else {
                echo "ERROR: No estas authorizado para esta accion";
                return;
            }
        }




        $sql = "DELETE FROM tbl_contabilidad_detalle WHERE idcontabilidad_detalle='$idcontabilidad_detalle'";
        $query = $conexion->query($sql);

        $mensaje = $query ? " ¡Eliminado Correctamente!" : "¡ERROR: Inesperado!";
        echo $mensaje;
        return;
    }
    public function eliminarAbono($iddescripcion)
    {
        global $conexion;
        $conexion->autocommit(false);
        $sw = true;
        try {
            $sql = "SELECT idtarjeta FROM tbl_descripcion WHERE iddescripcion='$iddescripcion'";
            $querydes = $conexion->query($sql);
            $fetchdescripcion = $querydes->fetch_object();

            $sql = "DELETE FROM tbl_descripcion WHERE iddescripcion='$iddescripcion' AND str_estado='created'";
            $query = $conexion->query($sql) or throw new Exception("error!");

            $sql = "SELECT 
            (select IFNULL(SUM(dec_abono),0) from tbl_descripcion where idtarjeta='$fetchdescripcion->idtarjeta' )AS abonado,
            dec_valor
            FROM tbl_tarjetas
            WHERE idtarjeta='$fetchdescripcion->idtarjeta' ";
            $querytar = $conexion->query($sql);
            $fetchtar = $querytar->fetch_object();

            $resta = $fetchtar->dec_valor + $fetchtar->abonado;

            $sql = "UPDATE tbl_tarjetas SET dec_resta=$resta WHERE idtarjeta='$fetchdescripcion->idtarjeta'";
            $conexion->query($sql) or throw new Exception("error!");
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
        return $query;
    }

    public function eliminarCredito($idtarjeta)
    {
        global $conexion;
        $conexion->autocommit(false);
        $sw = true;
        try {
            $sql = "DELETE FROM tbl_tarjetas WHERE idtarjeta='$idtarjeta' AND str_estado='created'";
            $query = $conexion->query($sql) or throw new Exception("error!");
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
        return $query;
    }

    public function listTarjetasCanceladas($idsucursal, $desde, $hasta)
    {
        global $conexion;
        $fechaPreCaja = date('Y-m-d', strtotime($hasta . ' +1 day'));

        // $sql = "SELECT * FROM view_ruta WHERE refSucursal=$idsucursal AND estado='cancelado' AND fecha_at>='$desde' AND fecha_at<='$fechaPreCaja'";
        $sql = "SELECT r.valor, 
       r.costo,
       r.ut_adi_valor,
       r.fecha_at,
       r.cliente,
       r.t_documento,
       r.n_documento,
       r.tel,   
       d.dec_abono AS cancelo, 
       d.str_descripcion as cancelo_descripcion,
       d.created_at as cancelo_fecha
        FROM view_ruta r INNER JOIN
       tbl_descripcion d ON d.idtarjeta=r.refTarjeta
       WHERE r.refSucursal=$idsucursal AND d.str_descripcion='Cancelado' AND r.estado='cancelado' AND d.created_at>='$desde' AND d.created_at<='$fechaPreCaja'";
        $query = $conexion->query($sql);

        return $query;
    }

    public function actualizarEstado($idtarjeta, $estado)
    {
        global $conexion;
        $conexion->autocommit(false);

        $sw = true;

        try {
            $sqlSelectAbono = "SELECT iddescripcion FROM tbl_descripcion 
            WHERE 
            idtarjeta='$idtarjeta' AND str_estado='created' AND str_estado='entregando' AND str_descripcion LIKE 'Abono%' OR
            idtarjeta='$idtarjeta' AND str_estado='created' AND str_estado='entregando' AND str_descripcion LIKE 'Cancelado%' OR
            idtarjeta='$idtarjeta' AND str_estado='created' AND str_estado='entregando' AND str_descripcion LIKE 'Inicial%'";
            $querySelecAbono = $conexion->query($sqlSelectAbono);
            $res1 = $querySelecAbono->fetch_object();
            // empty($res->iddescripcion) or throw new Exception('error!');
            $os = array("moroso", "fallecio", "discapacitado");

            if (isset($res1->iddescripcion) && in_array($estado, $os)) {
                echo "ERROR: No puede Cambiar el estado en estos momentos. Intenta guardar cuentas primero";
                return;
            }

            $sqlSelectTargeta = "SELECT str_estado, idcliente FROM tbl_tarjetas 
            WHERE idtarjeta='$idtarjeta' AND str_estado<>'created' AND str_estado <> 'entregando' ";
            $querySelecTarjeta = $conexion->query($sqlSelectTargeta);
            $res = $querySelecTarjeta->fetch_object();

            if (!isset($res->str_estado)) {
                echo "ERROR: No puede Cambiar el estado en estos momentos";
                return;
            }


            $sql = "UPDATE tbl_tarjetas SET str_estado='$estado' WHERE idtarjeta='$idtarjeta' ";
            $conexion->query($sql) or throw new Exception("error!");

            if ($estado == 'fallecio' || $estado == 'discapacitado') {
                $sqlSelectCliente = "SELECT idpersona FROM tbl_clientes
                WHERE idcliente=$res->idcliente";
                $querySelecCliente = $conexion->query($sqlSelectCliente);
                $res1 = $querySelecCliente->fetch_object();


                $sql = "UPDATE tbl_persona SET str_estado='$estado' WHERE idpersona=$res1->idpersona ";
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
        $mensaje = $sw ? "Estado actualizado ¡Correctamente!" : "¡ERROR: Inesperado!";
        echo $mensaje;
        return $sw;
    }


    public function getUserCreated($idtarjeta){
        global $conexion;
        $sql = "SELECT
pp.str_nombres, pp.str_apellidos,  t.created_at AS fecha



 FROM `tbl_persona`  p INNER JOIN
tbl_clientes c ON c.idpersona=p.idpersona INNER JOIN
tbl_tarjetas t ON t.idcliente=c.idcliente INNER JOIN
tbl_empleado e ON e.idempleado=t.created_empleado_id INNER JOIN
tbl_persona pp ON pp.idpersona=e.idpersona
WHERE t.idtarjeta='$idtarjeta'";
        $query = $conexion->query($sql);
        return $query;
    }
}
