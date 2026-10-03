Reglas de configuración y estilo para este proyecto (aplicadas por Copilot)

Propósito:
- Mantener coherencia en revisiones rápidas, seguridad y ejecución dentro de Docker.

Reglas principales:
1. Análisis de Entorno:
   - Siempre asumir que la app corre dentro de contenedores Docker.
   - Para conexiones a la base de datos usar el nombre del servicio `database` en lugar de `localhost`.
   - Rutas internas deben ser relativas al contenedor (`/var/www/html/...`) o mapeadas por `docker-compose`.

2. Contexto PHP-SQL:
   - Validar y sanear todas las entradas antes de construir consultas.
   - Usar prepared statements (`prepare` + `bind_param`) para todas las consultas que reciben parámetros.
   - Verificar tipos (int, string) antes de pasarlos a la base de datos.

3. Modularidad:
   - Mantener la lógica de negocio en `model/` (PHP), controladores en `ajax/`, y la vista en `views/`.
   - No mezclar HTML con lógica SQL; generar datos en PHP y renderizar en vistas/JS.

4. Docker-aware best practices:
   - Al referenciar servicios (DB, redis, phpmyadmin) usar nombres de servicio del `docker-compose.yml`.
   - Para linters o comandos `php -l` o `composer` ejecutar dentro del contenedor con `docker exec`.

5. Seguridad y pruebas:
   - Evitar concatenar valores en SQL; si se hace, sanitize con `intval()` o escapes apropiados.
   - Añadir pruebas locales mínimas: `php -l` y llamadas `curl` a endpoints para validar respuestas.

6. Git y persistencia:
   - Guardar estas reglas en el repo (archivo actual) y mantenerlas actualizadas.
   - Antes de push, ejecutar pruebas básicas dentro del contenedor si es posible.

Cómo ejecutar comprobaciones dentro de Docker (ejemplo):

```bash
# listar contenedores
docker ps
# sintaxis PHP dentro del contenedor webserver
docker exec -it ${COMPOSE_PROJECT_NAME}-${PHPVERSION} php -l /var/www/html/projects/webgoez/model/CobroDetallado.php
# probar endpoint
curl -X POST 'http://localhost/projects/webgoez/ajax/CobroDetalladoAjax.php?op=Search' -d 'txtUltimo=false&cbosucursal=1&txtFechaDesde=2026-04-17&txtFechaHasta=2026-04-17'
```

Contacto: Mantén este archivo actualizado si cambias convenciones o el stack.
