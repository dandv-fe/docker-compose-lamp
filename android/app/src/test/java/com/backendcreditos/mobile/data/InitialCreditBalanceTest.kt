package com.backendcreditos.mobile.data

import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class InitialCreditBalanceTest {
    @Test
    fun `total payable starts as the debt rather than the cost`() {
        val loan = buildJsonObject {
            put("valor", 140000)
            put("prestamo", 100000)
            put("cuotaInicial", 0)
        }
        assertEquals("140000", initialCreditBalance(loan))
    }

    @Test
    fun `an actual initial payment reduces the starting debt`() {
        val article = buildJsonObject {
            put("valor", 140000)
            put("prestamo", 100000)
            put("cuotaInicial", 20000)
        }
        assertEquals("120000", initialCreditBalance(article))
        assertThrows(IllegalArgumentException::class.java) {
            initialCreditBalance(buildJsonObject {
                put("valor", 100)
                put("cuotaInicial", 101)
            })
        }
    }
}
