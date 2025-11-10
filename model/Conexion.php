<?php
date_default_timezone_set("America/Bogota");

$HOST = 'database';
$USER = 'root';
$PASS = $_ENV['MYSQL_ROOT_PASSWORD'];
$DB = 'websdnco_db_webgoez';

/*
$HOST = 'localhost';
$USER = 'websdnco_user_webgoez';
$PASS = 'CHANGE_ME_EXAMPLE';
$DB = 'websdnco_db_webgoez';*/



$conexion = new mysqli($HOST, $USER, $PASS, $DB);
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

mysqli_set_charset($conexion,"utf8");
if (mysqli_connect_errno()) {
      printf("Connect failed: %s\n", mysqli_connect_error());
      exit();
  }
//4377382