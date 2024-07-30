<?php

session_start();
require_once "../method.php";
require_once "../model/CobroDetallado.php";

$objCobroDetallado = new CobroDetallado();
$idglobal = $_SESSION['idglobal'];
$createdEmpleadoId = $_SESSION['userEmpleado'];

switch ($_GET["op"]) {

    case 'Search':
        $idsucursal = limpiar_cadena($_POST['cbosucursal']);
        $desde = limpiar_cadena2($_POST['txtFechaDesde']);
        $hasta = limpiar_cadena2($_POST['txtFechaHasta']);

        if (empty($idsucursal) || empty($desde)  || empty($hasta)) {

            echo json_encode(array('error' => ''));
        }
        $query = $objCobroDetallado->list($idsucursal, $desde, $hasta);
        while ($res=$query[0]->fetch_object()) {
            # code...
        }
        break;
}
