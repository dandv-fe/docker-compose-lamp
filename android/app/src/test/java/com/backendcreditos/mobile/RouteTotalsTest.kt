package com.backendcreditos.mobile

import com.backendcreditos.mobile.data.CreditEntity
import com.backendcreditos.mobile.data.PaymentEntity
import org.junit.Assert.assertEquals
import org.junit.Test
import java.math.BigDecimal

class RouteTotalsTest {
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
}
