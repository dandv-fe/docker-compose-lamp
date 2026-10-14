package com.backendcreditos.mobile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.backendcreditos.mobile.network.PayrollPeriodDto
import com.backendcreditos.mobile.network.PayrollRouteDto
import com.backendcreditos.mobile.network.PayrollMovementDto
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private fun payrollMoney(value: Double): String = payrollDetailNumber(value)

private fun payrollLastRead(state: PayrollState): String? = state.readAt?.let {
    "Última consulta: " + DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")
        .withZone(ZoneId.of("America/Bogota")).format(Instant.ofEpochMilli(it)) + " (Colombia)"
}

@Composable
internal fun PayrollSummaryCard(
    state: PayrollState?, online: Boolean, onRefresh: () -> Unit, onDetails: () -> Unit
) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Mi sueldo", style = MaterialTheme.typography.titleMedium)
            val summary = state?.snapshot
            when {
                summary != null -> {
                    val configured = summary.periods.any { it.configured }
                    if (!configured) Text("Sin plan de sueldo configurado. La oficina lo gestiona en la web.")
                    else Text(summary.periods.joinToString(" · ") { "${it.type} / ${it.frequency}" })
                    val totals = summary.totals
                    Text("Devengado: ${payrollMoney(totals.earnedAmount)} · Pagado: ${payrollMoney(totals.paidAmount)} · Pendiente: ${payrollMoney(totals.pendingAmount)}")
                    if (summary.routes.any { it.provisional }) Text("Provisional: incluye despachos abiertos.")
                    payrollLastRead(state)?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                    if (!online || state.error.isNotBlank()) Text("Última lectura; no confirma el estado actual.")
                }
                state?.loading == true -> Text("Consultando tu sueldo…")
                !online -> Text("Consulta en línea; no hay un sueldo descargado en esta sesión.")
                state?.error.isNullOrBlank() -> Text("Tu sueldo se consulta en línea, solo para tu usuario.")
            }
            state?.error?.takeIf { it.isNotBlank() }?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onRefresh, enabled = online && state?.loading != true) {
                    Text(if (state?.loading == true) "Consultando…" else "Actualizar sueldo")
                }
                TextButton(onClick = onDetails, enabled = summary != null) { Text("Ver detalle") }
            }
        }
    }
}

@Composable
private fun PayrollPeriodDetails(period: PayrollPeriodDto) {
    Text("${period.startDate} al ${period.endDate}", style = MaterialTheme.typography.titleMedium)
    if (period.configured) {
        Text("${period.type} · ${period.frequency}")
    } else Text("Sin plan configurado; no se inventa sueldo básico ni comisiones.")
    payrollPeriodAmountLines(period).forEach { Text(it) }
}

@Composable
private fun PayrollRouteDetails(route: PayrollRouteDto, movements: List<PayrollMovementDto>) {
    var expanded by remember(route.partKey()) { mutableStateOf(false) }
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            payrollRouteLines(route).forEach { Text(it) }
            TextButton(onClick = { expanded = !expanded }) {
                Text(if (expanded) "Ocultar movimientos" else "Ver movimientos (${movements.size})")
            }
            if (expanded) {
                if (movements.isEmpty()) Text("Sin movimientos de esta ruta en el período hasta el corte.")
                movements.forEach { movement ->
                    Column(Modifier.padding(vertical = 6.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        payrollMovementLines(movement).forEach { Text(it) }
                    }
                }
            }
        }
    }
}

@Composable
internal fun PayrollDetailsDialog(
    state: PayrollState, online: Boolean, onRefresh: () -> Unit, onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Mi sueldo · detalle") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Consulta exclusiva de tu usuario. Contratos, vacaciones y repartos se gestionan solo en la web. Los gestores autorizados registran bonos como gastos desde la caja de la cartera.")
                payrollLastRead(state)?.let { Text(it) }
                if (!online || state.error.isNotBlank()) Text("Última lectura; requiere conexión para actualizar.")
                if (state.error.isNotBlank()) Text(state.error, color = MaterialTheme.colorScheme.error)
                state.snapshot?.let { summary ->
                    Text("Corte: ${summary.asOf} · calendario de Colombia")
                    Text("Cálculo al ${summary.asOf}; no es una liquidación laboral legal.")
                    if (summary.routes.any { it.provisional }) {
                        Text("Provisional: incluye despachos abiertos; movimientos y comisiones pueden cambiar.")
                    }
                    summary.periods.forEach { PayrollPeriodDetails(it) }
                    Text("El sueldo básico se acumula por días transcurridos, incluido hoy; el sueldo básico pactado del período completo no es pendiente devengado.")
                    Text("Combinado: el mayor entre sueldo básico acumulado y suma de las dos comisiones, más bonos.")
                    Text("Vacaciones: conservan el sueldo básico; no generan nuevas comisiones.")
                    Text("Rutas y reparto del período", style = MaterialTheme.typography.titleMedium)
                    Text("Solo tus snapshots. No hay límite de rutas; el reparto Titular / Igual / Personalizado se conserva como estaba al abrir el despacho.")
                    Text("Las comisiones acumuladas de cada ruta vienen del servidor. El total global no se reconstruye sumando rutas o filas redondeadas: puede haber diferencias de centavos. Reversos pueden aparecer con signo negativo.")
                    if (summary.routes.isEmpty()) Text("No hay rutas con snapshot propio para este período.")
                    val movementsByRoute = remember(summary.breakdown) { summary.breakdown.groupBy { it.partKey() } }
                    summary.routes.forEach { route ->
                        PayrollRouteDetails(route, movementsByRoute[route.partKey()].orEmpty())
                    }
                    Text("Contratos", style = MaterialTheme.typography.titleMedium)
                    if (summary.contracts.isEmpty()) Text("No hay contratos de sueldo.")
                    summary.contracts.forEach {
                        Text("${it.effectiveDate} · ${it.type} · ${it.frequency}\nSueldo básico pactado: ${payrollMoney(it.baseAmount)} · capital ${it.capitalRate}% · recaudo ${it.collectionRate}%")
                    }
                    Text("Vacaciones", style = MaterialTheme.typography.titleMedium)
                    if (summary.vacations.isEmpty()) Text("No hay vacaciones registradas.")
                    summary.vacations.forEach {
                        Text("${it.startDate} al ${it.endDate} · ${it.reason}")
                        it.replacementName?.let { name -> Text("Relevo: $name") }
                    }
                    Text("Bonos manuales", style = MaterialTheme.typography.titleMedium)
                    if (summary.bonuses.isEmpty()) Text("No hay bonos registrados.")
                    summary.bonuses.forEach {
                        Text("${it.date} · ${payrollMoney(it.amount)} · ${it.reason}")
                        it.expenseId?.let { id -> Text("Gasto de caja: #$id") }
                        if (it.cancelledAt != null) Text("Bono anulado · ${it.cancelledAt}")
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onRefresh, enabled = online && !state.loading) {
                Text(if (state.loading) "Consultando…" else "Actualizar")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cerrar") } }
    )
}
