-- Migration: Añadir índice único compuesto para evitar duplicados de documento por idglobal
-- Fecha: 2026-04-24
-- Ejecutar con: mysql -u user -p database_name < 20260424_add_unique_idx_tbl_persona.sql

ALTER TABLE tbl_persona
  ADD UNIQUE KEY idx_persona_global_tipo_num (idglobal, str_tipo_documento, str_num_documento);

-- Nota: antes de aplicar en producción, verificar registros duplicados existentes:
-- SELECT idglobal, str_tipo_documento, str_num_documento, COUNT(*) c FROM tbl_persona GROUP BY idglobal, str_tipo_documento, str_num_documento HAVING c>1;
