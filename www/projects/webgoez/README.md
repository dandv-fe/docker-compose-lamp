Para mejorar  la contabilidad de las carteras de prestamos

## Calificación del cliente

En la tarjeta de Cartera, una cinta y un botón **Ver calificación e historial**
presentan la nota del cliente, compartida por todas sus tarjetas:

| Nota | Categoría |
| --- | --- |
| 9–10 | Excelente |
| 7–8 | Bueno |
| 5–6 | Regular |
| 1–4 | Requiere seguimiento |
| Historia insuficiente | 5/10 · Inicial, poca historia |

La evaluación matemática local asigna una nota explicable de 1 a 10. Sin evidencia
suficiente se usa **5/10 como referencia inicial neutral**, no como prueba de buen
cumplimiento. Una evaluación pendiente se identifica explícitamente. Solo el
Super Administrador o el administrador real de la oficina de la tarjeta puede
asignar una nota manual entera de 1 a 10, con motivo obligatorio de 5 a 500 caracteres.
La nota manual tiene prioridad **7 días exactos desde su guardado**; la evaluación
automática continúa por debajo y vuelve a ser la nota vigente al vencer ese plazo.
Los lectores autorizados pueden ver la nota y las últimas 20 evaluaciones.
La nota no cambia automáticamente cupos ni aprobación de créditos.

Los cambios guardan nota anterior, nota nueva, motivo, usuario, sucursal y fecha
UTC y origen manual/automático en el historial compartido con la APK. Se permite reevaluar la misma nota
con otro motivo. La comprobación de concurrencia rechaza un editor desactualizado.
La web valida CSRF, usuario y permisos vigentes; la APK guarda únicamente con
conexión, sin enviar evaluaciones a la cola offline.

Antes de desplegar aplicar manualmente
[`../backend-creditos-apk/migrations/013_customer_rating.sql`](../backend-creditos-apk/migrations/013_customer_rating.sql)
tras las migraciones 001–012, usando una herramienta que soporte `DELIMITER`.
Después aplicar
[`../backend-creditos-apk/migrations/014_customer_rating_automatic.sql`](../backend-creditos-apk/migrations/014_customer_rating_automatic.sql)
antes de desplegar esta versión y arrancar el motor automático del backend.
Esta migración es **distinta** de los índices de Resumen integral en `sql/013`.
Las cintas usan el campo existente `str_calificacion`, y los eventos de sincronización
existentes propagan la nota a las APK. Las tablas nuevas son necesarias para
consultar el historial y guardar evaluaciones.

El motor único del backend evalúa pagos y tarjetas existentes, procesa los cambios
y reevalúa por calendario, incluso sin pagos nuevos. La web lee ese estado compartido:
no duplica la fórmula ni requiere una conexión externa a una IA. El diálogo muestra
nota automática, explicación, evidencia, fecha del último cálculo y vigencia manual.
La cinta distingue una referencia inicial de una nota regular con evidencia.

Pesos iniciales: puntualidad de cuotas **50%**, atraso actual **25%**, constancia
**15%** y carga de cuotas frente a pagos habituales **10%**. Se consideran las
frecuencias de cada tarjeta; los adelantos cubren cuotas futuras. La cantidad de
tarjetas por sí sola no baja la nota. La carga estimada usa pagos observados, no
ingresos declarados ni deudas externas que el sistema desconoce. Véase el
[README del backend](../backend-creditos-apk/README.md) para la fórmula, configuración
y operación del motor. Sin conexión, la APK muestra el último dato sincronizado;
no recalcula por su cuenta ni inventa un historial.

Pruebas locales aisladas:

```sh
docker exec -e RUN_CUSTOMER_RATING_TESTS=1 webgoez-php81 \
  php /var/www/html/projects/webgoez/tests/calificacion-cliente.php
docker exec -w /var/www/html/projects/webgoez webgoez-node \
  node --test tests/calificacion-cliente-ui.cjs
```

## Resumen integral de consultas

**Consultas → Resumen integral** agrega una página independiente en
`resumenIntegral.php`. Cobro Detallado, Egresos, Kardex Valorizado y Rendimientos
conservan sus páginas, consultas y comportamiento.

El Super Administrador consulta las sucursales disponibles de su empresa en
la oficina seleccionada. Un empleado necesita los cuatro permisos
(`cobro detallado`, `egresos`, `kardex valorizado`, `rendimientos`) **en la misma
sucursal**; tenerlos repartidos entre sucursales no da acceso al resumen combinado.
El endpoint verifica usuario, rol, vigencia del servicio, empresa y permisos
actuales en la base, sin confiar en los identificadores enviados por el navegador.
No requiere un permiso nuevo ni cambia los existentes.

Los filtros admiten fechas reales hasta hoy, máximo **366 días**, y todas las
sucursales autorizadas o una de ellas. La comparación usa el período inmediatamente
anterior de igual cantidad de días, no un mes de duración diferente.

- **Movimientos del período**: fecha de apertura de la ruta, como Rendimientos.
  Incluyen rutas aún sin cierre; se muestra su cantidad para advertirlo.
- **Egresos por concepto y detalle**: fecha del movimiento, como Egresos. Incluyen
  préstamos, artículos y traslados, que no se deben sumar otra vez al gasto operativo.
  Los reversos conservan su signo; no se convierten artificialmente en otro gasto.
- **Caja y cartera**: fotografía vigente al consultar, **no** saldo histórico al
  final del rango. Caja excluye categoría 8 y estado `created`. Cartera activa
  excluye canceladas, inactivas, morosas y retiradas. Mora y retiradas se muestran
  separadas. Las inactivas no inflan el capital disponible.
- **Utilidad generada**: valor total de créditos menos costo de préstamos y
  artículos, más adicionales y diferencia, menos descuento. Es margen generado,
  **no ganancia cobrada**. Utilidad neta resta gastos de ruta y otros gastos;
  crecimiento también resta salidas y suma entradas. No equivale a flujo de caja.
- **Capital actual**: caja vigente más cartera activa. Cartera total también
  incluye mora y retiradas. Riesgo indica qué porcentaje de esa cartera está en
  mora o retirada; sin cartera positiva se muestra sin porcentaje calculable.

Los gráficos usan Chart.js local ya incluido en el proyecto. No se instalan
dependencias ni se envían datos a terceros. Sin consultas automáticas repetidas;
los detalles de egresos se paginan de **50 en 50** en servidor, y los agregados
se calculan por conjuntos, no con una consulta por cada sucursal.
La exportación y la impresión identifican alcance y fechas; el detalle de egresos
es paginado, no una descarga implícita de todos los movimientos.

**Antes del despliegue**, aplicar manualmente
[`sql/013_integral_report_indexes.sql`](sql/013_integral_report_indexes.sql)
en la base compartida (MariaDB 10.2+). Es idempotente, agrega índices de lectura
para cartera y egresos, y no cambia datos ni fórmulas de los reportes anteriores.
Ejecutar con poco tráfico y espacio libre: crear índices consume disco y E/S.
La aplicación nunca ejecuta DDL al abrir la página.

Validación local dentro de Docker:

```sh
docker exec -e RUN_INTEGRAL_REPORT_TESTS=1 webgoez-php81 \
  php /var/www/html/projects/webgoez/tests/resumen-integral.php
docker exec -w /var/www/html/projects/webgoez webgoez-node \
  node --test tests/resumen-integral-ui.cjs
```

La prueba utiliza exclusivamente tablas temporales de su conexión: verifica
alcance, separación de empresas/oficinas, permisos coincidentes, fórmulas,
límites de fecha, comparación, saldos vigentes, reversos y paginación.
Las pruebas de interfaz verifican filtros, comparaciones, gráficos derivados,
estados incompletos, agrupación y exportación segura.

## Versiones instaladas de la APK

En el entorno Docker local, el sitio se abre con
`http://projects.localhost/webgoez/instalaciones_apk.php` desde el computador,
o `http://192.168.1.53/webgoez/instalaciones_apk.php` desde la misma red Wi-Fi.
El virtual host HTTP de proyectos tiene esa IP como `ServerAlias`; si cambia
la IP del computador, actualizar `../../../config/vhosts/projects.conf`,
validar con `apache2ctl -t` y recargar Apache. HTTP por Wi-Fi es solo para
pruebas locales, no para producción.
El panel incluye **Descargar APK de prueba** cuando el virtual host activa
`SetEnv WEBGOEZ_LOCAL_APK_DOWNLOAD 1` y existe la compilación debug. El enlace
es relativo al sitio para funcionar tanto por dominio como por IP Wi-Fi.
No activar esta opción en producción; la publicación de producción requiere
una APK firmada y un enlace HTTPS.

**Instalaciones APK** en el menú muestra los últimos reportes (hasta 100):
empleado, identificador aleatorio de instalación, versión y fecha UTC.
El Super Administrador ve su empresa, el administrador de oficina ve los
empleados de sus oficinas y cada usuario puede ver sus propias instalaciones.
No se infiere la versión actual de un teléfono sin conexión ni se recopila IMEI.
Las APK anteriores al control de versiones no reportan: deben actualizarse.

Aplicar manualmente `../backend-creditos-apk/migrations/012_app_installations.sql`
en la base compartida antes del despliegue. La política de actualización se
configura en el backend según su README; este panel muestra versiones reportadas,
no declara un dispositivo actualizado por no tener reportes recientes.

## Nómina por período y resumen personal

En **Mantenimiento → Empleados → Nómina** se configura el sueldo como **Fijo**,
**Porcentaje** o **Combinado**, por separado de la frecuencia **Diaria**,
**Semanal**, **Quincenal** o **Mensual**. Los períodos siguen el calendario
colombiano: semana de lunes a domingo, quincena del 1 al 15 y del 16 al fin
del mes, o mes calendario. La vista personal permite elegir una fecha y muestra
el período que contiene esa fecha.

Las comisiones conservan conceptos separados: capital de créditos y recaudo.
En un acuerdo combinado, el cálculo del sueldo lo realiza el servicio de nómina,
sin duplicar su fórmula en la interfaz: se reconoce el mayor entre el **sueldo
básico acumulado** y la suma de ambas comisiones, más los bonos. El sueldo básico se reconoce
una vez por período, no por despacho, y se prorratea por los días transcurridos
hasta la fecha de corte inclusive. Por ejemplo, un sueldo básico mensual de 3000 en un
mes de 30 días acumula 1000 al día 10. El sueldo pactado completo se muestra
por separado como referencia, no como devengado ni pendiente anticipado.
Las vacaciones se programan en una gestión independiente de **Mantenimiento →
Empleados**, fuera del formulario de sueldo, con inicio, fin y relevo obligatorio
activo y autorizado, distinto del empleado. La observación es opcional.
El empleado conserva su sueldo básico durante el rango, sin nuevas comisiones.
El relevo representa temporalmente al titular en la sucursal y Cartera, recibe
su participación con las tasas del propio relevo y su propio sueldo proporcional
a días calendario, sin duplicarlo por despacho. Guardar vacaciones no guarda ni
modifica el acuerdo salarial.
El acceso operativo del relevo a Cartera dura únicamente las fechas de vacaciones
y respeta sus propios permisos existentes; no otorga administración ni hereda
acciones especiales del titular.

Los bonos manuales se registran exclusivamente desde **Cartera → Gastos**,
para la sucursal seleccionada y un despacho en estado `created`, eligiendo un
empleado autorizado y un monto positivo con motivo. La operación del servidor
registra devengado y pago conjuntamente y descuenta el efectivo de caja, sin
contabilizar dos veces el bono. Tras guardar se actualiza la caja y la información
de nómina. No se registran desde Mantenimiento ni desde una página independiente;
la antigua URL informa que esa gestión fue retirada.
Sólo el Super Administrador o el administrador real de la oficina de la Cartera
pueden gestionar bonos; el cobrador y el relevo no reciben esa autorización.
El máximo es 99.999.999,99 COP, con hasta dos decimales; la fecha la establece
el servidor. La ruta y los permisos se comprueban de nuevo al guardar.

El Super Administrador configura en **Despachar** el reparto
del nuevo despacho: titular único, por igual entre empleados asignados o pesos
personalizados que suman 100%. Puede asignarse a una persona en varias rutas.
Las reglas se guardan como configuración para próximos despachos; al abrirse un
despacho se captura su instantánea y un cambio posterior no recalcula lo ya
abierto. Mientras siga abierto, su aporte se identifica como provisional.
Cada empleado conserva sus tasas de capital y recaudo en el acuerdo individual.

**Acceder → Mi nómina** presenta únicamente el sueldo propio: sueldo básico acumulado y
sueldo pactado completo separados, comisiones
de créditos, comisiones de recaudo, bonos, devengado, pagado, pendiente y
desglose de rutas; un despacho todavía abierto y el total que incluye sus aportes
son provisionales. Devengado y pendiente corresponden al corte, no al período
completo por adelantado. La pestaña
**Sueldo** existente y el registro de gastos de sueldo no se reemplazan.
Sin contrato pactado, el resumen conserva los bonos y pagos registrados,
agrupados por mes, y muestra explícitamente que no hay sueldo configurado.
El desglose presenta capital, recaudo efectivo, participación de la instantánea
y ambas comisiones calculadas por el servidor; los reversos conservan su signo.
Los totales del período no se reconstruyen sumando rutas redondeadas.
El Super Administrador registra contratos y vacaciones desde
**Mantenimiento → Empleados**. Los bonos respetan el alcance de empleados
autorizados para gastos de sueldo en la Cartera seleccionada. La lectura personal y
cada escritura usan el endpoint de nómina con permisos actuales, CSRF y
protección de idempotencia; ocultar un botón no sustituye esa autorización.

### Pagos recibidos y Mi nómina

En la última pestaña **Movimientos** de Inicio, el monto y el tipo visible se
presentan desde la perspectiva de la persona conectada. Un retiro de otra cuenta
que llega a la suya aparece como **Transferencia recibida**, con monto positivo
y su cuenta receptora. El titular de origen sigue viendo retiro negativo.
Un aporte/ajuste financiado por su cuenta aparece como transferencia enviada;
transferencias entre dos cuentas propias muestran efecto personal neto cero.
No se modifica el tipo original, importe almacenado ni cálculo de saldos.
La ficha de **Mis cuentas** utiliza la perspectiva de la cuenta seleccionada:
transferencia recibida positiva en destino y salida negativa en origen. Incluso
entre cuentas propias cada ficha conserva su entrada o salida individual; sólo
la pestaña de movimientos personales muestra el neto cero entre ambas cuentas.
Las etiquetas no reescriben el tipo original (un aporte positivo no es retiro).
**Cuenta principal** y su vista de cuenta corriente aplican las mismas etiquetas
por cuenta: transferencia recibida/enviada, aporte, retiro e interés. La lectura
de cuenta corriente incluye `idahorro_de` para determinar el lado correcto;
no modifica la caducidad de retiros temporales ni los cálculos contables.
**Mi ahorro**, **Corresponsales** y las fichas de **Ahorradores** también muestran
el tipo desde la cuenta consultada, sin convertir intereses en aportes ni
reescribir el movimiento. Mi ahorro respeta el monto firmado por el servidor.
El historial de Ahorradores conserva una fila por cuenta: si ambas pertenecen
a la persona, muestra por separado la salida y la entrada, no el neto personal
de Inicio. Los listados permanecen limitados a la empresa consultada.
**Ahorro programado** utiliza las mismas etiquetas por cuenta: transferencia
recibida positiva, transferencia enviada negativa, aporte, retiro e interés,
sin reescribir el tipo original ni utilizar la etiqueta de la cuenta de origen.

Inicio conserva dos consultas complementarias: **Pagos recibidos** (antes
«Sueldo») consulta el dinero registrado a nombre del empleado entre dos fechas
por concepto y cartera; **Mi nómina** calcula el devengado de su período hasta
el corte según contrato, comisiones y bonos, y lo compara con pagos vinculados
del mismo período. Ninguna consulta crea un desembolso. El básico se acumula
por días; Combinado usa el mayor entre básico y comisiones, más bonos.

El campo «Pagado» incluye todos los gastos vinculados mediante
`tbl_detalle_nomina`, no sólo sueldo: también otros conceptos, por ejemplo
viáticos. Por eso «Pendiente» es una comparación contable, no una certificación
de deuda salarial. El historial conserva sus conceptos separados. El rango
incluye todo el último día y excluye la medianoche del siguiente; fechas
inválidas o invertidas generan error explícito.
Inicio y Empleado inicializan ambos calendarios Desde/Hasta con el mes actual,
permiten fechas escritas en `AAAA-MM-DD` y tienen botón **Consultar pagos**.
Cambiar una fecha actualiza la consulta; un rango inválido no envía una petición
ni cambia silenciosamente la otra fecha. Una respuesta antigua no sobrescribe
la consulta más reciente al modificar rápidamente el rango.

En Empleado se distingue **Pagos recibidos** de **Acuerdo y nómina**.
La configuración no paga automáticamente; los desembolsos siguen registrados
como gastos desde cartera con despacho abierto y beneficiario explícito. Los
bonos manuales también salen de esa caja. Empleados y Despedidos se agrupan
por oficina, con encabezados, orden alfabético y columna de oficina exportable.
Los registros sin oficina tienen grupo propio. Despedidos muestra la oficina
actual del registro del empleado, no una oficina histórica congelada al despido.

### Despacho guiado

Los empleados ven todas las carteras con su permiso propio `despachar`, aunque
la oficina seleccionada en la sesión sea distinta. En **Recibir**, se conserva
el permiso `ver recibir` y el acceso del administrador a su oficina. El filtro
de oficina de la sesión se aplica a estos listados sólo para Super Administradores;
no oculta permisos de empleados ni concede acceso a otras carteras.

La pantalla **Despachar** presenta tarjetas de carteras autorizadas, búsqueda
por nombre u oficina, filtros de estado, resumen y exportación CSV del listado
filtrado. El asistente sigue cuatro pasos: cartera, personas, reparto y retos,
y revisión/confirmación. Los empleados se seleccionan con casillas accesibles.
Las tarjetas muestran oficina y cantidad de empleados operativos asignados.
También muestran sus nombres con inicial mayúscula en cada palabra, sin cambiar
los nombres almacenados. Al preparar el despacho, el equipo de la cartera
(asignados actuales, titular y relevo) aparece primero; luego los demás empleados
de la oficina de la cartera y después las otras oficinas por nombre. Cada grupo
tiene su encabezado y nombres ordenados alfabéticamente; los permisos y la
selección no cambian.
El equipo muestra oficina (o ausencia registrada), titular permanente y relevo
temporal vigente en esa cartera según el servidor. Estas etiquetas no conceden
permisos ni administración. El contexto distingue autorización efectiva
`branch.canDispatch` de escritura `branch.canSaveDispatch`; sólo esta última
habilita edición/confirmación. El servidor vuelve a autorizar la escritura.

Sólo el Super Administrador modifica el reparto de la nueva instantánea.
Los retos individuales permiten al Super Administrador sin requerir
`poner_retos`; el administrador real de la oficina sí debe tener ese permiso
propio en esa misma cartera. La web usa `canSetChallenges` del servidor,
sin inferir autorización por etiquetas de cargo o relevo.
Los demás usuarios conservan el despacho normal y la lectura autorizada,
sin poder editar retos. Las metas incluyen capital, recaudo, fecha límite,
incremento de 0,1 a 40% y descripción opcional de hasta 250 caracteres;
no modifican salarios ni generan bonos. Sin descripción se muestra una
invitación estática predeterminada, sin bloquear el reto.

El servidor calcula sueldo básico hasta la fecha, comisiones, lo necesario para
superar el objetivo y previsión de cuotas. Anticipos y atrasos se muestran
separados: son estimaciones, no garantías de recaudo o ganancias. El sueldo
básico sigue siendo único por período aunque haya varias carteras. La web no
reimplementa fórmulas ni modifica reglas históricas. Las invitaciones se animan
una sola vez por revisión del reto; se respeta movimiento reducido.
**Inicio → Mis retos** presenta únicamente los retos propios y sus avances,
sin necesitar permiso para despachar ni aceptar un identificador de empleado
en la consulta. Comparte las tarjetas de invitación y previsión con el asistente;
no permite editar metas y no promete ganancias ni bonos.
Consume `GET ajax/DespacharAjax.php?action=own` sin filtros. Usa `items` por
`challengeId`, fechas y estado propios, avance neto firmado y porcentajes
calculados por el servidor (pueden ser negativos, superiores al 100% o nulos).
Las comisiones realizadas del período/todas las carteras se muestran una vez
en cada reto, sin sumarlas entre tarjetas. La previsión usa sólo actividad
objetivo restante; si es insuficiente o ya no aplica se conserva el avance sin
mostrar una proyección salarial. El estado de animación se conserva por empleado
y contenido de invitación, sin reanimar al actualizar el avance.

El envío congela el borrador con token idempotente y versión de contexto.
Una ruta o permiso desactualizado exige consultar de nuevo; un resultado
incierto no se reenvía automáticamente. El endpoint revalida permisos y bloqueo.

```sh
docker exec -w /var/www/html/projects/webgoez webgoez-node \
  node --test tests/dispatch-ui.cjs tests/dispatch-controller.cjs tests/my-challenges-ui.cjs
```

El nuevo contrato estructurado de despacho requiere aplicar manualmente
[`../backend-creditos-apk/migrations/017_dispatch_challenges.sql`](../backend-creditos-apk/migrations/017_dispatch_challenges.sql)
después de 016, con el procedimiento de respaldo y mantenimiento del backend.
La UI no aplica migraciones ni modifica datos al abrir el asistente.
La lectura propia requiere además `SELECT` sobre
`view_dispatch_challenge_progress` y `EXECUTE` sobre
`sp_dispatch_challenge_goal`, según el despliegue del backend.
Previsión e Inicio necesitan Node 20+ accesible desde PHP mediante
`DISPATCH_FORECAST_NODE_BINARY` y `proc_open`. Sin motor el endpoint devuelve
503 explícito y la web muestra el error, no un avance ficticio.

Antes del despliegue aplicar manualmente
[`../backend-creditos-apk/migrations/015_employee_payroll.sql`](../backend-creditos-apk/migrations/015_employee_payroll.sql)
en la base compartida, después de las migraciones anteriores. No ejecutar DDL
desde la aplicación ni aplicar la migración sobre datos de producción sin el
respaldo y procedimiento de despliegue correspondientes.
La gestión de relevos y bonos pagados en caja requiere además
[`../backend-creditos-apk/migrations/016_payroll_replacements_cash_bonus.sql`](../backend-creditos-apk/migrations/016_payroll_replacements_cash_bonus.sql),
con MariaDB 10.11 o posterior, antes de habilitar esta versión. Aplicar con
respaldo y escritores detenidos; no reaplicar 015 como sustituto de 016.
La política de acceso temporal del relevo debe confirmarse antes del despliegue:
no debe heredar permisos del titular ni privilegios de administración.

Prueba aislada de validaciones de UI (sin base de negocio):

```sh
docker exec -w /var/www/html/projects/webgoez webgoez-node \
  node --test tests/payroll-ui.cjs
```

## Gastos de sueldo

Al crear un gasto de sueldo se debe seleccionar una nómina activa. Un empleado
solo puede registrar su propio sueldo si está despachado en la ruta abierta.
El Super Administrador puede seleccionar cualquier empleado de su empresa,
y el administrador de oficina puede seleccionar los empleados de esa oficina,
aunque esos empleados no estén despachados. La ruta del gasto debe estar abierta.
La lista y el guardado verifican el mismo alcance; cambiar el identificador
enviado no permite registrar el sueldo de un empleado no autorizado.
El selector agrupa empleados por oficina, muestra primero la oficina de la
sucursal como **Sugeridos**, y luego las demás oficinas por nombre. Dentro de
cada oficina los empleados aparecen alfabéticamente. No selecciona un empleado
automáticamente ni amplía los permisos existentes.

## Teléfonos del cliente en cartera

Al pulsar el teléfono principal se abre una lista de solo lectura con el historial
de la persona, sin números duplicados. El principal sigue mostrándose igual y
las ediciones no borran los teléfonos anteriores registrados por otros usuarios.
Antes del despliegue aplicar manualmente `sql/007_customer_phones.sql` en cada base
usada por PHP (MariaDB 10.2+); consultar [dependencias y pruebas](sql/TELEFONOS_CLIENTE.md).
No se instalan migraciones automáticamente ni se recuperan teléfonos perdidos antes de 007.

El pie de esta lista tiene **Gestionar teléfonos**, que abre un modal separado
para marcar INCORRECTO, restaurar deliberadamente y elegir otro principal válido.
La lista original sigue siendo solo lectura. No se eliminan números; cualquier
usuario autenticado autorizado al cliente/sucursal puede corregir, sin `editar cliente`.
**Selecciona primero otro teléfono principal** antes de marcar el principal actual.
Los INCORRECTOS quedan en historial y no se usan en WhatsApp de la APK ni se cuentan.
Aplicar manualmente 001–008 y después `sql/009_customer_phone_validity.sql`
(idéntica a la migración backend) en la base compartida; se audita el usuario
de sesión y la fecha de la última corrección, no un autor histórico inexistente.

## Caja de bolsillo en cartera

En la cabecera de `cartera.php`, una línea compacta muestra el efectivo esperado:
0 + base + recaudo + otros ingresos (incluidos seguros) - recaudo bancario
- gastos - créditos entregados en efectivo. La línea se desplaza horizontalmente
en pantallas estrechas, sin ocupar varias filas. En **Cuentas**, al final,
el detalle siempre visible agrupa recaudos, créditos, bases, gastos y otros
movimientos por empleado y muestra cuánto fue en efectivo o por banco y
la cuenta bancaria utilizada. Los ajustes informativos no entran en la caja.
Advierte si otro empleado recibió efectivo que todavía debe entregar; los
registros antiguos sin autor se identifican como tales. El recuadro de Recaudo
desglosa cuotas, inicial y cancelaciones cobradas por banco, y muestra los
abonos que quedan en efectivo. Al abrir o volver a totalizar Cuentas se
consultan de nuevo las cifras; tanto la diferencia presentada como la que
verifica el servidor descuentan lo recibido por banco y agregan los créditos
pagados desde el banco. Si no existe ruta abierta o falla la consulta,
no se muestra un importe cero como si fuera una cifra verificada.
Los datos provienen del servidor para la sucursal seleccionada en la sesión;
los permisos para entregar cuentas no cambian.
Al guardar permanentemente la ruta, se contabiliza solo la parte en efectivo
de los recaudos y créditos; los importes bancarios se conservan como información
sin totalizar, sin cambiar registros históricos.
Al crear un crédito se elige efectivo o consignación desde una cuenta autorizada
para la sucursal; se permite consignar todo o parte del costo y se conserva la
cuenta de origen con el desembolso.
Si un artículo lleva cuota inicial, el importe sigue calculando las cuotas y
se debe indicar además si lo recibió en efectivo quien registra la tarjeta o
cuánto entró en una cuenta autorizada. La cuenta receptora es independiente de
la cuenta desde la que se entregó el crédito; el movimiento Inicial conserva
el empleado registrador y solo la parte en efectivo entra en su caja.

### Aviso de caja al crear un préstamo

El formulario muestra un aviso informativo únicamente para tarjetas de tipo
`Prestamo`: si el efectivo disponible es cero o negativo, o si el costo del
préstamo supera ese efectivo. Cuando el costo es igual al efectivo disponible,
no se muestra el aviso por insuficiencia. Las tarjetas de tipo `Articulo` no
usan este aviso.

Si el saldo es desconocido o no se puede consultar, se muestra explícitamente
**Caja no disponible**; no se interpreta como cero ni como fondos suficientes.
El aviso no cambia permisos, no introduce bloqueos ni sustituye las
validaciones existentes del servidor.

Las cuatro pruebas puras cubren caja cero/negativa, insuficiencia e igualdad,
saldo desconocido y exclusión de artículos:

```sh
docker exec -w /var/www/html/projects/webgoez webgoez-node \
  node --test tests/caja-credito-ui.cjs
```

## Autor y origen de abonos en cartera

Antes de desplegar cambios en `model/Cartera.php`, respaldar `tbl_descripcion`
y aplicar manualmente `../backend-creditos-apk/migrations/002_payment_author.sql`
a **cada base usada por la web** (la instalación local utiliza
`websdnco_db_webgoez`, igual que la API de la APK).
La migración añade `idusuario` y `str_origen` sin modificar abonos existentes:
en éstos ambos datos permanecen sin registrar.

Los nuevos abonos, cuotas iniciales y ajustes de cartera web guardan el
`idusuario` de la sesión y origen `web`. La tarjeta muestra el último registro,
su descripción, origen, usuario, estado y que está guardado en el servidor.
Al registrar un abono en Cartera, Enter después del importe pide elegir
explícitamente efectivo o una cuenta receptora antes de confirmar el saldo.
Efectivo sigue disponible aunque no haya cuentas autorizadas; si se elige
banco, el valor bancario vacío indica el abono completo y un valor menor
permite pago mixto. Cada abono nuevo vuelve a pedir el medio de pago.
`created`/`saved` indica el estado del abono, no una sincronización pendiente
del navegador. La web y la API de la APK apuntan localmente a la misma base
`websdnco_db_webgoez`; compruebe `DB_NAME` o la configuración privada si
se despliegan en otro entorno.

El panel "Último registro" clasifica `str_descripcion` como abono, cuota inicial,
descuento, intereses, saldo corregido o cancelación y presenta el resto del
texto como detalle. Solo `Abono` y `c-Inicial` creados por quien está viendo
la tarjeta usan verde cuando `tbl_descripcion.str_estado` es `created`
(`#4b965b`) o `entregando` (`#1f5b2c`); si el autor no coincide o se
desconoce se muestran en gris. El autor se obtiene de la persona vinculada
al usuario y su nombre y apellidos se muestran con iniciales mayúsculas.
Los demás tipos usan otros colores. `saved` significa guardado, no liquidado.

## Autorización para escrituras de cartera

Los controladores de cartera (`CarteraAjax.php`), clientes/comentarios/alertas
(`ClienteAjax.php`) y liquidación (`RecibirCuentasAjax.php`) comprueban en el
servidor la ruta de la empresa y sucursal **antes** de cualquier escritura.
Se autoriza cuando se cumple al menos una condición: el empleado está en
`tbl_empleados_cobrando` para esa ruta, es `tbl_oficina.idempleado_administrador`
de la oficina a la que pertenece la sucursal, o tiene cargo
`Super Administrador`. Las consultas siguen disponibles. Para cartera se exige
la ruta abierta (`created`); las operaciones de liquidación validan la ruta
solicitada en `entregando` cuando corresponde. La ruta válida sigue siendo
necesaria incluso para los administradores, igual que en la API móvil.
El administrador de oficina puede consultar y modificar las sucursales de
**su oficina** sin permisos específicos en `tbl_auth_sucursal`; no recibe acceso
a las sucursales de otras oficinas ni privilegios globales de empresa.
Los rechazos devuelven
`ERROR:` para que los formularios existentes muestren el motivo y no confundan
un rechazo con un guardado exitoso.

## Cupo al crear clientes en cartera web

El botón «Nuevo» busca primero a la persona por documento. Al registrar un
cliente nuevo (también si la persona ya existe), «Máximo cupo que apruebo»
guarda `tbl_clientes.dec_max_credito`: es el límite aprobado para el cliente,
no el importe de una tarjeta. El servidor exige que no supere
`tbl_empleado.dec_max_credito` del empleado de la empresa que lo registra.
Solo el Super Administrador puede aprobar un cupo sin ese límite. El formulario
muestra el máximo del empleado como ayuda, pero la comprobación del servidor
es obligatoria aunque se modifique la petición desde el navegador. La edición
de clientes existentes conserva su flujo y permisos anteriores, pero un aumento
del cupo también respeta el máximo del empleado. Al crear una tarjeta, incluso
si quien la registra puede ampliar el cupo del cliente por permisos de oficina,
la nueva suma de deuda más el capital entregado no puede superar su propio
`tbl_empleado.dec_max_credito`; solo Super Administrador queda exceptuado.
