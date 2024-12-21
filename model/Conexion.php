
<?php
date_default_timezone_set("America/Bogota");
$HOST = 'localhost';
//$USER = 'root';
//$PASS = '';
//$DB = 'websdnco_db_webgoez_dev';
$USER = 'websdnco_user_webgoez';
$PASS = 'CHANGE_ME_EXAMPLE';
$DB = 'websdnco_db_webgoez';



$conexion = new mysqli($HOST, $USER, $PASS, $DB);
mysqli_set_charset($conexion,"utf8");
if (mysqli_connect_errno()) {
      printf("Connect failed: %s\n", mysqli_connect_error());
      exit();
  }