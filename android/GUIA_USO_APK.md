# Guía de uso de la APK de créditos

Guía editable para personal de cartera. Describe la versión actual de la aplicación Android. Algunas opciones solo aparecen si el usuario tiene permiso o si hay conexión.

> **Para añadir capturas:** guárdalas en una carpeta `capturas/` junto a esta guía y sustituye cada indicación «Captura sugerida» por, por ejemplo, `![Cartera](capturas/cartera.png)`. Usa datos de prueba u oculta nombres, documentos, teléfonos, saldos y cuentas reales. Al terminar puedes exportar este archivo a PDF desde un editor Markdown.

## 1. Primer ingreso y conexión

1. Abre **Configuración del servidor** antes de iniciar sesión. Escribe el dominio o la URL completa de GraphQL y toca **Guardar conexión**. En producción se requiere HTTPS.
2. Con internet, ingresa empresa, usuario y contraseña. El primer acceso siempre necesita conexión.
3. Selecciona la sucursal en la que vas a trabajar. La APK carga la cartera de esa sucursal; al cambiar de sucursal no mezcla sus datos con los de otra.

El dominio solo se puede cambiar tras cerrar sesión. Si el servicio de la empresa está vencido, no se permite usar la cartera, ni siquiera sin internet; regulariza el pago y vuelve a iniciar sesión en línea.

**Captura sugerida:** inicio de sesión y selector de sucursal.

## 2. Trabajar sin internet y sincronizar

Después de un ingreso en línea, puedes desbloquear los datos ya descargados con la biometría o el bloqueo del teléfono. Esto **no renueva** la sesión del servidor. La APK conserva localmente la cartera de la sucursal, los clientes abiertos y las operaciones pendientes.

- Al guardar un movimiento aparece en la **Cola**: verlo en el teléfono no significa que el servidor ya lo aprobó.
- En **Configuración**, activa o desactiva **Sincronización automática**, ajusta su intervalo (mínimo 15 minutos) o toca **Sincronizar ahora**. La sincronización envía la cola y actualiza los cambios de la cartera.
- Si se vence la sesión, inicia sesión de nuevo con internet. Si hay una operación rechazada o en conflicto, revísala en **Cola**: no se corrige sola.
- Antes de cambiar de teléfono, desinstalar o cerrar sesión, comprueba que la cola no tenga pendientes. Cerrar sesión borra los datos locales de esa cuenta; si hay pendientes, la APK pide confirmar su descarte.

El punto de color junto al usuario muestra el estado: verde, conexión y sincronización automática activas; naranja, sesión vencida; rojo, sin conexión o sincronización apagada/pausada. Tócalo para abrir **Configuración**.

**Captura sugerida:** configuración de sincronización y ejemplo de una operación pendiente en Cola.

## 3. Cartera y navegación

La pantalla principal permite buscar tarjetas y clientes guardados. Cada tarjeta muestra cliente, crédito, saldo y estado. Toca una tarjeta **una vez** para señalarla («Aquí vas»); tócala **otra vez** para abrir el abono dentro de la lista.

Arriba verás:

- **Abs**: tarjetas con abonos / tarjetas de la cartera.
- **R**: recaudo de la ruta; **C**: créditos entregados.
- **Caja**: efectivo esperado = base + recaudo en efectivo + otros ingresos − gastos − créditos pagados en efectivo. El dinero recibido o desembolsado por banco se muestra aparte y no se suma al efectivo del bolsillo.
  El resumen encima de **Buscar…** aparece abreviado: **B** (base), **Ef** (recaudo en efectivo), **O** (otros ingresos), **C** (costo de créditos en efectivo), **G** (gastos), **Bco** (banco) y **Abs** (tarjetas con abono). Tócalo para ver los nombres completos en mayúsculas y negrita; otro toque lo vuelve a abreviar.

La barra de progreso muestra el avance de tarjetas con abonos; mientras la app trabaja, indica actividad. Cada tarjeta puede marcarse con la **estrella**: las marcas solo existen en ese teléfono.

Abajo tienes accesos a **Cuentas del día**, **Abonos e historial completo** de la tarjeta señalada, **Cola**, **Tarjetas marcadas**, el número de la tarjeta señalada (regresa a ella) y **Más opciones**. En Más opciones están las búsquedas, creación, gastos, actualización de cartera, cambio de sucursal, configuración y cierre de sesión.

**Captura sugerida:** cartera con una tarjeta señalada, la línea Caja y la barra inferior.

## 4. Registrar un abono

1. En Cartera, toca dos veces la tarjeta. El formulario aparece debajo de sus datos y antes de **Último registro**. También puedes abrir **Abonos e historial completo** y tocar **Registrar pago**.
2. Escribe el **abono** como valor positivo y, en **Confirma cuánto queda restando**, digita el saldo que esperas después de cobrarlo.
3. Si la sucursal tiene cuentas autorizadas, elige **Efectivo** o una cuenta bancaria. Si no las tiene, el pago se registra en efectivo y no aparece el selector. Si parte entró al banco, indica cuánto; si dejas el importe bancario vacío se interpreta como el abono completo. Puedes añadir una referencia.
4. Si ingresó por banco más dinero que el valor del abono, confirma el **vuelto en efectivo** que entregaste. Después toca **Guardar abono**.

La tarjeta y la Cola mostrarán el movimiento pendiente hasta que el servidor lo confirme. Si ya hay un abono abierto sin liquidar en esa tarjeta, no se crea otro: abre el historial para editar el existente cuando todavía esté permitido.

**Captura sugerida:** formulario dentro de la tarjeta y selector de método de pago.

## 5. Último registro e historial completo

**Último registro** resume el movimiento más reciente: tipo, importe, origen, usuario, estado y sincronización. Un movimiento guardado solo en el teléfono no equivale a uno confirmado por el servidor.

En **Abonos e historial completo** ves cada movimiento con importe, fecha, estado y la **resta** correspondiente. Esa resta se reconstruye con los datos guardados en el teléfono. Para corregir o eliminar un abono, abre su movimiento y usa **Editar** o **Eliminar**; solo se permite mientras siga en estado **Creado**. Un movimiento entregado o liquidado ya no se modifica desde aquí.

En esa misma pantalla está **Ubicaciones de cobro**. Toca **Marcar ubicación aquí** estando parado en el punto real, escribe un nombre corto (por ejemplo Casa, Negocio o Trabajo) y acepta el permiso de ubicación. La APK guarda el GPS en el teléfono y lo envía por la cola aunque no haya internet. Si la precisión pasa de 50 m, conviene volver a marcar al aire libre. Cada punto tiene **Cómo llegar**, que abre Google Maps, Waze u otra app compatible; si el teléfono no tiene ninguna, verás un aviso. También puedes **Eliminar** un punto; el borrado se sincroniza igual que los demás cambios.

Al guardar un **abono** o un **crédito**, la APK ofrece **Enviar por WhatsApp** un comprobante para el cliente: abono con fecha y saldo pendiente, o crédito con valor, plazo y cuota aproximada. Puedes corregir el texto antes de enviarlo; WhatsApp se abre con el celular del cliente (se agrega +57 a los celulares de 10 dígitos) y el mensaje solo se envía cuando tú lo confirmas en WhatsApp. Si el número guardado no es válido, WhatsApp te deja elegir el contacto. Esta oferta se puede desactivar en **Configuración > Comprobantes por WhatsApp**.

En los tres puntos de esta pantalla están las acciones de la tarjeta: **Editar crédito**, **Cambiar estado**, **Reordenar**, **Aplicar descuento**, **Agregar interés**, **Actualizar pagos** (con internet) y **Eliminar crédito** (solo si su estado lo permite). Las operaciones se validan en el servidor y pueden requerir permisos.

**Captura sugerida:** historial de movimientos, ubicaciones de cobro y sus acciones.

## 6. Buscar, crear y editar clientes

- En **Más opciones > Crear cliente**, selecciona tipo de documento, escribe el número y consulta con internet. Revisa la persona y sus tarjetas antes de abrirla o crear otra.
- **Crear cliente** sigue la búsqueda: si ya existe, abre su registro en vez de duplicarlo. Si es nuevo, completa los datos y el **máximo cupo que apruebo**; la APK y el servidor verifican el límite autorizado para el empleado.
- En la ficha del cliente puedes **Editar cliente**, **Agregar comentario** o **Crear / editar alerta**. Algunas correcciones avanzadas piden el identificador del registro.

La búsqueda completa y la evaluación previa de una nueva tarjeta requieren conexión. Un cliente creado localmente debe recibir primero su identificador del servidor antes de poder editarlo o usarlo en una nueva tarjeta.

**Captura sugerida:** búsqueda de documento y ficha de cliente.

## 7. Evaluar y crear una tarjeta de crédito

1. Señala en Cartera la tarjeta de referencia («Aquí vas»). Usa **Crear crédito**, **Crear tarjeta para este cliente** o **Crear otra tarjeta a este cliente**.
2. Revisa la evaluación: tarjetas, saldos y movimientos del cliente en la sucursal. Con internet y la consulta completa, toca **Apto** para abrir el formulario. «Apto» no aprueba el crédito por sí solo: el servidor decide al recibirlo.
3. Selecciona **Préstamo** o **Artículo**, el lugar **Antes/Después** de la tarjeta de referencia, el valor total y el costo/capital. Elige expresamente si el dinero salió **en efectivo** o **desde una cuenta bancaria autorizada**; si fue mixto, anota el importe bancario y, si corresponde, la referencia.
4. Elige modo de pago (diario, semanal, quincenal o mensual) y plazo. Comprueba el **valor de la cuota** calculado en pantalla.
5. Para un **artículo**, describe el producto e indica la **cuota inicial**. Si es positiva, elige por separado **quién la recibió**: efectivo a cargo del registrador o cuenta bancaria receptora (total o parcial). La cuenta que recibe la inicial no es necesariamente la que financió el crédito.
6. Para un **préstamo**, completa boleta o seguro solo si la sucursal lo exige. Revisa los valores y guarda.

Se necesitan un cliente con ID del servidor, la evaluación en línea, la tarjeta de referencia y el consecutivo de comprobante de la sucursal. Una tarjeta nueva rechazada permanece como **borrador local no aprobado**: revisa el motivo en Cola; no la vuelvas a crear para intentar corregir el mismo rechazo.

**Captura sugerida:** evaluación, cálculo de cuota y los dos métodos de pago del formulario.

## 8. Gastos y bases

Abre **Más opciones > Gastos y bases**. Selecciona **Gasto** (categoría y concepto disponibles) o **Base recibida**, escribe el valor positivo y, si hace falta, un detalle. Algunos gastos permiten vincular una nómina. Toca **Anotar**.

Funciona sin internet después de haber descargado el catálogo de gastos. Los registros pendientes se ven en la lista y en la Cola. Puedes corregir o borrar los que aún estén habilitados; una vez entregadas las cuentas quedan bloqueados. La base se registra **aquí**, no en el formulario de entrega de cuentas.

**Captura sugerida:** anotación de una base y listado de gastos del día.

## 9. Cuentas del día

Abre el icono de **Cuentas del día** en la barra inferior o desde **Más opciones**. La pantalla muestra base, recaudo, cobros adicionales, créditos, gastos y movimientos por banco para calcular cuánto **debes tener en efectivo**. Los movimientos se agrupan por persona: si otro empleado cobró, comprueba que te haya entregado ese dinero.

1. Cuenta físicamente los **billetes** y **monedas** e ingrésalos en sus campos.
2. Revisa la diferencia: **cuadrado**, **sobra** o **falta**. Si hay diferencia, verifica los movimientos; si decides entregar así, marca la confirmación y esa diferencia quedará registrada.
3. Toca **Entregar cuentas** cuando corresponda. El servidor deja la ruta y sus movimientos en estado **Entregando**. Usa **Volver a totalizar** si hubo cambios antes de enviarlas.

La entrega exige internet, permiso para entregar, ruta abierta y ninguna operación pendiente en la Cola. No hagas una entrega de prueba con datos reales.

**Captura sugerida:** totales, conteo de efectivo y movimientos agrupados por empleado.

## 10. Cola, errores y registros

**Cola** permite distinguir **Esperando envío / Enviando** de **Confirmado**. Si aparece **Rechazado** o **Conflicto**, lee el motivo: puede ser saldo, cupo, permiso, datos cambiados o una ruta que ya se cerró. Las fallas temporales de red se reintentan; los rechazos del servidor requieren una decisión.

Si una tarjeta nueva fue rechazada por cupo o permisos, corrige primero el problema con la oficina y usa **Reintentar esta tarjeta**; si no se aprobará, descarta expresamente el borrador. Si una ruta se cerró, solo puedes reenviar sus operaciones si la oficina reabre el día y la app ofrece esa opción; en otro caso revísalas antes de quitarlas. **Quitar o descartar no envía dinero ni guarda el movimiento en el servidor.**

La pestaña **Logs** conserva avisos recientes para entender errores o descartes. Nunca des por entregado un cobro que todavía figure pendiente o rechazado.

**Captura sugerida:** estados de Cola y pestaña Logs.

## 11. Consultas y personalización

- En **Más opciones**, consulta **Morosos**, **Retirados**, **Canceladas** (por fechas) o **Clientes de cartera** si tienes permiso. Estas listas requieren internet y no se guardan para consulta sin conexión. Restaurar un crédito moroso o retirado solo aparece con el permiso correspondiente.
- En **Configuración**, elige apariencia **Sistema / Claro / Oscuro** y tamaño de texto **Estándar / Grande / Muy grande**. La APK respeta además el tamaño de letra configurado en Android.
- **Tarjetas marcadas** facilita volver a una tarjeta, pero marcarla no registra un abono ni abre su historial.

**Captura sugerida:** menú Más opciones y configuración de apariencia.

## Recordatorio antes de terminar el día

1. Revisa los abonos y gastos pendientes en **Cola** y sincroniza con internet.
2. Comprueba quién tiene el efectivo y qué ingresó por banco.
3. Cuenta billetes y monedas, vuelve a totalizar y solo entonces entrega cuentas.
4. No cierres sesión ni borres la aplicación mientras tengas registros sin confirmar.
