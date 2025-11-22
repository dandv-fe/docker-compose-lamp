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
         // normalizar authMovimientos
         $req->authMovimientos = normalize_bit($request->authMovimientos ?? $request->auth_movimientos ?? 0);
         $req->estadoAhorro = $request->estadoAhorro;
         $req->fechaCreacion = $request->fechaCreacion;
      }
      $req->isSuperAdmin = !empty($_SESSION['userEmpresa']) ? 1 : 0;
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
      $ok = $objAhorros->actualizarConfiguracion($idahorro, $porcentaje, $pagoUtilidad, $authMov, $estado);
      echo $ok ? "Configuración actualizada." : "ERROR: No se pudo actualizar";
      break;

   case 'listMovimientos':
      $refAhorro = limpiar_cadena($_POST['refAhorro']);
      $query = $objAhorros->listarMovimientos($idglobal, $refAhorro);
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

   case 'listGanancias':
      $refAhorro = limpiar_cadena($_POST['refAhorro']);
      $query = $objAhorros->listarGanancias($refAhorro);
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
      $perfil = $objAhorros->obtenerPerfil($refAhorro);
      if ($perfil) {
         // garantizar normalización (modelo ya intenta, pero reforzamos)
         $perfil->auth_movimientos = normalize_bit($perfil->auth_movimientos ?? 0);
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

      $sql = "SELECT bit_auth_movimientos AS auth, dec_ganancia_acumulada AS acum
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

      $ok = $objAhorros->registrarMovimiento($idglobal, $idahorro, $_SESSION['idusuario'], $tipo, $valor, $descripcion);
      if (!$ok) {
         echo json_encode(['status' => 'error', 'mensaje' => 'No se pudo registrar el movimiento']);
         break;
      }

      $acumActual = floatval($info->acum);
      if ($tipo === 'aporte') {
         $acumNuevo = $acumActual + $valor;
      } elseif ($tipo === 'retiro') {
         $acumNuevo = max($acumActual - $valor, 0);
      } elseif ($tipo === 'ajuste') {
         $acumNuevo = $valor;
      } else {
         $acumNuevo = $acumActual;
      }

      $dt = date('Y-m-d H:i:s');
      $conexion->query("UPDATE tbl_ahorros SET dec_ganancia_acumulada=$acumNuevo, update_at='$dt' WHERE idahorro=$idahorro");

      echo json_encode(['status' => 'success', 'mensaje' => 'Movimiento registrado']);
      break;
}

// Función utilitaria para normalizar valores BIT/char a 0/1
function normalize_bit($v) {
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
