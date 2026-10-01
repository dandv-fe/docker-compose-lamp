package com.backendcreditos.mobile.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable

enum class OperationStatus { PENDING, IN_FLIGHT, CONFIRMED, CONFLICT, REJECTED }

enum class OperationKind {
    CREATE_CUSTOMER, UPDATE_CUSTOMER, UPDATE_DOCUMENT, CREATE_CREDIT, UPDATE_CREDIT,
    UPDATE_CREDIT_TERMS, CREATE_PAYMENT, UPDATE_PAYMENT, DELETE_PAYMENT, DELETE_CREDIT,
    APPLY_DISCOUNT, ADD_INTEREST, CHANGE_CREDIT_STATUS, REORDER_CREDIT, CREATE_COMMENT,
    UPDATE_COMMENT, DELETE_COMMENT, UPSERT_ALERT,
    CREATE_EXPENSE, UPDATE_EXPENSE, DELETE_EXPENSE, CREATE_BASE, UPDATE_BASE, DELETE_BASE
}

@Entity(
    tableName = "customers",
    primaryKeys = ["accountKey", "branchId", "id"],
    indices = [Index("branchId"), Index(value = ["accountKey", "branchId", "documentNumber"])]
)
@Serializable
data class CustomerEntity(
    val accountKey: String,
    val branchId: String,
    val id: String,
    val documentType: String?,
    val documentNumber: String?,
    val firstName: String,
    val lastName: String,
    val phone: String?,
    val address: String?,
    val locallyCreated: Boolean = false,
    val sex: String? = null,
    val birthDate: String? = null,
    val email: String? = null,
    val occupation: String? = null,
    val personNote: String? = null,
    val department: String? = null,
    val city: String? = null,
    val neighborhood: String? = null,
    val maxCredit: String? = null,
    val nickname: String? = null,
    val customerNote: String? = null,
    val customerStatus: String? = null,
    val guarantorPersonId: String? = null
)

@Entity(
    tableName = "credits",
    primaryKeys = ["accountKey", "branchId", "id"],
    indices = [Index("customerId"), Index(value = ["accountKey", "branchId", "status"])]
)
@Serializable
data class CreditEntity(
    val accountKey: String,
    val branchId: String,
    val id: String,
    val customerId: String,
    val routeId: Int?,
    val additionalNumber: String?,
    val concept: String?,
    val value: String?,
    val frequency: String?,
    val term: Int?,
    val principal: String?,
    val balance: String?,
    val description: String?,
    val sortOrder: Double?,
    val status: String?,
    val saleId: Int? = null,
    val additionalValue: String? = null,
    val receiptType: String? = null,
    val receiptSeries: String? = null,
    val receiptNumber: String? = null,
    val note: String? = null,
    val createdAt: String? = null,
    val profit: String? = null,
    // Part of the loan paid out from a bank account (tbl_tarjeta_pago); the rest left in cash.
    val bankFunded: String? = null
)

@Entity(
    tableName = "payments",
    primaryKeys = ["accountKey", "branchId", "id"],
    indices = [Index(value = ["accountKey", "branchId", "creditId"])]
)
@Serializable
data class PaymentEntity(
    val accountKey: String,
    val branchId: String,
    val id: String,
    val creditId: String,
    val amount: String?,
    val description: String?,
    val state: String?,
    val createdAt: String?,
    val updatedAt: String?,
    val routeId: Int?,
    val createdLocally: Boolean = false,
    val creatorUsername: String? = null,
    val origin: String? = null,
    val creatorUserId: Int? = null,
    // Part of the abono received by bank transfer (tbl_descripcion_pago); the rest is cash.
    val bankAmount: String? = null
)

@Entity(
    tableName = "offline_operations",
    indices = [
        Index(value = ["accountKey", "companyId", "branchId", "status", "createdAt"]),
        Index(value = ["operationId"], unique = true)
    ]
)
data class OfflineOperationEntity(
    @PrimaryKey val operationId: String,
    val accountKey: String,
    val companyId: String,
    val branchId: String,
    val kind: OperationKind,
    val entityId: String,
    val baseVersion: String?,
    val payload: String,
    val dependsOnOperationId: String?,
    val status: OperationStatus,
    val attempts: Int,
    val lastError: String?,
    val serverState: String?,
    val createdAt: Long
)

data class BranchEntity(val id: String, val name: String, val type: String? = null)

@Entity(tableName = "sync_control")
data class SyncControlEntity(
    @PrimaryKey val accountKey: String,
    val paused: Boolean,
    val pauseReason: String?
)

@Entity(tableName = "sync_cursors", primaryKeys = ["accountKey", "branchId"])
data class SyncCursorEntity(val accountKey: String, val branchId: String, val cursor: String)

@Entity(
    tableName = "record_versions",
    primaryKeys = ["accountKey", "branchId", "recordType", "recordId"]
)
data class RecordVersionEntity(
    val accountKey: String,
    val branchId: String,
    val recordType: String,
    val recordId: String,
    val cursor: String
)

// What the app told the collector (notices, sync pauses). Stored in the encrypted database,
// capped by CreditRepository to a few days and a few hundred rows, and wiped on logout.
@Entity(tableName = "activity_log", indices = [Index(value = ["accountKey", "createdAt"])])
data class ActivityLogEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val accountKey: String,
    val createdAt: Long,
    val message: String,
    val problem: Boolean
)

// Server-side pocket-cash inputs of the open route day (base, other income, expenses), cached so
// the "Caja" line still shows the last known figures offline. Abonos and credits come from the
// card cache instead, so they update instantly.
@Entity(tableName = "route_cash", primaryKeys = ["accountKey", "branchId"])
data class RouteCashEntity(
    val accountKey: String,
    val branchId: String,
    val routeId: Int?,
    val base: String,
    val otherIncome: String,
    val expenses: String,
    val fetchedAt: Long
)

// Route expenses (gasolina, sueldo, viaticos...) and bases of the open day. Cached from the
// server and also written locally while offline, so the list is always complete: `pending` marks
// the rows that still travel in the queue.
@Entity(tableName = "route_entries", primaryKeys = ["accountKey", "branchId", "id"])
data class RouteEntryEntity(
    val accountKey: String,
    val branchId: String,
    val id: String,
    val kind: String,
    val name: String,
    val detail: String,
    val amount: String,
    val accountingType: Int?,
    val payrollId: Int?,
    val personName: String?,
    val state: String?,
    val createdAt: Long,
    val pending: Boolean = false
)

// The expense concepts the branch office publishes, stored as the JSON the server returned so a
// gasto can still be typed with the right categories after a day without signal.
@Entity(tableName = "route_catalog", primaryKeys = ["accountKey", "branchId"])
data class RouteCatalogEntity(
    val accountKey: String,
    val branchId: String,
    val payloadJson: String,
    val fetchedAt: Long
)

// Device-local reminder ("volver más tarde"). It is never sent to the server and is
// removed with the rest of the account cache on logout.
// Bank accounts (tbl_banco) authorized in the branch (tbl_banco_sucursal), offered besides cash.
@Entity(tableName = "bank_accounts", primaryKeys = ["accountKey", "branchId", "id"])
data class BankAccountEntity(
    val accountKey: String,
    val branchId: String,
    val id: Int,
    val name: String,
    val type: String?,
    val number: String?,
    val holderName: String? = null,
    val holderDocument: String? = null
)

@Entity(tableName = "marked_credits", primaryKeys = ["accountKey", "branchId", "creditId"])
data class MarkedCreditEntity(
    val accountKey: String,
    val branchId: String,
    val creditId: String,
    val markedAt: Long
)

// The branch's receipt counter, cached so "Crear otra tarjeta" can prefill the document
// sequence, series and next number while offline, exactly like the web form's hidden fields.
@Entity(tableName = "receipt_sequences", primaryKeys = ["accountKey", "branchId", "id"])
data class ReceiptSequenceEntity(
    val accountKey: String,
    val branchId: String,
    val id: Int,
    val documentType: String,
    val series: String?,
    val lastNumber: String?
)
