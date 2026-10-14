<?php
require "data.php";

http_response_code(410);
?>
<div class="content-wrapper p-3">
   <div class="alert alert-info" role="status">
      Los bonos se registran desde Gastos en Cartera, con una sucursal seleccionada y un despacho abierto.
      Esta página ya no permite registrar bonos.
   </div>
</div>
<?php

include "views/footer.html";
