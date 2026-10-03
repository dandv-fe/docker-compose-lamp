-- Script SQL para crear tablas de documentos y sus imágenes/archivos asociados
-- Diseñado para MySQL / MariaDB
-- Usar con: mysql -u user -p DB_NAME < create_documentos_tables.sql

SET @@sql_mode = CONCAT_WS(',', @@sql_mode, 'NO_ZERO_DATE', 'NO_ZERO_IN_DATE');

-- Tabla principal de documentos (facturas, contratos, comprobantes)
CREATE TABLE IF NOT EXISTS `tbl_documento` (
  `iddocumento` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `idglobal` INT NOT NULL COMMENT 'ID de la empresa/instancia',
  `ref_cliente` VARCHAR(100) DEFAULT NULL COMMENT 'Identificador del cliente (flexible)',
  `idpersona` INT DEFAULT NULL COMMENT 'Opcional: idpersona si aplica',
  `tipo` VARCHAR(50) NOT NULL DEFAULT 'otro' COMMENT 'Ej: factura, contrato, comprobante',
  `nombre_original` VARCHAR(255) DEFAULT NULL,
  `key_path` VARCHAR(512) NOT NULL COMMENT 'Ruta/Key en el storage (ej. clientes/ID/2026/04/file.pdf)',
  `storage_backend` VARCHAR(50) NOT NULL DEFAULT 'r2' COMMENT 'r2, s3, local, etc.',
  `content_type` VARCHAR(100) DEFAULT NULL,
  `size` BIGINT UNSIGNED DEFAULT 0,
  `checksum` VARCHAR(128) DEFAULT NULL,
  `is_private` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1: privado (acceso por presign), 0: público',
  `uploaded_by` INT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `expires_at` DATETIME DEFAULT NULL,
  `meta` JSON DEFAULT NULL,
  PRIMARY KEY (`iddocumento`),
  KEY `idx_documento_idglobal` (`idglobal`),
  KEY `idx_documento_refcliente` (`ref_cliente`),
  KEY `idx_documento_uploaded_by` (`uploaded_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla para imágenes/archivos relacionados a un documento (multi-archivos por documento)
CREATE TABLE IF NOT EXISTS `tbl_documento_archivo` (
  `idarchivo` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `iddocumento` INT UNSIGNED NOT NULL,
  `nombre_original` VARCHAR(255) DEFAULT NULL,
  `key_path` VARCHAR(512) NOT NULL,
  `content_type` VARCHAR(100) DEFAULT NULL,
  `size` BIGINT UNSIGNED DEFAULT 0,
  `width` INT DEFAULT NULL,
  `height` INT DEFAULT NULL,
  `checksum` VARCHAR(128) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`idarchivo`),
  KEY `idx_archivo_iddocumento` (`iddocumento`),
  CONSTRAINT `fk_archivo_documento` FOREIGN KEY (`iddocumento`) REFERENCES `tbl_documento`(`iddocumento`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Opcionales: vistas o índices adicionales según consultas habituales.
-- Por ejemplo, una vista para listar archivos por cliente:
-- CREATE VIEW view_documentos_cliente AS
-- SELECT d.iddocumento, d.ref_cliente, d.tipo, d.nombre_original, a.idarchivo, a.nombre_original AS archivo_nombre, a.key_path
-- FROM tbl_documento d LEFT JOIN tbl_documento_archivo a ON a.iddocumento=d.iddocumento;

-- Fin del script
