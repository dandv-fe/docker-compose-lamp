-- Manual forward migration after 015/016; stop writers and back up first.
-- Permission catalogue only: never assign this permission automatically.
INSERT INTO tbl_auth(idauth,str_categoria,str_nombre,str_descripcion,dec_item)
SELECT next_id,'despachar','poner_retos','Configurar retos individuales de un despacho',1.1
FROM (SELECT COALESCE(MAX(idauth),0)+1 AS next_id FROM tbl_auth) ids
WHERE NOT EXISTS(SELECT 1 FROM tbl_auth WHERE str_nombre='poner_retos');

CREATE TABLE IF NOT EXISTS tbl_dispatch_control (
  idglobal INT NOT NULL, route_id INT NOT NULL, branch_id INT NOT NULL,
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  distribution_override LONGTEXT NULL, actor_user_id INT NOT NULL,
  created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
  PRIMARY KEY(idglobal,route_id),
  CHECK(distribution_override IS NULL OR JSON_VALID(distribution_override))
) ENGINE=InnoDB;

DELIMITER $$
CREATE OR REPLACE PROCEDURE sp_dispatch_challenge_goal(
  IN p_salary LONGTEXT, IN p_part LONGTEXT, IN p_credited DECIMAL(18,6), IN p_input LONGTEXT)
SQL SECURITY INVOKER
BEGIN
  DECLARE v_base,v_other,v_target,v_gap,v_weight,v_k,v_r,v_projected,v_capital,v_collection DECIMAL(30,10);
  DECLARE v_credited_capital,v_credited_collection DECIMAL(30,10) DEFAULT 0;
  DECLARE v_enabled,v_configured BOOLEAN;
  SET v_base=JSON_VALUE(p_salary,'$.baseAmount');
  SET v_configured=JSON_VALUE(p_salary,'$.configured') IN ('true','1');
  SET v_other=JSON_VALUE(p_salary,'$.commissionAmount')-p_credited;
  SET v_target=v_base*(1+JSON_VALUE(p_input,'$.incrementPercent')/100);
  SET v_gap=GREATEST(0,v_target-v_other-p_credited);
  SET v_weight=COALESCE(JSON_VALUE(p_part,'$.weight'),0);
  SET v_enabled=JSON_VALUE(p_part,'$.contractId') IS NOT NULL AND JSON_VALUE(p_part,'$.type')<>'Fijo';
  SET v_k=IF(v_enabled,v_weight*JSON_VALUE(p_part,'$.capitalRate')/10000,0);
  SET v_r=IF(v_enabled,v_weight*JSON_VALUE(p_part,'$.collectionRate')/10000,0);
  SET v_capital=COALESCE(JSON_VALUE(p_input,'$.remainingCapitalGoal'),JSON_VALUE(p_input,'$.capitalGoal'));
  SET v_collection=COALESCE(JSON_VALUE(p_input,'$.remainingCollectionGoal'),JSON_VALUE(p_input,'$.collectionGoal'));
  IF JSON_VALUE(p_input,'$.challengeId') IS NOT NULL THEN
    SELECT COALESCE(SUM(IF(excludedReason IS NULL,capitalAmount*weight/100,0)),0),
      COALESCE(SUM(IF(excludedReason IS NULL,cashAmount*weight/100,0)),0)
      INTO v_credited_capital,v_credited_collection
    FROM view_employee_payroll_breakdown
    WHERE idglobal=JSON_VALUE(p_input,'$.idglobal') AND employeeId=JSON_VALUE(p_input,'$.employeeId')
      AND routeId=JSON_VALUE(p_input,'$.routeId')
      AND movementDate BETWEEN GREATEST(JSON_VALUE(p_salary,'$.startDate'),JSON_VALUE(p_input,'$.invitationDate'))
        AND LEAST(JSON_VALUE(p_input,'$.deadline'),DATE(UTC_TIMESTAMP()-INTERVAL 5 HOUR));
    SET v_capital=IF(v_weight>0,GREATEST(0,JSON_VALUE(p_input,'$.capitalGoal')-v_credited_capital*100/v_weight),JSON_VALUE(p_input,'$.capitalGoal'));
    SET v_collection=IF(v_weight>0,GREATEST(0,JSON_VALUE(p_input,'$.collectionGoal')-v_credited_collection*100/v_weight),JSON_VALUE(p_input,'$.collectionGoal'));
  END IF;
  SET v_projected=v_other+p_credited+v_capital*v_k+v_collection*v_r;
  SELECT IF(NOT v_configured OR v_base<=0 OR p_part='null' OR (v_k<=0 AND v_r<=0 AND v_gap>0),
      'insufficient_data','available') AS status,
    v_weight AS weight,IF(v_enabled,JSON_VALUE(p_part,'$.capitalRate'),0) AS capitalRate,
    IF(v_enabled,JSON_VALUE(p_part,'$.collectionRate'),0) AS collectionRate,
    ROUND(v_target,2) AS targetCommission,ROUND(v_other,2) AS otherCommission,
    ROUND(p_credited,2) AS routeCommission,ROUND(v_gap,2) AS commissionGap,
    IF(v_k>0,CEIL(GREATEST(0,v_gap-v_collection*v_r)/v_k*100)/100,NULL) AS capitalRequired,
    IF(v_r>0,CEIL(GREATEST(0,v_gap-v_capital*v_k)/v_r*100)/100,NULL) AS collectionRequired,
    ROUND(v_projected,2) AS projectedCommission,
    ROUND(IF(JSON_VALUE(p_salary,'$.type')='Combinado',GREATEST(v_base,v_projected),v_base+v_projected),2) AS projectedEarnedWithoutBonuses,
    ROUND(v_projected-v_base,2) AS surplusAmount,
    IF(v_base>0,ROUND((v_projected/v_base-1)*100,3),NULL) AS surplusPercent,
    v_credited_capital AS creditedCapital,v_credited_collection AS creditedCollection;
END$$
DELIMITER ;

CREATE TABLE IF NOT EXISTS tbl_dispatch_challenge (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  idglobal INT NOT NULL, route_id INT NOT NULL, employee_id INT NOT NULL,
  deadline DATE NOT NULL, increment_percent DECIMAL(6,3) NOT NULL,
  capital_goal DECIMAL(18,2) NOT NULL, collection_goal DECIMAL(18,2) NOT NULL,
  description VARCHAR(250) NOT NULL, actor_user_id INT NOT NULL,
  created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
  UNIQUE KEY challenge_employee(idglobal,route_id,employee_id),
  FOREIGN KEY(idglobal,route_id) REFERENCES tbl_dispatch_control(idglobal,route_id),
  CHECK(increment_percent BETWEEN 0.1 AND 40 AND capital_goal>=0 AND collection_goal>=0)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS tbl_dispatch_request (
  idglobal INT NOT NULL, token VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  actor_user_id INT NOT NULL, payload_hash CHAR(64) NOT NULL,
  result_json LONGTEXT NOT NULL, created_at DATETIME NOT NULL,
  PRIMARY KEY(idglobal,token), CHECK(JSON_VALID(result_json))
) ENGINE=InnoDB;

CREATE OR REPLACE VIEW view_dispatch_challenge_progress AS
SELECT c.id AS challengeId,c.idglobal,c.employee_id AS employeeId,c.route_id AS routeId,
  r.idsucursal AS branchId,s.str_codigo AS branchName,r.str_estado AS routeState,
  DATE_FORMAT(c.deadline,'%Y-%m-%d') AS deadline,c.increment_percent AS incrementPercent,
  c.capital_goal AS capitalGoal,c.collection_goal AS collectionGoal,c.description,
  DATE_FORMAT(c.created_at,'%Y-%m-%d') AS invitationDate,
  EXISTS(SELECT 1 FROM tbl_empleados_cobrando a WHERE a.id_detalle_ruta=r.iddetalleruta
    AND a.idempleado=c.employee_id) AS assigned
FROM tbl_dispatch_challenge c
JOIN tbl_detalle_ruta r ON r.idglobal=c.idglobal AND r.iddetalleruta=c.route_id
JOIN tbl_sucursal s ON s.idglobal=r.idglobal AND s.idsucursal=r.idsucursal;
