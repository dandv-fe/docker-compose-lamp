# Historial de teléfonos (solo lectura) y gestión separada

Para la corrección compartida aplicar manualmente **001–008 → 009** antes del
despliegue: `sql/009_customer_phone_validity.sql` es una copia idéntica de la
migración backend. Requiere las tablas/vista de sincronización de 001 además de 007.
009 puede ejecutarse nuevamente; conserva historial, auditoría y triggers de 007.

En cartera, pulsar el teléfono del cliente abre la lista **solo lectura**.
El botón de su pie **Gestionar teléfonos** abre otro modal; la lista original
no tiene controles inline. La gestión permite marcar INCORRECTO, restaurar
deliberadamente o seleccionar otro principal válido, siempre con confirmación.
Para marcar el principal: **«Selecciona primero otro teléfono principal»**.
Si una edición antigua puso un principal ya incorrecto, la gestión muestra una
advertencia clara y WhatsApp de la APK no lo utiliza.

No hay eliminaciones ni restricción al creador: cualquier sesión autenticada
con acceso al cliente/sucursal (misma autorización que lectura) puede corregir,
sin `editar cliente`. La persona se deriva de la tarjeta autorizada; no se confía
en un idpersona o usuario del POST. `validity_changed_by/at` audita la última
corrección, no el autor original. El endpoint separado valida un token CSRF
aleatorio vinculado a la sesión y usa transacciones y bloqueo del principal.
Las marcas se comparten con Android y no cambian al reingresar el número.

Antes de desplegar, respaldar la base y aplicar **manualmente** `sql/007_customer_phones.sql`
en la base que usa webgoez, con un cliente SQL que admita `DELIMITER` y un usuario
con permisos para tablas, índices, funciones, procedimientos y triggers.
Nunca se aplica automáticamente desde PHP ni en producción durante las pruebas.

Este archivo es una copia exacta de `backend-creditos-apk/migrations/007_customer_phones.sql`;
no requiere tener ese repositorio para instalarlo. Mantener ambas copias idénticas.
Requiere MariaDB **10.2+** (múltiples triggers, `CREATE OR REPLACE`, índices condicionales)
y las tablas existentes `tbl_persona`, `tbl_clientes`, `tbl_tarjetas`, `tbl_sucursal`.
En despliegues API/APK respetar el orden 001–006 → 007 → 008. En webgoez
independiente, 007 no referencia tablas de 001–006; 008 no es necesaria para
este modal y sus contadores existentes no se modifican.

La integración compartida solo se verificó cuando PHP y backend utilizan la **misma**
base local `websdnco_db_webgoez` en `webgoez-mariadb10`; no se presume que producción
comparta base. Verificar allí la versión, base y definición completa de tabla/rutinas/triggers
antes de habilitar la funcionalidad. El script se puede reaplicar; conserva las filas
y no elimina los triggers de sincronización con otros nombres.

`tbl_persona.str_telefono` sigue siendo el principal. Los triggers registran OLD y NEW
en cualquier actualización (Cliente, Ahorradores, Empleado, Empresa, UsuarioAjax),
independientemente del autor, sin borrar números anteriores. La clave única normalizada
unifica `300…`, `+57…`, `0057…`; los valores históricos inválidos se conservan
como texto, sin separar ni concatenar supuestos números. Los números perdidos antes
de instalar 007 no se pueden recuperar con este cambio.

El modal consulta la tarjeta seleccionada (`ArrayTarjetas[index].refTarjeta/refSucursal`),
valida sesión y autorización de lectura de la sucursal mediante
`puedeVerDetalleCuentasSucursal`, y deriva la persona dentro de la misma empresa/sucursal.
No requiere `editar cliente`; la lista original no ofrece acciones de creación,
selección ni eliminación. La gestión se encuentra en un modal separado.
Incluye el principal como respaldo, normalizado mediante la función SQL compartida;
si falta el esquema, muestra el error (sin ocultar fallos SQL); con la gestión
instalada se requieren también las columnas de 009.

Pruebas:

```sh
docker exec webgoez-php81 php /var/www/html/projects/webgoez/tests/TelefonosClienteTest.php
# Obtener el hostname directamente del contenedor local; nunca usar un host de producción.
docker exec webgoez-mariadb10 hostname
docker exec webgoez-php81 php /var/www/html/projects/webgoez/tests/TelefonosClienteTest.php --local HOSTNAME_VERIFICADO
docker exec webgoez-node node --check /var/www/html/projects/webgoez/dist/scripts/Cartera.js
docker exec webgoez-node node --test /var/www/html/projects/webgoez/tests/telefonosCliente.test.cjs
```

La prueba local usa solo fixtures reservados, verifica el host/base y revierte
la transacción; no modifica personas de negocio ni aplica migraciones.
