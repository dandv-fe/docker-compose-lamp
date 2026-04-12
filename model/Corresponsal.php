<?php
require "Conexion.php";

class Corresponsal
{
   public function __construct() {}

   public function obtenerCuentaCorresponsal($idglobal, $idpersona)
   {
      global $conexion;
      $idglobal = intval($idglobal);
      $idpersona = intval($idpersona);

      $sql = "SELECT
                        a.idahorro,
                        a.idpersona,
                        a.str_name,
                        a.id_cuenta,
                        a.str_tipo,
                        a.str_estado,
                        a.created_at,
                        IFNULL((
                           SELECT SUM(
                              CASE m.str_tipo
                                 WHEN 'aporte' THEN m.dec_valor
                                 WHEN 'ajuste' THEN m.dec_valor
                                 WHEN 'retiro' THEN m.dec_valor
                                 ELSE 0
                              END
                           )
                           FROM tbl_movimientos m
                           WHERE m.idglobal = a.idglobal
                              AND m.idahorro = a.idahorro
                              AND UPPER(IFNULL(m.str_estado, '')) <> 'INACTIVO'
                        ), 0) AS saldo_actual
                     FROM tbl_ahorros a
                     WHERE a.idglobal=$idglobal
                        AND a.idpersona=$idpersona
                        AND a.str_tipo='corresponsal'
                     ORDER BY a.idahorro DESC
                     LIMIT 1";

      return $conexion->query($sql);
   }

   public function listarMovimientos($idglobal, $idahorro)
   {
      global $conexion;
      $idglobal = intval($idglobal);
      $idahorro = intval($idahorro);

      $sql = "SELECT
                        m.idmovimiento,
                        m.date_movimiento,
                        m.str_tipo,
                        m.str_descripcion,
                        m.int_codigo,
                        m.dec_valor,
                        m.str_estado,
                        IFNULL((
                           SELECT SUM(
                              CASE m2.str_tipo
                                 WHEN 'aporte' THEN m2.dec_valor
                                 WHEN 'ajuste' THEN m2.dec_valor
                                 WHEN 'retiro' THEN m2.dec_valor
                                 ELSE 0
                              END
                           )
                           FROM tbl_movimientos m2
                           WHERE m2.idglobal = m.idglobal
                              AND m2.idahorro = m.idahorro
                              AND (
                                 m2.date_movimiento < m.date_movimiento
                                 OR (m2.date_movimiento = m.date_movimiento AND m2.idmovimiento <= m.idmovimiento)
                              )
                              AND UPPER(IFNULL(m2.str_estado, '')) <> 'INACTIVO'
                        ), 0) AS saldo_acumulado
                     FROM tbl_movimientos m
                     WHERE m.idglobal=$idglobal
                        AND m.idahorro=$idahorro
                     ORDER BY m.date_movimiento DESC, m.idmovimiento DESC";

      return $conexion->query($sql);
   }

   public function finalizarTransferencia($idglobal, $idpersona, $idahorroOrigen, $idahorroDestino, $idusuarioCreated, $monto)
   {
      global $conexion;

      $idglobal = intval($idglobal);
      $idpersona = intval($idpersona);
      $idahorroOrigen = intval($idahorroOrigen);
      $idahorroDestino = intval($idahorroDestino);
      $idusuarioCreated = intval($idusuarioCreated);
      $monto = floatval($monto);

      if ($idglobal <= 0 || $idpersona <= 0 || $idahorroOrigen <= 0 || $idahorroDestino <= 0 || $idusuarioCreated <= 0 || $monto <= 0) {
         return ['status' => 'error', 'mensaje' => 'Parámetros inválidos'];
      }

      if ($idahorroOrigen === $idahorroDestino) {
         return ['status' => 'error', 'mensaje' => 'La cuenta destino no puede ser la misma cuenta origen'];
      }

      $sw = true;
      $conexion->autocommit(false);
      $dt = date('Y-m-d H:i:s');

      try {
         $sqlOrigen = "SELECT idahorro, idpersona, id_cuenta, str_tipo, str_estado
                       FROM tbl_ahorros
                       WHERE idglobal=$idglobal
                         AND idahorro=$idahorroOrigen
                         AND idpersona=$idpersona
                         AND str_tipo='corresponsal'
                       LIMIT 1";
         $qOrigen = $conexion->query($sqlOrigen);
         $origen = $qOrigen ? $qOrigen->fetch_object() : null;

         if (!$origen) {
            throw new Exception('Cuenta corresponsal origen no encontrada');
         }

         if (strtoupper($origen->str_estado) === 'INACTIVO') {
            throw new Exception('La cuenta corresponsal origen está inactiva');
         }

         $sqlDestino = "SELECT idahorro, id_cuenta, str_estado
                        FROM tbl_ahorros
                        WHERE idglobal=$idglobal AND idahorro=$idahorroDestino
                        LIMIT 1";
         $qDestino = $conexion->query($sqlDestino);
         $destino = $qDestino ? $qDestino->fetch_object() : null;

         if (!$destino) {
            throw new Exception('Cuenta destino no encontrada');
         }

         if (strtoupper($destino->str_estado) === 'INACTIVO') {
            throw new Exception('La cuenta destino está inactiva');
         }

         $sqlSaldo = "SELECT IFNULL(SUM(
                        CASE m.str_tipo
                           WHEN 'aporte' THEN m.dec_valor
                           WHEN 'ajuste' THEN m.dec_valor
                           WHEN 'retiro' THEN m.dec_valor
                           ELSE 0 END
                     ),0) AS saldo
                     FROM tbl_movimientos m
                     WHERE m.idglobal=$idglobal
                       AND m.idahorro=$idahorroOrigen
                       AND UPPER(m.str_estado) <> 'INACTIVO'";
         $qSaldo = $conexion->query($sqlSaldo);
         $saldo = $qSaldo ? floatval(($qSaldo->fetch_object()->saldo ?? 0)) : 0;

         if ($saldo < $monto) {
            throw new Exception('Saldo insuficiente para completar la transferencia');
         }

         $montoSql = number_format($monto, 2, '.', '');
         $descRetiro = mysqli_real_escape_string($conexion, "Transferencia enviada a cuenta {$destino->id_cuenta}");
         $descAporte = mysqli_real_escape_string($conexion, "Transferencia recibida desde cuenta {$origen->id_cuenta}");

         $sqlRetiro = "INSERT INTO tbl_movimientos(
                        idglobal,idahorro,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
                     ) VALUES (
                        $idglobal,$idahorroOrigen,$idusuarioCreated,'retiro',-$montoSql,'$descRetiro',NULL,'activo','$dt','$dt'
                     )";
         $conexion->query($sqlRetiro) or throw new Exception('No se pudo registrar el retiro en cuenta corresponsal');

         $sqlAporte = "INSERT INTO tbl_movimientos(
                        idglobal,idahorro,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
                     ) VALUES (
                        $idglobal,$idahorroDestino,$idusuarioCreated,'aporte',$montoSql,'$descAporte',NULL,'activo','$dt','$dt'
                     )";
         $conexion->query($sqlAporte) or throw new Exception('No se pudo registrar el aporte en cuenta destino');

         $sqlUpd = "UPDATE tbl_ahorros SET update_at='$dt' WHERE idahorro IN ($idahorroOrigen, $idahorroDestino)";
         $conexion->query($sqlUpd) or throw new Exception('No se pudo actualizar el estado de las cuentas');
      } catch (Exception $e) {
         $sw = false;
         $conexion->rollback();
         return ['status' => 'error', 'mensaje' => $e->getMessage()];
      }

      if ($sw) {
         $conexion->commit();
      }

      return [
         'status' => 'success',
         'mensaje' => 'Transferencia realizada correctamente',
         'monto' => floatval($monto)
      ];
   }

   public function entregarRetiroTemporal($idglobal, $idpersonaCorresponsal, $idCuentaDestino, $monto, $codigoTemporal, $idusuarioEntrega)
   {
      global $conexion;

      $idglobal = intval($idglobal);
      $idpersonaCorresponsal = intval($idpersonaCorresponsal);
      $idusuarioEntrega = intval($idusuarioEntrega);
      $idCuentaDestino = trim((string)$idCuentaDestino);
      $monto = floatval($monto);
      $codigoTemporal = preg_replace('/\s+/', '', trim((string)$codigoTemporal));

      if ($idglobal <= 0 || $idpersonaCorresponsal <= 0 || $idusuarioEntrega <= 0 || $idCuentaDestino === '' || $monto <= 0 || $codigoTemporal === '') {
         return ['status' => 'error', 'mensaje' => 'Datos inválidos para retiro'];
      }

      if (!ctype_digit($codigoTemporal)) {
         return ['status' => 'error', 'mensaje' => 'El código temporal debe ser numérico'];
      }

      $codigoInt = intval($codigoTemporal);
      $sw = true;
      $conexion->autocommit(false);
      $dt = date('Y-m-d H:i:s');
      $limiteVigencia = date('Y-m-d H:i:s', strtotime('-30 minutes'));

      try {
         $sqlCorresponsal = "SELECT a.idahorro, a.str_name
                            FROM tbl_ahorros a
                            WHERE a.idglobal=$idglobal
                              AND a.idpersona=$idpersonaCorresponsal
                              AND a.str_tipo='corresponsal'
                              AND UPPER(IFNULL(a.str_estado, '')) <> 'INACTIVO'
                            LIMIT 1";
         $qCorresponsal = $conexion->query($sqlCorresponsal);
         $corresponsal = $qCorresponsal ? $qCorresponsal->fetch_object() : null;
         if (!$corresponsal) {
            throw new Exception('No tiene una cuenta corresponsal activa para entregar retiros');
         }
         $nombreCorresponsal = trim((string)($corresponsal->str_name ?? ''));
         if ($nombreCorresponsal === '') {
            $nombreCorresponsal = 'Corresponsal';
         }

         // Cierra automaticamente codigos vencidos para no dejar pendientes incompletos.
         $sqlExpirar = "UPDATE tbl_movimientos
                        SET str_estado='inactivo', update_at='$dt'
                        WHERE idglobal=$idglobal
                          AND str_tipo='retiro'
                          AND int_codigo=$codigoInt
                          AND UPPER(IFNULL(str_estado, ''))='PENDIENTE'
                          AND COALESCE(created_at, date_movimiento) < '$limiteVigencia'";
         $conexion->query($sqlExpirar);

         $sqlPorCodigo = "SELECT m.idmovimiento, m.idahorro, m.dec_valor, m.str_estado, m.created_at,
                                 a.id_cuenta,
                                 p.str_nombres,
                                 p.str_apellidos
                          FROM tbl_movimientos m
                          INNER JOIN tbl_ahorros a ON a.idahorro = m.idahorro AND a.idglobal = m.idglobal
                          LEFT JOIN tbl_persona p ON p.idpersona = a.idpersona
                          WHERE m.idglobal=$idglobal
                            AND m.str_tipo='retiro'
                            AND m.int_codigo=$codigoInt
                            AND UPPER(IFNULL(m.str_estado, '')) = 'PENDIENTE'
                                          AND COALESCE(m.created_at, m.date_movimiento) >= '$limiteVigencia'
                          ORDER BY m.idmovimiento DESC
                          LIMIT 1";
         $qMovimiento = $conexion->query($sqlPorCodigo);
         $movimiento = $qMovimiento ? $qMovimiento->fetch_object() : null;

         if (!$movimiento) {
            throw new Exception('El código temporal no existe, ya fue usado o expiró (30 minutos)');
         }

         $cuentaEsperada = trim((string)($movimiento->id_cuenta ?? ''));
         if ($cuentaEsperada !== $idCuentaDestino) {
            throw new Exception('La cuenta ingresada no coincide con la del código temporal');
         }

         $montoEsperado = abs(floatval($movimiento->dec_valor ?? 0));
         if (abs($montoEsperado - $monto) > 0.01) {
            throw new Exception('El valor ingresado no coincide con el valor del código temporal');
         }

         $nombreCliente = trim((string)($movimiento->str_nombres ?? '') . ' ' . (string)($movimiento->str_apellidos ?? ''));
         if ($nombreCliente === '') {
            $nombreCliente = 'Cliente';
         }

         $descEntrega = mysqli_real_escape_string(
            $conexion,
            'Retiro corresponsal. ' . $nombreCorresponsal . ' | Cód: ' . $codigoInt
         );

         $sqlUpdate = "UPDATE tbl_movimientos
                       SET str_estado='activo',
                           str_descripcion='$descEntrega',
                           update_at='$dt'
                       WHERE idmovimiento=" . intval($movimiento->idmovimiento) . "
                         AND idglobal=$idglobal";
         $conexion->query($sqlUpdate) or throw new Exception('No se pudo confirmar la entrega del retiro');

         $descCorresponsal = mysqli_real_escape_string(
            $conexion,
            'Aporte por entrega de retiro. Cuenta: ' . $movimiento->id_cuenta . ' | Código: ' . $codigoInt . ' | Monto: ' . number_format($monto, 2, '.', '')
         );
         $sqlRegistroCorresponsal = "INSERT INTO tbl_movimientos(
                                       idglobal,idahorro,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
                                    ) VALUES (
                                       $idglobal," . intval($corresponsal->idahorro) . ",$idusuarioEntrega,'aporte'," . number_format($monto, 2, '.', '') . ",'$descCorresponsal',$codigoInt,'activo','$dt','$dt'
                                    )";
         $conexion->query($sqlRegistroCorresponsal) or throw new Exception('No se pudo registrar el movimiento del corresponsal');

         $sqlUpdAhorro = "UPDATE tbl_ahorros SET update_at='$dt' WHERE idahorro=" . intval($movimiento->idahorro);
         $conexion->query($sqlUpdAhorro);

         $sqlUpdCorresponsal = "UPDATE tbl_ahorros SET update_at='$dt' WHERE idahorro=" . intval($corresponsal->idahorro);
         $conexion->query($sqlUpdCorresponsal);
      } catch (Exception $e) {
         $sw = false;
         $conexion->rollback();
         return ['status' => 'error', 'mensaje' => $e->getMessage()];
      }

      if ($sw) {
         $conexion->commit();
      }

      return [
         'status' => 'success',
         'mensaje' => 'Retiro entregado correctamente',
         'codigo_temporal' => (string)$codigoInt,
         'monto' => floatval($monto)
      ];
   }
}
