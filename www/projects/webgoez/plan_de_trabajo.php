<?php
require "data.php";
if ($isPagoSistema == -1) {
   include "views/pago_vencido.html";
} else {
   include "views/plan_de_trabajo.html";
}

include "views/footer.html";
