<?php
session_start();
require_once "../method.php";
require_once "../model/Banco.php";

$objBanco = new Banco();
$idglobal = intval($_SESSION['idglobal'] ?? 0);

function banco_requiere_admin()
{
    if (!isset($_SESSION['userEmpresa']) || intval($_SESSION['userEmpresa']) <= 0) {
        echo "ERROR: Solo el Super Administrador puede administrar bancos o métodos de pago";
        return false;
    }
    return true;
}

function banco_texto($key, $max)
{
    $value = trim((string)($_POST[$key] ?? ''));
    $value = strip_tags($value);
    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $max, 'UTF-8');
    }
    return substr($value, 0, $max);
}

switch ($_GET['op'] ?? '') {
    case 'list':
        if (!banco_requiere_admin()) {
            break;
        }
        $data = [];
        $query = $objBanco->Listar($idglobal);
        $i = 1;
        while ($reg = $query->fetch_object()) {
            $estado = $reg->str_estado === 'activo'
                ? '<span class="badge badge-success">Activo</span>'
                : '<span class="badge badge-secondary">Inactivo</span>';
            $accionEstado = $reg->str_estado === 'activo' ? 'inactivo' : 'activo';
            $textoEstado = $reg->str_estado === 'activo' ? 'Desactivar' : 'Activar';
            $claseEstado = $reg->str_estado === 'activo' ? 'btn-secondary' : 'btn-success';
            $nombreJs = json_encode($reg->str_banco, JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE);
            $tipoJs = json_encode($reg->str_tipo, JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE);
            $numeroJs = json_encode($reg->str_num_cueneta, JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE);
            $data[] = [
                $i,
                htmlspecialchars($reg->str_banco, ENT_QUOTES, 'UTF-8'),
                htmlspecialchars($reg->str_tipo, ENT_QUOTES, 'UTF-8'),
                htmlspecialchars($reg->str_num_cueneta, ENT_QUOTES, 'UTF-8'),
                intval($reg->int_orden),
                $estado,
                '<button class="btn btn-warning btn-sm" data-toggle="tooltip" title="Editar" onclick="cargarDataBancoPago('.intval($reg->idbanco).','.$nombreJs.','.$tipoJs.','.$numeroJs.','.intval($reg->int_orden).')"><i class="fa fa-pencil"></i></button> '.
                '<button class="btn '.$claseEstado.' btn-sm" data-toggle="tooltip" title="'.$textoEstado.'" onclick="cambiarEstadoBancoPago('.intval($reg->idbanco).',\''.$accionEstado.'\')">'.$textoEstado.'</button>'
            ];
            $i++;
        }
        echo json_encode($data);
        break;

    case 'SaveOrUpdate':
        if (!banco_requiere_admin()) {
            break;
        }
        $idbanco = intval($_POST['txtIdBanco'] ?? 0);
        $nombre = banco_texto('txtNombreBanco', 100);
        $tipo = banco_texto('txtTipoBanco', 30);
        $numero = banco_texto('txtNumeroCuenta', 30);
        $orden = intval($_POST['txtOrdenBanco'] ?? 0);
        if ($nombre === '' || $tipo === '' || $numero === '') {
            echo "ERROR: Complete el nombre, tipo y número de cuenta";
            break;
        }
        try {
            if ($idbanco > 0) {
                $objBanco->Modificar($idbanco, $idglobal, $nombre, $tipo, $numero, $orden);
                echo "Método de pago actualizado correctamente";
            } else {
                $objBanco->Registrar($idglobal, $nombre, $tipo, $numero, $orden);
                echo "Método de pago registrado correctamente";
            }
        } catch (Throwable $e) {
            echo "ERROR: No fue posible guardar el método de pago";
        }
        break;

    case 'cambiarEstado':
        if (!banco_requiere_admin()) {
            break;
        }
        $idbanco = intval($_POST['id'] ?? 0);
        $estado = ($_POST['estado'] ?? '') === 'activo' ? 'activo' : 'inactivo';
        if ($idbanco <= 0) {
            echo "ERROR: Banco inválido";
            break;
        }
        try {
            $objBanco->CambiarEstado($idbanco, $idglobal, $estado);
            echo $estado === 'activo' ? "Método de pago activado" : "Método de pago desactivado";
        } catch (Throwable $e) {
            echo "ERROR: No fue posible cambiar el estado";
        }
        break;

    default:
        echo "ERROR: Operación no definida";
        break;
}
