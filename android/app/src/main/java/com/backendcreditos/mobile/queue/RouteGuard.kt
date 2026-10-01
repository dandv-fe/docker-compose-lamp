package com.backendcreditos.mobile.queue

import com.backendcreditos.mobile.data.OperationKind
import com.backendcreditos.mobile.data.RouteCashEntity

// Records that belong to a route day (tbl_detalle_ruta). They are only queued while the phone
// knows that day is open ('created'). When the server refuses them the queue is never swept
// automatically: the record stays visible so the person can read it and decide.
object RouteGuard {
    /** The route was settled or deleted: the record can never be applied. */
    const val ROUTE_CLOSED = "ROUTE_CLOSED"

    /** The route was handed over but the office can unlock it, so the record can be resent. */
    const val ROUTE_REOPENABLE = "ROUTE_REOPENABLE"

    fun isRouteRefusal(code: String?): Boolean = code == ROUTE_CLOSED || code == ROUTE_REOPENABLE

    fun canResend(code: String?): Boolean = code == ROUTE_REOPENABLE

    fun refusalAdvice(code: String?): String? = when (code) {
        ROUTE_REOPENABLE ->
            "La ruta de ese día ya se entregó. Pide en la oficina que la desbloqueen y vuelve a enviarlo; " +
                "si no la desbloquean, quítalo de la cola."
        ROUTE_CLOSED ->
            "La ruta de ese día ya se guardó en la oficina y no admite más movimientos. " +
                "Anota lo que necesites y quítalo de la cola; no se va a registrar."
        else -> null
    }

    val routeBoundKinds: Set<OperationKind> = setOf(
        OperationKind.CREATE_CREDIT, OperationKind.DELETE_CREDIT,
        OperationKind.CREATE_PAYMENT, OperationKind.UPDATE_PAYMENT, OperationKind.DELETE_PAYMENT,
        OperationKind.APPLY_DISCOUNT, OperationKind.ADD_INTEREST,
        OperationKind.CREATE_EXPENSE, OperationKind.UPDATE_EXPENSE, OperationKind.DELETE_EXPENSE,
        OperationKind.CREATE_BASE, OperationKind.UPDATE_BASE, OperationKind.DELETE_BASE
    )

    fun isRouteBound(kind: OperationKind): Boolean = kind in routeBoundKinds

    /** The open route a new record can be queued against, or null when there is none. */
    fun openRouteId(cash: RouteCashEntity?): Int? =
        cash?.routeId?.takeIf { cash.routeState == "created" }

    /**
     * Applies a `route` change event (tbl_detalle_ruta) to the cached open route, so the phone
     * learns when the day is dispatched, handed over or settled without opening the cash screen.
     * Returns null when the event does not change what the phone knows.
     */
    fun routeCashAfterEvent(
        cached: RouteCashEntity?, accountKey: String, branchId: String,
        routeId: Int?, status: String?, now: Long
    ): RouteCashEntity? {
        if (routeId == null) return null
        val sameRoute = cached?.routeId == routeId
        return when (status) {
            "created" ->
                if (sameRoute) cached!!.copy(routeState = "created", fetchedAt = now)
                else RouteCashEntity(accountKey, branchId, routeId, "0", "0", "0", now, routeState = "created")
            "entregando" -> when {
                sameRoute -> cached!!.copy(routeState = "entregando", fetchedAt = now)
                cached?.routeId == null ->
                    RouteCashEntity(accountKey, branchId, routeId, "0", "0", "0", now, routeState = "entregando")
                else -> null
            }
            // 'saved', deleted, or anything unknown: that route can no longer take records.
            else ->
                if (sameRoute) cached!!.copy(routeId = null, routeState = null, base = "0",
                    otherIncome = "0", expenses = "0", fetchedAt = now)
                else null
        }
    }

    fun closedRouteMessage(cash: RouteCashEntity?): String = when {
        cash == null || cash.routeId == null ->
            "No hay una ruta abierta en esta sucursal. Conéctate a internet y actualiza; si sigue igual, pide que despachen la ruta."
        cash.routeState == null ->
            "No se sabe si la ruta sigue abierta. Conéctate a internet y actualiza antes de registrar."
        else ->
            "La ruta de hoy ya está en estado «${cash.routeState}». No se pueden registrar más movimientos en ella."
    }

    fun kindLabel(kind: OperationKind): String = when (kind) {
        OperationKind.CREATE_CREDIT -> "Tarjeta nueva"
        OperationKind.DELETE_CREDIT -> "Tarjeta borrada"
        OperationKind.CREATE_PAYMENT -> "Abono"
        OperationKind.UPDATE_PAYMENT -> "Corrección de abono"
        OperationKind.DELETE_PAYMENT -> "Abono borrado"
        OperationKind.APPLY_DISCOUNT -> "Descuento"
        OperationKind.ADD_INTEREST -> "Intereses"
        OperationKind.CREATE_EXPENSE -> "Gasto"
        OperationKind.UPDATE_EXPENSE -> "Corrección de gasto"
        OperationKind.DELETE_EXPENSE -> "Gasto borrado"
        OperationKind.CREATE_BASE -> "Base"
        OperationKind.UPDATE_BASE -> "Corrección de base"
        OperationKind.DELETE_BASE -> "Base borrada"
        else -> "Cambio"
    }
}
