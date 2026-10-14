package com.backendcreditos.mobile

import com.backendcreditos.mobile.network.EmployeePayrollDto
import com.backendcreditos.mobile.network.PayrollPeriodDto
import com.backendcreditos.mobile.network.PayrollMovementDto
import com.backendcreditos.mobile.network.PayrollRouteDto
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeParseException

internal data class PayrollScope(val accountKey: String, val branchId: String, val token: String)

internal fun payrollReplyIsCurrent(
    target: PayrollScope, accountKey: String?, branchId: String?, token: String?,
    requestId: Long, activeRequestId: Long
): Boolean = target.accountKey == accountKey && target.branchId == branchId &&
    target.token == token && requestId == activeRequestId

internal data class PayrollState(
    val scope: PayrollScope,
    val snapshot: EmployeePayrollDto? = null,
    val readAt: Long? = null,
    val loading: Boolean = false,
    val error: String = ""
)

private val salaryTypes = setOf("Fijo", "Porcentaje", "Combinado")
private val salaryFrequencies = setOf("Diario", "Semanal", "Quincenal", "Mensual")
private val distributionModes = setOf("Titular", "Igual", "Personalizado")
private val payrollRouteStates = setOf("created", "entregando", "saved")

internal data class PayrollPartKey(val routeId: Int, val contractId: String?, val vacationId: String?)
internal fun PayrollRouteDto.partKey() = PayrollPartKey(routeId, contractId, vacationId)
internal fun PayrollMovementDto.partKey() = PayrollPartKey(routeId, contractId, vacationId)

private fun payrollSnapshotValid(
    contractId: String?, type: String?, weight: Double, capitalRate: Double, collectionRate: Double, mode: String
): Boolean = (type == null || type in salaryTypes) && (contractId == null || contractId.isNotBlank()) &&
    weight.isFinite() && weight in 0.0..100.0 && capitalRate.isFinite() && capitalRate in 0.0..100.0 &&
    collectionRate.isFinite() && collectionRate in 0.0..100.0 && mode in distributionModes

private fun payrollOpenedAtValid(value: String): Boolean = try {
    LocalDateTime.parse(value, java.time.format.DateTimeFormatter.ofPattern("uuuu-MM-dd HH:mm:ss")
        .withResolverStyle(java.time.format.ResolverStyle.STRICT))
    true
} catch (_: DateTimeParseException) {
    false
}

private fun payrollDate(value: String): Boolean = try {
    value.matches(Regex("\\d{4}-\\d{2}-\\d{2}")) && LocalDate.parse(value).toString() == value
} catch (_: DateTimeParseException) {
    false
}

internal fun payrollContractError(dto: EmployeePayrollDto): String? {
    if (dto.employeeId <= 0 || !payrollDate(dto.asOf)) return "empleado o fecha no válidos"
    if (dto.periods.isEmpty()) return "falta el período consultado"
    dto.periods.forEach { period ->
        if (!payrollDate(period.startDate) || !payrollDate(period.endDate) ||
            period.startDate > period.endDate || dto.asOf !in period.startDate..period.endDate
        ) return "fechas de período no válidas"
        if (period.configured && (period.contractId.isNullOrBlank() ||
                period.type !in salaryTypes || period.frequency !in salaryFrequencies)
        ) return "plan de sueldo desconocido"
        val amounts = listOf(period.baseAmount, period.periodBaseAmount, period.agreedBaseAmount,
            period.capitalCommission, period.collectionCommission,
            period.commissionAmount, period.bonusAmount, period.earnedAmount, period.paidAmount)
        if (amounts.any { !it.isFinite() } || !period.pendingAmount.isFinite() ||
            listOf(period.baseAmount, period.periodBaseAmount, period.agreedBaseAmount).any { it < 0 }
        ) {
            return "importes de período no válidos"
        }
        if (kotlin.math.abs(period.capitalCommission + period.collectionCommission - period.commissionAmount) > 0.011) {
            return "suma de comisiones no coincide"
        }
        if (period.baseAmount > period.periodBaseAmount + 0.011) return "sueldo básico acumulado excede el sueldo básico del período"

        if (kotlin.math.abs(period.earnedAmount - period.paidAmount - period.pendingAmount) > 0.011) {
            return "pendiente no coincide con devengado menos pagado"
        }
    }
    val totals = dto.totals
    if (listOf(totals.baseAmount, totals.periodBaseAmount, totals.capitalCommission, totals.collectionCommission,
            totals.commissionAmount, totals.bonusAmount, totals.earnedAmount, totals.paidAmount)
            .any { !it.isFinite() } || !totals.pendingAmount.isFinite() ||
        listOf(totals.baseAmount, totals.periodBaseAmount).any { it < 0 }
    ) return "totales no válidos"
    if (kotlin.math.abs(totals.earnedAmount - totals.paidAmount - totals.pendingAmount) > 0.011) {
        return "total pendiente no coincide con devengado menos pagado"
    }
    val periodSums = listOf(
        dto.periods.sumOf { it.baseAmount } to totals.baseAmount,
        dto.periods.sumOf { it.periodBaseAmount } to totals.periodBaseAmount,
        dto.periods.sumOf { it.capitalCommission } to totals.capitalCommission,
        dto.periods.sumOf { it.collectionCommission } to totals.collectionCommission,
        dto.periods.sumOf { it.commissionAmount } to totals.commissionAmount,
        dto.periods.sumOf { it.bonusAmount } to totals.bonusAmount,
        dto.periods.sumOf { it.earnedAmount } to totals.earnedAmount,
        dto.periods.sumOf { it.paidAmount } to totals.paidAmount,
        dto.periods.sumOf { it.pendingAmount } to totals.pendingAmount
    )
    if (periodSums.any { kotlin.math.abs(it.first - it.second) > 0.011 }) return "totales no coinciden con los períodos"
    if (dto.contracts.any { it.type !in salaryTypes || it.frequency !in salaryFrequencies ||
            !payrollDate(it.effectiveDate) || !it.baseAmount.isFinite() || it.baseAmount < 0 ||
            !it.capitalRate.isFinite() || it.capitalRate !in 0.0..100.0 ||
            !it.collectionRate.isFinite() || it.collectionRate !in 0.0..100.0 }
    ) return "contrato no válido"
    if (dto.vacations.any { !payrollDate(it.startDate) || !payrollDate(it.endDate) ||
            it.startDate > it.endDate }
    ) return "vacaciones no válidas"
    if (dto.bonuses.any { !payrollDate(it.date) || !it.amount.isFinite() }) {
        return "bono no válido"
    }
    if (dto.routes.map { it.partKey() }.distinct().size != dto.routes.size) return "participaciones de ruta duplicadas"
    if (dto.routes.any {
            it.routeId <= 0 || it.branchId <= 0 || it.state !in payrollRouteStates ||
                it.provisional != (it.state != "saved") || !payrollOpenedAtValid(it.openedAt) ||
                !it.capitalAmount.isFinite() || !it.cashAmount.isFinite() ||
                !it.capitalCommission.isFinite() || !it.collectionCommission.isFinite() ||
                (it.coveredEmployeeId != null && it.coveredEmployeeId <= 0) ||
                !payrollSnapshotValid(it.contractId, it.type, it.weight, it.capitalRate, it.collectionRate, it.mode)
        }) return "snapshot de ruta no válido"
    val routesById = dto.routes.associateBy { it.partKey() }
    if (dto.breakdown.any {
            val route = routesById[it.partKey()]
            route == null || it.branchId != route.branchId || it.state != route.state ||
                it.coveredEmployeeId != route.coveredEmployeeId ||
                it.provisional != route.provisional || it.movementId.isBlank() || !payrollDate(it.movementDate) ||
                it.movementDate > dto.asOf || dto.periods.none { period -> it.movementDate in period.startDate..period.endDate } ||
                !payrollSnapshotValid(it.contractId, it.type, it.weight, it.capitalRate, it.collectionRate, it.mode) ||
                it.excludedReason !in setOf(null, "VACATION", "NO_CONTRACT", "FIXED") ||
                listOf(it.capitalAmount, it.cashAmount, it.capitalCommission, it.collectionCommission).any { value -> !value.isFinite() }
        }) return "desglose de ruta no válido"
    return null
}

internal fun payrollPeriodAmountLines(period: PayrollPeriodDto): List<String> {
    fun money(value: Double) = payrollDetailNumber(value)
    val lines = mutableListOf("Sueldo básico acumulado: ${money(period.baseAmount)}")
    if (period.configured) {
        lines += "Sueldo básico pactado (${period.frequency}): ${money(period.agreedBaseAmount)}"
        lines += "Sueldo básico del período: ${money(period.periodBaseAmount)} · no es devengado futuro"
    }
    lines += "Comisión capital: ${money(period.capitalCommission)}"
    lines += "Comisión recaudo: ${money(period.collectionCommission)}"
    lines += "Suma de comisiones: ${money(period.commissionAmount)}"
    lines += "Bonos manuales: ${money(period.bonusAmount)}"
    lines += "Total devengado: ${money(period.earnedAmount)}"
    lines += "Pagado: ${money(period.paidAmount)} · Pendiente: ${money(period.pendingAmount)}"
    return lines
}

internal fun payrollDetailNumber(value: Double): String = java.text.NumberFormat
    .getNumberInstance(java.util.Locale("es", "CO")).apply { maximumFractionDigits = 12 }.format(value)

internal fun payrollRouteLines(route: PayrollRouteDto): List<String> = listOf(
    "${route.branchName} · Ruta #${route.routeId}",
    if (route.provisional) "Provisional · despacho ${route.state}" else "Despacho cerrado",
    "Apertura: ${route.openedAt}",
    "Snapshot: ${route.type ?: "Sin contrato"} · contrato ${route.contractId ?: "sin asignar"}",
    "Reparto ${route.mode} · participación ${payrollDetailNumber(route.weight)}%",
    "Capital ${payrollDetailNumber(route.capitalRate)}% · recaudo ${payrollDetailNumber(route.collectionRate)}%",
    "Capital de la ruta (dec_prestamo): ${payrollDetailNumber(route.capitalAmount)} · Recaudo neto de bancos: ${payrollDetailNumber(route.cashAmount)}",
    "Comisiones de la ruta al corte: capital ${payrollDetailNumber(route.capitalCommission)} · recaudo ${payrollDetailNumber(route.collectionCommission)}"
) + listOfNotNull(route.coveredEmployeeId?.let { "Participación de relevo del empleado #$it · vacaciones #${route.vacationId}" })

internal fun payrollMovementLines(movement: PayrollMovementDto): List<String> = buildList {
    add("${movement.movementDate} · movimiento #${movement.movementId}")
    add("Capital (dec_prestamo): ${payrollDetailNumber(movement.capitalAmount)} · Recaudo: ${payrollDetailNumber(movement.cashAmount)}")
    add("Snapshot ${movement.type ?: "Sin contrato"} · reparto ${movement.mode} · ${payrollDetailNumber(movement.weight)}%")
    add("Tasas: capital ${payrollDetailNumber(movement.capitalRate)}% · recaudo ${payrollDetailNumber(movement.collectionRate)}%")
    add("Comisión capital: ${payrollDetailNumber(movement.capitalCommission)} · recaudo: ${payrollDetailNumber(movement.collectionCommission)}")
    when (movement.excludedReason) {
        "VACATION" -> add("Sin nuevas comisiones: vacaciones. El sueldo básico se conserva.")
        "NO_CONTRACT" -> add("Sin comisiones: no había contrato en el snapshot del despacho.")
        "FIXED" -> add("Sin comisiones: sueldo Fijo en el snapshot del despacho.")
    }
}
