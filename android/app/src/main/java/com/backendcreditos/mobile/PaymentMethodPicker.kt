package com.backendcreditos.mobile

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.backendcreditos.mobile.data.BankAccountEntity
import com.backendcreditos.mobile.data.BankSplit

/** Payment method chosen in a form: cash when [bankId] is null. */
internal data class PaymentMethodDraft(
    val bankId: Int? = null,
    val bankAmount: String = "",
    val reference: String = ""
) {
    /** Bank split for the payload; a blank amount means the whole [total] went through the bank. */
    fun splits(total: String): List<BankSplit> {
        val id = bankId ?: return emptyList()
        return listOf(BankSplit(id, bankAmount.ifBlank { total }, reference))
    }
}

/**
 * «Efectivo» plus one chip per company bank account. Choosing a bank reveals how much went
 * through it (blank = all of it, less = mixed payment, the rest in cash) and an optional reference.
 * Hidden when the company has no accounts, so cash-only offices see no extra fields.
 */
@Composable
internal fun PaymentMethodPicker(
    banks: List<BankAccountEntity>,
    draft: PaymentMethodDraft,
    onChange: (PaymentMethodDraft) -> Unit,
    amountLabel: String
) {
    if (banks.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text("Método de pago", style = MaterialTheme.typography.labelLarge)
        Row(
            Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(
                selected = draft.bankId == null,
                onClick = { onChange(PaymentMethodDraft()) },
                label = { Text("Efectivo") }
            )
            for (bank in banks) {
                FilterChip(
                    selected = draft.bankId == bank.id,
                    onClick = { onChange(draft.copy(bankId = bank.id)) },
                    label = { Text(bank.name) }
                )
            }
        }
        if (draft.bankId != null) {
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
        }
    }
}
