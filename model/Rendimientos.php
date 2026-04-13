<?php
require "Conexion.php";

class Rendimientos
{
   public function __construct() {}

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
               AND (a.str_nombre = 'rendimientos' OR a.str_nombre = 'kardex valorizado')
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
   public function listCurrentMonth($superadmin, $idglobal, $userEmpleadoId)
   {
      global $conexion;

      $primerDia = date('Y-m-01');
      $ultimoDia = date('Y-m-t');
      $scopeWhere = $this->buildScopeWhere($superadmin, $idglobal, $userEmpleadoId);

      $sql = "SELECT 
      codigo,
         SUM(IFNULL(recaudo, 0)) AS recaudo,
         SUM(IFNULL(prestamo, 0)) AS prestamo,
         SUM(IFNULL(ventaArticulo, 0)) AS venta,
         SUM(IFNULL(efectivoOtraUtilidad, 0)) AS seguro,
         SUM(IFNULL(diferencia, 0)) AS diferencia,
         SUM(IFNULL(descuento, 0)) AS descuento,
         SUM(IFNULL(gastos, 0)) AS gastos,
         SUM(IFNULL(otros_gastos, 0)) AS otros_gastos,
         SUM(IFNULL(salida, 0)) AS salida,
         SUM(IFNULL(entrada, 0)) AS entrada,
         SUM(IFNULL(base, 0)) AS sum_cart,
         SUM(IFNULL(efectivoCaja, 0)) AS saldo_disp,
         SUM(IFNULL(valorTotalCreditos, 0)) AS valorTotalCreditos
      FROM view_cobro_detallado
      WHERE fecha_at >= '$primerDia' AND fecha_at < DATE_ADD('$ultimoDia', INTERVAL 1 DAY) $scopeWhere
      GROUP By codigo

      ORDER BY codigo ASC";

      $query = $conexion->query($sql);
      return $query;
   }

   /**
    * Obtiene totales del mes actual
    */
   public function getTotalCurrentMonth($superadmin, $idglobal, $userEmpleadoId)
   {
      global $conexion;

      $primerDia = date('Y-m-01');
      $ultimoDia = date('Y-m-t');
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
