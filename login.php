<?php
session_start();
?>

<!DOCTYPE html>
<html lang="es">

<head>
   <meta charset="utf-8">
   <meta http-equiv="X-UA-Compatible" content="IE=edge">
   <meta name="viewport" content="width=device-width, initial-scale=1">
   <meta name="keywords" content="sdn credihogar, prestamos, productos, lavadoras, ventiladores, soat, televisores">
   <title>Sistemas</title>

   <!-- Favicon and touch icons -->
   <link rel="shortcut icon" href="ico/favicon.png">
   <link rel="apple-touch-icon-precomposed" sizes="144x144" href="ico/apple-touch-icon-144-precomposed.png">
   <link rel="apple-touch-icon-precomposed" sizes="114x114" href="ico/apple-touch-icon-114-precomposed.png">
   <link rel="apple-touch-icon-precomposed" sizes="72x72" href="ico/apple-touch-icon-72-precomposed.png">
   <link rel="apple-touch-icon-precomposed" href="ico/apple-touch-icon-57-precomposed.png">

   <!-- Google Font: Source Sans Pro -->
   <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Source+Sans+Pro:300,400,400i,700&display=fallback">
   <!-- Font Awesome -->
   <link rel="stylesheet" href="plugins/fontawesome-free/css/all.min.css">
   <!-- icheck bootstrap -->
   <link rel="stylesheet" href="plugins/icheck-bootstrap/icheck-bootstrap.min.css">
   <!-- Theme style -->
   <link rel="stylesheet" href="dist/css/adminlte.min.css">

   <!-- SweetAlert2 -->
   <link rel="stylesheet" href="plugins/sweetalert2-theme-bootstrap-4/bootstrap-4.min.css">

</head>

<body class="hold-transition login-page">
   <div class="login-box">
      <!-- /.login-logo -->
      <div class="card card-outline card-primary">
         <div class="card-header text-center">
            <a href="#" class="h1"><b></b></a>
         </div>
         <div class="card-body">

            <p class="login-box-msg">Accede a tu cuenta</p>

            <form role="form" id="frmIngresar" name="frmIngresar" method="post">
               <div class="input-group mb-3">
                  <input id="form-empresa" name="form-empresa" value="" type="text" class="form-control" placeholder="Id Empresa ">
                  <div class="input-group-append">
                     <div class="input-group-text">
                        <span class="fas fa-user"></span>
                     </div>
                  </div>
               </div>
               <div class="input-group mb-3">
                  <input id="form-username" name="form-username" value="" type="text" class="form-control" placeholder="Usuario">
                  <div class="input-group-append">
                     <div class="input-group-text">
                        <span class="fas fa-user"></span>
                     </div>
                  </div>
               </div>
               <div class="input-group mb-3">
                  <input type="password" value="" id="form-password" name="form-password" class="form-control" placeholder="Conraseña">
                  <div class="input-group-append">
                     <div class="input-group-text">
                        <span class="fas fa-lock"></span>
                     </div>
                  </div>
               </div>
               <div class="row">

                  <!-- /.col -->
                  <div class="col-12">
                     <button type="submit" class="btn btn-primary btn-block">Ingresar</button>
                  </div>
                  <!-- /.col -->
               </div>
            </form>
            <p class="mb-0">
               <a href="/" class="text-center">Regresar Inicio</a>
            </p>
         </div>
         <!-- /.card-body -->
      </div>
      <!-- /.card -->
   </div>
   <!-- /.login-box -->

   <!-- jQuery -->
   <script src="plugins/jquery/jquery.min.js"></script>
   <!-- Bootstrap 4 -->
   <script src="plugins/bootstrap/js/bootstrap.bundle.min.js"></script>
   <!-- AdminLTE App -->
   <script src="dist/js/adminlte.min.js"></script>

   <!-- SweetAlert2 -->
   <script src="plugins/sweetalert2/sweetalert2.min.js"></script>

   <script type="text/javascript">
      jQuery(document).ready(function() {
         var Toast = Swal.mixin({
            toast: true,
            position: 'center-start',
            showConfirmButton: false,
            timer: 2000
         });
         $("form#frmIngresar").submit(IngresarSistema);

         function IngresarSistema(e) {
            e.preventDefault();
            let empresa = $("#form-empresa").val();
            let user = $("#form-username").val();
            let pass = $("#form-password").val();
            // console.log(user,pass);
            $.getJSON("ajax/UsuarioAjax.php?op=IngresarSistema", {
               empresa,
               user,
               pass
            }, function(r) {
               if (r?.idusuario) {
                  $(location).attr("href", "acceder.php");
               } else if (r === 0) {
                  Toast.fire({
                     icon: 'error',
                     title: "Todos los campos son requeridos"
                  })
               } else {
                  Toast.fire({
                     icon: 'error',
                     title: "Error en los datos "
                  })
                  $("#form-password").val("");
                  $("#form-username").focus();
               }
            });
         }

      });
   </script>
</body>

</html>