package com.backendcreditos.mobile

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.biometric.BiometricPrompt
import androidx.fragment.app.FragmentActivity
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.backendcreditos.mobile.data.BranchEntity
import com.backendcreditos.mobile.data.CustomerEntity
import com.backendcreditos.mobile.data.OfflineOperationEntity
import com.backendcreditos.mobile.data.OperationKind
import com.backendcreditos.mobile.data.OperationPayloadMapper
import com.backendcreditos.mobile.data.OperationStatus
import com.backendcreditos.mobile.data.PortfolioRow
import com.backendcreditos.mobile.network.ApiResult
import com.backendcreditos.mobile.security.StoredSession
import com.backendcreditos.mobile.work.SyncScheduler
import androidx.work.WorkManager
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.UUID

private enum class Screen { LOGIN, BRANCHES, HOME, CUSTOMER, CREDIT, QUEUE, COMPOSER, DEFAULTERS, WITHDRAWN, CANCELLED, PORTFOLIO_CLIENTS, SYNC_SETTINGS }

class MainActivity : FragmentActivity() {
    fun unlockDevice(onResult: (Boolean, String?) -> Unit) {
        val prompt = BiometricPrompt(
            this,
            ContextCompat.getMainExecutor(this),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    onResult(true, null)
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    onResult(false, errString.toString())
                }
            }
        )
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Desbloquear datos locales")
            .setSubtitle("Este desbloqueo del dispositivo no autentica con el servidor")
            .setAllowedAuthenticators(
                androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG or
                    androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
            )
            .build()
        prompt.authenticate(promptInfo)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as CreditApp
        setContent {
            MaterialTheme {
                CreditApplicationScreen(app, this)
            }
        }
    }
}

/**
 * Friendly Spanish label for an [OperationKind]. Shown instead of the raw enum name
 * (e.g. "CREATE_PAYMENT") in the composer dropdown and the operations queue, since users
 * found the technical English identifiers confusing ("una lista rara").
 */
private fun operationDisplayName(kind: OperationKind): String = when (kind) {
    OperationKind.CREATE_CUSTOMER -> "Crear cliente"
    OperationKind.UPDATE_CUSTOMER -> "Editar cliente"
    OperationKind.UPDATE_DOCUMENT -> "Editar documento"
    OperationKind.CREATE_CREDIT -> "Crear crédito"
    OperationKind.UPDATE_CREDIT -> "Editar crédito"
    OperationKind.UPDATE_CREDIT_TERMS -> "Editar plazo/modo del crédito"
    OperationKind.CREATE_PAYMENT -> "Registrar abono"
    OperationKind.UPDATE_PAYMENT -> "Editar abono"
    OperationKind.DELETE_PAYMENT -> "Eliminar abono"
    OperationKind.DELETE_CREDIT -> "Eliminar crédito"
    OperationKind.APPLY_DISCOUNT -> "Aplicar descuento"
    OperationKind.ADD_INTEREST -> "Agregar interés"
    OperationKind.CHANGE_CREDIT_STATUS -> "Cambiar estado del crédito"
    OperationKind.REORDER_CREDIT -> "Reordenar crédito"
    OperationKind.CREATE_COMMENT -> "Crear comentario"
    OperationKind.UPDATE_COMMENT -> "Editar comentario"
    OperationKind.DELETE_COMMENT -> "Eliminar comentario"
    OperationKind.UPSERT_ALERT -> "Crear/editar alerta"
}

/**
 * Translates known server-side rejection messages (from operations.ts) into plain Spanish
 * so non-technical employees understand *why* something failed, instead of seeing raw
 * English strings like "You are not dispatched on the open route for this branch".
 * Unknown messages are returned unchanged as a safe fallback.
 */
private fun friendlyServerError(rawMessage: String?): String {
    val message = rawMessage.orEmpty()
    return when {
        message.contains("not dispatched on the open route", ignoreCase = true) ->
            "No estás despachado en la ruta de hoy para esta sucursal. Pide que te despachen antes de registrar movimientos."
        message.contains("An open route is required", ignoreCase = true) ->
            "Todavía no hay una ruta abierta (despacho) para esta sucursal hoy."
        message.contains("An employee identity is required", ignoreCase = true) ->
            "Tu usuario no tiene un empleado asociado; no puedes registrar esta operación."
        message.contains("Payments require an open credit", ignoreCase = true) ->
            "Este crédito ya está totalmente pagado (cancelado). No se puede registrar más abonos sobre él."
        message.contains("already has an open payment for the current cycle", ignoreCase = true) ->
            "Este crédito ya tiene un abono registrado hoy sin liquidar. Edita ese abono en vez de crear uno nuevo."
        message.contains("Payment must reduce the current authoritative balance without overpaying", ignoreCase = true) ->
            "El abono es mayor a lo que realmente queda pendiente según el servidor. Revisa el saldo actualizado antes de reintentar."
        message.contains("Payment exceeds the authoritative credit balance", ignoreCase = true) ->
            "El abono editado excede el saldo pendiente según el servidor. Revisa el saldo actualizado antes de reintentar."
        message.contains("Only created payments can be deleted", ignoreCase = true) ->
            "Este abono ya no se puede eliminar; su estado cambió en el servidor."
        message.contains("Only created credits can be deleted", ignoreCase = true) ->
            "Este crédito ya no se puede eliminar; su estado cambió en el servidor."
        message.isBlank() -> "El servidor rechazó la operación."
        else -> message
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CreditApplicationScreen(app: CreditApp, activity: MainActivity) {
    val scope = rememberCoroutineScope()
    var session by remember { mutableStateOf(app.vault.readSession()) }
    var screen by remember { mutableStateOf(Screen.LOGIN) }
    var online by remember { mutableStateOf(false) }
    var company by remember { mutableStateOf(session?.companyId.orEmpty()) }
    var username by remember { mutableStateOf(session?.username.orEmpty()) }
    var password by remember { mutableStateOf("") }
    var branchList by remember { mutableStateOf(emptyList<BranchEntity>()) }
    var rows by remember { mutableStateOf(emptyList<PortfolioRow>()) }
    var customerMatches by remember { mutableStateOf(emptyList<CustomerEntity>()) }
    var customer by remember { mutableStateOf<CustomerEntity?>(null) }
    var selectedCreditId by remember { mutableStateOf<String?>(null) }
    var paymentRows by remember { mutableStateOf(emptyList<com.backendcreditos.mobile.data.PaymentEntity>()) }
    var operationRows by remember { mutableStateOf(emptyList<com.backendcreditos.mobile.data.OfflineOperationEntity>()) }
    var syncControl by remember { mutableStateOf<com.backendcreditos.mobile.data.SyncControlEntity?>(null) }
    var notice by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var search by remember { mutableStateOf("") }
    var showLogoutConfirmation by remember { mutableStateOf(false) }
    var pendingLogoutCount by remember { mutableStateOf(0) }
    var showDocumentLookup by remember { mutableStateOf(false) }
    var documentType by remember { mutableStateOf("") }
    var documentNumber by remember { mutableStateOf("") }
    var operationKind by remember { mutableStateOf(OperationKind.UPDATE_CUSTOMER) }
    var entityId by remember { mutableStateOf("") }
    var draftFirstName by remember { mutableStateOf("") }
    var draftLastName by remember { mutableStateOf("") }
    var draftDocumentType by remember { mutableStateOf("") }
    var draftDocumentNumber by remember { mutableStateOf("") }
    var draftPhone by remember { mutableStateOf("") }
    var draftAddress by remember { mutableStateOf("") }
    var draftSex by remember { mutableStateOf("") }
    var draftBirthDate by remember { mutableStateOf("") }
    var draftEmail by remember { mutableStateOf("") }
    var draftOccupation by remember { mutableStateOf("") }
    var draftPersonNote by remember { mutableStateOf("") }
    var draftDepartment by remember { mutableStateOf("") }
    var draftCity by remember { mutableStateOf("") }
    var draftNeighborhood by remember { mutableStateOf("") }
    var draftMaxCredit by remember { mutableStateOf("0") }
    var draftNickname by remember { mutableStateOf("") }
    var draftCustomerNote by remember { mutableStateOf("") }
    var draftCustomerStatus by remember { mutableStateOf("activo") }
    var draftGuarantorPersonId by remember { mutableStateOf("") }
    var draftCustomerId by remember { mutableStateOf("") }
    var draftDocumentSequenceId by remember { mutableStateOf("") }
    var draftConcept by remember { mutableStateOf("") }
    var draftValue by remember { mutableStateOf("") }
    var draftFrequency by remember { mutableStateOf("") }
    var draftTerm by remember { mutableStateOf("") }
    var draftCreditCreatedAt by remember { mutableStateOf("") }
    var draftPrincipal by remember { mutableStateOf("") }
    var draftBalance by remember { mutableStateOf("") }
    var draftSortOrder by remember { mutableStateOf("") }
    var draftAdditionalNumber by remember { mutableStateOf("") }
    var draftInitialPayment by remember { mutableStateOf("0") }
    var draftProfit by remember { mutableStateOf("0") }
    var draftAdditionalValue by remember { mutableStateOf("0") }
    var draftReceiptType by remember { mutableStateOf("") }
    var draftSeries by remember { mutableStateOf("") }
    var draftReceiptNumber by remember { mutableStateOf("") }
    var draftNote by remember { mutableStateOf("") }
    var draftObligation by remember { mutableStateOf("") }
    var draftDescription by remember { mutableStateOf("") }
    var draftCreditStatus by remember { mutableStateOf("") }
    var draftPaymentAmount by remember { mutableStateOf("") }
    var draftPaymentDescription by remember { mutableStateOf("") }
    // Legacy PHP's abono form only exposes two editable inputs: the abono amount and a
    // manually-typed confirmation of what the balance will be left ("cuanto queda restando").
    // The user must type the confirmation themselves (it is never auto-filled) so a typo in
    // the abono is caught before submission; the server is still the final authority and
    // will reject/flag the operation if its own balance calculation disagrees.
    var draftPaymentConfirmRemaining by remember { mutableStateOf("") }
    var draftPaymentOriginalAmount by remember { mutableStateOf("0") }
    var draftInterestTerm by remember { mutableStateOf("") }
    var draftComment by remember { mutableStateOf("") }
    var draftCommentType by remember { mutableStateOf("comentario") }
    var draftAlertIcon by remember { mutableStateOf("⚠") }
    var draftAlertColor by remember { mutableStateOf("#FF9800") }
    var draftAlertSubject by remember { mutableStateOf("") }
    var draftAlertMessage by remember { mutableStateOf("") }
    var draftBaseVersion by remember { mutableStateOf("") }
    var showOperationConfirmation by remember { mutableStateOf(false) }
    var composerError by remember { mutableStateOf("") }
    // Cartera sub-screens (webgoez "Créditos" submenu): Morosos, Retirados, Canceladas,
    // Clientes De Cartera, gated by the same permission names as the legacy PHP sidebar.
    var branchPermissionSet by remember { mutableStateOf(emptySet<String>()) }
    var defaulterRows by remember { mutableStateOf(emptyList<com.backendcreditos.mobile.network.DefaulterCreditDto>()) }
    var withdrawnRows by remember { mutableStateOf(emptyList<com.backendcreditos.mobile.network.WithdrawnCreditDto>()) }
    var cancelledRows by remember { mutableStateOf(emptyList<com.backendcreditos.mobile.network.CancelledCreditDto>()) }
    var portfolioClientRows by remember { mutableStateOf(emptyList<com.backendcreditos.mobile.network.PortfolioClientDto>()) }
    var cancelledDateFrom by remember { mutableStateOf("") }
    var cancelledDateTo by remember { mutableStateOf("") }
    var syncIntervalMinutes by remember { mutableStateOf(SyncScheduler.readIntervalMinutes(activity)) }
    val branchId = session?.selectedBranchId
    val account = session

    suspend fun loadLocal() {
        val current = session ?: return
        val branch = current.selectedBranchId ?: return
        rows = app.repository.portfolio(current.accountKey, branch)
        customerMatches = app.repository.searchCustomers(current.accountKey, branch, search)
        operationRows = app.repository.queuedOperations(current)
        syncControl = app.database.localDao().syncControl(current.accountKey)
    }

    suspend fun loadOperations() {
        val current = session ?: return
        val branch = current.selectedBranchId ?: return
        operationRows = app.repository.queuedOperations(current)
        syncControl = app.database.localDao().syncControl(current.accountKey)
    }

    suspend fun enqueuePendingBranches(current: StoredSession) {
        app.database.localDao().pendingBranches(current.accountKey, current.companyId).forEach { pendingBranchId ->
            SyncScheduler.enqueue(activity, current.accountKey, pendingBranchId)
        }
    }

    // The background worker pauses all sync (including sending queued abonos) on certain server
    // responses, but does so silently — nothing else in the UI surfaces it unless the user happens
    // to open the Cola screen. Without this, a payment can sit queued locally forever with no clue
    // why. Shown persistently, on every screen, whenever sync is paused and something is waiting.
    fun syncPausedBannerText(): String? {
        val control = syncControl ?: return null
        if (!control.paused) return null
        val pendingCount = operationRows.count { it.status in setOf(OperationStatus.PENDING, OperationStatus.IN_FLIGHT) }
        if (pendingCount == 0) return null
        val plural = if (pendingCount == 1) "cambio" else "cambios"
        return when (control.pauseReason) {
            "AUTH" -> "⚠ Sincronización pausada: tu sesión venció. Tienes $pendingCount $plural sin enviar al servidor " +
                "(incluye abonos). Cierra sesión y vuelve a iniciar sesión para reanudar el envío automático."
            "CONFLICT", "SYNC_CONFLICT" -> "⚠ Sincronización pausada por un conflicto sin resolver. Tienes $pendingCount " +
                "$plural sin enviar; revisa la Cola para resolverlo."
            "PERMISSION" -> "⚠ Sincronización pausada: el servidor rechazó una operación por permisos. Tienes " +
                "$pendingCount $plural sin enviar; revisa la Cola."
            "REJECTED", "PROTOCOL", "SYNC_PROTOCOL" -> "⚠ Sincronización pausada: el servidor rechazó una operación. " +
                "Tienes $pendingCount $plural sin enviar; revisa la Cola."
            else -> "⚠ Sincronización pausada. Tienes $pendingCount $plural sin enviar; revisa la Cola."
        }
    }

    fun report(result: ApiResult<*>) {
        notice = when (result) {
            is ApiResult.Success<*> -> ""
            is ApiResult.AuthExpired -> "La sesión del servidor venció. Vuelve a iniciar sesión para sincronizar."
            is ApiResult.Conflict -> friendlyServerError(result.message)
            is ApiResult.PermissionRejected -> friendlyServerError(result.message)
            is ApiResult.Rejected -> friendlyServerError(result.message)
            is ApiResult.Retryable -> "Sin conexión con el servidor: ${result.message}"
        }
        if (result is ApiResult.AuthExpired) {
            session?.let { current -> scope.launch { app.repository.setSyncPaused(current.accountKey, "AUTH") } }
        }
    }

    suspend fun loadBranchPermissions() {
        val current = session ?: return
        val branch = current.selectedBranchId ?: return
        when (val result = app.repository.branchPermissions(current, branch)) {
            is ApiResult.Success -> branchPermissionSet = result.value.toSet()
            else -> report(result)
        }
    }

    suspend fun loadDefaulters() {
        val current = session ?: return
        val branch = current.selectedBranchId ?: return
        when (val result = app.repository.defaultersOfPortfolio(current, branch)) {
            is ApiResult.Success -> defaulterRows = result.value
            else -> report(result)
        }
    }

    suspend fun loadWithdrawn() {
        val current = session ?: return
        val branch = current.selectedBranchId ?: return
        when (val result = app.repository.withdrawnOfPortfolio(current, branch)) {
            is ApiResult.Success -> withdrawnRows = result.value
            else -> report(result)
        }
    }

    suspend fun loadCancelled() {
        val current = session ?: return
        val branch = current.selectedBranchId ?: return
        if (cancelledDateFrom.isBlank() || cancelledDateTo.isBlank()) {
            notice = "Selecciona el rango de fechas (desde/hasta) para consultar canceladas."
            return
        }
        when (val result = app.repository.cancelledCredits(current, branch, cancelledDateFrom, cancelledDateTo)) {
            is ApiResult.Success -> cancelledRows = result.value
            else -> report(result)
        }
    }

    suspend fun loadPortfolioClients() {
        val current = session ?: return
        val branch = current.selectedBranchId ?: return
        when (val result = app.repository.portfolioClients(current, branch)) {
            is ApiResult.Success -> portfolioClientRows = result.value
            else -> report(result)
        }
    }

    suspend fun restoreAndRefresh(creditId: String, fromScreen: Screen) {
        val current = session ?: return
        val branch = current.selectedBranchId ?: return
        busy = true
        when (val result = app.repository.restoreCredit(current, branch, creditId)) {
            is ApiResult.Success -> {
                notice = "Crédito restaurado. Nuevo estado: ${result.value.restoreCredit.state}."
                if (fromScreen == Screen.DEFAULTERS) loadDefaulters() else loadWithdrawn()
            }
            else -> report(result)
        }
        busy = false
    }

    /**
     * Sends [operation] to the sync worker and, when the device is online, waits briefly
     * for a real terminal result (CONFIRMED/CONFLICT/REJECTED) instead of only leaving a
     * generic "guardada como PENDING" message. This matters most for abonos (payments):
     * agents need to know right away whether the abono actually reached the server.
     * The durable offline queue (with its ordering and optimistic-concurrency guarantees)
     * is unchanged — this only requests high-priority, immediate processing and observes
     * its outcome; if the device is offline or the wait times out, the operation simply
     * stays PENDING and the existing background retry mechanism takes over as before.
     */
    suspend fun submitAndAwaitConfirmation(
        operation: OfflineOperationEntity,
        branch: String,
        current: StoredSession
    ) {
        SyncScheduler.enqueue(activity, current.accountKey, branch, expedited = online)
        if (!online) {
            notice = "Sin conexión: la operación ${operation.operationId} quedó en la cola y se enviará automáticamente al recuperar señal."
            screen = Screen.QUEUE
            return
        }
        notice = "Enviando al servidor…"
        var latest = operation
        val deadlineMs = System.currentTimeMillis() + 15_000
        while (latest.status in setOf(OperationStatus.PENDING, OperationStatus.IN_FLIGHT) &&
            System.currentTimeMillis() < deadlineMs
        ) {
            delay(400)
            latest = app.repository.operation(operation.operationId) ?: latest
        }
        loadLocal()
        loadOperations()
        notice = when (latest.status) {
            OperationStatus.CONFIRMED -> "Operación confirmada por el servidor."
            OperationStatus.CONFLICT -> "El servidor reportó un conflicto: ${friendlyServerError(latest.lastError)}"
            OperationStatus.REJECTED -> "El servidor rechazó la operación: ${friendlyServerError(latest.lastError)}"
            else -> if (syncControl?.pauseReason == "AUTH")
                "Tu sesión venció mientras se procesaba. Quedó guardada localmente pero el servidor no la recibirá " +
                    "hasta que cierres sesión y vuelvas a iniciar sesión; hazlo ahora para enviarla."
            else "La operación sigue pendiente de confirmación; revisa la Cola."
        }
        screen = Screen.QUEUE
    }

    suspend fun saveTypedOperation() {
        val current = session ?: throw IllegalArgumentException("Inicia sesión para guardar cambios.")
        val branch = current.selectedBranchId ?: throw IllegalArgumentException("Selecciona una sucursal.")
        if (operationKind == OperationKind.CREATE_PAYMENT || operationKind == OperationKind.UPDATE_PAYMENT) {
            // Mirrors the legacy PHP abono form: the abono and the confirmed remaining balance are
            // the only two editable fields, and the user must type the confirmation themselves.
            // We check it here against the balance we last synced locally so obvious typos are
            // caught immediately, but the server always recomputes the authoritative balance from
            // its own ledger and will reject/conflict the operation if it disagrees.
            val currentBalance = draftBalance.toDoubleOrNull()
                ?: throw IllegalArgumentException("No se conoce el saldo actual del crédito; sincroniza antes de registrar el abono.")
            val abono = draftPaymentAmount.toDoubleOrNull()
                ?: throw IllegalArgumentException("Ingresa un abono válido.")
            val originalAmount = draftPaymentOriginalAmount.toDoubleOrNull() ?: 0.0
            val expectedRemaining = currentBalance + originalAmount - abono
            val typedRemaining = draftPaymentConfirmRemaining.toDoubleOrNull()
                ?: throw IllegalArgumentException("Confirma cuánto queda restando.")
            if (kotlin.math.abs(typedRemaining - expectedRemaining) > 0.01) {
                throw IllegalArgumentException(
                    "La confirmación de lo que resta ($draftPaymentConfirmRemaining) no coincide; " +
                        "con este abono debería quedar restando ${"%.2f".format(expectedRemaining)}."
                )
            }
        }
        fun customerPayload() = OperationPayloadMapper.customer(
            draftFirstName, draftLastName, draftSex, draftBirthDate.takeIf(String::isNotBlank),
            draftDocumentType, draftDocumentNumber, draftPhone, draftEmail, draftOccupation,
            draftPersonNote, draftDepartment, draftCity, draftNeighborhood, draftAddress,
            draftMaxCredit, draftNickname, draftCustomerNote, draftCustomerStatus, draftGuarantorPersonId
        )
        val mapped = when (operationKind) {
            OperationKind.CREATE_CUSTOMER -> com.backendcreditos.mobile.data.MappedOperation(entityId, customerPayload())
            OperationKind.UPDATE_CUSTOMER -> {
                require(entityId.toIntOrNull()?.let { it > 0 } == true) {
                    "Actualizar un cliente requiere su ID entero asignado por el servidor."
                }
                com.backendcreditos.mobile.data.MappedOperation(entityId, customerPayload())
            }
            OperationKind.CREATE_CREDIT -> OperationPayloadMapper.createCredit(
                entityId, draftCustomerId, draftConcept, draftValue, draftFrequency, draftTerm,
                draftPrincipal, draftDescription, draftInitialPayment, draftSortOrder, draftProfit,
                draftAdditionalNumber, draftAdditionalValue, draftReceiptType, draftSeries,
                draftReceiptNumber, draftNote, draftObligation, draftDocumentSequenceId
            )
            OperationKind.UPDATE_CREDIT -> OperationPayloadMapper.updateCredit(
                entityId, draftConcept, draftValue, draftFrequency, draftTerm, draftPrincipal,
                draftDescription, draftSortOrder, draftProfit, draftAdditionalNumber,
                draftAdditionalValue, draftReceiptType, draftSeries, draftReceiptNumber, draftNote
            )
            OperationKind.UPDATE_CREDIT_TERMS -> OperationPayloadMapper.updateTerms(
                entityId, draftFrequency, draftTerm, draftReceiptNumber, draftCreditCreatedAt
            )
            OperationKind.CREATE_PAYMENT -> OperationPayloadMapper.createPayment(
                selectedCreditId ?: throw IllegalArgumentException("Selecciona un crédito."),
                UUID.randomUUID().toString(), draftPaymentAmount, draftPaymentDescription
            )
            OperationKind.UPDATE_PAYMENT ->
                OperationPayloadMapper.updatePayment(entityId, draftPaymentAmount, draftPaymentDescription)
            OperationKind.DELETE_CREDIT, OperationKind.DELETE_PAYMENT, OperationKind.DELETE_COMMENT ->
                OperationPayloadMapper.delete(entityId)
            OperationKind.APPLY_DISCOUNT ->
                OperationPayloadMapper.discount(entityId, draftPaymentAmount, draftPaymentDescription)
            OperationKind.ADD_INTEREST -> OperationPayloadMapper.interest(
                entityId, draftPaymentAmount, draftInterestTerm, draftPaymentDescription
            )
            OperationKind.CHANGE_CREDIT_STATUS ->
                OperationPayloadMapper.changeStatus(entityId, draftCreditStatus)
            OperationKind.REORDER_CREDIT -> OperationPayloadMapper.reorder(entityId, draftSortOrder)
            OperationKind.CREATE_COMMENT ->
                OperationPayloadMapper.createComment(draftCustomerId, draftComment, draftCommentType)
            OperationKind.UPDATE_COMMENT -> OperationPayloadMapper.updateComment(entityId, draftComment)
            OperationKind.UPSERT_ALERT -> OperationPayloadMapper.upsertAlert(
                draftCustomerId, entityId.ifBlank { UUID.randomUUID().toString() },
                draftAlertIcon, draftAlertColor, draftAlertSubject, draftAlertMessage
            )
            OperationKind.UPDATE_DOCUMENT -> throw IllegalArgumentException("Operación no disponible.")
        }
        val operation = when (operationKind) {
            OperationKind.CREATE_CUSTOMER -> app.repository.createCustomerOffline(
                current, branch, mapped.payload,
                CustomerEntity(
                    accountKey = current.accountKey, branchId = branch, id = entityId,
                    documentType = draftDocumentType, documentNumber = draftDocumentNumber,
                    firstName = draftFirstName, lastName = draftLastName, phone = draftPhone,
                    address = draftAddress, sex = draftSex, birthDate = draftBirthDate,
                    email = draftEmail, occupation = draftOccupation, personNote = draftPersonNote,
                    department = draftDepartment, city = draftCity, neighborhood = draftNeighborhood,
                    maxCredit = draftMaxCredit, nickname = draftNickname, customerNote = draftCustomerNote,
                    customerStatus = draftCustomerStatus, guarantorPersonId = draftGuarantorPersonId
                )
            )
            OperationKind.CREATE_CREDIT ->
                app.repository.createCreditOffline(current, branch, mapped.entityId, mapped.payload)
            else -> app.repository.enqueue(
                current, branch, operationKind, mapped.entityId, mapped.payload,
                draftBaseVersion.trim().ifBlank { null }
            )
        }
        app.repository.applyOptimisticCacheChange(operation)
        loadLocal()
        loadOperations()
        submitAndAwaitConfirmation(operation, branch, current)
    }

    fun logout() {
        val current = session ?: return
        scope.launch {
            WorkManager.getInstance(activity).cancelAllWorkByTag("credit-sync-account-${current.accountKey}")
            app.repository.clearAccount(current.accountKey)
            app.vault.clearSession()
            session = null
            online = false
            rows = emptyList()
            operationRows = emptyList()
            syncControl = null
            password = ""
            screen = Screen.LOGIN
            notice = "Se eliminó la caché local de la cuenta."
        }
    }

    fun prepareComposer(kind: OperationKind, targetId: String = "") {
        operationKind = kind
        entityId = targetId
        composerError = ""
        draftBaseVersion = ""
        customer?.let { selected ->
            draftFirstName = selected.firstName
            draftLastName = selected.lastName
            draftDocumentType = selected.documentType.orEmpty()
            draftDocumentNumber = selected.documentNumber.orEmpty()
            draftPhone = selected.phone.orEmpty()
            draftAddress = selected.address.orEmpty()
            draftSex = selected.sex.orEmpty()
            draftBirthDate = selected.birthDate.orEmpty()
            draftEmail = selected.email.orEmpty()
            draftOccupation = selected.occupation.orEmpty()
            draftPersonNote = selected.personNote.orEmpty()
            draftDepartment = selected.department.orEmpty()
            draftCity = selected.city.orEmpty()
            draftNeighborhood = selected.neighborhood.orEmpty()
            draftMaxCredit = selected.maxCredit ?: "0"
            draftNickname = selected.nickname.orEmpty()
            draftCustomerNote = selected.customerNote.orEmpty()
            draftCustomerStatus = selected.customerStatus.orEmpty()
            draftGuarantorPersonId = selected.guarantorPersonId.orEmpty()
            draftCustomerId = selected.id
        }
        selectedCreditId?.let { id ->
            rows.firstOrNull { it.credit.id == id }?.credit?.let { selected ->
                draftCustomerId = selected.customerId
                draftConcept = selected.concept.orEmpty()
                draftValue = selected.value.orEmpty()
                draftFrequency = selected.frequency ?: "Diario"
                draftTerm = selected.term?.toString().orEmpty()
                draftPrincipal = selected.principal.orEmpty()
                draftBalance = selected.balance.orEmpty()
                draftSortOrder = selected.sortOrder?.toString().orEmpty()
                draftProfit = selected.profit.orEmpty()
                draftAdditionalNumber = selected.additionalNumber.orEmpty()
                draftDescription = selected.description.orEmpty()
                draftCreditStatus = selected.status.orEmpty()
                draftProfit = "0"
                draftAdditionalValue = selected.additionalValue.orEmpty()
                draftReceiptType = selected.receiptType.orEmpty()
                draftSeries = selected.receiptSeries.orEmpty()
                draftReceiptNumber = selected.receiptNumber.orEmpty()
                draftNote = selected.note.orEmpty()
                draftCreditCreatedAt = selected.createdAt.orEmpty()
            }
        }
        if (kind == OperationKind.CREATE_CUSTOMER) {
            draftFirstName = ""
            draftLastName = ""
            draftSex = ""
            draftBirthDate = ""
            draftDocumentType = ""
            draftDocumentNumber = ""
            draftPhone = ""
            draftEmail = ""
            draftOccupation = ""
            draftPersonNote = ""
            draftDepartment = ""
            draftCity = ""
            draftNeighborhood = ""
            draftAddress = ""
            draftMaxCredit = "0"
            draftNickname = ""
            draftCustomerNote = ""
            draftCustomerStatus = "activo"
            draftGuarantorPersonId = ""
        }
        if (kind == OperationKind.CREATE_CREDIT) {
            entityId = UUID.randomUUID().toString()
            draftConcept = ""
            draftValue = ""
            draftFrequency = "Diario"
            draftTerm = "1"
            draftPrincipal = ""
            draftBalance = ""
            draftSortOrder = "0"
            draftAdditionalNumber = ""
            draftDescription = ""
            draftCreditStatus = ""
            draftInitialPayment = "0"
            draftProfit = "0"
            draftAdditionalValue = "0"
            draftReceiptType = ""
            draftSeries = ""
            draftReceiptNumber = ""
            draftNote = ""
            draftObligation = ""
            draftDocumentSequenceId = ""
        }
        if (kind == OperationKind.CREATE_PAYMENT) {
            entityId = selectedCreditId.orEmpty()
            draftPaymentAmount = ""
            draftPaymentDescription = ""
            draftPaymentConfirmRemaining = ""
            draftPaymentOriginalAmount = "0"
        }
        if (kind in setOf(OperationKind.APPLY_DISCOUNT, OperationKind.ADD_INTEREST)) {
            draftPaymentAmount = ""
            draftPaymentDescription = ""
            draftInterestTerm = ""
        }
        if (kind in setOf(OperationKind.CREATE_COMMENT, OperationKind.UPDATE_COMMENT)) {
            draftComment = ""
        }
        if (kind == OperationKind.UPSERT_ALERT) {
            draftAlertIcon = "⚠"
            draftAlertColor = "#FF9800"
            draftAlertSubject = ""
            draftAlertMessage = ""
        }
        screen = Screen.COMPOSER
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Créditos") },
                actions = {
                    if (account != null && screen !in setOf(Screen.LOGIN, Screen.BRANCHES)) {
                        TextButton(onClick = {
                            scope.launch {
                                pendingLogoutCount = app.repository.unresolvedCount(account.accountKey)
                                if (pendingLogoutCount > 0) showLogoutConfirmation = true else logout()
                            }
                        }) { Text("Cerrar sesión") }
                    }
                }
            )
        }
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).padding(16.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (notice.isNotBlank()) Text(notice, color = MaterialTheme.colorScheme.error)
            syncPausedBannerText()?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
            when (screen) {
                Screen.LOGIN -> {
                    Text("Inicio de sesión en línea", style = MaterialTheme.typography.headlineSmall)
                    Text("La primera autenticación necesita conexión. La contraseña no se guarda.")
                    OutlinedTextField(company, { company = it }, label = { Text("Empresa") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(username, { username = it }, label = { Text("Usuario") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(
                        password, { password = it }, label = { Text("Contraseña") },
                        visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth()
                    )
                    Button(
                        enabled = !busy && company.isNotBlank() && username.isNotBlank() && password.isNotEmpty(),
                        onClick = {
                            scope.launch {
                                busy = true
                                notice = ""
                                val previous = app.vault.readSession()
                                val companyId = company.trim().toIntOrNull()
                                if (companyId == null || companyId <= 0) {
                                    notice = "El ID de empresa debe ser un entero positivo."
                                    busy = false
                                    return@launch
                                }
                                when (val response = app.api.login(companyId, username.trim(), password)) {
                                    is ApiResult.Success -> {
                                        val login = response.value.login
                                        val newSession = StoredSession(login.company.id.toString(), login.user.username, login.token)
                                        if (previous != null && previous.accountKey != newSession.accountKey) {
                                            val unresolved = app.repository.unresolvedCount(previous.accountKey)
                                            if (unresolved > 0) {
                                                pendingLogoutCount = unresolved
                                                showLogoutConfirmation = true
                                                notice = "Cierra primero la cuenta guardada; sus operaciones no se pueden transferir a otra cuenta."
                                                busy = false
                                                return@launch
                                            }
                                            app.repository.clearAccount(previous.accountKey)
                                            app.vault.clearSession()
                                        }
                                        password = ""
                                        session = newSession
                                        app.vault.saveSession(newSession)
                                        if (previous?.accountKey == newSession.accountKey &&
                                            app.database.localDao().syncControl(newSession.accountKey)?.pauseReason == "AUTH"
                                        ) app.repository.setSyncPaused(newSession.accountKey, null)
                                        syncControl = app.database.localDao().syncControl(newSession.accountKey)
                                        when (val me = app.api.me(newSession.token)) {
                                            is ApiResult.Success -> {
                                                when (val branches = app.api.branches(newSession.token)) {
                                                    is ApiResult.Success -> {
                                                        branchList = branches.value.branches.map { BranchEntity(it.id.toString(), it.name) }
                                                        enqueuePendingBranches(newSession)
                                                        screen = Screen.BRANCHES
                                                    }
                                                    else -> report(branches)
                                                }
                                            }
                                            else -> report(me)
                                        }
                                    }
                                    is ApiResult.AuthExpired ->
                                        notice = "Empresa, usuario o contraseña incorrectos."
                                    else -> report(response)
                                }
                                busy = false
                            }
                        }
                    ) { Text(if (busy) "Conectando…" else "Iniciar sesión") }
                    if (session?.selectedBranchId != null) {
                        Spacer(Modifier.height(12.dp))
                        HorizontalDivider()
                        Text("Acceso sin conexión", style = MaterialTheme.typography.titleMedium)
                        Text("Solo desbloquea datos sincronizados en este dispositivo; no verifica la sesión del servidor.")
                        OutlinedButton(onClick = {
                            activity.unlockDevice { unlocked, error ->
                                if (unlocked) {
                                    online = false
                                    screen = Screen.HOME
                                    scope.launch {
                                        loadLocal()
                                        loadOperations()
                                    }
                                    notice = "Modo sin conexión: el servidor no ha autenticado esta sesión."
                                } else notice = error ?: "No se pudo desbloquear el dispositivo."
                            }
                        }) { Text("Desbloquear este dispositivo") }
                    }
                    Text("Al reinstalar, las operaciones aún no sincronizadas se pierden.")
                    if (session != null) {
                        TextButton(onClick = {
                            session?.let { current ->
                                scope.launch {
                                    pendingLogoutCount = app.repository.unresolvedCount(current.accountKey)
                                    if (pendingLogoutCount > 0) showLogoutConfirmation = true else logout()
                                }
                            }
                        }) { Text("Eliminar caché y cerrar la cuenta guardada") }
                    }
                }
                Screen.BRANCHES -> {
                    Text("Selecciona una sucursal", style = MaterialTheme.typography.headlineSmall)
                    branchList.forEach { branch ->
                        Card(Modifier.fillMaxWidth().clickable {
                            val current = session ?: return@clickable
                            val selected = current.copy(selectedBranchId = branch.id)
                            session = selected
                            app.vault.saveSession(selected)
                            screen = Screen.HOME
                            online = true
                            scope.launch {
                                busy = true
                                loadBranchPermissions()
                                SyncScheduler.schedulePeriodic(activity, selected.accountKey, branch.id, syncIntervalMinutes)
                                // Avoid throwing away and re-downloading a portfolio already cached on this
                                // device: if this branch was synced before, only pull what changed since then.
                                if (app.repository.hasCachedBranch(selected.accountKey, branch.id)) {
                                    notice = "Actualizando la cartera de ${branch.name}…"
                                    when (val result = app.repository.pullChanges(selected, branch.id)) {
                                        is ApiResult.Success -> {
                                            notice = "Cartera de ${branch.name} al día."
                                            loadLocal()
                                            enqueuePendingBranches(selected)
                                        }
                                        else -> report(result)
                                    }
                                } else {
                                    notice = "Sincronizando la cartera de ${branch.name}…"
                                    when (val result = app.repository.syncPortfolio(selected, branch.id)) {
                                        is ApiResult.Success -> {
                                            app.repository.pullChanges(selected, branch.id)
                                            notice = "Cartera sincronizada (${result.value} créditos)."
                                            loadLocal()
                                            enqueuePendingBranches(selected)
                                        }
                                        else -> report(result)
                                    }
                                }
                                busy = false
                            }
                        }) {
                            Column(Modifier.padding(16.dp)) {
                                Text(branch.name, style = MaterialTheme.typography.titleMedium)
                                Text("Solo se guardará la cartera vinculada a esta sucursal.")
                            }
                        }
                    }
                    TextButton(onClick = {
                        session?.let { current -> app.vault.saveSession(current.copy(selectedBranchId = null)) }
                        session = session?.copy(selectedBranchId = null)
                        screen = Screen.LOGIN
                    }) { Text("Volver") }
                }
                Screen.HOME -> {
                    Text(
                        if (online) "En línea · ${account?.username} · sucursal ${branchId.orEmpty()}"
                        else "Sin conexión · caché de esta sucursal ${branchId.orEmpty()}",
                        style = MaterialTheme.typography.titleMedium
                    )
                    if (!online) Text("El desbloqueo local no autentica ni renueva credenciales del servidor.")
                    OutlinedTextField(
                        search, {
                            search = it
                            session?.selectedBranchId?.let { branch ->
                                session?.let { current ->
                                    scope.launch {
                                        customerMatches = app.repository.searchCustomers(current.accountKey, branch, it)
                                    }
                                }
                            }
                        }, label = { Text("Buscar en cartera y clientes guardados") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = {
                            scope.launch {
                                loadOperations()
                                screen = Screen.QUEUE
                            }
                        }) { Text("Cola") }
                    }
                    OutlinedButton(onClick = {
                        prepareComposer(OperationKind.CREATE_CUSTOMER)
                    }) { Text("Crear cliente") }
                    OutlinedButton(onClick = { prepareComposer(OperationKind.CREATE_CREDIT) }) {
                        Text("Crear crédito")
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (online) OutlinedButton(onClick = { showDocumentLookup = true }) {
                            Text("Buscar cliente por documento")
                        }
                        if (online) OutlinedButton(onClick = {
                            scope.launch {
                                val current = session ?: return@launch
                                val branch = current.selectedBranchId ?: return@launch
                                busy = true
                                when (val result = app.repository.syncPortfolio(current, branch)) {
                                    is ApiResult.Success -> {
                                        app.repository.pullChanges(current, branch)
                                        loadLocal()
                                        notice = "Cartera actualizada."
                                    }
                                    else -> report(result)
                                }
                                busy = false
                            }
                        }) { Text("Actualizar cartera") }
                    }
                    if (busy) Text("Trabajando…")
                    if (online && branchPermissionSet.isNotEmpty()) {
                        Text("Cartera · Gestión", style = MaterialTheme.typography.titleLarge)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if ("ver morosos" in branchPermissionSet) OutlinedButton(onClick = {
                                scope.launch { busy = true; loadDefaulters(); busy = false; screen = Screen.DEFAULTERS }
                            }) { Text("Morosos") }
                            if ("ver retirados" in branchPermissionSet) OutlinedButton(onClick = {
                                scope.launch { busy = true; loadWithdrawn(); busy = false; screen = Screen.WITHDRAWN }
                            }) { Text("Retirados") }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if ("ver canceladas" in branchPermissionSet) OutlinedButton(onClick = {
                                screen = Screen.CANCELLED
                            }) { Text("Canceladas") }
                            if ("ver clientes" in branchPermissionSet) OutlinedButton(onClick = {
                                scope.launch { busy = true; loadPortfolioClients(); busy = false; screen = Screen.PORTFOLIO_CLIENTS }
                            }) { Text("Clientes de cartera") }
                        }
                    }
                    OutlinedButton(onClick = { screen = Screen.SYNC_SETTINGS }) { Text("Sincronización automática") }
                    Text("Cartera guardada", style = MaterialTheme.typography.titleLarge)
                    val filtered = rows.filter { row ->
                        val name = "${row.customer?.firstName.orEmpty()} ${row.customer?.lastName.orEmpty()} ${row.customer?.documentNumber.orEmpty()} ${row.credit.additionalNumber.orEmpty()}"
                        name.contains(search, ignoreCase = true)
                    }
                    if (filtered.isEmpty()) Text("No hay resultados guardados. Sincroniza la sucursal o abre un cliente en línea.")
                    filtered.forEach { row ->
                        Card(Modifier.fillMaxWidth().clickable {
                            selectedCreditId = row.credit.id
                            customer = row.customer
                            scope.launch {
                                val current = session ?: return@launch
                                val branch = current.selectedBranchId ?: return@launch
                                if (online) {
                                    when (val result = app.repository.openPaymentHistory(current, branch, row.credit.id)) {
                                        is ApiResult.Success -> paymentRows = result.value
                                        else -> report(result)
                                    }
                                }
                                paymentRows = app.database.localDao().payments(current.accountKey, branch, row.credit.id)
                                screen = Screen.CREDIT
                            }
                        }) {
                            Column(Modifier.padding(16.dp)) {
                                Text("${row.customer?.firstName.orEmpty()} ${row.customer?.lastName.orEmpty()}")
                                Text("Crédito ${row.credit.additionalNumber ?: row.credit.id} · Saldo ${row.credit.balance ?: "—"}")
                                Text("Estado: ${row.credit.status ?: "—"}")
                                if (operationRows.any {
                                        it.branchId == row.credit.branchId &&
                                            it.entityId == row.credit.id &&
                                            it.status in setOf(OperationStatus.PENDING, OperationStatus.IN_FLIGHT)
                                    }
                                ) Text("Cambio optimista PENDING · sin confirmar", color = MaterialTheme.colorScheme.error)
                            }
                        }
                        if (row.customer != null) TextButton(onClick = {
                            scope.launch {
                                val current = session ?: return@launch
                                val branch = current.selectedBranchId ?: return@launch
                                customer = if (online) {
                                    when (val result = app.repository.openCustomer(current, branch, row.customer.id)) {
                                        is ApiResult.Success -> result.value
                                        else -> {
                                            report(result)
                                            app.database.localDao().customer(current.accountKey, branch, row.customer.id)
                                        }
                                    }
                                } else row.customer
                                screen = Screen.CUSTOMER
                            }
                        }) { Text("Ver cliente") }
                    }
                    if (search.isNotBlank()) {
                        Text("Clientes guardados", style = MaterialTheme.typography.titleLarge)
                        customerMatches.forEach { item ->
                            TextButton(onClick = {
                                customer = item
                                screen = Screen.CUSTOMER
                            }) {
                                Text(
                                    "${item.firstName} ${item.lastName} · ${item.documentNumber.orEmpty()}" +
                                        if (item.locallyCreated) " · PENDING" else ""
                                )
                            }
                        }
                    }
                    Text("Este dispositivo conserva únicamente la cartera de la sucursal y los clientes que abras.")
                }
                Screen.DEFAULTERS -> {
                    val canRestore = "pasar activos" in branchPermissionSet || "pasar activos retirados" in branchPermissionSet
                    Text("Créditos morosos", style = MaterialTheme.typography.headlineSmall)
                    Text("Requiere conexión: esta lista no se guarda en el dispositivo.")
                    if (defaulterRows.isEmpty()) Text("No hay créditos morosos en esta sucursal.")
                    defaulterRows.forEach { credit ->
                        Card(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(16.dp)) {
                                Text(credit.customerName.orEmpty(), style = MaterialTheme.typography.titleMedium)
                                Text("Documento: ${credit.documentType.orEmpty()} ${credit.documentNumber ?: "—"}")
                                Text("Saldo: ${credit.balance ?: "—"} · Valor cuota: ${credit.value ?: "—"}")
                                Text("Teléfono: ${credit.phone.orEmpty()} · Desde: ${credit.createdAt.orEmpty()}")
                                if (canRestore) TextButton(onClick = {
                                    scope.launch { restoreAndRefresh(credit.id, Screen.DEFAULTERS) }
                                }) { Text("Restaurar") }
                            }
                        }
                    }
                    TextButton(onClick = { screen = Screen.HOME }) { Text("Volver") }
                }
                Screen.WITHDRAWN -> {
                    val canRestore = "pasar activos" in branchPermissionSet || "pasar activos retirados" in branchPermissionSet
                    Text("Créditos retirados", style = MaterialTheme.typography.headlineSmall)
                    Text("Requiere conexión: esta lista no se guarda en el dispositivo.")
                    if (withdrawnRows.isEmpty()) Text("No hay créditos retirados en esta sucursal.")
                    withdrawnRows.forEach { credit ->
                        Card(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(16.dp)) {
                                Text(credit.customerName.orEmpty(), style = MaterialTheme.typography.titleMedium)
                                Text("Documento: ${credit.documentType.orEmpty()} ${credit.documentNumber ?: "—"}")
                                Text("Saldo: ${credit.balance ?: "—"} · Estado: ${credit.status ?: "—"}")
                                Text("Teléfono: ${credit.phone.orEmpty()} · Desde: ${credit.createdAt.orEmpty()}")
                                if (canRestore) TextButton(onClick = {
                                    scope.launch { restoreAndRefresh(credit.id, Screen.WITHDRAWN) }
                                }) { Text("Restaurar") }
                            }
                        }
                    }
                    TextButton(onClick = { screen = Screen.HOME }) { Text("Volver") }
                }
                Screen.CANCELLED -> {
                    Text("Créditos cancelados", style = MaterialTheme.typography.headlineSmall)
                    Text("Requiere conexión: esta lista no se guarda en el dispositivo.")
                    OutlinedTextField(
                        cancelledDateFrom, { cancelledDateFrom = it },
                        label = { Text("Desde (AAAA-MM-DD)") }, modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        cancelledDateTo, { cancelledDateTo = it },
                        label = { Text("Hasta (AAAA-MM-DD)") }, modifier = Modifier.fillMaxWidth()
                    )
                    Button(onClick = { scope.launch { busy = true; loadCancelled(); busy = false } }) {
                        Text("Consultar")
                    }
                    if (busy) Text("Trabajando…")
                    if (cancelledRows.isEmpty()) Text("No hay créditos cancelados en el rango seleccionado.")
                    cancelledRows.forEach { credit ->
                        Card(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(16.dp)) {
                                Text(credit.customerName.orEmpty(), style = MaterialTheme.typography.titleMedium)
                                Text("Documento: ${credit.documentType.orEmpty()} ${credit.documentNumber ?: "—"}")
                                Text("Valor: ${credit.value ?: "—"} · Pagado: ${credit.paidAmount ?: "—"}")
                                Text("Cancelado: ${credit.cancelledAt.orEmpty()}")
                                if (!credit.description.isNullOrBlank()) Text(credit.description)
                            }
                        }
                    }
                    TextButton(onClick = { screen = Screen.HOME }) { Text("Volver") }
                }
                Screen.PORTFOLIO_CLIENTS -> {
                    Text("Clientes de cartera", style = MaterialTheme.typography.headlineSmall)
                    Text("Requiere conexión: esta lista no se guarda en el dispositivo.")
                    if (portfolioClientRows.isEmpty()) Text("No hay clientes registrados en esta sucursal.")
                    portfolioClientRows.forEach { client ->
                        Card(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(16.dp)) {
                                Text("${client.firstName.orEmpty()} ${client.lastName.orEmpty()}", style = MaterialTheme.typography.titleMedium)
                                Text("Documento: ${client.documentType.orEmpty()} ${client.documentNumber ?: "—"}")
                                Text("Teléfono: ${client.phone.orEmpty()} · Estado: ${client.customerStatus.orEmpty()}")
                                Text("Cupo máximo: ${client.maxCredit ?: "—"}")
                            }
                        }
                    }
                    TextButton(onClick = { screen = Screen.HOME }) { Text("Volver") }
                }
                Screen.SYNC_SETTINGS -> {
                    Text("Sincronización automática", style = MaterialTheme.typography.headlineSmall)
                    Text(
                        "El sistema operativo obliga a un mínimo de 15 minutos entre sincronizaciones " +
                            "en segundo plano; no es posible bajar de ese límite sin mantener la app " +
                            "abierta en primer plano de forma permanente."
                    )
                    OutlinedTextField(
                        syncIntervalMinutes.toString(),
                        { text -> text.toLongOrNull()?.let { syncIntervalMinutes = it } },
                        label = { Text("Intervalo en minutos (mínimo 15, recomendado 20-30)") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Button(onClick = {
                        val current = session ?: return@Button
                        val branch = current.selectedBranchId ?: return@Button
                        SyncScheduler.schedulePeriodic(activity, current.accountKey, branch, syncIntervalMinutes)
                        syncIntervalMinutes = SyncScheduler.readIntervalMinutes(activity)
                        notice = "Sincronización automática programada cada $syncIntervalMinutes minutos."
                    }) { Text("Guardar") }
                    TextButton(onClick = { screen = Screen.HOME }) { Text("Volver") }
                }
                Screen.CUSTOMER -> {
                    Text("Cliente", style = MaterialTheme.typography.headlineSmall)
                    customer?.let { selectedCustomer ->
                        Text("${selectedCustomer.firstName} ${selectedCustomer.lastName}", style = MaterialTheme.typography.titleLarge)
                        Text("Documento: ${selectedCustomer.documentType.orEmpty()} ${selectedCustomer.documentNumber.orEmpty()}")
                        Text("Teléfono: ${selectedCustomer.phone.orEmpty()}")
                        Text("Dirección: ${selectedCustomer.address.orEmpty()}")
                        Text(if (selectedCustomer.locallyCreated) "Pendiente de sincronización" else "Datos guardados localmente")
                        if (operationRows.any { operation ->
                                operation.branchId == selectedCustomer.branchId &&
                                    operation.entityId == selectedCustomer.id &&
                                    operation.status in setOf(OperationStatus.PENDING, OperationStatus.IN_FLIGHT)
                            }
                        ) Text("Hay una edición local pendiente · no confirmada")
                    } ?: Text("Cliente no disponible en la caché.")
                    Button(
                        enabled = customer?.locallyCreated != true,
                        onClick = { prepareComposer(OperationKind.UPDATE_CUSTOMER, customer?.id.orEmpty()) }
                    ) {
                        Text("Editar cliente")
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            enabled = customer?.locallyCreated != true,
                            onClick = { prepareComposer(OperationKind.CREATE_COMMENT) }
                        ) { Text("Agregar comentario") }
                        OutlinedButton(
                            enabled = customer?.locallyCreated != true,
                            onClick = { prepareComposer(OperationKind.UPSERT_ALERT) }
                        ) { Text("Crear / editar alerta") }
                    }
                    if (customer?.locallyCreated == true) {
                        Text("Este cliente aún no tiene ID del servidor. Edítalo después de confirmar su creación.")
                    }
                    TextButton(onClick = { screen = Screen.HOME }) { Text("Volver a cartera") }
                }
                Screen.CREDIT -> {
                    val credit = rows.firstOrNull { it.credit.id == selectedCreditId }?.credit
                    Text("Crédito / tarjeta", style = MaterialTheme.typography.headlineSmall)
                    credit?.let { selectedCredit ->
                        Text("Crédito ${selectedCredit.additionalNumber ?: selectedCredit.id}")
                        Text("Principal: ${selectedCredit.principal.orEmpty()} · Saldo: ${selectedCredit.balance.orEmpty()}")
                        Text("Concepto: ${selectedCredit.concept.orEmpty()} · Valor: ${selectedCredit.value.orEmpty()}")
                        Text("Estado: ${selectedCredit.status.orEmpty()} · Orden: ${selectedCredit.sortOrder ?: "—"}")
                        if (operationRows.any { operation ->
                                operation.branchId == selectedCredit.branchId &&
                                    operation.entityId == selectedCredit.id &&
                                    operation.status in setOf(OperationStatus.PENDING, OperationStatus.IN_FLIGHT)
                            }
                        ) Text("Cambio optimista PENDING · sin confirmar", color = MaterialTheme.colorScheme.error)
                    }
                    // Regla de negocio (igual que el legado: "No puede duplicar la Cuota"):
                    // solo puede existir un abono abierto (no liquidado) por crédito a la vez.
                    // Si ya hay uno, se debe editar en vez de crear uno nuevo.
                    val openPayment = paymentRows.firstOrNull { it.creditId == selectedCreditId && it.state != "saved" }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = { prepareComposer(OperationKind.CREATE_PAYMENT) },
                            enabled = openPayment == null
                        ) {
                            Text("Registrar pago")
                        }
                        OutlinedButton(onClick = { prepareComposer(OperationKind.UPDATE_CREDIT, selectedCreditId.orEmpty()) }) {
                            Text("Editar crédito")
                        }
                    }
                    if (openPayment != null) Text(
                        "Este crédito ya tiene un abono registrado hoy (sin liquidar). Usa \"Editar pago\" abajo si necesitas corregirlo.",
                        color = MaterialTheme.colorScheme.error
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = {
                            prepareComposer(OperationKind.DELETE_CREDIT, selectedCreditId.orEmpty())
                        }) { Text("Eliminar crédito") }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = {
                            prepareComposer(OperationKind.CHANGE_CREDIT_STATUS, selectedCreditId.orEmpty())
                        }) { Text("Cambiar estado") }
                        OutlinedButton(onClick = {
                            prepareComposer(OperationKind.REORDER_CREDIT, selectedCreditId.orEmpty())
                        }) { Text("Reordenar") }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = {
                            prepareComposer(OperationKind.APPLY_DISCOUNT, selectedCreditId.orEmpty())
                        }) { Text("Aplicar descuento") }
                        OutlinedButton(onClick = {
                            prepareComposer(OperationKind.ADD_INTEREST, selectedCreditId.orEmpty())
                        }) { Text("Agregar interés") }
                    }
                    Text("Pagos", style = MaterialTheme.typography.titleMedium)
                    paymentRows.forEach { payment ->
                        val displayedAmount = payment.amount?.toDoubleOrNull()?.let { kotlin.math.abs(it).toString() } ?: "—"
                        Text("Pago ${payment.id} · $displayedAmount · ${payment.createdAt ?: "—"} · ${payment.state.orEmpty()}")
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TextButton(onClick = {
                                prepareComposer(OperationKind.UPDATE_PAYMENT, payment.id)
                                val originalAmount = kotlin.math.abs(payment.amount?.toDoubleOrNull() ?: 0.0).toString()
                                draftPaymentAmount = originalAmount
                                draftPaymentOriginalAmount = originalAmount
                                draftPaymentDescription = payment.description.orEmpty()
                                draftPaymentConfirmRemaining = ""
                            }) { Text("Editar pago") }
                            TextButton(onClick = {
                                prepareComposer(OperationKind.DELETE_PAYMENT, payment.id)
                            }) { Text("Eliminar pago") }
                        }
                    }
                    if (online) OutlinedButton(onClick = {
                        scope.launch {
                            val current = session ?: return@launch
                            val branch = current.selectedBranchId ?: return@launch
                            when (val result = app.repository.openPaymentHistory(current, branch, selectedCreditId.orEmpty())) {
                                is ApiResult.Success -> paymentRows = result.value
                                else -> report(result)
                            }
                        }
                    }) { Text("Actualizar pagos") }
                    TextButton(onClick = { screen = Screen.HOME }) { Text("Volver a cartera") }
                }
                Screen.QUEUE -> {
                    Text("Operaciones locales", style = MaterialTheme.typography.headlineSmall)
                    Text("PENDING e IN_FLIGHT se muestran como cambios pendientes. Solo una respuesta del servidor los confirma.")
                    operationRows.forEach { operation ->
                        Card(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(12.dp)) {
                                Text("${operationDisplayName(operation.kind)} · ${operation.status}", style = MaterialTheme.typography.titleMedium)
                                if (operation.status == OperationStatus.PENDING || operation.status == OperationStatus.IN_FLIGHT) {
                                    Text("Cambio local pendiente · no confirmado por el servidor")
                                }
                                if (operation.status == OperationStatus.CONFLICT) {
                                    Text("Conflicto del servidor: compara el estado actual y descarta o vuelve a crear deliberadamente.")
                                }
                                if (operation.status == OperationStatus.REJECTED) {
                                    Text("Operación rechazada (incluidos permisos o reglas del servidor); no se reintentará automáticamente.")
                                }
                                Text("ID de operación: ${operation.operationId}")
                                Text("Entidad: ${operation.entityId} · sucursal ${operation.branchId}")
                                operation.lastError?.let { Text(friendlyServerError(it), color = MaterialTheme.colorScheme.error) }
                                if (operation.status == OperationStatus.CONFLICT || operation.status == OperationStatus.REJECTED) {
                                    Text("Estado del servidor:")
                                    Text(
                                        operation.serverState
                                            ?: "No se recibió una entidad actual. Al descartar se quitará este borrador de la caché para evitar mostrar datos optimistas como si fueran actuales."
                                    )
                                    Text("Revisa el estado del servidor antes de descartar este borrador. El estado devuelto queda visible arriba.")
                                    TextButton(onClick = {
                                        scope.launch {
                                            app.repository.discardResolvedOperation(operation.operationId, operation.accountKey)
                                            loadOperations()
                                            session?.let { enqueuePendingBranches(it) }
                                            screen = Screen.QUEUE
                                            notice = "Se descartó el borrador por decisión explícita."
                                        }
                                    }) { Text("Descartar borrador y aplicar el estado del servidor disponible") }
                                }
                            }
                        }
                    }
                    Text("Las operaciones sin conexión solo viven en este dispositivo y se perderán si desinstalas la app.")
                    TextButton(onClick = { screen = Screen.HOME }) { Text("Volver") }
                }
                Screen.COMPOSER -> {
                    Text("Crear o editar", style = MaterialTheme.typography.headlineSmall)
                    Text("Formularios tipados disponibles; el servidor valida las reglas de negocio.")
                    // La operación queda fija según el botón desde el que se entró (p.ej. "Crear cliente",
                    // "Registrar abono"); ya no se puede saltar a una operación no relacionada desde aquí.
                    Text("Operación: ${operationDisplayName(operationKind)}", style = MaterialTheme.typography.titleMedium)
                    when (operationKind) {
                        OperationKind.CREATE_CUSTOMER, OperationKind.UPDATE_CUSTOMER -> {
                            if (operationKind == OperationKind.UPDATE_CUSTOMER && customer?.locallyCreated == true) {
                                Text("La edición requiere el ID numérico asignado por el servidor.")
                            }
                            OutlinedTextField(draftFirstName, { draftFirstName = it }, label = { Text("Nombres *") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftLastName, { draftLastName = it }, label = { Text("Apellidos *") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftSex, { draftSex = it }, label = { Text("Sexo") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftBirthDate, { draftBirthDate = it }, label = { Text("Fecha de nacimiento") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftDocumentType, { draftDocumentType = it }, label = { Text("Tipo de documento *") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftDocumentNumber, { draftDocumentNumber = it }, label = { Text("Número de documento *") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftPhone, { draftPhone = it }, label = { Text("Teléfono") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftEmail, { draftEmail = it }, label = { Text("Correo") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftOccupation, { draftOccupation = it }, label = { Text("Ocupación") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftPersonNote, { draftPersonNote = it }, label = { Text("Nota de persona") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftDepartment, { draftDepartment = it }, label = { Text("Departamento") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftCity, { draftCity = it }, label = { Text("Ciudad") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftNeighborhood, { draftNeighborhood = it }, label = { Text("Barrio") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftAddress, { draftAddress = it }, label = { Text("Calle") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftMaxCredit, { draftMaxCredit = it }, label = { Text("Límite de crédito *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                            OutlinedTextField(draftNickname, { draftNickname = it }, label = { Text("Apodo") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftCustomerNote, { draftCustomerNote = it }, label = { Text("Nota de cliente") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftCustomerStatus, { draftCustomerStatus = it }, label = { Text("Estado de cliente") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftGuarantorPersonId, { draftGuarantorPersonId = it }, label = { Text("ID persona fiador (opcional)") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                        }
                        OperationKind.CREATE_CREDIT -> {
                            OutlinedTextField(draftCustomerId, { draftCustomerId = it }, label = { Text("ID de cliente del servidor *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                            OutlinedTextField(draftDocumentSequenceId, { draftDocumentSequenceId = it }, label = { Text("ID de consecutivo de documento de sucursal *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                            Text("La ruta abierta la asigna el servidor; no se envía routeId.")
                            OutlinedTextField(draftConcept, { draftConcept = it }, label = { Text("Concepto *") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftValue, { draftValue = it }, label = { Text("Valor *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                            OutlinedTextField(draftFrequency, { draftFrequency = it }, label = { Text("Modo (Diario/Semanal/Quincenal/Mensual) *") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftTerm, { draftTerm = it }, label = { Text("Plazo *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                            OutlinedTextField(draftPrincipal, { draftPrincipal = it }, label = { Text("Préstamo *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                            OutlinedTextField(draftDescription, { draftDescription = it }, label = { Text("Descripción") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftInitialPayment, { draftInitialPayment = it }, label = { Text("Cuota inicial") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                            OutlinedTextField(draftSortOrder, { draftSortOrder = it }, label = { Text("Orden / item *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                            OutlinedTextField(draftProfit, { draftProfit = it }, label = { Text("Utilidad *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                            OutlinedTextField(draftAdditionalNumber, { draftAdditionalNumber = it }, label = { Text("Número adicional *") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftAdditionalValue, { draftAdditionalValue = it }, label = { Text("Valor adicional *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                            OutlinedTextField(draftReceiptType, { draftReceiptType = it }, label = { Text("Tipo comprobante *") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftSeries, { draftSeries = it }, label = { Text("Serie *") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftReceiptNumber, { draftReceiptNumber = it }, label = { Text("Número comprobante *") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftNote, { draftNote = it }, label = { Text("Nota *") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftObligation, { draftObligation = it }, label = { Text("Obligación (opcional)") }, modifier = Modifier.fillMaxWidth())
                        }
                        OperationKind.UPDATE_CREDIT -> {
                            OutlinedTextField(draftConcept, { draftConcept = it }, label = { Text("Concepto *") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftValue, { draftValue = it }, label = { Text("Valor *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                            OutlinedTextField(draftFrequency, { draftFrequency = it }, label = { Text("Modo *") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftTerm, { draftTerm = it }, label = { Text("Plazo *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                            OutlinedTextField(draftPrincipal, { draftPrincipal = it }, label = { Text("Préstamo *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                            OutlinedTextField(draftDescription, { draftDescription = it }, label = { Text("Descripción") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftSortOrder, { draftSortOrder = it }, label = { Text("Orden / item *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                            OutlinedTextField(draftProfit, { draftProfit = it }, label = { Text("Utilidad *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                            OutlinedTextField(draftAdditionalNumber, { draftAdditionalNumber = it }, label = { Text("Número adicional *") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftAdditionalValue, { draftAdditionalValue = it }, label = { Text("Valor adicional *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                            OutlinedTextField(draftReceiptType, { draftReceiptType = it }, label = { Text("Tipo comprobante *") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftSeries, { draftSeries = it }, label = { Text("Serie *") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftReceiptNumber, { draftReceiptNumber = it }, label = { Text("Número comprobante *") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftNote, { draftNote = it }, label = { Text("Nota *") }, modifier = Modifier.fillMaxWidth())
                        }
                        OperationKind.UPDATE_CREDIT_TERMS -> {
                            OutlinedTextField(draftFrequency, { draftFrequency = it }, label = { Text("Modo *") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftTerm, { draftTerm = it }, label = { Text("Plazo *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                            OutlinedTextField(draftReceiptNumber, { draftReceiptNumber = it }, label = { Text("Número comprobante *") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftCreditCreatedAt, { draftCreditCreatedAt = it }, label = { Text("Fecha de creación (YYYY-MM-DD HH:MM:SS) *") }, modifier = Modifier.fillMaxWidth())
                        }
                        OperationKind.CREATE_PAYMENT, OperationKind.UPDATE_PAYMENT -> {
                            Text("Crédito asociado: ${selectedCreditId ?: "ninguno"}")
                            Text("Saldo actual: ${draftBalance.ifBlank { "0" }}")
                            if (operationKind == OperationKind.UPDATE_PAYMENT) {
                                OutlinedTextField(entityId, { entityId = it }, label = { Text("ID del pago *") }, modifier = Modifier.fillMaxWidth())
                            }
                            OutlinedTextField(draftPaymentAmount, { draftPaymentAmount = it }, label = { Text("Abono * (ingrese positivo; se enviará negativo)") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                            OutlinedTextField(
                                draftPaymentConfirmRemaining, { draftPaymentConfirmRemaining = it },
                                label = { Text("Confirma cuánto queda restando *") },
                                modifier = Modifier.fillMaxWidth(),
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            )
                        }
                        OperationKind.APPLY_DISCOUNT, OperationKind.ADD_INTEREST -> {
                            OutlinedTextField(draftPaymentAmount, { draftPaymentAmount = it }, label = { Text(if (operationKind == OperationKind.APPLY_DISCOUNT) "Valor de descuento *" else "Valor de interés *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                            if (operationKind == OperationKind.ADD_INTEREST) OutlinedTextField(draftInterestTerm, { draftInterestTerm = it }, label = { Text("Plazo adicional *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                            OutlinedTextField(draftPaymentDescription, { draftPaymentDescription = it }, label = { Text("Descripción") }, modifier = Modifier.fillMaxWidth())
                        }
                        OperationKind.CHANGE_CREDIT_STATUS ->
                            OutlinedTextField(draftCreditStatus, { draftCreditStatus = it }, label = { Text("Estado permitido: moroso, fallecio, discapacitado") }, modifier = Modifier.fillMaxWidth())
                        OperationKind.REORDER_CREDIT ->
                            OutlinedTextField(draftSortOrder, { draftSortOrder = it }, label = { Text("Nuevo item / posición *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                        OperationKind.CREATE_COMMENT, OperationKind.UPDATE_COMMENT -> {
                            if (operationKind == OperationKind.UPDATE_COMMENT) {
                                OutlinedTextField(entityId, { entityId = it }, label = { Text("ID del comentario *") }, modifier = Modifier.fillMaxWidth())
                            }
                            OutlinedTextField(draftCustomerId, { draftCustomerId = it }, label = { Text("ID numérico del cliente *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                            OutlinedTextField(draftComment, { draftComment = it }, label = { Text("Comentario *") }, modifier = Modifier.fillMaxWidth())
                            if (operationKind == OperationKind.CREATE_COMMENT) OutlinedTextField(draftCommentType, { draftCommentType = it }, label = { Text("Tipo *") }, modifier = Modifier.fillMaxWidth())
                        }
                        OperationKind.DELETE_COMMENT ->
                            OutlinedTextField(entityId, { entityId = it }, label = { Text("ID del comentario *") }, modifier = Modifier.fillMaxWidth())
                        OperationKind.UPSERT_ALERT -> {
                            OutlinedTextField(draftCustomerId, { draftCustomerId = it }, label = { Text("ID numérico del cliente *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                            OutlinedTextField(entityId, { entityId = it }, label = { Text("ID alerta existente (vacío para crear)") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftAlertIcon, { draftAlertIcon = it }, label = { Text("Icono") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftAlertColor, { draftAlertColor = it }, label = { Text("Color") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftAlertSubject, { draftAlertSubject = it }, label = { Text("Asunto") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftAlertMessage, { draftAlertMessage = it }, label = { Text("Alerta") }, modifier = Modifier.fillMaxWidth())
                        }
                        OperationKind.DELETE_CREDIT ->
                            Text("Acción destructiva para la entidad $entityId. Requiere confirmación.")
                        OperationKind.DELETE_PAYMENT ->
                            OutlinedTextField(entityId, { entityId = it }, label = { Text("ID del pago *") }, modifier = Modifier.fillMaxWidth())
                        OperationKind.UPDATE_DOCUMENT -> Text("Operación no disponible.")
                    }
                    // Hidden for CREATE/UPDATE_PAYMENT too: it is an advanced optimistic-concurrency
                    // override that the offline queue already resolves automatically from the
                    // locally-known record version when left blank (see CreditRepository.enqueue).
                    // The legacy PHP abono form only ever exposed the abono amount and the
                    // confirmed remaining balance, so we keep the payment composer to those two
                    // fields and let the app manage this cursor silently, same as it always did
                    // for a blank value.
                    if (operationKind !in setOf(
                            OperationKind.CREATE_CUSTOMER, OperationKind.CREATE_CREDIT, OperationKind.CREATE_COMMENT,
                            OperationKind.CREATE_PAYMENT, OperationKind.UPDATE_PAYMENT
                        )
                    ) {
                        OutlinedTextField(
                            draftBaseVersion, { draftBaseVersion = it },
                            label = { Text("Cursor base (vacío usa versión local conocida)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                    if (composerError.isNotBlank()) Text(composerError, color = MaterialTheme.colorScheme.error)
                    Text("La cola es durable, ligada a cuenta/empresa/sucursal y reintenta solo errores transitorios.")
                    val typedSupported = operationKind in setOf(
                        OperationKind.CREATE_CUSTOMER, OperationKind.UPDATE_CUSTOMER,
                        OperationKind.CREATE_CREDIT, OperationKind.UPDATE_CREDIT, OperationKind.UPDATE_CREDIT_TERMS,
                        OperationKind.CREATE_PAYMENT, OperationKind.UPDATE_PAYMENT, OperationKind.DELETE_PAYMENT,
                        OperationKind.DELETE_CREDIT, OperationKind.APPLY_DISCOUNT, OperationKind.ADD_INTEREST,
                        OperationKind.CHANGE_CREDIT_STATUS, OperationKind.REORDER_CREDIT,
                        OperationKind.CREATE_COMMENT, OperationKind.UPDATE_COMMENT, OperationKind.DELETE_COMMENT,
                        OperationKind.UPSERT_ALERT
                    )
                    Button(enabled = !busy && typedSupported, onClick = {
                        composerError = ""
                        if (operationKind in setOf(
                                OperationKind.DELETE_CREDIT, OperationKind.DELETE_PAYMENT, OperationKind.DELETE_COMMENT
                            )
                        ) {
                            showOperationConfirmation = true
                        } else scope.launch {
                            busy = true
                            try {
                                saveTypedOperation()
                            } catch (error: IllegalArgumentException) {
                                composerError = error.message ?: "Datos de operación inválidos."
                            } finally {
                                busy = false
                            }
                        }
                    }) {
                        Text(
                            if (busy) "Guardando…"
                            else if (operationKind in setOf(
                                    OperationKind.DELETE_CREDIT, OperationKind.DELETE_PAYMENT, OperationKind.DELETE_COMMENT
                                )
                            )
                                "Continuar para confirmar"
                            else "Guardar como pendiente"
                        )
                    }
                    TextButton(onClick = { screen = Screen.HOME }) { Text("Cancelar") }
                }
            }
        }
    }

    if (showLogoutConfirmation) {
        AlertDialog(
            onDismissRequest = { showLogoutConfirmation = false },
            title = { Text("Descartar operaciones pendientes") },
            text = {
                Text(
                    "Hay $pendingLogoutCount operaciones pendientes, en conflicto o rechazadas. Cerrar sesión eliminará toda la caché local y descartará esas operaciones de este dispositivo. Esta acción no se puede deshacer. La reinstalación también elimina operaciones no sincronizadas."
                )
            },
            confirmButton = {
                TextButton(onClick = { showLogoutConfirmation = false; logout() }) { Text("Descartar y cerrar sesión") }
            },
            dismissButton = { TextButton(onClick = { showLogoutConfirmation = false }) { Text("Conservar datos") } }
        )
    }

    if (showOperationConfirmation) {
        val deletingCredit = operationKind == OperationKind.DELETE_CREDIT
        val deletingComment = operationKind == OperationKind.DELETE_COMMENT
        val entityLabel = if (deletingCredit) "el crédito" else if (deletingComment) "el comentario" else "el pago"
        AlertDialog(
            onDismissRequest = { showOperationConfirmation = false },
            title = { Text("Eliminar ${if (deletingCredit) "crédito" else if (deletingComment) "comentario" else "pago"}") },
            text = {
                Text(
                    "Se encolará una solicitud para eliminar $entityLabel $entityId. " +
                        "El cambio local se verá como pendiente y no estará confirmado hasta que el servidor lo acepte."
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    showOperationConfirmation = false
                    scope.launch {
                        busy = true
                        try {
                            saveTypedOperation()
                        } catch (error: IllegalArgumentException) {
                            composerError = error.message ?: "No se pudo encolar la operación."
                        } finally {
                            busy = false
                        }
                    }
                }) { Text("Confirmar y encolar") }
            },
            dismissButton = { TextButton(onClick = { showOperationConfirmation = false }) { Text("Cancelar") } }
        )
    }

    if (showDocumentLookup) {
        AlertDialog(
            onDismissRequest = { showDocumentLookup = false },
            title = { Text("Buscar cliente en el servidor") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(documentType, { documentType = it }, label = { Text("Tipo de documento") })
                    OutlinedTextField(documentNumber, { documentNumber = it }, label = { Text("Número de documento") })
                    Text("Solo se guarda localmente el cliente que abras mediante esta búsqueda.")
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    scope.launch {
                        val current = session ?: return@launch
                        val branch = current.selectedBranchId ?: return@launch
                        when (val result = app.repository.openCustomerByDocument(current, branch, documentType, documentNumber)) {
                            is ApiResult.Success -> {
                                customer = result.value
                                showDocumentLookup = false
                                screen = Screen.CUSTOMER
                                notice = "Cliente abierto y guardado para acceso sin conexión."
                            }
                            else -> report(result)
                        }
                    }
                }) { Text("Buscar") }
            },
            dismissButton = { TextButton(onClick = { showDocumentLookup = false }) { Text("Cancelar") } }
        )
    }
}
