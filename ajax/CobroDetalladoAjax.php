<?php

session_start();
require_once "../method.php";
require_once "../model/CobroDetallado.php";

$objCobroDetallado = new CobroDetallado();
$idglobal = $_SESSION['idglobal'];
$createdEmpleadoId = $_SESSION['idempleado'];

switch ($_GET["op"]) {

   case 'Search':
      require_once "../model/Despachar.php";
      $objDespacar = new Despachar();
      $ultimo = limpiar_cadena($_POST["txtUltimo"]);
      $idsucursal = intval($_POST['cbosucursal']);
      $desde = limpiar_cadena2($_POST['txtFechaDesde']);
      $hasta = limpiar_cadena2($_POST['txtFechaHasta']);
      $query = null;
      if (empty($idsucursal) || empty($desde) || empty($hasta)) {

         echo json_encode(array('error' => ''));
      }
      $data = array();
      $textarea = '';
      $caja = 0;
      $i = 0;
      $query = $objCobroDetallado->list($idsucursal, $desde, $hasta, $ultimo);
      while ($reg = $query[0]->fetch_object()) {
         if ($ultimo == 'true') {
            $caja = $query[1];
         } else {
            $caja += $i ? $reg->efectivoCaja : ($query[1] + $reg->efectivoCaja); // $reg->efectivoCaja;
         }




          
         $numRuw = 0;



         $query1 = $objDespacar->getEmpleadosYaDspachados($reg->refDetalleRuta);
         $textarea = '<textarea class="form-control" rows="' . mysqli_num_rows($query1) . '" readonly style=" resize: none;" >';
         while ($a = $query1->fetch_object()) {
            $phpeol = mysqli_num_rows($query1) - 1 != $numRuw ? PHP_EOL : '';
            $textarea .= ($numRuw + 1) . '° ' . $a->persona . $phpeol;
            $numRuw++;
         }
         $textarea .= '</textarea>';
         $utilidad = (($reg->prestamo * -1) + ($reg->ventaArticulo * -1) + $reg->masUtilidad - ($reg->valorTotalCreditos) - $reg->descuento) * -1;
         $utNeta = $utilidad - ($reg->gastos + $reg->otros_gastos);

         $data[] = array(
            $reg->fecha_at,
            '<div class="user-block">
                    <img class="img-circle img-bordered-sm" src=""
                            alt="empleado">
                    <span class="username">
                        <a href="#">' . $reg->tipo . ': ' . $reg->codigo . '</a>
                    </span>
                </div>',
            $caja,
            $reg->recaudo,
            intval($reg->cantidadRecaudos),
            $reg->prestamo * -1,
            $reg->ventaArticulo * -1,
            $reg->efectivoOtraUtilidad,
            $reg->diferencia,
            $reg->base,
            $reg->efectivo,
            $reg->efectivoMonedas,
            $reg->descuento,
            $utilidad + $reg->efectivoOtraUtilidad,
            $utNeta + $reg->efectivoOtraUtilidad, //ulilidad neta
            $textarea,
            $reg->gastos,
            $reg->descripcion_gastos, // descripcion gastos
            $reg->otros_gastos, // Otros Gastos
            $reg->descripcion_otros_gastos, //descripcion otros Gastos
            $reg->salida,
            $reg->descripcion_salida,
            $reg->entrada,
            $reg->descripcion_entrada,

            '<button onclick="verFormContabilibad(' . $reg->refDetalleRuta . ', \'' . $reg->codigo . '\', \'' . $reg->tipo . '\', ' . $caja . ')" class="btn btn-default m-0">
                
                <i class="fa-regular fa-eye fa-lg" style="color: #000000;"></i>
              </button>'
         );

         $i++;
      }

      echo json_encode($data);
      break;


   case 'CobroDetallado':
      $iddetalleruta = limpiar_cadena($_REQUEST['id']);
      $arrayCuentas = array();
      $recaudos = array();
      $newsCreditos = array();
      $newsContabilidad = array();
      $newsContabilidadOtrosGastos = array();
      $newsContabilidadSalidas = array();
      $newsContabilidadEntradas = array();


      $query_tbl_detalle_ruta_despachada = $objCobroDetallado->listTblDetalleRuta($iddetalleruta, $createdEmpleadoId);
      $fetch = $query_tbl_detalle_ruta_despachada[0]->fetch_object();


      array_push($arrayCuentas, $fetch);
      $query_descripcion_recaudo = $objCobroDetallado->listDetalleCobrado($iddetalleruta);
      while ($reg = $query_descripcion_recaudo->fetch_object()) {

         array_push($recaudos, $reg);
      }

      $query_tbl_targeta_onSave = $objCobroDetallado->listDetalleTblTergetas($iddetalleruta);
      while ($a = $query_tbl_targeta_onSave->fetch_object()) {

         array_push($newsCreditos, $a);
      }

      $query_contabilidad = $objCobroDetallado->listDetalleTblContabilidad($iddetalleruta);

      while ($a = $query_contabilidad[0]->fetch_object()) {


         if (in_array($a->nombre, $query_contabilidad[1])) {
            array_push($newsContabilidad, $a);
         }
      }

      array_push($arrayCuentas, $recaudos);
      array_push($arrayCuentas, $newsCreditos);
      array_push($arrayCuentas, $newsContabilidad);

      array_push($arrayCuentas, $query_tbl_detalle_ruta_despachada[1]);
      //array_push($arrayCuentas, $query_tbl_detalle_ruta_despachada[2]);


      require_once "../model/Cartera.php";

      $classCartera = new ClassCartera();
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



      echo json_encode($arrayCuentas);
      break;
}
