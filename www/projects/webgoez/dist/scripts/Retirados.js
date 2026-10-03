var Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2000
  });
jQuery(document).ready(function () {
    
    ListarClientes()
   
});
function ListarClientes() {
    const tabla = $("#tblClientesMorosos").DataTable()
    $.ajax({
        url: "./ajax/ClienteAjax.php?op=listClientesRetiradosDeCartera",
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
                        element[10]

                    ])
                    .draw(false);
            }
        },
        error: function (e) {
            console.log(e.responseText);
        }
    });
}

function restaurarRetirados(refTarjeta) {
    $.post("./ajax/UsuarioAjax.php", function (r) {
        if (r === '0') {
          location.reload(true);
        }
      });

    Swal.fire({
        title: '¡Restaurar Tarjeta!',
        text: "¿Esta Seguro de Restaurar esta Tarjeta? ",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Si, Restaurar ahora!'
      }).then((result) => {
        if (result.isConfirmed) {
            $.post("./ajax/ClienteAjax.php?op=restaurarMoroso", {refTarjeta},
            function (data, textStatus) {
                if (textStatus==='success') {
                    if (data.indexOf("ERROR:") !== -1) {
                        Toast.fire({
                            icon: 'error',
                            title: data
                        })
                    } else {
                        Toast.fire({
                            icon: 'success',
                            title: data
                        })
                        ListarClientes()
                    }
    
                   
                }
            }
            
        );
        }
      })





   
}




