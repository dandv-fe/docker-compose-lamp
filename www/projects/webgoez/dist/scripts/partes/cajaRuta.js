function mostrarCajaBolsillo(respuesta) {
    const formato = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
    const pesos = valor => '$' + formato.format(Number(valor));
    const lista = $("#cajaBolsilloMovimientos").empty();
    const totales = respuesta?.totales;
    if (!totales) {
        $("#cajaBolsilloTotal").text("Sin ruta abierta");
        $("#cajaBolsilloFormula").text("No hay movimientos de una ruta abierta.");
        $("#cajaBolsilloOtros").empty();
        return;
    }
    $("#cajaBolsilloTotal").text(pesos(totales.efectivo));
    $("#cajaBolsilloFormula").text(
        `Base ${pesos(totales.base)} + recaudo ${pesos(totales.recaudo)}` +
        ` + otro recaudo ${pesos(totales.otro)} − banco ${pesos(totales.recaudoBanco)}` +
        ` − gastos ${pesos(totales.gastos)} − créditos en efectivo ${pesos(totales.creditos - totales.creditosBanco)}`
    );
    const otros = $("#cajaBolsilloOtros").empty();
    (respuesta.otrosAutores || []).forEach(function (autor) {
        const mensaje = autor.efectivo > 0
            ? "Si recibió este efectivo y no te lo entrega, te faltará al cuadrar."
            : "Revisa con esta persona los movimientos de la ruta.";
        otros.append($("<div>").addClass("text-warning").text(
            `${autor.nombre}: ${pesos(autor.efectivo)} de movimientos. ${mensaje}`
        ));
    });
    if (!respuesta.movimientos.length) {
        lista.append($("<p>").addClass("small").text("Todavía no hay movimientos en esta ruta."));
        return;
    }
    const grupos = new Map();
    respuesta.movimientos.forEach(function (movimiento) {
        const grupo = movimiento.tipo === 'Abono' ? 'Recaudo'
            : movimiento.tipo === 'Crédito' ? 'Créditos' : movimiento.tipo === 'Base' ? 'Bases'
                : movimiento.tipo === 'Gasto' ? 'Gastos' : movimiento.tipo === 'Otro recaudo' ? 'Otros ingresos' : 'Informativos';
        if (!grupos.has(grupo)) grupos.set(grupo, []);
        grupos.get(grupo).push(movimiento);
    });
    grupos.forEach(function (movimientos, titulo) {
        const grupo = $("<div>").addClass("mt-2");
        grupo.append($("<h6>").addClass("mb-1 border-bottom").text(titulo));
        const autores = new Map();
        movimientos.forEach(function (movimiento) {
            const clave = movimiento.autorPersona || `sin-autor-${movimiento.autor}`;
            if (!autores.has(clave)) autores.set(clave, { nombre: movimiento.autor, movimientos: [] });
            autores.get(clave).movimientos.push(movimiento);
        });
        autores.forEach(function (autor) {
            grupo.append($("<div>").addClass("small font-weight-bold mt-1").text(`Registró: ${autor.nombre}`));
            const filas = $("<ul>").addClass("list-group list-group-flush");
            autor.movimientos.forEach(function (movimiento) {
                const fila = $("<li>").addClass("list-group-item py-1 px-2");
                if (!movimiento.cuenta) fila.addClass("text-muted");
                const principal = $("<div>").addClass("d-flex justify-content-between");
                principal.append($("<span>").text(movimiento.nombre));
                principal.append($("<strong>").addClass("ml-2 text-nowrap").text(
                    movimiento.cuenta ? `${movimiento.efectivo >= 0 ? '+' : '−'}${pesos(Math.abs(movimiento.efectivo))}` : "No cuenta"
                ));
                fila.append(principal);
                const pagos = movimiento.pagosBanco || [];
                const efectivo = movimiento.tipo === 'Crédito'
                    ? Number(movimiento.desembolso) - Number(movimiento.banco)
                    : Number(movimiento.valor) - Number(movimiento.banco);
                const formas = [];
                if ((movimiento.tipo === 'Abono' || movimiento.tipo === 'Crédito') && Math.abs(efectivo) > 0.005)
                    formas.push(`${efectivo < 0 ? 'Vuelto en efectivo' : 'Efectivo'}: ${pesos(Math.abs(efectivo))}`);
                pagos.forEach(pago => formas.push(
                    `${movimiento.tipo === 'Crédito' ? 'Consignación desde' : 'Banco en'} ${pago.cuenta}: ${pesos(pago.valor)}`
                ));
                if (Number(movimiento.banco) !== 0 && !pagos.length)
                    formas.push(`Banco: ${pesos(movimiento.banco)} (cuenta no disponible)`);
                fila.append($("<small>").addClass("text-muted").text(
                    [movimiento.fecha, ...formas, movimiento.detalle].filter(Boolean).join(" · ")
                ));
                filas.append(fila);
            });
            grupo.append(filas);
        });
        lista.append(grupo);
    });
}
