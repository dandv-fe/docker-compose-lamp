package com.backendcreditos.mobile

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.backendcreditos.mobile.data.BankAccountEntity
import com.backendcreditos.mobile.data.BankSplit
import com.backendcreditos.mobile.data.OperationPayloadMapper

/** "Ahorros 123 · Titular: Ana Ruiz · NIT/CC 900123" — what the customer needs to transfer. */
internal fun bankAccountDetail(bank: BankAccountEntity): String = listOfNotNull(
    listOfNotNull(bank.type?.trim()?.takeIf(String::isNotEmpty), bank.number?.trim()?.takeIf(String::isNotEmpty))
        .joinToString(" ").takeIf(String::isNotEmpty),
    bank.holderName?.trim()?.takeIf(String::isNotEmpty)?.let { "Titular: $it" },
    bank.holderDocument?.trim()?.takeIf(String::isNotEmpty)?.let { "NIT/CC $it" }
).joinToString(" · ")

/** Payment method chosen in a form: cash when [bankId] is null. */
internal data class PaymentMethodDraft(
    val bankId: Int? = null,
    val bankAmount: String = "",
    val reference: String = "",
    val changeConfirmed: Boolean = false,
    /** False while editing means "leave the bank split as it was". */
    val edited: Boolean = false
) {
    fun requireCreditFunding(banks: List<BankAccountEntity>) {
        require(edited) { "Indica de dónde salió el dinero: efectivo o consignación desde una cuenta." }
        require(bankId == null || banks.any { it.id == bankId }) {
            "La cuenta de origen ya no está disponible para esta sucursal; actualiza las cuentas."
        }
    }

    fun requireInitialPaymentSource(banks: List<BankAccountEntity>) {
        require(edited) { "Indica quién recibió la cuota inicial: efectivo o cuenta bancaria." }
        require(bankId == null || banks.any { it.id == bankId }) {
            "La cuenta que recibió la cuota inicial no está disponible; actualiza las cuentas."
        }
    }

    /** Bank split for the payload; a blank amount means the whole [total] went through the bank. */
    fun splits(total: String): List<BankSplit> {
        val id = bankId ?: return emptyList()
        return listOf(BankSplit(id, bankAmount.ifBlank { total }, reference))
    }

    /** Cash handed back when the transfer came in bigger than the operation. */
    fun cashChange(total: String): Double {
        val amount = total.replace(',', '.').trim().toDoubleOrNull() ?: return 0.0
        return OperationPayloadMapper.cashChange(splits(total), amount)
    }
}

/**
 * «Efectivo» plus one chip per company bank account. Choosing a bank reveals how much went
 * through it (blank = all of it, less = mixed payment, the rest in cash) and an optional reference.
 * Only accounts the office authorized for this branch are listed. In required mode, cash
 * remains available even when there are no authorized accounts.
 */
@Composable
internal fun PaymentMethodPicker(
    banks: List<BankAccountEntity>,
    draft: PaymentMethodDraft,
    onChange: (PaymentMethodDraft) -> Unit,
    amountLabel: String,
    total: String = "",
    allowChange: Boolean = false,
    allowKeep: Boolean = false,
    requireSelection: Boolean = false,
    selectionLabel: String = "¿De dónde salió el dinero del crédito? *",
    accountLabel: String = "Cuenta desde la que salió el dinero"
) {
    if (banks.isEmpty() && !requireSelection) return
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            if (requireSelection) selectionLabel else "Método de pago",
            style = MaterialTheme.typography.labelLarge
        )
        Row(
            Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            if (allowKeep) FilterChip(
                selected = !draft.edited,
                onClick = { onChange(PaymentMethodDraft()) },
                label = { Text("Sin cambios") }
            )
            FilterChip(
                selected = draft.bankId == null && (draft.edited || (!allowKeep && !requireSelection)),
                onClick = { onChange(PaymentMethodDraft(edited = true)) },
                label = { Text("Efectivo") }
            )
            for (bank in banks) {
                FilterChip(
                    selected = draft.bankId == bank.id,
                    onClick = { onChange(draft.copy(bankId = bank.id, edited = true)) },
                    label = { Text(if (requireSelection) "Consignación · ${bank.name}" else bank.name) }
                )
            }
        }
        val selected = banks.firstOrNull { it.id == draft.bankId }
        if (selected != null) {
            Text(
                bankAccountDetail(selected),
                style = MaterialTheme.typography.bodySmall
            )
            if (requireSelection) Text(accountLabel, style = MaterialTheme.typography.bodySmall)
            OutlinedTextField(
                draft.bankAmount, { onChange(draft.copy(bankAmount = it)) },
                label = { Text(amountLabel) },
                supportingText = { Text("Vacío = todo por banco. Si es menos, el resto es efectivo.") },
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
            )
            OutlinedTextField(
                draft.reference, { onChange(draft.copy(reference = it.take(50))) },
                label = { Text("Referencia / comprobante (opcional)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            val change = if (allowChange) draft.cashChange(total) else 0.0
            if (change > 0.0) Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(draft.changeConfirmed, { onChange(draft.copy(changeConfirmed = it)) })
                Text(
                    "Transfirió de más: le devuelves ${formatMoney(change.toString())} en efectivo",
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
        if (requireSelection && !draft.edited) Text(
            "Selecciona efectivo o la cuenta de origen antes de guardar.",
            color = MaterialTheme.colorScheme.error,
            style = MaterialTheme.typography.bodySmall
        )
    }
}
