package com.backendcreditos.mobile

import com.backendcreditos.mobile.data.BankAccountEntity
import org.junit.Assert.assertEquals
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
}
