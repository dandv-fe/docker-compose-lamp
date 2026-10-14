jQuery(document).ready(function () {
    // Inicializar DataTable
    var tablaDespedidos = $('#tablaDespedidos').DataTable(Object.assign({}, EmployeeOfficeGroups.options(jQuery), {
        responsive: true,
        lengthChange: false,
        autoWidth: false,
        buttons: [
            {
                extend: 'excel',
                text: '<i class="fas fa-file-excel"></i> Excel',
                className: 'btn btn-success btn-sm',
                exportOptions: { columns: [0,1,2,3,4,5,6,7,8,9] }
            },
            {
                extend: 'pdf',
                text: '<i class="fas fa-file-pdf"></i> PDF',
                className: 'btn btn-danger btn-sm',
                exportOptions: { columns: [0,1,2,3,4,5,6,7,8,9] }
            },
            {
                extend: 'print',
                text: '<i class="fas fa-print"></i> Imprimir',
                className: 'btn btn-info btn-sm',
                exportOptions: { columns: [0,1,2,3,4,5,6,7,8,9] }
            }
        ],
        language: {
            "sProcessing": "Procesando...",
            "sLengthMenu": "Mostrar _MENU_ registros",
            "sZeroRecords": "No se encontraron resultados",
            "sEmptyTable": "Ningún dato disponible en esta tabla",
            "sInfo": "Mostrando registros del _START_ al _END_ de un total de _TOTAL_ registros",
            "sInfoEmpty": "Mostrando registros del 0 al 0 de un total de 0 registros",
            "sInfoFiltered": "(filtrado de un total de _MAX_ registros)",
            "sInfoPostFix": "",
            "sSearch": "Buscar:",
            "sUrl": "",
            "sInfoThousands": ",",
            "sLoadingRecords": "Cargando...",
            "oPaginate": {
                "sFirst": "Primero",
                "sLast": "Último",
                "sNext": "Siguiente",
                "sPrevious": "Anterior"
            },
            "oAria": {
                "sSortAscending": ": Activar para ordenar la columna de manera ascendente",
                "sSortDescending": ": Activar para ordenar la columna de manera descendente"
            }
        }
    }));

    tablaDespedidos.buttons().container().appendTo('#tablaDespedidos_wrapper .col-md-6:eq(0)');

    // Cargar datos iniciales
    cargarDespedidos();
    cargarEstadisticas();

    // Evento de filtros
    $('#formFiltrosDespidos').on('submit', function(e) {
        e.preventDefault();
        cargarDespedidos();
    });

    // Limpiar filtros
    $('#btnLimpiarFiltros').on('click', function() {
        $('#formFiltrosDespidos')[0].reset();
        cargarDespedidos();
    });

    // Exportar a Excel
    $('#btnExportarExcel').on('click', function() {
        tablaDespedidos.button('.buttons-excel').trigger();
    });

    // Toast para notificaciones
    var Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
    });

    // Función para cargar despedidos
    function cargarDespedidos() {
        var filtros = {
            tipo_despido: $('#filtroTipoDespido').val(),
            liquidacion: $('#filtroLiquidacion').val(),
            fecha_desde: $('#filtroFechaDesde').val(),
            fecha_hasta: $('#filtroFechaHasta').val()
        };

        $.ajax({
            url: 'ajax/EmpleadoAjax.php?op=listarDespedidos',
            type: 'POST',
            data: filtros,
            dataType: 'json',
            beforeSend: function() {
                // Mostrar loading
                Swal.fire({
                    title: 'Cargando...',
                    text: 'Obteniendo datos de despedidos',
                    allowOutsideClick: false,
                    showConfirmButton: false,
                    willOpen: () => {
                        Swal.showLoading();
                    }
                });
            },
            success: function(data) {
                Swal.close();
                tablaDespedidos.clear();
                
                if (data && data.length > 0) {
                    data.forEach(function(item, index) {
                        tablaDespedidos.row.add([
                            index + 1,
                            item.empleado,
                            item.documento,
                            item.cargo,
                            item.fechaDespido,
                            formatearTipoDespido(item.tipoDespido),
                            formatearLiquidacion(item.liquidacion),
                            formatearEstadoDocumentos(item.estadoDocs),
                            generarBotonesAccion(item),
                            item.oficinaNombre,
                            item.oficinaId === null ? 'sin-oficina' : String(item.oficinaId)
                        ]);
                    });
                }
                
                tablaDespedidos.draw();
                cargarEstadisticas();
            },
            error: function(xhr, status, error) {
                Swal.close();
                Toast.fire({
                    icon: 'error',
                    title: 'Error al cargar los despedidos'
                });
                console.error('Error:', error);
            }
        });
    }

    // Función para cargar estadísticas
    function cargarEstadisticas() {
        $.ajax({
            url: 'ajax/EmpleadoAjax.php?op=estadisticasDespedidos',
            type: 'GET',
            dataType: 'json',
            success: function(data) {
                $('#totalDespidos').text(data.total || 0);
                $('#despidosMes').text(data.meActual || 0);
                $('#liquidacionesPendientes').text(data.liquidacionesPendientes || 0);
                $('#documentosCompletos').text(data.documentosCompletos || 0);
            },
            error: function() {
                console.error('Error al cargar estadísticas');
            }
        });
    }

    // Formatear tipo de despido
    function formatearTipoDespido(tipo) {
        var badges = {
            'despido_justificado': '<span class="badge badge-danger">Despido Justificado</span>',
            'despido_injustificado': '<span class="badge badge-warning">Despido Injustificado</span>',
            'renuncia_voluntaria': '<span class="badge badge-success">Renuncia Voluntaria</span>',
            'terminacion_contrato': '<span class="badge badge-info">Terminación Contrato</span>',
            'reduccion_personal': '<span class="badge badge-primary">Reducción Personal</span>',
            'incapacidad_permanente': '<span class="badge badge-secondary">Incapacidad Permanente</span>',
            'jubilacion': '<span class="badge badge-light">Jubilación</span>',
            'otro': '<span class="badge badge-dark">Otro</span>'
        };
        return badges[tipo] || tipo;
    }

    // Formatear estado de liquidación
    function formatearLiquidacion(estado) {
        var badges = {
            'si': '<span class="badge badge-warning"><i class="fas fa-clock mr-1"></i>Pendiente</span>',
            'no': '<span class="badge badge-secondary"><i class="fas fa-times mr-1"></i>No Aplica</span>',
            'pagada': '<span class="badge badge-success"><i class="fas fa-check mr-1"></i>Pagada</span>'
        };
        return badges[estado] || estado;
    }

    // Formatear estado de documentos
    function formatearEstadoDocumentos(estado) {
        var badges = {
            'pendiente': '<span class="badge badge-warning"><i class="fas fa-hourglass-half mr-1"></i>Pendiente</span>',
            'parcial': '<span class="badge badge-info"><i class="fas fa-tasks mr-1"></i>Parcial</span>',
            'completa': '<span class="badge badge-success"><i class="fas fa-check-double mr-1"></i>Completa</span>'
        };
        return badges[estado] || estado;
    }

    // Generar botones de acción
    function generarBotonesAccion(item) {
        // Debug: ver qué datos llegan
        console.log('Item completo:', item);
        console.log('Recontratacion:', item.recontratacion);
        
        var botones = `
            <button class="btn btn-info btn-sm" title="Ver Detalles" onclick="verDetalleDespido(${item.id})">
                <i class="fas fa-eye"></i>
            </button>
            <button class="btn btn-warning btn-sm" title="Actualizar Estado" onclick="actualizarEstadoDespido(${item.id})">
                <i class="fas fa-edit"></i>
            </button>
        `;
        
        // Agregar botón de recontratación si tiene derecho
        if (item.recontratacion === 'si') {
            var nombreEscapado = (item.empleado || '').replace(/'/g, "\\'");
            botones += `
            <button class="btn btn-success btn-sm" title="Recontratar Empleado" onclick="recontratarEmpleado(${item.id}, ${item.idEmpleado}, '${nombreEscapado}')">
                <i class="fas fa-user-check"></i>
            </button>
            `;
        }
        
        return botones;
    }

    // Función global para ver detalles
    window.verDetalleDespido = function(id) {
        $.ajax({
            url: 'ajax/EmpleadoAjax.php?op=obtenerDetalleDespido',
            type: 'POST',
            data: { id: id },
            dataType: 'json',
            beforeSend: function() {
                Swal.fire({
                    title: 'Cargando...',
                    allowOutsideClick: false,
                    showConfirmButton: false,
                    willOpen: () => {
                        Swal.showLoading();
                    }
                });
            },
            success: function(data) {
                Swal.close();
                if (data) {
                    mostrarModalDetalle(data);
                } else {
                    Toast.fire({
                        icon: 'error',
                        title: 'No se pudieron cargar los detalles'
                    });
                }
            },
            error: function() {
                Swal.close();
                Toast.fire({
                    icon: 'error',
                    title: 'Error al cargar los detalles'
                });
            }
        });
    };

    // Mostrar modal con detalles
    function mostrarModalDetalle(data) {
        // Información del empleado
        $('#detalleFoto').attr('src', data.foto || 'dist/img/user-default.png');
        $('#detalleNombre').text(data.empleado);
        $('#detalleCargo').text(data.cargo);
        $('#detalleDocumento').text(data.documento);
        $('#detalleTelefono').text(data.telefono || 'N/A');
        $('#detalleFechaIngreso').text(data.fechaIngreso);
        $('#detalleFechaDespido').text(data.fechaDespido);
        $('#detalleTiempoTrabajado').text(data.tiempoTrabajado);

        // Información del despido
        $('#detalleTipoDespido').html(formatearTipoDespido(data.tipoDespido));
        $('#detalleUltimoDia').text(data.fechaUltimoTrabajo || 'N/A');
        $('#detalleMotivo').text(data.motivo);

        // Autorización
        $('#detalleAutorizadoPor').text(data.autorizadoPor || 'N/A');
        $('#detalleCargoAutoriza').text(data.cargoAutoriza || 'N/A');

        // Liquidación
        $('#detalleLiquidacion').text(data.liquidacion ? '$' + parseFloat(data.liquidacion).toLocaleString('es-CO') : 'N/A');
        $('#detalleMontoLiquidacion').text(data.montoLiquidacion ? '$' + parseFloat(data.montoLiquidacion).toLocaleString('es-CO') : 'N/A');

        // Documentación
        $('#detalleEntregaDocumentos').html(formatearEstadoDocumentos(data.entregaDocumentos));
        $('#detalleActaFirmada').html(
            data.actaFirmada === 'si' ? '<span class="badge badge-success">Sí</span>' :
            data.actaFirmada === 'no' ? '<span class="badge badge-danger">No</span>' :
            '<span class="badge badge-warning">Pendiente</span>'
        );
        $('#detalleRecontratacion').html(
            data.recontratacion === 'si' ? '<span class="badge badge-success">Sí</span>' :
            data.recontratacion === 'no' ? '<span class="badge badge-danger">No</span>' :
            '<span class="badge badge-warning">Condicional</span>'
        );

        // Observaciones
        $('#detalleObservaciones').text(data.observaciones || 'Sin observaciones');
        $('#detalleDocumentosEntregados').text(data.documentosEntregados || 'Sin documentos listados');

        // Mostrar modal
        $('#modalDetalleDespido').modal('show');
    }

    // Función global para actualizar estado
    window.actualizarEstadoDespido = function(id) {
        // Primero obtener los datos actuales
        $.ajax({
            url: 'ajax/EmpleadoAjax.php?op=obtenerDetalleDespido',
            type: 'POST',
            data: { id: id },
            dataType: 'json',
            success: function(datosActuales) {
                if (!datosActuales) {
                    Toast.fire({
                        icon: 'error',
                        title: 'No se pudieron cargar los datos actuales'
                    });
                    return;
                }

                // Modal mejorado con datos actuales y más opciones
                Swal.fire({
                    title: '<i class="fas fa-edit"></i> Actualizar Estado de Despido',
                    html: `
                        <div style="text-align: left; padding: 20px;">
                            <!-- Información del empleado -->
                            <div class="alert alert-info" style="border-left: 4px solid #17a2b8;">
                                <h6 class="alert-heading">
                                    <i class="fas fa-user mr-2"></i>
                                    <strong>Empleado:</strong> ${datosActuales.empleado}
                                </h6>
                                <p class="mb-0">
                                    <i class="fas fa-briefcase mr-2"></i>
                                    ${datosActuales.cargo} | 
                                    <i class="fas fa-id-card mr-2"></i>
                                    ${datosActuales.documento}
                                </p>
                            </div>

                            <!-- Formulario de actualización -->
                            <form id="formActualizarDespido">
                                <!-- Liquidación -->
                                <div class="card mb-3">
                                    <div class="card-header bg-success text-white">
                                        <i class="fas fa-money-bill-wave mr-2"></i>
                                        <strong>Compensación</strong>
                                    </div>
                                    <div class="card-body">
                                        <div class="form-group">
                                            <label for="nuevoMontoFraude">
                                                <i class="fas fa-dollar-sign mr-1"></i>
                                                Monto de fraude (solo lectura):
                                            </label>
                                            <div class="input-group">
                                                <div class="input-group-prepend">
                                                    <span class="input-group-text bg-danger text-white">
                                                        <i class="fas fa-coins"></i>
                                                    </span>
                                                </div>
                                                <input disabled type="number" id="nuevoMontoFraude" class="form-control" 
                                                       placeholder="0.00" step="0.01" min="0"
                                                       value="${datosActuales.liquidacion || ''}">
                                                <div class="input-group-append">
                                                    <span class="input-group-text bg-danger text-white">$</span>
                                                </div>
                                            </div>
                                            <small class="form-text text-muted">
                                                ${datosActuales.liquidacion ? 
                                                  '<strong>Monto de liquidación:</strong> $' + parseFloat(datosActuales.liquidacion).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : 
                                                  'No hay liquidación registrada'}
                                            </small>
                                        </div>

                                        <div class="form-group">
                                            <label for="nuevoMontoPendiente">
                                                <i class="fas fa-dollar-sign mr-1"></i>
                                                Monto pendiente de recuperación:
                                            </label>
                                            <div class="input-group">
                                                <div class="input-group-prepend">
                                                    <span class="input-group-text bg-warning text-dark">
                                                        <i class="fas fa-coins"></i>
                                                    </span>
                                                </div>
                                                <input type="number" id="nuevoMontoPendiente" class="form-control" 
                                                       placeholder="0.00" step="0.01" min="0"
                                                       value="${datosActuales.montoLiquidacion || ''}">
                                                <div class="input-group-append">
                                                    <span class="input-group-text bg-warning text-dark">$</span>
                                                </div>
                                            </div>
                                            <small class="form-text text-muted">
                                                ${datosActuales.montoLiquidacion ? 
                                                  '<strong>Monto actual pendiente:</strong> $' + parseFloat(datosActuales.montoLiquidacion).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : 
                                                  'No hay monto pendiente'}
                                            </small>
                                        </div>

                                        
                                    </div>
                                </div>

                                <!-- Documentación -->
                                <div class="card mb-3">
                                    <div class="card-header bg-primary text-white">
                                        <i class="fas fa-folder-open mr-2"></i>
                                        <strong>Documentación</strong>
                                    </div>
                                    <div class="card-body">
                                        <div class="form-group">
                                            <label for="nuevoEstadoDocumentos">
                                                <i class="fas fa-file-alt mr-1"></i>
                                                Entrega de Documentos: <span class="text-danger">*</span>
                                            </label>
                                            <select id="nuevoEstadoDocumentos" class="form-control form-control-lg">
                                                <option value="pendiente" ${datosActuales.entregaDocumentos === 'pendiente' ? 'selected' : ''}>
                                                    ⏳ Pendiente
                                                </option>
                                                <option value="parcial" ${datosActuales.entregaDocumentos === 'parcial' ? 'selected' : ''}>
                                                    ⚠️ Parcial
                                                </option>
                                                <option value="completa" ${datosActuales.entregaDocumentos === 'completa' ? 'selected' : ''}>
                                                    ✅ Completa
                                                </option>
                                            </select>
                                            <small class="form-text text-muted">
                                                <strong>Estado actual:</strong> 
                                                ${datosActuales.entregaDocumentos === 'pendiente' ? 'Pendiente' : 
                                                  datosActuales.entregaDocumentos === 'parcial' ? 'Parcial' : 'Completa'}
                                            </small>
                                        </div>

                                        <div class="form-group">
                                            <label for="nuevoActaFirmada">
                                                <i class="fas fa-file-signature mr-1"></i>
                                                Acta de Despido Firmada: <span class="text-danger">*</span>
                                            </label>
                                            <select id="nuevoActaFirmada" class="form-control form-control-lg">
                                                <option value="pendiente" ${datosActuales.actaFirmada === 'pendiente' ? 'selected' : ''}>
                                                    ⏳ Pendiente
                                                </option>
                                                <option value="si" ${datosActuales.actaFirmada === 'si' ? 'selected' : ''}>
                                                    ✅ Sí
                                                </option>
                                                <option value="no" ${datosActuales.actaFirmada === 'no' ? 'selected' : ''}>
                                                    ❌ No
                                                </option>
                                            </select>
                                            <small class="form-text text-muted">
                                                <strong>Estado actual:</strong> 
                                                ${datosActuales.actaFirmada === 'si' ? 'Sí' : 
                                                  datosActuales.actaFirmada === 'no' ? 'No' : 'Pendiente'}
                                            </small>
                                        </div>

                                        <div class="form-group">
                                            <label for="nuevosDocumentosEntregados">
                                                <i class="fas fa-list-check mr-1"></i>
                                                Lista de Documentos Entregados:
                                            </label>
                                            <textarea id="nuevosDocumentosEntregados" class="form-control" rows="3" 
                                                      placeholder="Ejemplo: Carnet, uniformes, llaves, equipos...">${datosActuales.documentosEntregados || ''}</textarea>
                                            <small class="form-text text-muted">
                                                Lista detallada de todos los documentos y elementos entregados
                                            </small>
                                        </div>
                                    </div>
                                </div>

                                <!-- Observaciones -->
                                <div class="card mb-3">
                                    <div class="card-header bg-secondary text-white">
                                        <i class="fas fa-sticky-note mr-2"></i>
                                        <strong>Observaciones de la Actualización</strong>
                                    </div>
                                    <div class="card-body">
                                        <div class="form-group mb-0">
                                            <label for="observacionesActualizacion">
                                                <i class="fas fa-comment-medical mr-1"></i>
                                                Notas sobre esta actualización:
                                            </label>
                                            <textarea id="observacionesActualizacion" class="form-control" rows="3" 
                                                      placeholder="Agregue notas sobre los cambios realizados..."></textarea>
                                            <small class="form-text text-muted">
                                                Estos comentarios se agregarán al historial del despido
                                            </small>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                    `,
                    width: '800px',
                    showCancelButton: true,
                    confirmButtonText: '<i class="fas fa-save mr-2"></i> Guardar Cambios',
                    cancelButtonText: '<i class="fas fa-times mr-2"></i> Cancelar',
                    confirmButtonColor: '#28a745',
                    cancelButtonColor: '#6c757d',
                    customClass: {
                        popup: 'swal-wide-update',
                        confirmButton: 'btn-lg',
                        cancelButton: 'btn-lg'
                    },
                    showClass: {
                        popup: 'animate__animated animate__fadeInDown'
                    },
                    preConfirm: () => {
                        const montoPendiente = document.getElementById('nuevoMontoPendiente').value;
                        const documentos = document.getElementById('nuevoEstadoDocumentos').value;
                        const actaFirmada = document.getElementById('nuevoActaFirmada').value;
                        const documentosEntregados = document.getElementById('nuevosDocumentosEntregados').value;
                        const observaciones = document.getElementById('observacionesActualizacion').value;

                        return {
                            montoPendiente: montoPendiente || '0',
                            documentos: documentos,
                            actaFirmada: actaFirmada,
                            documentosEntregados: documentosEntregados,
                            observaciones: observaciones
                        };
                    }
                }).then((result) => {
                    if (result.isConfirmed) {
                        // Procesar actualización
                        $.ajax({
                            url: 'ajax/EmpleadoAjax.php?op=actualizarEstadoDespido',
                            type: 'POST',
                            data: {
                                id: id,
                                montoPendiente: result.value.montoPendiente,
                                documentos: result.value.documentos,
                                actaFirmada: result.value.actaFirmada,
                                documentosEntregados: result.value.documentosEntregados,
                                observaciones: result.value.observaciones
                            },
                            beforeSend: function() {
                                Swal.fire({
                                    title: '<i class="fas fa-spinner fa-spin"></i> Procesando...',
                                    html: `
                                        <div style="padding: 20px;">
                                            <p style="font-size: 16px; margin-bottom: 15px;">
                                                Actualizando información del despido
                                            </p>
                                            <div class="progress" style="height: 25px;">
                                                <div class="progress-bar progress-bar-striped progress-bar-animated bg-success" 
                                                     role="progressbar" 
                                                     style="width: 100%">
                                                    <strong>Guardando cambios...</strong>
                                                </div>
                                            </div>
                                        </div>
                                    `,
                                    allowOutsideClick: false,
                                    showConfirmButton: false
                                });
                            },
                            success: function(response) {
                                try {
                                    var data = typeof response === 'string' ? JSON.parse(response) : response;
                                    
                                    if (data.status === 'success') {
                                        Swal.fire({
                                            title: '✅ ¡Actualización Exitosa!',
                                            html: `
                                                <div style="padding: 20px; text-align: center;">
                                                    <div style="font-size: 80px; color: #28a745; margin-bottom: 20px;">
                                                        <i class="fas fa-check-circle"></i>
                                                    </div>
                                                    <p style="font-size: 18px; color: #333; margin-bottom: 15px;">
                                                        ${data.mensaje || 'Los cambios han sido guardados correctamente'}
                                                    </p>
                                                    <div style="background-color: #d4edda; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745;">
                                                        <p style="margin: 0; color: #155724;">
                                                            <i class="fas fa-info-circle"></i> 
                                                            La información del despido ha sido actualizada
                                                        </p>
                                                    </div>
                                                </div>
                                            `,
                                            icon: 'success',
                                            confirmButtonText: '<i class="fas fa-check mr-2"></i> Entendido',
                                            confirmButtonColor: '#28a745',
                                            customClass: {
                                                confirmButton: 'btn-lg'
                                            },
                                            showClass: {
                                                popup: 'animate__animated animate__bounceIn'
                                            }
                                        }).then(() => {
                                            cargarDespedidos();
                                            cargarEstadisticas();
                                        });
                                    } else {
                                        Swal.fire({
                                            title: '❌ Error al Actualizar',
                                            html: `
                                                <div style="padding: 20px; text-align: center;">
                                                    <div style="font-size: 80px; color: #dc3545; margin-bottom: 20px;">
                                                        <i class="fas fa-times-circle"></i>
                                                    </div>
                                                    <p style="font-size: 16px; color: #333;">
                                                        ${data.mensaje || 'No se pudo actualizar la información'}
                                                    </p>
                                                </div>
                                            `,
                                            icon: 'error',
                                            confirmButtonText: '<i class="fas fa-redo mr-2"></i> Entendido',
                                            confirmButtonColor: '#dc3545',
                                            customClass: {
                                                confirmButton: 'btn-lg'
                                            }
                                        });
                                    }
                                } catch (e) {
                                    console.error('Error parsing response:', e);
                                    Swal.fire({
                                        icon: 'error',
                                        title: 'Error',
                                        text: 'Error al procesar la respuesta del servidor'
                                    });
                                }
                            },
                            error: function(xhr, status, error) {
                                console.error('AJAX Error:', error);
                                Swal.fire({
                                    icon: 'error',
                                    title: 'Error de Conexión',
                                    text: 'No se pudo comunicar con el servidor: ' + error
                                });
                            }
                        });
                    }
                });
            },
            error: function() {
                Toast.fire({
                    icon: 'error',
                    title: 'Error al cargar los datos del despido'
                });
            }
        });
    };

    // Función global para recontratar empleado
    window.recontratarEmpleado = function(idDespido, idEmpleado, nombreEmpleado) {
        Swal.fire({
            title: '<i class="fas fa-user-check text-success"></i> Recontratar Empleado',
            html: `
                <div style="text-align: left; padding: 20px;">
                    <div class="alert alert-info" style="border-left: 4px solid #17a2b8;">
                        <h5 class="alert-heading">
                            <i class="fas fa-user mr-2"></i>
                            <strong>${nombreEmpleado}</strong>
                        </h5>
                        <p class="mb-0">
                            <i class="fas fa-info-circle mr-2"></i>
                            Este empleado tiene derecho a recontratación
                        </p>
                    </div>

                    <div class="card mb-3">
                        <div class="card-header bg-success text-white">
                            <i class="fas fa-briefcase mr-2"></i>
                            <strong>Información de Recontratación</strong>
                        </div>
                        <div class="card-body">
                            <div class="form-group">
                                <label for="fechaReingreso">
                                    <i class="fas fa-calendar-check mr-1"></i>
                                    Fecha de Reingreso: <span class="text-danger">*</span>
                                </label>
                                <input type="date" id="fechaReingreso" class="form-control form-control-lg" 
                                       value="${new Date().toISOString().split('T')[0]}" required>
                                <small class="form-text text-muted">
                                    Fecha en la que el empleado volverá a trabajar
                                </small>
                            </div>

                            <div class="form-group">
                                <label for="cargoReingreso">
                                    <i class="fas fa-user-tie mr-1"></i>
                                    Cargo: <span class="text-danger">*</span>
                                </label>
                                <input type="text" id="cargoReingreso" class="form-control form-control-lg" 
                                       placeholder="Ej: Vendedor, Cajero, Supervisor..." required>
                                <small class="form-text text-muted">
                                    Cargo que ocupará el empleado al reingresar
                                </small>
                            </div>

                            <div class="form-group mb-0">
                                <label for="observacionesReingreso">
                                    <i class="fas fa-comment-alt mr-1"></i>
                                    Observaciones:
                                </label>
                                <textarea id="observacionesReingreso" class="form-control" rows="3" 
                                          placeholder="Motivo de recontratación, condiciones especiales, etc..."></textarea>
                                <small class="form-text text-muted">
                                    Información adicional sobre la recontratación
                                </small>
                            </div>
                        </div>
                    </div>

                    <div class="alert alert-warning mb-0" role="alert">
                        <i class="fas fa-exclamation-triangle mr-2"></i>
                        <strong>Nota:</strong> El empleado pasará a estado <strong>activo</strong> 
                        y el registro de despido se marcará como <strong>recontratado</strong>.
                    </div>
                </div>
            `,
            width: '700px',
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-check mr-2"></i> Recontratar',
            cancelButtonText: '<i class="fas fa-times mr-2"></i> Cancelar',
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#6c757d',
            customClass: {
                confirmButton: 'btn-lg',
                cancelButton: 'btn-lg'
            },
            preConfirm: () => {
                const fechaReingreso = document.getElementById('fechaReingreso').value;
                const cargoReingreso = document.getElementById('cargoReingreso').value;
                const observaciones = document.getElementById('observacionesReingreso').value;

                if (!fechaReingreso) {
                    Swal.showValidationMessage('Debe seleccionar una fecha de reingreso');
                    return false;
                }

                if (!cargoReingreso || cargoReingreso.trim() === '') {
                    Swal.showValidationMessage('Debe especificar el cargo');
                    return false;
                }

                const hoy = new Date();
                hoy.setHours(0, 0, 0, 0);
                const fechaSeleccionada = new Date(fechaReingreso + 'T00:00:00');
                
                if (fechaSeleccionada < hoy) {
                    Swal.showValidationMessage('La fecha de reingreso no puede ser anterior a hoy');
                    return false;
                }

                return {
                    fechaReingreso: fechaReingreso,
                    cargoReingreso: cargoReingreso.trim(),
                    observaciones: observaciones.trim()
                };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                $.ajax({
                    url: 'ajax/EmpleadoAjax.php?op=recontratarEmpleado',
                    type: 'POST',
                    data: {
                        idDespido: idDespido,
                        idEmpleado: idEmpleado,
                        fechaReingreso: result.value.fechaReingreso,
                        cargo: result.value.cargoReingreso,
                        observaciones: result.value.observaciones
                    },
                    beforeSend: function() {
                        Swal.fire({
                            title: '<i class="fas fa-spinner fa-spin"></i> Procesando...',
                            html: `
                                <div style="padding: 20px;">
                                    <p style="font-size: 16px; margin-bottom: 15px;">
                                        Recontratando empleado
                                    </p>
                                    <div class="progress" style="height: 25px;">
                                        <div class="progress-bar progress-bar-striped progress-bar-animated bg-success" 
                                             role="progressbar" style="width: 100%">
                                            <strong>Actualizando registros...</strong>
                                        </div>
                                    </div>
                                </div>
                            `,
                            allowOutsideClick: false,
                            showConfirmButton: false
                        });
                    },
                    success: function(response) {
                        try {
                            var data = typeof response === 'string' ? JSON.parse(response) : response;
                            
                            if (data.status === 'success') {
                                Swal.fire({
                                    icon: 'success',
                                    title: '¡Recontratación Exitosa!',
                                    html: `
                                        <div style="text-align: left; padding: 20px;">
                                            <p style="font-size: 16px; margin-bottom: 15px;">
                                                <i class="fas fa-check-circle text-success mr-2"></i>
                                                ${data.mensaje}
                                            </p>
                                            <div class="alert alert-success" role="alert">
                                                <i class="fas fa-user-check mr-2"></i>
                                                <strong>${nombreEmpleado}</strong> ha sido recontratado.
                                            </div>
                                            <ul style="list-style: none; padding-left: 0;">
                                                <li><i class="fas fa-calendar mr-2 text-primary"></i> Reingreso: <strong>${result.value.fechaReingreso}</strong></li>
                                                <li><i class="fas fa-briefcase mr-2 text-primary"></i> Cargo: <strong>${result.value.cargoReingreso}</strong></li>
                                                <li><i class="fas fa-check mr-2 text-success"></i> Estado: <strong>Activo</strong></li>
                                            </ul>
                                        </div>
                                    `,
                                    confirmButtonText: 'Entendido',
                                    confirmButtonColor: '#28a745'
                                }).then(() => {
                                    cargarDespedidos();
                                    cargarEstadisticas();
                                });
                            } else {
                                Swal.fire({
                                    icon: 'error',
                                    title: 'Error en la Recontratación',
                                    html: `
                                        <div style="text-align: left; padding: 20px;">
                                            <p>${data.mensaje || 'No se pudo completar la recontratación'}</p>
                                            ${data.detalle ? '<div class="alert alert-danger mt-2"><strong>Detalle:</strong> ' + data.detalle + '</div>' : ''}
                                        </div>
                                    `,
                                    confirmButtonText: 'Cerrar'
                                });
                            }
                        } catch (e) {
                            console.error('Error:', e, response);
                            Swal.fire({
                                icon: 'error',
                                title: 'Error',
                                text: 'Error al procesar la respuesta del servidor'
                            });
                        }
                    },
                    error: function(xhr, status, error) {
                        console.error('AJAX Error:', error);
                        Swal.fire({
                            icon: 'error',
                            title: 'Error de Conexión',
                            text: 'No se pudo comunicar con el servidor: ' + error
                        });
                    }
                });
            }
        });
    };
});
