<?php
session_start();
require_once "info_sistema.php";
$infoSistemaCuentas=infoSistemaCuentas();
?>
<!DOCTYPE html>

<html lang="es">



<head>

    <meta charset="utf-8">

    <meta name="viewport" content="width=device-width, initial-scale=1">

    <title>WebGoez</title>



    <!-- Google Font: Source Sans Pro -->

    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Source+Sans+Pro:300,400,400i,700&display=fallback">

    <!-- Font Awesome Icons -->

    <link rel="stylesheet" href="plugins/fontawesome-free/css/all.min.css">

    <!-- Theme style -->

    <link rel="stylesheet" href="dist/css/adminlte.min.css">

</head>



<body class="hold-transition layout-top-nav">

    <div class="wrapper">



        <!-- Navbar -->

        <nav class="main-header navbar navbar-expand-md navbar-light navbar-white">

            <div class="container">

                <a href="index.php" class="navbar-brand">

                    <img src="dist/img/AdminLTELogo.png" alt="AdminLTE Logo" class="brand-image img-circle elevation-3" style="opacity: .8">

                    <span class="brand-text font-weight-light">WebGoez</span>

                </a>



                <button class="navbar-toggler order-1" type="button" data-toggle="collapse" data-target="#navbarCollapse" aria-controls="navbarCollapse" aria-expanded="false" aria-label="Toggle navigation">

                    <span class="navbar-toggler-icon"></span>

                </button>



                <div class="collapse navbar-collapse order-3 show" id="navbarCollapse">

                    <!-- Left navbar links -->

                    <ul class="navbar-nav">

                        <!--<li class="nav-item">

                            <a href="registrarse.php" class="nav-link">Registrarse</a>

                        </li>-->

                        <li class="nav-item">

                            <a href="login.php" class="nav-link font-weight-bold">Iniciar Seccion</a>

                        </li>



                    </ul>





                </div>

            </div>

        </nav>

        <!-- /.navbar -->



        <!-- Content Wrapper. Contains page content -->

        <div class="content-wrapper">

            <!-- Content Header (Page header) -->

            <div class="content-header">

                <div class="container">

                    <div class="row mb-2">

                        <div class="col-sm-6">

                            <h1 class="m-0"> ¡Bienvenido <small>(a)</small>!</h1>

                        </div><!-- /.col -->



                    </div><!-- /.row -->

                </div><!-- /.container-fluid -->

            </div>

            <!-- /.content-header -->



            <!-- Main content -->

            <div class="content">

                <div class="container">

                    <div class="row">

                        <div class="col-lg-12">

                            <div class="card">

                                <div class="card-header">

                                    <h3 class="card-title">Cordial Saludo</h3>

                                </div>

                                <!-- /.card-header -->

                                <div class="card-body">

                                    <div id="carouselExampleIndicators" style="height: 330px;" class="carousel slide" data-ride="carousel">

                                        <ol class="carousel-indicators">

                                            <li data-target="#carouselExampleIndicators" data-slide-to="0" class="active"></li>

                                            <li data-target="#carouselExampleIndicators" data-slide-to="1"></li>

                                            <!--<li data-target="#carouselExampleIndicators" data-slide-to="2"></li>-->

                                        </ol>

                                        <div class="carousel-inner">

                                            <div class="carousel-item active">

                                                <img height="280" class="d-block w-100" src="dist/img/webcontable2v3.jpg" alt="First slide">



                                            </div>

                                            <div class="carousel-item">

                                                <img height="280" class="d-block w-100" src="dist/img/webcontable1.jpg" alt="Second slide">

                                            </div>

                                            <!--<div class="carousel-item">

                                                <img height="280" class="d-block w-100" src="dist/img/webcontable3.jpeg" alt="Third slide">

                                            </div>-->

                                        </div>

                                        <a class="carousel-control-prev" href="#carouselExampleIndicators" role="button" data-slide="prev">

                                            <span class="carousel-control-custom-icon" aria-hidden="true">

                                                <i class="fas fa-chevron-left"></i>

                                            </span>

                                            <span class="sr-only">Previous</span>

                                        </a>

                                        <a class="carousel-control-next" href="#carouselExampleIndicators" role="button" data-slide="next">

                                            <span class="carousel-control-custom-icon" aria-hidden="true">

                                                <i class="fas fa-chevron-right"></i>

                                            </span>

                                            <span class="sr-only">Next</span>

                                        </a>

                                    </div>

                                </div>

                                <!-- /.card-body -->

                            </div>

                            <!-- /.card -->

                        </div>

                    </div>



                    <h1>Contabilidad Simple</h1>

                    <br>

                    <div class="row">

                        <div class="col-lg-6">

                            <div class="card card-primary card-outline">

                                <div class="card-body">

                                    <h5 class="card-title">Misión</h5>



                                    <p class="card-text">

                                    <h6> “Crear una mejor vida cotidiana para las personas.”</h6>

                                    La empresa que revolucionó la Contabilidad busca que el día a día de cada uno sea más sencillo, mejor y fácil.

                                    </p>



                                    <!--<a href="#" class="card-link">Card link</a>

                                    <a href="#" class="card-link">Another link</a>-->

                                </div>

                            </div>



                            <!-- <div class="card card-primary card-outline">

                                <div class="card-body">

                                    <h5 class="card-title">Vicion</h5>



                                    <p class="card-text">

                                        Some quick example text to build on the card title and make up the bulk of the card's

                                        content.

                                    </p>

                                    <a href="#" class="card-link">Card link</a>

                                    <a href="#" class="card-link">Another link</a>

                                </div>

                            </div>-->

                        </div>

                        <div class="col-lg-6">

                            <div class="card card-primary card-outline">

                                <div class="card-body">

                                    <h5 class="card-title">Visión</h5>



                                    <p class="card-text">

                                        «Servir mejor a nuestros clientes para ser siempre relevantes en sus vidas y formar relaciones duraderas».

                                    </p>

                                    <!--<a href="#" class="card-link">Card link</a>

                                    <a href="#" class="card-link">Another link</a>-->

                                </div>

                            </div>

                        </div>

                    </div>

                    <div class="row">

                        <div class="col-12">

                            <div class="card card-primary card-outline">

                                <div class="card-body">

                                    <h5 class="card-title">Valores</h5>



                                    <p class="card-text">

                                    <div class="row invoice-info">

                                        <div class="col-sm-4 invoice-col">

                                            <ul>

                                                <li>Sinceridad.</li>

                                                <li>Colaboración.</li>

                                                <li>Alegría.</li>

                                            </ul>

                                        </div>

                                        <!-- /.col -->

                                        <div class="col-sm-4 invoice-col">

                                            <ul>

                                                <li>Responsabilidad.</li>

                                                <li>Autenticidad.</li>

                                                <li>Lealtad.</li>

                                            </ul>

                                        </div>

                                        <!-- /.col -->

                                        <div class="col-sm-4 invoice-col">

                                            <ul>

                                                <li>Compromiso.</li>

                                                <li>Innovación.</li>

                                                <li>Excelencia.</li>

                                            </ul>

                                        </div>

                                        <!-- /.col -->

                                    </div>

                                    </p>

                                    <!--<a href="#" class="card-link">Card link</a>

                                    <a href="#" class="card-link">Another link</a>-->

                                </div>

                            </div>

                        </div>

                    </div>

                    <!-- /.row -->

                </div><!-- /.container-fluid -->

            </div>

            <!-- /.content -->

        </div>

        <!-- REQUIRED SCRIPTS -->



        <!-- jQuery -->

        <script src="plugins/jquery/jquery.min.js"></script>

        <!-- Bootstrap 4 -->

        <script src="plugins/bootstrap/js/bootstrap.bundle.min.js"></script>

        <!-- AdminLTE App -->

        <script src="dist/js/adminlte.min.js"></script>

        <!-- AdminLTE for demo purposes -->

        <script src="dist/js/demo.js"></script>



        <!-- REQUIRED SCRIPTS -->
        <?php
        include "views/footer.html";

        ?>