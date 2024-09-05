<?php
session_start();
require_once "../method.php";
require_once "../model/Consultas.php";
$objConsultas=new Consultas();
switch ($_GET['op'] && true) {
    case 'egresos':
        $idSucursal=intval($_POST['cbosucursal']);
        $desde = limpiar_cadena2($_POST['txtFechaDesde']);
        $hasta = limpiar_cadena2($_POST['txtFechaHasta']);
        $data = array();
        $query = $objConsultas->listEgresos($idSucursal,$desde,$hasta);
        while ($reg = $query->fetch_object()) {
            $data[] = array(
                $reg->fecha_at,
                $reg->valor,
                $reg->consepto,
                $reg->detalle,
                $reg->categoria,

            );
        }
        echo json_encode($data);
        break;
    
    default:
        # code...
        break;
}