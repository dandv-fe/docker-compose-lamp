package com.backendcreditos.mobile

import com.backendcreditos.mobile.network.CashBonusContext
import com.backendcreditos.mobile.network.CashBonusEmployee
import org.junit.Assert.*
import org.junit.Test

class CashBonusTest {
    private val context = CashBonusContext(1, 2, "created", listOf(CashBonusEmployee(3, "Ana")))
    private val valid = CashBonusDraft(3, "100.50", "Bono por gestión")

    @Test fun onlySelectedAuthorizedEmployeeOpenDispatchAndValidCurrencyAreAccepted() {
        assertNull(cashBonusInputError(valid, context))
        for (amount in listOf("0", "-1", "100000000", "1.001", "abc")) {
            assertNotNull(cashBonusInputError(valid.copy(amount = amount), context))
        }
        assertNull(cashBonusInputError(valid.copy(amount = "99999999.99"), context))
        assertNotNull(cashBonusInputError(valid.copy(employeeId = 4), context))
        assertNotNull(cashBonusInputError(valid, context.copy(state = "saved")))
        assertNotNull(cashBonusInputError(valid.copy(reason = " "), context))
        assertNull(cashBonusInputError(valid.copy(reason = "😀".repeat(250)), context))
        assertNotNull(cashBonusInputError(valid.copy(reason = "😀".repeat(251)), context))
    }

    @Test fun unchangedRetryKeepsTokenButNewInputGetsANewToken() {
        assertEquals(valid.token, updatedCashBonusDraft(valid, valid.copy()).token)
        assertNotEquals(valid.token, updatedCashBonusDraft(valid, valid.copy(amount = "200")).token)
        assertNotEquals(valid.token, updatedCashBonusDraft(valid, valid.copy(employeeId = 4)).token)
        assertNotEquals(valid.token, updatedCashBonusDraft(valid, valid.copy(reason = "Otro motivo")).token)
        assertNotEquals(valid.token, CashBonusDraft().token)
        val target = PayrollScope("own", "1", "token")
        assertFalse(payrollReplyIsCurrent(target, "other", "1", "token", 0, 0))
        assertFalse(payrollReplyIsCurrent(target, "own", "2", "token", 0, 0))
    }
}
