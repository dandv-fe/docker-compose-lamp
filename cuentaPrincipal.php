<?php
require "data.php";
if ($isPagoSistema == -1) {
   include "views/pago_vencido.html";
} else {
   if ($userSession['usuario']->superadmin_personaid === $_SESSION['idpersona']) {
      include "views/main_account.html";
   } else {
      include "views/main_account_corriente.html";
   }
}

include "views/footer.html";
