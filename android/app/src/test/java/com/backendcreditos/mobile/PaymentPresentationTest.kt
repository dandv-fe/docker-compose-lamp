package com.backendcreditos.mobile

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class PaymentPresentationTest {
    @Test fun greenOnlyForOwnActiveAbonoAndCInicial() {
        for ((state, expected) in listOf("created" to Color(0xFF4B965B), "entregando" to Color(0xFF1F5B2C))) {
            assertEquals(expected, classifyPayment("Abono->99", state, true).background)
            assertEquals(expected, classifyPayment("c-Inicial->80", state, true).background)
            assertEquals(Color(0xFF343A40), classifyPayment("Abono", state, false).background)
            assertEquals(Color(0xFF343A40), classifyPayment("c-Inicial", state, false).background)
        }
        for (description in listOf("Abono", "c-Inicial->80")) {
            assertEquals(Color(0xFF343A40), classifyPayment(description, "saved", true).background)
        }
        for (description in listOf("Inicial", "Descuento: motivo", "Cancelado")) {
            val background = classifyPayment(description, "created", true).background
            assertNotEquals(Color(0xFF4B965B), background)
            assertNotEquals(Color(0xFF1F5B2C), background)
        }
    }

    @Test fun formatsEachPartOfFullName() {
        assertEquals("María De Los Ángeles Pérez-García", formatPersonName("  MARÍA DE LOS ÁNGELES PÉREZ-GARCÍA  "))
    }

    @Test fun separatesTypeFromDetailForHistoricalDescriptions() {
        val examples = listOf(
            Triple("Saldo corregido-> un asunto util", "Saldo corregido", "un asunto util"),
            Triple("Pagado->1200", "Pagado", "1200"),
            Triple("Intereses: Ya esta vencida", "Intereses", "Ya esta vencida"),
            Triple("Inicial", "Cuota inicial", ""),
            Triple("Descuento: sdfsfsd sgsdsdf", "Descuento", "sdfsfsd sgsdsdf"),
            Triple("Cancelado", "Cancelado", ""),
            Triple("Cancelada->68", "Cancelada", "68"),
            Triple("c-Inicial->80", "c-Inicial", "80"),
            Triple("Abono->99", "Abono", "99"),
            Triple("2024/04/08->Intereces", "Intereses", "2024/04/08"),
            Triple("registro desconocido", "Movimiento", "registro desconocido")
        )
        for ((description, type, detail) in examples) {
            val result = classifyPayment(description, "created")
            assertEquals(description, type, result.type)
            assertEquals(description, detail, result.detail)
        }
    }

    @Test fun moneyUsesColombianGroupingAndTwoDecimals() {
        assertEquals("$ 1.200.000,00", formatMoney("1200000"))
        assertEquals("$ 50,00", formatMoney("50"))
        assertEquals("$ 99,99", formatMoney("99.994"))
        assertEquals("—", formatMoney(null))
        assertEquals("—", formatMoney("no es un numero"))
    }

    @Test fun createdAtIsReadableWhateverShapeItArrivesIn() {
        val bogota = java.time.ZoneId.of("America/Bogota")
        // Epoch milliseconds, which is what GraphQL's String type makes of a MySQL DATETIME.
        assertEquals("08/04/2024 · 01:45 p.m.", formatPaymentMoment("1712601900000", bogota))
        assertEquals("08/04/2024 · 01:45 p.m.", formatPaymentMoment("2024-04-08 13:45:00", bogota))
        assertEquals("08/04/2024 · 01:45 p.m.", formatPaymentMoment("2024-04-08T18:45:00Z", bogota))
        assertEquals("Sin fecha", formatPaymentMoment(null, bogota))
        assertEquals("texto raro", formatPaymentMoment("texto raro", bogota))
    }

    @Test fun balanceAfterEachMovementWalksBackFromTheCurrentBalance() {
        val balances = runningBalances(
            java.math.BigDecimal("1000"),
            listOf(java.math.BigDecimal("-200"), java.math.BigDecimal("-300"), java.math.BigDecimal("500"))
        )
        assertEquals(
            listOf("1000.00", "1200.00", "1500.00"),
            balances.map { it?.toPlainString() }
        )
    }

    @Test fun balanceColumnStaysEmptyWhenItCannotBeTrusted() {
        assertEquals(listOf(null, null), runningBalances(null, listOf(java.math.BigDecimal.ONE, null)))
        assertEquals(
            listOf("1000.00", null),
            runningBalances(java.math.BigDecimal("1000"), listOf(null, java.math.BigDecimal("-50")))
                .map { it?.toPlainString() }
        )
    }
}
