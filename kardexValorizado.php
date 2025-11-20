<?php
require "data.php";
if ($isPagoSistema == -1) {
   include "views/pago_vencido.html";
} else {
   include "views/kardex_valorizado.html";
}

include "views/footer.html";
