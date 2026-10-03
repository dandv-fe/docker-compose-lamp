Instrucciones para variables privadas (cPanel / servidor)

1) Objetivo
   Guardar credenciales sensibles (BD, R2, API keys) fuera del repositorio y con permisos restringidos.

2) Archivos de configuración
   - `webgoez-db.php`     -> contiene host, user, pass, name (ej. en /home/usuario/config/)
   - `webgoez-r2.php`    -> contiene bucket, access_key_id, secret_access_key, endpoint

   En este repo encontrarás plantillas:
   - `config/webgoez-db.php.example`
   - `config/webgoez-r2.php.example`

3) Pasos recomendados (cPanel)
   a) Conéctate por SSH o usa el administrador de archivos de cPanel.
   b) Crea la carpeta privada (ej: `/home/tu_usuario/config/`) fuera de la carpeta pública `public_html`.
   c) Copia las plantillas aquí y renómbralas sin `.example`:
      - `/home/tu_usuario/config/webgoez-db.php`
      - `/home/tu_usuario/config/webgoez-r2.php`
   d) Edita los valores y guarda.
   e) Establece permisos estrictos:
      - `chmod 600 /home/tu_usuario/config/webgoez-db.php`
      - `chmod 600 /home/tu_usuario/config/webgoez-r2.php`

4) Integración con el proyecto
   `model/Conexion.php` ya busca `webgoez-db.php` en varios paths (HOME/config, docroot parent, etc.).
   Para R2 puedes cargar el archivo con `include` en el lugar donde inicialices `CloudflareR2`:

   $r2cfg = include('/home/tu_usuario/config/webgoez-r2.php');
   $r2 = new CloudflareR2(
       $r2cfg['bucket'],
       $r2cfg['access_key_id'],
       $r2cfg['secret_access_key'],
       $r2cfg['endpoint'],
       $r2cfg['region'] ?? 'auto'
   );

5) Buenas prácticas adicionales
   - No usar el usuario `root` de la BD en producción; crear un usuario con permisos mínimos.
   - Rotar las claves periódicamente.
   - Habilitar logging seguro (sin imprimir credenciales en logs).
   - Proteger el acceso SSH con claves y deshabilitar password login si es posible.

6) Git
   - Asegúrate de que los archivos verdaderos (sin .example) están en `.gitignore`.

7) Permisos y propiedad
   - Los archivos deben ser propiedad del usuario que ejecuta PHP/FPM o del propietario del sitio,
     y con permisos `600` para evitar lectura por otros usuarios.

8) Ejemplo rápido de creación por SSH:

```bash
mkdir -p ~/config
cp config/webgoez-db.php.example ~/config/webgoez-db.php
cp config/webgoez-r2.php.example ~/config/webgoez-r2.php
# Editar con nano/vi y luego:
chmod 600 ~/config/webgoez-db.php ~/config/webgoez-r2.php
```

Fin.
