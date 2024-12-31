<?php

session_start();
require_once("model/Up.php");
require_once("method.php");
$classUp = new ClassUp();

$idglobal = $_SESSION['idglobal'];
$created_empleado_id = $_SESSION['userEmpleado'];
$idsucursal = $_SESSION['MYSESSION_idsucursal'];
if (!$idglobal || !$idsucursal || !$created_empleado_id) {
    echo "No se puede continuar deve activar la ruta";
} else {
    $rutaArchivoTar = "subir/Tar.csv";
    $rutaArchivoAbn = "subir/Abn.csv";
    $jsonTar = array();
    $jsonAbn = array();
    global $conexion;
    $sql = "SELECT str_codigo FROM tbl_sucursal WHERE idsucursal=$idsucursal";
    $query = $conexion->query($sql);
    $res = $query->fetch_object();


    $needle = $res->str_codigo;




    if (($archivoTar = fopen($rutaArchivoTar, "r")) !== FALSE && ($archivoAbn = fopen($rutaArchivoAbn, "r")) !== FALSE) {


        while (($fila = fgetcsv($archivoAbn, 1000, "\t")) !== FALSE) {
            $pos = strripos($fila[3], $needle);
            if ($pos == !false) {
                $jsonAbn[] = $fila;
            }
        }
        fclose($archivoAbn);

        $num = 0;

        while (($fila = fgetcsv($archivoTar, 1000, "\t")) !== FALSE) {
            $abonos = array();

            $pos = strripos($fila[0], $needle);
            if ($pos == !false) {

                foreach ($jsonAbn as $key => $value) {
                    if ($value[0] == $fila[5]) {
                        $abonos[] = $value;
                    }
                }
                $num++;
                if (
                    $classUp->registrarTar(
                        $idglobal,
                        $idsucursal,
                        $created_empleado_id,
                        $fila,
                        $abonos,
                        $num
                    )
                ) {
                    # code...
                    echo "Registrado <br>";
                } else {
                    echo "Error: no registrado <br>";
                }
            }

        }
        fclose($archivoTar);

    } else {
        echo "No se Pudo abrir los arclivos";
    }
}