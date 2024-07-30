<?php

session_start();
require_once "../method.php";

require_once "../model/Sucursal.php";

$objSucursal = new Sucursal();
$useridglobal = $_SESSION['idglobal'];
switch ($_GET["op"]) {

    case 'SaveOrUpdate':

        $idsucursal = limpiar_cadena($_POST["txtIdSucursal"]);
        $tipo = limpiar_cadena($_POST["txtTipo"]);
        $razon_social = limpiar_cadena($_POST["txtRazon_Social"]);
        $tipo_documento = limpiar_cadena($_POST["comboTipo_Documento"]);
        $num_documento = limpiar_cadena($_POST["txtNum_Documento"]);
        $direccion = limpiar_cadena2($_POST["txtDireccion"]);
        $telefono = limpiar_cadena($_POST["txtTelefono"]);
        $email = limpiar_cadena2($_POST["txtEmail"]);
        $estado = limpiar_cadena($_POST['txtEstado']);
        $idreprecentante = limpiar_cadena($_POST["cboRepresentante"]);
        $adicional = limpiar_cadena($_POST["cboAdicional"]);
        $razon_social = preg_replace("/\s+/", "_", $razon_social);
        $imagen = $_FILES["imagenSuc"];
        $ruta_img = limpiar_cadena2($_POST["txtRutaImgSuc"]);


        if ($imagen['size'] > 0) {
            //si subio imagen
            $dirEspacioGlobal = "../Files/" . $useridglobal . "/";
            $dirEspacioGlobalSucursal = $dirEspacioGlobal . "sucursal" . "/";
            $tamanio = 10000; //Tamaño permitido en kb
            $permitidos = array('jpg', 'jpeg', 'png'); //Archivos permitido

            $arregloArchivo = explode(".", $imagen['name']);
            $extension = strtolower(end($arregloArchivo));



            if ($imagen['error'] == 0 && $imagen['size'] < ($tamanio * 1024) && in_array($extension, $permitidos)) {
                $primer_razon_social = explode(" ", $razon_social)[0];
                $newNombreImg = renombrar_fotos($primer_razon_social) . '.' . $extension;
                $ruta_carga = $dirEspacioGlobalSucursal . $newNombreImg;
                //Valida si no existe la carpeta y la crea
                if (!file_exists($dirEspacioGlobal)) {
                    mkdir($dirEspacioGlobal, 0777);
                }
                if (!file_exists($dirEspacioGlobalSucursal)) {
                    mkdir($dirEspacioGlobalSucursal, 0777);
                }

                if (move_uploaded_file($imagen['tmp_name'], $ruta_carga)) {
                    $ruta_carga = "Files/" . $useridglobal . "/" . "sucursal/" . $newNombreImg;
                    if (empty($idsucursal)) {

                        $objSucursal->Registrar($useridglobal, $tipo, $razon_social, $tipo_documento, $num_documento, $direccion, $telefono, $email, $idreprecentante, $ruta_carga, $estado,$adicional);


                    } else {

                        // $idglobal = $_POST["txtIdGlobal"];
                        $objSucursal->Modificar($idsucursal, $useridglobal, $tipo, $razon_social, $tipo_documento, $num_documento, $direccion, $telefono, $email, $idreprecentante, $ruta_carga, $estado,$adicional);
                    }
                } else {
                    echo 'error';
                }
            } else {
                echo 'error';
            }
        } else {

            $ruta_carga = $ruta_img;
            if (empty($idsucursal)) {

                $objSucursal->Registrar($useridglobal, $tipo, $razon_social, $tipo_documento, $num_documento, $direccion, $telefono, $email, $idreprecentante, $ruta_carga, $estado,$adicional);
            } else {

                // $idglobal = $_POST["txtIdGlobal"];
                $objSucursal->Modificar($idsucursal, $useridglobal, $tipo, $razon_social, $tipo_documento, $num_documento, $direccion, $telefono, $email, $idreprecentante, $ruta_carga, $estado,$adicional);
            }
        }


        break;

    case "list":

        $query_Tipo = $objSucursal->Listar();

        $i = 1;
        $data = array();
        while ($reg = $query_Tipo->fetch_object()) {
            $estado = $reg->estado == 'Disponible' ? '<span class="badge badge-success">Disponible</span>' : '<span class="badge badge-danger">Inactiva</span>';
            $data[] = array(
                $i,
                $reg->codigo,
                $reg->tipo,
                $estado,
                '<img width=100px height=100px src="./' . $reg->logo . '" />',
                $reg->empleado,
                '<button class="btn btn-warning" data-toggle="tooltip" title="Editar" onclick="cargarDataSucursal(\'' . $reg->id . '\')"><i class="fa fa-pencil"></i> </button>&nbsp;'/*.
                '<button class="btn btn-" data-toggle="tooltip" title="Configuracion" onclick="cambiarConfiguracion(\'' . $reg->id . '\')"><i class="fa-solid fa-gears"></i></button>'*/
            );
            $i++;
        }
        echo json_encode($data);
        break;

    case "listTipoDoc":
        require_once "../model/Tipo_Documento.php";

        $objTipo_Documento = new Tipo_Documento();

        $query_tipo_Documento = $objTipo_Documento->VerTipo_Documento_Persona();
        while ($reg = $query_tipo_Documento->fetch_object()) {
            echo '<option value="' . $reg->str_nombre . '">' . $reg->str_nombre . '</option>';
        }

        break;

    case 'buscarSucursal':
        $idsucursal = limpiar_cadena($_REQUEST['id']);
        $query = $objSucursal->buscarSucursal($idsucursal);
        $req = $query->fetch_object();
        echo json_encode($req);
        break;

}
