package com.backendcreditos.mobile.queue

import com.backendcreditos.mobile.data.OperationKind
import com.backendcreditos.mobile.data.RouteCashEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RouteGuardTest {
    private fun cash(routeId: Int?, state: String?) =
        RouteCashEntity("acc", "8", routeId, "500", "0", "40", 1L, routeState = state)

    @Test
    fun onlyACreatedRouteAcceptsNewRecords() {
        assertEquals(77, RouteGuard.openRouteId(cash(77, "created")))
        assertNull(RouteGuard.openRouteId(cash(77, "entregando")))
        assertNull(RouteGuard.openRouteId(cash(77, null)))
        assertNull(RouteGuard.openRouteId(cash(null, null)))
        assertNull(RouteGuard.openRouteId(null))
    }

    @Test
    fun theRefusalSaysWhyInPlainWords() {
        assertTrue(RouteGuard.closedRouteMessage(null).contains("No hay una ruta abierta"))
        assertTrue(RouteGuard.closedRouteMessage(cash(77, null)).contains("Conéctate a internet"))
        assertTrue(RouteGuard.closedRouteMessage(cash(77, "entregando")).contains("entregando"))
    }

    @Test
    fun aHandedOverRouteCanBeResentButASettledOneCannot() {
        assertTrue(RouteGuard.isRouteRefusal(RouteGuard.ROUTE_REOPENABLE))
        assertTrue(RouteGuard.isRouteRefusal(RouteGuard.ROUTE_CLOSED))
        assertFalse(RouteGuard.isRouteRefusal("BUSINESS_RULE"))
        assertFalse(RouteGuard.isRouteRefusal(null))

        assertTrue(RouteGuard.canResend(RouteGuard.ROUTE_REOPENABLE))
        assertFalse(RouteGuard.canResend(RouteGuard.ROUTE_CLOSED))
        assertFalse(RouteGuard.canResend(null))

        assertTrue(RouteGuard.refusalAdvice(RouteGuard.ROUTE_REOPENABLE)!!.contains("desbloqueen"))
        assertTrue(RouteGuard.refusalAdvice(RouteGuard.ROUTE_CLOSED)!!.contains("quítalo de la cola"))
        assertNull(RouteGuard.refusalAdvice("BUSINESS_RULE"))
    }

    @Test
    fun routeDayRecordsAreBoundButCustomersAndCommentsAreNot() {
        assertTrue(RouteGuard.isRouteBound(OperationKind.CREATE_PAYMENT))
        assertTrue(RouteGuard.isRouteBound(OperationKind.CREATE_EXPENSE))
        assertTrue(RouteGuard.isRouteBound(OperationKind.DELETE_BASE))
        assertTrue(RouteGuard.isRouteBound(OperationKind.CREATE_CREDIT))
        assertFalse(RouteGuard.isRouteBound(OperationKind.CREATE_CUSTOMER))
        assertFalse(RouteGuard.isRouteBound(OperationKind.CREATE_COMMENT))
        assertFalse(RouteGuard.isRouteBound(OperationKind.UPDATE_CREDIT))
    }

    @Test
    fun handingOverTheRouteClosesItOnThePhone() {
        val next = RouteGuard.routeCashAfterEvent(cash(77, "created"), "acc", "8", 77, "entregando", 5L)!!
        assertEquals("entregando", next.routeState)
        assertEquals(77, next.routeId)
        assertEquals("500", next.base)
        assertNull(RouteGuard.openRouteId(next))
    }

    @Test
    fun settlingOrDeletingTheRouteForgetsIt() {
        for (status in listOf("saved", null)) {
            val next = RouteGuard.routeCashAfterEvent(cash(77, "entregando"), "acc", "8", 77, status, 5L)!!
            assertNull(next.routeId)
            assertNull(next.routeState)
            assertEquals("0", next.base)
        }
    }

    @Test
    fun aNewlyDispatchedRouteOpensWithEmptyCash() {
        val next = RouteGuard.routeCashAfterEvent(cash(null, null), "acc", "8", 78, "created", 5L)!!
        assertEquals(78, RouteGuard.openRouteId(next))
        assertEquals("0", next.base)
        val reopened = RouteGuard.routeCashAfterEvent(cash(77, "entregando"), "acc", "8", 77, "created", 5L)!!
        assertEquals(77, RouteGuard.openRouteId(reopened))
        assertEquals("500", reopened.base)
    }

    @Test
    fun eventsOfAnotherOldRouteDoNotTouchTheOpenOne() {
        assertNull(RouteGuard.routeCashAfterEvent(cash(78, "created"), "acc", "8", 77, "saved", 5L))
        assertNull(RouteGuard.routeCashAfterEvent(cash(78, "created"), "acc", "8", 77, "entregando", 5L))
        assertNull(RouteGuard.routeCashAfterEvent(cash(78, "created"), "acc", "8", null, "created", 5L))
    }
}
