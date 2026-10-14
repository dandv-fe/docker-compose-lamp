package com.backendcreditos.mobile

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ChallengePresentationTest {
    @Test fun animationRunsOnlyOncePerChallengeRevisionWithinSession() {
        val session = ChallengePresentationLedger()
        val key = ChallengePresentationKey("1", "3")
        assertTrue(session.claim(key, 1f))
        assertFalse(session.claim(key, 1f))
        assertTrue(session.claim(key.copy(revision = "4"), 1f))
        assertTrue(session.claim(key.copy(challengeId = "2"), 1f))
        assertTrue(ChallengePresentationLedger().claim(key, 1f))
    }

    @Test fun reducedOrInvalidSystemAnimationScaleNeverAnimatesOrReplays() {
        for (scale in listOf(0f, -1f, Float.NaN, Float.POSITIVE_INFINITY)) {
            val session = ChallengePresentationLedger()
            val key = ChallengePresentationKey("1", "3")
            assertFalse(session.claim(key, scale))
            assertFalse(session.claim(key, 1f))
        }
    }

    @Test fun repliesAreScopedToOwnAccountTokenBranchAndActiveRequest() {
        val target = PayrollScope("own-account", "1", "token")
        assertTrue(payrollReplyIsCurrent(target, "own-account", "1", "token", 3, 3))
        assertFalse(payrollReplyIsCurrent(target, "another-account", "1", "token", 3, 3))
        assertFalse(payrollReplyIsCurrent(target, "own-account", "2", "token", 3, 3))
        assertFalse(payrollReplyIsCurrent(target, "own-account", "1", "new-token", 3, 3))
        assertFalse(payrollReplyIsCurrent(target, null, null, null, 3, 3))
        assertFalse(payrollReplyIsCurrent(target, "own-account", "1", "token", 2, 3))
    }
}
