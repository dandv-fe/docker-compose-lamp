# 📋 Guía de Uso - Formulario de Despido de Empleados

## ✨ Mejoras Visuales Implementadas

### 🎨 Diseño Mejorado

1. **Header con Gradiente**
   - Fondo degradado rojo para destacar la importancia
   - Ícono grande y título en negrita

2. **Tarjeta de Información del Empleado**
   - Callout con fondo azul claro
   - Íconos para cada campo (usuario, cargo, documento)
   - Diseño en 3 columnas

3. **Secciones Organizadas con Cards de Colores**
   - 🔴 **Datos del Despido** - Card roja con outline
   - 🟡 **Autorización** - Card amarilla con outline
   - 🟢 **Liquidación** - Card verde con outline
   - 🔵 **Documentación** - Card azul con outline
   - ⚫ **Observaciones** - Card gris con outline

4. **Campos de Formulario Mejorados**
   - Datepickers con íconos de calendario en colores
   - Input groups con íconos prepend
   - Select grande (form-control-lg) con emojis
   - Textareas con placeholders descriptivos
   - Tooltips y textos de ayuda con íconos

5. **Alerta de Advertencia**
   - Alert amarillo con mensaje de advertencia final
   - Íconos de escudo y advertencia

6. **Footer Mejorado**
   - Fondo gris claro
   - Botones grandes (btn-lg)
   - Botón de cancelar gris
   - Botón de confirmar rojo con sombra

### 🎯 Diálogo de Confirmación Mejorado

**Características:**
- ✅ Título con emoji de advertencia
- ✅ Muestra resumen del empleado (nombre, fecha, tipo de despido)
- ✅ Diseño visual con cajas de información
- ✅ Alerta amarilla con recordatorio importante
- ✅ Botones invertidos (cancelar a la derecha)
- ✅ Botones grandes con íconos
- ✅ Animaciones de entrada/salida
- ✅ Clase personalizada para ancho amplio

### 📊 Notificaciones Mejoradas

**Durante el proceso:**
- 🔄 Loading con barra de progreso animada
- ✅ Éxito con ícono grande de check verde
- ❌ Error con ícono grande de X roja
- ⚠️ Advertencias con ícono de triángulo amarillo

## 🚀 Cómo Usar el Formulario

### Método 1: Desde la Tabla de Empleados

El botón de despido aparece automáticamente en la tabla de empleados para:
- ✅ Empleados con estado **ACTIVO**
- ✅ Empleados que NO sean **Super Administrador**

```html
<!-- El botón se genera automáticamente en EmpleadoAjax.php -->
<button class="btn btn-danger btn-sm" 
        onclick="abrirModalDespido(123, 'Juan Pérez', 'Vendedor', 'CC 12345678')">
    <i class="fas fa-user-slash"></i>
</button>
```

### Método 2: Llamada Manual desde JavaScript

```javascript
// Abrir modal con datos del empleado
abrirModalDespido(
    123,                    // ID del empleado
    'Juan Pérez García',   // Nombre completo
    'Vendedor Senior',     // Cargo
    'CC 12345678'          // Tipo y número de documento
);
```

### Método 3: Desde HTML con data-attributes

```html
<button class="btn btn-danger" 
        data-toggle="modal" 
        data-target="#modal-despido-empleado"
        data-empleado-id="123"
        data-empleado-nombre="Juan Pérez"
        data-empleado-cargo="Vendedor"
        data-empleado-documento="CC 12345678">
    <i class="fas fa-user-slash"></i> Despedir Empleado
</button>
```

## 📝 Campos del Formulario

### Campos Obligatorios (*)
1. **Fecha de Despido** - Con datepicker
2. **Tipo de Despido** - Select con 8 opciones
3. **Motivo del Despido** - Textarea
4. **Estado de Liquidación** - Select
5. **Entrega de Documentos** - Select
6. **Acta Firmada** - Select
7. **Derecho a Recontratación** - Select

### Campos Opcionales
1. Fecha Último Día Trabajado
2. Autorizado Por
3. Cargo de Quien Autoriza
4. Monto de Liquidación
5. Lista de Documentos Entregados
6. Observaciones Adicionales

## 🎨 Estilos CSS Personalizados

```css
.swal-wide - Ancho amplio para SweetAlert (600px)
.shadow-sm - Sombra suave en cards
.callout-info - Callout informativo azul
.bg-gradient-danger - Gradiente rojo en header
```

## 🔔 Flujo de Proceso

1. **Usuario hace clic en botón de despido**
2. **Modal se abre con datos del empleado**
3. **Usuario completa el formulario**
4. **Usuario hace clic en "Confirmar y Registrar Despido"**
5. **Aparece diálogo de confirmación detallado**
6. **Usuario confirma la acción**
7. **Loading con barra de progreso**
8. **Registro exitoso con notificación**
9. **Modal se cierra automáticamente**
10. **Tabla de empleados se recarga**

## 🎭 Características Visuales

- ✨ Animaciones suaves en todos los elementos
- 🎨 Paleta de colores semántica (rojo=peligro, verde=éxito, etc.)
- 📱 Diseño responsive
- 🖱️ Efectos hover en botones e inputs
- 🔍 Focus mejorado en campos
- 📏 Scroll vertical automático si el contenido es muy largo
- 🎯 Íconos FontAwesome en todos los elementos

## 🛡️ Validaciones

- ✅ Validación de empleado seleccionado
- ✅ Validación de campos requeridos por HTML5
- ✅ Confirmación doble antes de procesar
- ✅ Manejo de errores con mensajes visuales
- ✅ Verificación de estado del empleado en servidor

## 📊 Respuestas del Servidor

El servidor retorna JSON:

```json
{
    "status": "success",
    "mensaje": "Despido registrado correctamente"
}
```

o

```json
{
    "status": "error",
    "mensaje": "El empleado ya tiene un registro de despido activo"
}
```

## 🔧 Personalización

Para modificar colores, edita las clases en el `<style>` al final del archivo:
- `bg-gradient-danger` - Color del header
- `.callout-info` - Color de info del empleado
- `.card-danger` - Bordes y colores de cards

---

**Fecha de creación:** 31 de octubre de 2025
**Sistema:** WebGoez
**Módulo:** Gestión de Empleados
