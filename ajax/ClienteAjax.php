<?php
session_start();
require_once "../method.php";
require_once "../vendor/autoload.php";

use PhpOffice\PhpSpreadsheet\IOFactory;

require_once "../model/Cliente.php";
$objCliente = new Cliente();
switch ($_GET["op"]) {
   case 'SaveOrUpdate':
      $idglobal = $_SESSION['idglobal'];
      //datos persona
      $idpersona = limpiar_cadena($_POST["txtRefPersona"]); // hidden
      $nombres = limpiar_cadena($_POST["txt_Nombre"]);
      $apellidos = limpiar_cadena($_POST["txt_Apellido"]);
      $imagen_Cli = $_FILES["imagen_Cli"];
      $rutaImgCli = limpiar_cadena2($_POST["txt_RutaImgCli"]);
      $sexo = limpiar_cadena($_POST["txt_Sexo"]);
      $fecha_nacimiento = limpiar_cadena2($_POST["txt_fechaNacimiento"]);
      $ocupacion = limpiar_cadena($_POST["txt_Ocupacion"]);
      $tipo_documento = limpiar_cadena($_POST["txt_tipo_documentoHidden"]);
      $num_documento = limpiar_cadena($_POST["txt_num_DocumentoHidden"]);
      $telefono = limpiar_cadena($_POST["txt_Telefono"]);
      $email = limpiar_cadena2($_POST["txt_Email"]);
      $direccion_departamento = limpiar_cadena($_POST["txt_Direccion_Departamento"]);
      $direccion_siudad = limpiar_cadena($_POST["txt_Direccion_Provincia"]);
      $direccion_barrio = limpiar_cadena($_POST["txt_Direccion_Distrito"]);
      $direccion_calle = limpiar_cadena2($_POST["txt_Direccion_Calle"]);
      $notaPersona = '';
      // datos cliente
      $idcliente = limpiar_cadena($_POST["txtRefCliente"]);

      $max_credito = floatval($_POST["txt_max_credito"]);
      $apodo = limpiar_cadena($_POST["txtApodo"]);
      $estadoCliente = limpiar_cadena($_POST["txtEstadoCliente"]);
      $notaCliente = '';
      $fiador = 0;
      $created_empleado_id = $_SESSION['userEmpleado'];


      if ($imagen_Cli['size'] > 0) {
         //si subio imagen
         $dirEspacioGlobal = "../Files/" . $idglobal . "/";
         $dirEspacioGlobalSucursal = $dirEspacioGlobal . "cliente" . "/";
         $tamanio = 10000; //Tamaño permitido en kb
         $permitidos = array('jpg', 'jpeg', 'png'); //Archivos permitido

         $arregloArchivo = explode(".", $imagen_Cli['name']);
         $extension = strtolower(end($arregloArchivo));

         if ($imagen_Cli['error'] == 0 && $imagen_Cli['size'] < ($tamanio * 1024) && in_array($extension, $permitidos)) {

            $newNombreImg = renombrar_fotos($num_documento) . '.' . $extension;
            $ruta_carga = $dirEspacioGlobalSucursal . $newNombreImg;
            //Valida si no existe la carpeta y la crea
            if (!file_exists($dirEspacioGlobal)) {
               mkdir($dirEspacioGlobal, 0777);
            }
            if (!file_exists($dirEspacioGlobalSucursal)) {
               mkdir($dirEspacioGlobalSucursal, 0777);
            }

            if (move_uploaded_file($imagen_Cli['tmp_name'], $ruta_carga)) {
               $ruta_carga = "Files/" . $idglobal . "/" . "cliente/" . $newNombreImg;
               if (empty($idpersona)) {

                  if (
                     $objCliente->Registrar(
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
                        $notaPersona,
                        $max_credito,
                        $apodo,
                        $notaCliente,
                        $estadoCliente,
                        $fiador,
                        $created_empleado_id,
                        $idglobal
                     )
                  ) {
                     echo "Cliente Registrado correctamente.";
                  } else {
                     echo "ERROR: Cliente no ha podido ser registado.";
                  }
               } else {

                  if (
                     $objCliente->Modificar(
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
                        $notaPersona,
                        $idcliente,
                        $max_credito,
                        $apodo,
                        $notaCliente,
                        $estadoCliente,
                        $fiador,
                        $created_empleado_id,
                        $idglobal
                     )
                  ) {
                     echo "Cliente Actualizado correctamente.";
                  } else {
                     echo "ERROR: Cliente no ha podido ser Actualizado.";
                  }
               }
            } else {
               echo 'error';
            }
         } else {
            echo 'error';
         }
      } else {
         $ruta_carga = $rutaImgCli;
         if (empty($idpersona)) {

            if (
               $objCliente->Registrar(
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
                  $notaPersona,
                  $max_credito,
                  $apodo,
                  $notaCliente,
                  $estadoCliente,
                  $fiador,
                  $created_empleado_id,
                  $idglobal
               )
            ) {
               echo "Cliente Registrado correctamente.";
            } else {
               echo "ERROR: Cliente no ha podido ser registado.";
            }
         } else {


            if (
               $objCliente->Modificar(
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
                  $notaPersona,
                  $idcliente,
                  $max_credito,
                  $apodo,
                  $notaCliente,
                  $estadoCliente,
                  $fiador,
                  $created_empleado_id,
                  $idglobal
               )
            ) {
               echo "Cliente Actualizado correctamente.";
            } else {
               echo "ERROR: Cliente no ha podido ser Actualizado.";
            }
         }
      }
      break;

   case 'SaveFromEcxel':
      $nameCampo = array(
         'A' => 'str_nombres',
         'B' => 'str_apellidos',
         'C' => 'str_sexo',
         'D' => 'str_tipo_documento',
         'E' => 'str_num_documento',
         'F' => 'str_ocupacion',
         'G' => 'str_telefono',
         'H' => 'str_email',
         'I' => 'str_direccion_departamento',
         'J' => 'str_direccion_ciudad',
         'K' => 'str_direccion_barrio',
         'L' => 'str_direccion_calle',
         'M' => 'dec_max_credito',
         'N' => 'str_apodo'

      );
      $json = array();
      function unique_multidim_array($array, $key)
      {

         $temp_array = array();

         $i = 0;

         $key_array = array();



         foreach ($array as $val) {

            if (!in_array($val[$key], $key_array)) {

               $key_array[$i] = $val[$key];

               $temp_array[$i] = $val;
            }

            $i++;
         }

         return $temp_array;
      }

      $excel_Clis = $_FILES["pantillaClientesExcel"];

      if ($excel_Clis['size'] > 0) {
         $tamanio = 200000; //Tamaño permitido en kb
         $permitidos = array('xls', 'xlsx'); //Archivos permitido

         $arregloArchivo = explode(".", $excel_Clis['name']);
         $extension = strtolower(end($arregloArchivo));

         if ($excel_Clis['error'] == 0 && $excel_Clis['size'] < ($tamanio * 1024) && in_array($extension, $permitidos)) {

            try {
               $inputFileName = $excel_Clis['tmp_name'];
               $documento = IOFactory::load($inputFileName);

               $totalDeHojas = $documento->getSheetCount();


               # Iterar hoja por hoja
               for ($indiceHoja = 0; $indiceHoja < $totalDeHojas; $indiceHoja++) {
                  # Obtener hoja en el índice que vaya del ciclo
                  $hojaActual = $documento->getSheet($indiceHoja);
                  echo "<h3>Vamos en la hoja con índice $indiceHoja</h3>";

                  # Iterar filas
                  $i = 0;
                  foreach ($hojaActual->getRowIterator() as $fila) {

                     $jsonCliente = array();

                     foreach ($fila->getCellIterator() as $celda) {

                        if ($celda->getRow() != 1) {
                           # Columna, que es la A, B, C y así...
                           $columna = $celda->getColumn();

                           $jsonCliente[$nameCampo[$columna]] = $celda->getValue();
                        }
                     }
                     !$i or array_push($json, $jsonCliente);
                     $i++;
                  }
               }

               $details = unique_multidim_array($json, 'str_num_documento');

               print_r($details);



               print_r("ss <br>");

               print_r($json);
            } catch (Exception $th) {
               throw $th;
            }
         } else {
            echo "ERROR: tamaño no permitido";
         }
      } else {
         echo "ERROR: No subio archibo";
      }
      break;


   case 'updateDocumentoPersona':
      $created_empleado_id = $_SESSION['userEmpleado'];
      $idglobal = $_SESSION['idglobal'];
      $idpersona = limpiar_cadena($_POST['refPersona']);
      $tipo_documento = limpiar_cadena($_POST['cboBusTipo_Documento']);
      $num_documento = limpiar_cadena($_POST['txtbusNum_Documento']);

      $objCliente->editarDocumentoPersona($idglobal, $idpersona, $tipo_documento, $num_documento, $created_empleado_id);



      break;
   case "listClientesDeCartera":
      $idsucursal = $_SESSION['idsucursal'];
      $query = $objCliente->ListarClientesDeCartera($idsucursal);
      $i = 1;
      $data = array();
      $documento = 'xxxx';

      while ($reg = $query->fetch_object()) {
         if (isset($_SESSION['userEmpresa']) || in_array('ver documento', array_column($_SESSION['AUTHS'], 'nombre'))) {
            $documento = $reg->n_documento;
         }
         $data[] = array(
            $i,
            $reg->nombres,
            $reg->apellidos,
            $reg->t_documento,
            $documento,
            $reg->sexo,
            $reg->f_nacimiento,
            $reg->ocupacion,
            $reg->telefono,
            $reg->email,
            $reg->departamento,
            $reg->ciudad,
            $reg->barrio,
            $reg->calle,
            $reg->estado_cliente,
            $reg->max_credito,
            $reg->apodo,
            ''

         );
         $i++;
      }
      echo json_encode($data);
      break;
   case "listClientesMorososDeCartera":
      $idsucursal = $_SESSION['idsucursal'];
      $query = $objCliente->ListarClientesMorososDeCartera($idsucursal);
      $i = 1;
      $data = array();
      while ($reg = $query->fetch_object()) {
         $data[] = array(
            $i,
            $reg->resta,
            $reg->costo,
            $reg->valor,
            $reg->ut_adi_valor,
            $reg->fecha_at,
            $reg->cliente,
            $reg->t_documento . ' => ' . $reg->n_documento,
            $reg->tel,
            '<button onclick="restaurarMoroso(\'' . $reg->refTarjeta . '\')" type="button" class="btn btn-info" title="Restaurar "><i class="fa-solid fa-window-restore"></i></button>'

         );
         $i++;
      }
      echo json_encode($data);
      break;
   case "listClientesRetiradosDeCartera":
      $idsucursal = $_SESSION['idsucursal'];
      $query = $objCliente->ListarClientesRetiradosDeCartera($idsucursal);
      $i = 1;
      $data = array();
      while ($reg = $query->fetch_object()) {
         $data[] = array(
            $i,
            $reg->resta,
            $reg->costo,
            $reg->valor,
            $reg->ut_adi_valor,
            $reg->fecha_at,
            $reg->cliente,
            $reg->t_documento . ' => ' . $reg->n_documento,
            $reg->tel,
            $reg->estado,
            '<button onclick="restaurarRetirados(\'' . $reg->refTarjeta . '\')" type="button" class="btn btn-info" title="Restaurar "><i class="fa-solid fa-window-restore"></i></button>'

         );
         $i++;
      }
      echo json_encode($data);
      break;

   // comentarios
   case 'SaveOrupdateComentario':
      $idcomentario = limpiar_cadena($_POST['txtHiddenRefComentario']);
      $idcliente = limpiar_cadena($_POST['txtHiddenRefCliente']);
      $comentario = limpiar_cadena2($_POST['txtComentario']);
      $idusuario = $_SESSION['idusuario'];
      if (empty($idcomentario)) {
         $idcomentario = uniqidReal();
         $objCliente->createComentario($idcomentario, $comentario, $idusuario, $idcliente, 'comentario');
      } else {
         $objCliente->updateComentario($idcomentario, $comentario, $idusuario);
      }
      break;

   case 'lisComentarios':
      $json = array();
      $idcliente = limpiar_cadena($_REQUEST['refCliente']);
      $idusuario = $_SESSION['idusuario'];
      $query = $objCliente->listComentarios($idcliente, $idusuario);
      while ($res = $query->fetch_object()) {
         $json[] = array(
            $res->refComentario,
            $res->comentario,
            $res->persona,
            $res->foto,
            $res->fecha_at,
            $res->tipo
         );
      }
      echo json_encode($json);
      break;

   case 'eliminarComentario':
      $idusuario = $_SESSION['idusuario'];
      $refComentario = limpiar_cadena($_POST["refComentario"]);
      $objCliente->eliminarComentario($refComentario, $idusuario);
      break;
   // Alertas personal

   case 'SearchAlerta':
      $idcliente = limpiar_cadena($_REQUEST['refCliente']);
      $idusuario = $_SESSION['idusuario'];
      $query = $objCliente->SearchAlerta($idcliente, $idusuario);
      $res = $query->fetch_object();
      echo json_encode($res);
      break;

   case 'SaveOrupdateAlerta':
      $idcomentario = limpiar_cadena($_POST['ftxtHiddenRefAlert']);
      $idcliente = limpiar_cadena($_POST['ftxtHiddenRefCliente']);

      $txtIcon = limpiar_cadena2($_POST['ftxtIcon']);
      $txtColor = limpiar_cadena($_POST['ftxtColor']);
      $txtAsunto = limpiar_cadena2($_POST['ftxtAsunto']);
      $txtAlerta = limpiar_cadena2($_POST['ftxtAreaAlerta']);
      $txtAsunto = str_ireplace("/,", "", $txtAsunto);
      $txtAlerta = str_ireplace("/,", "", $txtAlerta);

      $comentario = $txtIcon . '/,' . $txtColor . '/,' . $txtAsunto . '/,' . $txtAlerta;
      $idusuario = $_SESSION['idusuario'];

      if (empty($idcomentario)) {
         $query = $objCliente->SearchAlerta($idcliente, $idusuario);
         $res = $query->fetch_object();
         if (empty($res->id)) {
            $idcomentario = uniqidReal();
            $objCliente->createComentario($idcomentario, $comentario, $idusuario, $idcliente, 'alerta');
            return;
         }
         $idcomentario = $res->id;
         // $objCliente->updateComentario($idcomentario, $comentario);
      } else {
         //  $objCliente->updateComentario($idcomentario, $comentario);

      }
      break;
   case 'restaurarMoroso':
      if (
         isset($_SESSION['userEmpresa']) ||
         in_array('pasar activos', array_column($_SESSION['AUTHS'], 'nombre')) ||
         in_array('pasar activos retirados', array_column($_SESSION['AUTHS'], 'nombre'))
      ) {
         $idtarjeta = limpiar_cadena2($_POST['refTarjeta']);
         $objCliente->restaurarMoroso($idtarjeta);
      } else {
         echo "ERROR: No estas authorizado para esta accion";
      }

      break;
   case "search":
      $data = array();
      $search = limpiar_cadena($_POST["ref"]);
      // Busco en personas 
      $query = $objCliente->searchClientes($search);

      while ($reg = $query->fetch_object()) {
         $data_tarjetas = array();
         $data_descuentos = array();
         //Busco si es empleado
         $query_is_empleado = $objCliente->isEmpleado($reg->idpersona);
         $reg_empleado = $query_is_empleado->fetch_object();
         // busco obligaciones
         $query_obligaciones = $objCliente->obligaciones($reg->idpersona);
         while ($reg_obligacion = $query_obligaciones->fetch_object()) {
            $data_tarjetas[] = $reg_obligacion;
         }
         // busco descuentos
         $query_descuentos = $objCliente->descuentos($reg->idpersona);
         while ($reg_descuento = $query_descuentos->fetch_object()) {
            $data_descuentos[] = $reg_descuento;
         }

         $data[] = array(

            "persona" => $reg,
            "empleado" => empty($reg_empleado->idempleado) ?  null : $reg_empleado,
            "tarjetas" => $data_tarjetas,
            "descuentos" => $data_descuentos,
            "isBoton" => $_SESSION['idglobal'] == $reg->idglobal ? 0 : 1
         );
      }
      echo json_encode($data);
      break;
   case "savePersona":
      $idpersona = limpiar_cadena($_POST['ref']);
      $irpersona = $objCliente->getPersona($idpersona);
      $res = $irpersona->fetch_object();
      $res->idglobal = $_SESSION['idglobal'];
      $query = $objCliente->createPersona($res);
      // echo json_encode($res);
      break;
}
/*                $reg->idglobal,
                $reg->str_razon_social,
                $reg->nombre,
                $reg->str_tipo_documento,
                $reg->str_num_documento,
                $reg->str_telefono,
                $reg->str_email,
                $reg->str_direccion_departamento,
                $reg->str_direccion_ciudad,
                $reg->str_direccion_barrio,
                $reg->str_direccion_calle,
                $reg->str_nota,
                $reg->created_at,*/