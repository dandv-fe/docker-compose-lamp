package com.backendcreditos.mobile

import android.content.Context
import java.math.BigDecimal
import java.math.RoundingMode
import java.net.URLEncoder
import java.text.NumberFormat
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import com.backendcreditos.mobile.network.CustomerPhoneDto

/** A message ready to be opened in WhatsApp; [phone] is null when the stored number is unusable. */
data class WhatsAppOffer(
    val title: String,
    val customerName: String,
    val phone: String?,
    val message: String,
    val accountKey: String? = null,
    val branchId: String? = null,
    val customerId: String? = null,
    val phones: List<CustomerPhoneDto> = emptyList(),
    // Card/abono this receipt belongs to. Opening it queues ONE RECORD_WHATSAPP_RECEIPT that moves
    // the hidden per-record counter and, when a saved phone was chosen, that phone's counter.
    val receipt: ReceiptTarget? = null,
    val receiptFormat: String? = null,
    // Still-unsent operation that creates/edits that record; the counter waits for it.
    val receiptDependsOn: String? = null
)

fun rankedWhatsAppPhones(phones: List<CustomerPhoneDto>, primary: String?): List<CustomerPhoneDto> {
    val normalizedPrimary = whatsAppPhone(primary)
    return phones.filter { !it.invalid && it.normalizedPhone != null && whatsAppPhone(it.normalizedPhone) == it.normalizedPhone }
        .distinctBy { it.normalizedPhone }
        .sortedWith(compareByDescending<CustomerPhoneDto> {
            it.whatsappOpenCount.toBigIntegerOrNull() ?: java.math.BigInteger.ZERO
        }.thenByDescending { it.normalizedPhone == normalizedPrimary })
}

fun validWhatsAppPrimary(phones: List<CustomerPhoneDto>, primary: String?): String? {
    val normalized = whatsAppPhone(primary) ?: return null
    return normalized.takeUnless { phones.any { it.normalizedPhone == normalized && it.invalid } }
}

internal fun phoneHistoryWithPrimary(
    phones: List<CustomerPhoneDto>, previous: String?, next: String?
): List<CustomerPhoneDto> = phones.toMutableList().apply {
    for (raw in listOfNotNull(previous, next).filter(String::isNotBlank)) {
        val normalized = whatsAppPhone(raw)
        if (none { if (normalized != null) it.normalizedPhone == normalized else it.phone == raw }) {
            add(CustomerPhoneDto(id = "local:$raw", phone = raw, normalizedPhone = normalized))
        }
    }
}

internal fun withPendingPhoneValidity(
    phones: List<CustomerPhoneDto>, phone: String, invalid: Boolean, operationId: String
): List<CustomerPhoneDto> = phones.map {
    if (it.normalizedPhone != phone || operationId in it.pendingValidityIds) it else it.copy(
        invalid = invalid, pendingValidityIds = it.pendingValidityIds + operationId,
        validityBeforePending = it.validityBeforePending ?: it.invalid
    )
}

internal fun withoutPendingPhoneValidity(phones: List<CustomerPhoneDto>): List<CustomerPhoneDto> = phones.map {
    if (it.validityBeforePending == null) it else it.copy(
        invalid = it.validityBeforePending, pendingValidityIds = emptyList(), validityBeforePending = null
    )
}

internal fun withPendingWhatsAppOpen(
    phones: List<CustomerPhoneDto>, phone: String, operationId: String, openedAt: String
): List<CustomerPhoneDto> = phones.map {
    if (it.invalid || it.normalizedPhone != phone || operationId in it.pendingOpenIds) it else it.copy(
        whatsappOpenCount = ((it.whatsappOpenCount.toBigIntegerOrNull() ?: java.math.BigInteger.ZERO)
            + java.math.BigInteger.ONE).toString(),
        whatsappLastOpenedAt = maxOf(it.whatsappLastOpenedAt.orEmpty(), openedAt),
        pendingOpenIds = it.pendingOpenIds + operationId
    )
}

private val whatsAppLocale = Locale("es", "CO")
private val whatsAppMoment = DateTimeFormatter.ofPattern("dd/MM/yyyy hh:mm a", whatsAppLocale)

/**
 * Normalizes a stored phone to the international digits wa.me expects. Colombian mobiles are
 * stored as 10 digits starting with 3, so they get [defaultCountryCode]. Anything that cannot be
 * a real number (too short, all zeros) returns null so WhatsApp lets the user pick the contact.
 */
fun whatsAppPhone(raw: String?, defaultCountryCode: String = "57"): String? {
    val text = raw.orEmpty().trim()
    if (!Regex("^(?:\\+|00)?[0-9]+(?:[ ()-][0-9]+)*$").matches(text)) return null
    var digits = text.filter { it in '0'..'9' }
    if (digits.startsWith("00")) digits = digits.drop(2)
    if (digits.isEmpty() || digits.all { it == '0' }) return null
    return when {
        digits.length == 10 && digits.startsWith("3") -> defaultCountryCode + digits
        digits.length == 12 && digits.startsWith(defaultCountryCode + "3") -> digits
        digits.length in 11..15 && !digits.startsWith("0") && !digits.startsWith(defaultCountryCode) -> digits
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

/**
 * Card receipt. For an Articulo with a cuota inicial, the initial installment travels INSIDE this
 * same message (never as a separate abono receipt) and the balance shown is value − initial, i.e.
 * the balance right after creation: later movements of the day are not part of this receipt.
 */
fun creditCreatedMessage(
    customerName: String,
    value: String?,
    frequency: String?,
    term: Int?,
    balance: String?,
    concept: String?,
    collectorName: String?,
    moment: LocalDateTime = LocalDateTime.now(),
    articleDescription: String? = null,
    initialPayment: String? = null,
    initialBankAmount: String? = null
): String = buildString {
    append(greeting(customerName))
    append(" el ")
    append(moment.format(whatsAppMoment))
    append(" se registró su crédito")
    val article = articleDescription?.trim()?.replace(Regex("\\s+"), " ")?.take(120)?.takeIf(String::isNotEmpty)
    val label = concept?.trim()?.takeIf(String::isNotEmpty)
    when {
        label != null && article != null -> append(" (").append(label).append(": ").append(article).append(')')
        label != null -> append(" (").append(label).append(')')
        article != null -> append(" (").append(article).append(')')
    }
    whatsAppMoney(value)?.let { append(" por ").append(it) }
    append('.')
    val total = value?.trim()?.toBigDecimalOrNull()
    val initial = initialPayment?.trim()?.toBigDecimalOrNull()?.abs()?.takeIf { it.signum() > 0 }
    if (initial != null) {
        append(" Cuota inicial recibida: ").append(whatsAppMoney(initial.toPlainString()))
        initialBankAmount?.trim()?.toBigDecimalOrNull()?.abs()?.takeIf { it.signum() > 0 }?.let {
            append(" (por transferencia ").append(whatsAppMoney(it.toPlainString())).append(')')
        }
        append('.')
    }
    val shownBalance = if (initial != null && total != null) total.subtract(initial).toPlainString() else balance
    if (initial != null) whatsAppMoney(shownBalance)?.let { append(" Saldo pendiente: ").append(it).append('.') }
    if (term != null && term > 0 && !frequency.isNullOrBlank()) {
        append(" Plazo: ").append(term).append(' ').append(frequencyUnit(frequency, term)).append('.')
        if (total != null && total > BigDecimal.ZERO) {
            val installment = total.divide(BigDecimal(term), 0, RoundingMode.CEILING)
            append(" Cuota ").append(installmentAdjective(frequency)).append("aproximada: ")
                .append(whatsAppMoney(installment.toPlainString())).append('.')
        }
    }
    if (initial == null) whatsAppMoney(shownBalance)?.takeIf { shownBalance?.toBigDecimalOrNull()?.compareTo(total) != 0 }
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
