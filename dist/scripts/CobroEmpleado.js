
jQuery(document).ready(init);


function init() {
    $("form#formSearchCobrosDetallado").submit(function (e) { 
        e.preventDefault();
        Search()
    });

    $("#dateDeste").on("hide.datetimepicker", function (e) {
            $("form#formSearchCobrosDetallado").trigger('submit');
    });


     function Search() {
       
        $.post("./ajax/UsuarioAjax.php", function (r) {
            if (r === '0') {
                location.reload(true);
            }
        });
        var formData = new FormData($("#formSearchCobrosDetallado")[0]);



        $("#example1").DataTable({
            "responsive": true,
            "lengthChange": false,
            "autoWidth": false,
            dom: 'Bfrtip',
            "buttons": ["copy", "csv", "excel", "pdf", "print", "colvis"],
            "columns": [
                { "mDataProp": "0" },
                { "mDataProp": "1" },
                { "mDataProp": "2" },
                { "mDataProp": "3" },
                { "mDataProp": "4" },
                { "mDataProp": "5" },
                { "mDataProp": "6" },
                { "mDataProp": "7" },
                { "mDataProp": "8" },
                { "mDataProp": "9" },
                { "mDataProp": "10" },
                { "mDataProp": "11" },
                { "mDataProp": "12" }

            ],
            "ajax":
            {
                url:"./ajax/CobroDetalladoAjax.php?op=Search",
                data: formData,
                type: "get",
                contentType: false,
                processData: false,
                dataType: "json",

                error: function (e) {
                    console.log(e.responseText);
                }
            },
            "bDestroy": true
        })


      /*  $.ajax({
            url: "./ajax/CobroDetalladoAjax.php?op=Search",
            type: "POST",
            data: formData,
            contentType: false,
            processData: false,
            dataType: "json",
            success: function (datos) {
               console.log(datos);
            

            }

        });*/
    };
   
}