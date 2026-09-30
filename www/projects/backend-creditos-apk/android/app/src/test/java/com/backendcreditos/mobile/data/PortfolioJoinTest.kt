package com.backendcreditos.mobile.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PortfolioJoinTest {
    @Test
    fun `joining a large route keeps credit order and reuses customer records`() {
        val customers = (1..250).map { id ->
            CustomerEntity("account", "branch", id.toString(), null, null, "Nombre $id", "Apellido", null, null)
        }
        val credits = (1..500).map { index ->
            CreditEntity("account", "branch", "card-$index", ((index + 1) / 2).toString(),
                null, null, null, null, null, null, null, null, null, index.toDouble(), "created")
        }
        val joined = joinPortfolio(credits, customers)

        assertEquals(500, joined.size)
        assertEquals(credits.map { it.id }, joined.map { it.credit.id })
        assertEquals("Nombre 1", joined[0].customer?.firstName)
        assertEquals(joined[0].customer, joined[1].customer)
        assertEquals("Nombre 250", joined.last().customer?.firstName)
    }

    @Test
    fun `missing customer does not attach a different route customer`() {
        val credit = CreditEntity("account", "branch", "card", "unknown",
            null, null, null, null, null, null, null, null, null, 1.0, "created")
        assertNull(joinPortfolio(listOf(credit), emptyList()).single().customer)
    }
}
