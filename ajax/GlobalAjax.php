<?php

session_start();

require_once "../model/Configuracion.php";

$objGlobal = new Configuracion();

switch ($_GET["op"]) {

    case 'SaveOrUpdate':

        $empresa = $_POST["txtEmpresa"]; // Llamamos al input txtNombre
        $nombre_impuesto = $_POST["txtNombre_Impuesto"];
        $porcentaje_impuesto = $_POST["txtPorcentaje_Impuesto"];
       
        $imagen = $_FILES["imagenGlobal"]["tmp_name"];
        $ruta = $_FILES["imagenGlobal"]["name"];
        // $aplicacion = $_FILES["aplicacionGlobal"]["tmp_name"];
        // $rutaAplicacion = $_FILES["aplicacionGlobal"]["name"];

        if(move_uploaded_file($imagen, "../Files/Global/".$ruta)){///////////////////////////////////////////////
            // if(move_uploaded_file($aplicacion, "../Files/Aplicacion/".$rutaAplicacion)){
            if(empty($_POST["txtIdGlobal"])){

                if($objGlobal->Registrar($empresa, $nombre_impuesto, $porcentaje_impuesto, "Files/Global/".$ruta)){
                    echo "Configuración Global registrada, se utilizará esta configuración.";
                }else{
                    echo "ERROR: La configuración global no ha podido ser registada.";
                }

            }else{

                $idglobal = $_POST["txtIdGlobal"];
                if($objGlobal->Modificar($idglobal, $empresa, $nombre_impuesto, $porcentaje_impuesto, "Files/Global/".$ruta)){
                    echo "La configuración Global ha sido actualizada";
                }else{
                    echo "ERROR: La Informacion de la configuración global no ha podido ser actualizada.";
                }
            }
            // }
        } else {//////////////////////////////////////////
            $ruta_img = $_POST["txtRutaImgLogo"];
            // $ruta_app = $_POST["txtRutaAplicacion"];
            if(empty($_POST["txtIdGlobal"])){
                if($objGlobal->Registrar($empresa, $nombre_impuesto, $porcentaje_impuesto, $ruta_img)){
                    echo "Configuración Global registrada, se utilizará esta configuración.";
                }else{
                    echo "ERROR: La configuración global no ha podido ser registada.";
                }

            }else{


                $idglobal = $_POST["txtIdGlobal"];
                if($objGlobal->Modificar($idglobal, $empresa, $nombre_impuesto, $porcentaje_impuesto, $ruta_img)){
                    echo "La configuración Global ha sido actualizada";
                }else{
                    echo "ERROR: La Informacion de la configuración global no ha podido ser actualizada.";
                }
            }
        }
        break;



    case "delete":

        $id = $_POST["id"];// Llamamos a la variable id del js que mandamos por $.post (Categoria.js (Linea 62))
        $result = $objGlobal->Eliminar($id);
        if ($result) {
            echo "Configuración global eliminada Exitosamente";
        } else {
            echo "La configuración global no fue Eliminada";
        }
        break;

    case "list":
        $query_Tipo = $objGlobal->Listar();
        $reg = $query_Tipo->fetch_object();

        echo json_encode($reg);

        break;

    case "GetImpuesto":
        $query_Tipo = $objGlobal->Listar();

        $reg = $query_Tipo->fetch_object();

        echo json_encode($reg);

        break;

    case "SN":
        $letra = "0154";

        $entero = intval($letra);

        $cant_letra = strlen($entero);

        $parte_izquierda = substr($letra, 0, -$cant_letra);

        $suma = $entero + 1;

        echo $parte_izquierda."".$suma;

        break;


}
