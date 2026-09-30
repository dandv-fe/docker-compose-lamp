package com.backendcreditos.mobile

import com.backendcreditos.mobile.data.CreditEntity
import com.backendcreditos.mobile.data.PaymentEntity
import java.math.BigDecimal
import java.util.Locale

internal data class RouteTotals(
    val cardsWithPayments: Int,
    val totalCards: Int,
    val collected: BigDecimal,
    val newCredits: BigDecimal,
    val insurance: BigDecimal = BigDecimal.ZERO
)

/** Pocket cash = base + abonos + other income (incl. seguros) − expenses − new credits. */
internal data class PocketCash(
    val base: BigDecimal,
    val collected: BigDecimal,
    val otherIncome: BigDecimal,
    val expenses: BigDecimal,
    val newCredits: BigDecimal
) {
    val total: BigDecimal get() = base + collected + otherIncome - expenses - newCredits
}

internal fun pocketCash(totals: RouteTotals, base: String?, otherIncome: String?, expenses: String?) = PocketCash(
    base = base?.toBigDecimalOrNull() ?: BigDecimal.ZERO,
    collected = totals.collected,
    otherIncome = (otherIncome?.toBigDecimalOrNull() ?: BigDecimal.ZERO) + totals.insurance,
    expenses = expenses?.toBigDecimalOrNull() ?: BigDecimal.ZERO,
    newCredits = totals.newCredits
)

private val openStates = setOf("created", "entregando")
private val collectedPattern = Regex("Abono|Inicial|Cancelado", RegexOption.IGNORE_CASE)

/**
 * Same figures as the web cartera (view_ruta.recaudo + sumRecaudoCreditos worker), limited to
 * the open route: movements and cards still in `created`/`entregando`.
 * - collected: Abono / Inicial / Cancelado movements, sign flipped to positive.
 * - cardsWithPayments: cards whose collected amount is above zero.
 * - newCredits: dec_prestamo ("costo") of cards created in the open route.
 * - insurance: dec_c_adicional_valor (seguros) of those cards, which webgoez adds to the recaudo.
 * One pass over each list, so it stays cheap with hundreds of cards.
 */
internal fun routeTotals(credits: List<CreditEntity>, payments: List<PaymentEntity>): RouteTotals {
    val perCard = HashMap<String, BigDecimal>()
    for (payment in payments) {
        if (payment.state !in openStates) continue
        if (!collectedPattern.containsMatchIn(payment.description.orEmpty())) continue
        val amount = payment.amount?.toBigDecimalOrNull() ?: continue
        perCard[payment.creditId] = (perCard[payment.creditId] ?: BigDecimal.ZERO).subtract(amount)
    }
    var collected = BigDecimal.ZERO
    var cardsWithPayments = 0
    for (value in perCard.values) {
        collected = collected.add(value)
        if (value.signum() > 0) cardsWithPayments++
    }
    var newCredits = BigDecimal.ZERO
    var insurance = BigDecimal.ZERO
    for (credit in credits) {
        if (credit.status in openStates) {
            credit.principal?.toBigDecimalOrNull()?.let { newCredits = newCredits.add(it) }
            credit.additionalValue?.toBigDecimalOrNull()?.let { insurance = insurance.add(it) }
        }
    }
    return RouteTotals(cardsWithPayments, credits.size, collected, newCredits, insurance)
}

private val compactLocale = Locale("es", "CO")

/** Whole pesos with thousands dots ("11.250"), to fit the totals in one line. */
internal fun formatCompactMoney(value: BigDecimal): String =
    String.format(compactLocale, "%,.0f", value)
