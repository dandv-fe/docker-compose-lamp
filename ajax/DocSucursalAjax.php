<?php
session_start();
require_once('../method.php');
switch ($_GET["op"]) {

   case 'Save':

      require_once "../model/DocSucursal.php";

      $obj = new DocSucursal();

      $idglobal = $_SESSION['idglobal'];
      $idDocSucursal = limpiar_cadena($_POST["idDocSucursal"]);


      $idsucursal = $_SESSION['idsucursal']; // de SESSION

      if (empty($idDocSucursal)) {
         if (isset($_SESSION['userEmpresa']) || in_array('crear comprobantes', array_column($_SESSION['AUTHS'], 'nombre'))) {
            $detalle = $_POST["detalle"];
            $hosp = $obj->Registrar($idglobal, $idsucursal, $detalle);
            if ($hosp) {
               echo "Detalle Registrado";
            } else {
               echo "ERROR: No se ha podido registrar el Detalle";
            }
         } else {
            echo "ERROR: No estas authorizado para esta accion";
         }
      } else {
         if (isset($_SESSION['userEmpresa']) || in_array('editar comprobantes', array_column($_SESSION['AUTHS'], 'nombre'))) {
            if ($obj->Modificar($idDocSucursal, $idsucursal, $_POST["idTipoDoc"], $_POST["serie"], $_POST["numero"])) {
               echo "Modificado Exitosamente";
            } else {
               echo "ERROR: No se ha podido modificado";
            }
         } else {
            echo "ERROR: No estas authorizado para esta accion";
         }
      }

      break;


   case "list":
      require_once "../model/DocSucursal.php";

      $objDocSucursal = new DocSucursal();

      $idsucursal = $_SESSION['idsucursal']; // de SESSION
      $query_DocSucursal = $objDocSucursal->ListarDetalleDocSuc($idsucursal);
      $data = array();
      $i = 1;
      while ($reg = $query_DocSucursal->fetch_object()) {
         $data[] = array(
            $reg->str_nombre,
            $reg->str_ultima_serie,
            $reg->str_ultimo_numero,

            '<button class="btn btn-warning" data-toggle="tooltip" title="" onclick="cargarDataDocSucursal(' . $reg->iddetalle_documento_sucursal . ',\'' . $reg->idtipo_documento . '\',\'' . $reg->str_ultima_serie . '\',\'' . $reg->str_ultimo_numero . '\')"><i class="fa fa-pencil"></i> </button>&nbsp;' .
               '<button class="btn btn-danger" data-toggle="tooltip" title="Eliminar" onclick="eliminarDocSucursal(' . $reg->iddetalle_documento_sucursal . ')"><i class="fa fa-trash"></i> </button>'
         );
         $i++;
      }
      echo json_encode($data);

      break;
   case "delete":
      require_once "../model/DocSucursal.php";

      $obj = new DocSucursal();

      $idDocSucursal = $_POST["idDocSucursal"];
      if (isset($_SESSION['userEmpresa']) || in_array('eliminar comprobantes', array_column($_SESSION['AUTHS'], 'nombre'))) {
         $hosp = $obj->Eliminar($idDocSucursal);
         if ($hosp) {
            echo "Eliminado Exitosamente";
         } else {
            echo "ERROR: No se ha podido eliminar";
         }
      } else {
         echo "ERROR: No estas authorizado para esta accion";
      }

      break;

   case "listTipoDoc":

      require_once "../model/DocSucursal.php";

      $objDocSucursal = new DocSucursal();

      $query_Categoria = $objDocSucursal->ListarTipoDocumento();

      echo "<option>--Seleccione Comprobante--</option>";
      while ($reg = $query_Categoria->fetch_object()) {
         echo '<option value="' . $reg->idtipo_documento . '">' . $reg->str_nombre . '</option>';
      }

      break;
}
