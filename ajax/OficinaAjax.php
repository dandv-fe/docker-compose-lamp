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
		while($row = $query->fetch_object()){
			$data[] = array(
				'id' => $row->refOficina,
				'str_nombre' => $row->str_nombre,
				'idempleado_administrador' => $row->idempleado_administrador,
				'idpersona_representante' => $row->idpersona_representante,
				'representante' => $row->representante
			);
		}
		//header('Content-Type: application/json; charset=utf-8');
		echo json_encode(array('ok'=>true,'data'=>$data));
		break;

	default:
		//header('Content-Type: application/json; charset=utf-8');
		echo json_encode(array('ok'=>false,'msg'=>'Operación no definida'));
		break;
}
