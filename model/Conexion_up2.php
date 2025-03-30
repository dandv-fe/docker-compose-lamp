<?php
date_default_timezone_set("America/Bogota");
/*$HOST = 'database';
$USER = 'root';
$PASS = $_ENV['MYSQL_ROOT_PASSWORD'];
$DB = 'yilber';*/


$HOST = 'localhost';
$USER = 'websdnco_us_yilber';
$PASS = 'CHANGE_ME_EXAMPLE';
$DB = 'websdnco_yilber';

$conexion_up = new mysqli($HOST, $USER, $PASS, $DB);
if (mysqli_connect_errno()) {
      printf("Connect failed: %s\n", mysqli_connect_error());
      exit();
  }