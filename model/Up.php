<?php
require "Conexion_up2.php";
require "Conexion.php";

class ClassUp
{


  public function __construct()
  {
  }
  public function RegistrarCliente(
    $nombres,
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

    $apodo,
    $created_empleado_id,
    $idglobal
  ) {
    global $conexion;
    $sw = true;
    $conexion->autocommit(false);
    $dt = date('Y-m-d H:i:s');
    $idcliente = null;
    try {
      $sql = "SELECT idpersona FROM tbl_persona WHERE idglobal=$idglobal AND str_tipo_documento='$tipo_documento' AND str_num_documento='$num_documento'";
      $query = $conexion->query($sql);
      $requestPersona = $query->fetch_object();


      if (isset($requestPersona->idpersona)) {
        $sql = "SELECT idcliente FROM tbl_clientes WHERE idpersona=$requestPersona->idpersona";
        $query = $conexion->query($sql);
        $requestCli = $query->fetch_object();
        if (isset($requestCli->idcliente)) {
          $idcliente = $requestCli->idcliente;
        } else {
          $sql = "INSERT INTO `tbl_clientes`(
						idglobal,
						idpersona,
						dec_max_credito,
						str_apodo,
						str_nota,
						str_estado,
            str_calificacion,
						fiador_persona_id,
						created_empleado_id,
						create_at,
						update_at

				 )
				  VALUES ($idglobal, $requestPersona->idpersona, 100, '$apodo', '', 'Activo', 'nuevo', 0, $created_empleado_id, '$dt', '$dt')";
          $conexion->query($sql) or throw new Exception('error!');
          $idcliente = $conexion->insert_id;
        }



      } else {

        $sql = "INSERT INTO `tbl_persona`(	
        idglobal,
        str_nombres,
        str_apellidos,
        str_sexo,
        str_fecha_nacimiento,
        str_tipo_documento,
        str_num_documento,
        str_telefono,
        str_email,
        str_foto,
        str_ocupacion,
        str_estado,
        str_nota,
        str_direccion_departamento,
        str_direccion_ciudad,
        str_direccion_barrio,
        str_direccion_calle,
        str_email_verificado,
        created_at,
        update_at

        )
         VALUES ($idglobal,'$nombres', '', '$sexo', '$fecha_nacimiento', 
         '$tipo_documento', '$num_documento', '$telefono', '$email', 
         '$ruta_carga', '$ocupacion', 'activo', '',
          '$direccion_departamento',
          '$direccion_siudad',
          '$direccion_barrio',
          '$direccion_calle',
            '',
            '$dt',
            '$dt'
            )";

        $conexion->query($sql) or throw new Exception('error!');
        $idpersona = $conexion->insert_id;

        $sql = "INSERT INTO `tbl_clientes`(
          idglobal,
          idpersona,
          dec_max_credito,
          str_apodo,
          str_nota,
          str_estado,
          str_calificacion,
          fiador_persona_id,
          created_empleado_id,
          create_at,
          update_at

       )
        VALUES ($idglobal, $idpersona, 1, '$apodo', '', 'activo','nuevo', 0, $created_empleado_id, '$dt', '$dt')";
        $conexion->query($sql) or throw new Exception('error!');
        $idcliente = $conexion->insert_id;
      }
    } catch (Exception $e) {

      $sw = false;
      $conexion->rollback();
    }
    $conexion->commit();
    if ($conexion != null) {

      //  $conexion->close();
    }

    return $sw ? $idcliente : null;
  }

  public function RegistrarTarjeta(
    $idtarjeta,
    $idglobal,
    $idsucursal,
    $idcliente,
    $consepto,
    $valor,
    $modo,
    $plazo,
    $prestamo,
    $descripcion,
    $item,
    $utilidad,
    $c_adicional_valor,
    $str_tipo_comprobante,
    $str_serie,
    $realnumero,
    $createdEmpleadoId,
    $estado,
    $fecha_at,
    $resta,
    $allAbonos,
    $notas

  ) {
    global $conexion;
    $sw = true;
    $conexion->autocommit(false);
    $dt = date('Y-m-d H:i:s');
    try {
      $sql = "SELECT iddetalleruta from tbl_detalle_ruta where idsucursal=$idsucursal and str_estado='created' order by created_at desc limit 1";
      $cliente = $conexion->query($sql);
      $res = $cliente->fetch_object();
      $iddetalleruta = $res->iddetalleruta;
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
                    $idglobal,$idsucursal, $idcliente, 0, $iddetalleruta,
                    '$consepto', $valor, '$modo', $plazo, 
                     $prestamo, $resta, '$descripcion', $item, 
                    $utilidad, '', $c_adicional_valor,
                    '$str_tipo_comprobante','$str_serie', '$realnumero',
                    '', '', '', '$estado', $createdEmpleadoId,'$fecha_at','$dt'
                        )";

      $conexion->query($sql) or throw new Exception('error! Targeta');
      if ($allAbonos != 0) {
        $arrAbonos = explode(",,,", $allAbonos);

        foreach ($arrAbonos as $value) {

          $iddescripcion = uniqidReal();

          $abn = explode("<=>", $value);

          $a = floatval($abn[1]) * -1;
          $sql = "INSERT INTO tbl_descripcion(
                 iddescripcion,
                 idglobal,
                 idsucursal,
                 idtarjeta,
                 iddetalleruta,
                 dec_abono,
                 str_descripcion,
                 str_estado,
                 created_at,
                 updated_at
   
             )
         VALUES ('$iddescripcion',$idglobal, $idsucursal, '$idtarjeta', $iddetalleruta, $a, '$abn[2]', 'saved','$abn[0]','$dt')";
          $conexion->query($sql) or throw new Exception('error! abono');
        }
      }

      if ($notas) {
        $idusuario = $_SESSION['idusuario'];
        $idcomentario = uniqidReal();
        $sql = "INSERT INTO tbl_comentarios(
          idcomentario,
          str_comentario,
          str_tipo,
          idusuario,
          created_at,
          update_at
      )
      VALUES (
          '$idcomentario',
          '$notas',
          'comentario',
          $idusuario,
          '$dt',
          '$dt'
      )";
        $conexion->query($sql) or throw new Exception("error!");

        $idcomentarioVliente = uniqidReal();

        $sql = "INSERT INTO tbl_comentarios_cliente (
          idcomentariocliente,
          idcliente,
          idcomentario
     )
     VALUES ( '$idcomentarioVliente', $idcliente, '$idcomentario')";
        $conexion->query($sql) or throw new Exception("error!");
      }

    } catch (Exception $e) {
      print_r($e);
      $sw = false;
      $conexion->rollback();
    }
    $conexion->commit();
    $mensaje = $sw ? "Tarjeta Registrada" : "ERROR: Tarjeta no registrada";
    echo $mensaje;
    return $sw;
  }


  public function update($idsucursal)
  {
    global $conexion_up;
    global $conexion;
    $sql = "SELECT str_codigo FROM `tbl_sucursal` WHERE idsucursal=$idsucursal";
    $query = $conexion->query($sql);
    $fetch = $query->fetch_object();
    $razonSocial = $fetch->str_codigo;
    $sql = "SELECT * FROM `view_up` WHERE razonSocial='$razonSocial' ";
    $query = $conexion_up->query($sql);



    return $query;
  }

  public function terminar($idsucursal)
  {
    global $conexion;
    $sw = true;
    try {
      $sql = "SELECT iddetalleruta from tbl_detalle_ruta where idsucursal=$idsucursal and str_estado='created' order by created_at desc limit 1";
      $cliente = $conexion->query($sql);
      $res = $cliente->fetch_object();
      $iddetalleruta = $res->iddetalleruta;

      $sql = "UPDATE tbl_detalle_ruta SET str_estado='saved' WHERE iddetalleruta=$iddetalleruta ";
      $conexion->query($sql) or throw new Exception('error!');

    } catch (Exception $e) {
      print_r($e);
      $sw = false;
      $conexion->rollback();
    }
    $conexion->commit();
    $mensaje = $sw ? "Terminado" : "ERROR: al terminar";
    echo $mensaje;
    return $sw;
  }

  public function registrarTar($idglobal, $idsucursal, $created_empleado_id, $fila, $abonos,$num)
  {
    global $conexion;
    $sw = true;
    $conexion->autocommit(false);
    $dt = date('Y-m-d H:i:s');
    $idcliente = null;


    if (!$idglobal || !$idsucursal || !$created_empleado_id) {
      return false;
    }
   
    try {
      $sql = "SELECT idpersona FROM tbl_persona WHERE idglobal=$idglobal AND str_tipo_documento='Cedula de ciudadania' AND str_num_documento='$fila[1]'";
      $query = $conexion->query($sql);
      $requestPersona = $query->fetch_object();


      if (isset($requestPersona->idpersona)) {
        $sql = "SELECT idcliente FROM tbl_clientes WHERE idpersona=$requestPersona->idpersona";
        $query = $conexion->query($sql);
        $requestCli = $query->fetch_object();
        if (isset($requestCli->idcliente)) {
          $idcliente = $requestCli->idcliente;
        } else {
          $sql = "INSERT INTO `tbl_clientes`(
						idglobal,
						idpersona,
						dec_max_credito,
						str_apodo,
						str_nota,
						str_estado,
            str_calificacion,
						fiador_persona_id,
						created_empleado_id,
						create_at,
						update_at

				 )
				  VALUES ($idglobal, $requestPersona->idpersona, 100, '', '', 'Activo', 'nuevo', 0, $created_empleado_id, '$dt', '$dt')";
          $conexion->query($sql) or throw new Exception('error!');
          $idcliente = $conexion->insert_id;
        }



      } else {

        $sql = "INSERT INTO `tbl_persona`(	
        idglobal,
        str_nombres,
        str_apellidos,
        str_sexo,
        str_fecha_nacimiento,
        str_tipo_documento,
        str_num_documento,
        str_telefono,
        str_email,
        str_foto,
        str_ocupacion,
        str_estado,
        str_nota,
        str_direccion_departamento,
        str_direccion_ciudad,
        str_direccion_barrio,
        str_direccion_calle,
        str_email_verificado,
        created_at,
        update_at

        )
         VALUES ($idglobal,'$fila[2]', '', '', '', 
         'Cedula de ciudadania', '$fila[1]', '$fila[4]', '', 
         '', '', 'activo', '',
          '',
          '',
          '',
          '$fila[3]',
            '',
            '$dt',
            '$dt'
            )";

        $conexion->query($sql) or throw new Exception('error!');
        $idpersona = $conexion->insert_id;

        $sql = "INSERT INTO `tbl_clientes`(
          idglobal,
          idpersona,
          dec_max_credito,
          str_apodo,
          str_nota,
          str_estado,
          str_calificacion,
          fiador_persona_id,
          created_empleado_id,
          create_at,
          update_at

       )
        VALUES ($idglobal, $idpersona, 1, '', '', 'activo','nuevo', 0, $created_empleado_id, '$dt', '$dt')";
        $conexion->query($sql) or throw new Exception('error!');
        $idcliente = $conexion->insert_id;
      }





      $sql = "SELECT iddetalleruta from tbl_detalle_ruta where idsucursal=$idsucursal and str_estado='created' order by created_at desc limit 1";
      $cliente = $conexion->query($sql);
      $res = $cliente->fetch_object();
      $iddetalleruta = $res->iddetalleruta;
      $idtarjeta = uniqidReal();
      $valor=floatval($fila[6]) / 1000;
      $prestamo=floatval($fila[9]);
      $item=floatval($fila[8]);
      $utilidad=$valor-$prestamo;
      $estado='saved';
      $resta=$valor;
      
print_r($idtarjeta);
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
                    $idglobal,$idsucursal, $idcliente, 0, $iddetalleruta,
                    'Prestamo', $valor, 'Diario', $fila[10], 
                     $prestamo, $valor, '', $item, 
                    $utilidad, '', 0,
                    'TICKET','2020', '$num',
                    '', '', '', '$estado', $created_empleado_id,'$fila[7]','$dt'
                        )";

      $conexion->query($sql) or throw new Exception('error! Targeta');
     
        foreach ($abonos as $value) {

          $iddescripcion = uniqidReal();

        

          $a = (floatval($value[2]) / 1000) * -1;
          $resta+=$a;
          $sql = "INSERT INTO tbl_descripcion(
                 iddescripcion,
                 idglobal,
                 idsucursal,
                 idtarjeta,
                 iddetalleruta,
                 dec_abono,
                 str_descripcion,
                 str_estado,
                 created_at,
                 updated_at
   
             )
         VALUES ('$iddescripcion',$idglobal, $idsucursal, '$idtarjeta', $iddetalleruta, $a, 'Abono', 'saved','$value[1]','$dt')";
          $conexion->query($sql) or throw new Exception('error! abono');
        }

        $sql = "UPDATE tbl_tarjetas SET dec_resta=$resta WHERE idtarjeta='$idtarjeta'";
        $conexion->query($sql) or throw new Exception('error! abono');

  

    } catch (Exception $e) {

      $sw = false;
      $conexion->rollback();
    }
    $conexion->commit();
    if ($conexion != null) {

      //  $conexion->close();
    }

    return $sw ? $idcliente : null;
  }

}