<?php
date_default_timezone_set("America/Bogota");
$HOST = 'localhost';
$USER = 'websdnco_base';
$PASS = 'CHANGE_ME_EXAMPLE';
$DB = 'websdnco_db';

$conexion_up = new mysqli($HOST, $USER, $PASS, $DB);
if (mysqli_connect_errno()) {
      printf("Connect failed: %s\n", mysqli_connect_error());
      exit();
  }