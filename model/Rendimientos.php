<?php
require "Conexion.php";

class Rendimientos
{
   public function __construct() {}

   private function resolveMonthRange($periodo = '')
   {
      $periodo = trim((string)$periodo);
      if (preg_match('/^\d{4}-\d{2}$/', $periodo)) {
         $inicio = $periodo . '-01';
      } else {
         $inicio = date('Y-m-01');
      }

      $time = strtotime($inicio);
      if ($time === false) {
         $inicio = date('Y-m-01');
      }

      $primerDia = date('Y-m-01', strtotime($inicio));
      $ultimoDia = date('Y-m-t', strtotime($inicio));

      return array($primerDia, $ultimoDia);
   }


   private function buildScopeWhere($superadmin, $idglobal, $userEmpleadoId)
   {
      global $conexion;

      $idglobal = intval($idglobal);
      $userEmpleadoId = intval($userEmpleadoId);
      $idoficina = isset($_SESSION['idoficina']) ? intval($_SESSION['idoficina']) : 0;

      if (isset($superadmin) && $superadmin) {
         return " AND refSucursal IN (
            SELECT s.idsucursal
            FROM tbl_sucursal s
            WHERE s.idglobal=$idglobal AND s.str_estado='disponible' AND s.idoficina=$idoficina
         ) ";
      }

      $sql = "SELECT
               au.idsucursal
            FROM
               tbl_auth_sucursal au
               INNER JOIN tbl_auths b ON b.idauth_sucursal = au.idauth_sucursal
               INNER JOIN tbl_auth a ON a.idauth = b.idauth
            WHERE
               au.idempleado = $userEmpleadoId
               AND au.str_estado <> 'inactivo'
               AND a.str_nombre = 'rendimientos' 
            GROUP BY au.idauth_sucursal";

      $query = $conexion->query($sql);
      if (!$query) {
         return " AND 1=0 ";
      }

      $refSucursales = array();
      while ($reg = $query->fetch_object()) {
         $refSucursales[] = intval($reg->idsucursal);
      }

      if (count($refSucursales) === 0) {
         return " AND 1=0 ";
      }

      return " AND refSucursal IN (" . implode(",", $refSucursales) . ") ";
   }

   /**
    * Obtiene rendimientos del mes actual agrupados por día
    */
   public function listCurrentMonth($superadmin, $idglobal, $userEmpleadoId, $periodo)
   {
      global $conexion;

      $idglobal = intval($idglobal);
      list($primerDia, $ultimoDia) = $this->resolveMonthRange($periodo);
      $scopeWhere = $this->buildScopeWhere($superadmin, $idglobal, $userEmpleadoId);
      $scopeWhereSucursal = str_replace('refSucursal', 's.idsucursal', $scopeWhere);

      $sql = "SELECT 
    s.str_codigo AS codigo, 
    IFNULL(v.recaudo, 0) AS recaudo, 
    ABS(IFNULL(v.prestamo, 0)) AS prestamo, 
    ABS(IFNULL(v.venta, 0)) AS venta, 
    IFNULL(v.seguro, 0) AS seguro, 
    IFNULL(v.diferencia, 0) AS diferencia, 
    IFNULL(v.descuento, 0) AS descuento, 
    IFNULL(v.gastos, 0) AS gastos, 
    IFNULL(v.otros_gastos, 0) AS otros_gastos, 
    IFNULL(v.salida, 0) AS salida, 
    IFNULL(v.entrada, 0) AS entrada, 
    IFNULL(t.sum_cart, 0) AS sum_cart,
    IFNULL(v.saldo_disp + IFNULL(h.efectivo_historico, 0), 0) AS saldo_disp, 
    IFNULL(v.valorTotalCreditos, 0) AS valorTotalCreditos, 
    IFNULL(t.carteraTotal, 0) AS carteraTotal
FROM tbl_sucursal s

-- 1. Bloque del periodo actual optimizado desde las tablas base
LEFT JOIN (
    SELECT 
        dr.idsucursal AS refSucursal, 
        SUM(CASE WHEN c.str_nombre = 'recaudo' THEN c.dec_total ELSE 0 END) AS recaudo,
        SUM(CASE WHEN c.str_nombre = 'prestamos' THEN c.dec_total ELSE 0 END) AS prestamo,
        SUM(CASE WHEN c.str_nombre = 'articulos' THEN c.dec_total ELSE 0 END) AS venta,
        SUM(CASE WHEN c.str_nombre = 'efectivo-otra-utilidad' THEN c.dec_total ELSE 0 END) AS seguro,
        SUM(CASE WHEN c.str_nombre = 'diferencia' THEN c.dec_total ELSE 0 END) AS diferencia,
        SUM(CASE WHEN c.str_nombre = 'descuento' THEN c.dec_total ELSE 0 END) AS descuento,
        SUM(CASE WHEN c.str_nombre = 'valorTotalCreditos' THEN c.dec_total ELSE 0 END) AS valorTotalCreditos,
        SUM(CASE WHEN c.idtipo_contabilidad <> 8 THEN c.dec_total ELSE 0 END) AS saldo_disp,
        SUM(CASE WHEN c.str_nombre <> 'prestamos' AND c.str_nombre <> 'articulos' AND c.str_operacion LIKE 'salida-totalizar%' THEN c.dec_total ELSE 0 END) * -1 AS gastos,
        SUM(CASE WHEN c.idtipo_contabilidad <> 6 AND c.str_operacion LIKE 'salida-contabilidad%' THEN c.dec_total ELSE 0 END) * -1 AS otros_gastos,
        SUM(CASE WHEN c.idtipo_contabilidad = 6 AND c.str_operacion LIKE 'salida-contabilidad%' THEN c.dec_total ELSE 0 END) * -1 AS salida,
        SUM(CASE WHEN c.idtipo_contabilidad = 9 THEN c.dec_total ELSE 0 END) AS entrada
    FROM tbl_detalle_ruta dr
    INNER JOIN tbl_contabilidad_detalle c ON c.iddetalleruta = dr.iddetalleruta
    WHERE dr.created_at >= '$primerDia' 
      AND dr.created_at < DATE_ADD('$ultimoDia', INTERVAL 1 DAY)
    GROUP BY dr.idsucursal
) v ON v.refSucursal = s.idsucursal

-- 2. Bloque de cartera consolidada (Una sola lectura en lugar de dos subconsultas)
LEFT JOIN (
    SELECT 
        idsucursal,
        SUM(CASE WHEN str_estado NOT IN ('cancelado', 'inactiva', 'moroso', 'fallecio', 'discapacitado') THEN dec_resta ELSE 0 END) AS sum_cart,
        SUM(CASE WHEN str_estado NOT IN ('cancelado', 'inactiva') THEN dec_resta ELSE 0 END) AS carteraTotal
    FROM tbl_tarjetas
    WHERE str_estado NOT IN ('cancelado', 'inactiva')
    GROUP BY idsucursal
) t ON t.idsucursal = s.idsucursal

-- 3. Histórico acumulado de caja (Calculado de forma directa y rápida)
LEFT JOIN (
    SELECT 
        dr.idsucursal AS refSucursal, 
        SUM(CASE WHEN c.idtipo_contabilidad <> 8 THEN c.dec_total ELSE 0 END) AS efectivo_historico
    FROM tbl_detalle_ruta dr
    INNER JOIN tbl_contabilidad_detalle c ON c.iddetalleruta = dr.iddetalleruta
    WHERE dr.created_at < '$primerDia'
    GROUP BY dr.idsucursal
) h ON h.refSucursal = s.idsucursal

WHERE s.idglobal = $idglobal 
  AND s.str_estado = 'disponible' 
  $scopeWhereSucursal 
ORDER BY s.str_codigo ASC;
";





      // 2. Ejecución de la consulta utilizando tu conexión nativa
      $query = $conexion->query($sql);

      // 3. Validación y captura de errores (Estándar profesional)
      if (!$query) {
         die("Error en la consulta de MariaDB: " . $conexion->error);
      }

      return $query;
   }

   /**
    * Obtiene totales del mes actual
    */
   public function getTotalCurrentMonth($superadmin, $idglobal, $userEmpleadoId, $periodo = '')
   {
      global $conexion;

      list($primerDia, $ultimoDia) = $this->resolveMonthRange($periodo);
      $scopeWhere = $this->buildScopeWhere($superadmin, $idglobal, $userEmpleadoId);

      $sql = "SELECT 
         SUM(IFNULL(recaudo, 0)) AS recaudo,
         SUM(IFNULL(prestamo, 0)) AS prestamo,
         SUM(IFNULL(ventaArticulo, 0)) AS venta,
         SUM(IFNULL(efectivoOtraUtilidad, 0)) AS seguro,
         SUM(IFNULL(diferencia, 0)) AS diferencia,
         SUM(IFNULL(descuento, 0)) AS descuento,
         SUM(IFNULL(masUtilidad, 0)) AS utilidad,
         SUM(IFNULL(gastos, 0)) AS gastos,
         SUM(IFNULL(otros_gastos, 0)) AS otros_gastos,
         SUM(IFNULL(entrada, 0)) - SUM(IFNULL(salida, 0)) AS movimientos,
         SUM(IFNULL(base, 0)) AS sum_cart,
         SUM(IFNULL(efectivoCaja, 0)) AS saldo_disp,
         SUM(IFNULL(valorTotalCreditos, 0)) AS valorTotalCreditos
      FROM view_cobro_detallado
      WHERE fecha_at >= '$primerDia' AND fecha_at < DATE_ADD('$ultimoDia', INTERVAL 1 DAY) $scopeWhere";

      $query = $conexion->query($sql);
      return $query;
   }
}
