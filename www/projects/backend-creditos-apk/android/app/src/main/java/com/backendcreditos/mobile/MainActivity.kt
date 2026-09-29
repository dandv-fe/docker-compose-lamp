package com.backendcreditos.mobile

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.biometric.BiometricPrompt
import androidx.fragment.app.FragmentActivity
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Star
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.backendcreditos.mobile.data.BranchEntity
import com.backendcreditos.mobile.data.CustomerEntity
import com.backendcreditos.mobile.data.OfflineOperationEntity
import com.backendcreditos.mobile.data.OperationKind
import com.backendcreditos.mobile.data.OperationPayloadMapper
import com.backendcreditos.mobile.data.OperationStatus
import com.backendcreditos.mobile.data.PaymentEntity
import com.backendcreditos.mobile.data.PortfolioRow
import com.backendcreditos.mobile.network.ApiResult
import com.backendcreditos.mobile.security.StoredSession
import com.backendcreditos.mobile.work.SyncScheduler
import androidx.work.WorkManager
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.UUID
import java.math.RoundingMode

private enum class Screen { LOGIN, BRANCHES, HOME, CUSTOMER, CREDIT, CARD_ASSESSMENT, QUEUE, COMPOSER, DEFAULTERS, WITHDRAWN, CANCELLED, PORTFOLIO_CLIENTS, SYNC_SETTINGS, MARKED }

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
        message.contains("Credit exceeds the customer limit", ignoreCase = true) ->
            "El crédito supera el cupo disponible. Pide a un administrador o empleado autorizado que aumente el límite del cliente."
        message.contains("Inactive customers cannot exceed their credit limit", ignoreCase = true) ->
            "El cliente está inactivo y el crédito supera su límite. Edita el cliente antes de crear la tarjeta."
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

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class, ExperimentalFoundationApi::class)
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
    var branchPayments by remember { mutableStateOf(emptyList<PaymentEntity>()) }
    var customerMatches by remember { mutableStateOf(emptyList<CustomerEntity>()) }
    var customer by remember { mutableStateOf<CustomerEntity?>(null) }
    var selectedCreditId by remember { mutableStateOf<String?>(null) }
    var assessmentCreditId by remember { mutableStateOf<String?>(null) }
    var assessmentCustomer by remember { mutableStateOf<com.backendcreditos.mobile.network.CustomerDto?>(null) }
    var assessmentPayments by remember { mutableStateOf(emptyList<com.backendcreditos.mobile.network.PaymentDto>()) }
    var assessmentLocalCredits by remember { mutableStateOf(emptyList<com.backendcreditos.mobile.data.CreditEntity>()) }
    var assessmentLocalPayments by remember { mutableStateOf(emptyList<PaymentEntity>()) }
    var assessmentMessage by remember { mutableStateOf("") }
    var assessmentLoading by remember { mutableStateOf(false) }
    var assessmentJob by remember { mutableStateOf<kotlinx.coroutines.Job?>(null) }
    // Portfolio pointer: the card the collector is standing on. It is saved so it also
    // survives configuration changes and process death, not only screen changes.
    var pointedCreditId by rememberSaveable { mutableStateOf<String?>(null) }
    // Only a tap on the card itself arms the pointer; arrows and the marked list place it
    // disarmed so the next tap selects instead of opening the payments screen.
    var pointerArmed by rememberSaveable { mutableStateOf(false) }
    var restorePointerScroll by rememberSaveable { mutableStateOf(false) }
    val pointerRequester = remember { BringIntoViewRequester() }
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
    var receiptSequences by remember {
        mutableStateOf(emptyList<com.backendcreditos.mobile.data.ReceiptSequenceEntity>())
    }
    var draftCardPlacement by remember { mutableStateOf(CardPlacement.AFTER) }
    var draftCost by remember { mutableStateOf("0") }
    var defaulterRows by remember { mutableStateOf(emptyList<com.backendcreditos.mobile.network.DefaulterCreditDto>()) }
    var withdrawnRows by remember { mutableStateOf(emptyList<com.backendcreditos.mobile.network.WithdrawnCreditDto>()) }
    var cancelledRows by remember { mutableStateOf(emptyList<com.backendcreditos.mobile.network.CancelledCreditDto>()) }
    var portfolioClientRows by remember { mutableStateOf(emptyList<com.backendcreditos.mobile.network.PortfolioClientDto>()) }
    var cancelledDateFrom by remember { mutableStateOf("") }
    var cancelledDateTo by remember { mutableStateOf("") }
    var syncIntervalMinutes by remember { mutableStateOf(SyncScheduler.readIntervalMinutes(activity)) }
    var syncAutoEnabled by remember { mutableStateOf(SyncScheduler.isPeriodicEnabled(activity)) }
    var markedCreditIds by remember { mutableStateOf(emptySet<String>()) }
    var showMoreMenu by remember { mutableStateOf(false) }
    val branchId = session?.selectedBranchId
    val account = session

    suspend fun loadLocal() {
        val current = session ?: return
        val branch = current.selectedBranchId ?: return
        rows = app.repository.portfolio(current.accountKey, branch)
        branchPayments = app.repository.paymentsForBranch(current.accountKey, branch)
        customerMatches = app.repository.searchCustomers(current.accountKey, branch, search)
        operationRows = app.repository.queuedOperations(current)
        markedCreditIds = app.repository.markedCredits(current.accountKey, branch).toSet()
        receiptSequences = app.repository.receiptSequences(current.accountKey, branch)
        // Keep the open card's movement list fresh too, so returning to it right after saving
        // an abono shows the new row without waiting for a server round trip.
        selectedCreditId?.let { creditId ->
            paymentRows = app.database.localDao().payments(current.accountKey, branch, creditId)
        }
        syncControl = app.database.localDao().syncControl(current.accountKey)
    }

    fun assessCard(creditId: String) {
            assessmentJob?.cancel()
            val origin = rows.firstOrNull { it.credit.id == creditId }
            if (origin == null) {
                notice = "La tarjeta seleccionada ya no está en la cartera. Actualiza la lista."
                return
            }
            selectedCreditId = creditId
            assessmentCreditId = creditId
            customer = origin.customer
            assessmentCustomer = null
            assessmentPayments = emptyList()
            assessmentLoading = online
            assessmentLocalCredits = rows.filter { it.credit.customerId == origin.credit.customerId }.map { it.credit }
            assessmentLocalPayments = branchPayments.filter { payment ->
                assessmentLocalCredits.any { it.id == payment.creditId }
            }
            assessmentMessage = if (online) "Consultando el historial del servidor…" else
                "Sin conexión: el análisis solo incluye datos guardados en este dispositivo."
            screen = Screen.CARD_ASSESSMENT
            assessmentJob = scope.launch {
                val current = session ?: return@launch
                val branch = current.selectedBranchId ?: return@launch
                assessmentLocalCredits = app.database.localDao().portfolio(current.accountKey, branch)
                    .filter { it.customerId == origin.credit.customerId }
                assessmentLocalPayments = app.database.localDao().paymentsForBranch(current.accountKey, branch)
                    .filter { payment -> assessmentLocalCredits.any { it.id == payment.creditId } }
                if (!online) return@launch
                val person = origin.customer
                if (person?.documentType.isNullOrBlank() || person?.documentNumber.isNullOrBlank()) {
                    assessmentMessage = "Falta el tipo o número de documento local: no se puede consultar el servidor."
                    assessmentLoading = false
                    return@launch
                }
                when (val result = app.api.customerByDocument(
                    current.token, branch, person.documentType!!, person.documentNumber!!
                )) {
                    is ApiResult.Success -> {
                        val found = result.value.customerByDocument
                        if (found == null || found.id.toString() != origin.credit.customerId) {
                            assessmentMessage = "La identidad consultada no coincide con la tarjeta; verifica el cliente antes de continuar."
                        } else {
                            assessmentCustomer = found
                            assessmentMessage = "Historial consultado en el servidor para esta sucursal."
                            val allPayments = mutableListOf<com.backendcreditos.mobile.network.PaymentDto>()
                            for (credit in found.credits) {
                                when (val history = app.api.paymentHistory(current.token, branch, credit.id)) {
                                    is ApiResult.Success -> allPayments.addAll(history.value.paymentHistory)
                                    else -> {
                                        assessmentMessage = "No se pudo cargar todo el historial: ${when (history) {
                                            is ApiResult.AuthExpired -> history.message
                                            is ApiResult.PermissionRejected -> history.message
                                            is ApiResult.Conflict -> history.message
                                            is ApiResult.Rejected -> history.message
                                            is ApiResult.Retryable -> history.message
                                            is ApiResult.Success -> ""
                                        }}. Consulta la cola o vuelve a intentar."
                                        break
                                    }
                                }
                            }
                            assessmentPayments = allPayments
                        }
                    }
                    else -> assessmentMessage = "No se pudo consultar al cliente en el servidor: ${when (result) {
                        is ApiResult.AuthExpired -> result.message
                        is ApiResult.PermissionRejected -> result.message
                        is ApiResult.Conflict -> result.message
                        is ApiResult.Rejected -> result.message
                        is ApiResult.Retryable -> result.message
                        is ApiResult.Success -> ""
                    }}. El historial local sigue disponible."
                }
                assessmentLoading = false
            }
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
        // Receipt counters are refreshed alongside the permissions so creating a card works
        // offline later. A failure here is silent on purpose: the previous cached copy stays
        // valid and the create form is the only thing that needs it.
        app.repository.syncReceiptSequences(current, branch)
        receiptSequences = app.repository.receiptSequences(current.accountKey, branch)
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
        // Registering an abono has to feel instant in the street: the movement is already saved
        // and queued on this device, so we go straight back to the card instead of blocking on
        // the server. The queue badge in the bottom bar is what reports the outcome afterwards.
        if (operation.kind == OperationKind.CREATE_PAYMENT || operation.kind == OperationKind.UPDATE_PAYMENT) {
            notice = if (online) {
                "Abono guardado en el teléfono · se está enviando solo. Revisa el contador de la cola."
            } else {
                "Sin conexión: el abono quedó guardado y se enviará al recuperar señal."
            }
            screen = if (selectedCreditId != null) Screen.CREDIT else Screen.HOME
            return
        }
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
        if (operationKind == OperationKind.CREATE_CREDIT) {
            val charge = extraChargeFields(draftConcept, session?.branchExtraCharges?.get(branch))
            if (draftConcept == "Articulo") {
                require(draftDescription.isNotBlank()) { "Describe el artículo." }
                require(draftInitialPayment.toBigDecimalOrNull()?.let { it >= java.math.BigDecimal.ZERO } == true) {
                    "El artículo necesita una cuota inicial válida."
                }
                require(draftInitialPayment.toBigDecimal() <=
                    (draftValue.toBigDecimalOrNull() ?: java.math.BigDecimal.ZERO)) {
                    "La cuota inicial no puede superar el valor a pagar."
                }
            } else if (charge == "boleta") {
                require(draftAdditionalNumber.isNotBlank()) { "Ingresa el número de boleta." }
                require(draftAdditionalValue.toBigDecimalOrNull()?.let { it > java.math.BigDecimal.ZERO } == true) {
                    "Ingresa un valor de boleta positivo."
                }
            } else if (charge == "seguro") {
                require(draftAdditionalValue.toBigDecimalOrNull()?.let { it > java.math.BigDecimal.ZERO } == true) {
                    "Ingresa un valor de seguro positivo."
                }
            }
            if (charge != "boleta") draftAdditionalNumber = ""
            if (charge == "ninguno") draftAdditionalValue = "0"
            if (draftConcept != "Articulo") {
                draftInitialPayment = "0"
                draftDescription = ""
            }
            require(installmentValue(draftValue, draftTerm) != null) {
                "Valor a pagar y plazo deben ser positivos."
            }
            require(draftCost.toBigDecimalOrNull()?.let { it > java.math.BigDecimal.ZERO } == true) {
                "El costo debe ser positivo."
            }
            if (draftDocumentSequenceId.isBlank()) {
                throw IllegalArgumentException(
                    "Esta sucursal no tiene consecutivo de comprobante guardado; sincroniza en línea antes de crear la tarjeta."
                )
            }
            if (draftConcept.equals("Articulo", ignoreCase = true) && draftDescription.isBlank()) {
                throw IllegalArgumentException("Un crédito de tipo Articulo necesita descripción.")
            }
            // The order is derived from the chosen placement instead of asking for a raw item
            // number, and the loan/profit pair is computed like the legacy form does.
            val origin = rows.firstOrNull { it.credit.id == selectedCreditId }
                ?: throw IllegalArgumentException("Selecciona la tarjeta de origen de este cliente.")
            val cachedRoute = app.database.localDao().portfolio(current.accountKey, branch)
                .sortedWith(compareBy<com.backendcreditos.mobile.data.CreditEntity> { it.sortOrder }.thenBy { it.id })
            val ordered = cachedRoute.map {
                it.sortOrder ?: throw IllegalArgumentException("Hay tarjetas sin posición; sincroniza la cartera.")
            }
            val index = cachedRoute.indexOfFirst { it.id == origin.credit.id }
            require(index >= 0) { "La tarjeta de origen ya no está en la ruta guardada; sincroniza antes de crear." }
            draftSortOrder = placementSortOrder(ordered, index, draftCardPlacement).toString()
            draftPrincipal = draftCost.ifBlank { "0" }
            draftProfit = creditProfit(draftValue, draftCost)
        }
        if (operationKind == OperationKind.ADD_INTEREST) {
            val creditStatus = rows.firstOrNull { it.credit.id == entityId }?.credit?.status
            require(canAddInterest(creditStatus)) {
                "No se pueden cobrar más intereses mientras la tarjeta esté en estado created o entregando. Actualiza la cartera si cambió su estado."
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
                draftReceiptNumber, draftNote, draftObligation, draftDocumentSequenceId,
                selectedCreditId, if (draftCardPlacement == CardPlacement.BEFORE) "antes" else "despues"
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
        app.repository.applyOptimisticCacheChange(
            operation,
            creatorUsername = listOfNotNull(current.firstName, current.lastName)
                .joinToString(" ").ifBlank { current.username }.takeIf { operationKind == OperationKind.CREATE_PAYMENT },
            creatorUserId = current.userId.takeIf { operationKind == OperationKind.CREATE_PAYMENT }
        )
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
            branchPayments = emptyList()
            operationRows = emptyList()
            syncControl = null
            password = ""
            pointedCreditId = null
            pointerArmed = false
            restorePointerScroll = false
            screen = Screen.LOGIN
            notice = "Se eliminó la caché local de la cuenta."
        }
    }

    fun prepareComposer(kind: OperationKind, targetId: String = "", sourceCreditId: String? = null) {
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
            draftConcept = "Prestamo"
            draftValue = ""
            draftFrequency = "Diario"
            draftTerm = "1"
            draftPrincipal = ""
            draftCost = "0"
            draftBalance = ""
            draftAdditionalNumber = ""
            draftDescription = ""
            draftCreditStatus = ""
            draftInitialPayment = "0"
            draftProfit = "0"
            draftAdditionalValue = "0"
            draftNote = ""
            draftObligation = ""
            draftCardPlacement = CardPlacement.AFTER
            // The web form fills these from the branch's counter instead of asking for them;
            // the cached sequence does the same here so the collector never types an internal ID.
            val sequence = receiptSequences.firstOrNull()
            draftDocumentSequenceId = sequence?.id?.toString().orEmpty()
            draftReceiptType = sequence?.documentType.orEmpty()
            draftSeries = sequence?.series.orEmpty()
            draftReceiptNumber = nextReceiptNumber(sequence?.lastNumber)
            // Creating from a card means the customer and the position are already known.
            val origin = rows.firstOrNull { it.credit.id == sourceCreditId }
            if (origin != null) {
                draftCustomerId = origin.credit.customerId
                customer = origin.customer
                draftSortOrder = origin.credit.sortOrder?.toString() ?: "0"
            } else {
                draftCustomerId = ""
                draftSortOrder = "0"
            }
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

    // The portfolio keeps its own scroll state so leaving to any other screen (and its own
    // scrolling) never moves the cartera; the remaining screens keep sharing one state, as before.
    val portfolioScrollState = rememberScrollState()
    val otherScreensScrollState = rememberScrollState()

    // Hoisted out of the HOME branch because the bottom bar arrows and counter act on the
    // same visible list the user sees, filter included.
    val visibleRows = rows.filter { row ->
        val name = "${row.customer?.firstName.orEmpty()} ${row.customer?.lastName.orEmpty()} " +
            "${row.customer?.documentNumber.orEmpty()} ${row.credit.additionalNumber.orEmpty()}"
        name.contains(search, ignoreCase = true)
    }
    val visibleCreditIds = visibleRows.map { it.credit.id }
    val pointerIndex = pointerPosition(pointedCreditId, visibleCreditIds)
    val onPortfolio = screen == Screen.HOME
    val unresolvedBadge = operationRows.count {
        it.status in setOf(
            OperationStatus.PENDING, OperationStatus.IN_FLIGHT,
            OperationStatus.CONFLICT, OperationStatus.REJECTED
        )
    }

    fun movePointer(forward: Boolean) {
        val target = pointerStep(pointedCreditId, visibleCreditIds, forward) ?: return
        pointedCreditId = target
        pointerArmed = false
        restorePointerScroll = true
    }

    LaunchedEffect(screen) {
        if (screen != Screen.HOME && pointedCreditId != null) restorePointerScroll = true
    }
    LaunchedEffect(rows) {
        pointedCreditId = keepSelection(pointedCreditId, rows.map { it.credit.id })
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Créditos") }
            )
        },
        bottomBar = {
            if (account != null && branchId != null && screen !in setOf(Screen.LOGIN, Screen.BRANCHES)) {
                Surface(tonalElevation = 3.dp) {
                    Row(
                        Modifier.fillMaxWidth()
                            // Android 15 forces edge-to-edge, so without this the bar lands
                            // underneath the system navigation buttons/gesture handle.
                            .navigationBarsPadding()
                            .padding(horizontal = 4.dp, vertical = 6.dp),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Arrows walk the route card by card; they are dead outside the cartera
                        // and at both ends of the visible list, like a browser's history arrows.
                        val canGoBack = onPortfolio && pointerStep(pointedCreditId, visibleCreditIds, false) != null
                        val canGoForward = onPortfolio && pointerStep(pointedCreditId, visibleCreditIds, true) != null
                        IconButton(onClick = { movePointer(forward = false) }, enabled = canGoBack) {
                            Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, contentDescription = "Tarjeta anterior")
                        }
                        IconButton(onClick = { movePointer(forward = true) }, enabled = canGoForward) {
                            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = "Tarjeta siguiente")
                        }
                        IconButton(onClick = {
                            if (pointedCreditId != null) restorePointerScroll = true
                            screen = Screen.HOME
                        }) {
                            Icon(Icons.Filled.Home, contentDescription = "Volver a la cartera")
                        }
                        BadgedBox(badge = {
                            if (markedCreditIds.isNotEmpty()) Badge { Text(markedCreditIds.size.toString()) }
                        }) {
                            IconButton(onClick = {
                                scope.launch { loadLocal() }
                                screen = Screen.MARKED
                            }) {
                                Icon(Icons.Filled.Star, contentDescription = "Tarjetas marcadas")
                            }
                        }
                        IconButton(
                            onClick = { restorePointerScroll = true; screen = Screen.HOME },
                            enabled = pointerIndex != null
                        ) {
                            Box(
                                Modifier.size(26.dp)
                                    .border(
                                        BorderStroke(2.dp, MaterialTheme.colorScheme.onSurfaceVariant),
                                        RoundedCornerShape(6.dp)
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    pointerIndex?.toString() ?: "—",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                        Box {
                            BadgedBox(badge = {
                                if (unresolvedBadge > 0) Badge { Text(unresolvedBadge.toString()) }
                            }) {
                                IconButton(onClick = { showMoreMenu = true }) {
                                    Icon(Icons.Filled.MoreVert, contentDescription = "Más opciones")
                                }
                            }
                            DropdownMenu(showMoreMenu, onDismissRequest = { showMoreMenu = false }) {
                                // Card actions live here too, so the payments screen keeps only the
                                // button you press every day and the rest act on the open card.
                                if (screen == Screen.CREDIT && selectedCreditId != null) {
                                    if ("nueva tarjeta" in branchPermissionSet || branchPermissionSet.isEmpty()) {
                                        DropdownMenuItem(
                                            text = { Text("Crear otra tarjeta a este cliente") },
                                            onClick = {
                                                showMoreMenu = false
                                                selectedCreditId?.let(::assessCard)
                                            }
                                        )
                                        HorizontalDivider()
                                    }
                                    DropdownMenuItem(
                                        text = { Text("Editar crédito") },
                                        onClick = {
                                            showMoreMenu = false
                                            prepareComposer(OperationKind.UPDATE_CREDIT, selectedCreditId.orEmpty())
                                        }
                                    )
                                    DropdownMenuItem(
                                        text = { Text("Cambiar estado") },
                                        onClick = {
                                            showMoreMenu = false
                                            prepareComposer(OperationKind.CHANGE_CREDIT_STATUS, selectedCreditId.orEmpty())
                                        }
                                    )
                                    DropdownMenuItem(
                                        text = { Text("Reordenar") },
                                        onClick = {
                                            showMoreMenu = false
                                            prepareComposer(OperationKind.REORDER_CREDIT, selectedCreditId.orEmpty())
                                        }
                                    )
                                    DropdownMenuItem(
                                        text = { Text("Aplicar descuento") },
                                        onClick = {
                                            showMoreMenu = false
                                            prepareComposer(OperationKind.APPLY_DISCOUNT, selectedCreditId.orEmpty())
                                        }
                                    )
                                    DropdownMenuItem(
                                        text = { Text("Agregar interés") },
                                        enabled = canAddInterest(
                                            rows.firstOrNull { it.credit.id == selectedCreditId }?.credit?.status
                                        ),
                                        onClick = {
                                            showMoreMenu = false
                                            prepareComposer(OperationKind.ADD_INTEREST, selectedCreditId.orEmpty())
                                        }
                                    )
                                    if (online) DropdownMenuItem(
                                        text = { Text("Actualizar pagos") },
                                        onClick = {
                                            showMoreMenu = false
                                            scope.launch {
                                                val current = session ?: return@launch
                                                val branch = current.selectedBranchId ?: return@launch
                                                when (
                                                    val result = app.repository.openPaymentHistory(
                                                        current, branch, selectedCreditId.orEmpty()
                                                    )
                                                ) {
                                                    is ApiResult.Success -> paymentRows = result.value
                                                    else -> report(result)
                                                }
                                            }
                                        }
                                    )
                                    DropdownMenuItem(
                                        text = {
                                            Text("Eliminar crédito", color = MaterialTheme.colorScheme.error)
                                        },
                                        // The server refuses to delete a credit that left the
                                        // 'created' state or that already has settled payments.
                                        enabled = rows.firstOrNull { it.credit.id == selectedCreditId }
                                            ?.credit?.status == "created",
                                        onClick = {
                                            showMoreMenu = false
                                            prepareComposer(OperationKind.DELETE_CREDIT, selectedCreditId.orEmpty())
                                        }
                                    )
                                    HorizontalDivider()
                                }
                                DropdownMenuItem(
                                    text = {
                                        Text(if (unresolvedBadge > 0) "Cola ($unresolvedBadge sin resolver)" else "Cola")
                                    },
                                    onClick = {
                                        showMoreMenu = false
                                        scope.launch { loadOperations(); screen = Screen.QUEUE }
                                    }
                                )
                                HorizontalDivider()
                                DropdownMenuItem(
                                    text = { Text("Crear cliente") },
                                    onClick = { showMoreMenu = false; prepareComposer(OperationKind.CREATE_CUSTOMER) }
                                )
                                DropdownMenuItem(
                                    text = { Text("Crear crédito") },
                                    enabled = pointedCreditId != null,
                                    onClick = { showMoreMenu = false; pointedCreditId?.let(::assessCard) }
                                )
                                if (online) DropdownMenuItem(
                                    text = { Text("Buscar cliente por documento") },
                                    onClick = { showMoreMenu = false; showDocumentLookup = true }
                                )
                                if (online) DropdownMenuItem(
                                    text = { Text("Actualizar cartera") },
                                    onClick = {
                                        showMoreMenu = false
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
                                    }
                                )
                                if (online && branchPermissionSet.isNotEmpty()) {
                                    HorizontalDivider()
                                    if ("ver morosos" in branchPermissionSet) DropdownMenuItem(
                                        text = { Text("Morosos") },
                                        onClick = {
                                            showMoreMenu = false
                                            scope.launch { busy = true; loadDefaulters(); busy = false; screen = Screen.DEFAULTERS }
                                        }
                                    )
                                    if ("ver retirados" in branchPermissionSet) DropdownMenuItem(
                                        text = { Text("Retirados") },
                                        onClick = {
                                            showMoreMenu = false
                                            scope.launch { busy = true; loadWithdrawn(); busy = false; screen = Screen.WITHDRAWN }
                                        }
                                    )
                                    if ("ver canceladas" in branchPermissionSet) DropdownMenuItem(
                                        text = { Text("Canceladas") },
                                        onClick = { showMoreMenu = false; screen = Screen.CANCELLED }
                                    )
                                    if ("ver clientes" in branchPermissionSet) DropdownMenuItem(
                                        text = { Text("Clientes de cartera") },
                                        onClick = {
                                            showMoreMenu = false
                                            scope.launch { busy = true; loadPortfolioClients(); busy = false; screen = Screen.PORTFOLIO_CLIENTS }
                                        }
                                    )
                                }
                                HorizontalDivider()
                                if (online) DropdownMenuItem(
                                    text = { Text("Cambiar sucursal") },
                                    onClick = { showMoreMenu = false; screen = Screen.BRANCHES }
                                )
                                DropdownMenuItem(
                                    text = { Text("Sincronización automática") },
                                    onClick = { showMoreMenu = false; screen = Screen.SYNC_SETTINGS }
                                )
                                DropdownMenuItem(
                                    text = { Text("Cerrar sesión") },
                                    onClick = {
                                        showMoreMenu = false
                                        scope.launch {
                                            pendingLogoutCount = app.repository.unresolvedCount(account.accountKey)
                                            if (pendingLogoutCount > 0) showLogoutConfirmation = true else logout()
                                        }
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).padding(16.dp)
                .verticalScroll(if (screen == Screen.HOME) portfolioScrollState else otherScreensScrollState),
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
                                        val newSession = StoredSession(
                                            login.company.id.toString(), login.user.username, login.token,
                                            userId = login.user.userId,
                                            firstName = login.user.firstName, lastName = login.user.lastName,
                                            branchExtraCharges = login.branches.associate { it.id.toString() to it.extraCharge }
                                        )
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
                                                me.value.me?.let { user ->
                                                    val refreshed = newSession.copy(
                                                        userId = user.userId, firstName = user.firstName, lastName = user.lastName
                                                    )
                                                    session = refreshed
                                                    app.vault.saveSession(refreshed)
                                                }
                                                when (val branches = app.api.branches(newSession.token)) {
                                                    is ApiResult.Success -> {
                                                        branchList = branches.value.branches.map { BranchEntity(it.id.toString(), it.name, it.type) }
                                                        val updated = (session ?: newSession).copy(
                                                            branchExtraCharges = branches.value.branches.associate {
                                                                it.id.toString() to it.extraCharge
                                                            }
                                                        )
                                                        session = updated
                                                        app.vault.saveSession(updated)
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
                        Text("Desbloquea datos sincronizados en este dispositivo e intenta revalidar la sesión con el servidor.")
                        OutlinedButton(onClick = {
                            activity.unlockDevice { unlocked, error ->
                                if (unlocked) {
                                    val current = session
                                    scope.launch {
                                        busy = true
                                        notice = "Verificando conexión…"
                                        // The token saved at the last real login is still on the
                                        // device; probe it to learn the true connection/session
                                        // state instead of assuming offline just because we came
                                        // in through the local biometric unlock.
                                        val me = current?.let { app.api.me(it.token) }
                                        when (me) {
                                            is ApiResult.Success -> {
                                                me.value.me?.let { user ->
                                                    val refreshed = current.copy(
                                                        userId = user.userId, firstName = user.firstName, lastName = user.lastName
                                                    )
                                                    session = refreshed
                                                    app.vault.saveSession(refreshed)
                                                }
                                                online = true
                                                screen = Screen.HOME
                                                loadLocal()
                                                loadOperations()
                                                // The biometric unlock never populates branchList (it
                                                // skips login's branch fetch), so "Cambiar sucursal"
                                                // would open an empty list unless we refresh it here.
                                                when (val branches = app.api.branches(current.token)) {
                                                    is ApiResult.Success -> {
                                                        branchList = branches.value.branches.map {
                                                            BranchEntity(it.id.toString(), it.name, it.type)
                                                        }
                                                        val updated = (session ?: current).copy(
                                                            branchExtraCharges = branches.value.branches.associate {
                                                                it.id.toString() to it.extraCharge
                                                            }
                                                        )
                                                        session = updated
                                                        app.vault.saveSession(updated)
                                                    }
                                                    else -> { /* keep whatever branchList had; branch switch will report the error if used */ }
                                                }
                                                notice = "Conectado: se validó la sesión con el servidor."
                                            }
                                            is ApiResult.AuthExpired -> {
                                                online = false
                                                notice = "Tu sesión venció; inicia sesión de nuevo con usuario y contraseña."
                                            }
                                            else -> {
                                                online = false
                                                screen = Screen.HOME
                                                loadLocal()
                                                loadOperations()
                                                notice = "Sin conexión: te quedas en la última sucursal vista; " +
                                                    "no se puede cambiar de sucursal hasta reconectar."
                                            }
                                        }
                                        busy = false
                                    }
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
                            // Clear the previous branch's rows/matches right away instead of leaving
                            // them on screen while the new branch syncs; loadLocal() below repopulates
                            // them from this branch's own cache (may briefly be empty on first visit).
                            rows = emptyList()
                            branchPayments = emptyList()
                            customerMatches = emptyList()
                            pointedCreditId = null
                            pointerArmed = false
                            restorePointerScroll = false
                            scope.launch {
                                busy = true
                                loadLocal()
                                loadBranchPermissions()
                                if (syncAutoEnabled) {
                                    SyncScheduler.schedulePeriodic(activity, selected.accountKey, branch.id, syncIntervalMinutes)
                                }
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
                    // branchId (session.selectedBranchId) is the numeric idsucursal; show the
                    // human-readable str_codigo (BranchDto.name) instead, looked up from the
                    // last fetched branchList, falling back to the raw id if not found yet. The
                    // label itself uses str_tipo (BranchDto.type) instead of a hardcoded word,
                    // since branches can be typed differently (e.g. "Agencia", "Sucursal").
                    val selectedBranch = branchList.find { it.id == branchId }
                    val branchCode = selectedBranch?.name ?: branchId.orEmpty()
                    val branchLabel = (selectedBranch?.type ?: "sucursal").lowercase()
                    Text(
                        if (online) "En línea · ${account?.username} · $branchLabel $branchCode"
                        else "Sin conexión · caché de esta $branchLabel $branchCode",
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
                    if (busy) Text("Trabajando…")
                    Text("Cartera guardada", style = MaterialTheme.typography.titleLarge)
                    Text(
                        "Un toque marca la tarjeta donde vas; otro toque la abre. Usa ‹ › de la barra para avanzar.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    val filtered = visibleRows
                    if (filtered.isEmpty()) Text("No hay resultados guardados. Sincroniza la sucursal o abre un cliente en línea.")
                    LaunchedEffect(restorePointerScroll, pointedCreditId, filtered.size) {
                        if (restorePointerScroll && filtered.any { it.credit.id == pointedCreditId }) {
                            pointerRequester.bringIntoView()
                            restorePointerScroll = false
                        }
                    }
                    filtered.forEach { row ->
                        val pointed = pointedCreditId == row.credit.id
                        Card(Modifier.fillMaxWidth()
                            .then(
                                if (pointed) Modifier
                                    .bringIntoViewRequester(pointerRequester)
                                    .border(
                                        BorderStroke(3.dp, MaterialTheme.colorScheme.primary),
                                        RoundedCornerShape(12.dp)
                                    )
                                else Modifier
                            )
                            .clickable {
                            // First tap only moves the pointer; the second tap on the same card opens it.
                            if (portfolioTap(pointedCreditId, row.credit.id, pointerArmed) == PortfolioTap.SELECT) {
                                pointedCreditId = row.credit.id
                                pointerArmed = true
                                return@clickable
                            }
                            selectedCreditId = row.credit.id
                            customer = row.customer
                            scope.launch {
                                val current = session ?: return@launch
                                val branch = current.selectedBranchId ?: return@launch
                                if (online) {
                                    when (val result = app.repository.openPaymentHistory(current, branch, row.credit.id)) {
                                        is ApiResult.Success -> {
                                            paymentRows = result.value
                                            branchPayments = app.repository.paymentsForBranch(current.accountKey, branch)
                                        }
                                        else -> report(result)
                                    }
                                }
                                paymentRows = app.database.localDao().payments(current.accountKey, branch, row.credit.id)
                                screen = Screen.CREDIT
                            }
                        }) {
                            Column(Modifier.padding(16.dp)) {
                                if (pointed) Text(
                                    "▶ Aquí vas · toca de nuevo para abrir",
                                    color = MaterialTheme.colorScheme.primary,
                                    fontWeight = FontWeight.Bold
                                )
                                if (pointed && ("nueva tarjeta" in branchPermissionSet || branchPermissionSet.isEmpty())) {
                                    TextButton(onClick = { assessCard(row.credit.id) }) {
                                        Text("Crear tarjeta para este cliente")
                                    }
                                }
                                Row(
                                    Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text("${row.customer?.firstName.orEmpty()} ${row.customer?.lastName.orEmpty()}")
                                    val marked = row.credit.id in markedCreditIds
                                    IconButton(onClick = {
                                        scope.launch {
                                            val current = session ?: return@launch
                                            val branch = current.selectedBranchId ?: return@launch
                                            app.repository.setCreditMarked(current.accountKey, branch, row.credit.id, !marked)
                                            markedCreditIds = app.repository.markedCredits(current.accountKey, branch).toSet()
                                        }
                                    }) {
                                        Icon(
                                            Icons.Filled.Star,
                                            contentDescription = if (marked) "Quitar marca" else "Marcar para volver más tarde",
                                            tint = if (marked) MaterialTheme.colorScheme.primary
                                            else MaterialTheme.colorScheme.outlineVariant
                                        )
                                    }
                                }
                                Text("Crédito ${row.credit.additionalNumber ?: row.credit.id} · Saldo ${row.credit.balance ?: "—"}")
                                Text("Estado: ${row.credit.status ?: "—"}")
                                val cachedCreditPayments = branchPayments.filter { it.creditId == row.credit.id }
                                val pendingLocalPayment = cachedCreditPayments.firstOrNull { payment ->
                                    payment.createdLocally && operationRows.any { operation ->
                                        operation.kind == OperationKind.CREATE_PAYMENT &&
                                            operation.entityId == payment.creditId &&
                                            operation.payload.contains("\"iddescripcion\":\"${payment.id}\"") &&
                                            operation.status in setOf(
                                                OperationStatus.PENDING, OperationStatus.IN_FLIGHT,
                                                OperationStatus.CONFLICT, OperationStatus.REJECTED
                                            )
                                    }
                                }
                                val displayedPayment = pendingLocalPayment ?: cachedCreditPayments.firstOrNull()
                                displayedPayment?.let { payment ->
                                    val paymentOperation = if (payment.createdLocally) operationRows.firstOrNull { operation ->
                                        operation.kind == OperationKind.CREATE_PAYMENT &&
                                            operation.entityId == payment.creditId &&
                                            operation.payload.contains("\"iddescripcion\":\"${payment.id}\"")
                                    } else null
                                    val amount = payment.amount?.toBigDecimalOrNull()
                                        ?.abs()?.setScale(2, RoundingMode.HALF_UP)?.toPlainString() ?: "—"
                                    val presentation = classifyPayment(
                                        payment.description, payment.state,
                                        session?.userId != null && payment.creatorUserId == session?.userId
                                    )
                                    val originLabel = when {
                                        payment.createdLocally -> "Creado en este dispositivo"
                                        payment.origin == "android" -> "Descargado del servidor · registrado desde la app"
                                        payment.origin == "web" -> "Descargado del servidor · registrado desde la web"
                                        else -> "Descargado del servidor · canal no registrado"
                                    }
                                    val syncLabel = when (paymentOperation?.status) {
                                        OperationStatus.PENDING -> "Pendiente de sincronizar"
                                        OperationStatus.IN_FLIGHT -> "Enviando al servidor"
                                        OperationStatus.CONFLICT ->
                                            "Conflicto: ${paymentOperation.lastError ?: "revisar Cola"}"
                                        OperationStatus.REJECTED ->
                                            "Rechazado: ${paymentOperation.lastError ?: "revisar Cola"}"
                                        else -> if (payment.createdLocally) "Sincronizado con el servidor"
                                            else "Disponible desde el servidor"
                                    }
                                    val stateLabel = when (payment.state) {
                                        "saved" -> "Guardado"
                                        "created" -> "Creado"
                                        "entregando" -> "Entregando"
                                        else -> payment.state ?: "No registrado"
                                    }
                                    Column(
                                        Modifier.fillMaxWidth()
                                            .clip(RoundedCornerShape(8.dp))
                                            .background(presentation.background)
                                            .padding(12.dp)
                                    ) {
                                        Text("Último registro", color = presentation.foreground, fontWeight = FontWeight.Bold)
                                        Text("${presentation.type} · $ $amount", color = presentation.foreground)
                                        if (presentation.detail.isNotBlank()) {
                                            Text("Detalle: ${presentation.detail}", color = presentation.foreground)
                                        }
                                        Text("Origen: $originLabel", color = presentation.foreground)
                                        Text("Sincronización: $syncLabel", color = presentation.foreground)
                                        payment.creatorUsername?.let {
                                            Text("Creado por: ${formatPersonName(it)}", color = presentation.foreground)
                                        } ?: if (!payment.createdLocally) {
                                            Text("Usuario creador: no registrado (abono anterior a este control)", color = presentation.foreground)
                                        } else Unit
                                        Text("Estado: $stateLabel", color = presentation.foreground)
                                        payment.createdAt?.let {
                                            Text(formatPaymentMoment(it), color = presentation.foreground)
                                        }
                                    }
                                }
                                if (operationRows.any {
                                        it.branchId == row.credit.branchId &&
                                            it.entityId == row.credit.id &&
                                            it.kind != OperationKind.CREATE_PAYMENT &&
                                            it.status in setOf(OperationStatus.PENDING, OperationStatus.IN_FLIGHT)
                                    }
                                ) Text("Hay otros cambios pendientes de confirmar.", color = MaterialTheme.colorScheme.error)
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
                                Text("Saldo: ${credit.balance ?: "—"} · Valor total: ${credit.value ?: "—"}")
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
                Screen.MARKED -> {
                    Text("Tarjetas marcadas", style = MaterialTheme.typography.headlineSmall)
                    Text(
                        "Marcas guardadas solo en este teléfono; nunca viajan al servidor.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    val markedRows = rows.filter { it.credit.id in markedCreditIds }
                    if (markedRows.isEmpty()) Text("Todavía no marcaste ninguna tarjeta. Usa la estrella de la cartera.")
                    markedRows.forEach { row ->
                        Card(Modifier.fillMaxWidth().clickable {
                            // Bookmarks only take you back to the card; opening payments still
                            // needs a deliberate tap on the card itself in the portfolio.
                            pointedCreditId = row.credit.id
                            pointerArmed = false
                            restorePointerScroll = true
                            screen = Screen.HOME
                        }) {
                            Column(Modifier.padding(16.dp)) {
                                Text("${row.customer?.firstName.orEmpty()} ${row.customer?.lastName.orEmpty()}")
                                Text("Crédito ${row.credit.additionalNumber ?: row.credit.id} · Saldo ${row.credit.balance ?: "—"}")
                                TextButton(onClick = {
                                    scope.launch {
                                        val current = session ?: return@launch
                                        val branch = current.selectedBranchId ?: return@launch
                                        app.repository.setCreditMarked(current.accountKey, branch, row.credit.id, false)
                                        markedCreditIds = app.repository.markedCredits(current.accountKey, branch).toSet()
                                    }
                                }) { Text("Quitar marca") }
                            }
                        }
                    }
                    TextButton(onClick = { screen = Screen.HOME }) { Text("Volver a la cartera") }
                }
                Screen.SYNC_SETTINGS -> {
                    Text("Sincronización", style = MaterialTheme.typography.headlineSmall)
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Sincronización automática", style = MaterialTheme.typography.titleMedium)
                        Switch(
                            checked = syncAutoEnabled,
                            onCheckedChange = { enabled ->
                                val current = session ?: return@Switch
                                val branch = current.selectedBranchId ?: return@Switch
                                SyncScheduler.setPeriodicEnabled(activity, current.accountKey, branch, enabled)
                                syncAutoEnabled = enabled
                                notice = if (enabled) {
                                    "Sincronización automática encendida cada $syncIntervalMinutes minutos."
                                } else {
                                    "Sincronización automática apagada. Lo guardado sigue en la cola; " +
                                        "usa \"Sincronizar ahora\" cuando quieras enviarlo."
                                }
                            }
                        )
                    }
                    Text(
                        if (syncAutoEnabled) {
                            "El sistema operativo obliga a un mínimo de 15 minutos entre sincronizaciones " +
                                "en segundo plano; no es posible bajar de ese límite sin mantener la app " +
                                "abierta en primer plano de forma permanente."
                        } else {
                            "Apagada: nada se envía ni se baja solo. Lo que guardes queda en la cola del " +
                                "teléfono hasta que toques \"Sincronizar ahora\"."
                        },
                        style = MaterialTheme.typography.bodySmall
                    )
                    Button(onClick = {
                        val current = session ?: return@Button
                        val branch = current.selectedBranchId ?: return@Button
                        scope.launch {
                            busy = true
                            // Push the queue first so nothing registered in the street is lost,
                            // then pull so the portfolio reflects what other collectors did.
                            SyncScheduler.enqueue(activity, current.accountKey, branch, expedited = true)
                            if (online) {
                                when (val result = app.repository.pullChanges(current, branch)) {
                                    is ApiResult.Success -> notice = "Cartera al día."
                                    else -> report(result)
                                }
                            } else {
                                notice = "Sin conexión: la cola se enviará sola al recuperar señal."
                            }
                            loadLocal()
                            loadOperations()
                            busy = false
                        }
                    }) { Text("Sincronizar ahora") }
                    if (unresolvedBadge > 0) Text(
                        "$unresolvedBadge operación(es) sin resolver en la cola.",
                        color = MaterialTheme.colorScheme.error
                    )
                    OutlinedTextField(
                        syncIntervalMinutes.toString(),
                        { text -> text.toLongOrNull()?.let { syncIntervalMinutes = it } },
                        label = { Text("Intervalo en minutos (mínimo 15, recomendado 20-30)") },
                        enabled = syncAutoEnabled,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Button(
                        enabled = syncAutoEnabled,
                        onClick = {
                            val current = session ?: return@Button
                            val branch = current.selectedBranchId ?: return@Button
                            SyncScheduler.schedulePeriodic(activity, current.accountKey, branch, syncIntervalMinutes)
                            syncIntervalMinutes = SyncScheduler.readIntervalMinutes(activity)
                            notice = "Sincronización automática programada cada $syncIntervalMinutes minutos."
                        }
                    ) { Text("Guardar intervalo") }
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
                        Text("Valor total: ${formatMoney(selectedCredit.value)} · Saldo actual: ${formatMoney(selectedCredit.balance)}")
                        Text("Costo / capital entregado: ${formatMoney(selectedCredit.principal)}")
                        Text("Concepto: ${selectedCredit.concept.orEmpty()} · Valor: ${formatMoney(selectedCredit.value)}")
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
                    Button(
                        onClick = { prepareComposer(OperationKind.CREATE_PAYMENT) },
                        enabled = openPayment == null
                    ) {
                        Text("Registrar pago")
                    }
                    if ("nueva tarjeta" in branchPermissionSet || branchPermissionSet.isEmpty()) {
                        OutlinedButton(onClick = { selectedCreditId?.let(::assessCard) }) {
                            Text("Crear otra tarjeta a este cliente")
                        }
                    }
                    Text(
                        "Editar, eliminar, cambiar estado, reordenar, descuento, interés y actualizar " +
                            "pagos están en los tres punticos de abajo.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    if (openPayment != null) Text(
                        if (openPayment.state == "created") {
                            "Este crédito ya tiene un abono registrado hoy (sin liquidar). Usa \"Editar\" en ese movimiento si necesitas corregirlo."
                        } else {
                            "Este crédito ya tiene un abono en entrega. Solo se podrá registrar otro cuando se cierre la ruta."
                        },
                        color = MaterialTheme.colorScheme.error
                    )
                    Text("Movimientos", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "La resta es el saldo que quedó tras cada movimiento; se calcula en el " +
                            "teléfono con lo que hay guardado.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    val creditPayments = paymentRows.filter { it.creditId == selectedCreditId }
                    val balancesAfter = runningBalances(
                        credit?.balance?.toBigDecimalOrNull(),
                        creditPayments.map { it.amount?.toBigDecimalOrNull() }
                    )
                    if (creditPayments.isEmpty()) Text("Esta tarjeta todavía no tiene movimientos guardados.")
                    creditPayments.forEachIndexed { index, payment ->
                        val presentation = classifyPayment(
                            payment.description, payment.state,
                            session?.userId != null && payment.creatorUserId == session?.userId
                        )
                        val movementAmount = payment.amount?.toBigDecimalOrNull()?.abs()
                        val stateLabel = when (payment.state) {
                            "saved" -> "Guardado"
                            "created" -> "Creado"
                            "entregando" -> "Entregando"
                            null -> "Sin estado"
                            else -> payment.state.orEmpty()
                        }
                        val pendingPayment = payment.createdLocally && operationRows.any { operation ->
                            operation.kind == OperationKind.CREATE_PAYMENT &&
                                operation.payload.contains("\"iddescripcion\":\"${payment.id}\"") &&
                                operation.status in setOf(OperationStatus.PENDING, OperationStatus.IN_FLIGHT)
                        }
                        Card(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(12.dp)) {
                                Row(
                                    Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column {
                                        Text("Abono", style = MaterialTheme.typography.labelSmall)
                                        Text(
                                            movementAmount?.let { formatMoney(it) } ?: "—",
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                    Column(horizontalAlignment = Alignment.End) {
                                        Text("Resta", style = MaterialTheme.typography.labelSmall)
                                        Text(
                                            balancesAfter.getOrNull(index)?.let { formatMoney(it) } ?: "—",
                                            style = MaterialTheme.typography.titleMedium
                                        )
                                    }
                                }
                                Text(formatPaymentMoment(payment.createdAt))
                                Row(
                                    Modifier.fillMaxWidth().padding(top = 4.dp),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        presentation.type,
                                        color = presentation.foreground,
                                        style = MaterialTheme.typography.labelMedium,
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(6.dp))
                                            .background(presentation.background)
                                            .padding(horizontal = 8.dp, vertical = 2.dp)
                                    )
                                    Text(stateLabel, style = MaterialTheme.typography.labelMedium)
                                }
                                if (presentation.detail.isNotBlank()) Text(presentation.detail)
                                if (pendingPayment) Text(
                                    "Pendiente de enviar · sin confirmar",
                                    color = MaterialTheme.colorScheme.error,
                                    style = MaterialTheme.typography.labelMedium
                                )
                                payment.creatorUsername?.let {
                                    Text(
                                        "Registró: ${formatPersonName(it)}",
                                        style = MaterialTheme.typography.labelMedium
                                    )
                                }
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    // The server only lets a payment be rewritten or removed while
                                    // it is still 'created'; afterwards it belongs to a closed route.
                                    if (payment.state == "created") {
                                        TextButton(onClick = {
                                            prepareComposer(OperationKind.UPDATE_PAYMENT, payment.id)
                                            val originalAmount = kotlin.math.abs(payment.amount?.toDoubleOrNull() ?: 0.0).toString()
                                            draftPaymentAmount = originalAmount
                                            draftPaymentOriginalAmount = originalAmount
                                            draftPaymentDescription = payment.description.orEmpty()
                                            draftPaymentConfirmRemaining = ""
                                        }) { Text("Editar") }
                                        TextButton(onClick = {
                                            prepareComposer(OperationKind.DELETE_PAYMENT, payment.id)
                                        }) { Text("Eliminar") }
                                    } else Text(
                                        "Ya liquidado · no se puede editar ni eliminar",
                                        style = MaterialTheme.typography.labelMedium
                                    )
                                }
                            }
                        }
                    }
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
                Screen.CARD_ASSESSMENT -> {
                    val origin = rows.firstOrNull { it.credit.id == assessmentCreditId }
                    val person = origin?.customer
                    Text("Análisis previo · nueva tarjeta", style = MaterialTheme.typography.headlineSmall)
                    if (origin == null || person == null) {
                        Text("No hay datos locales del cliente de esta tarjeta; sincroniza antes de decidir.",
                            color = MaterialTheme.colorScheme.error)
                    } else {
                        Text("${formatPersonName("${person.firstName} ${person.lastName}")} · " +
                            "${person.documentType.orEmpty()} ${person.documentNumber.orEmpty()}")
                        Text("Estado del cliente: ${person.customerStatus.orEmpty()} · Cupo máximo: ${formatMoney(person.maxCredit)}")
                        Text("Teléfono ${person.phone.orEmpty()} · Dirección ${person.city.orEmpty()}, " +
                            "${person.neighborhood.orEmpty()} ${person.address.orEmpty()}")
                        if (!person.customerNote.isNullOrBlank()) Text("Nota: ${person.customerNote}")
                        val localCredits = assessmentLocalCredits
                        val localDebt = localCredits.sumOf { it.balance?.toBigDecimalOrNull() ?: java.math.BigDecimal.ZERO }
                        Text("Guardado en este teléfono (${branchId.orEmpty()}): ${localCredits.size} tarjetas · " +
                            "saldo pendiente ${formatMoney(localDebt.toPlainString())} · " +
                            "${assessmentLocalPayments.size} abonos")
                        localCredits.forEach { credit ->
                            val payments = assessmentLocalPayments.filter { it.creditId == credit.id }
                            Text("Tarjeta ${credit.id} · ${credit.status.orEmpty()} · " +
                                "saldo ${formatMoney(credit.balance)} · ${payments.size} abonos locales")
                            payments.forEach { payment ->
                                Text("  ${payment.createdAt.orEmpty()} · ${formatMoney(payment.amount)} · " +
                                    "${payment.description.orEmpty()} (${payment.state.orEmpty()})",
                                    style = MaterialTheme.typography.bodySmall)
                            }
                        }
                        Text(if (assessmentLoading) "Consultando…" else assessmentMessage)
                        assessmentCustomer?.let { remote ->
                            Text("${formatPersonName("${remote.firstName} ${remote.lastName}")} · " +
                                "${remote.documentType.orEmpty()} ${remote.documentNumber.orEmpty()} · " +
                                "teléfono ${remote.phone.orEmpty()} · ${remote.city.orEmpty()}, ${remote.neighborhood.orEmpty()} ${remote.street.orEmpty()}")
                            Text("Servidor (solo sucursal autorizada): ${remote.credits.size} tarjetas · " +
                                "cupo máximo ${formatMoney(remote.maxCredit?.toString())} · " +
                                "estado ${remote.status.orEmpty()} · calificación ${remote.rating.orEmpty()} · " +
                                "${assessmentPayments.size} abonos")
                            if (!remote.note.isNullOrBlank()) Text("Nota: ${remote.note}")
                            remote.comments.forEach { note -> Text("Comentario: ${note.comment}") }
                            remote.credits.forEach { credit ->
                                Text("Tarjeta ${credit.id} · ${credit.status.orEmpty()} · " +
                                    "saldo ${formatMoney(credit.balance?.toString())} · " +
                                    "valor ${formatMoney(credit.value?.toString())}")
                                assessmentPayments.filter { it.creditId == credit.id }.forEach { payment ->
                                    Text("  ${payment.createdAt.orEmpty()} · ${formatMoney(payment.amount?.toString())} · " +
                                        "${payment.description.orEmpty()} (${payment.state.orEmpty()})",
                                        style = MaterialTheme.typography.bodySmall)
                                }
                            }
                        }
                        Text("Revisa los pagos y saldos antes de decidir. La aprobación la decide el empleado; " +
                            "el servidor valida el cupo y la ruta al guardar.")
                        if (receiptSequences.isEmpty()) Text(
                            "No hay consecutivo de comprobante guardado para esta sucursal; sincroniza en línea.",
                            color = MaterialTheme.colorScheme.error
                        )
                        if (session?.branchExtraCharges?.get(branchId) !in setOf("boleta", "seguro", "ninguno")) Text(
                            "No se conoce el cobro adicional de esta sucursal; entra en línea para actualizarlo.",
                            color = MaterialTheme.colorScheme.error
                        )
                        Button(
                            enabled = !assessmentLoading && assessmentCreditId == selectedCreditId &&
                                receiptSequences.isNotEmpty() &&
                                (session?.branchExtraCharges?.get(branchId) in setOf("boleta", "seguro", "ninguno")),
                            onClick = {
                                prepareComposer(OperationKind.CREATE_CREDIT, sourceCreditId = assessmentCreditId)
                            }
                        ) { Text("Apto · abrir formulario") }
                    }
                    TextButton(onClick = { screen = Screen.HOME }) { Text("Volver a cartera") }
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
                            val originCredit = rows.firstOrNull { it.credit.id == selectedCreditId }
                            Text(
                                "Cliente: ${formatPersonName("${customer?.firstName.orEmpty()} ${customer?.lastName.orEmpty()}").ifBlank { "—" }}",
                                style = MaterialTheme.typography.titleMedium
                            )
                            if (draftCustomerId.isBlank()) {
                                OutlinedTextField(draftCustomerId, { draftCustomerId = it }, label = { Text("ID de cliente del servidor *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                            }
                            if (draftDocumentSequenceId.isBlank()) Text(
                                "Esta sucursal no tiene consecutivo de comprobante guardado. Sincroniza en línea antes de crear la tarjeta.",
                                color = MaterialTheme.colorScheme.error
                            ) else Text(
                                "Comprobante: ${draftReceiptType} ${draftSeries} N° ${draftReceiptNumber}",
                                style = MaterialTheme.typography.bodySmall
                            )
                            if (originCredit != null) {
                                Text("Posición respecto a la tarjeta abierta", style = MaterialTheme.typography.labelLarge)
                                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    for ((placement, label) in listOf(
                                        CardPlacement.BEFORE to "Antes", CardPlacement.AFTER to "Después"
                                    )) {
                                        FilterChip(
                                            selected = draftCardPlacement == placement,
                                            onClick = { draftCardPlacement = placement },
                                            label = { Text(label) }
                                        )
                                    }
                                }
                            }
                            Text("La ruta abierta la asigna el servidor; no se envía routeId.", style = MaterialTheme.typography.bodySmall)
                            Text("Concepto", style = MaterialTheme.typography.labelLarge)
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                for (option in listOf("Prestamo", "Articulo")) {
                                    FilterChip(
                                        selected = draftConcept.equals(option, ignoreCase = true),
                                        onClick = { draftConcept = option },
                                        label = { Text(option) }
                                    )
                                }
                            }
                            OutlinedTextField(draftValue, { draftValue = it }, label = { Text("Valor total a pagar (deuda inicial) *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                            OutlinedTextField(draftCost, { draftCost = it }, label = { Text("Costo / capital entregado (no es la deuda) *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                            Text("Utilidad calculada: ${formatMoney(creditProfit(draftValue, draftCost))}")
                            val total = draftValue.toBigDecimalOrNull()
                            val initial = if (draftConcept == "Articulo") draftInitialPayment.toBigDecimalOrNull() else java.math.BigDecimal.ZERO
                            Text("Empieza debiendo: ${if (total != null && initial != null && total >= initial) formatMoney(total.subtract(initial)) else "—"}")
                            Text("Modo de pago", style = MaterialTheme.typography.labelLarge)
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                for (option in listOf("Diario", "Semanal", "Quincenal", "Mensual")) {
                                    FilterChip(
                                        selected = draftFrequency.equals(option, ignoreCase = true),
                                        onClick = { draftFrequency = option },
                                        label = { Text(option) }
                                    )
                                }
                            }
                            OutlinedTextField(draftTerm, { draftTerm = it }, label = { Text("Plazo *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                            Text("Valor cuota: ${installmentValue(draftValue, draftTerm)?.let(::formatMoney) ?: "—"}")
                            if (draftConcept == "Articulo") {
                                OutlinedTextField(draftDescription, { draftDescription = it }, label = { Text("Descripción del artículo *") }, modifier = Modifier.fillMaxWidth(), minLines = 2)
                                OutlinedTextField(draftInitialPayment, { draftInitialPayment = it }, label = { Text("Cuota inicial *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                            } else {
                                when (session?.branchExtraCharges?.get(branchId)) {
                                    "boleta" -> {
                                        OutlinedTextField(draftAdditionalNumber, { draftAdditionalNumber = it }, label = { Text("Número de boleta *") }, modifier = Modifier.fillMaxWidth())
                                        OutlinedTextField(draftAdditionalValue, { draftAdditionalValue = it }, label = { Text("Valor boleta *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                                    }
                                    "seguro" -> OutlinedTextField(draftAdditionalValue, { draftAdditionalValue = it }, label = { Text("Valor seguro *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                                    "ninguno" -> Unit
                                    else -> Text("Falta conocer el cobro adicional de esta sucursal; actualiza en línea.",
                                        color = MaterialTheme.colorScheme.error)
                                }
                            }
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
