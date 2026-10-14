-- Forward migration after 015. Stop writers; apply manually with a backup.
-- Old vacations/bonuses remain auditable; new writes require the v2 routines.
ALTER TABLE tbl_employee_payroll_vacation ADD COLUMN IF NOT EXISTS replacement_employee_id INT NULL;
ALTER TABLE tbl_employee_payroll_bonus ADD COLUMN IF NOT EXISTS expense_id VARCHAR(50) NULL;
ALTER TABLE tbl_employee_payroll_bonus ADD COLUMN IF NOT EXISTS cancelled_at DATETIME NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bonus_expense ON tbl_employee_payroll_bonus(idglobal,expense_id);

CREATE TABLE IF NOT EXISTS tbl_employee_payroll_coverage (
  vacation_id BIGINT UNSIGNED NOT NULL, idglobal INT NOT NULL, branch_id INT NOT NULL,
  holder_employee_id INT NOT NULL, replacement_employee_id INT NOT NULL,
  start_date DATE NOT NULL, end_date DATE NOT NULL,
  actor_user_id INT NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(vacation_id,branch_id),
  KEY replacement_dates(idglobal,replacement_employee_id,start_date,end_date),
  FOREIGN KEY(vacation_id) REFERENCES tbl_employee_payroll_vacation(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS tbl_employee_payroll_coverage_contract (
  vacation_id BIGINT UNSIGNED NOT NULL, contract_id BIGINT UNSIGNED NOT NULL,
  start_date DATE NOT NULL, end_date DATE NOT NULL,
  salary_type ENUM('Fijo','Porcentaje','Combinado') NOT NULL,
  capital_rate DECIMAL(9,6) NOT NULL, collection_rate DECIMAL(9,6) NOT NULL,
  PRIMARY KEY(vacation_id,start_date),
  FOREIGN KEY(vacation_id) REFERENCES tbl_employee_payroll_vacation(id),
  FOREIGN KEY(contract_id) REFERENCES tbl_employee_payroll_contract(id)
) ENGINE=InnoDB;

CREATE OR REPLACE VIEW view_employee_payroll_active_coverage AS
SELECT c.* FROM tbl_employee_payroll_coverage c
JOIN tbl_empleado e ON e.idglobal=c.idglobal AND e.idempleado=c.replacement_employee_id AND e.str_estado='activo'
JOIN tbl_sucursal s ON s.idglobal=c.idglobal AND s.idsucursal=c.branch_id
WHERE DATE(UTC_TIMESTAMP()-INTERVAL 5 HOUR) BETWEEN c.start_date AND c.end_date;

-- Coverage supplies branch scope only. Actions use the replacement's own
-- active grants in this exact branch, never grants from any other branch.
CREATE OR REPLACE VIEW view_employee_payroll_temporary_permission AS
SELECT DISTINCT c.idglobal,c.branch_id,c.replacement_employee_id AS employee_id,a.str_nombre AS permission
FROM view_employee_payroll_active_coverage c
JOIN tbl_auth_sucursal g ON g.idglobal=c.idglobal AND g.idsucursal=c.branch_id
  AND g.idempleado=c.replacement_employee_id AND g.str_estado<>'inactivo'
JOIN tbl_sucursal own_branch ON own_branch.idglobal=g.idglobal AND own_branch.idsucursal=g.idsucursal
JOIN tbl_auths x ON x.idauth_sucursal=g.idauth_sucursal
JOIN tbl_auth a ON a.idauth=x.idauth;

CREATE OR REPLACE VIEW view_employee_payroll_bonus_manager AS
SELECT u.idglobal,u.idusuario AS actor_user_id,s.idsucursal AS branch_id
FROM tbl_usuario u
JOIN tbl_empleado e ON e.idglobal=u.idglobal AND e.idpersona=u.idpersona
JOIN tbl_sucursal s ON s.idglobal=e.idglobal
JOIN tbl_oficina o ON o.idglobal=s.idglobal AND o.idoficina=s.idoficina
WHERE u.str_estado='activo' AND e.str_estado='activo'
  AND (e.str_cargo='Super Administrador' OR o.idempleado_administrador=e.idempleado);

-- A source snapshot's holder share is transferred, never copied. Coverage
-- freezes the replacement's own terms; their normal share remains independent.
CREATE OR REPLACE VIEW view_employee_payroll_effective_allocation AS
SELECT m.idglobal,s.employee_id AS employeeId,m.route_id AS routeId,m.movement_id AS movementId,
  m.movement_date AS movementDate,s.contract_id AS contractId,s.salary_type AS type,
  s.weight,s.capital_rate AS capitalRate,s.collection_rate AS collectionRate,
  pr.mode,m.capital AS capitalAmount,m.collected AS cashAmount,
  CAST(NULL AS UNSIGNED) AS vacationId,CAST(NULL AS SIGNED) AS coveredEmployeeId
FROM view_employee_payroll_movement m
JOIN tbl_employee_payroll_snapshot s ON s.idglobal=m.idglobal AND s.route_id=m.route_id
JOIN tbl_employee_payroll_route pr ON pr.idglobal=s.idglobal AND pr.route_id=s.route_id
UNION ALL
SELECT m.idglobal,c.replacement_employee_id,m.route_id,m.movement_id,m.movement_date,
  cc.contract_id,cc.salary_type,s.weight,cc.capital_rate,cc.collection_rate,
  pr.mode,m.capital,m.collected,c.vacation_id,c.holder_employee_id
FROM view_employee_payroll_movement m
JOIN tbl_employee_payroll_route pr ON pr.idglobal=m.idglobal AND pr.route_id=m.route_id
JOIN tbl_employee_payroll_coverage c ON c.idglobal=m.idglobal AND c.branch_id=pr.branch_id
  AND m.movement_date BETWEEN c.start_date AND c.end_date
JOIN tbl_employee_payroll_snapshot s ON s.idglobal=m.idglobal AND s.route_id=m.route_id
  AND s.employee_id=c.holder_employee_id
JOIN tbl_employee_payroll_coverage_contract cc ON cc.vacation_id=c.vacation_id
  AND m.movement_date BETWEEN cc.start_date AND cc.end_date;

CREATE OR REPLACE VIEW view_employee_payroll_attribution AS
SELECT a.*,r.idsucursal AS branchId,b.str_codigo AS branchName,r.str_estado AS state,
  (r.str_estado<>'saved') AS provisional,
  CASE WHEN EXISTS(SELECT 1 FROM tbl_employee_payroll_vacation v
    WHERE v.idglobal=a.idglobal AND v.employee_id=a.employeeId
      AND a.movementDate BETWEEN v.start_date AND v.end_date) THEN 'VACATION'
    WHEN a.contractId IS NULL THEN 'NO_CONTRACT'
    WHEN a.type='Fijo' THEN 'FIXED' ELSE NULL END AS excludedReason,
  a.capitalAmount*a.weight*a.capitalRate/10000 AS rawCapitalCommission,
  a.cashAmount*a.weight*a.collectionRate/10000 AS rawCollectionCommission
FROM view_employee_payroll_effective_allocation a
JOIN tbl_detalle_ruta r ON r.idglobal=a.idglobal AND r.iddetalleruta=a.routeId
JOIN tbl_sucursal b ON b.idglobal=r.idglobal AND b.idsucursal=r.idsucursal;
CREATE OR REPLACE VIEW view_employee_payroll_breakdown AS
SELECT a.*,IF(excludedReason IS NULL,rawCapitalCommission,0) AS capitalCommission,
  IF(excludedReason IS NULL,rawCollectionCommission,0) AS collectionCommission
FROM view_employee_payroll_attribution a;

DELIMITER $$
DROP TRIGGER IF EXISTS payroll_vacation_requires_replacement$$
CREATE TRIGGER payroll_vacation_requires_replacement BEFORE INSERT ON tbl_employee_payroll_vacation FOR EACH ROW
BEGIN
  IF NEW.replacement_employee_id IS NULL OR NEW.replacement_employee_id=NEW.employee_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_REPLACEMENT_REQUIRED';
  END IF;
END$$
DROP TRIGGER IF EXISTS payroll_bonus_requires_cash_scope$$
CREATE TRIGGER payroll_bonus_requires_cash_scope BEFORE INSERT ON tbl_employee_payroll_bonus FOR EACH ROW
BEGIN
  IF NEW.expense_id IS NULL OR NOT EXISTS(SELECT 1 FROM tbl_contabilidad_detalle d
      JOIN tbl_detalle_ruta r ON r.idglobal=d.idglobal AND r.iddetalleruta=d.iddetalleruta
      JOIN tbl_detalle_nomina dn ON dn.idglobal=d.idglobal AND dn.idcontabilidad_detalle=d.idcontabilidad_detalle
      JOIN tbl_nomina n ON n.idglobal=dn.idglobal AND n.idnomina=dn.idnomina AND n.idempleado=NEW.employee_id
      WHERE d.idglobal=NEW.idglobal AND d.idcontabilidad_detalle=NEW.expense_id
        AND r.str_estado='created' AND d.idtipo_contabilidad=2 AND d.dec_total=-NEW.amount
        AND d.str_operacion='salida-totalizar') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_BONUS_CASH_SCOPE_REQUIRED';
  END IF;
END$$
DROP TRIGGER IF EXISTS payroll_bonus_expense_guard$$
CREATE TRIGGER payroll_bonus_expense_guard BEFORE UPDATE ON tbl_contabilidad_detalle FOR EACH ROW
BEGIN
  IF OLD.str_operacion='salida-totalizar'
    AND (NOT(NEW.dec_total<=>OLD.dec_total) OR NOT(NEW.str_detalle<=>OLD.str_detalle) OR NOT(NEW.str_nombre<=>OLD.str_nombre)
      OR NOT(NEW.idtipo_contabilidad<=>OLD.idtipo_contabilidad))
    AND NOT EXISTS(SELECT 1 FROM tbl_detalle_ruta r WHERE r.idglobal=OLD.idglobal
      AND r.iddetalleruta=OLD.iddetalleruta AND r.str_estado='created') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_EXPENSE_ROUTE_CLOSED';
  END IF;
  IF EXISTS(SELECT 1 FROM tbl_employee_payroll_bonus b WHERE b.idglobal=OLD.idglobal AND b.expense_id=OLD.idcontabilidad_detalle)
    AND (NOT(NEW.idglobal<=>OLD.idglobal) OR NOT(NEW.idcontabilidad_detalle<=>OLD.idcontabilidad_detalle)
      OR NOT(NEW.idsucursal<=>OLD.idsucursal) OR NOT(NEW.iddetalleruta<=>OLD.iddetalleruta)
      OR NOT(NEW.idtipo_contabilidad<=>2) OR NOT(NEW.str_operacion<=>'salida-totalizar') OR NOT(NEW.str_nombre<=>'Bono')
      OR NOT(NEW.created_at<=>OLD.created_at)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_BONUS_EXPENSE_IMMUTABLE_SCOPE';
  END IF;
END$$
DROP TRIGGER IF EXISTS payroll_expense_delete_guard$$
CREATE TRIGGER payroll_expense_delete_guard BEFORE DELETE ON tbl_contabilidad_detalle FOR EACH ROW
BEGIN
  -- Legacy settlement removes zero-valued rows after closing the route.
  IF OLD.str_operacion='salida-totalizar' AND NOT(OLD.dec_total<=>0) AND NOT EXISTS(
    SELECT 1 FROM tbl_detalle_ruta r WHERE r.idglobal=OLD.idglobal AND r.iddetalleruta=OLD.iddetalleruta
      AND r.str_estado='created') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_EXPENSE_ROUTE_CLOSED';
  END IF;
END$$
DROP TRIGGER IF EXISTS payroll_bonus_expense_update$$
CREATE TRIGGER payroll_bonus_expense_update AFTER UPDATE ON tbl_contabilidad_detalle FOR EACH ROW
BEGIN
  UPDATE tbl_employee_payroll_bonus SET amount=-NEW.dec_total,reason=NEW.str_detalle,
    cancelled_at=IF(NEW.dec_total=0,NOW(),NULL)
  WHERE idglobal=NEW.idglobal AND expense_id=NEW.idcontabilidad_detalle;
END$$
DROP TRIGGER IF EXISTS payroll_bonus_expense_delete$$
CREATE TRIGGER payroll_bonus_expense_delete AFTER DELETE ON tbl_contabilidad_detalle FOR EACH ROW
BEGIN
  UPDATE tbl_employee_payroll_bonus SET amount=0,cancelled_at=NOW()
    WHERE idglobal=OLD.idglobal AND expense_id=OLD.idcontabilidad_detalle;
  DELETE FROM tbl_detalle_nomina WHERE idglobal=OLD.idglobal AND idcontabilidad_detalle=OLD.idcontabilidad_detalle;
END$$
DROP TRIGGER IF EXISTS payroll_bonus_link_guard$$
CREATE TRIGGER payroll_bonus_link_guard BEFORE INSERT ON tbl_detalle_nomina FOR EACH ROW
BEGIN
  IF EXISTS(SELECT 1 FROM tbl_employee_payroll_bonus b
    WHERE b.idglobal=NEW.idglobal AND b.expense_id=NEW.idcontabilidad_detalle AND NOT EXISTS(
      SELECT 1 FROM tbl_nomina n WHERE n.idglobal=NEW.idglobal AND n.idnomina=NEW.idnomina AND n.idempleado=b.employee_id)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_BONUS_BENEFICIARY_IMMUTABLE';
  END IF;
END$$
DROP TRIGGER IF EXISTS payroll_bonus_link_update_guard$$
CREATE TRIGGER payroll_bonus_link_update_guard BEFORE UPDATE ON tbl_detalle_nomina FOR EACH ROW
BEGIN
  IF EXISTS(SELECT 1 FROM tbl_employee_payroll_bonus b WHERE b.idglobal=OLD.idglobal
    AND b.expense_id=OLD.idcontabilidad_detalle AND
      (NOT(NEW.idglobal<=>OLD.idglobal) OR NOT(NEW.idcontabilidad_detalle<=>OLD.idcontabilidad_detalle) OR NOT EXISTS(
        SELECT 1 FROM tbl_nomina n WHERE n.idglobal=NEW.idglobal AND n.idnomina=NEW.idnomina AND n.idempleado=b.employee_id))) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_BONUS_BENEFICIARY_IMMUTABLE';
  END IF;
END$$
DROP TRIGGER IF EXISTS payroll_bonus_link_delete$$
CREATE TRIGGER payroll_bonus_link_delete BEFORE DELETE ON tbl_detalle_nomina FOR EACH ROW
BEGIN
  IF EXISTS(SELECT 1 FROM tbl_employee_payroll_bonus b JOIN tbl_contabilidad_detalle d
    ON d.idglobal=b.idglobal AND d.idcontabilidad_detalle=b.expense_id
    WHERE b.idglobal=OLD.idglobal AND b.expense_id=OLD.idcontabilidad_detalle) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_BONUS_LINK_REQUIRED';
  END IF;
END$$
DROP TRIGGER IF EXISTS payroll_bonus_link_insert$$
CREATE TRIGGER payroll_bonus_link_insert AFTER INSERT ON tbl_detalle_nomina FOR EACH ROW
BEGIN
  UPDATE tbl_employee_payroll_bonus b JOIN tbl_contabilidad_detalle d
    ON d.idglobal=b.idglobal AND d.idcontabilidad_detalle=b.expense_id
  SET b.amount=-d.dec_total WHERE b.idglobal=NEW.idglobal AND b.expense_id=NEW.idcontabilidad_detalle;
END$$

DROP PROCEDURE IF EXISTS sp_employee_payroll_routes$$
CREATE PROCEDURE sp_employee_payroll_routes(IN p_company INT,IN p_employee INT,IN p_start DATE,IN p_end DATE)
BEGIN
  WITH parts AS (
    SELECT s.route_id AS routeId,s.contract_id AS contractId,s.salary_type AS type,s.weight,
      s.capital_rate AS capitalRate,s.collection_rate AS collectionRate,pr.mode,
      CAST(NULL AS UNSIGNED) AS vacationId,CAST(NULL AS SIGNED) AS coveredEmployeeId
    FROM tbl_employee_payroll_snapshot s
    JOIN tbl_employee_payroll_route pr ON pr.idglobal=s.idglobal AND pr.route_id=s.route_id
    WHERE s.idglobal=p_company AND s.employee_id=p_employee
    UNION ALL
    SELECT s.route_id,cc.contract_id,cc.salary_type,s.weight,cc.capital_rate,cc.collection_rate,'Relevo',
      c.vacation_id,c.holder_employee_id
    FROM tbl_employee_payroll_coverage c
    JOIN tbl_employee_payroll_coverage_contract cc ON cc.vacation_id=c.vacation_id
      AND cc.start_date<=p_end AND cc.end_date>=p_start
    JOIN tbl_employee_payroll_route pr ON pr.idglobal=c.idglobal AND pr.branch_id=c.branch_id
    JOIN tbl_employee_payroll_snapshot s ON s.idglobal=pr.idglobal AND s.route_id=pr.route_id
      AND s.employee_id=c.holder_employee_id
    WHERE c.idglobal=p_company AND c.replacement_employee_id=p_employee
      AND c.start_date<=p_end AND c.end_date>=p_start
  ), amounts AS (
    SELECT routeId,contractId,vacationId,SUM(capitalCommission) AS capitalCommission,
      SUM(collectionCommission) AS collectionCommission,SUM(capitalAmount) AS capitalAmount,SUM(cashAmount) AS cashAmount
    FROM view_employee_payroll_breakdown WHERE idglobal=p_company AND employeeId=p_employee
      AND movementDate BETWEEN p_start AND p_end
    GROUP BY routeId,contractId,vacationId
  )
  SELECT q.*,r.idsucursal AS branchId,b.str_codigo AS branchName,r.str_estado AS state,
    (r.str_estado<>'saved') AS provisional,DATE_FORMAT(pr.opened_at,'%Y-%m-%d %H:%i:%s') AS openedAt,
    ROUND(COALESCE(a.capitalCommission,0),2) AS capitalCommission,
    ROUND(COALESCE(a.collectionCommission,0),2) AS collectionCommission,
    COALESCE(a.capitalAmount,0) AS capitalAmount,COALESCE(a.cashAmount,0) AS cashAmount
  FROM parts q
  JOIN tbl_employee_payroll_route pr ON pr.idglobal=p_company AND pr.route_id=q.routeId
  JOIN tbl_detalle_ruta r ON r.idglobal=p_company AND r.iddetalleruta=q.routeId
  JOIN tbl_sucursal b ON b.idglobal=r.idglobal AND b.idsucursal=r.idsucursal
  LEFT JOIN amounts a ON a.routeId=q.routeId AND a.contractId<=>q.contractId AND a.vacationId<=>q.vacationId
  WHERE DATE(pr.opened_at) BETWEEN p_start AND p_end OR a.routeId IS NOT NULL
  ORDER BY pr.opened_at,q.routeId,q.vacationId,q.contractId;
END$$

DROP PROCEDURE IF EXISTS sp_employee_payroll_bonus_context$$
CREATE PROCEDURE sp_employee_payroll_bonus_context(IN p_company INT,IN p_actor INT,IN p_branch INT,IN p_route INT)
BEGIN
  DECLARE v_actor INT; DECLARE v_cargo VARCHAR(50); DECLARE v_route INT; DECLARE v_open_date DATE;
  SELECT e.idempleado,e.str_cargo INTO v_actor,v_cargo FROM tbl_usuario u
    JOIN tbl_empleado e ON e.idglobal=u.idglobal AND e.idpersona=u.idpersona
    WHERE u.idglobal=p_company AND u.idusuario=p_actor AND u.str_estado='activo' AND e.str_estado='activo';
  IF v_actor IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_UNAUTHENTICATED'; END IF;
  SELECT iddetalleruta,DATE(created_at) INTO v_route,v_open_date FROM tbl_detalle_ruta
    WHERE idglobal=p_company AND idsucursal=p_branch AND str_estado='created'
    ORDER BY created_at DESC,iddetalleruta DESC LIMIT 1;
  IF v_route IS NULL OR v_open_date IS NULL OR v_open_date>DATE(UTC_TIMESTAMP()-INTERVAL 5 HOUR)
    OR (p_route IS NOT NULL AND p_route<>v_route) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_ROUTE_CLOSED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM view_employee_payroll_bonus_manager
    WHERE idglobal=p_company AND actor_user_id=p_actor AND branch_id=p_branch) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_FORBIDDEN';
  END IF;
  SELECT p_branch AS branchId,v_route AS routeId,'created' AS state,
    n.idempleado AS employeeId,TRIM(CONCAT_WS(' ',p.str_nombres,p.str_apellidos)) AS name
  FROM tbl_nomina n
  JOIN tbl_empleado e ON e.idglobal=n.idglobal AND e.idempleado=n.idempleado AND e.str_estado='activo'
  JOIN tbl_persona p ON p.idglobal=e.idglobal AND p.idpersona=e.idpersona
  JOIN tbl_sucursal s ON s.idglobal=n.idglobal AND s.idsucursal=p_branch
  LEFT JOIN tbl_oficina o ON o.idglobal=s.idglobal AND o.idoficina=s.idoficina
  WHERE n.idglobal=p_company AND n.str_estado='activo'
    AND (v_cargo='Super Administrador' OR (o.idempleado_administrador=v_actor AND e.idoficina=s.idoficina))
  GROUP BY n.idempleado,p.str_nombres,p.str_apellidos
  ORDER BY name;
END$$

DROP PROCEDURE IF EXISTS sp_employee_payroll_change_v2$$
CREATE PROCEDURE sp_employee_payroll_change_v2(IN p_company INT,IN p_actor INT,IN p_action VARCHAR(20),IN p_data LONGTEXT)
change_v2: BEGIN
  DECLARE v_actor INT; DECLARE v_cargo VARCHAR(50); DECLARE v_employee INT; DECLARE v_replacement INT;
  DECLARE v_locked_user INT;
  DECLARE v_branch INT; DECLARE v_route INT; DECLARE v_id BIGINT; DECLARE v_payroll INT;
  DECLARE v_token VARCHAR(100); DECLARE v_hash CHAR(64); DECLARE v_old_hash CHAR(64); DECLARE v_old_actor INT;
  DECLARE v_date DATE; DECLARE v_end DATE; DECLARE v_now DATETIME; DECLARE v_reason VARCHAR(250);
  DECLARE v_amount DECIMAL(10,2); DECLARE v_expense VARCHAR(50); DECLARE v_state VARCHAR(15);
  DECLARE v_current_route INT; DECLARE v_open_date DATE;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  IF p_action IN ('contrato','reparto') THEN
    CALL sp_employee_payroll_change(p_company,p_actor,p_action,p_data); LEAVE change_v2;
  END IF;
  IF NOT JSON_VALID(p_data) OR p_action NOT IN ('vacacion','bono') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_INVALID_INPUT';
  END IF;
  START TRANSACTION;
  SET v_now=UTC_TIMESTAMP()-INTERVAL 5 HOUR;
  -- Serialize same-actor retries before target/route locks and trigger reads.
  SELECT idusuario INTO v_locked_user FROM tbl_usuario
    WHERE idusuario=p_actor AND idglobal=p_company FOR UPDATE;
  SELECT e.idempleado,e.str_cargo INTO v_actor,v_cargo FROM tbl_usuario u
    JOIN tbl_empleado e ON e.idglobal=u.idglobal AND e.idpersona=u.idpersona
    WHERE u.idglobal=p_company AND u.idusuario=p_actor AND u.str_estado='activo' AND e.str_estado='activo';
  IF v_actor IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_UNAUTHENTICATED'; END IF;
  SET v_employee=JSON_UNQUOTE(JSON_EXTRACT(p_data,'$.employeeId'));
  SET v_token=JSON_UNQUOTE(JSON_EXTRACT(p_data,'$.idempotencyToken'));
  SET v_reason=COALESCE(TRIM(JSON_UNQUOTE(JSON_EXTRACT(p_data,'$.reason'))),'');
  IF v_token IS NULL OR v_token NOT REGEXP '^[A-Za-z0-9_-]{16,100}$' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_INVALID_TOKEN'; END IF;
  IF NOT EXISTS(SELECT 1 FROM tbl_empleado WHERE idglobal=p_company AND idempleado=v_employee AND str_estado='activo') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_EMPLOYEE_NOT_FOUND'; END IF;
  SELECT idempleado INTO v_employee FROM tbl_empleado WHERE idglobal=p_company AND idempleado=v_employee FOR UPDATE;
  IF p_action='vacacion' THEN
    SET v_replacement=JSON_UNQUOTE(JSON_EXTRACT(p_data,'$.replacementEmployeeId'));
    IF v_replacement IS NULL OR v_replacement=v_employee OR NOT EXISTS(
      SELECT 1 FROM tbl_empleado WHERE idglobal=p_company AND idempleado=v_replacement AND str_estado='activo') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_INVALID_REPLACEMENT'; END IF;
    SELECT idempleado INTO v_replacement FROM tbl_empleado WHERE idglobal=p_company AND idempleado=v_replacement FOR UPDATE;
    IF v_cargo<>'Super Administrador' AND (
      NOT EXISTS(SELECT 1 FROM tbl_empleado e JOIN tbl_oficina o ON o.idglobal=e.idglobal AND o.idoficina=e.idoficina
        WHERE e.idglobal=p_company AND e.idempleado=v_employee AND o.idempleado_administrador=v_actor)
      OR NOT EXISTS(SELECT 1 FROM tbl_empleado e JOIN tbl_oficina o ON o.idglobal=e.idglobal AND o.idoficina=e.idoficina
        WHERE e.idglobal=p_company AND e.idempleado=v_replacement AND o.idempleado_administrador=v_actor)) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_FORBIDDEN'; END IF;
  ELSE
    SET v_branch=JSON_UNQUOTE(JSON_EXTRACT(p_data,'$.branchId'));
    SET v_route=JSON_UNQUOTE(JSON_EXTRACT(p_data,'$.routeId'));
    SELECT iddetalleruta,str_estado,DATE(created_at) INTO v_current_route,v_state,v_open_date FROM tbl_detalle_ruta
      WHERE idglobal=p_company AND idsucursal=v_branch AND str_estado='created'
      ORDER BY created_at DESC,iddetalleruta DESC LIMIT 1 FOR UPDATE;
    IF v_state IS NULL OR v_current_route IS NULL OR v_route IS NULL OR v_current_route<>v_route
      OR v_open_date IS NULL OR v_open_date>DATE(v_now) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_ROUTE_CLOSED'; END IF;
    IF NOT EXISTS(SELECT 1 FROM view_employee_payroll_bonus_manager
      WHERE idglobal=p_company AND actor_user_id=p_actor AND branch_id=v_branch) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_FORBIDDEN'; END IF;
    SELECT MIN(n.idnomina) INTO v_payroll FROM tbl_nomina n JOIN tbl_empleado e
      ON e.idglobal=n.idglobal AND e.idempleado=n.idempleado
      JOIN tbl_sucursal s ON s.idglobal=n.idglobal AND s.idsucursal=v_branch
      LEFT JOIN tbl_oficina o ON o.idglobal=s.idglobal AND o.idoficina=s.idoficina
      WHERE n.idglobal=p_company AND n.idempleado=v_employee AND n.str_estado='activo'
        AND (v_cargo='Super Administrador' OR (o.idempleado_administrador=v_actor AND e.idoficina=s.idoficina));
    IF v_payroll IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_FORBIDDEN'; END IF;
    IF JSON_CONTAINS_PATH(p_data,'one','$.date') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_BONUS_DATE_NOT_ALLOWED'; END IF;
  END IF;
  SET v_hash=SHA2(CONCAT(p_action,':',p_data),256);
  INSERT IGNORE INTO tbl_employee_payroll_request(idglobal,token,actor_user_id,action,payload_hash)
    VALUES(p_company,v_token,p_actor,p_action,v_hash);
  IF ROW_COUNT()=0 THEN
    SELECT payload_hash,actor_user_id,result_id INTO v_old_hash,v_old_actor,v_id
      FROM tbl_employee_payroll_request WHERE idglobal=p_company AND token=v_token FOR UPDATE;
    IF v_hash<>v_old_hash OR v_old_actor<>p_actor THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_IDEMPOTENCY_CONFLICT'; END IF;
    SET v_expense=(SELECT expense_id FROM tbl_employee_payroll_bonus WHERE idglobal=p_company AND id=v_id);
    COMMIT; SELECT 1 AS ok,v_id AS id,1 AS duplicate,v_expense AS expenseId,v_branch AS branchId,v_route AS routeId;
    LEAVE change_v2;
  END IF;
  IF p_action='vacacion' THEN
    SET v_date=STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(p_data,'$.startDate')),'%Y-%m-%d');
    SET v_end=STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(p_data,'$.endDate')),'%Y-%m-%d');
    IF v_date IS NULL OR v_end IS NULL OR v_date<DATE(v_now) OR v_end<v_date OR
      NOT EXISTS(SELECT 1 FROM tbl_employee_payroll_contract WHERE idglobal=p_company
        AND employee_id=v_replacement AND effective_date<=v_date) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_REPLACEMENT_CONTRACT_REQUIRED'; END IF;
    IF EXISTS(SELECT 1 FROM tbl_employee_payroll_vacation WHERE idglobal=p_company
        AND employee_id IN (v_employee,v_replacement) AND start_date<=v_end AND end_date>=v_date)
      OR EXISTS(SELECT 1 FROM tbl_employee_payroll_coverage WHERE idglobal=p_company
        AND replacement_employee_id=v_employee AND start_date<=v_end AND end_date>=v_date) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_VACATION_OVERLAP'; END IF;
    INSERT INTO tbl_employee_payroll_vacation(idglobal,employee_id,start_date,end_date,reason,actor_user_id,replacement_employee_id)
      VALUES(p_company,v_employee,v_date,v_end,v_reason,p_actor,v_replacement);
    SET v_id=LAST_INSERT_ID();
    INSERT INTO tbl_employee_payroll_coverage
      (vacation_id,idglobal,branch_id,holder_employee_id,replacement_employee_id,start_date,end_date,actor_user_id)
      SELECT v_id,p_company,idsucursal,v_employee,v_replacement,v_date,v_end,p_actor
      FROM tbl_sucursal WHERE idglobal=p_company AND idempleado=v_employee;
    INSERT INTO tbl_employee_payroll_coverage_contract
      (vacation_id,contract_id,start_date,end_date,salary_type,capital_rate,collection_rate)
      SELECT v_id,c.id,GREATEST(v_date,c.effective_date),
        LEAST(v_end,COALESCE((SELECT MIN(c2.effective_date)-INTERVAL 1 DAY
          FROM tbl_employee_payroll_contract c2 WHERE c2.idglobal=c.idglobal
          AND c2.employee_id=c.employee_id AND c2.effective_date>c.effective_date),v_end)),
        c.salary_type,c.capital_rate,c.collection_rate
      FROM tbl_employee_payroll_contract c WHERE c.idglobal=p_company AND c.employee_id=v_replacement
        AND c.effective_date<=v_end AND c.id IN(
          SELECT c3.id FROM tbl_employee_payroll_contract c3 WHERE c3.idglobal=p_company
            AND c3.employee_id=v_replacement AND c3.effective_date BETWEEN v_date AND v_end
          UNION SELECT c4.id FROM tbl_employee_payroll_contract c4 WHERE c4.idglobal=p_company
            AND c4.employee_id=v_replacement AND c4.effective_date=(SELECT MAX(effective_date)
              FROM tbl_employee_payroll_contract WHERE idglobal=p_company AND employee_id=v_replacement AND effective_date<=v_date));
  ELSE
    IF JSON_UNQUOTE(JSON_EXTRACT(p_data,'$.amount')) NOT REGEXP '^[0-9]+([.][0-9]{1,2})?$' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_INVALID_BONUS'; END IF;
    SET v_amount=JSON_UNQUOTE(JSON_EXTRACT(p_data,'$.amount'));
    IF v_amount IS NULL OR v_amount<=0 OR CHAR_LENGTH(v_reason)=0 OR CHAR_LENGTH(v_reason)>250 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_INVALID_BONUS'; END IF;
    SET v_expense=CONCAT('bonus',REPLACE(UUID(),'-',''));
    INSERT INTO tbl_contabilidad_detalle
      (idcontabilidad_detalle,idglobal,idsucursal,idtipo_contabilidad,iddetalleruta,dec_total,
       str_detalle,str_nombre,str_estado,str_operacion,created_empleado_id,created_at,update_at)
      VALUES(v_expense,p_company,v_branch,2,v_route,-v_amount,v_reason,'Bono','created','salida-totalizar',v_actor,v_now,v_now);
    INSERT INTO tbl_detalle_nomina(idglobal,idnomina,idcontabilidad_detalle,str_tipo,str_estado)
      VALUES(p_company,v_payroll,v_expense,'Bono','created');
    INSERT INTO tbl_employee_payroll_bonus(idglobal,employee_id,movement_date,amount,reason,actor_user_id,expense_id)
      VALUES(p_company,v_employee,DATE(v_now),v_amount,v_reason,p_actor,v_expense);
    SET v_id=LAST_INSERT_ID();
  END IF;
  UPDATE tbl_employee_payroll_request SET result_id=v_id WHERE idglobal=p_company AND token=v_token;
  COMMIT; SELECT 1 AS ok,v_id AS id,0 AS duplicate,v_expense AS expenseId,v_branch AS branchId,v_route AS routeId;
END$$
DELIMITER ;
