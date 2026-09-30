<?php
require "data.php";
if ($isPagoSistema == -1) {
   include "views/pago_vencido.html";
} elseif (!isset($_SESSION['userEmpresa'])) {
   echo '<div class="content-wrapper"><section class="content"><div class="alert alert-danger m-3">Solo el Super Administrador puede administrar bancos o métodos de pago.</div></section></div>';
} else {
   include "views/bancos_pago.html";
}

include "views/footer.html";
