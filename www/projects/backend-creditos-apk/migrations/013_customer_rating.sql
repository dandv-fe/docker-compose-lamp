-- Apply manually after 001-012 and BEFORE deploying the API/APK that uses customerRating.
-- MariaDB 10.3+ (DATETIME(3), FOLLOWS, CREATE OR REPLACE TRIGGER). Re-running only re-creates
-- DDL objects: it never inserts events, never backfills and never touches business rows.
-- The manual score lives in the existing tbl_clientes.str_calificacion as '1'..'10'
-- ('nuevo' or '' = unrated). Customer sync is unchanged: the existing trg_mobile_cliente_au
-- already emits a customer UPDATE event for every tbl_clientes update (PHP and Node writers).
-- Uses DELIMITER $$ (mysql/mariadb CLI or phpMyAdmin); do not feed to a splitter that ignores it.

CREATE TABLE IF NOT EXISTS mobile_customer_rating_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  idglobal INT NOT NULL,
  idcliente INT NOT NULL,
  idsucursal INT NOT NULL,
  score TINYINT UNSIGNED NULL,
  previous_score TINYINT UNSIGNED NULL,
  reason VARCHAR(500) NOT NULL,
  source VARCHAR(16) NOT NULL DEFAULT 'manual',
  created_by INT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_rating_history_customer (idglobal, idcliente, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Prepared, DISABLED automation: an append-only log of real business events with their source
-- values. Nothing reads or scores them yet; state stays 'pending'. source_record_id is always the
-- original iddescripcion/idtarjeta, so repeated events for the same record are separate rows.
CREATE TABLE IF NOT EXISTS mobile_customer_rating_event (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  idglobal INT NOT NULL,
  idcliente INT NOT NULL,
  idsucursal INT NULL,
  event_type VARCHAR(32) NOT NULL,
  source_record_id VARCHAR(100) NOT NULL,
  old_state VARCHAR(50) NULL,
  new_state VARCHAR(50) NULL,
  previous_amount DECIMAL(12,2) NULL,
  amount DECIMAL(12,2) NULL,
  occurred_at DATETIME(3) NOT NULL,
  processed_at DATETIME(3) NULL,
  state VARCHAR(16) NOT NULL DEFAULT 'pending',
  PRIMARY KEY (id),
  KEY ix_rating_event_source (idglobal, event_type, source_record_id),
  KEY ix_rating_event_state (state, id),
  KEY ix_rating_event_customer (idglobal, idcliente, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One extra trigger per event, ordered after the untouched sync trigger. No error handler and no
-- IGNORE: a failed event insert fails the legacy statement, so it rolls back together with its
-- mobile_change_event rows instead of silently losing the event. The payment->credit lookup is a
-- scalar subquery, so a missing credit raises a NOT NULL error rather than skipping the event.
DELIMITER $$
CREATE OR REPLACE TRIGGER trg_rating_descripcion_ai AFTER INSERT ON tbl_descripcion FOR EACH ROW
FOLLOWS trg_mobile_descripcion_ai
INSERT INTO mobile_customer_rating_event
  (idglobal,idcliente,idsucursal,event_type,source_record_id,old_state,new_state,previous_amount,amount,occurred_at)
VALUES (NEW.idglobal,
  (SELECT t.idcliente FROM tbl_tarjetas t WHERE t.idtarjeta=NEW.idtarjeta AND t.idglobal=NEW.idglobal),
  NEW.idsucursal,'payment_created',NEW.iddescripcion,NULL,NEW.str_estado,NULL,NEW.dec_abono,UTC_TIMESTAMP(3))$$

CREATE OR REPLACE TRIGGER trg_rating_descripcion_au AFTER UPDATE ON tbl_descripcion FOR EACH ROW
FOLLOWS trg_mobile_descripcion_au
BEGIN
  IF NOT (OLD.str_estado <=> NEW.str_estado AND OLD.dec_abono <=> NEW.dec_abono) THEN
    INSERT INTO mobile_customer_rating_event
      (idglobal,idcliente,idsucursal,event_type,source_record_id,old_state,new_state,previous_amount,amount,occurred_at)
    VALUES (NEW.idglobal,
      (SELECT t.idcliente FROM tbl_tarjetas t WHERE t.idtarjeta=NEW.idtarjeta AND t.idglobal=NEW.idglobal),
      NEW.idsucursal,'payment_updated',NEW.iddescripcion,OLD.str_estado,NEW.str_estado,
      OLD.dec_abono,NEW.dec_abono,UTC_TIMESTAMP(3));
  END IF;
END$$

CREATE OR REPLACE TRIGGER trg_rating_descripcion_ad AFTER DELETE ON tbl_descripcion FOR EACH ROW
FOLLOWS trg_mobile_descripcion_ad
INSERT INTO mobile_customer_rating_event
  (idglobal,idcliente,idsucursal,event_type,source_record_id,old_state,new_state,previous_amount,amount,occurred_at)
VALUES (OLD.idglobal,
  (SELECT t.idcliente FROM tbl_tarjetas t WHERE t.idtarjeta=OLD.idtarjeta AND t.idglobal=OLD.idglobal),
  OLD.idsucursal,'payment_deleted',OLD.iddescripcion,OLD.str_estado,NULL,OLD.dec_abono,NULL,UTC_TIMESTAMP(3))$$

CREATE OR REPLACE TRIGGER trg_rating_tarjeta_ai AFTER INSERT ON tbl_tarjetas FOR EACH ROW
FOLLOWS trg_mobile_tarjeta_ai
INSERT INTO mobile_customer_rating_event
  (idglobal,idcliente,idsucursal,event_type,source_record_id,old_state,new_state,previous_amount,amount,occurred_at)
VALUES (NEW.idglobal,NEW.idcliente,NEW.idsucursal,'credit_created',NEW.idtarjeta,
  NULL,NEW.str_estado,NULL,NEW.dec_valor,UTC_TIMESTAMP(3))$$

CREATE OR REPLACE TRIGGER trg_rating_tarjeta_au AFTER UPDATE ON tbl_tarjetas FOR EACH ROW
FOLLOWS trg_mobile_tarjeta_au
BEGIN
  IF NOT (OLD.str_estado <=> NEW.str_estado) THEN
    INSERT INTO mobile_customer_rating_event
      (idglobal,idcliente,idsucursal,event_type,source_record_id,old_state,new_state,previous_amount,amount,occurred_at)
    VALUES (NEW.idglobal,NEW.idcliente,NEW.idsucursal,'credit_status_changed',NEW.idtarjeta,
      OLD.str_estado,NEW.str_estado,OLD.dec_resta,NEW.dec_resta,UTC_TIMESTAMP(3));
  END IF;
END$$
DELIMITER ;
