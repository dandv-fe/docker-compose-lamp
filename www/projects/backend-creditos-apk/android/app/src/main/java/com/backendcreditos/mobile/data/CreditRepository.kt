package com.backendcreditos.mobile.data

import androidx.room.withTransaction
import com.backendcreditos.mobile.network.ApiResult
import com.backendcreditos.mobile.network.CustomerDto
import com.backendcreditos.mobile.network.GraphQlApi
import com.backendcreditos.mobile.network.OfflineOperationInput
import com.backendcreditos.mobile.security.StoredSession
import kotlinx.serialization.SerializationException
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.put
import java.util.UUID

data class PortfolioRow(val credit: CreditEntity, val customer: CustomerEntity?)

internal fun initialCreditBalance(fields: JsonObject): String {
    val value = (fields["valor"] as? JsonPrimitive)?.content?.toBigDecimalOrNull()
        ?: throw IllegalArgumentException("Valor de tarjeta inválido.")
    val initial = (fields["cuotaInicial"] as? JsonPrimitive)?.content?.toBigDecimalOrNull()
        ?: throw IllegalArgumentException("Cuota inicial inválida.")
    require(value > java.math.BigDecimal.ZERO && initial >= java.math.BigDecimal.ZERO && initial <= value) {
        "La cuota inicial debe estar entre cero y el valor total de la tarjeta."
    }
    return value.subtract(initial).toPlainString()
}

class CreditRepository(
    private val database: CreditDatabase,
    private val api: GraphQlApi
) {
    private val dao = database.localDao()
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun portfolio(accountKey: String, branchId: String): List<PortfolioRow> =
        dao.visiblePortfolio(accountKey, branchId).map { PortfolioRow(it, dao.customer(accountKey, branchId, it.customerId)) }

    suspend fun paymentsForBranch(accountKey: String, branchId: String): List<PaymentEntity> =
        dao.paymentsForBranch(accountKey, branchId)

    suspend fun searchCustomers(accountKey: String, branchId: String, text: String): List<CustomerEntity> =
        dao.searchCustomers(accountKey, branchId, text)

    suspend fun openCustomer(account: StoredSession, branchId: String, customerId: String): ApiResult<CustomerEntity> {
        return when (val response = api.customerById(account.token, branchId, customerId)) {
            is ApiResult.Success -> {
                val dto = response.value.customerById
                    ?: return ApiResult.Rejected("Cliente no disponible para esta sucursal.")
                val entity = dto.toEntity(account, branchId)
                dao.putCustomers(listOf(entity))
                cacheLatestPayments(dto.credits, account, branchId)
                dao.syncCursor(account.accountKey, branchId)?.let { cursor ->
                    dao.setRecordVersions(
                        listOf(RecordVersionEntity(account.accountKey, branchId, "customer", entity.id, cursor)) +
                            dto.comments.map {
                                RecordVersionEntity(account.accountKey, branchId, "comment", it.id, cursor)
                            }
                    )
                }
                ApiResult.Success(entity)
            }
            is ApiResult.AuthExpired -> response
            is ApiResult.Conflict -> response
            is ApiResult.PermissionRejected -> response
            is ApiResult.Rejected -> response
            is ApiResult.Retryable -> response
        }
    }

    suspend fun openCustomerByDocument(
        account: StoredSession, branchId: String, documentType: String, documentNumber: String
    ): ApiResult<CustomerEntity> {
        return when (val response = api.customerByDocument(account.token, branchId, documentType, documentNumber)) {
            is ApiResult.Success -> {
                val dto = response.value.customerByDocument
                if (dto == null) ApiResult.Rejected("No se encontró ese cliente en esta sucursal.")
                else {
                    val entity = dto.toEntity(account, branchId)
                    dao.putCustomers(listOf(entity))
                    cacheLatestPayments(dto.credits, account, branchId)
                    dao.syncCursor(account.accountKey, branchId)?.let { cursor ->
                        dao.setRecordVersions(
                            listOf(RecordVersionEntity(account.accountKey, branchId, "customer", entity.id, cursor)) +
                                dto.comments.map {
                                    RecordVersionEntity(account.accountKey, branchId, "comment", it.id, cursor)
                                }
                        )
                    }
                    ApiResult.Success(entity)
                }
            }
            is ApiResult.AuthExpired -> response
            is ApiResult.Conflict -> response
            is ApiResult.PermissionRejected -> response
            is ApiResult.Rejected -> response
            is ApiResult.Retryable -> response
        }
    }

    suspend fun openPaymentHistory(
        account: StoredSession, branchId: String, creditId: String
    ): ApiResult<List<PaymentEntity>> = when (val response = api.paymentHistory(account.token, branchId, creditId)) {
        is ApiResult.Success -> {
            val entities = response.value.paymentHistory.map { dto ->
                dto.toEntity(account, branchId).preservingLocalOrigin(account, branchId)
            }
            dao.putPayments(entities)
            val cursor = dao.syncCursor(account.accountKey, branchId)
            if (cursor != null) dao.setRecordVersions(entities.map {
                RecordVersionEntity(account.accountKey, branchId, "payment", it.id, cursor)
            })
            ApiResult.Success(entities)
        }
        is ApiResult.AuthExpired -> response
        is ApiResult.Conflict -> response
        is ApiResult.PermissionRejected -> response
        is ApiResult.Rejected -> response
        is ApiResult.Retryable -> response
    }

    suspend fun syncPortfolio(account: StoredSession, branchId: String): ApiResult<Int> {
        var after: String? = null
        var snapshotCursor: String? = null
        var count = 0
        do {
            when (val response = api.portfolio(account.token, branchId, PAGE_SIZE, after, snapshotCursor)) {
                is ApiResult.Success -> {
                    val page = response.value.portfolio
                    if (snapshotCursor == null) snapshotCursor = page.snapshotCursor
                    dao.putCustomers(page.nodes.map { it.toEntity(account, branchId) })
                    val customers = page.nodes.map { it.toEntity(account, branchId) }
                    val credits = page.nodes.flatMap { it.credits }
                        .filter { it.branchId.toString() == branchId }
                        .map { it.toEntity(account, branchId) }
                    dao.putCredits(credits)
                    cacheLatestPayments(page.nodes.flatMap { it.credits }, account, branchId)
                    dao.setRecordVersions(
                        customers.map { RecordVersionEntity(account.accountKey, branchId, "customer", it.id, page.snapshotCursor) } +
                            credits.map { RecordVersionEntity(account.accountKey, branchId, "credit", it.id, page.snapshotCursor) } +
                            page.nodes.flatMap { it.comments }.map {
                                RecordVersionEntity(account.accountKey, branchId, "comment", it.id, page.snapshotCursor)
                            }
                    )
                    count += page.nodes.size
                    if (page.hasNextPage && (page.nextCursor == null || page.nextCursor == after)) {
                        return ApiResult.Rejected("El servidor repitió el cursor de cartera; sincronización detenida.")
                    }
                    after = if (page.hasNextPage) page.nextCursor else null
                }
                is ApiResult.AuthExpired -> return response
                is ApiResult.Conflict -> return response
                is ApiResult.PermissionRejected -> return response
                is ApiResult.Rejected -> return response
                is ApiResult.Retryable -> return response
            }
        } while (after != null)
        snapshotCursor?.let { dao.setSyncCursor(SyncCursorEntity(account.accountKey, branchId, it)) }
        return ApiResult.Success(count)
    }

    suspend fun pullChanges(account: StoredSession, branchId: String): ApiResult<String?> {
        var cursor = dao.syncCursor(account.accountKey, branchId) ?: "0"
        while (true) {
            when (val response = api.syncChanges(account.token, branchId, cursor, PAGE_SIZE)) {
                is ApiResult.Success -> {
                    val changes = response.value.syncChanges.nodes
                    try {
                        database.withTransaction {
                            changes.forEach { change ->
                                val type = change.recordType.uppercase()
                                val deleting = change.action.uppercase() in setOf("DELETE", "DELETED", "REMOVE", "REMOVED")
                                val recordId = change.recordId
                                when (type) {
                                    "CUSTOMER", "CLIENT" -> if (deleting) {
                                        dao.deleteCreditsForCustomer(account.accountKey, branchId, recordId)
                                        dao.deleteCustomer(account.accountKey, branchId, recordId)
                                    } else change.payload?.let { payload ->
                                        val dto = json.decodeFromJsonElement(CustomerDto.serializer(), payload)
                                        dao.putCustomers(listOf(dto.toEntity(account, branchId)))
                                        dao.putCredits(dto.credits.filter { it.branchId.toString() == branchId }
                                            .map { it.toEntity(account, branchId) })
                                        cacheLatestPayments(dto.credits, account, branchId)
                                    }
                                    "CREDIT", "CARD" -> if (deleting) {
                                        dao.deletePaymentsForCredit(account.accountKey, branchId, recordId)
                                        dao.deleteCredit(account.accountKey, branchId, recordId)
                                    } else change.payload?.let { payload ->
                                        val dto = json.decodeFromJsonElement(
                                            com.backendcreditos.mobile.network.CreditDto.serializer(), payload
                                        )
                                        dao.putCredits(listOf(dto.toEntity(account, branchId)))
                                        cacheLatestPayments(listOf(dto), account, branchId)
                                    }
                                    "PAYMENT", "DESCRIPTION" -> if (deleting) {
                                        dao.deletePayment(account.accountKey, branchId, recordId)
                                    } else change.payload?.let { payload ->
                                        val dto = json.decodeFromJsonElement(com.backendcreditos.mobile.network.PaymentDto.serializer(), payload)
                                        dao.putPayments(listOf(dto.toEntity(account, branchId).preservingLocalOrigin(account, branchId)))
                                    }
                                }
                                val recordType = when (type) {
                                    "CUSTOMER", "CLIENT" -> "customer"
                                    "CREDIT", "CARD" -> "credit"
                                    "PAYMENT", "DESCRIPTION" -> "payment"
                                    "COMMENT" -> "comment"
                                    else -> type.lowercase()
                                }
                                dao.setRecordVersions(listOf(
                                    RecordVersionEntity(account.accountKey, branchId, recordType, recordId, change.cursor)
                                ))
                            }
                            if (changes.isNotEmpty()) {
                                val newCursor = changes.last().cursor
                                if (newCursor == cursor && changes.size == PAGE_SIZE) {
                                    throw IllegalStateException("El servidor repitió el cursor de cambios.")
                                }
                                cursor = newCursor
                                dao.setSyncCursor(SyncCursorEntity(account.accountKey, branchId, cursor))
                            }
                        }
                    } catch (error: SerializationException) {
                        return ApiResult.Rejected("No se pudo aplicar un cambio recibido del servidor: ${error.message}")
                    } catch (error: IllegalStateException) {
                        return ApiResult.Rejected(error.message ?: "Cursor de cambios inválido.")
                    }
                    if (changes.size < PAGE_SIZE) return ApiResult.Success(cursor)
                }
                is ApiResult.AuthExpired -> return response
                is ApiResult.Conflict -> return response
                is ApiResult.PermissionRejected -> return response
                is ApiResult.Rejected -> return response
                is ApiResult.Retryable -> return response
            }
        }
    }

    suspend fun enqueue(
        account: StoredSession,
        branchId: String,
        kind: OperationKind,
        entityId: String,
        payload: JsonElement,
        baseVersion: String? = null,
        dependsOnOperationId: String? = null,
        operationId: String = UUID.randomUUID().toString()
    ): OfflineOperationEntity {
        require(branchId.isNotBlank()) { "Selecciona una sucursal antes de crear cambios." }
        if (dependsOnOperationId != null) {
            val dependency = requireNotNull(dao.operation(dependsOnOperationId)) { "No se encontró la operación dependiente." }
            require(
                dependency.accountKey == account.accountKey &&
                    dependency.companyId == account.companyId &&
                    dependency.branchId == branchId
            ) { "La dependencia pertenece a otra cuenta o sucursal." }
        }
        val isCreate = kind in setOf(OperationKind.CREATE_CUSTOMER, OperationKind.CREATE_CREDIT, OperationKind.CREATE_COMMENT)
        val effectiveBaseVersion = if (isCreate) null else baseVersion ?: run {
            val recordType = when (kind) {
                OperationKind.UPDATE_CUSTOMER, OperationKind.UPDATE_DOCUMENT -> "customer"
                OperationKind.CREATE_PAYMENT -> "credit"
                OperationKind.CREATE_COMMENT, OperationKind.UPDATE_COMMENT, OperationKind.DELETE_COMMENT,
                OperationKind.UPSERT_ALERT -> "comment"
                OperationKind.UPDATE_PAYMENT, OperationKind.DELETE_PAYMENT -> "payment"
                else -> "credit"
            }
            val recordId = entityId
            dao.recordVersion(account.accountKey, branchId, recordType, recordId)?.cursor
                ?: dao.syncCursor(account.accountKey, branchId)
                ?: if (kind == OperationKind.UPSERT_ALERT) "0" else null
        }
        require(isCreate || effectiveBaseVersion?.matches(Regex("\\d+")) == true) {
            "No se conoce la versión del servidor para este registro. Sincroniza la sucursal o ingresa su cursor base."
        }
        val operation = OfflineOperationEntity(
            operationId = operationId,
            accountKey = account.accountKey,
            companyId = account.companyId,
            branchId = branchId,
            kind = kind,
            entityId = entityId,
            baseVersion = effectiveBaseVersion,
            payload = json.encodeToString(JsonElement.serializer(), payload),
            dependsOnOperationId = dependsOnOperationId,
            status = OperationStatus.PENDING,
            attempts = 0,
            lastError = null,
            serverState = null,
            createdAt = System.currentTimeMillis()
        )
        dao.addOperation(operation)
        return operation
    }

    suspend fun createCustomerOffline(
        account: StoredSession,
        branchId: String,
        payload: JsonElement,
        localCustomer: CustomerEntity
    ): OfflineOperationEntity {
        val id = UUID.randomUUID().toString()
        val operation = enqueue(account, branchId, OperationKind.CREATE_CUSTOMER, id, payload, operationId = id)
        dao.putCustomers(listOf(localCustomer.copy(
            accountKey = account.accountKey, branchId = branchId, id = id, locallyCreated = true
        )))
        return operation
    }

    suspend fun createCreditOffline(
        account: StoredSession,
        branchId: String,
        creditId: String,
        payload: JsonElement
    ): OfflineOperationEntity {
        val operation = enqueue(
            account, branchId, OperationKind.CREATE_CREDIT, creditId, payload
        )
        val fields = payload as? JsonObject
        if (fields != null) {
            val customerId = fields["idcliente"].textOr(null) ?: return operation
            dao.putCredits(listOf(CreditEntity(
                accountKey = account.accountKey,
                branchId = branchId,
                id = operation.entityId,
                customerId = customerId,
                routeId = null,
                additionalNumber = fields["adicionalNumero"].textOr(null),
                concept = fields["concepto"].textOr(null),
                value = fields["valor"].textOr(null),
                frequency = fields["modo"].textOr(null),
                term = fields["plazo"].intOr(null),
                principal = fields["prestamo"].textOr(null),
                balance = initialCreditBalance(fields),
                description = fields["descripcion"].textOr(null),
                sortOrder = fields["item"].doubleOr(null),
                status = "created",
                saleId = fields["idventa"].intOr(null),
                additionalValue = fields["adicionalValor"].textOr(null),
                receiptType = fields["tipoComprobante"].textOr(null),
                receiptSeries = fields["serie"].textOr(null),
                receiptNumber = fields["numero"].textOr(null),
                note = fields["nota"].textOr(null),
                profit = fields["utilidad"].textOr(null)
            )))
        }
        return operation
    }

    suspend fun applyOptimisticCacheChange(
        operation: OfflineOperationEntity,
        creatorUsername: String? = null,
        creatorUserId: Int? = null
    ) {
        val payload = json.parseToJsonElement(operation.payload)
        when (operation.kind) {
            OperationKind.DELETE_CREDIT -> {
                dao.deletePaymentsForCredit(operation.accountKey, operation.branchId, operation.entityId)
                dao.deleteCredit(operation.accountKey, operation.branchId, operation.entityId)
            }
            OperationKind.DELETE_PAYMENT -> {
                val existingPayment = dao.payment(operation.accountKey, operation.branchId, operation.entityId)
                dao.deletePayment(operation.accountKey, operation.branchId, operation.entityId)
                // Deleting a queued payment must restore the balance it had reduced, otherwise
                // the cached credit stays understated until the next full sync.
                val removedAmount = existingPayment?.amount?.toDoubleOrNull()
                val creditId = existingPayment?.creditId
                if (removedAmount != null && creditId != null) {
                    val existingCredit = dao.portfolio(operation.accountKey, operation.branchId)
                        .firstOrNull { it.id == creditId }
                    if (existingCredit != null) {
                        val newBalance = (existingCredit.balance?.toDoubleOrNull() ?: 0.0) - removedAmount
                        dao.putCredits(listOf(existingCredit.copy(balance = newBalance.toString())))
                    }
                }
            }
            OperationKind.UPDATE_CUSTOMER, OperationKind.UPDATE_DOCUMENT -> {
                val existing = dao.customer(operation.accountKey, operation.branchId, operation.entityId)
                val fields = payload as? JsonObject
                if (existing != null && fields != null) dao.putCustomers(listOf(existing.copy(
                    documentType = fields["tipoDocumento"].textOr(existing.documentType),
                    documentNumber = fields["numeroDocumento"].textOr(existing.documentNumber),
                    firstName = fields["nombres"].textOr(existing.firstName).orEmpty(),
                    lastName = fields["apellidos"].textOr(existing.lastName).orEmpty(),
                    phone = fields["telefono"].textOr(existing.phone),
                    address = fields["calle"].textOr(existing.address),
                    sex = fields["sexo"].textOr(existing.sex),
                    birthDate = fields["fechaNacimiento"].textOr(existing.birthDate),
                    email = fields["email"].textOr(existing.email),
                    occupation = fields["ocupacion"].textOr(existing.occupation),
                    personNote = fields["notaPersona"].textOr(existing.personNote),
                    department = fields["departamento"].textOr(existing.department),
                    city = fields["ciudad"].textOr(existing.city),
                    neighborhood = fields["barrio"].textOr(existing.neighborhood),
                    maxCredit = fields["maxCredito"].textOr(existing.maxCredit),
                    nickname = fields["apodo"].textOr(existing.nickname),
                    customerNote = fields["notaCliente"].textOr(existing.customerNote),
                    customerStatus = fields["estadoCliente"].textOr(existing.customerStatus),
                    guarantorPersonId = fields["fiadorPersonaId"].textOr(existing.guarantorPersonId)
                )))
            }
            OperationKind.UPDATE_CREDIT, OperationKind.UPDATE_CREDIT_TERMS,
            OperationKind.APPLY_DISCOUNT, OperationKind.ADD_INTEREST,
            OperationKind.CHANGE_CREDIT_STATUS, OperationKind.REORDER_CREDIT -> {
                val existing = dao.portfolio(operation.accountKey, operation.branchId)
                    .firstOrNull { it.id == operation.entityId }
                val fields = payload as? JsonObject
                if (existing != null && fields != null) {
                    val adjustment = fields["amount"].doubleOr(null)
                    val adjustedBalance = if (
                        adjustment != null && operation.kind in setOf(OperationKind.APPLY_DISCOUNT, OperationKind.ADD_INTEREST)
                    ) ((existing.balance?.toDoubleOrNull() ?: 0.0) + adjustment).toString()
                    else existing.balance
                    val adjustedProfit = if (
                        adjustment != null && operation.kind in setOf(OperationKind.APPLY_DISCOUNT, OperationKind.ADD_INTEREST)
                    ) ((existing.profit?.toDoubleOrNull() ?: 0.0) + adjustment).toString()
                    else fields["utilidad"].textOr(existing.profit)
                    dao.putCredits(listOf(existing.copy(
                        additionalNumber = fields["adicionalNumero"].textOr(existing.additionalNumber),
                        concept = fields["concepto"].textOr(existing.concept),
                        value = fields["valor"].textOr(existing.value),
                        frequency = fields["modo"].textOr(existing.frequency),
                        term = fields["plazo"].intOr(existing.term),
                        principal = fields["prestamo"].textOr(existing.principal),
                        balance = adjustedBalance,
                        description = fields["descripcion"].textOr(existing.description),
                        status = if (operation.kind == OperationKind.ADD_INTEREST) "refinanciada"
                            else fields["status"].textOr(existing.status),
                        sortOrder = fields["item"].doubleOr(existing.sortOrder),
                        additionalValue = fields["adicionalValor"].textOr(existing.additionalValue),
                        receiptType = fields["tipoComprobante"].textOr(existing.receiptType),
                        receiptSeries = fields["serie"].textOr(existing.receiptSeries),
                        receiptNumber = fields["numero"].textOr(existing.receiptNumber),
                        note = fields["nota"].textOr(existing.note),
                        createdAt = fields["createdAt"].textOr(existing.createdAt),
                        profit = adjustedProfit
                    )))
                }
            }
            OperationKind.CREATE_CREDIT -> {
                val fields = payload as? JsonObject
                val customerId = fields?.get("idcliente").textOr(null)
                if (fields != null && customerId != null) dao.putCredits(listOf(CreditEntity(
                    accountKey = operation.accountKey,
                    branchId = operation.branchId,
                    id = operation.entityId,
                    customerId = customerId,
                    routeId = null,
                    additionalNumber = fields["adicionalNumero"].textOr(null),
                    concept = fields["concepto"].textOr(null),
                    value = fields["valor"].textOr(null),
                    frequency = fields["modo"].textOr(null),
                    term = fields["plazo"].intOr(null),
                    principal = fields["prestamo"].textOr(null),
                    balance = initialCreditBalance(fields),
                    description = fields["descripcion"].textOr(null),
                    sortOrder = fields["item"].doubleOr(null),
                    status = "created",
                    saleId = fields["idventa"].intOr(null),
                    additionalValue = fields["adicionalValor"].textOr(null),
                    receiptType = fields["tipoComprobante"].textOr(null),
                    receiptSeries = fields["serie"].textOr(null),
                    receiptNumber = fields["numero"].textOr(null),
                    note = fields["nota"].textOr(null),
                    profit = fields["utilidad"].textOr(null)
                )))
            }
            OperationKind.CREATE_PAYMENT, OperationKind.UPDATE_PAYMENT -> {
                val fields = payload as? JsonObject
                val paymentId = if (operation.kind == OperationKind.CREATE_PAYMENT) {
                    fields?.get("iddescripcion").textOr(null) ?: operation.entityId
                } else operation.entityId
                val existing = dao.payment(operation.accountKey, operation.branchId, paymentId)
                val creditId = if (operation.kind == OperationKind.CREATE_PAYMENT) operation.entityId else existing?.creditId
                if (fields != null && creditId != null) {
                    val amount = fields["abono"].doubleOr(null)
                    if (amount != null) {
                        dao.putPayments(listOf(
                            (existing ?: PaymentEntity(
                                operation.accountKey, operation.branchId, paymentId, creditId, amount.toString(),
                                fields["descripcion"].textOr(null), "created",
                                // Device clock in epoch millis, the same shape the server sends, so
                                // the row sorts and shows a real date before it is confirmed.
                                System.currentTimeMillis().toString(), null, null,
                                createdLocally = true,
                                creatorUsername = creatorUsername,
                                creatorUserId = creatorUserId
                            )).copy(
                                amount = amount.toString(),
                                description = fields["descripcion"].textOr(existing?.description),
                                createdLocally = existing?.createdLocally ?: true,
                                creatorUsername = existing?.creatorUsername ?: creatorUsername,
                                creatorUserId = existing?.creatorUserId ?: creatorUserId
                            )
                        ))
                        // Keep the cached credit balance in sync with the queued payment so the
                        // composer shows the reduced balance immediately. Without this, the UI
                        // kept showing the pre-payment balance while offline, letting the user
                        // register a duplicate payment against a balance that no longer existed.
                        val existingCredit = dao.portfolio(operation.accountKey, operation.branchId)
                            .firstOrNull { it.id == creditId }
                        if (existingCredit != null) {
                            // UPDATE_PAYMENT replaces a queued payment's amount: undo the old
                            // amount before applying the new one so the balance isn't double-counted.
                            val previousAmount = if (operation.kind == OperationKind.UPDATE_PAYMENT) {
                                existing?.amount?.toDoubleOrNull() ?: 0.0
                            } else 0.0
                            val newBalance = (existingCredit.balance?.toDoubleOrNull() ?: 0.0) - previousAmount + amount
                            dao.putCredits(listOf(existingCredit.copy(balance = newBalance.toString())))
                        }
                    }
                }
            }
            else -> Unit
        }
    }

    suspend fun queuedOperations(account: StoredSession): List<OfflineOperationEntity> =
        dao.allAccountOperations(account.accountKey)

    // Exposed for immediate-feedback polling (see MainActivity.saveTypedOperation): after
    // enqueueing an operation (e.g. an abono/payment) while online, the UI awaits this
    // operation's terminal status instead of only showing a generic "PENDING" notice,
    // without introducing a second, non-idempotent submission path to the server.
    suspend fun operation(operationId: String): OfflineOperationEntity? = dao.operation(operationId)

    // Whether a full snapshot of this branch's portfolio was already downloaded. When true,
    // switching back into the branch only needs pullChanges() (incremental), avoiding a
    // wasteful full re-download of data already cached locally on the device.
    suspend fun hasCachedBranch(accountKey: String, branchId: String): Boolean =
        dao.syncCursor(accountKey, branchId) != null

    // Kept for an explicit "free up space" action (e.g. a settings/storage screen); no
    // longer called automatically on every branch switch, since caches for multiple
    // branches can coexist on-device (all local tables are keyed by branchId) and are
    // kept current via pullChanges() instead of being discarded and re-downloaded.
    suspend fun retainOnlyBranchCache(accountKey: String, branchId: String) {
        database.withTransaction {
            dao.deleteCustomersOutsideBranch(accountKey, branchId)
            dao.deleteCreditsOutsideBranch(accountKey, branchId)
            dao.deletePaymentsOutsideBranch(accountKey, branchId)
            dao.deleteCursorsOutsideBranch(accountKey, branchId)
            dao.deleteRecordVersionsOutsideBranch(accountKey, branchId)
            dao.deleteMarkedCreditsOutsideBranch(accountKey, branchId)
            dao.deleteReceiptSequencesOutsideBranch(accountKey, branchId)
        }
    }

    suspend fun markedCredits(accountKey: String, branchId: String): List<String> =
        dao.markedCredits(accountKey, branchId)

    suspend fun setCreditMarked(accountKey: String, branchId: String, creditId: String, marked: Boolean) {
        if (marked) {
            dao.markCredit(MarkedCreditEntity(accountKey, branchId, creditId, System.currentTimeMillis()))
        } else {
            dao.unmarkCredit(accountKey, branchId, creditId)
        }
    }

    suspend fun unresolvedCount(accountKey: String): Int = dao.unresolvedCount(accountKey)

    suspend fun receiptSequences(accountKey: String, branchId: String) =
        dao.receiptSequences(accountKey, branchId)

    /**
     * Refreshes the branch's receipt counters so a new card can be created offline with the
     * right document sequence, series and next number. A failure is not fatal: the cached copy
     * from the last sync keeps working, which is why the result is only the freshly stored list.
     */
    suspend fun syncReceiptSequences(account: StoredSession, branchId: String): ApiResult<Int> =
        when (val response = api.receiptSequences(account.token, branchId)) {
            is ApiResult.Success -> {
                val sequences = response.value.receiptSequences.map {
                    ReceiptSequenceEntity(
                        accountKey = account.accountKey, branchId = branchId, id = it.id,
                        documentType = it.documentType, series = it.series, lastNumber = it.lastNumber
                    )
                }
                database.withTransaction {
                    dao.deleteReceiptSequences(account.accountKey, branchId)
                    dao.putReceiptSequences(sequences)
                }
                ApiResult.Success(sequences.size)
            }
            is ApiResult.AuthExpired -> response
            is ApiResult.Conflict -> response
            is ApiResult.PermissionRejected -> response
            is ApiResult.Rejected -> response
            is ApiResult.Retryable -> response
        }

    suspend fun syncIsPaused(accountKey: String): Boolean = dao.syncControl(accountKey)?.paused == true

    suspend fun setSyncPaused(accountKey: String, reason: String?) {
        dao.setSyncControl(SyncControlEntity(accountKey, paused = reason != null, pauseReason = reason))
    }

    suspend fun discardResolvedOperation(operationId: String, accountKey: String) {
        val operation = requireNotNull(dao.operation(operationId))
        require(operation.accountKey == accountKey)
        require(operation.status in setOf(OperationStatus.CONFLICT, OperationStatus.REJECTED))
        database.withTransaction {
            dao.rejectPendingDependents(
                operationId,
                "Dependency $operationId was explicitly discarded; review and recreate this operation."
            )
            val server = operation.serverState?.let { encoded ->
                runCatching { json.parseToJsonElement(encoded) }.getOrNull()
            }
            when (operation.kind) {
                OperationKind.CREATE_CUSTOMER, OperationKind.UPDATE_CUSTOMER, OperationKind.UPDATE_DOCUMENT -> {
                    val dto = server?.let {
                        runCatching { json.decodeFromJsonElement(CustomerDto.serializer(), it) }.getOrNull()
                    }
                    if (dto != null) dao.putCustomers(listOf(dto.toEntity(
                        StoredSession(operation.accountKey, "", ""), operation.branchId
                    ))) else {
                        dao.deleteCreditsForCustomer(operation.accountKey, operation.branchId, operation.entityId)
                        dao.deleteCustomer(operation.accountKey, operation.branchId, operation.entityId)
                    }
                }
                OperationKind.CREATE_CREDIT, OperationKind.UPDATE_CREDIT, OperationKind.UPDATE_CREDIT_TERMS,
                OperationKind.DELETE_CREDIT, OperationKind.APPLY_DISCOUNT, OperationKind.ADD_INTEREST,
                OperationKind.CHANGE_CREDIT_STATUS, OperationKind.REORDER_CREDIT -> {
                    val dto = server?.let {
                        runCatching { json.decodeFromJsonElement(com.backendcreditos.mobile.network.CreditDto.serializer(), it) }.getOrNull()
                    }
                    if (dto != null) dao.putCredits(listOf(dto.toEntity(
                        StoredSession(operation.accountKey, "", ""), operation.branchId
                    ))) else dao.deleteCredit(operation.accountKey, operation.branchId, operation.entityId)
                }
                OperationKind.CREATE_PAYMENT -> {
                    val dto = server?.let {
                        runCatching {
                            json.decodeFromJsonElement(com.backendcreditos.mobile.network.CreditDto.serializer(), it)
                        }.getOrNull()
                    }
                    if (dto != null) dao.putCredits(listOf(dto.toEntity(
                        StoredSession(operation.accountKey, "", ""), operation.branchId
                    )))
                    val paymentId = (json.parseToJsonElement(operation.payload) as? JsonObject)
                        ?.get("iddescripcion").textOr(null)
                    if (paymentId != null) dao.deletePayment(operation.accountKey, operation.branchId, paymentId)
                }
                OperationKind.UPDATE_PAYMENT, OperationKind.DELETE_PAYMENT -> {
                    val dto = server?.let {
                        runCatching { json.decodeFromJsonElement(com.backendcreditos.mobile.network.PaymentDto.serializer(), it) }.getOrNull()
                    }
                    if (dto != null) {
                        val localAccount = StoredSession(operation.accountKey, "", "")
                        dao.putPayments(listOf(
                            dto.toEntity(localAccount, operation.branchId)
                                .preservingLocalOrigin(localAccount, operation.branchId)
                        ))
                    } else dao.deletePayment(operation.accountKey, operation.branchId, operation.entityId)
                }
                else -> Unit
            }
            dao.discardResolvedOperation(operationId)
            if (
                dao.blockingOperationCount(accountKey) == 0 &&
                dao.syncControl(accountKey)?.pauseReason in setOf("CONFLICT", "PERMISSION", "PROTOCOL", "REJECTED")
            ) setSyncPaused(accountKey, null)
        }
    }

    suspend fun clearAccount(accountKey: String) {
        database.withTransaction {
            dao.deleteOperations(accountKey)
            dao.deletePayments(accountKey)
            dao.deleteCredits(accountKey)
            dao.deleteCustomers(accountKey)
            dao.deleteSyncCursors(accountKey)
            dao.deleteRecordVersions(accountKey)
            dao.deleteMarkedCredits(accountKey)
            dao.deleteAllReceiptSequences(accountKey)
            dao.deleteSyncControl(accountKey)
        }
    }

    suspend fun operationInput(operation: OfflineOperationEntity): OfflineOperationInput =
        OfflineOperationInput(
            operationId = operation.operationId,
            branchId = requireNotNull(operation.branchId.toIntOrNull()) { "Operation branch ID must be numeric." },
            kind = operation.kind.name,
            entityId = operation.entityId,
            baseVersion = operation.baseVersion,
            payload = json.parseToJsonElement(operation.payload)
        )

    fun serverStateForStorage(operation: OfflineOperationEntity, data: JsonElement?, entityId: String): String? {
        val root = data as? JsonObject ?: return null
        val normalized = kotlinx.serialization.json.buildJsonObject {
            root.forEach { (key, value) -> put(key, value) }
            val aliases = when (operation.kind) {
                OperationKind.CREATE_PAYMENT, OperationKind.CREATE_CREDIT, OperationKind.UPDATE_CREDIT,
                OperationKind.UPDATE_CREDIT_TERMS, OperationKind.DELETE_CREDIT, OperationKind.APPLY_DISCOUNT,
                OperationKind.ADD_INTEREST, OperationKind.CHANGE_CREDIT_STATUS, OperationKind.REORDER_CREDIT ->
                    mapOf(
                        "idtarjeta" to "id", "idglobal" to "companyId", "idsucursal" to "branchId",
                        "idcliente" to "customerId", "iddetalleruta" to "routeId", "idventa" to "saleId",
                        "str_concepto" to "concept", "dec_valor" to "value", "str_modo" to "frequency",
                        "int_tiempo" to "term", "dec_prestamo" to "principal", "dec_resta" to "balance",
                        "str_descripcion" to "description", "float_item" to "sortOrder",
                        "dec_utilidad" to "profit", "str_c_adicional_numero" to "additionalNumber",
                        "dec_c_adicional_valor" to "additionalValue", "str_tipo_comprobante" to "receiptType",
                        "str_serie" to "receiptSeries", "str_numero" to "receiptNumber",
                        "str_abono" to "paymentSummary", "str_nota" to "note", "str_estado" to "status",
                        "created_at" to "createdAt", "updated_at" to "updatedAt"
                    )
                OperationKind.UPDATE_PAYMENT, OperationKind.DELETE_PAYMENT ->
                    mapOf(
                        "iddescripcion" to "id", "idtarjeta" to "creditId", "dec_abono" to "amount",
                        "str_descripcion" to "description", "str_estado" to "state",
                        "created_at" to "createdAt", "updated_at" to "updatedAt", "iddetalleruta" to "routeId"
                    )
                OperationKind.CREATE_COMMENT, OperationKind.UPDATE_COMMENT, OperationKind.DELETE_COMMENT,
                OperationKind.UPSERT_ALERT ->
                    mapOf(
                        "idcomentario" to "id", "str_comentario" to "comment",
                        "str_tipo" to "type", "idusuario" to "userId"
                    )
                else -> emptyMap()
            }
            aliases.forEach { (source, target) ->
                val value = root[source]
                if (value != null && root[target] == null) put(target, value)
            }
            if (root["customerStatus"] != null && root["status"] == null) {
                put("status", root.getValue("customerStatus"))
            }
            if (root["str_comentario"] != null && root["alerta"] == null) {
                put("alerta", root.getValue("str_comentario"))
            }
        }
        val (nestedName, allowedFields) = when (operation.kind) {
            OperationKind.CREATE_CUSTOMER, OperationKind.UPDATE_CUSTOMER, OperationKind.UPDATE_DOCUMENT ->
                "customer" to setOf(
                    "id", "companyId", "personId", "firstName", "lastName", "documentType", "documentNumber",
                    "phone", "street", "sex", "birthDate", "email", "occupation", "status", "rating",
                    "maxCredit", "nickname", "note", "guarantorPersonId", "personNote", "department", "city",
                    "neighborhood", "customerStatus"
                )
            OperationKind.CREATE_CREDIT, OperationKind.UPDATE_CREDIT, OperationKind.UPDATE_CREDIT_TERMS,
            OperationKind.DELETE_CREDIT, OperationKind.APPLY_DISCOUNT, OperationKind.ADD_INTEREST,
            OperationKind.CHANGE_CREDIT_STATUS, OperationKind.REORDER_CREDIT ->
                "credit" to setOf(
                    "id", "companyId", "branchId", "customerId", "routeId", "saleId", "concept", "value",
                    "frequency", "term", "principal", "balance", "description", "sortOrder", "additionalNumber",
                    "additionalValue", "receiptType", "receiptSeries", "receiptNumber", "paymentSummary", "style",
                    "note", "status", "profit", "updatedAt"
                )
            OperationKind.CREATE_PAYMENT ->
                "credit" to setOf(
                    "id", "companyId", "branchId", "customerId", "routeId", "saleId", "concept", "value",
                    "frequency", "term", "principal", "balance", "description", "sortOrder", "additionalNumber",
                    "additionalValue", "receiptType", "receiptSeries", "receiptNumber", "paymentSummary", "style",
                    "note", "status", "profit", "updatedAt"
                )
            OperationKind.UPDATE_PAYMENT, OperationKind.DELETE_PAYMENT ->
                "payment" to setOf("id", "creditId", "amount", "description", "state", "createdAt", "updatedAt", "routeId")
            OperationKind.CREATE_COMMENT, OperationKind.UPDATE_COMMENT, OperationKind.DELETE_COMMENT ->
                "comment" to setOf("id", "customerId", "comment", "type", "userId", "createdAt", "updatedAt")
            OperationKind.UPSERT_ALERT ->
                "alert" to setOf("id", "alerta")
        }
        val selectedObject = (normalized[nestedName] as? JsonObject) ?: normalized
        val numericFields = when (operation.kind) {
            OperationKind.CREATE_CUSTOMER, OperationKind.UPDATE_CUSTOMER, OperationKind.UPDATE_DOCUMENT ->
                setOf("id", "companyId", "personId", "guarantorPersonId")
            OperationKind.CREATE_PAYMENT, OperationKind.CREATE_CREDIT, OperationKind.UPDATE_CREDIT,
            OperationKind.UPDATE_CREDIT_TERMS, OperationKind.DELETE_CREDIT, OperationKind.APPLY_DISCOUNT,
            OperationKind.ADD_INTEREST, OperationKind.CHANGE_CREDIT_STATUS, OperationKind.REORDER_CREDIT ->
                setOf("companyId", "branchId", "customerId", "routeId", "saleId", "term", "createdEmployeeId")
            OperationKind.UPDATE_PAYMENT, OperationKind.DELETE_PAYMENT ->
                setOf("routeId")
            OperationKind.CREATE_COMMENT, OperationKind.UPDATE_COMMENT, OperationKind.DELETE_COMMENT ->
                setOf("customerId", "userId")
            OperationKind.UPSERT_ALERT -> emptySet()
        }
        val decimalFields = when (operation.kind) {
            OperationKind.CREATE_CUSTOMER, OperationKind.UPDATE_CUSTOMER, OperationKind.UPDATE_DOCUMENT ->
                setOf("maxCredit")
            OperationKind.CREATE_PAYMENT -> setOf("value", "principal", "balance", "sortOrder", "profit", "additionalValue")
            OperationKind.CREATE_CREDIT, OperationKind.UPDATE_CREDIT, OperationKind.UPDATE_CREDIT_TERMS,
            OperationKind.DELETE_CREDIT, OperationKind.APPLY_DISCOUNT, OperationKind.ADD_INTEREST,
            OperationKind.CHANGE_CREDIT_STATUS, OperationKind.REORDER_CREDIT ->
                setOf("value", "principal", "balance", "sortOrder", "profit", "additionalValue")
            OperationKind.UPDATE_PAYMENT, OperationKind.DELETE_PAYMENT -> setOf("amount")
            else -> emptySet()
        }
        val selected = kotlinx.serialization.json.buildJsonObject {
            allowedFields.forEach { field ->
                val rawValue = selectedObject[field]
                if (rawValue is JsonPrimitive || rawValue == JsonNull) {
                    val numeric = (rawValue as? JsonPrimitive)?.content
                    val normalizedValue = when {
                        field in numericFields -> numeric?.toIntOrNull()?.let(::JsonPrimitive) ?: rawValue
                        field in decimalFields -> numeric?.toDoubleOrNull()?.let(::JsonPrimitive) ?: rawValue
                        else -> rawValue
                    }
                    put(field, normalizedValue)
                }
            }
            if ("id" in allowedFields && "id" !in selectedObject && entityId.toIntOrNull() != null) {
                put("id", JsonPrimitive(entityId.toInt()))
            }
        }
        if (selected.isEmpty()) return null
        return json.encodeToString(JsonElement.serializer(), selected)
    }

    suspend fun applyServerAcknowledgement(
        operation: OfflineOperationEntity,
        serverState: String?,
        responseEntityId: String
    ) {
        val state = serverState?.let { runCatching { json.parseToJsonElement(it) }.getOrNull() }
        var appliedServerState = false
        database.withTransaction {
            when (operation.kind) {
                OperationKind.CREATE_CUSTOMER -> {
                    val old = dao.customer(operation.accountKey, operation.branchId, operation.entityId)
                    val stateObject = state as? JsonObject
                    val dto = state?.let {
                        runCatching { json.decodeFromJsonElement(CustomerDto.serializer(), it) }.getOrNull()
                    }
                    val serverId = dto?.id?.toString()
                        ?: stateObject?.get("id").textOr(null)?.takeIf(String::isNotBlank)
                        ?: responseEntityId.takeIf(String::isNotBlank)
                    if (old != null) {
                        val confirmed = if (dto != null) dto.toEntity(
                            StoredSession(operation.accountKey, "", ""), operation.branchId
                        ) else old.copy(
                            id = serverId ?: old.id,
                            locallyCreated = false
                        )
                        if (confirmed.id != old.id) dao.deleteCustomer(operation.accountKey, operation.branchId, old.id)
                        dao.putCustomers(listOf(confirmed))
                        appliedServerState = true
                    }
                    val finalId = serverId ?: old?.id
                    if (finalId != null && finalId != operation.entityId) {
                        dao.remapCreditCustomerId(operation.accountKey, operation.branchId, operation.entityId, finalId)
                        remapCustomerDependents(operation, operation.entityId, finalId)
                    }
                    if (old == null && finalId != null) appliedServerState = true
                }
                OperationKind.UPDATE_CUSTOMER, OperationKind.UPDATE_DOCUMENT -> {
                    val dto = state?.let {
                        runCatching { json.decodeFromJsonElement(CustomerDto.serializer(), it) }.getOrNull()
                    }
                    if (dto != null) {
                        dao.putCustomers(listOf(dto.toEntity(
                            StoredSession(operation.accountKey, "", ""), operation.branchId
                        )))
                        appliedServerState = true
                    }
                }
                OperationKind.CREATE_CREDIT, OperationKind.UPDATE_CREDIT, OperationKind.UPDATE_CREDIT_TERMS,
                OperationKind.APPLY_DISCOUNT, OperationKind.ADD_INTEREST, OperationKind.CHANGE_CREDIT_STATUS,
                OperationKind.REORDER_CREDIT -> {
                    val dto = state?.let {
                        runCatching { json.decodeFromJsonElement(com.backendcreditos.mobile.network.CreditDto.serializer(), it) }.getOrNull()
                    }
                    if (dto != null) {
                        if (dto.id != operation.entityId) dao.deleteCredit(operation.accountKey, operation.branchId, operation.entityId)
                        dao.putCredits(listOf(dto.toEntity(
                            StoredSession(operation.accountKey, "", ""), operation.branchId
                        )))
                        appliedServerState = true
                    } else if (operation.kind == OperationKind.CREATE_CREDIT) {
                        val local = dao.portfolio(operation.accountKey, operation.branchId)
                            .firstOrNull { it.id == operation.entityId }
                        val assignedId = responseEntityId.takeIf(String::isNotBlank)
                        if (local != null && assignedId != null) {
                            dao.deleteCredit(operation.accountKey, operation.branchId, operation.entityId)
                            dao.putCredits(listOf(local.copy(id = assignedId)))
                            appliedServerState = true
                        }
                    }
                }
                OperationKind.CREATE_PAYMENT, OperationKind.UPDATE_PAYMENT -> {
                    val dto = state?.let {
                        runCatching { json.decodeFromJsonElement(com.backendcreditos.mobile.network.PaymentDto.serializer(), it) }.getOrNull()
                    }
                    val localPaymentId = if (operation.kind == OperationKind.CREATE_PAYMENT) {
                        (json.parseToJsonElement(operation.payload) as? JsonObject)
                            ?.get("iddescripcion").textOr(null) ?: operation.entityId
                    } else operation.entityId
                    if (dto != null) {
                        if (dto.id != localPaymentId) dao.deletePayment(operation.accountKey, operation.branchId, localPaymentId)
                        val localAccount = StoredSession(operation.accountKey, "", "")
                        dao.putPayments(listOf(
                            dto.toEntity(localAccount, operation.branchId)
                                .preservingLocalOrigin(localAccount, operation.branchId)
                        ))
                        appliedServerState = true
                    } else if (operation.kind == OperationKind.CREATE_PAYMENT) {
                        val local = dao.payment(operation.accountKey, operation.branchId, localPaymentId)
                        val assignedId = responseEntityId.takeIf(String::isNotBlank)
                        if (local != null && assignedId != null) {
                            dao.deletePayment(operation.accountKey, operation.branchId, localPaymentId)
                            dao.putPayments(listOf(local.copy(id = assignedId)))
                            appliedServerState = true
                        }
                    } else {
                        val local = dao.payment(operation.accountKey, operation.branchId, operation.entityId)
                        if (local != null) appliedServerState = true
                    }
                }
                OperationKind.DELETE_CREDIT -> {
                    dao.deletePaymentsForCredit(operation.accountKey, operation.branchId, operation.entityId)
                    dao.deleteCredit(operation.accountKey, operation.branchId, operation.entityId)
                    appliedServerState = true
                }
                OperationKind.DELETE_PAYMENT -> {
                    dao.deletePayment(operation.accountKey, operation.branchId, operation.entityId)
                    appliedServerState = true
                }
                else -> Unit
            }
        }
        if (!appliedServerState) applyOptimisticCacheChange(operation)
    }

    private suspend fun remapCustomerDependents(
        operation: OfflineOperationEntity,
        oldCustomerId: String,
        newCustomerId: String
    ) {
        dao.pendingDependents(operation.operationId).forEach { dependent ->
            val objectPayload = runCatching { json.parseToJsonElement(dependent.payload) }.getOrNull() as? JsonObject
            val currentCustomerId = objectPayload?.get("customerId").textOr(null)
            if (objectPayload != null && currentCustomerId == oldCustomerId) {
                val remapped = JsonObject(objectPayload + ("customerId" to JsonPrimitive(newCustomerId)))
                dao.updatePendingPayload(dependent.operationId, json.encodeToString(JsonElement.serializer(), remapped))
            }
        }
    }

    private fun CustomerDto.toEntity(account: StoredSession, branchId: String) = CustomerEntity(
        accountKey = account.accountKey,
        branchId = branchId,
        id = id.toString(),
        documentType = documentType,
        documentNumber = documentNumber,
        firstName = firstName,
        lastName = lastName,
        phone = phone,
        address = street,
        sex = sex,
        birthDate = birthDate,
        email = email,
        occupation = occupation,
        personNote = personNote,
        department = department,
        city = city,
        neighborhood = neighborhood,
        maxCredit = maxCredit?.toString(),
        nickname = nickname,
        customerNote = note,
        customerStatus = status,
        guarantorPersonId = guarantorPersonId?.toString()
    )

    private suspend fun cacheLatestPayments(
        credits: List<com.backendcreditos.mobile.network.CreditDto>,
        account: StoredSession,
        branchId: String
    ) {
        val payments = credits.mapNotNull { it.latestPayment }
            .map { it.toEntity(account, branchId).preservingLocalOrigin(account, branchId) }
        if (payments.isNotEmpty()) dao.putPayments(payments)
    }

    private suspend fun PaymentEntity.preservingLocalOrigin(
        account: StoredSession,
        branchId: String
    ): PaymentEntity {
        val existing = dao.payment(account.accountKey, branchId, id) ?: return this
        return copy(
            createdLocally = existing.createdLocally,
            creatorUsername = creatorUsername ?: existing.creatorUsername,
            origin = origin ?: existing.origin,
            creatorUserId = creatorUserId ?: existing.creatorUserId
        )
    }

    private fun com.backendcreditos.mobile.network.CreditDto.toEntity(account: StoredSession, branchId: String) =
        CreditEntity(
            accountKey = account.accountKey,
            branchId = branchId,
            id = id,
            customerId = customerId.toString(),
            routeId = routeId,
            additionalNumber = additionalNumber,
            concept = concept,
            value = value?.toString(),
            frequency = frequency,
            term = term,
            principal = principal?.toString(),
            balance = balance?.toString(),
            description = description,
            sortOrder = sortOrder,
            status = status,
            saleId = saleId,
            additionalValue = additionalValue?.toString(),
            receiptType = receiptType,
            receiptSeries = receiptSeries,
            receiptNumber = receiptNumber,
            note = note,
            createdAt = createdAt,
            profit = profit?.toString()
        )

    private fun com.backendcreditos.mobile.network.PaymentDto.toEntity(account: StoredSession, branchId: String) =
        PaymentEntity(
            accountKey = account.accountKey,
            branchId = branchId,
            id = id,
            creditId = creditId,
            amount = amount.toString(),
            description = description,
            state = state,
            createdAt = createdAt,
            updatedAt = updatedAt,
            routeId = routeId,
            creatorUsername = createdByUsername,
            origin = origin,
            creatorUserId = createdByUserId
        )

    private fun JsonElement?.textOr(fallback: String?): String? = when (this) {
        null -> fallback
        JsonNull -> null
        is JsonPrimitive -> content
        else -> fallback
    }

    private fun JsonElement?.intOr(fallback: Int?): Int? =
        (this as? JsonPrimitive)?.content?.toIntOrNull() ?: fallback

    private fun JsonElement?.doubleOr(fallback: Double?): Double? =
        (this as? JsonPrimitive)?.content?.toDoubleOrNull() ?: fallback

    // --- Cartera sub-screens: these mirror webgoez's Morosos/Retirados/Canceladas/Clientes
    // De Cartera screens, which are live management/reporting views in the legacy PHP app
    // too (not part of the offline collection workflow), so they are fetched on demand
    // rather than cached in Room.

    suspend fun branchPermissions(account: StoredSession, branchId: String): ApiResult<List<String>> =
        when (val response = api.branchPermissions(account.token, branchId)) {
            is ApiResult.Success -> ApiResult.Success(response.value.branchPermissions)
            is ApiResult.AuthExpired -> response
            is ApiResult.Conflict -> response
            is ApiResult.PermissionRejected -> response
            is ApiResult.Rejected -> response
            is ApiResult.Retryable -> response
        }

    suspend fun defaultersOfPortfolio(account: StoredSession, branchId: String) =
        when (val response = api.defaultersOfPortfolio(account.token, branchId)) {
            is ApiResult.Success -> ApiResult.Success(response.value.defaultersOfPortfolio)
            is ApiResult.AuthExpired -> response
            is ApiResult.Conflict -> response
            is ApiResult.PermissionRejected -> response
            is ApiResult.Rejected -> response
            is ApiResult.Retryable -> response
        }

    suspend fun withdrawnOfPortfolio(account: StoredSession, branchId: String) =
        when (val response = api.withdrawnOfPortfolio(account.token, branchId)) {
            is ApiResult.Success -> ApiResult.Success(response.value.withdrawnOfPortfolio)
            is ApiResult.AuthExpired -> response
            is ApiResult.Conflict -> response
            is ApiResult.PermissionRejected -> response
            is ApiResult.Rejected -> response
            is ApiResult.Retryable -> response
        }

    suspend fun cancelledCredits(account: StoredSession, branchId: String, dateFrom: String, dateTo: String) =
        when (val response = api.cancelledCredits(account.token, branchId, dateFrom, dateTo)) {
            is ApiResult.Success -> ApiResult.Success(response.value.cancelledCredits)
            is ApiResult.AuthExpired -> response
            is ApiResult.Conflict -> response
            is ApiResult.PermissionRejected -> response
            is ApiResult.Rejected -> response
            is ApiResult.Retryable -> response
        }

    suspend fun portfolioClients(account: StoredSession, branchId: String) =
        when (val response = api.portfolioClients(account.token, branchId)) {
            is ApiResult.Success -> ApiResult.Success(response.value.portfolioClients)
            is ApiResult.AuthExpired -> response
            is ApiResult.Conflict -> response
            is ApiResult.PermissionRejected -> response
            is ApiResult.Rejected -> response
            is ApiResult.Retryable -> response
        }

    // Mirrors model/Cliente.php::restaurarMoroso(): reused by both the Morosos and
    // Retirados "Restaurar" actions; the resulting state string is the legacy literal,
    // not 'activa'. Restored/defaulted credits are excluded from the cached portfolio
    // (see portfolio()'s legacy status filter), so there is no local cache to invalidate.
    suspend fun restoreCredit(account: StoredSession, branchId: String, creditId: String) =
        api.restoreCredit(account.token, branchId, creditId)

    companion object {
        const val PAGE_SIZE = 100
    }
}
