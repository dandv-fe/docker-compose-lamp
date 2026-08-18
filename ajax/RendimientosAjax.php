<?php
session_start();
require_once "../method.php";
require_once "../model/Rendimientos.php";
$objRendimientos = new Rendimientos();
$idglobal = $_SESSION['idglobal'];
$userEmpleadoId = $_SESSION['idempleado'];
$superadmin = $_SESSION['userEmpresa'];
session_write_close();

switch ($_GET["op"]) {
   case 'GetCurrentMonth':
      $periodo = isset($_GET['periodo']) ? trim($_GET['periodo']) : '';
      if (!preg_match('/^\d{4}-\d{2}$/', $periodo)) {
         $periodo = '';
      }
      print_r($periodo);
      $query = $objRendimientos->listCurrentMonth($superadmin, $idglobal, $userEmpleadoId, $periodo);
      $data = array();
      $totales = array(
         'recaudo' => 0,
         'prestamo' => 0,
         'venta' => 0,
         'seguro' => 0,
         'diferencia' => 0,
         'descuento' => 0,
         'gastos' => 0,
         'otros_gastos' => 0,
         'salida' => 0,
         'entrada' => 0,
         'sum_cart' => 0,
         'saldo_disp' => 0,
         'valorTotalCreditos' => 0,
         'carteraTotal' => 0
      );

      if ($query && $query->num_rows > 0) {
         while ($reg = $query->fetch_object()) {
            print_r($reg);

            $utilidad = ($reg->valorTotalCreditos - ($reg->prestamo + $reg->venta)) + $reg->seguro + $reg->diferencia - $reg->descuento;
            $gastos = $reg->gastos + $reg->otros_gastos;
            $crece = $utilidad - $gastos - $reg->salida + $reg->entrada;

            $totales['recaudo'] += (float)$reg->recaudo;
            $totales['prestamo'] += (float)$reg->prestamo;
            $totales['venta'] += (float)$reg->venta;
            $totales['seguro'] += (float)$reg->seguro;
            $totales['diferencia'] += (float)$reg->diferencia;
            $totales['descuento'] += (float)$reg->descuento;
            $totales['gastos'] += (float)$reg->gastos;
            $totales['otros_gastos'] += (float)$reg->otros_gastos;
            $totales['salida'] += (float)$reg->salida;
            $totales['entrada'] += (float)$reg->entrada;
            $totales['sum_cart'] += (float)$reg->sum_cart;
            $totales['saldo_disp'] += (float)$reg->saldo_disp;
            $totales['valorTotalCreditos'] += (float)$reg->valorTotalCreditos;
            $totales['carteraTotal'] += ((float)$reg->sum_cart + (float)$reg->saldo_disp);

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
               number_format(((float)$reg->sum_cart + (float)$reg->saldo_disp), 2, '.', ',')
            );
         }

         $total_utilidad = ($totales['valorTotalCreditos'] - ($totales['prestamo'] + $totales['venta'])  + $totales['seguro'] + $totales['diferencia'] - $totales['descuento']);
         $total_gastos = $totales['gastos'] + $totales['otros_gastos'];
         $utilidad_neta_total = $total_utilidad - $total_gastos;
         $total_crece = $utilidad_neta_total - $totales['salida'] + $totales['entrada'];

         $data[] = array(
            '<b>TOTAL</b>',
            '<b>' . number_format($totales['recaudo'], 2, '.', ',') . '</b>',
            '<b>' . number_format($totales['prestamo'], 2, '.', ',') . '</b>',
            '<b>' . number_format($totales['venta'], 2, '.', ',') . '</b>',
            '<b>' . number_format($totales['seguro'], 2, '.', ',') . '</b>',
            '<b>' . number_format($totales['diferencia'], 2, '.', ',') . '</b>',
            '<b>' . number_format($totales['descuento'], 2, '.', ',') . '</b>',
            '<b>' . number_format($total_utilidad, 2, '.', ',') . '</b>',
            '<b>' . number_format($utilidad_neta_total, 2, '.', ',') . '</b>',
            '<b>' . number_format($total_gastos, 2, '.', ',') . '</b>',
            '<b>' . number_format($totales['salida'], 2, '.', ',') . '</b>',
            '<b>' . number_format($totales['entrada'], 2, '.', ',') . '</b>',
            '<b>' . number_format($total_crece, 2, '.', ',') . '</b>',
            '<b>' . number_format($totales['sum_cart'], 2, '.', ',') . '</b>',
            '<b>' . number_format($totales['saldo_disp'], 2, '.', ',') . '</b>',
            '<b>' . number_format($totales['carteraTotal'], 2, '.', ',') . '</b>'
         );
      }

      echo json_encode($data);
      break;

   default:
      echo json_encode(array('error' => 'Operación no válida'));
      break;
}
