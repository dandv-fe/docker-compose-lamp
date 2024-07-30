<?php

session_start();
require_once "../model/KardexValorizado.php";

$objKardex = new KardexValorizado();
$idglobal = $_SESSION['idglobal'];
$createdEmpleadoId = $_SESSION['userEmpleado'];
$superadmin=$_SESSION['userEmpresa'];

switch ($_GET["op"]) {

   case 'valorizado':
    $query= $objKardex->listKardex($idglobal,$superadmin,$createdEmpleadoId);
    $data = array();
        while ($reg = $query->fetch_object()) {

            $data[] = array(
                $reg->codigo,
                $reg->caja,
                $reg->n_at,
                $reg->suma_at,
                $reg->n_mo,
                $reg->suma_mo,
                $reg->n_re,
                $reg->suma_re,
                $reg->n_cli,
               
            );
            $i++;
        }
        echo json_encode($data);
    break;
}
