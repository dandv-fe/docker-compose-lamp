<?php
require "data.php";
require_once "model/Banco.php";
$bancoAlcance = (new Banco())->Alcance(
   intval($idglobal),
   isset($_SESSION['userEmpresa']),
   intval($_SESSION['idempleado'] ?? 0)
);
if ($isPagoSistema == -1) {
   include "views/pago_vencido.html";
} elseif (!(new Banco())->PuedeAdministrar($bancoAlcance)) {
   echo '<div class="content-wrapper"><section class="content"><div class="alert alert-danger m-3">Solo el Super Administrador o el administrador de una oficina pueden administrar cuentas bancarias.</div></section></div>';
} else {
   include "views/bancos_pago.html";
}

include "views/footer.html";
