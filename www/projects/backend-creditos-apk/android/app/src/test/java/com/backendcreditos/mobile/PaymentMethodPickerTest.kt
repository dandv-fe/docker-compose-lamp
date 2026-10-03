package com.backendcreditos.mobile

import com.backendcreditos.mobile.data.BankAccountEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class PaymentMethodPickerTest {
    @Test
    fun detailShowsAccountHolderAndDocument() {
        val bank = BankAccountEntity("a", "1", 3, "Bancolombia", "ahorros", "123-45", "Ana Ruiz", "900123456-1")
        assertEquals("ahorros 123-45 · Titular: Ana Ruiz · NIT/CC 900123456-1", bankAccountDetail(bank))
        assertEquals("", bankAccountDetail(bank.copy(type = null, number = " ", holderName = null, holderDocument = "")))
    }

    @Test
    fun blankBankAmountMeansTheWholeTotal() {
        assertEquals(emptyList<Any>(), PaymentMethodDraft().splits("100"))
        assertEquals("100", PaymentMethodDraft(bankId = 3).splits("100").single().amount)
        assertEquals("40", PaymentMethodDraft(bankId = 3, bankAmount = "40").splits("100").single().amount)
    }

    @Test
    fun cashChangeAppearsOnlyWhenTheTransferIsBigger() {
        assertEquals(0.0, PaymentMethodDraft(bankId = 3).cashChange("100"), 0.0001)
        assertEquals(0.0, PaymentMethodDraft(bankId = 3, bankAmount = "40").cashChange("100"), 0.0001)
        assertEquals(20.0, PaymentMethodDraft(bankId = 3, bankAmount = "120").cashChange("100"), 0.0001)
        assertEquals(0.0, PaymentMethodDraft().cashChange("100"), 0.0001)
    }

    @Test
    fun creditFundingRequiresExplicitCashOrAuthorizedOriginAccount() {
        val banks = listOf(BankAccountEntity("a", "1", 3, "Banco", "ahorros", "123", "Ana", "123"))
        assertThrows(IllegalArgumentException::class.java) {
            PaymentMethodDraft().requireCreditFunding(banks)
        }

        PaymentMethodDraft(edited = true).requireCreditFunding(emptyList())
        PaymentMethodDraft(bankId = 3, edited = true).requireCreditFunding(banks)
        assertThrows(IllegalArgumentException::class.java) {
            PaymentMethodDraft(bankId = 4, edited = true).requireCreditFunding(banks)
        }
    }

    @Test
    fun initialPaymentRequiresExplicitCollectorOrAuthorizedReceivingAccount() {
        val banks = listOf(BankAccountEntity("a", "1", 3, "Banco", "ahorros", "123", "Ana", "123"))
        assertThrows(IllegalArgumentException::class.java) {
            PaymentMethodDraft().requireInitialPaymentSource(banks)
        }
        PaymentMethodDraft(edited = true).requireInitialPaymentSource(emptyList())
        PaymentMethodDraft(bankId = 3, edited = true).requireInitialPaymentSource(banks)
        assertThrows(IllegalArgumentException::class.java) {
            PaymentMethodDraft(bankId = 4, edited = true).requireInitialPaymentSource(banks)
        }
    }
}
