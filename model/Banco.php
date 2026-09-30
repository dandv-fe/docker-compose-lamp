<?php
require "Conexion.php";

class Banco
{
    public function Listar($idglobal)
    {
        global $conexion;
        $sql = "SELECT idbanco, str_banco, str_tipo, str_num_cueneta, str_estado, int_orden, created_at, updated_at
                FROM tbl_banco
                WHERE idglobal=?
                ORDER BY int_orden ASC, str_banco ASC, idbanco ASC";
        $stmt = db_prepare_execute($conexion, $sql, "i", [intval($idglobal)]);
        return $stmt->get_result();
    }

    public function ListarActivos($idglobal)
    {
        global $conexion;
        $sql = "SELECT idbanco, str_banco, str_tipo, str_num_cueneta, int_orden
                FROM tbl_banco
                WHERE idglobal=? AND str_estado='activo'
                ORDER BY int_orden ASC, str_banco ASC, idbanco ASC";
        $stmt = db_prepare_execute($conexion, $sql, "i", [intval($idglobal)]);
        return $stmt->get_result();
    }

    public function Registrar($idglobal, $nombre, $tipo, $numeroCuenta, $orden)
    {
        global $conexion;
        $sql = "INSERT INTO tbl_banco (idglobal, str_banco, str_tipo, str_num_cueneta, str_estado, int_orden, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'activo', ?, NOW(), NOW())";
        db_execute($conexion, $sql, "isssi", [intval($idglobal), $nombre, $tipo, $numeroCuenta, intval($orden)]);
        return $conexion->insert_id;
    }

    public function Modificar($idbanco, $idglobal, $nombre, $tipo, $numeroCuenta, $orden)
    {
        global $conexion;
        $sql = "UPDATE tbl_banco
                SET str_banco=?, str_tipo=?, str_num_cueneta=?, int_orden=?, updated_at=NOW()
                WHERE idbanco=? AND idglobal=?";
        db_execute($conexion, $sql, "sssiii", [$nombre, $tipo, $numeroCuenta, intval($orden), intval($idbanco), intval($idglobal)]);
        return $conexion->affected_rows >= 0;
    }

    public function CambiarEstado($idbanco, $idglobal, $estado)
    {
        global $conexion;
        $sql = "UPDATE tbl_banco SET str_estado=?, updated_at=NOW() WHERE idbanco=? AND idglobal=?";
        db_execute($conexion, $sql, "sii", [$estado, intval($idbanco), intval($idglobal)]);
        return $conexion->affected_rows >= 0;
    }

    public function TieneReferencias($idbanco, $idglobal)
    {
        global $conexion;
        $sql = "SELECT
                    (SELECT COUNT(*) FROM tbl_descripcion_pago WHERE idbanco=? AND idglobal=?) +
                    (SELECT COUNT(*) FROM tbl_tarjeta_pago WHERE idbanco=? AND idglobal=?) AS total";
        $row = db_fetch_object($conexion, $sql, "iiii", [intval($idbanco), intval($idglobal), intval($idbanco), intval($idglobal)]);
        return intval($row->total ?? 0) > 0;
    }
}
