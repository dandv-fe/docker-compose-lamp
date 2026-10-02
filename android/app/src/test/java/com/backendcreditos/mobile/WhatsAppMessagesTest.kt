package com.backendcreditos.mobile

import java.time.LocalDateTime
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class WhatsAppMessagesTest {
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
