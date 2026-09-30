package com.backendcreditos.mobile.network

import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

object GraphQlIdSerializer : KSerializer<String> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("GraphQlId", PrimitiveKind.STRING)

    override fun deserialize(decoder: Decoder): String {
        val jsonDecoder = decoder as? JsonDecoder
            ?: return decoder.decodeString()
        return when (val element = jsonDecoder.decodeJsonElement()) {
            is JsonPrimitive -> {
                if (element.isString || element.content.toLongOrNull() != null) {
                    element.content
                } else {
                    throw SerializationException("GraphQL ID must be a string or integer.")
                }
            }
            else -> throw SerializationException("GraphQL ID must be a string or integer.")
        }
    }

    override fun serialize(encoder: Encoder, value: String) = encoder.encodeString(value)
}

@Serializable
data class GraphQlRequest(val query: String, val variables: JsonObject)

@Serializable
data class GraphQlError(
    val message: String,
    val extensions: GraphQlErrorExtensions? = null
)

@Serializable
data class GraphQlErrorExtensions(
    val code: String? = null,
    val currentRecord: JsonElement? = null
)

@Serializable
data class GraphQlEnvelope<T>(
    val data: T? = null,
    val errors: List<GraphQlError> = emptyList()
)

@Serializable
data class LoginData(@SerialName("login") val login: LoginResult)

@Serializable
data class LoginResult(
    val token: String,
    val expiresIn: Int,
    val user: UserDto,
    val company: CompanyDto,
    val branches: List<BranchDto>
)

@Serializable
data class CompanyDto(val id: Int, val name: String)

@Serializable
data class UserDto(
    val userId: Int,
    val companyId: Int,
    val employeeId: Int? = null,
    val employeeMaxCredit: Double? = null,
    val isSuperAdministrator: Boolean = false,
    val username: String,
    val firstName: String,
    val lastName: String,
    val companyName: String
)

@Serializable
data class MeData(val me: UserWithBranchesDto?)

@Serializable
data class UserWithBranchesDto(
    val userId: Int,
    val companyId: Int,
    val employeeId: Int? = null,
    val employeeMaxCredit: Double? = null,
    val isSuperAdministrator: Boolean = false,
    val username: String,
    val firstName: String,
    val lastName: String,
    val companyName: String,
    val branches: List<BranchDto>
)

@Serializable
data class BranchesData(val branches: List<BranchDto>)

@Serializable
data class BranchDto(val id: Int, val name: String, val type: String? = null, val extraCharge: String)

@Serializable
data class PersonDocumentTypesData(val personDocumentTypes: List<PersonDocumentTypeDto>)

@Serializable
data class PersonDocumentTypeDto(val name: String)

@Serializable
data class CustomerCandidateData(val customerCandidate: CustomerCandidateDto?)

@Serializable
data class CustomerCandidateDto(
    val personId: Int,
    val customerId: Int? = null,
    val firstName: String? = null,
    val lastName: String? = null,
    val sex: String? = null,
    val birthDate: String? = null,
    val documentType: String? = null,
    val documentNumber: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val occupation: String? = null,
    val personNote: String? = null,
    val department: String? = null,
    val city: String? = null,
    val neighborhood: String? = null,
    val street: String? = null
)

@Serializable
data class CustomerDto(
    val id: Int,
    val companyId: Int,
    val personId: Int,
    val firstName: String,
    val lastName: String,
    val sex: String? = null,
    val birthDate: String? = null,
    val documentType: String? = null,
    val documentNumber: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val photo: String? = null,
    val occupation: String? = null,
    val personStatus: String? = null,
    val personNote: String? = null,
    val department: String? = null,
    val city: String? = null,
    val neighborhood: String? = null,
    val street: String? = null,
    val maxCredit: Double? = null,
    val nickname: String? = null,
    val note: String? = null,
    val status: String? = null,
    val rating: String? = null,
    val guarantorPersonId: Int? = null,
    val credits: List<CreditDto> = emptyList(),
    val comments: List<CommentDto> = emptyList()
)

@Serializable
data class CreditDto(
    @Serializable(with = GraphQlIdSerializer::class) val id: String,
    val companyId: Int,
    val branchId: Int,
    val customerId: Int,
    val routeId: Int,
    val saleId: Int? = null,
    val concept: String? = null,
    val value: Double? = null,
    val frequency: String? = null,
    val term: Int? = null,
    val principal: Double? = null,
    val balance: Double? = null,
    val description: String? = null,
    val sortOrder: Double? = null,
    val profit: Double? = null,
    val additionalNumber: String? = null,
    val additionalValue: Double? = null,
    val receiptType: String? = null,
    val receiptSeries: String? = null,
    val receiptNumber: String? = null,
    val paymentSummary: String? = null,
    val style: String? = null,
    val note: String? = null,
    val status: String? = null,
    val createdEmployeeId: Int? = null,
    val agreementDate: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val bankFunded: Double? = null,
    val latestPayment: PaymentDto? = null
)

@Serializable
data class CommentDto(
    @Serializable(with = GraphQlIdSerializer::class) val id: String,
    val customerId: Int,
    val comment: String,
    val type: String,
    val userId: Int,
    val createdAt: String? = null,
    val updatedAt: String? = null
)

@Serializable
data class PortfolioData(val portfolio: PortfolioPageDto)

@Serializable
data class PortfolioPageDto(
    val nodes: List<CustomerDto>,
    val snapshotCursor: String,
    val nextCursor: String? = null,
    val hasNextPage: Boolean
)

@Serializable
data class CustomerByIdData(val customerById: CustomerDto? = null)

@Serializable
data class CustomerByDocumentData(val customerByDocument: CustomerDto? = null)

@Serializable
data class PaymentDto(
    @Serializable(with = GraphQlIdSerializer::class) val id: String,
    @Serializable(with = GraphQlIdSerializer::class) val creditId: String,
    val amount: Double,
    val description: String? = null,
    val state: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val routeId: Int? = null,
    val createdByUserId: Int? = null,
    val createdByUsername: String? = null,
    val origin: String? = null,
    val bankAmount: Double? = null
)

@Serializable
data class PaymentHistoryData(val paymentHistory: List<PaymentDto>)

@Serializable
data class SyncChangeDto(
    val cursor: String,
    val recordType: String,
    val recordId: String,
    val action: String,
    val createdAt: String? = null,
    val payload: JsonElement? = null
)

@Serializable
data class SyncChangesData(val syncChanges: SyncChangesPageDto)

@Serializable
data class SyncChangesPageDto(val nodes: List<SyncChangeDto>)

@Serializable
data class ApplyOfflineOperationData(
    val applyOfflineOperation: ApplyOfflineOperationResult
)

@Serializable
data class ApplyOfflineOperationResult(
    val operationId: String,
    val status: String,
    val entityId: String,
    val data: JsonElement? = null,
    val eventCursor: String,
    val replayed: Boolean? = null
)

@Serializable
data class OfflineOperationInput(
    val operationId: String,
    val branchId: Int,
    val kind: String,
    val entityId: String,
    val baseVersion: String?,
    val payload: JsonElement
)

// --- Cartera sub-screens: Morosos, Retirados, Canceladas, Clientes De Cartera ---

@Serializable
data class BranchPermissionsData(val branchPermissions: List<String>)

@Serializable
data class ReceiptSequenceDto(
    val id: Int,
    val documentType: String,
    val series: String? = null,
    val lastNumber: String? = null
)

@Serializable
data class BankAccountDto(val id: Int, val name: String, val type: String? = null, val number: String? = null)

@Serializable
data class BankAccountsData(val bankAccounts: List<BankAccountDto>)

@Serializable
data class RouteCashDto(
    val routeId: Int? = null,
    val base: Double = 0.0,
    val otherIncome: Double = 0.0,
    val expenses: Double = 0.0
)

@Serializable
data class OpenRouteCashData(val openRouteCash: RouteCashDto)

@Serializable
data class ReceiptSequencesData(val receiptSequences: List<ReceiptSequenceDto>)

@Serializable
data class DefaulterCreditDto(
    @Serializable(with = GraphQlIdSerializer::class) val id: String,
    val balance: Double? = null,
    val principal: Double? = null,
    val value: Double? = null,
    val additionalValue: Double? = null,
    val createdAt: String? = null,
    val customerName: String? = null,
    val documentType: String? = null,
    val documentNumber: String? = null,
    val phone: String? = null
)

@Serializable
data class DefaultersOfPortfolioData(val defaultersOfPortfolio: List<DefaulterCreditDto>)

@Serializable
data class WithdrawnCreditDto(
    @Serializable(with = GraphQlIdSerializer::class) val id: String,
    val balance: Double? = null,
    val principal: Double? = null,
    val value: Double? = null,
    val additionalValue: Double? = null,
    val createdAt: String? = null,
    val customerName: String? = null,
    val documentType: String? = null,
    val documentNumber: String? = null,
    val phone: String? = null,
    val status: String? = null
)

@Serializable
data class WithdrawnOfPortfolioData(val withdrawnOfPortfolio: List<WithdrawnCreditDto>)

@Serializable
data class CancelledCreditDto(
    @Serializable(with = GraphQlIdSerializer::class) val id: String,
    val value: Double? = null,
    val principal: Double? = null,
    val additionalValue: Double? = null,
    val createdAt: String? = null,
    val customerName: String? = null,
    val documentType: String? = null,
    val documentNumber: String? = null,
    val phone: String? = null,
    val paidAmount: Double? = null,
    val description: String? = null,
    val cancelledAt: String? = null
)

@Serializable
data class CancelledCreditsData(val cancelledCredits: List<CancelledCreditDto>)

@Serializable
data class PortfolioClientDto(
    val personId: Int,
    val firstName: String? = null,
    val lastName: String? = null,
    val documentType: String? = null,
    val documentNumber: String? = null,
    val sex: String? = null,
    val birthDate: String? = null,
    val occupation: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val department: String? = null,
    val city: String? = null,
    val neighborhood: String? = null,
    val street: String? = null,
    val customerStatus: String? = null,
    val maxCredit: Double? = null,
    val nickname: String? = null
)

@Serializable
data class PortfolioClientsData(val portfolioClients: List<PortfolioClientDto>)

@Serializable
data class RestoreCreditData(val restoreCredit: RestoreCreditResultDto)

@Serializable
data class RestoreCreditResultDto(
    @Serializable(with = GraphQlIdSerializer::class) val id: String,
    val previousState: String,
    val state: String
)

sealed interface ApiResult<out T> {
    data class Success<T>(val value: T) : ApiResult<T>
    data class AuthExpired(val message: String) : ApiResult<Nothing>
    data class Conflict(val message: String, val currentRecord: JsonElement? = null) : ApiResult<Nothing>
    data class PermissionRejected(val message: String) : ApiResult<Nothing>
    data class Rejected(val message: String) : ApiResult<Nothing>
    data class Retryable(val message: String) : ApiResult<Nothing>
}
