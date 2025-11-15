<?php
session_start();
require_once "../method.php";
require_once "../model/Despachar.php";
$objDespacar = new Despachar();
$idglobal = $_SESSION['idglobal'];
$userEmpleadoId = $_SESSION['idempleado'];
$superadmin = $_SESSION['userEmpresa'];
switch ($_GET["op"]) {
   case 'SaveOrUpdate':
      $idsucursal = limpiar_cadena($_POST['refSucursal']);
      $id_detalle_ruta = limpiar_cadena($_POST['refDetalleRuta']);
      $empleados_ids = $_POST['empls'];
      if (is_array($empleados_ids)) {
         if ($id_detalle_ruta == 0) {
            $objDespacar->registrar($idglobal, $idsucursal, $empleados_ids);
         } else {
            $objDespacar->modificar($id_detalle_ruta, $empleados_ids);
         }
      } else {
         echo "¡ERROR: Inesperado!" . PHP_EOL;
         echo "NADA SELECCIONADO";
      }
      break;

   case "list":
      $query_Tipo = $objDespacar->ListarDespachar($idglobal, $superadmin, $userEmpleadoId);
      $data = array();
      while ($reg = $query_Tipo->fetch_object()) {
         $textarea = '';
         $numRuw = 0;
         if (isset($reg->detalle_ruta)) {
            $query = $objDespacar->getEmpleadosYaDspachados($reg->detalle_ruta);
            $textarea = '<textarea class="form-control" rows="' . mysqli_num_rows($query) . '" readonly style=" resize: none;" >';
            while ($a = $query->fetch_object()) {
               $phpeol = mysqli_num_rows($query) - 1 != $numRuw ? PHP_EOL : '';
               $textarea .= ($numRuw + 1) . '° ' . ucwords(strtolower($a->persona)) . $phpeol;
               $numRuw++;
            }
            $textarea .= '</textarea>';
         }
         $isiddetalle = empty($reg->detalle_ruta) ? 0 : $reg->detalle_ruta;
         $data[] = array(
            isset($reg->detalle_ruta) ? '<button onclick="manejarCambioCheckDespachar(' . $reg->id . ',' . $reg->refEmpleado . ',' . $isiddetalle . ')" class="btn btn-app btn-success m-0">
                <span class="badge bg-warning">' . mysqli_num_rows($query) . '</span>
                <i class="fas fa-bullhorn"></i> DESPACHADOS
              </button>' :
               '<button onclick="manejarCambioCheckDespachar(' . $reg->id . ',' . $reg->refEmpleado . ',' . $isiddetalle . ')" class="btn btn-app btn-warning m-0">
                    <i class="fas fa-users"></i> AGREGAR
                  </button>',
            '<div class="user-block">
                  
                  <span class="username">
                      <a href="#">' . $reg->tipo . ': ' . $reg->codigo . '</a>
                  </span>
              </div>',
            $textarea
         );
      }
      echo json_encode($data);
      break;

   case 'listEmpleados':
      $id_detalle_ruta = limpiar_cadena($_GET['refDetalleRuta']);
      $refEmpleado = limpiar_cadena($_GET['refEmpleado']);
      if (!isset($superadmin)) {
         $query = $objDespacar->listEncargadoDespachar($refEmpleado, $userEmpleadoId);
         while ($reg = $query->fetch_object()) {
            $selected = $refEmpleado == $reg->refEmpleado ? 'selected' : '';
            echo '<option class="optEmpleadoDespachado" value="' . $reg->refEmpleado . '" ' . $selected . ' >' . ucwords(strtolower($reg->empleado)) . '</option>';
         }
      }
      $query = $objDespacar->listEmpleadosDespachar($idglobal, $id_detalle_ruta, $superadmin, $userEmpleadoId);
      while ($reg = $query->fetch_object()) {
         if (!isset($superadmin)) {
            if ($refEmpleado != $reg->refEmpleado) {
               $selected = !empty($reg->refEmpleadoCobrando) ? 'selected' : '';
               echo '<option class="optEmpleadoDespachado" value="' . $reg->refEmpleado . '" ' . $selected . '>' . ucwords(strtolower($reg->empleado)) . '</option>';
            }
         } else {
            $selected = $refEmpleado == $reg->refEmpleado || !empty($reg->refEmpleadoCobrando) ? 'selected' : '';
            echo '<option class="optEmpleadoDespachado" value="' . $reg->refEmpleado . '" ' . $selected . '>' . ucwords(strtolower($reg->empleado)) . '</option>';
         }
      }
      break;
}
