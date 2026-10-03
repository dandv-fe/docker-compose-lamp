<?php
require "data.php";
if ($isPagoSistema == -1) {
   include "views/pago_vencido.html";
} else {
   include "views/tarjetas_canceladas_por_cartera.html";
}

include "views/footer.html";
