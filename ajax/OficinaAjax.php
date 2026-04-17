<?php

session_start();
require_once "../method.php";

require_once "../model/Oficina.php";

$objOficina = new Oficina();
$useridglobal = $_SESSION['idglobal'];
switch (isset($_GET["op"]) ? $_GET["op"] : '') {
   case 'list':
      $data = array();
      $query = $objOficina->Listar($useridglobal);
      while ($row = $query->fetch_object()) {
         $data[] = array(
            'id' => $row->refOficina,
            'str_nombre' => $row->str_nombre,
            'idempleado_administrador' => $row->idempleado_administrador,
            'idpersona_representante' => $row->idpersona_representante,
            'representante' => $row->representante,
            'foto' => isset($row->foto) ? $row->foto : '',
            'telefono_representante' => $row->telefono_representante,
            'cantidad_carteras' => $row->cantidad_carteras,
            'cantidad_empleados' => $row->cantidad_empleados,
            'cantidad_despedidos' => $row->cantidad_despedidos
         );
      }
      //header('Content-Type: application/json; charset=utf-8');
      echo json_encode(array('ok' => true, 'data' => $data));
      break;

   case 'detalle':
      $idOficina = intval($_GET['id']);
      $query = $objOficina->Obtener($idOficina);
      if ($query) {
         echo json_encode(array('ok' => true, 'data' => $query));
      } else {
         echo json_encode(array('ok' => false, 'msg' => 'Oficina no encontrada'));
      }
      break;

   case 'SaveOrUpdate':
      $idoficina = intval($_POST['txtRefOficina']);
      $str_nombre = limpiar_cadena($_POST['txtNombre']);
      $idempleado_administrador = intval($_POST['cboAdministrador']);

      if ($idoficina == 0) {
         $newId = $objOficina->Registrar($str_nombre, $idempleado_administrador, $useridglobal);
         echo 'Oficina registrada correctamente';
      } else {
         $objOficina->Modificar($idoficina, $str_nombre, $idempleado_administrador, $useridglobal);
         echo 'Oficina actualizada correctamente';
      }
      break;

   case 'delete':
      $id = intval($_POST['id']);
      $objOficina->Eliminar($id);
      echo 'Oficina eliminada correctamente';
      break;

   case 'SeleccionarOficinaSession':
      $idoficina = intval($_POST['idoficina']);
      $_SESSION['idoficina'] = $idoficina;
      $_SESSION['idsucursal'] = 0;
      echo json_encode(array('success' => true));
      break;

   default:
      //header('Content-Type: application/json; charset=utf-8');
      echo json_encode(array('ok' => false, 'msg' => 'Operación no definida'));
      break;
}
