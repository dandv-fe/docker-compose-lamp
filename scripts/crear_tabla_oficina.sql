-- Script para crear la tabla tbl_oficina y sus relaciones
-- Ejecutar este script en la base de datos para tener funcionalidad completa

-- Crear tabla tbl_oficina
CREATE TABLE IF NOT EXISTS `tbl_oficina` (
  `idoficina` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NOT NULL,
  `str_nombre` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `idempleado_administrador` int(11) NULL DEFAULT NULL,
  `str_descripcion` text CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NULL DEFAULT NULL,
  `str_direccion` varchar(200) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NULL DEFAULT NULL,
  `str_telefono` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NULL DEFAULT NULL,
  `str_estado` enum('activo','inactivo') CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL DEFAULT 'activo',
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`idoficina`) USING BTREE,
  INDEX `idx_idglobal` (`idglobal` ASC) USING BTREE,
  INDEX `idx_empleado_admin` (`idempleado_administrador` ASC) USING BTREE,
  CONSTRAINT `fk_oficina_empleado` FOREIGN KEY (`idempleado_administrador`) REFERENCES `tbl_empleado` (`idempleado`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci COMMENT = 'Tabla de oficinas para el plan de trabajo';

-- Agregar campo idoficina a la tabla tbl_sucursal si no existe
ALTER TABLE `tbl_sucursal` 
ADD COLUMN IF NOT EXISTS `idoficina` int(11) NULL DEFAULT NULL AFTER `idempleado`,
ADD INDEX IF NOT EXISTS `idx_idoficina` (`idoficina` ASC) USING BTREE,
ADD CONSTRAINT `fk_sucursal_oficina` FOREIGN KEY (`idoficina`) REFERENCES `tbl_oficina` (`idoficina`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Agregar campo idoficina a la tabla tbl_empleado si no existe
ALTER TABLE `tbl_empleado` 
ADD COLUMN IF NOT EXISTS `idoficina` int(11) NULL DEFAULT NULL AFTER `idglobal`,
ADD INDEX IF NOT EXISTS `idx_empleado_oficina` (`idoficina` ASC) USING BTREE,
ADD CONSTRAINT `fk_empleado_oficina` FOREIGN KEY (`idoficina`) REFERENCES `tbl_oficina` (`idoficina`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Insertar oficinas de ejemplo (ajustar idglobal según corresponda)
-- NOTA: Cambiar el valor 1 por el idglobal correspondiente de tu empresa
INSERT IGNORE INTO `tbl_oficina` (`idglobal`, `str_nombre`, `str_descripcion`, `str_estado`) VALUES
(1, 'Oficina Principal', 'Oficina central de operaciones', 'activo'),
(1, 'Oficina Norte', 'Oficina zona norte de la ciudad', 'activo'),
(1, 'Oficina Sur', 'Oficina zona sur de la ciudad', 'activo'),
(1, 'Oficina Este', 'Oficina zona este de la ciudad', 'activo'),
(1, 'Oficina Oeste', 'Oficina zona oeste de la ciudad', 'activo');

-- Crear tabla intermedia para el historial de asignaciones (opcional)
CREATE TABLE IF NOT EXISTS `tbl_plan_trabajo_historial` (
  `id_historial` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NOT NULL,
  `idoficina` int(11) NOT NULL,
  `tipo_asignacion` enum('sucursal','empleado') CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `id_asignado` int(11) NOT NULL COMMENT 'ID de la sucursal o empleado asignado',
  `fecha_asignacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `usuario_asigna` int(11) NULL DEFAULT NULL COMMENT 'ID del usuario que realiza la asignación',
  `observaciones` text CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NULL DEFAULT NULL,
  PRIMARY KEY (`id_historial`) USING BTREE,
  INDEX `idx_oficina_historial` (`idoficina` ASC) USING BTREE,
  INDEX `idx_global_historial` (`idglobal` ASC) USING BTREE,
  CONSTRAINT `fk_historial_oficina` FOREIGN KEY (`idoficina`) REFERENCES `tbl_oficina` (`idoficina`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci COMMENT = 'Historial de asignaciones del plan de trabajo';