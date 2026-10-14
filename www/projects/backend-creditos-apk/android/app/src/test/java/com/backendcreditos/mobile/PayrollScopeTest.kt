package com.backendcreditos.mobile

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PayrollScopeTest {
    @Test fun lateRepliesCannotLeakAcrossAccountBranchSessionOrRefresh() {
        val target = PayrollScope("account", "1", "token")
        assertTrue(payrollReplyIsCurrent(target, "account", "1", "token", 2, 2))
        assertFalse(payrollReplyIsCurrent(target, "other", "1", "token", 2, 2))
        assertFalse(payrollReplyIsCurrent(target, "account", "2", "token", 2, 2))
        assertFalse(payrollReplyIsCurrent(target, "account", "1", "new-token", 2, 2))
        assertFalse(payrollReplyIsCurrent(target, null, null, null, 2, 2))
        assertFalse(payrollReplyIsCurrent(target, "account", "1", "token", 1, 2))
    }
}
