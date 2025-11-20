<?php
// header("Access-Control-Allow-Origin: *"); 
session_start();

require_once "../method.php";

if (empty($_GET["op"])) {
   if (empty($_SESSION["idusuario"])) {
      echo 0;
   } else {
      echo 1;
   }
   exit;
}
require_once "../model/Usuario.php";

$objusuario = new usuario();

switch ($_GET["op"]) {
   case 'seccionValidarHoja':
      $par = limpiar_cadena($_POST['parametro']);
      $otrop = limpiar_cadena($_POST['otro_parametro']);

      $_SESSION['idsucursal'] = $par;
      $_SESSION['MYSESSION_usuario'] = $otrop;
      echo 'Ok';
      break;

   case "IngresarSistema":
      $encoder = new CustomEncoder();
      $empresa = limpiar_cadena($_REQUEST["empresa"]);
      $user = limpiar_cadena($_REQUEST["user"]);
      $pass = limpiar_cadena2($_REQUEST["pass"]);
      if (!$empresa || !$user || !$pass) {
         echo json_encode(0);
         return;
      }
      $idglobal = intval($empresa);
      $query = $objusuario->SignIn($user, md5($pass), $idglobal);
      $fetch = $query->fetch_object();
      if (isset($fetch)) {
         $_SESSION['idsucursal'] = 0; // Cortera activa
         $_SESSION['idoficina'] = 0; // oficina activa
         $_SESSION['idusuario'] = $fetch->idusuario;
         $_SESSION['idglobal'] = $idglobal;
         $fetch->idusuario = $encoder->encode($fetch->idusuario);
         echo json_encode($fetch);
         return;
      }
      /* // Uso
      $txt = 'Duvan';

      // Codificar
      $key = $encoder->encode($txt);
      echo "Codificado: " . $key . "\n"; // WsuIoPqAjK

      // Descodicar
      $decoded = $encoder->decode($key);
      echo "Descodificado: " . $decoded . "\n"; // Versy
      */
      echo json_encode($fetch);
      break;

   case "Salir":

      session_unset();
      session_destroy();

      echo "<script>
			sessionStorage.removeItem('empleado')
			sessionStorage.removeItem('empresa')
			sessionStorage.removeItem('userNameEmpleado')
			sessionStorage.removeItem('fotoEmpleado')
			sessionStorage.removeItem('index')
			window.name='';
			location.href ='../login.php';
		  </script>";
      break;

   case 'IngresarSistemaActividad':
      $idsucursal = limpiar_cadena($_REQUEST['empresa']);
      //$refSession = limpiar_cadena($_REQUEST['refSession']);
      //$idempleado = $_SESSION['idempleado'];

      //if (empty($_SESSION['userEmpresa'])) {
      //	echo json_encode(array('session'=> $idsucursal));
      //} else {
      $_SESSION['idsucursal'] = $idsucursal;
      echo json_encode(array('session' => $idsucursal));
      //}
      break;
   case 'BajarSistemaActividad':
      $refSession = limpiar_cadena($_REQUEST['refSession']);
      unset($_SESSION[$refSession]);
      $_SESSION['idsucursal'] = '';
      echo json_encode(1);
      break;
}
