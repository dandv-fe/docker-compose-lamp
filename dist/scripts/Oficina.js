
jQuery(document).ready(function () {
  Oficina.init();
  Oficina.cargarOficinas();
  Oficina.eventos();


});

var Oficina = (function () {

  var init = function () {

    verListado();

    // Si la pestaña 'Carteras' está marcada como activa por defecto, cargar su contenido
    if ($('#custom-tabs-five-overlay-dark-tab-carteras').hasClass('active')) {
      cargarCarteras();
    }
  };

  var cargarOficinas = function () {
    showLoading();
    $.getJSON('ajax/OficinaAjax.php?op=list', function (res) {
      if (!res.ok) { console.error(res.msg); return; }
      var $tbody = $('div#VerListado table tbody');
      $tbody.empty();
      var i = 1;
      res.data.forEach(function (item) {
        var representante = item.representante || '';
        var idpersona = item.idpersona_representante || '';
        var idEmpleadoAdmin = item.idempleado_administrador || '';
        var $tr = $('<tr>');
        $tr.append('<td>' + (i++) + '</td>');
        $tr.append('<td>' + (item.str_nombre || '') + '</td>');
        $tr.append('<td data-idempleado="' + idEmpleadoAdmin + '" data-idpersona="' + idpersona + '">' + representante + '</td>');
        $tr.append(`<td>
                        <button class="btn btn-sm btn-warning btnEditar" data-id="${item.id}"><i class="fa fa-pen"></i> <span class="d-none d-sm-inline">Editar</span></button>
                        <button class="btn btn-sm btn-info btnVistaOficina" data-item='${JSON.stringify(item)}'><i class="fa fa-eye"></i> <span class="d-none d-sm-inline">Ver</span></button>
                      </td>`);
        $tbody.append($tr);
        verListado();
      });
    }).fail(function (err) { console.error('Error cargando oficinas', err); }).always(function () { hideLoading(); });
  };

  var cargarDetalleOficina = function (item) {
    console.log(item);
    $('#txtRefOficinaDetalle').val(item.id || '0');
    $('#txt-nombre-oficina-detalle').contents().filter(function () {
      return this.nodeType === 3; // Solo nodos de texto
    }).first().replaceWith(item.str_nombre || '');
    $('#txt-nombre-representante').text(item.representante || '');
    $('#txt-telefono-representante').text(item.telefono_representante || '');
    // actualizar foto del representante (si existe). Si no, usar avatar por sexo
    var foto = item.foto || '';
    var sexo = (item.sexo || '').toLowerCase();
    if (foto) {
      $('#imgRepresentanteOficina').attr('src', foto);
    } else {
      var fallback = 'dist/img/avatar2.png'; // por defecto mujer
      if (sexo.indexOf('hombre') !== -1 || sexo.indexOf('mascul') !== -1) {
        fallback = 'dist/img/avatar.png';
      }
      $('#imgRepresentanteOficina').attr('src', fallback);
    }
    $('#txt-cantidad-carteras').text(item.cantidad_carteras || '0');
    $('#txt-cantidad-empleados').text(item.cantidad_empleados || '0');
    $('#txt-cantidad-despedidos').text(item.cantidad_despedidos || '0');
    verDetalle();
    // Si la pestaña Cartera está activa al mostrar detalle, cargar carteras inmediatamente
    if ($('#custom-tabs-five-overlay-dark-tab-carteras').hasClass('active')) {
      cargarCarteras();
    }
    /*
    $.getJSON('ajax/OficinaAjax.php?op=detalle', { id: idOficina }, function (res) {
      // console.log(res.data);

      if (!res.ok) { console.error(res.msg); return; }
      var found = res.data;
      if (found) {
        $('#txt-nombre-oficina-detalle').contents().filter(function () {
          return this.nodeType === 3; // Solo nodos de texto
        }).first().replaceWith(found.str_nombre || '');
        $('#txt-nombre-representante').text(found.representante || '');
        $('#txt-telefono-representante').text(found.telefono_representante || '');
        $('#txt-cantidad-carteras').text(found.cantidad_carteras || '0');
        $('#txt-cantidad-empleados').text(found.cantidad_empleados || '0');
        $('#txt-cantidad-despedidos').text(found.cantidad_despedidos || '0');
        verDetalle();
      }
    }).fail(function (err) { console.error('Error cargando detalle de oficina', err); });*/
  }

  var eventos = function () {
    // Aquí puedes agregar más eventos si es necesario
    $('#btnNuevaOficina').on('click', function () {
      // mostrar formulario de creación
      $('#modalOficinaTitle').text('Crear Nueva Oficina');
      $('#formOficina')[0].reset();
      $('#txtRefOficina').val('0');
      $('#modalOficina').modal('show');
    });
    $.get('./ajax/EmpleadoAjax.php?op=listEmpleados', function (html) {
      $('#cboAdministrador').append(html);
    });

    // guardar oficina
    $('#btnGuardarOficina').on('click', function () {
      var data = $('#formOficina').serialize();
      $.post('ajax/OficinaAjax.php?op=SaveOrUpdate', data, function (resp) {
        // respuesta en texto
        $('#modalOficina').modal('hide');
        // recargar tabla
        $('div#VerListado table tbody').empty();
        // volver a cargar
        cargarOficinas();
      });
    });

    // Delegation para editar
    $(document).on('click', '.btnEditar', function () {
      var id = $(this).data('id');
      // buscar en la lista actual mediante ajax
      $.getJSON('ajax/OficinaAjax.php?op=list', function (res) {
        if (res.ok) {
          var found = res.data.find(function (x) { return x.id == id; });
          if (found) {
            $('#modalOficinaTitle').text('Editar Oficina');
            $('#txtRefOficina').val(found.id);
            $('#txtNombre').val(found.str_nombre);
            $('#cboAdministrador').val(found.idempleado_administrador);
            $('#modalOficina').modal('show');
          }
        }
      });
    });
    // Delegation para ver detalle
    $(document).on('click', '.btnVistaOficina', function () {
      var item = $(this).data('item');
      // buscar en la lista actual mediante ajax
      cargarDetalleOficina(item);
    });
    $("#icono-ver-lista-oficinas").click(function (e) {
      e.preventDefault();
      $('#custom-tabs-five-tab .nav-link').removeClass('active');
      $('#custom-tabs-five-tabContent .tab-pane').removeClass('active show');

      cargarOficinas();
    });

    $('#custom-tabs-five-tab a').on('show.bs.tab', function (e) {
      console.log('Pestaña a punto de mostrarse:', e.target.getAttribute('id'));

      // Puedes prevenir el cambio si es necesario
      // if (condicion) {
      //     e.preventDefault();
      // }
      switch (e.target.getAttribute('id')) {
        case 'custom-tabs-five-overlay-tab-movimientos':
          cargarMovimientos();
          break;
        case 'custom-tabs-five-overlay-dark-tab-carteras':
          cargarCarteras();
          break;
        case 'custom-tabs-five-normal-tab-empleados':
          cargarEmpleados();
          break;
        default:
          cargarDespedidos();
          break;
      }
    });
  };// /eventos

  var verListado = function () {
    // Mostrar listado
    $("#txt-titulo-oficinas").show();
    $('#btnNuevaOficina').show();
    $('#VerListado').show();
    $('#VerOficina').hide();
  };
  var verDetalle = function () {
    // Mostrar detalle
    $("#txt-titulo-oficinas").hide();
    $('#btnNuevaOficina').hide();
    $('#VerOficina').show();
    $('#VerListado').hide();

  };
  var cargarMovimientos = function () {
    var idOficina = $('#txtRefOficinaDetalle').val() || '0';
    console.log('Listar movimientos para oficina ID:', idOficina);
    // Aquí puedes agregar la lógica para listar los movimientos asociados a la oficina
  };
  var cargarCarteras = function () {
    var idOficina = $('#txtRefOficinaDetalle').val() || '0';
    console.log('Listar carteras para oficina ID:', idOficina);
    var $container = $('#custom-tabs-five-overlay-dark-carteras');
    if (idOficina == '0' || idOficina === 0) {
      $container.html('<div class="p-3 text-muted">Seleccione una oficina para ver sus carteras.</div>');
      return;
    }
    $container.html('<div class="table-responsive"><table class="table table-sm table-striped"><thead><tr><th>#</th><th>Código</th><th>Tipo</th><th>Empleado</th><th>Estado</th></tr></thead><tbody></tbody></table></div>');
    var $tbody = $container.find('tbody');
    showLoading();
    $.getJSON('ajax/SucursalAjax.php?op=listByOficina&idoficina=' + encodeURIComponent(idOficina), function (res) {
      if (!res.ok) { console.error(res.msg); $container.html('<div class="p-3 text-danger">Error cargando carteras</div>'); return; }
      if (!res.data || res.data.length === 0) {
        $tbody.append('<tr><td colspan="5" class="text-center">No se encontraron carteras</td></tr>');
        return;
      }
      var i = 1;
      res.data.forEach(function (suc) {
        var $tr = $('<tr>');
        $tr.append('<td>' + (i++) + '</td>');
        $tr.append('<td>' + (suc.codigo || '') + '</td>');
        $tr.append('<td>' + (suc.tipo || '') + '</td>');
        $tr.append('<td>' + (suc.empleado || '') + '</td>');
        $tr.append('<td>' + (suc.estado || '') + '</td>');
        $tbody.append($tr);
      });
    }).fail(function (err) { console.error('Error cargando carteras', err); $container.html('<div class="p-3 text-danger">Error cargando carteras</div>'); }).always(function () { hideLoading(); });
  }
  var cargarEmpleados = function () {
    var idOficina = $('#txtRefOficinaDetalle').val() || '0';
    console.log('Listar empleados para oficina ID:', idOficina);
    var $container = $('#custom-tabs-five-normal-empleados');
    if (idOficina == '0' || idOficina === 0) {
      $container.html('<div class="p-3 text-muted">Seleccione una oficina para ver sus empleados.</div>');
      return;
    }
    $container.html('<div class="table-responsive"><table class="table table-sm table-striped"><thead><tr><th>#</th><th>Empleado</th><th>Estado</th></tr></thead><tbody></tbody></table></div>');
    var $tbody = $container.find('tbody');
    showLoading();
    $.getJSON('ajax/PlanTrabajoAjax.php?op=listarEmpleados&idoficina=' + encodeURIComponent(idOficina), function (res) {
      if (!res.ok) { console.error(res.msg); $container.html('<div class="p-3 text-danger">Error cargando empleados</div>'); return; }
      if (!res.data || res.data.length === 0) {
        $tbody.append('<tr><td colspan="3" class="text-center">No se encontraron empleados</td></tr>');
        return;
      }
      var i = 1;
      res.data.forEach(function (emp) {
        var $tr = $('<tr>');
        $tr.append('<td>' + (i++) + '</td>');
        $tr.append('<td>' + (emp.nombre || '') + '</td>');
        $tr.append('<td>' + (emp.asignado ? 'Asignado' : 'Disponible') + '</td>');
        $tbody.append($tr);
      });
    }).fail(function (err) { console.error('Error cargando empleados', err); $container.html('<div class="p-3 text-danger">Error cargando empleados</div>'); }).always(function () { hideLoading(); });
  }
  var cargarDespedidos = function () {
    var idOficina = $('#txtRefOficinaDetalle').val() || '0';
    console.log('Listar despedidos para oficina ID:', idOficina);
    var $container = $('#custom-tabs-five-normal-retirados');
    if (idOficina == '0' || idOficina === 0) {
      $container.html('<div class="p-3 text-muted">Seleccione una oficina para ver los despedidos.</div>');
      return;
    }
    $container.html('<div class="table-responsive"><table class="table table-sm table-striped"><thead><tr><th>#</th><th>Empleado</th><th>Cargo</th><th>Fecha</th><th>Motivo</th></tr></thead><tbody></tbody></table></div>');
    var $tbody = $container.find('tbody');
    $.getJSON('ajax/PlanTrabajoAjax.php?op=listarDespedidos&idoficina=' + encodeURIComponent(idOficina), function (res) {
      if (!res.ok) { console.error(res.msg); $container.html('<div class="p-3 text-danger">Error cargando despedidos</div>'); return; }
      if (!res.data || res.data.length === 0) {
        $tbody.append('<tr><td colspan="5" class="text-center">No se encontraron despedidos</td></tr>');
        return;
      }
      var i = 1;
      res.data.forEach(function (d) {
        var $tr = $('<tr>');
        $tr.append('<td>' + (i++) + '</td>');
        $tr.append('<td>' + (d.empleado || '') + '</td>');
        $tr.append('<td>' + (d.cargo || '') + '</td>');
        $tr.append('<td>' + (d.fechaDespido || '') + '</td>');
        $tr.append('<td>' + (d.motivo || '') + '</td>');
        $tbody.append($tr);
      });
    }).fail(function (err) { console.error('Error cargando despedidos', err); $container.html('<div class="p-3 text-danger">Error cargando despedidos</div>'); });
  };

  /* Loading helpers */
  function showLoading() {
    try { $('#global-loading').show(); } catch (e) { }
  }
  function hideLoading() {
    try { $('#global-loading').hide(); } catch (e) { }
  }

  return {
    init: init,
    cargarOficinas: cargarOficinas,
    eventos: eventos,
    verListado: verListado,
    verDetalle: verDetalle,
    cargarMovimientos: cargarMovimientos,
    cargarCarteras: cargarCarteras,
    cargarEmpleados: cargarEmpleados,
    cargarDespedidos: cargarDespedidos,
  };
})();