-- 002_payment_author.sql
-- Records who registered each abono (tbl_descripcion) and from which channel.
--
-- Additive only: two NULLable columns and one index. Existing rows keep NULL
-- (author/channel unknown); no historical author is inferred or backfilled.
-- The legacy PHP INSERTs into tbl_descripcion use explicit column lists, so they
-- keep working unchanged and simply leave both columns NULL.
--
-- Idempotent on MariaDB >= 10.0.2 (IF NOT EXISTS), safe to re-run.
-- Never executed automatically by the API, npm scripts, or tests. Back up first:
--   mysqldump <db> tbl_descripcion > tbl_descripcion_before_002.sql
--
-- Must be applied BEFORE deploying the API version that writes these columns;
-- otherwise CREATE_PAYMENT fails with an unknown-column error.

ALTER TABLE `tbl_descripcion`
  ADD COLUMN IF NOT EXISTS `idusuario` INT NULL DEFAULT NULL
    COMMENT 'tbl_usuario.idusuario that registered the abono; NULL = unknown/legacy'
    AFTER `str_estado`,
  ADD COLUMN IF NOT EXISTS `str_origen` VARCHAR(20) NULL DEFAULT NULL
    COMMENT 'Channel that registered the abono: android | web; NULL = unknown/legacy'
    AFTER `idusuario`,
  ADD INDEX IF NOT EXISTS `ix_descripcion_usuario` (`idglobal`, `idusuario`);

-- Rollback (manual, only if needed; drops the recorded authorship data):
-- ALTER TABLE `tbl_descripcion`
--   DROP INDEX IF EXISTS `ix_descripcion_usuario`,
--   DROP COLUMN IF EXISTS `str_origen`,
--   DROP COLUMN IF EXISTS `idusuario`;
