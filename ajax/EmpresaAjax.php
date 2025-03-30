<?php

session_start();
require_once "../method.php";

require_once "../model/Empresa.php";


$classEmpresas = new ClassEmpresas();

$idglobal = $_SESSION['idglobal'];


switch ($_GET["op"]) {

    case 'SaveOrUpdate':
        $password = '';

        // cliente empresario
        $idpersona = intval($_POST["txtRefPersona"]); // hidden
        $nombres = limpiar_cadena($_POST["txt_Nombre"]);
        $apellidos = limpiar_cadena($_POST["txt_Apellido"]);
        //foto cliente
        $imagen_Cli = $_FILES["imagen_Cli"];
        $rutaImgCli = limpiar_cadena2($_POST["txt_RutaImgCli"]);
        $sexo = limpiar_cadena($_POST["txt_Sexo"]);
        $fecha_nacimiento = limpiar_cadena2($_POST["txt_fechaNacimiento"]);
        $ocupacion = limpiar_cadena($_POST["txt_Ocupacion"]);
        $telefono = limpiar_cadena($_POST["txt_Telefono"]);
        $tipo_documento = limpiar_cadena($_POST["txt_tipo_documento"]);
        $num_documento = limpiar_cadena($_POST["txt_num_Documento"]);
        $email = limpiar_cadena2($_POST["txt_Email"]);
        $direccion_departamento = limpiar_cadena($_POST["txt_Direccion_Departamento"]);
        $direccion_siudad = limpiar_cadena($_POST["txt_Direccion_Provincia"]);
        $direccion_barrio = limpiar_cadena($_POST["txt_Direccion_Distrito"]);
        $direccion_calle = limpiar_cadena2($_POST["txt_Direccion_Calle"]);
        $nota = '';//limpiar_cadena($_POST["txt_Nota_Cliente"]);
        // usuario
        $idusuario = intval($_POST['txtRefUsuario']);
        $login = limpiar_cadena($_POST["txt_Login"]);
        if (empty($_POST["txt_Password"])) {
            $password = limpiar_cadena2($_POST["txtidPublica"]);
        } else {
            $password = limpiar_cadena2($_POST["txt_Password"]);
            $password = !$password ? $claveAnterior : md5($password);
        }

        // empresa
        $idempresa = intval($_POST["txtRefEmpresa"]);
        $empresa = limpiar_cadena($_POST["txtEmpresa"]); // Llamamos al input txtNombre
        $estado = limpiar_cadena($_POST["txt_estado"]);
        $max_sucursal = intval($_POST["txt_Maxsucursal"]);


        if ($imagen_Cli['size'] > 0) {
            $dir = "../Files/servicio/clientes/";

            $tamanio = 10000; //Tamaño permitido en kb
            $permitidos = array('jpg', 'jpeg', 'png'); //Archivos permitido

            $arregloArchivo = explode(".", $imagen_Cli['name']);
            $extension = strtolower(end($arregloArchivo));

            if ($imagen_Cli['error'] == 0 && $imagen_Cli['size'] < ($tamanio * 1024) && in_array($extension, $permitidos)) {

                unset($arregloArchivo[count($arregloArchivo) - 1]);
                $newNombreImg = join(" ", $arregloArchivo);
                $newNombreImg = renombrar_fotos($newNombreImg) . '.' . $extension;
                $ruta_carga = $dir . $newNombreImg;
                echo $ruta_carga;
                if (move_uploaded_file($imagen_Cli['tmp_name'], $ruta_carga)) {
                    $ruta_carga = 'Files/servicio/clientes/' . $newNombreImg;
                    if (empty($idempresa)) {
                        $classEmpresas->Registrar(
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
                        );
                    } else {

                        $classEmpresas->Modificar(
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
                        );
                    }
                } else {
                    echo 'ERROR: al guardar la Imagen';
                }


            } else {
                echo 'ERROR: general';
            }
        } else {
            $ruta_carga = $rutaImgCli;
            if (!$idempresa) {

                $classEmpresas->Registrar(
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
                );
            } else {
                $classEmpresas->Modificar(
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
                );

            }
        }
        break;
    case 'buscarClienteEmpresa':

        $tipo_documento = limpiar_cadena($_REQUEST['tipo_documento']);
        $num_documento = limpiar_cadena($_REQUEST['num_documento']);


        if (
            empty($idglobal) ||
            !$tipo_documento ||
            !$num_documento
        ) {
            echo json_encode(0);
            return;
        }

        $query = $classEmpresas->buscarClienteEnpresa($idglobal, $tipo_documento, $num_documento);
        $req = $query->fetch_object();
        echo json_encode($req);
        break;
    case "delete":

        $id = $_POST["id"]; // Llamamos a la variable id del js que mandamos por $.post (Categoria.js (Linea 62))
        $result = $objGlobal->Eliminar($id);
        if ($result) {
            echo "Configuración global eliminada Exitosamente";
        } else {
            echo "La configuración global no fue Eliminada";
        }
        break;

    case "list":

        $query_Tipo = $classEmpresas->Listar($idglobal);
        # code...


        $i = 1;
        while ($reg = $query_Tipo->fetch_object()) {

            $data[] = array(
                $i,
                $reg->refGlobal,
                $reg->razonSocial,
                '<div class="user-block">
                <img class="img-circle img-bordered-sm" src="' . $reg->foto . '"
                    alt="cliente">
                <span class="username">
                    <a href="#">' . $reg->superadmin . '</a>
                </span>
                <span class="description"></span>
            </div>',
                $reg->actividades . ' de ' . $reg->max_sucursal,
                $reg->empleados,// $reg->str_simbolo_moneda,
                $reg->clientes,
                '<button class="btn btn-warning" title="Editar" onclick="cargarEmpresaCliente(\'' . $reg->t_documento . '\',\'' . $reg->n_documento . '\',\'editar\')"><i class="fa-solid fa-user-pen fa-xl" style="color: #000000;"></i> </button>&nbsp;'

            );
            $i++;
        }
        echo json_encode($data);

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

        echo $parte_izquierda . "" . $suma;

        break;
    /*------------------------------------------------------*/
    // Gestion
    case 'SaveOrUpdateGestion': 
        $iddescripcion_global=limpiar_cadena($_POST['hrefDg']);
        $idglobal_accion=limpiar_cadena($_POST['hrefGlobal']);
        $date_corte=limpiar_cadena2($_POST['txtFechaDesde']);
        $dec_valor=floatval($_POST['txtValor']);
        $int_dias_extras=intval($_POST['txtDiasExtras']);
        
        $classEmpresas->RegistrarGestion(
            $iddescripcion_global, 
            $idglobal, 
            $idglobal_accion, 
            $date_corte, 
            $dec_valor, 
            int_dias_extras: $int_dias_extras );
        
    break;

    case "listGestion": 
        $query = $classEmpresas->Gestion($idglobal);

        $i = 1;
        while ($reg = $query->fetch_object()) {

            $data[] = array(

                '<div class="user-block">
                <img class="img-circle img-bordered-sm" src="' . $reg->foto . '"
                    alt="cliente">
                <span class="username">
                    <a href="#">' . $reg->superadmin . '</a>
                </span>
                <span class="description"></span>
            </div>',
                $reg->razonSocial,
                $reg->date_corte,
                $reg->int_dias_extras,
                 //'<button class="btn btn-info" title="Gestionar" onclick="gestionarEmpresa( )"><i class="fa-solid fa-eye fa-xl" style="color: #000000;"></i> </button>&nbsp;'.
                '<button onclick="formGestionPago(' . $reg->refGlobal . ')" class="btn btn-info" title="Formulario de Pago" ><i class="fa-solid fa-dollar-sign fa-xl" style="color: #000000;"></i> </button>&nbsp;'

            );
            $i++;
        }
        echo json_encode($data);
    break;

}

//onclick="gestionarEmpresa(\'' . $reg->t_documento . '\',\'' . $reg->n_documento . '\',\'editar\')"
