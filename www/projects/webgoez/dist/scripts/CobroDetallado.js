
jQuery(document).ready(init);


function init() {
  $("form#formSearchCobrosDetallado").submit(function (e) {
    e.preventDefault();
    Search(false)
  });

  $("#dateDeste").on("hide.datetimepicker", function (e) {
    $("form#formSearchCobrosDetallado").trigger('submit');
  });
  $("#dateHasta").on("hide.datetimepicker", function (e) {
    $("form#formSearchCobrosDetallado").trigger('submit');
  });

  Search(true)



  function Search(ultimo) {

    $.post("./ajax/UsuarioAjax.php", function (r) {
      if (r === '0') {
        location.reload(true);
      }
    });
    $("#txtUltimo").val(ultimo)


    var formData = new FormData($("#formSearchCobrosDetallado")[0]);
    var Tabla = $("#tblCobroDetallado").DataTable()
    var Tabla1 = $("#tbl1").DataTable()
    $.ajax({
      url: "./ajax/CobroDetalladoAjax.php?op=Search",
      type: "POST",
      data: formData,
      contentType: false,
      processData: false,
      dataType: "json",
      success: function (datos) {
        let recaudo = 0, abonos = 0, prestamos = 0, venta = 0, seguro = 0, diferencia = 0,
          base = 0, efectivo = 0, monedas = 0, descuentos = 0, Utilidal = 0,
          UtiNeta = 0,
          Gastos = 0,
          OtGastos = 0,
          Salida = 0,
          Entrada = 0;
        Tabla.clear().draw();
        Tabla1.clear().draw();
        for (let i = 0; i < datos.length; i++) {
          const val = datos[i];
          Tabla.row
            .add([
              val[0],
              val[1],
              val[2],
              val[3],//recaudo
              val[4],
              val[5],
              val[6],
              val[7],
              val[8],
              val[9],
              val[10],
              val[11],
              val[12],
              val[13],
              val[14],
              val[15],
              val[16],
              val[17],
              val[18],
              val[19],
              val[20],
              val[21],
              val[22],
              val[23],
              val[24],

            ]).draw(false);
          recaudo += parseFloat(val[3]);
          abonos += parseInt(val[4]);
          prestamos += parseFloat(val[5]);
          venta += parseFloat(val[6]);
          seguro += parseFloat(val[7]);
          diferencia += parseFloat(val[8]);
          base += parseFloat(val[9]);
          efectivo += parseFloat(val[10]);
          monedas += parseFloat(val[11]);
          descuentos += parseFloat(val[12]);
          Utilidal += parseFloat(val[13]);
          UtiNeta += parseFloat(val[14]);
          Gastos += parseFloat(val[16]);
          OtGastos += parseFloat(val[18]);
          Salida += parseFloat(val[20]);
          Entrada += parseFloat(val[22])
        }

        Tabla1.row
            .add([
              recaudo,
              abonos,
              prestamos,
              venta,
              seguro,
              diferencia,
              base,
              efectivo,
              monedas,
              descuentos,
              Utilidal,
              UtiNeta,
              Gastos,
              OtGastos,
              Salida,
              Entrada

            ]).draw(false);




      }

    });
  };

}

function verFormContabilibad(params, codigo, tipo, caja) {
  $("#txtcodigoSucursal").text(' ' + tipo + ': ' + codigo);
  $("#VerListado").hide()
  $("#VerformContabilidad").show()
  $("#txtTituloRecibir").text(tipo + ': ' + codigo);


  $.post("./ajax/UsuarioAjax.php", function (r) {
    if (r === '0') {
      location.reload(true);
    }
  });

  $.getJSON("ajax/CobroDetalladoAjax.php?op=CobroDetallado", { id: params }, function (r) {




    if (!r[0]?.reg && r[0] != null) {
      if (r[3].length === 0 && r[6].length === 0 && r[7].length === 0 && r[8].length === 0) {
        $("#alertNotGuardarEnContabilidad a").attr("href", r[0]?.refDetalle_ruta);
        $("#alertNotGuardarEnContabilidad").removeClass('hide')
      }

    }




    $("#textpcaja").text(caja);
    // listar canceladas en la tabla
    let seguroSuma = 0;
    let recaudoTotal = 0;
    let recaudoSumaCuota = 0;
    let recaudoSumaCancelado = 0;
    let recaudoSumaInicial = 0;
    let creditoSumaProducto = 0;
    let creditoSumaPrestamo = 0;
    let creditoSumaTotal = 0;
    let cantidadRecaudos = 0;
    let interecesSuma = 0;
    let descuentoSuma = 0;
    const tblRecaudos = $("#tblRecaudo").DataTable();

    tblRecaudos.clear().draw();



    $.each(r[1].filter((a) =>
      a.descripcion.indexOf("Intereces") === -1 &&
      a.descripcion.indexOf("Descuento") === -1
    ), function (i, v) {
      cantidadRecaudos++;
      recaudoSumaCuota +=
        v.descripcion.indexOf("Abono") != -1 ? parseFloat(v.abono) * -1 : 0;
      recaudoSumaCancelado +=
        v.descripcion.indexOf("Cancelado") != -1 ? parseFloat(v.abono) * -1 : 0;
      recaudoSumaInicial +=
        v.descripcion.indexOf("Inicial") != -1 ? parseFloat(v.abono) * -1 : 0;
      tblRecaudos.row
        .add([
          (i + 1),
          v.descripcion.indexOf("Abono") != -1 ? parseFloat(v.abono).toFixed(2) * -1 : "",
          v.descripcion.indexOf("Cancelado") != -1 ? parseFloat(v.abono).toFixed(2) * -1 : "",
          v.descripcion.indexOf("Inicial") != -1 ? parseFloat(v.abono).toFixed(2) * -1 : "",
          v.nombre,
          v.n_documento,
          v.valor,
          v.costo
        ])
        .draw(false);


    });


    // listar nueva en la tabla
    var trNueva = [];
    trNueva.push(
      r[2].map((v, i) => {
        seguroSuma += parseFloat(v.ut_adi_valor);
        creditoSumaPrestamo +=
          v.consepto === "Prestamo" ? parseFloat(v.costo) : 0;
        creditoSumaProducto +=
          v.consepto === "Articulo" ? parseFloat(v.costo) : 0;
        creditoSumaTotal += parseFloat(v.valor);
        return `
            <tr>
              <td>${i + 1}</td>
              <td>${parseFloat(v.costo).toFixed(2)}</td>
              <td>${parseFloat(v.valor).toFixed(2)}</td>
              <td>${parseFloat(v.ut_adi_valor).toFixed(2)}</td>
              <td>0</td>
              <td>${v.consepto}</td>
              <td style="min-width: 240px;">${v.nombre}</td>
              <td>${v.n_documento}</td>
            </tr>
          `;
      })
    );

    // listar Intereses en la table
    let trIntereces = [];
    trIntereces.push(
      r[1]
        .filter((a) => a.descripcion.indexOf("Intereces") != -1)
        .map((v, i) => {
          interecesSuma += parseFloat(v.abono);
          return `
            <tr>
              <td>${i + 1}</td>
              <td>${(parseFloat(v.abono).toFixed(2) * -1)}</td>
              <td style="min-width: 240px;">${v.nombre}</td>
              <td>${v.n_documento}</td>
              <td>${v.valor}</td>
              <td>${v.costo}</td>
            </tr>
            `;
        })
    );

    // listar Descuentos en la table
    let trDescuentos = [];
    trDescuentos.push(
      r[1]
        .filter((a) => a.descripcion.indexOf("Descuento") != -1)
        .map((v, i) => {
          descuentoSuma += parseFloat(v.abono);
          let des = v.descripcion.replace('Descuento->', '')
          return `
            <tr>
              <td>${i + 1}</td>
              <td>${parseFloat(v.abono).toFixed(2)}</td>
              <td style="min-width: 300px;">des</td>
              <td style="min-width: 240px;">${v.nombre}</td>
              <td>${v.n_documento}</td>
              <td>${v.valor}</td>
              <td>${v.costo}</td>
            </tr>
            `;
        })
    );



    // recaudos append a la table
    recaudoTotal =
      recaudoSumaCuota +
      recaudoSumaCancelado +
      recaudoSumaInicial +
      seguroSuma;





    $("#tfResultado").html("");
    $("#tfResultado").append(`
        <tr>
          <th></th>
          <th>${recaudoSumaCuota}</th>
          <th>${recaudoSumaCancelado}</th>
          <th>${recaudoSumaInicial}</th>
          <th>Total</th>
          <th colspan="4" >${recaudoSumaCuota + recaudoSumaCancelado + recaudoSumaInicial
      }</th>
        </tr>`);

    $("#tdNue").html("");
    $("#tdNue").append(trNueva.join(""));
    //recaudos append a ala tabla
    $("#tblCuentasRecaudo").html("");
    $("#tblCuentasRecaudo").append(`
        <tr>
          <th style="width:50%">Cuotas:</th>
          <td>$${recaudoSumaCuota.toFixed(2)}</td>
        </tr>
        <tr>
          <th>Cuota Inicial</th>
          <td>$${recaudoSumaInicial.toFixed(2)}</td>
        </tr>
        <tr>
          <th>Cancelado:</th>
          <td>$${recaudoSumaCancelado.toFixed(2)}</td>
        </tr>
        <tr>
          <th>Seguros:</th>
          <td>$${seguroSuma.toFixed(2)}</td>
        </tr>
        <tr>
          <th>Total:</th>
          <td>$${recaudoTotal.toFixed(2)}</td>
        </tr>
     `);
    // creditos append 
    $("#tblCuentasCreditos").html("");
    $("#tblCuentasCreditos").append(`
            <tr>
              <th style="width:50%">Prestamo:</th>
              <td>$${creditoSumaPrestamo.toFixed(2)}</td>
            </tr>
            <tr>
              <th>Articulo</th>
              <td>$${creditoSumaProducto.toFixed(2)}</td>
            </tr>
          
            <tr>
              <th>Sub-Total:</th>
              <td>$${(creditoSumaProducto + creditoSumaPrestamo).toFixed(2)}</td>
            </tr>
            <tr>
              <th>Total:</th>
              <td>$${creditoSumaTotal.toFixed(2)}</td>
            </tr>
        `);

    // Descuentos add en la tablebody
    $("#tbodyDescuentos").html("");
    $("#tbodyDescuentos").append(trDescuentos.join(""));


    // refinanciacion add en la tablebody
    $("#tbodyRefinanciaciones").html("");
    $("#tbodyRefinanciaciones").append(trIntereces.join(""));



    // Informacion
    $("#tblCuentasInformacion").html("");
    $("#tblCuentasInformacion").append(`
            <tr>
              <th style="width:50%">Intereses:</th>
              <td>$${(interecesSuma * -1).toFixed(2)}</td>
            </tr>
            <tr>
              <th>Descuento</th>
              <td>$${descuentoSuma.toFixed(2)}</td>
            </tr> 
           
            
          </tr> 
        `);




    if (r[0]) {
      let boolop = true
      if (r[0].estado === 'entregando') {
        $("form#fromDataCobro input").attr('disabled', true)
        $("#btnTotalizarDataCobro").hide()
        $("#iAaddNewGasto").hide()
        /*if ('<?php echo isset($_SESSION["userEmpresa"]);') {
          $("#btnSavedPermanente").html(`
          <a onclick="saveContabilibad(' ${r[0].refDetalle_ruta} ')" class="btn btn-app bg-success">
                    
                    <i class="fas fa-save"></i> Guardar
                  </a>
  
  
          
          
          `);
        }*/

        boolop = false
      } else {
        $("form#fromDataCobro input").attr('disabled', false)
        $("#btnTotalizarDataCobro").show()
        $("#iAaddNewGasto").show()
        //$("#btnSavedPermanente").html('')
      }


      $("#iAaddNewGasto").val(r[0].refDetalle_ruta)
      $("#thNumAleatorio").val(r[0].refDetalle_ruta)



      let trGastos = [];
      let gastosSuma = 0;
      trGastos.push(
        r[3].filter(a => a.nombre != 'base' &&
          a.nombre != 'efectivo' &&
          a.nombre != "efectivoMonedas" &&
          a.nombre != "diferencia" &&
          a.nombre != "efectivo-otra-utilidad"

        ).map((v, i) => {
          gastosSuma += parseFloat(v.valor);

          const desc = v.refCategoria_contabilidad === '2' ? v.nombreEmpleado : v.descripcion;
          const descfoto = v.refCategoria_contabilidad === 10 ? `<img class="img-circle img-sm" src="${v.fotoEmpleado}" alt="Image">` : '';
          const nombre = `<div class="card-comment">
          ${descfoto}
        
          <div class="comment-text">
            <span class="username">
              ${desc}
              <span class="text-muted float-right">${v.nombre}</span>
            </span>
          </div>
        </div>`
          return `idcontabilidad_detalle
        <tr onClick="showBtnDeleteGasto('','${v.refContabilidad_detalle}',${boolop})">
          <th id="thbtndelete${v.refContabilidad_detalle}" class="btnDeleteGasto" style="width: 1px; "></th>
          <th>${nombre}</th>
          <td>${parseFloat(v.valor).toFixed(2)}</td>
        </tr>
        `

        })
      );


      $("#tblCuentasGastos").html("");
      $("#tblCuentasGastos").append(
        trGastos.join("") +
        `<tr>
                 <th  style="width: 1px; "></th>
                 <th style="text-align: right; padding-right: 5px;">Total: </th>
                 <td>$${gastosSuma.toFixed(
          2
        )}</td>
              </tr> `
      );

      var $bDiferencia = $("#txtDiferenciaCuentas");
      let classDiferencia = "";
      let textDiferencia;

      textDiferencia = '';
      $("#btnTotalizarDataCobro").removeClass("hide");
      // Puede haber varias bases en el día; se muestra la suma, igual que en la vista
      // view_contabilidad_detalle_ruta con la que se verifican las cuentas.
      $("#inputBaseInformacion").val(
        r[3].filter(a => a.nombre === 'base')
          .reduce((total, a) => total + (parseFloat(a.valor) || 0), 0)
      );
      $("#inputEfectivoInformacion").val(r[3].find(a => a.nombre === 'efectivo')?.valor);
      $("#inputMonedaInformacion").val(r[3].find(a => a.nombre === 'efectivoMonedas')?.valor);
      textDiferencia = r[3].find(a => a.nombre === 'diferencia')?.valor;
      $("#infoModificarDetalleRuta a").attr("href", r[0]?.refDetalle_ruta);
      if (r[0].estado === 'entregando') $("#infoModificarDetalleRuta").removeClass("hide");
      classDiferencia = "text-muted";
      $("#btnDataCobro").addClass("hide");


      $bDiferencia.parent().attr("class", "");
      $bDiferencia.parent().attr("class", classDiferencia);
      $bDiferencia.text(textDiferencia);
      $("#txtDiferenciaHidden").val(textDiferencia);

      if (r[6].length > 0) {

        // OTROS GASTOS
        let trOtrosGastos = [];
        let otrosGastosSuma = 0;
        trOtrosGastos.push(
          r[6].filter(a => a.nombre != 'base' && a.nombre != 'efectivo' && a.nombre != "efectivoMonedas" && a.nombre != "diferencia").map((v, i) => {
            otrosGastosSuma += parseFloat(v.valor);

            const desc = v.refCategoria_contabilidad === '2' ? v.nombreEmpleado : v.descripcion;
            const descfoto = v.refCategoria_contabilidad === 10 ? `<img class="img-circle img-sm" src="${v.fotoEmpleado}" alt="Image">` : '';
            const nombre = `<div class="card-comment">
          ${descfoto}
        
          <div class="comment-text">
            <span class="username">
              ${desc}
              <span class="text-muted float-right">${v.nombre}</span>
            </span>
          </div>
        </div>`
            return `idcontabilidad_detalle
        <tr onClick="showBtnDeleteGasto('','${v.refContabilidad_detalle}',${boolop})">
          <th id="thbtndelete${v.refContabilidad_detalle}" class="btnDeleteGasto" style="width: 1px; "></th>
          <th>${nombre}</th>
          <td>${parseFloat(v.valor).toFixed(2)}</td>
        </tr>
        `

          })
        );


        $("#tblCuentasOtrosGastos").html("");
        $("#tblCuentasOtrosGastos").append(
          trOtrosGastos.join("") +
          `<tr>
                 <th  style="width: 1px; "></th>
                 <th style="text-align: right; padding-right: 5px;">Total: </th>
                 <td>$${otrosGastosSuma.toFixed(
            2
          )}</td>
              </tr> `
        );
      }
      if (r[7].length > 0) {

        // SALIDAS
        let trSalidas = [];
        let salidasSuma = 0;
        trSalidas.push(
          r[7].filter(a => a.nombre != 'base' && a.nombre != 'efectivo' && a.nombre != "efectivoMonedas" && a.nombre != "diferencia").map((v, i) => {
            salidasSuma += parseFloat(v.valor);

            const desc = v.refCategoria_contabilidad === '2' ? v.nombreEmpleado : v.descripcion;
            const descfoto = v.refCategoria_contabilidad === 10 ? `<img class="img-circle img-sm" src="${v.fotoEmpleado}" alt="Image">` : '';
            const nombre = `<div class="card-comment">
           ${descfoto}
         
           <div class="comment-text">
             <span class="username">
               ${desc}
               <span class="text-muted float-right">${v.nombre}</span>
             </span>
           </div>
         </div>`
            return `idcontabilidad_detalle
         <tr onClick="showBtnDeleteGasto('','${v.refContabilidad_detalle}',${boolop})">
           <th id="thbtndelete${v.refContabilidad_detalle}" class="btnDeleteGasto" style="width: 1px; "></th>
           <th>${nombre}</th>
           <td>${parseFloat(v.valor).toFixed(2)}</td>
         </tr>
         `

          })
        );


        $("#tblCuentasSalidas").html("");
        $("#tblCuentasSalidas").append(
          trSalidas.join("") +
          `<tr>
                  <th  style="width: 1px; "></th>
                  <th style="text-align: right; padding-right: 5px;">Total: </th>
                  <td>$${salidasSuma.toFixed(
            2
          )}</td>
               </tr> `
        );
      }
      if (r[8].length > 0) {

        // ENTRADAS
        let trEntradas = [];
        let entradasSuma = 0;
        trEntradas.push(
          r[8].filter(a => a.nombre != 'base' && a.nombre != 'efectivo' && a.nombre != "efectivoMonedas" && a.nombre != "diferencia").map((v, i) => {
            entradasSuma += parseFloat(v.valor);

            const desc = v.refCategoria_contabilidad === '2' ? v.nombreEmpleado : v.descripcion;
            const descfoto = v.refCategoria_contabilidad === 10 ? `<img class="img-circle img-sm" src="${v.fotoEmpleado}" alt="Image">` : '';
            const nombre = `<div class="card-comment">
          ${descfoto}
        
          <div class="comment-text">
            <span class="username">
              ${desc}
              <span class="text-muted float-right">${v.nombre}</span>
            </span>
          </div>
        </div>`
            return `idcontabilidad_detalle
        <tr onClick="showBtnDeleteGasto('','${v.refContabilidad_detalle}',${boolop})">
          <th id="thbtndelete${v.refContabilidad_detalle}" class="btnDeleteGasto" style="width: 1px; "></th>
          <th>${nombre}</th>
          <td>${parseFloat(v.valor).toFixed(2)}</td>
        </tr>
        `

          })
        );


        $("#tblCuentasEntradas").html("");
        $("#tblCuentasEntradas").append(
          trEntradas.join("") +
          `<tr>
                 <th  style="width: 1px; "></th>
                 <th style="text-align: right; padding-right: 5px;">Total: </th>
                 <td>$${entradasSuma.toFixed(2)}</td>
              </tr> `
        );
      }





    }



  });
}