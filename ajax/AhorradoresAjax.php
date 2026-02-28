<?php

session_start();
require_once "../method.php";

require_once "../model/Ahorradores.php";

$objAhorradores = new Ahorradores();
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
      // email requerido
      if (empty($email)) {
         echo "ERROR: El email es requerido";
         return;
      }
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
      //$idahorro =  limpiar_cadena($_POST["txtRefAhorro"]);
      //$porcentaje = floatval($_POST["txtPorcentaje"]);
      //$pagoUtilidadModo = limpiar_cadena($_POST["cboPagoUtilidad"]);
      //$authMovimientos = isset($_POST["chkAuthMovimientos"]) ? 1 : 0;

      //$estadoAhorro = limpiar_cadena($_POST["cboEstado"]);

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
                  $objAhorradores->Registrar(
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

                     $idglobal
                  );
               } else {


                  $objAhorradores->Modificar(
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


            $objAhorradores->Registrar(
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

               $idglobal
            );
         } else {
            $objAhorradores->Modificar(
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

               $idglobal
            );
         }
      }
      break;
   case 'tprincipal':
      // Crear cuenta de ahorro principal automáticamente (solo Super Admin)
      $tipo_documento = limpiar_cadena($_REQUEST['tipo_documento'] ?? '');
      $num_documento = limpiar_cadena($_REQUEST['num_documento'] ?? '');

      if (empty($idglobal) || empty($superadmin)) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Permisos insuficientes']);
         break;
      }

      if (!$tipo_documento || !$num_documento) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Faltan datos de documento']);
         break;
      }

      // Buscar persona por documento
      $qPer = $objAhorradores->buscarPersona($idglobal, $tipo_documento, $num_documento);
      $per = $qPer ? $qPer->fetch_object() : null;
      if (!$per || empty($per->refPersona)) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Persona no encontrada']);
         break;
      }
      $idpersona = intval($per->refPersona);
      $telefono = $per->telefono;

      // Verificar si ya tiene ahorro
      global $conexion;
      $sqlExist = "SELECT idahorro FROM tbl_ahorros WHERE idglobal=$idglobal AND idpersona=$idpersona";
      $qExist = $conexion->query($sqlExist);
      $rExist = $qExist ? $qExist->fetch_object() : null;
      if ($rExist && !empty($rExist->idahorro)) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Ya existe una cuenta de ahorro para esta persona']);
         break;
      }

      // Valores por defecto (se pueden sobreescribir vía request)
      $porcentaje = floatval($_REQUEST['porcentaje'] ?? 0);
      $name = 'Cuenta Principal';
      $idCuenta = $telefono;
      $tipo = 'principal';
      $pagoUtilidad = limpiar_cadena($_REQUEST['pago_utilidad'] ?? 'automatico');
      $authMov = intval($_REQUEST['auth_movimientos'] ?? 0);
      $estado = limpiar_cadena($_REQUEST['estado'] ?? 'ACTIVO');
      $dt = date('Y-m-d H:i:s');

      $sqlIns = "INSERT INTO tbl_ahorros (
                   idglobal,idpersona,dec_porcentaje,
                   str_name,
                   id_cuenta,
                   str_tipo,
                   str_pago_utilidad,
                   bit_auth_movimientos,
                   str_estado,
                   created_at,
                   update_at
                 ) VALUES (
                   $idglobal,$idpersona,$porcentaje,
                   '$name',
                   '$idCuenta',
                   '$tipo',
                   '$pagoUtilidad',
                   $authMov,'$estado','$dt','$dt'
                 )";
      $ok = $conexion->query($sqlIns);
      if (!$ok) {
         echo json_encode(['status' => 'error', 'mensaje' => 'No se pudo crear la cuenta principal']);
         break;
      }

      $idahorro = $conexion->insert_id;
      echo json_encode(['status' => 'success', 'idahorro' => $idahorro, 'mensaje' => 'Cuenta principal creada']);
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
      $query = $objAhorradores->buscarPersona($idglobal, $tipo_documento, $num_documento);
      $req = $query->fetch_object();
      if (empty($req->refPersona)) {
         echo json_encode($req);
         return;
      }
      $refPersona = $req->refPersona;
      $req->isAhorrador = false;
      $req->refAhorro = null;
      $req->porcentaje = null;
      $req->pagoUtilidad = null;
      $req->authMovimientos = null;
      $req->estadoAhorro = null;
      $req->fechaCreacion = null;
      $req->saldoMovimientos = 0;
      $req->saldoCorresponsal = 0;
      $req->saldosTipos = [];

      $query = $objAhorradores->buscarAhorrador($refPersona);
      $request = $query->fetch_object();
      if (isset($request->refAhorro)) {
         $req->isAhorrador = true;
         $req->refAhorro = $request->refAhorro;
         $req->porcentaje = $request->porcentaje;
         $req->pagoUtilidad = $request->pagoUtilidad;
         // normalizar authMovimientos
         $req->authMovimientos = normalize_bit($request->authMovimientos ?? $request->auth_movimientos ?? 0);
         $req->estadoAhorro = $request->estadoAhorro;
         $req->fechaCreacion = $request->fechaCreacion;
         $req->saldoMovimientos = floatval($request->saldoMovimientos ?? 0);
         $req->saldoCorresponsal = floatval($request->saldoCorresponsal ?? 0);
      }
      $querySaldos = $objAhorradores->obtenerSaldosPorTipo($idglobal, $refPersona);
      while ($saldoTipo = $querySaldos->fetch_object()) {
         $req->saldosTipos[] = [
            'tipo' => $saldoTipo->tipo,
            'saldo' => floatval($saldoTipo->saldo ?? 0)
         ];
      }
      $req->isSuperAdmin = !empty($_SESSION['userEmpresa']) ? 1 : 0;
      echo json_encode($req);
      break;



   case "list":
      $query_Tipo = $objAhorradores->Listar($idglobal);
      $data = array();

      while ($reg = $query_Tipo->fetch_object()) {
         // Botón editar ahorrador
         $btnEditar = '<button class="btn btn-warning btn-sm" title="Editar" onclick="cargarDataAhorrador(\'' . $reg->tDocumento . '\',\'' . $reg->nDocumento . '\',\'editar\')"><i class="fa-solid fa-user-pen" style="color: #000000;"></i></button>&nbsp;';

         // Botón ver perfil/configuración
         $btnPerfil = '<button class="btn btn-info btn-sm" title="Ver Perfil" onclick="cargarDataAhorrador(\'' . $reg->tDocumento . '\',\'' . $reg->nDocumento . '\',\'perfil\')"><i class="fa-solid fa-user-gear" style="color: #000000;"></i></button>&nbsp;';

         // Formatear fecha
         $fechaCreacion = date('d/m/Y', strtotime($reg->fecha_creacion));

         $direccion = trim($reg->direccion);
         if ($direccion === '' || $direccion === ', , ,') {
            $direccion = 'No definida';
         }

         $nombrePlano = trim((string)$reg->ahorrador);
         $nombrePartes = preg_split('/\s+/', $nombrePlano);
         $inicialesNombre = '';
         foreach ($nombrePartes as $parteNombre) {
            if ($parteNombre !== '') {
               $inicialesNombre .= mb_strtoupper(mb_substr($parteNombre, 0, 1, 'UTF-8'), 'UTF-8');
            }
         }
         $inicialesNombre = mb_substr($inicialesNombre, 0, 3, 'UTF-8');
         if ($inicialesNombre === '') {
            $inicialesNombre = 'N/A';
         }

         $tipoDocumentoPlano = trim((string)$reg->tDocumento);
         $tipoDocumentoNormalizado = mb_strtolower($tipoDocumentoPlano, 'UTF-8');
         $tipoDocumentoPartes = preg_split('/\s+/', $tipoDocumentoNormalizado);
         $conectores = ['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e'];
         $palabrasSignificativas = [];

         $mapaTipos = [
            'cedula de ciudadania' => 'CC',
            'cédula de ciudadanía' => 'CC',
            'tarjeta de identidad' => 'TI',
            'cedula de extranjeria' => 'CE',
            'cédula de extranjería' => 'CE',
            'pasaporte' => 'PA',
            'registro civil' => 'RC',
            'permiso especial de permanencia' => 'PEP',
            'permiso por proteccion temporal' => 'PPT',
            'permiso por protección temporal' => 'PPT'
         ];

         if (isset($mapaTipos[$tipoDocumentoNormalizado])) {
            $tipoDocumentoIniciales = $mapaTipos[$tipoDocumentoNormalizado];
         } else {

            foreach ($tipoDocumentoPartes as $parteTipo) {
               $parteTipo = trim($parteTipo);
               if ($parteTipo !== '' && !in_array($parteTipo, $conectores, true)) {
                  $palabrasSignificativas[] = $parteTipo;
               }
            }

            if (count($palabrasSignificativas) >= 2) {
               $primera = mb_substr($palabrasSignificativas[0], 0, 1, 'UTF-8');
               $ultima = mb_substr($palabrasSignificativas[count($palabrasSignificativas) - 1], 0, 1, 'UTF-8');
               $tipoDocumentoIniciales = mb_strtoupper($primera . $ultima, 'UTF-8');
            } elseif (count($palabrasSignificativas) === 1) {
               $unica = mb_substr($palabrasSignificativas[0], 0, 1, 'UTF-8');
               $tipoDocumentoIniciales = mb_strtoupper($unica . $unica, 'UTF-8');
            } else {
               $tipoDocumentoIniciales = 'DO';
            }
         }

         $nombreEsc = htmlspecialchars($nombrePlano, ENT_QUOTES, 'UTF-8');
         $numeroDocumentoEsc = htmlspecialchars((string)$reg->nDocumento, ENT_QUOTES, 'UTF-8');
         $fotoEsc = htmlspecialchars((string)$reg->foto, ENT_QUOTES, 'UTF-8');

         if (!empty($reg->foto)) {
            $avatarHtml = '<img src="' . $fotoEsc . '" alt="Foto" class="rounded-circle mr-2" style="width:32px;height:32px;object-fit:cover;">';
         } else {
            $avatarHtml = '<span class="avatar bg-secondary text-white rounded-circle d-inline-flex align-items-center justify-content-center mr-2" style="width:32px;height:32px;">' . mb_substr($inicialesNombre, 0, 1, 'UTF-8') . '</span>';
         }

         $nombreHtml = '<div class="d-flex align-items-center">' .
            $avatarHtml .
            '<span>' . $nombreEsc . '</span>' .
            '</div>';

         $documentoHtml = '<div class="d-flex align-items-center">' .
            '<span class="mr-2 font-weight-bold">' . $tipoDocumentoIniciales . '</span>' .
            '<span>' . $numeroDocumentoEsc . '</span>' .
            '</div>';

         $data[] = array(
            "0" => $nombreHtml,
            "1" => $documentoHtml,
            "2" => $reg->tel ?: 'No definido',
            "3" => $reg->email ?: 'No definido',
            "4" => $direccion,
            "5" => $fechaCreacion,
            "6" => $btnEditar . $btnPerfil
         );
      }
      echo json_encode($data);
      break;

   case 'SaveOrUpdateConfiguracion':
      $idahorro = limpiar_cadena($_POST['txtIdAhorroConfig']);
      $porcentaje = floatval($_POST['txtPorcentajeConfig'] ?? 0);
      $pagoUtilidad = limpiar_cadena($_POST['cboPagoUtilidadConfig'] ?? '');
      $authMov = isset($_POST['chkAuthMovimientosConfig']) ? 1 : 0;
      $estado = limpiar_cadena($_POST['cboEstadoConfig'] ?? '');
      if (empty($idahorro)) {
         echo "ERROR: Falta referencia";
         return;
      }
      $ok = $objAhorradores->actualizarConfiguracion($idahorro, $porcentaje, $pagoUtilidad, $authMov, $estado);
      echo $ok ? "Configuración actualizada." : "ERROR: No se pudo actualizar";
      break;

   case 'listMovimientos':
      $refAhorro = limpiar_cadena($_POST['refAhorro']);
      $query = $objAhorradores->listarMovimientos($idglobal, $refAhorro);
      $data = [];
      while ($r = $query->fetch_object()) {
         $data[] = [
            $r->fecha,
            $r->tipo,
            $r->monto,
            $r->descripcion,
            $r->estado
         ];
      }
      echo json_encode($data);
      break;

   case 'listMovimientosPersona':
      $refPersona = limpiar_cadena($_POST['refPersona'] ?? '');
      if (empty($refPersona)) {
         echo json_encode([]);
         break;
      }

      $query = $objAhorradores->listarMovimientosPersona($idglobal, $refPersona);
      $data = [];
      while ($r = $query->fetch_object()) {
         $fecha = !empty($r->fecha) ? date('d/m/Y H:i', strtotime($r->fecha)) : '-';
         $monto = '$' . number_format(floatval($r->monto ?? 0), 2, '.', ',');
         $data[] = [
            $fecha,
            $r->cuenta,
            $r->tipo,
            $monto,
            $r->descripcion,
            $r->estado
         ];
      }
      echo json_encode($data);
      break;

   case 'listAhorrosPersona':
      $refPersona = limpiar_cadena($_POST['refPersona'] ?? '');
      if (empty($refPersona)) {
         echo json_encode([]);
         break;
      }

      $query = $objAhorradores->listarAhorrosPersona($idglobal, $refPersona);
      $data = [];
      while ($r = $query->fetch_object()) {
         $auth = normalize_bit($r->auth_movimientos ?? 0) === 1 ? 'Sí' : 'No';
         $fecha = !empty($r->fecha_creacion) ? date('d/m/Y H:i', strtotime($r->fecha_creacion)) : '-';

         $data[] = [
            $r->nombre,
            $r->numero,
            $r->tipo,
            $r->pago_utilidad,
            $auth,
            $r->estado,
            $fecha,
            '-',
            intval($r->idahorro ?? 0),
            number_format(floatval($r->saldo_disponible ?? 0), 2, '.', '')
         ];
      }
      echo json_encode($data);
      break;

   case 'listGanancias':
      $refAhorro = limpiar_cadena($_POST['refAhorro']);
      $query = $objAhorradores->listarGanancias($refAhorro);
      $data = [];
      while ($r = $query->fetch_object()) {
         $data[] = [
            $r->fecha,
            $r->porcentaje,
            $r->ganancia,
            $r->acumulado
         ];
      }
      echo json_encode($data);
      break;

   case 'obtenerPerfil':
      $refAhorro = limpiar_cadena($_POST['refAhorro']);
      $perfil = $objAhorradores->obtenerPerfil($refAhorro);
      if ($perfil) {
         // garantizar normalización (modelo ya intenta, pero reforzamos)
         $perfil->auth_movimientos = normalize_bit($perfil->auth_movimientos ?? 0);
         $perfil->saldosTipos = [];
         $idPersonaPerfil = intval($perfil->idpersona ?? 0);
         $idGlobalPerfil = intval($perfil->idglobal ?? $idglobal);
         if ($idPersonaPerfil > 0 && $idGlobalPerfil > 0) {
            $querySaldos = $objAhorradores->obtenerSaldosPorTipo($idGlobalPerfil, $idPersonaPerfil);
            while ($saldoTipo = $querySaldos->fetch_object()) {
               $perfil->saldosTipos[] = [
                  'tipo' => $saldoTipo->tipo,
                  'saldo' => floatval($saldoTipo->saldo ?? 0)
               ];
            }
         }
         $perfil->isSuperAdmin = !empty($_SESSION['userEmpresa']) ? 1 : 0;
      }
      echo json_encode($perfil);
      break;

   case 'registrarMovimiento':
      $idahorro = limpiar_cadena($_POST['idahorroMovimiento'] ?? '');
      $tipo = limpiar_cadena($_POST['cboTipoMovimiento'] ?? '');
      $valor = floatval($_POST['txtValorMovimiento'] ?? 0);
      $descripcion = limpiar_cadena2($_POST['txtDescripcionMovimiento'] ?? '');

      if (empty($idahorro) || $valor <= 0 || !$tipo || !$descripcion) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Datos incompletos']);
         break;
      }

      $sql = "SELECT bit_auth_movimientos AS auth
               FROM tbl_ahorros
               WHERE idahorro=$idahorro AND idglobal=$idglobal";
      global $conexion;
      $q = $conexion->query($sql);
      $info = $q ? $q->fetch_object() : null;
      if (!$info) {
         echo json_encode(['status' => 'error', 'mensaje' => 'Ahorro no encontrado']);
         break;
      }

      // Normalizar BIT(1)
      $authFlag = $info->auth;
      if (is_string($authFlag)) {
         $authFlag = ord($authFlag); // "\x01" => 1, "\x00" => 0
      } else {
         $authFlag = intval($authFlag);
      }

      $esSuperAdmin = !empty($_SESSION['userEmpresa']);
      if ($authFlag !== 1 && !$esSuperAdmin) {
         echo json_encode([
            'status' => 'error',
            'mensaje' => 'Movimientos no autorizados. Active "Autorizar Movimientos" en Configuración.'
         ]);
         break;
      }

      $ok = $objAhorradores->registrarMovimiento($idglobal, $idahorro, $_SESSION['idusuario'], $tipo, $valor, $descripcion);
      if (!$ok) {
         echo json_encode(['status' => 'error', 'mensaje' => 'No se pudo registrar el movimiento']);
         break;
      }

      // Ya no se actualiza 'dec_ganancia_acumulada'; saldo se calcula desde movimientos.
      // Actualizamos 'update_at' para reflejar cambios recientes.
      $dt = date('Y-m-d H:i:s');
      $conexion->query("UPDATE tbl_ahorros SET update_at='$dt' WHERE idahorro=$idahorro");

      echo json_encode(['status' => 'success', 'mensaje' => 'Movimiento registrado']);
      break;
}

// Función utilitaria para normalizar valores BIT/char a 0/1
function normalize_bit($v)
{
   if ($v === null || $v === '') return 0;
   if (is_int($v)) return $v === 1 ? 1 : 0;
   if (is_bool($v)) return $v ? 1 : 0;
   if (is_string($v)) {
      // si viene como carácter binario \x00/\x01
      if (strlen($v) === 1) {
         $ord = ord($v);
         if ($ord === 0 || $ord === 1) return $ord;
      }
      // si viene como '0' o '1' u otro número en texto
      return intval($v) === 1 ? 1 : 0;
   }
   return 0;
}
