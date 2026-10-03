# Instrucciones Personalizadas para GitHub Copilot - WebGoez

## Contexto del Proyecto

Este es un proyecto PHP con arquitectura MVC para gestión financiera y cartera de clientes. El sistema maneja empresas, sucursales, empleados, clientes y carteras de préstamos.

## Convenciones de Código PHP

### Estructura General

- Usa indentación de **3 espacios** (no tabs)
- Clases en PascalCase: `ClassCartera`, `Cliente`, `Empleado`
- Métodos en camelCase: `registrarCliente`, `listarEmpleados`
- Variables de BD en snake_case: `$idcliente`, `$created_at`, `$str_estado`
- Variables locales en camelCase: `$fechaIngreso`, `$nombreCompleto`

### Patrones de Conexión y Transacciones

Siempre usa este patrón para métodos que modifican datos:

```php
public function nombreMetodo($parametros) {
   global $conexion;
   $sw = true;
   $conexion->autocommit(false);
   $dt = date('Y-m-d H:i:s');

   try {
      // Lógica del método aquí
      $sql = "...";
      $conexion->query($sql) or throw new Exception('error!');

   } catch (Exception $e) {
      $sw = false;
      $conexion->rollback();
   }

   $conexion->commit();
   if ($conexion != null) {
      $conexion->close();
   }

   $msg = $sw ? "Operación exitosa" : "ERROR: Operación fallida";
   echo $msg;
   return $sw;
}
```

### Convenciones de Base de Datos

- Prefijo tablas: `tbl_` (ej: `tbl_clientes`, `tbl_empleado`)
- Campos ID: `id[tabla]` (ej: `idcliente`, `idempleado`)
- Estados: usar `str_estado` con valores: 'activo', 'inactivo', 'created'
- Timestamps: `created_at`, `update_at` con formato `Y-m-d H:i:s`
- Referencias: usar nombres descriptivos como `created_empleado_id`

### Validaciones Comunes

Siempre incluir estas validaciones cuando corresponda:

1. **Verificar duplicados** antes de insertar:

```php
$sql = "SELECT id FROM tabla WHERE campo='$valor' AND idglobal=$idglobal";
$query = $conexion->query($sql);
if ($query->fetch_object()) {
   echo "ERROR: Ya existe un registro con estos datos";
   return;
}
```

2. **Verificar permisos** con auth_sucursal:

```php
$sql = "SELECT a.str_nombre FROM tbl_auth_sucursal au
        INNER JOIN tbl_auths b ON b.idauth_sucursal=au.idauth_sucursal
        INNER JOIN tbl_auth a ON a.idauth=b.idauth
        WHERE au.str_estado<>'inactivo' AND au.idempleado=$empleado_id
        AND au.idsucursal=$idsucursal";
```

3. **Control de estados** activo/inactivo antes de operaciones importantes

### Consultas SQL Típicas

- Usar `IFNULL()` para valores por defecto en agregaciones
- Subconsultas para cálculos de deudas y totales
- JOINs para obtener datos relacionados con nombres descriptivos
- Siempre filtrar por `idglobal` para multi-empresa

### Variables de Sesión

Usar estas variables según corresponda:

- `$_SESSION['idusuario']`: ID del usuario logueado
- `$_SESSION['idempleado']`: ID del empleado actual
- `$_SESSION['idglobal']`: ID de la empresa
- `$_SESSION['idsucursal']`: Sucursal activa

### Manejo de Errores

- Usar try/catch con `throw new Exception('error!')`
- Mensajes de error descriptivos que empiecen con "ERROR:"
- Mensajes de éxito que terminen con "!Exitosamente!"
- Siempre hacer rollback en caso de error

### Campos Estándar en Nuevas Tablas

Al crear tablas, incluir siempre:

- `idglobal INT`: referencia a empresa
- `str_estado VARCHAR(20) DEFAULT 'activo'`: estado del registro
- `created_at DATETIME`: fecha de creación
- `update_at DATETIME`: fecha de última actualización
- `created_empleado_id INT`: empleado que creó el registro

## Instrucciones Específicas

- Al generar código PHP, seguir exactamente estos patrones
- No uses características de PHP 8+ a menos que se solicite específicamente
- Mantén compatibilidad con MySQL 5.7+
- Usa mysqli como driver de BD, no PDO
- Para fechas usar `date('Y-m-d H:i:s')`
- En consultas complejas, usar alias descriptivos
- Comentar lógica de negocio compleja
- Validar todos los inputs antes de usarlos en SQL
