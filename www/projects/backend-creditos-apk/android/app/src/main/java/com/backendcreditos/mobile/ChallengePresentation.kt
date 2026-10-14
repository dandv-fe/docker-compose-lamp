package com.backendcreditos.mobile

internal data class ChallengePresentationKey(
    val challengeId: String,
    val revision: String
)

/** Kept in memory for one authenticated session, not shared between accounts or tokens. */
internal class ChallengePresentationLedger {
    private val seen = mutableSetOf<ChallengePresentationKey>()

    fun claim(key: ChallengePresentationKey, animationScale: Float): Boolean {
        val firstPresentation = seen.add(key)
        return firstPresentation && animationScale.isFinite() && animationScale > 0f
    }
}
