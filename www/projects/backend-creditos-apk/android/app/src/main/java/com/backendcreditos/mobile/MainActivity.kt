package com.backendcreditos.mobile

import android.Manifest
import android.os.Bundle
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.PullToRefreshDefaults
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Star
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.backendcreditos.mobile.data.BranchEntity
import com.backendcreditos.mobile.data.CustomerEntity
import com.backendcreditos.mobile.data.CreditLocationEntity
import com.backendcreditos.mobile.data.ACTIVITY_LOG_MAX_ENTRIES
import com.backendcreditos.mobile.data.ActivityLogEntity
import com.backendcreditos.mobile.data.OfflineOperationEntity
import com.backendcreditos.mobile.data.OperationKind
import com.backendcreditos.mobile.data.OperationPayloadMapper
import com.backendcreditos.mobile.data.OperationStatus
import com.backendcreditos.mobile.data.PaymentEntity
import com.backendcreditos.mobile.data.PortfolioRow
import com.backendcreditos.mobile.network.ApiResult
import com.backendcreditos.mobile.network.LoginResult
import com.backendcreditos.mobile.location.currentLocation
import com.backendcreditos.mobile.location.geoUriForLocation
import com.backendcreditos.mobile.location.hasLocationPermission
import com.backendcreditos.mobile.location.LocationLookup
import com.backendcreditos.mobile.security.BiometricCredentialManager
import com.backendcreditos.mobile.security.StoredSession
import com.backendcreditos.mobile.ui.theme.CreditTheme
import com.backendcreditos.mobile.ui.theme.TextScale
import com.backendcreditos.mobile.ui.theme.ThemeMode
import com.backendcreditos.mobile.ui.theme.ThemePreferences
import com.backendcreditos.mobile.work.SyncScheduler
import androidx.work.WorkManager
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.UUID
import java.math.RoundingMode

private data class ConnectionStatus(val color: Color, val description: String)

// A paused automatic sync is different from being offline: authenticated online actions may
// continue while the queue waits for the user to resolve a conflict or configuration choice.
private fun connectionStatus(authExpired: Boolean, online: Boolean, autoSync: Boolean): ConnectionStatus = when {
    authExpired -> ConnectionStatus(Color(0xFFFFA726), "Sesión del servidor vencida")
    online && autoSync -> ConnectionStatus(Color(0xFF43A047), "En línea con sincronización automática")
    online -> ConnectionStatus(Color(0xFFFFC107), "En línea; sincronización automática detenida")
    else -> ConnectionStatus(Color(0xFFE53935), "Sin conexión con el servidor")
}

private enum class Screen { LOGIN, BRANCHES, HOME, CUSTOMER, CUSTOMER_PHONES, CUSTOMER_LOOKUP, CREDIT, CARD_ASSESSMENT, QUEUE, COMPOSER, DEFAULTERS, WITHDRAWN, CANCELLED, PORTFOLIO_CLIENTS, SYNC_SETTINGS, MARKED, SETTLEMENT, ROUTE_ENTRIES }

private fun themeModeLabel(mode: ThemeMode): String = when (mode) {
    ThemeMode.SYSTEM -> "Sistema"
    ThemeMode.LIGHT -> "Claro"
    ThemeMode.DARK -> "Oscuro"
}

private fun textScaleLabel(scale: TextScale): String = when (scale) {
    TextScale.STANDARD -> "Estándar"
    TextScale.LARGE -> "Grande"
    TextScale.EXTRA_LARGE -> "Muy grande"
}

@Composable
private fun MenuIcon(drawable: Int) {
    Icon(
        painter = painterResource(drawable),
        contentDescription = null
    )
}

@Composable
private fun MenuSectionDivider() {
    HorizontalDivider(
        modifier = Modifier.padding(horizontal = 12.dp),
        thickness = 1.dp,
        color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.7f)
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CompactOutlinedTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    modifier: Modifier = Modifier
) {
    val interactionSource = remember {
        androidx.compose.foundation.interaction.MutableInteractionSource()
    }
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier
            .heightIn(min = 48.dp)
            .semantics { contentDescription = placeholder },
        textStyle = MaterialTheme.typography.bodyLarge.merge(
            TextStyle(color = MaterialTheme.colorScheme.onSurface)
        ),
        keyboardOptions = keyboardOptions,
        singleLine = true,
        decorationBox = { innerTextField ->
            OutlinedTextFieldDefaults.DecorationBox(
                value = value,
                innerTextField = innerTextField,
                enabled = true,
                singleLine = true,
                visualTransformation = androidx.compose.ui.text.input.VisualTransformation.None,
                interactionSource = interactionSource,
                placeholder = {
                    Text(
                        placeholder,
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                },
                contentPadding = androidx.compose.foundation.layout.PaddingValues(
                    horizontal = 8.dp,
                    vertical = 4.dp
                )
            )
        }
    )
}

// The record is no longer in the queue: someone removed it by hand from the Cola screen.
private const val DROPPED_FROM_QUEUE_MESSAGE =
    "Ese registro ya no está en la cola: lo quitaron sin registrarlo. Mira el detalle en Actividad."

// Server message plus, when the route day was the problem, what the person can do about it.
private fun rejectionDetail(operation: com.backendcreditos.mobile.data.OfflineOperationEntity): String =
    listOfNotNull(
        friendlyServerError(operation.lastError),
        com.backendcreditos.mobile.queue.RouteGuard.refusalAdvice(operation.rejectionCode)
    ).joinToString(" ")

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
            val themePreferences = remember { ThemePreferences(this) }
            var themeMode by remember { mutableStateOf(themePreferences.read()) }
            var textScale by remember { mutableStateOf(themePreferences.readTextScale()) }
            CreditTheme(themeMode, textScale) {
                CreditApplicationScreen(
                    app = app,
                    activity = this,
                    themeMode = themeMode,
                    textScale = textScale,
                    onThemeModeChange = { selected ->
                        themePreferences.save(selected)
                        themeMode = selected
                    },
                    onTextScaleChange = { selected ->
                        themePreferences.saveTextScale(selected)
                        textScale = selected
                    }
                )
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
    OperationKind.ADD_CUSTOMER_PHONE -> "Crear teléfono de WhatsApp"
    OperationKind.SELECT_CUSTOMER_PHONE -> "Seleccionar teléfono de WhatsApp"
    OperationKind.SET_CUSTOMER_PHONE_VALIDITY -> "Corregir teléfono del cliente"
    OperationKind.RECORD_WHATSAPP_OPEN -> "Registrar apertura de WhatsApp"
    OperationKind.RECORD_WHATSAPP_RECEIPT -> "Reenvío de comprobante por WhatsApp"
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
    OperationKind.CREATE_LOCATION -> "Marcar ubicación de cobro"
    OperationKind.DELETE_LOCATION -> "Eliminar ubicación de cobro"
    OperationKind.UPSERT_ALERT -> "Crear/editar alerta"
    OperationKind.CREATE_EXPENSE -> "Anotar gasto de la ruta"
    OperationKind.UPDATE_EXPENSE -> "Corregir gasto de la ruta"
    OperationKind.DELETE_EXPENSE -> "Borrar gasto de la ruta"
    OperationKind.CREATE_BASE -> "Anotar base recibida"
    OperationKind.UPDATE_BASE -> "Corregir base recibida"
    OperationKind.DELETE_BASE -> "Borrar base recibida"
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
private fun CreditApplicationScreen(
    app: CreditApp,
    activity: MainActivity,
    themeMode: ThemeMode,
    textScale: TextScale,
    onThemeModeChange: (ThemeMode) -> Unit,
    onTextScaleChange: (TextScale) -> Unit
) {
    val scope = rememberCoroutineScope()
    var session by remember { mutableStateOf(app.vault.readSession()) }
    var screen by remember { mutableStateOf(Screen.LOGIN) }
    var currentTime by remember { mutableStateOf(System.currentTimeMillis()) }
    LaunchedEffect(session?.paymentExpiresAt) {
        val expiry = session?.paymentExpiresAt
        if (expiry != null && expiry > System.currentTimeMillis()) {
            delay(expiry - System.currentTimeMillis())
            currentTime = System.currentTimeMillis()
        }
    }
    var settingsReturnScreen by remember { mutableStateOf(Screen.LOGIN) }
    var online by remember { mutableStateOf(false) }
    val connectivity = remember {
        activity.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    }
    var deviceConnected by remember { mutableStateOf(
        connectivity.getNetworkCapabilities(connectivity.activeNetwork)
            ?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
    ) }
    DisposableEffect(connectivity) {
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                activity.runOnUiThread {
                    deviceConnected = connectivity.getNetworkCapabilities(connectivity.activeNetwork)
                        ?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
                }
            }
            override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
                activity.runOnUiThread {
                    deviceConnected = connectivity.getNetworkCapabilities(connectivity.activeNetwork)
                        ?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
                }
            }
            override fun onLost(network: Network) {
                activity.runOnUiThread {
                    deviceConnected = connectivity.getNetworkCapabilities(connectivity.activeNetwork)
                        ?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
                }
            }
        }
        connectivity.registerDefaultNetworkCallback(callback)
        onDispose { connectivity.unregisterNetworkCallback(callback) }
    }
    // `online` comes from a real authenticated server response. Android's network capability can
    // be transiently false after screen lock, especially on private Wi-Fi, even while the API works.
    val creditOnline = online
    val biometricManager = remember { BiometricCredentialManager() }
    val biometricDeviceId = remember { app.vault.biometricDeviceId() }
    var company by remember { mutableStateOf(session?.companyId.orEmpty()) }
    var username by remember { mutableStateOf(session?.username.orEmpty()) }
    var password by remember { mutableStateOf("") }
    var branchList by remember { mutableStateOf(emptyList<BranchEntity>()) }
    var branchOfficeFilter by rememberSaveable { mutableStateOf<String?>(null) }
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
    var assessmentComplete by remember { mutableStateOf(false) }
    var assessmentJob by remember { mutableStateOf<kotlinx.coroutines.Job?>(null) }
    // Portfolio pointer: the card the collector is standing on. It is saved so it also
    // survives configuration changes and process death, not only screen changes.
    var pointedCreditId by rememberSaveable { mutableStateOf<String?>(null) }
    var previousPortfolioCreditIds by remember { mutableStateOf(emptyList<String>()) }
    // Only a tap on the card itself arms the pointer; arrows and bookmarks leave it disarmed.
    var pointerArmed by rememberSaveable { mutableStateOf(false) }
    var restorePointerScroll by rememberSaveable { mutableStateOf(false) }
    var inlinePaymentCreditId by remember { mutableStateOf<String?>(null) }
    var inlinePaymentError by remember { mutableStateOf("") }
    var watchedPaymentOperationIds by remember { mutableStateOf(emptySet<String>()) }
    val snackbarHostState = remember { SnackbarHostState() }
    var paymentRows by remember { mutableStateOf(emptyList<com.backendcreditos.mobile.data.PaymentEntity>()) }
    var creditLocationRows by remember { mutableStateOf(emptyList<CreditLocationEntity>()) }
    var operationRows by remember { mutableStateOf(emptyList<com.backendcreditos.mobile.data.OfflineOperationEntity>()) }
    var syncControl by remember { mutableStateOf<com.backendcreditos.mobile.data.SyncControlEntity?>(null) }
    var notice by remember { mutableStateOf("") }
    var queueTab by rememberSaveable { mutableStateOf(0) }
    var activityLogRows by remember { mutableStateOf(emptyList<ActivityLogEntity>()) }
    var routeCash by remember { mutableStateOf<com.backendcreditos.mobile.data.RouteCashEntity?>(null) }
    var busy by remember { mutableStateOf(false) }
    var search by remember { mutableStateOf("") }
    var showPortfolioSearch by remember { mutableStateOf(false) }
    var refreshingPortfolio by remember { mutableStateOf(false) }
    var alwaysShowPortfolioSearch by remember {
        mutableStateOf(PortfolioDisplaySettings.alwaysShowSearch(activity))
    }
    var showLogoutConfirmation by remember { mutableStateOf(false) }
    var showRouteSweepConfirmation by remember { mutableStateOf(false) }
    var showLocationNameDialog by remember { mutableStateOf(false) }
    var locationNameDraft by remember { mutableStateOf("Casa") }
    var pendingLocationName by remember { mutableStateOf<String?>(null) }
    var grantedLocationName by remember { mutableStateOf<String?>(null) }
    var locationToDelete by remember { mutableStateOf<CreditLocationEntity?>(null) }
    var pendingLogoutCount by remember { mutableStateOf(0) }
    var documentType by remember { mutableStateOf("") }
    var documentNumber by remember { mutableStateOf("") }
    var personDocumentTypes by remember { mutableStateOf(emptyList<String>()) }
    var showPersonDocumentMenu by remember { mutableStateOf(false) }
    var customerCandidate by remember { mutableStateOf<com.backendcreditos.mobile.network.CustomerCandidateDto?>(null) }
    var customerLookupVerified by remember { mutableStateOf(false) }
    var lookupCustomer by remember { mutableStateOf<com.backendcreditos.mobile.network.CustomerDto?>(null) }
    var lookupPayments by remember { mutableStateOf(emptyList<com.backendcreditos.mobile.network.PaymentDto>()) }
    var lookupAnchorId by remember { mutableStateOf<String?>(null) }
    var lookupMessage by remember { mutableStateOf("") }
    var lookupComplete by remember { mutableStateOf(false) }
    var lookupSearched by remember { mutableStateOf(false) }
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
    var draftInitialPayment by remember { mutableStateOf("0") }
    var draftInitialPaymentMethod by remember { mutableStateOf(PaymentMethodDraft()) }
    var draftPaymentMethod by remember { mutableStateOf(PaymentMethodDraft()) }
    var bankAccounts by remember { mutableStateOf(emptyList<com.backendcreditos.mobile.data.BankAccountEntity>()) }
    var settlement by remember { mutableStateOf<com.backendcreditos.mobile.network.RouteSettlementDto?>(null) }
    var cashCount by remember { mutableStateOf(CashCount()) }
    var settlementError by remember { mutableStateOf("") }
    var routeEntryRows by remember { mutableStateOf(emptyList<com.backendcreditos.mobile.data.RouteEntryEntity>()) }
    var routeCatalog by remember { mutableStateOf<com.backendcreditos.mobile.network.ExpenseCatalogDto?>(null) }
    var routeEntryDraft by remember { mutableStateOf(RouteEntryDraft()) }
    var routeEntryError by remember { mutableStateOf("") }
    var defaulterRows by remember { mutableStateOf(emptyList<com.backendcreditos.mobile.network.DefaulterCreditDto>()) }
    var withdrawnRows by remember { mutableStateOf(emptyList<com.backendcreditos.mobile.network.WithdrawnCreditDto>()) }
    var cancelledRows by remember { mutableStateOf(emptyList<com.backendcreditos.mobile.network.CancelledCreditDto>()) }
    var portfolioClientRows by remember { mutableStateOf(emptyList<com.backendcreditos.mobile.network.PortfolioClientDto>()) }
    var cancelledDateFrom by remember { mutableStateOf("") }
    var cancelledDateTo by remember { mutableStateOf("") }
    var syncIntervalMinutes by remember { mutableStateOf(SyncScheduler.readIntervalMinutes(activity)) }
    var syncAutoEnabled by remember { mutableStateOf(SyncScheduler.isPeriodicEnabled(activity)) }
    var serverEndpoint by remember { mutableStateOf(app.connectionSettings.endpoint()) }
    var serverEndpointError by remember { mutableStateOf<String?>(null) }
    var markedCreditIds by remember { mutableStateOf(emptySet<String>()) }
    var showMoreMenu by remember { mutableStateOf(false) }
    var expandedCashSummary by rememberSaveable { mutableStateOf(false) }
    var whatsAppOffer by remember { mutableStateOf<WhatsAppOffer?>(null) }
    var whatsAppOfferEnabled by remember { mutableStateOf(WhatsAppSettings.offerAfterSave(activity)) }
    var showReceiptLinkManager by remember { mutableStateOf(false) }
    var receiptLinkManagerBusy by remember { mutableStateOf(false) }
    var receiptLinkManagerBranch by remember { mutableStateOf<String?>(null) }
    var receiptLinkSummaries by remember {
        mutableStateOf(emptyList<com.backendcreditos.mobile.network.ReceiptLinkSummaryDto>())
    }
    var receiptLinkManagerHasMore by remember { mutableStateOf(false) }
    var receiptLinkToRevoke by remember {
        mutableStateOf<com.backendcreditos.mobile.network.ReceiptLinkSummaryDto?>(null)
    }
    val branchId = session?.selectedBranchId
    val account = session
    val serviceBlocked = account?.let { stored ->
        syncControl?.pauseReason == "PAYMENT" ||
            com.backendcreditos.mobile.security.paymentAccessBlocked(stored.paymentExpiresAt, currentTime)
    } == true
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        if (grants.values.any { it }) {
            grantedLocationName = pendingLocationName
            pendingLocationName = null
        } else {
            pendingLocationName = null
            notice = "Permiso de ubicación denegado. No se pudo marcar el punto."
        }
    }

    suspend fun loadLocal() {
        val current = session ?: return
        val branch = current.selectedBranchId ?: return
        rows = app.repository.portfolio(current.accountKey, branch)
        customer?.let { selected ->
            customer = app.database.localDao().customer(current.accountKey, branch, selected.id) ?: selected
        }
        branchPayments = app.repository.paymentsForBranch(current.accountKey, branch)
        customerMatches = app.repository.searchCustomers(current.accountKey, branch, search)
        operationRows = app.repository.queuedOperations(current)
        markedCreditIds = app.repository.markedCredits(current.accountKey, branch).toSet()
        receiptSequences = app.repository.receiptSequences(current.accountKey, branch)
        routeCash = app.repository.routeCash(current.accountKey, branch)
        bankAccounts = app.repository.bankAccounts(current.accountKey, branch)
        // Keep the open card's movement list fresh too, so returning to it right after saving
        // an abono shows the new row without waiting for a server round trip.
        selectedCreditId?.let { creditId ->
            paymentRows = app.database.localDao().payments(current.accountKey, branch, creditId)
            creditLocationRows = app.repository.locationsForCredit(current.accountKey, branch, creditId)
        }
        syncControl = app.database.localDao().syncControl(current.accountKey)
    }

    suspend fun serverPaymentHistories(
        remote: com.backendcreditos.mobile.network.CustomerDto, token: String, branch: String
    ): Pair<List<com.backendcreditos.mobile.network.PaymentDto>, String?> {
        val payments = mutableListOf<com.backendcreditos.mobile.network.PaymentDto>()
        for (credit in remote.credits) {
            when (val history = app.api.paymentHistory(token, branch, credit.id)) {
                is ApiResult.Success -> payments.addAll(history.value.paymentHistory)
                else -> return payments to when (history) {
                    is ApiResult.AuthExpired -> history.message
                    is ApiResult.PermissionRejected -> history.message
                    is ApiResult.Conflict -> history.message
                    is ApiResult.Rejected -> history.message
                    is ApiResult.Retryable -> history.message
                    is ApiResult.Success -> error("Handled above")
                }
            }
        }
        return payments to null
    }

    suspend fun showCustomerHistory(
        remote: com.backendcreditos.mobile.network.CustomerDto, current: StoredSession, branch: String
    ) {
        lookupCustomer = remote
        lookupAnchorId = null
        val (payments, error) = serverPaymentHistories(remote, current.token, branch)
        lookupPayments = payments
        lookupComplete = error == null
        lookupMessage = if (error == null)
            "Historial completo del servidor para esta sucursal. Evalúa la cartera antes de continuar."
        else "No se pudo cargar todo el historial: $error. Busca de nuevo."
        if (error == null) {
            val anchor = rows.firstOrNull { it.credit.id == pointedCreditId }
            if (anchor == null || anchor.customer?.documentType.isNullOrBlank() ||
                anchor.customer?.documentNumber.isNullOrBlank()) {
                lookupMessage += " Selecciona una tarjeta «Aquí vas» en la cartera antes de abrir el crédito."
            } else {
                val confirmed = if (anchor.credit.customerId == remote.id.toString()) {
                    remote.credits.any { it.id == anchor.credit.id }
                } else {
                    when (val reference = app.api.customerByDocument(
                        current.token, branch, anchor.customer!!.documentType!!, anchor.customer!!.documentNumber!!
                    )) {
                        is ApiResult.Success -> reference.value.customerByDocument
                            ?.credits?.any { it.id == anchor.credit.id } == true
                        else -> {
                            val reason = when (reference) {
                                is ApiResult.AuthExpired -> reference.message
                                is ApiResult.PermissionRejected -> reference.message
                                is ApiResult.Conflict -> reference.message
                                is ApiResult.Rejected -> reference.message
                                is ApiResult.Retryable -> reference.message
                                is ApiResult.Success -> error("Handled above")
                            }
                            lookupMessage += " No se pudo verificar «Aquí vas»: $reason."
                            false
                        }
                    }
                }
                if (confirmed) lookupAnchorId = anchor.credit.id
                else lookupMessage += " La tarjeta «Aquí vas» no está confirmada en el servidor; selecciona otra."
            }
        }
    }

    fun assessCard(creditId: String) {
            assessmentJob?.cancel()
            lookupCustomer = null
            lookupAnchorId = null
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
            assessmentComplete = false
            assessmentLoading = creditOnline
            assessmentLocalCredits = rows.filter { it.credit.customerId == origin.credit.customerId }.map { it.credit }
            assessmentLocalPayments = branchPayments.filter { payment ->
                assessmentLocalCredits.any { it.id == payment.creditId }
            }
            assessmentMessage = if (creditOnline) "Consultando el historial del servidor…" else
                "Sin conexión: el análisis solo incluye datos guardados en este dispositivo."
            screen = Screen.CARD_ASSESSMENT
            assessmentJob = scope.launch {
                val current = session ?: return@launch
                val branch = current.selectedBranchId ?: return@launch
                assessmentLocalCredits = app.database.localDao().portfolio(current.accountKey, branch)
                    .filter { it.customerId == origin.credit.customerId }
                assessmentLocalPayments = app.database.localDao().paymentsForBranch(current.accountKey, branch)
                    .filter { payment -> assessmentLocalCredits.any { it.id == payment.creditId } }
                if (!creditOnline) return@launch
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
                        } else if (!assessmentMatchesOrigin(origin.credit.customerId, origin.credit.id,
                                found.id, found.credits.map { it.id })) {
                            assessmentMessage = "La tarjeta seleccionada aún no existe en el servidor. " +
                                "Resuelve su operación en la Cola antes de crear otra tarjeta junto a ella."
                        } else {
                            assessmentCustomer = found
                            val (payments, error) = serverPaymentHistories(found, current.token, branch)
                            assessmentPayments = payments
                            assessmentComplete = error == null
                            assessmentMessage = if (error == null)
                                "Historial completo consultado en el servidor para esta sucursal."
                            else "No se pudo cargar todo el historial: $error. Vuelve a consultar."
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
        activityLogRows = app.repository.activityLog(current.accountKey)
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
            "ROUTE" -> "⚠ Sincronización pausada: la ruta de ese día ya no está abierta. Tienes $pendingCount " +
                "$plural sin enviar; revisa abajo y decide si los vuelves a enviar o los quitas."
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
        when (result) {
            is ApiResult.Success<*>, is ApiResult.Conflict, is ApiResult.PermissionRejected,
            is ApiResult.Rejected -> online = true
            is ApiResult.AuthExpired, is ApiResult.Retryable -> online = false
        }
        if (result is ApiResult.AuthExpired) {
            session?.let { current ->
                scope.launch {
                    app.repository.setSyncPaused(current.accountKey, "AUTH")
                    syncControl = app.database.localDao().syncControl(current.accountKey)
                }
            }
        }
        if (result is ApiResult.Rejected && result.code == "PAYMENT_REQUIRED") {
            session?.let { current ->
                scope.launch {
                    app.repository.setSyncPaused(current.accountKey, "PAYMENT")
                    syncControl = app.database.localDao().syncControl(current.accountKey)
                }
            }
        }
    }

    suspend fun revalidateServerConnection() {
        val current = session ?: return
        when (val result = app.api.me(current.token)) {
            is ApiResult.Success -> {
                online = true
                if (app.database.localDao().syncControl(current.accountKey)?.pauseReason == "AUTH") {
                    app.repository.setSyncPaused(current.accountKey, null)
                }
                loadOperations()
            }
            is ApiResult.AuthExpired -> report(result)
            is ApiResult.Retryable -> online = false
            is ApiResult.Rejected -> report(result)
            else -> online = true
        }
    }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner, session?.accountKey) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                currentTime = System.currentTimeMillis()
                val current = session
                if (current != null) scope.launch {
                    syncControl = app.database.localDao().syncControl(current.accountKey)
                    revalidateServerConnection()
                }
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    LaunchedEffect(deviceConnected, session?.accountKey) {
        if (deviceConnected && session != null) revalidateServerConnection()
    }
    LaunchedEffect(session?.accountKey) {
        val current = session ?: return@LaunchedEffect
        while (true) {
            delay(5_000)
            val latest = app.database.localDao().syncControl(current.accountKey)
            if (latest?.pauseReason == "PAYMENT" && syncControl?.pauseReason != "PAYMENT") {
                syncControl = latest
            }
        }
    }

    fun openFullPayments(creditId: String) {
        scope.launch {
            val current = session ?: return@launch
            val branch = current.selectedBranchId ?: return@launch
            inlinePaymentCreditId = null
            inlinePaymentError = ""
            selectedCreditId = creditId
            paymentRows = app.database.localDao().payments(current.accountKey, branch, creditId)
            creditLocationRows = app.repository.locationsForCredit(current.accountKey, branch, creditId)
            screen = Screen.CREDIT
            if (online) {
                when (val result = app.repository.openPaymentHistory(current, branch, creditId)) {
                    is ApiResult.Success -> {
                        paymentRows = result.value
                        branchPayments = app.repository.paymentsForBranch(current.accountKey, branch)
                    }
                    else -> report(result)
                }
            }
        }
    }

    suspend fun markLocationHere(name: String) {
            val current = session ?: return
            val branch = current.selectedBranchId ?: return
            val creditId = selectedCreditId ?: return
            if (!hasLocationPermission(activity)) {
                pendingLocationName = name
                locationPermissionLauncher.launch(arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ))
                return
            }
            notice = "Buscando ubicación (GPS y red)…"
            val fix = when (val lookup = currentLocation(activity)) {
                is LocationLookup.Found -> lookup.fix
                LocationLookup.ServicesOff -> {
                    notice = "La ubicación del teléfono está apagada. Actívala en Ajustes > Ubicación y vuelve a intentar."
                    runCatching {
                        activity.startActivity(Intent(android.provider.Settings.ACTION_LOCATION_SOURCE_SETTINGS))
                    }
                    return
                }
                LocationLookup.NoPermission -> {
                    notice = "Falta el permiso de ubicación. Actívalo en Ajustes > Apps > Créditos > Permisos."
                    return
                }
                LocationLookup.TimedOut -> {
                    notice = "No se obtuvo ubicación en 30 segundos. Sal a un lugar abierto o activa el Wi-Fi y vuelve a intentar."
                    return
                }
            }
            val operation = app.repository.addLocation(
                current, branch, creditId, name, fix.latitude, fix.longitude, fix.accuracyMeters
            )
            creditLocationRows = app.repository.locationsForCredit(current.accountKey, branch, creditId)
            operationRows = operationRows + operation
            SyncScheduler.enqueue(activity, current.accountKey, branch, expedited = online)
            val accuracyText = fix.accuracyMeters?.let { " Precisión: ${it} m." }.orEmpty()
            val warning = when {
                (fix.accuracyMeters ?: 0) > 50 -> " La precisión es baja; si puedes, marca de nuevo al aire libre."
                fix.ageSeconds > 0 -> " Se usó la última ubicación del teléfono (hace ${fix.ageSeconds} s)."
                else -> ""
            }
            notice = if (online) "Ubicación guardada y enviándose.$accuracyText$warning"
                else "Sin conexión: ubicación guardada y pendiente de envío.$accuracyText$warning"
    }

    suspend fun deleteLocation(location: CreditLocationEntity) {
            val current = session ?: return
            val branch = current.selectedBranchId ?: return
            val creditId = selectedCreditId ?: return
            val operation = app.repository.deleteLocation(current, branch, location)
            creditLocationRows = app.repository.locationsForCredit(current.accountKey, branch, creditId)
            operationRows = operationRows + operation
            SyncScheduler.enqueue(activity, current.accountKey, branch, expedited = online)
            notice = if (online) "Ubicación eliminada y enviándose." else "Ubicación eliminada; se enviará al recuperar señal."
    }

    fun openDirections(location: CreditLocationEntity) {
            val intent = Intent(Intent.ACTION_VIEW, geoUriForLocation(location.latitude, location.longitude, location.name))
            val chooser = Intent.createChooser(intent, "Cómo llegar")
            try {
                activity.startActivity(chooser)
            } catch (_: android.content.ActivityNotFoundException) {
                notice = "No hay una app instalada para abrir rutas (Maps o Waze)."
            } catch (error: RuntimeException) {
                notice = "No se pudo abrir la ruta: ${error.message.orEmpty()}"
            }
    }

    LaunchedEffect(grantedLocationName) {
        val name = grantedLocationName ?: return@LaunchedEffect
        grantedLocationName = null
        busy = true
        markLocationHere(name)
        busy = false
    }

    fun openCustomerLookup() {
        customerLookupVerified = false
        customerCandidate = null
        lookupCustomer = null
        lookupPayments = emptyList()
        lookupAnchorId = null
        lookupComplete = false
        lookupSearched = false
        lookupMessage = ""
        personDocumentTypes = emptyList()
        documentType = ""
        documentNumber = ""
        if (!creditOnline) {
            notice = "La búsqueda de clientes por documento requiere conexión con el servidor."
            return
        }
        screen = Screen.CUSTOMER_LOOKUP
        scope.launch {
            val current = session ?: return@launch
            val branch = current.selectedBranchId ?: return@launch
            when (val result = app.api.personDocumentTypes(current.token, branch)) {
                is ApiResult.Success -> {
                    personDocumentTypes = result.value.personDocumentTypes.map { it.name }
                    documentType = personDocumentTypes.firstOrNull {
                        it.contains("cédula", ignoreCase = true) ||
                            it.contains("cedula", ignoreCase = true)
                    } ?: personDocumentTypes.firstOrNull().orEmpty()
                    if (personDocumentTypes.isEmpty()) notice = "No hay tipos de documento configurados para personas."
                }
                else -> report(result)
            }
        }
    }

    // Base, gastos and other income are entered on the web during the day, so they are re-read
    // whenever the cartera is refreshed. Failures keep the cached figures silently.
    suspend fun refreshRouteCash() {
        val current = session ?: return
        val branch = current.selectedBranchId ?: return
        if (!online) return
        app.repository.syncRouteCash(current, branch)
        routeCash = app.repository.routeCash(current.accountKey, branch)
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
        // Bank accounts change rarely; the cached list keeps the payment method picker offline.
        app.repository.syncBankAccounts(current, branch)
        bankAccounts = app.repository.bankAccounts(current.accountKey, branch)
        refreshRouteCash()
    }

    suspend fun openBranch(branch: BranchEntity) {
        val current = session ?: return
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
        inlinePaymentCreditId = null
        watchedPaymentOperationIds = emptySet()
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

    fun selectBranch(branch: BranchEntity) {
        scope.launch { openBranch(branch) }
    }

    suspend fun completeOnlineLogin(login: LoginResult): Boolean {
        val previous = app.vault.readSession()
        val newSession = StoredSession(
            login.company.id.toString(), login.user.username, login.token,
            userId = login.user.userId,
            firstName = login.user.firstName, lastName = login.user.lastName,
            branchExtraCharges = login.branches.associate { it.id.toString() to it.extraCharge },
            employeeMaxCredit = login.user.employeeMaxCredit?.toString(),
            isSuperAdministrator = login.user.isSuperAdministrator,
            paymentExpiresAt = login.paymentExpiresAt?.toLong()
        )
        if (previous != null && previous.accountKey != newSession.accountKey) {
            val unresolved = app.repository.unresolvedCount(previous.accountKey)
            if (unresolved > 0) {
                pendingLogoutCount = unresolved
                showLogoutConfirmation = true
                notice = "Cierra primero la cuenta guardada; sus operaciones no se pueden transferir a otra cuenta."
                return false
            }
            app.repository.clearAccount(previous.accountKey)
            app.vault.clearSession()
        }
        password = ""
        session = newSession
        app.vault.saveSession(newSession)
        if (previous?.accountKey == newSession.accountKey &&
            app.database.localDao().syncControl(newSession.accountKey)?.pauseReason in setOf("AUTH", "PAYMENT")
        ) app.repository.setSyncPaused(newSession.accountKey, null)
        syncControl = app.database.localDao().syncControl(newSession.accountKey)
        when (val me = app.api.me(newSession.token)) {
            is ApiResult.Success -> {
                me.value.me?.let { user ->
                    val refreshed = newSession.copy(
                        userId = user.userId, firstName = user.firstName, lastName = user.lastName,
                        employeeMaxCredit = user.employeeMaxCredit?.toString(),
                        isSuperAdministrator = user.isSuperAdministrator
                    )
                    session = refreshed
                    app.vault.saveSession(refreshed)
                }
                when (val branches = app.api.branches(newSession.token)) {
                    is ApiResult.Success -> {
                        branchList = branches.value.branches.map { it.toEntity() }
                        val updated = (session ?: newSession).copy(
                            branchExtraCharges = branches.value.branches.associate {
                                it.id.toString() to it.extraCharge
                            }
                        )
                        session = updated
                        app.vault.saveSession(updated)
                        enqueuePendingBranches(newSession)
                        branchOfficeFilter = null
                        val onlyBranch = branchList.singleOrNull()
                        if (onlyBranch != null) openBranch(onlyBranch) else screen = Screen.BRANCHES
                        return true
                    }
                    else -> report(branches)
                }
            }
            else -> report(me)
        }
        return false
    }



    suspend fun loadDefaulters() {
        val current = session ?: return
        val branch = current.selectedBranchId ?: return
        when (val result = app.repository.defaultersOfPortfolio(current, branch)) {
            is ApiResult.Success -> defaulterRows = result.value
            else -> report(result)
        }
    }

    suspend fun loadSettlement() {
        val current = session ?: return
        val branch = current.selectedBranchId ?: return
        settlementError = ""
        when (val result = app.repository.routeSettlement(current, branch)) {
            is ApiResult.Success -> settlement = result.value
            else -> report(result)
        }
    }

    // Gastos y bases: la lista se lee siempre de la caché, así se puede anotar sin señal.
    suspend fun loadRouteEntries(fromServer: Boolean) {
        val current = session ?: return
        val branch = current.selectedBranchId ?: return
        routeEntryError = ""
        if (fromServer && online) {
            app.repository.syncRouteEntries(current, branch)
            app.repository.syncRouteCatalog(current, branch)
        }
        routeEntryRows = app.repository.routeEntries(current.accountKey, branch)
        routeCatalog = app.repository.routeCatalog(current.accountKey, branch)
    }

    /**
     * Wakes the queue up so the gasto or base leaves the phone right away and, while online,
     * waits a moment for the answer so the «Falta enviar» mark disappears without the collector
     * having to look for it in the Cola. Offline it simply stays queued, like the abonos.
     */
    suspend fun sendRouteEntry(
        operation: OfflineOperationEntity, current: StoredSession, branch: String
    ) {
        SyncScheduler.enqueue(activity, current.accountKey, branch, expedited = online)
        if (online) {
            var latest = operation
            var dropped = false
            val deadlineMs = System.currentTimeMillis() + 15_000
            while (latest.status in setOf(OperationStatus.PENDING, OperationStatus.IN_FLIGHT) &&
                System.currentTimeMillis() < deadlineMs
            ) {
                delay(400)
                val next = app.repository.operation(operation.operationId)
                if (next == null) { dropped = true; break }
                latest = next
            }
            routeEntryError = if (dropped) DROPPED_FROM_QUEUE_MESSAGE else when (latest.status) {
                OperationStatus.CONFIRMED -> ""
                OperationStatus.CONFLICT ->
                    "El servidor reportó un conflicto: ${friendlyServerError(latest.lastError)}"
                OperationStatus.REJECTED ->
                    "El servidor no lo aceptó: ${rejectionDetail(latest)}"
                else -> "Quedó guardado y se sigue enviando; revisa la Cola si no desaparece el aviso."
            }
        } else {
            routeEntryError = "Sin conexión: quedó guardado y se enviará al recuperar señal."
        }
        loadOperations()
        loadRouteEntries(false)
        refreshRouteCash()
    }

    suspend fun saveRouteEntry() {
        val current = session ?: return
        val branch = current.selectedBranchId ?: return
        val draft = routeEntryDraft
        routeEntryError = ""
        val mapped = try {
            validateRoutePayroll(draft, routeCatalog)
            when {
                draft.isBase && draft.editing ->
                    OperationKind.UPDATE_BASE to OperationPayloadMapper.updateBase(draft.id, draft.amount, draft.detail)
                draft.isBase ->
                    OperationKind.CREATE_BASE to OperationPayloadMapper.createBase(draft.amount, draft.detail)
                draft.editing -> OperationKind.UPDATE_EXPENSE to OperationPayloadMapper.updateExpense(
                    draft.id, draft.categoryId ?: 0, draft.name, draft.amount, draft.detail, draft.payrollId
                )
                else -> OperationKind.CREATE_EXPENSE to OperationPayloadMapper.createExpense(
                    draft.categoryId ?: 0, draft.name, draft.amount, draft.detail, draft.payrollId
                )
            }
        } catch (error: IllegalArgumentException) {
            routeEntryError = error.message ?: "Revisa los datos."
            return
        }
        val (kind, payload) = mapped
        val operation = try {
            app.repository.enqueue(current, branch, kind, payload.entityId, payload.payload)
        } catch (error: IllegalArgumentException) {
            routeEntryError = error.message ?: "No se pudo anotar."
            return
        }
        app.repository.applyOptimisticCacheChange(
            operation,
            creatorUsername = listOfNotNull(current.firstName, current.lastName)
                .joinToString(" ").ifBlank { current.username }
        )
        routeEntryDraft = RouteEntryDraft()
        sendRouteEntry(operation, current, branch)
    }

    suspend fun deleteRouteEntry(entry: com.backendcreditos.mobile.data.RouteEntryEntity) {
        val current = session ?: return
        val branch = current.selectedBranchId ?: return
        routeEntryError = ""
        val kind = if (entry.kind == "base") OperationKind.DELETE_BASE else OperationKind.DELETE_EXPENSE
        val operation = try {
            app.repository.enqueue(
                current, branch, kind, entry.id, OperationPayloadMapper.delete(entry.id).payload
            )
        } catch (error: IllegalArgumentException) {
            routeEntryError = error.message ?: "No se pudo borrar."
            return
        }
        app.repository.applyOptimisticCacheChange(operation)
        if (routeEntryDraft.id == entry.id) routeEntryDraft = RouteEntryDraft()
        sendRouteEntry(operation, current, branch)
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
        current: StoredSession,
        stayOnPortfolio: Boolean = false
    ) {
        SyncScheduler.enqueue(activity, current.accountKey, branch, expedited = online)
        // Registering an abono has to feel instant in the street: the movement is already saved
        // and queued on this device, so we go straight back to the card instead of blocking on
        // the server. The queue badge in the bottom bar is what reports the outcome afterwards.
        if (operation.kind == OperationKind.CREATE_PAYMENT || operation.kind == OperationKind.UPDATE_PAYMENT) {
            notice = if (stayOnPortfolio) "" else if (online) {
                "Abono guardado en el teléfono · se está enviando solo. Revisa el contador de la cola."
            } else {
                "Sin conexión: el abono quedó guardado y se enviará al recuperar señal."
            }
            screen = if (stayOnPortfolio) Screen.HOME
                else if (selectedCreditId != null) Screen.CREDIT else Screen.HOME
            return
        }
        if (!online) {
            notice = "Sin conexión: «${operationDisplayName(operation.kind)}» quedó en la cola y se enviará automáticamente al recuperar señal."
            queueTab = 0; screen = Screen.QUEUE
            return
        }
        notice = "Enviando al servidor…"
        var latest = operation
        var dropped = false
        val deadlineMs = System.currentTimeMillis() + 15_000
        while (latest.status in setOf(OperationStatus.PENDING, OperationStatus.IN_FLIGHT) &&
            System.currentTimeMillis() < deadlineMs
        ) {
            delay(400)
            val next = app.repository.operation(operation.operationId)
            if (next == null) { dropped = true; break }
            latest = next
        }
        loadLocal()
        loadOperations()
        notice = if (dropped) DROPPED_FROM_QUEUE_MESSAGE else when (latest.status) {
            OperationStatus.CONFIRMED -> "Operación confirmada por el servidor."
            OperationStatus.CONFLICT -> "El servidor reportó un conflicto: ${friendlyServerError(latest.lastError)}"
            OperationStatus.REJECTED -> "El servidor rechazó la operación: ${rejectionDetail(latest)}"
            else -> if (syncControl?.pauseReason == "AUTH")
                "Tu sesión venció mientras se procesaba. Quedó guardada localmente pero el servidor no la recibirá " +
                    "hasta que cierres sesión y vuelvas a iniciar sesión; hazlo ahora para enviarla."
            else "La operación sigue pendiente de confirmación; revisa la Cola."
        }
        if (operation.kind == OperationKind.CREATE_CREDIT && latest.status == OperationStatus.CONFIRMED) {
            pointedCreditId = operation.entityId
            pointerArmed = false
            restorePointerScroll = true
            screen = Screen.HOME
        } else { queueTab = 0; screen = Screen.QUEUE }
    }

    fun collectorName(current: StoredSession): String =
        listOfNotNull(current.firstName, current.lastName).joinToString(" ").trim()

    fun loadReceiptLinkManager() {
        val current = session
        val branch = current?.selectedBranchId
        if (current == null || branch == null || !online) {
            notice = "Conéctate y selecciona una sucursal para administrar sus enlaces."
            return
        }
        receiptLinkManagerBusy = true
        scope.launch {
            try {
                when (val result = app.api.receiptLinks(current.token, branch)) {
                    is ApiResult.Success -> {
                        receiptLinkSummaries = result.value.receiptLinks.receiptLinks
                        receiptLinkManagerHasMore = result.value.receiptLinks.hasMore
                        receiptLinkManagerBranch = branch
                        showReceiptLinkManager = true
                    }
                    is ApiResult.AuthExpired -> notice = result.message
                    is ApiResult.Conflict -> notice = result.message
                    is ApiResult.PermissionRejected -> notice = result.message
                    is ApiResult.Rejected -> notice = result.message
                    is ApiResult.Retryable -> notice = "No se pudieron cargar los enlaces: ${result.message}"
                }
            } catch (error: Exception) {
                notice = "No se pudieron cargar los enlaces: ${error.message ?: "error de conexión"}."
            } finally { receiptLinkManagerBusy = false }
        }
    }

    fun loadOlderReceiptLinks() {
        val current = session
        val branch = receiptLinkManagerBranch
        val afterId = receiptLinkSummaries.lastOrNull()?.id
        if (current == null || branch == null || afterId == null || !online || receiptLinkManagerBusy) return
        receiptLinkManagerBusy = true
        scope.launch {
            try {
                when (val result = app.api.receiptLinks(current.token, branch, afterId)) {
                    is ApiResult.Success -> {
                        receiptLinkSummaries =
                            (receiptLinkSummaries + result.value.receiptLinks.receiptLinks).distinctBy { it.id }
                        receiptLinkManagerHasMore = result.value.receiptLinks.hasMore
                    }
                    is ApiResult.AuthExpired -> notice = result.message
                    is ApiResult.Conflict -> notice = result.message
                    is ApiResult.PermissionRejected -> notice = result.message
                    is ApiResult.Rejected -> notice = result.message
                    is ApiResult.Retryable -> notice = "No se pudieron cargar enlaces anteriores: ${result.message}"
                }
            } catch (error: Exception) {
                notice = "No se pudieron cargar enlaces anteriores: ${error.message ?: "error de conexión"}."
            } finally { receiptLinkManagerBusy = false }
        }
    }

    suspend fun openWhatsApp(offer: WhatsAppOffer): Boolean {
        val current = session
        if (current == null || current.accountKey != offer.accountKey ||
            current.selectedBranchId != offer.branchId) {
            notice = "La cuenta o sucursal cambió. Abre de nuevo el comprobante."
            return false
        }
        if (offer.phone != null) {
            val owner = if (offer.branchId != null && offer.customerId != null)
                app.database.localDao().customer(current.accountKey, offer.branchId, offer.customerId) else null
            if (owner == null || app.repository.savedPhones(owner).none {
                    it.normalizedPhone == offer.phone && !it.invalid
                }) {
                notice = "Este teléfono no está en el historial válido. Abre de nuevo el comprobante o elige un contacto externo."
                return false
            }
        }
        val intent = Intent(Intent.ACTION_VIEW, android.net.Uri.parse(whatsAppUrl(offer.phone, offer.message)))
        try {
            activity.startActivity(intent)
        } catch (_: android.content.ActivityNotFoundException) {
            notice = "No hay WhatsApp ni navegador para abrir el mensaje."
            return false
        } catch (_: SecurityException) {
            notice = "Android no permitió abrir WhatsApp o el navegador."
            return false
        }
        val receipt = offer.receipt
        if (receipt != null && offer.customerId != null && offer.branchId != null) {
            // One queued operation counts this opening for the record (hidden) and the chosen phone.
            try {
                app.repository.recordWhatsAppReceipt(
                    current, offer.branchId, offer.customerId, offer.phone, receipt, offer.receiptDependsOn
                )
                SyncScheduler.enqueue(activity, current.accountKey, offer.branchId, expedited = online)
                rows = app.repository.portfolio(current.accountKey, offer.branchId)
                loadOperations()
                notice = "WhatsApp abierto. Apertura guardada para sincronizar; no confirma envío ni entrega."
            } catch (error: Exception) {
                notice = "WhatsApp se abrió, pero no se pudo registrar la apertura: ${error.message ?: "revisa la cola"}."
            }
        } else if (offer.phone != null && offer.customerId != null && offer.branchId != null) {
            try {
                app.repository.recordWhatsAppOpen(current, offer.branchId, offer.customerId, offer.phone)
                SyncScheduler.enqueue(activity, current.accountKey, offer.branchId, expedited = online)
                rows = app.repository.portfolio(current.accountKey, offer.branchId)
                loadOperations()
                notice = "WhatsApp abierto. Apertura guardada para sincronizar; no confirma envío ni entrega."
            } catch (error: Exception) {
                notice = "WhatsApp se abrió, pero no se pudo registrar la apertura: ${error.message ?: "revisa la cola"}."
            }
        } else {
            notice = "WhatsApp abierto para elegir contacto. No se cuenta: no podemos saber qué destinatario elegiste ni si enviaste."
        }
        return true
    }

    fun receiptMoment(raw: String?, fallbackMillis: Long?): java.time.LocalDateTime =
        (momentMillis(raw, RECEIPT_ZONE) ?: fallbackMillis)
            ?.let { java.time.Instant.ofEpochMilli(it).atZone(java.time.ZoneId.systemDefault()).toLocalDateTime() }
            ?: java.time.LocalDateTime.now()

    // Card receipt (Articulo + its cuota inicial in the same message) or abono receipt, built from
    // the cached/hydrated records. Default phone = ranked valid primary of the current customer row.
    fun receiptOffer(
        current: StoredSession, branch: String, target: ReceiptTarget, credit: com.backendcreditos.mobile.data.CreditEntity,
        owner: CustomerEntity?, payment: PaymentEntity?, initial: InitialInstallment?,
        createdAtFallback: Long?, dependsOn: String?
    ): WhatsAppOffer {
        val name = owner?.let { "${it.firstName} ${it.lastName}".trim() }.orEmpty()
        val phones = owner?.let(app.repository::savedPhones).orEmpty()
        val message = if (target.kind == ReceiptKind.PAYMENT) paymentReceiptMessage(
            name, requireNotNull(payment).amount.orEmpty(), credit.balance, collectorName(current),
            receiptMoment(payment.createdAt, createdAtFallback)
        ) else creditCreatedMessage(
            name, credit.value, credit.frequency, credit.term, credit.balance, credit.concept, collectorName(current),
            receiptMoment(credit.createdAt, createdAtFallback),
            articleDescription = credit.description.takeIf { isArticle(credit.concept) },
            initialPayment = initial?.amount, initialBankAmount = initial?.bankAmount
        )
        return WhatsAppOffer(
            title = if (target.kind == ReceiptKind.PAYMENT) "Comprobante de abono" else "Comprobante de tarjeta",
            customerName = name,
            phone = validWhatsAppPrimary(phones, owner?.phone),
            accountKey = current.accountKey, branchId = branch, customerId = owner?.id,
            phones = phones, message = message, receipt = target, receiptFormat = credit.receiptType,
            receiptDependsOn = dependsOn
        )
    }

    /**
     * Cola resend: only this branch's cards/abonos created today (business zone) that are still
     * created/entregando. Unsent ones are judged on the cache; server-confirmed ones on live data.
     * Only prepares the chooser: nothing is sent automatically.
     */
    suspend fun offerQueuedReceipt(operation: OfflineOperationEntity) {
        val current = session ?: return
        val branch = current.selectedBranchId
        if (branch == null || operation.branchId != branch || operation.accountKey != current.accountKey) {
            notice = "Cambia a la sucursal de este registro para reenviar el comprobante."
            return
        }
        val requested = receiptTargetFor(operation.kind, operation.entityId, operation.payload)
        val pending = operation.status in setOf(OperationStatus.PENDING, OperationStatus.IN_FLIGHT)
        if (requested == null || (!pending && operation.status != OperationStatus.CONFIRMED)) {
            notice = "Este registro no tiene comprobante para reenviar."
            return
        }
        if (!pending && !online) {
            notice = "Conéctate: hay que revisar en el servidor el estado actual antes de reenviar."
            return
        }
        val dao = app.database.localDao()
        val cachedPayment = if (requested.kind == ReceiptKind.PAYMENT)
            dao.payment(current.accountKey, branch, requested.recordId) else null
        val creditId = receiptCreditIdFor(operation.kind, operation.entityId, requested, cachedPayment?.creditId) ?: run {
            notice = "Abre la tarjeta de este abono para cargarlo y vuelve a intentarlo."
            return
        }
        var credit = dao.credit(current.accountKey, branch, creditId)
        var owner = credit?.let { dao.customer(current.accountKey, branch, it.customerId) }
        var payment = cachedPayment
        val history: List<PaymentEntity>
        if (pending) {
            history = dao.payments(current.accountKey, branch, creditId)
        } else {
            val customerId = credit?.customerId ?: payloadText(operation.payload, "idcliente") ?: run {
                notice = "Abre la tarjeta para cargarla y vuelve a intentarlo."
                return
            }
            when (val live = app.repository.refreshReceiptRecord(
                current, branch, customerId, creditId, requested.recordId.takeIf { requested.kind == ReceiptKind.PAYMENT }
            )) {
                is ApiResult.Success -> {
                    val record = live.value ?: run {
                        notice = "El servidor ya no tiene este registro para este cliente y sucursal. No se reenvía."
                        return
                    }
                    credit = record.credit
                    owner = record.customer
                    payment = record.payment
                    history = record.payments
                    rows = app.repository.portfolio(current.accountKey, branch)
                }
                is ApiResult.AuthExpired -> { notice = live.message; return }
                is ApiResult.Conflict -> { notice = live.message; return }
                is ApiResult.PermissionRejected -> { notice = live.message; return }
                is ApiResult.Rejected -> { notice = live.message; return }
                is ApiResult.Retryable -> { notice = "No se pudo revisar el estado actual: ${live.message}"; return }
            }
        }
        val card = credit ?: run {
            notice = "La tarjeta no está guardada en este teléfono. Abre el cliente y vuelve a intentarlo."
            return
        }
        var target = requested
        var receiptPayment = payment
        // The cuota inicial belongs to the Articulo receipt: it is never sent as a separate abono.
        if (target.kind == ReceiptKind.PAYMENT && isInitialInstallment(receiptPayment?.description)) {
            target = ReceiptTarget(ReceiptKind.CREDIT, card.id)
            receiptPayment = null
        }
        if (target.kind == ReceiptKind.PAYMENT && receiptPayment == null) {
            notice = "El abono no está guardado en este teléfono. Abre la tarjeta y vuelve a intentarlo."
            return
        }
        // Unsent creations have no server createdAt yet: the queue moment is their creation time.
        val fallback = operation.createdAt.takeIf {
            pending && target == requested && operation.kind in setOf(OperationKind.CREATE_CREDIT, OperationKind.CREATE_PAYMENT)
        }
        val eligible = if (target.kind == ReceiptKind.PAYMENT)
            receiptEligible(receiptPayment?.state, receiptPayment?.createdAt ?: fallback?.toString())
        else receiptEligible(card.status, card.createdAt ?: fallback?.toString())
        if (!eligible) {
            notice = "Solo se reenvían comprobantes de tarjetas y abonos creados hoy que siguen en estado creado o entregando."
            return
        }
        val initialRow = history.firstOrNull { it.creditId == card.id && isInitialInstallment(it.description) }
        val initial = if (target.kind != ReceiptKind.CREDIT) null else initialRow?.amount?.toBigDecimalOrNull()?.abs()
            ?.takeIf { it.signum() > 0 }?.let { amount ->
                InitialInstallment(amount.toPlainString(), initialRow.bankAmount?.takeIf {
                    (it.toBigDecimalOrNull()?.signum() ?: 0) > 0
                } ?: if (operation.kind == OperationKind.CREATE_CREDIT) initialInstallmentFromPayload(operation.payload)?.bankAmount else null)
            } ?: if (pending && operation.kind == OperationKind.CREATE_CREDIT) initialInstallmentFromPayload(operation.payload) else null
        val dependency = operation.operationId.takeIf { pending && target == requested }
        whatsAppOffer = receiptOffer(current, branch, target, card, owner, receiptPayment, initial, fallback, dependency)
    }

    suspend fun saveTypedOperation(stayOnPortfolio: Boolean = false): OfflineOperationEntity {
        require(!serviceBlocked) { "Servicio no disponible: no hemos registrado el pago." }
        var current = session ?: throw IllegalArgumentException("Inicia sesión para guardar cambios.")
        val branch = current.selectedBranchId ?: throw IllegalArgumentException("Selecciona una sucursal.")
        if (operationKind == OperationKind.CREATE_CUSTOMER) {
            require(creditOnline && customerLookupVerified &&
                draftDocumentType == documentType && draftDocumentNumber == documentNumber) {
                "Busca primero el documento en línea antes de crear el cliente."
            }
            when (val identity = app.api.me(current.token)) {
                is ApiResult.Success -> {
                    val user = identity.value.me
                        ?: throw IllegalArgumentException("No se pudo verificar el empleado. Inicia sesión de nuevo.")
                    current = current.copy(
                        employeeMaxCredit = user.employeeMaxCredit?.toString(),
                        isSuperAdministrator = user.isSuperAdministrator
                    )
                    session = current
                    app.vault.saveSession(current)
                }
                else -> {
                    report(identity)
                    throw IllegalArgumentException("No se pudo comprobar tu cupo actual en línea. ${notice}")
                }
            }
            val approved = draftMaxCredit.toBigDecimalOrNull()
                ?: throw IllegalArgumentException("Ingresa un máximo cupo válido.")
            require(approved >= java.math.BigDecimal.ZERO) { "El máximo cupo no puede ser negativo." }
            if (!current.isSuperAdministrator) {
                val maximum = current.employeeMaxCredit?.toBigDecimalOrNull()
                    ?: throw IllegalArgumentException("No se conoce el cupo autorizado del empleado. Inicia sesión en línea.")
                require(approved <= maximum) { "El cupo aprobado supera el máximo autorizado: $maximum." }
            }
        }
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
        if (operationKind == OperationKind.CREATE_CREDIT || operationKind == OperationKind.UPDATE_CREDIT) {
            val cost = if (operationKind == OperationKind.CREATE_CREDIT) draftCost else draftPrincipal
            val isSuperAdministrator = session?.isSuperAdministrator == true
            require(creditPricingAllowed(draftValue, cost, isSuperAdministrator)) {
                if (isSuperAdministrator) "El valor total no puede ser menor que el costo."
                else "La ganancia mínima debe ser 20% del costo."
            }
        }
        if (operationKind == OperationKind.CREATE_CREDIT || operationKind == OperationKind.UPDATE_CREDIT) {
            val allowed = creditPricingAllowed(
                draftValue,
                if (operationKind == OperationKind.CREATE_CREDIT) draftCost else draftPrincipal,
                session?.isSuperAdministrator == true,
            )
            require(allowed) {
                if (session?.isSuperAdministrator == true) "El valor total no puede ser menor que el costo."
                else "Mínimo 20% de ganancia."
            }
        }
        if (operationKind == OperationKind.CREATE_CREDIT) {
            require(canOpenCreditForm(creditOnline, assessmentLoading, assessmentComplete) &&
                assessmentCreditId == selectedCreditId) {
                "Para crear una tarjeta consulta primero todo el historial del cliente en línea."
            }
            when (val connectivity = app.api.me(current.token)) {
                is ApiResult.Success -> require(connectivity.value.me != null) {
                    "No se pudo verificar tu sesión para crear la tarjeta."
                }
                else -> {
                    report(connectivity)
                    throw IllegalArgumentException("No se pudo verificar la conexión con el servidor. ${notice}")
                }
            }
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
                if (draftInitialPayment.toBigDecimal() > java.math.BigDecimal.ZERO) {
                    draftInitialPaymentMethod.requireInitialPaymentSource(bankAccounts)
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
            draftPaymentMethod.requireCreditFunding(bankAccounts)
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
            require(origin != null &&
                (origin.credit.customerId == draftCustomerId ||
                    (lookupAnchorId == selectedCreditId && pointedCreditId == selectedCreditId &&
                        lookupCustomer?.id?.toString() == draftCustomerId))) {
                "La tarjeta «Aquí vas» cambió o no corresponde a la búsqueda. Busca de nuevo."
            }
            val cachedRoute = app.database.localDao().portfolio(current.accountKey, branch)
                .sortedWith(compareBy<com.backendcreditos.mobile.data.CreditEntity> { it.sortOrder }.thenBy { it.id })
            val index = cachedRoute.indexOfFirst { it.id == selectedCreditId }
            require(index >= 0) { "La tarjeta «Aquí vas» ya no está en la ruta guardada; sincroniza." }
            val ordered = cachedRoute.map {
                it.sortOrder ?: throw IllegalArgumentException("Hay tarjetas sin posición; sincroniza la cartera.")
            }
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
        if (operationKind in setOf(OperationKind.CREATE_CUSTOMER, OperationKind.UPDATE_CUSTOMER) &&
            draftPhone.isNotBlank() && draftPhone != customer?.phone) {
            draftPhone = requireNotNull(whatsAppPhone(draftPhone)) {
                "Ingresa un solo celular colombiano de 10 dígitos que empiece en 3, o un número internacional válido."
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
                selectedCreditId, if (draftCardPlacement == CardPlacement.BEFORE) "antes" else "despues",
                draftPaymentMethod.splits(draftPrincipal),
                if (draftConcept == "Articulo" && draftInitialPayment.toBigDecimal() > java.math.BigDecimal.ZERO)
                    draftInitialPaymentMethod.splits(draftInitialPayment) else emptyList()
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
                UUID.randomUUID().toString(), draftPaymentAmount, draftPaymentDescription,
                draftPaymentMethod.splits(draftPaymentAmount), draftPaymentMethod.changeConfirmed
            )
            OperationKind.UPDATE_PAYMENT -> OperationPayloadMapper.updatePayment(
                entityId, draftPaymentAmount, draftPaymentDescription,
                draftPaymentMethod.splits(draftPaymentAmount).takeIf { draftPaymentMethod.edited },
                draftPaymentMethod.changeConfirmed
            )
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
            OperationKind.ADD_CUSTOMER_PHONE, OperationKind.SELECT_CUSTOMER_PHONE, OperationKind.SET_CUSTOMER_PHONE_VALIDITY, OperationKind.RECORD_WHATSAPP_OPEN,
            OperationKind.RECORD_WHATSAPP_RECEIPT, OperationKind.UPDATE_DOCUMENT, OperationKind.CREATE_EXPENSE, OperationKind.UPDATE_EXPENSE,
            OperationKind.DELETE_EXPENSE, OperationKind.CREATE_BASE, OperationKind.UPDATE_BASE,
            OperationKind.DELETE_BASE, OperationKind.CREATE_LOCATION, OperationKind.DELETE_LOCATION ->
                throw IllegalArgumentException("Operación no disponible.")
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
                .joinToString(" ").ifBlank { current.username }
                .takeIf { operationKind in setOf(OperationKind.CREATE_PAYMENT, OperationKind.CREATE_CREDIT) },
            creatorUserId = current.userId.takeIf {
                operationKind in setOf(OperationKind.CREATE_PAYMENT, OperationKind.CREATE_CREDIT)
            }
        )
        if (operationKind == OperationKind.CREATE_PAYMENT) {
            val dao = app.database.localDao()
            val creditId = operation.entityId
            dao.credit(current.accountKey, branch, creditId)?.let { updated ->
                rows = rows.map { row ->
                    if (row.credit.id == creditId) row.copy(credit = updated) else row
                }
            }
            branchPayments = branchPayments.filterNot { it.creditId == creditId } +
                dao.payments(current.accountKey, branch, creditId)
            paymentRows = dao.payments(current.accountKey, branch, creditId)
            operationRows = operationRows + operation
            if (whatsAppOfferEnabled) {
                val credit = dao.credit(current.accountKey, branch, creditId)
                val owner = credit?.let { c ->
                    dao.customer(current.accountKey, branch, c.customerId)
                }
                val name = owner?.let { "${it.firstName} ${it.lastName}".trim() }.orEmpty()
                whatsAppOffer = WhatsAppOffer(
                    title = "Comprobante de abono",
                    customerName = name,
                    phone = validWhatsAppPrimary(owner?.let(app.repository::savedPhones).orEmpty(), owner?.phone),
                    accountKey = current.accountKey, branchId = branch, customerId = owner?.id,
                    phones = owner?.let(app.repository::savedPhones).orEmpty(),
                    message = paymentReceiptMessage(name, draftPaymentAmount, credit?.balance, collectorName(current)),
                    receipt = receiptTargetFor(operation.kind, operation.entityId, operation.payload),
                    receiptDependsOn = operation.operationId
                )
            }
        } else if (operationKind == OperationKind.CREATE_CREDIT) {
            val dao = app.database.localDao()
            dao.credit(current.accountKey, branch, operation.entityId)?.let { newCredit ->
                val owner = dao.customer(current.accountKey, branch, newCredit.customerId)
                rows = (rows.filterNot { it.credit.id == newCredit.id } + PortfolioRow(newCredit, owner))
                    .sortedWith(compareBy<PortfolioRow> { it.credit.sortOrder }.thenBy { it.credit.id })
                val target = receiptTargetFor(operation.kind, operation.entityId, operation.payload)
                if (whatsAppOfferEnabled && target != null) {
                    // Same builder as the Cola resend: an Articulo carries its cuota inicial inside.
                    whatsAppOffer = receiptOffer(
                        current, branch, target, newCredit, owner, null,
                        initialInstallmentFromPayload(operation.payload), operation.createdAt, operation.operationId
                    ).copy(title = "Crédito registrado")
                }
            }
            operationRows = operationRows + operation
        } else {
            loadLocal()
            loadOperations()
        }
        submitAndAwaitConfirmation(operation, branch, current, stayOnPortfolio)
        return operation
    }

    suspend fun synchronizeNow() {
        if (refreshingPortfolio || busy) return
        val current = session ?: return
        val branch = current.selectedBranchId ?: return
        refreshingPortfolio = true
        busy = true
        try {
            SyncScheduler.enqueue(activity, current.accountKey, branch, expedited = deviceConnected)
            if (!deviceConnected) {
                notice = "Sin conexión; pendientes conservados. Se enviarán al recuperar señal."
                return
            }
            when (val result = app.repository.pullChanges(current, branch)) {
                is ApiResult.Success -> {
                    refreshRouteCash()
                    notice = "Cambios recibidos. Envío de pendientes solicitado; revisa la cola."
                }
                else -> report(result)
            }
            loadLocal()
            loadOperations()
        } finally {
            busy = false
            refreshingPortfolio = false
        }
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
            creditLocationRows = emptyList()
            operationRows = emptyList()
            syncControl = null
            activityLogRows = emptyList()
            routeCash = null
            bankAccounts = emptyList()
            password = ""
            pointedCreditId = null
            pointerArmed = false
            restorePointerScroll = false
            inlinePaymentCreditId = null
            watchedPaymentOperationIds = emptySet()
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
        draftPaymentMethod = PaymentMethodDraft()
        draftInitialPaymentMethod = PaymentMethodDraft()
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
            // The reference is always the pointed portfolio card, even for a different customer.
            val origin = rows.firstOrNull { it.credit.id == sourceCreditId }
            if (origin != null) {
                draftCustomerId = lookupCustomer?.takeIf { lookupAnchorId == sourceCreditId }
                    ?.id?.toString() ?: origin.credit.customerId
                if (lookupCustomer == null) customer = origin.customer
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
    val portfolioListState = rememberLazyListState()
    val otherScreensScrollState = rememberScrollState()

    // Hoisted out of the HOME branch because the bottom bar arrows and counter act on the
    // same visible list the user sees, filter included.
    val visibleRows = remember(rows, search) { rows.filter { row ->
        val name = "${row.customer?.firstName.orEmpty()} ${row.customer?.lastName.orEmpty()} " +
            "${row.customer?.documentNumber.orEmpty()} ${row.credit.additionalNumber.orEmpty()}"
        name.contains(search, ignoreCase = true)
    } }
    val paymentsByCredit = remember(branchPayments) { branchPayments.groupBy { it.creditId } }
    val routeSummary = remember(rows, branchPayments) { routeTotals(rows.map { it.credit }, branchPayments) }
    val operationsByEntity = remember(operationRows) { operationRows.groupBy { it.entityId } }
    val visibleCreditIds = visibleRows.map { it.credit.id }
    val pointerIndex = pointerPosition(pointedCreditId, visibleCreditIds)
    val unresolvedBadge = operationRows.count {
        it.status in setOf(
            OperationStatus.PENDING, OperationStatus.IN_FLIGHT,
            OperationStatus.CONFLICT, OperationStatus.REJECTED
        )
    }
    LaunchedEffect(watchedPaymentOperationIds, account?.accountKey, branchId) {
        if (watchedPaymentOperationIds.isEmpty()) return@LaunchedEffect
        val current = account ?: return@LaunchedEffect
        val branch = branchId ?: return@LaunchedEffect
        while (true) {
            if (watchedPaymentOperationIds.isEmpty()) break
            delay(if (deviceConnected) 1_500 else 5_000)
            if (!deviceConnected) continue
            val completed = mutableSetOf<String>()
            val messages = mutableListOf<String>()
            var failed = 0
            val watched = watchedPaymentOperationIds
            val dao = app.database.localDao()
            val trackedOperations = buildList {
                for (ids in watched.toList().chunked(400)) addAll(dao.operationsByIds(ids))
            }
            val removed = watched - trackedOperations.mapTo(mutableSetOf()) { it.operationId }
            for (latest in trackedOperations) {
                if (latest.status !in setOf(OperationStatus.CONFIRMED, OperationStatus.CONFLICT, OperationStatus.REJECTED)) {
                    continue
                }
                if (session?.accountKey != current.accountKey || session?.selectedBranchId != branch) return@LaunchedEffect
                operationRows = operationRows.filterNot { it.operationId == latest.operationId } + latest
                dao.credit(current.accountKey, branch, latest.entityId)?.let { updated ->
                    rows = rows.map { row ->
                        if (row.credit.id == updated.id) row.copy(credit = updated) else row
                    }
                }
                branchPayments = branchPayments.filterNot { it.creditId == latest.entityId } +
                    dao.payments(current.accountKey, branch, latest.entityId)
                completed.add(latest.operationId)
                val message = when (latest.status) {
                    OperationStatus.CONFIRMED -> "Abono confirmado por el servidor."
                    OperationStatus.CONFLICT -> "Conflicto en el abono: ${friendlyServerError(latest.lastError)}. Revisa la Cola."
                    else -> "Abono rechazado: ${rejectionDetail(latest)}. Revisa la Cola."
                }
                if (latest.status != OperationStatus.CONFIRMED) failed++
                messages.add(message)
            }
            if (completed.isNotEmpty() || removed.isNotEmpty()) {
                watchedPaymentOperationIds -= completed + removed
            }
            if (removed.isNotEmpty()) {
                if (session?.accountKey != current.accountKey || session?.selectedBranchId != branch) return@LaunchedEffect
                loadLocal()
                scope.launch {
                    snackbarHostState.showSnackbar(
                        if (removed.size == 1) "Un abono salió de la cola sin registrarse. Mira el motivo en Actividad."
                        else "${removed.size} abonos salieron de la cola sin registrarse. Mira el motivo en Actividad.",
                        duration = SnackbarDuration.Long
                    )
                }
            }
            if (completed.isNotEmpty()) {
                val message = if (messages.size == 1) messages.single()
                    else "${messages.size - failed} abonos confirmados; $failed con problemas. Revisa la Cola."
                scope.launch {
                    if (failed > 0) session?.let { app.repository.log(it.accountKey, message, problem = true) }
                    val result = snackbarHostState.showSnackbar(
                        message,
                        actionLabel = if (failed > 0) "Ver Cola" else null,
                        duration = if (failed > 0) SnackbarDuration.Long else SnackbarDuration.Short
                    )
                    if (result == SnackbarResult.ActionPerformed) {
                        loadOperations()
                        queueTab = 0
                        screen = Screen.QUEUE
                    }
                }
            }
        }
    }

    LaunchedEffect(screen) {
        if (screen != Screen.HOME && pointedCreditId != null) restorePointerScroll = true
    }
    LaunchedEffect(rows) {
        val currentCreditIds = rows.map { it.credit.id }
        val selection = keepSelection(pointedCreditId, previousPortfolioCreditIds, currentCreditIds)
        if (selection != null && selection != pointedCreditId) pointerArmed = true
        pointedCreditId = selection
        if (currentCreditIds.isNotEmpty()) previousPortfolioCreditIds = currentCreditIds
    }

    // Notices used to sit as red text above every screen, eating space. They are now a brief
    // snackbar and are kept in Cola › Logs so the collector can read them later.
    LaunchedEffect(notice) {
        val message = notice
        if (message.isBlank()) return@LaunchedEffect
        notice = ""
        val current = session
        val problem = isProblemNotice(message)
        scope.launch {
            current?.let { app.repository.log(it.accountKey, message, problem) }
            val result = snackbarHostState.showSnackbar(
                message,
                actionLabel = if (current?.selectedBranchId != null) "Logs" else null,
                withDismissAction = true,
                duration = if (problem) SnackbarDuration.Long else SnackbarDuration.Short
            )
            if (result == SnackbarResult.ActionPerformed) {
                loadOperations()
                queueTab = 1
                screen = Screen.QUEUE
            }
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            val branchChosen = !serviceBlocked && account != null && branchId != null &&
                screen !in setOf(Screen.LOGIN, Screen.BRANCHES)
            TopAppBar(
                title = {
                    if (!branchChosen) {
                        Text("Créditos")
                    } else {
                        // Branch type/code come from str_tipo/str_codigo (BranchDto.type/name);
                        // the raw idsucursal is only a fallback until the branch list loads.
                        val selectedBranch = branchList.find { it.id == branchId }
                        val status = connectionStatus(
                            authExpired = syncControl?.pauseReason == "AUTH",
                            online = online,
                            autoSync = syncAutoEnabled && syncControl?.paused != true
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                Modifier
                                    .size(14.dp)
                                    .background(status.color, CircleShape)
                                    .clickable(onClickLabel = "Abrir sincronización") {
                                        settingsReturnScreen = screen
                                        screen = Screen.SYNC_SETTINGS
                                    }
                                    .semantics { contentDescription = status.description }
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(
                                listOfNotNull(
                                    account?.username,
                                    selectedBranch?.type,
                                    selectedBranch?.name ?: branchId
                                ).joinToString(" · "),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
            )
        },
        bottomBar = {
            if (!serviceBlocked && account != null && branchId != null && screen !in setOf(Screen.LOGIN, Screen.BRANCHES)) {
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
                        IconButton(onClick = {
                            scope.launch {
                                busy = true
                                loadOperations()
                                loadSettlement()
                                busy = false
                                screen = Screen.SETTLEMENT
                            }
                        }) {
                            Icon(
                                painterResource(R.drawable.ic_daily_accounting),
                                contentDescription = "Abrir Cuentas del día"
                            )
                        }
                        IconButton(
                            onClick = { pointedCreditId?.let(::openFullPayments) },
                            enabled = pointedCreditId != null
                        ) {
                            Icon(
                                painterResource(R.drawable.ic_payment_history),
                                contentDescription = "Abrir Abonos e historial completo"
                            )
                        }
                        BadgedBox(badge = {
                            if (unresolvedBadge > 0) Badge { Text(unresolvedBadge.toString()) }
                        }) {
                            IconButton(onClick = {
                                scope.launch {
                                    loadOperations()
                                    queueTab = 0; screen = Screen.QUEUE
                                }
                            }) {
                                Icon(painterResource(R.drawable.ic_queue_transfers), contentDescription = "Abrir Cola")
                            }
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
                            val systemBarPadding = WindowInsets.statusBars.asPaddingValues().calculateTopPadding() +
                                WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
                            val maxMenuHeight = (LocalConfiguration.current.screenHeightDp.dp -
                                systemBarPadding - 32.dp).coerceAtLeast(200.dp)
                            BadgedBox(badge = {
                                if (unresolvedBadge > 0) Badge { Text(unresolvedBadge.toString()) }
                            }) {
                                IconButton(onClick = { showMoreMenu = true }) {
                                    Icon(Icons.Filled.MoreVert, contentDescription = "Más opciones")
                                }
                            }
                            DropdownMenu(
                                expanded = showMoreMenu,
                                onDismissRequest = { showMoreMenu = false },
                                modifier = Modifier.heightIn(max = maxMenuHeight),
                                shape = RoundedCornerShape(24.dp),
                                containerColor = lerp(
                                    MaterialTheme.colorScheme.surface,
                                    MaterialTheme.colorScheme.surfaceVariant,
                                    0.6f
                                ),
                                border = BorderStroke(
                                    1.dp,
                                    MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.65f)
                                )
                            ) {
                                // Card actions live here too, so the payments screen keeps only the
                                // button you press every day and the rest act on the open card.
                                if (screen == Screen.CREDIT && selectedCreditId != null) {
                                    if ("nueva tarjeta" in branchPermissionSet || branchPermissionSet.isEmpty()) {
                                        DropdownMenuItem(
                                            text = { Text("Crear otra tarjeta a este cliente") },
                                            leadingIcon = { MenuIcon(R.drawable.ic_menu_credit_add) },
                                            onClick = {
                                                showMoreMenu = false
                                                selectedCreditId?.let(::assessCard)
                                            }
                                        )
                                        MenuSectionDivider()
                                    }
                                    DropdownMenuItem(
                                        text = { Text("Editar crédito") },
                                        leadingIcon = { MenuIcon(R.drawable.ic_menu_edit) },
                                        onClick = {
                                            showMoreMenu = false
                                            prepareComposer(OperationKind.UPDATE_CREDIT, selectedCreditId.orEmpty())
                                        }
                                    )
                                    DropdownMenuItem(
                                        text = { Text("Cambiar estado") },
                                        leadingIcon = { MenuIcon(R.drawable.ic_menu_status) },
                                        onClick = {
                                            showMoreMenu = false
                                            prepareComposer(OperationKind.CHANGE_CREDIT_STATUS, selectedCreditId.orEmpty())
                                        }
                                    )
                                    DropdownMenuItem(
                                        text = { Text("Reordenar") },
                                        leadingIcon = { MenuIcon(R.drawable.ic_menu_reorder) },
                                        onClick = {
                                            showMoreMenu = false
                                            prepareComposer(OperationKind.REORDER_CREDIT, selectedCreditId.orEmpty())
                                        }
                                    )
                                    DropdownMenuItem(
                                        text = { Text("Aplicar descuento") },
                                        leadingIcon = { MenuIcon(R.drawable.ic_menu_money) },
                                        onClick = {
                                            showMoreMenu = false
                                            prepareComposer(OperationKind.APPLY_DISCOUNT, selectedCreditId.orEmpty())
                                        }
                                    )
                                    DropdownMenuItem(
                                        text = { Text("Agregar interés") },
                                        leadingIcon = { MenuIcon(R.drawable.ic_menu_money) },
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
                                        leadingIcon = { MenuIcon(R.drawable.ic_menu_refresh) },
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
                                        leadingIcon = { MenuIcon(R.drawable.ic_menu_delete) },
                                        // The server refuses to delete a credit that left the
                                        // 'created' state or that already has settled payments.
                                        enabled = rows.firstOrNull { it.credit.id == selectedCreditId }
                                            ?.credit?.status == "created",
                                        onClick = {
                                            showMoreMenu = false
                                            prepareComposer(OperationKind.DELETE_CREDIT, selectedCreditId.orEmpty())
                                        }
                                    )
                                    MenuSectionDivider()
                                }
                                DropdownMenuItem(
                                    text = {
                                        Text(if (unresolvedBadge > 0) "Cola ($unresolvedBadge sin resolver)" else "Cola")
                                    },
                                    leadingIcon = { MenuIcon(R.drawable.ic_queue_transfers) },
                                    onClick = {
                                        showMoreMenu = false
                                        scope.launch { loadOperations(); queueTab = 0; screen = Screen.QUEUE }
                                    }
                                )
                                MenuSectionDivider()
                                DropdownMenuItem(
                                    text = { Text("Crear cliente") },
                                    leadingIcon = { MenuIcon(R.drawable.ic_menu_person_add) },
                                    onClick = {
                                        showMoreMenu = false
                                        openCustomerLookup()
                                    }
                                )
                                if (screen == Screen.HOME) DropdownMenuItem(
                                    text = { Text("Abonos e historial completo") },
                                    leadingIcon = { MenuIcon(R.drawable.ic_payment_history) },
                                    enabled = pointedCreditId != null,
                                    onClick = { showMoreMenu = false; pointedCreditId?.let(::openFullPayments) }
                                )
                                DropdownMenuItem(
                                    text = { Text("Crear crédito") },
                                    leadingIcon = { MenuIcon(R.drawable.ic_menu_credit_add) },
                                    enabled = creditOnline && pointedCreditId != null,
                                    onClick = { showMoreMenu = false; pointedCreditId?.let(::assessCard) }
                                )
                                if (online) DropdownMenuItem(
                                    text = { Text("Actualizar cartera") },
                                    leadingIcon = { MenuIcon(R.drawable.ic_menu_refresh) },
                                    onClick = {
                                        showMoreMenu = false
                                        scope.launch {
                                            val current = session ?: return@launch
                                            val branch = current.selectedBranchId ?: return@launch
                                            busy = true
                                            when (val result = app.repository.syncPortfolio(current, branch)) {
                                                is ApiResult.Success -> {
                                                    online = true
                                                    app.repository.pullChanges(current, branch)
                                                    loadLocal()
                                                    refreshRouteCash()
                                                    notice = "Cartera actualizada."
                                                }
                                                else -> report(result)
                                            }
                                            busy = false
                                        }
                                    }
                                )
                                DropdownMenuItem(
                                    text = { Text("Gastos y bases") },
                                    leadingIcon = { MenuIcon(R.drawable.ic_menu_money) },
                                    onClick = {
                                        showMoreMenu = false
                                        scope.launch {
                                            busy = true
                                            routeEntryDraft = RouteEntryDraft()
                                            loadRouteEntries(true)
                                            busy = false
                                            screen = Screen.ROUTE_ENTRIES
                                        }
                                    }
                                )
                                if (online) DropdownMenuItem(
                                    text = { Text("Cuentas del día") },
                                    leadingIcon = { MenuIcon(R.drawable.ic_daily_accounting) },
                                    onClick = {
                                        showMoreMenu = false
                                        scope.launch {
                                            busy = true
                                            loadOperations()
                                            loadSettlement()
                                            busy = false
                                            screen = Screen.SETTLEMENT
                                        }
                                    }
                                )
                                if (online && branchPermissionSet.isNotEmpty()) {
                                    MenuSectionDivider()
                                    if ("ver morosos" in branchPermissionSet) DropdownMenuItem(
                                        text = { Text("Morosos") },
                                        leadingIcon = { MenuIcon(R.drawable.ic_menu_people) },
                                        onClick = {
                                            showMoreMenu = false
                                            scope.launch { busy = true; loadDefaulters(); busy = false; screen = Screen.DEFAULTERS }
                                        }
                                    )
                                    if ("ver retirados" in branchPermissionSet) DropdownMenuItem(
                                        text = { Text("Retirados") },
                                        leadingIcon = { MenuIcon(R.drawable.ic_menu_people) },
                                        onClick = {
                                            showMoreMenu = false
                                            scope.launch { busy = true; loadWithdrawn(); busy = false; screen = Screen.WITHDRAWN }
                                        }
                                    )
                                    if ("ver canceladas" in branchPermissionSet) DropdownMenuItem(
                                        text = { Text("Canceladas") },
                                        leadingIcon = { MenuIcon(R.drawable.ic_menu_status) },
                                        onClick = { showMoreMenu = false; screen = Screen.CANCELLED }
                                    )
                                    if ("ver clientes" in branchPermissionSet) DropdownMenuItem(
                                        text = { Text("Clientes de cartera") },
                                        leadingIcon = { MenuIcon(R.drawable.ic_menu_people) },
                                        onClick = {
                                            showMoreMenu = false
                                            scope.launch { busy = true; loadPortfolioClients(); busy = false; screen = Screen.PORTFOLIO_CLIENTS }
                                        }
                                    )
                                }
                                MenuSectionDivider()
                                if (online && branchList.size > 1) DropdownMenuItem(
                                    text = { Text("Cambiar sucursal") },
                                    leadingIcon = { MenuIcon(R.drawable.ic_menu_branch) },
                                    onClick = { showMoreMenu = false; screen = Screen.BRANCHES }
                                )
                                DropdownMenuItem(
                                    text = { Text("Configuración") },
                                    leadingIcon = { MenuIcon(R.drawable.ic_menu_settings) },
                                    onClick = {
                                        showMoreMenu = false
                                        settingsReturnScreen = screen
                                        screen = Screen.SYNC_SETTINGS
                                    }
                                )
                                DropdownMenuItem(
                                    text = { Text("Cerrar sesión") },
                                    leadingIcon = { MenuIcon(R.drawable.ic_menu_logout) },
                                    onClick = {
                                        showMoreMenu = false
                                        scope.launch {
                                            pendingLogoutCount = app.repository.unresolvedCount(account.accountKey)
                                            if (pendingLogoutCount > 0) showLogoutConfirmation = true else logout()
                                        }
                                    }
                                )
                                Spacer(Modifier.height(16.dp))
                            }
                        }
                    }
                }
            }
        }
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).padding(16.dp)
                .then(if (screen == Screen.HOME && !serviceBlocked) Modifier else Modifier.verticalScroll(otherScreensScrollState)),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (!serviceBlocked && account != null && branchId != null && screen !in setOf(Screen.LOGIN, Screen.BRANCHES)) {
                val totals = routeSummary
                val cash = pocketCash(totals, routeCash?.base, routeCash?.otherIncome, routeCash?.expenses)
                Text(
                    if (expandedCashSummary) {
                        "BASE: ${formatCompactMoney(cash.base)}" +
                            "\n+ RECAUDO EN EFECTIVO: ${formatCompactMoney(cash.cashCollected)}" +
                            "\n+ OTROS INGRESOS: ${formatCompactMoney(cash.otherIncome)}" +
                            "\n− COSTO DE CRÉDITOS EN EFECTIVO: ${formatCompactMoney(cash.cashCredits)}" +
                            "\n− GASTOS EN EFECTIVO: ${formatCompactMoney(cash.expenses)}" +
                            "\n= EFECTIVO DISPONIBLE: ${formatCompactMoney(cash.total)}" +
                            "\nBANCO: RECIBIDO ${formatCompactMoney(cash.bankIn)} − ENTREGADO ${formatCompactMoney(cash.bankOut)}" +
                            "\nTARJETAS CON ABONO: ${totals.cardsWithPayments}/${totals.totalCards}" +
                            (if (routeCash == null) "\nSIN DATOS DE BASE/GASTOS" else "")
                    } else {
                        "B ${formatCompactMoney(cash.base)} + Ef ${formatCompactMoney(cash.cashCollected)}" +
                            " + O ${formatCompactMoney(cash.otherIncome)} − C ${formatCompactMoney(cash.cashCredits)}" +
                            " − G ${formatCompactMoney(cash.expenses)} = ${formatCompactMoney(cash.total)}" +
                            "\nBco: +${formatCompactMoney(cash.bankIn)} −${formatCompactMoney(cash.bankOut)}" +
                            " · Abs: ${totals.cardsWithPayments}/${totals.totalCards}" +
                            (if (routeCash == null) " · sin base/gastos" else "")
                    },
                    style = if (expandedCashSummary) MaterialTheme.typography.bodyMedium else MaterialTheme.typography.bodySmall,
                    fontWeight = if (expandedCashSummary) FontWeight.Bold else FontWeight.Normal,
                    modifier = Modifier.fillMaxWidth().clickable(
                        onClickLabel = if (expandedCashSummary) "Abreviar resumen" else "Explicar resumen"
                    ) { expandedCashSummary = !expandedCashSummary }.semantics {
                        contentDescription = "Abonos ${totals.cardsWithPayments} de ${totals.totalCards} tarjetas, " +
                            "recaudo total ${formatCompactMoney(totals.collected)}, créditos totales ${formatCompactMoney(totals.newCredits)}. " +
                            "Caja de bolsillo ${formatCompactMoney(cash.total)}: base " +
                            "${formatCompactMoney(cash.base)}, abonos en efectivo ${formatCompactMoney(cash.cashCollected)}, otro recaudo " +
                            "${formatCompactMoney(cash.otherIncome)}, menos gastos ${formatCompactMoney(cash.expenses)} " +
                            "y créditos en efectivo ${formatCompactMoney(cash.cashCredits)}" +
                            ". Por banco: recibido ${formatCompactMoney(cash.bankIn)}, " +
                                "pagado ${formatCompactMoney(cash.bankOut)}"
                    }
                )
            }
            if (serviceBlocked && screen != Screen.LOGIN) {
                Text("Servicio no disponible", style = MaterialTheme.typography.headlineSmall)
                Text(if (session?.paymentExpiresAt == -1L)
                    "Para comprobar el pago del servicio, inicia sesión en línea con esta versión de la app."
                else "No hemos registrado su pago. Este es necesario para continuar usando el servicio.")
                Button(onClick = { screen = Screen.LOGIN }) { Text("Iniciar sesión para comprobar el pago") }
                TextButton(
                    enabled = online && !receiptLinkManagerBusy,
                    onClick = { loadReceiptLinkManager() }
                ) { Text("Administrar enlaces de comprobantes") }
            } else when (screen) {
                Screen.LOGIN -> {
                    Text("Inicio de sesión en línea", style = MaterialTheme.typography.headlineSmall)
                    Text("La primera autenticación necesita conexión. La contraseña no se guarda.")
                    OutlinedTextField(company, { company = it }, label = { Text("Empresa") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(username, { username = it }, label = { Text("Usuario") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(
                        password, { password = it }, label = { Text("Contraseña") },
                        visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth()
                    )
                    val trimmedCompany = company.trim()
                    val trimmedUsername = username.trim()
                    val companyId = trimmedCompany.toIntOrNull()
                    val biometricAccountKey = if (companyId != null && companyId > 0 && trimmedUsername.isNotEmpty()) {
                        StoredSession.accountKeyFor(trimmedCompany, trimmedUsername)
                    } else null
                    val biometricReady = biometricAccountKey != null &&
                        biometricManager.hasCredential(biometricAccountKey)
                    Button(
                        enabled = !busy && company.isNotBlank() && username.isNotBlank() && password.isNotEmpty(),
                        onClick = {
                            scope.launch {
                                busy = true
                                notice = ""
                                if (companyId == null || companyId <= 0) {
                                    notice = "El ID de empresa debe ser un entero positivo."
                                    busy = false
                                    return@launch
                                }
                                when (val response = app.api.login(companyId, trimmedUsername, password)) {
                                    is ApiResult.Success -> {
                                        completeOnlineLogin(response.value.login)
                                    }
                                    is ApiResult.AuthExpired ->
                                        notice = "Empresa, usuario o contraseña incorrectos."
                                    is ApiResult.Rejected ->
                                        if (response.code == "PAYMENT_REQUIRED") notice = response.message else report(response)
                                    else -> report(response)
                                }
                                busy = false
                            }
                        }
                    ) { Text(if (busy) "Conectando…" else "Iniciar sesión") }
                    if (biometricReady) {
                        OutlinedButton(
                            enabled = !busy && deviceConnected,
                            onClick = {
                                scope.launch {
                                    busy = true
                                    notice = ""
                                    val biometricCompanyId = companyId ?: return@launch
                                    val accountKey = biometricAccountKey ?: return@launch
                                    when (val start = app.api.startBiometricLogin(biometricCompanyId, trimmedUsername, biometricDeviceId)) {
                                        is ApiResult.Success -> {
                                            val challenge = start.value.startBiometricLogin
                                            val signature = biometricManager.signChallenge(
                                                activity,
                                                accountKey,
                                                challenge.challenge,
                                                "Iniciar sesión con huella",
                                                "Confirma tu identidad para continuar"
                                            )
                                            if (signature.isFailure) {
                                                notice = signature.exceptionOrNull()?.message
                                                    ?: "No se pudo completar la validación biométrica."
                                                busy = false
                                                return@launch
                                            }
                                            when (
                                                val login = app.api.biometricLogin(
                                                    biometricCompanyId, trimmedUsername, biometricDeviceId,
                                                    challenge.challengeId, signature.getOrThrow()
                                                )
                                            ) {
                                                is ApiResult.Success -> completeOnlineLogin(login.value.login)
                                                else -> report(login)
                                            }
                                        }
                                        else -> report(start)
                                    }
                                    busy = false
                                }
                            }
                        ) { Text("Iniciar sesión con huella") }
                    }
                    TextButton(onClick = {
                        settingsReturnScreen = Screen.LOGIN
                        serverEndpoint = app.connectionSettings.endpoint()
                        serverEndpointError = null
                        screen = Screen.SYNC_SETTINGS
                    }) { Text("Configuración del servidor") }
                    if (session?.selectedBranchId != null && !serviceBlocked) {
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
                                                        branchList = branches.value.branches.map { it.toEntity() }
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
                    val offices = branchList.mapNotNull { branch ->
                        branch.officeId?.let { it to (branch.officeName?.takeIf(String::isNotBlank) ?: "Oficina $it") }
                    }.distinctBy { it.first }.sortedBy { it.second.lowercase() }
                    val activeOffice = branchOfficeFilter?.takeIf { selected -> offices.any { it.first == selected } }
                    if (offices.size > 1) {
                        Text("Oficina", style = MaterialTheme.typography.labelLarge)
                        Row(
                            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            FilterChip(
                                selected = activeOffice == null,
                                onClick = { branchOfficeFilter = null },
                                label = { Text("Todas (${branchList.size})") }
                            )
                            offices.forEach { (officeId, officeName) ->
                                FilterChip(
                                    selected = activeOffice == officeId,
                                    onClick = { branchOfficeFilter = officeId },
                                    label = { Text("$officeName (${branchList.count { it.officeId == officeId }})") }
                                )
                            }
                        }
                    }
                    branchList.filter { activeOffice == null || it.officeId == activeOffice }.forEach { branch ->
                        Card(Modifier.fillMaxWidth().clickable { selectBranch(branch) }) {
                            Column(Modifier.padding(16.dp)) {
                                Text(branch.name, style = MaterialTheme.typography.titleMedium)
                                if (activeOffice == null && offices.size > 1) branch.officeName?.let {
                                    Text(it, style = MaterialTheme.typography.labelMedium)
                                }
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
                    if (!online) Text("El desbloqueo local no autentica ni renueva credenciales del servidor.")
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (alwaysShowPortfolioSearch || showPortfolioSearch) {
                    BasicTextField(
                        value = search,
                        onValueChange = {
                            search = it
                            scope.launch { portfolioListState.scrollToItem(0) }
                            session?.selectedBranchId?.let { branch ->
                                session?.let { current ->
                                    scope.launch {
                                        customerMatches = app.repository.searchCustomers(current.accountKey, branch, it)
                                    }
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        textStyle = MaterialTheme.typography.bodyLarge.merge(
                            TextStyle(color = MaterialTheme.colorScheme.onSurface)
                        ),
                        singleLine = true,
                        decorationBox = { innerTextField ->
                            OutlinedTextFieldDefaults.DecorationBox(
                                value = search,
                                innerTextField = innerTextField,
                                enabled = true,
                                singleLine = true,
                                visualTransformation = androidx.compose.ui.text.input.VisualTransformation.None,
                                interactionSource = remember {
                                    androidx.compose.foundation.interaction.MutableInteractionSource()
                                },
                                placeholder = {
                                    Text(
                                        "Buscar...",
                                        style = MaterialTheme.typography.bodyLarge,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                },
                                contentPadding = androidx.compose.foundation.layout.PaddingValues(
                                    horizontal = 10.dp,
                                    vertical = 6.dp
                                )
                            )
                        }
                    )
                    }
                    val waitingServer = busy || watchedPaymentOperationIds.isNotEmpty()
                    val progressModifier = Modifier.fillMaxWidth()
                        .height(
                            when {
                                alwaysShowPortfolioSearch -> 4.dp
                                showPortfolioSearch -> 28.dp
                                else -> 48.dp
                            }
                        ).semantics {
                        contentDescription = if (waitingServer) "Trabajando" else
                            "Avance de la ruta: ${routeSummary.cardsWithPayments} de ${routeSummary.totalCards} tarjetas con abono"
                    }
                    Box(
                        modifier = Modifier.fillMaxWidth().clickable(
                            enabled = !alwaysShowPortfolioSearch,
                            onClickLabel = if (showPortfolioSearch) "Ocultar búsqueda" else "Buscar cliente"
                        ) {
                            showPortfolioSearch = !showPortfolioSearch
                            if (!showPortfolioSearch) {
                                search = ""
                                customerMatches = emptyList()
                            }
                        },
                        contentAlignment = Alignment.Center
                    ) {
                    if (waitingServer) {
                        LinearProgressIndicator(
                            modifier = progressModifier,
                            color = MaterialTheme.colorScheme.primary.copy(alpha = if (alwaysShowPortfolioSearch) 1f else 0.25f),
                            trackColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                    } else {
                        LinearProgressIndicator(
                            progress = {
                                if (routeSummary.totalCards == 0) 0f
                                else routeSummary.cardsWithPayments.toFloat() / routeSummary.totalCards
                            },
                            modifier = progressModifier,
                            color = MaterialTheme.colorScheme.primary.copy(alpha = if (alwaysShowPortfolioSearch) 1f else 0.25f),
                            trackColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                    }
                    if (!alwaysShowPortfolioSearch) Text(
                        if (showPortfolioSearch) "Toca para ocultar búsqueda" else "Toca para buscar cliente",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.padding(horizontal = 8.dp)
                    )
                    }
                    }
                    val filtered = visibleRows
                    LaunchedEffect(restorePointerScroll, pointedCreditId, filtered) {
                        if (restorePointerScroll) {
                            val index = filtered.indexOfFirst { it.credit.id == pointedCreditId }
                            if (index >= 0) portfolioListState.scrollToItem(index)
                            restorePointerScroll = false
                        }
                    }
                    val pullState = rememberPullToRefreshState()
                    PullToRefreshBox(
                        isRefreshing = refreshingPortfolio,
                        onRefresh = { scope.launch { synchronizeNow() } },
                        state = pullState,
                        modifier = Modifier.weight(1f),
                        indicator = {
                            Column(
                                Modifier.align(Alignment.TopCenter),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                PullToRefreshDefaults.Indicator(
                                    state = pullState,
                                    isRefreshing = refreshingPortfolio
                                )
                                if (refreshingPortfolio || pullState.distanceFraction > 0f) {
                                    Text(
                                        when {
                                            refreshingPortfolio -> "Sincronizando…"
                                            pullState.distanceFraction >= 1f -> "Suelta para sincronizar"
                                            else -> "Desliza para sincronizar"
                                        },
                                        style = MaterialTheme.typography.labelMedium,
                                        modifier = Modifier.background(MaterialTheme.colorScheme.surface)
                                            .padding(horizontal = 8.dp, vertical = 4.dp)
                                    )
                                }
                            }
                        }
                    ) {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        state = portfolioListState,
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                    if (filtered.isEmpty()) item {
                        Text("No hay resultados guardados. Sincroniza la sucursal o abre un cliente en línea.")
                    }
                    items(filtered, key = { it.credit.id }) { row ->
                        val pointed = pointedCreditId == row.credit.id
                        Card(Modifier.fillMaxWidth()
                            .then(
                                if (pointed) Modifier
                                    .border(
                                        BorderStroke(3.dp, MaterialTheme.colorScheme.primary),
                                        RoundedCornerShape(12.dp)
                                    )
                                else Modifier
                            )
                            .clickable {
                            // First tap selects; the second opens the inline payment form.
                            if (portfolioTap(pointedCreditId, row.credit.id, pointerArmed) == PortfolioTap.SELECT) {
                                pointedCreditId = row.credit.id
                                pointerArmed = true
                                inlinePaymentCreditId = null
                                return@clickable
                            }
                            selectedCreditId = row.credit.id
                            customer = row.customer
                            operationKind = OperationKind.CREATE_PAYMENT
                            draftBalance = row.credit.balance.orEmpty()
                            draftPaymentOriginalAmount = "0"
                            draftPaymentAmount = ""
                            draftPaymentConfirmRemaining = ""
                            draftPaymentMethod = PaymentMethodDraft()
                            inlinePaymentError = ""
                            inlinePaymentCreditId = if (inlinePaymentCreditId == row.credit.id) null else row.credit.id
                        }) {
                            Column(Modifier.padding(16.dp)) {
                                if (pointed) Text(
                                    "▶ Aquí vas · toca de nuevo para abonar",
                                    color = MaterialTheme.colorScheme.primary,
                                    fontWeight = FontWeight.Bold
                                )
                                if (pointed && ("nueva tarjeta" in branchPermissionSet || branchPermissionSet.isEmpty())) {
                                    TextButton(onClick = { assessCard(row.credit.id) }) {
                                        Text("Crear tarjeta para este cliente")
                                    }
                                    if (pointed) {
                                        TextButton(onClick = {
                                            scope.launch {
                                                val current = session ?: return@launch
                                                val branch = current.selectedBranchId ?: return@launch
                                                customer = app.database.localDao().customer(current.accountKey, branch, row.credit.customerId)
                                                screen = Screen.CUSTOMER_PHONES
                                            }
                                        }) { Text("Crear o seleccionar teléfono de WhatsApp") }
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
                                operationsByEntity[row.credit.id].orEmpty().firstOrNull {
                                    it.kind == OperationKind.CREATE_CREDIT &&
                                        it.branchId == row.credit.branchId && it.status != OperationStatus.CONFIRMED
                                }?.let { creation ->
                                    Text(
                                        when (creation.status) {
                                            OperationStatus.REJECTED ->
                                                "NO APROBADA POR EL SERVIDOR · borrador local. Revisa la Cola para corregir el cupo y reintentar o descartar."
                                            OperationStatus.CONFLICT ->
                                                "Conflicto con el servidor · borrador local. Revisa la Cola."
                                            else -> "Solo en este teléfono · aún no confirmada por el servidor."
                                        },
                                        color = MaterialTheme.colorScheme.error
                                    )
                                }
                                val cachedCreditPayments = paymentsByCredit[row.credit.id].orEmpty()
                                if (inlinePaymentCreditId == row.credit.id) {
                                    val openPayment = cachedCreditPayments.firstOrNull { it.state != "saved" }
                                    if (openPayment != null) {
                                        Text("Ya hay un abono sin liquidar. Usa los movimientos para editarlo.",
                                            color = MaterialTheme.colorScheme.error)
                                    } else {
                                        CompactOutlinedTextField(
                                            draftPaymentAmount, { draftPaymentAmount = it },
                                            placeholder = "Abono *",
                                            modifier = Modifier.fillMaxWidth(),
                                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                                        )
                                        Spacer(Modifier.height(6.dp))
                                        CompactOutlinedTextField(
                                            draftPaymentConfirmRemaining, { draftPaymentConfirmRemaining = it },
                                            placeholder = "Confirma cuánto queda restando *",
                                            modifier = Modifier.fillMaxWidth(),
                                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                                        )
                                        PaymentMethodPicker(
                                            bankAccounts, draftPaymentMethod, { draftPaymentMethod = it },
                                            "¿Cuánto entró por banco?", draftPaymentAmount, allowChange = true
                                        )
                                        if (inlinePaymentError.isNotBlank()) {
                                            Text(inlinePaymentError, color = MaterialTheme.colorScheme.error)
                                        }
                                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                            Button(enabled = !busy, onClick = {
                                                scope.launch {
                                                    busy = true
                                                    inlinePaymentError = ""
                                                    try {
                                                        operationKind = OperationKind.CREATE_PAYMENT
                                                        selectedCreditId = row.credit.id
                                                        draftBalance = row.credit.balance.orEmpty()
                                                        val saved = saveTypedOperation(stayOnPortfolio = true)
                                                        inlinePaymentCreditId = null
                                                        draftPaymentAmount = ""
                                                        draftPaymentConfirmRemaining = ""
                                                        draftPaymentMethod = PaymentMethodDraft()
                                                        watchedPaymentOperationIds += saved.operationId
                                                        scope.launch {
                                                            snackbarHostState.showSnackbar(
                                                                "Abono guardado en el teléfono; pendiente de confirmación del servidor.",
                                                                duration = SnackbarDuration.Short
                                                            )
                                                        }
                                                    } catch (error: IllegalArgumentException) {
                                                        inlinePaymentError = error.message ?: "Abono inválido."
                                                    } finally {
                                                        busy = false
                                                    }
                                                }
                                            }) { Text("Guardar abono") }
                                            TextButton(onClick = {
                                                inlinePaymentCreditId = null
                                                inlinePaymentError = ""
                                            }) { Text("Cancelar") }
                                        }
                                    }
                                }
                                val pendingLocalPayment = cachedCreditPayments.firstOrNull { payment ->
                                    payment.createdLocally && operationsByEntity[row.credit.id].orEmpty().any { operation ->
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
                                    val paymentOperation = if (payment.createdLocally) operationsByEntity[row.credit.id].orEmpty().firstOrNull { operation ->
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
                                if (operationsByEntity[row.credit.id].orEmpty().any {
                                        it.branchId == row.credit.branchId &&
                                            it.kind != OperationKind.CREATE_PAYMENT &&
                                            it.status in setOf(OperationStatus.PENDING, OperationStatus.IN_FLIGHT)
                                    }
                                ) Text("Hay otros cambios pendientes de confirmar.", color = MaterialTheme.colorScheme.error)
                            }
                        }
                        if (inlinePaymentCreditId == row.credit.id) {
                            TextButton(onClick = { openFullPayments(row.credit.id) }) {
                                Text("Ver todos los movimientos / editar abono")
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
                        item { Text("Clientes guardados", style = MaterialTheme.typography.titleLarge) }
                        items(customerMatches, key = { "customer-${it.id}" }) { item ->
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
                    item { Text("Este dispositivo conserva únicamente la cartera de la sucursal y los clientes que abras.") }
                    }
                    }
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
                            inlinePaymentCreditId = null
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
                    Text("Configuración", style = MaterialTheme.typography.headlineSmall)
                    Text("Apariencia", style = MaterialTheme.typography.titleMedium)
                    Text("Búsqueda en cartera", style = MaterialTheme.typography.titleSmall)
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        listOf(
                            true to "Siempre visible · barra delgada",
                            false to "Al tocar la barra · más espacio para tarjetas"
                        ).forEach { (alwaysVisible, label) ->
                            FilterChip(
                                selected = alwaysShowPortfolioSearch == alwaysVisible,
                                onClick = {
                                    alwaysShowPortfolioSearch = alwaysVisible
                                    PortfolioDisplaySettings.setAlwaysShowSearch(activity, alwaysVisible)
                                    showPortfolioSearch = false
                                    if (!alwaysVisible) {
                                        search = ""
                                        customerMatches = emptyList()
                                    }
                                },
                                label = { Text(label) }
                            )
                        }
                    }
                    Text(
                        "Elige el tema de la aplicación. Sistema sigue automáticamente la configuración del teléfono.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        ThemeMode.entries.forEach { mode ->
                            FilterChip(
                                selected = themeMode == mode,
                                onClick = { onThemeModeChange(mode) },
                                label = { Text(themeModeLabel(mode)) }
                            )
                        }
                    }
                    Text("Tamaño del texto", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "La app siempre respeta el tamaño configurado en el teléfono. Estas opciones permiten aumentarlo aún más.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        TextScale.entries.forEach { scale ->
                            FilterChip(
                                selected = textScale == scale,
                                onClick = { onTextScaleChange(scale) },
                                label = { Text(textScaleLabel(scale)) }
                            )
                        }
                    }
                    HorizontalDivider()
                    Row(
                        Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text("Comprobantes por WhatsApp", style = MaterialTheme.typography.titleMedium)
                            Text(
                                "Al guardar un abono o un crédito, ofrecer enviarle el mensaje al cliente por WhatsApp.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Switch(
                            checked = whatsAppOfferEnabled,
                            onCheckedChange = {
                                whatsAppOfferEnabled = it
                                WhatsAppSettings.setOfferAfterSave(activity, it)
                            }
                        )
                    }
                    OutlinedButton(
                        enabled = session != null && branchId != null && online && !receiptLinkManagerBusy,
                        onClick = { loadReceiptLinkManager() }
                    ) {
                        Text(if (receiptLinkManagerBusy) "Cargando enlaces…" else "Administrar enlaces compartidos")
                    }
                    Text(
                        "Puedes revocar enlaces ya enviados. Quien tenga un enlace activo puede abrir el comprobante.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    HorizontalDivider()
                    Text("Conexión con el servidor", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "Escribe el dominio (por ejemplo, api.empresa.com) o la URL completa de GraphQL. " +
                            "En producción se exige HTTPS.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    OutlinedTextField(
                        serverEndpoint,
                        {
                            serverEndpoint = it
                            serverEndpointError = null
                        },
                        label = { Text("Dominio o URL del servidor") },
                        isError = serverEndpointError != null,
                        supportingText = { serverEndpointError?.let { Text(it) } },
                        enabled = session == null,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    if (session == null && BuildConfig.DEBUG && BuildConfig.LOCAL_GRAPHQL_ENDPOINT.isNotBlank()) {
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            listOf(
                                "Local (PC)" to BuildConfig.LOCAL_GRAPHQL_ENDPOINT,
                                "Pruebas" to "https://api-pruebas.websdn.co/graphql"
                            ).forEach { (label, preset) ->
                                FilterChip(
                                    selected = serverEndpoint == preset,
                                    onClick = {
                                        serverEndpoint = preset
                                        serverEndpointError = null
                                    },
                                    label = { Text(label) }
                                )
                            }
                        }
                    }
                    if (session == null) {
                        Button(onClick = {
                            try {
                                serverEndpoint = app.configureGraphQlEndpoint(serverEndpoint)
                                serverEndpointError = null
                                notice = "Conexión guardada: $serverEndpoint"
                            } catch (error: IllegalArgumentException) {
                                serverEndpointError = error.message ?: "La URL del servidor no es válida."
                            }
                        }) { Text("Guardar conexión") }
                    } else {
                        Text(
                            "Para proteger tu sesión y sus operaciones pendientes, cierra sesión antes de cambiar el servidor.",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    val currentSession = session
                    val currentBranch = currentSession?.selectedBranchId
                    if (currentSession != null) {
                        HorizontalDivider()
                        Text("Acceso con huella", style = MaterialTheme.typography.titleMedium)
                        val biometricEnabled = biometricManager.hasCredential(currentSession.accountKey)
                        Text(
                            if (biometricEnabled) {
                                "Activo en este dispositivo. La huella se valida localmente y el servidor guarda solo la clave pública."
                            } else {
                                "Activa la huella para futuros inicios de sesión en este dispositivo. La huella nunca sale del teléfono."
                            },
                            style = MaterialTheme.typography.bodySmall
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(
                                enabled = !busy && online,
                                onClick = {
                                    scope.launch {
                                        busy = true
                                        val account = session
                                        if (account == null) {
                                            notice = "Inicia sesión primero para activar la huella."
                                            busy = false
                                            return@launch
                                        }
                                        if (!biometricEnabled) {
                                            runCatching { biometricManager.ensureCredential(account.accountKey) }
                                                .onFailure {
                                                    notice = it.message ?: "No se pudo crear la credencial biométrica local."
                                                    busy = false
                                                    return@launch
                                                }
                                        }
                                        val publicKey = runCatching {
                                            biometricManager.ensureCredential(account.accountKey)
                                        }.getOrElse {
                                            notice = it.message ?: "No se pudo leer la clave biométrica local."
                                            busy = false
                                            return@launch
                                        }
                                        when (val start = app.api.startBiometricRegistration(account.token, biometricDeviceId)) {
                                            is ApiResult.Success -> {
                                                val challenge = start.value.startBiometricRegistration
                                                val signature = biometricManager.signChallenge(
                                                    activity,
                                                    account.accountKey,
                                                    challenge.challenge,
                                                    "Activar inicio con huella",
                                                    "Confirma para registrar este dispositivo"
                                                )
                                                if (signature.isFailure) {
                                                    notice = signature.exceptionOrNull()?.message
                                                        ?: "No se pudo completar la validación biométrica."
                                                    busy = false
                                                    return@launch
                                                }
                                                when (
                                                    val finish = app.api.finishBiometricRegistration(
                                                        account.token,
                                                        biometricDeviceId,
                                                        challenge.challengeId,
                                                        publicKey,
                                                        signature.getOrThrow()
                                                    )
                                                ) {
                                                    is ApiResult.Success -> notice = "Huella activada para esta cuenta en este dispositivo."
                                                    else -> report(finish)
                                                }
                                            }
                                            else -> report(start)
                                        }
                                        busy = false
                                    }
                                }
                            ) {
                                Text(if (biometricEnabled) "Reactivar huella" else "Activar huella")
                            }
                            if (biometricEnabled) {
                                OutlinedButton(
                                    enabled = !busy,
                                    onClick = {
                                        biometricManager.clearCredential(currentSession.accountKey)
                                        notice = "Huella desactivada en este dispositivo."
                                    }
                                ) { Text("Quitar de este dispositivo") }
                            }
                        }
                    }
                    if (currentSession != null && currentBranch != null) {
                        HorizontalDivider()
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Sincronización automática", style = MaterialTheme.typography.titleMedium)
                            Switch(
                                checked = syncAutoEnabled,
                                onCheckedChange = { enabled ->
                                    SyncScheduler.setPeriodicEnabled(
                                        activity, currentSession.accountKey, currentBranch, enabled
                                    )
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
                    Button(enabled = !busy && !refreshingPortfolio, onClick = {
                        scope.launch { synchronizeNow() }
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
                    }
                    TextButton(onClick = { screen = settingsReturnScreen }) { Text("Volver") }
                }
                Screen.CUSTOMER_LOOKUP -> {
                    Text("Buscar por documento · cliente o tarjeta",
                        style = MaterialTheme.typography.headlineSmall)
                    Text("Si existe un cliente, revisa su historial y crea otra tarjeta. " +
                        "Si no existe, abre el formulario para registrarlo. Se requiere conexión.")
                    if (personDocumentTypes.isEmpty()) Text(
                        "No se cargaron los tipos de documento del servidor. Vuelve a abrir esta pantalla con conexión.",
                        color = MaterialTheme.colorScheme.error
                    )
                    Box {
                        OutlinedButton(
                            enabled = personDocumentTypes.isNotEmpty(),
                            onClick = { showPersonDocumentMenu = true }
                        ) { Text("Tipo de documento: ${documentType.ifBlank { "Seleccionar" }} ▾") }
                        DropdownMenu(
                            expanded = showPersonDocumentMenu,
                            onDismissRequest = { showPersonDocumentMenu = false }
                        ) {
                            personDocumentTypes.forEach { type ->
                                DropdownMenuItem(
                                    text = { Text(type) },
                                    onClick = {
                                        documentType = type
                                        showPersonDocumentMenu = false
                                        lookupSearched = false
                                        lookupComplete = false
                                        lookupAnchorId = null
                                        customerLookupVerified = false
                                    }
                                )
                            }
                        }
                    }
                    OutlinedTextField(
                        documentNumber, {
                            documentNumber = it.trim()
                            lookupSearched = false
                            lookupComplete = false
                            lookupAnchorId = null
                            customerLookupVerified = false
                        },
                        label = { Text("Número de documento *") }, modifier = Modifier.fillMaxWidth()
                    )
                    Button(
                        enabled = !busy && creditOnline && documentType in personDocumentTypes && documentNumber.isNotBlank(),
                        onClick = {
                            scope.launch {
                                val current = session ?: return@launch
                                val branch = current.selectedBranchId ?: return@launch
                                busy = true
                                lookupSearched = false
                                lookupComplete = false
                                customerLookupVerified = false
                                customerCandidate = null
                                lookupCustomer = null
                                lookupPayments = emptyList()
                                lookupAnchorId = null
                                lookupMessage = "Consultando identidad e historial en el servidor…"
                                try {
                                    when (val result = app.api.customerCandidate(
                                        current.token, branch, documentType, documentNumber
                                    )) {
                                        is ApiResult.Success -> {
                                            val existing = result.value.customerCandidate
                                            customerCandidate = existing
                                            lookupSearched = true
                                            if (existing?.customerId != null) {
                                                when (val history = app.api.customerByDocument(
                                                    current.token, branch, documentType, documentNumber
                                                )) {
                                                    is ApiResult.Success -> {
                                                        val remote = history.value.customerByDocument
                                                        if (remote == null || remote.id != existing.customerId) {
                                                            lookupMessage = "Cliente registrado en la empresa sin historial visible en esta sucursal. " +
                                                                "No se puede crear otro cliente con el mismo documento."
                                                        } else {
                                                            showCustomerHistory(remote, current, branch)
                                                        }
                                                    }
                                                    is ApiResult.Rejected -> {
                                                        report(history)
                                                        lookupMessage = if (history.message == "Customer not found")
                                                            "Cliente registrado en la empresa sin tarjeta visible en esta sucursal. " +
                                                                "No se puede crear otro cliente con el mismo documento."
                                                        else "No se pudo consultar la cartera de este cliente: $notice"
                                                    }
                                                    else -> {
                                                        report(history)
                                                        lookupMessage = "No se pudo consultar la cartera de este cliente: $notice"
                                                    }
                                                }
                                            } else {
                                                lookupComplete = true
                                                lookupMessage = if (existing == null)
                                                    "No existe una persona ni un cliente con este documento en la empresa."
                                                else "Persona existente sin cliente asociado: no hay historial de tarjetas en la empresa."
                                                lookupMessage += if ("crear cliente" in branchPermissionSet)
                                                    " Puedes crear el cliente."
                                                else " No tienes permiso para crear clientes."
                                            }
                                        }
                                        is ApiResult.PermissionRejected -> {
                                            when (val history = app.api.customerByDocument(
                                                current.token, branch, documentType, documentNumber
                                            )) {
                                                is ApiResult.Success -> {
                                                    lookupSearched = true
                                                    val remote = history.value.customerByDocument
                                                    if (remote != null) showCustomerHistory(remote, current, branch)
                                                    else lookupMessage = "No se encontró el cliente. No tienes permiso para crear clientes."
                                                }
                                                is ApiResult.Rejected -> {
                                                    report(history)
                                                    lookupMessage = if (history.message == "Customer not found")
                                                        "No se encontró un cliente accesible con ese documento. " +
                                                            "No tienes permiso para crear clientes."
                                                    else "No se pudo consultar el historial: $notice"
                                                }
                                                else -> {
                                                    report(history)
                                                    lookupMessage = "No se pudo consultar el historial: $notice"
                                                }
                                            }
                                        }
                                        else -> {
                                            report(result)
                                            lookupMessage = "No se pudo consultar la identidad: $notice"
                                        }
                                    }
                                } finally {
                                    busy = false
                                }
                            }
                        }
                    ) { Text("Buscar") }
                    if (lookupMessage.isNotBlank()) Text(lookupMessage)
                    if (lookupSearched) {
                        val existing = customerCandidate
                        if (existing != null) Text(
                            "${formatPersonName("${existing.firstName.orEmpty()} ${existing.lastName.orEmpty()}")} · " +
                                "${existing.documentType.orEmpty()} ${existing.documentNumber.orEmpty()} · " +
                                "teléfono ${existing.phone.orEmpty()} · ${existing.city.orEmpty()} ${existing.street.orEmpty()}"
                        )
                        lookupCustomer?.let { remote ->
                            Text("Servidor (sucursal autorizada): ${remote.credits.size} tarjetas · " +
                                "cupo ${formatMoney(remote.maxCredit?.toString())} · estado ${remote.status.orEmpty()} · " +
                                "${lookupPayments.size} movimientos")
                            if (!remote.note.isNullOrBlank()) Text("Nota: ${remote.note}")
                            remote.comments.forEach { note -> Text("Comentario: ${note.comment}") }
                            remote.credits.forEach { credit ->
                                Text("Tarjeta ${credit.id} · ${credit.status.orEmpty()} · " +
                                    "saldo ${formatMoney(credit.balance?.toString())} · " +
                                    "valor ${formatMoney(credit.value?.toString())}")
                                lookupPayments.filter { it.creditId == credit.id }.forEach { payment ->
                                    Text("  ${payment.createdAt.orEmpty()} · ${formatMoney(payment.amount?.toString())} · " +
                                        "${payment.description.orEmpty()} (${payment.state.orEmpty()})",
                                        style = MaterialTheme.typography.bodySmall)
                                }
                            }
                            Text("Tarjeta de referencia para el orden: «Aquí vas» " +
                                (lookupAnchorId?.let { "($it)" } ?: "(sin confirmar)."),
                                style = MaterialTheme.typography.bodySmall)
                            if (receiptSequences.isEmpty()) Text(
                                "No hay consecutivo de comprobante de esta sucursal; sincroniza antes de crear.",
                                color = MaterialTheme.colorScheme.error
                            )
                            if (session?.branchExtraCharges?.get(branchId) !in setOf("boleta", "seguro", "ninguno")) Text(
                                "No se conoce el cobro adicional de esta sucursal; vuelve a iniciar sesión en línea.",
                                color = MaterialTheme.colorScheme.error
                            )
                            Button(
                                enabled = canOpenLookedUpCreditForm(creditOnline, busy, lookupComplete,
                                    lookupAnchorId, pointedCreditId) &&
                                    ("nueva tarjeta" in branchPermissionSet || branchPermissionSet.isEmpty()) &&
                                    receiptSequences.isNotEmpty() &&
                                    session?.branchExtraCharges?.get(branchId) in setOf("boleta", "seguro", "ninguno"),
                                onClick = {
                                    scope.launch {
                                        val current = session ?: return@launch
                                        val branch = current.selectedBranchId ?: return@launch
                                        val anchor = lookupAnchorId ?: return@launch
                                        busy = true
                                        try {
                                            when (val verified = app.api.me(current.token)) {
                                                is ApiResult.Success -> {
                                                    if (verified.value.me == null || !creditOnline) {
                                                        lookupComplete = false
                                                        lookupMessage = "Se perdió la conexión o la sesión. Busca de nuevo."
                                                    } else when (val opened = app.repository.openCustomerByDocument(
                                                        current, branch, documentType, documentNumber
                                                    )) {
                                                        is ApiResult.Success -> {
                                                            if (opened.value.id != remote.id.toString() ||
                                                                anchor != pointedCreditId ||
                                                                rows.none { it.credit.id == anchor }) {
                                                                lookupComplete = false
                                                                lookupMessage = "El cliente o la tarjeta cambió. Busca de nuevo."
                                                            } else {
                                                                customer = opened.value
                                                                selectedCreditId = anchor
                                                                assessmentCreditId = anchor
                                                                assessmentCustomer = remote
                                                                assessmentPayments = lookupPayments
                                                                assessmentComplete = true
                                                                assessmentLoading = false
                                                                prepareComposer(OperationKind.CREATE_CREDIT, sourceCreditId = anchor)
                                                            }
                                                        }
                                                        else -> {
                                                            report(opened)
                                                            lookupComplete = false
                                                            lookupMessage = "No se pudo confirmar el cliente: $notice. Busca de nuevo."
                                                        }
                                                    }
                                                }
                                                else -> {
                                                    report(verified)
                                                    lookupComplete = false
                                                    lookupMessage = "No se pudo confirmar la conexión: $notice. Busca de nuevo."
                                                }
                                            }
                                        } finally {
                                            busy = false
                                        }
                                    }
                                }
                            ) { Text("Apto · abrir formulario de nueva tarjeta") }
                            OutlinedButton(enabled = lookupComplete && !busy && creditOnline, onClick = {
                                scope.launch {
                                    val current = session ?: return@launch
                                    val branch = current.selectedBranchId ?: return@launch
                                    when (val opened = app.repository.openCustomerByDocument(
                                        current, branch, documentType, documentNumber
                                    )) {
                                        is ApiResult.Success -> {
                                            customer = opened.value
                                            screen = Screen.CUSTOMER
                                        }
                                        else -> report(opened)
                                    }
                                }
                            }) { Text("Abrir cliente existente (no duplicar)") }
                        }
                        if (existing?.customerId == null && lookupCustomer == null) {
                            Button(enabled = canOpenCreditForm(creditOnline, busy, lookupComplete) &&
                                "crear cliente" in branchPermissionSet, onClick = {
                                scope.launch {
                                    val current = session ?: return@launch
                                    busy = true
                                    try {
                                        when (val verified = app.api.me(current.token)) {
                                            is ApiResult.Success -> {
                                                if (verified.value.me == null) {
                                                    lookupComplete = false
                                                    lookupMessage = "No se pudo verificar la sesión. Busca de nuevo."
                                                } else {
                                                    prepareComposer(OperationKind.CREATE_CUSTOMER)
                                                    draftDocumentType = documentType
                                                    draftDocumentNumber = documentNumber
                                                    if (existing != null) {
                                                        draftFirstName = existing.firstName.orEmpty()
                                                        draftLastName = existing.lastName.orEmpty()
                                                        draftSex = existing.sex.orEmpty()
                                                        draftBirthDate = existing.birthDate.orEmpty()
                                                        draftPhone = existing.phone.orEmpty()
                                                        draftEmail = existing.email.orEmpty()
                                                        draftOccupation = existing.occupation.orEmpty()
                                                        draftPersonNote = existing.personNote.orEmpty()
                                                        draftDepartment = existing.department.orEmpty()
                                                        draftCity = existing.city.orEmpty()
                                                        draftNeighborhood = existing.neighborhood.orEmpty()
                                                        draftAddress = existing.street.orEmpty()
                                                    }
                                                    customerLookupVerified = true
                                                }
                                            }
                                            else -> {
                                                report(verified)
                                                lookupComplete = false
                                                lookupMessage = "Se perdió la conexión: $notice. Busca de nuevo."
                                            }
                                        }
                                    } finally {
                                        busy = false
                                    }
                                }
                            }) { Text("Apto · abrir formulario") }
                        }
                    }
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
                Screen.CUSTOMER_PHONES -> {
                    var phoneDraft by remember(customer?.id) { mutableStateOf("") }
                    var phoneError by remember(customer?.id) { mutableStateOf("") }
                    var savingPhone by remember { mutableStateOf(false) }
                    var confirmingValidity by remember(customer?.id) {
                        mutableStateOf<com.backendcreditos.mobile.network.CustomerPhoneDto?>(null)
                    }
                    confirmingValidity?.let { phone ->
                        AlertDialog(
                            onDismissRequest = { if (!savingPhone) confirmingValidity = null },
                            title = { Text(if (phone.invalid) "Restaurar teléfono" else "Marcar teléfono incorrecto") },
                            text = { Text(phone.phone + if (phone.invalid)
                                "\n¿Restaurarlo como válido? Volverá a estar disponible para WhatsApp."
                                else "\nSe conservará en el historial, pero no se usará en WhatsApp.") },
                            confirmButton = { TextButton(enabled = !savingPhone, onClick = {
                                scope.launch {
                                    val current = session ?: return@launch
                                    val branch = current.selectedBranchId ?: return@launch
                                    val selected = customer ?: return@launch
                                    savingPhone = true
                                    try {
                                        customer = app.repository.setCustomerPhoneValidity(current, branch, selected.id,
                                            requireNotNull(phone.normalizedPhone), !phone.invalid)
                                        rows = app.repository.portfolio(current.accountKey, branch)
                                        phoneError = "Corrección guardada localmente; pendiente de sincronizar."
                                        confirmingValidity = null
                                        SyncScheduler.enqueue(activity, current.accountKey, branch, expedited = online)
                                    } catch (error: IllegalArgumentException) {
                                        phoneError = error.message ?: "No se pudo corregir el teléfono."
                                        confirmingValidity = null
                                    } finally { savingPhone = false }
                                }
                            }) { Text(if (phone.invalid) "Restaurar" else "Marcar incorrecto") } },
                            dismissButton = { TextButton(enabled = !savingPhone,
                                onClick = { confirmingValidity = null }) { Text("Cancelar") } }
                        )
                    }
                    fun savePhone(raw: String, add: Boolean) {
                        scope.launch {
                            val current = session ?: return@launch
                            val branch = current.selectedBranchId ?: return@launch
                            val selected = customer ?: return@launch
                            savingPhone = true
                            try {
                                customer = app.repository.changeCustomerPhone(current, branch, selected.id, raw, add)
                                rows = app.repository.portfolio(current.accountKey, branch)
                                phoneDraft = ""
                                phoneError = "Guardado en el dispositivo; se enviará con la cola de sincronización."
                                SyncScheduler.enqueue(activity, current.accountKey, branch, expedited = online)
                            } catch (error: IllegalArgumentException) {
                                phoneError = error.message ?: "Teléfono no válido."
                            } finally {
                                savingPhone = false
                            }
                        }
                    }
                    Text("Teléfonos de WhatsApp", style = MaterialTheme.typography.titleLarge)
                    Text("${customer?.firstName.orEmpty()} ${customer?.lastName.orEmpty()}")
                    Text("Un principal para este cliente, compartido por todas sus tarjetas.")
                    Text("Principal: ${customer?.phone?.takeIf(String::isNotBlank) ?: "Sin teléfono"}")
                    Text("Agregar, seleccionar y corregir teléfonos está disponible para usuarios con acceso a este cliente y sucursal.")
                    customer?.let { selected ->
                        if (app.repository.savedPhones(selected).any {
                                it.invalid && it.normalizedPhone == whatsAppPhone(selected.phone)
                            }) {
                            Text("El principal está marcado INCORRECTO y no se usará en WhatsApp. Selecciona otro principal válido o restáuralo deliberadamente.",
                                color = MaterialTheme.colorScheme.error)
                        }
                        app.repository.savedPhones(selected).forEach { phone ->
                            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(phone.phone)
                                    if (phone.invalid) Text("INCORRECTO", color = MaterialTheme.colorScheme.error)
                                    if (phone.pendingValidityIds.isNotEmpty()) Text("Corrección pendiente de sincronizar")
                                    phone.validityChangedAt?.let { Text("Última corrección: $it · usuario ${phone.validityChangedBy}") }
                                    if (phone.normalizedPhone == null) Text("Histórico no válido para WhatsApp")
                                }
                                TextButton(
                                    enabled = !savingPhone && !phone.invalid && phone.normalizedPhone != null &&
                                        whatsAppPhone(selected.phone) != phone.normalizedPhone,
                                    onClick = { savePhone(phone.normalizedPhone.orEmpty(), false) }
                                ) { Text("Seleccionar") }
                                if (phone.normalizedPhone != null) {
                                    TextButton(enabled = !savingPhone, onClick = {
                                        if (!phone.invalid && whatsAppPhone(selected.phone) == phone.normalizedPhone) {
                                            phoneError = "Selecciona primero otro teléfono principal antes de marcar este como incorrecto."
                                        } else confirmingValidity = phone
                                    }) { Text(if (phone.invalid) "Restaurar" else "Marcar incorrecto") }
                                }
                            }
                        }
                    }
                    OutlinedTextField(
                        phoneDraft, { phoneDraft = it }, label = { Text("Nuevo número") },
                        supportingText = { Text("Celular colombiano: 3XXXXXXXXX. Internacional: +código y número.") },
                        enabled = !savingPhone, modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone)
                    )
                    Button(enabled = !savingPhone && phoneDraft.isNotBlank(),
                        onClick = { savePhone(phoneDraft, true) }) { Text("Crear y usar como principal") }
                    if (phoneError.isNotBlank()) Text(phoneError)
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
                    HorizontalDivider()
                    Text("Ubicaciones de cobro", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "Marca cada punto estando parado en el lugar. Luego usa «Cómo llegar» para abrir Maps o Waze.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    Button(
                        enabled = !busy && selectedCreditId != null,
                        onClick = {
                            locationNameDraft = "Casa"
                            showLocationNameDialog = true
                        }
                    ) { Text("Marcar ubicación aquí") }
                    if (creditLocationRows.isEmpty()) {
                        Text("Esta tarjeta no tiene ubicaciones de cobro guardadas.")
                    }
                    creditLocationRows.forEach { location ->
                        Card(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Row(
                                    Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(location.name, style = MaterialTheme.typography.titleMedium)
                                    if (location.pending) Text(
                                        "Pendiente",
                                        color = MaterialTheme.colorScheme.error,
                                        style = MaterialTheme.typography.labelMedium
                                    )
                                }
                                Text(
                                    "${"%.6f".format(location.latitude)}, ${"%.6f".format(location.longitude)}" +
                                        (location.accuracy?.let { " · precisión ${it} m" } ?: ""),
                                    style = MaterialTheme.typography.bodySmall
                                )
                                if ((location.accuracy ?: 0) > 50) {
                                    Text(
                                        "Precisión baja: si puedes, vuelve a marcar al aire libre.",
                                        color = MaterialTheme.colorScheme.error,
                                        style = MaterialTheme.typography.labelMedium
                                    )
                                }
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    TextButton(onClick = { openDirections(location) }) { Text("Cómo llegar") }
                                    TextButton(onClick = { locationToDelete = location }) { Text("Eliminar") }
                                }
                            }
                        }
                    }
                    HorizontalDivider()
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
                Screen.ROUTE_ENTRIES -> {
                    RouteEntriesScreen(
                        entries = routeEntryRows,
                        catalog = routeCatalog,
                        draft = routeEntryDraft,
                        onDraftChange = { routeEntryDraft = it },
                        busy = busy,
                        error = routeEntryError,
                        onSave = { scope.launch { busy = true; saveRouteEntry(); busy = false } },
                        onDelete = { entry -> scope.launch { busy = true; deleteRouteEntry(entry); busy = false } },
                        onRefresh = { scope.launch { busy = true; loadRouteEntries(true); busy = false } },
                        onBack = { screen = Screen.HOME }
                    )
                }
                Screen.SETTLEMENT -> {
                    SettlementScreen(
                        summary = settlement,
                        count = cashCount,
                        onCountChange = { cashCount = it },
                        blocker = settlementBlocker(settlement, creditOnline, unresolvedBadge),
                        busy = busy,
                        error = settlementError,
                        onRefresh = {
                            scope.launch { busy = true; loadOperations(); loadSettlement(); busy = false }
                        },
                        onSettle = {
                            scope.launch {
                                val current = session ?: return@launch
                                val branch = current.selectedBranchId ?: return@launch
                                val summary = settlement ?: return@launch
                                busy = true
                                settlementError = ""
                                val difference = cashDifference(summary, cashCount)
                                when (
                                    val result = app.repository.settleRoute(
                                        current, branch,
                                        cashCount.amount(cashCount.cash).toDouble(),
                                        cashCount.amount(cashCount.coins).toDouble(),
                                        difference.toDouble()
                                    )
                                ) {
                                    is ApiResult.Success -> {
                                        settlement = result.value
                                        cashCount = cashCount.copy(confirmed = false)
                                        app.repository.pullChanges(current, branch)
                                        loadLocal()
                                        refreshRouteCash()
                                        notice = "Cuentas entregadas. La ruta quedó en entregando."
                                    }
                                    else -> {
                                        report(result)
                                        settlementError = notice
                                        notice = ""
                                        loadSettlement()
                                    }
                                }
                                busy = false
                            }
                        },
                        onBack = { screen = Screen.HOME }
                    )
                }
                Screen.QUEUE -> {
                    TabRow(selectedTabIndex = queueTab) {
                        Tab(selected = queueTab == 0, onClick = { queueTab = 0 }, text = {
                            Text(if (unresolvedBadge > 0) "Cola ($unresolvedBadge)" else "Cola")
                        })
                        Tab(selected = queueTab == 1, onClick = {
                            queueTab = 1
                            scope.launch { session?.let { activityLogRows = app.repository.activityLog(it.accountKey) } }
                        }, text = { Text("Logs") })
                    }
                    if (queueTab == 1) {
                        Text(
                            "Avisos de los últimos 7 días (máximo $ACTIVITY_LOG_MAX_ENTRIES). Se borran al cerrar sesión.",
                            style = MaterialTheme.typography.bodySmall
                        )
                        if (activityLogRows.isEmpty()) Text("No hay avisos registrados.")
                        activityLogRows.forEach { entry ->
                            Column(Modifier.fillMaxWidth()) {
                                Text(
                                    formatPaymentMoment(entry.createdAt.toString()),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Text(
                                    entry.message,
                                    color = if (entry.problem) MaterialTheme.colorScheme.error
                                        else MaterialTheme.colorScheme.onSurface
                                )
                                HorizontalDivider(Modifier.padding(top = 6.dp))
                            }
                        }
                    } else {
                    syncPausedBannerText()?.let {
                        Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
                    }
                    val routeBlocked = operationRows.filter {
                        com.backendcreditos.mobile.queue.RouteGuard.isRouteRefusal(it.rejectionCode)
                    }
                    if (routeBlocked.isNotEmpty()) {
                        val resendable = routeBlocked.count {
                            com.backendcreditos.mobile.queue.RouteGuard.canResend(it.rejectionCode)
                        }
                        Card(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(12.dp)) {
                                Text("Ruta cerrada: ${routeBlocked.size} registros detenidos",
                                    style = MaterialTheme.typography.titleMedium)
                                Text(
                                    "Nada se borra solo. Revisa abajo uno por uno y anota lo que necesites antes de quitarlos. " +
                                        if (resendable > 0)
                                            "$resendable se pueden volver a enviar si la oficina desbloquea el día."
                                        else "Ninguno se puede volver a enviar: la oficina ya guardó esos días."
                                )
                                if (resendable > 0) Button(enabled = !busy && online, onClick = {
                                    scope.launch {
                                        busy = true
                                        try {
                                            val sent = app.repository.resendAllRouteBlockedOperations(
                                                requireNotNull(session).accountKey
                                            )
                                            loadOperations()
                                            session?.let { enqueuePendingBranches(it) }
                                            val stuck = operationRows.count {
                                                com.backendcreditos.mobile.queue.RouteGuard.isRouteRefusal(it.rejectionCode)
                                            }
                                            notice = "Se volvieron a poner en cola $sent registros." +
                                                if (stuck > 0) " Todavía hay $stuck detenidos: quítalos para que el envío siga."
                                                else ""
                                        } finally { busy = false }
                                    }
                                }) { Text("Volver a enviar los $resendable que se pueden") }
                                TextButton(enabled = !busy, onClick = { showRouteSweepConfirmation = true }) {
                                    Text("Quitar de la cola los ${routeBlocked.size}")
                                }
                            }
                        }
                    }
                    if (operationRows.isEmpty()) Text("No hay operaciones en la cola.")
                    Text(
                        "«Esperando envío» y «Enviando…» aún no están confirmados; solo el servidor los confirma.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    operationRows.forEach { operation ->
                        val opCredit = rows.firstOrNull { it.credit.id == operation.entityId }
                            ?: branchPayments.firstOrNull { it.id == operation.entityId }
                                ?.let { payment -> rows.firstOrNull { it.credit.id == payment.creditId } }
                        val opCustomer = opCredit?.customer
                            ?: rows.firstOrNull { it.customer?.id == operation.entityId }?.customer
                        val opBranch = branchList.find { it.id == operation.branchId }
                        val summary = summarizeOperation(
                            operation.kind,
                            operation.payload,
                            customerName = opCustomer?.let { formatPersonName("${it.firstName} ${it.lastName}") },
                            cardLabel = opCredit?.credit?.let { cardLabel(it.concept, it.value, it.balance) },
                            paymentAmount = branchPayments.firstOrNull { it.id == operation.entityId }?.amount
                        )
                        Card(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(12.dp)) {
                                Text(operationDisplayName(operation.kind), style = MaterialTheme.typography.titleMedium)
                                Text(
                                    operationStatusLabel(operation.status),
                                    color = when (operation.status) {
                                        OperationStatus.CONFLICT, OperationStatus.REJECTED -> MaterialTheme.colorScheme.error
                                        OperationStatus.CONFIRMED -> MaterialTheme.colorScheme.primary
                                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                                    },
                                    style = MaterialTheme.typography.labelLarge
                                )
                                summary.person?.let { Text(it, style = MaterialTheme.typography.bodyLarge) }
                                summary.details.forEach { Text(it) }
                                Text(
                                    listOfNotNull(
                                        formatPaymentMoment(operation.createdAt.toString()),
                                        listOfNotNull(opBranch?.type, opBranch?.name).joinToString(" ").ifBlank { null }
                                    ).joinToString(" · "),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                if (operation.status == OperationStatus.CONFLICT) {
                                    Text("Otra persona cambió este dato antes. Compara con el servidor y decide si descartas este cambio.")
                                }
                                if (operation.status == OperationStatus.REJECTED) {
                                    Text("No se reintentará solo (permisos o reglas del servidor).")
                                }
                                // Cheap pre-filter; offerQueuedReceipt re-checks state and day (live when confirmed).
                                if (operation.kind in setOf(OperationKind.CREATE_CREDIT, OperationKind.CREATE_PAYMENT,
                                        OperationKind.UPDATE_PAYMENT) &&
                                    operation.status in setOf(OperationStatus.PENDING, OperationStatus.IN_FLIGHT,
                                        OperationStatus.CONFIRMED) &&
                                    operation.branchId == session?.selectedBranchId &&
                                    createdOnBusinessDay(operation.createdAt.toString()) &&
                                    receiptTargetFor(operation.kind, operation.entityId, operation.payload) != null
                                ) {
                                    OutlinedButton(enabled = !busy, onClick = {
                                        scope.launch {
                                            busy = true
                                            try {
                                                offerQueuedReceipt(operation)
                                            } catch (error: Exception) {
                                                notice = error.message ?: "No se pudo preparar el comprobante."
                                            } finally { busy = false }
                                        }
                                    }) { Text("Reenviar comprobante por WhatsApp") }
                                }
                                operation.lastError?.takeIf {
                                    operation.status == OperationStatus.CONFLICT || operation.status == OperationStatus.REJECTED
                                }?.let { Text(friendlyServerError(it), color = MaterialTheme.colorScheme.error) }
                                com.backendcreditos.mobile.queue.RouteGuard.refusalAdvice(operation.rejectionCode)?.let {
                                    Text(it, color = MaterialTheme.colorScheme.error)
                                }
                                if (com.backendcreditos.mobile.queue.RouteGuard.canResend(operation.rejectionCode) &&
                                    operation.status == OperationStatus.REJECTED
                                ) {
                                    Button(enabled = !busy && online, onClick = {
                                        scope.launch {
                                            busy = true
                                            try {
                                                val resent = app.repository.resendRouteBlockedOperation(
                                                    operation.operationId, operation.accountKey
                                                )
                                                loadOperations()
                                                submitAndAwaitConfirmation(resent, resent.branchId,
                                                    requireNotNull(session))
                                            } catch (error: IllegalArgumentException) {
                                                notice = error.message ?: "No se pudo volver a enviar."
                                            } finally {
                                                busy = false
                                            }
                                        }
                                    }) { Text("Volver a enviar este registro") }
                                }
                                if (operation.kind == OperationKind.CREATE_CREDIT &&
                                    operation.status == OperationStatus.REJECTED
                                ) {
                                    Text("Esta tarjeta solo existe en este teléfono. Corrige primero el cupo del cliente o pide autorización. " +
                                        "Después podrás reenviar la misma creación; no crees otra tarjeta igual.")
                                    Button(enabled = !busy && online, onClick = {
                                        scope.launch {
                                            busy = true
                                            try {
                                                val retried = app.repository.retryRejectedCredit(
                                                    operation.operationId, operation.accountKey
                                                )
                                                loadOperations()
                                                submitAndAwaitConfirmation(retried, retried.branchId,
                                                    requireNotNull(session))
                                            } catch (error: IllegalArgumentException) {
                                                notice = error.message ?: "No se pudo reintentar la tarjeta."
                                            } finally {
                                                busy = false
                                            }
                                        }
                                    }) { Text("Reintentar esta tarjeta después de corregir el cupo") }
                                }
                                if (operation.status == OperationStatus.CONFLICT || operation.status == OperationStatus.REJECTED) {
                                    var showServerData by remember(operation.operationId) { mutableStateOf(false) }
                                    TextButton(onClick = { showServerData = !showServerData }) {
                                        Text(if (showServerData) "Ocultar datos técnicos" else "Ver datos técnicos (soporte)")
                                    }
                                    if (showServerData) Text(
                                        operation.serverState ?: "El servidor no envió el estado actual.",
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                    val routeBlockedItem = com.backendcreditos.mobile.queue.RouteGuard
                                        .isRouteRefusal(operation.rejectionCode)
                                    TextButton(enabled = !busy, onClick = {
                                        scope.launch {
                                            busy = true
                                            try {
                                                val current = requireNotNull(session)
                                                if (routeBlockedItem) {
                                                    app.repository.discardRouteBlockedOperation(current, operation.operationId)
                                                } else {
                                                    app.repository.discardResolvedOperation(operation.operationId, operation.accountKey)
                                                }
                                                loadLocal()
                                                loadOperations()
                                                enqueuePendingBranches(current)
                                                screen = Screen.QUEUE
                                                notice = if (routeBlockedItem)
                                                    "Se quitó de la cola. No quedó registrado; mira el detalle en Actividad."
                                                else "Se descartó el borrador por decisión explícita."
                                            } finally { busy = false }
                                        }
                                    }) {
                                        Text(
                                            if (routeBlockedItem) "Quitar este registro de la cola"
                                            else "Descartar mi cambio y quedarme con lo del servidor"
                                        )
                                    }
                                }
                            }
                        }
                    }
                    Text(
                        "Lo que está en la cola solo vive en este teléfono hasta que el servidor lo confirme; " +
                            "si desinstalas la app se pierde.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    }
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
                        if (!assessmentLoading && !assessmentComplete && creditOnline) {
                            OutlinedButton(onClick = { assessCard(assessmentCreditId.orEmpty()) }) {
                                Text("Volver a consultar el historial")
                            }
                        }
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
                            enabled = canOpenCreditForm(creditOnline, assessmentLoading, assessmentComplete) &&
                                assessmentCreditId == selectedCreditId &&
                                receiptSequences.isNotEmpty() &&
                                (session?.branchExtraCharges?.get(branchId) in setOf("boleta", "seguro", "ninguno")),
                            onClick = {
                                scope.launch {
                                    assessmentLoading = true
                                    try {
                                        val current = session ?: return@launch
                                        when (val verified = app.api.me(current.token)) {
                                            is ApiResult.Success -> {
                                                if (verified.value.me != null && creditOnline) {
                                                    prepareComposer(OperationKind.CREATE_CREDIT,
                                                        sourceCreditId = assessmentCreditId)
                                                } else {
                                                    assessmentComplete = false
                                                    assessmentMessage = "Se perdió la conexión o la sesión. Vuelve a consultar el historial."
                                                }
                                            }
                                            else -> {
                                                report(verified)
                                                assessmentComplete = false
                                                assessmentMessage = "No se pudo confirmar la conexión: $notice. Vuelve a consultar."
                                            }
                                        }
                                    } finally {
                                        assessmentLoading = false
                                    }
                                }
                            }
                        ) { Text("Apto · abrir formulario") }
                        if (!creditOnline) Text("Sin conexión: no se puede abrir el formulario de nueva tarjeta.",
                            color = MaterialTheme.colorScheme.error)
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
                            if (operationKind == OperationKind.CREATE_CUSTOMER) {
                                Text(if (customerCandidate != null)
                                    "Persona encontrada en la empresa: verifica sus datos antes de vincularla como cliente y aprobar su cupo."
                                else "Documento sin persona registrada: completa sus datos para crear el cliente.")
                            }
                            OutlinedTextField(draftFirstName, { draftFirstName = it }, label = { Text("Nombres *") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftLastName, { draftLastName = it }, label = { Text("Apellidos *") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftSex, { draftSex = it }, label = { Text("Sexo") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftBirthDate, { draftBirthDate = it }, label = { Text("Fecha de nacimiento") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftDocumentType, { draftDocumentType = it }, label = { Text("Tipo de documento *") }, modifier = Modifier.fillMaxWidth(), readOnly = operationKind == OperationKind.CREATE_CUSTOMER)
                            OutlinedTextField(draftDocumentNumber, { draftDocumentNumber = it }, label = { Text("Número de documento *") }, modifier = Modifier.fillMaxWidth(), readOnly = operationKind == OperationKind.CREATE_CUSTOMER)
                            OutlinedTextField(draftPhone, { draftPhone = it }, label = { Text("Teléfono") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftEmail, { draftEmail = it }, label = { Text("Correo") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftOccupation, { draftOccupation = it }, label = { Text("Ocupación") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftPersonNote, { draftPersonNote = it }, label = { Text("Nota de persona") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftDepartment, { draftDepartment = it }, label = { Text("Departamento") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftCity, { draftCity = it }, label = { Text("Ciudad") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftNeighborhood, { draftNeighborhood = it }, label = { Text("Barrio") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftAddress, { draftAddress = it }, label = { Text("Calle") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftMaxCredit, { draftMaxCredit = it }, label = { Text(if (operationKind == OperationKind.CREATE_CUSTOMER) "Máximo cupo que apruebo *" else "Límite de crédito *") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                            if (operationKind == OperationKind.CREATE_CUSTOMER) Text(
                                if (session?.isSuperAdministrator == true) "Super Administrador: sin límite de empleado."
                                else "Máximo autorizado del empleado: ${session?.employeeMaxCredit ?: "desconocido; inicia sesión en línea"}"
                            )
                            OutlinedTextField(draftNickname, { draftNickname = it }, label = { Text("Apodo") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftCustomerNote, { draftCustomerNote = it }, label = { Text("Nota de cliente") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftCustomerStatus, { draftCustomerStatus = it }, label = { Text("Estado de cliente") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(draftGuarantorPersonId, { draftGuarantorPersonId = it }, label = { Text("ID persona fiador (opcional)") }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                        }
                        OperationKind.CREATE_CREDIT -> {
                            val originCredit = rows.firstOrNull { it.credit.id == selectedCreditId }?.credit
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
                                Text("Posición respecto a «Aquí vas»", style = MaterialTheme.typography.labelLarge)
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
                            PaymentMethodPicker(
                                bankAccounts, draftPaymentMethod, { draftPaymentMethod = it },
                                "¿Cuánto del costo salió de esta cuenta?",
                                requireSelection = true
                            )
                            Text(
                                if (session?.isSuperAdministrator == true)
                                    "Si se amplía el cupo del cliente, Super Administrador no tiene límite de empleado."
                                else "Si hace falta ampliar el cupo, el servidor verificará tus permisos y que la deuda existente más este capital no exceda tu máximo autorizado (${session?.employeeMaxCredit ?: "desconocido"})."
                            )
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
                                if (draftInitialPayment.toBigDecimalOrNull()?.signum() == 1) PaymentMethodPicker(
                                    bankAccounts, draftInitialPaymentMethod, { draftInitialPaymentMethod = it },
                                    "¿Cuánto entró a esta cuenta?", draftInitialPayment,
                                    requireSelection = true,
                                    selectionLabel = "¿Quién recibió la cuota inicial? *",
                                    accountLabel = "Cuenta que recibió la cuota inicial; el efectivo queda a cargo de quien la registra"
                                )
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
                            if (operationKind in setOf(OperationKind.CREATE_PAYMENT, OperationKind.UPDATE_PAYMENT)) PaymentMethodPicker(
                                bankAccounts, draftPaymentMethod, { draftPaymentMethod = it },
                                "¿Cuánto entró por banco?", draftPaymentAmount, allowChange = true,
                                allowKeep = operationKind == OperationKind.UPDATE_PAYMENT
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
                        OperationKind.ADD_CUSTOMER_PHONE, OperationKind.SELECT_CUSTOMER_PHONE, OperationKind.SET_CUSTOMER_PHONE_VALIDITY, OperationKind.RECORD_WHATSAPP_OPEN,
                        OperationKind.RECORD_WHATSAPP_RECEIPT,
                        OperationKind.UPDATE_DOCUMENT, OperationKind.CREATE_EXPENSE,
                        OperationKind.UPDATE_EXPENSE, OperationKind.DELETE_EXPENSE,
                        OperationKind.CREATE_BASE, OperationKind.UPDATE_BASE, OperationKind.DELETE_BASE,
                        OperationKind.CREATE_LOCATION, OperationKind.DELETE_LOCATION ->
                            Text("Los gastos y las bases se anotan en la pantalla «Gastos y bases».")
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

    whatsAppOffer?.let { offer ->
        var editedMessage by remember(offer) { mutableStateOf(offer.message) }
        var availablePhones by remember(offer) { mutableStateOf(rankedWhatsAppPhones(offer.phones, offer.phone)) }
        var selectedPhone by remember(offer) { mutableStateOf(availablePhones.firstOrNull()?.normalizedPhone) }
        var opening by remember(offer) { mutableStateOf(false) }
        var loadingPhones by remember(offer) { mutableStateOf(true) }
        var receiptFormat by remember(offer) { mutableStateOf(canonicalReceiptFormat(offer.receiptFormat)) }
        var receiptFormatMenu by remember(offer) { mutableStateOf(false) }
        var receiptLink by remember(offer) { mutableStateOf<com.backendcreditos.mobile.network.ReceiptLinkDto?>(null) }
        var receiptLinkError by remember(offer) {
            mutableStateOf(if (offer.receipt != null && !online) "Se necesita conexión al servidor para emitir un enlace válido." else null)
        }
        var receiptLinkOpened by remember(offer) { mutableStateOf(false) }
        var confirmLinkRevocation by remember(offer) { mutableStateOf(false) }
        LaunchedEffect(offer) {
            try {
                val current = session
                if (current != null && current.accountKey == offer.accountKey && offer.branchId != null && offer.customerId != null) {
                    if (online) app.repository.openCustomer(current, offer.branchId, offer.customerId)
                    val fresh = app.database.localDao().customer(current.accountKey, offer.branchId, offer.customerId)
                    if (fresh != null) {
                        availablePhones = rankedWhatsAppPhones(app.repository.savedPhones(fresh), fresh.phone)
                        selectedPhone = availablePhones.firstOrNull()?.normalizedPhone
                    }
                }
            } catch (error: Exception) {
                notice = "No se pudo actualizar el historial; se muestran los teléfonos guardados en este dispositivo."
            } finally {
                loadingPhones = false
            }
        }
        fun closeOffer() {
            if (opening) return
            val link = receiptLink
            val current = session
            if (link != null && !receiptLinkOpened && current != null && offer.branchId != null) {
                opening = true
                scope.launch {
                    try {
                        when (val result = app.api.revokeReceiptLink(current.token, offer.branchId, link.id)) {
                            is ApiResult.Success -> notice = "Enlace no compartido revocado."
                            is ApiResult.AuthExpired -> notice = result.message
                            is ApiResult.Conflict -> notice = result.message
                            is ApiResult.PermissionRejected -> notice = result.message
                            is ApiResult.Rejected -> notice = "El enlace quedó activo hasta revocarlo o vencer: ${result.message}"
                            is ApiResult.Retryable -> notice = "No se confirmó la revocación; el enlace puede seguir activo: ${result.message}"
                        }
                    } catch (error: Exception) {
                        notice = "No se confirmó la revocación; el enlace puede seguir activo: ${error.message ?: "error de conexión"}."
                    } finally {
                        whatsAppOffer = null
                        opening = false
                    }
                }
            } else {
                whatsAppOffer = null
            }
        }
        AlertDialog(
            onDismissRequest = { closeOffer() },
            title = { Text(offer.title) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "Destinatario para ${offer.customerName.ifBlank { "el cliente" }}. Se sugiere el número con más aperturas compartidas entre todos los cobradores.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    if (offer.receipt != null) {
                        Text("Formato del comprobante", style = MaterialTheme.typography.labelMedium)
                        Box {
                            OutlinedButton(
                                enabled = !opening && receiptLink == null,
                                onClick = { receiptFormatMenu = true }
                            ) {
                                Text(receiptFormat?.replaceFirstChar(Char::uppercase) ?: "Elige Ticket, Factura o Cartulina")
                            }
                            DropdownMenu(expanded = receiptFormatMenu, onDismissRequest = { receiptFormatMenu = false }) {
                                RECEIPT_FORMAT_CHOICES.forEach { option ->
                                    DropdownMenuItem(
                                        text = { Text(option.replaceFirstChar(Char::uppercase)) },
                                        onClick = { receiptFormat = option; receiptFormatMenu = false }
                                    )
                                }
                            }
                        }
                        Text("El enlace requiere que el registro ya esté sincronizado. Vence en 30 días; quien lo tenga podrá ver y descargar este snapshot.",
                            style = MaterialTheme.typography.bodySmall)
                        receiptLink?.let { link ->
                            Text("Enlace listo. Vence: ${link.expiresAt}", style = MaterialTheme.typography.bodySmall)
                            TextButton(enabled = !opening, onClick = { confirmLinkRevocation = true }) {
                                Text("Revocar enlace")
                            }
                        }
                        receiptLinkError?.let { error ->
                            Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    Column(Modifier.heightIn(max = 200.dp).verticalScroll(rememberScrollState())) {
                        availablePhones.forEach { phone ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                RadioButton(selected = selectedPhone == phone.normalizedPhone,
                                    enabled = !opening && !loadingPhones,
                                    onClick = { selectedPhone = phone.normalizedPhone })
                                Text("+${phone.normalizedPhone} · ${phone.whatsappOpenCount} aperturas" +
                                    if (phone.pendingOpenIds.isEmpty()) "" else " (${phone.pendingOpenIds.size} pendientes locales)",
                                    style = MaterialTheme.typography.bodySmall)
                            }
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(selected = selectedPhone == null, enabled = !opening && !loadingPhones,
                                onClick = { selectedPhone = null })
                            Text(if (offer.receipt != null) "Elegir contacto en WhatsApp (no suma a ningún teléfono)"
                                else "Elegir contacto en WhatsApp (sin contar)", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    Text("Cuenta aperturas, no mensajes enviados ni entregados. No cambia el teléfono principal.",
                        style = MaterialTheme.typography.bodySmall)
                    if (loadingPhones) Text("Actualizando teléfonos…")
                    OutlinedTextField(
                        editedMessage, { editedMessage = it },
                        label = { Text("Mensaje") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Column(horizontalAlignment = Alignment.End) {
                    TextButton(
                        enabled = !opening && !loadingPhones &&
                            (offer.receipt == null || receiptLink != null || receiptFormat != null),
                        onClick = {
                            val target = offer.receipt
                            if (target != null && receiptLink == null) {
                                val current = session
                                val branch = offer.branchId
                                val customer = offer.customerId
                                if (!online || current == null || branch == null || customer == null || receiptFormat == null) {
                                    receiptLinkError = when {
                                        !online -> "Sin conexión: el servidor debe emitir el enlace después de sincronizar el registro."
                                        receiptFormat == null -> "Elige explícitamente un formato compatible."
                                        else -> "No se pudo verificar la cuenta, sucursal o cliente."
                                    }
                                    return@TextButton
                                }
                                opening = true
                                receiptLinkError = null
                                scope.launch {
                                    try {
                                        when (val result = app.api.issueReceiptLink(
                                            current.token, branch, customer, target.kind.wire, target.recordId, receiptFormat!!
                                        )) {
                                            is ApiResult.Success -> {
                                                val issued = result.value.issueReceiptLink
                                                receiptLink = issued
                                                editedMessage = appendReceiptLink(editedMessage, issued.url)
                                                receiptLinkError = null
                                            }
                                            is ApiResult.AuthExpired -> receiptLinkError = result.message
                                            is ApiResult.Conflict -> receiptLinkError = result.message
                                            is ApiResult.PermissionRejected -> receiptLinkError = result.message
                                            is ApiResult.Rejected -> receiptLinkError = result.message
                                            is ApiResult.Retryable -> receiptLinkError =
                                                "No se pudo emitir el enlace. Revisa conexión y sincronización: ${result.message}"
                                        }
                                    } catch (error: Exception) {
                                        receiptLinkError = "No se pudo emitir el enlace: ${error.message ?: "error de conexión"}."
                                    } finally { opening = false }
                                }
                            } else {
                                opening = true
                                scope.launch {
                                    try {
                                        if (openWhatsApp(offer.copy(phone = selectedPhone, message = editedMessage))) {
                                            receiptLinkOpened = receiptLink != null
                                            whatsAppOffer = null
                                        }
                                    } finally { opening = false }
                                }
                            }
                        }
                    ) {
                        Text(
                            when {
                                opening -> "Procesando…"
                                offer.receipt != null && receiptLink == null -> "Emitir enlace y añadir al mensaje"
                                else -> "Abrir WhatsApp"
                            }
                        )
                    }
                    if (offer.receipt != null && receiptLink == null && receiptLinkError != null) {
                        TextButton(enabled = !opening && !loadingPhones, onClick = {
                            opening = true
                            scope.launch {
                                try {
                                    if (openWhatsApp(offer.copy(phone = selectedPhone, message = editedMessage))) {
                                        whatsAppOffer = null
                                    }
                                } finally { opening = false }
                            }
                        }) { Text("Enviar solo texto") }
                        TextButton(enabled = !opening, onClick = { closeOffer() }) {
                            Text("Esperar sincronización")
                        }
                    }
                }
            },
            dismissButton = { TextButton(enabled = !opening, onClick = { closeOffer() }) { Text("Ahora no") } }
        )
        if (confirmLinkRevocation) {
            AlertDialog(
                onDismissRequest = { confirmLinkRevocation = false },
                title = { Text("Revocar enlace") },
                text = { Text("El enlace dejará de funcionar para cualquier persona que lo haya recibido.") },
                confirmButton = {
                    TextButton(enabled = !opening, onClick = {
                        val current = session
                        val branch = offer.branchId
                        val link = receiptLink
                        if (current == null || branch == null || link == null) {
                            receiptLinkError = "No se pudo verificar la sesión para revocar el enlace."
                            confirmLinkRevocation = false
                        } else {
                            opening = true
                            scope.launch {
                                try {
                                    when (val result = app.api.revokeReceiptLink(current.token, branch, link.id)) {
                                        is ApiResult.Success -> {
                                            editedMessage = removeReceiptLink(editedMessage, link.url)
                                            receiptLink = null
                                            receiptLinkError = "Enlace revocado. Emite uno nuevo solo si todavía lo necesitas."
                                        }
                                        is ApiResult.AuthExpired -> receiptLinkError = result.message
                                        is ApiResult.Conflict -> receiptLinkError = result.message
                                        is ApiResult.PermissionRejected -> receiptLinkError = result.message
                                        is ApiResult.Rejected -> receiptLinkError = result.message
                                        is ApiResult.Retryable -> receiptLinkError = "No se pudo confirmar la revocación: ${result.message}"
                                    }
                                } catch (error: Exception) {
                                    receiptLinkError = "No se pudo confirmar la revocación: ${error.message ?: "error de conexión"}."
                                } finally {
                                    confirmLinkRevocation = false
                                    opening = false
                                }
                            }
                        }
                    }) { Text("Revocar") }
                },
                dismissButton = {
                    TextButton(onClick = { confirmLinkRevocation = false }) { Text("Cancelar") }
                }
            )
        }
    }

    if (showReceiptLinkManager) {
        AlertDialog(
            onDismissRequest = { if (!receiptLinkManagerBusy) showReceiptLinkManager = false },
            title = { Text("Enlaces compartidos activos") },
            text = {
                Column(Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState())) {
                    if (receiptLinkSummaries.isEmpty()) {
                        Text("No hay enlaces activos en esta sucursal.")
                    } else receiptLinkSummaries.forEach { link ->
                        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text(
                                "${link.format.replaceFirstChar(Char::uppercase)} · ${link.receiptType} " +
                                    "${link.receiptSeries.takeIf(String::isNotBlank)?.let { "$it · " }.orEmpty()}N° ${link.receiptNumber}",
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Text("Vence: ${link.expiresAt}", style = MaterialTheme.typography.bodySmall)
                            TextButton(
                                enabled = !receiptLinkManagerBusy,
                                onClick = { receiptLinkToRevoke = link }
                            ) { Text("Revocar este enlace") }
                            HorizontalDivider()
                        }
                    }
                    if (receiptLinkManagerHasMore) {
                        TextButton(
                            enabled = !receiptLinkManagerBusy,
                            onClick = { loadOlderReceiptLinks() }
                        ) {
                            Text(if (receiptLinkManagerBusy) "Cargando…" else "Cargar enlaces anteriores")
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showReceiptLinkManager = false }) { Text("Cerrar") }
            },
            dismissButton = {}
        )
    }

    receiptLinkToRevoke?.let { link ->
        AlertDialog(
            onDismissRequest = { if (!receiptLinkManagerBusy) receiptLinkToRevoke = null },
            title = { Text("Revocar comprobante") },
            text = { Text("El enlace del comprobante N° ${link.receiptNumber} dejará de funcionar para todos.") },
            confirmButton = {
                TextButton(enabled = !receiptLinkManagerBusy, onClick = {
                    val current = session
                    val branch = receiptLinkManagerBranch
                    if (current == null || branch == null) {
                        notice = "Inicia sesión y vuelve a cargar los enlaces de la sucursal."
                        receiptLinkToRevoke = null
                    } else {
                        receiptLinkManagerBusy = true
                        scope.launch {
                            try {
                                when (val result = app.api.revokeReceiptLink(current.token, branch, link.id)) {
                                    is ApiResult.Success -> {
                                        receiptLinkSummaries = receiptLinkSummaries.filterNot { it.id == link.id }
                                        notice = "Enlace revocado."
                                    }
                                    is ApiResult.AuthExpired -> notice = result.message
                                    is ApiResult.Conflict -> notice = result.message
                                    is ApiResult.PermissionRejected -> notice = result.message
                                    is ApiResult.Rejected -> notice = result.message
                                    is ApiResult.Retryable -> notice = "No se confirmó la revocación: ${result.message}"
                                }
                            } catch (error: Exception) {
                                notice = "No se confirmó la revocación: ${error.message ?: "error de conexión"}."
                            } finally {
                                receiptLinkToRevoke = null
                                receiptLinkManagerBusy = false
                            }
                        }
                    }
                }) { Text("Revocar") }
            },
            dismissButton = {
                TextButton(enabled = !receiptLinkManagerBusy, onClick = { receiptLinkToRevoke = null }) {
                    Text("Cancelar")
                }
            }
        )
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

    if (showRouteSweepConfirmation) {
        AlertDialog(
            onDismissRequest = { showRouteSweepConfirmation = false },
            title = { Text("Quitar de la cola") },
            text = {
                Text(
                    "Se van a quitar todos los registros detenidos porque su ruta ya no está abierta, y también los " +
                        "que dependían de ellos. No se van a registrar en la oficina y no se puede deshacer. " +
                        "Queda la lista en Actividad por si necesitas copiarla."
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    showRouteSweepConfirmation = false
                    scope.launch {
                        busy = true
                        try {
                            val current = requireNotNull(session)
                            val removed = app.repository.discardAllRouteBlockedOperations(current)
                            loadLocal()
                            loadOperations()
                            enqueuePendingBranches(current)
                            notice = "Se quitaron $removed registros de la cola. Mira la lista en Actividad."
                        } finally { busy = false }
                    }
                }) { Text("Sí, quitarlos") }
            },
            dismissButton = {
                TextButton(onClick = { showRouteSweepConfirmation = false }) { Text("No, dejarlos") }
            }
        )
    }

    if (showLocationNameDialog) {
        AlertDialog(
            onDismissRequest = { showLocationNameDialog = false },
            title = { Text("Marcar ubicación aquí") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Escribe un nombre corto para este punto de cobro.")
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("Casa", "Negocio", "Trabajo").forEach { option ->
                            FilterChip(
                                selected = locationNameDraft == option,
                                onClick = { locationNameDraft = option },
                                label = { Text(option) }
                            )
                        }
                    }
                    OutlinedTextField(
                        value = locationNameDraft,
                        onValueChange = { locationNameDraft = it.take(40) },
                        label = { Text("Nombre (máx. 40)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    val safeName = locationNameDraft.trim()
                    if (safeName.isBlank()) {
                        notice = "Escribe un nombre para la ubicación."
                    } else {
                        showLocationNameDialog = false
                        scope.launch {
                            busy = true
                            markLocationHere(safeName)
                            busy = false
                        }
                    }
                }) { Text("Guardar con GPS") }
            },
            dismissButton = { TextButton(onClick = { showLocationNameDialog = false }) { Text("Cancelar") } }
        )
    }

    locationToDelete?.let { target ->
        AlertDialog(
            onDismissRequest = { locationToDelete = null },
            title = { Text("Eliminar ubicación") },
            text = { Text("Se eliminará «${target.name}» de esta tarjeta y se enviará el cambio al servidor.") },
            confirmButton = {
                TextButton(onClick = {
                    locationToDelete = null
                    scope.launch {
                        busy = true
                        deleteLocation(target)
                        busy = false
                    }
                }) { Text("Eliminar") }
            },
            dismissButton = { TextButton(onClick = { locationToDelete = null }) { Text("Cancelar") } }
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

}
