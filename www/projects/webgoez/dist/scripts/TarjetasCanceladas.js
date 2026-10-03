
jQuery(document).ready(init);


function init() {
  $("form#formSearchTarjetasCanceladas").submit(function (e) {
    e.preventDefault();
    Search(false)
  });

  $("#dateDeste").on("hide.datetimepicker", function (e) {
    $("form#formSearchTarjetasCanceladas").trigger('submit');
  });
  $("#dateHasta").on("hide.datetimepicker", function (e) {
    $("form#formSearchTarjetasCanceladas").trigger('submit');
  });

  Search(true)



  function Search(ultimo) {

    $.post("./ajax/UsuarioAjax.php", function (r) {
      if (r === '0') {
        // location.reload(true);
      }
    });
    $("#txtUltimo").val(ultimo)


    var formData = new FormData($("#formSearchTarjetasCanceladas")[0]);
    var Tabla = $("#tblTarjetasCanceladas").DataTable()
    $.ajax({
      url: "./ajax/CarteraAjax.php?op=listarTarjetasCanceladas",
      type: "POST",
      data: formData,
      contentType: false,
      processData: false,
      dataType: "json",
      success: function (datos) {
        console.log(datos);
        Tabla.clear().draw();
        for (let i = 0; i < datos.length; i++) {
          const val = datos[i];
          Tabla.row
            .add([
              val[0],
              val[1],
              val[2],
              val[3],
              val[4],
              val[5],
              val[6],
              val[7],
              val[8]

            ]).draw(false);

        }


      }

    });
  };

}