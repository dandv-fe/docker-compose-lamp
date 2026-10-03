-- Apply manually after 007 and 008. MariaDB 10.2+. Safe to run again.
-- Never deletes history or resets validity when legacy forms change the primary.
ALTER TABLE mobile_customer_phone
  ADD COLUMN IF NOT EXISTS is_invalid TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS validity_changed_by INT NULL,
  ADD COLUMN IF NOT EXISTS validity_changed_at DATETIME NULL;

DELIMITER $$
CREATE OR REPLACE TRIGGER trg_mobile_phone_validity_au AFTER UPDATE ON mobile_customer_phone FOR EACH ROW
BEGIN
  IF OLD.is_invalid<>NEW.is_invalid THEN
    INSERT INTO mobile_change_event(idglobal,idsucursal,record_type,action,record_id,related_id,created_at)
    SELECT DISTINCT NEW.idglobal,b.idsucursal,'customer','UPDATE',CAST(c.idcliente AS CHAR),CAST(NEW.idpersona AS CHAR),NOW()
    FROM tbl_clientes c JOIN mobile_customer_branch b ON b.idglobal=c.idglobal AND b.idcliente=c.idcliente
    WHERE c.idglobal=NEW.idglobal AND c.idpersona=NEW.idpersona;
  END IF;
END$$
DELIMITER ;
