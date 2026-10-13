package com.backendcreditos.mobile

import com.backendcreditos.mobile.network.CustomerRatingDto

const val RATING_REASON_MIN = 5
const val RATING_REASON_MAX = 500

// Policy score for a customer with too little history (raw 'nuevo' / '' or confidence 'initial').
const val INITIAL_POLICY_SCORE = 5

enum class CustomerRatingCategory(val label: String) {
    EXCELLENT("Excelente"),
    GOOD("Bueno"),
    REGULAR("Regular"),
    FOLLOW_UP("Requiere seguimiento"),
    INITIAL("Inicial, poca historia"),
    // Cache column is NULL: the rating was never downloaded to this phone. Not a real rating.
    PENDING("Nota pendiente de sincronizar"),
    // The server holds a value outside the contract ('abc', ' 7 ', '0'…). Shown as is, never as a score.
    UNRECOGNIZED("Nota por revisar");

    companion object {
        fun of(score: Int?): CustomerRatingCategory = when (score) {
            in 9..10 -> EXCELLENT
            in 7..8 -> GOOD
            in 5..6 -> REGULAR
            in 1..4 -> FOLLOW_UP
            else -> UNRECOGNIZED
        }
    }
}

enum class RatingSource(val wire: String, val label: String) {
    MANUAL("manual", "Manual"), AUTOMATIC("automatic", "Automática");

    companion object {
        fun fromWire(value: String?): RatingSource? = entries.firstOrNull { it.wire == value }
    }
}

enum class RatingConfidence(val wire: String, val label: String) {
    INITIAL("initial", "Inicial · poca historia"),
    LIMITED("limited", "Limitada · historia corta"),
    ESTABLISHED("established", "Establecida · historia suficiente");

    companion object {
        fun fromWire(value: String?): RatingConfidence? = entries.firstOrNull { it.wire == value }
    }
}

/**
 * tbl_clientes.str_calificacion holds '1'..'10'. 'nuevo' / '' mean the initial policy (see
 * [ratingBadgeInfo]); anything else is not a score. Parsing stays nullable on purpose: only an
 * exact '1'..'10' becomes a number.
 */
fun parseCustomerRatingScore(raw: String?): Int? {
    // Exact match like the backend: padded values such as ' 7 ' or '07' are not a score.
    if (raw == null || raw.isEmpty() || raw.length > 2 || !raw.all { it in '0'..'9' } || raw[0] == '0') return null
    return raw.toInt().takeIf { it in 1..10 }
}

fun isInitialRawRating(raw: String?): Boolean = raw == "nuevo" || raw == ""

/** Reason length as the backend counts it: Unicode code points of the trimmed text, not UTF-16 units. */
fun ratingReasonLength(reason: String): Int = reason.trim().let { it.codePointCount(0, it.length) }

/** Plain score text, for drafts and history values. Null means "no value", not a rating. */
fun customerRatingText(score: Int?): String =
    if (score == null || score !in 1..10) "Sin nota" else "$score/10 · ${CustomerRatingCategory.of(score).label}"

data class RatingBadgeInfo(val score: Int?, val category: CustomerRatingCategory, val text: String, val description: String)

/**
 * What the ribbon shows for a cached or downloaded rating.
 * - [locallyCreated]: the customer only exists on this phone; provisional initial policy score.
 * - raw null: never downloaded to this phone (e.g. right after the APK update) → pending, not a score.
 * - 'nuevo' / '' or confidence 'initial': initial policy, 5/10 with little history.
 * - '1'..'10': that score and its category.
 * - anything else: unrecognized, never converted into a score.
 */
fun ratingBadgeInfo(
    raw: String?, confidence: String?, locallyCreated: Boolean = false, source: String? = null
): RatingBadgeInfo {
    // Backend contract (same rule as web): 'Inicial' when raw isn't numeric, or confidence is
    // 'initial' and the source isn't manual. Metadata outside the contract is flagged, not guessed.
    val initial = CustomerRatingCategory.INITIAL
    val score = parseCustomerRatingScore(raw)
    val badMetadata = (source != null && RatingSource.fromWire(source) == null) ||
        (confidence != null && RatingConfidence.fromWire(confidence) == null)
    val initialPolicy = confidence == RatingConfidence.INITIAL.wire && source != RatingSource.MANUAL.wire
    return when {
        locallyCreated -> RatingBadgeInfo(
            INITIAL_POLICY_SCORE, initial, "$INITIAL_POLICY_SCORE/10 · Inicial provisional",
            "Nota inicial provisional $INITIAL_POLICY_SCORE de 10: el cliente aún no está sincronizado"
        )
        raw == null -> RatingBadgeInfo(
            null, CustomerRatingCategory.PENDING, CustomerRatingCategory.PENDING.label,
            "Nota pendiente de sincronizar con el servidor"
        )
        isInitialRawRating(raw) -> RatingBadgeInfo(
            INITIAL_POLICY_SCORE, initial, "$INITIAL_POLICY_SCORE/10 · ${initial.label}",
            "Calificación inicial $INITIAL_POLICY_SCORE de 10, poca historia"
        )
        score == null || badMetadata -> RatingBadgeInfo(
            null, CustomerRatingCategory.UNRECOGNIZED, CustomerRatingCategory.UNRECOGNIZED.label,
            "Nota no reconocida; consulta el detalle con conexión"
        )
        initialPolicy -> RatingBadgeInfo(
            score, initial, "$score/10 · ${initial.label}", "Calificación inicial $score de 10, poca historia"
        )
        else -> CustomerRatingCategory.of(score).let {
            RatingBadgeInfo(score, it, "$score/10 · ${it.label}", "Calificación $score de 10, ${it.label}")
        }
    }
}

/** Badge text for a raw value without confidence (e.g. the card assessment screen). */
fun customerRatingText(raw: String?, confidence: String?, source: String? = null): String =
    ratingBadgeInfo(raw, confidence, source = source).text

/** History createdAt is UTC ISO-8601 (e.g. 2026-10-13T14:05:09.123Z); shown in the phone's zone. Unparseable values are shown as sent. */
fun formatRatingHistoryTime(createdAt: String, zone: java.time.ZoneId = java.time.ZoneId.systemDefault()): String =
    try {
        java.time.Instant.parse(createdAt).atZone(zone)
            .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))
    } catch (error: java.time.format.DateTimeParseException) {
        createdAt
    }

fun CustomerRatingDto.currentScore(): Int? = score?.takeIf { it in 1..10 } ?: parseCustomerRatingScore(rawRating)

/** Confidence that qualifies the stored rating: only an automatic effective rating carries one. */

private val ISO_UTC = Regex("""\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z""")

private fun isIsoUtc(value: String): Boolean =
    ISO_UTC.matches(value) && try {
        java.time.Instant.parse(value); true
    } catch (error: java.time.format.DateTimeParseException) {
        false
    }

/**
 * Rejects a customerRating answer that breaks the contract instead of guessing a fallback.
 * Returns the problem, or null when the answer is usable.
 */
fun customerRatingContractError(dto: CustomerRatingDto): String? = when {
    dto.score != null && dto.score !in 1..10 -> "nota fuera de 1..10 (${dto.score})"
    dto.automaticScore !in 1..10 -> "nota automática fuera de 1..10 (${dto.automaticScore})"
    RatingSource.fromWire(dto.source) == null -> "fuente desconocida '${dto.source}'"
    RatingConfidence.fromWire(dto.confidence) == null -> "confianza desconocida '${dto.confidence}'"
    dto.explanation.isBlank() -> "falta la explicación"
    dto.rawRating.length > 50 -> "rawRating demasiado largo"
    dto.manualUntil != null && !isIsoUtc(dto.manualUntil) -> "manualUntil no es ISO UTC"
    dto.evaluatedAt != null && !isIsoUtc(dto.evaluatedAt) -> "evaluatedAt no es ISO UTC"
    dto.history.any { RatingSource.fromWire(it.source) == null } -> "historial con fuente desconocida"
    dto.history.any { (it.score != null && it.score !in 1..10) || (it.previousScore != null && it.previousScore !in 1..10) } ->
        "historial con nota fuera de 1..10"
    else -> null
}

const val MANUAL_PRIORITY_DAYS = 7

const val MANUAL_PRIORITY_NOTICE =
    "La nota manual tendrá prioridad durante $MANUAL_PRIORITY_DAYS días. La evaluación automática sigue " +
        "calculándose por debajo y vuelve a aplicarse al vencer; guardar no reinicia el motor automático."

/** In history a null score means the rating went back to the initial policy ('nuevo'). */
fun ratingHistoryScoreText(score: Int?): String =
    score?.let { customerRatingText(it) } ?: ratingBadgeInfo("nuevo", null).text

/**
 * Customer.ratingSource/ratingConfidence as the portfolio/sync sends them: source null and
 * confidence null until the first automatic evaluation, unless a manual rating is in force.
 */
fun CustomerRatingDto.customerSource(): String? =
    if (source == RatingSource.MANUAL.wire) source else source.takeIf { evaluatedAt != null }

fun CustomerRatingDto.customerConfidence(): String? = confidence.takeIf { evaluatedAt != null }

fun ratingSourceLabel(source: String): String = RatingSource.fromWire(source)?.label ?: source

/** Lines that explain where the effective rating comes from; built only from server data. */
fun ratingDetailLines(remote: CustomerRatingDto, zone: java.time.ZoneId = java.time.ZoneId.systemDefault()): List<String> {
    val automatic = if (remote.confidence == RatingConfidence.INITIAL.wire)
        "${remote.automaticScore}/10 · ${CustomerRatingCategory.INITIAL.label}"
    else customerRatingText(remote.automaticScore)
    val lines = mutableListOf("Fuente vigente: ${ratingSourceLabel(remote.source)}")
    if (remote.source == RatingSource.MANUAL.wire) {
        lines += remote.manualUntil?.let {
            "Nota manual vigente hasta ${formatRatingHistoryTime(it, zone)}; después vuelve la automática."
        } ?: "Nota manual sin fecha de vencimiento informada."
    }
    lines += "Automática: $automatic"
    lines += "Confianza: ${RatingConfidence.fromWire(remote.confidence)?.label ?: remote.confidence}"
    lines += "Actualizada: ${formatRatingTime(remote.evaluatedAt, zone)}"
    return lines
}

fun formatRatingTime(value: String?, zone: java.time.ZoneId = java.time.ZoneId.systemDefault()): String =
    value?.let { formatRatingHistoryTime(it, zone) } ?: "aún sin evaluar"

/** Returns the validation message for a manual rating, or null when it can be sent. */
fun ratingInputError(score: Int?, reason: String): String? {
    val length = ratingReasonLength(reason)
    return when {
        score == null || score !in 1..10 -> "Elige una nota entre 1 y 10."
        length < RATING_REASON_MIN -> "Escribe el motivo (mínimo $RATING_REASON_MIN caracteres)."
        length > RATING_REASON_MAX -> "El motivo admite máximo $RATING_REASON_MAX caracteres."
        else -> null
    }
}

enum class RatingEditorAccess { ALLOWED, OFFLINE, UNCONFIRMED_CUSTOMER, NOT_LOADED, NOT_PERMITTED }

/**
 * The editor exists only with a fresh server answer that says canRate, while online. Offline the
 * app shows the cached badge alone: it never invents history nor assumes permission.
 */
fun ratingEditorAccess(online: Boolean, locallyCreated: Boolean, remote: CustomerRatingDto?): RatingEditorAccess = when {
    locallyCreated -> RatingEditorAccess.UNCONFIRMED_CUSTOMER
    !online -> RatingEditorAccess.OFFLINE
    remote == null -> RatingEditorAccess.NOT_LOADED
    !remote.canRate -> RatingEditorAccess.NOT_PERMITTED
    else -> RatingEditorAccess.ALLOWED
}

fun ratingEditorNotice(access: RatingEditorAccess): String? = when (access) {
    RatingEditorAccess.ALLOWED -> null
    RatingEditorAccess.OFFLINE ->
        "Sin conexión: se muestra la calificación guardada en el teléfono. El historial y la edición requieren conexión."
    RatingEditorAccess.UNCONFIRMED_CUSTOMER ->
        "Este cliente aún no está confirmado por el servidor; podrás calificarlo después de sincronizarlo."
    RatingEditorAccess.NOT_LOADED -> "Consulta el servidor para ver el historial y si puedes cambiar la nota."
    RatingEditorAccess.NOT_PERMITTED -> "Solo un administrador de la oficina de este cliente puede cambiar la nota."
}

data class RatingDialogState(
    val accountKey: String,
    val branchId: String,
    val customerId: String,
    val customerName: String,
    val cachedRating: String?,
    val cachedSource: String? = null,
    val cachedConfidence: String? = null,
    val locallyCreated: Boolean = false,
    val remote: CustomerRatingDto? = null,
    val loading: Boolean = false,
    val loadError: String = "",
    val editing: Boolean = false,
    val draftScore: Int? = null,
    val draftReason: String = "",
    val confirming: Boolean = false,
    val saving: Boolean = false,
    val saveError: String = "",
    // Distinguishes two openings of the same customer so a late reply never lands in a newer dialog.
    val instanceId: Long = 0
) {
    val displayScore: Int? get() = badge.score
    val badge: RatingBadgeInfo get() = remote?.let { ratingBadgeInfo(it.rawRating, it.confidence, source = it.source) }
        ?: ratingBadgeInfo(cachedRating, cachedConfidence, locallyCreated, cachedSource)
}

/** The dialog is valid only for the account and branch it was opened in. */
fun ratingDialogBelongsTo(state: RatingDialogState, accountKey: String?, branchId: String?): Boolean =
    state.accountKey == accountKey && state.branchId == branchId

/** A late network reply is applied only to the very dialog that sent the request. */
fun isSameRatingDialog(current: RatingDialogState?, sent: RatingDialogState): Boolean =
    current != null && current.instanceId == sent.instanceId &&
        current.accountKey == sent.accountKey && current.branchId == sent.branchId && current.customerId == sent.customerId

/** Null rating in the local cache means "not downloaded yet" (e.g. right after the APK update). */
fun ratingCacheNotice(state: RatingDialogState): String? =
    if (state.remote == null && state.cachedRating == null && !state.locallyCreated)
        "Nota pendiente de sincronizar: aún no está descargada en este teléfono. Con conexión, usa «Actualizar cartera» o «Consultar historial»."
    else null

const val RATING_RESPONSE_INVALID = "RATING_RESPONSE_INVALID"

const val RATING_SAVE_UNCERTAIN =
    "No se pudo confirmar el guardado. No queda en cola; consulta la nota y el historial antes de reintentar."

/**
 * A timeout or dropped connection may happen after the server committed the rating. Forget the
 * server snapshot (so canSubmitRating stays false until a successful refresh brings the real
 * rawRating) but keep the draft so the admin can retry after checking the history.
 */
fun ratingAfterUncertainSave(state: RatingDialogState): RatingDialogState = state.copy(
    remote = null, saving = false, confirming = false, saveError = RATING_SAVE_UNCERTAIN
)

/** Guards the confirm button: one request at a time, only for an allowed and valid draft. */
fun canSubmitRating(state: RatingDialogState, online: Boolean): Boolean =
    !state.saving && !state.loading && state.editing &&
        ratingEditorAccess(online, state.locallyCreated, state.remote) == RatingEditorAccess.ALLOWED &&
        ratingInputError(state.draftScore, state.draftReason) == null
