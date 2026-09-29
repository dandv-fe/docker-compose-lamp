<?php
session_start();
require_once "../method.php";
require_once "../model/RecibeCuentas.php";
require_once "../model/AutorizarDespachoCartera.php";
$objRecibeCuentas = new RecibeCuentas();
$idglobal = $_SESSION['idglobal'];
$userEmpleadoId = $_SESSION['idempleado'];
$superadmin = $_SESSION['userEmpresa'];

$operacion = $_GET['op'] ?? '';
if (!in_array($operacion, ['list', 'listTipoContabilidadS', 'listNominas', 'deContabilidad'], true)) {
   if ($operacion === 'SaveOrUpdateGastos') {
      $idsucursalDespacho = (int)($_POST['txtrefSucursalHidden'] ?? 0);
      $iddetallerutaDespacho = null;
      $estadosDespacho = ['created'];
   } else {
      $iddetallerutaDespacho = (int)($_POST['params'] ?? $_POST['thNumAleatorio'] ?? 0);
      $consulta = db_prepare_execute(
         $conexion,
         'SELECT idsucursal FROM tbl_detalle_ruta WHERE iddetalleruta=? AND idglobal=? LIMIT 1',
         'ii',
         [$iddetallerutaDespacho, (int)($idglobal ?? 0)]
      );
      $ruta = $consulta->get_result()->fetch_object();
      $consulta->close();
      $idsucursalDespacho = (int)($ruta->idsucursal ?? 0);
      $estadosDespacho = $operacion === 'SaveOrUpdateDtaCobro' ? ['created'] : ['entregando'];
      if ($operacion === 'manejarNotIncludeDetalleRuta') {
         $estadosDespacho = ['created', 'entregando'];
      }
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
   case "saveContabilidad":
      $iddetalleruta = limpiar_cadena($_POST["params"]);
      $objRecibeCuentas->registrarDetalleruta($iddetalleruta, $userEmpleadoId);
      break;

   case 'SaveOrUpdateDtaCobro':
      $iddetalleruta = limpiar_cadena($_POST['thNumAleatorio']);
      $base = floatval($_POST['inputBaseInformacion']);
      $efectivo = floatval($_POST['inputEfectivoInformacion']);
      $efectivoMoneda = floatval($_POST['inputMonedaInformacion']);
      $diferencia = floatval($_POST['txtDiferenciaHidden']);
      $objRecibeCuentas->RegistrarContabilidadDetalle($iddetalleruta, $base, $efectivo, $efectivoMoneda, $diferencia, $userEmpleadoId);
      break;

   case "SaveOrUpdateGastos":
      $idsucursal = limpiar_cadena($_POST['txtrefSucursalHidden']);
      $idtipo_contabilidad = limpiar_cadena($_POST['cboTipo_contabilidad']);
      $str_nombre = limpiar_cadena($_POST['cboDeContabilidad']);
      $idnomina = limpiar_cadena($_POST['txtrefNominaHidden']);
      $dec_total = floatval($_POST['txtValorContabilidad']);
      $str_detalle = limpiar_cadena($_POST['txtdescripcionContabilidad']);
      $str_operacion = limpiar_cadena2($_POST['txtOperacionContabilidad']);
      $pos = strpos($str_nombre, ' ');
      if ($pos) {
         echo 'ERROR: "De" No puede ser de mas de una palabra';
         return;
      }
      $objRecibeCuentas->RegistrarContabilidad($idglobal, $idsucursal, $idtipo_contabilidad, $dec_total, $str_detalle, $str_nombre, $str_operacion, $userEmpleadoId, $idnomina);
      break;

   case 'list':
      $data = array();
      $query = $objRecibeCuentas->ListContabilidadRecibir($idglobal, $superadmin, $userEmpleadoId);
      while ($result = $query->fetch_object()) {
         $btnSave = '';
         $btnEdit = '';
         $btnSave = $result->estado == 'entregando' ? '<button onclick="saveContabilibad(' . $result->refDetalle_ruta . ')" type="button" class="btn btn-success btn-sm"><i class="fa-regular fa-floppy-disk"></i></button>' : '';
         if (isset($_SESSION['userEmpresa']) || isset($result->verCuentasDetalladas)) {
            $btnEdit = '<button onclick="verFormContabilibad(' . $result->refSucursal . ', \'' . $result->codigo . '\', \'' . $result->tipo . '\')" type="button" class="btn btn-warning btn-sm"><i class="fa-regular fa-pen-to-square"></i></button>&nbsp;';
         }
         $data[] = array(
            '<div class="user-block">
                           
                            <span class="username">
                                <a href="#">' . $result->codigo . '</a>
                            </span>
                            <span class="description">' . $result->tipo . '</span>
                        </div>',
            $result->recaudo,
            $result->cantidadTotalRecaudos,
            $result->creditos,
            $result->descuento,
            $result->base,
            $result->efectivoMonedas,
            $result->efectivo,
            $result->efectivoOtraUtilidad,
            $result->diferencia,
            $result->gastos,
            $result->descripcion_gastos,
            '<button onclick="verFormContabilibadAdd(' . $result->refSucursal . ', \'salida-contabilidad\')" type="button" style="padding: 0; margin: 0; width: 100%;" class="btn btn-default">$' . $result->otros_gastos . '</button>',
            $result->descripcion_otros_gastos,
            '<button onclick="verFormContabilibadAdd(' . $result->refSucursal . ', \'salida\')" type="button" style="padding: 0; margin: 0; width: 100%;" class="btn btn-default">$' . $result->salida . '</button>',
            $result->descripcion_salida,
            '<button onclick="verFormContabilibadAdd(' . $result->refSucursal . ', \'entrada-contabilidad\')" type="button" style="padding: 0; margin: 0; width: 100%;" class="btn btn-default">$ ' . $result->entrada . '</button>',
            $result->descripcion_entrada,
            $btnEdit . '' . $btnSave,
         );
      }
      echo json_encode(array($data, 123));
      break;

   case 'manejarDesbEditarDetalleRuta':
      $iddetalleruta = limpiar_cadena($_POST['params']);
      $objRecibeCuentas->manejarDesbEditarDetalleRuta($iddetalleruta, $userEmpleadoId);
      break;

   case 'listTipoContabilidadS':
      $operacion = limpiar_cadena2($_GET['operacion']);
      // print_r($operacion);
      $query = $objRecibeCuentas->listTipoContabilidadS($idglobal, $operacion);
      echo '<option value="">--Seleccione--</option>';
      while ($reg = $query->fetch_object()) {
         echo '<option value="' . $reg->refTopoContabilidad . '">' . $reg->categoria . '</option>';
      }
      break;

   case 'listNominas':
      $refSucursal = intval($_REQUEST['refSucursal']);
      $idtipo_contabilidad = limpiar_cadena($_REQUEST['operacion']);
      $query = $objRecibeCuentas->listNomina($idglobal, $superadmin, $refSucursal);
      $data = array(array('<option value="">--Seleccione--</option>'), array('<option value="">--Seleccione--</option>'));
      while ($reg = $query->fetch_object()) {
         if (isset($reg->refNomina)) {
            array_push($data[0], '<option value="' . $reg->refNomina . '">' . ucwords(strtolower($reg->nombre)) . '</option>');
         }
      }
      $query = $objRecibeCuentas->listDeContabilidad($idglobal, $idtipo_contabilidad);
      while ($reg = $query->fetch_object()) {
         array_push($data[1], '<option value="' . $reg->str_de . '">' . $reg->str_de . '</option>');
      }
      echo json_encode($data);
      break;

   case 'manejarNotIncludeDetalleRuta':
      $iddetalleruta = limpiar_cadena($_POST['params']);
      $objRecibeCuentas->noIncludeContabilidad($iddetalleruta);
      break;

   case 'deContabilidad':
      $idtipo_contabilidad = limpiar_cadena($_GET['operacion']);
      $query = $objRecibeCuentas->listDeContabilidad($idglobal, $idtipo_contabilidad);
      echo '<option value="">--Seleccione--</option>';
      while ($reg = $query->fetch_object()) {
         echo '<option value="' . $reg->str_de . '">' . $reg->str_de . '</option>';
      }
      break;
}
