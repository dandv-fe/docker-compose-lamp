-- Apply manually after 013 and BEFORE deploying the API/APK that reads automatic ratings.
-- MariaDB 10.3+. Never touches business rows and backfills no scores. The only rows it inserts are
-- the state of manual ratings saved under 013 that are still inside their own 7 days (end of file);
-- re-running it re-creates DDL and inserts nothing new. The engine stays off until
-- CUSTOMER_RATING_AUTOMATION=1.
-- Uses DELIMITER $$ (mysql/mariadb CLI or phpMyAdmin); do not feed to a splitter that ignores it.

-- One row per company customer. Effective rating stays in tbl_clientes.str_calificacion:
-- manual_score while manual_until > UTC now, else 'nuevo' for initial confidence, else automatic_score.
-- evaluated_at NULL = not evaluated yet (e.g. row created by a PHP/Node manual save): the defaults
-- are the neutral pending state.
CREATE TABLE IF NOT EXISTS mobile_customer_rating_state (
  idglobal INT NOT NULL,
  idcliente INT NOT NULL,
  automatic_score TINYINT UNSIGNED NOT NULL DEFAULT 5,
  manual_score TINYINT UNSIGNED NULL,
  manual_until DATETIME(3) NULL,
  evaluated_at DATETIME(3) NULL,
  confidence VARCHAR(16) NOT NULL DEFAULT 'initial',
  explanation VARCHAR(500) NOT NULL DEFAULT 'Nota inicial neutral; evaluación matemática pendiente.',
  metrics_json LONGTEXT NULL DEFAULT NULL,
  next_evaluation_at DATETIME(3) NULL DEFAULT NULL,
  PRIMARY KEY (idglobal, idcliente),
  KEY ix_rating_state_next (next_evaluation_at),
  KEY ix_rating_state_manual (manual_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Worker bookkeeping (pending -> processed | failed after 5 attempts) and the source values of
-- every rating-relevant change. Source dates are the legacy DATETIME as stored (database clock).
ALTER TABLE mobile_customer_rating_event
  ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS old_value DECIMAL(12,2) NULL,
  ADD COLUMN IF NOT EXISTS new_value DECIMAL(12,2) NULL,
  ADD COLUMN IF NOT EXISTS old_term INT NULL,
  ADD COLUMN IF NOT EXISTS new_term INT NULL,
  ADD COLUMN IF NOT EXISTS old_mode VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS new_mode VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS old_record_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS new_record_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS old_parent_id VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS new_parent_id VARCHAR(100) NULL;

-- Replaces the 013 rating triggers (same names, still FOLLOWS the untouched sync triggers) and
-- adds credit deletion. Still no handler and no IGNORE: a failed event insert fails the legacy
-- statement. A payment moved to another credit, or a credit moved to another customer, emits one
-- event for the old customer and one for the new one so both are re-evaluated.
DELIMITER $$
CREATE OR REPLACE TRIGGER trg_rating_descripcion_ai AFTER INSERT ON tbl_descripcion FOR EACH ROW
FOLLOWS trg_mobile_descripcion_ai
INSERT INTO mobile_customer_rating_event
  (idglobal,idcliente,idsucursal,event_type,source_record_id,old_state,new_state,previous_amount,amount,
   new_record_at,new_parent_id,occurred_at)
VALUES (NEW.idglobal,
  (SELECT t.idcliente FROM tbl_tarjetas t WHERE t.idtarjeta=NEW.idtarjeta AND t.idglobal=NEW.idglobal),
  NEW.idsucursal,'payment_created',NEW.iddescripcion,NULL,NEW.str_estado,NULL,NEW.dec_abono,
  NEW.created_at,NEW.idtarjeta,UTC_TIMESTAMP(3))$$

CREATE OR REPLACE TRIGGER trg_rating_descripcion_au AFTER UPDATE ON tbl_descripcion FOR EACH ROW
FOLLOWS trg_mobile_descripcion_au
BEGIN
  IF NOT (OLD.str_estado <=> NEW.str_estado AND OLD.dec_abono <=> NEW.dec_abono
      AND OLD.created_at <=> NEW.created_at AND OLD.idtarjeta <=> NEW.idtarjeta
      AND OLD.idglobal <=> NEW.idglobal AND OLD.str_descripcion <=> NEW.str_descripcion) THEN
    INSERT INTO mobile_customer_rating_event
      (idglobal,idcliente,idsucursal,event_type,source_record_id,old_state,new_state,previous_amount,amount,
       old_record_at,new_record_at,old_parent_id,new_parent_id,occurred_at)
    VALUES (NEW.idglobal,
      (SELECT t.idcliente FROM tbl_tarjetas t WHERE t.idtarjeta=NEW.idtarjeta AND t.idglobal=NEW.idglobal),
      NEW.idsucursal,'payment_updated',NEW.iddescripcion,OLD.str_estado,NEW.str_estado,
      OLD.dec_abono,NEW.dec_abono,OLD.created_at,NEW.created_at,OLD.idtarjeta,NEW.idtarjeta,UTC_TIMESTAMP(3));
    IF NOT (OLD.idtarjeta <=> NEW.idtarjeta AND OLD.idglobal <=> NEW.idglobal) THEN
      INSERT INTO mobile_customer_rating_event
        (idglobal,idcliente,idsucursal,event_type,source_record_id,old_state,new_state,previous_amount,amount,
         old_record_at,new_record_at,old_parent_id,new_parent_id,occurred_at)
      VALUES (OLD.idglobal,
        (SELECT t.idcliente FROM tbl_tarjetas t WHERE t.idtarjeta=OLD.idtarjeta AND t.idglobal=OLD.idglobal),
        OLD.idsucursal,'payment_moved_out',OLD.iddescripcion,OLD.str_estado,NEW.str_estado,
        OLD.dec_abono,NEW.dec_abono,OLD.created_at,NEW.created_at,OLD.idtarjeta,NEW.idtarjeta,UTC_TIMESTAMP(3));
    END IF;
  END IF;
END$$

CREATE OR REPLACE TRIGGER trg_rating_descripcion_ad AFTER DELETE ON tbl_descripcion FOR EACH ROW
FOLLOWS trg_mobile_descripcion_ad
INSERT INTO mobile_customer_rating_event
  (idglobal,idcliente,idsucursal,event_type,source_record_id,old_state,new_state,previous_amount,amount,
   old_record_at,old_parent_id,occurred_at)
VALUES (OLD.idglobal,
  (SELECT t.idcliente FROM tbl_tarjetas t WHERE t.idtarjeta=OLD.idtarjeta AND t.idglobal=OLD.idglobal),
  OLD.idsucursal,'payment_deleted',OLD.iddescripcion,OLD.str_estado,NULL,OLD.dec_abono,NULL,
  OLD.created_at,OLD.idtarjeta,UTC_TIMESTAMP(3))$$

CREATE OR REPLACE TRIGGER trg_rating_tarjeta_ai AFTER INSERT ON tbl_tarjetas FOR EACH ROW
FOLLOWS trg_mobile_tarjeta_ai
INSERT INTO mobile_customer_rating_event
  (idglobal,idcliente,idsucursal,event_type,source_record_id,old_state,new_state,previous_amount,amount,
   new_value,new_term,new_mode,new_record_at,new_parent_id,occurred_at)
VALUES (NEW.idglobal,NEW.idcliente,NEW.idsucursal,'credit_created',NEW.idtarjeta,
  NULL,NEW.str_estado,NULL,NEW.dec_resta,NEW.dec_valor,NEW.int_tiempo,NEW.str_modo,NEW.created_at,
  CAST(NEW.idcliente AS CHAR),UTC_TIMESTAMP(3))$$

CREATE OR REPLACE TRIGGER trg_rating_tarjeta_au AFTER UPDATE ON tbl_tarjetas FOR EACH ROW
FOLLOWS trg_mobile_tarjeta_au
BEGIN
  IF NOT (OLD.str_estado <=> NEW.str_estado AND OLD.dec_resta <=> NEW.dec_resta
      AND OLD.dec_valor <=> NEW.dec_valor AND OLD.int_tiempo <=> NEW.int_tiempo
      AND OLD.str_modo <=> NEW.str_modo AND OLD.created_at <=> NEW.created_at
      AND OLD.idcliente <=> NEW.idcliente AND OLD.idglobal <=> NEW.idglobal) THEN
    INSERT INTO mobile_customer_rating_event
      (idglobal,idcliente,idsucursal,event_type,source_record_id,old_state,new_state,previous_amount,amount,
       old_value,new_value,old_term,new_term,old_mode,new_mode,old_record_at,new_record_at,
       old_parent_id,new_parent_id,occurred_at)
    VALUES (NEW.idglobal,NEW.idcliente,NEW.idsucursal,
      IF(OLD.str_estado <=> NEW.str_estado,'credit_changed','credit_status_changed'),NEW.idtarjeta,
      OLD.str_estado,NEW.str_estado,OLD.dec_resta,NEW.dec_resta,OLD.dec_valor,NEW.dec_valor,
      OLD.int_tiempo,NEW.int_tiempo,OLD.str_modo,NEW.str_modo,OLD.created_at,NEW.created_at,
      CAST(OLD.idcliente AS CHAR),CAST(NEW.idcliente AS CHAR),UTC_TIMESTAMP(3));
    IF NOT (OLD.idcliente <=> NEW.idcliente AND OLD.idglobal <=> NEW.idglobal) THEN
      INSERT INTO mobile_customer_rating_event
        (idglobal,idcliente,idsucursal,event_type,source_record_id,old_state,new_state,previous_amount,amount,
         old_value,new_value,old_term,new_term,old_mode,new_mode,old_record_at,new_record_at,
         old_parent_id,new_parent_id,occurred_at)
      VALUES (OLD.idglobal,OLD.idcliente,OLD.idsucursal,'credit_moved_out',OLD.idtarjeta,
        OLD.str_estado,NEW.str_estado,OLD.dec_resta,NEW.dec_resta,OLD.dec_valor,NEW.dec_valor,
        OLD.int_tiempo,NEW.int_tiempo,OLD.str_modo,NEW.str_modo,OLD.created_at,NEW.created_at,
        CAST(OLD.idcliente AS CHAR),CAST(NEW.idcliente AS CHAR),UTC_TIMESTAMP(3));
    END IF;
  END IF;
END$$

CREATE OR REPLACE TRIGGER trg_rating_tarjeta_ad AFTER DELETE ON tbl_tarjetas FOR EACH ROW
FOLLOWS trg_mobile_tarjeta_ad
INSERT INTO mobile_customer_rating_event
  (idglobal,idcliente,idsucursal,event_type,source_record_id,old_state,new_state,previous_amount,amount,
   old_value,old_term,old_mode,old_record_at,old_parent_id,occurred_at)
VALUES (OLD.idglobal,OLD.idcliente,OLD.idsucursal,'credit_deleted',OLD.idtarjeta,
  OLD.str_estado,NULL,OLD.dec_resta,NULL,OLD.dec_valor,OLD.int_tiempo,OLD.str_modo,OLD.created_at,
  CAST(OLD.idcliente AS CHAR),UTC_TIMESTAMP(3))$$

-- Customer sync for the ratingSource/ratingConfidence fields (customer DTO/sync payload): any change
-- of a visible value emits the same customer UPDATE event as trg_mobile_cliente_au, for every branch.
-- Daily re-evaluations that only refresh evaluated_at/score internals emit nothing here (a changed
-- effective rating already syncs through tbl_clientes).
CREATE OR REPLACE TRIGGER trg_rating_state_ai AFTER INSERT ON mobile_customer_rating_state FOR EACH ROW
INSERT INTO mobile_change_event
  (idglobal,idsucursal,record_type,record_id,action,related_id,created_at)
SELECT NEW.idglobal,mcb.idsucursal,'customer',CAST(NEW.idcliente AS CHAR),'UPDATE',
       CAST(c.idpersona AS CHAR),NOW()
FROM mobile_customer_branch mcb
JOIN tbl_clientes c ON c.idglobal=mcb.idglobal AND c.idcliente=mcb.idcliente
WHERE mcb.idglobal=NEW.idglobal AND mcb.idcliente=NEW.idcliente$$

CREATE OR REPLACE TRIGGER trg_rating_state_au AFTER UPDATE ON mobile_customer_rating_state FOR EACH ROW
BEGIN
  IF NOT (OLD.confidence <=> NEW.confidence AND OLD.manual_score <=> NEW.manual_score
      AND OLD.manual_until <=> NEW.manual_until
      AND (OLD.evaluated_at IS NULL) <=> (NEW.evaluated_at IS NULL)) THEN
    INSERT INTO mobile_change_event
      (idglobal,idsucursal,record_type,record_id,action,related_id,created_at)
    SELECT NEW.idglobal,mcb.idsucursal,'customer',CAST(NEW.idcliente AS CHAR),'UPDATE',
           CAST(c.idpersona AS CHAR),NOW()
    FROM mobile_customer_branch mcb
    JOIN tbl_clientes c ON c.idglobal=mcb.idglobal AND c.idcliente=mcb.idcliente
    WHERE mcb.idglobal=NEW.idglobal AND mcb.idcliente=NEW.idcliente;
  END IF;
END$$
DELIMITER ;

-- Preserve manual ratings saved under 013: if a customer's latest manual history row is still within
-- its own 7 days (created_at + 7 days, not extended by this migration) and is still the stored
-- rating, create its state so the engine keeps that priority. Runs after the state triggers so
-- APK/web receive ratingSource. Idempotent: customers that already have a state are skipped.
INSERT INTO mobile_customer_rating_state (idglobal,idcliente,manual_score,manual_until,next_evaluation_at)
SELECT h.idglobal,h.idcliente,h.score,h.created_at + INTERVAL 7 DAY,UTC_TIMESTAMP(3)
FROM mobile_customer_rating_history h
JOIN tbl_clientes c ON c.idglobal=h.idglobal AND c.idcliente=h.idcliente
WHERE h.source='manual' AND h.score IS NOT NULL
  AND h.created_at + INTERVAL 7 DAY > UTC_TIMESTAMP(3)
  AND BINARY c.str_calificacion=CAST(h.score AS CHAR)
  AND h.id=(SELECT MAX(h2.id) FROM mobile_customer_rating_history h2
            WHERE h2.idglobal=h.idglobal AND h2.idcliente=h.idcliente AND h2.source='manual')
  AND NOT EXISTS (SELECT 1 FROM mobile_customer_rating_state s
                  WHERE s.idglobal=h.idglobal AND s.idcliente=h.idcliente);
