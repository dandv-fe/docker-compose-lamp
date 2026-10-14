package com.backendcreditos.mobile

import com.backendcreditos.mobile.network.EmployeePayrollDto
import com.backendcreditos.mobile.network.PayrollAmountsDto
import com.backendcreditos.mobile.network.PayrollPeriodDto
import com.backendcreditos.mobile.network.PayrollRouteDto
import com.backendcreditos.mobile.network.PayrollMovementDto
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PayrollTest {
    private fun summary() = EmployeePayrollDto(
        7, "2026-09-10",
        listOf(PayrollPeriodDto("1", true, "Combinado", "Mensual", "2026-09-01", "2026-09-30",
            1000.0, 3000.0, 3000.0, 100.0, 200.0, 300.0, 50.0, 1050.0, 500.0, 550.0)),
        PayrollAmountsDto(1000.0, 3000.0, 100.0, 200.0, 300.0, 50.0, 1050.0, 500.0, 550.0),
        emptyList(), emptyList(), emptyList(), emptyList(), emptyList()
    )

    @Test fun salaryTypesFrequenciesAndUnconfiguredPeriodAreExplicit() {
        val summary = summary()
        assertNull(payrollContractError(summary))
        for (type in listOf("Fijo", "Porcentaje", "Combinado")) {
            for (frequency in listOf("Diario", "Semanal", "Quincenal", "Mensual")) {
                assertNull(payrollContractError(summary.copy(periods = listOf(summary.periods.single().copy(
                    type = type, frequency = frequency
                )))))
            }
        }
        assertNull(payrollContractError(summary.copy(periods = listOf(summary.periods.single().copy(
            configured = false, contractId = null, type = null
        )))))
        assertNotNull(payrollContractError(summary.copy(periods = listOf(summary.periods.single().copy(type = "otro")))))
        assertNotNull(payrollContractError(summary.copy(periods = emptyList())))
    }

    @Test fun malformedAmountsAndDatesNeverBecomeFalseUnpaidZero() {
        val summary = summary()
        assertNotNull(payrollContractError(summary.copy(asOf = "2026-02-30")))
        assertNotNull(payrollContractError(summary.copy(employeeId = 0)))
        assertNotNull(payrollContractError(summary.copy(totals = summary.totals.copy(earnedAmount = Double.NaN))))
        assertNotNull(payrollContractError(summary.copy(totals = summary.totals.copy(pendingAmount = 0.0))))
        assertNotNull(payrollContractError(summary.copy(periods = listOf(summary.periods.single().copy(
            baseAmount = Double.POSITIVE_INFINITY
        )))))
        // Overpaid balances are real negative pending amounts, not silently clamped to zero.
        assertNull(payrollContractError(summary.copy(
            totals = summary.totals.copy(paidAmount = 1100.0, pendingAmount = -50.0),
            periods = listOf(summary.periods.single().copy(paidAmount = 1100.0, pendingAmount = -50.0))
        )))
    }

    @Test fun accruedBaseAndFullAgreementAreNotPresentedAsTheSamePending() {
        val lines = payrollPeriodAmountLines(summary().periods.single())
        assertTrue(lines.contains("Sueldo básico acumulado: 1.000"))
        assertTrue(lines.contains("Sueldo básico pactado (Mensual): 3.000"))
        assertTrue(lines.contains("Sueldo básico del período: 3.000 · no es devengado futuro"))
        assertTrue(lines.contains("Total devengado: 1.050"))
        assertTrue(lines.contains("Pagado: 500 · Pendiente: 550"))
    }

    private fun route(id: Int = 1) = PayrollRouteDto(
        id, 2, "Punto centro", "created", true, "2026-09-01 08:00:00",
        "1", "Combinado", 50.0, 2.0, 3.0, "Igual", 100.0, 200.0, 1.0, 3.0
    )

    private fun movement() = PayrollMovementDto(
        1, 2, "Punto centro", "created", true, "10", "2026-09-10", "1", "Combinado",
        50.0, 2.0, 3.0, "Igual", 100.0, 200.0, null, 1.0, 3.0
    )

    @Test fun multiRouteSnapshotsHaveNoLimitAndLabelsExplainProvisionalAndExclusions() {
        val summary = summary().copy(routes = (1..150).map { route(it) }, breakdown = listOf(movement()))
        assertNull(payrollContractError(summary))
        assertTrue(payrollRouteLines(route()).contains("Provisional · despacho created"))
        assertTrue(payrollRouteLines(route()).contains("Reparto Igual · participación 50%"))
        assertTrue(payrollRouteLines(route()).contains("Comisiones de la ruta al corte: capital 1 · recaudo 3"))
        assertTrue(payrollRouteLines(route()).contains("Capital de la ruta (dec_prestamo): 100 · Recaudo neto de bancos: 200"))
        for (mode in listOf("Titular", "Igual", "Personalizado")) {
            assertNull(payrollContractError(summary.copy(routes = listOf(route().copy(mode = mode)), breakdown = emptyList())))
        }
        assertTrue(payrollRouteLines(route().copy(state = "saved", provisional = false)).contains("Despacho cerrado"))
        assertTrue(payrollMovementLines(movement().copy(excludedReason = "VACATION")).any { it.contains("El sueldo básico se conserva") })
        assertTrue(payrollMovementLines(movement().copy(excludedReason = "FIXED")).any { it.contains("sueldo Fijo") })
        assertTrue(payrollMovementLines(movement().copy(excludedReason = "NO_CONTRACT")).any { it.contains("no había contrato") })
        assertTrue(payrollMovementLines(movement().copy(capitalCommission = 0.333333333333))
            .any { it.contains("0,333333333333") })
        assertNull(payrollContractError(summary.copy(breakdown = listOf(movement().copy(
            capitalAmount = -100.0, cashAmount = -200.0, capitalCommission = -1.0, collectionCommission = -3.0
        )))))
    }

    @Test fun malformedRoutesDoNotBecomeEmptyOrFinalAndSignedTotalsRemainValid() {
        val summary = summary().copy(routes = listOf(route()), breakdown = listOf(movement()))
        for (bad in listOf(
                route().copy(mode = "otro"), route().copy(weight = 101.0),
                route().copy(state = "saved", provisional = true), route().copy(openedAt = "ayer"),
                route().copy(capitalCommission = Double.NaN), route().copy(cashAmount = Double.NaN)
            )) {
            assertNotNull(payrollContractError(summary.copy(routes = listOf(bad))))
        }
        for (bad in listOf(
                movement().copy(routeId = 999), movement().copy(excludedReason = "OTHER"),
                movement().copy(movementDate = "2026-09-11"), movement().copy(cashAmount = Double.NaN)
            )) {
            assertNotNull(payrollContractError(summary.copy(breakdown = listOf(bad))))
        }
        val period = summary.periods.single().copy(capitalCommission = -100.0, collectionCommission = -200.0,
            commissionAmount = -300.0, earnedAmount = 750.0, paidAmount = -10.0, pendingAmount = 760.0)
        val totals = summary.totals.copy(capitalCommission = -100.0, collectionCommission = -200.0,
            commissionAmount = -300.0, earnedAmount = 750.0, paidAmount = -10.0, pendingAmount = 760.0)
        assertNull(payrollContractError(summary.copy(periods = listOf(period), totals = totals)))
    }

    @Test fun replacementAndOwnParticipationOnSameRouteStaySeparate() {
        val own = route()
        val replacement = own.copy(contractId = "2", vacationId = "9", coveredEmployeeId = 8, capitalRate = 4.0)
        val coveredMovement = movement().copy(contractId = "2", vacationId = "9", coveredEmployeeId = 8, capitalRate = 4.0)
        val dto = summary().copy(routes = listOf(own, replacement), breakdown = listOf(movement(), coveredMovement))
        assertNull(payrollContractError(dto))
        org.junit.Assert.assertNotEquals(own.partKey(), replacement.partKey())
        org.junit.Assert.assertEquals(replacement.partKey(), coveredMovement.partKey())
        assertTrue(payrollRouteLines(replacement).any { it.contains("relevo del empleado #8") })
        assertNotNull(payrollContractError(dto.copy(routes = listOf(own, own))))
    }
}
