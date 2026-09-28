-- Additive only. Manually review, back up, and test on a disposable MariaDB 10.x copy.
-- This file is never executed by the API, npm scripts, or tests.
-- New trigger names must be checked for collisions before the one-time trigger install.

CREATE TABLE IF NOT EXISTS `mobile_operation` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `operation_id` CHAR(36) NOT NULL,
  `idusuario` INT NOT NULL,
  `idglobal` INT NOT NULL,
  `operation_kind` VARCHAR(40) NOT NULL,
  `entity_id` VARCHAR(100) NOT NULL,
  `payload_hash` CHAR(64) NOT NULL,
  `result_json` LONGTEXT NULL,
  `state` VARCHAR(20) NOT NULL,
  `created_at` DATETIME NOT NULL,
  `completed_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mobile_operation_owner` (`operation_id`, `idusuario`, `idglobal`),
  KEY `ix_mobile_operation_entity` (`idglobal`, `entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `mobile_change_event` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `idglobal` INT NOT NULL,
  `idsucursal` INT NOT NULL,
  `record_type` VARCHAR(40) NOT NULL,
  `record_id` VARCHAR(100) NOT NULL,
  `action` VARCHAR(12) NOT NULL,
  `related_id` VARCHAR(100) NULL,
  `payload_json` LONGTEXT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_mobile_change_scope` (`idglobal`, `idsucursal`, `id`),
  KEY `ix_mobile_change_record` (`idglobal`, `record_type`, `record_id`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- A single transactional lock row makes event ID allocation commit-ordered.
-- The BEFORE INSERT trigger below acquires it for legacy trigger writes and API writes.
CREATE TABLE IF NOT EXISTS `mobile_change_lock` (
  `lock_id` TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (`lock_id`)
) ENGINE=InnoDB;

INSERT IGNORE INTO `mobile_change_lock` (`lock_id`) VALUES (1);

CREATE TRIGGER `trg_mobile_event_order` BEFORE INSERT ON `mobile_change_event` FOR EACH ROW
  INSERT INTO mobile_change_lock (lock_id) VALUES (1)
  ON DUPLICATE KEY UPDATE lock_id=VALUES(lock_id);

-- A company customer is visible in a branch only if it has a credit there, or
-- its creating employee has an active association to that same company/branch.
-- The view carries IDs only; API resolvers fetch branch-scoped records on demand.
CREATE VIEW `mobile_customer_branch` AS
  SELECT t.idglobal,t.idsucursal,t.idcliente
  FROM tbl_tarjetas t
  UNION
  SELECT c.idglobal,a.idsucursal,c.idcliente
  FROM tbl_clientes c
  JOIN tbl_auth_sucursal a ON a.idempleado=c.created_empleado_id
    AND a.idglobal=c.idglobal AND a.str_estado<>'inactivo'
  JOIN tbl_sucursal s ON s.idsucursal=a.idsucursal AND s.idglobal=a.idglobal
  UNION
  SELECT c.idglobal,e.idsucursal,c.idcliente
  FROM mobile_change_event e
  JOIN tbl_clientes c ON c.idglobal=e.idglobal
    AND CAST(c.idcliente AS CHAR)=e.record_id
  WHERE e.record_type='customer' AND e.action='INSERT';

CREATE VIEW `mobile_comment_branch` AS
  SELECT customer.idglobal,mcb.idsucursal,l.idcliente,l.idcomentario
  FROM tbl_comentarios_cliente l
  JOIN tbl_comentarios c ON c.idcomentario=l.idcomentario
  JOIN tbl_clientes customer ON customer.idcliente=l.idcliente
  JOIN mobile_customer_branch mcb
    ON mcb.idcliente=customer.idcliente AND mcb.idglobal=customer.idglobal;

-- Tenant-wide persona rows fan out only to branches where a linked customer is visible.
CREATE TRIGGER `trg_mobile_persona_ai` AFTER INSERT ON `tbl_persona` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,related_id,created_at)
  SELECT c.idglobal,mcb.idsucursal,'customer',CAST(c.idcliente AS CHAR),'INSERT',
         CAST(NEW.idpersona AS CHAR),NOW()
  FROM tbl_clientes c
  JOIN mobile_customer_branch mcb ON mcb.idglobal=c.idglobal AND mcb.idcliente=c.idcliente
  WHERE c.idglobal=NEW.idglobal AND c.idpersona=NEW.idpersona;

CREATE TRIGGER `trg_mobile_persona_au` AFTER UPDATE ON `tbl_persona` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,related_id,created_at)
  SELECT c.idglobal,mcb.idsucursal,'customer',CAST(c.idcliente AS CHAR),'UPDATE',
         CAST(NEW.idpersona AS CHAR),NOW()
  FROM tbl_clientes c
  JOIN mobile_customer_branch mcb ON mcb.idglobal=c.idglobal AND mcb.idcliente=c.idcliente
  WHERE c.idglobal=NEW.idglobal AND c.idpersona=NEW.idpersona;

CREATE TRIGGER `trg_mobile_persona_bd` BEFORE DELETE ON `tbl_persona` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,related_id,created_at)
  SELECT c.idglobal,mcb.idsucursal,'customer',CAST(c.idcliente AS CHAR),'DELETE',
         CAST(OLD.idpersona AS CHAR),NOW()
  FROM tbl_clientes c
  JOIN mobile_customer_branch mcb ON mcb.idglobal=c.idglobal AND mcb.idcliente=c.idcliente
  WHERE c.idglobal=OLD.idglobal AND c.idpersona=OLD.idpersona;

CREATE TRIGGER `trg_mobile_cliente_ai` AFTER INSERT ON `tbl_clientes` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,related_id,created_at)
  SELECT NEW.idglobal,mcb.idsucursal,'customer',CAST(NEW.idcliente AS CHAR),'INSERT',
         CAST(NEW.idpersona AS CHAR),NOW()
  FROM mobile_customer_branch mcb
  WHERE mcb.idglobal=NEW.idglobal AND mcb.idcliente=NEW.idcliente;

CREATE TRIGGER `trg_mobile_cliente_au` AFTER UPDATE ON `tbl_clientes` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,related_id,created_at)
  SELECT NEW.idglobal,mcb.idsucursal,'customer',CAST(NEW.idcliente AS CHAR),'UPDATE',
         CAST(NEW.idpersona AS CHAR),NOW()
  FROM mobile_customer_branch mcb
  WHERE mcb.idglobal=NEW.idglobal AND mcb.idcliente=NEW.idcliente;

CREATE TRIGGER `trg_mobile_cliente_bd` BEFORE DELETE ON `tbl_clientes` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,related_id,created_at)
  SELECT OLD.idglobal,mcb.idsucursal,'customer',CAST(OLD.idcliente AS CHAR),'DELETE',
         CAST(OLD.idpersona AS CHAR),NOW()
  FROM mobile_customer_branch mcb
  WHERE mcb.idglobal=OLD.idglobal AND mcb.idcliente=OLD.idcliente;

-- Credit writes also refresh their customer cache; deletes keep a branch tombstone.
CREATE TRIGGER `trg_mobile_tarjeta_ai` AFTER INSERT ON `tbl_tarjetas` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,related_id,created_at)
  VALUES
    (NEW.idglobal,NEW.idsucursal,'credit',NEW.idtarjeta,'INSERT',CAST(NEW.idcliente AS CHAR),NOW()),
    (NEW.idglobal,NEW.idsucursal,'customer',CAST(NEW.idcliente AS CHAR),'UPDATE',NULL,NOW());

CREATE TRIGGER `trg_mobile_tarjeta_au` AFTER UPDATE ON `tbl_tarjetas` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,related_id,created_at)
  VALUES
    (NEW.idglobal,NEW.idsucursal,'credit',NEW.idtarjeta,'UPDATE',CAST(NEW.idcliente AS CHAR),NOW()),
    (NEW.idglobal,NEW.idsucursal,'customer',CAST(NEW.idcliente AS CHAR),'UPDATE',NULL,NOW());

CREATE TRIGGER `trg_mobile_tarjeta_ad` AFTER DELETE ON `tbl_tarjetas` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,related_id,created_at)
  VALUES
    (OLD.idglobal,OLD.idsucursal,'credit',OLD.idtarjeta,'DELETE',CAST(OLD.idcliente AS CHAR),NOW()),
    (OLD.idglobal,OLD.idsucursal,'customer',CAST(OLD.idcliente AS CHAR),'UPDATE',NULL,NOW());

-- A payment mutation also affects its credit balance. Payment deletes are tombstones.
CREATE TRIGGER `trg_mobile_descripcion_ai` AFTER INSERT ON `tbl_descripcion` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,related_id,created_at)
  VALUES
    (NEW.idglobal,NEW.idsucursal,'payment',NEW.iddescripcion,'INSERT',NEW.idtarjeta,NOW()),
    (NEW.idglobal,NEW.idsucursal,'credit',NEW.idtarjeta,'UPDATE',NULL,NOW());

CREATE TRIGGER `trg_mobile_descripcion_au` AFTER UPDATE ON `tbl_descripcion` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,related_id,created_at)
  VALUES
    (NEW.idglobal,NEW.idsucursal,'payment',NEW.iddescripcion,'UPDATE',NEW.idtarjeta,NOW()),
    (NEW.idglobal,NEW.idsucursal,'credit',NEW.idtarjeta,'UPDATE',NULL,NOW());

CREATE TRIGGER `trg_mobile_descripcion_ad` AFTER DELETE ON `tbl_descripcion` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,related_id,created_at)
  VALUES
    (OLD.idglobal,OLD.idsucursal,'payment',OLD.iddescripcion,'DELETE',OLD.idtarjeta,NOW()),
    (OLD.idglobal,OLD.idsucursal,'credit',OLD.idtarjeta,'UPDATE',NULL,NOW());

-- New comments are visible only after a customer-link insert. Updates fan out per
-- customer-link branch. DELETE triggers run before either referenced row disappears.
CREATE TRIGGER `trg_mobile_comentario_ai` AFTER INSERT ON `tbl_comentarios` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,related_id,created_at)
  SELECT mcb.idglobal,mcb.idsucursal,'comment',NEW.idcomentario,'INSERT',
         CAST(mcb.idcliente AS CHAR),NOW()
  FROM mobile_comment_branch mcb WHERE mcb.idcomentario=NEW.idcomentario;

CREATE TRIGGER `trg_mobile_comentario_au` AFTER UPDATE ON `tbl_comentarios` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,related_id,created_at)
  SELECT mcb.idglobal,mcb.idsucursal,'comment',NEW.idcomentario,'UPDATE',
         CAST(mcb.idcliente AS CHAR),NOW()
  FROM mobile_comment_branch mcb WHERE mcb.idcomentario=NEW.idcomentario;

CREATE TRIGGER `trg_mobile_comentario_bd` BEFORE DELETE ON `tbl_comentarios` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,related_id,created_at)
  SELECT mcb.idglobal,mcb.idsucursal,'comment',OLD.idcomentario,'DELETE',
         CAST(mcb.idcliente AS CHAR),NOW()
  FROM mobile_comment_branch mcb WHERE mcb.idcomentario=OLD.idcomentario;

CREATE TRIGGER `trg_mobile_comentario_cliente_ai` AFTER INSERT ON `tbl_comentarios_cliente` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,related_id,created_at)
  SELECT mcb.idglobal,mcb.idsucursal,'comment',NEW.idcomentario,'INSERT',
         CAST(NEW.idcliente AS CHAR),NOW()
  FROM mobile_customer_branch mcb
  WHERE mcb.idcliente=NEW.idcliente AND mcb.idglobal=(
    SELECT c.idglobal FROM tbl_clientes c WHERE c.idcliente=NEW.idcliente LIMIT 1);

-- Moving a link emits a tombstone for the old customer, then an upsert for the new.
CREATE TRIGGER `trg_mobile_comentario_cliente_bu` BEFORE UPDATE ON `tbl_comentarios_cliente` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,related_id,created_at)
  SELECT mcb.idglobal,mcb.idsucursal,'comment',OLD.idcomentario,'DELETE',
         CAST(OLD.idcliente AS CHAR),NOW()
  FROM mobile_customer_branch mcb
  WHERE mcb.idcliente=OLD.idcliente AND mcb.idglobal=(
    SELECT c.idglobal FROM tbl_clientes c WHERE c.idcliente=OLD.idcliente LIMIT 1);

CREATE TRIGGER `trg_mobile_comentario_cliente_au` AFTER UPDATE ON `tbl_comentarios_cliente` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,related_id,created_at)
  SELECT mcb.idglobal,mcb.idsucursal,'comment',NEW.idcomentario,'INSERT',
         CAST(NEW.idcliente AS CHAR),NOW()
  FROM mobile_customer_branch mcb
  WHERE mcb.idcliente=NEW.idcliente AND mcb.idglobal=(
    SELECT c.idglobal FROM tbl_clientes c WHERE c.idcliente=NEW.idcliente LIMIT 1);

CREATE TRIGGER `trg_mobile_comentario_cliente_bd` BEFORE DELETE ON `tbl_comentarios_cliente` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,related_id,created_at)
  SELECT mcb.idglobal,mcb.idsucursal,'comment',OLD.idcomentario,'DELETE',
         CAST(OLD.idcliente AS CHAR),NOW()
  FROM mobile_customer_branch mcb
  WHERE mcb.idcliente=OLD.idcliente AND mcb.idglobal=(
    SELECT c.idglobal FROM tbl_clientes c WHERE c.idcliente=OLD.idcliente LIMIT 1);

CREATE TRIGGER `trg_mobile_route_ai` AFTER INSERT ON `tbl_detalle_ruta` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,created_at)
  VALUES (NEW.idglobal,NEW.idsucursal,'route',CAST(NEW.iddetalleruta AS CHAR),'INSERT',NOW());
CREATE TRIGGER `trg_mobile_route_au` AFTER UPDATE ON `tbl_detalle_ruta` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,created_at)
  VALUES (NEW.idglobal,NEW.idsucursal,'route',CAST(NEW.iddetalleruta AS CHAR),'UPDATE',NOW());
CREATE TRIGGER `trg_mobile_route_ad` AFTER DELETE ON `tbl_detalle_ruta` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,created_at)
  VALUES (OLD.idglobal,OLD.idsucursal,'route',CAST(OLD.iddetalleruta AS CHAR),'DELETE',NOW());

CREATE TRIGGER `trg_mobile_branch_ai` AFTER INSERT ON `tbl_sucursal` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,created_at)
  VALUES (NEW.idglobal,NEW.idsucursal,'branch',CAST(NEW.idsucursal AS CHAR),'INSERT',NOW());
CREATE TRIGGER `trg_mobile_branch_au` AFTER UPDATE ON `tbl_sucursal` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,created_at)
  VALUES (NEW.idglobal,NEW.idsucursal,'branch',CAST(NEW.idsucursal AS CHAR),'UPDATE',NOW());
CREATE TRIGGER `trg_mobile_branch_ad` AFTER DELETE ON `tbl_sucursal` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,created_at)
  VALUES (OLD.idglobal,OLD.idsucursal,'branch',CAST(OLD.idsucursal AS CHAR),'DELETE',NOW());

CREATE TRIGGER `trg_mobile_access_ai` AFTER INSERT ON `tbl_auth_sucursal` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,related_id,created_at)
  SELECT NEW.idglobal,NEW.idsucursal,'branch_access',CAST(NEW.idauth_sucursal AS CHAR),
         'INSERT',CAST(NEW.idempleado AS CHAR),NOW()
  UNION ALL
  SELECT c.idglobal,NEW.idsucursal,'customer',CAST(c.idcliente AS CHAR),'UPDATE',
         CAST(c.idpersona AS CHAR),NOW()
  FROM tbl_clientes c
  LEFT JOIN tbl_tarjetas t ON t.idcliente=c.idcliente AND t.idglobal=c.idglobal
    AND t.idsucursal=NEW.idsucursal
  WHERE c.idglobal=NEW.idglobal AND c.created_empleado_id=NEW.idempleado
    AND t.idtarjeta IS NULL;
CREATE TRIGGER `trg_mobile_access_au` AFTER UPDATE ON `tbl_auth_sucursal` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,related_id,created_at)
  SELECT NEW.idglobal,NEW.idsucursal,'branch_access',CAST(NEW.idauth_sucursal AS CHAR),
         'UPDATE',CAST(NEW.idempleado AS CHAR),NOW()
  UNION ALL
  SELECT c.idglobal,NEW.idsucursal,'customer',CAST(c.idcliente AS CHAR),'UPDATE',
         CAST(c.idpersona AS CHAR),NOW()
  FROM tbl_clientes c
  LEFT JOIN tbl_tarjetas t ON t.idcliente=c.idcliente AND t.idglobal=c.idglobal
    AND t.idsucursal=NEW.idsucursal
  WHERE c.idglobal=NEW.idglobal AND c.created_empleado_id=NEW.idempleado
    AND t.idtarjeta IS NULL;
CREATE TRIGGER `trg_mobile_access_ad` AFTER DELETE ON `tbl_auth_sucursal` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,related_id,created_at)
  SELECT OLD.idglobal,OLD.idsucursal,'branch_access',CAST(OLD.idauth_sucursal AS CHAR),
         'DELETE',CAST(OLD.idempleado AS CHAR),NOW()
  UNION ALL
  SELECT c.idglobal,OLD.idsucursal,'customer',CAST(c.idcliente AS CHAR),'UPDATE',
         CAST(c.idpersona AS CHAR),NOW()
  FROM tbl_clientes c
  LEFT JOIN tbl_tarjetas t ON t.idcliente=c.idcliente AND t.idglobal=c.idglobal
    AND t.idsucursal=OLD.idsucursal
  WHERE c.idglobal=OLD.idglobal AND c.created_empleado_id=OLD.idempleado
    AND t.idtarjeta IS NULL;

CREATE TRIGGER `trg_mobile_receipt_ai` AFTER INSERT ON `tbl_detalle_documento_sucursal` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,created_at)
  VALUES (NEW.idglobal,NEW.idsucursal,'receipt_sequence',
          CAST(NEW.iddetalle_documento_sucursal AS CHAR),'INSERT',NOW());
CREATE TRIGGER `trg_mobile_receipt_au` AFTER UPDATE ON `tbl_detalle_documento_sucursal` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,created_at)
  VALUES (NEW.idglobal,NEW.idsucursal,'receipt_sequence',
          CAST(NEW.iddetalle_documento_sucursal AS CHAR),'UPDATE',NOW());
CREATE TRIGGER `trg_mobile_receipt_ad` AFTER DELETE ON `tbl_detalle_documento_sucursal` FOR EACH ROW
  INSERT INTO mobile_change_event
    (idglobal,idsucursal,record_type,record_id,action,created_at)
  VALUES (OLD.idglobal,OLD.idsucursal,'receipt_sequence',
          CAST(OLD.iddetalle_documento_sucursal AS CHAR),'DELETE',NOW());
