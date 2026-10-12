package com.backendcreditos.mobile

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.backendcreditos.mobile.data.RouteEntryEntity
import com.backendcreditos.mobile.network.ExpenseCatalogDto
import java.math.BigDecimal
import java.math.RoundingMode

/** What the collector is writing in the «Gastos y bases» form. */
internal data class RouteEntryDraft(
    /** Empty while creating; the id of the row being corrected otherwise. */
    val id: String = "",
    val isBase: Boolean = false,
    val categoryId: Int? = null,
    val name: String = "",
    val amount: String = "",
    val detail: String = "",
    val payrollId: Int? = null
) {
    val editing: Boolean get() = id.isNotBlank()
}

/** Turns a cached row back into a draft so the same form corrects what is already written. */
internal fun routeEntryDraftOf(entry: RouteEntryEntity) = RouteEntryDraft(
    id = entry.id,
    isBase = entry.kind == "base",
    categoryId = entry.accountingType,
    name = if (entry.kind == "base") "" else entry.name,
    amount = entry.amount,
    detail = entry.detail,
    payrollId = entry.payrollId
)

/** Why the row cannot be touched, or null when it can. */
internal fun routeEntryBlocker(entry: RouteEntryEntity): String? = when {
    entry.pending -> "Está en la cola, esperando a enviarse."
    entry.state != null && entry.state != "created" -> "Ya se entregó con las cuentas del día."
    else -> null
}

internal fun validateRoutePayroll(draft: RouteEntryDraft, catalog: ExpenseCatalogDto?) {
    if (draft.isBase) return
    require(draft.categoryId != 2 || draft.payrollId != null) {
        "Seleccione el empleado del gasto de sueldo."
    }
    if (draft.payrollId != null) {
        require(catalog?.payrolls?.any { it.id == draft.payrollId } == true) {
            "No puede registrar sueldo para este empleado. Actualice la lista de gastos."
        }
    }
}

private fun money(raw: String) =
    formatMoney(raw.toBigDecimalOrNull()?.setScale(2, RoundingMode.HALF_UP) ?: BigDecimal.ZERO)

/**
 * «Gastos y bases»: la plata que entró como base y lo que se gastó en la ruta. Se puede
 * escribir sin internet: queda en la cola y se envía cuando haya señal.
 */
@Composable
internal fun RouteEntriesScreen(
    entries: List<RouteEntryEntity>,
    catalog: ExpenseCatalogDto?,
    draft: RouteEntryDraft,
    onDraftChange: (RouteEntryDraft) -> Unit,
    busy: Boolean,
    error: String,
    onSave: () -> Unit,
    onDelete: (RouteEntryEntity) -> Unit,
    onRefresh: () -> Unit,
    onBack: () -> Unit
) {
    Text("Gastos y bases", style = MaterialTheme.typography.headlineSmall)
    val bases = entries.filter { it.kind == "base" }
    val expenses = entries.filter { it.kind != "base" }
    val baseTotal = bases.sumOf { it.amount.toBigDecimalOrNull() ?: BigDecimal.ZERO }
    val expenseTotal = expenses.sumOf { it.amount.toBigDecimalOrNull() ?: BigDecimal.ZERO }

    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text("Bases: ${formatMoney(baseTotal)}", fontWeight = FontWeight.Bold)
        Text("Gastos: ${formatMoney(expenseTotal)}", fontWeight = FontWeight.Bold)
    }

    Text(
        if (draft.editing) "Corregir lo escrito" else "Anotar algo nuevo",
        style = MaterialTheme.typography.titleMedium
    )
    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        FilterChip(
            selected = !draft.isBase,
            onClick = { if (!draft.editing) onDraftChange(draft.copy(isBase = false)) },
            label = { Text("Gasto") }
        )
        FilterChip(
            selected = draft.isBase,
            onClick = { if (!draft.editing) onDraftChange(draft.copy(isBase = true, categoryId = null, name = "", payrollId = null)) },
            label = { Text("Base recibida") }
        )
    }

    if (!draft.isBase) {
        if (catalog == null) Text(
            "Todavía no se ha descargado la lista de gastos. Conéctate una vez para tenerla.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.error
        ) else {
            Text("¿De qué es el gasto?", style = MaterialTheme.typography.labelLarge)
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                catalog.categories.forEach { category ->
                    FilterChip(
                        selected = draft.categoryId == category.id,
                        onClick = { onDraftChange(draft.copy(categoryId = category.id, name = "", payrollId = null)) },
                        label = { Text(category.category) }
                    )
                }
            }
            val names = catalog.categories.firstOrNull { it.id == draft.categoryId }?.names.orEmpty()
            if (names.isNotEmpty()) {
                Text("Concepto", style = MaterialTheme.typography.labelLarge)
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    names.forEach { name ->
                        FilterChip(
                            selected = draft.name == name,
                            onClick = { onDraftChange(draft.copy(name = name)) },
                            label = { Text(name) }
                        )
                    }
                }
            }
            if (draft.categoryId == 2 || catalog.payrolls.isNotEmpty()) {
                Text(
                    if (draft.categoryId == 2) "Empleado del gasto de sueldo"
                    else "¿Es para una nómina? (opcional)",
                    style = MaterialTheme.typography.labelLarge
                )
                if (draft.categoryId == 2 && catalog.payrolls.isEmpty()) {
                    Text(
                        "No hay una nómina disponible para tu usuario. Verifica el despacho y actualiza.",
                        color = MaterialTheme.colorScheme.error
                    )
                }
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (draft.categoryId != 2) FilterChip(
                        selected = draft.payrollId == null,
                        onClick = { onDraftChange(draft.copy(payrollId = null)) },
                        label = { Text("No") }
                    )
                    catalog.payrolls.forEach { payroll ->
                        FilterChip(
                            selected = draft.payrollId == payroll.id,
                            onClick = { onDraftChange(draft.copy(payrollId = payroll.id)) },
                            label = { Text(payroll.name) }
                        )
                    }
                }
            }
        }
    }

    OutlinedTextField(
        draft.amount, { onDraftChange(draft.copy(amount = it)) },
        label = { Text(if (draft.isBase) "Valor de la base" else "Valor del gasto") },
        modifier = Modifier.fillMaxWidth(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
    )
    OutlinedTextField(
        draft.detail, { onDraftChange(draft.copy(detail = it.take(250))) },
        label = { Text("Detalle (opcional)") },
        modifier = Modifier.fillMaxWidth()
    )
    if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(onClick = onSave, enabled = !busy) {
            Text(if (draft.editing) "Guardar cambio" else "Anotar")
        }
        if (draft.editing) TextButton(onClick = { onDraftChange(RouteEntryDraft()) }) { Text("Cancelar") }
        TextButton(onClick = onRefresh, enabled = !busy) { Text("Actualizar") }
        TextButton(onClick = onBack) { Text("Volver") }
    }

    HorizontalDivider(Modifier.padding(vertical = 4.dp))
    Text("Anotado hoy (${entries.size})", style = MaterialTheme.typography.titleMedium)
    if (entries.isEmpty()) Text("Todavía no hay bases ni gastos anotados hoy.")
    entries.forEach { entry ->
        Column(Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(
                    if (entry.kind == "base") "Base recibida" else entry.name,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.weight(1f)
                )
                Text(money(entry.amount), style = MaterialTheme.typography.bodyMedium)
            }
            val notes = listOfNotNull(
                entry.detail.takeIf(String::isNotBlank),
                entry.personName?.takeIf(String::isNotBlank),
                if (entry.pending) "Falta enviar" else null
            )
            if (notes.isNotEmpty()) Text(
                notes.joinToString(" · "),
                style = MaterialTheme.typography.labelSmall,
                color = if (entry.pending) MaterialTheme.colorScheme.error
                else MaterialTheme.colorScheme.onSurfaceVariant
            )
            val blocker = routeEntryBlocker(entry)
            if (blocker != null) Text(
                blocker,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            ) else Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = { onDraftChange(routeEntryDraftOf(entry)) }, enabled = !busy) {
                    Text("Corregir")
                }
                TextButton(onClick = { onDelete(entry) }, enabled = !busy) { Text("Borrar") }
            }
        }
    }
}
