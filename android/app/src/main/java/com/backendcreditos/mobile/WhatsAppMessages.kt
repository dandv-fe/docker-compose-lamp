package com.backendcreditos.mobile

import android.content.Context
import java.math.BigDecimal
import java.math.RoundingMode
import java.net.URLEncoder
import java.text.NumberFormat
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/** A message ready to be opened in WhatsApp; [phone] is null when the stored number is unusable. */
data class WhatsAppOffer(
    val title: String,
    val customerName: String,
    val phone: String?,
    val message: String
)

private val whatsAppLocale = Locale("es", "CO")
private val whatsAppMoment = DateTimeFormatter.ofPattern("dd/MM/yyyy hh:mm a", whatsAppLocale)

/**
 * Normalizes a stored phone to the international digits wa.me expects. Colombian mobiles are
 * stored as 10 digits starting with 3, so they get [defaultCountryCode]. Anything that cannot be
 * a real number (too short, all zeros) returns null so WhatsApp lets the user pick the contact.
 */
fun whatsAppPhone(raw: String?, defaultCountryCode: String = "57"): String? {
    var digits = raw.orEmpty().filter(Char::isDigit)
    if (digits.startsWith("00")) digits = digits.drop(2)
    if (digits.isEmpty() || digits.all { it == '0' }) return null
    return when {
        digits.length == 10 && digits.startsWith("3") -> defaultCountryCode + digits
        digits.length == 12 && digits.startsWith(defaultCountryCode) -> digits
        digits.length in 11..15 -> digits
        else -> null
    }
}

fun whatsAppUrl(phone: String?, message: String): String {
    val text = URLEncoder.encode(message, "UTF-8").replace("+", "%20")
    return if (phone == null) "https://wa.me/?text=$text" else "https://wa.me/$phone?text=$text"
}

private fun whatsAppMoney(raw: String?): String? {
    val value = raw?.trim()?.toBigDecimalOrNull()?.abs() ?: return null
    val format = NumberFormat.getNumberInstance(whatsAppLocale).apply {
        maximumFractionDigits = if (value.stripTrailingZeros().scale() > 0) 2 else 0
        minimumFractionDigits = 0
    }
    return "$" + format.format(value.setScale(2, RoundingMode.HALF_UP))
}

private fun greeting(customerName: String) =
    customerName.trim().takeIf(String::isNotEmpty)?.let { "Hola $it," } ?: "Hola,"

fun paymentReceiptMessage(
    customerName: String,
    amount: String,
    balance: String?,
    collectorName: String?,
    moment: LocalDateTime = LocalDateTime.now()
): String = buildString {
    append(greeting(customerName))
    append(" recibimos su abono de ")
    append(whatsAppMoney(amount) ?: amount)
    append(" el ")
    append(moment.format(whatsAppMoment))
    append('.')
    whatsAppMoney(balance)?.let { append(" Saldo pendiente: ").append(it).append('.') }
    collectorName?.trim()?.takeIf(String::isNotEmpty)?.let { append(" Recibió: ").append(it).append('.') }
    append(" ¡Gracias por su pago!")
}

fun creditCreatedMessage(
    customerName: String,
    value: String?,
    frequency: String?,
    term: Int?,
    balance: String?,
    concept: String?,
    collectorName: String?,
    moment: LocalDateTime = LocalDateTime.now()
): String = buildString {
    append(greeting(customerName))
    append(" el ")
    append(moment.format(whatsAppMoment))
    append(" se registró su crédito")
    concept?.trim()?.takeIf(String::isNotEmpty)?.let { append(" (").append(it).append(')') }
    whatsAppMoney(value)?.let { append(" por ").append(it) }
    append('.')
    val total = value?.trim()?.toBigDecimalOrNull()
    if (term != null && term > 0 && !frequency.isNullOrBlank()) {
        append(" Plazo: ").append(term).append(' ').append(frequencyUnit(frequency, term)).append('.')
        if (total != null && total > BigDecimal.ZERO) {
            val installment = total.divide(BigDecimal(term), 0, RoundingMode.CEILING)
            append(" Cuota ").append(installmentAdjective(frequency)).append("aproximada: ")
                .append(whatsAppMoney(installment.toPlainString())).append('.')
        }
    }
    whatsAppMoney(balance)?.takeIf { balance?.toBigDecimalOrNull()?.compareTo(total) != 0 }
        ?.let { append(" Saldo pendiente: ").append(it).append('.') }
    collectorName?.trim()?.takeIf(String::isNotEmpty)?.let { append(" Atendió: ").append(it).append('.') }
    append(" ¡Gracias por su confianza!")
}

private fun installmentAdjective(frequency: String): String =
    when (frequency.lowercase(whatsAppLocale)) {
        "diario" -> "diaria "
        "semanal", "quincenal", "mensual" -> frequency.lowercase(whatsAppLocale) + " "
        else -> ""
    }

private fun frequencyUnit(frequency: String, term: Int): String {
    val singular = when (frequency.lowercase(whatsAppLocale)) {
        "diario" -> "día"
        "semanal" -> "semana"
        "quincenal" -> "quincena"
        "mensual" -> "mes"
        else -> "cuota"
    }
    if (term == 1) return singular
    return when (singular) {
        "mes" -> "meses"
        else -> singular + "s"
    }
}

object WhatsAppSettings {
    private const val PREFS = "whatsapp_settings"
    private const val KEY_OFFER = "offer_after_save"

    fun offerAfterSave(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_OFFER, true)

    fun setOfferAfterSave(context: Context, enabled: Boolean) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(KEY_OFFER, enabled).apply()
    }
}
