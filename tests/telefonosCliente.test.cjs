const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')

const script = fs.readFileSync(path.join(__dirname, '../dist/scripts/Cartera.js'), 'utf8')
const modal = fs.readFileSync(path.join(__dirname, '../views/partials/modalTelefonosCliente.html'), 'utf8')

function preparar() {
    const estados = new Map()
    const solicitudes = []
    const elementos = []
    const $ = selector => {
        if (typeof selector === 'string' && selector.startsWith('<')) {
            const elemento = {
                valor: '',
                text(valor) { this.valor = valor; return this },
                addClass() { return this },
                attr() { return this },
                on(evento, fn) { this.click = fn; return this },
                appendTo(destino) {
                    if (typeof destino === 'string') {
                        if (!estados.has(destino)) estados.set(destino, { texto: '', filas: [] })
                        estados.get(destino).filas.push(this.valor)
                    } else destino.valor += this.valor + ' '
                    return this
                }
            }
            elementos.push(elemento)
            return elemento
        }
        if (!estados.has(selector)) estados.set(selector, { texto: '', filas: [] })
        const estado = estados.get(selector)
        return {
            text(valor) { estado.texto = valor; return this },
            empty() { estado.filas = []; return this },
            hasClass(nombre) { return nombre === 'show' && estado.modal === 'show' },
            off() { estado.hidden = null; return this },
            one(evento, fn) { estado.hidden = fn; return this },
            modal(valor) { estado.modal = valor; return this }
        }
    }
    const solicitar = (url, datos) => {
        const solicitud = {
            url, datos,
            done(fn) { this.exito = fn; return this },
            fail(fn) { this.error = fn; return this },
            always(fn) { this.final = fn; return this },
            abort() { this.abortada = true }
        }
        solicitudes.push(solicitud)
        return solicitud
    }
    $.getJSON = solicitar
    $.ajax = options => solicitar(options.url, options.data)
    let index = '0'
    const contexto = {
        document: {}, jQuery: () => ({ ready() {} }), $, confirm: () => true,
        sessionStorage: { getItem() { return index } }
    }
    vm.runInNewContext(script, contexto)
    vm.runInNewContext("ArrayTarjetas = [{refTarjeta:'A',refSucursal:7},{refTarjeta:'B',refSucursal:8}]", contexto)
    return { contexto, estados, solicitudes, elementos, seleccionar(valor) { index = valor } }
}

test('reads the clicked portfolio card, displays literal text and has no history actions', () => {
    const { contexto, estados, solicitudes } = preparar()
    contexto.mostrarTelefonosCliente()
    assert.equal(estados.get('#estado-telefonos-cliente').texto, 'Cargando teléfonos…')
    assert.equal(solicitudes[0].datos.idtarjeta, 'A')
    assert.equal(solicitudes[0].datos.idsucursal, 7)
    solicitudes[0].exito({ telefonos: ['3000000001', '<b>legacy</b>'] })
    assert.deepEqual(estados.get('#lista-telefonos-cliente').filas, ['3000000001', '<b>legacy</b>'])
    assert.equal(estados.get('#estado-telefonos-cliente').texto, '')
    assert.doesNotMatch(modal, /<(?:input|select|form)\b/i)
    const soloLectura = modal.split('<div class="modal fade" id="modal-gestion-telefonos-cliente"')[0]
    assert.equal((soloLectura.match(/<button\b/g) || []).length, 3)
    assert.match(soloLectura, /Gestionar teléfonos/)
    assert.doesNotMatch(soloLectura, /Marcar incorrecto|Restaurar|Seleccionar principal/)
    assert.match(script, /\.off\('\.telefonosCliente'\)/)
})

test('separate management guards primary, confirms restore and sends CSRF, never uses HTML', () => {
    const { contexto, estados, solicitudes } = preparar()
    contexto.mostrarGestionTelefonosCliente()
    const incorrecto = { phone: '<b>3000000002</b>', normalizedPhone: '573000000002', invalid: true, primary: false }
    solicitudes[0].exito({ csrf: 'session-token', telefonos: [incorrecto] })
    assert.match(estados.get('#lista-gestion-telefonos-cliente').filas[0], /<b>3000000002<\/b> · INCORRECTO/)
    contexto.mutarGestionTelefonoCliente({ ...incorrecto, invalid: false, primary: true }, 'incorrecto')
    assert.match(estados.get('#estado-gestion-telefonos-cliente').texto, /Selecciona primero otro teléfono principal/)
    assert.equal(solicitudes.length, 1)
    contexto.confirm = () => false
    contexto.mutarGestionTelefonoCliente(incorrecto, 'restaurar')
    assert.equal(solicitudes.length, 1)
    contexto.confirm = () => true
    contexto.mutarGestionTelefonoCliente(incorrecto, 'restaurar')
    assert.equal(solicitudes[1].datos.csrf, 'session-token')
    assert.equal(solicitudes[1].datos.accion, 'restaurar')
    assert.equal(solicitudes[1].datos.telefono, '573000000002')
    assert.equal(solicitudes[1].datos.idtarjeta, 'A')
    solicitudes[1].exito({ csrf: 'session-token', telefonos: [{ ...incorrecto, invalid: false }] })
    solicitudes[1].final()
    assert.doesNotMatch(estados.get('#lista-gestion-telefonos-cliente').filas[0], /INCORRECTO/)
    assert.doesNotMatch(script, /\.html\([^)]*telefono/)
})

test('management is a sibling modal and opens only after the history transition ends', () => {
    const { contexto, estados } = preparar()
    const beforeManagement = modal.split('<div class="modal fade" id="modal-gestion-telefonos-cliente"')[0]
    assert.equal((beforeManagement.match(/<div\b/g) || []).length,
        (beforeManagement.match(/<\/div>/g) || []).length)
    contexto.mostrarTelefonosCliente()
    contexto.mostrarGestionTelefonosCliente()
    const consulta = estados.get('#modal-telefonos-cliente')
    assert.equal(consulta.modal, 'hide')
    assert.notEqual(estados.get('#modal-gestion-telefonos-cliente')?.modal, 'show')
    consulta.hidden()
    assert.equal(estados.get('#modal-gestion-telefonos-cliente').modal, 'show')
})

test('stale management reads and mutations cannot overwrite another card or closed modal', () => {
    const { contexto, estados, solicitudes, seleccionar } = preparar()
    contexto.mostrarGestionTelefonosCliente()
    seleccionar('1')
    solicitudes[0].exito({ csrf: 'old', telefonos: [{ phone: 'OLD', invalid: true }] })
    assert.deepEqual(estados.get('#lista-gestion-telefonos-cliente').filas, [])
    contexto.mostrarGestionTelefonosCliente()
    const telefono = { phone: 'NEW', normalizedPhone: '573000000002', invalid: true }
    solicitudes[1].exito({ csrf: 'new', telefonos: [telefono] })
    contexto.mutarGestionTelefonoCliente(telefono, 'restaurar')
    contexto.cerrarGestionTelefonosCliente()
    solicitudes[2].exito({ csrf: 'new', telefonos: [telefono] })
    solicitudes[2].error({ responseJSON: { error: 'LATE ERROR' } }, 'error')
    solicitudes[2].final()
    assert.deepEqual(estados.get('#lista-gestion-telefonos-cliente').filas, [])
})

test('late results cannot overwrite another card, a reopened modal or a closed modal', () => {
    const { contexto, estados, solicitudes, seleccionar } = preparar()
    contexto.mostrarTelefonosCliente()
    seleccionar('1')
    solicitudes[0].exito({ telefonos: ['OLD'] })
    assert.deepEqual(estados.get('#lista-telefonos-cliente').filas, [])
    contexto.mostrarTelefonosCliente()
    assert.equal(solicitudes[0].abortada, true)
    solicitudes[1].exito({ telefonos: ['NEW'] })
    solicitudes[0].exito({ telefonos: ['OLD'] })
    solicitudes[0].error({ responseJSON: { error: 'OLD ERROR' } }, 'error')
    assert.deepEqual(estados.get('#lista-telefonos-cliente').filas, ['NEW'])
    assert.equal(estados.get('#estado-telefonos-cliente').texto, '')
    contexto.cerrarTelefonosCliente()
    solicitudes[1].exito({ telefonos: ['LATE'] })
    assert.deepEqual(estados.get('#lista-telefonos-cliente').filas, [])
})

test('empty, missing selection, malformed response and actionable errors are explicit', () => {
    const { contexto, estados, solicitudes, seleccionar } = preparar()
    contexto.mostrarTelefonosCliente()
    solicitudes[0].exito({ telefonos: [] })
    assert.equal(estados.get('#estado-telefonos-cliente').texto, 'Sin teléfonos registrados.')
    contexto.mostrarTelefonosCliente()
    solicitudes[1].exito({})
    assert.match(estados.get('#estado-telefonos-cliente').texto, /Respuesta inválida/)
    contexto.mostrarTelefonosCliente()
    solicitudes[2].error({ responseJSON: { error: 'Aplica la migración 007.' } }, 'error')
    assert.equal(estados.get('#estado-telefonos-cliente').texto, 'Aplica la migración 007.')
    contexto.mostrarTelefonosCliente()
    solicitudes[3].error({}, 'error')
    assert.match(estados.get('#estado-telefonos-cliente').texto, /No se pudieron cargar/)
    seleccionar('9')
    contexto.mostrarTelefonosCliente()
    assert.equal(estados.get('#estado-telefonos-cliente').texto, 'Selecciona un cliente en la cartera.')
    assert.equal(solicitudes.length, 4)
})
