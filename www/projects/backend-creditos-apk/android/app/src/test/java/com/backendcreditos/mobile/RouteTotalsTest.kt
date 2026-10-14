package com.backendcreditos.mobile

import com.backendcreditos.mobile.data.CreditEntity
import com.backendcreditos.mobile.data.PaymentEntity
import org.junit.Assert.assertEquals
import org.junit.Test
import java.math.BigDecimal

class RouteTotalsTest {
    @Test fun loanCashWarningChecksCapitalAndNeverInventsUnknownCash() {
        val totals = RouteTotals(0, 0, BigDecimal.ZERO, BigDecimal.ZERO)
        assertEquals(null, loanCashWarning(totals, "100", "0", "0", "100"))
        org.junit.Assert.assertTrue(loanCashWarning(totals, "99", "0", "0", "100")!!.contains("no tiene dinero disponible"))
        org.junit.Assert.assertTrue(loanCashWarning(totals, "0", "0", "0", "1")!!.contains("no tiene dinero disponible"))
        org.junit.Assert.assertTrue(loanCashWarning(totals, "-10", "0", "0", "1")!!.contains("no tiene dinero disponible"))
        org.junit.Assert.assertTrue(loanCashWarning(totals, null, "0", "0", "100")!!.contains("No se conoce"))
        org.junit.Assert.assertTrue(loanCashWarning(totals, "mal", "0", "0", "100")!!.contains("No se conoce"))
        assertEquals(null, loanCashWarning(totals, null, null, null, ""))
        val bank = RouteTotals(1, 1, BigDecimal("100"), BigDecimal("100"),
            collectedBank = BigDecimal("100"), creditsBank = BigDecimal("100"))
        org.junit.Assert.assertTrue(loanCashWarning(bank, "50", "0", "10", "41")!!.contains("Disponible: 40"))
        assertEquals(null, loanCashWarning(bank, "50", "0", "10", "40"))
    }

    private fun credit(id: String, status: String, principal: String?, insurance: String? = null) = CreditEntity(
        "a", "1", id, "c", null, null, null, null, null, null, principal, null, null, null, status,
        additionalValue = insurance
    )

    private fun payment(id: String, creditId: String, amount: String, description: String, state: String) =
        PaymentEntity("a", "1", id, creditId, amount, description, state, null, null, null)

    @Test
    fun matchesWebRecaudoAndCreditRules() {
        val credits = listOf(
            credit("1", "refinanciada", "100000"),
            credit("2", "created", "200000"),
            credit("3", "entregando", "50000"),
            credit("4", "saved", "999999")
        )
        val payments = listOf(
            payment("p1", "1", "-5000", "Abono", "created"),
            payment("p2", "1", "-1250", "Abono", "entregando"),
            payment("p3", "2", "-5000", "c-Inicial", "created"),
            payment("p4", "3", "-9000", "Abono", "saved"),
            payment("p5", "3", "-700", "Descuento", "created"),
            payment("p6", "4", "3000", "2026/09/01->Intereces", "created")
        )
        val totals = routeTotals(credits, payments)
        assertEquals(2, totals.cardsWithPayments)
        assertEquals(4, totals.totalCards)
        assertEquals(0, BigDecimal("11250").compareTo(totals.collected))
        assertEquals(0, BigDecimal("250000").compareTo(totals.newCredits))
        assertEquals("11.250", formatCompactMoney(totals.collected))
    }

    @Test
    fun fiveHundredCardsInOnePass() {
        val credits = (1..500).map { credit("$it", "refinanciada", "1000") }
        val payments = (1..500).map { payment("p$it", "$it", "-100", "Abono", "created") }
        val totals = routeTotals(credits, payments)
        assertEquals(500, totals.cardsWithPayments)
        assertEquals(0, BigDecimal("50000").compareTo(totals.collected))
    }

    @Test
    fun pocketCashAddsBaseCollectedIncomeAndInsuranceMinusExpensesAndCredits() {
        val credits = listOf(credit("1", "created", "200000", insurance = "4000"), credit("2", "refinanciada", "1"))
        val payments = listOf(payment("p1", "2", "-11250", "Abono", "created"))
        val cash = pocketCash(routeTotals(credits, payments), base = "700000", otherIncome = "20000", expenses = "96000")
        assertEquals(0, BigDecimal("24000").compareTo(cash.otherIncome))
        // 700.000 + 11.250 + 24.000 − 96.000 − 200.000
        assertEquals(0, BigDecimal("439250").compareTo(cash.total))
    }

    @Test
    fun pocketCashWithoutServerFiguresUsesOnlyLocalCards() {
        val cash = pocketCash(routeTotals(listOf(credit("1", "created", "50000")), emptyList()), null, null, null)
        assertEquals(0, BigDecimal("-50000").compareTo(cash.total))
    }

    @Test
    fun bankTransfersStayOutOfThePocket() {
        val credits = listOf(
            credit("1", "created", "200000").copy(bankFunded = "150000"),
            credit("2", "refinanciada", "1")
        )
        val payments = listOf(
            payment("p1", "2", "-30000", "Abono", "created").copy(bankAmount = "20000"),
            payment("p2", "1", "-5000", "Abono", "saved").copy(bankAmount = "5000")
        )
        val totals = routeTotals(credits, payments)
        assertEquals(0, BigDecimal("20000").compareTo(totals.collectedBank))
        assertEquals(0, BigDecimal("150000").compareTo(totals.creditsBank))
        val cash = pocketCash(totals, base = "100000", otherIncome = "0", expenses = "0")
        assertEquals(0, BigDecimal("10000").compareTo(cash.cashCollected))
        assertEquals(0, BigDecimal("50000").compareTo(cash.cashCredits))
        // 100.000 + 10.000 cash abono − 50.000 cash credit
        assertEquals(0, BigDecimal("60000").compareTo(cash.total))
    }

    @Test
    fun initialReceivedByTheCreatorCountsOnlyTheCashRemainder() {
        val credit = credit("new", "created", "900").copy(bankFunded = "600")
        val initial = payment("initial", "new", "-100", "Inicial", "created")
            .copy(bankAmount = "70", creatorUserId = 12, creatorUsername = "Cobradora")
        val totals = routeTotals(listOf(credit), listOf(initial))
        val cash = pocketCash(totals, base = "0", otherIncome = "0", expenses = "0")
        assertEquals(0, BigDecimal("30").compareTo(cash.cashCollected))
        assertEquals(0, BigDecimal("300").compareTo(cash.cashCredits))
        assertEquals(0, BigDecimal("-270").compareTo(cash.total))
        assertEquals(12, initial.creatorUserId)
    }
}
