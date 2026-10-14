package com.backendcreditos.mobile

import com.backendcreditos.mobile.network.DispatchChallengeDto
import com.backendcreditos.mobile.network.DispatchChallengesDto
import java.time.LocalDate
import java.time.format.DateTimeParseException
import java.security.MessageDigest

internal data class DispatchChallengesState(
    val scope: PayrollScope,
    val snapshot: DispatchChallengesDto? = null,
    val readAt: Long? = null,
    val loading: Boolean = false,
    val error: String = ""
)

private fun challengeDate(value: String): Boolean = try {
    value.matches(Regex("\\d{4}-\\d{2}-\\d{2}")) && LocalDate.parse(value).toString() == value
} catch (_: DateTimeParseException) {
    false
}

fun dispatchChallengesError(dto: DispatchChallengesDto): String? {
    if (dto.employeeId <= 0 || !challengeDate(dto.asOf)) return "empleado o corte inválido"
    if (dto.items.map { it.challengeId }.distinct().size != dto.items.size) return "retos duplicados"
    dto.items.forEach { item ->
        if (item.challengeId.isBlank() || item.routeId <= 0 || item.branchId <= 0 ||
            item.branchName.isBlank() || item.description.isBlank()) return "invitación incompleta"
        if (item.status !in setOf("active", "expired", "closed", "unassigned") ||
            item.routeState !in setOf("created", "entregando", "saved")) return "estado desconocido"
        if (!challengeDate(item.invitationDate) || !challengeDate(item.deadline) ||
            item.invitationDate > item.deadline) return "fechas inválidas"
        if (!item.incrementPercent.isFinite() || item.incrementPercent !in 0.1..40.0 ||
            !item.capitalGoal.isFinite() || item.capitalGoal < 0 ||
            !item.collectionGoal.isFinite() || item.collectionGoal < 0) return "meta inválida"
        val salary = item.salary
        if (!challengeDate(salary.startDate) || !challengeDate(salary.endDate) ||
            salary.startDate > salary.endDate) return "período salarial inválido"
        if (salary.configured && (salary.contractId.isNullOrBlank() ||
                salary.type !in setOf("Fijo", "Porcentaje", "Combinado") ||
                salary.frequency !in setOf("Diario", "Semanal", "Quincenal", "Mensual"))) return "sueldo desconocido"
        if (listOf(salary.baseAmount, salary.periodBaseAmount, salary.agreedBaseAmount,
                salary.capitalCommission, salary.collectionCommission, salary.commissionAmount,
                salary.bonusAmount, salary.earnedAmount, salary.paidAmount, salary.pendingAmount).any { !it.isFinite() } ||
            listOf(salary.baseAmount, salary.periodBaseAmount, salary.agreedBaseAmount).any { it < 0 }) return "sueldo inválido"
        val allocation = item.allocation
        if (listOf(allocation.weight, allocation.capitalRate, allocation.collectionRate)
                .any { !it.isFinite() || it !in 0.0..100.0 }) return "participación o tasas inválidas"
        val goal = item.goal
        if (listOf(goal.targetCommission, goal.otherCommission, goal.routeCommission, goal.commissionGap,
                goal.projectedCommission, goal.projectedEarnedWithoutBonuses, goal.surplusAmount)
                .any { !it.isFinite() } ||
            listOf(goal.capitalRequired, goal.collectionRequired, goal.surplusPercent).any { it != null && !it.isFinite() } ||
            listOf(goal.capitalRequired, goal.collectionRequired).any { it != null && it < 0 }) return "estimación de meta inválida"
        val progress = item.progress
        if (listOf(progress.creditedCapital, progress.creditedCollection, progress.capitalTarget,
                progress.collectionTarget, progress.commissionAmount, progress.targetCommission).any { !it.isFinite() } ||
            progress.capitalTarget < 0 || progress.collectionTarget < 0 ||
            listOf(progress.capitalPercent, progress.collectionPercent, progress.commissionPercent)
                .any { it != null && !it.isFinite() }) return "avance inválido"
        if ((progress.capitalTarget <= 0) != (progress.capitalPercent == null) ||
            (progress.collectionTarget <= 0) != (progress.collectionPercent == null) ||
            (progress.targetCommission <= 0) != (progress.commissionPercent == null)) return "avance sin porcentaje consistente"
        val forecast = item.forecast
        if (!forecast.estimated || forecast.status !in setOf("available", "insufficient_data", "not_applicable")) {
            return "estado de proyección inválido"
        }
        if (item.status == "active" && (!item.assigned || item.routeState != "created")) return "invitación activa sin asignación"
        if (forecast.status == "available" && (item.status != "active" || forecast.collections == null ||
                forecast.collections.status != "available")) return "proyección disponible sin datos"
        forecast.collections?.let { collections ->
            if (!collections.estimated || collections.status !in setOf("available", "insufficient_data") ||
                listOf(collections.dueAmount, collections.arrearsAmount, collections.advanceAmount)
                    .any { !it.isFinite() || it < 0 } ||
                collections.cardCount < 0 || collections.invalidCardCount !in 0..collections.cardCount) {
                return "estimación de cuotas inválida"
            }
        }
    }
    return null
}

internal fun challengePresentationKey(item: DispatchChallengeDto): ChallengePresentationKey {
    // No revision field in the API: fingerprint invitation/goal configuration, never live progress.
    val invitation = listOf(item.invitationDate, item.deadline, item.description, item.branchId.toString(),
        item.routeId.toString(), item.incrementPercent.toString(), item.capitalGoal.toString(),
        item.collectionGoal.toString(), item.allocation.toString()).joinToString("\u0000")
    val revision = MessageDigest.getInstance("SHA-256").digest(invitation.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it.toInt() and 0xff) }
    return ChallengePresentationKey(item.challengeId, revision)
}

internal fun challengeAchievementText(item: DispatchChallengeDto): String = when {
    !item.progress.achieved -> "Oportunidad de superar tu sueldo básico; objetivo aún no alcanzado al corte."
    item.routeState != "saved" -> "Objetivo alcanzado al corte · provisional hasta cerrar el despacho. No confirma un pago."
    else -> "Objetivo alcanzado según el servidor al corte · despacho cerrado. No confirma un pago."
}

internal fun challengeForecastText(item: DispatchChallengeDto): String = when (item.forecast.status) {
    "available" -> "Estimación disponible, no garantía de ingresos."
    "insufficient_data" -> "No se puede estimar esta oportunidad con los datos o tasas disponibles. Consulta los avisos."
    else -> "Sin proyección vigente: reto vencido, despacho cerrado o sin asignación."
}
