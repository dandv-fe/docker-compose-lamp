package com.backendcreditos.mobile

import com.backendcreditos.mobile.data.OperationKind
import com.backendcreditos.mobile.data.OperationStatus
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject

/** What the collector recognizes about an operation: who, which card, how much. */
internal data class OperationSummary(val person: String?, val details: List<String>)

internal fun operationStatusLabel(status: OperationStatus): String = when (status) {
    OperationStatus.PENDING -> "Esperando envío"
    OperationStatus.IN_FLIGHT -> "Enviando…"
    OperationStatus.CONFIRMED -> "Confirmado por el servidor"
    OperationStatus.CONFLICT -> "Conflicto: necesita revisión"
    OperationStatus.REJECTED -> "Rechazado por el servidor"
}

/**
 * Builds the queue card text from the queued payload plus whatever the phone already knows
 * about the customer/card. Never shows internal IDs; unknown fields are simply omitted.
 * [paymentAmount] is the cached amount of the payment being edited or deleted, if known.
 */
internal fun summarizeOperation(
    kind: OperationKind,
    payload: String,
    customerName: String?,
    cardLabel: String?,
    paymentAmount: String? = null
): OperationSummary {
    val data = runCatching { Json.parseToJsonElement(payload).jsonObject }.getOrNull() ?: JsonObject(emptyMap())
    fun text(key: String) = (data[key] as? JsonPrimitive)?.contentOrNull?.trim()?.takeIf { it.isNotEmpty() }
    fun money(key: String) = text(key)?.toBigDecimalOrNull()?.abs()?.let(::formatMoney)
    val details = mutableListOf<String>()
    var person = customerName

    when (kind) {
        OperationKind.CREATE_CUSTOMER, OperationKind.UPDATE_CUSTOMER -> {
            val name = listOfNotNull(text("nombres"), text("apellidos")).joinToString(" ")
            if (name.isNotBlank()) person = formatPersonName(name)
            listOfNotNull(text("tipoDocumento"), text("numeroDocumento")).joinToString(" ")
                .takeIf(String::isNotBlank)?.let(details::add)
            money("maxCredito")?.let { details += "Cupo máximo $it" }
        }
        OperationKind.UPDATE_DOCUMENT -> {
            listOfNotNull(text("tipoDocumento"), text("numeroDocumento")).joinToString(" ")
                .takeIf(String::isNotBlank)?.let { details += "Nuevo documento: $it" }
        }
        OperationKind.CREATE_CREDIT, OperationKind.UPDATE_CREDIT -> {
            text("concepto")?.let { details += it }
            val amounts = listOfNotNull(
                money("valor")?.let { "Valor $it" },
                money("prestamo")?.let { "Préstamo $it" }
            )
            if (amounts.isNotEmpty()) details += amounts.joinToString(" · ")
            val plan = listOfNotNull(text("plazo")?.let { "$it cuotas" }, text("modo")).joinToString(" ")
            if (plan.isNotBlank()) details += "Plazo $plan"
            money("cuotaInicial")?.takeIf { text("cuotaInicial")?.toBigDecimalOrNull()?.signum() != 0 }
                ?.let { details += "Cuota inicial $it" }
        }
        OperationKind.UPDATE_CREDIT_TERMS -> {
            val plan = listOfNotNull(text("plazo")?.let { "$it cuotas" }, text("modo")).joinToString(" ")
            if (plan.isNotBlank()) details += "Nuevo plazo: $plan"
        }
        OperationKind.CREATE_PAYMENT, OperationKind.UPDATE_PAYMENT -> {
            money("abono")?.let { details += "Abono $it" }
            text("descripcion")?.takeUnless { it.equals("Abono", ignoreCase = true) }?.let { details += it }
        }
        OperationKind.DELETE_PAYMENT -> {
            details += paymentAmount?.toBigDecimalOrNull()?.abs()
                ?.let { "Se elimina el abono de ${formatMoney(it)}" } ?: "Se elimina un abono"
        }
        OperationKind.DELETE_CREDIT -> details += "Se elimina la tarjeta"
        OperationKind.APPLY_DISCOUNT -> {
            money("amount")?.let { details += "Descuento $it" }
            text("descripcion")?.let { details += it }
        }
        OperationKind.ADD_INTEREST -> {
            val parts = listOfNotNull(money("amount")?.let { "Interés $it" }, text("plazo")?.let { "a $it meses" })
            if (parts.isNotEmpty()) details += parts.joinToString(" ")
            text("descripcion")?.let { details += it }
        }
        OperationKind.CHANGE_CREDIT_STATUS -> text("status")?.let { details += "Nuevo estado: ${creditStatusLabel(it)}" }
        OperationKind.REORDER_CREDIT -> text("item")?.let { details += "Nueva posición en la ruta: $it" }
        OperationKind.CREATE_COMMENT, OperationKind.UPDATE_COMMENT -> text("comentario")?.let { details += "«$it»" }
        OperationKind.DELETE_COMMENT -> details += "Se elimina un comentario"
        OperationKind.UPSERT_ALERT -> text("alerta")?.split("/,")?.getOrNull(2)
            ?.takeIf(String::isNotBlank)?.let { details += "Alerta: $it" }
    }
    if (cardLabel != null && kind != OperationKind.CREATE_CREDIT) details.add(0, cardLabel)
    return OperationSummary(person?.takeIf(String::isNotBlank), details)
}

/** The card as the collector knows it: concept, value and current balance. */
internal fun cardLabel(concept: String?, value: String?, balance: String?): String? {
    val parts = listOfNotNull(
        concept?.trim()?.takeIf(String::isNotEmpty),
        value?.toBigDecimalOrNull()?.takeIf { it.signum() != 0 }?.let { "valor ${formatMoney(it)}" },
        balance?.toBigDecimalOrNull()?.let { "saldo ${formatMoney(it)}" }
    )
    return if (parts.isEmpty()) null else "Tarjeta: ${parts.joinToString(" · ")}"
}

internal fun creditStatusLabel(status: String): String = when (status.lowercase()) {
    "created" -> "creada"
    "entregando" -> "entregando"
    "refinanciada" -> "refinanciada"
    "pagado", "paid" -> "pagada"
    "cancelado", "cancelada", "cancelled" -> "cancelada"
    "retirado", "retirada", "withdrawn" -> "retirada"
    else -> status
}

// Short phrases that only confirm something went well; everything else is kept as a problem
// so the Logs tab highlights it.
internal fun isProblemNotice(message: String): Boolean {
    val text = message.lowercase()
    val ok = listOf("enviando", "actualizada", "al día", "guardad", "confirmad", "reanudada", "encendida", "se descartó", "creada", "creado")
    val bad = listOf("sin conexión", "rechaz", "venció", "error", "no se pudo", "inválid", "conflicto", "pausada",
        "requiere", "no hay", "no está", "no se encontró", "supera", "debe")
    return bad.any(text::contains) || ok.none(text::contains)
}
