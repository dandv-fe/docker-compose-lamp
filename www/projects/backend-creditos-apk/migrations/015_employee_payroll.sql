-- Apply manually, before deploying the dispatch hook. MariaDB 10.11 / MySQL 8.
-- Legacy timestamps are Colombia local DATETIME (not UTC).
CREATE TABLE IF NOT EXISTS tbl_employee_payroll_contract (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  idglobal INT NOT NULL, employee_id INT NOT NULL, effective_date DATE NOT NULL,
  salary_type ENUM('Fijo','Porcentaje','Combinado') NOT NULL,
  frequency ENUM('Diario','Semanal','Quincenal','Mensual') NOT NULL,
  base_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
  capital_rate DECIMAL(9,6) NOT NULL DEFAULT 0,
  collection_rate DECIMAL(9,6) NOT NULL DEFAULT 0,
  actor_user_id INT NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY contract_date (idglobal,employee_id,effective_date),
  CHECK (base_amount >= 0 AND capital_rate BETWEEN 0 AND 100 AND collection_rate BETWEEN 0 AND 100)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS tbl_employee_payroll_vacation (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, idglobal INT NOT NULL,
  employee_id INT NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL,
  reason VARCHAR(250) NOT NULL, actor_user_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY employee_dates (idglobal,employee_id,start_date,end_date), CHECK (end_date >= start_date)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS tbl_employee_payroll_bonus (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, idglobal INT NOT NULL,
  employee_id INT NOT NULL, movement_date DATE NOT NULL, amount DECIMAL(18,2) NOT NULL,
  reason VARCHAR(250) NOT NULL, actor_user_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY employee_date (idglobal,employee_id,movement_date)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS tbl_employee_payroll_branch_rule (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, idglobal INT NOT NULL,
  branch_id INT NOT NULL, mode ENUM('Titular','Igual','Personalizado') NOT NULL,
  actor_user_id INT NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY branch_rule (idglobal,branch_id,id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS tbl_employee_payroll_weight (
  rule_id BIGINT UNSIGNED NOT NULL, employee_id INT NOT NULL,
  weight DECIMAL(12,8) NOT NULL, PRIMARY KEY (rule_id,employee_id),
  FOREIGN KEY (rule_id) REFERENCES tbl_employee_payroll_branch_rule(id),
  CHECK (weight > 0 AND weight <= 100)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS tbl_employee_payroll_route (
  idglobal INT NOT NULL, route_id INT NOT NULL, branch_id INT NOT NULL,
  rule_id BIGINT UNSIGNED NULL, mode ENUM('Titular','Igual','Personalizado') NOT NULL,
  opened_at DATETIME NOT NULL, PRIMARY KEY (idglobal,route_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS tbl_employee_payroll_snapshot (
  idglobal INT NOT NULL, route_id INT NOT NULL, employee_id INT NOT NULL,
  contract_id BIGINT UNSIGNED NULL, salary_type ENUM('Fijo','Porcentaje','Combinado') NULL,
  weight DECIMAL(18,12) NOT NULL, capital_rate DECIMAL(9,6) NOT NULL,
  collection_rate DECIMAL(9,6) NOT NULL,
  PRIMARY KEY (idglobal,route_id,employee_id),
  KEY employee_route (idglobal,employee_id,route_id),
  FOREIGN KEY (idglobal,route_id) REFERENCES tbl_employee_payroll_route(idglobal,route_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS tbl_employee_payroll_request (
  idglobal INT NOT NULL, token VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  actor_user_id INT NOT NULL, action VARCHAR(20) NOT NULL,
  payload_hash CHAR(64) NOT NULL, result_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (idglobal,token)
) ENGINE=InnoDB;

-- One source row per movement; bank rows are aggregated before joining.
CREATE OR REPLACE VIEW view_employee_payroll_movement AS
SELECT t.idglobal, t.iddetalleruta AS route_id, CONCAT('capital:',t.idtarjeta) AS movement_id,
       DATE(t.created_at) AS movement_date, t.dec_prestamo AS capital, 0 AS collected
FROM tbl_tarjetas t WHERE t.str_concepto IN ('Prestamo','Articulo')
UNION ALL
SELECT d.idglobal, d.iddetalleruta, CONCAT('cash:',d.iddescripcion), DATE(d.created_at), 0,
       -d.dec_abono - COALESCE(b.amount,0)
FROM tbl_descripcion d
LEFT JOIN (SELECT idglobal,iddescripcion,SUM(dec_valor) AS amount FROM tbl_descripcion_pago
           GROUP BY idglobal,iddescripcion) b
  ON b.idglobal=d.idglobal AND b.iddescripcion=d.iddescripcion
WHERE d.str_descripcion LIKE 'Abono%' OR d.str_descripcion LIKE 'Inicial%'
   OR d.str_descripcion LIKE 'Cancelado%';

CREATE OR REPLACE VIEW view_employee_payroll_attribution AS
SELECT m.idglobal,s.employee_id AS employeeId,m.route_id AS routeId,
       r.idsucursal AS branchId,b.str_codigo AS branchName,r.str_estado AS state,
       (r.str_estado<>'saved') AS provisional,
       m.movement_id AS movementId,m.movement_date AS movementDate,
       s.contract_id AS contractId,s.salary_type AS type,s.weight,
       s.capital_rate AS capitalRate,s.collection_rate AS collectionRate,
       pr.mode, m.capital AS capitalAmount,m.collected AS cashAmount,
       CASE WHEN EXISTS(SELECT 1 FROM tbl_employee_payroll_vacation v
          WHERE v.idglobal=m.idglobal AND v.employee_id=s.employee_id
            AND m.movement_date BETWEEN v.start_date AND v.end_date) THEN 'VACATION'
         WHEN s.contract_id IS NULL THEN 'NO_CONTRACT'
         WHEN s.salary_type='Fijo' THEN 'FIXED' ELSE NULL END AS excludedReason,
       m.capital*s.weight*s.capital_rate/10000 AS rawCapitalCommission,
       m.collected*s.weight*s.collection_rate/10000 AS rawCollectionCommission
FROM view_employee_payroll_movement m
JOIN tbl_employee_payroll_snapshot s ON s.idglobal=m.idglobal AND s.route_id=m.route_id
JOIN tbl_employee_payroll_route pr ON pr.idglobal=s.idglobal AND pr.route_id=s.route_id
JOIN tbl_detalle_ruta r ON r.idglobal=m.idglobal AND r.iddetalleruta=m.route_id
JOIN tbl_sucursal b ON b.idglobal=r.idglobal AND b.idsucursal=r.idsucursal;

CREATE OR REPLACE VIEW view_employee_payroll_breakdown AS
SELECT a.*,
       IF(excludedReason IS NULL,rawCapitalCommission,0) AS capitalCommission,
       IF(excludedReason IS NULL,rawCollectionCommission,0) AS collectionCommission
FROM view_employee_payroll_attribution a;

-- EXISTS deliberately deduplicates old payroll links. Expenses without a payroll
-- beneficiary are not guessed from their author (author != recipient).
CREATE OR REPLACE VIEW view_employee_payroll_payment AS
SELECT DISTINCT dc.idglobal,n.idempleado AS employee_id,dc.idcontabilidad_detalle AS movement_id,
       DATE(dc.created_at) AS movement_date,-dc.dec_total AS amount
FROM tbl_contabilidad_detalle dc
JOIN tbl_nomina n ON n.idglobal=dc.idglobal
WHERE EXISTS (SELECT 1 FROM tbl_detalle_nomina dn
              WHERE dn.idglobal=dc.idglobal AND dn.idnomina=n.idnomina
                AND dn.idcontabilidad_detalle=dc.idcontabilidad_detalle);

DELIMITER $$
DROP PROCEDURE IF EXISTS sp_employee_payroll_snapshot$$
CREATE PROCEDURE sp_employee_payroll_snapshot(IN p_company INT, IN p_route INT)
snapshot: BEGIN
  DECLARE v_branch INT; DECLARE v_owner INT; DECLARE v_rule BIGINT DEFAULT NULL;
  DECLARE v_mode VARCHAR(20) DEFAULT 'Titular'; DECLARE v_open DATETIME;
  SELECT r.idsucursal,s.idempleado,r.created_at INTO v_branch,v_owner,v_open
  FROM tbl_detalle_ruta r JOIN tbl_sucursal s ON s.idsucursal=r.idsucursal AND s.idglobal=r.idglobal
  WHERE r.idglobal=p_company AND r.iddetalleruta=p_route;
  IF v_branch IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_ROUTE_NOT_FOUND'; END IF;
  SELECT idsucursal INTO v_branch FROM tbl_sucursal WHERE idglobal=p_company AND idsucursal=v_branch FOR UPDATE;
  SET v_rule=(SELECT id FROM tbl_employee_payroll_branch_rule
              WHERE idglobal=p_company AND branch_id=v_branch ORDER BY id DESC LIMIT 1);
  IF v_rule IS NOT NULL THEN
    SELECT mode INTO v_mode FROM tbl_employee_payroll_branch_rule WHERE id=v_rule;
  END IF;
  INSERT IGNORE INTO tbl_employee_payroll_route VALUES(p_company,p_route,v_branch,v_rule,v_mode,v_open);
  IF ROW_COUNT()=0 THEN LEAVE snapshot; END IF;
  INSERT INTO tbl_employee_payroll_snapshot
    (idglobal,route_id,employee_id,contract_id,salary_type,weight,capital_rate,collection_rate)
  SELECT p_company,p_route,a.employee_id,c.id,c.salary_type,a.weight,
         COALESCE(c.capital_rate,0),COALESCE(c.collection_rate,0)
  FROM (
    SELECT v_owner AS employee_id,100 AS weight WHERE v_mode='Titular'
    UNION ALL
    SELECT DISTINCT ec.idempleado,CAST(100 AS DECIMAL(30,12)) / (SELECT COUNT(DISTINCT ec2.idempleado)
      FROM tbl_empleados_cobrando ec2 JOIN tbl_empleado e2 ON e2.idempleado=ec2.idempleado
      WHERE ec2.id_detalle_ruta=p_route AND e2.idglobal=p_company)
    FROM tbl_empleados_cobrando ec JOIN tbl_empleado e ON e.idempleado=ec.idempleado AND e.idglobal=p_company
    WHERE ec.id_detalle_ruta=p_route AND v_mode='Igual'
    UNION ALL
    SELECT employee_id,weight FROM tbl_employee_payroll_weight WHERE rule_id=v_rule AND v_mode='Personalizado'
  ) a
  JOIN tbl_empleado e ON e.idempleado=a.employee_id AND e.idglobal=p_company
  LEFT JOIN tbl_employee_payroll_contract c ON c.idglobal=p_company AND c.employee_id=a.employee_id
    AND c.id=(SELECT c2.id FROM tbl_employee_payroll_contract c2 WHERE c2.idglobal=p_company
      AND c2.employee_id=a.employee_id AND c2.effective_date<=DATE(v_open)
      ORDER BY c2.effective_date DESC LIMIT 1);
END$$

DROP PROCEDURE IF EXISTS sp_employee_payroll_summary$$
CREATE PROCEDURE sp_employee_payroll_summary(IN p_company INT, IN p_employee INT, IN p_date DATE)
summary: BEGIN
  DECLARE v_id BIGINT; DECLARE v_type VARCHAR(20); DECLARE v_frequency VARCHAR(20);
  DECLARE v_start DATE; DECLARE v_end DATE; DECLARE v_base DECIMAL(18,2) DEFAULT 0;
  DECLARE v_capital DECIMAL(18,2) DEFAULT 0; DECLARE v_collection DECIMAL(18,2) DEFAULT 0;
  DECLARE v_bonus DECIMAL(18,2) DEFAULT 0; DECLARE v_paid DECIMAL(18,2) DEFAULT 0;
  DECLARE v_salary DECIMAL(18,2) DEFAULT 0;
  DECLARE v_day DATE; DECLARE v_day_base DECIMAL(18,2);
  DECLARE v_day_frequency VARCHAR(20); DECLARE v_days INT;
  DECLARE v_base_accrual DECIMAL(30,12) DEFAULT 0;
  DECLARE v_period_base DECIMAL(18,2) DEFAULT 0;
  DECLARE v_full_accrual DECIMAL(30,12) DEFAULT 0;
  DECLARE v_agreed_base DECIMAL(18,2) DEFAULT 0;
  IF p_date IS NULL THEN SET p_date=DATE(UTC_TIMESTAMP()-INTERVAL 5 HOUR); END IF;
  IF NOT EXISTS(SELECT 1 FROM tbl_empleado WHERE idglobal=p_company AND idempleado=p_employee)
    THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_EMPLOYEE_NOT_FOUND'; END IF;
  SELECT id,salary_type,frequency,base_amount INTO v_id,v_type,v_frequency,v_agreed_base FROM tbl_employee_payroll_contract
  WHERE idglobal=p_company AND employee_id=p_employee AND effective_date<=p_date
  ORDER BY effective_date DESC LIMIT 1;
  IF v_id IS NULL THEN
    -- Unconfigured employees can still receive manual bonuses/legacy payments;
    -- monthly grouping is only a reporting window, not an invented salary.
    SET v_frequency='Mensual';
  END IF;
  SET v_start=CASE v_frequency
    WHEN 'Diario' THEN p_date WHEN 'Semanal' THEN DATE_SUB(p_date,INTERVAL WEEKDAY(p_date) DAY)
    WHEN 'Quincenal' THEN DATE_SUB(p_date,INTERVAL (DAY(p_date)-IF(DAY(p_date)<=15,1,16)) DAY)
    ELSE DATE_SUB(p_date,INTERVAL (DAY(p_date)-1) DAY) END;
  SET v_end=CASE v_frequency WHEN 'Diario' THEN v_start WHEN 'Semanal' THEN v_start+INTERVAL 6 DAY
    WHEN 'Quincenal' THEN IF(DAY(v_start)=1, v_start+INTERVAL 14 DAY,LAST_DAY(v_start))
    ELSE LAST_DAY(v_start) END;
  -- At most 31 calendar days. Each covered day uses its contract's own
  -- frequency denominator, including a frequency change inside the window.
  SET v_day=v_start;
  WHILE v_day<=v_end DO
    SET v_day_base=0; SET v_day_frequency='Diario';
    SELECT base_amount,frequency INTO v_day_base,v_day_frequency FROM tbl_employee_payroll_contract
      WHERE idglobal=p_company AND employee_id=p_employee AND effective_date<=LEAST(v_day,p_date)
      ORDER BY effective_date DESC LIMIT 1;
    SET v_days=CASE v_day_frequency WHEN 'Diario' THEN 1 WHEN 'Semanal' THEN 7
      WHEN 'Quincenal' THEN IF(DAY(v_day)<=15,15,DAY(LAST_DAY(v_day))-15)
      ELSE DAY(LAST_DAY(v_day)) END;
    SET v_full_accrual=v_full_accrual+v_day_base/v_days;
    IF v_day<=p_date THEN SET v_base_accrual=v_base_accrual+v_day_base/v_days; END IF;
    SET v_day=v_day+INTERVAL 1 DAY;
  END WHILE;
  SET v_base=ROUND(v_base_accrual,2);
  SET v_period_base=ROUND(v_full_accrual,2);
  SELECT COALESCE(ROUND(SUM(capitalCommission),2),0),
         COALESCE(ROUND(SUM(collectionCommission),2),0)
    INTO v_capital,v_collection
  FROM view_employee_payroll_breakdown
  WHERE idglobal=p_company AND employeeId=p_employee AND movementDate BETWEEN v_start AND LEAST(v_end,p_date);
  SELECT COALESCE(SUM(amount),0) INTO v_bonus FROM tbl_employee_payroll_bonus
    WHERE idglobal=p_company AND employee_id=p_employee AND movement_date BETWEEN v_start AND LEAST(v_end,p_date);
  SELECT COALESCE(SUM(amount),0) INTO v_paid FROM view_employee_payroll_payment
    WHERE idglobal=p_company AND employee_id=p_employee AND movement_date BETWEEN v_start AND LEAST(v_end,p_date);
  -- Fixed snapshots generate no commission, but a later fixed contract must not
  -- discard the commissions of a previously opened percentage dispatch.
  SET v_salary=CASE v_type WHEN 'Combinado' THEN GREATEST(v_base,v_capital+v_collection)
    ELSE v_base+v_capital+v_collection END;
  SELECT v_id AS contractId,v_type AS type,v_frequency AS frequency,v_start AS startDate,v_end AS endDate,
    v_base AS baseAmount,v_period_base AS periodBaseAmount,v_agreed_base AS agreedBaseAmount,
    v_capital AS capitalCommission,v_collection AS collectionCommission,
    v_capital+v_collection AS commissionAmount,v_bonus AS bonusAmount,v_salary+v_bonus AS earnedAmount,
    v_paid AS paidAmount,v_salary+v_bonus-v_paid AS pendingAmount,(v_id IS NOT NULL) AS configured;
END$$

-- All clients use this routine for authorization, validation and idempotency.
DROP PROCEDURE IF EXISTS sp_employee_payroll_change$$
CREATE PROCEDURE sp_employee_payroll_change(IN p_company INT,IN p_actor INT,IN p_action VARCHAR(20),IN p_data LONGTEXT)
change_data: BEGIN
  DECLARE v_actor INT; DECLARE v_cargo VARCHAR(50); DECLARE v_employee INT; DECLARE v_branch INT;
  DECLARE v_id BIGINT; DECLARE v_token VARCHAR(100); DECLARE v_hash CHAR(64); DECLARE v_old_hash CHAR(64);
  DECLARE v_old_actor INT; DECLARE v_date DATE; DECLARE v_end DATE;
  DECLARE v_type VARCHAR(20); DECLARE v_frequency VARCHAR(20); DECLARE v_mode VARCHAR(20);
  DECLARE v_base DECIMAL(18,2); DECLARE v_capital DECIMAL(9,6); DECLARE v_collection DECIMAL(9,6);
  DECLARE v_amount DECIMAL(18,2); DECLARE v_reason VARCHAR(250); DECLARE v_i INT DEFAULT 0;
  DECLARE v_count INT; DECLARE v_weight DECIMAL(12,8); DECLARE v_sum DECIMAL(18,8) DEFAULT 0;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  IF NOT JSON_VALID(p_data) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_INVALID_INPUT'; END IF;
  START TRANSACTION;
  SELECT e.idempleado,e.str_cargo INTO v_actor,v_cargo FROM tbl_usuario u
    JOIN tbl_empleado e ON e.idpersona=u.idpersona AND e.idglobal=u.idglobal
    WHERE u.idusuario=p_actor AND u.idglobal=p_company AND u.str_estado='activo' AND e.str_estado='activo';
  IF v_actor IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_UNAUTHENTICATED'; END IF;
  SET v_token=JSON_UNQUOTE(JSON_EXTRACT(p_data,'$.idempotencyToken'));
  IF v_token IS NULL OR v_token NOT REGEXP '^[A-Za-z0-9_-]{16,100}$' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_INVALID_TOKEN'; END IF;
  SET v_employee=JSON_UNQUOTE(JSON_EXTRACT(p_data,'$.employeeId'));
  SET v_branch=JSON_UNQUOTE(JSON_EXTRACT(p_data,'$.branchId'));
  IF p_action='reparto' THEN
    IF v_cargo<>'Super Administrador' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_FORBIDDEN'; END IF;
    IF NOT EXISTS(SELECT 1 FROM tbl_sucursal WHERE idglobal=p_company AND idsucursal=v_branch) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_BRANCH_NOT_FOUND'; END IF;
  ELSEIF p_action IN ('contrato','vacacion','bono') THEN
    IF NOT EXISTS(SELECT 1 FROM tbl_empleado WHERE idglobal=p_company AND idempleado=v_employee) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_EMPLOYEE_NOT_FOUND'; END IF;
    -- Lock employee: serialize version dates and vacation overlap across tokens.
    SELECT idempleado INTO v_employee FROM tbl_empleado WHERE idglobal=p_company AND idempleado=v_employee FOR UPDATE;
    IF v_cargo<>'Super Administrador' AND NOT EXISTS(
      SELECT 1 FROM tbl_empleado e JOIN tbl_oficina o ON o.idoficina=e.idoficina AND o.idglobal=e.idglobal
      WHERE e.idglobal=p_company AND e.idempleado=v_employee AND o.idempleado_administrador=v_actor) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_FORBIDDEN'; END IF;
  ELSE SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_INVALID_ACTION'; END IF;
  SET v_hash=SHA2(CONCAT(p_action,':',p_data),256);
  INSERT IGNORE INTO tbl_employee_payroll_request(idglobal,token,actor_user_id,action,payload_hash)
    VALUES(p_company,v_token,p_actor,p_action,v_hash);
  IF ROW_COUNT()=0 THEN
    SELECT payload_hash,actor_user_id,result_id INTO v_old_hash,v_old_actor,v_id
      FROM tbl_employee_payroll_request WHERE idglobal=p_company AND token=v_token FOR UPDATE;
    IF v_old_hash<>v_hash OR v_old_actor<>p_actor THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_IDEMPOTENCY_CONFLICT'; END IF;
    COMMIT; SELECT 1 AS ok,v_id AS id,1 AS duplicate; LEAVE change_data;
  END IF;
  IF p_action='contrato' THEN
    SET v_date=STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(p_data,'$.effectiveDate')),'%Y-%m-%d');
    SET v_type=JSON_UNQUOTE(JSON_EXTRACT(p_data,'$.type'));
    SET v_frequency=JSON_UNQUOTE(JSON_EXTRACT(p_data,'$.frequency'));
    SET v_base=JSON_UNQUOTE(JSON_EXTRACT(p_data,'$.baseAmount'));
    SET v_capital=JSON_UNQUOTE(JSON_EXTRACT(p_data,'$.capitalRate'));
    SET v_collection=JSON_UNQUOTE(JSON_EXTRACT(p_data,'$.collectionRate'));
    IF v_date IS NULL OR v_date<DATE(UTC_TIMESTAMP()-INTERVAL 5 HOUR)
      OR v_type IS NULL OR v_type NOT IN ('Fijo','Porcentaje','Combinado')
      OR v_frequency IS NULL OR v_frequency NOT IN ('Diario','Semanal','Quincenal','Mensual')
      OR v_base IS NULL OR v_base<0 OR v_capital IS NULL OR v_capital NOT BETWEEN 0 AND 100
      OR v_collection IS NULL OR v_collection NOT BETWEEN 0 AND 100 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_INVALID_CONTRACT'; END IF;
    IF EXISTS(SELECT 1 FROM tbl_employee_payroll_contract WHERE idglobal=p_company AND employee_id=v_employee
      AND effective_date>=v_date) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_CONTRACT_DATE_CONFLICT'; END IF;
    INSERT INTO tbl_employee_payroll_contract
      (idglobal,employee_id,effective_date,salary_type,frequency,base_amount,capital_rate,collection_rate,actor_user_id)
      VALUES(p_company,v_employee,v_date,v_type,v_frequency,v_base,v_capital,v_collection,p_actor);
    SET v_id=LAST_INSERT_ID();
    -- Keep a stable legacy payroll recipient; new tables own compensation terms.
    IF NOT EXISTS(SELECT 1 FROM tbl_nomina WHERE idglobal=p_company AND idempleado=v_employee AND str_estado='activo') THEN
      INSERT INTO tbl_nomina(idglobal,idempleado,str_modo_sueldo,dec_sueldo,str_estado,created_at,updated_at)
      VALUES(p_company,v_employee,v_frequency,v_base,'activo',NOW(),NOW());
    END IF;
  ELSEIF p_action IN ('vacacion','bono') THEN
    SET v_reason=COALESCE(TRIM(JSON_UNQUOTE(JSON_EXTRACT(p_data,'$.reason'))),'');
    SET v_date=STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(p_data,IF(p_action='bono','$.date','$.startDate'))),'%Y-%m-%d');
    IF (p_action='bono' AND CHAR_LENGTH(v_reason)=0) OR v_date IS NULL OR v_date<DATE(UTC_TIMESTAMP()-INTERVAL 5 HOUR) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_INVALID_INPUT'; END IF;
    IF p_action='vacacion' THEN
      SET v_end=STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(p_data,'$.endDate')),'%Y-%m-%d');
      IF v_end IS NULL OR v_end<v_date OR EXISTS(SELECT 1 FROM tbl_employee_payroll_vacation
        WHERE idglobal=p_company AND employee_id=v_employee AND start_date<=v_end AND end_date>=v_date) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_INVALID_VACATION'; END IF;
      INSERT INTO tbl_employee_payroll_vacation(idglobal,employee_id,start_date,end_date,reason,actor_user_id)
        VALUES(p_company,v_employee,v_date,v_end,v_reason,p_actor);
    ELSE
      SET v_amount=JSON_UNQUOTE(JSON_EXTRACT(p_data,'$.amount'));
      IF v_amount IS NULL OR v_amount<=0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_INVALID_BONUS'; END IF;
      INSERT INTO tbl_employee_payroll_bonus(idglobal,employee_id,movement_date,amount,reason,actor_user_id)
        VALUES(p_company,v_employee,v_date,v_amount,v_reason,p_actor);
    END IF;
    SET v_id=LAST_INSERT_ID();
  ELSE
    -- Lock branch to serialize snapshots against concurrent policy changes.
    SELECT idsucursal INTO v_branch FROM tbl_sucursal WHERE idglobal=p_company AND idsucursal=v_branch FOR UPDATE;
    SET v_mode=JSON_UNQUOTE(JSON_EXTRACT(p_data,'$.mode'));
    IF v_mode IS NULL OR v_mode NOT IN ('Titular','Igual','Personalizado') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_INVALID_DISTRIBUTION'; END IF;
    INSERT INTO tbl_employee_payroll_branch_rule(idglobal,branch_id,mode,actor_user_id)
      VALUES(p_company,v_branch,v_mode,p_actor);
    SET v_id=LAST_INSERT_ID();
    IF v_mode='Personalizado' THEN
      SET v_count=JSON_LENGTH(JSON_EXTRACT(p_data,'$.weights'));
      IF v_count IS NULL OR v_count=0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_INVALID_WEIGHTS'; END IF;
      WHILE v_i<v_count DO
        SET v_employee=JSON_UNQUOTE(JSON_EXTRACT(p_data,CONCAT('$.weights[',v_i,'].employeeId')));
        SET v_weight=JSON_UNQUOTE(JSON_EXTRACT(p_data,CONCAT('$.weights[',v_i,'].weight')));
        IF v_weight IS NULL OR v_weight<=0 OR v_weight>100 OR NOT EXISTS(
          SELECT 1 FROM tbl_empleado WHERE idglobal=p_company AND idempleado=v_employee AND str_estado='activo') THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_INVALID_WEIGHTS'; END IF;
        INSERT INTO tbl_employee_payroll_weight VALUES(v_id,v_employee,v_weight);
        SET v_sum=v_sum+v_weight; SET v_i=v_i+1;
      END WHILE;
      IF v_sum<>100 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PAYROLL_WEIGHTS_MUST_SUM_100'; END IF;
    END IF;
  END IF;
  UPDATE tbl_employee_payroll_request SET result_id=v_id WHERE idglobal=p_company AND token=v_token;
  COMMIT; SELECT 1 AS ok,v_id AS id,0 AS duplicate;
END$$
DELIMITER ;
