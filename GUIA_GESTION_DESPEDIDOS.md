# 📊 Guía de Gestión de Despedidos - Sistema WebGoez

## 🎯 Características Implementadas

### 📈 Panel de Estadísticas

El sistema muestra 4 tarjetas informativas con métricas clave:

1. **Total Despidos** (Rojo) - Cantidad total de empleados despedidos
2. **Despidos Este Mes** (Amarillo) - Despidos registrados en el mes actual
3. **Liquidaciones Pendientes** (Azul) - Despidos con liquidación pendiente
4. **Documentos Completos** (Verde) - Despidos con documentación completa

### 🔍 Sistema de Filtros Avanzado

**Filtros disponibles:**
- ✅ Tipo de Despido (8 opciones)
- ✅ Estado de Liquidación (Pendiente/No Aplica/Pagada)
- ✅ Rango de Fechas (Desde - Hasta)

**Funcionalidades:**
- Búsqueda en tiempo real
- Limpiar filtros con un clic
- Resultados actualizados automáticamente

### 📋 DataTable de Despedidos

**Columnas mostradas:**
1. # - Número correlativo
2. Empleado - Nombre completo
3. Documento - Tipo y número
4. Cargo - Cargo que desempeñaba
5. Fecha Despido - Fecha efectiva
6. Tipo Despido - Con badge de color según tipo
7. Liquidación - Estado con iconos
8. Estado Docs - Estado de documentación
9. Opciones - Botones de acción

**Características:**
- ✅ Responsive (adaptable a móviles)
- ✅ Búsqueda integrada
- ✅ Ordenamiento por columnas
- ✅ Paginación automática
- ✅ Exportación a Excel, PDF e Impresión
- ✅ Idioma español

### 🎨 Badges de Estado

**Tipo de Despido:**
- 🔴 Despido Justificado - Badge rojo
- 🟠 Despido Injustificado - Badge naranja
- 🟢 Renuncia Voluntaria - Badge verde
- 🔵 Terminación Contrato - Badge azul
- 🟡 Reducción Personal - Badge amarillo
- ⚫ Incapacidad Permanente - Badge gris
- ⚪ Jubilación - Badge claro
- ⚫ Otro - Badge oscuro

**Estado de Liquidación:**
- ⏳ Pendiente - Badge amarillo con reloj
- ❌ No Aplica - Badge gris con X
- ✅ Pagada - Badge verde con check

**Estado de Documentos:**
- ⏳ Pendiente - Badge amarillo con reloj de arena
- 📋 Parcial - Badge azul con tareas
- ✅ Completa - Badge verde con doble check

### 👁️ Modal de Detalles Completo

**Información mostrada:**

#### Panel Izquierdo:
- Foto del empleado
- Nombre completo
- Cargo
- Documento
- Teléfono
- Fecha de ingreso
- Fecha de despido
- Tiempo trabajado (calculado automáticamente)

#### Panel Derecho (4 tarjetas):

1. **Información del Despido** (Rojo)
   - Tipo de despido
   - Último día trabajado
   - Motivo detallado

2. **Autorización** (Amarillo)
   - Autorizado por (nombre)
   - Cargo de quien autoriza

3. **Liquidación** (Verde)
   - Estado de liquidación
   - Monto (formateado con separadores de miles)

4. **Documentación** (Azul)
   - Entrega de documentos
   - Acta firmada (Sí/No/Pendiente)
   - Derecho a recontratación

5. **Observaciones** (Gris)
   - Observaciones generales
   - Lista de documentos entregados

### ✏️ Actualización de Estado

**Función:** Permite actualizar rápidamente:
- Estado de liquidación
- Monto de liquidación
- Estado de documentos

**Proceso:**
1. Clic en botón amarillo "Actualizar Estado"
2. Aparece SweetAlert con formulario
3. Seleccionar nuevos valores
4. Confirmar
5. Actualización automática de la tabla

### 📤 Exportación de Datos

**Formatos disponibles:**
- **Excel** - Para análisis en hojas de cálculo
- **PDF** - Para documentos formales
- **Imprimir** - Para copias físicas

**Botón rápido:** En el header de la tabla o en el botón superior derecho

## 🔧 Funciones JavaScript Principales

### `cargarDespedidos()`
Carga la lista de despedidos aplicando los filtros seleccionados

### `cargarEstadisticas()`
Actualiza las tarjetas de estadísticas

### `verDetalleDespido(id)`
Abre el modal con todos los detalles del despido

### `actualizarEstadoDespido(id)`
Permite actualizar el estado de liquidación y documentos

### Funciones de formato:
- `formatearTipoDespido(tipo)` - Retorna HTML con badge
- `formatearLiquidacion(estado)` - Retorna HTML con badge
- `formatearEstadoDocumentos(estado)` - Retorna HTML con badge

## 📊 Endpoints del API

### `listarDespedidos`
**Método:** POST  
**Parámetros:**
- tipo_despido (opcional)
- liquidacion (opcional)
- fecha_desde (opcional)
- fecha_hasta (opcional)

**Retorna:** Array de despedidos con filtros aplicados

### `obtenerDetalleDespido`
**Método:** POST  
**Parámetros:**
- id (requerido) - ID del despido

**Retorna:** Objeto con todos los detalles del despido

### `estadisticasDespedidos`
**Método:** GET  
**Retorna:** Objeto con estadísticas generales

### `actualizarEstadoDespido`
**Método:** POST  
**Parámetros:**
- id (requerido)
- liquidacion (requerido)
- monto (opcional)
- documentos (requerido)

**Retorna:** Status de la operación

## 🗄️ Modelo de Base de Datos

### Tabla: `tbl_empleado_despido`

**Campos principales:**
- idempleado_despido - ID único
- idglobal - ID de la empresa
- idempleado - ID del empleado
- fecha_despido - Fecha efectiva del despido
- tipo_despido - Enum con tipos
- motivo_despido - Texto del motivo
- autorizado_por - Nombre
- cargo_autoriza - Cargo
- observaciones - Texto
- fecha_ultimo_trabajo - Fecha
- liquidacion_pendiente - Enum (si/no/pagada)
- monto_liquidacion - Decimal
- entrega_documentos - Enum (pendiente/parcial/completa)
- documentos_entregados - Texto
- acta_firmada - Enum (si/no/pendiente)
- derecho_recontratacion - Enum (si/no/condicional)
- str_estado - Estado del registro
- created_empleado_id - Quien registró
- created_at - Fecha creación
- updated_at - Fecha actualización

## 🎨 Diseño Visual

### Colores Semánticos:
- 🔴 Rojo - Peligro/Despido
- 🟡 Amarillo - Advertencia/Pendiente
- 🔵 Azul - Información
- 🟢 Verde - Éxito/Completo
- ⚫ Gris - Neutral/No aplica

### Componentes:
- Cards con outline de colores
- Badges informativos
- Iconos FontAwesome
- Botones con estados hover
- Modal XL para detalles
- SweetAlert2 para confirmaciones

## 💡 Mejores Prácticas

1. **Revisar detalles** antes de actualizar estados
2. **Usar filtros** para búsquedas específicas
3. **Exportar regularmente** para respaldos
4. **Documentar** todas las actualizaciones
5. **Verificar** el cálculo de liquidaciones

## 🔐 Seguridad

- Validación de permisos en servidor
- Limpieza de datos de entrada
- Transacciones para integridad
- Logs de quien registra cambios
- Estado activo/inactivo para soft delete

## 📱 Responsive Design

- Adaptable a tablets y móviles
- DataTable responsive
- Modal ajustable
- Botones táctiles optimizados

## 🚀 Flujo de Uso Típico

1. **Ver estadísticas** generales en tarjetas
2. **Aplicar filtros** si es necesario
3. **Ver listado** en DataTable
4. **Hacer clic en "Ver Detalles"** para información completa
5. **Actualizar estado** si es necesario
6. **Exportar** para reportes

## 📝 Cálculos Automáticos

### Tiempo Trabajado:
El sistema calcula automáticamente:
- Días entre fecha de ingreso y fecha de despido
- Convierte a años, meses y días
- Muestra formato legible: "2 años 3 meses 15 días"

### Formato de Montos:
- Separadores de miles
- Dos decimales
- Símbolo de moneda ($)
- Formato: $1,250,000.00

---

**Sistema:** WebGoez  
**Módulo:** Gestión de Despedidos  
**Versión:** 1.0  
**Fecha:** 31 de octubre de 2025
