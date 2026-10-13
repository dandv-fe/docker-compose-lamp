-- Apply manually to the shared database before deploying Resumen integral.
-- MariaDB 10.2+. Idempotent; does not alter report formulas or business data.
-- Run during a low-traffic window; index creation consumes I/O and disk space.
ALTER TABLE tbl_tarjetas
  ADD INDEX IF NOT EXISTS idx_integral_portfolio
    (idglobal, idsucursal, str_estado, dec_resta);

ALTER TABLE tbl_contabilidad_detalle
  ADD INDEX IF NOT EXISTS idx_integral_expense_period
    (idglobal, idsucursal, created_at);
