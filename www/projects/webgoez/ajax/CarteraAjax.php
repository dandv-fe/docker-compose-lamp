<?php

session_start();
if (in_array(($_GET['op'] ?? ''), ['VerfCuentas', 'resumenCajaRuta'], true) &&
    ((int)($_SESSION['idusuario'] ?? 0) <= 0 ||
     (int)($_SESSION['idglobal'] ?? 0) <= 0 ||
     (int)($_SESSION['idsucursal'] ?? 0) <= 0)) {
   http_response_code(401);
   header('Content-Type: application/json; charset=utf-8');
   echo json_encode(['error' => 'Inicia sesión y selecciona una sucursal.']);
   return;
}
require_once "../method.php";

require_once "../model/Cartera.php";
require_once "../model/Banco.php";
require_once "../model/AutorizarDespachoCartera.php";

$classCartera = new ClassCartera();
$objBancoPago = new Banco();
$idglobal = $_SESSION['idglobal'];
$createdEmpleadoId = $_SESSION['idempleado'];
$coverage = scopeRelevoCartera($conexion, $_SESSION, (int)($_SESSION['idsucursal'] ?? 0));
if ($coverage !== null && !$coverage->independentAccess && !$coverage->activeCoverage) {
   echo 'ERROR: La representación temporal de esta sucursal no está vigente';
   return;
}

function leerVueltoBancoDesdePost($sufijo)
{
   return round(floatval($_POST['txtVueltoBancoPago' . $sufijo] ?? 0), 2);
}

function leerPagoBancoDesdePost($sufijo, $maximo)
{
   $idbanco = intval($_POST['cboBancoPago' . $sufijo] ?? 0);
   if ($idbanco <= 0) {
      return array();
   }
   $valorTexto = trim((string)($_POST['txtValorBancoPago' . $sufijo] ?? ''));
   $valor = $valorTexto === '' ? floatval($maximo) : floatval($valorTexto);
   $referencia = trim((string)($_POST['txtReferenciaBancoPago' . $sufijo] ?? ''));
   $referencia = strip_tags($referencia);
   return array(array(
      'idbanco' => $idbanco,
      'valor' => $valor,
      'referencia' => $referencia
   ));
}


// Solo estas operaciones son de lectura; las demás requieren despacho.
$accionesLectura = [
   'buscarCliente', 'getDiferencia', 'listarRuta', 'listarDescripcion',
   'valid', 'VerfCuentas', 'resumenCajaRuta', 'listarTarjetasCanceladas', 'usercreated', 'listarBancosPago'
];
if (!in_array($_GET['op'] ?? '', $accionesLectura, true)) {
   $idsucursalDespacho = (int)($_SESSION['idsucursal'] ?? 0);
   $iddetallerutaDespacho = null;
   $estadosDespacho = ['created'];
   if ($_GET['op'] === 'deleteGastoDetalleRuta') {
      $consulta = db_prepare_execute(
         $conexion,
         'SELECT idsucursal, iddetalleruta FROM tbl_contabilidad_detalle WHERE idcontabilidad_detalle=? AND idglobal=? LIMIT 1',
         'si',
         [$_POST['id'] ?? '', (int)($idglobal ?? 0)]
      );
      $gasto = $consulta->get_result()->fetch_object();
      $consulta->close();
      $idsucursalDespacho = (int)($gasto->idsucursal ?? 0);
      $iddetallerutaDespacho = (int)($gasto->iddetalleruta ?? 0);
      $estadosDespacho = ['created', 'entregando'];
   }
   $error = errorDespachoCartera(
      $conexion, $_SESSION, $idsucursalDespacho, $iddetallerutaDespacho, $estadosDespacho
   );
   if ($error !== null) {
      echo $error;
      return;
   }
}

switch ($_GET["op"]) {

   case 'resumenCajaRuta':
      $caja = $classCartera->cajaBolsilloRuta((int)$idglobal, (int)$_SESSION['idsucursal']);
      echo json_encode(['ruta' => $caja['ruta'], 'totales' => $caja['totales']]);
      break;

   case 'listarBancosPago':
      $queryBancoPago = $objBancoPago->ListarActivos($idglobal, intval($_SESSION['idsucursal'] ?? 0));
      $bancos = array();
      while ($banco = $queryBancoPago->fetch_object()) {
         $bancos[] = array(
            'idbanco' => intval($banco->idbanco),
            'nombre' => $banco->str_banco,
            'tipo' => $banco->str_tipo,
            'numero' => $banco->str_num_cueneta,
            'titular' => $banco->str_titular,
            'documento' => $banco->str_documento_titular
         );
      }
      echo json_encode(array('ok' => true, 'data' => $bancos));
      break;

   case 'SaveOrUpdate':
      $idusuario = (int)($_SESSION['idusuario'] ?? 0);
      if ($idusuario <= 0) {
         echo "ERROR: Inicie sesion para registrar el credito";
         break;
      }
      $errors = array();
      $permitidos = array('ninguno', 'boleta', 'seguro');
      $idsucursal = $_SESSION['idsucursal']; // de SESSION
      $idventa = 0; // DE pendiente

      $tipoAdicional = limpiar_cadena($_POST['txtHiddenAdicional']);
      if (!in_array($tipoAdicional, $permitidos)) array_push($errors, 'Dsconocido');

      $iddetalle_documento_socursal = limpiar_cadena($_POST['txt_refDetalle_documento_sucursalfHidden']);
      $str_tipo_comprobante = limpiar_cadena($_POST['txt_tipo_comprobanteHidden']);
      $str_serie = limpiar_cadena($_POST['txt_ultima_serieHidden']);
      $ultimo_numero = limpiar_cadena($_POST['txt_ultimo_numeroHidden']);

      $idtarjeta = limpiar_cadena($_POST['txtrefTarjetaHidden']);
      $idcliente = limpiar_cadena($_POST['referencia-cliente']);

      $item = floatval($_POST['txtitemHidden']);

      $consepto = limpiar_cadena($_POST['txtConsepto']);
      $obligacion = limpiar_cadena2($_POST['txtObligacion']);
      $descripcion = limpiar_cadena($_POST['txtdescricion']);
      $cutaInicial = floatval($_POST['txtCuotaInicial']);
      $valor = floatval($_POST['txtValor']);
      $prestamo = floatval($_POST['txtCosto']);
      $modo = limpiar_cadena($_POST['txtModo']);
      $plazo = intval($_POST['txtTiempo']);
      $c_adicional_valor = floatval($_POST['txtRecaudo']);
      $str_nota = '';

      $utilidad = $valor - $prestamo;
      $c_adicional_numero = limpiar_cadena($_POST['txtNumBoleta']);
      //$str_tipo_comprobante = 'TICKET';


      $entero = intval($ultimo_numero);
      $cant_letra = strlen($entero);
      $parte_izquierda = substr($ultimo_numero, 0, -$cant_letra);
      $suma = $entero + 1;
      $str_numero = $parte_izquierda . "" . $suma;


      if (empty($idsucursal) || count($errors) > 0) {
         echo "ERROR: Complete el formulario";
         return;
      }

      if (empty($idtarjeta)) {
         if ($cutaInicial > 0 && !array_key_exists('cboBancoPagoInicial', $_POST)) {
            echo "ERROR: Seleccione cómo recibió la cuota inicial";
            break;
         }
         if ($cutaInicial > 0 && !ctype_digit((string)$_POST['cboBancoPagoInicial'])) {
            echo "ERROR: Seleccione efectivo o la cuenta que recibió la cuota inicial";
            break;
         }
         if ($cutaInicial <= 0 && !empty($_POST['cboBancoPagoInicial'])) {
            echo "ERROR: No registre un banco sin cuota inicial";
            break;
         }
         $idtarjeta = uniqidReal();
         $pagoBancoCredito = leerPagoBancoDesdePost('Credito', $prestamo);
         $pagoBancoInicial = $cutaInicial > 0 ? leerPagoBancoDesdePost('Inicial', $cutaInicial) : array();
         $classCartera->Registrar(
            $idtarjeta,
            $idglobal,
            $idsucursal,
            $idcliente,
            $idventa,
            $consepto,
            $valor,
            $modo,
            $plazo,
            $prestamo,
            $descripcion,
            $cutaInicial,
            $item,
            $utilidad,
            $c_adicional_numero,
            $c_adicional_valor,
            $str_tipo_comprobante,
            $str_serie,
            $str_numero,
            $str_nota,
            $createdEmpleadoId,
            $obligacion,
            $iddetalle_documento_socursal,
            $idusuario,
            $pagoBancoCredito,
            $pagoBancoInicial
         );
      } else {
         if ($classCartera->Modificar($idtarjeta, $idglobal, $idsucursal, $idcliente, $idventa, $consepto, $valor, $modo, $plazo, $prestamo, $descripcion, $item, $utilidad, $c_adicional_numero, $c_adicional_valor, $str_tipo_comprobante, $str_serie, $str_numero, $str_nota, $createdEmpleadoId)) {
            echo "";
         } else {
            echo "ERROR: No cumple la regla mínima";
         }
      }

      break;
   case 'SaveOrUpdateCredito':
      $idtarjeta = limpiar_cadena($_POST['textRefTarjeta']);
      $created_at = limpiar_cadena2($_POST['fecha_at']);
      $numero = limpiar_cadena2($_POST['num_obligacion']);
      $modo = limpiar_cadena($_POST['modo']);
      $plazo = intval($_POST['plazo']);
      $classCartera->ModificarCredito(
         $idtarjeta,
         $created_at,
         $numero,
         $modo,
         $plazo
      );
      break;
   case 'SaveOrUpdateAbono':
      $idusuario = (int)($_SESSION['idusuario'] ?? 0);
      if ($idusuario <= 0) {
         echo "ERROR: Inicie sesion para registrar el abono";
         break;
      }
      $idsucursal = $_SESSION['idsucursal'];

      $iddescripcion = limpiar_cadena($_POST['textRefDexcripcionHidden']);
      $idtarjeta = limpiar_cadena($_POST['txtrefTarjetaHidden']);
      if (empty($iddescripcion)) {
         $medioAbono = (string)($_POST['cboBancoPagoAbono'] ?? '');
         if (!preg_match('/^(0|[1-9][0-9]*)$/', $medioAbono)) {
            echo "ERROR: Seleccione efectivo o la cuenta que recibió el abono";
            break;
         }
      }
      $abono = floatval($_POST['txtCuotaHidden']) * -1;
      $pagoBancoAbono = leerPagoBancoDesdePost('Abono', abs($abono));
      $vueltoBancoAbono = leerVueltoBancoDesdePost('Abono');

      $resta = floatval($_POST['txtconfirma-credito']);

      if (empty($iddescripcion)) {
         $iddescripcion = uniqidReal();
         $classCartera->saveCuota($iddescripcion, $idglobal, $idsucursal, $idtarjeta, $abono, $resta, $idusuario, $pagoBancoAbono, $vueltoBancoAbono);
      } else {
         if (isset($_SESSION['userEmpresa']) || administraOficinaCartera($conexion, $_SESSION, (int)$idsucursal) ||
             tienePermisoTemporalCartera($conexion, $_SESSION, (int)$idsucursal, 'editar cuota') ||
             in_array('editar cuota', array_column($_SESSION['AUTHS'], 'nombre'))) {
            $classCartera->updateCuota($iddescripcion, $idsucursal, $abono, $resta);
         } else {
            echo "ERROR: No estas authorizado para esta accion";
         }
      }


      break;

   case 'buscarCliente':
      require_once "../model/Empleado.php";
      $objEmpleado = new Empleado();

      // $nombre = 'TICKET';
      $idsucursal = $_SESSION['idsucursal'];




      $idglobal = $_SESSION['idglobal'];
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

      $query = $classCartera->GetTipoDocSerieNum($idsucursal);
      $reg_comprobante = $query->fetch_object();
      if (empty($reg_comprobante->refDetalle_documento_sucursal)) {
         echo json_encode(1);
         return;
      }
      $query = $objEmpleado->buscarPersona($idglobal, $tipo_documento, $num_documento);
      $req = $query->fetch_object();
      if (empty($req->refPersona)) {
         echo json_encode($req);
         return;
      }
      $req->refDetalle_documento_sucursal = $reg_comprobante->refDetalle_documento_sucursal;

      $req->tipo_comprobante = $reg_comprobante->tipo_comprobante;
      $req->ultima_serie = $reg_comprobante->ultima_serie;
      $req->ultimo_numero = $reg_comprobante->ultimo_numero;
      $req->refCliente = 0;
      $query = $classCartera->buscarCliente($req->refPersona);
      $request = $query->fetch_object();
      if (isset($request->refCliente)) {
         $req->tarjetas = array();
         $req->tarjetasHistorial = array();
         $req->comentarios = array();
         $req->refCliente = $request->refCliente;
         $req->max_credito = $request->max_credito;
         $req->apodo = $request->apodo;
         $req->notaCliente = $request->notaCliente;
         $req->estadoCliente = $request->estadoCliente;
         $req->total_deuda_actual = $request->total_deuda_actual;

         /*if ($idglobal == "1002") {

            require_once "../model/Archivo1002.php";
            $classArchivo1002 = new ClassArchivo1002();
            $queryArchivo1002 = $classArchivo1002->Archivo1002($num_documento);

            while ($reg1 = $queryArchivo1002->fetch_object()) {
               array_push($req->tarjetas, $reg1);
               ///  array_push($req->tarjetasHistorial, $reg1);
            }
         }*/

         $query = $classCartera->buscarTarjetas($request->refCliente);

         while ($reg = $query->fetch_object()) {
            array_push($req->tarjetas, $reg);
         }



         require_once "../model/Cliente.php";
         $objCliente = new Cliente();
         $idusuario = $_SESSION['idusuario'];
         $queryi = $objCliente->listComentarios($req->refCliente, $idusuario);
         while ($regu = $queryi->fetch_object()) {
            array_push($req->comentarios, $regu);
         }
      }
      echo json_encode($req);
      break;

   case 'getDiferencia':
      $idsucursal = $_SESSION['idsucursal'];
      $query = $classCartera->getDiferencias($idsucursal);
      $req = $query->fetch_object();
      echo json_encode($req->diferencia);
      break;

   case "listarRuta":
      $idsucursal = $_SESSION['idsucursal'];
      $data = array();

      $query = $classCartera->listRuta($idsucursal);

      while ($result = $query->fetch_object()) {
         $data[] = $result;
      }
      echo json_encode($data);
      break;

   case 'ordenarMover':
      $idtarjeta = limpiar_cadena($_POST['id']);
      $item = floatval($_POST['item']);

      $classCartera->moverOrdenar($idtarjeta, $item);
      break;
   case 'SaveDescuentoMaxInteres':
      $idusuario = (int)($_SESSION['idusuario'] ?? 0);
      if ($idusuario <= 0) {
         echo "ERROR: Inicie sesion para registrar el ajuste";
         break;
      }
      $idsucursal = $_SESSION['idsucursal'];

      $operacion = limpiar_cadena($_POST['txtFormTipo']);
      $idtarjeta = limpiar_cadena($_POST['txtRefTarjeta']);
      $plazo = intval($_POST['txtmodalplazo']);
      $abono = floatval($_POST['txtmodalFormValor']);
      $descripcion = limpiar_cadena($_POST['txtmodalDescripcion']);

      $operacion != 'Descuento' || $abono = $abono * -1;

      $iddescripcion = uniqidReal();
      $classCartera->saveDescripcionDescuentoOrMasInteres($operacion, $iddescripcion, $idglobal, $idsucursal, $idtarjeta, $abono, $descripcion, $plazo, $idusuario);
      break;
   case 'listarDescripcion':
      $idtarjeta = limpiar_cadena($_GET['refTarjeta']);
      $data = array();
      $query = $classCartera->listarDescripcion($idtarjeta);
      while ($fetch = $query->fetch_object()) {
         $data[] = $fetch;
      }
      echo json_encode($data);
      break;

   case 'valid': // verifica carterea montada en Session 
      echo json_encode($_SESSION['idsucursal']);
      break;
   case 'VerfCuentas':
      $idsucursal = (int)($_REQUEST['id'] ?? 0);
      if (!puedeVerDetalleCuentasSucursal($conexion, $_SESSION, $idsucursal)) {
         http_response_code(403);
         header('Content-Type: application/json; charset=utf-8');
         echo json_encode(['error' => 'No tienes permiso para ver el detalle de esta sucursal.']);
         break;
      }
      $arrayCuentas = array();
      $recaudos = array();
      $newsCreditos = array();
      $newsContabilidad = array();
      $newsContabilidadOtrosGastos = array();
      $newsContabilidadSalidas = array();
      $newsContabilidadEntradas = array();
      $query_tbl_detalle_ruta_despachada = $classCartera->listTblDetalleRutaDespachada($idsucursal, $createdEmpleadoId);
      $fetch = $query_tbl_detalle_ruta_despachada[0]->fetch_object();

      array_push($arrayCuentas, $fetch);
      $query_descripcion_recaudo = $classCartera->listDescripcionNoGuardada($idsucursal);
      while ($reg = $query_descripcion_recaudo->fetch_object()) {

         array_push($recaudos, $reg);
      }

      $query_tbl_targeta_onSave = $classCartera->listTblTergetasNoGuardada($idsucursal);
      while ($a = $query_tbl_targeta_onSave->fetch_object()) {

         array_push($newsCreditos, $a);
      }

      if (isset($fetch->refDetalle_ruta)) {
         $query_contabilidad = $classCartera->listTblContabilidadNoGuardada($fetch->refDetalle_ruta);
         while ($a = $query_contabilidad->fetch_object()) {
            array_push($newsContabilidad, $a);
         }
      }


      array_push($arrayCuentas, $recaudos);
      array_push($arrayCuentas, $newsCreditos);
      array_push($arrayCuentas, $newsContabilidad);

      array_push($arrayCuentas, $query_tbl_detalle_ruta_despachada[1]);
      array_push($arrayCuentas, $query_tbl_detalle_ruta_despachada[2]);


      // otros Gastos

      if (isset($fetch->refDetalle_ruta)) {
         $query_contabilidad = $classCartera->listTblContabilidadNoGuardadaOtrosGastos($fetch->refDetalle_ruta, $createdEmpleadoId);
         while ($a = $query_contabilidad->fetch_object()) {
            array_push($newsContabilidadOtrosGastos, $a);
         }
      }
      // salidas

      if (isset($fetch->refDetalle_ruta)) {
         $query_contabilidad = $classCartera->listTblContabilidadNoGuardadaSalida($fetch->refDetalle_ruta, $createdEmpleadoId);
         while ($a = $query_contabilidad->fetch_object()) {
            array_push($newsContabilidadSalidas, $a);
         }
      }
      // entradas

      if (isset($fetch->refDetalle_ruta)) {
         $query_contabilidad = $classCartera->listTblContabilidadNoGuardadaEntradas($fetch->refDetalle_ruta, $createdEmpleadoId);
         while ($a = $query_contabilidad->fetch_object()) {
            array_push($newsContabilidadEntradas, $a);
         }
      }
      array_push($arrayCuentas, $newsContabilidadOtrosGastos);
      array_push($arrayCuentas, $newsContabilidadSalidas);
      array_push($arrayCuentas, $newsContabilidadEntradas);
      $arrayCuentas[] = $classCartera->cajaBolsilloRuta(
         (int)$idglobal, (int)$idsucursal, (int)($_SESSION['idusuario'] ?? 0)
      );

      echo json_encode($arrayCuentas);
      break;
   case 'deleteGastoDetalleRuta':
      $idcontabilidad_detalle = limpiar_cadena($_POST['id']);
      $classCartera->deleteGastoDetalleRuta($idcontabilidad_detalle, $createdEmpleadoId);
      break;
   case 'eliminarAbono':
      if (isset($_SESSION['userEmpresa']) || administraOficinaCartera($conexion, $_SESSION, (int)$_SESSION['idsucursal']) ||
          tienePermisoTemporalCartera($conexion, $_SESSION, (int)$_SESSION['idsucursal'], 'eliminar cuota') ||
          in_array('eliminar cuota', array_column($_SESSION['AUTHS'], 'nombre'))) {
         $iddescripcion = limpiar_cadena($_POST['refDescripcion']);
         $classCartera->eliminarAbono($iddescripcion);
      } else {
         echo "ERROR: No estas authorizado para esta accion";
      }
      break;
   case 'eliminarCredito':
      if (isset($_SESSION['userEmpresa']) || administraOficinaCartera($conexion, $_SESSION, (int)$_SESSION['idsucursal']) ||
          tienePermisoTemporalCartera($conexion, $_SESSION, (int)$_SESSION['idsucursal'], 'eliminar credito') ||
          in_array('eliminar credito', array_column($_SESSION['AUTHS'], 'nombre'))) {
         $idtarjeta = limpiar_cadena($_POST['refTarjeta']);
         $classCartera->eliminarCredito($idtarjeta);
      } else {
         echo "ERROR: No estas authorizado para esta accion";
      }
      break;

   case 'listarTarjetasCanceladas':

      $idsucursal = $_SESSION['idsucursal'];
      $desde = limpiar_cadena2($_POST['txtFechaDesde']);
      $hasta = limpiar_cadena2($_POST['txtFechaHasta']);
      if (empty($desde) || empty($hasta)) {

         echo json_encode(array('error' => ''));
      }
      $data = array();
      $i = 0;

      $documento = 'xxxx';
      $data = array();
      $query = $classCartera->listTarjetasCanceladas($idsucursal, $desde, $hasta);
      while ($result = $query->fetch_object()) {
         if (isset($_SESSION['userEmpresa']) || administraOficinaCartera($conexion, $_SESSION, (int)$idsucursal) || in_array('documento', array_column($_SESSION['AUTHS'], 'nombre'))) {
            $documento = $result->t_documento . ' => ' . $result->n_documento;
         }
         $data[] = array(
            $result->cancelo,

            $result->costo,
            $result->valor,
            $result->ut_adi_valor,
            $result->cancelo_fecha,
            $result->fecha_at,
            $result->cliente,
            $documento,

            $result->tel
         );
      }
      echo json_encode($data);
      break;

   case 'UpdateEstado':
      $idtarjeta = limpiar_cadena2($_POST['txtRefTarjetaCambiEstado']);
      $estado = limpiar_cadena2($_POST['txtmodalFormEstado']);
      $otroEstado = limpiar_cadena2($_POST['txtmodalOtroEstado']);
      if ($estado == 'otro') {
         $estado = $otroEstado;
      }


      if (empty($estado) || empty($idtarjeta)) {
         echo "ERROR: revise el formulario";
         return;
      }
      $os = array("cancelado", "inactiva", "cancelada", "inactivo", 'entregando', 'created');
      if (in_array($estado, $os)) {
         echo "ERROR: Estado no permitido!";
         return;
      }
      // echo 'ERROR: sssss';
      $classCartera->actualizarEstado($idtarjeta, $estado);
      break;
   case "usercreated":
      $idtargeta = limpiar_cadena2($_GET['ref']);
      $query = $classCartera->getUserCreated($idtargeta);
      $result = $query->fetch_object();
      echo json_encode($result);
      break;
}
