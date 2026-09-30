-- 004_bank_holder_branches.sql
-- Who owns each bank account and in which sucursales (rutas) it may receive or pay money.
--
-- * tbl_banco gains the holder as registered at the bank (str_titular) and the holder's NIT or
--   ID document (str_documento_titular), so the collector can tell the customer exactly where to
--   transfer. idoficina is the office that created/owns the account; NULL = company-level account
--   (created by Super Administrador / the company user) that any office may authorize.
-- * tbl_banco_sucursal: the accounts authorized in each sucursal. Only linked accounts are offered
--   in that ruta and accepted by the API/web. An office administrator decides for the sucursales
--   of their office. Accounts without links are not usable anywhere (existing accounts must be
--   authorized after applying this migration).
--
-- Idempotent on MariaDB >= 10.0.2, safe to re-run. Requires 003_payment_methods.sql.
-- Back up first: mysqldump <db> tbl_banco > tbl_banco_before_004.sql
-- Apply BEFORE deploying the API version that reads these columns/table.

ALTER TABLE `tbl_banco`
  ADD COLUMN IF NOT EXISTS `str_titular` VARCHAR(100) NOT NULL DEFAULT ''
    COMMENT 'Account holder exactly as registered at the bank' AFTER `str_num_cueneta`,
  ADD COLUMN IF NOT EXISTS `str_documento_titular` VARCHAR(20) NOT NULL DEFAULT ''
    COMMENT 'NIT or ID document number of the holder' AFTER `str_titular`,
  ADD COLUMN IF NOT EXISTS `idoficina` INT NULL DEFAULT NULL
    COMMENT 'tbl_oficina that owns the account; NULL = company-level' AFTER `idglobal`,
  ADD INDEX IF NOT EXISTS `ix_banco_global_oficina` (`idglobal`, `idoficina`);

CREATE TABLE IF NOT EXISTS `tbl_banco_sucursal` (
  `idbanco` INT NOT NULL,
  `idsucursal` INT NOT NULL,
  `idglobal` INT NOT NULL,
  `idusuario` INT NULL DEFAULT NULL COMMENT 'Who authorized the account in this sucursal',
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`idbanco`, `idsucursal`),
  KEY `ix_banco_sucursal_sucursal` (`idglobal`, `idsucursal`),
  CONSTRAINT `fk_banco_sucursal_banco` FOREIGN KEY (`idbanco`)
    REFERENCES `tbl_banco` (`idbanco`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_spanish_ci;

-- Example: authorize account 3 in sucursal 12 of company 1002
-- INSERT IGNORE INTO tbl_banco_sucursal (idbanco, idsucursal, idglobal, created_at) VALUES (3, 12, 1002, NOW());

-- Rollback (manual):
-- DROP TABLE IF EXISTS `tbl_banco_sucursal`;
-- ALTER TABLE `tbl_banco` DROP INDEX `ix_banco_global_oficina`,
--   DROP COLUMN `idoficina`, DROP COLUMN `str_documento_titular`, DROP COLUMN `str_titular`;
