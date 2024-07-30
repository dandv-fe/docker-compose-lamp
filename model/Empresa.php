<?php
require "Conexion.php";

class ClassEmpresas
{


  public function __construct()
  {
  }

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
    $login,
    $password,
    $empresa,
    $max_sucursal,
    $estado

  ) {
    global $conexion;
    $sw = true;
    $userEmpresa = $_SESSION['userEmpresa'];
    $dt = date('Y-m-d H:i:s');

    $conexion->autocommit(false);
    try {

      $sql = "INSERT INTO `tbl_persona`(
					idglobal, str_nombres, str_apellidos, str_sexo, str_fecha_nacimiento,
					str_tipo_documento, str_num_documento, str_telefono, str_email, str_foto,
					str_ocupacion,str_estado,str_nota,
					str_direccion_departamento, str_direccion_ciudad, str_direccion_barrio, str_direccion_calle,
					str_email_verificado, created_at, update_at
	
					)
					 VALUES (0,'$nombres', '$apellidos', '$sexo', '$fecha_nacimiento',
            '$tipo_documento', '$num_documento', '$telefono', '$email', '$ruta_carga', 
            '$ocupacion', 'activo', '', 
            '$direccion_departamento', '$direccion_siudad', '$direccion_barrio', '$direccion_calle',
							'', '$dt', '$dt'
							)";

      $conexion->query($sql) or throw new Exception('error!');

      $idpersona = $conexion->insert_id;


      $sql = "INSERT INTO `tbl_global`(
        str_razon_social, str_tipo_documento,  str_documento, str_email, str_tipo,
        str_nombre_impuesto, dec_porcentaje_impuesto, str_logo, str_estado,
        str_telefono, iddireccion, int_maxsucursal, bool_writemiles, bool_viewmiles,
        divisaid, empresaid, superadmin_personaid, created_at, updated_at
        
        )
         VALUES ('$empresa', NULL, NULL, NULL, 'publica', 
         '', 0, '', 'activa', 
         NULL, NULL, $max_sucursal, 0, 0, 
         1, $userEmpresa, $idpersona, '$dt', '$dt'
         )";

      $conexion->query($sql) or throw new Exception('error!');
      $idglobal = $conexion->insert_id;

      $sql = "INSERT INTO `tbl_empleado`(
              idglobal,idpersona,str_apodo,str_cargo,
              str_estado,str_comentarios,created_at,update_at
      )
       VALUES ($idglobal, $idpersona, '', 'Super Administrador',
        'activo', '', '$dt', '$dt')";
      $conexion->query($sql) or throw new Exception('error!');

      $sql = "INSERT INTO `tbl_usuario`(
      idglobal,idpersona,str_user_name,
      str_password, str_terminos_condiciones,str_estado
      )
      VALUES ($idglobal, $idpersona, '$login',
      '$password', 'pendiente', 'activo')";
      $conexion->query($sql) or throw new Exception('error!');


      $sql = "UPDATE tbl_persona SET idglobal=$idglobal WHERE idpersona=$idpersona";
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
    $msg = $sw ? "Empresa registrada, !Exitosamente!" : "ERROR: Empresa no ha podido ser registado. ";
    echo $msg;
    return;
  }


  public function Modificar(
    $idempresa,
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
    $idusuario,
    $login,
    $password,
    $empresa,
    $max_sucursal,
    $estado
  ) {
    global $conexion;
    $sw = true;
    $dt = date('Y-m-d H:i:s');
    $conexion->autocommit(false);
    try {


      $sql = "SELECT idusuario 
      FROM tbl_usuario 
      WHERE idglobal=$idempresa AND 
      str_user_name='$login' AND 
      idpersona<>$idpersona";
      $query = $conexion->query($sql);
      $res = $query->fetch_object();
      if (isset($res->idusuario)) {
        echo "ERROR: Este Nombre usuario esta en uso busque otro";
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
          str_nota='',
          str_direccion_departamento='$direccion_departamento',
          str_direccion_ciudad='$direccion_siudad',
          str_direccion_barrio='$direccion_barrio',
          str_direccion_calle='$direccion_calle',
          update_at='$dt'
          WHERE idpersona=$idpersona";
      $conexion->query($sql) or throw new Exception('error!');

      $sql = "UPDATE `tbl_usuario` SET
                  str_user_name='$login',
                  str_password='$password'
                  WHERE idusuario=$idusuario
            ";
      $conexion->query($sql) or throw new Exception('error!');

      $sql="UPDATE tbl_global SET str_razon_social='$empresa', int_maxsucursal=$max_sucursal, str_estado='$estado', updated_at='$dt' 
        WHERE idglobal=$idempresa";
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
    $msg = $sw ? "Empresa registrada, !Exitosamente!" : "ERROR: Empresa no ha podido ser registado. ";
    echo $msg;
    return;

  }

  public function buscarClienteEnpresa($idglobal, $tipo_documento, $num_documento)
  {
    global $conexion;
    $sql = "SELECT * FROM `view_empresas_publica`
     WHERE refEmpresa=$idglobal AND t_documento ='$tipo_documento' AND n_documento='$num_documento'";
    $query = $conexion->query($sql);
    return $query;
  }





  public function Listar($idglobal)
  {
    global $conexion;
    $sql = "SELECT e.*,
      (SELECT IFNULL(COUNT(idsucursal),0) FROM tbl_sucursal WHERE idglobal=e.refGlobal ) AS actividades,
      (SELECT IFNULL(COUNT(idempleado),0) FROM tbl_empleado WHERE idglobal=e.refGlobal AND str_cargo<>'Super Administrador') AS empleados,
      (SELECT IFNULL(COUNT(idcliente),0) FROM tbl_clientes WHERE idglobal=e.refGlobal ) AS clientes
    FROM `view_empresas_publica` e WHERE refEmpresa=$idglobal";
    $query = $conexion->query($sql);
    return $query;
  }
}







