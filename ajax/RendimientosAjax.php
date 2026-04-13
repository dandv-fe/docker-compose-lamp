<?php
session_start();
require_once "../method.php";
require_once "../model/Rendimientos.php";
$objRendimientos = new Rendimientos();
$idglobal = $_SESSION['idglobal'];
$userEmpleadoId = $_SESSION['idempleado'];
$superadmin = $_SESSION['userEmpresa'];

switch ($_GET["op"]) {
   case 'GetCurrentMonth':
      $periodo = isset($_GET['periodo']) ? trim($_GET['periodo']) : '';
      if (!preg_match('/^\d{4}-\d{2}$/', $periodo)) {
         $periodo = '';
      }

      $query = $objRendimientos->listCurrentMonth($superadmin, $idglobal, $userEmpleadoId, $periodo);
      $data = array();

      if ($query && $query->num_rows > 0) {
         while ($reg = $query->fetch_object()) {
            // $utilidad_neta = $reg->utilidad - $reg->gastos;
            $utilidad = $reg->valorTotalCreditos + $reg->prestamo + $reg->venta + $reg->seguro + $reg->diferencia - $reg->descuento;
            $gastos = $reg->gastos + $reg->otros_gastos;
            $crece = $utilidad - $gastos - $reg->salida + $reg->entrada;

            $data[] = array(
               $reg->codigo,
               number_format($reg->recaudo, 2, '.', ','),
               number_format($reg->prestamo, 2, '.', ','),
               number_format($reg->venta, 2, '.', ','),
               number_format($reg->seguro, 2, '.', ','),
               number_format($reg->diferencia, 2, '.', ','),
               number_format($reg->descuento, 2, '.', ','),
               number_format($utilidad, 2, '.', ','), //utilidad
               number_format($utilidad - $gastos, 2, '.', ','), //$utilidad_neta
               number_format($gastos, 2, '.', ','),
               number_format($reg->salida, 2, '.', ','), //salida
               number_format($reg->entrada, 2, '.', ','), //entrada
               number_format($crece, 2, '.', ','), //crece
               number_format($reg->sum_cart, 2, '.', ','), //sum_cart
               number_format($reg->saldo_disp, 2, '.', ','), //saldo_disp
               number_format($reg->valorTotalCreditos, 2, '.', ',')
            );
         }

         // Agregar fila de totales
         $queryTotal = $objRendimientos->getTotalCurrentMonth($superadmin, $idglobal, $userEmpleadoId, $periodo);
         $total = $queryTotal->fetch_object();
         $total_utilidad = $total->valorTotalCreditos + $total->prestamo + $total->venta + $total->seguro + $total->diferencia - $total->descuento;
         $total_gastos = $total->gastos + $total->otros_gastos;
         $utilidad_neta_total = $total_utilidad - $total_gastos;
         $total_crece = $total_utilidad - $total_gastos + $total->movimientos;

         $data[] = array(
            '<b>TOTAL</b>',
            '<b>' . number_format($total->recaudo, 2, '.', ',') . '</b>',
            '<b>' . number_format($total->prestamo, 2, '.', ',') . '</b>',
            '<b>' . number_format($total->venta, 2, '.', ',') . '</b>',
            '<b>' . number_format($total->seguro, 2, '.', ',') . '</b>',
            '<b>' . number_format($total->diferencia, 2, '.', ',') . '</b>',
            '<b>' . number_format($total->descuento, 2, '.', ',') . '</b>',
            '<b>' . number_format($total_utilidad, 2, '.', ',') . '</b>',
            '<b>' . number_format($utilidad_neta_total, 2, '.', ',') . '</b>',
            '<b>' . number_format($total_gastos, 2, '.', ',') . '</b>',
            '<b>' . number_format(0, 2, '.', ',') . '</b>',
            '<b>' . number_format(0, 2, '.', ',') . '</b>',
            '<b>' . number_format($total_crece, 2, '.', ',') . '</b>',
            '<b>' . number_format($total->sum_cart, 2, '.', ',') . '</b>',
            '<b>' . number_format($total->saldo_disp, 2, '.', ',') . '</b>',
            '<b>' . number_format($total->valorTotalCreditos, 2, '.', ',') . '</b>'
         );
      }

      echo json_encode($data);
      break;

   default:
      echo json_encode(array('error' => 'Operación no válida'));
      break;
}
