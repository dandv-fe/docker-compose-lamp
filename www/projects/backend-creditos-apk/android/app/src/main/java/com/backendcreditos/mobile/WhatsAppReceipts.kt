package com.backendcreditos.mobile

import com.backendcreditos.mobile.data.OperationKind
import java.time.Instant
import java.time.ZoneId
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject

// Business day for receipt resends: the zone webgoez pins (Conexion.php) and the API's default
// APP_TIME_ZONE. The server enforces the same rule; this only hides buttons that would fail.
internal val RECEIPT_ZONE: ZoneId = ZoneId.of("America/Bogota")

enum class ReceiptKind(val wire: String) { CREDIT("credit"), PAYMENT("payment") }

data class ReceiptTarget(val kind: ReceiptKind, val recordId: String)

internal val RECEIPT_FORMAT_CHOICES = listOf("ticket", "factura", "cartulina")

internal fun canonicalReceiptFormat(value: String?): String? =
    value?.trim()?.lowercase()?.takeIf { it in RECEIPT_FORMAT_CHOICES }

internal fun appendReceiptLink(message: String, url: String): String =
    if (url in message) message else "${message.trimEnd()}\n\nDescargue su comprobante: $url"

internal fun removeReceiptLink(message: String, url: String): String =
    message.replace(Regex("(?m)^Descargue su comprobante: ${Regex.escape(url)}$"), "")
        .replace(Regex("\\n{3,}"), "\n\n").trimEnd()

private fun payloadObject(payload: String): JsonObject? =
    runCatching { Json.parseToJsonElement(payload).jsonObject }.getOrNull()

private fun JsonObject.text(key: String): String? =
    (this[key] as? JsonPrimitive)?.contentOrNull?.trim()?.takeIf(String::isNotEmpty)

/**
 * Which card or abono a queued/confirmed operation produced. CREATE_PAYMENT travels with the
 * CREDIT id as entityId; its abono id is payload.iddescripcion and nothing else is accepted.
 */
internal fun receiptTargetFor(kind: OperationKind, entityId: String, payload: String): ReceiptTarget? {
    val fields = payloadObject(payload)
    return when (kind) {
        OperationKind.CREATE_CREDIT -> {
            val id = fields?.text("idtarjeta") ?: entityId
            ReceiptTarget(ReceiptKind.CREDIT, id).takeIf { id == entityId && id.isNotBlank() }
        }
        OperationKind.CREATE_PAYMENT -> fields?.text("iddescripcion")
            ?.takeIf { it != entityId }?.let { ReceiptTarget(ReceiptKind.PAYMENT, it) }
        OperationKind.UPDATE_PAYMENT -> entityId.takeIf(String::isNotBlank)?.let { ReceiptTarget(ReceiptKind.PAYMENT, it) }
        else -> null
    }
}

/** Card behind the receipt: itself, the CREATE_PAYMENT entity, or the cached abono's card. */
internal fun receiptCreditIdFor(
    kind: OperationKind, entityId: String, target: ReceiptTarget, cachedPaymentCreditId: String?
): String? = when {
    target.kind == ReceiptKind.CREDIT -> target.recordId
    kind == OperationKind.CREATE_PAYMENT -> entityId
    else -> cachedPaymentCreditId
}

internal fun isReceiptState(state: String?): Boolean =
    state?.trim()?.lowercase() in setOf("created", "entregando")

/** Accepts epoch millis, SQL "yyyy-MM-dd HH:mm:ss" (read in [zone]) or ISO instants. */
internal fun createdOnBusinessDay(raw: String?, now: Instant = Instant.now(), zone: ZoneId = RECEIPT_ZONE): Boolean {
    val millis = momentMillis(raw, zone) ?: return false
    return Instant.ofEpochMilli(millis).atZone(zone).toLocalDate() == now.atZone(zone).toLocalDate()
}

internal fun receiptEligible(
    state: String?, createdAt: String?, now: Instant = Instant.now(), zone: ZoneId = RECEIPT_ZONE
): Boolean = isReceiptState(state) && createdOnBusinessDay(createdAt, now, zone)

internal fun isInitialInstallment(description: String?): Boolean =
    description?.trim().equals("Inicial", ignoreCase = true)

internal fun isArticle(concept: String?): Boolean = concept?.trim().equals("Articulo", ignoreCase = true)

/** Initial installment of a CREATE_CREDIT payload: amount and the part received by bank. */
internal data class InitialInstallment(val amount: String, val bankAmount: String?)

internal fun initialInstallmentFromPayload(payload: String): InitialInstallment? {
    val fields = payloadObject(payload) ?: return null
    val amount = fields.text("cuotaInicial")?.toBigDecimalOrNull()?.abs()?.takeIf { it.signum() > 0 } ?: return null
    val bank = (fields["bancosInicial"] as? JsonArray)?.sumOf {
        ((it as? JsonObject)?.text("valor")?.toBigDecimalOrNull() ?: java.math.BigDecimal.ZERO)
    }?.takeIf { it.signum() > 0 }
    return InitialInstallment(amount.toPlainString(), bank?.toPlainString())
}

internal fun payloadText(payload: String, key: String): String? = payloadObject(payload)?.text(key)
