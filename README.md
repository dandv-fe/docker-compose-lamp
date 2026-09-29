Para mejorar  la contabilidad de las carteras de prestamos

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
