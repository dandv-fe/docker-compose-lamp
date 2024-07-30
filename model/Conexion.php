<?php
date_default_timezone_set("America/Bogota");
$HOST = 'localhost';
$USER = 'root';
$PASS = '';//$_ENV['MYSQL_ROOT_PASSWORD'];


$DB = 'websdnco_db_webgoez_dev';


$conexion = new mysqli($HOST, $USER, $PASS, $DB);
//$conexion = mysqli_connect("database", "root", $_ENV['MYSQL_ROOT_PASSWORD'], null);



if (mysqli_connect_errno()) {
      printf("Connect failed: %s\n", mysqli_connect_error());
      exit();
  }