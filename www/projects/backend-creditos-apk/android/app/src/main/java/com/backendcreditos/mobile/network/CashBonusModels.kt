package com.backendcreditos.mobile.network

import kotlinx.serialization.Serializable

@Serializable
data class CashBonusEmployee(val employeeId: Int, val name: String)

@Serializable
data class CashBonusContext(
    val branchId: Int, val routeId: Int, val state: String, val employees: List<CashBonusEmployee>
)

@Serializable
data class CashBonusContextData(val payrollBonusContext: CashBonusContext)

@Serializable
data class CashBonusResult(
    val ok: Boolean,
    @Serializable(with = GraphQlIdSerializer::class) val id: String,
    val duplicate: Boolean,
    val expenseId: String?,
    val branchId: Int?,
    val routeId: Int?
)

@Serializable
data class CashBonusData(val changeEmployeePayroll: CashBonusResult)
