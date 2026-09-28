package com.backendcreditos.mobile.data

import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class OperationPayloadMapperTest {
    @Test fun customerPayloadMatchesStrictSpanishBackendKeysWithoutAccountScope() {
        val payload = OperationPayloadMapper.customer(
            "Ana", "Pérez", "F", "1990-01-01", "CC", "123", "300", "ana@example.test",
            "Independiente", "Nota persona", "Antioquia", "Medellín", "Centro", "Calle 1",
            "5000.25", "Anita", "Nota cliente", "activo", null
        ) as JsonObject

        assertEquals(
            setOf(
                "nombres", "apellidos", "sexo", "fechaNacimiento", "tipoDocumento", "numeroDocumento",
                "telefono", "email", "ocupacion", "notaPersona", "departamento", "ciudad", "barrio",
                "calle", "maxCredito", "apodo", "notaCliente", "estadoCliente", "fiadorPersonaId"
            ),
            payload.keys
        )
        assertEquals("Ana", payload.getValue("nombres").jsonPrimitive.content)
        assertEquals("123", payload.getValue("numeroDocumento").jsonPrimitive.content)
        assertEquals(JsonNull, payload.getValue("fiadorPersonaId"))
        assertTrue(payload.keys.none { it in setOf("companyId", "branchId", "firstName", "lastName") })
    }

    @Test fun creditPayloadUsesOpaqueCardIdAndServerRouteAssignmentContract() {
        val mapped = OperationPayloadMapper.createCredit(
            "card/opaque-1", "42", "Compra", "1200", "Mensual", "12", "900",
            "Descripción", "100", "3", "300", "A-2", "10", "Factura", "A", "8",
            "Nota", "", "17"
        )
        val payload = mapped.payload as JsonObject

        assertEquals("card/opaque-1", mapped.entityId)
        assertEquals(
            setOf(
                "idtarjeta", "idcliente", "idventa", "concepto", "valor", "modo", "plazo", "prestamo",
                "descripcion", "cuotaInicial", "item", "utilidad", "adicionalNumero", "adicionalValor",
                "tipoComprobante", "serie", "numero", "nota", "obligacion", "detalleDocumentoSucursalId"
            ),
            payload.keys
        )
        assertEquals("card/opaque-1", payload.getValue("idtarjeta").jsonPrimitive.content)
        assertEquals("42", payload.getValue("idcliente").jsonPrimitive.content)
        assertEquals(JsonNull, payload.getValue("obligacion"))
        assertTrue("routeId" !in payload && "branchId" !in payload && "companyId" !in payload)
    }

    @Test fun paymentEntityIdIsCreditAndAbonoIsNegative() {
        val mapped = OperationPayloadMapper.createPayment("card/non-numeric", "payment-uuid", "25.5", "Abono")
        val payload = mapped.payload as JsonObject

        assertEquals("card/non-numeric", mapped.entityId)
        assertEquals(setOf("iddescripcion", "abono", "descripcion"), payload.keys)
        assertEquals("payment-uuid", payload.getValue("iddescripcion").jsonPrimitive.content)
        assertEquals("-25.5", payload.getValue("abono").jsonPrimitive.content)
        assertTrue("creditId" !in payload && "amount" !in payload)
    }

    @Test fun paymentUpdateUsesOpaquePaymentIdAndStrictNegativeFields() {
        val mapped = OperationPayloadMapper.updatePayment("payment/non-numeric", "9", "Ajuste")
        val payload = mapped.payload as JsonObject

        assertEquals("payment/non-numeric", mapped.entityId)
        assertEquals(setOf("abono", "descripcion"), payload.keys)
        assertEquals("-9.0", payload.getValue("abono").jsonPrimitive.content)
    }

    @Test fun discountInterestCommentsAndAlertsUseBackendPayloadShapes() {
        val discount = OperationPayloadMapper.discount("card/x", "20", "acuerdo").payload as JsonObject
        assertEquals("-20.0", discount.getValue("amount").jsonPrimitive.content)
        val interest = OperationPayloadMapper.interest("card/x", "15", "2", "").payload as JsonObject
        assertEquals(setOf("amount", "plazo"), interest.keys)
        val comment = OperationPayloadMapper.createComment("42", "nota").payload as JsonObject
        assertEquals(setOf("idcliente", "comentario", "tipo"), comment.keys)
        val alert = OperationPayloadMapper.upsertAlert("42", "alert-id", "i", "c", "a/,b", "m/,n")
        assertEquals("alert-id", alert.entityId)
        assertEquals("i/,c/,ab/,mn", (alert.payload as JsonObject).getValue("alerta").jsonPrimitive.content)
    }
}
