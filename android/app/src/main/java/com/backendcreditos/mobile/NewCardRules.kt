package com.backendcreditos.mobile

/** Where the new card is placed relative to the one it was created from. */
internal enum class CardPlacement { FIRST, BEFORE, AFTER, LAST }

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
    val anchor = sortedOrders.getOrNull(index) ?: sortedOrders.last()
    return when (placement) {
        CardPlacement.FIRST -> sortedOrders.first() - 1.1
        CardPlacement.LAST -> sortedOrders.last() + 1.1
        CardPlacement.BEFORE -> sortedOrders.getOrNull(index - 1)
            ?.let { previous -> (previous + anchor) / 2 } ?: (anchor - 1.1)
        CardPlacement.AFTER -> sortedOrders.getOrNull(index + 1)
            ?.let { next -> (anchor + next) / 2 } ?: (anchor + 1.1)
    }
}

/** Profit is derived, never typed: what the customer pays minus what the card cost. */
internal fun creditProfit(value: String, cost: String): String {
    val paid = value.toBigDecimalOrNull() ?: return "0"
    val spent = cost.toBigDecimalOrNull() ?: return "0"
    return paid.subtract(spent).toPlainString()
}
