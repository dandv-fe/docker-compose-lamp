# Plan de Trabajo - Configuración de Oficinas

## 📋 Descripción

Sistema para configurar qué sucursales pertenecen a una oficina y qué empleados pertenecen a una oficina, utilizando Bootstrap Duallistbox para una interfaz intuitiva.

## 🔧 Instalación y Configuración

### Paso 1: Ejecutar Script SQL (Recomendado)

Para tener funcionalidad completa, ejecuta el script SQL en tu base de datos:

```sql
-- Ejecutar el contenido del archivo: scripts/crear_tabla_oficina.sql
```

Este script:

- ✅ Crea la tabla `tbl_oficina`
- ✅ Agrega campos `idoficina` a `tbl_sucursal` y `tbl_empleado`
- ✅ Crea las relaciones necesarias
- ✅ Inserta oficinas de ejemplo

### Paso 2: Ajustar idglobal

Modifica el script SQL para usar tu `idglobal` correcto:

```sql
-- Cambiar el valor 1 por tu idglobal en las líneas de INSERT
INSERT IGNORE INTO `tbl_oficina` (`idglobal`, `str_nombre`, `str_descripcion`, `str_estado`) VALUES
(TU_IDGLOBAL_AQUI, 'Oficina Principal', 'Oficina central de operaciones', 'activo'),
...
```

## 📁 Archivos del Sistema

### Principales

- `plan_de_trabajo.php` - Controlador principal
- `views/plan_de_trabajo.html` - Vista con interfaz Bootstrap Duallistbox
- `ajax/PlanTrabajoAjax.php` - API para operaciones AJAX

### Auxiliares

- `scripts/crear_tabla_oficina.sql` - Script de instalación de BD
- `README_PlanTrabajo.md` - Este archivo de documentación

## 🎯 Funcionalidades

### ✅ Implementadas

1. **Selección de Oficina**: Dropdown con oficinas filtradas por idglobal
2. **Vista de Disponibilidad**: Solo muestra recursos disponibles (sin asignar) y los ya asignados a la oficina seleccionada
3. **Configuración de Sucursales**: Bootstrap Duallistbox con indicadores de estado
4. **Configuración de Empleados**: Bootstrap Duallistbox con indicadores de estado
5. **Resumen en Tiempo Real**: Muestra contadores de asignados vs disponibles
6. **Estado Visual**: Indicadores claros de qué recursos están disponibles vs asignados
7. **Guardado por Secciones**: Guarda sucursales y empleados por separado
8. **Finalización**: Proceso completo con confirmación
9. **Modo Compatibilidad**: Funciona con o sin tabla tbl_oficina

### 🔄 Modos de Funcionamiento

#### Con tabla tbl_oficina (Recomendado)

- ✅ Oficinas reales desde base de datos
- ✅ Asignaciones persistentes
- ✅ Relaciones con foreign keys
- ✅ Funcionalidad completa

#### Sin tabla tbl_oficina (Modo compatibilidad)

- ⚠️ Oficinas basadas en tipos de sucursales
- ⚠️ Asignaciones simuladas
- ⚠️ Funcionalidad limitada

## 🎨 Interfaz de Usuario

### Diseño

- Tarjetas Bootstrap con gradientes
- Iconos Font Awesome
- Animaciones suaves
- Diseño responsive

### Componentes

- **Bootstrap Duallistbox** con etiquetas en español
- **SweetAlert2** para notificaciones
- **Modal de carga** con spinner
- **Toast notifications** para feedback

## 🔧 Uso del Sistema

### Flujo de Trabajo

1. **Seleccionar Oficina** del dropdown
2. **Ver Estado**: El sistema muestra solo recursos disponibles (sin asignar a ninguna oficina) y los ya asignados a esta oficina
3. **Configurar Sucursales**:
   - **Izquierda**: Sucursales disponibles para asignar
   - **Derecha**: Sucursales ya asignadas a esta oficina
   - Mover entre listas con las flechas
   - Usar filtros de búsqueda
   - Hacer clic en "Guardar Configuración de Sucursales"
4. **Configurar Empleados**:
   - **Izquierda**: Empleados disponibles para asignar
   - **Derecha**: Empleados ya asignados a esta oficina
   - Mover entre listas con las flechas
   - Usar filtros de búsqueda
   - Hacer clic en "Guardar Configuración de Empleados"
5. **Revisar Resumen** con contadores de asignados vs disponibles
6. **Finalizar** haciendo clic en "Finalizar Configuración del Plan de Trabajo"

### Controles Duallistbox

- **Búsqueda**: Campo de filtro en cada lista
- **Mover Seleccionados**: Botones con flechas simples
- **Mover Todos**: Botones con flechas dobles
- **Doble Click**: Mueve elemento individual

## 🛠 Personalización

### Estilos CSS

Los estilos están definidos en la vista y pueden modificarse:

```css
.btn-config {
  background: linear-gradient(45deg, #28a745, #20c997);
  /* Personalizar colores */
}
```

### Etiquetas Duallistbox

Configuración en JavaScript:

```javascript
nonSelectedListLabel: 'Sucursales Disponibles',
selectedListLabel: 'Sucursales Asignadas',
// Modificar según necesidades
```

## 🚨 Troubleshooting

### Error: "Oficinas no cargan"

- ✅ Verificar que existe `idglobal` en sesión
- ✅ Ejecutar script SQL si no hay tabla tbl_oficina
- ✅ Revisar permisos de base de datos

### Error: "Sucursales no aparecen"

- ✅ Verificar que existen sucursales con tu `idglobal`
- ✅ Revisar consulta en `PlanTrabajoAjax.php`

### Error: "Empleados no aparecen"

- ✅ Verificar empleados activos (estado <> 'inactivo')
- ✅ Verificar relación con tabla `tbl_persona`

## 🔮 Mejoras Futuras

### Posibles Extensiones

- [ ] Historial de cambios
- [ ] Notificaciones por email
- [ ] Export/Import de configuraciones
- [ ] Dashboard con estadísticas
- [ ] Asignaciones automáticas por reglas

### Optimizaciones

- [ ] Cache de consultas frecuentes
- [ ] Paginación para listas grandes
- [ ] Búsqueda avanzada con filtros múltiples

## 📞 Soporte

Para dudas o problemas:

1. Revisar logs de errores PHP
2. Verificar consola del navegador
3. Comprobar estructura de base de datos
4. Revisar permisos de usuario

---

**Versión**: 1.0  
**Fecha**: Noviembre 2025
