package com.backendcreditos.mobile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.GenericShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

internal data class RatingBadgeColors(val container: Color, val content: Color)

internal fun ratingBadgeColors(category: CustomerRatingCategory): RatingBadgeColors = when (category) {
    CustomerRatingCategory.EXCELLENT -> RatingBadgeColors(Color(0xFF2E7D32), Color.White)
    CustomerRatingCategory.GOOD -> RatingBadgeColors(Color(0xFF1565C0), Color.White)
    CustomerRatingCategory.REGULAR -> RatingBadgeColors(Color(0xFFF9A825), Color(0xFF3E2723))
    CustomerRatingCategory.FOLLOW_UP -> RatingBadgeColors(Color(0xFFC62828), Color.White)
    CustomerRatingCategory.INITIAL -> RatingBadgeColors(Color(0xFF00838F), Color.White)
    CustomerRatingCategory.PENDING -> RatingBadgeColors(Color(0xFF757575), Color.White)
    CustomerRatingCategory.UNRECOGNIZED -> RatingBadgeColors(Color(0xFF455A64), Color.White)
}

// Ribbon end: a flat left edge and a swallow-tail notch on the right, so the label reads as a
// tag without rotating text (rotated long labels such as "Requiere seguimiento" get clipped).
private val RibbonShape = GenericShape { size: Size, _ ->
    val notch = size.height * 0.32f
    moveTo(0f, 0f)
    lineTo(size.width, 0f)
    lineTo(size.width - notch, size.height / 2f)
    lineTo(size.width, size.height)
    lineTo(0f, size.height)
    close()
}

@Composable
fun CustomerRatingBadge(info: RatingBadgeInfo, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val colors = ratingBadgeColors(info.category)
    val description = "${info.description}. Ver detalle de la calificación"
    // The outer box keeps a 48dp touch target while the ribbon itself stays compact.
    Box(
        modifier
            .heightIn(min = 48.dp)
            .clickable(onClickLabel = "Ver calificación", onClick = onClick)
            .semantics(mergeDescendants = true) {
                contentDescription = description
                role = Role.Button
            },
        contentAlignment = Alignment.Center
    ) {
        Text(
            info.text,
            color = colors.content,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier
                .widthIn(max = 210.dp)
                .background(colors.container, RibbonShape)
                .padding(start = 10.dp, end = 16.dp, top = 4.dp, bottom = 4.dp)
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CustomerRatingDialog(
    state: RatingDialogState,
    online: Boolean,
    onDismiss: () -> Unit,
    onReload: () -> Unit,
    onStartEdit: () -> Unit,
    onScore: (Int) -> Unit,
    onReason: (String) -> Unit,
    onCancelEdit: () -> Unit,
    onRequestConfirm: () -> Unit,
    onBackFromConfirm: () -> Unit,
    onConfirm: () -> Unit
) {
    val access = ratingEditorAccess(online, state.locallyCreated, state.remote)
    val editorOpen = state.editing && access == RatingEditorAccess.ALLOWED
    // Reading is harmless, so a retry is offered even when the app believes it is offline.
    val canReload = !state.locallyCreated && !state.loading
    if (state.confirming) {
        AlertDialog(
            onDismissRequest = { if (!state.saving) onBackFromConfirm() },
            title = { Text("Confirmar calificación") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(state.customerName, fontWeight = FontWeight.Bold)
                    Text("Nota actual: ${state.badge.text}")
                    Text("Nueva nota: ${customerRatingText(state.draftScore)}")
                    Text("Motivo: ${state.draftReason.trim()}")
                    Text(MANUAL_PRIORITY_NOTICE)
                    Text("Se guardará en el servidor con tu usuario y quedará en el historial.")
                    if (state.saving) Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(Modifier.padding(end = 8.dp))
                        Text("Guardando…")
                    }
                }
            },
            confirmButton = {
                Button(enabled = canSubmitRating(state, online), onClick = onConfirm) { Text("Guardar nota") }
            },
            dismissButton = {
                TextButton(enabled = !state.saving, onClick = onBackFromConfirm) { Text("Revisar") }
            }
        )
        return
    }
    AlertDialog(
        onDismissRequest = { if (!state.saving) onDismiss() },
        title = { Text("Calificación del cliente") },
        text = {
            Column(
                Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(state.customerName, fontWeight = FontWeight.Bold)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Nota actual: ")
                    Text(
                        state.badge.text,
                        fontWeight = FontWeight.Bold,
                        color = ratingBadgeColors(state.badge.category).container
                    )
                }
                state.remote?.let { remote ->
                    ratingDetailLines(remote).forEach { Text(it) }
                    Text(remote.explanation, style = MaterialTheme.typography.bodyMedium)
                }
                Text(
                    "Escala: 9-10 Excelente · 7-8 Bueno · 5-6 Regular · 1-4 Requiere seguimiento. " +
                        "Con poca historia la nota es $INITIAL_POLICY_SCORE/10 Inicial.",
                    style = MaterialTheme.typography.bodySmall
                )
                if (state.loading) Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(Modifier.padding(end = 8.dp))
                    Text("Consultando el servidor…")
                }
                if (!state.loading) ratingCacheNotice(state)?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                if (state.loadError.isNotBlank()) {
                    Text(state.loadError, color = MaterialTheme.colorScheme.error)
                }
                if (!state.loading) ratingEditorNotice(access)?.let {
                    if (access != RatingEditorAccess.NOT_LOADED || state.loadError.isBlank()) Text(it)
                }
                if (editorOpen) {
                    HorizontalDivider()
                    Text("Nueva nota", style = MaterialTheme.typography.titleSmall)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        (1..10).forEach { value ->
                            FilterChip(
                                selected = state.draftScore == value,
                                enabled = !state.saving,
                                onClick = { onScore(value) },
                                label = { Text(value.toString()) },
                                modifier = Modifier.semantics {
                                    contentDescription = "Nota $value, ${CustomerRatingCategory.of(value).label}"
                                }
                            )
                        }
                    }
                    Text(
                        state.draftScore?.let { "Seleccionada: ${customerRatingText(it)}" } ?: "Ninguna nota seleccionada",
                        fontWeight = FontWeight.Bold
                    )
                    OutlinedTextField(
                        state.draftReason,
                        onReason,
                        enabled = !state.saving,
                        label = { Text("Motivo *") },
                        supportingText = {
                            Text("${ratingReasonLength(state.draftReason)}/$RATING_REASON_MAX · mínimo $RATING_REASON_MIN caracteres")
                        },
                        minLines = 2,
                        modifier = Modifier.fillMaxWidth()
                    )
                    ratingInputError(state.draftScore, state.draftReason)?.let {
                        Text(it, style = MaterialTheme.typography.bodySmall)
                    }
                }
                if (state.saveError.isNotBlank()) Text(state.saveError, color = MaterialTheme.colorScheme.error)
                if (state.editing && !editorOpen && state.draftScore != null) {
                    Text("Borrador conservado: ${customerRatingText(state.draftScore)} · ${state.draftReason.trim()}",
                        style = MaterialTheme.typography.bodySmall)
                }
                state.remote?.let { remote ->
                    HorizontalDivider()
                    Text("Historial", style = MaterialTheme.typography.titleSmall)
                    if (remote.history.isEmpty()) Text("Sin cambios registrados.")
                    remote.history.forEach { entry ->
                        Column {
                            Text(
                                "${ratingHistoryScoreText(entry.previousScore)} → ${ratingHistoryScoreText(entry.score)}",
                                fontWeight = FontWeight.Bold
                            )
                            Text(entry.reason)
                            Text(
                                "${formatRatingHistoryTime(entry.createdAt)} · ${ratingSourceLabel(entry.source)}" +
                                    if (entry.source == RatingSource.MANUAL.wire) " · usuario #${entry.createdBy}" else "",
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            when {
                editorOpen -> Button(enabled = canSubmitRating(state, online), onClick = onRequestConfirm) {
                    Text("Continuar")
                }
                access == RatingEditorAccess.ALLOWED -> Button(
                    enabled = !state.loading && !state.saving, onClick = onStartEdit
                ) { Text("Cambiar nota") }
                canReload -> OutlinedButton(onClick = onReload) {
                    Text(if (state.remote == null) "Consultar historial" else "Actualizar")
                }
                else -> TextButton(onClick = onDismiss) { Text("Cerrar") }
            }
        },
        dismissButton = {
            when {
                editorOpen -> TextButton(enabled = !state.saving, onClick = onCancelEdit) { Text("Cancelar edición") }
                access == RatingEditorAccess.ALLOWED || canReload -> TextButton(enabled = !state.saving, onClick = onDismiss) {
                    Text("Cerrar")
                }
            }
        }
    )
}
