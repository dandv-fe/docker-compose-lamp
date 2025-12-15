/*
 Navicat Premium Dump SQL

 Source Server         : local
 Source Server Type    : MariaDB
 Source Server Version : 101114 (10.11.14-MariaDB-ubu2204)
 Source Host           : localhost:3306
 Source Schema         : websdnco_db_webgoez

 Target Server Type    : MariaDB
 Target Server Version : 101114 (10.11.14-MariaDB-ubu2204)
 File Encoding         : 65001

 Date: 15/12/2025 06:38:16
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for archivo_tar
-- ----------------------------
DROP TABLE IF EXISTS `archivo_tar`;
CREATE TABLE `archivo_tar`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `idsucrsal` int(11) NULL DEFAULT NULL,
  `idtargeta` int(11) NULL DEFAULT NULL,
  `cc_cliente` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NULL DEFAULT NULL,
  `targeta` text CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NULL DEFAULT NULL,
  `fecha` date NULL DEFAULT NULL,
  `val_can` int(11) NULL DEFAULT NULL,
  `datos` text CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NULL DEFAULT NULL,
  `descuento` int(11) NULL DEFAULT NULL,
  `det_descuento` varchar(150) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `cc_cliente`(`cc_cliente` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 144822 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_ahorros
-- ----------------------------
DROP TABLE IF EXISTS `tbl_ahorros`;
CREATE TABLE `tbl_ahorros`  (
  `idahorro` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NOT NULL,
  `idpersona` int(11) NOT NULL,
  `dec_porcentaje` decimal(5, 1) NOT NULL,
  `dec_ganancia_acumulada` decimal(10, 2) NOT NULL DEFAULT 0.00,
  `str_pago_utilidad` enum('automatico','manual') CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL DEFAULT 'manual',
  `bit_auth_movimientos` bit(1) NOT NULL DEFAULT b'0',
  `str_estado` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `created_at` datetime NULL DEFAULT NULL,
  `update_at` datetime NULL DEFAULT NULL,
  PRIMARY KEY (`idahorro`) USING BTREE,
  INDEX `index_idglobal`(`idglobal` ASC) USING BTREE,
  INDEX `index_idpersona`(`idpersona` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_ahorro_tbl_persona_1` FOREIGN KEY (`idpersona`) REFERENCES `tbl_persona` (`idpersona`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 6 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish2_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_articulo
-- ----------------------------
DROP TABLE IF EXISTS `tbl_articulo`;
CREATE TABLE `tbl_articulo`  (
  `idarticulo` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NOT NULL,
  `idcategoria` int(11) NOT NULL,
  `idunidad_medida` int(11) NOT NULL,
  `str_nombre` varchar(50) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_descripcion` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `str_marca` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NULL DEFAULT NULL,
  `imagen_ids` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `str_estado` char(1) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  PRIMARY KEY (`idarticulo`) USING BTREE,
  INDEX `fk_articulo_categoria_idx`(`idcategoria` ASC) USING BTREE,
  INDEX `fk_articulo_unidad_medida_idx`(`idunidad_medida` ASC) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  CONSTRAINT `fk_articulo_categoria` FOREIGN KEY (`idcategoria`) REFERENCES `tbl_categoria` (`idcategoria`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_articulo_unidad_medida` FOREIGN KEY (`idunidad_medida`) REFERENCES `tbl_unidad_medida` (`idunidad_medida`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for tbl_auth
-- ----------------------------
DROP TABLE IF EXISTS `tbl_auth`;
CREATE TABLE `tbl_auth`  (
  `idauth` int(11) NOT NULL AUTO_INCREMENT,
  `str_categoria` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_nombre` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_descripcion` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `dec_item` float NOT NULL,
  PRIMARY KEY (`idauth`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 54 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_auth_sucursal
-- ----------------------------
DROP TABLE IF EXISTS `tbl_auth_sucursal`;
CREATE TABLE `tbl_auth_sucursal`  (
  `idauth_sucursal` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NOT NULL,
  `idsucursal` int(11) NOT NULL,
  `idempleado` int(11) NOT NULL,
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
) ENGINE = InnoDB AUTO_INCREMENT = 735 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for tbl_auths
-- ----------------------------
DROP TABLE IF EXISTS `tbl_auths`;
CREATE TABLE `tbl_auths`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `idauth` int(11) NOT NULL,
  `idauth_sucursal` int(11) NOT NULL,
  PRIMARY KEY (`id`, `idauth`, `idauth_sucursal`) USING BTREE,
  INDEX `fk_tbl_auths_tbl_auth_1`(`idauth` ASC) USING BTREE,
  INDEX `fk_tbl_auths_tbl_auth_sucursal_1`(`idauth_sucursal` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_auths_tbl_auth_1` FOREIGN KEY (`idauth`) REFERENCES `tbl_auth` (`idauth`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_auths_tbl_auth_sucursal_1` FOREIGN KEY (`idauth_sucursal`) REFERENCES `tbl_auth_sucursal` (`idauth_sucursal`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 10379 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_banco
-- ----------------------------
DROP TABLE IF EXISTS `tbl_banco`;
CREATE TABLE `tbl_banco`  (
  `idbanco` int(11) NOT NULL AUTO_INCREMENT,
  `str_banco` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_tipo` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_num_cueneta` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_estado` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NULL DEFAULT NULL,
  PRIMARY KEY (`idbanco`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish2_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_categoria
-- ----------------------------
DROP TABLE IF EXISTS `tbl_categoria`;
CREATE TABLE `tbl_categoria`  (
  `idcategoria` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NOT NULL,
  `str_nombre` varchar(50) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_estado` char(1) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  PRIMARY KEY (`idcategoria`) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for tbl_clientes
-- ----------------------------
DROP TABLE IF EXISTS `tbl_clientes`;
CREATE TABLE `tbl_clientes`  (
  `idcliente` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NOT NULL,
  `idpersona` int(11) NOT NULL,
  `dec_max_credito` decimal(10, 2) NOT NULL,
  `str_apodo` varchar(20) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_nota` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_estado` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_calificacion` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `fiador_persona_id` int(11) NULL DEFAULT NULL,
  `created_empleado_id` int(11) NOT NULL,
  `create_at` datetime NULL DEFAULT NULL,
  `update_at` datetime NULL DEFAULT NULL,
  PRIMARY KEY (`idcliente`) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  INDEX `index2`(`idpersona` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_clientes_tbl_persona_1` FOREIGN KEY (`idpersona`) REFERENCES `tbl_persona` (`idpersona`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 67276 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish2_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_comentarios
-- ----------------------------
DROP TABLE IF EXISTS `tbl_comentarios`;
CREATE TABLE `tbl_comentarios`  (
  `idcomentario` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_comentario` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_tipo` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `idusuario` int(11) NOT NULL COMMENT 'id usuario created',
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
  `idcliente` int(11) NOT NULL,
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
  `idglobal` int(11) NOT NULL,
  `idsucursal` int(11) NOT NULL,
  `idtipo_contabilidad` int(11) NOT NULL,
  `iddetalleruta` int(11) NOT NULL,
  `dec_total` decimal(10, 2) NOT NULL,
  `str_detalle` varchar(250) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_nombre` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_estado` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_operacion` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `created_empleado_id` int(11) NOT NULL,
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
) ENGINE = InnoDB CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for tbl_de_contabilidad
-- ----------------------------
DROP TABLE IF EXISTS `tbl_de_contabilidad`;
CREATE TABLE `tbl_de_contabilidad`  (
  `idde_contabilidad` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NOT NULL,
  `idtipo_contabilidad` int(11) NOT NULL,
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
  `idglobal` int(11) NOT NULL,
  `idsucursal` int(11) NOT NULL,
  `idtarjeta` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `iddetalleruta` int(11) NOT NULL,
  `dec_abono` decimal(9, 2) NOT NULL,
  `str_descripcion` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_estado` varchar(20) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `created_at` datetime NULL DEFAULT NULL,
  `updated_at` datetime NULL DEFAULT NULL,
  PRIMARY KEY (`iddescripcion`) USING BTREE,
  INDEX `fey`(`idtarjeta` ASC) USING BTREE,
  INDEX `fk_desc_sucursal`(`idsucursal` ASC) USING BTREE,
  INDEX `index_idd`(`iddescripcion` ASC) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  INDEX `fk_tbl_descripcion_tbl_detalle_ruta_1`(`iddetalleruta` ASC) USING BTREE,
  CONSTRAINT `fk_desc_sucursal` FOREIGN KEY (`idsucursal`) REFERENCES `tbl_sucursal` (`idsucursal`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_tbl_descripcion_tbl_detalle_ruta_1` FOREIGN KEY (`iddetalleruta`) REFERENCES `tbl_detalle_ruta` (`iddetalleruta`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_descripcion_tbl_tarjetas_1` FOREIGN KEY (`idtarjeta`) REFERENCES `tbl_tarjetas` (`idtarjeta`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for tbl_descripcion_global
-- ----------------------------
DROP TABLE IF EXISTS `tbl_descripcion_global`;
CREATE TABLE `tbl_descripcion_global`  (
  `iddescripcion_global` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NOT NULL,
  `idglobal_accion` int(11) NOT NULL,
  `date_corte` date NOT NULL,
  `dec_valor` decimal(9, 2) NOT NULL,
  `int_dias_extras` int(11) NOT NULL,
  `str_estado` varchar(20) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`iddescripcion_global`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 156 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_detalle_documento_sucursal
-- ----------------------------
DROP TABLE IF EXISTS `tbl_detalle_documento_sucursal`;
CREATE TABLE `tbl_detalle_documento_sucursal`  (
  `iddetalle_documento_sucursal` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NOT NULL,
  `idsucursal` int(11) NOT NULL,
  `idtipo_documento` int(11) NOT NULL,
  `str_ultima_serie` varchar(7) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_ultimo_numero` varchar(10) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  PRIMARY KEY (`iddetalle_documento_sucursal`) USING BTREE,
  INDEX `fk_documento_sucursal_idx`(`idtipo_documento` ASC) USING BTREE,
  INDEX `fk_detalle_sucursal_idx`(`idsucursal` ASC) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  CONSTRAINT `fk_detalle_sucursal` FOREIGN KEY (`idsucursal`) REFERENCES `tbl_sucursal` (`idsucursal`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_documento_sucursal` FOREIGN KEY (`idtipo_documento`) REFERENCES `tbl_tipo_documento` (`idtipo_documento`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 174 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for tbl_detalle_ingreso
-- ----------------------------
DROP TABLE IF EXISTS `tbl_detalle_ingreso`;
CREATE TABLE `tbl_detalle_ingreso`  (
  `iddetalle_ingreso` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NOT NULL,
  `idingreso` int(11) NOT NULL,
  `idarticulo` int(11) NOT NULL,
  `str_codigo` varchar(50) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_serie` varchar(50) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `str_descripcion` varchar(150) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `int_stock_ingreso` int(11) NOT NULL,
  `int_stock_actual` int(11) NOT NULL,
  `dec_precio_compra` decimal(10, 2) NOT NULL,
  `dec_precio_ventadistribuidor` decimal(10, 2) NOT NULL,
  `dec_precio_ventapublico` decimal(10, 2) NOT NULL,
  PRIMARY KEY (`iddetalle_ingreso`) USING BTREE,
  INDEX `fk_detalle_ingreso_idx`(`idingreso` ASC) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  INDEX `index_articuloid`(`idarticulo` ASC) USING BTREE,
  CONSTRAINT `fk_detalle_ingreso` FOREIGN KEY (`idingreso`) REFERENCES `tbl_ingreso` (`idingreso`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_detalle_ingreso_tbl_articulo_1` FOREIGN KEY (`idarticulo`) REFERENCES `tbl_articulo` (`idarticulo`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for tbl_detalle_nomina
-- ----------------------------
DROP TABLE IF EXISTS `tbl_detalle_nomina`;
CREATE TABLE `tbl_detalle_nomina`  (
  `iddetalle_nonina` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NOT NULL,
  `idnomina` int(11) NOT NULL,
  `idcontabilidad_detalle` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_tipo` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `str_estado` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  PRIMARY KEY (`iddetalle_nonina`) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  INDEX `index2`(`idnomina` ASC) USING BTREE,
  INDEX `fk_tbl_detalle_nomina_tbl_contabilidad_detalle_1`(`idcontabilidad_detalle` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_detalle_nomina_tbl_contabilidad_detalle_1` FOREIGN KEY (`idcontabilidad_detalle`) REFERENCES `tbl_contabilidad_detalle` (`idcontabilidad_detalle`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_tbl_detalle_nomina_tbl_nomina_1` FOREIGN KEY (`idnomina`) REFERENCES `tbl_nomina` (`idnomina`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 24138 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for tbl_detalle_pedido
-- ----------------------------
DROP TABLE IF EXISTS `tbl_detalle_pedido`;
CREATE TABLE `tbl_detalle_pedido`  (
  `iddetalle_pedido` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NOT NULL,
  `idpedido` int(11) NOT NULL,
  `iddetalle_ingreso` int(11) NOT NULL,
  `int_cantidad` int(11) NOT NULL,
  `dec_precio_venta` decimal(10, 2) NOT NULL,
  `dec_descuento` decimal(10, 2) NULL DEFAULT NULL,
  PRIMARY KEY (`iddetalle_pedido`) USING BTREE,
  INDEX `fk_detalle_venta_ingreso_idx`(`iddetalle_ingreso` ASC) USING BTREE,
  INDEX `fk_detalle_venta_idx`(`idpedido` ASC) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  INDEX `indexpedid`(`idpedido` ASC) USING BTREE,
  CONSTRAINT `fk_detalle_pedido_ingreso` FOREIGN KEY (`iddetalle_ingreso`) REFERENCES `tbl_detalle_ingreso` (`iddetalle_ingreso`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_detalle_pedido_tbl_pedido_1` FOREIGN KEY (`idpedido`) REFERENCES `tbl_pedido` (`idpedido`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for tbl_detalle_ruta
-- ----------------------------
DROP TABLE IF EXISTS `tbl_detalle_ruta`;
CREATE TABLE `tbl_detalle_ruta`  (
  `iddetalleruta` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NOT NULL,
  `idsucursal` int(11) NOT NULL,
  `idempleado_resibe` int(11) NOT NULL,
  `str_estado` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL DEFAULT '0',
  `created_at` datetime NULL DEFAULT NULL,
  `updated_at` datetime NULL DEFAULT NULL,
  PRIMARY KEY (`iddetalleruta`) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  INDEX `fk_tbl_detalle_ruta_tbl_sucursal_1`(`idsucursal` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_detalle_ruta_tbl_sucursal_1` FOREIGN KEY (`idsucursal`) REFERENCES `tbl_sucursal` (`idsucursal`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 44144 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_direccion
-- ----------------------------
DROP TABLE IF EXISTS `tbl_direccion`;
CREATE TABLE `tbl_direccion`  (
  `iddireccion` int(11) NOT NULL AUTO_INCREMENT,
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
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish2_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_direccions_persona
-- ----------------------------
DROP TABLE IF EXISTS `tbl_direccions_persona`;
CREATE TABLE `tbl_direccions_persona`  (
  `id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `idperson` int(11) NOT NULL,
  `iddireccion` int(11) NOT NULL,
  PRIMARY KEY (`id`, `idperson`, `iddireccion`) USING BTREE,
  INDEX `fk_tbl_direccions_persona_tbl_persona_1`(`idperson` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_direccions_persona_tbl_direccion_1` FOREIGN KEY (`idperson`) REFERENCES `tbl_direccion` (`iddireccion`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_divisa
-- ----------------------------
DROP TABLE IF EXISTS `tbl_divisa`;
CREATE TABLE `tbl_divisa`  (
  `iddivisa` int(11) NOT NULL AUTO_INCREMENT,
  `juridicion` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NULL DEFAULT NULL,
  `divisa` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NULL DEFAULT NULL,
  `codigo` varchar(8) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NULL DEFAULT NULL,
  `simbolo` varchar(5) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NULL DEFAULT NULL,
  PRIMARY KEY (`iddivisa`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_docs_tarjetas
-- ----------------------------
DROP TABLE IF EXISTS `tbl_docs_tarjetas`;
CREATE TABLE `tbl_docs_tarjetas`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `idtarjeta` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `idimagen` int(11) NOT NULL,
  PRIMARY KEY (`id`, `idtarjeta`, `idimagen`) USING BTREE,
  INDEX `fk_tbl_docs_tbl_imagen_1`(`idimagen` ASC) USING BTREE,
  INDEX `fk_tbl_docs_tbl_tarjetas_1`(`idtarjeta` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_docs_tbl_imagen_1` FOREIGN KEY (`idimagen`) REFERENCES `tbl_imagen` (`idimagen`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_tbl_docs_tbl_tarjetas_1` FOREIGN KEY (`idtarjeta`) REFERENCES `tbl_tarjetas` (`idtarjeta`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for tbl_empleado
-- ----------------------------
DROP TABLE IF EXISTS `tbl_empleado`;
CREATE TABLE `tbl_empleado`  (
  `idempleado` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NOT NULL,
  `idpersona` int(11) NOT NULL,
  `str_apodo` varchar(30) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_cargo` varchar(30) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_estado` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_comentarios` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `date_fecha_inicio` date NOT NULL,
  `created_at` datetime NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `update_at` datetime NULL DEFAULT NULL,
  `idoficina` int(11) NULL DEFAULT NULL,
  `dec_max_credito` decimal(10, 2) NULL DEFAULT NULL,
  PRIMARY KEY (`idempleado`) USING BTREE,
  INDEX `index1`(`idglobal` ASC) USING BTREE,
  INDEX `index2`(`idpersona` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_empleado_tbl_persona_1` FOREIGN KEY (`idpersona`) REFERENCES `tbl_persona` (`idpersona`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 406 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_empleado_despido
-- ----------------------------
DROP TABLE IF EXISTS `tbl_empleado_despido`;
CREATE TABLE `tbl_empleado_despido`  (
  `idempleado_despido` int(11) NOT NULL AUTO_INCREMENT COMMENT 'ID único del despido',
  `idglobal` int(10) UNSIGNED NOT NULL COMMENT 'ID de la empresa global',
  `idempleado` int(11) NOT NULL COMMENT 'ID del empleado despedido',
  `fecha_despido` date NOT NULL COMMENT 'Fecha efectiva del despido',
  `tipo_despido` enum('despido_justificado','despido_injustificado','renuncia_voluntaria','terminacion_contrato','reduccion_personal','incapacidad_permanente','jubilacion','otro') CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL COMMENT 'Tipo de despido',
  `motivo_despido` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL COMMENT 'Motivo detallado del despido',
  `autorizado_por` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL COMMENT 'Nombre de quien autoriza el despido',
  `cargo_autoriza` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL COMMENT 'Cargo de quien autoriza',
  `observaciones` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL COMMENT 'Observaciones adicionales',
  `fecha_ultimo_trabajo` date NULL DEFAULT NULL COMMENT 'Último día trabajado (si difiere de fecha_despido)',
  `monto_fraude` decimal(10, 2) NULL DEFAULT NULL COMMENT 'Si hubo fraude por parte del empleado',
  `monto_fraude_pendiente` decimal(10, 2) NULL DEFAULT NULL COMMENT 'Monto del fraude cometido',
  `entrega_documentos` enum('pendiente','parcial','completa') CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL DEFAULT 'pendiente' COMMENT 'Estado de entrega de documentos',
  `documentos_entregados` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL COMMENT 'Lista de documentos entregados',
  `acta_firmada` enum('si','no','pendiente') CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL DEFAULT 'pendiente' COMMENT 'Si firmó acta de despido',
  `derecho_recontratacion` enum('si','no','condicional') CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL DEFAULT 'si' COMMENT 'Derecho a ser recontratado',
  `str_estado` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL DEFAULT 'activo' COMMENT 'Estado del registro',
  `created_empleado_id` int(11) NOT NULL COMMENT 'ID del empleado que registra el despido',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Fecha de creación del registro',
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de última actualización',
  PRIMARY KEY (`idempleado_despido`) USING BTREE,
  INDEX `idx_empleado_despido`(`idempleado` ASC) USING BTREE,
  INDEX `idx_global`(`idglobal` ASC) USING BTREE,
  INDEX `idx_fecha_despido`(`fecha_despido` ASC) USING BTREE,
  INDEX `idx_tipo_despido`(`tipo_despido` ASC) USING BTREE,
  INDEX `idx_created_empleado`(`created_empleado_id` ASC) USING BTREE,
  INDEX `idx_estado`(`str_estado` ASC) USING BTREE,
  CONSTRAINT `fk_empleado_despido_created_by` FOREIGN KEY (`created_empleado_id`) REFERENCES `tbl_empleado` (`idempleado`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_empleado_despido_empleado` FOREIGN KEY (`idempleado`) REFERENCES `tbl_empleado` (`idempleado`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 7 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci COMMENT = 'Tabla para registrar despidos de empleados con información detallada' ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for tbl_empleados_asignado
-- ----------------------------
DROP TABLE IF EXISTS `tbl_empleados_asignado`;
CREATE TABLE `tbl_empleados_asignado`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `idempleado` int(11) NOT NULL,
  `idempleado_asignado` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `fk_idempleado`(`idempleado` ASC) USING BTREE,
  INDEX `fkidempleado_asignado`(`idempleado_asignado` ASC) USING BTREE,
  CONSTRAINT `fk_idempleado` FOREIGN KEY (`idempleado`) REFERENCES `tbl_empleado` (`idempleado`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fkidempleado_asignado` FOREIGN KEY (`idempleado_asignado`) REFERENCES `tbl_empleado` (`idempleado`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 339 CHARACTER SET = latin1 COLLATE = latin1_spanish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_empleados_cobrando
-- ----------------------------
DROP TABLE IF EXISTS `tbl_empleados_cobrando`;
CREATE TABLE `tbl_empleados_cobrando`  (
  `idempleadoscobrando` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `idempleado` int(11) NOT NULL,
  `id_detalle_ruta` int(11) NOT NULL,
  `str_estado` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  PRIMARY KEY (`idempleadoscobrando`, `idempleado`, `id_detalle_ruta`) USING BTREE,
  INDEX `fk_tbl_empleados_cobrando_tbl_detalle_ruta_1`(`id_detalle_ruta` ASC) USING BTREE,
  INDEX `fk_tbl_empleados_cobrando_tbl_empleado_1`(`idempleado` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_empleados_cobrando_tbl_detalle_ruta_1` FOREIGN KEY (`id_detalle_ruta`) REFERENCES `tbl_detalle_ruta` (`iddetalleruta`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_empleados_cobrando_tbl_empleado_1` FOREIGN KEY (`idempleado`) REFERENCES `tbl_empleado` (`idempleado`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_global
-- ----------------------------
DROP TABLE IF EXISTS `tbl_global`;
CREATE TABLE `tbl_global`  (
  `idglobal` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
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
  `iddireccion` int(11) NULL DEFAULT NULL,
  `int_maxsucursal` int(11) NULL DEFAULT NULL,
  `bool_writemiles` bit(1) NOT NULL,
  `bool_viewmiles` bit(1) NOT NULL,
  `divisaid` int(11) NULL DEFAULT NULL,
  `empresaid` int(10) UNSIGNED NOT NULL,
  `superadmin_personaid` int(11) NOT NULL,
  `bit_ahorradores` bit(1) NOT NULL DEFAULT b'0',
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
) ENGINE = InnoDB AUTO_INCREMENT = 1046 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for tbl_imagen
-- ----------------------------
DROP TABLE IF EXISTS `tbl_imagen`;
CREATE TABLE `tbl_imagen`  (
  `idimagen` int(11) NOT NULL AUTO_INCREMENT,
  `str_title` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `str_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `str_imagen_url` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `str_imagen_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `str_estado` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  PRIMARY KEY (`idimagen`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_imagenes_articulo
-- ----------------------------
DROP TABLE IF EXISTS `tbl_imagenes_articulo`;
CREATE TABLE `tbl_imagenes_articulo`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `idarticulo` int(11) NOT NULL,
  `idimagen` int(11) NOT NULL,
  PRIMARY KEY (`id`, `idarticulo`, `idimagen`) USING BTREE,
  INDEX `fk_tbl_imagenes_articulo_tbl_imagen_1`(`idimagen` ASC) USING BTREE,
  INDEX `fk_tbl_imagenes_articulo_tbl_articulo_1`(`idarticulo` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_imagenes_articulo_tbl_articulo_1` FOREIGN KEY (`idarticulo`) REFERENCES `tbl_articulo` (`idarticulo`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_imagenes_articulo_tbl_imagen_1` FOREIGN KEY (`idimagen`) REFERENCES `tbl_imagen` (`idimagen`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_imgs_global
-- ----------------------------
DROP TABLE IF EXISTS `tbl_imgs_global`;
CREATE TABLE `tbl_imgs_global`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `idglogal` int(10) UNSIGNED NOT NULL,
  `idimagen` int(11) NOT NULL,
  PRIMARY KEY (`id`, `idglogal`, `idimagen`) USING BTREE,
  INDEX `fk_tbl_imgs_global_tbl_imagen_1`(`idimagen` ASC) USING BTREE,
  INDEX `fk_tbl_imgs_global_tbl_gobal_1`(`idglogal` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_imgs_global_tbl_gobal_1` FOREIGN KEY (`idglogal`) REFERENCES `tbl_global` (`idglobal`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_imgs_global_tbl_imagen_1` FOREIGN KEY (`idimagen`) REFERENCES `tbl_imagen` (`idimagen`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_imgs_persona
-- ----------------------------
DROP TABLE IF EXISTS `tbl_imgs_persona`;
CREATE TABLE `tbl_imgs_persona`  (
  `id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `idpersona` int(11) NOT NULL,
  `idimagen` int(11) NOT NULL,
  PRIMARY KEY (`id`, `idpersona`, `idimagen`) USING BTREE,
  INDEX `fk_tbl_imgs_persona_tbl_imagen_1`(`idimagen` ASC) USING BTREE,
  INDEX `fk_tbl_imgs_persona_tbl_persona_1`(`idpersona` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_imgs_persona_tbl_imagen_1` FOREIGN KEY (`idimagen`) REFERENCES `tbl_imagen` (`idimagen`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_tbl_imgs_persona_tbl_persona_1` FOREIGN KEY (`idpersona`) REFERENCES `tbl_persona` (`idpersona`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_ingreso
-- ----------------------------
DROP TABLE IF EXISTS `tbl_ingreso`;
CREATE TABLE `tbl_ingreso`  (
  `idingreso` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NULL DEFAULT NULL,
  `idsucursal` int(11) NOT NULL,
  `idproveedor` int(11) NOT NULL,
  `str_tipo_comprobante` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_serie_comprobante` varchar(7) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_num_comprobante` varchar(10) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `dec_impuesto` decimal(10, 2) NOT NULL,
  `dec_total` decimal(10, 2) NOT NULL,
  `str_estado` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `created_empleado_id` int(11) NOT NULL,
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
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for tbl_movimientos
-- ----------------------------
DROP TABLE IF EXISTS `tbl_movimientos`;
CREATE TABLE `tbl_movimientos`  (
  `idmovimiento` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NOT NULL,
  `idahorro` int(11) NOT NULL,
  `idusuario_created` int(11) NOT NULL,
  `date_movimiento` datetime NOT NULL DEFAULT current_timestamp(),
  `str_tipo` enum('aporte','retiro','ajuste') CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL DEFAULT 'aporte',
  `dec_valor` decimal(10, 2) NOT NULL,
  `str_descripcion` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `int_codigo` int(11) NULL DEFAULT NULL,
  `str_estado` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `created_at` datetime NOT NULL,
  `update_at` datetime NOT NULL,
  PRIMARY KEY (`idmovimiento`) USING BTREE,
  INDEX `indexid`(`idglobal` ASC) USING BTREE,
  INDEX `FK_tbl_movimientos_tbl_ahorros`(`idahorro` ASC) USING BTREE,
  INDEX `FK_tbl_movimientos_tbl_usuarios`(`idusuario_created` ASC) USING BTREE,
  CONSTRAINT `FK_tbl_movimientos_tbl_ahorros` FOREIGN KEY (`idahorro`) REFERENCES `tbl_ahorros` (`idahorro`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `FK_tbl_movimientos_tbl_usuarios` FOREIGN KEY (`idusuario_created`) REFERENCES `tbl_usuario` (`idusuario`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 9 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish2_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_nomina
-- ----------------------------
DROP TABLE IF EXISTS `tbl_nomina`;
CREATE TABLE `tbl_nomina`  (
  `idnomina` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NOT NULL,
  `idempleado` int(11) NOT NULL,
  `str_modo_sueldo` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `dec_sueldo` decimal(10, 2) NOT NULL,
  `str_estado` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`idnomina`) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  INDEX `index2`(`idempleado` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_nomina_tbl_empleado_1` FOREIGN KEY (`idempleado`) REFERENCES `tbl_empleado` (`idempleado`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 384 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish2_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_oficina
-- ----------------------------
DROP TABLE IF EXISTS `tbl_oficina`;
CREATE TABLE `tbl_oficina`  (
  `idoficina` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NOT NULL,
  `str_nombre` varchar(45) CHARACTER SET latin1 COLLATE latin1_spanish_ci NULL DEFAULT NULL,
  `idempleado_administrador` int(11) NULL DEFAULT NULL,
  PRIMARY KEY (`idoficina`) USING BTREE,
  INDEX `fk`(`idempleado_administrador` ASC) USING BTREE,
  CONSTRAINT `fk` FOREIGN KEY (`idempleado_administrador`) REFERENCES `tbl_empleado` (`idempleado`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 82 CHARACTER SET = latin1 COLLATE = latin1_spanish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_pedido
-- ----------------------------
DROP TABLE IF EXISTS `tbl_pedido`;
CREATE TABLE `tbl_pedido`  (
  `idpedido` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NOT NULL,
  `idcliente` int(11) NOT NULL,
  `idsucursal` int(11) NOT NULL,
  `str_tipo_pedido` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `int_numero` int(11) NULL DEFAULT NULL,
  `str_estado` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `created_empleado_id` int(11) NOT NULL,
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
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for tbl_persona
-- ----------------------------
DROP TABLE IF EXISTS `tbl_persona`;
CREATE TABLE `tbl_persona`  (
  `idpersona` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NOT NULL,
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
) ENGINE = InnoDB AUTO_INCREMENT = 67537 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for tbl_proveedor
-- ----------------------------
DROP TABLE IF EXISTS `tbl_proveedor`;
CREATE TABLE `tbl_proveedor`  (
  `idproveedor` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NOT NULL,
  `idpersona` int(11) NULL DEFAULT NULL,
  ` str_name_negoco` varchar(10) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_descripcion` varchar(150) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  `str_estado` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish2_ci NOT NULL,
  PRIMARY KEY (`idproveedor`) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  INDEX `index2`(`idpersona` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_proveedor_tbl_persona_1` FOREIGN KEY (`idpersona`) REFERENCES `tbl_persona` (`idpersona`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish2_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_sucursal
-- ----------------------------
DROP TABLE IF EXISTS `tbl_sucursal`;
CREATE TABLE `tbl_sucursal`  (
  `idsucursal` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NOT NULL,
  `str_tipo` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_codigo` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_telefono` varchar(10) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `idempleado` int(11) NOT NULL COMMENT 'representante',
  `str_cobro_adicional` enum('seguro','boleta','ninguno') CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL DEFAULT 'seguro',
  `str_estado` varchar(15) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `created_at` datetime NULL DEFAULT NULL,
  `updated_at` datetime NULL DEFAULT NULL,
  `idoficina` int(11) NULL DEFAULT NULL,
  PRIMARY KEY (`idsucursal`) USING BTREE,
  INDEX `fkuser`(`idempleado` ASC) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  INDEX `fkoficina`(`idoficina` ASC) USING BTREE,
  CONSTRAINT `fkoficina` FOREIGN KEY (`idoficina`) REFERENCES `tbl_oficina` (`idoficina`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fkuser` FOREIGN KEY (`idempleado`) REFERENCES `tbl_empleado` (`idempleado`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 175 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for tbl_tarjetas
-- ----------------------------
DROP TABLE IF EXISTS `tbl_tarjetas`;
CREATE TABLE `tbl_tarjetas`  (
  `idtarjeta` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `idglobal` int(11) NOT NULL,
  `idsucursal` int(11) NOT NULL,
  `idcliente` int(11) NOT NULL,
  `idventa` int(11) NULL DEFAULT NULL,
  `iddetalleruta` int(11) NOT NULL,
  `str_concepto` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `dec_valor` decimal(10, 2) NOT NULL,
  `str_modo` varchar(15) CHARACTER SET utf8mb3 COLLATE utf8mb3_spanish_ci NOT NULL,
  `int_tiempo` int(11) NOT NULL,
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
  `created_empleado_id` int(11) NOT NULL,
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
) ENGINE = InnoDB CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish_ci ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for tbl_tipo_contabilidad
-- ----------------------------
DROP TABLE IF EXISTS `tbl_tipo_contabilidad`;
CREATE TABLE `tbl_tipo_contabilidad`  (
  `idtipo_contabilidad` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NOT NULL,
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
  `idtipo_documento` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NOT NULL,
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
  `idunidad_medida` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NOT NULL,
  `str_nombre` varchar(30) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_prefijo` varchar(5) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_estado` char(1) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  PRIMARY KEY (`idunidad_medida`) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for tbl_usuario
-- ----------------------------
DROP TABLE IF EXISTS `tbl_usuario`;
CREATE TABLE `tbl_usuario`  (
  `idusuario` int(11) NOT NULL AUTO_INCREMENT COMMENT 'uniqid — Generar un ID único',
  `idglobal` int(11) NOT NULL,
  `idpersona` int(11) NOT NULL,
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
) ENGINE = InnoDB AUTO_INCREMENT = 406 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_spanish2_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for tbl_venta
-- ----------------------------
DROP TABLE IF EXISTS `tbl_venta`;
CREATE TABLE `tbl_venta`  (
  `idventa` int(11) NOT NULL AUTO_INCREMENT,
  `idglobal` int(11) NOT NULL,
  `idpedido` int(11) NOT NULL,
  `tipo_venta` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_tipo_comprobante` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_serie_comprobante` varchar(7) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `str_num_comprobante` varchar(10) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `dec_impuesto` decimal(10, 3) NOT NULL,
  `dec_total` decimal(10, 3) NOT NULL,
  `estado` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `created_empleado_id` int(11) NOT NULL,
  `created_at` datetime NULL DEFAULT NULL,
  `updated_at` datetime NULL DEFAULT NULL,
  PRIMARY KEY (`idventa`) USING BTREE,
  INDEX `fk_venta_pedido_idx`(`idpedido` ASC) USING BTREE,
  INDEX `fk_venta_usuario_idx`(`created_empleado_id` ASC) USING BTREE,
  INDEX `index`(`idglobal` ASC) USING BTREE,
  CONSTRAINT `fk_tbl_venta_tbl_pedido_1` FOREIGN KEY (`idpedido`) REFERENCES `tbl_pedido` (`idpedido`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_venta_usuario` FOREIGN KEY (`created_empleado_id`) REFERENCES `tbl_empleado` (`idempleado`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Compact;

-- ----------------------------
-- View structure for view_auth_sucursal
-- ----------------------------
DROP VIEW IF EXISTS `view_auth_sucursal`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `view_auth_sucursal` AS select `asu`.`idauth_sucursal` AS `refAuthSucursal`,`asu`.`idempleado` AS `refEmpleado`,`asu`.`tipo_usuario` AS `tipoUsuario`,`asu`.`str_estado` AS `estadoAuthSucursal`,`s`.`idsucursal` AS `refSucursal`,`s`.`str_codigo` AS `codigo`,`ats`.`id` AS `refid`,`ats`.`idauth_sucursal` AS `refAuthsSucursal`,`a`.`idauth` AS `refAuth`,`a`.`str_categoria` AS `categoria`,`a`.`str_nombre` AS `nameAccion`,`a`.`str_descripcion` AS `descripcion`,`a`.`dec_item` AS `item` from (((`tbl_auth_sucursal` `asu` join `tbl_sucursal` `s` on(`s`.`idsucursal` = `asu`.`idsucursal`)) left join `tbl_auths` `ats` on(`ats`.`idauth_sucursal` = `asu`.`idauth_sucursal`)) left join `tbl_auth` `a` on(`a`.`idauth` = `ats`.`idauth`));

-- ----------------------------
-- View structure for view_cobro_detallado
-- ----------------------------
DROP VIEW IF EXISTS `view_cobro_detallado`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `view_cobro_detallado` AS select `s`.`str_codigo` AS `codigo`,`s`.`str_tipo` AS `tipo`,`dr`.`iddetalleruta` AS `refDetalle_ruta`,`dr`.`idglobal` AS `refGlobal`,`dr`.`idsucursal` AS `refSucursal`,`dr`.`idempleado_resibe` AS `idcreated`,`dr`.`str_estado` AS `estado`,`dr`.`created_at` AS `fecha_at`,`dr`.`updated_at` AS `fecha_up`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`idtipo_contabilidad` <> 8) AS `efectivoCaja`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'recaudo') AS `recaudo`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'cantidad-abonos') AS `cantidadRecaudos`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'prestamos') AS `prestamo`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'articulos') AS `ventaArticulo`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'efectivo-otra-utilidad') AS `efectivoOtraUtilidad`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'diferencia') AS `diferencia`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'base') AS `base`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'efectivo') AS `efectivo`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'efectivoMonedas') AS `efectivoMonedas`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'descuento') AS `descuento`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'mas-utilidad') AS `masUtilidad`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'valorTotalCreditos') AS `valorTotalCreditos`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) * -1 from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` <> 'prestamos' and `tbl_contabilidad_detalle`.`str_nombre` <> 'articulos' and `tbl_contabilidad_detalle`.`str_operacion` like 'salida-totalizar%') AS `gastos`,(select group_concat(`tbl_contabilidad_detalle`.`str_nombre`,' ',`tbl_contabilidad_detalle`.`dec_total`,'  : ',`tbl_contabilidad_detalle`.`str_detalle` separator ' ||<br/> ') from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` <> 'prestamos' and `tbl_contabilidad_detalle`.`str_nombre` <> 'articulos' and `tbl_contabilidad_detalle`.`str_operacion` like 'salida-totalizar%') AS `descripcion_gastos`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) * -1 from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`idtipo_contabilidad` <> 6 and `tbl_contabilidad_detalle`.`str_operacion` like 'salida-contabilidad%') AS `otros_gastos`,(select group_concat(`tbl_contabilidad_detalle`.`str_nombre`,' ',`tbl_contabilidad_detalle`.`dec_total`,'  : ',`tbl_contabilidad_detalle`.`str_detalle` separator ' ||<br/> ') from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`idtipo_contabilidad` <> 6 and `tbl_contabilidad_detalle`.`str_operacion` like 'salida-contabilidad%') AS `descripcion_otros_gastos`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) * -1 from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`idtipo_contabilidad` = 6 and `tbl_contabilidad_detalle`.`str_operacion` like 'salida-contabilidad%') AS `salida`,(select group_concat(`tbl_contabilidad_detalle`.`str_nombre`,' ',`tbl_contabilidad_detalle`.`dec_total`,'  : ',`tbl_contabilidad_detalle`.`str_detalle` separator ' ||<br/> ') from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`idtipo_contabilidad` = 6 and `tbl_contabilidad_detalle`.`str_operacion` like 'salida-contabilidad%') AS `descripcion_salida`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`idtipo_contabilidad` = 9) AS `entrada`,(select group_concat(`tbl_contabilidad_detalle`.`str_nombre`,' ',`tbl_contabilidad_detalle`.`dec_total`,'  : ',`tbl_contabilidad_detalle`.`str_detalle` separator ' ||<br/> ') from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`idtipo_contabilidad` = 9) AS `descripcion_entrada` from (`tbl_detalle_ruta` `dr` join `tbl_sucursal` `s` on(`s`.`idsucursal` = `dr`.`idsucursal`));

-- ----------------------------
-- View structure for view_contabilidad
-- ----------------------------
DROP VIEW IF EXISTS `view_contabilidad`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `view_contabilidad` AS select `s`.`str_codigo` AS `codigo`,`s`.`str_logo` AS `logo`,`s`.`str_tipo` AS `tipo`,`dr`.`iddetalleruta` AS `refDetalle_ruta`,`dr`.`idglobal` AS `refGlobal`,`dr`.`idsucursal` AS `refSucursal`,`dr`.`idempleado_resibe` AS `idcreated`,`dr`.`str_estado` AS `estado`,`dr`.`created_at` AS `fecha_at`,`dr`.`updated_at` AS `fecha_up`,`cd`.`dec_total` AS `valor`,`cd`.`str_nombre` AS `de` from ((`tbl_detalle_ruta` `dr` join `tbl_sucursal` `s` on(`s`.`idsucursal` = `dr`.`idsucursal`)) join `tbl_contabilidad_detalle` `cd` on(`cd`.`iddetalleruta` = `dr`.`iddetalleruta`)) where `dr`.`str_estado` = 'saved' and `cd`.`str_operacion`  not like 'info-%';

-- ----------------------------
-- View structure for view_contabilidad_detalle_ruta
-- ----------------------------
DROP VIEW IF EXISTS `view_contabilidad_detalle_ruta`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `view_contabilidad_detalle_ruta` AS select `s`.`str_codigo` AS `codigo`,`s`.`str_tipo` AS `tipo`,`dr`.`iddetalleruta` AS `refDetalle_ruta`,`dr`.`idglobal` AS `refGlobal`,`dr`.`idsucursal` AS `refSucursal`,`dr`.`idempleado_resibe` AS `idcreated`,`dr`.`str_estado` AS `estado`,`dr`.`created_at` AS `fecha_at`,`dr`.`updated_at` AS `fecha_up`,(select ifnull(sum(`tbl_tarjetas`.`dec_prestamo`),0) from `tbl_tarjetas` where `tbl_tarjetas`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_tarjetas`.`str_concepto` = 'Prestamo') + (select ifnull(sum(`tbl_tarjetas`.`dec_prestamo`),0) from `tbl_tarjetas` where `tbl_tarjetas`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_tarjetas`.`str_concepto` = 'Articulo') AS `creditos`,(select ifnull(sum(`tbl_tarjetas`.`dec_valor`),0) from `tbl_tarjetas` where `tbl_tarjetas`.`iddetalleruta` = `dr`.`iddetalleruta`) AS `valorTotalCreditos`,(select ifnull(sum(`tbl_tarjetas`.`dec_prestamo`),0) from `tbl_tarjetas` where `tbl_tarjetas`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_tarjetas`.`str_concepto` = 'Prestamo') AS `prestamo`,(select ifnull(sum(`tbl_tarjetas`.`dec_prestamo`),0) from `tbl_tarjetas` where `tbl_tarjetas`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_tarjetas`.`str_concepto` = 'Articulo') AS `articulo`,(select ifnull(sum(`tbl_tarjetas`.`dec_c_adicional_valor`),0) from `tbl_tarjetas` where `tbl_tarjetas`.`iddetalleruta` = `dr`.`iddetalleruta`) AS `efectivoOtraUtilidad`,(select ifnull(sum(`tbl_descripcion`.`dec_abono`),0) * -1 from `tbl_descripcion` where `tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_descripcion`.`str_descripcion` like '%Abono%' or `tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_descripcion`.`str_descripcion` like '%Inicial%' or `tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_descripcion`.`str_descripcion` like '%Cancelado%') AS `recaudo`,(select ifnull(count(`tbl_descripcion`.`iddetalleruta`),0) from `tbl_descripcion` where `tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_descripcion`.`str_descripcion` like '%Abono%' or `tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_descripcion`.`str_descripcion` like '%Inicial%' or `tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_descripcion`.`str_descripcion` like '%Cancelado%') AS `cantidadTotalRecaudos`,(select ifnull(sum(`tbl_descripcion`.`dec_abono`),0) * -1 from `tbl_descripcion` where `tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_descripcion`.`str_descripcion` like 'Intereses%') AS `masUtilidad`,(select ifnull(sum(`tbl_descripcion`.`dec_abono`),0) * -1 from `tbl_descripcion` where `tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_descripcion`.`str_descripcion` like 'Descuento%') AS `descuento`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_operacion` like 'salida-totalizar%') AS `gastos`,(select group_concat(`tbl_contabilidad_detalle`.`str_nombre`,' ',`tbl_contabilidad_detalle`.`dec_total`,'  : ',`tbl_contabilidad_detalle`.`str_detalle` separator ' ||<br/> ') from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` <> 'prestamos' and `tbl_contabilidad_detalle`.`str_operacion` like 'salida-totalizar%') AS `descripcion_gastos`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) * -1 from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`idtipo_contabilidad` <> 6 and `tbl_contabilidad_detalle`.`str_operacion` like 'salida-contabilidad%') AS `otros_gastos`,(select group_concat(`tbl_contabilidad_detalle`.`str_nombre`,' ',`tbl_contabilidad_detalle`.`dec_total`,'  : ',`tbl_contabilidad_detalle`.`str_detalle` separator ' ||<br/> ') from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`idtipo_contabilidad` <> 6 and `tbl_contabilidad_detalle`.`str_operacion` like 'salida-contabilidad%') AS `descripcion_otros_gastos`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) * -1 from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`idtipo_contabilidad` = 6) AS `salida`,(select group_concat(`tbl_contabilidad_detalle`.`str_nombre`,' ',`tbl_contabilidad_detalle`.`dec_total`,'  : ',`tbl_contabilidad_detalle`.`str_detalle` separator ' ||<br/> ') from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`idtipo_contabilidad` = 6) AS `descripcion_salida`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`idtipo_contabilidad` = 9) AS `entrada`,(select group_concat(`tbl_contabilidad_detalle`.`str_nombre`,' ',`tbl_contabilidad_detalle`.`dec_total`,'  : ',`tbl_contabilidad_detalle`.`str_detalle` separator ' ||<br/> ') from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`idtipo_contabilidad` = 9) AS `descripcion_entrada`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'base') AS `base`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'efectivo') AS `efectivo`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'efectivoMonedas') AS `efectivoMonedas`,(select ifnull(sum(`tbl_contabilidad_detalle`.`dec_total`),0) from `tbl_contabilidad_detalle` where `tbl_contabilidad_detalle`.`iddetalleruta` = `dr`.`iddetalleruta` and `tbl_contabilidad_detalle`.`str_nombre` = 'diferencia') AS `diferencia` from (`tbl_detalle_ruta` `dr` join `tbl_sucursal` `s` on(`s`.`idsucursal` = `dr`.`idsucursal`));

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
-- View structure for view_empleado_despido
-- ----------------------------
DROP VIEW IF EXISTS `view_empleado_despido`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `view_empleado_despido` AS select `ed`.`idempleado_despido` AS `refDespido`,`ed`.`idglobal` AS `refGlobal`,`ed`.`idempleado` AS `refEmpleado`,`ed`.`fecha_despido` AS `fechaDespido`,`ed`.`tipo_despido` AS `tipoDespido`,`ed`.`motivo_despido` AS `motivoDespido`,`ed`.`autorizado_por` AS `autorizadoPor`,`ed`.`cargo_autoriza` AS `cargoAutoriza`,`ed`.`observaciones` AS `observaciones`,`ed`.`fecha_ultimo_trabajo` AS `fechaUltimoTrabajo`,`ed`.`monto_fraude` AS `liquidacionPendiente`,`ed`.`monto_fraude_pendiente` AS `montoLiquidacion`,`ed`.`entrega_documentos` AS `entregaDocumentos`,`ed`.`documentos_entregados` AS `documentosEntregados`,`ed`.`acta_firmada` AS `actaFirmada`,`ed`.`derecho_recontratacion` AS `derechoRecontratacion`,`ed`.`str_estado` AS `estadoRegistro`,`ed`.`created_at` AS `fechaRegistro`,`ed`.`updated_at` AS `fechaActualizacion`,concat(`p`.`str_nombres`,' ',`p`.`str_apellidos`) AS `empleadoDespedido`,`p`.`str_tipo_documento` AS `tipoDocumento`,`p`.`str_num_documento` AS `numeroDocumento`,`p`.`str_telefono` AS `telefono`,`p`.`str_email` AS `email`,`p`.`str_foto` AS `foto`,`e`.`str_apodo` AS `apodo`,`e`.`str_cargo` AS `cargo`,`e`.`date_fecha_inicio` AS `fechaIngreso`,concat(`p2`.`str_nombres`,' ',`p2`.`str_apellidos`) AS `registradoPor`,`e2`.`str_cargo` AS `cargoRegistra`,to_days(`ed`.`fecha_despido`) - to_days(`e`.`date_fecha_inicio`) AS `diasTrabajados`,`g`.`str_razon_social` AS `empresa` from (((((`tbl_empleado_despido` `ed` join `tbl_empleado` `e` on(`e`.`idempleado` = `ed`.`idempleado`)) join `tbl_persona` `p` on(`p`.`idpersona` = `e`.`idpersona`)) join `tbl_empleado` `e2` on(`e2`.`idempleado` = `ed`.`created_empleado_id`)) join `tbl_persona` `p2` on(`p2`.`idpersona` = `e2`.`idpersona`)) join `tbl_global` `g` on(`g`.`idglobal` = `ed`.`idglobal`)) order by `ed`.`created_at` desc;

-- ----------------------------
-- View structure for view_empresas_publica
-- ----------------------------
DROP VIEW IF EXISTS `view_empresas_publica`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `view_empresas_publica` AS select `g`.`idglobal` AS `refGlobal`,`g`.`str_razon_social` AS `razonSocial`,`g`.`str_estado` AS `estadoEmpresa`,`g`.`str_telefono` AS `telEmpresa`,`g`.`empresaid` AS `refEmpresa`,`g`.`int_maxsucursal` AS `max_sucursal`,`g`.`str_logo` AS `logo`,`g`.`created_at` AS `fecha_atEmpresa`,`p`.`idpersona` AS `refPersona`,concat(convert(`p`.`str_nombres` using utf8mb3),' ',`p`.`str_apellidos`) AS `superadmin`,`p`.`str_nombres` AS `nombres`,`p`.`str_apellidos` AS `apellidos`,`p`.`str_sexo` AS `sexo`,`p`.`str_fecha_nacimiento` AS `f_nacimiento`,`p`.`str_email` AS `email`,`p`.`str_ocupacion` AS `ocupacion`,`p`.`str_estado` AS `estadoPersona`,`p`.`str_direccion_departamento` AS `departamento`,`p`.`str_direccion_ciudad` AS `ciudad`,`p`.`str_direccion_barrio` AS `barrio`,`p`.`str_direccion_calle` AS `calle`,`p`.`str_foto` AS `foto`,`p`.`str_telefono` AS `telefono`,`p`.`str_tipo_documento` AS `t_documento`,`p`.`str_num_documento` AS `n_documento`,`u`.`idusuario` AS `refUsuario`,`u`.`str_user_name` AS `username`,`u`.`str_password` AS `id` from ((`tbl_global` `g` join `tbl_persona` `p` on(`p`.`idpersona` = `g`.`superadmin_personaid`)) join `tbl_usuario` `u` on(`u`.`idpersona` = `p`.`idpersona`)) where `g`.`str_tipo` = 'publica';

-- ----------------------------
-- View structure for view_libro_contabilidad
-- ----------------------------
DROP VIEW IF EXISTS `view_libro_contabilidad`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `view_libro_contabilidad` AS select `s`.`str_codigo` AS `codigo`,`s`.`str_logo` AS `logo`,`s`.`str_tipo` AS `tipo`,`dr`.`iddetalleruta` AS `refDetalle_ruta`,`dr`.`idglobal` AS `refGlobal`,`dr`.`idsucursal` AS `refSucursal`,`dr`.`idempleado_resibe` AS `idcreated`,`dr`.`str_estado` AS `estado`,`dr`.`created_at` AS `fecha_at`,`dr`.`updated_at` AS `fecha_up`,sum(if(`cd`.`iddetalleruta` = `dr`.`iddetalleruta` and `cd`.`str_nombre` = 'efectivo',`cd`.`dec_total`,0)) AS `efectivo`,sum(if(`cd`.`iddetalleruta` = `dr`.`iddetalleruta` and `cd`.`str_nombre` = 'efectivoMonedas',`cd`.`dec_total`,0)) AS `efectivoMonedas`,sum(if(`cd`.`iddetalleruta` = `dr`.`iddetalleruta` and `cd`.`str_nombre` = 'base',`cd`.`dec_total`,0)) AS `base`,(select ifnull(sum(`websdnco_db_webgoez`.`tbl_descripcion`.`dec_abono`),0) from `tbl_descripcion` where `websdnco_db_webgoez`.`tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `websdnco_db_webgoez`.`tbl_descripcion`.`str_descripcion` like '%Abono%' or `websdnco_db_webgoez`.`tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `websdnco_db_webgoez`.`tbl_descripcion`.`str_descripcion` like '%Inicial%' or `websdnco_db_webgoez`.`tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `websdnco_db_webgoez`.`tbl_descripcion`.`str_descripcion` like '%Cancelado%') AS `recaudo`,(select ifnull(count(`websdnco_db_webgoez`.`tbl_descripcion`.`iddetalleruta`),0) from `tbl_descripcion` where `websdnco_db_webgoez`.`tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `websdnco_db_webgoez`.`tbl_descripcion`.`str_descripcion` like '%Abono%' or `websdnco_db_webgoez`.`tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `websdnco_db_webgoez`.`tbl_descripcion`.`str_descripcion` like '%Inicial%' or `websdnco_db_webgoez`.`tbl_descripcion`.`iddetalleruta` = `dr`.`iddetalleruta` and `websdnco_db_webgoez`.`tbl_descripcion`.`str_descripcion` like '%Cancelado%') AS `cantidadRecaudos`,(select ifnull(sum(`websdnco_db_webgoez`.`tbl_tarjetas`.`dec_prestamo`),0) from `tbl_tarjetas` where `websdnco_db_webgoez`.`tbl_tarjetas`.`iddetalleruta` = `dr`.`iddetalleruta` and `websdnco_db_webgoez`.`tbl_tarjetas`.`str_concepto` = 'Prestamo') AS `creditoPrestamos`,(select ifnull(sum(`websdnco_db_webgoez`.`tbl_tarjetas`.`dec_prestamo`),0) from `tbl_tarjetas` where `websdnco_db_webgoez`.`tbl_tarjetas`.`iddetalleruta` = `dr`.`iddetalleruta` and `websdnco_db_webgoez`.`tbl_tarjetas`.`str_concepto` = 'Articulo') AS `creditosArticulos`,(select ifnull(sum(`websdnco_db_webgoez`.`tbl_tarjetas`.`dec_valor`),0) from `tbl_tarjetas` where `websdnco_db_webgoez`.`tbl_tarjetas`.`iddetalleruta` = `dr`.`iddetalleruta`) AS `creditosValorTotal`,(select ifnull(sum(`websdnco_db_webgoez`.`tbl_tarjetas`.`dec_c_adicional_valor`),0) from `tbl_tarjetas` where `websdnco_db_webgoez`.`tbl_tarjetas`.`iddetalleruta` = `dr`.`iddetalleruta`) AS `efectivoAdicional` from ((`tbl_detalle_ruta` `dr` join `tbl_sucursal` `s` on(`s`.`idsucursal` = `dr`.`idsucursal`)) join `tbl_contabilidad_detalle` `cd` on(`cd`.`iddetalleruta` = `dr`.`iddetalleruta`)) where `dr`.`str_estado` = 'saved' group by `dr`.`iddetalleruta`;

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
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `view_ruta` AS select `t`.`idtarjeta` AS `refTarjeta`,`t`.`idglobal` AS `refGlobal`,`t`.`idsucursal` AS `refSucursal`,`t`.`idcliente` AS `refCliente`,`t`.`idventa` AS `refVenta`,`t`.`str_concepto` AS `consepto`,`t`.`dec_valor` AS `valor`,`t`.`str_modo` AS `modo`,`t`.`int_tiempo` AS `plazo`,`t`.`dec_prestamo` AS `costo`,`t`.`dec_resta` AS `resta`,`t`.`str_descripcion` AS `descripcion`,`t`.`float_item` AS `item`,`t`.`dec_utilidad` AS `ut`,`t`.`str_c_adicional_numero` AS `ut_adi_num`,`t`.`dec_c_adicional_valor` AS `ut_adi_valor`,`t`.`str_tipo_comprobante` AS `comprobante`,`t`.`str_serie` AS `serie`,`t`.`str_numero` AS `numero`,`t`.`str_nota` AS `comentarios`,`t`.`str_abono` AS `ultimo_pago`,`t`.`str_style` AS `stylo`,`t`.`str_estado` AS `estado`,`t`.`created_empleado_id` AS `creado_por`,`t`.`date_acuerdo` AS `acuerdo`,`t`.`created_at` AS `fecha_at`,`t`.`updated_at` AS `fercha_up`,`c`.`str_apodo` AS `apodo`,`c`.`str_calificacion` AS `calificacion`,`p`.`idpersona` AS `refPersona`,concat(`p`.`str_nombres`,' ',`p`.`str_apellidos`) AS `cliente`,`p`.`str_tipo_documento` AS `t_documento`,`p`.`str_num_documento` AS `n_documento`,`p`.`str_telefono` AS `tel`,`p`.`str_ocupacion` AS `ocupacion`,`p`.`str_foto` AS `foto`,(select ifnull(sum(`tbl_descripcion`.`dec_abono`),0) from `tbl_descripcion` where `tbl_descripcion`.`idtarjeta` = `t`.`idtarjeta` and `tbl_descripcion`.`str_estado` <> 'saved' and `tbl_descripcion`.`str_descripcion` like '%Abono%' or `tbl_descripcion`.`idtarjeta` = `t`.`idtarjeta` and `tbl_descripcion`.`str_estado` <> 'saved' and `tbl_descripcion`.`str_descripcion` like '%Inicial%' or `tbl_descripcion`.`idtarjeta` = `t`.`idtarjeta` and `tbl_descripcion`.`str_estado` <> 'saved' and `tbl_descripcion`.`str_descripcion` like '%Cancelado%') AS `recaudo`,(select ifnull(sum(`tbl_descripcion`.`dec_abono`),0) from `tbl_descripcion` where `tbl_descripcion`.`idtarjeta` = `t`.`idtarjeta` and `tbl_descripcion`.`str_descripcion` like '%Inicial%') AS `inicial` from ((`tbl_tarjetas` `t` join `tbl_clientes` `c` on(`c`.`idcliente` = `t`.`idcliente`)) join `tbl_persona` `p` on(`p`.`idpersona` = `c`.`idpersona`)) order by `t`.`float_item`;

-- ----------------------------
-- View structure for view_usuario_session
-- ----------------------------
DROP VIEW IF EXISTS `view_usuario_session`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `view_usuario_session` AS select `u`.`idusuario` AS `idusuario`,`u`.`str_user_name` AS `str_user_name`,`u`.`str_terminos_condiciones` AS `str_terminos_condiciones`,`u`.`str_estado` AS `estado_usuario`,`p`.`idpersona` AS `idpersona`,`p`.`str_nombres` AS `str_nombres`,`p`.`str_apellidos` AS `str_apellidos`,`p`.`str_sexo` AS `str_sexo`,`p`.`str_fecha_nacimiento` AS `str_fecha_nacimiento`,`p`.`str_tipo_documento` AS `str_tipo_documento`,`p`.`str_num_documento` AS `str_num_documento`,`p`.`str_telefono` AS `str_telefono`,`p`.`str_email` AS `str_email`,`p`.`str_foto` AS `str_foto`,`p`.`str_estado` AS `estado_persona`,`p`.`str_nota` AS `str_nota`,`p`.`str_email_verificado` AS `str_email_verificado`,`g`.`idglobal` AS `idglobal`,`g`.`str_razon_social` AS `str_razon_social`,`g`.`str_tipo_documento` AS `tipo_documento_empresa`,`g`.`str_documento` AS `str_documento`,`g`.`str_email` AS `email_empresa`,`g`.`str_tipo` AS `str_tipo`,`g`.`str_nombre_impuesto` AS `str_nombre_impuesto`,`g`.`dec_porcentaje_impuesto` AS `dec_porcentaje_impuesto`,`g`.`str_logo` AS `str_logo`,`g`.`str_estado` AS `estado_emoresa`,`g`.`str_telefono` AS `telefono_empresa`,`g`.`int_maxsucursal` AS `int_maxsucursal`,`g`.`bool_writemiles` AS `bool_writemiles`,`g`.`bool_viewmiles` AS `bool_viewmiles`,`g`.`divisaid` AS `divisaid`,`g`.`empresaid` AS `empresaid`,`g`.`superadmin_personaid` AS `superadmin_personaid`,`g`.`bit_ahorradores` AS `bit_ahorradores`,`e`.`idempleado` AS `idempleado`,`e`.`str_apodo` AS `str_apodo`,`e`.`str_cargo` AS `str_cargo`,`e`.`str_estado` AS `estado_empleado`,`e`.`str_comentarios` AS `str_comentarios`,`e`.`date_fecha_inicio` AS `date_fecha_inicio`,`e`.`idoficina` AS `idoficina`,`c`.`idcliente` AS `idcliente`,`c`.`dec_max_credito` AS `dec_max_credito`,`c`.`str_apodo` AS `apodo_cliente`,`c`.`str_nota` AS `nota_cliente`,`c`.`str_estado` AS `estado_cliente`,`c`.`str_calificacion` AS `str_calificacion` from (((((`tbl_usuario` `u` join `tbl_persona` `p` on(`p`.`idpersona` = `u`.`idpersona`)) join `tbl_global` `g` on(`g`.`idglobal` = `u`.`idglobal`)) left join `tbl_empleado` `e` on(`e`.`idpersona` = `p`.`idpersona`)) left join `tbl_ahorros` `a` on(`a`.`idpersona` = `p`.`idpersona`)) left join `tbl_clientes` `c` on(`c`.`idpersona` = `p`.`idpersona`));

-- ----------------------------
-- Function structure for fn_estadisticas_despidos
-- ----------------------------
DROP FUNCTION IF EXISTS `fn_estadisticas_despidos`;
delimiter ;;
CREATE FUNCTION `fn_estadisticas_despidos`(p_idglobal INT,
  p_tipo_estadistica VARCHAR(20), 
  p_parametro VARCHAR(50))
 RETURNS int(11)
  READS SQL DATA 
  DETERMINISTIC
BEGIN
  DECLARE v_resultado INT DEFAULT 0;
  
  CASE p_tipo_estadistica
    WHEN 'total' THEN
      SELECT COUNT(*) INTO v_resultado
      FROM tbl_empleado_despido 
      WHERE idglobal = p_idglobal AND str_estado = 'activo';
      
    WHEN 'mes_actual' THEN
      SELECT COUNT(*) INTO v_resultado
      FROM tbl_empleado_despido 
      WHERE idglobal = p_idglobal 
        AND str_estado = 'activo'
        AND MONTH(fecha_despido) = MONTH(CURDATE())
        AND YEAR(fecha_despido) = YEAR(CURDATE());
        
    WHEN 'año_actual' THEN
      SELECT COUNT(*) INTO v_resultado
      FROM tbl_empleado_despido 
      WHERE idglobal = p_idglobal 
        AND str_estado = 'activo'
        AND YEAR(fecha_despido) = YEAR(CURDATE());
        
    WHEN 'tipo' THEN
      SELECT COUNT(*) INTO v_resultado
      FROM tbl_empleado_despido 
      WHERE idglobal = p_idglobal 
        AND str_estado = 'activo'
        AND tipo_despido = p_parametro;
        
    ELSE
      SET v_resultado = 0;
  END CASE;
  
  RETURN v_resultado;
END
;;
delimiter ;

-- ----------------------------
-- Procedure structure for sp_registrar_despido_empleado
-- ----------------------------
DROP PROCEDURE IF EXISTS `sp_registrar_despido_empleado`;
delimiter ;;
CREATE PROCEDURE `sp_registrar_despido_empleado`(IN p_idglobal INT,
  IN p_idempleado INT,
  IN p_fecha_despido DATE,
  IN p_tipo_despido VARCHAR(50),
  IN p_motivo_despido TEXT,
  IN p_autorizado_por VARCHAR(100),
  IN p_cargo_autoriza VARCHAR(100),
  IN p_observaciones TEXT,
  IN p_created_empleado_id INT,
  OUT p_resultado VARCHAR(50),
  OUT p_mensaje VARCHAR(255))
BEGIN
  DECLARE v_count INT DEFAULT 0;
  DECLARE v_estado_empleado VARCHAR(20);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION 
  BEGIN
    ROLLBACK;
    SET p_resultado = 'ERROR';
    SET p_mensaje = 'Error al registrar el despido del empleado';
  END;

  START TRANSACTION;
  
  
  SELECT COUNT(*), str_estado INTO v_count, v_estado_empleado
  FROM tbl_empleado 
  WHERE idempleado = p_idempleado AND idglobal = p_idglobal;
  
  IF v_count = 0 THEN
    SET p_resultado = 'ERROR';
    SET p_mensaje = 'El empleado no existe en la empresa especificada';
    ROLLBACK;
  ELSEIF v_estado_empleado = 'inactivo' THEN
    SET p_resultado = 'ERROR';
    SET p_mensaje = 'El empleado ya se encuentra inactivo';
    ROLLBACK;
  ELSE
    
    SELECT COUNT(*) INTO v_count
    FROM tbl_empleado_despido 
    WHERE idempleado = p_idempleado AND str_estado = 'activo';
    
    IF v_count > 0 THEN
      SET p_resultado = 'ERROR';
      SET p_mensaje = 'El empleado ya tiene un registro de despido activo';
      ROLLBACK;
    ELSE
      
      INSERT INTO tbl_empleado_despido (
        idglobal,
        idempleado,
        fecha_despido,
        tipo_despido,
        motivo_despido,
        autorizado_por,
        cargo_autoriza,
        observaciones,
        created_empleado_id
      ) VALUES (
        p_idglobal,
        p_idempleado,
        p_fecha_despido,
        p_tipo_despido,
        p_motivo_despido,
        p_autorizado_por,
        p_cargo_autoriza,
        p_observaciones,
        p_created_empleado_id
      );
      
      
      UPDATE tbl_empleado 
      SET str_estado = 'inactivo', 
          str_comentarios = CONCAT(str_comentarios, '\n[DESPIDO ', p_fecha_despido, '] ', p_motivo_despido),
          update_at = NOW()
      WHERE idempleado = p_idempleado;
      
      SET p_resultado = 'SUCCESS';
      SET p_mensaje = 'Despido registrado correctamente';
      COMMIT;
    END IF;
  END IF;
END
;;
delimiter ;

SET FOREIGN_KEY_CHECKS = 1;
