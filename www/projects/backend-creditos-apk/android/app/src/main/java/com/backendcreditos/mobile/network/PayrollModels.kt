package com.backendcreditos.mobile.network

import kotlinx.serialization.Serializable
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerializationException
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonPrimitive

object PayrollDecimalSerializer : KSerializer<Double> {
    override val descriptor = PrimitiveSerialDescriptor("PayrollDecimal", PrimitiveKind.DOUBLE)

    override fun deserialize(decoder: Decoder): Double {
        val value = if (decoder is JsonDecoder) {
            (decoder.decodeJsonElement() as? JsonPrimitive)?.content?.toDoubleOrNull()
                ?: throw SerializationException("Importe de sueldo inválido.")
        } else decoder.decodeDouble()
        if (!value.isFinite()) throw SerializationException("Importe de sueldo no finito.")
        return value
    }

    override fun serialize(encoder: Encoder, value: Double) = encoder.encodeDouble(value)
}

@Serializable
data class MyPayrollData(val myPayroll: EmployeePayrollDto)

@Serializable
data class PayrollAmountsDto(
    val baseAmount: Double,
    val periodBaseAmount: Double,
    val capitalCommission: Double,
    val collectionCommission: Double,
    val commissionAmount: Double,
    val bonusAmount: Double,
    val earnedAmount: Double,
    val paidAmount: Double,
    val pendingAmount: Double
)

@Serializable
data class PayrollPeriodDto(
    @Serializable(with = GraphQlIdSerializer::class) val contractId: String?,
    val configured: Boolean,
    val type: String?,
    val frequency: String?,
    val startDate: String,
    val endDate: String,
    val baseAmount: Double,
    val periodBaseAmount: Double,
    val agreedBaseAmount: Double,
    val capitalCommission: Double,
    val collectionCommission: Double,
    val commissionAmount: Double,
    val bonusAmount: Double,
    val earnedAmount: Double,
    val paidAmount: Double,
    val pendingAmount: Double
)

@Serializable
data class PayrollContractDto(
    @Serializable(with = GraphQlIdSerializer::class) val contractId: String,
    val effectiveDate: String,
    val type: String,
    val frequency: String,
    @Serializable(with = PayrollDecimalSerializer::class) val baseAmount: Double,
    @Serializable(with = PayrollDecimalSerializer::class) val capitalRate: Double,
    @Serializable(with = PayrollDecimalSerializer::class) val collectionRate: Double
)

@Serializable
data class PayrollVacationDto(
    @Serializable(with = GraphQlIdSerializer::class) val id: String,
    val startDate: String,
    val endDate: String,
    val reason: String,
    val replacementEmployeeId: Int? = null,
    val replacementName: String? = null
)

@Serializable
data class PayrollBonusDto(
    @Serializable(with = GraphQlIdSerializer::class) val id: String,
    val date: String,
    @Serializable(with = PayrollDecimalSerializer::class) val amount: Double,
    val reason: String,
    val expenseId: String? = null,
    val cancelledAt: String? = null
)

@Serializable
data class EmployeePayrollDto(
    val employeeId: Int,
    val asOf: String,
    val periods: List<PayrollPeriodDto>,
    val totals: PayrollAmountsDto,
    val contracts: List<PayrollContractDto>,
    val vacations: List<PayrollVacationDto>,
    val bonuses: List<PayrollBonusDto>,
    val routes: List<PayrollRouteDto>,
    val breakdown: List<PayrollMovementDto>
)

@Serializable
data class PayrollRouteDto(
    val routeId: Int,
    val branchId: Int,
    val branchName: String,
    val state: String,
    val provisional: Boolean,
    val openedAt: String,
    @Serializable(with = GraphQlIdSerializer::class) val contractId: String?,
    val type: String?,
    val weight: Double,
    val capitalRate: Double,
    val collectionRate: Double,
    val mode: String,
    val capitalAmount: Double,
    val cashAmount: Double,
    val capitalCommission: Double,
    val collectionCommission: Double,
    @Serializable(with = GraphQlIdSerializer::class) val vacationId: String? = null,
    val coveredEmployeeId: Int? = null
)

@Serializable
data class PayrollMovementDto(
    val routeId: Int,
    val branchId: Int,
    val branchName: String,
    val state: String,
    val provisional: Boolean,
    @Serializable(with = GraphQlIdSerializer::class) val movementId: String,
    val movementDate: String,
    @Serializable(with = GraphQlIdSerializer::class) val contractId: String?,
    val type: String?,
    val weight: Double,
    val capitalRate: Double,
    val collectionRate: Double,
    val mode: String,
    val capitalAmount: Double,
    val cashAmount: Double,
    val excludedReason: String?,
    val capitalCommission: Double,
    val collectionCommission: Double,
    @Serializable(with = GraphQlIdSerializer::class) val vacationId: String? = null,
    val coveredEmployeeId: Int? = null
)
