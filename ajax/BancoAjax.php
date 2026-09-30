<?php
session_start();
require_once "../method.php";
require_once "../model/Banco.php";

$objBanco = new Banco();
$idglobal = intval($_SESSION['idglobal'] ?? 0);
$idusuario = intval($_SESSION['idusuario'] ?? 0);
$esSuper = isset($_SESSION['userEmpresa']) && intval($_SESSION['userEmpresa']) > 0;
$alcance = $objBanco->Alcance($idglobal, $esSuper, intval($_SESSION['idempleado'] ?? 0));

function banco_texto($key, $max)
{
    $value = strip_tags(trim((string)($_POST[$key] ?? '')));
    return function_exists('mb_substr') ? mb_substr($value, 0, $max, 'UTF-8') : substr($value, 0, $max);
}

function banco_h($value)
{
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

function banco_js($value)
{
    return banco_h(json_encode($value, JSON_UNESCAPED_UNICODE));
}

if ($idglobal <= 0 || !$objBanco->PuedeAdministrar($alcance)) {
    echo "ERROR: Solo el Super Administrador o el administrador de una oficina pueden administrar cuentas bancarias";
    exit;
}

switch ($_GET['op'] ?? '') {
    case 'oficinas':
        $data = array();
        if ($alcance['super']) {
            $data[] = array('id' => '', 'nombre' => 'Empresa (todas las oficinas)');
        }
        foreach ($objBanco->OficinasPermitidas($idglobal, $alcance) as $id => $nombre) {
            $data[] = array('id' => $id, 'nombre' => $nombre);
        }
        echo json_encode($data);
        break;

    case 'list':
        $data = array();
        $query = $objBanco->Listar($idglobal, $alcance);
        $i = 1;
        while ($reg = $query->fetch_object()) {
            $editable = $objBanco->PuedeEditar($reg, $alcance);
            $activo = $reg->str_estado === 'activo';
            $estado = $activo
                ? '<span class="badge badge-success">Activo</span>'
                : '<span class="badge badge-secondary">Inactivo</span>';
            $opciones = '<button class="btn btn-info btn-sm" title="Sucursales autorizadas" onclick="verSucursalesBancoPago('
                . intval($reg->idbanco) . ',' . banco_js($reg->str_banco . ' ' . $reg->str_num_cueneta) . ')"><i class="fa fa-map-marker"></i> Sucursales</button> ';
            if ($editable) {
                $datos = array(
                    'id' => intval($reg->idbanco), 'oficina' => $reg->idoficina === null ? '' : intval($reg->idoficina),
                    'nombre' => $reg->str_banco, 'tipo' => $reg->str_tipo, 'numero' => $reg->str_num_cueneta,
                    'titular' => $reg->str_titular, 'documento' => $reg->str_documento_titular, 'orden' => intval($reg->int_orden),
                );
                $opciones .= '<button class="btn btn-warning btn-sm" title="Editar" onclick="cargarDataBancoPago(' . banco_js($datos) . ')"><i class="fa fa-pencil"></i></button> ';
                $opciones .= '<button class="btn ' . ($activo ? 'btn-secondary' : 'btn-success') . ' btn-sm" onclick="cambiarEstadoBancoPago('
                    . intval($reg->idbanco) . ',\'' . ($activo ? 'inactivo' : 'activo') . '\')">' . ($activo ? 'Desactivar' : 'Activar') . '</button>';
            }
            $data[] = array(
                $i++,
                banco_h($reg->str_banco),
                banco_h($reg->str_tipo) . '<br><small>' . banco_h($reg->str_num_cueneta) . '</small>',
                banco_h($reg->str_titular) . '<br><small>NIT/CC ' . banco_h($reg->str_documento_titular) . '</small>',
                $reg->idoficina === null ? '<em>Empresa</em>' : banco_h($reg->oficina),
                intval($reg->sucursales),
                $estado,
                $opciones,
            );
        }
        echo json_encode($data);
        break;

    case 'SaveOrUpdate':
        $idbanco = intval($_POST['txtIdBanco'] ?? 0);
        $nombre = banco_texto('txtNombreBanco', 100);
        $tipo = banco_texto('txtTipoBanco', 30);
        $numero = banco_texto('txtNumeroCuenta', 30);
        $titular = banco_texto('txtTitularBanco', 100);
        $documento = banco_texto('txtDocumentoTitular', 20);
        $orden = intval($_POST['txtOrdenBanco'] ?? 0);
        $oficinaTexto = trim((string)($_POST['cboOficinaBanco'] ?? ''));
        $idoficina = $oficinaTexto === '' ? null : intval($oficinaTexto);
        if ($nombre === '' || $tipo === '' || $numero === '' || $titular === '' || $documento === '') {
            echo "ERROR: Complete banco, tipo, número, titular y NIT/documento del titular";
            break;
        }
        $permitidas = $objBanco->OficinasPermitidas($idglobal, $alcance);
        if ($idoficina === null ? !$alcance['super'] : !array_key_exists($idoficina, $permitidas)) {
            echo "ERROR: No puede asignar la cuenta a esa oficina";
            break;
        }
        try {
            if ($idbanco > 0) {
                if (!$objBanco->PuedeEditar($objBanco->Obtener($idbanco, $idglobal), $alcance)) {
                    echo "ERROR: No puede editar esta cuenta";
                    break;
                }
                $objBanco->Modificar($idbanco, $idglobal, $idoficina, $nombre, $tipo, $numero, $titular, $documento, $orden);
                echo "Cuenta actualizada correctamente";
            } else {
                $objBanco->Registrar($idglobal, $idoficina, $nombre, $tipo, $numero, $titular, $documento, $orden);
                echo "Cuenta registrada. Ahora autorice en qué sucursales puede usarse";
            }
        } catch (Throwable $e) {
            echo "ERROR: No fue posible guardar la cuenta";
        }
        break;

    case 'cambiarEstado':
        $idbanco = intval($_POST['id'] ?? 0);
        $estado = ($_POST['estado'] ?? '') === 'activo' ? 'activo' : 'inactivo';
        if (!$objBanco->PuedeEditar($objBanco->Obtener($idbanco, $idglobal), $alcance)) {
            echo "ERROR: No puede cambiar el estado de esta cuenta";
            break;
        }
        try {
            $objBanco->CambiarEstado($idbanco, $idglobal, $estado);
            echo $estado === 'activo' ? "Cuenta activada" : "Cuenta desactivada";
        } catch (Throwable $e) {
            echo "ERROR: No fue posible cambiar el estado";
        }
        break;

    case 'sucursales':
        $idbanco = intval($_GET['id'] ?? 0);
        if (!$objBanco->PuedeAutorizar($objBanco->Obtener($idbanco, $idglobal), $alcance)) {
            echo json_encode(array('ok' => false, 'error' => 'No puede autorizar esta cuenta'));
            break;
        }
        $rows = array();
        foreach ($objBanco->SucursalesParaAutorizar($idbanco, $idglobal, $alcance) as $row) {
            $rows[] = array(
                'id' => intval($row->idsucursal), 'oficina' => (string)$row->oficina,
                'nombre' => trim($row->str_tipo . ' ' . $row->str_codigo), 'estado' => $row->str_estado,
                'autorizada' => intval($row->autorizada) === 1,
            );
        }
        echo json_encode(array('ok' => true, 'data' => $rows));
        break;

    case 'guardarSucursales':
        $idbanco = intval($_POST['id'] ?? 0);
        if (!$objBanco->PuedeAutorizar($objBanco->Obtener($idbanco, $idglobal), $alcance)) {
            echo "ERROR: No puede autorizar esta cuenta";
            break;
        }
        $seleccionadas = isset($_POST['sucursales']) && is_array($_POST['sucursales']) ? $_POST['sucursales'] : array();
        try {
            $total = $objBanco->GuardarSucursales($idbanco, $idglobal, $alcance, $seleccionadas, $idusuario);
            echo "Autorizada en $total sucursal(es) de su alcance";
        } catch (Throwable $e) {
            echo "ERROR: No fue posible guardar las sucursales";
        }
        break;

    default:
        echo "ERROR: Operación no definida";
        break;
}
