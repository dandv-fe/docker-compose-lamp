-- This deliberately minimal legacy schema lives ONLY in an isolated test database.
CREATE TABLE tbl_persona(idpersona INT PRIMARY KEY,idglobal INT,str_nombres VARCHAR(80),str_apellidos VARCHAR(80));
CREATE TABLE tbl_usuario(idusuario INT PRIMARY KEY,idglobal INT,idpersona INT,str_estado VARCHAR(20));
CREATE TABLE tbl_empleado(idempleado INT PRIMARY KEY,idglobal INT,idpersona INT,idoficina INT,str_cargo VARCHAR(50),str_estado VARCHAR(20));
CREATE TABLE tbl_oficina(idoficina INT PRIMARY KEY,idglobal INT,idempleado_administrador INT,str_nombre VARCHAR(80));
CREATE TABLE tbl_sucursal(idsucursal INT PRIMARY KEY,idglobal INT,idempleado INT,idoficina INT,str_codigo VARCHAR(80));
CREATE TABLE tbl_detalle_ruta(iddetalleruta INT PRIMARY KEY,idglobal INT,idsucursal INT,created_at DATETIME,str_estado VARCHAR(15) DEFAULT 'created');
CREATE TABLE tbl_empleados_cobrando(idempleado INT,id_detalle_ruta INT);
CREATE TABLE tbl_tarjetas(idtarjeta VARCHAR(50) PRIMARY KEY,idglobal INT,iddetalleruta INT,dec_prestamo DECIMAL(18,2),dec_valor DECIMAL(18,2),str_concepto VARCHAR(30),created_at DATETIME);
CREATE TABLE tbl_descripcion(iddescripcion VARCHAR(50) PRIMARY KEY,idglobal INT,iddetalleruta INT,dec_abono DECIMAL(18,2),str_descripcion VARCHAR(255),created_at DATETIME);
CREATE TABLE tbl_descripcion_pago(idglobal INT,iddescripcion VARCHAR(50),dec_valor DECIMAL(18,2));
CREATE TABLE tbl_nomina(idnomina INT AUTO_INCREMENT PRIMARY KEY,idglobal INT,idempleado INT,str_modo_sueldo VARCHAR(30),dec_sueldo DECIMAL(18,2),str_estado VARCHAR(15),created_at DATETIME,updated_at DATETIME);
CREATE TABLE tbl_detalle_nomina(idglobal INT,idnomina INT,idcontabilidad_detalle VARCHAR(50));
CREATE TABLE tbl_contabilidad_detalle(idcontabilidad_detalle VARCHAR(50) PRIMARY KEY,idglobal INT,created_at DATETIME,dec_total DECIMAL(18,2),idtipo_contabilidad INT);

INSERT INTO tbl_persona VALUES (1,1,'Super','Admin'),(2,1,'Office','Admin'),(3,1,'Employee','A'),(4,1,'Reviewer','B'),(5,2,'Other','Company');
INSERT INTO tbl_usuario VALUES (1,1,1,'activo'),(2,1,2,'activo'),(3,1,3,'activo'),(4,1,4,'activo'),(5,2,5,'activo');
INSERT INTO tbl_empleado VALUES (1,1,1,1,'Super Administrador','activo'),(2,1,2,1,'Administrador','activo'),(3,1,3,1,'Cobrador','activo'),(4,1,4,1,'Revisador','activo'),(5,2,5,2,'Super Administrador','activo');
INSERT INTO tbl_oficina VALUES (1,1,2,'Office'),(2,2,5,'Other');
INSERT INTO tbl_sucursal VALUES (1,1,3,1,'A'),(2,1,3,1,'B'),(3,2,5,2,'Other');
INSERT INTO tbl_nomina VALUES (1,1,3,'Mensual',100,'activo',NOW(),NOW()),(2,1,4,'Mensual',0,'activo',NOW(),NOW());
