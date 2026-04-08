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
      $password,


      $idglobal
   ) {
      global $conexion;
      $sw = true;
      $conexion->autocommit(false);
      $dt = date('Y-m-d H:i:s');
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

         $idCuenta = uniqidReal(); // Asignar el valor adecuado para idCuenta


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
         $idahorro = $conexion->insert_id;

         // Generar número de cuenta concatenando el ID del ahorro con un contador
         $qr_upd = "UPDATE tbl_ahorros SET id_cuenta=CONCAT('$idahorro', '-', '00') WHERE idahorro=$idahorro";
         $conexion->query($qr_upd) or throw new Exception('error!');
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
            $idCuenta = uniqidReal(); // Asignar el valor adecuado para idCuenta


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
            $idahorro = $conexion->insert_id;

            // Generar número de cuenta concatenando el ID del ahorro con un contador
            $qr_upd = "UPDATE tbl_ahorros SET id_cuenta=CONCAT('$idahorro', '-', '00') WHERE idahorro=$idahorro";
            $conexion->query($qr_upd) or throw new Exception('error!');
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
                           WHEN 'retiro' THEN m.dec_valor
                           ELSE 0 END
                     ),0)
                     FROM tbl_movimientos m
                     WHERE m.idahorro = a.idahorro
                  ) AS saldoMovimientos,
                  (
                     SELECT IFNULL(SUM(
                        CASE mc.str_tipo
                           WHEN 'aporte' THEN mc.dec_valor
                           WHEN 'ajuste' THEN mc.dec_valor
                           WHEN 'retiro' THEN mc.dec_valor
                           ELSE 0 END
                     ),0)
                     FROM tbl_movimientos mc
                     INNER JOIN tbl_ahorros ac ON ac.idahorro = mc.idahorro
                     WHERE ac.idpersona = a.idpersona
                       AND ac.idglobal = a.idglobal
                       AND LOWER(IFNULL(ac.str_tipo, '')) = 'corresponsal'
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
                str_estado AS estado
              FROM tbl_movimientos
              WHERE idglobal=$idglobal AND idahorro=$idahorro
              ORDER BY date_movimiento DESC";
      return $conexion->query($sql);
   }

   public function listarMovimientosPersona($idglobal, $idpersona)
   {
      global $conexion;
      $sql = "SELECT
                m.date_movimiento AS fecha,
                IFNULL(NULLIF(TRIM(a.id_cuenta), ''), CONCAT('Ahorro #', a.idahorro)) AS cuenta,
                m.str_tipo AS tipo,
                m.dec_valor AS monto,
                m.str_descripcion AS descripcion,
                m.str_estado AS estado
              FROM tbl_movimientos m
              INNER JOIN tbl_ahorros a ON a.idahorro = m.idahorro
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
                                 WHEN 'retiro' THEN m.dec_valor
                                 ELSE 0 END
                           ),0)
                           FROM tbl_movimientos m
                           WHERE m.idahorro = a.idahorro
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
                        IFNULL(SUM(
                           CASE m.str_tipo
                              WHEN 'aporte' THEN m.dec_valor
                              WHEN 'ajuste' THEN m.dec_valor
                              WHEN 'retiro' THEN m.dec_valor
                              ELSE 0
                           END
                        ), 0) AS saldo
                     FROM tbl_ahorros a
                     LEFT JOIN tbl_movimientos m ON m.idahorro = a.idahorro
                     WHERE a.idglobal = $idglobal
                        AND a.idpersona = $idpersona
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
                      WHEN 'retiro' THEN m.dec_valor
                      ELSE 0 END
                  ),0)
                  FROM tbl_movimientos m
                           WHERE m.idahorro = a.idahorro
                        ) AS saldo_movimientos,
                        (
                           SELECT IFNULL(SUM(
                              CASE mc.str_tipo
                                 WHEN 'aporte' THEN mc.dec_valor
                                 WHEN 'ajuste' THEN mc.dec_valor
                                 WHEN 'retiro' THEN mc.dec_valor
                                 ELSE 0 END
                           ),0)
                           FROM tbl_movimientos mc
                           INNER JOIN tbl_ahorros ac ON ac.idahorro = mc.idahorro
                           WHERE ac.idpersona = a.idpersona
                              AND ac.idglobal = a.idglobal
                              AND LOWER(IFNULL(ac.str_tipo, '')) = 'corresponsal'
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
}
