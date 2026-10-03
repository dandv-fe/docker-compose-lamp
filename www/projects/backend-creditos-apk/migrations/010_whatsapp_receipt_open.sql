-- Apply manually after 001–009. MariaDB 10.2+. Safe to run again; never alters legacy tables.
-- Hidden, server-only counter of successful EXTERNAL WhatsApp openings of a receipt, per card
-- (tbl_tarjetas.idtarjeta) or abono (tbl_descripcion.iddescripcion). It cannot prove that a
-- message was sent or delivered: WhatsApp never reports back. It is not exposed by GraphQL.
CREATE TABLE IF NOT EXISTS `mobile_whatsapp_receipt_open` (
  `idglobal` INT NOT NULL,
  `idsucursal` INT NOT NULL,
  `record_kind` ENUM('credit','payment') NOT NULL,
  `record_id` VARCHAR(50) NOT NULL,
  `open_count` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `first_opened_at` DATETIME NOT NULL,
  `last_opened_at` DATETIME NOT NULL,
  `last_opened_by` INT NULL,
  PRIMARY KEY (`idglobal`,`idsucursal`,`record_kind`,`record_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_spanish_ci;
