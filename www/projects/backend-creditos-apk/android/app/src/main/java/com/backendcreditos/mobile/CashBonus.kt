package com.backendcreditos.mobile

import com.backendcreditos.mobile.network.CashBonusContext
import java.math.BigDecimal
import java.util.UUID

internal data class CashBonusDraft(
    val employeeId: Int? = null,
    val amount: String = "",
    val reason: String = "",
    val token: String = UUID.randomUUID().toString()
)

internal fun updatedCashBonusDraft(previous: CashBonusDraft, edited: CashBonusDraft): CashBonusDraft =
    if (previous.employeeId == edited.employeeId && previous.amount == edited.amount &&
        previous.reason == edited.reason) previous
    else edited.copy(token = UUID.randomUUID().toString())

internal fun cashBonusInputError(draft: CashBonusDraft, context: CashBonusContext): String? {
    if (context.state != "created" || context.branchId <= 0 || context.routeId <= 0) return "El despacho ya no está abierto."
    if (context.employees.none { it.employeeId == draft.employeeId }) return "Selecciona un empleado autorizado."
    val amount = draft.amount.toBigDecimalOrNull() ?: return "Escribe un monto válido."
    if (amount <= BigDecimal.ZERO || amount > BigDecimal("99999999.99") ||
        amount.stripTrailingZeros().scale() > 2) return "El bono debe ser positivo, máximo 99.999.999,99 y con hasta dos decimales."
    val reason = draft.reason.trim()
    if (reason.isEmpty() || reason.codePointCount(0, reason.length) > 250) return "Escribe un motivo de 1 a 250 caracteres."
    return null
}
