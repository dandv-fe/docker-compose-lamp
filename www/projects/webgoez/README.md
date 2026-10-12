Para mejorar  la contabilidad de las carteras de prestamos

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
