package com.backendcreditos.mobile

import com.backendcreditos.mobile.data.OperationPayloadMapper
import com.backendcreditos.mobile.data.RouteEntryEntity
import com.backendcreditos.mobile.network.ExpenseCatalogDto
import com.backendcreditos.mobile.network.PayrollDto
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class RouteEntriesScreenTest {
    private fun entry(
        id: String = "abc", kind: String = "expense", state: String? = "created", pending: Boolean = false
    ) = RouteEntryEntity(
        accountKey = "a", branchId = "8", id = id, kind = kind, name = "gasolina",
        detail = "moto vieja", amount = "12000", accountingType = 1, payrollId = null,
        personName = "Ana Ruiz", state = state, createdAt = 0L, pending = pending
    )

    private fun field(payload: kotlinx.serialization.json.JsonElement, key: String) =
        ((payload as JsonObject)[key] as? JsonPrimitive)?.content

    @Test
    fun expensesAndBasesAlwaysTravelPositive() {
        val expense = OperationPayloadMapper.createExpense(1, "gasolina", "12000", "moto", payrollId = 4)
        assertEquals("12000.0", field(expense.payload, "valor"))
        assertEquals("gasolina", field(expense.payload, "nombre"))
        assertEquals("4", field(expense.payload, "idnomina"))
        // webgoez identifies these rows with uniqid(): 13 characters.
        assertEquals(13, expense.entityId.length)

        val base = OperationPayloadMapper.createBase("50000", "")
        assertEquals("50000.0", field(base.payload, "valor"))
        assertNull(field(base.payload, "detalle"))
        assertNull(field(base.payload, "nombre"))
    }

    @Test
    fun theFormRefusesWhatTheServerWouldReject() {
        assertThrows(IllegalArgumentException::class.java) {
            OperationPayloadMapper.createExpense(1, "gasolina", "-5", "")
        }
        assertThrows(IllegalArgumentException::class.java) {
            OperationPayloadMapper.createExpense(1, "gasolina", "0", "")
        }
        assertThrows(IllegalArgumentException::class.java) {
            OperationPayloadMapper.createExpense(0, "gasolina", "100", "")
        }
        assertThrows(IllegalArgumentException::class.java) {
            OperationPayloadMapper.createExpense(1, "", "100", "")
        }
        assertThrows(IllegalArgumentException::class.java) {
            OperationPayloadMapper.createBase("100", "x".repeat(251))
        }
    }

    @Test
    fun correctingKeepsTheSameRow() {
        val draft = routeEntryDraftOf(entry(id = "row1"))
        assertTrue(draft.editing)
        assertFalse(draft.isBase)
        assertEquals("gasolina", draft.name)
        assertEquals("12000", draft.amount)
        assertEquals("row1", OperationPayloadMapper.updateExpense("row1", 1, "gasolina", "12000", "").entityId)

        val baseDraft = routeEntryDraftOf(entry(kind = "base"))
        assertTrue(baseDraft.isBase)
        assertEquals("", baseDraft.name)
    }

    @Test
    fun salaryRequiresAnAuthorizedPayroll() {
        val catalog = ExpenseCatalogDto(payrolls = listOf(PayrollDto(4, "Ana")))
        val salary = RouteEntryDraft(categoryId = 2, name = "sueldo", amount = "100")
        assertThrows(IllegalArgumentException::class.java) { validateRoutePayroll(salary, catalog) }
        assertThrows(IllegalArgumentException::class.java) {
            OperationPayloadMapper.createExpense(2, "sueldo", "100", "")
        }
        validateRoutePayroll(salary.copy(payrollId = 4), catalog)
        assertEquals("4", field(
            OperationPayloadMapper.createExpense(2, "sueldo", "100", "", 4).payload, "idnomina"
        ))
        assertThrows(IllegalArgumentException::class.java) {
            validateRoutePayroll(salary.copy(payrollId = 5), catalog)
        }
        assertThrows(IllegalArgumentException::class.java) {
            validateRoutePayroll(salary.copy(payrollId = 4), null)
        }
        validateRoutePayroll(RouteEntryDraft(categoryId = 1, name = "gasolina"), null)
        validateRoutePayroll(RouteEntryDraft(isBase = true), null)
    }

    @Test
    fun alreadySentOrQueuedRowsCannotBeTouched() {
        assertNull(routeEntryBlocker(entry()))
        assertEquals("Está en la cola, esperando a enviarse.", routeEntryBlocker(entry(pending = true)))
        assertEquals(
            "Ya se entregó con las cuentas del día.",
            routeEntryBlocker(entry(state = "entregando"))
        )
    }

    @Test
    fun movementsWithoutAnOwnerAreLabelledForTheCollector() {
        assertEquals("Ana Ruiz", collectorLabel("Ana Ruiz"))
        assertEquals("Sin identificar (cobros antiguos)", collectorLabel(null))
        assertEquals("Sin identificar (cobros antiguos)", collectorLabel("  "))
    }
}
