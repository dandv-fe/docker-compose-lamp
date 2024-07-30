
jQuery(document).ready(function () {
    ListarClientes()
    verList()

    $("#btnSubirMultiplesClientes").click(verForm);
    $("#btnCancelarForm").click(function (e) { 
        e.preventDefault();
        verList()
    });

    $("#pantillaClientesExcel").change(function (e) { 
    
        let imports=e.target.value
        let idxDot=imports.lastIndexOf('.')+1;
        let extFile=imports.substr(idxDot, imports.length).toLowerCase()

        if (extFile=='xlsx' || extFile=='xls') {
            
        } else {
            alert(`solo se aceptan archivos Excel - Usted a intenta subir un archivo ${extFile}`);
            $(e.target).val('')
            return false
        }
    });

    $("form#frmClienteFromExcel").submit(function (e) { 
        e.preventDefault();

        $.post("./ajax/UsuarioAjax.php", function (r) {
            if (r === '0') {
                location.reload(true);
            }
        });
        var formData = new FormData($("#frmClienteFromExcel")[0]);
        $.ajax({
            url: "./ajax/ClienteAjax.php?op=SaveFromEcxel",
            type: "POST",
            data: formData,
            contentType: false,
            processData: false,
            success: function (datos) {
                if (datos.indexOf("ERROR:") !== -1) {
                    Toast.fire({
                        icon: 'error',
                        title: datos
                    })
                } else {
                    Toast.fire({
                        icon: 'success',
                        title: datos
                    })
                   
                    
                }
            }
        });
        
    });



    function ListarClientes() {
        const tabla = $("#clientesDeCartera").DataTable()
        $.ajax({
            url: "./ajax/ClienteAjax.php?op=listClientesDeCartera",
            dataType: "json",
            success: function (r) {
                tabla.clear().draw();
                for (let i = 0; i < r.length; i++) {
                    const element = r[i];
                    tabla.row
                        .add([element[0],
                            element[1],
                            element[2],
                            element[3],
                            element[4],
                            element[5],
                            element[6],
                            element[7],
                            element[8],
                            element[9],
                            element[10],
                            element[11],
                            element[12],
                            element[13],
                            element[14],
                            element[15],
                            element[16],
                            element[17],

                        ])
                        .draw(false);
                }
            },
            error: function (e) {
                console.log(e.responseText);
            }
        });
    }

    

});

function verForm() {

    $("#VerForm").show()
    $("#VerListado").hide();
    $("#btnSubirMultiplesClientes").hide();
}

function verList() {
    $("#VerForm").hide()
    $("#VerListado").show();
     $("#btnSubirMultiplesClientes").show();
}




