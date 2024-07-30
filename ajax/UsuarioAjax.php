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
		$par=limpiar_cadena($_POST['parametro']);
		$otrop=limpiar_cadena($_POST['otro_parametro']);

		$_SESSION['MYSESSION_idsucursal']=$par;		
		$_SESSION['MYSESSION_usuario']=$otrop;
		echo 'Ok';
		break; 

	case "IngresarSistema":
		$empresa = limpiar_cadena($_REQUEST["empresa"]);
		$user = limpiar_cadena($_REQUEST["user"]);
		$pass = limpiar_cadena2($_REQUEST["pass"]);
		
		if (!$empresa || !$user || !$pass) {
			echo json_encode(0);
			return;
		}

		$query = $objusuario->Auth($user, md5($pass), $empresa);
		$fetch = $query->fetch_object();



		if (isset($fetch)) {
			
			$_SESSION['MYSESSION_idsucursal']=0;

			// datos del usuario
			$_SESSION['idusuario'] = $fetch->numeroUsuario;
			$_SESSION['idglobal'] = $fetch->numeroGlobal;
			$_SESSION['idpersona'] = $fetch->numeroPersona;
			$_SESSION['userName'] = $fetch->usuario;
			$_SESSION['terminosCondiciones'] = $fetch->terminosCondiciones;
			$_SESSION['userEstado'] = $fetch->userEstado;

			// datos de la persona
			$_SESSION['personName'] = $fetch->nombre;
			$_SESSION['personPhoto'] = $fetch->foto;
			$_SESSION['personTypeDocument'] = $fetch->typeDocument;
			$_SESSION['personDocument'] = $fetch->document;
			$_SESSION['personSexo'] = $fetch->sexo;
			$_SESSION['personPhone'] = $fetch->phone;
			$_SESSION['personEmail'] = $fetch->email;
			$_SESSION['personEmailVerificado'] = $fetch->emailVerificado;

			//los ids suscripciones
			$_SESSION['userEmpleado'] = $fetch->userEmpleado;
			$_SESSION['userCliente'] = $fetch->userCliente;
			$_SESSION['userNatillera'] = $fetch->userNatillera;


			// is propierario
			$_SESSION['userEmpresa'] = $fetch->userEmpresa === $fetch->numeroPersona ? $fetch->numeroGlobal : null;

			//datos de la empresa
			$_SESSION['typeEmpresa'] = $fetch->typeEmpresa;
			$_SESSION['nameEmpresa'] = $fetch->empresa;
			$_SESSION['logoEmpresa'] = $fetch->logo;
			

			$fetch->session = 0;
		}

		//array_push($_SESSION[''],$unicosesion);
		//print_r($fetch);
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
    //$idempleado = $_SESSION['userEmpleado'];

		//if (empty($_SESSION['userEmpresa'])) {
		//	echo json_encode(array('session'=> $idsucursal));
		//} else {
			$_SESSION['MYSESSION_idsucursal']=$idsucursal;
			echo json_encode(array('session'=> $idsucursal));
		//}
		break;
	case 'BajarSistemaActividad':
		$refSession = limpiar_cadena($_REQUEST['refSession']);
		unset($_SESSION[$refSession]);
		$_SESSION['MYSESSION_idsucursal']='';
		echo json_encode(1);
		break;
}
