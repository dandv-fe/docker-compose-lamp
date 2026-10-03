package com.backendcreditos.mobile

internal enum class PortfolioTap { SELECT, OPEN }

// A card only opens when the pointer was placed by tapping that very card. Pointer moves coming
// from the arrows or from the marked list leave it disarmed, so the next tap selects instead of
// opening the inline abono form.
internal fun portfolioTap(
    selectedCreditId: String?, tappedCreditId: String, pointerArmed: Boolean = true,
): PortfolioTap =
    if (pointerArmed && selectedCreditId == tappedCreditId) PortfolioTap.OPEN else PortfolioTap.SELECT

// An empty list means the branch cache has not been loaded yet, so the pointer is kept.
// When a selected card disappears, stay near its former route position: previous first,
// then next. With no previous selection, the route starts at its first card.
internal fun keepSelection(
    selectedCreditId: String?,
    previousCreditIds: List<String>,
    cachedCreditIds: List<String>,
): String? {
    if (cachedCreditIds.isEmpty()) return selectedCreditId
    if (selectedCreditId == null) return cachedCreditIds.first()
    if (selectedCreditId in cachedCreditIds) return selectedCreditId
    val previousIndex = previousCreditIds.indexOf(selectedCreditId)
    if (previousIndex < 0) return cachedCreditIds.first()
    for (index in previousIndex - 1 downTo 0) {
        previousCreditIds[index].takeIf { it in cachedCreditIds }?.let { return it }
    }
    for (index in previousIndex + 1 until previousCreditIds.size) {
        previousCreditIds[index].takeIf { it in cachedCreditIds }?.let { return it }
    }
    return cachedCreditIds.first()
}

// Arrow navigation walks the currently visible (filtered) list. It stops at both ends,
// which is what disables the arrows, and starts at an end when nothing is pointed.
internal fun pointerStep(
    pointedCreditId: String?, visibleCreditIds: List<String>, forward: Boolean,
): String? {
    if (visibleCreditIds.isEmpty()) return null
    val index = visibleCreditIds.indexOf(pointedCreditId)
    if (index < 0) return if (forward) visibleCreditIds.first() else visibleCreditIds.last()
    return visibleCreditIds.getOrNull(if (forward) index + 1 else index - 1)
}

// 1-based position shown inside the counter button; null hides the number and disables it.
internal fun pointerPosition(pointedCreditId: String?, visibleCreditIds: List<String>): Int? {
    val index = visibleCreditIds.indexOf(pointedCreditId ?: return null)
    return if (index < 0) null else index + 1
}
