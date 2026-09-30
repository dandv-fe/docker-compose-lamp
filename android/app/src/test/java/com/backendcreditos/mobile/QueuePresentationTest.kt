package com.backendcreditos.mobile

import com.backendcreditos.mobile.data.OperationKind
import com.backendcreditos.mobile.data.OperationStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class QueuePresentationTest {
    @Test
    fun paymentShowsPersonCardAndPositiveAmountWithoutIds() {
        val summary = summarizeOperation(
            OperationKind.CREATE_PAYMENT,
            """{"iddescripcion":"4f1c-uuid","abono":-20000,"descripcion":"Abono"}""",
            customerName = "Ana Pérez",
            cardLabel = cardLabel("Nevera", "600000", "380000")
        )
        assertEquals("Ana Pérez", summary.person)
        assertEquals(2, summary.details.size)
        assertTrue(summary.details[0].startsWith("Tarjeta: Nevera"))
        assertTrue(summary.details[1].startsWith("Abono $"))
        assertTrue(summary.details[1].contains("20.000"))
        assertFalse(summary.details.any { "4f1c" in it })
    }

    @Test
    fun newCustomerTakesNameAndDocumentFromPayload() {
        val summary = summarizeOperation(
            OperationKind.CREATE_CUSTOMER,
            """{"nombres":"JUAN","apellidos":"GÓMEZ","tipoDocumento":"Cédula","numeroDocumento":"123","maxCredito":500000}""",
            customerName = null,
            cardLabel = null
        )
        assertEquals("Juan Gómez", summary.person)
        assertEquals("Cédula 123", summary.details[0])
        assertTrue(summary.details[1].startsWith("Cupo máximo"))
    }

    @Test
    fun deletedPaymentUsesCachedAmountAndUnknownPayloadIsTolerated() {
        val summary = summarizeOperation(OperationKind.DELETE_PAYMENT, "not json", null, null, paymentAmount = "-15000")
        assertNull(summary.person)
        assertTrue(summary.details.single().contains("15.000"))
    }

    @Test
    fun statusLabelsAreForCollectors() {
        assertEquals("Esperando envío", operationStatusLabel(OperationStatus.PENDING))
        assertEquals("Rechazado por el servidor", operationStatusLabel(OperationStatus.REJECTED))
    }

    @Test
    fun problemNoticesAreHighlighted() {
        assertTrue(isProblemNotice("Sin conexión con el servidor: timeout"))
        assertTrue(isProblemNotice("El servidor rechazó la operación: cupo"))
        assertFalse(isProblemNotice("Cartera actualizada."))
        assertFalse(isProblemNotice("Enviando al servidor…"))
    }
}
