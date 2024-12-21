<?php

session_start();
require_once "../method.php";

require_once "../model/Empleado.php";

$objEmpleado = new Empleado();
$idglobal = $_SESSION['idglobal'];
$superadmin=$_SESSION['userEmpresa'];

switch ($_GET["op"]) {

    case 'SaveOrUpdate':
        $password = '';
        //datos persona txtRefPersona
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
        $nota = '';
        // datos usuario txt_fechaIngreso
        $idusuario = limpiar_cadena($_POST["txtRefUsuario"]);
        $login = limpiar_cadena($_POST["txt_Login"]);
        if (empty($_POST["txt_Password"])) {
            $password = limpiar_cadena2($_POST["txtidPublica"]);
        } else {
            $password = limpiar_cadena2($_POST["txt_Password"]);
            $password = !$password ? $claveAnterior : md5($password);
        }

        // datos empleado
        $idempleado = limpiar_cadena($_POST["txtRefEmpleado"]);
        $fechaIngreso= limpiar_cadena2($_POST["txt_fechaIngreso"]);
        $apodo = limpiar_cadena($_POST["txtApodo"]);
        $cargo = limpiar_cadena($_POST["txtCargo"]);
        $estadoEmpleado = limpiar_cadena($_POST["txtEstadoEmpleado"]);

        $os = array("Super Administrador", "Semanal", "Quincenal", "Mensual");
        if (in_array($cargo, $os)) {
            echo "ERROR: Revisar el Formulario del empleado! cargos de  'Super Administrador' no pude asignar";
            return;
        }

        if ($imagen_Cli['size'] > 0) {
            //si subio imagen
            $dirEspacioGlobal = "../Files/" . $idglobal . "/";
            $dirEspacioGlobalSucursal = $dirEspacioGlobal . "empleado" . "/";
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
                    $ruta_carga = "Files/" . $idglobal . "/" . "empleado/" . $newNombreImg;
                    if (empty($idpersona)) {
                        $objEmpleado->Registrar(
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
                            $login,
                            $password,
                            $fechaIngreso,
                            $apodo,
                            $cargo,
                            $estadoEmpleado,
                            $idglobal
                        );
                    } else {


                        $objEmpleado->Modificar(
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
                            $idusuario,
                            $login,
                            $password,
                            $idempleado,
                            $fechaIngreso,
                            $apodo,
                            $cargo,
                            $estadoEmpleado,
                            $idglobal
                        );
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


                $objEmpleado->Registrar(
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
                    $login,
                    $password,
                    $fechaIngreso,
                    $apodo,
                    $cargo,
                    $estadoEmpleado,
                    $idglobal
                );
            } else {
                $objEmpleado->Modificar(
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
                    $idusuario,
                    $login,
                    $password,
                    $idempleado,
                    $fechaIngreso,
                    $apodo,
                    $cargo,
                    $estadoEmpleado,
                    $idglobal
                );
            }
        }
        break;

    case 'SaveOrUpdateSueldoPactado':
        $idnomina = limpiar_cadena($_POST["txtRefNomina"]);
        $idempleado = limpiar_cadena($_POST["txtRefEmpleado_formPactarSueldo"]);
        $modoSueldo = limpiar_cadena($_POST["cboModoSueldo"]);
        $valorSueldo = limpiar_cadena($_POST["txtValorSueldo"]);
        if ($idempleado == '' || $modoSueldo == '' || $valorSueldo == '') {
            echo "ERROR: revisar el formulario";
            return;
        }
        $valorSueldo = floatval($valorSueldo);
        if (empty($idnomina)) {
            $objEmpleado->RegistrarSueldo($idempleado, $idglobal, $modoSueldo, $valorSueldo);
        } else {
            $objEmpleado->ModificarSueldo($idnomina, $idempleado, $idglobal, $modoSueldo, $valorSueldo);
        }
        break;

    case 'buscarPersona':
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
        $query = $objEmpleado->buscarPersona($idglobal, $tipo_documento, $num_documento);
        $req = $query->fetch_object();
        if (empty($req->refPersona)) {
            echo json_encode($req);
            return;
        }
        $refPersona=$req->refPersona;
        $req->isEmpleado=false;
        $req->refEmpleado = '';
        $req->apodo = '';
        $req->cargo = '';
        $req->estadoEmpleado = '';
        $req->comentarios = '';
        $req->fecha_at = '';
        $req->fecha_inicio='';
        $req->refUsuario = '';
        $req->username = '';
        $req->id = '';
        $req->t_condiciones = '';
        $query = $objEmpleado->buscarEmpleado( $refPersona);
        $request = $query->fetch_object();
        if (isset($request->refEmpleado)) {
            $req->isEmpleado=true;
            $req->refEmpleado = $request->refEmpleado;
            $req->apodo = $request->apodo;
            $req->cargo = $request->cargo;
            $req->estadoEmpleado = $request->estadoEmpleado;
            $req->comentarios = $request->comentarios;
            $req->fecha_inicio = $request->fecha_inicio;
            $req->fecha_at = $request->fecha_at;
            $req->refUsuario = $request->refUsuario;
            $req->username = $request->username;
            $req->id = $request->id;
            $req->t_condiciones = $request->t_condiciones;
        }
        echo json_encode($req);
        break;



    case "list":
        $query_Tipo = $objEmpleado->Listar($idglobal);
        $data = array();
        $i = 1;

        while ($reg = $query_Tipo->fetch_object()) {
            $btneditar = $reg->cargo != 'Super Administrador' ?
                '<button class="btn btn-warning" title="Editar" onclick="cargarDataEmpleado(\'' . $reg->tDocumento . '\',\'' . $reg->nDocumento . '\',\'editar\')"><i class="fa-solid fa-user-pen fa-xl" style="color: #000000;"></i> </button>&nbsp;' :
                '<button class="btn btn-info" title="Editar" onclick="cargarDataEmpleado(' . $reg->refPersona . ',\'' . $reg->nDocumento . '\',\'editarUser\')"><i class="fa-solid fa-user-pen fa-xl" style="color: #000000;"></i> </button>&nbsp;';

                $estado= $reg->estado=='activo'? '<span class="badge badge-success">Activo</span>': '<span class="badge badge-danger">Inactivo</span>';
            $data[] = array(
                "0" => $i,
                "1" => $reg->empleado,
                "2" => '<p>' . $reg->tDocumento . '</p>' . '<p>' . $reg->nDocumento . '</p>',
                "3" => $reg->fecha_init,
                "4" => $estado,
                "5" => $reg->cargo,
                "6" => $reg->tel,
                "7" => '<img width=100px height=100px src="./' . $reg->foto . '" />',
                "8" => $btneditar .
                    '<button class="btn btn-default" title="Configuracion" onclick="cargarDataEmpleado(\'' . $reg->tDocumento . '\',\'' . $reg->nDocumento . '\',\'perfil\')"><i class="fa-solid fa-user-gear fa-xl" style="color: #000000;"></i> </button>'

            );
            $i++;
        }
        echo json_encode($data);
        break;
    case 'listNomina':
        $data = array();
        $estado = array('activo' => 'ACTUAL', 'inactivo' => 'ANTERIOR');
        $idempleado = limpiar_cadena($_POST['refEmpleado']);
        $query = $objEmpleado->listNomna($idempleado);
        while ($reg = $query->fetch_object()) {
            $data[] = array(
                $reg->fecha_at,

                $reg->m_sueldo,
                $reg->sueldo,
                $estado[$reg->estado]

            );
        }
        echo json_encode($data);
        break;
    case 'listNominaDetalle':
        $idempleado=limpiar_cadena($_POST['txtUltimo']);
        $desde = limpiar_cadena2($_POST['txtFechaDesde']);
        $hasta = limpiar_cadena2($_POST['txtFechaHasta']);
        $data = array();
       // $idempleado = limpiar_cadena($_POST['refEmpleado']);
        $query = $objEmpleado->listNomnaDetalle($idempleado,$desde,$hasta);
        while ($reg = $query->fetch_object()) {
            $data[] = array(
                $reg->fecha_at,
                $reg->valor,
                $reg->consepto,
                $reg->detalle

            );
        }
        echo json_encode($data);
        break;

    case 'listPermisos':

        $data = array('auth' => [], 'authSucursal' => [], "sucurlales" => $_SESSION['authSucursal']);
        $idempleado = limpiar_cadena($_POST['refEmpleado']);
        $query = $objEmpleado->listAuths($idempleado, $idglobal);
        while ($reg = $query[0]->fetch_object()) {
            array_push($data['authSucursal'], $reg);
        }
        while ($reg = $query[1]->fetch_object()) {
            array_push($data['auth'], $reg);
        }

        echo json_encode($data);
        break;
    case 'inicializarPermiso':
        $idempleado = limpiar_cadena($_POST['refEmpleado']);
        $idsucursal = limpiar_cadena($_POST['refSucursal']);
        $tipoUser = limpiar_cadena($_POST['tipoUser']);
        $ope = limpiar_cadena($_POST['ope']);
        $objEmpleado->inicializarPermisos($idglobal, $idempleado, $idsucursal, $tipoUser, $ope);
        break;
        case 'quitarAuth':
            $idempleado = intval($_POST['refEmpleado']);
            $idsucursal = intval($_POST['refSucursal']);
            $objEmpleado->quitarPermisos($idglobal, $idempleado, $idsucursal);
            break;

    case 'otorgarPermiso':
        $iduath = limpiar_cadena($_POST['refAuth']);
        $idauthsucursal = limpiar_cadena($_POST['refAuthSucursal']);
        $objEmpleado->manejarAuths($iduath, $idauthsucursal);
        break;


    case "listEmpleados":

        $query = $objEmpleado->cboListEmpleado($idglobal);
        echo '<option value="">--Seleccione--</option>';
        while ($reg = $query->fetch_object()) {
            echo '<option value="' . $reg->ref . '">' . $reg->empleado . '</option>';
        }


        break;


    case "AuthSucursalAddEmpleado":
        $idauthsucursal = $_POST["id"];
        $idauth = $_POST["idauth"];

        $query = $objEmpleado->AddAuthSucursalEmpleado($idauthsucursal, $idauth);

        break;
    case 'edit-super-a':
        $idpersona = limpiar_cadena($_POST['tipo_documento']);
        $user = limpiar_cadena($_POST['nameuser']);
        $pass = limpiar_cadena2($_POST['pass']);
        $pass = md5($pass);
        $objEmpleado->editUserSuperAdmin($idglobal, $idpersona, $user, $pass);
        break;
case 'listEmpleadosAsignadosEmpleado':
    $refEmpleado = limpiar_cadena($_GET['refEmpleado']);
    $query = $objEmpleado->listEmpleadosAsignadoEmpleado($superadmin,$idglobal,$refEmpleado);
    while ($reg = $query->fetch_object()) {
        $selected = $refEmpleado == $reg->refEmpleado || !empty($reg->refEmpleadoAsignado) ? 'selected' : '';
        echo '<option class="optEmpleadoDespachado" value="' . $reg->refEmpleado . '" ' . $selected . '>' . ucwords(strtolower($reg->empleado))   . '</option>';
       // echo '<option class="optEmpleadoDespachado" value="' . $reg->refEmpleado . '" >' . ucwords(strtolower($reg->empleado))  . '</option>';
    }
    break;
    case 'SaveEmpleadosAsignados':
        $idempleado = limpiar_cadena($_POST['refEmpleado']);
        $empleados_ids = $_POST['empls'];

        if (is_array($empleados_ids)) {
            $objEmpleado->registrarEmpleadosAsignado($idempleado, $empleados_ids);
        }else {
            echo  "¡ERROR: Inesperado!".PHP_EOL;
            echo  "NADA SELECCIONADO";
        }

       /* if ($id_detalle_ruta == 0) {
            $objDespacar->registrar($idglobal, $idsucursal, $empleados_ids);
        } else {
            $objDespacar->modificar($id_detalle_ruta, $empleados_ids);
        }*/
        break;
}
