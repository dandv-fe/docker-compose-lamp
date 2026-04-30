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
   public function listCurrentMonth($superadmin, $idglobal, $userEmpleadoId, $periodo = '')
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

         
         (SELECT IFNULL( sum( dec_resta ), 0 ) 
            FROM tbl_tarjetas WHERE idsucursal=s.idsucursal 
                     AND str_estado<>'cancelado' 
                     AND str_estado<>'inactiva' 
                     AND str_estado<>'moroso' 
                     AND str_estado<>'fallecio'
                     AND str_estado<>'discapacitado'
          ) AS sum_cart,

         IFNULL(v.saldo_disp +(SELECT IFNULL( sum( efectivoCaja ), 0 ) 
            FROM view_cobro_detallado WHERE refSucursal=s.idsucursal AND fecha_at<'$primerDia'), 0)  AS saldo_disp,

          IFNULL(v.valorTotalCreditos, 0) AS valorTotalCreditos,
         (SELECT IFNULL( sum( dec_resta ), 0 ) 
            FROM tbl_tarjetas WHERE idsucursal=s.idsucursal 
                     AND str_estado<>'cancelado' 
                     AND str_estado<>'inactiva' 

          ) AS carteraTotal


      FROM tbl_sucursal s
      LEFT JOIN (
         SELECT
            refSucursal,
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
         WHERE fecha_at >= '$primerDia' AND fecha_at < DATE_ADD('$ultimoDia', INTERVAL 1 DAY)
         GROUP BY refSucursal
      ) v ON v.refSucursal = s.idsucursal
      WHERE s.idglobal = $idglobal
        AND s.str_estado = 'disponible'
        $scopeWhereSucursal
      ORDER BY s.str_codigo ASC";

      $query = $conexion->query($sql);
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
