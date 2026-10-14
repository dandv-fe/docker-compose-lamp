<?php
require "Conexion.php";

class MainAccountCorriente
{
   public function __construct() {}

   private function expirarRetirosTemporalesPendientes($idglobal, $idahorro = 0)
   {
      global $conexion;

      $idglobal = intval($idglobal);
      $idahorro = intval($idahorro);
      if ($idglobal <= 0) {
         return;
      }

      $limiteVigencia = date('Y-m-d H:i:s', strtotime('-30 minutes'));
      $filtroAhorro = $idahorro > 0 ? " AND idahorro=$idahorro" : '';

      $sql = "UPDATE tbl_movimientos
              SET str_estado='inactivo', update_at=NOW()
              WHERE idglobal=$idglobal
                $filtroAhorro
                AND LOWER(IFNULL(str_tipo, ''))='retiro'
                AND UPPER(IFNULL(str_estado, ''))='PENDIENTE'
                AND IFNULL(int_codigo, 0) > 0
                AND COALESCE(created_at, date_movimiento) < '$limiteVigencia'";
      $conexion->query($sql);
   }

   private function generarCodigoRetiro($idglobal)
   {
      global $conexion;
      $idglobal = intval($idglobal);
      $maxIntentos = 20;
      $limiteVigencia = date('Y-m-d H:i:s', strtotime('-30 minutes'));

      for ($i = 0; $i < $maxIntentos; $i++) {
         $codigo = random_int(100000, 999999);
         $sql = "SELECT idmovimiento
                 FROM tbl_movimientos
                 WHERE idglobal=$idglobal
                   AND int_codigo=$codigo
                            AND COALESCE(created_at, date_movimiento) >= '$limiteVigencia'
                 LIMIT 1";
         $q = $conexion->query($sql);
         $existe = $q ? $q->fetch_object() : null;
         if (!$existe) {
            return $codigo;
         }
      }

      return 0;
   }
   public function registrar(int $idglobal, int $idpersona)
   {
      global $conexion;
      $sw = true;
      $conexion->autocommit(false);
      $dt = date('Y-m-d H:i:s');
      $idahorro = null;
      try {
         // Verificar si ya tiene ahorro
         $sqlExist = "SELECT idahorro FROM tbl_ahorros WHERE idglobal=$idglobal AND idpersona=$idpersona AND str_tipo='principal'";
         $qExist = $conexion->query($sqlExist);
         $rExist = $qExist ? $qExist->fetch_object() : null;
         if ($rExist && !empty($rExist->idahorro)) {
            echo json_encode(['status' => 'error', 'mensaje' => 'Ya existe una cuenta de principal para esta empresa']);
            return false;
         }

         $sqlIdCuenta = "SELECT id_cuenta FROM tbl_ahorros
         WHERE id_cuenta LIKE '%0' ORDER BY idahorro DESC LIMIT 1";
         $qIdCuenta = $conexion->query($sqlIdCuenta);
         $ultimoIdCuenta = $qIdCuenta ? $qIdCuenta->fetch_object()->id_cuenta : null;
         // Generar nuevo id_cuenta a partir del último: quitar último dígito, sumar 1, añadir '0'
         $strUltimo = $ultimoIdCuenta !== null ? (string)$ultimoIdCuenta : '';
         if ($strUltimo === '') {
            // No existe cuenta previa -> devolver error
            echo json_encode(['status' => 'error', 'mensaje' => 'No existe cuenta previa para generar id_cuenta']);
            $conexion->rollback();
            if ($conexion != null) {
               $conexion->close();
            }
            return false;
         }

         $idCuenta = (intval($strUltimo) + 10);
         $idCuenta = strval($idCuenta);
         $sqlIns = "INSERT INTO tbl_ahorros (
                   idglobal,idpersona,dec_porcentaje,
                   str_name,
                   id_cuenta,
                   str_tipo,
                   str_pago_utilidad,
                   bit_auth_movimientos, str_estado, created_at, update_at
                 ) VALUES (
                   $idglobal,$idpersona,0,
                   'Cuenta Principal',
                  '$idCuenta',
                   'principal',
                   'manual',
                  1,'activo','$dt','$dt'
                 )";
         $conexion->query($sqlIns) or throw new Exception('error!');
      } catch (Exception $e) {
         $sw = false;
         $conexion->rollback();
      }

      if ($sw) {
         $conexion->commit();
      }

      if ($conexion != null) {
         $conexion->close();
      }

      $msg = $sw ? ['status' => 'success', 'idahorro' => $idahorro, 'mensaje' => 'Cuenta principal creada'] : ['status' => 'error', 'mensaje' => 'ERROR: Cuenta principal no ha podido ser creada.'];
      echo json_encode($msg);
   }
   public function goAccount($idglobal, $idpersona)
   {
      global $conexion;
      $this->expirarRetirosTemporalesPendientes($idglobal);
      $sql = "SELECT *,
               (SELECT IFNULL(SUM(
                  CASE m.str_tipo
                     WHEN 'aporte' THEN m.dec_valor
                     WHEN 'ajuste' THEN m.dec_valor
                     WHEN 'retiro' THEN -m.dec_valor
                     WHEN 'entrada' THEN m.dec_valor
                     WHEN 'salida' THEN -m.dec_valor
                     ELSE 0 END
               ),0) FROM tbl_movimientos m WHERE m.idglobal=$idglobal AND m.idahorro=a.idahorro AND UPPER(m.str_estado) <> 'INACTIVO'
               AND NOT (
                  LOWER(IFNULL(m.str_tipo, '')) = 'retiro'
                  AND UPPER(IFNULL(m.str_estado, '')) = 'PENDIENTE'
                  AND IFNULL(m.int_codigo, 0) > 0
               ))
               +(SELECT IFNULL(SUM(
                  CASE m2.str_tipo
                     WHEN 'aporte' THEN -m2.dec_valor
                     WHEN 'ajuste' THEN -m2.dec_valor
                     WHEN 'retiro' THEN m2.dec_valor
                     ELSE 0 END
               ),0)
               FROM tbl_movimientos m2
               WHERE m2.idglobal=$idglobal
                 AND m2.idahorro_de=a.idahorro
                 AND UPPER(IFNULL(m2.str_estado, '')) <> 'INACTIVO') AS saldo 
      FROM `tbl_ahorros` a
      WHERE a.idglobal=$idglobal 
      AND a.idpersona=$idpersona 
      AND a.str_tipo='corriente'";
      $query = $conexion->query($sql);
      return $query;
   }
   public function buscarCuentaDestino($idglobal, $id_cuenta)
   {
      global $conexion;
      $sql = "SELECT
                  a.idahorro,
                  a.idpersona,
                  a.id_cuenta,
                  p.str_nombres AS nombres,
                  p.str_apellidos AS apellidos
               FROM tbl_ahorros a
               INNER JOIN tbl_persona p ON p.idpersona = a.idpersona
               WHERE a.idglobal=$idglobal
                 AND a.id_cuenta='$id_cuenta'
                 AND UPPER(a.str_estado) <> 'INACTIVO'
               LIMIT 1";
      return $conexion->query($sql);
   }

   public function obtenerResumenSaldos($idglobal, $idpersona)
   {
      global $conexion;
      $this->expirarRetirosTemporalesPendientes($idglobal);

      $sql = "SELECT
                 IFNULL(SUM(CASE WHEN LOWER(a.str_tipo) = 'corriente' THEN s.saldo ELSE 0 END), 0) AS principal,
                 IFNULL(SUM(CASE WHEN LOWER(a.str_tipo) = 'corresponsal' THEN s.saldo ELSE 0 END), 0) AS corresponsales,
                 IFNULL(SUM(CASE WHEN LOWER(IFNULL(a.str_tipo, 'ahorro')) IN ('ahorro', 'corriente') AND a.idpersona <> $idpersona THEN s.saldo ELSE 0 END), 0) AS ahorradores,
                 IFNULL(SUM(CASE WHEN LOWER(a.str_tipo) = 'ahorro' AND a.idpersona = $idpersona THEN s.saldo ELSE 0 END), 0) AS mi_ahorros
              FROM tbl_ahorros a
              LEFT JOIN (
                 SELECT
                    a2.idahorro,
                    (SELECT IFNULL(SUM(
                       CASE m.str_tipo
                          WHEN 'aporte' THEN m.dec_valor
                          WHEN 'ajuste' THEN m.dec_valor
                          WHEN 'retiro' THEN -m.dec_valor
                          WHEN 'entrada' THEN m.dec_valor
                          WHEN 'salida' THEN -m.dec_valor
                          ELSE 0
                       END
                    ), 0)
                     FROM tbl_movimientos m
                     WHERE m.idglobal = $idglobal
                       AND m.idahorro = a2.idahorro
                       AND UPPER(IFNULL(m.str_estado, '')) <> 'INACTIVO'
                       AND NOT (
                          LOWER(IFNULL(m.str_tipo, '')) = 'retiro'
                          AND UPPER(IFNULL(m.str_estado, '')) = 'PENDIENTE'
                          AND IFNULL(m.int_codigo, 0) > 0
                       ))
                    +(SELECT IFNULL(SUM(
                       CASE m2.str_tipo
                          WHEN 'aporte' THEN -m2.dec_valor
                          WHEN 'ajuste' THEN -m2.dec_valor
                          WHEN 'retiro' THEN m2.dec_valor
                          ELSE 0
                       END
                    ), 0)
                     FROM tbl_movimientos m2
                     WHERE m2.idglobal = $idglobal
                       AND m2.idahorro_de = a2.idahorro
                       AND UPPER(IFNULL(m2.str_estado, '')) <> 'INACTIVO') AS saldo
                 FROM tbl_ahorros a2
                 WHERE a2.idglobal = $idglobal
                   AND UPPER(IFNULL(a2.str_estado, '')) <> 'INACTIVO'
              ) s ON s.idahorro = a.idahorro
              WHERE a.idpersona = $idpersona
               AND UPPER(a.str_estado) <> 'INACTIVO'";

      $query = $conexion->query($sql);
      $row = $query ? $query->fetch_object() : null;

      $principal = floatval($row->principal ?? 0);
      $corresponsales = floatval($row->corresponsales ?? 0);
      $ahorradores = floatval($row->ahorradores ?? 0);
      $miAhorros = floatval($row->mi_ahorros ?? 0);
      $saldoDisponible = $principal;
      $subtotal = $corresponsales + $ahorradores + $miAhorros;

      return [
         'status' => 'success',
         'corresponsales' => $corresponsales,
         'ahorradores' => $ahorradores,
         'mi_ahorros' => $miAhorros,
         'saldo_disponible' => $saldoDisponible,
         'subtotal' => $subtotal
      ];
   }

   public function listarMovimientosPorAhorro($idglobal, $idahorro)
   {
      global $conexion;
      $this->expirarRetirosTemporalesPendientes($idglobal, $idahorro);

      $sql = "SELECT
                  idmovimiento,
                  idglobal,
                  idahorro,
                  idahorro_de,
                  idusuario_created,
                  date_movimiento,
                  str_tipo,
                  dec_valor,
                  str_descripcion,
                  int_codigo,
                  str_estado,
                  created_at,
                  update_at
                     FROM tbl_movimientos m
                     WHERE m.idglobal=$idglobal
                        AND (m.idahorro=$idahorro OR m.idahorro_de=$idahorro)
                        AND NOT (
                            LOWER(IFNULL(m.str_tipo, '')) = 'retiro'
                            AND UPPER(IFNULL(m.str_estado, '')) = 'PENDIENTE'
                            AND IFNULL(m.int_codigo, 0) > 0
                        )
              ORDER BY date_movimiento DESC, idmovimiento DESC";

      return $conexion->query($sql);
   }

   public function obtenerRetiroTemporalVigente($idglobal, $idahorro)
   {
      global $conexion;

      $idglobal = intval($idglobal);
      $idahorro = intval($idahorro);
      if ($idglobal <= 0 || $idahorro <= 0) {
         return null;
      }

      $this->expirarRetirosTemporalesPendientes($idglobal, $idahorro);

      $limiteVigencia = date('Y-m-d H:i:s', strtotime('-30 minutes'));
      $sql = "SELECT
                  idmovimiento,
                  int_codigo,
                  COALESCE(created_at, date_movimiento) AS fecha_base,
                  DATE_ADD(COALESCE(created_at, date_movimiento), INTERVAL 30 MINUTE) AS vence_en,
                  ABS(dec_valor) AS monto
              FROM tbl_movimientos
              WHERE idglobal=$idglobal
                AND idahorro=$idahorro
                AND LOWER(IFNULL(str_tipo, ''))='codigo'
                AND UPPER(IFNULL(str_estado, ''))='PENDIENTE'
                AND IFNULL(int_codigo, 0) > 0
                AND COALESCE(created_at, date_movimiento) >= '$limiteVigencia'
              ORDER BY idmovimiento DESC
              LIMIT 1";

      $query = $conexion->query($sql);
      return $query ? $query->fetch_object() : null;
   }

   public function registrarMovimientoRA($idglobal, $idahorro, $idusuario_created, $tipo, $valor, $descripcion, $estado = 'activo')
   {
      // Inserta movimiento; actualización de acumulado se realiza en AhorrosAjax.php
      global $conexion;
      $dt = date('Y-m-d H:i:s');
      $sql = "INSERT INTO tbl_movimientos(
                idglobal,idahorro,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
              ) VALUES (
                $idglobal,$idahorro,$idusuario_created,'$tipo',$valor,'$descripcion',NULL,'$estado','$dt','$dt'
              )";
      return $conexion->query($sql);
   }

   public function registrarRetiroTemporal($idglobal, $idahorro, $idusuarioCreated, $valor, $descripcion)
   {
      global $conexion;

      $idglobal = intval($idglobal);
      $idahorro = intval($idahorro);
      $idusuarioCreated = intval($idusuarioCreated);
      $valor = floatval($valor);
      $descripcion = trim((string)$descripcion);

      if ($idglobal <= 0 || $idahorro <= 0 || $idusuarioCreated <= 0 || $valor <= 0 || $descripcion === '') {
         return ['status' => 'error', 'mensaje' => 'Datos inválidos para generar el retiro'];
      }

      $this->expirarRetirosTemporalesPendientes($idglobal, $idahorro);

      // Verificar si ya existe un código vigente: no generar otro
      $vigente = $this->obtenerRetiroTemporalVigente($idglobal, $idahorro);
      if ($vigente) {
         return [
            'status'          => 'codigo_ya_vigente',
            'mensaje'         => 'Ya existe un código de retiro vigente. Presente este código al corresponsal.',
            'codigo_temporal' => (string)$vigente->int_codigo,
            'vence_en'        => (string)$vigente->vence_en,
            'monto'           => floatval($vigente->monto ?? 0),
         ];
      }

      $sw = true;
      $conexion->autocommit(false);
      $dt = date('Y-m-d H:i:s');
      $idmovimiento = 0;

      try {
         $sqlCuenta = "SELECT a.idahorro, a.id_cuenta, a.str_estado,
                                           p.str_email,
                                           CAST(IFNULL(p.str_email_verificado, '0') AS UNSIGNED) AS email_verificado
                      FROM tbl_ahorros
                                 a
                                 INNER JOIN tbl_persona p ON p.idpersona = a.idpersona
                                 WHERE a.idglobal=$idglobal
                                    AND a.idahorro=$idahorro
                                    AND a.str_tipo='corriente'
                      LIMIT 1";
         $qCuenta = $conexion->query($sqlCuenta);
         $cuenta = $qCuenta ? $qCuenta->fetch_object() : null;

         if (!$cuenta) {
            throw new Exception('Cuenta corriente no encontrada');
         }

         if (strtoupper($cuenta->str_estado) === 'INACTIVO') {
            throw new Exception('La cuenta está inactiva');
         }

         $email = trim((string)($cuenta->str_email ?? ''));
         $emailVerificado = intval($cuenta->email_verificado ?? 0);
         if ($email === '' || $emailVerificado !== 1) {
            throw new Exception('Debe tener email verificado para generar el retiro temporal');
         }

         $sqlSaldo = "SELECT IFNULL(SUM(
                        CASE m.str_tipo
                           WHEN 'aporte' THEN m.dec_valor
                           WHEN 'ajuste' THEN m.dec_valor
                     WHEN 'retiro' THEN -m.dec_valor
                     WHEN 'entrada' THEN m.dec_valor
                     WHEN 'salida' THEN -m.dec_valor
                           ELSE 0 END
                  ),0)
                  +(SELECT IFNULL(SUM(
                  CASE m2.str_tipo
                     WHEN 'aporte' THEN -m2.dec_valor
                     WHEN 'ajuste' THEN -m2.dec_valor
                     WHEN 'retiro' THEN m2.dec_valor
                     ELSE 0 END
                  ),0)
                  FROM tbl_movimientos m2
                  WHERE m2.idglobal=$idglobal
                    AND m2.idahorro_de=$idahorro
                    AND UPPER(IFNULL(m2.str_estado, '')) <> 'INACTIVO') AS saldo
                     FROM tbl_movimientos m
                     WHERE m.idglobal=$idglobal
                       AND m.idahorro=$idahorro
                       AND UPPER(IFNULL(m.str_estado, '')) <> 'INACTIVO'
                       AND NOT (
                          LOWER(IFNULL(m.str_tipo, '')) = 'codigo'
                          AND UPPER(IFNULL(m.str_estado, '')) = 'PENDIENTE'
                          AND IFNULL(m.int_codigo, 0) > 0
                       )";
         $qSaldo = $conexion->query($sqlSaldo);
         $saldo = $qSaldo ? floatval(($qSaldo->fetch_object()->saldo ?? 0)) : 0;

         if ($saldo < $valor) {
            throw new Exception('Saldo insuficiente para generar el retiro');
         }

         $codigo = $this->generarCodigoRetiro($idglobal);
         if ($codigo <= 0) {
            throw new Exception('No fue posible generar un código temporal');
         }

         $valorSql = number_format($valor, 2, '.', '');
         $fechaExpira = date('Y-m-d H:i:s', strtotime('+30 minutes'));
         $descSegura = mysqli_real_escape_string($conexion, $descripcion . ' | Código temporal: ' . $codigo . ' | Expira: ' . $fechaExpira);

         $sqlRetiro = "INSERT INTO tbl_movimientos(
                        idglobal,idahorro,idahorro_de,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
                      ) VALUES (
                        $idglobal,$idahorro,$idahorro,$idusuarioCreated,'codigo',$valorSql,'$descSegura',$codigo,'pendiente','$dt','$dt'
                      )";
         $conexion->query($sqlRetiro) or throw new Exception('No se pudo generar el retiro temporal');
         $idmovimiento = intval($conexion->insert_id);

         $sqlUpd = "UPDATE tbl_ahorros SET update_at='$dt' WHERE idahorro=$idahorro";
         $conexion->query($sqlUpd) or throw new Exception('No se pudo actualizar la cuenta');
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
         'mensaje' => 'Retiro temporal generado correctamente',
         'idmovimiento' => $idmovimiento,
         'codigo_temporal' => (string)$codigo,
         'vence_en' => $fechaExpira,
         'monto' => floatval($valor),
         'email' => $email,
         'id_cuenta' => (string)$cuenta->id_cuenta
      ];
   }

   public function anularRetiroTemporalPendiente($idglobal, $idahorro, $idmovimiento, $idusuarioUpdated = 0)
   {
      global $conexion;

      $idglobal = intval($idglobal);
      $idahorro = intval($idahorro);
      $idMovimiento = intval($idmovimiento);
      $idusuarioUpdated = intval($idusuarioUpdated);

      if ($idglobal <= 0 || $idahorro <= 0 || $idMovimiento <= 0) {
         return false;
      }

      $dt = date('Y-m-d H:i:s');
      $sql = "UPDATE tbl_movimientos
               SET str_estado='inactivo', update_at='$dt'
              WHERE idglobal=$idglobal
                AND idahorro=$idahorro
                        AND idmovimiento=$idMovimiento
                AND str_tipo='retiro'
                AND str_estado='pendiente'";

      $ok = $conexion->query($sql);
      if ($ok) {
         $conexion->query("UPDATE tbl_ahorros SET update_at='$dt' WHERE idahorro=$idahorro AND idglobal=$idglobal");
      }

      return (bool)$ok;
   }

   public function finalizarEnvioPrincipal($idglobal, $idahorroOrigen, $idahorroDestino, $idusuarioCreated, $monto, $descripcion = '')
   {
      global $conexion;

      $this->expirarRetirosTemporalesPendientes($idglobal, $idahorroOrigen);

      if ($idahorroOrigen <= 0 || $idahorroDestino <= 0 || $monto <= 0) {
         return ['status' => 'error', 'mensaje' => 'Parámetros inválidos'];
      }

      if ($idahorroOrigen === $idahorroDestino) {
         return ['status' => 'error', 'mensaje' => 'La cuenta destino no puede ser la misma cuenta origen'];
      }

      $sw = true;
      $conexion->autocommit(false);
      $dt = date('Y-m-d H:i:s');

      try {
         $sqlOrigen = "SELECT idahorro, id_cuenta, str_tipo, str_estado
                       FROM tbl_ahorros
                       WHERE idahorro=$idahorroOrigen
                       LIMIT 1";
         $qOrigen = $conexion->query($sqlOrigen);
         $origen = $qOrigen ? $qOrigen->fetch_object() : null;

         if (!$origen) {
            throw new Exception('Cuenta origen no encontrada');
         }

         if (strtolower($origen->str_tipo) !== 'corriente') {
            throw new Exception('La cuenta origen no es una cuenta principal válida');
         }

         if (strtoupper($origen->str_estado) === 'INACTIVO') {
            throw new Exception('La cuenta origen está inactiva');
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
                     WHEN 'retiro' THEN -m.dec_valor
                     WHEN 'entrada' THEN m.dec_valor
                     WHEN 'salida' THEN -m.dec_valor
                           ELSE 0 END
                  ),0)
                  +(SELECT IFNULL(SUM(
                  CASE m2.str_tipo
                     WHEN 'aporte' THEN -m2.dec_valor
                     WHEN 'ajuste' THEN -m2.dec_valor
                     WHEN 'retiro' THEN m2.dec_valor
                     ELSE 0 END
                  ),0)
                  FROM tbl_movimientos m2
                  WHERE m2.idglobal=$idglobal
                    AND m2.idahorro_de=$idahorroOrigen
                    AND UPPER(IFNULL(m2.str_estado, '')) <> 'INACTIVO') AS saldo
                     FROM tbl_movimientos m
                     WHERE m.idglobal=$idglobal
                       AND m.idahorro=$idahorroOrigen
                       AND UPPER(m.str_estado) <> 'INACTIVO'
                       AND NOT (
                          LOWER(IFNULL(m.str_tipo, '')) = 'retiro'
                          AND UPPER(IFNULL(m.str_estado, '')) = 'PENDIENTE'
                          AND IFNULL(m.int_codigo, 0) > 0
                       )";
         $qSaldo = $conexion->query($sqlSaldo);
         $saldo = $qSaldo ? floatval(($qSaldo->fetch_object()->saldo ?? 0)) : 0;

         if ($saldo < $monto) {
            throw new Exception('Saldo insuficiente para completar la transferencia');
         }

         $montoSql = number_format($monto, 2, '.', '');
         $descripcion = trim((string)$descripcion);
         /*
         $sqlRetiro = "INSERT INTO tbl_movimientos(
                        idglobal,idahorro,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
                     ) VALUES (
                        $idglobal,$idahorroOrigen,$idusuarioCreated,'retiro',-$montoSql,'$descRetiro',NULL,'activo','$dt','$dt'
                     )";
         $conexion->query($sqlRetiro) or throw new Exception('No se pudo registrar el retiro en cuenta origen');
*/
         $sqlAporte = "INSERT INTO tbl_movimientos(
                        idglobal,idahorro,idahorro_de,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
                     ) VALUES (
                        $idglobal,$idahorroDestino,$idahorroOrigen,$idusuarioCreated,'aporte',$montoSql,'$descripcion',NULL,'activo','$dt','$dt'
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
}
/*
1

*/
