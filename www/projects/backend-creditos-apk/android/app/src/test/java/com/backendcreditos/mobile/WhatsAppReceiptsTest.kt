package com.backendcreditos.mobile

import com.backendcreditos.mobile.data.OperationKind
import com.backendcreditos.mobile.data.OperationPayloadMapper
import com.backendcreditos.mobile.queue.RouteGuard
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class WhatsAppReceiptsTest {
    // 2026-03-10 09:00 in Bogotá (UTC-5).
    private val now = Instant.parse("2026-03-10T14:00:00Z")

    @Test fun todayIsJudgedInBusinessZoneForEpochSqlAndIso() {
        val todayEpoch = Instant.parse("2026-03-10T05:30:00Z").toEpochMilli().toString() // 00:30 Bogotá
        assertTrue(createdOnBusinessDay(todayEpoch, now))
        assertTrue(createdOnBusinessDay("2026-03-10 00:00:05", now))
        assertTrue(createdOnBusinessDay("2026-03-10T08:00:00-05:00", now))
        assertTrue(createdOnBusinessDay("2026-03-10T13:59:00Z", now))
    }

    @Test fun yesterdayAndBeforeBusinessMidnightAreNotToday() {
        // 04:59 UTC on the 10th is still the 9th in Bogotá, though already the 10th in UTC.
        assertFalse(createdOnBusinessDay(Instant.parse("2026-03-10T04:59:00Z").toEpochMilli().toString(), now))
        assertFalse(createdOnBusinessDay("2026-03-09 23:59:59", now))
        assertFalse(createdOnBusinessDay("2026-03-09T23:00:00-05:00", now))
        assertFalse(createdOnBusinessDay("2026-03-11 00:00:00", now))
        assertFalse(createdOnBusinessDay(null, now))
        assertFalse(createdOnBusinessDay("ayer", now))
    }

    @Test fun onlyCreatedOrEntregandoStatesQualify() {
        val today = "2026-03-10 08:00:00"
        assertTrue(receiptEligible("created", today, now))
        assertTrue(receiptEligible(" Entregando ", today, now))
        for (state in listOf("saved", "deleted", "anulado", "", null)) assertFalse(receiptEligible(state, today, now))
        assertFalse(receiptEligible("created", "2026-03-09 08:00:00", now))
    }

    @Test fun cardTargetIsTheCreatedCardId() {
        assertEquals(ReceiptTarget(ReceiptKind.CREDIT, "card-1"),
            receiptTargetFor(OperationKind.CREATE_CREDIT, "card-1", """{"idtarjeta":"card-1","idcliente":"7"}"""))
        assertNull(receiptTargetFor(OperationKind.CREATE_CREDIT, "card-1", """{"idtarjeta":"other"}"""))
    }

    @Test fun createPaymentTargetsPayloadAbonoNotCreditEntity() {
        val target = receiptTargetFor(OperationKind.CREATE_PAYMENT, "card-1", """{"iddescripcion":"pay-9","abono":-5000}""")
        assertEquals(ReceiptTarget(ReceiptKind.PAYMENT, "pay-9"), target)
        assertEquals("card-1", receiptCreditIdFor(OperationKind.CREATE_PAYMENT, "card-1", target!!, null))
        // Without iddescripcion the credit id must never be mistaken for the abono.
        assertNull(receiptTargetFor(OperationKind.CREATE_PAYMENT, "card-1", """{"abono":-5000}"""))
        assertNull(receiptTargetFor(OperationKind.CREATE_PAYMENT, "card-1", """{"iddescripcion":"card-1"}"""))
    }

    @Test fun updatePaymentTargetsEntityAndUsesCachedCard() {
        val target = receiptTargetFor(OperationKind.UPDATE_PAYMENT, "pay-3", """{"abono":-1}""")!!
        assertEquals(ReceiptTarget(ReceiptKind.PAYMENT, "pay-3"), target)
        assertEquals("card-4", receiptCreditIdFor(OperationKind.UPDATE_PAYMENT, "pay-3", target, "card-4"))
        assertNull(receiptCreditIdFor(OperationKind.UPDATE_PAYMENT, "pay-3", target, null))
        assertNull(receiptTargetFor(OperationKind.UPDATE_CREDIT, "card-1", "{}"))
        assertNull(receiptTargetFor(OperationKind.DELETE_PAYMENT, "pay-3", "{}"))
    }

    @Test fun initialInstallmentComesFromCreditPayload() {
        val initial = initialInstallmentFromPayload(
            """{"cuotaInicial":100000,"bancosInicial":[{"idbanco":1,"valor":60000},{"idbanco":2,"valor":15000}]}"""
        )
        assertEquals(InitialInstallment("100000", "75000"), initial)
        assertEquals(InitialInstallment("5000", null), initialInstallmentFromPayload("""{"cuotaInicial":5000}"""))
        assertNull(initialInstallmentFromPayload("""{"cuotaInicial":0}"""))
        assertNull(initialInstallmentFromPayload("""{"valor":1}"""))
        assertTrue(isInitialInstallment(" inicial "))
        assertFalse(isInitialInstallment("Abono"))
        assertTrue(isArticle("Articulo"))
        assertFalse(isArticle("Prestamo"))
    }

    @Test fun articleReceiptCarriesInitialInstallmentInSameMessage() {
        val message = creditCreatedMessage(
            "Ana", "600000", "semanal", 10, "500000", "Articulo", "Luis",
            LocalDateTime.of(2026, 3, 10, 9, 15), articleDescription = "Nevera  Haceb",
            initialPayment = "100000", initialBankAmount = "40000"
        )
        assertTrue(message, message.contains("(Articulo: Nevera Haceb) por \$600.000."))
        assertTrue(message, message.contains("Cuota inicial recibida: \$100.000 (por transferencia \$40.000)."))
        assertTrue(message, message.contains("Saldo pendiente: \$500.000."))
        assertTrue(message, message.contains("Plazo: 10"))
        assertEquals(1, Regex("Saldo pendiente").findAll(message).count())
        assertFalse(message.contains("recibimos su abono"))
    }

    @Test fun articleBalanceIgnoresLaterMovementsOfTheDay() {
        // Cached balance already moved by something else: the receipt states value − initial.
        val message = creditCreatedMessage(
            "Ana", "600000", "semanal", 10, "450000", "Articulo", null,
            LocalDateTime.of(2026, 3, 10, 9, 15), initialPayment = "100000"
        )
        assertTrue(message, message.contains("Saldo pendiente: \$500.000."))
        assertFalse(message.contains("transferencia"))
    }

    @Test fun loanReceiptWithoutInitialKeepsPreviousShape() {
        val message = creditCreatedMessage("Ana", "600000", "diario", 30, "600000", "Prestamo", "Luis",
            LocalDateTime.of(2026, 3, 10, 9, 15))
        assertFalse(message.contains("Cuota inicial"))
        assertFalse(message.contains("Saldo pendiente"))
    }

    @Test fun receiptPayloadIsStrictAndPhoneOptional() {
        val target = ReceiptTarget(ReceiptKind.PAYMENT, "pay-9")
        assertEquals("""{"tipo":"payment","registroId":"pay-9","telefono":"573000000001"}""",
            OperationPayloadMapper.whatsappReceipt("573000000001", target).toString())
        assertEquals("""{"tipo":"credit","registroId":"c"}""",
            OperationPayloadMapper.whatsappReceipt(null, ReceiptTarget(ReceiptKind.CREDIT, "c")).toString())
        for (raw in listOf("", "3000000001", "+573000000001")) {
            assertThrows(IllegalArgumentException::class.java) { OperationPayloadMapper.whatsappReceipt(raw, target) }
        }
        assertThrows(IllegalArgumentException::class.java) {
            OperationPayloadMapper.whatsappReceipt(null, ReceiptTarget(ReceiptKind.CREDIT, "x".repeat(51)))
        }
    }

    @Test fun receiptCounterIsNotRouteBoundAndHidesCounts() {
        assertFalse(RouteGuard.isRouteBound(OperationKind.RECORD_WHATSAPP_RECEIPT))
        val summary = summarizeOperation(OperationKind.RECORD_WHATSAPP_RECEIPT,
            """{"tipo":"credit","registroId":"c","telefono":"573000000001"}""", null, null)
        assertTrue(summary.details.joinToString(), summary.details.any { it.contains("no confirma envío") })
        assertFalse(summary.details.any { it.contains("aperturas") || it.contains("veces") })
    }

    @Test fun zoneDefaultIsBogota() {
        assertEquals(ZoneId.of("America/Bogota"), RECEIPT_ZONE)
    }

    @Test fun signedReceiptLinkIsAppendedOnceWithoutDiscardingUserEdits() {
        val edited = "Hola Ana, texto editado."
        val link = "https://recibos.example/comprobante/AbC123"
        val withLink = appendReceiptLink(edited, link)
        assertTrue(withLink.startsWith(edited))
        assertEquals(1, Regex(Regex.escape(link)).findAll(appendReceiptLink(withLink, link)).count())
        assertEquals(edited, removeReceiptLink(withLink, link))
    }

    @Test fun unknownStoredReceiptFormatRequiresAnExplicitChoice() {
        assertEquals("ticket", canonicalReceiptFormat(" Ticket "))
        assertEquals("factura", canonicalReceiptFormat("FACTURA"))
        assertEquals("cartulina", canonicalReceiptFormat("Cartulina"))
        assertNull(canonicalReceiptFormat("factura electrónica"))
        assertNull(canonicalReceiptFormat(null))
    }
}
