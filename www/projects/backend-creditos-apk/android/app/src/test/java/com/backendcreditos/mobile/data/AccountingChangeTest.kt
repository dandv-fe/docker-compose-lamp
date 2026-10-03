package com.backendcreditos.mobile.data

import com.backendcreditos.mobile.network.AccountingChangeDto
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AccountingChangeTest {
    private val json = Json { ignoreUnknownKeys = true }

    private fun decode(raw: String) =
        json.decodeFromString(AccountingChangeDto.serializer(), raw)

    private val expenseChange = """
        {"id":"e865281eb9461","amount":"-1500.00","name":"gasolina","detail":"tanqueada",
         "operation":"salida-totalizar","state":"created","accountingType":1,"routeId":77787,
         "createdEmployeeId":2,"createdAt":"2026-09-30T23:18:55.000Z","payrollId":null,
         "personName":"Ana Ruiz"}
    """.trimIndent()

    @Test
    fun `reads the decimal MySQL sends as text and drops the sign`() {
        val entry = decode(expenseChange).toRouteEntry("a", "8")
        assertEquals("expense", entry?.kind)
        assertEquals("1500.0", entry?.amount)
        assertEquals("gasolina", entry?.name)
        assertEquals("tanqueada", entry?.detail)
        assertEquals("Ana Ruiz", entry?.personName)
        assertEquals(1790810335000L, entry?.createdAt)
    }

    @Test
    fun `a base is recognised by its name`() {
        val entry = decode(
            """{"id":"b1","amount":"2500.00","name":"base","operation":"entrada-totalizar",
                "state":"created"}"""
        ).toRouteEntry("a", "8")
        assertEquals("base", entry?.kind)
        assertEquals("2500.0", entry?.amount)
        assertNull(entry?.personName)
    }

    @Test
    fun `the counted cash of the settlement is not a gasto`() {
        val entry = decode(
            """{"id":"c1","amount":"90000.00","name":"efectivo","operation":"info-totalizar",
                "state":"created"}"""
        ).toRouteEntry("a", "8")
        assertNull(entry)
    }

    @Test
    fun `a row already handed in belongs to a closed day`() {
        val entry = decode(
            """{"id":"d1","amount":"-500.00","name":"gasolina","operation":"salida-totalizar",
                "state":"entregando"}"""
        ).toRouteEntry("a", "8")
        assertNull(entry)
    }
}
