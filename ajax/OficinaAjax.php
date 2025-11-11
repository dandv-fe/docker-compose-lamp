<?php

session_start();
require_once "../method.php";

require_once "../model/Oficina.php";

$objOficina = new Oficina();
$useridglobal = $_SESSION['idglobal'];
switch ($_GET["op"]) {


}
