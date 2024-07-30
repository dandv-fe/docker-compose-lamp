<?php
date_default_timezone_set("America/Bogota");
$HOST = 'localhost';
$USER = 'root';
$PASS = '';
$DB = 'websdnco_db';

$conexion_up = new mysqli($HOST, $USER, $PASS, $DB);
if (mysqli_connect_errno()) {
      printf("Connect failed: %s\n", mysqli_connect_error());
      exit();
  }
