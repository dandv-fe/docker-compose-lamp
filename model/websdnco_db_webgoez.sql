/*
 Navicat Premium Dump SQL

 Source Server         : webgoez
 Source Server Type    : MySQL
 Source Server Version : 101113 (10.11.13-MariaDB-cll-lve)
 Source Host           : webgoez.com:3306
 Source Schema         : websdnco_db_webgoez

 Target Server Type    : MySQL
 Target Server Version : 101113 (10.11.13-MariaDB-cll-lve)
 File Encoding         : 65001

 Date: 14/07/2025 12:15:46
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for tbl_articulo
-- ----------------------------
DROP TABLE IF EXISTS `tbl_articulo`;
CREATE TABLE `tbl_articulo`  (
  `idarticulo` int NOT NULL AUTO_INCREMENT,
  `idglobal` int NOT NULL,
  `idcategoria` int NOT NULL,
  `idunidad_medida` int NOT NULL,
  `str_nombre` varchar(50) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_descripcion` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `str_marca` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NULL DEFAULT NULL,
  `imagen_ids` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `str_estado` char(1) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  PRIMARY KEY (`idarticulo`) USING BTREE,
  INDEX `fk_articulo_categoria_idx`(`idcategoria` ASC) USING BTREE,
  INDEX `fk_articulo_unidad_medida_idx`(`idunidad_medida` ASC) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  CONSTRAINT `fk_articulo_categoria` FOREIGN KEY (`idcategoria`) REFERENCES `tbl_categoria` (`idcategoria`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_articulo_unidad_medida` FOREIGN KEY (`idunidad_medida`) REFERENCES `tbl_unidad_medida` (`idunidad_medida`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = COMPACT;

-- ----------------------------
-- Table structure for tbl_auth
-- ----------------------------
DROP TABLE IF EXISTS `tbl_auth`;
CREATE TABLE `tbl_auth`  (
  `idauth` int NOT NULL AUTO_INCREMENT,
  `str_categoria` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_nombre` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_descripcion` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `dec_item` float NOT NULL,
  PRIMARY KEY (`idauth`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 54 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for tbl_auth_sucursal
-- ----------------------------
DROP TABLE IF EXISTS `tbl_auth_sucursal`;
CREATE TABLE `tbl_auth_sucursal`  (
  `idauth_sucursal` int NOT NULL AUTO_INCREMENT,
  `idglobal` int NOT NULL,
  `idsucursal` int NOT NULL,
  `idempleado` int NOT NULL,
  `tipo_usuario` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `created_at` datetime NULL DEFAULT NULL,
  `updated_at` datetime NULL DEFAULT NULL,
  `str_estado` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  PRIMARY KEY (`idauth_sucursal`) USING BTREE,
  INDEX `fk_usuario_empleado_idx`(`idempleado` ASC) USING BTREE,
  INDEX `fk_usuario_sucursal_idx`(`idsucursal` ASC) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  CONSTRAINT `fk_usuario_empleado` FOREIGN KEY (`idempleado`) REFERENCES `tbl_empleado` (`idempleado`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_usuario_sucursal` FOREIGN KEY (`idsucursal`) REFERENCES `tbl_sucursal` (`idsucursal`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 557 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = COMPACT;

-- ----------------------------
-- Table structure for tbl_auths
-- ----------------------------
DROP TABLE IF EXISTS `tbl_auths`;
CREATE TABLE `tbl_auths`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `idauth` int NOT NULL,
  `idauth_sucursal` int NOT NULL,
  PRIMARY KEY (`id`, `idauth`, `idauth_sucursal`) USING BTREE,
  INDEX `fk_tbl_auths_tbl_auth_1`(`idauth` ASC) USING BTREE,
  INDEX `fk_tbl_auths_tbl_auth_sucursal_1`(`idauth_sucursal` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_auths_tbl_auth_1` FOREIGN KEY (`idauth`) REFERENCES `tbl_auth` (`idauth`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_auths_tbl_auth_sucursal_1` FOREIGN KEY (`idauth_sucursal`) REFERENCES `tbl_auth_sucursal` (`idauth_sucursal`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 7889 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for tbl_banco
-- ----------------------------
DROP TABLE IF EXISTS `tbl_banco`;
CREATE TABLE `tbl_banco`  (
  `idbanco` int NOT NULL AUTO_INCREMENT,
  `str_banco` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_tipo` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_num_cueneta` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_estado` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NULL DEFAULT NULL,
  PRIMARY KEY (`idbanco`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish2_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for tbl_categoria
-- ----------------------------
DROP TABLE IF EXISTS `tbl_categoria`;
CREATE TABLE `tbl_categoria`  (
  `idcategoria` int NOT NULL AUTO_INCREMENT,
  `idglobal` int NOT NULL,
  `str_nombre` varchar(50) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_estado` char(1) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  PRIMARY KEY (`idcategoria`) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = COMPACT;

-- ----------------------------
-- Table structure for tbl_clientes
-- ----------------------------
DROP TABLE IF EXISTS `tbl_clientes`;
CREATE TABLE `tbl_clientes`  (
  `idcliente` int NOT NULL AUTO_INCREMENT,
  `idglobal` int NOT NULL,
  `idpersona` int NOT NULL,
  `dec_max_credito` decimal(10, 2) NOT NULL,
  `str_apodo` varchar(20) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_nota` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_estado` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_calificacion` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `fiador_persona_id` int NULL DEFAULT NULL,
  `created_empleado_id` int NOT NULL,
  `create_at` datetime NULL DEFAULT NULL,
  `update_at` datetime NULL DEFAULT NULL,
  PRIMARY KEY (`idcliente`) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  INDEX `index2`(`idpersona` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_clientes_tbl_persona_1` FOREIGN KEY (`idpersona`) REFERENCES `tbl_persona` (`idpersona`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 58292 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish2_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for tbl_comentarios
-- ----------------------------
DROP TABLE IF EXISTS `tbl_comentarios`;
CREATE TABLE `tbl_comentarios`  (
  `idcomentario` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_comentario` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_tipo` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `idusuario` int NOT NULL COMMENT 'id usuario created',
  `created_at` datetime NOT NULL,
  `update_at` datetime NOT NULL,
  PRIMARY KEY (`idcomentario`) USING BTREE,
  INDEX `fkusuario_created`(`idusuario` ASC) USING BTREE,
  CONSTRAINT `fkusuario_created` FOREIGN KEY (`idusuario`) REFERENCES `tbl_usuario` (`idusuario`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_comentarios_cliente
-- ----------------------------
DROP TABLE IF EXISTS `tbl_comentarios_cliente`;
CREATE TABLE `tbl_comentarios_cliente`  (
  `idcomentariocliente` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `idcliente` int NOT NULL,
  `idcomentario` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  PRIMARY KEY (`idcomentariocliente`) USING BTREE,
  INDEX `fkcomentario`(`idcomentario` ASC) USING BTREE,
  INDEX `fk_cliente`(`idcliente` ASC) USING BTREE,
  CONSTRAINT `fk_cliente` FOREIGN KEY (`idcliente`) REFERENCES `tbl_clientes` (`idcliente`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fkcomentario` FOREIGN KEY (`idcomentario`) REFERENCES `tbl_comentarios` (`idcomentario`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_contabilidad_detalle
-- ----------------------------
DROP TABLE IF EXISTS `tbl_contabilidad_detalle`;
CREATE TABLE `tbl_contabilidad_detalle`  (
  `idcontabilidad_detalle` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `idglobal` int NULL DEFAULT NULL,
  `idsucursal` int NOT NULL,
  `idtipo_contabilidad` int NOT NULL,
  `iddetalleruta` int NOT NULL,
  `dec_total` decimal(10, 2) NOT NULL,
  `str_detalle` varchar(250) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_nombre` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_estado` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_operacion` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `created_empleado_id` int NOT NULL,
  `created_at` datetime NOT NULL,
  `update_at` datetime NOT NULL,
  PRIMARY KEY (`idcontabilidad_detalle`) USING BTREE,
  INDEX `fk_detalle_tipodocumentoid`(`idtipo_contabilidad` ASC) USING BTREE,
  INDEX `fk_detalle_usuario_id`(`idsucursal` ASC) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  INDEX `indexempleado`(`created_empleado_id` ASC) USING BTREE,
  INDEX `fk_tbl_contabilidad_detalle_tbl_detalle_ruta_1`(`iddetalleruta` ASC) USING BTREE,
  CONSTRAINT `fk_detalle_usuario_id` FOREIGN KEY (`idsucursal`) REFERENCES `tbl_sucursal` (`idsucursal`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_contabilidad_detalle_tbl_detalle_ruta_1` FOREIGN KEY (`iddetalleruta`) REFERENCES `tbl_detalle_ruta` (`iddetalleruta`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_contabilidad_detalle_tbl_empleado_1` FOREIGN KEY (`created_empleado_id`) REFERENCES `tbl_empleado` (`idempleado`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_contabilidad_detalle_tbl_tipo_contabilidad_1` FOREIGN KEY (`idtipo_contabilidad`) REFERENCES `tbl_tipo_contabilidad` (`idtipo_contabilidad`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = COMPACT;

-- ----------------------------
-- Table structure for tbl_de_contabilidad
-- ----------------------------
DROP TABLE IF EXISTS `tbl_de_contabilidad`;
CREATE TABLE `tbl_de_contabilidad`  (
  `idde_contabilidad` int NOT NULL AUTO_INCREMENT,
  `idglobal` int NOT NULL,
  `idtipo_contabilidad` int NOT NULL,
  `str_de` varchar(50) CHARACTER SET latin1 COLLATE latin1_spanish_ci NOT NULL,
  `str_estado` varchar(30) CHARACTER SET latin1 COLLATE latin1_spanish_ci NOT NULL,
  PRIMARY KEY (`idde_contabilidad`) USING BTREE,
  UNIQUE INDEX `indice_str_de`(`str_de` ASC) USING BTREE,
  INDEX `fk_idtipo_contabilidad`(`idtipo_contabilidad` ASC) USING BTREE,
  CONSTRAINT `fk_idtipo_contabilidad` FOREIGN KEY (`idtipo_contabilidad`) REFERENCES `tbl_tipo_contabilidad` (`idtipo_contabilidad`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 37 CHARACTER SET = latin1 COLLATE = latin1_spanish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_descripcion
-- ----------------------------
DROP TABLE IF EXISTS `tbl_descripcion`;
CREATE TABLE `tbl_descripcion`  (
  `iddescripcion` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `idglobal` int NOT NULL,
  `idsucursal` int NOT NULL,
  `idtarjeta` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `iddetalleruta` int NOT NULL,
  `dec_abono` decimal(9, 2) NOT NULL,
  `str_descripcion` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_estado` varchar(20) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `created_at` datetime NULL DEFAULT NULL,
  `updated_at` datetime NULL DEFAULT NULL,
  INDEX `fey`(`idtarjeta` ASC) USING BTREE,
  INDEX `fk_desc_sucursal`(`idsucursal` ASC) USING BTREE,
  INDEX `index_idd`(`iddescripcion` ASC) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  INDEX `fk_tbl_descripcion_tbl_detalle_ruta_1`(`iddetalleruta` ASC) USING BTREE,
  CONSTRAINT `fk_desc_sucursal` FOREIGN KEY (`idsucursal`) REFERENCES `tbl_sucursal` (`idsucursal`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_tbl_descripcion_tbl_detalle_ruta_1` FOREIGN KEY (`iddetalleruta`) REFERENCES `tbl_detalle_ruta` (`iddetalleruta`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_descripcion_tbl_tarjetas_1` FOREIGN KEY (`idtarjeta`) REFERENCES `tbl_tarjetas` (`idtarjeta`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = COMPACT;

-- ----------------------------
-- Table structure for tbl_descripcion_global
-- ----------------------------
DROP TABLE IF EXISTS `tbl_descripcion_global`;
CREATE TABLE `tbl_descripcion_global`  (
  `iddescripcion_global` int NOT NULL AUTO_INCREMENT,
  `idglobal` int NOT NULL,
  `idglobal_accion` int NOT NULL,
  `date_corte` date NOT NULL,
  `dec_valor` decimal(9, 2) NOT NULL,
  `int_dias_extras` int NOT NULL,
  `str_estado` varchar(20) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`iddescripcion_global`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 89 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_detalle_documento_sucursal
-- ----------------------------
DROP TABLE IF EXISTS `tbl_detalle_documento_sucursal`;
CREATE TABLE `tbl_detalle_documento_sucursal`  (
  `iddetalle_documento_sucursal` int NOT NULL AUTO_INCREMENT,
  `idglobal` int NOT NULL,
  `idsucursal` int NOT NULL,
  `idtipo_documento` int NOT NULL,
  `str_ultima_serie` varchar(7) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_ultimo_numero` varchar(10) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  PRIMARY KEY (`iddetalle_documento_sucursal`) USING BTREE,
  INDEX `fk_documento_sucursal_idx`(`idtipo_documento` ASC) USING BTREE,
  INDEX `fk_detalle_sucursal_idx`(`idsucursal` ASC) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  CONSTRAINT `fk_detalle_sucursal` FOREIGN KEY (`idsucursal`) REFERENCES `tbl_sucursal` (`idsucursal`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_documento_sucursal` FOREIGN KEY (`idtipo_documento`) REFERENCES `tbl_tipo_documento` (`idtipo_documento`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 154 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = COMPACT;

-- ----------------------------
-- Table structure for tbl_detalle_ingreso
-- ----------------------------
DROP TABLE IF EXISTS `tbl_detalle_ingreso`;
CREATE TABLE `tbl_detalle_ingreso`  (
  `iddetalle_ingreso` int NOT NULL AUTO_INCREMENT,
  `idglobal` int NOT NULL,
  `idingreso` int NOT NULL,
  `idarticulo` int NOT NULL,
  `str_codigo` varchar(50) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_serie` varchar(50) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `str_descripcion` varchar(150) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `int_stock_ingreso` int NOT NULL,
  `int_stock_actual` int NOT NULL,
  `dec_precio_compra` decimal(10, 2) NOT NULL,
  `dec_precio_ventadistribuidor` decimal(10, 2) NOT NULL,
  `dec_precio_ventapublico` decimal(10, 2) NOT NULL,
  PRIMARY KEY (`iddetalle_ingreso`) USING BTREE,
  INDEX `fk_detalle_ingreso_idx`(`idingreso` ASC) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  INDEX `index_articuloid`(`idarticulo` ASC) USING BTREE,
  CONSTRAINT `fk_detalle_ingreso` FOREIGN KEY (`idingreso`) REFERENCES `tbl_ingreso` (`idingreso`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_detalle_ingreso_tbl_articulo_1` FOREIGN KEY (`idarticulo`) REFERENCES `tbl_articulo` (`idarticulo`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = COMPACT;

-- ----------------------------
-- Table structure for tbl_detalle_natillera
-- ----------------------------
DROP TABLE IF EXISTS `tbl_detalle_natillera`;
CREATE TABLE `tbl_detalle_natillera`  (
  `iddetalle_natillera` int NOT NULL,
  `idglobal` int NOT NULL,
  `idnatillera` int NOT NULL,
  `str_operacion` enum('Ahorro','Retiro') CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `dec_valor` decimal(10, 2) NOT NULL,
  `str_comentario` varchar(150) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_estado` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `created_at` datetime NOT NULL,
  `update_at` datetime NOT NULL,
  PRIMARY KEY (`iddetalle_natillera`) USING BTREE,
  INDEX `indexid`(`idglobal` ASC) USING BTREE,
  INDEX `index_idnatillera`(`idnatillera` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_detalle_natillera_tbl_natillera_1` FOREIGN KEY (`idnatillera`) REFERENCES `tbl_natillera` (`idnatillera`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish2_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for tbl_detalle_nomina
-- ----------------------------
DROP TABLE IF EXISTS `tbl_detalle_nomina`;
CREATE TABLE `tbl_detalle_nomina`  (
  `iddetalle_nonina` int NOT NULL AUTO_INCREMENT,
  `idglobal` int NOT NULL,
  `idnomina` int NOT NULL,
  `idcontabilidad_detalle` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_tipo` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_estado` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  PRIMARY KEY (`iddetalle_nonina`) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  INDEX `index2`(`idnomina` ASC) USING BTREE,
  INDEX `fk_tbl_detalle_nomina_tbl_contabilidad_detalle_1`(`idcontabilidad_detalle` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_detalle_nomina_tbl_contabilidad_detalle_1` FOREIGN KEY (`idcontabilidad_detalle`) REFERENCES `tbl_contabilidad_detalle` (`idcontabilidad_detalle`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_tbl_detalle_nomina_tbl_nomina_1` FOREIGN KEY (`idnomina`) REFERENCES `tbl_nomina` (`idnomina`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 18954 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = COMPACT;

-- ----------------------------
-- Table structure for tbl_detalle_pedido
-- ----------------------------
DROP TABLE IF EXISTS `tbl_detalle_pedido`;
CREATE TABLE `tbl_detalle_pedido`  (
  `iddetalle_pedido` int NOT NULL AUTO_INCREMENT,
  `idglobal` int NOT NULL,
  `idpedido` int NOT NULL,
  `iddetalle_ingreso` int NOT NULL,
  `int_cantidad` int NOT NULL,
  `dec_precio_venta` decimal(10, 2) NOT NULL,
  `dec_descuento` decimal(10, 2) NULL DEFAULT NULL,
  PRIMARY KEY (`iddetalle_pedido`) USING BTREE,
  INDEX `fk_detalle_venta_ingreso_idx`(`iddetalle_ingreso` ASC) USING BTREE,
  INDEX `fk_detalle_venta_idx`(`idpedido` ASC) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  INDEX `indexpedid`(`idpedido` ASC) USING BTREE,
  CONSTRAINT `fk_detalle_pedido_ingreso` FOREIGN KEY (`iddetalle_ingreso`) REFERENCES `tbl_detalle_ingreso` (`iddetalle_ingreso`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_detalle_pedido_tbl_pedido_1` FOREIGN KEY (`idpedido`) REFERENCES `tbl_pedido` (`idpedido`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = COMPACT;

-- ----------------------------
-- Table structure for tbl_detalle_ruta
-- ----------------------------
DROP TABLE IF EXISTS `tbl_detalle_ruta`;
CREATE TABLE `tbl_detalle_ruta`  (
  `iddetalleruta` int NOT NULL AUTO_INCREMENT,
  `idglobal` int NOT NULL,
  `idsucursal` int NOT NULL,
  `idempleado_resibe` int NOT NULL,
  `str_estado` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL DEFAULT '0',
  `created_at` datetime NULL DEFAULT NULL,
  `updated_at` datetime NULL DEFAULT NULL,
  PRIMARY KEY (`iddetalleruta`) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  INDEX `fk_tbl_detalle_ruta_tbl_sucursal_1`(`idsucursal` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_detalle_ruta_tbl_sucursal_1` FOREIGN KEY (`idsucursal`) REFERENCES `tbl_sucursal` (`idsucursal`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 31995 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for tbl_direccion
-- ----------------------------
DROP TABLE IF EXISTS `tbl_direccion`;
CREATE TABLE `tbl_direccion`  (
  `iddireccion` int NOT NULL AUTO_INCREMENT,
  `str_pais` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_departamento` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_municipio` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_barrio` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_direccion` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_puntoReferencia` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_geoLocalization` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NULL DEFAULT NULL,
  `str_accion` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_estado` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  PRIMARY KEY (`iddireccion`) USING BTREE,
  UNIQUE INDEX `indez`(`iddireccion` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish2_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for tbl_direccions_persona
-- ----------------------------
DROP TABLE IF EXISTS `tbl_direccions_persona`;
CREATE TABLE `tbl_direccions_persona`  (
  `id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `idperson` int NOT NULL,
  `iddireccion` int NOT NULL,
  PRIMARY KEY (`id`, `idperson`, `iddireccion`) USING BTREE,
  INDEX `fk_tbl_direccions_persona_tbl_persona_1`(`idperson` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_direccions_persona_tbl_direccion_1` FOREIGN KEY (`idperson`) REFERENCES `tbl_direccion` (`iddireccion`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for tbl_divisa
-- ----------------------------
DROP TABLE IF EXISTS `tbl_divisa`;
CREATE TABLE `tbl_divisa`  (
  `iddivisa` int NOT NULL AUTO_INCREMENT,
  `juridicion` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NULL DEFAULT NULL,
  `divisa` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NULL DEFAULT NULL,
  `codigo` varchar(8) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NULL DEFAULT NULL,
  `simbolo` varchar(5) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NULL DEFAULT NULL,
  PRIMARY KEY (`iddivisa`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_general_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for tbl_docs_tarjetas
-- ----------------------------
DROP TABLE IF EXISTS `tbl_docs_tarjetas`;
CREATE TABLE `tbl_docs_tarjetas`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `idtarjeta` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `idimagen` int NOT NULL,
  PRIMARY KEY (`id`, `idtarjeta`, `idimagen`) USING BTREE,
  INDEX `fk_tbl_docs_tbl_imagen_1`(`idimagen` ASC) USING BTREE,
  INDEX `fk_tbl_docs_tbl_tarjetas_1`(`idtarjeta` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_docs_tbl_imagen_1` FOREIGN KEY (`idimagen`) REFERENCES `tbl_imagen` (`idimagen`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_tbl_docs_tbl_tarjetas_1` FOREIGN KEY (`idtarjeta`) REFERENCES `tbl_tarjetas` (`idtarjeta`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = COMPACT;

-- ----------------------------
-- Table structure for tbl_empleado
-- ----------------------------
DROP TABLE IF EXISTS `tbl_empleado`;
CREATE TABLE `tbl_empleado`  (
  `idempleado` int NOT NULL AUTO_INCREMENT,
  `idglobal` int NOT NULL,
  `idpersona` int NOT NULL,
  `str_apodo` varchar(30) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_cargo` varchar(30) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_estado` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_comentarios` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `date_fecha_inicio` date NOT NULL,
  `created_at` datetime NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `update_at` datetime NULL DEFAULT NULL,
  PRIMARY KEY (`idempleado`) USING BTREE,
  INDEX `index1`(`idglobal` ASC) USING BTREE,
  INDEX `index2`(`idpersona` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_empleado_tbl_persona_1` FOREIGN KEY (`idpersona`) REFERENCES `tbl_persona` (`idpersona`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 333 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = COMPACT;

-- ----------------------------
-- Table structure for tbl_empleados_asignado
-- ----------------------------
DROP TABLE IF EXISTS `tbl_empleados_asignado`;
CREATE TABLE `tbl_empleados_asignado`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `idempleado` int NOT NULL,
  `idempleado_asignado` int NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `fk_idempleado`(`idempleado` ASC) USING BTREE,
  INDEX `fkidempleado_asignado`(`idempleado_asignado` ASC) USING BTREE,
  CONSTRAINT `fk_idempleado` FOREIGN KEY (`idempleado`) REFERENCES `tbl_empleado` (`idempleado`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fkidempleado_asignado` FOREIGN KEY (`idempleado_asignado`) REFERENCES `tbl_empleado` (`idempleado`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 278 CHARACTER SET = latin1 COLLATE = latin1_spanish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_empleados_cobrando
-- ----------------------------
DROP TABLE IF EXISTS `tbl_empleados_cobrando`;
CREATE TABLE `tbl_empleados_cobrando`  (
  `idempleadoscobrando` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `idempleado` int NOT NULL,
  `id_detalle_ruta` int NOT NULL,
  `str_estado` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  PRIMARY KEY (`idempleadoscobrando`, `idempleado`, `id_detalle_ruta`) USING BTREE,
  INDEX `fk_tbl_empleados_cobrando_tbl_detalle_ruta_1`(`id_detalle_ruta` ASC) USING BTREE,
  INDEX `fk_tbl_empleados_cobrando_tbl_empleado_1`(`idempleado` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_empleados_cobrando_tbl_detalle_ruta_1` FOREIGN KEY (`id_detalle_ruta`) REFERENCES `tbl_detalle_ruta` (`iddetalleruta`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_empleados_cobrando_tbl_empleado_1` FOREIGN KEY (`idempleado`) REFERENCES `tbl_empleado` (`idempleado`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for tbl_global
-- ----------------------------
DROP TABLE IF EXISTS `tbl_global`;
CREATE TABLE `tbl_global`  (
  `idglobal` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `str_razon_social` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_tipo_documento` varchar(30) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `str_documento` varchar(30) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `str_email` varchar(150) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `str_tipo` varchar(15) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `str_nombre_impuesto` varchar(5) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `dec_porcentaje_impuesto` decimal(5, 2) NOT NULL,
  `str_logo` varchar(50) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `str_estado` varchar(50) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `str_telefono` varchar(15) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `iddireccion` int NULL DEFAULT NULL,
  `int_maxsucursal` int NULL DEFAULT NULL,
  `bool_writemiles` bit(1) NOT NULL,
  `bool_viewmiles` bit(1) NOT NULL,
  `divisaid` int NULL DEFAULT NULL,
  `empresaid` int UNSIGNED NOT NULL,
  `superadmin_personaid` int NOT NULL,
  `created_at` datetime NULL DEFAULT NULL,
  `updated_at` datetime NULL DEFAULT NULL,
  PRIMARY KEY (`idglobal`) USING BTREE,
  UNIQUE INDEX `index_persona_empresasio`(`superadmin_personaid` ASC) USING BTREE,
  INDEX `index_divisa`(`divisaid` ASC) USING BTREE,
  INDEX `empresaindex`(`empresaid` ASC) USING BTREE,
  INDEX `fk_tbl_gobal_tbl_direccion_1`(`iddireccion` ASC) USING BTREE,
  INDEX `empresa_`(`str_razon_social` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_gobal_tbl_direccion_1` FOREIGN KEY (`iddireccion`) REFERENCES `tbl_direccion` (`iddireccion`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_gobal_tbl_divisa_1` FOREIGN KEY (`divisaid`) REFERENCES `tbl_divisa` (`iddivisa`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_gobal_tbl_gobal_1` FOREIGN KEY (`empresaid`) REFERENCES `tbl_global` (`idglobal`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_gobal_tbl_persona_1` FOREIGN KEY (`superadmin_personaid`) REFERENCES `tbl_persona` (`idpersona`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 1037 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = COMPACT;

-- ----------------------------
-- Table structure for tbl_imagen
-- ----------------------------
DROP TABLE IF EXISTS `tbl_imagen`;
CREATE TABLE `tbl_imagen`  (
  `idimagen` int NOT NULL AUTO_INCREMENT,
  `str_title` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `str_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `str_imagen_url` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `str_imagen_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `str_estado` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  PRIMARY KEY (`idimagen`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for tbl_imagenes_articulo
-- ----------------------------
DROP TABLE IF EXISTS `tbl_imagenes_articulo`;
CREATE TABLE `tbl_imagenes_articulo`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `idarticulo` int NOT NULL,
  `idimagen` int NOT NULL,
  PRIMARY KEY (`id`, `idarticulo`, `idimagen`) USING BTREE,
  INDEX `fk_tbl_imagenes_articulo_tbl_imagen_1`(`idimagen` ASC) USING BTREE,
  INDEX `fk_tbl_imagenes_articulo_tbl_articulo_1`(`idarticulo` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_imagenes_articulo_tbl_articulo_1` FOREIGN KEY (`idarticulo`) REFERENCES `tbl_articulo` (`idarticulo`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_imagenes_articulo_tbl_imagen_1` FOREIGN KEY (`idimagen`) REFERENCES `tbl_imagen` (`idimagen`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for tbl_imgs_global
-- ----------------------------
DROP TABLE IF EXISTS `tbl_imgs_global`;
CREATE TABLE `tbl_imgs_global`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `idglogal` int UNSIGNED NOT NULL,
  `idimagen` int NOT NULL,
  PRIMARY KEY (`id`, `idglogal`, `idimagen`) USING BTREE,
  INDEX `fk_tbl_imgs_global_tbl_imagen_1`(`idimagen` ASC) USING BTREE,
  INDEX `fk_tbl_imgs_global_tbl_gobal_1`(`idglogal` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_imgs_global_tbl_gobal_1` FOREIGN KEY (`idglogal`) REFERENCES `tbl_global` (`idglobal`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_imgs_global_tbl_imagen_1` FOREIGN KEY (`idimagen`) REFERENCES `tbl_imagen` (`idimagen`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for tbl_imgs_persona
-- ----------------------------
DROP TABLE IF EXISTS `tbl_imgs_persona`;
CREATE TABLE `tbl_imgs_persona`  (
  `id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `idpersona` int NOT NULL,
  `idimagen` int NOT NULL,
  PRIMARY KEY (`id`, `idpersona`, `idimagen`) USING BTREE,
  INDEX `fk_tbl_imgs_persona_tbl_imagen_1`(`idimagen` ASC) USING BTREE,
  INDEX `fk_tbl_imgs_persona_tbl_persona_1`(`idpersona` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_imgs_persona_tbl_imagen_1` FOREIGN KEY (`idimagen`) REFERENCES `tbl_imagen` (`idimagen`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_imgs_persona_tbl_persona_1` FOREIGN KEY (`idpersona`) REFERENCES `tbl_persona` (`idpersona`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for tbl_ingreso
-- ----------------------------
DROP TABLE IF EXISTS `tbl_ingreso`;
CREATE TABLE `tbl_ingreso`  (
  `idingreso` int NOT NULL AUTO_INCREMENT,
  `idglobal` int NULL DEFAULT NULL,
  `idsucursal` int NOT NULL,
  `idproveedor` int NOT NULL,
  `str_tipo_comprobante` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_serie_comprobante` varchar(7) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_num_comprobante` varchar(10) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `dec_impuesto` decimal(10, 2) NOT NULL,
  `dec_total` decimal(10, 2) NOT NULL,
  `str_estado` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `created_empleado_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `update_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`idingreso`) USING BTREE,
  INDEX `fk_ingreso_proveedor_idx`(`idproveedor` ASC) USING BTREE,
  INDEX `fk_ingreso_usuario_idx`(`created_empleado_id` ASC) USING BTREE,
  INDEX `fk_ingreso_sucursal_idx`(`idsucursal` ASC) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  CONSTRAINT `fk_ingreso_sucursal` FOREIGN KEY (`idsucursal`) REFERENCES `tbl_sucursal` (`idsucursal`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_ingreso_usuario` FOREIGN KEY (`created_empleado_id`) REFERENCES `tbl_empleado` (`idempleado`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_ingreso_tbl_proveedor_1` FOREIGN KEY (`idproveedor`) REFERENCES `tbl_proveedor` (`idproveedor`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = COMPACT;

-- ----------------------------
-- Table structure for tbl_natillera
-- ----------------------------
DROP TABLE IF EXISTS `tbl_natillera`;
CREATE TABLE `tbl_natillera`  (
  `idnatillera` int NOT NULL,
  `idglobal` int NOT NULL,
  `idpersona` int NOT NULL,
  `str_estado` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `created_at` datetime NULL DEFAULT NULL,
  `updated_at` datetime NULL DEFAULT NULL,
  PRIMARY KEY (`idnatillera`) USING BTREE,
  INDEX `index_idglobal`(`idglobal` ASC) USING BTREE,
  INDEX `index_idpersona`(`idpersona` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_natillera_tbl_persona_1` FOREIGN KEY (`idpersona`) REFERENCES `tbl_persona` (`idpersona`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish2_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for tbl_nomina
-- ----------------------------
DROP TABLE IF EXISTS `tbl_nomina`;
CREATE TABLE `tbl_nomina`  (
  `idnomina` int NOT NULL AUTO_INCREMENT,
  `idglobal` int NOT NULL,
  `idempleado` int NOT NULL,
  `str_modo_sueldo` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `dec_sueldo` decimal(10, 2) NOT NULL,
  `str_estado` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`idnomina`) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  INDEX `index2`(`idempleado` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_nomina_tbl_empleado_1` FOREIGN KEY (`idempleado`) REFERENCES `tbl_empleado` (`idempleado`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 322 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish2_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for tbl_pedido
-- ----------------------------
DROP TABLE IF EXISTS `tbl_pedido`;
CREATE TABLE `tbl_pedido`  (
  `idpedido` int NOT NULL AUTO_INCREMENT,
  `idglobal` int NOT NULL,
  `idcliente` int NOT NULL,
  `idsucursal` int NOT NULL,
  `str_tipo_pedido` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `int_numero` int NULL DEFAULT NULL,
  `str_estado` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `created_empleado_id` int NOT NULL,
  `created_at` datetime NULL DEFAULT NULL,
  `update_at` datetime NULL DEFAULT NULL,
  PRIMARY KEY (`idpedido`) USING BTREE,
  INDEX `fk_venta_cliente_idx`(`idcliente` ASC) USING BTREE,
  INDEX `fk_venta_trabajador_idx`(`created_empleado_id` ASC) USING BTREE,
  INDEX `fk_pedido_sucursal_idx`(`idsucursal` ASC) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  CONSTRAINT `fk_pedido_sucursal` FOREIGN KEY (`idsucursal`) REFERENCES `tbl_sucursal` (`idsucursal`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_pedido_trabajador` FOREIGN KEY (`created_empleado_id`) REFERENCES `tbl_empleado` (`idempleado`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_pedido_tbl_clientes_1` FOREIGN KEY (`idcliente`) REFERENCES `tbl_clientes` (`idcliente`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = COMPACT;

-- ----------------------------
-- Table structure for tbl_persona
-- ----------------------------
DROP TABLE IF EXISTS `tbl_persona`;
CREATE TABLE `tbl_persona`  (
  `idpersona` int NOT NULL AUTO_INCREMENT,
  `idglobal` int NOT NULL,
  `str_nombres` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_apellidos` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_sexo` varchar(20) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_fecha_nacimiento` varchar(11) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NULL DEFAULT NULL,
  `str_tipo_documento` varchar(45) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_num_documento` varchar(45) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_telefono` varchar(15) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_email` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_foto` varchar(50) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_ocupacion` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_estado` varchar(15) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_nota` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_email_verificado` varchar(25) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_direccion_departamento` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_direccion_ciudad` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_direccion_barrio` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_direccion_calle` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `created_at` datetime NULL DEFAULT NULL,
  `update_at` datetime NULL DEFAULT NULL,
  PRIMARY KEY (`idpersona`) USING BTREE,
  INDEX `index`(`str_num_documento` ASC) USING BTREE,
  INDEX `index_idgloba`(`idglobal` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 58498 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = COMPACT;

-- ----------------------------
-- Table structure for tbl_proveedor
-- ----------------------------
DROP TABLE IF EXISTS `tbl_proveedor`;
CREATE TABLE `tbl_proveedor`  (
  `idproveedor` int NOT NULL AUTO_INCREMENT,
  `idglobal` int NOT NULL,
  `idpersona` int NULL DEFAULT NULL,
  ` str_name_negoco` varchar(10) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_descripcion` varchar(150) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_estado` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  PRIMARY KEY (`idproveedor`) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  INDEX `index2`(`idpersona` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_proveedor_tbl_persona_1` FOREIGN KEY (`idpersona`) REFERENCES `tbl_persona` (`idpersona`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish2_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for tbl_sucursal
-- ----------------------------
DROP TABLE IF EXISTS `tbl_sucursal`;
CREATE TABLE `tbl_sucursal`  (
  `idsucursal` int NOT NULL AUTO_INCREMENT,
  `idglobal` int NOT NULL,
  `str_tipo` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_codigo` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_tipo_documento` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_num_documento` varchar(15) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_direccion` varchar(150) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_telefono` varchar(10) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_email` varchar(70) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `idempleado` int NOT NULL COMMENT 'representante',
  `str_logo` varchar(50) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_cobro_adicional` enum('seguro','boleta','ninguno') CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL DEFAULT 'seguro',
  `str_estado` varchar(15) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `created_at` datetime NULL DEFAULT NULL,
  `updated_at` datetime NULL DEFAULT NULL,
  PRIMARY KEY (`idsucursal`) USING BTREE,
  INDEX `fkuser`(`idempleado` ASC) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  CONSTRAINT `fkuser` FOREIGN KEY (`idempleado`) REFERENCES `tbl_empleado` (`idempleado`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 156 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = COMPACT;

-- ----------------------------
-- Table structure for tbl_tarjetas
-- ----------------------------
DROP TABLE IF EXISTS `tbl_tarjetas`;
CREATE TABLE `tbl_tarjetas`  (
  `idtarjeta` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `idglobal` int NOT NULL,
  `idsucursal` int NOT NULL,
  `idcliente` int NOT NULL,
  `idventa` int NULL DEFAULT NULL,
  `iddetalleruta` int NOT NULL,
  `str_concepto` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `dec_valor` decimal(10, 2) NOT NULL,
  `str_modo` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `int_tiempo` int NOT NULL,
  `dec_prestamo` decimal(10, 2) NOT NULL,
  `dec_resta` decimal(10, 2) NOT NULL,
  `str_descripcion` text CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `float_item` float NOT NULL,
  `dec_utilidad` decimal(10, 2) NOT NULL,
  `str_c_adicional_numero` varchar(11) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `dec_c_adicional_valor` decimal(5, 2) NOT NULL,
  `str_tipo_comprobante` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_serie` varchar(11) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_numero` varchar(11) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_nota` text CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_abono` varchar(250) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_style` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_estado` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `created_empleado_id` int NOT NULL,
  `date_acuerdo` date NULL DEFAULT NULL,
  `created_at` datetime NULL DEFAULT NULL,
  `updated_at` datetime NULL DEFAULT NULL,
  PRIMARY KEY (`idtarjeta`) USING BTREE,
  INDEX `fk_targ_usuar_id`(`created_empleado_id` ASC) USING BTREE,
  INDEX `fk_targ_sucursal_id`(`idsucursal` ASC) USING BTREE,
  INDEX `index`(`float_item` ASC) USING BTREE,
  INDEX `indexc`(`idcliente` ASC) USING BTREE,
  INDEX `index_idventa`(`idventa` ASC) USING BTREE,
  INDEX `idglobal`(`idglobal` ASC) USING BTREE,
  INDEX `fk_tbl_tarjetas_tbl_detalle_ruta_1`(`iddetalleruta` ASC) USING BTREE,
  CONSTRAINT `fk_targ_sucursal_id` FOREIGN KEY (`idsucursal`) REFERENCES `tbl_sucursal` (`idsucursal`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_tarjetas_tbl_clientes_1` FOREIGN KEY (`idcliente`) REFERENCES `tbl_clientes` (`idcliente`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_tarjetas_tbl_detalle_ruta_1` FOREIGN KEY (`iddetalleruta`) REFERENCES `tbl_detalle_ruta` (`iddetalleruta`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_tarjetas_tbl_empleado_1` FOREIGN KEY (`created_empleado_id`) REFERENCES `tbl_empleado` (`idempleado`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = COMPACT;

-- ----------------------------
-- Table structure for tbl_tipo_contabilidad
-- ----------------------------
DROP TABLE IF EXISTS `tbl_tipo_contabilidad`;
CREATE TABLE `tbl_tipo_contabilidad`  (
  `idtipo_contabilidad` int NOT NULL AUTO_INCREMENT,
  `idglobal` int NOT NULL,
  `str_categoria` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_operacion` enum('salida','entrada','info') CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  PRIMARY KEY (`idtipo_contabilidad`) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 13 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish2_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_tipo_documento
-- ----------------------------
DROP TABLE IF EXISTS `tbl_tipo_documento`;
CREATE TABLE `tbl_tipo_documento`  (
  `idtipo_documento` int NOT NULL AUTO_INCREMENT,
  `idglobal` int NOT NULL,
  `str_nombre` varchar(45) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_operacion` varchar(45) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_abreviatura` varchar(45) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  PRIMARY KEY (`idtipo_documento`) USING BTREE,
  UNIQUE INDEX `nombre_UNIQUE`(`str_nombre` ASC) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 26 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_unidad_medida
-- ----------------------------
DROP TABLE IF EXISTS `tbl_unidad_medida`;
CREATE TABLE `tbl_unidad_medida`  (
  `idunidad_medida` int NOT NULL AUTO_INCREMENT,
  `idglobal` int NOT NULL,
  `str_nombre` varchar(30) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_prefijo` varchar(5) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_estado` char(1) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  PRIMARY KEY (`idunidad_medida`) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = COMPACT;

-- ----------------------------
-- Table structure for tbl_usuario
-- ----------------------------
DROP TABLE IF EXISTS `tbl_usuario`;
CREATE TABLE `tbl_usuario`  (
  `idusuario` int NOT NULL AUTO_INCREMENT COMMENT 'uniqid — Generar un ID único',
  `idglobal` int NOT NULL,
  `idpersona` int NOT NULL,
  `str_user_name` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NULL DEFAULT NULL,
  `str_password` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_terminos_condiciones` enum('si acepto','no acepto','pendiente') CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_estado` varchar(20) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  PRIMARY KEY (`idusuario`) USING BTREE,
  INDEX `index`(`idpersona` ASC) USING BTREE COMMENT 'Une el usuario con una persona',
  INDEX `index_globalid`(`idglobal` ASC) USING BTREE,
  INDEX `index_pass`(`str_password` ASC) USING BTREE,
  INDEX `index_username`(`str_user_name` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_usuario_tbl_persona_1` FOREIGN KEY (`idpersona`) REFERENCES `tbl_persona` (`idpersona`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 334 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish2_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for tbl_venta
-- ----------------------------
DROP TABLE IF EXISTS `tbl_venta`;
CREATE TABLE `tbl_venta`  (
  `idventa` int NOT NULL AUTO_INCREMENT,
  `idglobal` int NOT NULL,
  `idpedido` int NOT NULL,
  `tipo_venta` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_tipo_comprobante` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_serie_comprobante` varchar(7) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_num_comprobante` varchar(10) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `dec_impuesto` decimal(10, 3) NOT NULL,
  `dec_total` decimal(10, 3) NOT NULL,
  `estado` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `created_empleado_id` int NOT NULL,
  `created_at` datetime NULL DEFAULT NULL,
  `updated_at` datetime NULL DEFAULT NULL,
  PRIMARY KEY (`idventa`) USING BTREE,
  INDEX `fk_venta_pedido_idx`(`idpedido` ASC) USING BTREE,
  INDEX `fk_venta_usuario_idx`(`created_empleado_id` ASC) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_venta_tbl_pedido_1` FOREIGN KEY (`idpedido`) REFERENCES `tbl_pedido` (`idpedido`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_venta_usuario` FOREIGN KEY (`created_empleado_id`) REFERENCES `tbl_empleado` (`idempleado`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = COMPACT;

-- ----------------------------
-- View structure for view_auth_sucursal
-- ----------------------------
DROP VIEW IF EXISTS `view_auth_sucursal`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `view_auth_sucursal` AS select `asu`.`idauth_sucursal` AS `refAuthSucursal`,`asu`.`idempleado` AS `refEmpleado`,`asu`.`tipo_usuario` AS `tipoUsuario`,`asu`.`str_estado` AS `estadoAuthSucursal`,`s`.`idsucursal` AS `refSucursal`,`s`.`str_codigo` AS `codigo`,`ats`.`id` AS `refid`,`ats`.`idauth_sucursal` AS `refAuthsSucursal`,`a`.`idauth` AS `refAuth`,`a`.`str_categoria` AS `categoria`,`a`.`str_nombre` AS `nameAccion`,`a`.`str_descripcion` AS `descripcion`,`a`.`dec_item` AS `item` from (((`tbl_auth_sucursal` `asu` join `tbl_sucursal` `s` on(`s`.`idsucursal` = `asu`.`idsucursal`)) left join `tbl_auths` `ats` on(`ats`.`idauth_sucursal` = `asu`.`idauth_sucursal`)) left join `tbl_auth` `a` on(`a`.`idauth` = `ats`.`idauth`));

-- ----------------------------
-- View structure for view_cobro_detallado
-- ----------------------------
DROP VIEW IF EXISTS `view_cobro_detallado`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `view_cobro_detallado` AS select `s`.`str_codigo` AS `codigo`,`s`.`str_logo` AS `logo`,`s`.`str_tipo` AS `tipo`,`dr`.`iddetalleruta` AS `refDetalle_ruta`,`dr`.`idglobal` AS `refGlobal`,`dr`.`idsucursal` AS `refSucursal`,`dr`.`idempleado_resibe` AS `idcreated`,`dr`.`str_estado` AS `estado`,`dr`.`created_at` AS `fecha_at`,`dr`.`updated_at` AS `fecha_up`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`idtipo_contabilidad` <> 8) AS `efectivoCaja`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'recaudo') AS `recaudo`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'cantidad-abonos') AS `cantidadRecaudos`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'prestamos') AS `prestamo`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'articulos') AS `ventaArticulo`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'efectivo-otra-utilidad') AS `efectivoOtraUtilidad`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'diferencia') AS `diferencia`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'base') AS `base`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'efectivo') AS `efectivo`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'efectivoMonedas') AS `efectivoMonedas`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'descuento') AS `descuento`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'mas-utilidad') AS `masUtilidad`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'valorTotalCreditos') AS `valorTotalCreditos`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) * -1 from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` <> 'prestamos' and `tbl_contabilidad_detalle`.`str_nombre` <> 'articulos' and `tbl_contabilidad_detalle`.`str_operacion` like 'salida-totalizar%') AS `gastos`,(select group_concat(`tbl_contabilidad_detalle`.`str_nombre`,' ',`tbl_contabilidad_detalle`.`dec_total`,'  : ',`tbl_contabilidad_detalle`.`str_detalle` separator ' ||<br/> ') from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` <> 'prestamos' and `tbl_contabilidad_detalle`.`str_nombre` <> 'articulos' and `tbl_contabilidad_detalle`.`str_operacion` like 'salida-totalizar%') AS `descripcion_gastos`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) * -1 from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`idtipo_contabilidad` <> 6 and `tbl_contabilidad_detalle`.`str_operacion` like 'salida-contabilidad%') AS `otros_gastos`,(select group_concat(`tbl_contabilidad_detalle`.`str_nombre`,' ',`tbl_contabilidad_detalle`.`dec_total`,'  : ',`tbl_contabilidad_detalle`.`str_detalle` separator ' ||<br/> ') from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`idtipo_contabilidad` <> 6 and `tbl_contabilidad_detalle`.`str_operacion` like 'salida-contabilidad%') AS `descripcion_otros_gastos`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) * -1 from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`idtipo_contabilidad` = 6 and `tbl_contabilidad_detalle`.`str_operacion` like 'salida-contabilidad%') AS `salida`,(select group_concat(`tbl_contabilidad_detalle`.`str_nombre`,' ',`tbl_contabilidad_detalle`.`dec_total`,'  : ',`tbl_contabilidad_detalle`.`str_detalle` separator ' ||<br/> ') from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`idtipo_contabilidad` = 6 and `tbl_contabilidad_detalle`.`str_operacion` like 'salida-contabilidad%') AS `descripcion_salida`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`idtipo_contabilidad` = 9) AS `entrada`,(select group_concat(`tbl_contabilidad_detalle`.`str_nombre`,' ',`tbl_contabilidad_detalle`.`dec_total`,'  : ',`tbl_contabilidad_detalle`.`str_detalle` separator ' ||<br/> ') from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`idtipo_contabilidad` = 9) AS `descripcion_entrada` from (`tbl_detalle_ruta` `dr` join `tbl_sucursal` `s` on(`s`.`idsucursal` = `dr`.`idsucursal`));

-- ----------------------------
-- View structure for view_contabilidad
-- ----------------------------
DROP VIEW IF EXISTS `view_contabilidad`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `view_contabilidad` AS select `s`.`str_codigo` AS `codigo`,`s`.`str_logo` AS `logo`,`s`.`str_tipo` AS `tipo`,`dr`.`iddetalleruta` AS `refDetalle_ruta`,`dr`.`idglobal` AS `refGlobal`,`dr`.`idsucursal` AS `refSucursal`,`dr`.`idempleado_resibe` AS `idcreated`,`dr`.`str_estado` AS `estado`,`dr`.`created_at` AS `fecha_at`,`dr`.`updated_at` AS `fecha_up`,`cd`.`dec_total` AS `valor`,`cd`.`str_nombre` AS `de` from ((`tbl_detalle_ruta` `dr` join `tbl_sucursal` `s` on(`s`.`idsucursal` = `dr`.`idsucursal`)) join `tbl_contabilidad_detalle` `cd` on(`cd`.`iddetalleruta` = `dr`.`iddetalleruta`)) where `dr`.`str_estado` = 'saved' and `cd`.`str_operacion`  not like 'info-%';

-- ----------------------------
-- View structure for view_contabilidad_detalle_ruta
-- ----------------------------
DROP VIEW IF EXISTS `view_contabilidad_detalle_ruta`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `view_contabilidad_detalle_ruta` AS select `s`.`str_codigo` AS `codigo`,`s`.`str_logo` AS `logo`,`s`.`str_tipo` AS `tipo`,`dr`.`iddetalleruta` AS `refDetalle_ruta`,`dr`.`idglobal` AS `refGlobal`,`dr`.`idsucursal` AS `refSucursal`,`dr`.`idempleado_resibe` AS `idcreated`,`dr`.`str_estado` AS `estado`,`dr`.`created_at` AS `fecha_at`,`dr`.`updated_at` AS `fecha_up`,(select ifnull(sum(`tbl_tarjetas`.`dec_prestamo`),0) from `tbl_tarjetas` where `tbl_tarjetas`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_tarjetas`.`str_concepto` = 'Prestamo') + (select ifnull(sum(`tbl_tarjetas`.`dec_prestamo`),0) from `tbl_tarjetas` where `tbl_tarjetas`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_tarjetas`.`str_concepto` = 'Articulo') AS `creditos`,(select ifnull(sum(`tbl_tarjetas`.`dec_valor`),0) from `tbl_tarjetas` where `tbl_tarjetas`.`iddetalleruta` = `dr`.`iddetalleruta`) AS `valorTotalCreditos`,(select ifnull(sum(`tbl_tarjetas`.`dec_prestamo`),0) from `tbl_tarjetas` where `tbl_tarjetas`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_tarjetas`.`str_concepto` = 'Prestamo') AS `prestamo`,(select ifnull(sum(`tbl_tarjetas`.`dec_prestamo`),0) from `tbl_tarjetas` where `tbl_tarjetas`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_tarjetas`.`str_concepto` = 'Articulo') AS `articulo`,(select ifnull(sum(`tbl_tarjetas`.`dec_c_adicional_valor`),0) from `tbl_tarjetas` where `tbl_tarjetas`.`iddetalleruta` = `dr`.`iddetalleruta`) AS `efectivoOtraUtilidad`,(select ifnull(sum(`tbl_descripcion`.`dec_abono`),0) * -1 from `tbl_descripcion` where `tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_descripcion`.`str_descripcion` like '%Abono%' or `tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_descripcion`.`str_descripcion` like '%Inicial%' or `tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_descripcion`.`str_descripcion` like '%Cancelado%') AS `recaudo`,(select ifnull(count(`tbl_descripcion`.`iddetalleruta`),0) from `tbl_descripcion` where `tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_descripcion`.`str_descripcion` like '%Abono%' or `tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_descripcion`.`str_descripcion` like '%Inicial%' or `tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_descripcion`.`str_descripcion` like '%Cancelado%') AS `cantidadTotalRecaudos`,(select ifnull(sum(`tbl_descripcion`.`dec_abono`),0) * -1 from `tbl_descripcion` where `tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_descripcion`.`str_descripcion` like 'Intereses%') AS `masUtilidad`,(select ifnull(sum(`tbl_descripcion`.`dec_abono`),0) * -1 from `tbl_descripcion` where `tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_descripcion`.`str_descripcion` like 'Descuento%') AS `descuento`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_operacion` like 'salida-totalizar%') AS `gastos`,(select group_concat(`tbl_contabilidad_detalle`.`str_nombre`,' ',`tbl_contabilidad_detalle`.`dec_total`,'  : ',`tbl_contabilidad_detalle`.`str_detalle` separator ' ||<br/> ') from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` <> 'prestamos' and `tbl_contabilidad_detalle`.`str_operacion` like 'salida-totalizar%') AS `descripcion_gastos`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) * -1 from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`idtipo_contabilidad` <> 6 and `tbl_contabilidad_detalle`.`str_operacion` like 'salida-contabilidad%') AS `otros_gastos`,(select group_concat(`tbl_contabilidad_detalle`.`str_nombre`,' ',`tbl_contabilidad_detalle`.`dec_total`,'  : ',`tbl_contabilidad_detalle`.`str_detalle` separator ' ||<br/> ') from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`idtipo_contabilidad` <> 6 and `tbl_contabilidad_detalle`.`str_operacion` like 'salida-contabilidad%') AS `descripcion_otros_gastos`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) * -1 from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`idtipo_contabilidad` = 6) AS `salida`,(select group_concat(`tbl_contabilidad_detalle`.`str_nombre`,' ',`tbl_contabilidad_detalle`.`dec_total`,'  : ',`tbl_contabilidad_detalle`.`str_detalle` separator ' ||<br/> ') from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`idtipo_contabilidad` = 6) AS `descripcion_salida`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`idtipo_contabilidad` = 9) AS `entrada`,(select group_concat(`tbl_contabilidad_detalle`.`str_nombre`,' ',`tbl_contabilidad_detalle`.`dec_total`,'  : ',`tbl_contabilidad_detalle`.`str_detalle` separator ' ||<br/> ') from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`idtipo_contabilidad` = 9) AS `descripcion_entrada`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'base') AS `base`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'efectivo') AS `efectivo`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'efectivoMonedas') AS `efectivoMonedas`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'diferencia') AS `diferencia` from (`tbl_detalle_ruta` `dr` join `tbl_sucursal` `s` on(`s`.`idsucursal` = `dr`.`idsucursal`));

-- ----------------------------
-- View structure for view_detalle_nomina
-- ----------------------------
DROP VIEW IF EXISTS `view_detalle_nomina`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `view_detalle_nomina` AS select `dn`.`iddetalle_nonina` AS `refDetalleNomina`,`dn`.`str_estado` AS `estadoDetalleNomina`,`cd`.`dec_total` * -1 AS `valor`,`cd`.`str_nombre` AS `consepto`,`cd`.`str_detalle` AS `detalle`,`cd`.`created_at` AS `fecha_at`,`n`.`idempleado` AS `refEmpleado`,`n`.`str_estado` AS `estadoNomina`,`s`.`str_codigo` AS `codigo`,`s`.`str_tipo` AS `tipo` from (((`tbl_detalle_nomina` `dn` join `tbl_contabilidad_detalle` `cd` on(`cd`.`idcontabilidad_detalle` = `dn`.`idcontabilidad_detalle`)) join `tbl_nomina` `n` on(`n`.`idnomina` = `dn`.`idnomina`)) join `tbl_sucursal` `s` on(`s`.`idsucursal` = `cd`.`idsucursal`));

-- ----------------------------
-- View structure for view_egresos
-- ----------------------------
DROP VIEW IF EXISTS `view_egresos`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `view_egresos` AS select `cd`.`idsucursal` AS `refSucursal`,`cd`.`dec_total` AS `valor`,if(`tc`.`str_categoria` = 'empleado',(select concat(`p`.`str_nombres`,' ',`p`.`str_apellidos`,'<br/>',`cd`.`str_detalle`) from (((`tbl_detalle_nomina` `dn` join `tbl_nomina` `n` on(`n`.`idnomina` = `dn`.`idnomina`)) join `tbl_empleado` `e` on(`e`.`idempleado` = `n`.`idempleado`)) join `tbl_persona` `p` on(`p`.`idpersona` = `e`.`idpersona`)) where `dn`.`idcontabilidad_detalle` = `cd`.`idcontabilidad_detalle`),`cd`.`str_detalle`) AS `detalle`,`cd`.`str_nombre` AS `consepto`,`cd`.`idtipo_contabilidad` AS `ref_contabilida`,`cd`.`created_at` AS `fecha_at`,`tc`.`str_categoria` AS `categoria` from (`tbl_contabilidad_detalle` `cd` join `tbl_tipo_contabilidad` `tc` on(`tc`.`idtipo_contabilidad` = `cd`.`idtipo_contabilidad`)) where `tc`.`str_operacion` = 'salida' and `cd`.`str_operacion` like 'salida%';

-- ----------------------------
-- View structure for view_empresas_publica
-- ----------------------------
DROP VIEW IF EXISTS `view_empresas_publica`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `view_empresas_publica` AS select `g`.`idglobal` AS `refGlobal`,`g`.`str_razon_social` AS `razonSocial`,`g`.`str_estado` AS `estadoEmpresa`,`g`.`str_telefono` AS `telEmpresa`,`g`.`empresaid` AS `refEmpresa`,`g`.`int_maxsucursal` AS `mex_sucursal`,`g`.`str_logo` AS `logo`,`g`.`created_at` AS `fecha_atEmpresa`,`p`.`idpersona` AS `refPersona`,concat(convert(`p`.`str_nombres` using utf8mb3),' ',`p`.`str_apellidos`) AS `superadmin`,`p`.`str_nombres` AS `nombres`,`p`.`str_apellidos` AS `apellidos`,`p`.`str_sexo` AS `sexo`,`p`.`str_fecha_nacimiento` AS `f_nacimiento`,`p`.`str_email` AS `email`,`p`.`str_ocupacion` AS `ocupacion`,`p`.`str_estado` AS `estadoPersona`,`p`.`str_direccion_departamento` AS `departamento`,`p`.`str_direccion_ciudad` AS `ciudad`,`p`.`str_direccion_barrio` AS `barrio`,`p`.`str_direccion_calle` AS `calle`,`p`.`str_foto` AS `foto`,`p`.`str_telefono` AS `telefono`,`p`.`str_tipo_documento` AS `t_documento`,`p`.`str_num_documento` AS `n_documento`,`u`.`idusuario` AS `refUsuario`,`u`.`str_user_name` AS `username`,`u`.`str_password` AS `id` from ((`tbl_global` `g` join `tbl_persona` `p` on(`p`.`idpersona` = `g`.`superadmin_personaid`)) join `tbl_usuario` `u` on(`u`.`idpersona` = `p`.`idpersona`)) where `g`.`str_tipo` = 'publica';

-- ----------------------------
-- View structure for view_libro_contabilidad
-- ----------------------------
DROP VIEW IF EXISTS `view_libro_contabilidad`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `view_libro_contabilidad` AS select `s`.`str_codigo` AS `codigo`,`s`.`str_logo` AS `logo`,`s`.`str_tipo` AS `tipo`,`dr`.`iddetalleruta` AS `refDetalle_ruta`,`dr`.`idglobal` AS `refGlobal`,`dr`.`idsucursal` AS `refSucursal`,`dr`.`idempleado_resibe` AS `idcreated`,`dr`.`str_estado` AS `estado`,`dr`.`created_at` AS `fecha_at`,`dr`.`updated_at` AS `fecha_up`,sum(if(`cd`.`iddetalleruta` = `dr`.`iddetalleruta` and `cd`.`str_nombre` = 'efectivo',`cd`.`dec_total`,0)) AS `efectivo`,sum(if(`cd`.`iddetalleruta` = `dr`.`iddetalleruta` and `cd`.`str_nombre` = 'efectivoMonedas',`cd`.`dec_total`,0)) AS `efectivoMonedas`,sum(if(`cd`.`iddetalleruta` = `dr`.`iddetalleruta` and `cd`.`str_nombre` = 'base',`cd`.`dec_total`,0)) AS `base`,(select ifnull(sum(`tbl_descripcion`.`dec_abono`),0) from `tbl_descripcion` where `tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_descripcion`.`str_descripcion` like '%Abono%' or `tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_descripcion`.`str_descripcion` like '%Inicial%' or `tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_descripcion`.`str_descripcion` like '%Cancelado%') AS `recaudo`,(select ifnull(count(`tbl_descripcion`.`iddetalleruta`),0) from `tbl_descripcion` where `tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_descripcion`.`str_descripcion` like '%Abono%' or `tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_descripcion`.`str_descripcion` like '%Inicial%' or `tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_descripcion`.`str_descripcion` like '%Cancelado%') AS `cantidadRecaudos`,(select ifnull(sum(`tbl_tarjetas`.`dec_prestamo`),0) from `tbl_tarjetas` where `tbl_tarjetas`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_tarjetas`.`str_concepto` = 'Prestamo') AS `creditoPrestamos`,(select ifnull(sum(`tbl_tarjetas`.`dec_prestamo`),0) from `tbl_tarjetas` where `tbl_tarjetas`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_tarjetas`.`str_concepto` = 'Articulo') AS `creditosArticulos`,(select ifnull(sum(`tbl_tarjetas`.`dec_valor`),0) from `tbl_tarjetas` where `tbl_tarjetas`.`iddetalleruta` = `dr`.`iddetalleruta`) AS `creditosValorTotal`,(select ifnull(sum(`tbl_tarjetas`.`dec_c_adicional_valor`),0) from `tbl_tarjetas` where `tbl_tarjetas`.`iddetalleruta` = `dr`.`iddetalleruta`) AS `efectivoAdicional` from ((`tbl_detalle_ruta` `dr` join `tbl_sucursal` `s` on(`s`.`idsucursal` = `dr`.`idsucursal`)) join `tbl_contabilidad_detalle` `cd` on(`cd`.`iddetalleruta` = `dr`.`iddetalleruta`)) where `dr`.`str_estado` = 'saved' group by `dr`.`iddetalleruta`;

-- ----------------------------
-- View structure for view_list_client
-- ----------------------------
DROP VIEW IF EXISTS `view_list_client`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `view_list_client` AS select `p`.`idpersona` AS `refPersona`,`p`.`str_nombres` AS `nombres`,`p`.`str_apellidos` AS `apellidos`,`p`.`str_sexo` AS `sexo`,`p`.`str_fecha_nacimiento` AS `f_nacimiento`,`p`.`str_tipo_documento` AS `t_documento`,`p`.`str_num_documento` AS `n_documento`,`p`.`str_telefono` AS `telefono`,`p`.`str_email` AS `email`,`p`.`str_foto` AS `foto`,`p`.`str_ocupacion` AS `ocupacion`,`p`.`str_estado` AS `estado_persona`,`p`.`str_direccion_departamento` AS `departamento`,`p`.`str_direccion_ciudad` AS `ciudad`,`p`.`str_direccion_barrio` AS `barrio`,`p`.`str_direccion_calle` AS `calle`,`c`.`idcliente` AS `refCliente`,`c`.`dec_max_credito` AS `max_credito`,`c`.`str_apodo` AS `apodo`,`c`.`str_estado` AS `estado_cliente`,`c`.`str_calificacion` AS `calificacion`,`c`.`fiador_persona_id` AS `id_fiador`,`c`.`created_empleado_id` AS `id_create_empleado`,`c`.`create_at` AS `fecha_at`,`c`.`update_at` AS `fecha_up`,`t`.`idsucursal` AS `refSucursal` from ((`tbl_tarjetas` `t` join `tbl_clientes` `c` on(`c`.`idcliente` = `t`.`idcliente`)) join `tbl_persona` `p` on(`p`.`idpersona` = `c`.`idpersona`)) group by `t`.`idcliente` order by `c`.`create_at` desc;

-- ----------------------------
-- View structure for view_nomina
-- ----------------------------
DROP VIEW IF EXISTS `view_nomina`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `view_nomina` AS select `n`.`idnomina` AS `refNomina`,`n`.`idglobal` AS `refGlobal`,`n`.`idempleado` AS `refEmpleado`,`n`.`str_modo_sueldo` AS `m_sueldo`,`n`.`dec_sueldo` AS `sueldo`,`n`.`str_estado` AS `estado`,`n`.`created_at` AS `fecha_at`,concat(`p`.`str_nombres`,' ',`p`.`str_apellidos`) AS `empleado`,`p`.`str_tipo_documento` AS `t_documento`,`p`.`str_num_documento` AS `n_documento`,`p`.`str_telefono` AS `tel`,`p`.`str_foto` AS `foto` from ((`tbl_nomina` `n` join `tbl_empleado` `e` on(`e`.`idempleado` = `n`.`idempleado`)) join `tbl_persona` `p` on(`p`.`idpersona` = `e`.`idpersona`)) order by `n`.`created_at`;

-- ----------------------------
-- View structure for view_ruta
-- ----------------------------
DROP VIEW IF EXISTS `view_ruta`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `view_ruta` AS select `t`.`idtarjeta` AS `refTarjeta`,`t`.`idglobal` AS `refGlobal`,`t`.`idsucursal` AS `refSucursal`,`t`.`idcliente` AS `refCliente`,`t`.`idventa` AS `refVenta`,`t`.`str_concepto` AS `consepto`,`t`.`dec_valor` AS `valor`,`t`.`str_modo` AS `modo`,`t`.`int_tiempo` AS `plazo`,`t`.`dec_prestamo` AS `costo`,`t`.`dec_resta` AS `resta`,`t`.`str_descripcion` AS `descripcion`,`t`.`float_item` AS `item`,`t`.`dec_utilidad` AS `ut`,`t`.`str_c_adicional_numero` AS `ut_adi_num`,`t`.`dec_c_adicional_valor` AS `ut_adi_valor`,`t`.`str_tipo_comprobante` AS `comprobante`,`t`.`str_serie` AS `serie`,`t`.`str_numero` AS `numero`,`t`.`str_nota` AS `comentarios`,`t`.`str_abono` AS `ultimo_pago`,`t`.`str_style` AS `stylo`,`t`.`str_estado` AS `estado`,`t`.`created_empleado_id` AS `creado_por`,`t`.`date_acuerdo` AS `acuerdo`,`t`.`created_at` AS `fecha_at`,`t`.`updated_at` AS `fercha_up`,`c`.`str_apodo` AS `apodo`,`c`.`str_calificacion` AS `calificacion`,concat(`p`.`str_nombres`,' ',`p`.`str_apellidos`) AS `cliente`,`p`.`str_tipo_documento` AS `t_documento`,`p`.`str_num_documento` AS `n_documento`,`p`.`str_telefono` AS `tel`,`p`.`str_ocupacion` AS `ocupacion`,`p`.`str_foto` AS `foto`,(select ifnull(sum(`tbl_descripcion`.`dec_abono`),0) from `tbl_descripcion` where `tbl_descripcion`.`idtarjeta` = `t`.`idtarjeta` and `tbl_descripcion`.`str_estado` <> 'saved' and `tbl_descripcion`.`str_descripcion` like '%Abono%' or `tbl_descripcion`.`idtarjeta` = `t`.`idtarjeta` and `tbl_descripcion`.`str_estado` <> 'saved' and `tbl_descripcion`.`str_descripcion` like '%Inicial%' or `tbl_descripcion`.`idtarjeta` = `t`.`idtarjeta` and `tbl_descripcion`.`str_estado` <> 'saved' and `tbl_descripcion`.`str_descripcion` like '%Cancelado%') AS `recaudo`,(select ifnull(sum(`tbl_descripcion`.`dec_abono`),0) from `tbl_descripcion` where `tbl_descripcion`.`idtarjeta` = `t`.`idtarjeta` and `tbl_descripcion`.`str_descripcion` like '%Inicial%') AS `inicial` from ((`tbl_tarjetas` `t` join `tbl_clientes` `c` on(`c`.`idcliente` = `t`.`idcliente`)) join `tbl_persona` `p` on(`p`.`idpersona` = `c`.`idpersona`)) order by `t`.`float_item`;

SET FOREIGN_KEY_CHECKS = 1;
