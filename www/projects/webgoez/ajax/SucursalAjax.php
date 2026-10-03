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
      $telefono = limpiar_cadena($_POST["txtTelefono"]);
      $estado = limpiar_cadena($_POST['txtEstado']);
      $idreprecentante = limpiar_cadena($_POST["cboRepresentante"]);
      $adicional = limpiar_cadena($_POST["cboAdicional"]);
      $idoficina = isset($_POST['cboOficina']) ? intval($_POST['cboOficina']) : 0;
      $razon_social = preg_replace("/\s+/", "_", $razon_social);


      if (empty($idsucursal)) {

         $objSucursal->Registrar($useridglobal, $tipo, $razon_social, $telefono, $idreprecentante, $estado, $adicional, $idoficina);
      } else {

         // $idglobal = $_POST["txtIdGlobal"];
         $objSucursal->Modificar($idsucursal, $useridglobal, $tipo, $razon_social, $telefono, $idreprecentante, $estado, $adicional, $idoficina);
      }


      break;

   case "list":

      $query_Tipo = $objSucursal->Listar();

      $i = 1;
      $data = array();
      while ($reg = $query_Tipo->fetch_object()) {
         $estado = $reg->estado == 'Disponible' ? '<span class="badge badge-success">Disponible</span>' : '<span class="badge badge-danger">Inactiva</span>';
         $data[] = array(
            "0" => $reg->codigo,
            "1" => $reg->empleado,
            "2" => $reg->oficina,
            "3" => $reg->id
         );
         $i++;
      }
      echo json_encode($data);
      break;

   case 'listByOficina':
      $idoficina = intval($_GET['idoficina']);
      $data = array();
      $query = $objSucursal->ListarPorOficina($idoficina);
      while ($reg = $query->fetch_object()) {
         $data[] = array(
            'id' => $reg->id,
            'codigo' => $reg->codigo,
            'tipo' => $reg->tipo,
            'empleado' => $reg->empleado,
            'estado' => $reg->estado
         );
      }
      echo json_encode(array('ok' => true, 'data' => $data));
      break;



   case 'buscarSucursal':
      $idsucursal = limpiar_cadena($_REQUEST['id']);
      $query = $objSucursal->buscarSucursal($idsucursal);
      $req = $query->fetch_object();
      echo json_encode($req);
      break;
}
