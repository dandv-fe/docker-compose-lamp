<?php

$idglobal = $_SESSION['idglobal'];
$created_empleado_id = $_SESSION['userEmpleado'];
$idsucursal=$_SESSION['MYSESSION_idsucursal'];



$query_up = $classUp->update($_SESSION['MYSESSION_idsucursal']);

echo ' <script>
      $("#myprog").css("width", 20);
    </script>';
//echo $query_up->num_rows.PHP_EOL; 
//echo PHP_EOL;
while ($req = $query_up->fetch_object()) {
$estado='saved';
  if ($req->str_estado_tar=='Z') {
   $estado='moroso';
  } else if($req->str_estado_tar=='F'){
    $estado='fallecio';
  }
  $nombres=limpiar_cadena($req->nombre);
  $res=$classUp->RegistrarCliente(
    $nombres,
    $sexo=$req->sexo||'',
    $fecha_nacimiento= $req->fecha_nacimiento||'',
    $tipo_documento='Cedula de ciudadania',
    $num_documento=$req->num_documento,
    $direccion_departamento= $req->direccion_departamento,
    $direccion_siudad =$req->direccion_siudad,
    $direccion_barrio =$req->direccion_barrio,
    $direccion_calle =$req->direccion_calle,
    $telefono =$req->telefono,
    $email =$req->email,
    $ruta_carga =$req->foto,
    $ocupacion =$req->ocupacion||'',
    $apodo =$req->apodo||'',
    $created_empleado_id,
    $idglobal
  );


    if ($res) {

        echo "Cliente Registrado correctamente.";
        $nota=limpiar_cadena2($req->str_nota);
        $consepto =$req->tipo=='Prestamo'? 'Prestamo': 'Articulo';
        $idtarjeta = uniqidReal();
        $resTarjeta=$classUp->RegistrarTarjeta(
            $idtarjeta,
            $idglobal,
            $idsucursal,
            $idcliente=$res,
            $consepto,
            $valor =$req->str_valor_tar,
            $modo =$req->str_modo,
            $plazo =$req->int_tiempo_tar,
            $prestamo =$req->int_prstamo_tar,
            $descripcion =$req->descripcion,
            $item =$req->decimal_iten_tar,
            $utilidad =$req->str_valor_tar-$req->int_prstamo_tar,
            $c_adicional_valor =$req->boleta_valor,
            $str_tipo_comprobante= 'TICKET',
            $str_serie =$req->serie,
            $str_numero =$req->int_numero_tar,
            $created_empleado_id,
            $estado,
            $req->fecha_inicial,
            $req->resta,
            $req->abonos,
            $nota
        );

    } else {

        echo "ERROR: Cliente no ha podido ser registado.";
        echo json_encode($req);
        echo 'FINAL ERROR CLIENTE';
    }
    
}


$resTarjeta=$classUp->terminar($idsucursal);