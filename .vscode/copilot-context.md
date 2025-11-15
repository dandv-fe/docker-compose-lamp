# WebGoez - Contexto del Proyecto para GitHub Copilot

## Información del Proyecto
- **Tipo**: Aplicación web PHP con arquitectura MVC
- **Framework**: PHP nativo con MySQL
- **Base de datos**: MySQL (websdnco_db_webgoez)
- **Frontend**: HTML, CSS, JavaScript, Bootstrap
- **Patrón**: MVC con separación de responsabilidades

## Estructura del Proyecto
```
/model/          - Clases PHP para lógica de negocio y acceso a datos
/ajax/           - Controladores AJAX para peticiones asíncronas  
/views/          - Vistas HTML y plantillas
/plugins/        - Librerías y plugins de terceros
/scripts/        - Scripts JavaScript personalizados
/subir/          - Directorio para archivos subidos
```

## Convenciones de Código

### PHP
- Indentación: 3 espacios
- Nombres de clases: PascalCase (ej: `ClassCartera`, `Cliente`)
- Nombres de métodos: camelCase (ej: `registrarDetalle`, `listarClientes`)
- Variables: snake_case para BD, camelCase para lógica (ej: `$idcliente`, `$fechaIngreso`)
- Conexión global: `global $conexion;`
- Control de transacciones: `$conexion->autocommit(false);` + `try/catch` + `commit/rollback`

### Base de Datos
- Prefijo tablas: `tbl_`
- Campos ID: `id[tabla]` (ej: `idcliente`, `idempleado`)
- Campos de fecha: `created_at`, `update_at`
- Estados: `str_estado` ('activo', 'inactivo', 'created', etc.)

### JavaScript/AJAX
- jQuery como librería principal
- DataTables para tablas
- Bootstrap para UI
- SweetAlert para alertas

## Clases Principales

### Modelos de Negocio
- `Cliente`: Gestión de clientes y personas
- `ClassCartera`: Manejo de carteras y préstamos
- `Empleado`: Gestión de empleados
- `ClassEmpresas`: Administración de empresas
- `Despachar`: Control de despachos y rutas
- `Sucursal`: Gestión de sucursales

### Utilidades
- `Conexion.php`: Conexión principal a MySQL
- `Usuario.php`: Autenticación y sesiones
- `Consultas.php`: Consultas específicas

## Patrones Comunes

### Estructura de Método Típica
```php
public function metodo($param1, $param2) {
    global $conexion;
    $sw = true;
    $conexion->autocommit(false);
    $dt = date('Y-m-d H:i:s');
    
    try {
        // Lógica del método
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
    
    return $resultado;
}
```

### Validaciones Comunes
- Verificar duplicados antes de insertar
- Validar permisos con `tbl_auth_sucursal`
- Control de estados ('activo', 'inactivo')
- Manejo de sesiones con `$_SESSION`

### Consultas SQL Típicas
- JOINs complejos para obtener datos relacionados
- Subconsultas para cálculos (deudas, totales)
- Uso de IFNULL y COALESCE para valores por defecto
- GROUP BY y agregaciones frecuentes

## Variables de Sesión Importantes
- `$_SESSION['idusuario']`: ID del usuario logueado
- `$_SESSION['userEmpleado']`: ID del empleado
- `$_SESSION['idglobal']`: ID de la empresa/global
- `$_SESSION['MYSESSION_idsucursal']`: ID de sucursal activa

## Campos Recurrentes en Tablas
- `idglobal`: Identificador de empresa
- `str_estado`: Estado del registro
- `created_at`, `update_at`: Timestamps
- `created_empleado_id`: ID del empleado que creó
- Referencias: `idpersona`, `idsucursal`, `idempleado`

## Funcionalidades Principales
1. **Gestión de Clientes**: Registro, edición, consulta de clientes
2. **Cartera**: Préstamos, pagos, seguimiento de deudas
3. **Empleados**: CRUD de empleados, autenticación
4. **Empresas**: Gestión multi-empresa
5. **Sucursales**: Control por sucursales
6. **Reportes**: Consultas y reportes financieros

## Dependencias
- PHP 7.4+
- MySQL 5.7+
- PHPSpreadsheet para Excel
- Bootstrap 4
- jQuery 3.x
- DataTables
- FontAwesome

Este contexto ayudará a GitHub Copilot a generar código más preciso y consistente con los patrones del proyecto.