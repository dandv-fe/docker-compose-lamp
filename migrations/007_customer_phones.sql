-- Apply manually after 001..006, before deploying this API/APK. MariaDB 10.2+.
-- str_telefono remains the primary; triggers also capture writes from legacy PHP.
CREATE TABLE IF NOT EXISTS mobile_customer_phone (
  idphone BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  idglobal INT NOT NULL,
  idpersona INT NOT NULL,
  raw_phone VARCHAR(255) NOT NULL,
  normalized_phone VARCHAR(15) NULL,
  phone_key VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_customer_phone (idglobal,idpersona,phone_key),
  UNIQUE KEY uq_customer_normalized_phone (idglobal,idpersona,normalized_phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE mobile_customer_phone
  ADD UNIQUE INDEX IF NOT EXISTS uq_customer_normalized_phone (idglobal,idpersona,normalized_phone);

DELIMITER $$
CREATE OR REPLACE FUNCTION mobile_normalize_phone(raw_value VARCHAR(255))
RETURNS VARCHAR(15) DETERMINISTIC NO SQL
BEGIN
  DECLARE digits VARCHAR(255);
  IF TRIM(raw_value) NOT REGEXP '^(\\+|00)?[0-9]+([ ()-][0-9]+)*$' THEN RETURN NULL; END IF;
  SET digits=REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(raw_value),' ',''),'(',''),')',''),'-',''),'+','');
  IF LEFT(digits,2)='00' THEN SET digits=SUBSTRING(digits,3); END IF;
  IF digits REGEXP '^3[0-9]{9}$' THEN RETURN CONCAT('57',digits); END IF;
  IF digits REGEXP '^573[0-9]{9}$' THEN RETURN digits; END IF;
  IF digits REGEXP '^[1-9][0-9]{10,14}$' AND LEFT(digits,2)<>'57' THEN RETURN digits; END IF;
  RETURN NULL;
END$$
CREATE OR REPLACE PROCEDURE mobile_remember_phone(IN company_id INT, IN person_id INT, IN raw_value VARCHAR(255))
BEGIN
  DECLARE normalized VARCHAR(15);
  IF LENGTH(TRIM(COALESCE(raw_value,'')))>0 THEN
    SET normalized=mobile_normalize_phone(raw_value);
    INSERT INTO mobile_customer_phone(idglobal,idpersona,raw_phone,normalized_phone,phone_key)
    VALUES(company_id,person_id,TRIM(raw_value),normalized,COALESCE(normalized,CONCAT('legacy:',TRIM(raw_value))))
    ON DUPLICATE KEY UPDATE idphone=idphone;
  END IF;
END$$
CREATE OR REPLACE TRIGGER trg_mobile_phone_ai AFTER INSERT ON tbl_persona FOR EACH ROW
BEGIN
  CALL mobile_remember_phone(NEW.idglobal,NEW.idpersona,NEW.str_telefono);
END$$
CREATE OR REPLACE TRIGGER trg_mobile_phone_au AFTER UPDATE ON tbl_persona FOR EACH ROW
BEGIN
  CALL mobile_remember_phone(OLD.idglobal,OLD.idpersona,OLD.str_telefono);
  CALL mobile_remember_phone(NEW.idglobal,NEW.idpersona,NEW.str_telefono);
END$$
DELIMITER ;

INSERT INTO mobile_customer_phone(idglobal,idpersona,raw_phone,normalized_phone,phone_key)
SELECT idglobal,idpersona,TRIM(str_telefono),mobile_normalize_phone(str_telefono),
       COALESCE(mobile_normalize_phone(str_telefono),CONCAT('legacy:',TRIM(str_telefono)))
FROM tbl_persona WHERE LENGTH(TRIM(COALESCE(str_telefono,'')))>0
ON DUPLICATE KEY UPDATE idphone=idphone;
