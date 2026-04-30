<?php
require "Conexion.php";

class Ahorradores
{


   public function __construct() {}

   public function Registrar(
      $nombres,
      $apellidos,
      $sexo,
      $fecha_nacimiento,
      $tipo_documento,
      $num_documento,
      $direccion_departamento,
      $direccion_siudad,
      $direccion_barrio,
      $direccion_calle,
      $telefono,
      $email,
      $ruta_carga,
      $ocupacion,
      $nota,
      //$estado,
      $login,
      $idglobal
   ) {
      global $conexion;
      $sw = true;
      $conexion->autocommit(false);
      $dt = date('Y-m-d H:i:s');
      $idCuenta = '';

      try {
         $sql = "SELECT idpersona 
            FROM tbl_persona
             WHERE idglobal=$idglobal AND 
             str_num_documento='$num_documento'
             ";
         $query = $conexion->query($sql);
         $request = $query->fetch_object();

         if (isset($request->idpersona)) {
            echo "ERROR: Documento de Persona existe";
            return;
         }

         $sql = "SELECT idpersona FROM tbl_persona WHERE idglobal=$idglobal AND str_email='$email'";
         $query = $conexion->query($sql);
         $request = $query->fetch_object();
         if (isset($request->idpersona) && $email != '') {
            echo "ERROR: Este Email ya existe";
            return;
         }

         $sql = "SELECT idusuario 
            FROM tbl_usuario 
            WHERE idglobal=$idglobal AND 
            str_user_name='$login' ";
         $query = $conexion->query($sql);
         $res = $query->fetch_object();
         if (isset($res->idusuario) && $email != '') {
            echo "ERROR: Este Nombre usuario esta en uso busque otro";
            return;
         }



         $sql = "INSERT INTO `tbl_persona`(idglobal, str_nombres, str_apellidos,
                str_sexo, str_fecha_nacimiento, str_tipo_documento, str_num_documento,
                str_telefono, str_email, str_foto, str_ocupacion, str_estado,
                str_nota, str_direccion_departamento, str_direccion_ciudad, 
                str_direccion_barrio,  str_direccion_calle, str_email_verificado,
                created_at, update_at
                )
                 VALUES ($idglobal,'$nombres', '$apellidos', 
                 '$sexo', '$fecha_nacimiento', '$tipo_documento', '$num_documento', 
                 '$telefono', '$email', '$ruta_carga', '$ocupacion', 'activo', 
                 '$nota', '$direccion_departamento',  '$direccion_siudad',
                    '$direccion_barrio', '$direccion_calle', '', '$dt', '$dt'
                        )";
         $conexion->query($sql) or throw new Exception('error!');
         $idpersona = $conexion->insert_id;

         //$sqlIdCuenta = "SELECT id_cuenta FROM tbl_ahorros WHERE ORDER BY idahorro DESC LIMIT 1";
         $sqlIdCuenta = "SELECT id_cuenta FROM tbl_ahorros
         WHERE id_cuenta LIKE '%0' ORDER BY idahorro DESC LIMIT 1";
         $qIdCuenta = $conexion->query($sqlIdCuenta);
         $ultimoIdCuenta = $qIdCuenta ? $qIdCuenta->fetch_object()->id_cuenta : null;
         // Generar nuevo id_cuenta a partir del último: quitar último dígito, sumar 1, añadir '0'
         $strUltimo = $ultimoIdCuenta !== null ? intval($ultimoIdCuenta) : '';
         if ($strUltimo <= 0) {
            // No existe cuenta previa -> devolver error
            echo json_encode(['status' => 'error', 'mensaje' => 'No existe cuenta previa para generar id_cuenta']);
            $conexion->rollback();
            if ($conexion != null) {
               $conexion->close();
            }
            return false;
         }

         $idCuenta = ($strUltimo + 10);
         $idCuenta = strval($idCuenta);


         $sqlIns = "INSERT INTO tbl_ahorros (
                   idglobal,idpersona,dec_porcentaje,
                   str_name,
                   id_cuenta,
                   str_tipo,
                   str_pago_utilidad,
                   bit_auth_movimientos, str_estado, created_at, update_at
                 ) VALUES (
                   $idglobal,$idpersona,0.00,
                   'Cuenta Principal',
                   '$idCuenta',
                   'corriente',
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
      $msg = $sw ? 'Ahorrador Registrado correctamente.' : 'ERROR: Ahorrador no ha podido ser registado.';
      echo $msg;
      return $sw;
   }

   public function Modificar(
      $idpersona,
      $nombres,
      $apellidos,
      $sexo,
      $fecha_nacimiento,
      $tipo_documento,
      $num_documento,
      $direccion_departamento,
      $direccion_siudad,
      $direccion_barrio,
      $direccion_calle,
      $telefono,
      $email,
      $ruta_carga,
      $ocupacion,
      $nota,
      //$estado,
      $idusuario,
      $login,
      $password,

      $idglobal
   ) {
      global $conexion;
      $sw = true;
      $conexion->autocommit(false);
      $dt = date('Y-m-d H:i:s');
      try {

         $sql = "SELECT idusuario 
            FROM tbl_usuario 
            WHERE idglobal=$idglobal AND 
            str_user_name='$login' AND 
            idpersona<>$idpersona ";
         $query = $conexion->query($sql);
         $res = $query->fetch_object();
         if (isset($res->idusuario)) {
            echo "ERROR: Este Nombre usuario esta en uso busque otro";
            return;
         }

         $sql = "SELECT idpersona FROM tbl_persona
				 WHERE idglobal=$idglobal 
				 AND str_email='$email' 
				 AND  idpersona<>$idpersona";
         $query = $conexion->query($sql);
         $request = $query->fetch_object();
         if (isset($request->idpersona) && $email != '') {
            echo "ERROR: Este Email ya existe";
            return;
         }



         $sql = "UPDATE `tbl_persona` SET	
                str_nombres='$nombres',
                str_apellidos='$apellidos',
                str_sexo='$sexo',
                str_fecha_nacimiento='$fecha_nacimiento',
                str_tipo_documento='$tipo_documento',
                str_num_documento='$num_documento',
                str_telefono='$telefono',
                str_email='$email',
                str_foto='$ruta_carga',
                str_ocupacion='$ocupacion',
                str_nota='$nota',
                str_direccion_departamento='$direccion_departamento',
                str_direccion_ciudad='$direccion_siudad',
                str_direccion_barrio='$direccion_barrio',
                str_direccion_calle='$direccion_calle',
                update_at='$dt'
                WHERE idpersona=$idpersona";
         // Validar unicidad de documento dentro del mismo idglobal
         $sqlDoc = "SELECT idpersona FROM tbl_persona WHERE idglobal=" . intval($idglobal) . " AND str_tipo_documento='" . $conexion->real_escape_string($tipo_documento) . "' AND str_num_documento='" . $conexion->real_escape_string($num_documento) . "' AND idpersona<>" . intval($idpersona) . " LIMIT 1";
         $qDoc = $conexion->query($sqlDoc);
         $rDoc = $qDoc ? $qDoc->fetch_object() : null;
         if (!empty($rDoc->idpersona)) {
            echo "ERROR: Documento de Persona existe";
            return;
         }

         $conexion->query($sql) or throw new Exception('error!');



         $sql = "SELECT idusuario FROM tbl_usuario WHERE idglobal=$idglobal AND idpersona=$idpersona";
         $query = $conexion->query($sql);
         $request = $query->fetch_object();

         if (empty($request->idusuario)) {
            $sql = "INSERT INTO `tbl_usuario`(
                        idglobal,
                        idpersona,
                        str_user_name,
                        str_password,
                        str_terminos_condiciones,
                        str_estado
                  
                  )
                  VALUES ($idglobal, $idpersona, '$login', '$password', 'pendiente', 'activo')";
            $conexion->query($sql) or throw new Exception('error!');
         } else {
            $sql = "UPDATE `tbl_usuario` SET
                        str_user_name='$login',
                        str_password='$password'
                        WHERE idusuario=$idusuario
                  ";
            $conexion->query($sql) or throw new Exception('error!');
         }

         // Verificar si el ahorrador tiene un ahorro principal, si no, crear uno
         $sql = "SELECT idahorro FROM tbl_ahorros WHERE  idpersona=$idpersona AND str_tipo='corriente' LIMIT 1";
         $query = $conexion->query($sql);
         $request = $query->fetch_object();

         if (empty($request->idahorro)) {
            $idCuenta = '';
            //$sqlIdCuenta = "SELECT id_cuenta FROM tbl_ahorros WHERE ORDER BY idahorro DESC LIMIT 1";
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
                   $idglobal,$idpersona,0.00,
                   'Cuenta Principal',
                   '$idCuenta',
                   'corriente',
                   'manual',
                  1,'activo','$dt','$dt'
                 )";
            $conexion->query($sqlIns) or throw new Exception('error!');
         }
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
      $msg = $sw ? 'Ahorrador Actualizado correctamente.' : 'ERROR: Ahorrador no ha podido ser Actualizado.';
      echo $msg;
      return $sw;
   }

   public function Listar($idglobal)
   {
      global $conexion;

      $sql = "SELECT 
            p.idpersona AS refPersona,
            CONCAT(p.str_nombres,' ',p.str_apellidos) AS ahorrador,
         p.str_foto AS foto,
            p.str_tipo_documento AS tDocumento,
            p.str_num_documento AS nDocumento,
            p.str_telefono AS tel,
            p.str_email AS email,
            CONCAT(
               COALESCE(p.str_direccion_departamento,''),
               IF(p.str_direccion_departamento IS NOT NULL AND p.str_direccion_departamento<>'', ', ', ''),
               COALESCE(p.str_direccion_ciudad,''),
               IF(p.str_direccion_ciudad IS NOT NULL AND p.str_direccion_ciudad<>'', ', ', ''),
               COALESCE(p.str_direccion_barrio,''),
               IF(p.str_direccion_barrio IS NOT NULL AND p.str_direccion_barrio<>'', ', ', ''),
               COALESCE(p.str_direccion_calle,'')
            ) AS direccion,
            p.created_at AS fecha_creacion
         FROM tbl_persona p
         WHERE p.idglobal=$idglobal
           AND EXISTS (
              SELECT 1
              FROM tbl_ahorros a
              WHERE a.idpersona=p.idpersona
                AND a.idglobal=$idglobal
           )
         ORDER BY p.created_at DESC";
      $query = $conexion->query($sql);
      return $query;
   }

   public function buscarAhorrador($idpersona)
   {
      global $conexion;
      $sql = "SELECT idahorro as refAhorro,
                  dec_porcentaje as porcentaje,
                  str_pago_utilidad AS pagoUtilidad,
                  bit_auth_movimientos AS authMovimientos,
                  str_estado AS estadoAhorro,
                  created_at AS fechaCreacion,
                  (
                     SELECT IFNULL(SUM(
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
                     WHERE m2.idahorro_de = a.idahorro
                       AND UPPER(IFNULL(m2.str_estado, '')) <> 'INACTIVO')
                     FROM tbl_movimientos m
                     WHERE m.idahorro = a.idahorro
                       AND UPPER(IFNULL(m.str_estado, '')) <> 'INACTIVO'
                  ) AS saldoMovimientos,
                  (
                     SELECT IFNULL(SUM(
                        (SELECT IFNULL(SUM(
                           CASE mc.str_tipo
                              WHEN 'aporte' THEN mc.dec_valor
                              WHEN 'ajuste' THEN mc.dec_valor
                              WHEN 'retiro' THEN -mc.dec_valor
                              WHEN 'entrada' THEN mc.dec_valor
                              WHEN 'salida' THEN -mc.dec_valor
                              ELSE 0 END
                        ),0)
                        FROM tbl_movimientos mc
                        WHERE mc.idahorro = ac.idahorro
                          AND UPPER(IFNULL(mc.str_estado, '')) <> 'INACTIVO')
                        +
                        (SELECT IFNULL(SUM(
                           CASE mc2.str_tipo
                              WHEN 'aporte' THEN -mc2.dec_valor
                              WHEN 'ajuste' THEN -mc2.dec_valor
                              WHEN 'retiro' THEN mc2.dec_valor
                              ELSE 0 END
                        ),0)
                        FROM tbl_movimientos mc2
                        WHERE mc2.idahorro_de = ac.idahorro
                          AND UPPER(IFNULL(mc2.str_estado, '')) <> 'INACTIVO')
                     ),0)
                     FROM tbl_ahorros ac
                     WHERE ac.idpersona = a.idpersona
                       AND ac.idglobal = a.idglobal
                       AND LOWER(IFNULL(ac.str_tipo, '')) = 'corresponsal'
                       AND UPPER(IFNULL(ac.str_estado, '')) <> 'INACTIVO'
                  ) AS saldoCorresponsal
               FROM tbl_ahorros a
           WHERE idpersona=$idpersona";
      $query = $conexion->query($sql);
      return $query;
   }
   public function buscarPersona($idglobal, $tipo_documento, $num_documento)
   {
      global $conexion;

      $sql = "SELECT 
            p.idpersona AS refPersona,
            p.idglobal AS refGlobal,
            p.str_nombres AS nombres,
            p.str_apellidos AS apellidos,
            p.str_sexo AS sexo,
            p.str_fecha_nacimiento AS f_nacimiento,
            p.str_tipo_documento AS t_documento,
            p.str_num_documento AS n_documento,
            p.str_telefono AS telefono,
            p.str_email AS email,
            p.str_foto AS foto,
            p.str_ocupacion AS ocupacion,
            p.str_estado AS estado,
            p.str_nota AS nota,
            p.str_email_verificado AS e_verificado,
            p.str_direccion_departamento AS departamento,
            p.str_direccion_ciudad AS ciudad,
            p.str_direccion_barrio AS barrio,
            p.str_direccion_calle AS calle,
            p.created_at AS fecha_at,
            u.idusuario AS refUsuario,
            u.str_user_name AS username,
            u.str_password AS id,
            u.str_terminos_condiciones AS t_condiciones
         FROM tbl_persona p
         LEFT JOIN tbl_usuario u ON u.idpersona=p.idpersona 
         
         
         WHERE p.idglobal=$idglobal AND p.str_tipo_documento='$tipo_documento' AND p.str_num_documento='$num_documento'";
      $query = $conexion->query($sql);


      return $query;
   }

   public function actualizarConfiguracion($idahorro, $porcentaje, $pagoUtilidad, $authMov, $estado)
   {
      global $conexion;
      $dt = date('Y-m-d H:i:s');
      $sql = "UPDATE tbl_ahorros SET 
              dec_porcentaje=$porcentaje,
              str_pago_utilidad='$pagoUtilidad',
              bit_auth_movimientos=$authMov,
              str_estado='$estado',
              update_at='$dt'
              WHERE idahorro=$idahorro";
      return $conexion->query($sql);
   }

   public function listarMovimientos($idglobal, $idahorro)
   {
      global $conexion;
      $sql = "SELECT 
                date_movimiento AS fecha,
                str_tipo AS tipo,
                dec_valor AS monto,
                str_descripcion AS descripcion,
                        str_estado AS estado,
                        idahorro,
                        idahorro_de
              FROM tbl_movimientos
              WHERE idglobal=$idglobal AND (idahorro=$idahorro OR idahorro_de=$idahorro)
                AND UPPER(str_estado) <> 'INACTIVO'
              ORDER BY date_movimiento DESC";
      return $conexion->query($sql);
   }

   public function listarMovimientosPersona($idglobal, $idpersona)
   {
      global $conexion;
         $sql = "SELECT
                        m.idahorro,
                        m.idahorro_de,
                        m.date_movimiento AS fecha,
                        IFNULL(NULLIF(TRIM(a.id_cuenta), ''), CONCAT('Ahorro #', a.idahorro)) AS cuenta,
                        m.str_tipo AS tipo,
                        m.dec_valor AS monto,
                        CASE WHEN m.idahorro_de = a.idahorro AND m.idahorro <> m.idahorro_de THEN 1 ELSE 0 END AS isvia,
                        m.str_descripcion AS descripcion,
                        m.str_estado AS estado
                     FROM tbl_movimientos m
                     INNER JOIN tbl_ahorros a ON (a.idahorro = m.idahorro OR a.idahorro = m.idahorro_de)
                     WHERE m.idglobal=$idglobal
                        AND a.idglobal=$idglobal
                        AND a.idpersona=$idpersona
                     ORDER BY m.date_movimiento DESC";
      return $conexion->query($sql);
   }

   public function listarAhorrosPersona($idglobal, $idpersona)
   {
      global $conexion;
      $sql = "SELECT
                IFNULL(NULLIF(TRIM(str_name), ''), CONCAT('Ahorro #', idahorro)) AS nombre,
                IFNULL(NULLIF(TRIM(id_cuenta), ''), '-') AS numero,
                IFNULL(NULLIF(TRIM(str_tipo), ''), '-') AS tipo,
                IFNULL(NULLIF(TRIM(str_pago_utilidad), ''), '-') AS pago_utilidad,
                bit_auth_movimientos AS auth_movimientos,
                IFNULL(NULLIF(TRIM(str_estado), ''), '-') AS estado,
                created_at AS fecha_creacion,
                        idahorro,
                        dec_porcentaje,
                        (
                           SELECT IFNULL(SUM(
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
                           WHERE m2.idahorro_de = a.idahorro
                             AND UPPER(IFNULL(m2.str_estado, '')) <> 'INACTIVO')
                           FROM tbl_movimientos m
                           WHERE m.idahorro = a.idahorro
                             AND UPPER(IFNULL(m.str_estado, '')) <> 'INACTIVO'
                        ) AS saldo_disponible
              FROM tbl_ahorros a
                     WHERE a.idpersona=$idpersona
              ORDER BY a.created_at DESC";
      return $conexion->query($sql);
   }

   public function listarGanancias($idahorro)
   {
      global $conexion;
      // Ganancias = movimientos tipo 'ajuste'
      $sql = "SELECT 
                m.date_movimiento AS fecha,
                a.dec_porcentaje AS porcentaje,
                m.dec_valor AS ganancia,
                (@acum := @acum + m.dec_valor) AS acumulado
              FROM (SELECT @acum := 0) vars,
                   tbl_movimientos m
              INNER JOIN tbl_ahorros a ON a.idahorro = m.idahorro
              WHERE m.idahorro=$idahorro AND m.str_tipo='ajuste'
              ORDER BY m.date_movimiento ASC";
      return $conexion->query($sql);
   }

   public function obtenerSaldosPorTipo($idglobal, $idpersona)
   {
      global $conexion;
      $sql = "SELECT
                        IFNULL(NULLIF(TRIM(a.str_tipo), ''), 'corriente') AS tipo,
                        IFNULL(SUM(s.saldo), 0) AS saldo
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
                                 ELSE 0 END
                           ),0)
                           FROM tbl_movimientos m
                           WHERE m.idglobal = $idglobal
                             AND m.idahorro = a2.idahorro
                             AND UPPER(IFNULL(m.str_estado, '')) <> 'INACTIVO')
                           +
                           (SELECT IFNULL(SUM(
                              CASE m2.str_tipo
                                 WHEN 'aporte' THEN -m2.dec_valor
                                 WHEN 'ajuste' THEN -m2.dec_valor
                                 WHEN 'retiro' THEN m2.dec_valor
                                 ELSE 0 END
                           ),0)
                           FROM tbl_movimientos m2
                           WHERE m2.idglobal = $idglobal
                             AND m2.idahorro_de = a2.idahorro
                             AND UPPER(IFNULL(m2.str_estado, '')) <> 'INACTIVO') AS saldo
                        FROM tbl_ahorros a2
                        WHERE a2.idglobal = $idglobal
                          AND a2.idpersona = $idpersona
                          AND UPPER(IFNULL(a2.str_estado, '')) <> 'INACTIVO'
                     ) s ON s.idahorro = a.idahorro
                     WHERE a.idglobal = $idglobal
                        AND a.idpersona = $idpersona
                        AND UPPER(IFNULL(a.str_estado, '')) <> 'INACTIVO'
                     GROUP BY IFNULL(NULLIF(TRIM(a.str_tipo), ''), 'corriente')
                     ORDER BY IFNULL(NULLIF(TRIM(a.str_tipo), ''), 'corriente') ASC";
      return $conexion->query($sql);
   }

   public function obtenerPerfil($idahorro)
   {
      global $conexion;
      $sql = "SELECT 
                                    a.idpersona AS idpersona,
                                    a.idglobal AS idglobal,
                        a.dec_porcentaje AS porcentaje,
                        a.str_pago_utilidad AS pago_utilidad,
                        a.bit_auth_movimientos AS auth_movimientos,
                        a.str_estado AS estado,
                (
                  SELECT IFNULL(SUM(
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
                  WHERE m2.idahorro_de = a.idahorro
                    AND UPPER(IFNULL(m2.str_estado, '')) <> 'INACTIVO')
                  FROM tbl_movimientos m
                           WHERE m.idahorro = a.idahorro
                             AND UPPER(IFNULL(m.str_estado, '')) <> 'INACTIVO'
                        ) AS saldo_movimientos,
                        (
                           SELECT IFNULL(SUM(
                              (SELECT IFNULL(SUM(
                                 CASE mc.str_tipo
                                    WHEN 'aporte' THEN mc.dec_valor
                                    WHEN 'ajuste' THEN mc.dec_valor
                                    WHEN 'retiro' THEN -mc.dec_valor
                                    WHEN 'entrada' THEN mc.dec_valor
                                    WHEN 'salida' THEN -mc.dec_valor
                                    ELSE 0 END
                              ),0)
                              FROM tbl_movimientos mc
                              WHERE mc.idahorro = ac.idahorro
                                AND UPPER(IFNULL(mc.str_estado, '')) <> 'INACTIVO')
                              +
                              (SELECT IFNULL(SUM(
                                 CASE mc2.str_tipo
                                    WHEN 'aporte' THEN -mc2.dec_valor
                                    WHEN 'ajuste' THEN -mc2.dec_valor
                                    WHEN 'retiro' THEN mc2.dec_valor
                                    ELSE 0 END
                              ),0)
                              FROM tbl_movimientos mc2
                              WHERE mc2.idahorro_de = ac.idahorro
                                AND UPPER(IFNULL(mc2.str_estado, '')) <> 'INACTIVO')
                           ),0)
                           FROM tbl_ahorros ac
                           WHERE ac.idpersona = a.idpersona
                              AND ac.idglobal = a.idglobal
                              AND LOWER(IFNULL(ac.str_tipo, '')) = 'corresponsal'
                              AND UPPER(IFNULL(ac.str_estado, '')) <> 'INACTIVO'
                        ) AS saldo_corresponsal
                     FROM tbl_ahorros a
                     WHERE a.idahorro=$idahorro";
      $q = $conexion->query($sql);
      $r = $q->fetch_object();
      if (!$r) return null;
      $r->pagoUtilidad = $r->pago_utilidad;
      $r->saldoCorresponsal = isset($r->saldo_corresponsal) ? floatval($r->saldo_corresponsal) : 0;
      // Normalizar auth_movimientos de forma segura:
      $val = $r->auth_movimientos;
      if (is_string($val)) {
         if (strlen($val) === 1) {
            $ord = ord($val);
            // si es verdadero bit binario \x00 o \x01
            if ($ord === 0 || $ord === 1) {
               $r->auth_movimientos = $ord;
            } else {
               // cadena '0' o '1' o cualquier otro número en texto
               $r->auth_movimientos = intval($val);
            }
         } else {
            $r->auth_movimientos = intval($val);
         }
      } else {
         $r->auth_movimientos = intval($val);
      }
      return $r;
   }

   public function registrarMovimiento($idglobal, $idahorro, $idusuario_created, $tipo, $valor, $descripcion, $estado = 'activo')
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

   public function obtenerSaldoDisponible($idglobal, $idahorro)
   {
      global $conexion;
      $idglobal = intval($idglobal);
      $idahorro = intval($idahorro);

      $sql = "SELECT IFNULL(SUM(
                  CASE m.str_tipo
                     WHEN 'aporte' THEN m.dec_valor
                     WHEN 'ajuste' THEN m.dec_valor
                     WHEN 'retiro' THEN -m.dec_valor
                     WHEN 'entrada' THEN m.dec_valor
                     WHEN 'salida' THEN -m.dec_valor
                     ELSE 0 END
               ), 0)
               +(SELECT IFNULL(SUM(
                  CASE m2.str_tipo
                     WHEN 'aporte' THEN -m2.dec_valor
                     WHEN 'ajuste' THEN -m2.dec_valor
                     WHEN 'retiro' THEN m2.dec_valor
                     ELSE 0 END
               ), 0)
               FROM tbl_movimientos m2
               WHERE m2.idglobal=$idglobal
                 AND m2.idahorro_de=$idahorro
                 AND UPPER(IFNULL(m2.str_estado, '')) <> 'INACTIVO') AS saldo
              FROM tbl_movimientos m
              WHERE m.idglobal=$idglobal
                AND m.idahorro=$idahorro
                AND UPPER(IFNULL(m.str_estado, '')) <> 'INACTIVO'";
      $query = $conexion->query($sql);
      $reg = $query ? $query->fetch_object() : null;
      return $reg ? floatval($reg->saldo ?? 0) : 0;
   }

   public function registrarAjusteInteresesConPrincipal($idglobal, $idpersonaSesion, $idahorroDestino, $idusuarioCreated, $monto, $descripcion = '', $estado = 'activo')
   {
      global $conexion;

      $idglobal = intval($idglobal);
      $idpersonaSesion = intval($idpersonaSesion);
      $idahorroDestino = intval($idahorroDestino);
      $idusuarioCreated = intval($idusuarioCreated);
      $monto = floatval($monto);

      if ($idglobal <= 0 || $idpersonaSesion <= 0 || $idahorroDestino <= 0 || $idusuarioCreated <= 0 || $monto <= 0) {
         return ['status' => 'error', 'mensaje' => 'Parámetros inválidos para registrar intereses'];
      }

      $sw = true;
      $conexion->autocommit(false);
      $dt = date('Y-m-d H:i:s');

      try {
         $sqlDestino = "SELECT idahorro, idpersona, id_cuenta, str_estado
                        FROM tbl_ahorros
                        WHERE idglobal=$idglobal
                          AND idahorro=$idahorroDestino
                        LIMIT 1";
         $qDestino = $conexion->query($sqlDestino);
         $destino = $qDestino ? $qDestino->fetch_object() : null;

         if (!$destino) {
            throw new Exception('Cuenta destino no encontrada');
         }

         if (strtoupper(trim((string)$destino->str_estado)) === 'INACTIVO') {
            throw new Exception('La cuenta destino está inactiva');
         }

         $sqlPrincipal = "SELECT idahorro, id_cuenta, str_tipo, str_estado
                          FROM tbl_ahorros
                          WHERE idglobal=$idglobal
                            AND idpersona=$idpersonaSesion
                            AND idahorro<>$idahorroDestino
                            AND LOWER(IFNULL(str_tipo, ''))='principal'
                            AND UPPER(IFNULL(str_estado, '')) <> 'INACTIVO'
                          ORDER BY idahorro ASC
                          LIMIT 1";
         $qPrincipal = $conexion->query($sqlPrincipal);
         $principal = $qPrincipal ? $qPrincipal->fetch_object() : null;

         if (!$principal) {
            throw new Exception('No se encontró cuenta principal activa para el usuario en sesión');
         }

         $saldoPrincipal = $this->obtenerSaldoDisponible($idglobal, intval($principal->idahorro));
         if ($saldoPrincipal < $monto) {
            throw new Exception('Saldo insuficiente en la cuenta principal para respaldar intereses');
         }

         $montoSql = number_format($monto, 2, '.', '');
         $descripcionBase = trim((string)$descripcion);
         $extra = $descripcionBase !== '' ? ' - ' . $descripcionBase : '';

         $estadoEsc = mysqli_real_escape_string($conexion, $estado);

         // 1) Salida de la cuenta principal: SIEMPRE negativa.
         $sqlSalida = "INSERT INTO tbl_movimientos(
                        idglobal,idahorro,idahorro_de,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
                      ) VALUES (
                        $idglobal,$idahorroDestino,{$principal->idahorro},$idusuarioCreated,'ajuste',$montoSql,'$descripcion',NULL,'$estadoEsc','$dt','$dt'
                      )";
         $conexion->query($sqlSalida) or throw new Exception('No se pudo registrar la salida en cuenta principal');
         /*
         // 2) Entrada de la cuenta destino: positiva.
         $sqlEntrada = "INSERT INTO tbl_movimientos(
                        idglobal,idahorro,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
                      ) VALUES (
                        $idglobal,$idahorroDestino,$idusuarioCreated,'ajuste',$montoSql,'$descEntrada',NULL,'$estadoEsc','$dt','$dt'
                      )";
         $conexion->query($sqlEntrada) or throw new Exception('No se pudo registrar la entrada en cuenta destino');
*/
         $sqlUpd = "UPDATE tbl_ahorros SET update_at='$dt' WHERE idahorro IN ({$principal->idahorro}, $idahorroDestino)";
         $conexion->query($sqlUpd) or throw new Exception('No se pudo actualizar la fecha de las cuentas');
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
         'mensaje' => 'Intereses registrados con doble asiento (principal y destino)',
         'monto' => $monto
      ];
   }

   public function transferirDesdePrincipalSesion($idglobal, $idpersonaSesion, $idahorroDestino, $idusuarioCreated, $monto, $descripcion = '', $estado = 'activo')
   {
      global $conexion;

      $idglobal = intval($idglobal);
      $idpersonaSesion = intval($idpersonaSesion);
      $idahorroDestino = intval($idahorroDestino);
      $idusuarioCreated = intval($idusuarioCreated);
      $monto = floatval($monto);

      if ($idglobal <= 0 || $idpersonaSesion <= 0 || $idahorroDestino <= 0 || $idusuarioCreated <= 0 || $monto <= 0) {
         return ['status' => 'error', 'mensaje' => 'Parámetros inválidos'];
      }

      $conexion->autocommit(false);
      $dt = date('Y-m-d H:i:s');

      try {
         $sqlPrincipal = "SELECT idahorro, id_cuenta, str_estado
                          FROM tbl_ahorros
                          WHERE idglobal=$idglobal
                            AND idpersona=$idpersonaSesion
                            AND LOWER(IFNULL(str_tipo, ''))='principal'
                            AND UPPER(IFNULL(str_estado, '')) <> 'INACTIVO'
                          ORDER BY idahorro ASC
                          LIMIT 1";
         $qPrincipal = $conexion->query($sqlPrincipal);
         $principal = $qPrincipal ? $qPrincipal->fetch_object() : null;
         if (!$principal) {
            throw new Exception('No se encontró cuenta principal activa para el usuario en sesión');
         }

         $sqlDestino = "SELECT idahorro, id_cuenta, str_estado
                        FROM tbl_ahorros
                        WHERE idglobal=$idglobal
                          AND idahorro=$idahorroDestino
                          AND UPPER(IFNULL(str_estado, '')) <> 'INACTIVO'
                        LIMIT 1";
         $qDestino = $conexion->query($sqlDestino);
         $destino = $qDestino ? $qDestino->fetch_object() : null;
         if (!$destino) {
            throw new Exception('Cuenta destino no encontrada o inactiva');
         }

         if (intval($principal->idahorro) === intval($destino->idahorro)) {
            throw new Exception('La cuenta destino no puede ser la misma cuenta principal');
         }

         $saldoPrincipal = $this->obtenerSaldoDisponible($idglobal, intval($principal->idahorro));
         if ($saldoPrincipal < $monto) {
            throw new Exception('Saldo insuficiente en la cuenta principal');
         }

         $montoSql = number_format($monto, 2, '.', '');
         $extra = trim((string)$descripcion);
         $extra = $extra !== '' ? ' - ' . $extra : '';
         $estadoEsc = mysqli_real_escape_string($conexion, $estado);

         /*
         $sqlOut = "INSERT INTO tbl_movimientos(
                      idglobal,idahorro,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
                    ) VALUES (
                      $idglobal,{$principal->idahorro},$idusuarioCreated,'retiro',-$montoSql,'$descRetiro',NULL,'$estadoEsc','$dt','$dt'
                    )";
         $conexion->query($sqlOut) or throw new Exception('No se pudo registrar salida en cuenta principal');
*/
         $sqlIn = "INSERT INTO tbl_movimientos(
                      idglobal,idahorro,idahorro_de,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
                    ) VALUES (
                      $idglobal,{$destino->idahorro},{$principal->idahorro},$idusuarioCreated,'aporte',$montoSql,'$descripcion',NULL,'$estadoEsc','$dt','$dt'
                    )";
         $conexion->query($sqlIn) or throw new Exception('No se pudo registrar entrada en cuenta destino');

         $sqlUpd = "UPDATE tbl_ahorros SET update_at='$dt' WHERE idahorro IN ({$principal->idahorro}, {$destino->idahorro})";
         $conexion->query($sqlUpd) or throw new Exception('No se pudo actualizar cuentas');

         $conexion->commit();
         return ['status' => 'success', 'mensaje' => 'Aporte registrado contra cuenta principal', 'monto' => $monto];
      } catch (Exception $e) {
         $conexion->rollback();
         return ['status' => 'error', 'mensaje' => $e->getMessage()];
      }
   }

   public function transferirHaciaPrincipalSesion($idglobal, $idpersonaSesion, $idahorroOrigen, $idusuarioCreated, $monto, $descripcion = '', $estado = 'activo')
   {
      global $conexion;

      $idglobal = intval($idglobal);
      $idpersonaSesion = intval($idpersonaSesion);
      $idahorroOrigen = intval($idahorroOrigen);
      $idusuarioCreated = intval($idusuarioCreated);
      $monto = floatval($monto);

      if ($idglobal <= 0 || $idpersonaSesion <= 0 || $idahorroOrigen <= 0 || $idusuarioCreated <= 0 || $monto <= 0) {
         return ['status' => 'error', 'mensaje' => 'Parámetros inválidos'];
      }

      $conexion->autocommit(false);
      $dt = date('Y-m-d H:i:s');

      try {
         $sqlOrigen = "SELECT idahorro, id_cuenta, str_estado
                       FROM tbl_ahorros
                       WHERE idglobal=$idglobal
                         AND idahorro=$idahorroOrigen
                         AND UPPER(IFNULL(str_estado, '')) <> 'INACTIVO'
                       LIMIT 1";
         $qOrigen = $conexion->query($sqlOrigen);
         $origen = $qOrigen ? $qOrigen->fetch_object() : null;
         if (!$origen) {
            throw new Exception('Cuenta origen no encontrada o inactiva');
         }

         $sqlPrincipal = "SELECT idahorro, id_cuenta, str_estado
                          FROM tbl_ahorros
                          WHERE idglobal=$idglobal
                            AND idpersona=$idpersonaSesion
                            AND LOWER(IFNULL(str_tipo, ''))='principal'
                            AND UPPER(IFNULL(str_estado, '')) <> 'INACTIVO'
                          ORDER BY idahorro ASC
                          LIMIT 1";
         $qPrincipal = $conexion->query($sqlPrincipal);
         $principal = $qPrincipal ? $qPrincipal->fetch_object() : null;
         if (!$principal) {
            throw new Exception('No se encontró cuenta principal activa para el usuario en sesión');
         }

         if (intval($principal->idahorro) === intval($origen->idahorro)) {
            throw new Exception('La cuenta origen no puede ser la misma cuenta principal');
         }

         $saldoOrigen = $this->obtenerSaldoDisponible($idglobal, intval($origen->idahorro));
         if ($saldoOrigen < $monto) {
            throw new Exception('Saldo insuficiente para realizar el retiro');
         }

         $montoSql = number_format($monto, 2, '.', '');
         $extra = trim((string)$descripcion);
         $extra = $extra !== '' ? ' - ' . $extra : '';
         $estadoEsc = mysqli_real_escape_string($conexion, $estado);


         $sqlOut = "INSERT INTO tbl_movimientos(
                      idglobal,idahorro,idahorro_de,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
                    ) VALUES (
                      $idglobal,{$origen->idahorro},{$principal->idahorro},$idusuarioCreated,'retiro',$montoSql,'$descripcion',NULL,'$estadoEsc','$dt','$dt'
                    )";
         $conexion->query($sqlOut) or throw new Exception('No se pudo registrar salida en cuenta origen');
         /*
         $sqlIn = "INSERT INTO tbl_movimientos(
                      idglobal,idahorro,idusuario_created,str_tipo,dec_valor,str_descripcion,int_codigo,str_estado,created_at,update_at
                    ) VALUES (
                      $idglobal,{$principal->idahorro},$idusuarioCreated,'aporte',$montoSql,'$descIn',NULL,'$estadoEsc','$dt','$dt'
                    )";
         $conexion->query($sqlIn) or throw new Exception('No se pudo registrar entrada en cuenta principal');
*/
         $sqlUpd = "UPDATE tbl_ahorros SET update_at='$dt' WHERE idahorro IN ({$principal->idahorro}, {$origen->idahorro})";
         $conexion->query($sqlUpd) or throw new Exception('No se pudo actualizar cuentas');

         $conexion->commit();
         return ['status' => 'success', 'mensaje' => 'Retiro transferido a cuenta principal', 'monto' => $monto];
      } catch (Exception $e) {
         $conexion->rollback();
         return ['status' => 'error', 'mensaje' => $e->getMessage()];
      }
   }
}
