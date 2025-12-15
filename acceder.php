<?php
require "data.php";
if ($isPagoSistema == -1) {
   include "views/pago_vencido.html";
} else {
   is_null($userSession['usuario']->idempleado) ?
      require "views/mi_ahorro.html" :
      include "views/acceder.html";
}

include "views/footer.html";
