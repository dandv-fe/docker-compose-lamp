<?php

session_start();
require_once "../method.php";

require_once "../model/Ahorros.php";

$objAhorros = new Ahorros();
$idglobal = $_SESSION['idglobal'];
$superadmin = $_SESSION['userEmpresa'];

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

      // datos ahorro
      $idahorro =  limpiar_cadena($_POST["txtRefAhorro"]);
      $porcentaje = floatval($_POST["txtPorcentaje"]);
      $pagoUtilidadModo = limpiar_cadena($_POST["cboPagoUtilidad"]);
      $authMovimientos = isset($_POST["chkAuthMovimientos"]) ? 1 : 0;

      $estadoAhorro = limpiar_cadena($_POST["cboEstado"]);

      if ($imagen_Cli['size'] > 0) {
         //si subio imagen
         $dirEspacioGlobal = "../Files/" . $idglobal . "/";
         $dirEspacioGlobalSucursal = $dirEspacioGlobal . "ahorros" . "/";
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
               $ruta_carga = "Files/" . $idglobal . "/" . "ahorros/" . $newNombreImg;
               if (empty($idpersona)) {
                  $objAhorros->Registrar(
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
                     $porcentaje,
                     $pagoUtilidadModo,
                     $authMovimientos,
                     $estadoAhorro,
                     $idglobal
                  );
               } else {


                  $objAhorros->Modificar(
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
                     $idahorro,
                     $porcentaje,
                     $pagoUtilidadModo,
                     $authMovimientos,
                     $estadoAhorro,
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


            $objAhorros->Registrar(
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
               $porcentaje,
               $pagoUtilidadModo,
               $authMovimientos,
               $estadoAhorro,
               $idglobal
            );
         } else {
            $objAhorros->Modificar(
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
               $idahorro,
               $porcentaje,
               $pagoUtilidadModo,
               $authMovimientos,
               $estadoAhorro,
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
      $query = $objAhorros->buscarPersona($idglobal, $tipo_documento, $num_documento);
      $req = $query->fetch_object();
      if (empty($req->refPersona)) {
         echo json_encode($req);
         return;
      }
      $refPersona = $req->refPersona;
      $req->isAhorrador = false;
      $req->refAhorro = null;
      $req->porcentaje = null;
      $req->gananciaAcumulada = null;
      $req->pagoUtilidad = null;
      $req->authMovimientos = null;
      $req->estadoAhorro = null;
      $req->fechaCreacion = null;

      $query = $objAhorros->buscarAhorrador($refPersona);
      $request = $query->fetch_object();
      if (isset($request->refAhorro)) {
         $req->isAhorrador = true;
         $req->refAhorro = $request->refAhorro;
         $req->porcentaje = $request->porcentaje;
         $req->gananciaAcumulada = $request->gananciaAcumulada;
         $req->pagoUtilidad = $request->pagoUtilidad;
         $req->authMovimientos = $request->authMovimientos;
         $req->estadoAhorro = $request->estadoAhorro;
         $req->fechaCreacion = $request->fechaCreacion;
      }
      echo json_encode($req);
      break;



   case "list":
      $query_Tipo = $objAhorros->Listar($idglobal);
      $data = array();

      while ($reg = $query_Tipo->fetch_object()) {
         // Botón editar ahorrador
         $btnEditar = '<button class="btn btn-warning btn-sm" title="Editar" onclick="cargarDataAhorrador(\'' . $reg->tDocumento . '\',\'' . $reg->nDocumento . '\',\'editar\')"><i class="fa-solid fa-user-pen" style="color: #000000;"></i></button>&nbsp;';

         // Botón ver perfil/configuración
         $btnPerfil = '<button class="btn btn-info btn-sm" title="Ver Perfil" onclick="cargarDataAhorrador(\'' . $reg->tDocumento . '\',\'' . $reg->nDocumento . '\',\'perfil\')"><i class="fa-solid fa-user-gear" style="color: #000000;"></i></button>&nbsp;';

         // Formatear estado
         $estadoBadge = $reg->estado == 'ACTIVO' ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-danger">' . $reg->estado . '</span>';

         // Formatear porcentaje
         $porcentaje = number_format($reg->porcentaje, 1) . '%';

         // Formatear auth movimientos
         $authMovimientos = $reg->auth_movimientos == 1 ? '<span class="badge badge-success">Sí</span>' : '<span class="badge badge-secondary">No</span>';

         // Formatear fecha
         $fechaCreacion = date('d/m/Y', strtotime($reg->fecha_creacion));

         $data[] = array(
            "0" => $reg->ahorrador,
            "1" => '<p>' . $reg->tDocumento . '</p><p>' . $reg->nDocumento . '</p>',
            "2" => $porcentaje,
            "3" => $reg->pago_utilidad ?: 'No definido',
            "4" => $authMovimientos,
            "5" => $estadoBadge,
            "6" => $fechaCreacion,
            "7" => $btnEditar . $btnPerfil
         );
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
      $idempleado = limpiar_cadena($_POST['txtUltimo']);
      $desde = limpiar_cadena2($_POST['txtFechaDesde']);
      $hasta = limpiar_cadena2($_POST['txtFechaHasta']);
      $data = array();
      // $idempleado = limpiar_cadena($_POST['refEmpleado']);
      $query = $objEmpleado->listNomnaDetalle($idempleado, $desde, $hasta);
      while ($reg = $query->fetch_object()) {
         $data[] = array(
            $reg->fecha_at,
            $reg->valor,
            $reg->consepto,
            $reg->detalle,
            $reg->codigo,
            $reg->tipo

         );
      }
      echo json_encode($data);
      break;

   case 'listPermisos':

      $data = array(
         'auth' => [],
         'authSucursal' => [],
         "sucurlales" => []
      );
      $idempleado = limpiar_cadena($_POST['refEmpleado']);
      $query = $objEmpleado->listAuths($idempleado, $idglobal);
      while ($reg = $query[0]->fetch_object()) {
         array_push($data['authSucursal'], $reg);
      }
      while ($reg = $query[1]->fetch_object()) {
         array_push($data['auth'], $reg);
      }
      while ($reg = $query[2]->fetch_object()) {
         array_push($data['sucurlales'], $reg);
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
      $query = $objEmpleado->listEmpleadosAsignadoEmpleado($superadmin, $idglobal, $refEmpleado);
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
      } else {
         echo  "¡ERROR: Inesperado!" . PHP_EOL;
         echo  "NADA SELECCIONADO";
      }

      /* if ($id_detalle_ruta == 0) {
            $objDespacar->registrar($idglobal, $idsucursal, $empleados_ids);
        } else {
            $objDespacar->modificar($id_detalle_ruta, $empleados_ids);
        }*/
      break;

   case 'registrarDespido':
      try {
         // Validar sesión y permisos
         if (empty($_SESSION['userEmpresa'])) {
            echo json_encode([
               'status' => 'error',
               'mensaje' => 'No tiene permisos para realizar esta acción'
            ]);
            return;
         }

         // Obtener y limpiar datos del formulario
         $idempleado = limpiar_cadena($_POST['txtIdEmpleadoDespedir']);
         $fecha_despido = limpiar_cadena($_POST['txtFechaDespido']);
         $tipo_despido = limpiar_cadena2($_POST['cboTipoDespido']);
         $motivo_despido = limpiar_cadena2($_POST['txtMotivoDespido']);
         $autorizado_por = limpiar_cadena2($_POST['txtAutorizadoPor']);
         $cargo_autoriza = limpiar_cadena2($_POST['txtCargoAutoriza']);
         $observaciones = limpiar_cadena2($_POST['txtObservaciones']);
         $fecha_ultimo_trabajo = limpiar_cadena2($_POST['txtFechaUltimoTrabajo']);
         $liquidacion_pendiente = limpiar_cadena2($_POST['txtMontoTotal']);
         $monto_liquidacion = limpiar_cadena2($_POST['txtMontoLiquidacion']);
         $entrega_documentos = limpiar_cadena($_POST['cboEntregaDocumentos']);
         $documentos_entregados = limpiar_cadena2($_POST['txtDocumentosEntregados']);
         $acta_firmada = limpiar_cadena($_POST['cboActaFirmada']);
         $derecho_recontratacion = limpiar_cadena($_POST['cboDerechoRecontratacion']);
         $created_empleado_id = $_SESSION['idempleado'];

         // Validaciones básicas
         if (empty($idempleado) || empty($fecha_despido) || empty($tipo_despido) || empty($motivo_despido)) {
            echo json_encode([
               'status' => 'error',
               'mensaje' => 'Faltan datos obligatorios. Verifique el formulario.'
            ]);
            return;
         }

         // Convertir monto a decimal o null
         $monto_liquidacion = !empty($monto_liquidacion) ? floatval($monto_liquidacion) : null;

         // Si fecha último trabajo está vacía, usar null
         $fecha_ultimo_trabajo = !empty($fecha_ultimo_trabajo) ? $fecha_ultimo_trabajo : null;

         // Registrar despido usando el modelo
         $resultado = $objEmpleado->registrarDespido(
            $idglobal,
            $idempleado,
            $fecha_despido,
            $tipo_despido,
            $motivo_despido,
            $autorizado_por,
            $cargo_autoriza,
            $observaciones,
            $fecha_ultimo_trabajo,
            $liquidacion_pendiente,
            $monto_liquidacion,
            $entrega_documentos,
            $documentos_entregados,
            $acta_firmada,
            $derecho_recontratacion,
            $created_empleado_id
         );

         echo json_encode($resultado);
      } catch (Exception $e) {
         echo json_encode([
            'status' => 'error',
            'mensaje' => 'Error al procesar el despido: ' . $e->getMessage()
         ]);
      }
      break;

   case 'listarDespedidos':
      $tipo_despido = limpiar_cadena2($_POST['tipo_despido']);
      $liquidacion = limpiar_cadena2($_POST['liquidacion']);
      $fecha_desde = limpiar_cadena2($_POST['fecha_desde']);
      $fecha_hasta = limpiar_cadena2($_POST['fecha_hasta']);

      $query = $objEmpleado->listarDespedidos($idglobal, $tipo_despido, $liquidacion, $fecha_desde, $fecha_hasta);
      $data = array();

      while ($reg = $query->fetch_object()) {
         $data[] = array(
            'id' => $reg->id,
            'idEmpleado' => $reg->idEmpleado,
            'empleado' => $reg->empleado,
            'documento' => $reg->documento,
            'cargo' => $reg->cargo,
            'fechaDespido' => $reg->fechaDespido,
            'tipoDespido' => $reg->tipoDespido,
            'liquidacion' => $reg->liquidacion,
            'estadoDocs' => $reg->estadoDocs,
            'recontratacion' => $reg->recontratacion,
            'refEmpleado' => $reg->refEmpleado
         );
      }

      echo json_encode($data);
      break;

   case 'obtenerDetalleDespido':
      $id = limpiar_cadena($_POST['id']);

      $query = $objEmpleado->obtenerDetalleDespido($id);
      $reg = $query->fetch_object();

      if ($reg) {
         // Calcular tiempo trabajado
         $diasTrabajados = $reg->diasTrabajados;
         $anios = floor($diasTrabajados / 365);
         $meses = floor(($diasTrabajados % 365) / 30);
         $dias = ($diasTrabajados % 365) % 30;

         $tiempoTrabajado = '';
         if ($anios > 0) $tiempoTrabajado .= $anios . ' año' . ($anios > 1 ? 's' : '') . ' ';
         if ($meses > 0) $tiempoTrabajado .= $meses . ' mes' . ($meses > 1 ? 'es' : '') . ' ';
         if ($dias > 0) $tiempoTrabajado .= $dias . ' día' . ($dias > 1 ? 's' : '');

         $data = array(
            'id' => $reg->id,
            'empleado' => $reg->empleado,
            'documento' => $reg->documento,
            'cargo' => $reg->cargo,
            'telefono' => $reg->telefono,
            'foto' => $reg->foto,
            'fechaIngreso' => $reg->fechaIngreso,
            'fechaDespido' => $reg->fechaDespido,
            'fechaUltimoTrabajo' => $reg->fechaUltimoTrabajo,
            'tiempoTrabajado' => trim($tiempoTrabajado) ?: 'N/A',
            'tipoDespido' => $reg->tipoDespido,
            'motivo' => $reg->motivo,
            'autorizadoPor' => $reg->autorizadoPor,
            'cargoAutoriza' => $reg->cargoAutoriza,
            'observaciones' => $reg->observaciones,
            'liquidacion' => $reg->liquidacion,
            'montoLiquidacion' => $reg->montoLiquidacion,
            'entregaDocumentos' => $reg->entregaDocumentos,
            'documentosEntregados' => $reg->documentosEntregados,
            'actaFirmada' => $reg->actaFirmada,
            'recontratacion' => $reg->recontratacion
         );

         echo json_encode($data);
      } else {
         echo json_encode(null);
      }
      break;

   case 'estadisticasDespedidos':
      $query = $objEmpleado->obtenerEstadisticasDespedidos($idglobal);
      $reg = $query->fetch_object();

      $data = array(
         'total' => $reg->total ?? 0,
         'meActual' => $reg->meActual ?? 0,
         'liquidacionesPendientes' => $reg->liquidacionesPendientes ?? 0,
         'documentosCompletos' => $reg->documentosCompletos ?? 0
      );

      echo json_encode($data);
      break;

   case 'actualizarEstadoDespido':
      $id = limpiar_cadena($_POST['id']);
      $montoPendiente = limpiar_cadena2($_POST['montoPendiente']);
      $documentos = limpiar_cadena($_POST['documentos']);
      $actaFirmada = isset($_POST['actaFirmada']) ? limpiar_cadena($_POST['actaFirmada']) : null;
      $documentosEntregados = isset($_POST['documentosEntregados']) ? limpiar_cadena($_POST['documentosEntregados']) : null;
      $observaciones = isset($_POST['observaciones']) ? limpiar_cadena($_POST['observaciones']) : null;

      $resultado = $objEmpleado->actualizarEstadoDespido(
         $id,
         $montoPendiente,
         $documentos,
         $actaFirmada,
         $documentosEntregados,
         $observaciones
      );
      echo json_encode($resultado);
      break;

   case 'recontratarEmpleado':
      $idDespido = limpiar_cadena($_POST['idDespido']);
      $idEmpleado = limpiar_cadena($_POST['idEmpleado']);
      $fechaReingreso = limpiar_cadena2($_POST['fechaReingreso']);
      $cargo = limpiar_cadena($_POST['cargo']);
      $observaciones = isset($_POST['observaciones']) ? limpiar_cadena2($_POST['observaciones']) : '';

      $resultado = $objEmpleado->recontratarEmpleado(
         $idDespido,
         $idEmpleado,
         $fechaReingreso,
         $cargo,
         $observaciones,
         $_SESSION['idempleado']
      );
      echo json_encode($resultado);
      break;
}
