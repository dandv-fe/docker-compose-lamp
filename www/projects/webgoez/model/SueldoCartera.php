<?php

function errorNominaGastoCartera(
   mysqli $conexion, array $sesion, int $idsucursal, int $idtipoContabilidad, $idnomina
): ?string {
   if (empty($idnomina)) {
      return $idtipoContabilidad === 2 ? 'ERROR: Seleccione el empleado del gasto de sueldo.' : null;
   }
   $id = filter_var($idnomina, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
   if ($id === false) {
      return 'ERROR: La nómina elegida no es válida.';
   }
   $nominas = nominasAutorizadasCartera($conexion, $sesion, $idsucursal, $id);
   return $nominas->fetch_object() ? null : 'ERROR: No puede registrar sueldo para este empleado.';
}

function nominasAutorizadasCartera(
   mysqli $conexion, array $sesion, int $idsucursal, ?int $idnomina = null
): mysqli_result {
   $idglobal = (int)($sesion['idglobal'] ?? 0);
   $idempleado = (int)($sesion['idempleado'] ?? 0);
   $parametros = [$idsucursal, $idglobal];
   $tipos = 'ii';
   if ($idglobal > 0 && (int)($sesion['userEmpresa'] ?? 0) === $idglobal) {
      $alcance = '1=1';
   } else {
      $alcance = "(o.idempleado_administrador=? AND e.idoficina=s.idoficina)
         OR (e.idempleado=? AND EXISTS (
            SELECT 1 FROM tbl_detalle_ruta dr
            JOIN tbl_empleados_cobrando ec ON ec.id_detalle_ruta=dr.iddetalleruta
            WHERE dr.idglobal=s.idglobal AND dr.idsucursal=s.idsucursal
              AND dr.str_estado='created' AND ec.idempleado=e.idempleado
         ))";
      $tipos .= 'ii';
      $parametros[] = $idempleado > 0 ? $idempleado : -1;
      $parametros[] = $idempleado > 0 ? $idempleado : -1;
   }
   $filtro = '';
   if ($idnomina !== null) {
      $filtro = ' AND n.idnomina=?';
      $tipos .= 'i';
      $parametros[] = $idnomina;
   }
   $consulta = db_prepare_execute(
      $conexion,
      "SELECT n.idnomina AS refNomina,
              TRIM(CONCAT_WS(' ', p.str_nombres, p.str_apellidos)) AS nombre,
              oe.idoficina AS oficinaId, oe.str_nombre AS oficinaNombre,
              COALESCE(oe.idoficina=s.idoficina, 0) AS sugerida
       FROM tbl_nomina n
       JOIN tbl_empleado e ON e.idempleado=n.idempleado AND e.idglobal=n.idglobal
       JOIN tbl_persona p ON p.idpersona=e.idpersona AND p.idglobal=e.idglobal
       JOIN tbl_sucursal s ON s.idsucursal=? AND s.idglobal=n.idglobal
       LEFT JOIN tbl_oficina o ON o.idoficina=s.idoficina AND o.idglobal=s.idglobal
       LEFT JOIN tbl_oficina oe ON oe.idoficina=e.idoficina AND oe.idglobal=e.idglobal
       WHERE n.idglobal=? AND n.str_estado='activo' AND ($alcance)$filtro
       ORDER BY sugerida DESC, oe.idoficina IS NULL, oficinaNombre, oficinaId, nombre, n.idnomina",
      $tipos, $parametros
   );
   $resultado = $consulta->get_result();
   $consulta->close();
   return $resultado;
}

function opcionesNominasPorOficinaCartera(array $nominas): string
{
   $html = '<option value="">--Seleccione empleado--</option>';
   $grupoActual = null;
   foreach ($nominas as $nomina) {
      $grupo = $nomina['oficinaId'] === null ? 'sin-oficina' : (string)$nomina['oficinaId'];
      if ($grupo !== $grupoActual) {
         if ($grupoActual !== null) {
            $html .= '</optgroup>';
         }
         $nombre = trim((string)($nomina['oficinaNombre'] ?? '')) ?: 'Sin oficina asignada';
         if ((int)$nomina['sugerida'] === 1) {
            $nombre .= ' (Sugeridos: oficina de esta sucursal)';
         }
         $html .= '<optgroup label="' . htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8') . '">';
         $grupoActual = $grupo;
      }
      $html .= '<option value="' . (int)$nomina['refNomina'] . '">'
         . htmlspecialchars($nomina['nombre'], ENT_QUOTES, 'UTF-8') . '</option>';
   }
   if ($grupoActual !== null) {
      $html .= '</optgroup>';
   }
   return $html;
}
