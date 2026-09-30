<?php
require_once "Conexion.php";

/**
 * Cuentas bancarias (tbl_banco) y en qué sucursales pueden recibir o pagar dinero
 * (tbl_banco_sucursal).
 *
 * Alcance: el Super Administrador / usuario empresa ve y administra todo. Un administrador de
 * oficina (tbl_oficina.idempleado_administrador) crea cuentas de su oficina, edita solo las suyas
 * y autoriza, en las sucursales de su oficina, sus cuentas y las de la empresa (idoficina NULL).
 */
class Banco
{
    /** ['super' => bool, 'oficinas' => int[]] */
    public function Alcance($idglobal, $esSuper, $idempleado)
    {
        global $conexion;
        if ($esSuper) {
            return array('super' => true, 'oficinas' => array());
        }
        $oficinas = array();
        if (intval($idempleado) > 0) {
            $stmt = db_prepare_execute(
                $conexion,
                "SELECT idoficina FROM tbl_oficina WHERE idglobal=? AND idempleado_administrador=? ORDER BY idoficina",
                "ii",
                [intval($idglobal), intval($idempleado)]
            );
            $res = $stmt->get_result();
            while ($row = $res->fetch_object()) {
                $oficinas[] = intval($row->idoficina);
            }
            $stmt->close();
        }
        return array('super' => false, 'oficinas' => $oficinas);
    }

    public function PuedeAdministrar(array $alcance)
    {
        return $alcance['super'] || count($alcance['oficinas']) > 0;
    }

    /** Oficinas en las que el usuario puede crear cuentas (id => nombre). */
    public function OficinasPermitidas($idglobal, array $alcance)
    {
        global $conexion;
        if ($alcance['super']) {
            $stmt = db_prepare_execute($conexion, "SELECT idoficina, str_nombre FROM tbl_oficina WHERE idglobal=? ORDER BY str_nombre", "i", [intval($idglobal)]);
        } elseif (count($alcance['oficinas']) > 0) {
            $ph = implode(',', array_fill(0, count($alcance['oficinas']), '?'));
            $stmt = db_prepare_execute(
                $conexion,
                "SELECT idoficina, str_nombre FROM tbl_oficina WHERE idglobal=? AND idoficina IN ($ph) ORDER BY str_nombre",
                str_repeat('i', count($alcance['oficinas']) + 1),
                array_merge([intval($idglobal)], $alcance['oficinas'])
            );
        } else {
            return array();
        }
        $res = $stmt->get_result();
        $oficinas = array();
        while ($row = $res->fetch_object()) {
            $oficinas[intval($row->idoficina)] = $row->str_nombre;
        }
        $stmt->close();
        return $oficinas;
    }

    /** Cuentas visibles: todas (super) o las de sus oficinas más las de empresa. */
    public function Listar($idglobal, array $alcance)
    {
        global $conexion;
        $filtro = '';
        $types = "i";
        $params = [intval($idglobal)];
        if (!$alcance['super']) {
            $oficinas = count($alcance['oficinas']) > 0 ? $alcance['oficinas'] : array(0);
            $filtro = " AND (b.idoficina IS NULL OR b.idoficina IN (" . implode(',', array_fill(0, count($oficinas), '?')) . "))";
            $types .= str_repeat('i', count($oficinas));
            $params = array_merge($params, $oficinas);
        }
        $sql = "SELECT b.idbanco, b.idoficina, o.str_nombre AS oficina, b.str_banco, b.str_tipo, b.str_num_cueneta,
                       b.str_titular, b.str_documento_titular, b.str_estado, b.int_orden,
                       (SELECT COUNT(*) FROM tbl_banco_sucursal bs WHERE bs.idbanco=b.idbanco AND bs.idglobal=b.idglobal) AS sucursales
                FROM tbl_banco b
                LEFT JOIN tbl_oficina o ON o.idoficina=b.idoficina AND o.idglobal=b.idglobal
                WHERE b.idglobal=?$filtro
                ORDER BY b.int_orden ASC, b.str_banco ASC, b.idbanco ASC";
        $stmt = db_prepare_execute($conexion, $sql, $types, $params);
        return $stmt->get_result();
    }

    /** Cuentas activas autorizadas en la sucursal: lo único que se ofrece en la ruta. */
    public function ListarActivos($idglobal, $idsucursal)
    {
        global $conexion;
        $sql = "SELECT b.idbanco, b.str_banco, b.str_tipo, b.str_num_cueneta, b.str_titular, b.str_documento_titular, b.int_orden
                FROM tbl_banco b
                JOIN tbl_banco_sucursal bs ON bs.idbanco=b.idbanco AND bs.idglobal=b.idglobal AND bs.idsucursal=?
                WHERE b.idglobal=? AND b.str_estado='activo'
                ORDER BY b.int_orden ASC, b.str_banco ASC, b.idbanco ASC";
        $stmt = db_prepare_execute($conexion, $sql, "ii", [intval($idsucursal), intval($idglobal)]);
        return $stmt->get_result();
    }

    public function Obtener($idbanco, $idglobal)
    {
        global $conexion;
        return db_fetch_object(
            $conexion,
            "SELECT idbanco, idoficina, str_estado FROM tbl_banco WHERE idbanco=? AND idglobal=?",
            "ii",
            [intval($idbanco), intval($idglobal)]
        );
    }

    /** Editar datos o estado: super todo; oficina solo cuentas de sus oficinas. */
    public function PuedeEditar($banco, array $alcance)
    {
        if (!$banco) return false;
        if ($alcance['super']) return true;
        return $banco->idoficina !== null && in_array(intval($banco->idoficina), $alcance['oficinas'], true);
    }

    /** Autorizar en sucursales: además de las editables, las cuentas de empresa. */
    public function PuedeAutorizar($banco, array $alcance)
    {
        if (!$banco) return false;
        return $alcance['super'] || $banco->idoficina === null || $this->PuedeEditar($banco, $alcance);
    }

    public function Registrar($idglobal, $idoficina, $nombre, $tipo, $numeroCuenta, $titular, $documento, $orden)
    {
        global $conexion;
        $sql = "INSERT INTO tbl_banco (idglobal, idoficina, str_banco, str_tipo, str_num_cueneta, str_titular, str_documento_titular,
                                       str_estado, int_orden, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'activo', ?, NOW(), NOW())";
        db_execute($conexion, $sql, "iisssssi", [intval($idglobal), $idoficina, $nombre, $tipo, $numeroCuenta, $titular, $documento, intval($orden)]);
        return $conexion->insert_id;
    }

    public function Modificar($idbanco, $idglobal, $idoficina, $nombre, $tipo, $numeroCuenta, $titular, $documento, $orden)
    {
        global $conexion;
        $sql = "UPDATE tbl_banco
                SET idoficina=?, str_banco=?, str_tipo=?, str_num_cueneta=?, str_titular=?, str_documento_titular=?,
                    int_orden=?, updated_at=NOW()
                WHERE idbanco=? AND idglobal=?";
        db_execute($conexion, $sql, "isssssiii", [$idoficina, $nombre, $tipo, $numeroCuenta, $titular, $documento, intval($orden), intval($idbanco), intval($idglobal)]);
        return true;
    }

    public function CambiarEstado($idbanco, $idglobal, $estado)
    {
        global $conexion;
        db_execute($conexion, "UPDATE tbl_banco SET str_estado=?, updated_at=NOW() WHERE idbanco=? AND idglobal=?", "sii", [$estado, intval($idbanco), intval($idglobal)]);
        return true;
    }

    /** Sucursales que el usuario puede gestionar, con la marca de si la cuenta está autorizada. */
    public function SucursalesParaAutorizar($idbanco, $idglobal, array $alcance)
    {
        global $conexion;
        $filtro = '';
        $types = "ii";
        $params = [intval($idbanco), intval($idglobal)];
        if (!$alcance['super']) {
            $oficinas = count($alcance['oficinas']) > 0 ? $alcance['oficinas'] : array(0);
            $filtro = " AND s.idoficina IN (" . implode(',', array_fill(0, count($oficinas), '?')) . ")";
            $types .= str_repeat('i', count($oficinas));
            $params = array_merge($params, $oficinas);
        }
        $sql = "SELECT s.idsucursal, s.str_tipo, s.str_codigo, s.str_estado, o.str_nombre AS oficina,
                       (bs.idbanco IS NOT NULL) AS autorizada
                FROM tbl_sucursal s
                LEFT JOIN tbl_oficina o ON o.idoficina=s.idoficina AND o.idglobal=s.idglobal
                LEFT JOIN tbl_banco_sucursal bs ON bs.idsucursal=s.idsucursal AND bs.idbanco=? AND bs.idglobal=s.idglobal
                WHERE s.idglobal=?$filtro
                ORDER BY o.str_nombre, s.str_tipo, s.str_codigo";
        $stmt = db_prepare_execute($conexion, $sql, $types, $params);
        $res = $stmt->get_result();
        $rows = array();
        while ($row = $res->fetch_object()) {
            $rows[] = $row;
        }
        $stmt->close();
        return $rows;
    }

    /** Reemplaza las autorizaciones solo dentro de las sucursales que el usuario gestiona. */
    public function GuardarSucursales($idbanco, $idglobal, array $alcance, array $seleccionadas, $idusuario)
    {
        global $conexion;
        $gestionables = array();
        foreach ($this->SucursalesParaAutorizar($idbanco, $idglobal, $alcance) as $row) {
            $gestionables[] = intval($row->idsucursal);
        }
        $seleccionadas = array_values(array_intersect(array_map('intval', $seleccionadas), $gestionables));
        $conexion->begin_transaction();
        try {
            if (count($gestionables) > 0) {
                $ph = implode(',', array_fill(0, count($gestionables), '?'));
                db_execute(
                    $conexion,
                    "DELETE FROM tbl_banco_sucursal WHERE idbanco=? AND idglobal=? AND idsucursal IN ($ph)",
                    str_repeat('i', count($gestionables) + 2),
                    array_merge([intval($idbanco), intval($idglobal)], $gestionables)
                );
            }
            foreach ($seleccionadas as $idsucursal) {
                db_execute(
                    $conexion,
                    "INSERT INTO tbl_banco_sucursal (idbanco, idsucursal, idglobal, idusuario, created_at) VALUES (?, ?, ?, ?, NOW())",
                    "iiii",
                    [intval($idbanco), $idsucursal, intval($idglobal), intval($idusuario)]
                );
            }
            $conexion->commit();
        } catch (Throwable $e) {
            $conexion->rollback();
            throw $e;
        }
        return count($seleccionadas);
    }
}
