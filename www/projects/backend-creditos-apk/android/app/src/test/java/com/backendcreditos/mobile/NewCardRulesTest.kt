package com.backendcreditos.mobile

import org.junit.Assert.assertEquals
import org.junit.Test

class NewCardRulesTest {
    @Test
    fun `keeps the zero padding the branch configured`() {
        assertEquals("0002", nextReceiptNumber("0001"))
        assertEquals("7169", nextReceiptNumber("7168"))
        assertEquals("0100", nextReceiptNumber("0099"))
    }

    @Test
    fun `starts at one when the branch has no previous receipt`() {
        assertEquals("1", nextReceiptNumber(null))
        assertEquals("1", nextReceiptNumber("   "))
    }

    @Test
    fun `only the numeric tail is incremented`() {
        assertEquals("A-0008", nextReceiptNumber("A-0007"))
        assertEquals("SINNUMERO", nextReceiptNumber("SINNUMERO"))
    }

    @Test
    fun `first and last clear the edges of the portfolio`() {
        val orders = listOf(1.0, 2.0, 3.0)
        assertEquals(-0.1, placementSortOrder(orders, 1, CardPlacement.FIRST), 0.0001)
        assertEquals(4.1, placementSortOrder(orders, 1, CardPlacement.LAST), 0.0001)
    }

    @Test
    fun `before and after land between the neighbours`() {
        val orders = listOf(1.0, 2.0, 3.0)
        assertEquals(1.5, placementSortOrder(orders, 1, CardPlacement.BEFORE), 0.0001)
        assertEquals(2.5, placementSortOrder(orders, 1, CardPlacement.AFTER), 0.0001)
    }

    @Test
    fun `before the first and after the last still jump past the edge`() {
        val orders = listOf(1.0, 2.0, 3.0)
        assertEquals(-0.1, placementSortOrder(orders, 0, CardPlacement.BEFORE), 0.0001)
        assertEquals(4.1, placementSortOrder(orders, 2, CardPlacement.AFTER), 0.0001)
    }

    @Test
    fun `an empty portfolio starts at one`() {
        assertEquals(1.0, placementSortOrder(emptyList(), 0, CardPlacement.AFTER), 0.0001)
    }

    @Test
    fun `profit is what the customer pays minus what the card cost`() {
        assertEquals("40000", creditProfit("140000", "100000"))
        assertEquals("0.50", creditProfit("1.00", "0.50"))
        assertEquals("0", creditProfit("", "100"))
    }
}
