<?php

session_start();
require_once "../method.php";
require_once "../model/Oficina.php";
require_once "../model/Sucursal.php";
require_once "../model/Empleado.php";

$objOficina = new Oficina();
$objSucursal = new Sucursal();
$objEmpleado = new Empleado();
$useridglobal = $_SESSION['idglobal'] ?? $_SESSION['userEmpresa'];

// Función para verificar si la tabla tbl_oficina existe
function tablaOficinaExiste() {
    global $conexion;
    $sql = "SHOW TABLES LIKE 'tbl_oficina'";
    $result = $conexion->query($sql);
    return $result && $result->num_rows > 0;
}

switch (isset($_GET["op"]) ? $_GET["op"] : '') {
    case 'listarOficinas':
        $data = array();
        
        try {
            global $conexion;
            
            if (tablaOficinaExiste()) {
                // Si la tabla tbl_oficina existe, usar el método del modelo
                $query = $objOficina->Listar($useridglobal);
                while ($row = $query->fetch_object()) {
                    $data[] = array(
                        'id' => $row->refOficina,
                        'nombre' => $row->str_nombre
                    );
                }
            } else {
                // Si no existe la tabla, crear oficinas temporales basadas en las sucursales
                $sql = "SELECT DISTINCT 
                            CASE 
                                WHEN str_tipo = 'Principal' THEN 1
                                WHEN str_tipo = 'Sucursal' THEN 2
                                ELSE 3
                            END as oficina_id,
                            CASE 
                                WHEN str_tipo = 'Principal' THEN 'Oficina Principal'
                                WHEN str_tipo = 'Sucursal' THEN 'Oficina Sucursales'
                                ELSE 'Oficina General'
                            END as oficina_nombre
                        FROM tbl_sucursal 
                        WHERE idglobal = $useridglobal
                        ORDER BY oficina_id";
                
                $query = $conexion->query($sql);
                
                if ($query && $query->num_rows > 0) {
                    while ($row = $query->fetch_object()) {
                        $data[] = array(
                            'id' => $row->oficina_id,
                            'nombre' => $row->oficina_nombre
                        );
                    }
                } else {
                    // Si no hay sucursales, crear oficinas por defecto
                    $data = array(
                        array('id' => 1, 'nombre' => 'Oficina Principal'),
                        array('id' => 2, 'nombre' => 'Oficina Secundaria')
                    );
                }
            }
            
            echo json_encode(array('ok' => true, 'data' => $data));
        } catch (Exception $e) {
            echo json_encode(array('ok' => false, 'msg' => 'Error al cargar oficinas: ' . $e->getMessage()));
        }
        break;

    case 'listarSucursales':
        $idoficina = intval($_GET['idoficina']);
        $data = array();
        
        try {
            global $conexion;
            
            if (tablaOficinaExiste()) {
                // Si existe la tabla oficina, mostrar disponibles y asignadas a esta oficina
                // Considerar tanto NULL como 0 como "no asignado" para compatibilidad con esquemas
                $sql = "SELECT 
                            s.idsucursal AS id,
                            s.str_codigo AS nombre,
                            CASE 
                                WHEN s.idoficina = $idoficina THEN 1
                                WHEN (s.idoficina IS NULL OR s.idoficina = 0) THEN 0
                                ELSE -1
                            END AS estado_asignacion,
                            CASE 
                                WHEN s.idoficina = $idoficina THEN 'Asignada a esta oficina'
                                WHEN (s.idoficina IS NULL OR s.idoficina = 0) THEN 'Disponible'
                                ELSE CONCAT('Asignada a oficina ID: ', s.idoficina)
                            END AS estado_texto
                        FROM tbl_sucursal s 
                        WHERE s.idglobal = $useridglobal
                        ORDER BY (s.idoficina IS NULL OR s.idoficina = 0) DESC, s.idoficina = $idoficina DESC, s.str_codigo";
            } else {
                // Si no existe la tabla oficina, todas están disponibles
                $sql = "SELECT 
                            s.idsucursal AS id,
                            s.str_codigo AS nombre,
                            0 AS estado_asignacion,
                            'Disponible (Modo compatibilidad)' AS estado_texto
                        FROM tbl_sucursal s 
                        WHERE s.idglobal = $useridglobal
                        ORDER BY s.str_codigo";
            }
            
            $query = $conexion->query($sql);
            while ($row = $query->fetch_object()) {
                // Solo incluir sucursales disponibles o asignadas a esta oficina
                if ($row->estado_asignacion >= 0) {
                    $data[] = array(
                        'id' => $row->id,
                        'nombre' => $row->nombre . ' (' . $row->estado_texto . ')',
                        'asignada' => ($row->estado_asignacion == 1)
                    );
                }
            }
            
            echo json_encode(array('ok' => true, 'data' => $data));
        } catch (Exception $e) {
            echo json_encode(array('ok' => false, 'msg' => 'Error al cargar sucursales: ' . $e->getMessage()));
        }
        break;

    case 'listarEmpleados':
        $idoficina = intval($_GET['idoficina']);
        $data = array();
        
        try {
            global $conexion;
            
            if (tablaOficinaExiste()) {
                // Si existe la tabla oficina, mostrar disponibles y asignados a esta oficina
                // Considerar tanto NULL como 0 como "no asignado" para compatibilidad con esquemas
                $sql = "SELECT 
                            e.idempleado AS id,
                            CONCAT(p.str_nombres, ' ', p.str_apellidos, ' - ', e.str_cargo) AS nombre_base,
                            CASE 
                                WHEN e.str_cargo = 'Super Administrador' THEN 1
                                WHEN e.idoficina = $idoficina THEN 1
                                WHEN (e.idoficina IS NULL OR e.idoficina = 0) THEN 0
                                ELSE -1
                            END AS estado_asignacion,
                            CASE 
                                WHEN e.str_cargo = 'Super Administrador' THEN 'Super Administrador (Acceso global)'
                                WHEN e.idoficina = $idoficina THEN 'Asignado a esta oficina'
                                WHEN (e.idoficina IS NULL OR e.idoficina = 0) THEN 'Disponible'
                                ELSE CONCAT('Asignado a oficina ID: ', e.idoficina)
                            END AS estado_texto
                        FROM tbl_empleado e 
                        INNER JOIN tbl_persona p ON p.idpersona = e.idpersona
                        WHERE e.idglobal = $useridglobal AND e.str_estado <> 'inactivo'
                        ORDER BY (e.str_cargo = 'Super Administrador') DESC, (e.idoficina IS NULL OR e.idoficina = 0) DESC, e.idoficina = $idoficina DESC, p.str_nombres, p.str_apellidos";
            } else {
                // Si no existe la tabla oficina, todos están disponibles
                $sql = "SELECT 
                            e.idempleado AS id,
                            CONCAT(p.str_nombres, ' ', p.str_apellidos, ' - ', e.str_cargo) AS nombre_base,
                            0 AS estado_asignacion,
                            'Disponible (Modo compatibilidad)' AS estado_texto
                        FROM tbl_empleado e 
                        INNER JOIN tbl_persona p ON p.idpersona = e.idpersona
                        WHERE e.idglobal = $useridglobal AND e.str_estado <> 'inactivo'
                        ORDER BY p.str_nombres, p.str_apellidos";
            }
            
            $query = $conexion->query($sql);
            while ($row = $query->fetch_object()) {
                // Solo incluir empleados disponibles o asignados a esta oficina
                if ($row->estado_asignacion >= 0) {
                    $data[] = array(
                        'id' => $row->id,
                        'nombre' => $row->nombre_base . ' (' . $row->estado_texto . ')',
                        'asignado' => ($row->estado_asignacion == 1)
                    );
                }
            }
            
            echo json_encode(array('ok' => true, 'data' => $data));
        } catch (Exception $e) {
            echo json_encode(array('ok' => false, 'msg' => 'Error al cargar empleados: ' . $e->getMessage()));
        }
        break;

    case 'listarDespedidos':
        $idoficina = intval($_GET['idoficina']);
        $data = array();
        try {
            global $conexion;
            // Seleccionamos despidos asociados a empleados que pertenecen a la oficina
            $sql = "SELECT ed.idempleado_despido AS id, ed.fecha_despido AS fechaDespido, ed.tipo_despido AS tipoDespido, ed.motivo_despido AS motivo, CONCAT(p.str_nombres,' ',p.str_apellidos) AS empleado, e.str_cargo AS cargo, p.str_telefono AS telefono
                    FROM tbl_empleado_despido ed
                    INNER JOIN tbl_empleado e ON e.idempleado = ed.idempleado
                    INNER JOIN tbl_persona p ON p.idpersona = e.idpersona
                    WHERE ed.idglobal = $useridglobal AND e.idoficina = $idoficina
                    ORDER BY ed.created_at DESC";
            $query = $conexion->query($sql);
            while ($row = $query->fetch_object()) {
                $data[] = array(
                    'id' => $row->id,
                    'fechaDespido' => $row->fechaDespido,
                    'tipoDespido' => $row->tipoDespido,
                    'motivo' => $row->motivo,
                    'empleado' => $row->empleado,
                    'cargo' => $row->cargo,
                    'telefono' => $row->telefono
                );
            }
            echo json_encode(array('ok' => true, 'data' => $data));
        } catch (Exception $e) {
            echo json_encode(array('ok' => false, 'msg' => 'Error al cargar despedidos: ' . $e->getMessage()));
        }
        break;

    case 'guardarSucursales':
        $idoficina = intval($_POST['idoficina']);
        $sucursales = isset($_POST['sucursales']) ? $_POST['sucursales'] : array();
        
        try {
            global $conexion;
            
            if (tablaOficinaExiste()) {
                // Si existe la tabla oficina, realizar asignaciones reales
                $conexion->autocommit(false);
                
                // Primero, desasignar todas las sucursales de esta oficina
                // Usar 0 como valor "no asignado" para esquemas donde "idoficina" no permite NULL
                $sql = "UPDATE tbl_sucursal SET idoficina = 0 WHERE idoficina = ? AND idglobal = ?";
                $stmt = $conexion->prepare($sql);
                $stmt->bind_param("ii", $idoficina, $useridglobal);
                $stmt->execute();
                
                // Luego, asignar las sucursales seleccionadas
                if (!empty($sucursales)) {
                    $sql = "UPDATE tbl_sucursal SET idoficina = ? WHERE idsucursal = ? AND idglobal = ?";
                    $stmt = $conexion->prepare($sql);
                    
                    foreach ($sucursales as $idsucursal) {
                        $stmt->bind_param("iii", $idoficina, $idsucursal, $useridglobal);
                        $stmt->execute();
                    }
                }
                
                $conexion->commit();
                echo json_encode(array(
                    'ok' => true, 
                    'msg' => 'Sucursales asignadas correctamente', 
                    'count' => count($sucursales)
                ));
            } else {
                // Si no existe la tabla, simular el guardado
                echo json_encode(array(
                    'ok' => true, 
                    'msg' => 'Sucursales asignadas correctamente (Simulación - Ejecutar script SQL para funcionalidad completa)', 
                    'count' => count($sucursales)
                ));
            }
            
        } catch (Exception $e) {
            if (isset($conexion)) $conexion->rollback();
            echo json_encode(array('ok' => false, 'msg' => 'Error al guardar sucursales: ' . $e->getMessage()));
        }
        break;

    case 'guardarEmpleados':
        $idoficina = intval($_POST['idoficina']);
        $empleados = isset($_POST['empleados']) ? $_POST['empleados'] : array();
        
        try {
            global $conexion;
            
            if (tablaOficinaExiste()) {
                // Si existe la tabla oficina, realizar asignaciones reales
                $conexion->autocommit(false);
                
                // Primero, desasignar todos los empleados de esta oficina
                // Usar 0 como valor "no asignado" para esquemas donde "idoficina" no permite NULL
                $sql = "UPDATE tbl_empleado SET idoficina = 0 WHERE idoficina = ? AND idglobal = ?";
                $stmt = $conexion->prepare($sql);
                $stmt->bind_param("ii", $idoficina, $useridglobal);
                $stmt->execute();
                
                // Luego, asignar los empleados seleccionados
                if (!empty($empleados)) {
                    $sql = "UPDATE tbl_empleado SET idoficina = ? WHERE idempleado = ? AND idglobal = ?";
                    $stmt = $conexion->prepare($sql);
                    
                    foreach ($empleados as $idempleado) {
                        $stmt->bind_param("iii", $idoficina, $idempleado, $useridglobal);
                        $stmt->execute();
                    }
                }
                
                $conexion->commit();
                echo json_encode(array(
                    'ok' => true, 
                    'msg' => 'Empleados asignados correctamente', 
                    'count' => count($empleados)
                ));
            } else {
                // Si no existe la tabla, simular el guardado
                echo json_encode(array(
                    'ok' => true, 
                    'msg' => 'Empleados asignados correctamente (Simulación - Ejecutar script SQL para funcionalidad completa)', 
                    'count' => count($empleados)
                ));
            }
            
        } catch (Exception $e) {
            if (isset($conexion)) $conexion->rollback();
            echo json_encode(array('ok' => false, 'msg' => 'Error al guardar empleados: ' . $e->getMessage()));
        }
        break;

    case 'finalizarConfiguracion':
        $idoficina = intval($_POST['idoficina']);
        
        try {
            // Simulamos un resumen de configuración
            $resumen = (object) array(
                'oficina_nombre' => 'Oficina Seleccionada',
                'total_sucursales' => 0,
                'total_empleados' => 0
            );
            
            echo json_encode(array(
                'ok' => true, 
                'msg' => 'Plan de trabajo configurado exitosamente (Demo)',
                'resumen' => $resumen
            ));
            
        } catch (Exception $e) {
            echo json_encode(array('ok' => false, 'msg' => 'Error al finalizar configuración: ' . $e->getMessage()));
        }
        break;

    default:
        echo json_encode(array('ok' => false, 'msg' => 'Operación no válida'));
        break;
}
?>