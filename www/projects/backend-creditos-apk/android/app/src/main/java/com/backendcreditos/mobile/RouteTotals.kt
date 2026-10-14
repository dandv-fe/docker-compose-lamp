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
    val insurance: BigDecimal = BigDecimal.ZERO,
    /** Part of [collected] received by bank transfer (never reaches the pocket). */
    val collectedBank: BigDecimal = BigDecimal.ZERO,
    /** Part of [newCredits] paid out from a bank account (never left the pocket). */
    val creditsBank: BigDecimal = BigDecimal.ZERO
)

/**
 * Pocket cash = base + cash abonos + other income (incl. seguros) − expenses − credits paid in cash.
 * Bank transfers are kept apart: [bankIn] abonos received by bank, [bankOut] credits paid by bank.
 */
internal data class PocketCash(
    val base: BigDecimal,
    val collected: BigDecimal,
    val otherIncome: BigDecimal,
    val expenses: BigDecimal,
    val newCredits: BigDecimal,
    val bankIn: BigDecimal = BigDecimal.ZERO,
    val bankOut: BigDecimal = BigDecimal.ZERO
) {
    val cashCollected: BigDecimal get() = collected - bankIn
    val cashCredits: BigDecimal get() = newCredits - bankOut
    val total: BigDecimal get() = base + cashCollected + otherIncome - expenses - cashCredits
}

internal fun pocketCash(totals: RouteTotals, base: String?, otherIncome: String?, expenses: String?) = PocketCash(
    base = base?.toBigDecimalOrNull() ?: BigDecimal.ZERO,
    collected = totals.collected,
    otherIncome = (otherIncome?.toBigDecimalOrNull() ?: BigDecimal.ZERO) + totals.insurance,
    expenses = expenses?.toBigDecimalOrNull() ?: BigDecimal.ZERO,
    newCredits = totals.newCredits,
    bankIn = totals.collectedBank,
    bankOut = totals.creditsBank
)

internal fun loanCashWarning(
    totals: RouteTotals, base: String?, otherIncome: String?, expenses: String?, capital: String
): String? {
    val amount = capital.toBigDecimalOrNull() ?: return null
    if (amount.signum() <= 0) return null
    if (listOf(base, otherIncome, expenses).any { it?.toBigDecimalOrNull() == null }) {
        return "No se conoce el dinero disponible de la cartera/ruta/punto de venta. Actualiza la caja para comprobarlo; este aviso no bloquea el préstamo."
    }
    val available = pocketCash(totals, base, otherIncome, expenses).total
    return if (available.signum() <= 0 || available < amount) {
        "La cartera/ruta/punto de venta no tiene dinero disponible" +
            " suficiente para este capital. Disponible: ${formatCompactMoney(available)}; capital: ${formatCompactMoney(amount)}. " +
            "Este aviso no amplía cupos ni cambia permisos y no bloquea el préstamo."
    } else null
}

private val openStates = setOf("created", "entregando")
private val collectedPattern = Regex("Abono|Inicial|Cancelado", RegexOption.IGNORE_CASE)

/**
 * Same figures as the web cartera (view_ruta.recaudo + sumRecaudoCreditos worker), limited to
 * the open route: movements and cards still in `created`/`entregando`.
 * - collected: Abono / Inicial / Cancelado movements, sign flipped to positive.
 * - cardsWithPayments: cards whose collected amount is above zero.
 * - newCredits: dec_prestamo ("costo") of cards created in the open route.
 * - insurance: dec_c_adicional_valor (seguros) of those cards, which webgoez adds to the recaudo.
 * - collectedBank / creditsBank: the part of those abonos / loans that went through a bank.
 * One pass over each list, so it stays cheap with hundreds of cards.
 */
internal fun routeTotals(credits: List<CreditEntity>, payments: List<PaymentEntity>): RouteTotals {
    val perCard = HashMap<String, BigDecimal>()
    var collectedBank = BigDecimal.ZERO
    for (payment in payments) {
        if (payment.state !in openStates) continue
        if (!collectedPattern.containsMatchIn(payment.description.orEmpty())) continue
        val amount = payment.amount?.toBigDecimalOrNull() ?: continue
        perCard[payment.creditId] = (perCard[payment.creditId] ?: BigDecimal.ZERO).subtract(amount)
        payment.bankAmount?.toBigDecimalOrNull()?.let { collectedBank = collectedBank.add(it) }
    }
    var collected = BigDecimal.ZERO
    var cardsWithPayments = 0
    for (value in perCard.values) {
        collected = collected.add(value)
        if (value.signum() > 0) cardsWithPayments++
    }
    var newCredits = BigDecimal.ZERO
    var insurance = BigDecimal.ZERO
    var creditsBank = BigDecimal.ZERO
    for (credit in credits) {
        if (credit.status in openStates) {
            credit.principal?.toBigDecimalOrNull()?.let { newCredits = newCredits.add(it) }
            credit.bankFunded?.toBigDecimalOrNull()?.let { creditsBank = creditsBank.add(it) }
            credit.additionalValue?.toBigDecimalOrNull()?.let { insurance = insurance.add(it) }
        }
    }
    return RouteTotals(cardsWithPayments, credits.size, collected, newCredits, insurance, collectedBank, creditsBank)
}

private val compactLocale = Locale("es", "CO")

/** Whole pesos with thousands dots ("11.250"), to fit the totals in one line. */
internal fun formatCompactMoney(value: BigDecimal): String =
    String.format(compactLocale, "%,.0f", value)
