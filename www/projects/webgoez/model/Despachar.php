<?php
require_once __DIR__ . '/Conexion.php';
require_once __DIR__ . '/DespachoCore.php';

class Despachar
{
   private DespachoCore $core;

   public function __construct(?mysqli $db = null, ?array $session = null)
   {
      global $conexion;
      $this->core=new DespachoCore($db ?? $conexion,$session ?? ($_SESSION ?? []));
   }

   public function listar(): array { return $this->core->listing(); }
   public function contexto(int $branchId): array { return $this->core->context($branchId); }
   public function guardar(array $data): array { return $this->core->write('save',$data); }
   public function reto(array $data): array { return $this->core->write('challenge',$data); }
   public function estimar(array $data): array { return $this->core->forecast($data); }
   public function propios(): array { return $this->core->own(); }

   public function registrar($idglobal,$idsucursal,$empleados_ids)
   {
      if ((int)$idglobal!==(int)($_SESSION['idglobal'] ?? 0)) throw new RuntimeException('Empresa no autorizada.',403);
      return $this->guardar(['branchId'=>$idsucursal,'expectedRouteId'=>0,'expectedVersion'=>0,
         'employeeIds'=>$empleados_ids,'idempotencyToken'=>$_POST['idempotencyToken'] ?? '']);
   }

   public function modificar($id_detalle_ruta,$empleados_ids)
   {
      return $this->guardar(['branchId'=>$_POST['refSucursal'] ?? null,'expectedRouteId'=>$id_detalle_ruta,
         'expectedVersion'=>$_POST['expectedVersion'] ?? null,'employeeIds'=>$empleados_ids,
         'idempotencyToken'=>$_POST['idempotencyToken'] ?? '']);
   }
}
