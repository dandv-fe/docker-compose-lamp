package com.backendcreditos.mobile.security

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PaymentAccessTest {
    @Test fun `blocks at cutoff but not before`() {
        assertFalse(paymentAccessBlocked(1_000L, 999L))
        assertTrue(paymentAccessBlocked(1_000L, 1_000L))
        assertTrue(paymentAccessBlocked(1_000L, 1_001L))
    }

    @Test fun `requires online validation of sessions created before the payment check`() {
        assertTrue(paymentAccessBlocked(-1L, 0L))
        assertFalse(paymentAccessBlocked(null, Long.MAX_VALUE))
    }
}
