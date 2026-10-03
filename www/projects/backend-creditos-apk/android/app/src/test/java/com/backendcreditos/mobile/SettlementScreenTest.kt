package com.backendcreditos.mobile

import com.backendcreditos.mobile.network.RouteSettlementDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.math.BigDecimal

class SettlementScreenTest {
    private val summary = RouteSettlementDto(
        routeId = 900, state = "created", canSettle = true,
        base = 50.0, collected = 458.0, collectedBank = 20.0, otherCollected = 33.0,
        credits = 650.0, creditsBank = 100.0, expenses = 8.0,
        // 50 + (458 - 20) + 33 - (650 - 100) - 8
        expectedCash = -37.0
    )

    @Test
    fun theBaseIsOneMoreMovementAndIsNoLongerTypedHere() {
        // The base is registered in «Gastos y bases», so the count no longer changes it.
        assertEquals(BigDecimal("-37.00"), expectedCash(summary, CashCount()))
        assertEquals(BigDecimal("-37.00"), expectedCash(summary, CashCount(cash = "999")))
    }

    @Test
    fun theDifferenceIsWhatTheCollectorHasOverOrUnder() {
        val squared = CashCount(cash = "-37")
        assertEquals(0, cashDifference(summary, squared).compareTo(BigDecimal.ZERO))
        assertEquals(BigDecimal("40.00"), cashDifference(summary, CashCount(cash = "3")))
        assertEquals(BigDecimal("-13.00"), cashDifference(summary, CashCount(cash = "-50")))
        // Bills and coins add up, and a comma is typed as often as a dot.
        assertEquals(BigDecimal("50.50"), CashCount(cash = "40,25", coins = "10,25").counted)
    }

    @Test
    fun handingInIsBlockedWithoutInternetOrWithAPendingQueue() {
        assertEquals(
            "Las cuentas solo se pueden entregar con conexión a internet.",
            settlementBlocker(summary, online = false, queuePending = 0)
        )
        assertEquals(
            "Hay 2 movimiento(s) sin confirmar en la cola. Espera o arréglalos antes de entregar.",
            settlementBlocker(summary, online = true, queuePending = 2)
        )
        assertNull(settlementBlocker(summary, online = true, queuePending = 0))
    }

    @Test
    fun handingInIsBlockedWhenThereIsNothingToHandInOrNoPermission() {
        assertEquals(
            "No hay una ruta abierta para entregar.",
            settlementBlocker(summary.copy(routeId = null), online = true, queuePending = 0)
        )
        assertEquals(
            "Estas cuentas ya fueron entregadas.",
            settlementBlocker(summary.copy(state = "entregando"), online = true, queuePending = 0)
        )
        assertEquals(
            "No tienes permiso para entregar las cuentas de esta ruta.",
            settlementBlocker(summary.copy(canSettle = false), online = true, queuePending = 0)
        )
        assertEquals(
            "Todavía no se han cargado las cuentas.",
            settlementBlocker(null, online = true, queuePending = 0)
        )
    }
}
