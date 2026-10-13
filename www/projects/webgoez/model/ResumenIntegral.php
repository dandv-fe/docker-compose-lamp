<?php
require_once __DIR__ . '/Conexion.php';

function resumenIntegralPermisos(): array
{
   return ['cobro detallado', 'egresos', 'kardex valorizado', 'rendimientos'];
}

function resumenIntegralFilas(mysqli $conexion, string $sql, string $types = '', array $params = []): array
{
   $stmt = db_prepare_execute($conexion, $sql, $types, $params);
   try {
      return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
   } finally {
      $stmt->close();
   }
}

function resumenIntegralIdentidad(mysqli $conexion, int $idusuario, int $oficina): array
{
   $rows = resumenIntegralFilas($conexion,
      'SELECT idglobal, idempleado, str_cargo, idoficina, estado_usuario, estado_empleado
       FROM view_usuario_session WHERE idusuario=?', 'i', [$idusuario]);
   if (!$rows || (int)$rows[0]['idempleado'] <= 0 ||
       $rows[0]['estado_usuario'] === 'inactivo' || $rows[0]['estado_empleado'] === 'inactivo') {
      throw new DomainException('Su usuario no tiene acceso a esta consulta.');
   }
   $user = $rows[0];
   $payment = db_fetch_object($conexion,
      "SELECT date_corte, int_dias_extras FROM tbl_descripcion_global
       WHERE idglobal_accion=? AND str_estado='actual' LIMIT 1", 'i', [(int)$user['idglobal']]);
   if ($payment && $payment->date_corte) {
      $cutoff = new DateTimeImmutable($payment->date_corte);
      $days = (int)(new DateTimeImmutable())->diff($cutoff)->format('%r%a');
      if ($days + (int)$payment->int_dias_extras < 0) {
         throw new DomainException('El servicio está vencido. Revise el pago de la plataforma.');
      }
   }
   return [
      'idglobal' => (int)$user['idglobal'],
      'idempleado' => (int)$user['idempleado'],
      'superadmin' => $user['str_cargo'] === 'Super Administrador',
      'idoficina' => $oficina > 0 ? $oficina : (int)$user['idoficina']
   ];
}

function resumenIntegralSucursales(mysqli $conexion, array $context): array
{
   $params = [(int)$context['idglobal']];
   $types = 'i';
   if ($context['superadmin']) {
      $where = ' AND s.idoficina=?';
      $types .= 'i';
      $params[] = (int)$context['idoficina'];
   } else {
      // Los cuatro permisos deben coincidir en la misma sucursal, no solo en el usuario.
      $where = " AND s.idsucursal IN (
         SELECT au.idsucursal FROM tbl_auth_sucursal au
         JOIN tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal
         JOIN tbl_auth a ON a.idauth=b.idauth
         WHERE au.idglobal=? AND au.idempleado=? AND au.str_estado <> 'inactivo'
           AND a.str_nombre IN (?,?,?,?)
         GROUP BY au.idsucursal HAVING COUNT(DISTINCT a.str_nombre)=4
      )";
      $types .= 'iissss';
      $params = array_merge($params, [(int)$context['idglobal'], (int)$context['idempleado']],
         resumenIntegralPermisos());
   }
   $rows = resumenIntegralFilas($conexion,
      "SELECT s.idsucursal AS id, s.str_codigo AS code, o.str_nombre AS office
       FROM tbl_sucursal s JOIN tbl_oficina o ON o.idoficina=s.idoficina AND o.idglobal=s.idglobal
       WHERE s.idglobal=? AND s.str_estado='disponible'$where
       ORDER BY o.str_nombre, s.str_codigo, s.idsucursal", $types, $params);
   foreach ($rows as &$row) {
      $row['id'] = (int)$row['id'];
   }
   unset($row);
   return $rows;
}

function resumenIntegralPeriodo(string $desde, string $hasta): array
{
   $parse = static function (string $value): DateTimeImmutable {
      $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
      if (!$date || $date->format('Y-m-d') !== $value) {
         throw new InvalidArgumentException('Seleccione fechas válidas (AAAA-MM-DD).');
      }
      return $date;
   };
   $start = $parse($desde);
   $end = $parse($hasta);
   $days = (int)$start->diff($end)->format('%r%a') + 1;
   if ($days <= 0 || $days > 366) {
      throw new InvalidArgumentException('La fecha final debe ser posterior o igual a la inicial; máximo 366 días.');
   }
   if ($end > new DateTimeImmutable('today')) {
      throw new InvalidArgumentException('La fecha final no puede estar en el futuro.');
   }
   return [
      'start' => $desde, 'end' => $hasta,
      'endExclusive' => $end->modify('+1 day')->format('Y-m-d'),
      'previousStart' => $start->modify("-$days days")->format('Y-m-d'),
      'previousEnd' => $start->modify('-1 day')->format('Y-m-d')
   ];
}

function resumenIntegralMetricas(): array
{
   return array_fill_keys([
      'recaudo', 'prestamos', 'ventas', 'adicionales', 'diferencia', 'descuento',
      'valorCreditos', 'gastosRuta', 'otrosGastos', 'salidas', 'entradas',
      'utilidad', 'utilidadNeta', 'crecimiento', 'rutas', 'rutasPendientes'
   ], 0);
}

function resumenIntegralCalcular(array $row): array
{
   foreach (array_merge(array_keys(resumenIntegralMetricas()), [
      'caja', 'carteraActiva', 'carteraMorosa', 'carteraRetirada',
      'tarjetasActivas', 'tarjetasMorosas', 'tarjetasRetiradas'
   ]) as $key) {
      if (array_key_exists($key, $row)) {
         $row[$key] = round($row[$key], 2);
      }
   }
   $row['utilidad'] = round($row['valorCreditos'] - $row['prestamos'] - $row['ventas'] +
      $row['adicionales'] + $row['diferencia'] - $row['descuento'], 2);
   $row['utilidadNeta'] = round($row['utilidad'] - $row['gastosRuta'] - $row['otrosGastos'], 2);
   $row['crecimiento'] = round($row['utilidadNeta'] - $row['salidas'] + $row['entradas'], 2);
   if (array_key_exists('caja', $row)) {
      $row['carteraTotal'] = round($row['carteraActiva'] + $row['carteraMorosa'] + $row['carteraRetirada'], 2);
      $row['capitalActual'] = round($row['caja'] + $row['carteraActiva'], 2);
      $row['riesgoPct'] = $row['carteraTotal'] > 0
         ? round(100 * ($row['carteraMorosa'] + $row['carteraRetirada']) / $row['carteraTotal'], 2) : null;
   }
   return $row;
}

class ResumenIntegral
{
   private mysqli $conexion;
   private array $branches;
   private array $selected;
   private array $period;
   private string $marks;
   private string $types;
   private array $ids;
   private int $company;
   private string $snapshotAt;

   public function __construct(mysqli $conexion, array $context, string $desde, string $hasta, int $sucursal = 0)
   {
      $this->conexion = $conexion;
      $this->company = (int)$context['idglobal'];
      $this->period = resumenIntegralPeriodo($desde, $hasta);
      $this->branches = resumenIntegralSucursales($conexion, $context);
      if (!$this->branches) {
         throw new DomainException('No hay sucursales disponibles con los cuatro permisos de consulta.');
      }
      $this->selected = array_values(array_filter($this->branches,
         static fn(array $row): bool => $sucursal === 0 || $row['id'] === $sucursal));
      if (!$this->selected) {
         throw new DomainException('La sucursal seleccionada no está autorizada para esta consulta.');
      }
      $this->ids = array_column($this->selected, 'id');
      $this->marks = implode(',', array_fill(0, count($this->ids), '?'));
      $this->types = str_repeat('i', count($this->ids));
   }

   private function rows(string $sql, string $suffixTypes = '', array $suffixParams = []): array
   {
      return resumenIntegralFilas($this->conexion, $sql, 'i' . $this->types . $suffixTypes,
         array_merge([$this->company], $this->ids, $suffixParams));
   }

   private function operations(): array
   {
      // Agregar primero por ruta evita contarla una vez por cada asiento contable.
      return $this->rows(
         "SELECT r.idsucursal AS id, DATE(r.created_at) AS date,
            COUNT(*) AS rutas, SUM(r.str_estado <> 'saved') AS rutasPendientes,
            SUM(v.recaudo) AS recaudo, -SUM(v.prestamos) AS prestamos, -SUM(v.ventas) AS ventas,
            SUM(v.adicionales) AS adicionales, SUM(v.diferencia) AS diferencia,
            SUM(v.descuento) AS descuento, SUM(v.valorCreditos) AS valorCreditos,
            -SUM(v.gastosRuta) AS gastosRuta, -SUM(v.otrosGastos) AS otrosGastos,
            -SUM(v.salidas) AS salidas, SUM(v.entradas) AS entradas
          FROM tbl_detalle_ruta r
          LEFT JOIN (
            SELECT c.iddetalleruta,
               SUM(CASE WHEN c.str_nombre='recaudo' THEN c.dec_total ELSE 0 END) AS recaudo,
               SUM(CASE WHEN c.str_nombre='prestamos' THEN c.dec_total ELSE 0 END) AS prestamos,
               SUM(CASE WHEN c.str_nombre='articulos' THEN c.dec_total ELSE 0 END) AS ventas,
               SUM(CASE WHEN c.str_nombre='efectivo-otra-utilidad' THEN c.dec_total ELSE 0 END) AS adicionales,
               SUM(CASE WHEN c.str_nombre='diferencia' THEN c.dec_total ELSE 0 END) AS diferencia,
               SUM(CASE WHEN c.str_nombre='descuento' THEN c.dec_total ELSE 0 END) AS descuento,
               SUM(CASE WHEN c.str_nombre='valorTotalCreditos' THEN c.dec_total ELSE 0 END) AS valorCreditos,
               SUM(CASE WHEN c.str_nombre NOT IN ('prestamos','articulos')
                  AND c.str_operacion LIKE 'salida-totalizar%' THEN c.dec_total ELSE 0 END) AS gastosRuta,
               SUM(CASE WHEN c.idtipo_contabilidad<>6 AND c.str_operacion LIKE 'salida-contabilidad%'
                  THEN c.dec_total ELSE 0 END) AS otrosGastos,
               SUM(CASE WHEN c.idtipo_contabilidad=6 AND c.str_operacion LIKE 'salida-contabilidad%'
                  THEN c.dec_total ELSE 0 END) AS salidas,
               SUM(CASE WHEN c.idtipo_contabilidad=9 THEN c.dec_total ELSE 0 END) AS entradas
            FROM tbl_contabilidad_detalle c
            JOIN tbl_detalle_ruta dr ON dr.iddetalleruta=c.iddetalleruta
            WHERE dr.idglobal=? AND dr.idsucursal IN ($this->marks)
              AND c.idglobal=dr.idglobal AND c.idsucursal=dr.idsucursal
              AND dr.created_at>=? AND dr.created_at<?
            GROUP BY c.iddetalleruta
          ) v ON v.iddetalleruta=r.iddetalleruta
          WHERE r.idglobal=? AND r.idsucursal IN ($this->marks) AND r.created_at>=? AND r.created_at<?
          GROUP BY r.idsucursal, DATE(r.created_at)",
         'ssi' . $this->types . 'ss',
         array_merge([$this->period['previousStart'], $this->period['endExclusive'], $this->company],
            $this->ids, [$this->period['previousStart'], $this->period['endExclusive']])
      );
   }

   private function expensePage(int $page): array
   {
      if ($page < 1 || $page > 100000) {
         throw new InvalidArgumentException('La página de egresos no es válida.');
      }
      $where = "FROM tbl_contabilidad_detalle c
         JOIN tbl_tipo_contabilidad tc ON tc.idtipo_contabilidad=c.idtipo_contabilidad
         JOIN tbl_sucursal s ON s.idsucursal=c.idsucursal AND s.idglobal=c.idglobal
         WHERE c.idglobal=? AND c.idsucursal IN ($this->marks)
           AND tc.str_operacion='salida' AND c.str_operacion LIKE 'salida%'
           AND c.created_at>=? AND c.created_at<?";
      $dates = [$this->period['start'], $this->period['endExclusive']];
      $count = $this->rows("SELECT COUNT(*) AS total $where", 'ss', $dates);
      $total = (int)$count[0]['total'];
      $pageSize = 50;
      $page = min($page, max(1, (int)ceil($total / $pageSize)));
      $rows = $this->rows(
         "SELECT c.created_at AS date, s.str_codigo AS branch, c.str_nombre AS concept,
            tc.str_categoria AS category, -c.dec_total AS amount,
            CASE WHEN tc.str_categoria='empleado' THEN CONCAT_WS('\n',
               (SELECT GROUP_CONCAT(DISTINCT CONCAT_WS(' ', p.str_nombres, p.str_apellidos)
                  ORDER BY p.str_nombres, p.str_apellidos SEPARATOR ', ')
                FROM tbl_detalle_nomina dn
                JOIN tbl_nomina n ON n.idnomina=dn.idnomina AND n.idglobal=dn.idglobal
                JOIN tbl_empleado e ON e.idempleado=n.idempleado AND e.idglobal=n.idglobal
                JOIN tbl_persona p ON p.idpersona=e.idpersona AND p.idglobal=e.idglobal
                WHERE dn.idcontabilidad_detalle=c.idcontabilidad_detalle AND dn.idglobal=c.idglobal),
               NULLIF(c.str_detalle, '')) ELSE c.str_detalle END AS detail
          $where ORDER BY c.created_at DESC, c.idcontabilidad_detalle DESC LIMIT ? OFFSET ?",
         'ssii', array_merge($dates, [$pageSize, ($page - 1) * $pageSize]));
      foreach ($rows as &$row) {
         $row['amount'] = (float)$row['amount'];
      }
      unset($row);
      return ['rows' => $rows, 'total' => $total, 'page' => $page, 'pageSize' => $pageSize];
   }

   public function expenses(int $page = 1): array
   {
      return $this->snapshot(fn(): array => $this->expensePage($page));
   }

   private function buildReport(): array
   {
      $snapshot = array_fill_keys([
         'caja', 'carteraActiva', 'carteraMorosa', 'carteraRetirada',
         'tarjetasActivas', 'tarjetasMorosas', 'tarjetasRetiradas'
      ], 0);
      $totals = array_merge(resumenIntegralMetricas(), $snapshot);
      $previous = resumenIntegralMetricas();
      $branches = [];
      foreach ($this->selected as $branch) {
         $branches[$branch['id']] = array_merge($branch, $totals);
      }
      $daily = [];
      $last = new DateTimeImmutable($this->period['end']);
      for ($day = new DateTimeImmutable($this->period['start']); $day <= $last; $day = $day->modify('+1 day')) {
         $date = $day->format('Y-m-d');
         $daily[$date] = array_merge(['date' => $date], resumenIntegralMetricas());
      }
      foreach ($this->operations() as $operation) {
         $current = $operation['date'] >= $this->period['start'];
         foreach (resumenIntegralMetricas() as $key => $_) {
            if (in_array($key, ['utilidad', 'utilidadNeta', 'crecimiento'], true)) {
               continue;
            }
            $value = (float)($operation[$key] ?? 0);
            if ($current) {
               $totals[$key] += $value;
               $branches[(int)$operation['id']][$key] += $value;
               $daily[$operation['date']][$key] += $value;
            } else {
               $previous[$key] += $value;
            }
         }
      }
      $cash = $this->rows(
         "SELECT idsucursal AS id, SUM(dec_total) AS caja FROM tbl_contabilidad_detalle
          WHERE idglobal=? AND idsucursal IN ($this->marks) AND idtipo_contabilidad<>8
            AND str_estado<>'created' GROUP BY idsucursal");
      foreach ($cash as $row) {
         $branches[(int)$row['id']]['caja'] = (float)$row['caja'];
         $totals['caja'] += (float)$row['caja'];
      }
      $cards = $this->rows(
         "SELECT idsucursal AS id,
            SUM(CASE WHEN str_estado NOT IN ('moroso','fallecio','discapacitado') THEN dec_resta ELSE 0 END) AS carteraActiva,
            SUM(CASE WHEN str_estado='moroso' THEN dec_resta ELSE 0 END) AS carteraMorosa,
            SUM(CASE WHEN str_estado IN ('fallecio','discapacitado') THEN dec_resta ELSE 0 END) AS carteraRetirada,
            SUM(str_estado NOT IN ('moroso','fallecio','discapacitado')) AS tarjetasActivas,
            SUM(str_estado='moroso') AS tarjetasMorosas,
            SUM(str_estado IN ('fallecio','discapacitado')) AS tarjetasRetiradas
          FROM tbl_tarjetas WHERE idglobal=? AND idsucursal IN ($this->marks)
            AND str_estado NOT IN ('cancelado','inactiva') GROUP BY idsucursal");
      foreach ($cards as $row) {
         foreach ($snapshot as $key => $_) {
            if ($key !== 'caja') {
               $branches[(int)$row['id']][$key] = (float)$row[$key];
               $totals[$key] += (float)$row[$key];
            }
         }
      }
      $expenses = $this->rows(
         "SELECT c.str_nombre AS concept, tc.str_categoria AS category,
            -SUM(c.dec_total) AS amount, COUNT(*) AS count
          FROM tbl_contabilidad_detalle c
          JOIN tbl_tipo_contabilidad tc ON tc.idtipo_contabilidad=c.idtipo_contabilidad
          WHERE c.idglobal=? AND c.idsucursal IN ($this->marks)
            AND tc.str_operacion='salida' AND c.str_operacion LIKE 'salida%'
            AND c.created_at>=? AND c.created_at<?
          GROUP BY c.str_nombre, tc.str_categoria ORDER BY amount DESC, concept, category",
         'ss', [$this->period['start'], $this->period['endExclusive']]);
      foreach ($expenses as &$row) {
         $row['amount'] = (float)$row['amount'];
         $row['count'] = (int)$row['count'];
      }
      unset($row);
      $period = $this->period;
      unset($period['endExclusive']);
      $period['snapshotAt'] = $this->snapshotAt;
      $offices = array_unique(array_column($this->branches, 'office'));
      return [
         'period' => $period,
         'scope' => ['branches' => $this->branches, 'office' => implode(' / ', $offices)],
         'totals' => resumenIntegralCalcular($totals),
         'previous' => resumenIntegralCalcular($previous),
         'branches' => array_values(array_map('resumenIntegralCalcular', $branches)),
         'daily' => array_values(array_map('resumenIntegralCalcular', $daily)),
         'expenses' => $expenses, 'expenseDetails' => $this->expensePage(1)
      ];
   }

   private function snapshot(callable $read): array
   {
      $this->conexion->begin_transaction(MYSQLI_TRANS_START_READ_ONLY | MYSQLI_TRANS_START_WITH_CONSISTENT_SNAPSHOT);
      $this->snapshotAt = date('c');
      try {
         $report = $read();
         $this->conexion->commit();
         return $report;
      } catch (Throwable $error) {
         $this->conexion->rollback();
         throw $error;
      }
   }

   public function report(): array
   {
      return $this->snapshot(fn(): array => $this->buildReport());
   }
}
