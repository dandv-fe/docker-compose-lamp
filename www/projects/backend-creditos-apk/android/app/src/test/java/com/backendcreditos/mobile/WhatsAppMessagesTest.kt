package com.backendcreditos.mobile

import java.time.LocalDateTime
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import com.backendcreditos.mobile.network.CustomerPhoneDto

class WhatsAppMessagesTest {
    private fun phone(id: String, number: String, count: String = "0") =
        CustomerPhoneDto(id, number, number, count)

    @Test fun ranksSharedCountsBeforePrimaryAndKeepsStableTies() {
        val phones = listOf(phone("a", "573000000001", "2"), phone("b", "573000000002", "20"),
            phone("c", "573000000003", "2"), phone("d", "573000000004", "2"))
        assertEquals(listOf("b", "c", "a", "d"),
            rankedWhatsAppPhones(phones, "3000000003").map { it.id })
    }

    @Test fun rankingExcludesInvalidLegacyAndHandlesLargeCounts() {
        val phones = listOf(CustomerPhoneDto("bad", "300 / 310"),
            phone("invalid", "123"), phone("a", "573000000001", "9007199254740993"),
            phone("b", "573000000002", "9007199254740992"))
        assertEquals(listOf("a", "b"), rankedWhatsAppPhones(phones, "573000000002").map { it.id })
    }

    @Test fun pendingUsageReplayIsIdempotentAndKeepsOtherPhones() {
        val phones = listOf(phone("a", "573000000001", "10"), phone("b", "573000000002", "20"))
        val updated = withPendingWhatsAppOpen(phones, "573000000001", "operation", "2026-10-02T12:00:00")
        assertEquals("11", updated.first().whatsappOpenCount)
        assertEquals(phones.last(), updated.last())
        assertEquals(updated, withPendingWhatsAppOpen(updated, "573000000001", "operation", "2026-10-03T12:00:00"))
        // A fresh server list resets local markers; only still-pending operations are overlaid.
        assertEquals("21", withPendingWhatsAppOpen(listOf(phone("a", "573000000001", "20")),
            "573000000001", "operation", "2026-10-02T12:00:00").first().whatsappOpenCount)
    }
    @Test fun incorrectPhonesRemainHistoryButNeverRankOrFallbackOrCount() {
        val incorrect = phone("bad", "573000000001", "999").copy(invalid = true)
        val history = listOf(incorrect, phone("good", "573000000002"))
        assertEquals(listOf("good"), rankedWhatsAppPhones(history, "3000000001").map { it.id })
        assertNull(validWhatsAppPrimary(history, "3000000001"))
        assertEquals("573000000003", validWhatsAppPrimary(history, "3000000003"))
        assertEquals(history, withPendingWhatsAppOpen(history, "573000000001", "op", "2026-10-02"))
        assertEquals(2, history.size)
        val restored = history.map { if (it.id == "bad") it.copy(invalid = false) else it }
        assertEquals("bad", rankedWhatsAppPhones(restored, null).first().id)
        assertEquals("573000000001", validWhatsAppPrimary(restored, "3000000001"))
    }
    @Test fun readdingIncorrectPrimaryKeepsFlagAuditAndAllHistory() {
        val history = listOf(phone("a", "573000000001").copy(invalid = true, validityChangedBy = "9",
            validityChangedAt = "2026-10-02"), CustomerPhoneDto("legacy", "300 / 310"))
        val updated = phoneHistoryWithPrimary(history, "3000000001", "+57 3000000001")
        assertEquals(history, updated)
        assertNull(validWhatsAppPrimary(updated, "3000000001"))
    }

    @Test fun pendingAddThenMarkThenRestoreReplaysAcrossFreshSnapshotWithoutLosingHistory() {
        val snapshot = listOf(phone("a", "573000000001"))
        val added = phoneHistoryWithPrimary(snapshot, "3000000001", "3000000002")
        val marked = withPendingPhoneValidity(added, "573000000002", true, "mark")
        assertEquals(marked, withPendingPhoneValidity(marked, "573000000002", true, "mark"))
        assertEquals(2, marked.size)
        assertTrue(marked.last().invalid)
        val restored = withPendingPhoneValidity(marked, "573000000002", false, "restore")
        assertEquals(false, restored.last().invalid)
        val snapshotReplay = withPendingPhoneValidity(withPendingPhoneValidity(
            phoneHistoryWithPrimary(snapshot, "3000000001", "3000000002"), "573000000002", true, "mark"),
            "573000000002", false, "restore")
        assertEquals(restored, snapshotReplay)
        assertEquals(added, withoutPendingPhoneValidity(restored))
    }

    @Test fun rejectedRestorationRollsBackToIncorrectWithoutErasingHistoryOrAudit() {
        val original = listOf(phone("a", "573000000001").copy(invalid = true, validityChangedBy = "9"))
        val pending = withPendingPhoneValidity(original, "573000000001", false, "restore")
        assertEquals(original, withoutPendingPhoneValidity(pending))
        assertTrue(withoutPendingPhoneValidity(pending).single().invalid)
    }
    private val moment = LocalDateTime.of(2026, 10, 2, 9, 30)

    @Test fun colombianMobileGetsCountryCode() {
        assertEquals("573023085506", whatsAppPhone("302 308 5506"))
        assertEquals("573023085506", whatsAppPhone("+57 302-308-5506"))
        assertEquals("573023085506", whatsAppPhone("00573023085506"))
    }

    @Test fun unusablePhonesAreNull() {
        assertNull(whatsAppPhone("0000"))
        assertNull(whatsAppPhone(""))
        assertNull(whatsAppPhone(null))
        assertNull(whatsAppPhone("12345"))
        assertNull(whatsAppPhone("3001234567 / 3101234567"))
        assertNull(whatsAppPhone("3001234567,3101234567"))
        assertNull(whatsAppPhone("3001234567 3101234567"))
        assertNull(whatsAppPhone("abc3001234567"))
        assertNull(whatsAppPhone("570012345678"))
        assertEquals("12025550100", whatsAppPhone("+1 202 555 0100"))
    }

    @Test fun urlEncodesTextAndFallsBackToContactPicker() {
        assertEquals("https://wa.me/573001112233?text=Hola%20Ana%2C%20%24", whatsAppUrl("573001112233", "Hola Ana, $"))
        assertEquals("https://wa.me/?text=Hola", whatsAppUrl(null, "Hola"))
    }

    @Test fun paymentReceiptIncludesAmountBalanceAndCollector() {
        val text = paymentReceiptMessage("Juan Pérez", "20000", "180000.00", "Luis", moment)
        assertTrue(text, text.startsWith("Hola Juan Pérez, recibimos su abono de $20.000 el 02/10/2026"))
        assertTrue(text, text.contains("Saldo pendiente: $180.000."))
        assertTrue(text, text.contains("Recibió: Luis."))
    }

    @Test fun creditMessageIncludesTermAndInstallment() {
        val text = creditCreatedMessage("Ana", "240000", "Diario", 24, "240000", "Prestamo", null, moment)
        assertTrue(text, text.contains("se registró su crédito (Prestamo) por $240.000."))
        assertTrue(text, text.contains("Plazo: 24 días."))
        assertTrue(text, text.contains("Cuota diaria aproximada: $10.000."))
        assertTrue(text, !text.contains("Saldo pendiente"))
    }

    @Test fun creditMessageShowsBalanceWhenInitialPaymentReducedIt() {
        val text = creditCreatedMessage("Ana", "300000", "Mensual", 3, "250000", null, "Luis", moment)
        assertTrue(text, text.contains("Plazo: 3 meses."))
        assertTrue(text, text.contains("Saldo pendiente: $250.000."))
        assertTrue(text, text.contains("Atendió: Luis."))
    }
}
