package com.backendcreditos.mobile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.backendcreditos.mobile.network.CashBonusContext

@Composable
internal fun CashBonusDialog(
    context: CashBonusContext, draft: CashBonusDraft, saving: Boolean, uncertain: Boolean,
    online: Boolean, error: String, onDraft: (CashBonusDraft) -> Unit, onSave: () -> Unit, onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = { if (!saving) onDismiss() },
        title = { Text("Bono desde caja · ruta #${context.routeId}") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Al confirmar se registra el bono y su gasto real en la cartera seleccionada. Solo gestores autorizados; no se envía a la Cola.")
                context.employees.forEach { employee ->
                    FilterChip(selected = draft.employeeId == employee.employeeId,
                        enabled = !saving && !uncertain,
                        onClick = { onDraft(draft.copy(employeeId = employee.employeeId)) },
                        label = { Text(employee.name) })
                }
                OutlinedTextField(draft.amount, { onDraft(draft.copy(amount = it)) },
                    enabled = !saving && !uncertain, label = { Text("Monto del bono") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth())
                OutlinedTextField(draft.reason, { onDraft(draft.copy(reason = it)) },
                    enabled = !saving && !uncertain, label = { Text("Motivo obligatorio (máximo 250 caracteres)") },
                    modifier = Modifier.fillMaxWidth())
                cashBonusInputError(draft, context)?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                if (uncertain) Text("No se pudo confirmar el guardado. El reintento conserva exactamente el mismo bono y token para no duplicar el gasto. No crees otro bono; revisa caja y sueldo.")
                if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
                if (!online) Text("Requiere conexión. El borrador no queda en cola.")
            }
        },
        confirmButton = { TextButton(onClick = onSave,
            enabled = online && !saving && cashBonusInputError(draft, context) == null) {
            Text(if (saving) "Guardando…" else if (uncertain) "Reintentar mismo bono" else "Confirmar bono y gasto")
        } },
        dismissButton = { TextButton(onClick = onDismiss, enabled = !saving) { Text("Cerrar") } }
    )
}
