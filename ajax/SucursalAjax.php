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
        $razon_social = preg_replace("/\s+/", "_", $razon_social);


            if (empty($idsucursal)) {

                $objSucursal->Registrar($useridglobal, $tipo, $razon_social, $telefono, $idreprecentante, $estado,$adicional);
            } else {

                // $idglobal = $_POST["txtIdGlobal"];
                $objSucursal->Modificar($idsucursal, $useridglobal, $tipo, $razon_social, $telefono, $idreprecentante, $estado,$adicional);
            }
        


        break;

    case "list":

        $query_Tipo = $objSucursal->Listar();

        $i = 1;
        $data = array();
        while ($reg = $query_Tipo->fetch_object()) {
            $estado = $reg->estado == 'Disponible' ? '<span class="badge badge-success">Disponible</span>' : '<span class="badge badge-danger">Inactiva</span>';
            $data[] = array(
                $i,
                $reg->codigo,
                $reg->tipo,
                $estado,
                '<img width=100px height=100px src="" />',
                $reg->empleado,
                '<button class="btn btn-warning" data-toggle="tooltip" title="Editar" onclick="cargarDataSucursal(\'' . $reg->id . '\')"><i class="fa fa-pencil"></i> </button>&nbsp;'/*.
                '<button class="btn btn-" data-toggle="tooltip" title="Configuracion" onclick="cambiarConfiguracion(\'' . $reg->id . '\')"><i class="fa-solid fa-gears"></i></button>'*/
            );
            $i++;
        }
        echo json_encode($data);
        break;

    case "listTipoDoc":
        require_once "../model/Tipo_Documento.php";

        $objTipo_Documento = new Tipo_Documento();

        $query_tipo_Documento = $objTipo_Documento->VerTipo_Documento_Persona();
        while ($reg = $query_tipo_Documento->fetch_object()) {
            echo '<option value="' . $reg->str_nombre . '">' . $reg->str_nombre . '</option>';
        }

        break;

    case 'buscarSucursal':
        $idsucursal = limpiar_cadena($_REQUEST['id']);
        $query = $objSucursal->buscarSucursal($idsucursal);
        $req = $query->fetch_object();
        echo json_encode($req);
        break;

}
