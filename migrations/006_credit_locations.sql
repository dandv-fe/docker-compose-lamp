-- 006_credit_locations.sql
-- Named GPS collection points for each credit card, captured from the Android app.
--
-- Idempotent on MariaDB >= 10.0.2, safe to re-run. Apply after 001..005 and before deploying
-- the API/APK version that syncs card collection locations.

CREATE TABLE IF NOT EXISTS `mobile_credit_location` (
  `idlocation` VARCHAR(50) NOT NULL,
  `idglobal` INT NOT NULL,
  `idsucursal` INT NOT NULL,
  `idtarjeta` VARCHAR(50) NOT NULL,
  `str_nombre` VARCHAR(40) NOT NULL,
  `dec_latitud` DECIMAL(9,6) NOT NULL,
  `dec_longitud` DECIMAL(9,6) NOT NULL,
  `int_precision_m` INT NULL DEFAULT NULL,
  `idusuario` INT NOT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`idlocation`),
  KEY `ix_credit_location_card` (`idglobal`, `idsucursal`, `idtarjeta`),
  KEY `ix_credit_location_user` (`idglobal`, `idusuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_spanish_ci;

-- Rollback (manual):
-- DROP TABLE IF EXISTS `mobile_credit_location`;
