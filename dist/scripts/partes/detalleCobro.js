jQuery(document).ready(init)
var banderaTotalizar = false

function init() {
  $("#formNuevaContabilidad").submit(function (e) {
    e.preventDefault();

    $.post("./ajax/UsuarioAjax.php", function (r) {
      if (r === '0') {
        location.reload(true);
      }
    });
    var formData = new FormData($("#formNuevaContabilidad")[0]);

    $.ajax({

      url: "./ajax/RecibirCuentasAjax.php?op=SaveOrUpdateGastos",
      type: "POST",
      data: formData,
      contentType: false,
      processData: false,
      success: function (datos) {

        if (datos.indexOf("ERROR:") !== -1) {
          Toast.fire({
            icon: 'error',
            title: datos,
            position: 'top',
          })

        } else {
          $("#modal-NuevaContabilidad").modal('hide')

          Toast.fire({
            icon: 'success',
            title: datos,
            position: 'top',
          })

          DatosCobro(false);
        }

      }

    });
  });

  $("a#btnTotalizarDataCobro").on("click", function (e) {
    e.preventDefault();
    if (!$("a#btnTotalizarDataCobro").is(':disabled')) {
      let efectivo = $("#inputEfectivoInformacion").val();
      let moneda = $("#inputMonedaInformacion").val();


      if (
        efectivo != "" &&
        moneda != ""

      ) {
        // totaliza

        DatosCobro(true);
      } else {
        Swal.fire({
          title: 'Error! Informacion incompleta',
          text: 'Todos los campos son : REQUERIDOS!!!',
          icon: 'error',
          confirmButtonText: 'Ok!'
        })
      }

    }

  });


  $("body").on("click", "#iAaddNewGasto", (e) => {
    $("#txtOperacionContabilidad").val('salida-totalizar');
    $("#txtrefSucursalHidden").val($("#txtrefSucursalContabiliddHidden").val());
    $("#modal-NuevaContabilidad").modal('show')
  });

  // La base se anota durante el día, una o varias veces, igual que en la APK.
  $("body").on("click", "#iAaddNewBase", (e) => {
    e.preventDefault();
    abrirFormBase('', '', '');
  });

  $("#formNuevaBase").submit(function (e) {
    e.preventDefault();

    $.post("./ajax/UsuarioAjax.php", function (r) {
      if (r === '0') {
        location.reload(true);
      }
    });

    $.ajax({
      url: "./ajax/RecibirCuentasAjax.php?op=SaveOrUpdateBase",
      type: "POST",
      data: new FormData($("#formNuevaBase")[0]),
      contentType: false,
      processData: false,
      success: function (datos) {
        if (datos.indexOf("ERROR:") !== -1) {
          Toast.fire({ icon: 'error', title: datos, position: 'top' })
          return;
        }
        $("#modal-NuevaBase").modal('hide')
        Toast.fire({ icon: 'success', title: datos, position: 'top' })
        DatosCobro(false);
      }
    });
  });

  $("#modal-NuevaBase").on('hidden.bs.modal', function (e) {
    $("form#formNuevaBase").trigger('reset');
    $("#txtrefBaseHidden").val('');
  });

  $("form#fromDataCobro").submit(function (e) {
    e.preventDefault();
    if (!banderaTotalizar) {
      $("#btnTotalizarDataCobro").trigger('click');
      return
    }
    $.post("./ajax/UsuarioAjax.php", function (r) {
      if (r === '0') {
        location.reload(true);
      }
    });
    var formData = new FormData($("#fromDataCobro")[0]);

    $.ajax({
      url: "./ajax/RecibirCuentasAjax.php?op=SaveOrUpdateDtaCobro",
      type: "POST",
      data: formData,
      contentType: false,
      processData: false,
      success: function (datos) {
        if (datos.indexOf("ERROR:") !== -1) {
          Toast.fire({
            icon: 'error',
            title: datos,
            position: 'top',
          })

        } else {
          $("#modal-NuevaContabilidad").modal('hide')

          Toast.fire({
            icon: 'success',
            title: datos,
            position: 'top',
          })

          DatosCobro(false);
        }

      },
    });
  });

  $("#alertNotGuardarEnContabilidad a").click((e) => {
    e.preventDefault()
    $.post("./ajax/UsuarioAjax.php", function (r) {
      if (r === '0') {
        location.reload(true);
      }
    });
    Swal.fire({
      title: '¡Activar para editar!',
      text: "¿Esta Seguro archivar sin incluir a la contabilidad?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Si, hacer ahora!'
    }).then((result) => {
      if (result.isConfirmed) {
        $.post("./ajax/RecibirCuentasAjax.php?op=manejarNotIncludeDetalleRuta", { params: $(e.target).attr('href') }, function (datos) {
          if (datos.indexOf("ERROR:") !== -1) {
            Toast.fire({
              icon: 'error',
              title: datos,
              position: 'top',
            })

          } else {
            Toast.fire({
              icon: 'success',
              title: datos,
              position: 'top',
            })

            location.reload(true);
          }
        });
      }
    })

  });



  $("#infoModificarDetalleRuta a").click((e) => {
    e.preventDefault()
    $.post("./ajax/UsuarioAjax.php", function (r) {
      if (r === '0') {
        location.reload(true);
      }
    });
    Swal.fire({
      title: '¡Activar para editar!',
      text: "¿Esta Seguro de Editar este Documento?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Si, Activar ahora!'
    }).then((result) => {
      if (result.isConfirmed) {
        $.post("./ajax/RecibirCuentasAjax.php?op=manejarDesbEditarDetalleRuta", { params: $(e.target).attr('href') }, function (datos) {
          if (datos.indexOf("ERROR:") !== -1) {
            Toast.fire({
              icon: 'error',
              title: datos,
              position: 'top',
            })

          } else {
            Toast.fire({
              icon: 'success',
              title: datos,
              position: 'top',
            })

            DatosCobro(false);
          }
        });
      }
    })

  });


  $("#cboTipo_contabilidad").change(function (e) {
    e.preventDefault();
    $("#cboNomina").val('')
    $("#cboDeContabilidad").html('');
   
    $.post("./ajax/UsuarioAjax.php", function (r) {
      if (r === '0') {
        location.reload(true);
      }
    });

    if ($(e.target).val() != '2') {
      $.get("./ajax/RecibirCuentasAjax.php?op=deContabilidad", { operacion: e.target.value }, function (r) {
        $("#cboDeContabilidad").html(r);

      })




      if ($("#divcboNomina").is(':visible')) $("#divcboNomina").addClass('hide')
      $("#cboNomina").val('')
      $("#txtrefNominaHidden").val('')
      $("#cboNomina").attr('required', false)
    } else {
      const refSucursal=$("#txtrefSucursalHidden").val();
     
        $.getJSON("./ajax/RecibirCuentasAjax.php?op=listNominas", { operacion: e.target.value,refSucursal }, function (r) {
          if (!$("#divcboNomina").is(':visible')) $("#divcboNomina").removeClass('hide')
          
          $("#cboNomina").html(r[0]);
          $("#cboDeContabilidad").html(r[1]);
          $("#cboNomina").attr('required', true)
        })
     
    }

  });

  $("#cboNomina").change(function (e) {
    e.preventDefault();
    $("#txtrefNominaHidden").val(e.target.value);
  });

} // .//init



function DatosCobro(istotalizar) {
  $("#alertNotGuardarEnContabilidad").addClass('hide')
  $.post("./ajax/UsuarioAjax.php", function (r) {
    if (r === '0') {
      location.reload(true);
    }
  });
  if (!istotalizar) {
    window.scroll(0, 0);
  }


  $("#errorSegurosIncorrectos").addClass("hide");
  $("#infoModificarDetalleRuta").addClass("hide");

  let efectivo = $("#inputEfectivoInformacion").val();
  let moneda = $("#inputMonedaInformacion").val();


  $.getJSON("ajax/CarteraAjax.php?op=VerfCuentas", { id: $("#txtrefSucursalContabiliddHidden").val(), istotalizar }, function (r) {
    const cajaRuta = r[9];
    const cajaVigente = cajaRuta?.totales && Number(cajaRuta.ruta) === Number(r[0]?.refDetalle_ruta);
    mostrarCajaBolsillo(cajaRuta);
    if (typeof actualizarResumenCajaCartera === 'function') actualizarResumenCajaCartera();
    if (!cajaVigente) {
      $("#btnDataCobro").addClass("hide");
      $("#txtDiferenciaCuentas").text("No se pudo verificar la caja de esta ruta. Actualiza las cuentas.");
      if (istotalizar) return;
    }


    if (!r[0]?.reg && r[0] != null) {
      if (r[0].estado === 'created' && r[3].length === 0 && r[6].length === 0 && r[7].length === 0 && r[8].length === 0) {
        $("#alertNotGuardarEnContabilidad a").attr("href", r[0]?.refDetalle_ruta);
        $("#alertNotGuardarEnContabilidad").removeClass('hide')
      }

    }




    if (!r[5]) {
      $("#fromDataCobro").addClass('hide')
    }


    $("#textpcaja").text(r[4]);
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


    $(".Nojodasmierda").hide();
    $("#accordion").show();

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
              <td>${(r[0].estado === 'entregando') ? 'Entregando' : '<button onclick="eliminarCredito(\'' + v.refTarjeta + '\')" class="btn btn-danger"  data-dato="" title=""><i class="fa fa-trash"></i> </button>'}</td>
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
    if (cajaVigente) {
      recaudoSumaCuota = cajaRuta.totales.cuotas;
      recaudoSumaInicial = cajaRuta.totales.inicial;
      recaudoSumaCancelado = cajaRuta.totales.cancelado;
      seguroSuma = cajaRuta.totales.seguros;
    }
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
          <th>Recibido por banco (cuotas):</th>
          <td>$${(cajaVigente ? cajaRuta.totales.cuotasBanco : 0).toFixed(2)}</td>
        </tr>
        <tr>
          <th>Recibido por banco (inicial):</th>
          <td>$${(cajaVigente ? cajaRuta.totales.inicialBanco : 0).toFixed(2)}</td>
        </tr>
        <tr>
          <th>Recibido por banco (cancelado):</th>
          <td>$${(cajaVigente ? cajaRuta.totales.canceladoBanco : 0).toFixed(2)}</td>
        </tr>
        <tr>
          <th>Abonos en efectivo:</th>
          <td>$${(cajaVigente ? cajaRuta.totales.recaudo - cajaRuta.totales.recaudoBanco : 0).toFixed(2)}</td>
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
              <th>Pagado desde banco:</th>
              <td>$${(cajaVigente ? cajaRuta.totales.creditosBanco : 0).toFixed(2)}</td>
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

      // Las bases anotadas en el día. Mientras la ruta siga abierta se pueden corregir o borrar;
      // una vez entregadas quedan como historia y solo se leen.
      const basesDelDia = r[3].filter(a => a.nombre === 'base');
      const basesSuma = basesDelDia.reduce((total, a) => total + (parseFloat(a.valor) || 0), 0);
      $("#tblCuentasBases").html(
        (basesDelDia.length === 0
          ? `<tr><td class="text-muted">Todavía no hay ninguna base anotada.</td></tr>`
          : basesDelDia.map((v) => `
        <tr>
          <th style="width: 1px;">${boolop
            ? `<i onClick="deleteBaseDetalleRuta('${v.refContabilidad_detalle}')" class="fa-solid fa-circle-minus fa-lg" style="color: #e30d0d; cursor: pointer;"></i>`
            : ''}</th>
          <th>${v.descripcion ? v.descripcion : 'Base recibida'}</th>
          <td>${parseFloat(v.valor).toFixed(2)}</td>
          <td style="width: 1px;">${boolop
            ? `<i onClick="editarBase('${v.refContabilidad_detalle}', ${parseFloat(v.valor)}, '${(v.descripcion || '').replace(/'/g, "\\'")}')" class="fa-solid fa-pen-to-square fa-lg" style="color: #0636c6; cursor: pointer;"></i>`
            : ''}</td>
        </tr>`).join("")) +
        `<tr>
          <th style="width: 1px;"></th>
          <th style="text-align: right; padding-right: 5px;">Total: </th>
          <td>$${basesSuma.toFixed(2)}</td>
          <td style="width: 1px;"></td>
        </tr>`
      );
      if (boolop) $("#iAaddNewBase").show(); else $("#iAaddNewBase").hide();


      let trGastos = [];
      let gastosSuma = 0;
      trGastos.push(
        r[3].filter(a => a.nombre != 'base' && a.nombre != 'efectivo' && a.nombre != "efectivoMonedas" && a.nombre != "diferencia").map((v, i) => {
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
      // La base es la que quedó anotada en la ruta, no un dato que se escriba aquí. Puede haber
      // varias en el día, así que se usa la suma: es lo mismo que hace la vista
      // view_contabilidad_detalle_ruta, con la que el servidor verifica la diferencia.
      const base = basesSuma;
      $("#inputBaseInformacion").val(base);
      if (istotalizar === true) {
        const diferencia = Math.round((
          Number(moneda) + Number(efectivo) - cajaRuta.totales.efectivo
        ) * 100) / 100;

        // $diferencia = $prestamo + $gastos + $gasolina + $boletas + $monedas + $efectivo - $base - $cobro - $boletas;
        if (diferencia > 0) {
          classDiferencia = "text-yellow";
        } else if (diferencia < 0) {
          classDiferencia = "text-red";
        } else {
          classDiferencia = "text-green";
        }

        textDiferencia = parseFloat(diferencia);
        $("#btnDataCobro").removeClass("hide");
        $("#btnTotalizarDataCobro").addClass("hide");
        banderaTotalizar = true
      } else {
        textDiferencia = '';
        $("#btnTotalizarDataCobro").removeClass("hide");
        $("#inputEfectivoInformacion").val(r[3].find(a => a.nombre === 'efectivo')?.valor);
        $("#inputMonedaInformacion").val(r[3].find(a => a.nombre === 'efectivoMonedas')?.valor);
        textDiferencia = r[3].find(a => a.nombre === 'diferencia')?.valor;
        $("#infoModificarDetalleRuta a").attr("href", r[0]?.refDetalle_ruta);
        if (r[0].estado === 'entregando') $("#infoModificarDetalleRuta").removeClass("hide");
        classDiferencia = "text-muted";
        $("#btnDataCobro").addClass("hide");
      }

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

        // OENTRADAS
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



  }).fail(function () {
    $("#btnDataCobro").addClass("hide");
    $("#cajaBolsilloTotal").text("No disponible");
    $("#txtDiferenciaCuentas").text("No se pudieron actualizar las cuentas. Intenta de nuevo.");
  });
}// ./DatosCobro()



function showBtnDeleteGasto(i, id, op) {
  if (op) {
    $(".btnDeleteGasto").html("");

    $("#thbtndelete" + id).html(
      '<i onClick="deleteGastoDetalleRuta(\'' +
      id +
      '\')" class="fa-solid fa-circle-minus fa-lg" style="color: #e30d0d;"></i>'
    );
  }
}

//<i class="fa-solid fa-minus fa-2xl" style="color: #e30d0d;"></i>
// Abre el formulario de base: sin id anota una nueva, con id corrige la que ya estaba.
function abrirFormBase(id, valor, detalle) {
  $("#txtrefBaseHidden").val(id);
  $("#txtrefSucursalBaseHidden").val($("#txtrefSucursalContabiliddHidden").val());
  $("#txtValorBase").val(valor);
  $("#txtdescripcionBase").val(detalle);
  $("#tituloModalBase").text(id ? 'Corregir base' : 'Anotar base');
  $("#modal-NuevaBase").modal('show');
}

function editarBase(id, valor, detalle) {
  abrirFormBase(id, valor, detalle);
}

function deleteBaseDetalleRuta(params) {
  $.post("./ajax/UsuarioAjax.php", function (r) {
    if (r === '0') {
      location.reload(true);
    }
  });

  Swal.fire({
    title: '¡Borrar base!',
    text: "¿Está seguro de borrar esta base del día?",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Si, Borrar ahora!'
  }).then((result) => {
    if (!result.isConfirmed) return;
    $.post("./ajax/RecibirCuentasAjax.php?op=deleteBase", { id: params }, function (datos) {
      if (datos.indexOf("ERROR:") !== -1) {
        Toast.fire({ icon: 'error', title: datos, position: 'top' })
        return;
      }
      Toast.fire({ icon: 'success', title: datos, position: 'top' })
      DatosCobro(false);
    });
  })
}

function deleteGastoDetalleRuta(params) {
  $.post("./ajax/UsuarioAjax.php", function (r) {
    if (r === '0') {
      location.reload(true);
    }
  });

  Swal.fire({
    title: '¡Eliminar Gasto!',
    text: "¿Esta Seguro de Eliminar el ¡Gasto! De este  Documento?",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Si, Eliminar ahora!'
  }).then((result) => {
    if (result.isConfirmed) {
      $.post(
        "./ajax/CarteraAjax.php?op=deleteGastoDetalleRuta",
        { id: params },
        function (datos) {
          if (datos.indexOf("ERROR:") !== -1) {
            Toast.fire({
              icon: 'error',
              title: datos,
              position: 'top',
            })

          } else {
            $("#modal-NuevaContabilidad").modal('hide')

            Toast.fire({
              icon: 'success',
              title: datos,
              position: 'top',
            })

            DatosCobro(false);
          }
        }
      );
    }
  })

}

function manejaronKeyEnter(e, input) {
  var key = e.keyCode ? e.keyCode : e.which;
  banderaTotalizar = false;
  if (key == 13) {
    /* e.preventDefault()
     const valor = $(input)
     if (valor.val() === '') return false
     switch (valor.attr('id')) {
 
       case 'inputBaseInformacion':
         $("#inputEfectivoInformacion").focus()
         break; case 'inputEfectivoInformacion':
         $("#inputMonedaInformacion").focus()
         break;
       default:
         $("#btnTotalizarDataCobro").trigger('click');
         break;
     }*/
  } else if (key != 9) {
    $("#errorSegurosIncorrectos").addClass("hide");
    var $bDiferencia = $("#txtDiferenciaCuentas");
    $bDiferencia.parent().attr("class", "");
    $bDiferencia.parent().attr("class", "text-muted");
    $bDiferencia.text("");
    if ($("#btnDataCobro").is(":visible")) $("#btnDataCobro").addClass("hide");
    if (!$("#btnTotalizarDataCobro").is(":visible")) $("#btnTotalizarDataCobro").removeClass("hide");
  }

}

function eliminarCredito(params) {

  Swal.fire({
    title: "Eliminar Crédito",
    text: "Se eliminara permanentemente este crédito del cliente! \n Para eliminar escriba si o eliminar",
    icon: "warning",
    input: "text",
    showCancelButton: true,
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",
    confirmButtonText: "Si, eliminar ahora!",
    preConfirm: (login) => {

      if (login.toLowerCase() == 'si' || login.toLowerCase() == 'eliminar' || login.toLowerCase() == 'yes' || login.toLowerCase() == '1') {
        return;
      }
      Swal.showValidationMessage(`
                Emposible eliminar : \n Tu desicion fue \n  ${login}
            `);

    },
  }).then((result) => {
    if (result.isConfirmed) {
      $.post("./ajax/UsuarioAjax.php", function (r) {
        if (r === '0') {
          location.reload(true);
        }
      });

      $.post("./ajax/CarteraAjax.php?op=eliminarCredito", { refTarjeta: params }, function (r) {
        if (r.indexOf("ERROR:") !== -1) {
          Toast.fire({
            icon: 'error',
            title: r
          })
        } else {
          Toast.fire({
            icon: 'success',
            title: r
          })
          // DatosCobro(false);
          listarRuta();
        }

      });

    }
  });
}
function saveContabilibad(params) {

  $.post("./ajax/UsuarioAjax.php", function (r) {
    if (r === '0') {
      location.reload(true);
    }
  });
  Swal.fire({
    title: '¡Guardar Contabilidad!',
    text: "¿Esta Seguro de Archivar este  Documento?\r Los Cambios son permanentes ",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Si, Guardar ahora!'
  }).then((result) => {
    if (result.isConfirmed) {
      $.post("./ajax/RecibirCuentasAjax.php?op=saveContabilidad", { params }, function (datos) {
        if (datos.indexOf("ERROR:") !== -1) {
          Toast.fire({
            icon: 'error',
            title: datos,
            position: 'top',
          })

        } else {
          Toast.fire({
            icon: 'success',
            title: datos,
            position: 'top',
          })

          location.reload(true)
        }
      });
    }
  })
}