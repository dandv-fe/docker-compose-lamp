<?php
	session_start();


  if(isset($_SESSION["idusuario"])){
     

      include "views/header.html";



      include "views/cobro_mpleado.html";



      include "views/footer.html";
	} else {
    include "views/lockscreen.html";
	}
		
