package com.backendcreditos.mobile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.backendcreditos.mobile.network.RouteMovementDto
import com.backendcreditos.mobile.network.RouteSettlementDto
import java.math.BigDecimal
import java.math.RoundingMode

/** What the collector typed while counting the cash in their pocket. */
internal data class CashCount(
    val base: String = "",
    val cash: String = "",
    val coins: String = "",
    val confirmed: Boolean = false
) {
    fun amount(raw: String): BigDecimal =
        raw.replace(',', '.').trim().toBigDecimalOrNull()?.setScale(2, RoundingMode.HALF_UP) ?: BigDecimal.ZERO

    val counted: BigDecimal get() = amount(cash) + amount(coins)
}

/**
 * The cash the route should hold once the base the collector typed replaces the stored one.
 * Money that arrived or left through a bank is already discounted by the server.
 */
internal fun expectedCash(summary: RouteSettlementDto, count: CashCount): BigDecimal =
    summary.expectedCash.toBigDecimal().setScale(2, RoundingMode.HALF_UP) -
        summary.base.toBigDecimal().setScale(2, RoundingMode.HALF_UP) + count.amount(count.base)

/** Positive = the collector has more cash than the movements explain; negative = it is missing. */
internal fun cashDifference(summary: RouteSettlementDto, count: CashCount): BigDecimal =
    count.counted - expectedCash(summary, count)

/** A reason the accounts cannot be handed in yet, or null when everything is ready. */
internal fun settlementBlocker(
    summary: RouteSettlementDto?, online: Boolean, queuePending: Int
): String? = when {
    !online -> "Las cuentas solo se pueden entregar con conexión a internet."
    queuePending > 0 -> "Hay $queuePending movimiento(s) sin confirmar en la cola. Espera o arréglalos antes de entregar."
    summary == null -> "Todavía no se han cargado las cuentas."
    summary.routeId == null -> "No hay una ruta abierta para entregar."
    summary.state != "created" -> "Estas cuentas ya fueron entregadas."
    !summary.canSettle -> "No tienes permiso para entregar las cuentas de esta ruta."
    else -> null
}

private fun money(value: Double) = formatMoney(BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP))

@Composable
private fun TotalLine(label: String, value: String, strong: Boolean = false) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyMedium)
        Text(
            value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (strong) FontWeight.Bold else FontWeight.Normal
        )
    }
}

@Composable
private fun MovementRow(movement: RouteMovementDto) {
    Column(Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(
                movement.title,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.weight(1f)
            )
            Text(
                (if (movement.amount >= 0) "+" else "−") + money(kotlin.math.abs(movement.amount)),
                style = MaterialTheme.typography.bodyMedium,
                color = if (movement.amount >= 0) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.error
            )
        }
        val notes = listOfNotNull(
            movement.detail?.takeIf(String::isNotBlank),
            movement.bankAmount.takeIf { it > 0.0 }?.let { "Por banco ${money(it)}" },
            movement.createdAt?.let(::formatPaymentMoment)
        )
        if (notes.isNotEmpty()) Text(
            notes.joinToString(" · "),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

/**
 * «Cuentas del día»: everything the collector did, the cash that should be in their pocket and
 * the count they hand in. Sending turns the day into 'entregando', exactly like the web does.
 */
@Composable
internal fun SettlementScreen(
    summary: RouteSettlementDto?,
    count: CashCount,
    onCountChange: (CashCount) -> Unit,
    blocker: String?,
    busy: Boolean,
    error: String,
    onRefresh: () -> Unit,
    onSettle: () -> Unit,
    onBack: () -> Unit
) {
    Text("Cuentas del día", style = MaterialTheme.typography.headlineSmall)
    if (summary == null) {
        Text(blocker ?: "Cargando…")
        TextButton(onClick = onRefresh, enabled = !busy) { Text("Cargar cuentas") }
        TextButton(onClick = onBack) { Text("Volver a cartera") }
        return
    }
    val difference = cashDifference(summary, count)
    val squared = difference.compareTo(BigDecimal.ZERO) == 0
    val counting = summary.movements.filter { it.countsForCash }
    val informative = summary.movements.filterNot { it.countsForCash }

    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        TotalLine("Base con la que salió", money(summary.base))
        TotalLine("Recaudo del día", money(summary.collected))
        if (summary.collectedBank != 0.0) TotalLine("− Le consignaron al banco", money(summary.collectedBank))
        if (summary.otherCollected != 0.0) TotalLine("Cobros adicionales", money(summary.otherCollected))
        TotalLine("− Créditos entregados", money(summary.credits))
        if (summary.creditsBank != 0.0) TotalLine("+ Créditos pagados desde el banco", money(summary.creditsBank))
        if (summary.expenses != 0.0) TotalLine("− Gastos de la ruta", money(summary.expenses))
        HorizontalDivider(Modifier.padding(vertical = 4.dp))
        TotalLine("Debe tener en efectivo", money(summary.expectedCash), strong = true)
    }

    Text("Cuente el efectivo", style = MaterialTheme.typography.titleMedium)
    OutlinedTextField(
        count.base, { onCountChange(count.copy(base = it, confirmed = false)) },
        label = { Text("Base") }, modifier = Modifier.fillMaxWidth(),
        supportingText = { Text("La base con la que arrancó el día.") },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
    )
    OutlinedTextField(
        count.cash, { onCountChange(count.copy(cash = it, confirmed = false)) },
        label = { Text("Billetes") }, modifier = Modifier.fillMaxWidth(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
    )
    OutlinedTextField(
        count.coins, { onCountChange(count.copy(coins = it, confirmed = false)) },
        label = { Text("Monedas") }, modifier = Modifier.fillMaxWidth(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
    )
    TotalLine("Contó", formatMoney(count.counted), strong = true)
    Text(
        when {
            squared -> "Cuadrado: el efectivo coincide con los movimientos."
            difference.signum() > 0 -> "Le sobran ${formatMoney(difference)}."
            else -> "Le faltan ${formatMoney(difference.negate())}."
        },
        color = if (squared) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error,
        fontWeight = FontWeight.Bold
    )
    if (!squared) Row(verticalAlignment = Alignment.CenterVertically) {
        Checkbox(count.confirmed, { onCountChange(count.copy(confirmed = it)) })
        Text(
            "Revisé los movimientos y entrego así; la diferencia queda registrada.",
            style = MaterialTheme.typography.bodySmall
        )
    }

    if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
    if (blocker != null) Text(blocker, color = MaterialTheme.colorScheme.error)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(
            enabled = !busy && blocker == null && (squared || count.confirmed),
            onClick = onSettle
        ) { Text("Entregar cuentas") }
        TextButton(onClick = onRefresh, enabled = !busy) { Text("Volver a totalizar") }
        TextButton(onClick = onBack) { Text("Corregir en cartera") }
    }

    Text("Lo que hizo hoy (${counting.size})", style = MaterialTheme.typography.titleMedium)
    if (counting.isEmpty()) Text("Todavía no hay movimientos en esta ruta.")
    counting.forEach { MovementRow(it) }
    if (informative.isNotEmpty()) {
        HorizontalDivider()
        Text("No entra en el cuadre (${informative.size})", style = MaterialTheme.typography.titleMedium)
        informative.forEach { MovementRow(it) }
    }
}
