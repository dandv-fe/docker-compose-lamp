package com.backendcreditos.mobile

import java.math.BigDecimal
import java.math.RoundingMode

/** Where the new card is placed relative to the one it was created from. */
internal enum class CardPlacement { FIRST, BEFORE, AFTER, LAST }

internal fun canAddInterest(status: String?): Boolean =
    status != null && status != "created" && status != "entregando"

/**
 * Next receipt number, replicating the legacy PHP in `ajax/CarteraAjax.php`:
 * the numeric tail is incremented while any leading zero padding is preserved,
 * so "0001" becomes "0002" and "7168" becomes "7169".
 */
internal fun nextReceiptNumber(lastNumber: String?): String {
    val text = lastNumber?.trim().orEmpty()
    if (text.isEmpty()) return "1"
    val digits = text.takeLastWhile { it.isDigit() }
    if (digits.isEmpty()) return text
    val prefix = text.dropLast(digits.length)
    val incremented = (digits.toLongOrNull() ?: return text) + 1
    // Keep the original width so the padding the branch configured is not lost.
    return prefix + incremented.toString().padStart(digits.length, '0')
}

/**
 * Sort order ("float_item") for a card created from the one at [index] of [sortedOrders].
 * The legacy JS picks a random point between the two neighbours; a midpoint does the same job
 * deterministically, and the ±1.1 jumps at both ends are kept so the new card clears the edge.
 */
internal fun placementSortOrder(
    sortedOrders: List<Double>, index: Int, placement: CardPlacement,
): Double {
    if (sortedOrders.isEmpty()) return 1.0
    require(sortedOrders.all { it.isFinite() } && sortedOrders.zipWithNext().all { (a, b) -> a <= b }) {
        "La ruta contiene posiciones inválidas; actualiza la cartera antes de insertar."
    }
    val anchor = sortedOrders.getOrNull(index)
        ?: throw IllegalArgumentException("La tarjeta seleccionada ya no está en la ruta; actualiza la cartera.")
    val result = when (placement) {
        CardPlacement.FIRST -> sortedOrders.first() - 1.1
        CardPlacement.LAST -> sortedOrders.last() + 1.1
        CardPlacement.BEFORE -> sortedOrders.getOrNull(index - 1)
            ?.let { previous -> (previous + anchor) / 2 } ?: (anchor - 1.1)
        CardPlacement.AFTER -> sortedOrders.getOrNull(index + 1)
            ?.let { next -> (anchor + next) / 2 } ?: (anchor + 1.1)
    }
    val previous = when (placement) {
        CardPlacement.FIRST -> null
        CardPlacement.LAST -> sortedOrders.last()
        CardPlacement.BEFORE -> sortedOrders.getOrNull(index - 1)
        CardPlacement.AFTER -> anchor
    }
    val next = when (placement) {
        CardPlacement.FIRST -> sortedOrders.first()
        CardPlacement.LAST -> null
        CardPlacement.BEFORE -> anchor
        CardPlacement.AFTER -> sortedOrders.getOrNull(index + 1)
    }
    val stored = result.toFloat().toDouble()
    // This is only the offline preview. The server inserts beside the reference card
    // and renumbers the route when legacy duplicates leave no float between neighbors.
    return if (stored.isFinite() && (previous == null || stored > previous) &&
        (next == null || stored < next) && stored !in sortedOrders) stored else anchor
}

internal fun installmentValue(value: String, term: String): String? {
    val amount = value.toBigDecimalOrNull() ?: return null
    val count = term.toIntOrNull()?.takeIf { it > 0 } ?: return null
    if (amount <= BigDecimal.ZERO) return null
    return amount.divide(BigDecimal(count), 2, RoundingMode.HALF_UP).toPlainString()
}

internal fun extraChargeFields(concept: String, branchCharge: String?): String {
    if (concept == "Articulo") return "ninguno"
    require(branchCharge in setOf("boleta", "seguro", "ninguno")) {
        "No se conoce el cobro adicional de la sucursal; conéctate para actualizarla."
    }
    return branchCharge!!
}

/** Profit is derived, never typed: what the customer pays minus what the card cost. */
internal fun creditProfit(value: String, cost: String): String {
    val paid = value.toBigDecimalOrNull() ?: return "0"
    val spent = cost.toBigDecimalOrNull() ?: return "0"
    return paid.subtract(spent).toPlainString()
}
