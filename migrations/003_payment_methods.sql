-- 003_payment_methods.sql
-- Where the money of each abono came in and where the money of each new credit came from,
-- so the collector's pocket cash only counts cash.
--
-- * tbl_banco: the company's bank accounts / wallets (Bancolombia, Nequi, Daviplata...).
--   It already existed, empty and unused by webgoez; it gains the company (idglobal),
--   timestamps and a lookup index. "Efectivo" is NOT a row: cash is the absence of a bank.
-- * tbl_descripcion_pago: abono (tbl_descripcion) <-> bank. An abono without rows here is
--   100 % cash, which is exactly what the 8M+ existing abonos and the legacy PHP inserts are.
--   Several rows allow a mixed payment (part transfer, part cash).
-- * tbl_tarjeta_pago: new credit (tbl_tarjetas) <-> bank. A credit without rows was paid out
--   (loan handed over / product bought) in cash.
--
-- tbl_descripcion and tbl_tarjetas are NOT altered. Deleting an abono or a credit deletes its
-- rows here (ON DELETE CASCADE), so the legacy PHP deletes keep working unchanged.
--
-- Idempotent on MariaDB >= 10.0.2 (IF NOT EXISTS), safe to re-run. Never executed by the API,
-- npm scripts or tests. Back up first:
--   mysqldump <db> tbl_banco > tbl_banco_before_003.sql
-- Must be applied BEFORE deploying the API version that reads these tables; otherwise the
-- portfolio and sync queries fail with an unknown-table error.

ALTER TABLE `tbl_banco`
  ADD COLUMN IF NOT EXISTS `idglobal` INT NOT NULL DEFAULT 0
    COMMENT 'tbl_global.idglobal that owns the account' AFTER `idbanco`,
  MODIFY `str_tipo` VARCHAR(30) NOT NULL
    COMMENT 'ahorros | corriente | billetera',
  MODIFY `str_num_cueneta` VARCHAR(30) NOT NULL
    COMMENT 'Account or wallet number shown to the collector',
  MODIFY `str_estado` VARCHAR(15) NOT NULL DEFAULT 'activo'
    COMMENT 'activo | inactivo; inactive accounts stay for history but cannot be chosen',
  ADD COLUMN IF NOT EXISTS `int_orden` INT NOT NULL DEFAULT 0
    COMMENT 'Display order in the payment selectors' AFTER `str_estado`,
  ADD COLUMN IF NOT EXISTS `created_at` DATETIME NULL DEFAULT NULL AFTER `int_orden`,
  ADD COLUMN IF NOT EXISTS `updated_at` DATETIME NULL DEFAULT NULL AFTER `created_at`,
  ADD INDEX IF NOT EXISTS `ix_banco_global_estado` (`idglobal`, `str_estado`, `int_orden`);

CREATE TABLE IF NOT EXISTS `tbl_descripcion_pago` (
  `iddescripcion_pago` INT NOT NULL AUTO_INCREMENT,
  `idglobal` INT NOT NULL,
  `iddescripcion` VARCHAR(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `idbanco` INT NOT NULL,
  `dec_valor` DECIMAL(10,2) NOT NULL COMMENT 'Positive amount received in this account',
  `str_referencia` VARCHAR(50) NULL DEFAULT NULL COMMENT 'Transfer receipt number, optional',
  `idusuario` INT NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`iddescripcion_pago`),
  UNIQUE KEY `uq_descripcion_banco` (`iddescripcion`, `idbanco`),
  KEY `ix_descripcion_pago_banco` (`idglobal`, `idbanco`),
  CONSTRAINT `fk_descripcion_pago_descripcion` FOREIGN KEY (`iddescripcion`)
    REFERENCES `tbl_descripcion` (`iddescripcion`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_descripcion_pago_banco` FOREIGN KEY (`idbanco`)
    REFERENCES `tbl_banco` (`idbanco`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_spanish_ci;

CREATE TABLE IF NOT EXISTS `tbl_tarjeta_pago` (
  `idtarjeta_pago` INT NOT NULL AUTO_INCREMENT,
  `idglobal` INT NOT NULL,
  `idtarjeta` VARCHAR(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `idbanco` INT NOT NULL,
  `dec_valor` DECIMAL(10,2) NOT NULL COMMENT 'Positive amount paid out from this account',
  `str_referencia` VARCHAR(50) NULL DEFAULT NULL COMMENT 'Transfer receipt number, optional',
  `idusuario` INT NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`idtarjeta_pago`),
  UNIQUE KEY `uq_tarjeta_banco` (`idtarjeta`, `idbanco`),
  KEY `ix_tarjeta_pago_banco` (`idglobal`, `idbanco`),
  CONSTRAINT `fk_tarjeta_pago_tarjeta` FOREIGN KEY (`idtarjeta`)
    REFERENCES `tbl_tarjetas` (`idtarjeta`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_tarjeta_pago_banco` FOREIGN KEY (`idbanco`)
    REFERENCES `tbl_banco` (`idbanco`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_spanish_ci;

-- Example account (adjust idglobal and numbers):
-- INSERT INTO tbl_banco (idglobal, str_banco, str_tipo, str_num_cueneta, str_estado, int_orden, created_at, updated_at)
-- VALUES (1001, 'Nequi', 'billetera', '3001234567', 'activo', 1, NOW(), NOW());

-- Rollback (manual, only if needed; drops the recorded payment methods):
-- DROP TABLE IF EXISTS `tbl_tarjeta_pago`;
-- DROP TABLE IF EXISTS `tbl_descripcion_pago`;
-- ALTER TABLE `tbl_banco`
--   DROP INDEX IF EXISTS `ix_banco_global_estado`,
--   DROP COLUMN IF EXISTS `updated_at`, DROP COLUMN IF EXISTS `created_at`,
--   DROP COLUMN IF EXISTS `int_orden`, DROP COLUMN IF EXISTS `idglobal`;
