-- Apply manually before using reportAppInstallation/appInstallations.
-- Additive and rerunnable; the API never creates or changes this schema.
-- One latest report per company/user/installation; no device secrets or telemetry.
CREATE TABLE IF NOT EXISTS `mobile_app_installation` (
  `idglobal` INT NOT NULL,
  `idusuario` INT NOT NULL,
  `installation_id` VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `version_code` INT NOT NULL,
  `version_name` VARCHAR(80) NOT NULL,
  `last_seen_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`idglobal`, `idusuario`, `installation_id`),
  KEY `ix_app_installation_latest` (`idglobal`, `last_seen_at`),
  CONSTRAINT `chk_app_installation_version` CHECK (`version_code` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
