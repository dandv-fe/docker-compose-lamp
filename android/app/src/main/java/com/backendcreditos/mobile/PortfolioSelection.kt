package com.backendcreditos.mobile

internal enum class PortfolioTap { SELECT, OPEN }

// A card only opens when the pointer was placed by tapping that very card. Pointer moves coming
// from the arrows or from the marked list leave it disarmed, so the next tap selects instead of
// jumping straight into the payments screen.
internal fun portfolioTap(
    selectedCreditId: String?, tappedCreditId: String, pointerArmed: Boolean = true,
): PortfolioTap =
    if (pointerArmed && selectedCreditId == tappedCreditId) PortfolioTap.OPEN else PortfolioTap.SELECT

// An empty list means the branch cache has not been loaded yet, so the pointer is kept
// instead of being dropped before the portfolio appears.
internal fun keepSelection(selectedCreditId: String?, cachedCreditIds: Collection<String>): String? =
    if (cachedCreditIds.isEmpty()) selectedCreditId
    else selectedCreditId?.takeIf { it in cachedCreditIds }

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
