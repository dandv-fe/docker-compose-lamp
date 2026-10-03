package com.backendcreditos.mobile

import androidx.compose.ui.graphics.Color
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Instant
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

internal data class PaymentPresentation(
    val type: String,
    val detail: String,
    val background: Color,
    val foreground: Color
)

internal fun formatPersonName(name: String): String =
    Regex("""\p{L}+""").replace(name.trim().lowercase(Locale("es"))) {
        it.value.replaceFirstChar { char -> char.titlecase(Locale("es")) }
    }

internal fun classifyPayment(description: String?, state: String?, ownRecord: Boolean = false): PaymentPresentation {
    val text = description.orEmpty().trim()
    val active = state == "created" || state == "entregando"
    val datedInterest = Regex("""^(\d{4}/\d{2}/\d{2})->Intereces$""", RegexOption.IGNORE_CASE)
        .matchEntire(text)
    if (datedInterest != null) {
        return PaymentPresentation("Intereses", datedInterest.groupValues[1], Color(0xFF6F42C1), Color.White)
    }

    val green = if (active && ownRecord) {
        if (state == "entregando") Color(0xFF1F5B2C) else Color(0xFF4B965B)
    } else Color(0xFF343A40)
    val types = listOf(
        Triple(Regex("""^c-Inicial(?=$|\s|->|:)""", RegexOption.IGNORE_CASE), "c-Inicial", green),
        Triple(Regex("""^Abono(?=$|\s|->|:)""", RegexOption.IGNORE_CASE), "Abono", green),
        Triple(Regex("""^Inicial(?=$|\s|->|:)""", RegexOption.IGNORE_CASE), "Cuota inicial", Color(0xFFFD7E14)),
        Triple(Regex("""^Descuento(?=$|\s|->|:)""", RegexOption.IGNORE_CASE), "Descuento", Color(0xFFFFC107)),
        Triple(Regex("""^Inter(?:eses|eces|és)(?=$|\s|->|:)""", RegexOption.IGNORE_CASE), "Intereses", Color(0xFF6F42C1)),
        Triple(Regex("""^Saldo corregido(?=$|\s|->|:)""", RegexOption.IGNORE_CASE), "Saldo corregido", Color(0xFF343A40)),
        Triple(Regex("""^Pagado(?=$|\s|->|:)""", RegexOption.IGNORE_CASE), "Pagado", Color(0xFF212529)),
        Triple(Regex("""^Cancelado(?=$|\s|->|:)""", RegexOption.IGNORE_CASE), "Cancelado", Color(0xFFDC3545)),
        Triple(Regex("""^Cancelada(?=$|\s|->|:)""", RegexOption.IGNORE_CASE), "Cancelada", Color(0xFFDC3545))
    )
    for ((pattern, type, color) in types) {
        val match = pattern.find(text) ?: continue
        val detail = text.substring(match.value.length).replace(Regex("""^\s*(?:->|:)\s*"""), "").trim()
        val background = color
        val foreground = if (background in listOf(Color(0xFFFD7E14), Color(0xFFFFC107))) {
            Color.Black
        } else Color.White
        return PaymentPresentation(type, detail, background, foreground)
    }
    return PaymentPresentation("Movimiento", text, Color(0xFFDC3545), Color.White)
}

private val moneyLocale = Locale("es", "CO")
private val momentFormat = DateTimeFormatter.ofPattern("dd/MM/yyyy · hh:mm a", moneyLocale)

internal fun formatMoney(raw: String?): String {
    val value = raw?.toBigDecimalOrNull() ?: return "—"
    return formatMoney(value)
}

internal fun formatMoney(value: BigDecimal): String =
    String.format(moneyLocale, "$ %,.2f", value.setScale(2, RoundingMode.HALF_UP))

// createdAt travels as epoch milliseconds because the server serializes MySQL DATETIME through
// GraphQL's String type; older caches may still hold a plain SQL datetime or an ISO instant.
internal fun formatPaymentMoment(raw: String?, zone: ZoneId = ZoneId.systemDefault()): String {
    val text = raw?.trim().orEmpty()
    if (text.isEmpty()) return "Sin fecha"
    val moment = parseMoment(text, zone) ?: return text
    return momentFormat.format(moment.atZone(zone))
        .replace('\u00A0', ' ').replace('\u202F', ' ')
        .replace("a. m.", "a.m.").replace("p. m.", "p.m.")
        .replace("AM", "a.m.").replace("PM", "p.m.")
}

private fun parseMoment(text: String, zone: ZoneId): Instant? {
    text.toLongOrNull()?.let { return Instant.ofEpochMilli(it) }
    runCatching { return OffsetDateTime.parse(text).toInstant() }
    runCatching { return Instant.parse(text) }
    runCatching { return LocalDateTime.parse(text.replace(' ', 'T')).atZone(zone).toInstant() }
    return null
}

// Same reading as formatPaymentMoment, but returning the instant so a cached row can be sorted:
// the list query hands epoch milliseconds while a sync change hands an ISO instant.
internal fun momentMillis(raw: String?, zone: ZoneId = ZoneId.systemDefault()): Long? {
    val text = raw?.trim().orEmpty()
    if (text.isEmpty()) return null
    return parseMoment(text, zone)?.toEpochMilli()
}

// The server never sends a per-payment balance, so it is rebuilt from the card's current
// balance walking backwards: the newest row lands on today's balance and every older row
// undoes the movement above it. It is only exact while the whole history is cached, which is
// why the caller tells the user the column is calculated on the device.
internal fun runningBalances(
    currentBalance: BigDecimal?, amountsNewestFirst: List<BigDecimal?>,
): List<BigDecimal?> {
    if (currentBalance == null) return amountsNewestFirst.map { null }
    var balance = currentBalance
    return amountsNewestFirst.map { amount ->
        val shown = balance ?: return@map null
        balance = amount?.let { shown.subtract(it) }
        shown.setScale(2, RoundingMode.HALF_UP)
    }
}
