/*
 Script SQL de Actualización, Monitoreo y Auditoría Automática
 Sistema: WebGoez - Sistema de Gestión Empresarial
 Propósito: Implementar sistema completo de auditoría y monitoreo
 Fecha: 31 de octubre de 2025
 Autor: Sistema WebGoez
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ========================================
-- 1. TABLA DE AUDITORÍA GENERAL
-- ========================================

DROP TABLE IF EXISTS `tbl_auditoria_sistema`;
CREATE TABLE `tbl_auditoria_sistema` (
  `idauditoria` bigint NOT NULL AUTO_INCREMENT,
  `idglobal` int UNSIGNED NOT NULL,
  `tabla_afectada` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `id_registro_afectado` varchar(50) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `accion` enum('INSERT', 'UPDATE', 'DELETE', 'SELECT') CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `datos_anteriores` longtext CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `datos_nuevos` longtext CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `usuario_id` int NULL DEFAULT NULL,
  `empleado_id` int NULL DEFAULT NULL,
  `ip_address` varchar(45) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `user_agent` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `sesion_id` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `modulo_sistema` varchar(50) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `descripcion_accion` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `nivel_criticidad` enum('BAJO', 'MEDIO', 'ALTO', 'CRITICO') CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL DEFAULT 'MEDIO',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`idauditoria`) USING BTREE,
  INDEX `idx_tabla_afectada` (`tabla_afectada` ASC) USING BTREE,
  INDEX `idx_accion` (`accion` ASC) USING BTREE,
  INDEX `idx_usuario` (`usuario_id` ASC) USING BTREE,
  INDEX `idx_empleado` (`empleado_id` ASC) USING BTREE,
  INDEX `idx_fecha` (`created_at` ASC) USING BTREE,
  INDEX `idx_global` (`idglobal` ASC) USING BTREE,
  INDEX `idx_criticidad` (`nivel_criticidad` ASC) USING BTREE,
  INDEX `idx_modulo` (`modulo_sistema` ASC) USING BTREE,
  
  CONSTRAINT `fk_auditoria_empleado` 
    FOREIGN KEY (`empleado_id`) 
    REFERENCES `tbl_empleado` (`idempleado`) 
    ON DELETE SET NULL ON UPDATE CASCADE,
    
  CONSTRAINT `fk_auditoria_usuario` 
    FOREIGN KEY (`usuario_id`) 
    REFERENCES `tbl_usuario` (`idusuario`) 
    ON DELETE SET NULL ON UPDATE CASCADE
    
) ENGINE = InnoDB 
AUTO_INCREMENT = 1 
CHARACTER SET = latin1 
COLLATE = latin1_swedish_ci 
ROW_FORMAT = COMPACT
COMMENT = 'Tabla principal de auditoría del sistema';

-- ========================================
-- 2. TABLA DE SESIONES DE USUARIO
-- ========================================

DROP TABLE IF EXISTS `tbl_sesiones_usuario`;
CREATE TABLE `tbl_sesiones_usuario` (
  `idsesion` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `idglobal` int UNSIGNED NOT NULL,
  `usuario_id` int NOT NULL,
  `empleado_id` int NULL DEFAULT NULL,
  `ip_address` varchar(45) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `user_agent` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `fecha_inicio` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_ultimo_acceso` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `fecha_fin` timestamp NULL DEFAULT NULL,
  `estado_sesion` enum('ACTIVA', 'CERRADA', 'EXPIRADA', 'BLOQUEADA') CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL DEFAULT 'ACTIVA',
  `dispositivo_tipo` varchar(50) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `navegador` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `sistema_operativo` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `ubicacion_geografica` varchar(200) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `intentos_fallidos` int NOT NULL DEFAULT 0,
  `modulos_accedidos` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  
  PRIMARY KEY (`idsesion`) USING BTREE,
  INDEX `idx_usuario_sesion` (`usuario_id` ASC) USING BTREE,
  INDEX `idx_empleado_sesion` (`empleado_id` ASC) USING BTREE,
  INDEX `idx_estado_sesion` (`estado_sesion` ASC) USING BTREE,
  INDEX `idx_fecha_inicio` (`fecha_inicio` ASC) USING BTREE,
  INDEX `idx_global_sesion` (`idglobal` ASC) USING BTREE,
  INDEX `idx_ip_address` (`ip_address` ASC) USING BTREE,
  
  CONSTRAINT `fk_sesion_usuario` 
    FOREIGN KEY (`usuario_id`) 
    REFERENCES `tbl_usuario` (`idusuario`) 
    ON DELETE CASCADE ON UPDATE CASCADE,
    
  CONSTRAINT `fk_sesion_empleado` 
    FOREIGN KEY (`empleado_id`) 
    REFERENCES `tbl_empleado` (`idempleado`) 
    ON DELETE CASCADE ON UPDATE CASCADE
    
) ENGINE = InnoDB 
CHARACTER SET = latin1 
COLLATE = latin1_swedish_ci 
ROW_FORMAT = COMPACT
COMMENT = 'Control de sesiones de usuarios del sistema';

-- ========================================
-- 3. TABLA DE MONITOREO DE PERFORMANCE
-- ========================================

DROP TABLE IF EXISTS `tbl_monitoreo_performance`;
CREATE TABLE `tbl_monitoreo_performance` (
  `idmonitoreo` bigint NOT NULL AUTO_INCREMENT,
  `idglobal` int UNSIGNED NOT NULL,
  `tipo_operacion` varchar(50) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `consulta_sql` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `tiempo_ejecucion` decimal(10,4) NOT NULL,
  `memoria_utilizada` bigint NULL DEFAULT NULL,
  `registros_afectados` int NULL DEFAULT NULL,
  `tabla_principal` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `usuario_id` int NULL DEFAULT NULL,
  `empleado_id` int NULL DEFAULT NULL,
  `endpoint_api` varchar(200) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `parametros_entrada` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `codigo_respuesta` varchar(10) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `mensaje_error` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`idmonitoreo`) USING BTREE,
  INDEX `idx_tipo_operacion` (`tipo_operacion` ASC) USING BTREE,
  INDEX `idx_tiempo_ejecucion` (`tiempo_ejecucion` ASC) USING BTREE,
  INDEX `idx_tabla_principal` (`tabla_principal` ASC) USING BTREE,
  INDEX `idx_fecha_monitoreo` (`created_at` ASC) USING BTREE,
  INDEX `idx_global_monitoreo` (`idglobal` ASC) USING BTREE,
  INDEX `idx_usuario_monitoreo` (`usuario_id` ASC) USING BTREE
  
) ENGINE = InnoDB 
AUTO_INCREMENT = 1 
CHARACTER SET = latin1 
COLLATE = latin1_swedish_ci 
ROW_FORMAT = COMPACT
COMMENT = 'Monitoreo de performance del sistema';

-- ========================================
-- 4. TABLA DE ERRORES Y EXCEPCIONES
-- ========================================

DROP TABLE IF EXISTS `tbl_errores_sistema`;
CREATE TABLE `tbl_errores_sistema` (
  `iderror` bigint NOT NULL AUTO_INCREMENT,
  `idglobal` int UNSIGNED NOT NULL,
  `tipo_error` enum('PHP_ERROR', 'SQL_ERROR', 'VALIDATION_ERROR', 'AUTHENTICATION_ERROR', 'AUTHORIZATION_ERROR', 'SYSTEM_ERROR', 'NETWORK_ERROR') CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `codigo_error` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `mensaje_error` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `archivo_origen` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `linea_origen` int NULL DEFAULT NULL,
  `stack_trace` longtext CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `contexto_adicional` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `usuario_id` int NULL DEFAULT NULL,
  `empleado_id` int NULL DEFAULT NULL,
  `sesion_id` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `ip_address` varchar(45) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `url_solicitada` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `metodo_http` varchar(10) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `datos_post` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `estado_resuelto` enum('PENDIENTE', 'EN_PROCESO', 'RESUELTO', 'IGNORADO') CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL DEFAULT 'PENDIENTE',
  `resuelto_por` int NULL DEFAULT NULL,
  `fecha_resolucion` timestamp NULL DEFAULT NULL,
  `notas_resolucion` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`iderror`) USING BTREE,
  INDEX `idx_tipo_error` (`tipo_error` ASC) USING BTREE,
  INDEX `idx_codigo_error` (`codigo_error` ASC) USING BTREE,
  INDEX `idx_estado_resuelto` (`estado_resuelto` ASC) USING BTREE,
  INDEX `idx_fecha_error` (`created_at` ASC) USING BTREE,
  INDEX `idx_global_error` (`idglobal` ASC) USING BTREE,
  INDEX `idx_usuario_error` (`usuario_id` ASC) USING BTREE,
  INDEX `idx_resuelto_por` (`resuelto_por` ASC) USING BTREE
  
) ENGINE = InnoDB 
AUTO_INCREMENT = 1 
CHARACTER SET = latin1 
COLLATE = latin1_swedish_ci 
ROW_FORMAT = COMPACT
COMMENT = 'Registro de errores y excepciones del sistema';

-- ========================================
-- 5. TRIGGERS DE AUDITORÍA AUTOMÁTICA
-- ========================================

-- Trigger para auditoría de empleados
DELIMITER $$

DROP TRIGGER IF EXISTS `tr_empleado_audit_insert`$$
CREATE TRIGGER `tr_empleado_audit_insert`
AFTER INSERT ON `tbl_empleado`
FOR EACH ROW
BEGIN
  INSERT INTO `tbl_auditoria_sistema` (
    `idglobal`, `tabla_afectada`, `id_registro_afectado`, `accion`, 
    `datos_nuevos`, `modulo_sistema`, `descripcion_accion`, `nivel_criticidad`
  ) VALUES (
    NEW.idglobal, 'tbl_empleado', NEW.idempleado, 'INSERT',
    CONCAT('{"idempleado":', NEW.idempleado, ',"idpersona":', NEW.idpersona, ',"cargo":"', NEW.str_cargo, '","estado":"', NEW.str_estado, '","fecha_inicio":"', NEW.date_fecha_inicio, '"}'),
    'EMPLEADOS', 'Nuevo empleado registrado', 'MEDIO'
  );
END$$

DROP TRIGGER IF EXISTS `tr_empleado_audit_update`$$
CREATE TRIGGER `tr_empleado_audit_update`
AFTER UPDATE ON `tbl_empleado`
FOR EACH ROW
BEGIN
  INSERT INTO `tbl_auditoria_sistema` (
    `idglobal`, `tabla_afectada`, `id_registro_afectado`, `accion`, 
    `datos_anteriores`, `datos_nuevos`, `modulo_sistema`, `descripcion_accion`, 
    `nivel_criticidad`
  ) VALUES (
    NEW.idglobal, 'tbl_empleado', NEW.idempleado, 'UPDATE',
    CONCAT('{"estado":"', OLD.str_estado, '","cargo":"', OLD.str_cargo, '","comentarios":"', OLD.str_comentarios, '"}'),
    CONCAT('{"estado":"', NEW.str_estado, '","cargo":"', NEW.str_cargo, '","comentarios":"', NEW.str_comentarios, '"}'),
    'EMPLEADOS', 
    CASE 
      WHEN OLD.str_estado <> NEW.str_estado THEN CONCAT('Cambio de estado de empleado: ', OLD.str_estado, ' -> ', NEW.str_estado)
      WHEN OLD.str_cargo <> NEW.str_cargo THEN CONCAT('Cambio de cargo: ', OLD.str_cargo, ' -> ', NEW.str_cargo)
      ELSE 'Actualización de datos de empleado'
    END,
    CASE 
      WHEN OLD.str_estado = 'activo' AND NEW.str_estado = 'inactivo' THEN 'ALTO'
      ELSE 'MEDIO'
    END
  );
END$$

-- Trigger para auditoría de despidos
DROP TRIGGER IF EXISTS `tr_empleado_despido_audit_insert`$$
CREATE TRIGGER `tr_empleado_despido_audit_insert`
AFTER INSERT ON `tbl_empleado_despido`
FOR EACH ROW
BEGIN
  INSERT INTO `tbl_auditoria_sistema` (
    `idglobal`, `tabla_afectada`, `id_registro_afectado`, `accion`, 
    `datos_nuevos`, `empleado_id`, `modulo_sistema`, `descripcion_accion`, `nivel_criticidad`
  ) VALUES (
    NEW.idglobal, 'tbl_empleado_despido', NEW.idempleado_despido, 'INSERT',
    CONCAT('{"empleado_id":', NEW.idempleado, ',"tipo_despido":"', NEW.tipo_despido, '","fecha_despido":"', NEW.fecha_despido, '","motivo":"', LEFT(NEW.motivo_despido, 100), '..."}'),
    NEW.created_empleado_id, 'EMPLEADOS', 
    CONCAT('Registro de despido - Empleado ID: ', NEW.idempleado, ' - Tipo: ', NEW.tipo_despido), 
    'ALTO'
  );
END$$

-- Trigger para auditoría de usuarios
DROP TRIGGER IF EXISTS `tr_usuario_audit_insert`$$
CREATE TRIGGER `tr_usuario_audit_insert`
AFTER INSERT ON `tbl_usuario`
FOR EACH ROW
BEGIN
  INSERT INTO `tbl_auditoria_sistema` (
    `idglobal`, `tabla_afectada`, `id_registro_afectado`, `accion`, 
    `datos_nuevos`, `modulo_sistema`, `descripcion_accion`, `nivel_criticidad`
  ) VALUES (
    NEW.idglobal, 'tbl_usuario', NEW.idusuario, 'INSERT',
    CONCAT('{"idusuario":', NEW.idusuario, ',"username":"', NEW.str_user_name, '","estado":"', NEW.str_estado, '"}'),
    'USUARIOS', 'Nuevo usuario registrado', 'MEDIO'
  );
END$$

DROP TRIGGER IF EXISTS `tr_usuario_audit_update`$$
CREATE TRIGGER `tr_usuario_audit_update`
AFTER UPDATE ON `tbl_usuario`
FOR EACH ROW
BEGIN
  INSERT INTO `tbl_auditoria_sistema` (
    `idglobal`, `tabla_afectada`, `id_registro_afectado`, `accion`, 
    `datos_anteriores`, `datos_nuevos`, `usuario_id`, `modulo_sistema`, `descripcion_accion`, 
    `nivel_criticidad`
  ) VALUES (
    NEW.idglobal, 'tbl_usuario', NEW.idusuario, 'UPDATE',
    CONCAT('{"estado":"', OLD.str_estado, '","password_changed":', IF(OLD.str_password <> NEW.str_password, 'true', 'false'), '}'),
    CONCAT('{"estado":"', NEW.str_estado, '","password_changed":', IF(OLD.str_password <> NEW.str_password, 'true', 'false'), '}'),
    NEW.idusuario, 'USUARIOS', 
    CASE 
      WHEN OLD.str_password <> NEW.str_password THEN 'Cambio de contraseña'
      WHEN OLD.str_estado <> NEW.str_estado THEN CONCAT('Cambio de estado: ', OLD.str_estado, ' -> ', NEW.str_estado)
      ELSE 'Actualización de usuario'
    END,
    CASE 
      WHEN OLD.str_password <> NEW.str_password THEN 'ALTO'
      WHEN OLD.str_estado <> NEW.str_estado THEN 'MEDIO'
      ELSE 'BAJO'
    END
  );
END$$

-- Trigger para auditoría de contabilidad
DROP TRIGGER IF EXISTS `tr_contabilidad_audit_insert`$$
CREATE TRIGGER `tr_contabilidad_audit_insert`
AFTER INSERT ON `tbl_contabilidad_detalle`
FOR EACH ROW
BEGIN
  INSERT INTO `tbl_auditoria_sistema` (
    `idglobal`, `tabla_afectada`, `id_registro_afectado`, `accion`, 
    `datos_nuevos`, `empleado_id`, `modulo_sistema`, `descripcion_accion`, 
    `nivel_criticidad`
  ) VALUES (
    NEW.idglobal, 'tbl_contabilidad_detalle', NEW.idcontabilidad_detalle, 'INSERT',
    CONCAT('{"valor":', NEW.dec_total, ',"operacion":"', NEW.str_operacion, '","detalle":"', NEW.str_detalle, '"}'),
    NEW.created_empleado_id, 'CONTABILIDAD', 
    CONCAT('Movimiento contable: ', NEW.str_nombre, ' por valor: ', NEW.dec_total),
    CASE 
      WHEN NEW.dec_total > 1000000 THEN 'ALTO'
      WHEN NEW.dec_total > 100000 THEN 'MEDIO'
      ELSE 'BAJO'
    END
  );
END$$

DELIMITER ;

-- ========================================
-- 6. PROCEDIMIENTOS DE MONITOREO
-- ========================================

DELIMITER $$

-- Procedimiento para registrar performance
DROP PROCEDURE IF EXISTS `sp_registrar_performance`$$
CREATE PROCEDURE `sp_registrar_performance`(
  IN p_idglobal INT,
  IN p_tipo_operacion VARCHAR(50),
  IN p_consulta_sql TEXT,
  IN p_tiempo_ejecucion DECIMAL(10,4),
  IN p_memoria_utilizada BIGINT,
  IN p_registros_afectados INT,
  IN p_tabla_principal VARCHAR(100),
  IN p_usuario_id INT,
  IN p_empleado_id INT,
  IN p_endpoint_api VARCHAR(200)
)
BEGIN
  INSERT INTO `tbl_monitoreo_performance` (
    `idglobal`, `tipo_operacion`, `consulta_sql`, `tiempo_ejecucion`,
    `memoria_utilizada`, `registros_afectados`, `tabla_principal`,
    `usuario_id`, `empleado_id`, `endpoint_api`
  ) VALUES (
    p_idglobal, p_tipo_operacion, p_consulta_sql, p_tiempo_ejecucion,
    p_memoria_utilizada, p_registros_afectados, p_tabla_principal,
    p_usuario_id, p_empleado_id, p_endpoint_api
  );
END$$

-- Procedimiento para registrar errores
DROP PROCEDURE IF EXISTS `sp_registrar_error`$$
CREATE PROCEDURE `sp_registrar_error`(
  IN p_idglobal INT,
  IN p_tipo_error VARCHAR(50),
  IN p_codigo_error VARCHAR(20),
  IN p_mensaje_error TEXT,
  IN p_archivo_origen VARCHAR(255),
  IN p_linea_origen INT,
  IN p_stack_trace LONGTEXT,
  IN p_usuario_id INT,
  IN p_empleado_id INT,
  IN p_sesion_id VARCHAR(100),
  IN p_ip_address VARCHAR(45),
  IN p_url_solicitada TEXT
)
BEGIN
  INSERT INTO `tbl_errores_sistema` (
    `idglobal`, `tipo_error`, `codigo_error`, `mensaje_error`,
    `archivo_origen`, `linea_origen`, `stack_trace`, `usuario_id`,
    `empleado_id`, `sesion_id`, `ip_address`, `url_solicitada`
  ) VALUES (
    p_idglobal, p_tipo_error, p_codigo_error, p_mensaje_error,
    p_archivo_origen, p_linea_origen, p_stack_trace, p_usuario_id,
    p_empleado_id, p_sesion_id, p_ip_address, p_url_solicitada
  );
END$$

-- Procedimiento para iniciar sesión
DROP PROCEDURE IF EXISTS `sp_iniciar_sesion`$$
CREATE PROCEDURE `sp_iniciar_sesion`(
  IN p_sesion_id VARCHAR(100),
  IN p_idglobal INT,
  IN p_usuario_id INT,
  IN p_empleado_id INT,
  IN p_ip_address VARCHAR(45),
  IN p_user_agent TEXT,
  IN p_dispositivo_tipo VARCHAR(50),
  IN p_navegador VARCHAR(100),
  IN p_sistema_operativo VARCHAR(100)
)
BEGIN
  -- Cerrar sesiones anteriores del mismo usuario
  UPDATE `tbl_sesiones_usuario` 
  SET `estado_sesion` = 'CERRADA', `fecha_fin` = NOW()
  WHERE `usuario_id` = p_usuario_id AND `estado_sesion` = 'ACTIVA';
  
  -- Crear nueva sesión
  INSERT INTO `tbl_sesiones_usuario` (
    `idsesion`, `idglobal`, `usuario_id`, `empleado_id`, `ip_address`,
    `user_agent`, `dispositivo_tipo`, `navegador`, `sistema_operativo`
  ) VALUES (
    p_sesion_id, p_idglobal, p_usuario_id, p_empleado_id, p_ip_address,
    p_user_agent, p_dispositivo_tipo, p_navegador, p_sistema_operativo
  );
  
  -- Registrar en auditoría
  INSERT INTO `tbl_auditoria_sistema` (
    `idglobal`, `tabla_afectada`, `id_registro_afectado`, `accion`,
    `usuario_id`, `empleado_id`, `ip_address`, `sesion_id`,
    `modulo_sistema`, `descripcion_accion`, `nivel_criticidad`
  ) VALUES (
    p_idglobal, 'tbl_sesiones_usuario', p_usuario_id, 'INSERT',
    p_usuario_id, p_empleado_id, p_ip_address, p_sesion_id,
    'AUTENTICACION', 'Inicio de sesión', 'BAJO'
  );
END$$

DELIMITER ;

-- ========================================
-- 7. VISTAS DE MONITOREO Y REPORTING
-- ========================================

-- Vista de resumen de auditoría
DROP VIEW IF EXISTS `view_auditoria_resumen`;
CREATE VIEW `view_auditoria_resumen` AS
SELECT 
  a.idglobal,
  a.tabla_afectada,
  a.accion,
  a.nivel_criticidad,
  COUNT(*) as total_operaciones,
  DATE(a.created_at) as fecha,
  MIN(a.created_at) as primera_operacion,
  MAX(a.created_at) as ultima_operacion,
  COUNT(DISTINCT a.usuario_id) as usuarios_involucrados,
  COUNT(DISTINCT a.empleado_id) as empleados_involucrados
FROM `tbl_auditoria_sistema` a
GROUP BY a.idglobal, a.tabla_afectada, a.accion, a.nivel_criticidad, DATE(a.created_at)
ORDER BY a.created_at DESC;

-- Vista de sesiones activas
DROP VIEW IF EXISTS `view_sesiones_activas`;
CREATE VIEW `view_sesiones_activas` AS
SELECT 
  s.idsesion,
  s.idglobal,
  s.usuario_id,
  s.empleado_id,
  CONCAT(p.str_nombres, ' ', p.str_apellidos) as nombre_usuario,
  u.str_user_name as username,
  s.ip_address,
  s.fecha_inicio,
  s.fecha_ultimo_acceso,
  TIMESTAMPDIFF(MINUTE, s.fecha_ultimo_acceso, NOW()) as minutos_inactivo,
  s.dispositivo_tipo,
  s.navegador,
  s.sistema_operativo,
  s.intentos_fallidos
FROM `tbl_sesiones_usuario` s
INNER JOIN `tbl_usuario` u ON u.idusuario = s.usuario_id
LEFT JOIN `tbl_empleado` e ON e.idempleado = s.empleado_id
LEFT JOIN `tbl_persona` p ON p.idpersona = e.idpersona
WHERE s.estado_sesion = 'ACTIVA'
ORDER BY s.fecha_ultimo_acceso DESC;

-- Vista de errores críticos
DROP VIEW IF EXISTS `view_errores_criticos`;
CREATE VIEW `view_errores_criticos` AS
SELECT 
  e.iderror,
  e.idglobal,
  e.tipo_error,
  e.codigo_error,
  e.mensaje_error,
  e.archivo_origen,
  e.usuario_id,
  e.empleado_id,
  CONCAT(p.str_nombres, ' ', p.str_apellidos) as usuario_afectado,
  e.ip_address,
  e.estado_resuelto,
  e.created_at,
  TIMESTAMPDIFF(HOUR, e.created_at, NOW()) as horas_sin_resolver
FROM `tbl_errores_sistema` e
LEFT JOIN `tbl_usuario` u ON u.idusuario = e.usuario_id
LEFT JOIN `tbl_empleado` emp ON emp.idempleado = e.empleado_id
LEFT JOIN `tbl_persona` p ON p.idpersona = emp.idpersona
WHERE e.estado_resuelto IN ('PENDIENTE', 'EN_PROCESO')
ORDER BY e.created_at DESC;

-- Vista de performance lenta
DROP VIEW IF EXISTS `view_performance_lenta`;
CREATE VIEW `view_performance_lenta` AS
SELECT 
  m.idmonitoreo,
  m.idglobal,
  m.tipo_operacion,
  m.tabla_principal,
  m.tiempo_ejecucion,
  m.memoria_utilizada,
  m.registros_afectados,
  m.usuario_id,
  m.empleado_id,
  CONCAT(p.str_nombres, ' ', p.str_apellidos) as usuario,
  m.endpoint_api,
  m.created_at
FROM `tbl_monitoreo_performance` m
LEFT JOIN `tbl_usuario` u ON u.idusuario = m.usuario_id
LEFT JOIN `tbl_empleado` e ON e.idempleado = m.empleado_id
LEFT JOIN `tbl_persona` p ON p.idpersona = e.idpersona
WHERE m.tiempo_ejecucion > 5.0000 -- Operaciones que toman más de 5 segundos
ORDER BY m.tiempo_ejecucion DESC;

-- ========================================
-- 8. FUNCIONES DE ESTADÍSTICAS
-- ========================================

DELIMITER $$

-- Función para obtener estadísticas de auditoría
DROP FUNCTION IF EXISTS `fn_estadisticas_auditoria`$$
CREATE FUNCTION `fn_estadisticas_auditoria`(
  p_idglobal INT,
  p_tipo_estadistica VARCHAR(30),
  p_fecha_inicio DATE,
  p_fecha_fin DATE
) RETURNS INT
READS SQL DATA
DETERMINISTIC
BEGIN
  DECLARE v_resultado INT DEFAULT 0;
  
  CASE p_tipo_estadistica
    WHEN 'total_operaciones' THEN
      SELECT COUNT(*) INTO v_resultado
      FROM tbl_auditoria_sistema 
      WHERE idglobal = p_idglobal 
        AND DATE(created_at) BETWEEN p_fecha_inicio AND p_fecha_fin;
        
    WHEN 'operaciones_criticas' THEN
      SELECT COUNT(*) INTO v_resultado
      FROM tbl_auditoria_sistema 
      WHERE idglobal = p_idglobal 
        AND nivel_criticidad IN ('ALTO', 'CRITICO')
        AND DATE(created_at) BETWEEN p_fecha_inicio AND p_fecha_fin;
        
    WHEN 'errores_pendientes' THEN
      SELECT COUNT(*) INTO v_resultado
      FROM tbl_errores_sistema 
      WHERE idglobal = p_idglobal 
        AND estado_resuelto = 'PENDIENTE'
        AND DATE(created_at) BETWEEN p_fecha_inicio AND p_fecha_fin;
        
    WHEN 'sesiones_activas' THEN
      SELECT COUNT(*) INTO v_resultado
      FROM tbl_sesiones_usuario 
      WHERE idglobal = p_idglobal 
        AND estado_sesion = 'ACTIVA';
        
    WHEN 'performance_lenta' THEN
      SELECT COUNT(*) INTO v_resultado
      FROM tbl_monitoreo_performance 
      WHERE idglobal = p_idglobal 
        AND tiempo_ejecucion > 5.0000
        AND DATE(created_at) BETWEEN p_fecha_inicio AND p_fecha_fin;
        
    ELSE
      SET v_resultado = 0;
  END CASE;
  
  RETURN v_resultado;
END$$

DELIMITER ;

-- ========================================
-- 9. EVENTOS AUTOMÁTICOS DE LIMPIEZA
-- ========================================

-- Crear evento para limpiar registros antiguos de auditoría (mantener 6 meses)
DROP EVENT IF EXISTS `ev_limpiar_auditoria_antigua`;
CREATE EVENT `ev_limpiar_auditoria_antigua`
ON SCHEDULE EVERY 1 WEEK
STARTS CURRENT_TIMESTAMP
DO
  DELETE FROM `tbl_auditoria_sistema` 
  WHERE `created_at` < DATE_SUB(NOW(), INTERVAL 6 MONTH)
  AND `nivel_criticidad` NOT IN ('ALTO', 'CRITICO');

-- Crear evento para limpiar sesiones expiradas
DROP EVENT IF EXISTS `ev_limpiar_sesiones_expiradas`;
CREATE EVENT `ev_limpiar_sesiones_expiradas`
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
  UPDATE `tbl_sesiones_usuario` 
  SET `estado_sesion` = 'EXPIRADA', `fecha_fin` = NOW()
  WHERE `estado_sesion` = 'ACTIVA' 
  AND `fecha_ultimo_acceso` < DATE_SUB(NOW(), INTERVAL 24 HOUR);

-- Crear evento para limpiar monitoreo de performance antiguo (mantener 3 meses)
DROP EVENT IF EXISTS `ev_limpiar_performance_antigua`;
CREATE EVENT `ev_limpiar_performance_antigua`
ON SCHEDULE EVERY 1 WEEK
STARTS CURRENT_TIMESTAMP
DO
  DELETE FROM `tbl_monitoreo_performance` 
  WHERE `created_at` < DATE_SUB(NOW(), INTERVAL 3 MONTH);

SET FOREIGN_KEY_CHECKS = 1;

-- ========================================
-- 10. EJEMPLOS DE USO
-- ========================================

/*
-- Registrar performance de una operación
CALL sp_registrar_performance(1, 'SELECT', 'SELECT * FROM tbl_empleado', 2.5678, 1024000, 150, 'tbl_empleado', 1, 1, '/api/empleados');

-- Registrar un error
CALL sp_registrar_error(1, 'PHP_ERROR', 'E001', 'Error de conexión', '/path/to/file.php', 125, 'Stack trace...', 1, 1, 'sess123', '192.168.1.1', '/empleados/crear');

-- Iniciar sesión
CALL sp_iniciar_sesion('sess_123456', 1, 1, 1, '192.168.1.100', 'Mozilla/5.0...', 'Desktop', 'Chrome', 'Windows 10');

-- Obtener estadísticas
SELECT fn_estadisticas_auditoria(1, 'total_operaciones', '2025-10-01', '2025-10-31') as total_ops;
SELECT fn_estadisticas_auditoria(1, 'operaciones_criticas', '2025-10-01', '2025-10-31') as ops_criticas;

-- Consultar vistas de monitoreo
SELECT * FROM view_auditoria_resumen WHERE idglobal = 1 AND fecha = CURDATE();
SELECT * FROM view_sesiones_activas WHERE idglobal = 1;
SELECT * FROM view_errores_criticos WHERE idglobal = 1 LIMIT 10;
SELECT * FROM view_performance_lenta WHERE idglobal = 1 LIMIT 10;
*/