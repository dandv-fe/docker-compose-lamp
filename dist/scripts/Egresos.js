jQuery(document).ready(init);

function init() {
    // Escuchar los Eventos
    $("form#formSearchCobrosEgresos").submit(function (e) { 
        e.preventDefault();
        if (!e.target[0].value)return
       listar()
    });

    // Cuando la pagina este lista buscamos egresos del mes actual
    $("form#formSearchCobrosEgresos").trigger("submit");

    function listar() {
        $("#btnstatico").addClass('hide');
        $("#btnspinner").removeClass('hide');
        $.post("./ajax/UsuarioAjax.php", function (r) {
            if (r === '0') {
                location.reload(true);
            }
        });
        var formData = new FormData($("#formSearchCobrosEgresos")[0]);
        var tabla = $('#tblDetalleEgresos').DataTable();
        //console.log('bbb');
        $.ajax({
            url: './ajax/ConsultasAjax.php?op=egresos',
            type: "POST",
            data: formData,
            contentType: false,
            processData: false,
            dataType: "json",
            success: function (datos) {
                
                
                 const conseptos = Array.from(new Set(datos.map(x => capitalizarPalabras(x[2]))));
                // console.log(datos.filter(x => capitalizarPalabras(x[2]) === n));
                 const trTableconsepto = conseptos.map(n => {
                    console.log(datos.filter(x => capitalizarPalabras(x[2]) === n)[0][4]);
                   return `<tr>
                            
                             <td>
                                 $${datos.filter(x => capitalizarPalabras(x[2]) === n).map(m => m[1]).reduce((a, b) => parseFloat(a) + parseFloat(b), 0)}
                             </td>
                              <td>
                                 ${n}
                             </td>
                              <td>
                                 ${datos.filter(x => capitalizarPalabras(x[2]) === n)[0][4]}
                             </td>
                         </tr>`
                 })
                 $("#trTableconsepto").html(trTableconsepto.join(''));
         
                 tabla.clear().draw();
                 for (let i = 0; i < datos.length; i++) {
                    
                    
                   const val = datos[i];
                
                   tabla.row
                     .add([
                       val[0],
                       val[1],
                       capitalizarPalabras(val[2]),
                       val[4],
                       val[3]
                     ]).draw(false);
                 }
                 $("#btnstatico").removeClass('hide');
                 $("#btnspinner").addClass('hide');
            },
            error: function (e) {
                $("#btnstatico").removeClass('hide');
                $("#btnspinner").addClass('hide');
                console.log(e.responseText);
            }
        });
    }

}