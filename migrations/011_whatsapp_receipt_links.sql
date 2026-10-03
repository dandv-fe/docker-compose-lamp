-- Apply manually after 001–010. MariaDB 10.2+. Safe to run again; never alters legacy tables.
-- Each row contains only an immutable JSON snapshot. The bearer token itself is never stored.
CREATE TABLE IF NOT EXISTS `mobile_whatsapp_receipt_link` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `token_hash` BINARY(32) NOT NULL,
  `idglobal` INT NOT NULL,
  `idsucursal` INT NOT NULL,
  `record_kind` ENUM('credit','payment') NOT NULL,
  `record_id` VARCHAR(50) NOT NULL,
  `idcliente` INT NOT NULL,
  `issued_by` INT NOT NULL,
  `receipt_format` ENUM('ticket','factura','cartulina') NOT NULL,
  `snapshot_version` SMALLINT UNSIGNED NOT NULL,
  `snapshot_json` JSON NOT NULL,
  `created_at` DATETIME NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `revoked_at` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_receipt_link_token_hash` (`token_hash`),
  KEY `ix_receipt_link_scope` (`idglobal`,`idsucursal`,`record_kind`,`record_id`),
  KEY `ix_receipt_link_expiry` (`expires_at`,`revoked_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_spanish_ci;
