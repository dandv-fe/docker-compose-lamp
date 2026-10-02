# Prueba de la API Android en cPanel con MariaDB 10

Este procedimiento es para **una base de pruebas independiente**, alojada en el mismo servidor cPanel que la web, cuyas credenciales están en `/home/USUARIO_CPANEL/config/webgoez-db_dev.php`. Sustituye `USUARIO_CPANEL` y `NOMBRE_BD_PRUEBAS` únicamente después de comprobarlos en el servidor. No ejecuta nada automáticamente: las migraciones SQL se aplican **manualmente** y modifican la base seleccionada. No uses la base de producción ni credenciales reales en capturas, chats o comandos compartidos.

## Estado de esta prueba

- Base seleccionada: `websdnco_dev`, MariaDB `10.11.19-MariaDB-cll-lve`, independiente de la base productiva. El operador confirmó exportación y restauración del respaldo en otra base desechable, y permisos de migración.
- Migraciones **001, 002, 003 y 004 importadas manualmente en phpMyAdmin**. Tras 001 se verificaron tres tablas, dos vistas, 32 triggers, la fila del candado y la comparación de cotejos corregida. Tras 002 se verificaron dos columnas y su índice; tras 003, dos tablas de pagos y cinco columnas bancarias; tras 004, **seis tablas nuevas, dos vistas, 32 triggers y tres columnas bancarias adicionales**.
- No se ejecutó el test de integración ni se crearon pagos o créditos de prueba. Se creó una **aplicación Node independiente** con Node 20.20.2 en modo Production, raíz `apps/backend-creditos-apk-pruebas`, URL `https://api-pruebas.websdn.co/` (sin `/graphql` en la URL de montaje) y entrada `dist/index.js`. Se preparó un ZIP local de 66 KB con `dist/`, `package.json` y `package-lock.json`, sin `.env` ni secretos. **Siguiente fase:** cargarlo en la raíz privada de esa app, instalar dependencias y configurar variables para el clon. No vuelvas a importar las migraciones completas.

## Antes de tocar la base

1. Confirma con cPanel/phpMyAdmin que `webgoez-db_dev.php` apunta a **NOMBRE_BD_PRUEBAS**, un clon aislado, y anota el host y puerto de MariaDB 10. No confundas «servidor de producción» (la máquina) con «base de producción» (los datos reales).
2. Comprueba la versión con `SELECT VERSION(), DATABASE();` **dentro de la base de pruebas**. Las migraciones 002–004 usan `IF NOT EXISTS` de MariaDB (mínimo 10.0.2); la 001 también necesita compatibilidad de vistas y triggers con el esquema legado. No avances si la base seleccionada no es la de pruebas.
3. Confirma que la cuenta que aplicará el SQL tiene `CREATE`, `ALTER`, `INDEX`, `CREATE VIEW`, `TRIGGER` y permisos necesarios sobre la base de pruebas. En cPanel puede hacer falta pedir al proveedor permisos de triggers/vistas. La cuenta que usará la API después debe ser distinta o, al menos, tener **solo los permisos de ejecución necesarios**, no de migración.
4. Revisa en el clon `SHOW CREATE TABLE tbl_banco;` y `SELECT COUNT(*) FROM tbl_banco;`. La migración 003 modifica esta tabla. Si ya tiene cuentas, comprueba sus tipos, números y empresas **sin copiar aquí esos datos**: `idglobal` nuevo empieza en `0` y habría que asociar cada cuenta a su empresa antes de utilizarla. Comprueba también que no hay objetos llamados `mobile_%`, `trg_mobile_%`, `tbl_descripcion_pago`, `tbl_tarjeta_pago` o `tbl_banco_sucursal` creados parcialmente por un intento anterior.
5. Programa la prueba cuando nadie escriba en el clon. Los `ALTER TABLE` pueden bloquear tablas grandes; el DDL de MariaDB hace confirmaciones implícitas y **no se deshace con `ROLLBACK`**.

### Respaldo verificable con phpMyAdmin (tu caso)

1. En cPanel abre **phpMyAdmin**, haz clic en **NOMBRE_BD_PRUEBAS** en la columna izquierda y abre la pestaña **SQL**. Ejecuta `SELECT DATABASE() AS base_seleccionada, VERSION() AS version_mariadb;`. Si el nombre no coincide con el clon, **detente**.
2. En esa base, entra en **Exportar > Personalizado > SQL**. Selecciona **todas** las tablas y vistas, exporta **estructura y datos** y, si tu versión ofrece las opciones, incluye triggers, eventos y rutinas. Descarga el archivo SQL a un lugar privado. Si el tamaño de la base supera los límites de phpMyAdmin, pide al proveedor un respaldo completo: un archivo truncado no sirve para restaurar.
3. Comprueba que el archivo se descargó por completo, que incluye las tablas principales (`tbl_tarjetas`, `tbl_descripcion`, `tbl_banco`) y sus `CREATE TABLE`, y verifica la restauración importándolo en **otra base desechable**, nunca en la de producción. El nombre de esa segunda base debe aparecer en `SELECT DATABASE()`. No publiques ni envíes el volcado: puede incluir datos y contraseñas de usuarios.
4. Si no puedes verificar un respaldo restaurable en una segunda base, **no importes las migraciones todavía**; solicita al alojamiento una copia recuperable de la base de pruebas.

### Alternativa de respaldo por SSH (si te habilitan acceso después)

En SSH, guarda el volcado **fuera de `public_html`**, con permisos privados. `-p` solicita la contraseña interactivamente; nunca la pongas en la línea de comandos. Si no hay SSH o `mysqldump`, exporta desde phpMyAdmin el esquema y los datos **incluidos los triggers y vistas** a un lugar privado.

```sh
mkdir -m 700 -p "$HOME/backups-pruebas"
mysqldump -h HOST_MARIADB -u USUARIO_MIGRACION -p \
  --single-transaction --routines --triggers --events \
  NOMBRE_BD_PRUEBAS > "$HOME/backups-pruebas/antes-api-android.sql"
chmod 600 "$HOME/backups-pruebas/antes-api-android.sql"
test -s "$HOME/backups-pruebas/antes-api-android.sql"
```

Confirma que el volcado no está vacío, contiene el esquema esperado y que puedes **restaurarlo en otra base desechable** antes de seguir. No subas el respaldo al repositorio ni a la carpeta pública. Si la versión del servidor no permite alguna opción de `mysqldump`, consulta con el administrador en lugar de asumir que el respaldo está completo.

## Aplicar las migraciones, en orden

Los archivos están en [`migrations/`](migrations/). Usa un usuario con permisos de migración **solo en el clon**. El comando pide la contraseña de forma interactiva y para ante el primer error; no uses `--force` ni ejecutes todo nuevamente a ciegas si queda una instalación parcial.

| Orden | Archivo | Qué crea o modifica |
| --- | --- | --- |
| 1 | `001_offline_sync.sql` | Tres tablas `mobile_*`, dos vistas de alcance por sucursal y **32 triggers** de cambios. |
| 2 | `002_payment_author.sql` | Autor y origen de abonos en `tbl_descripcion`. |
| 3 | `003_payment_methods.sql` | Datos de `tbl_banco` y vínculos bancarios de abonos/créditos. |
| 4 | `004_bank_holder_branches.sql` | Titular y oficina de cuentas, y autorización por sucursal. Requiere 003. |
| 5 | `005_biometric_credentials.sql` | Credenciales biométricas por dispositivo y retos temporales. |
| 6 | `006_credit_locations.sql` | Ubicaciones GPS de cobro por tarjeta para la APK. |

Desde la carpeta del backend, ejecuta **uno por uno**, revisando el resultado después de cada archivo:

```sh
mysql -h HOST_MARIADB -u USUARIO_MIGRACION -p NOMBRE_BD_PRUEBAS < migrations/001_offline_sync.sql
mysql -h HOST_MARIADB -u USUARIO_MIGRACION -p NOMBRE_BD_PRUEBAS < migrations/002_payment_author.sql
mysql -h HOST_MARIADB -u USUARIO_MIGRACION -p NOMBRE_BD_PRUEBAS < migrations/003_payment_methods.sql
mysql -h HOST_MARIADB -u USUARIO_MIGRACION -p NOMBRE_BD_PRUEBAS < migrations/004_bank_holder_branches.sql
mysql -h HOST_MARIADB -u USUARIO_MIGRACION -p NOMBRE_BD_PRUEBAS < migrations/005_biometric_credentials.sql
mysql -h HOST_MARIADB -u USUARIO_MIGRACION -p NOMBRE_BD_PRUEBAS < migrations/006_credit_locations.sql
```

Las migraciones 005 y 006 deben estar aplicadas antes de publicar una APK/backend que use inicio con huella o ubicaciones de cobro; son idempotentes, pero revísalas igual una por una.

**Alto si falla una instrucción.** La 001 no es reejecutable completa: sus `CREATE VIEW` y `CREATE TRIGGER` no llevan `IF NOT EXISTS`. Revisa cuáles objetos ya se crearon y cuál fue el error; restaura el clon desde el respaldo o solicita ayuda antes de reintentar. En MariaDB 10.11 con phpMyAdmin, la conexión puede usar `utf8mb4_unicode_ci` mientras `mobile_change_event.record_id` usa `utf8mb4_general_ci`; la versión actual de la vista `mobile_customer_branch` establece explícitamente el cotejo de la comparación para evitar el error `#1267`. Cambiar el cotejo predeterminado de la base **no** modifica las columnas ya creadas ni sustituye esta corrección. Los demás archivos tienen instrucciones repetibles, pero tampoco reparan automáticamente cambios parciales ni datos bancarios preexistentes.

Como solo dispones de phpMyAdmin, selecciona **NOMBRE_BD_PRUEBAS** explícitamente y usa **Importar > Seleccionar archivo** para cada `.sql`, **uno por vez** en el orden de la tabla. Después de cada importación verifica que phpMyAdmin informa éxito y repite la consulta `SELECT DATABASE();`. Si aparece un error, copia solo el mensaje y el número de sentencia **sin datos privados**; no pases al siguiente archivo. Comprueba límites de tamaño de subida, permisos y resultados entre importaciones. Si el importador no acepta los triggers/vistas de 001, detente: no omitas objetos ni cambies SQL sin revisarlo.

### Recuperación comprobada del error `#1267` en `websdnco_dev`

En el primer intento de prueba, phpMyAdmin se detuvo en `CREATE VIEW mobile_customer_branch` por la comparación entre la conexión `utf8mb4_unicode_ci` y la columna `mobile_change_event.record_id` con `utf8mb4_general_ci`. **No repitas el archivo original**. La versión corregida de 001 fija el cotejo de esa comparación.

En ese intento se verificaron **tres tablas nuevas**, **ninguna vista**, **un trigger** (`trg_mobile_event_order`), `mobile_operation` y `mobile_change_event` vacías, y solo la fila inicial de `mobile_change_lock`. Si y solo si estos datos **siguen siendo ciertos**, el respaldo del clon está restaurado/verificado y `SELECT DATABASE()` sigue devolviendo `websdnco_dev`, retira exclusivamente los objetos nuevos antes de reimportar la 001 corregida:

```sql
DROP TRIGGER IF EXISTS trg_mobile_event_order;
DROP TABLE IF EXISTS mobile_change_lock;
DROP TABLE IF EXISTS mobile_change_event;
DROP TABLE IF EXISTS mobile_operation;
```

**No borres tablas de negocio ni ejecutes este bloque en otra base.** Si cambian los conteos, aparecen más triggers o alguien empezó a usar la API, detente y revisa el estado con el administrador. Después de retirar estos objetos, comprueba que sus tres conteos son cero y carga la versión **actualizada** de `migrations/001_offline_sync.sql` en phpMyAdmin; el archivo antiguo del primer intento sigue teniendo el problema. Si falla otra sentencia, detente de nuevo y anota el error sin continuar con 002–004.

Tras retirar los objetos de la instalación parcial, una consulta intermedia mostró `0 tablas, 0 vistas, 0 triggers`. Una importación posterior **sí instaló la 001**: se verificaron **3 tablas, 2 vistas, 32 triggers, 1 fila de candado**, y la definición de `mobile_customer_branch` contiene `COLLATE utf8mb4_general_ci`. El mensaje posterior «ya existe el disparador `trg_mobile_event_order`» fue causado por **volver a importar la 001 completa**: no implica que falten objetos. **No vuelvas a importar 001 ni ejecutes el bloque de limpieza anterior** una vez verificada su instalación; procede a 002. Si durante una importación no conoces el estado final, consulta primero `information_schema` en lugar de fiarte únicamente del aviso de phpMyAdmin.

### Verificar sin crear negocios ficticios

Ejecuta estas consultas en **la misma base de pruebas** desde phpMyAdmin o `mysql -p`:

```sql
SELECT DATABASE() AS base_seleccionada, VERSION() AS version_mariadb;
SELECT table_name FROM information_schema.tables
 WHERE table_schema = DATABASE()
   AND table_name IN ('mobile_operation','mobile_change_event','mobile_change_lock',
                      'tbl_descripcion_pago','tbl_tarjeta_pago','tbl_banco_sucursal')
 ORDER BY table_name;
SELECT table_name FROM information_schema.views
 WHERE table_schema = DATABASE()
   AND table_name IN ('mobile_customer_branch','mobile_comment_branch')
 ORDER BY table_name;
SELECT COUNT(*) AS triggers_mobile FROM information_schema.triggers
 WHERE trigger_schema = DATABASE() AND trigger_name LIKE 'trg_mobile_%';
SELECT COUNT(*) AS fila_candado FROM mobile_change_lock WHERE lock_id = 1;
SHOW COLUMNS FROM tbl_descripcion LIKE 'idusuario';
SHOW COLUMNS FROM tbl_descripcion LIKE 'str_origen';
SHOW COLUMNS FROM tbl_banco LIKE 'idglobal';
SHOW COLUMNS FROM tbl_banco LIKE 'str_titular';
SHOW COLUMNS FROM tbl_banco LIKE 'idoficina';
```

Resultado esperado: **seis tablas** listadas, **dos vistas**, **32 triggers**, `fila_candado = 1` y cada columna indicada presente. Confirma que los conteos de las tablas de negocio del respaldo no cambiaron inesperadamente. No hace falta crear un crédito o cerrar cuentas reales para verificar la estructura. El test opcional `npm run test:integration` exige `RUN_DB_INTEGRATION=1` y variables `TEST_DB_*` explícitas: inserta y borra una fila aleatoria en `mobile_operation`; úsalo **solo** en el clon ya migrado y con autorización para hacer esa escritura.

Después de 004, las cuentas bancarias existentes **no quedan autorizadas automáticamente**. Un administrador debe asignarlas a sucursales desde la web de pruebas antes de usarlas en la APK.

## La conexión de la web y la del backend no son automáticas

[`../webgoez/model/Conexion.php`](../webgoez/model/Conexion.php) busca `webgoez-db.php`, **no** `webgoez-db_dev.php`. No basta con que exista el archivo `_dev.php` para que esa web utilice el clon. Si se prueba también la web, hace falta configurar expresamente **una instancia web de pruebas** y comprobar su `SELECT DATABASE()` antes de escribir; no modifiques la web pública para apuntarla al clon ni alteres el archivo privado de producción por esta prueba.

El backend Node **no incluye ni interpreta PHP**. Para que utilice esa misma base independiente, configura en cPanel sus variables de entorno `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_NAME` con los valores correspondientes al clon (sin mostrarlos ni copiarlos al repositorio). La clave PHP `pass` corresponde a `DB_PASSWORD`, y `name` a `DB_NAME`; conviene darle a Node su propia cuenta de MariaDB con permisos adecuados en **esa misma base**, en lugar de compartir la cuenta PHP. [`src/db.ts`](src/db.ts) usa `mysql2`, no el archivo de conexión PHP. No subas `.env`, `node_modules`, respaldos SQL, capturas de credenciales ni archivos de configuración privada.

## Lo siguiente: instalar y exponer la API

No arranques hasta que la migración del clon y sus verificaciones hayan terminado:

1. En esta prueba hay Node.js **20.20.2** disponible. Conserva intacta la aplicación existente bajo `/api`: usa **otra aplicación Node** y un subdominio de pruebas HTTPS. Si cPanel pide «directorio raíz» al crear el subdominio, una ruta como `/home/USUARIO_CPANEL/public_html/api-creditos-pruebas` sirve **solo como raíz pública para la configuración que cPanel genere**; déjala sin código, `.env`, respaldos ni credenciales. Su nombre es una sugerencia, no una ruta que la API deba leer. Configura en *Setup Node.js App* la **ruta de la aplicación** por separado, por ejemplo `/home/USUARIO_CPANEL/apps/backend-creditos-apk-pruebas`, **fuera de `public_html`**, y asigna la URL del subdominio a `/`. Si el alojamiento obliga a colocar el código bajo la raíz pública o no permite asociar la app al subdominio, detente y consulta con el proveedor antes de subir secretos.
2. Comprueba la ruta de aplicación y el archivo de inicio admitidos por ese proveedor: el comando del proyecto es `npm start` y su entrada es `dist/index.js`. Si cPanel no acepta esa entrada ESM, necesitaremos un despliegue alternativo; no basta con copiar los archivos. Asegúrate de que el subdominio tiene certificado TLS válido antes de ingresar credenciales.
3. Sube el backend a esa **carpeta privada**, fuera de `public_html`. Con SSH se instalan dependencias y se compila (`npm ci`, `npm run build`); **sin SSH**, utiliza el paquete ya compilado y el botón **Run NPM Install** descritos abajo. Arranca con `npm start` o configura la entrada que admita cPanel. Define `NODE_ENV=production`, `DB_*`, `JWT_SECRET` aleatorio de **al menos 32 caracteres**, y las variables opcionales `DB_POOL_SIZE`, `FILES_ROOT` y `PORT` según el proveedor. No reutilices una clave de desarrollo.
4. Configura el subdominio HTTPS de pruebas con proxy inverso hacia el proceso Node y establece `TRUST_PROXY` **solo** para la IP o red del proxy TLS real. Restringe el puerto interno para que no sea accesible desde internet. En modo producción, `/graphql` rechaza peticiones si Express no detecta HTTPS; `/health` solo sirve para comprobar que el proceso escucha y **no prueba la conexión a MariaDB**.
5. Prueba desde fuera `https://SUBDOMINIO_PRUEBAS/health` (debe responder `{"status":"ok"}`). Comprueba que `/graphql` por HTTPS llega al backend y que por HTTP no queda accesible sin redirección segura. Haz la primera autenticación y lectura de sucursal **con una cuenta de prueba**, sin publicar usuario/contraseña ni crear créditos o pagos reales.
6. En la APK de depuración abre **Configuración del servidor** antes de iniciar sesión y guarda la URL HTTPS de pruebas terminada en `/graphql`. La app no deja cambiar de servidor con una sesión guardada; primero habría que cerrar sesión, **después de resolver su Cola**. La versión de producción también exige HTTPS.

### Si solo tienes Administrador de archivos (sin SSH)

El paquete ZIP de pruebas preparado junto con esta guía ya incluye el resultado de `npm run build`, así que **no es necesario instalar TypeScript ni compilar en cPanel**. En **Administrador de archivos**, abre la ruta privada `/home/USUARIO_CPANEL/apps/backend-creditos-apk-pruebas`, sube el ZIP y usa **Extraer** en esa misma carpeta. Comprueba que allí están `package.json`, `package-lock.json` y `dist/index.js` (no anidados en otra carpeta adicional). El ZIP no contiene `node_modules` ni credenciales. No lo extraigas bajo `public_html`; si la aplicación Node del panel no encuentra archivos en la raíz privada, detente y corrige su «Application root» antes de continuar.

En la pantalla de la aplicación Node usa **Run NPM Install** para instalar las dependencias de ejecución desde `package.json`/`package-lock.json`. La app ya viene compilada; no pulses *Run JS script* para ejecutar el SQL ni uses `npm run dev`. Configura las variables privadas en el gestor de entorno de cPanel, sin capturas ni mensajes que muestren sus valores. Una vez disponibles las dependencias y las variables, usa **Restart** en la app Node. Si cPanel indica que no admite `dist/index.js` como archivo de inicio o hay un error ESM, no muevas el código a la raíz pública ni cambies a Development para ocultarlo: revisa el log de la aplicación y el mecanismo de arranque del proveedor.

**Punto actual para continuar juntos:** subir el paquete ya compilado a la carpeta privada de la nueva aplicación Node y verificar sus tres entradas (`package.json`, `package-lock.json` y `dist/index.js`) antes de instalar dependencias. No introducir aún credenciales en chat ni conectar la APK a este servidor hasta que la API responda por HTTPS y se haya comprobado que usa `websdnco_dev`.
