-- 005_biometric_credentials.sql
-- Device-bound biometric credentials for Android login.
--
-- The APK never uploads fingerprint data. Android validates biometrics locally and signs
-- a server challenge with a private key in Android Keystore. This migration stores only the
-- public key and short-lived login/enrollment challenges.
--
-- Idempotent on MariaDB >= 10.0.2, safe to re-run. Apply after 001..004 and before deploying
-- the API version that serves biometric login mutations.

CREATE TABLE IF NOT EXISTS `mobile_biometric_credential` (
  `idcredential` VARCHAR(64) NOT NULL,
  `idglobal` INT NOT NULL,
  `idusuario` INT NOT NULL,
  `device_id` VARCHAR(120) NOT NULL,
  `public_key_spki` TEXT NOT NULL,
  `str_estado` VARCHAR(15) NOT NULL DEFAULT 'activo',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `last_used_at` DATETIME NULL DEFAULT NULL,
  `revoked_at` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`idcredential`),
  UNIQUE KEY `ux_biometric_user_device` (`idglobal`, `idusuario`, `device_id`),
  KEY `ix_biometric_user` (`idglobal`, `idusuario`),
  KEY `ix_biometric_device` (`idglobal`, `device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_spanish_ci;

CREATE TABLE IF NOT EXISTS `mobile_biometric_challenge` (
  `idchallenge` VARCHAR(64) NOT NULL,
  `idcredential` VARCHAR(64) NULL DEFAULT NULL,
  `idglobal` INT NOT NULL,
  `idusuario` INT NOT NULL,
  `device_id` VARCHAR(120) NOT NULL,
  `str_purpose` VARCHAR(20) NOT NULL,
  `challenge_base64` VARCHAR(128) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `used_at` DATETIME NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`idchallenge`),
  KEY `ix_biometric_challenge_scope` (`idglobal`, `idusuario`, `device_id`, `str_purpose`),
  KEY `ix_biometric_challenge_expires` (`expires_at`),
  CONSTRAINT `fk_biometric_challenge_credential` FOREIGN KEY (`idcredential`)
    REFERENCES `mobile_biometric_credential` (`idcredential`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_spanish_ci;

-- Rollback (manual):
-- DROP TABLE IF EXISTS `mobile_biometric_challenge`;
-- DROP TABLE IF EXISTS `mobile_biometric_credential`;
