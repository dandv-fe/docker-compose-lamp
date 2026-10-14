package com.backendcreditos.mobile

import android.content.Context
import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.backendcreditos.mobile.network.DispatchChallengeDto

@Composable
private fun systemChallengeAnimationScale(): Float {
    val context = LocalContext.current
    fun readScale(): Float {
        val accessibility = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
        if (accessibility.isTouchExplorationEnabled) return 0f
        return minOf(
            Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f),
            Settings.Global.getFloat(context.contentResolver, Settings.Global.TRANSITION_ANIMATION_SCALE, 1f)
        )
    }
    var scale by remember(context) { mutableStateOf(readScale()) }
    DisposableEffect(context) {
        val observer = object : ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean) { scale = readScale() }
        }
        val manager = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
        val listener = AccessibilityManager.TouchExplorationStateChangeListener { scale = readScale() }
        listOf(Settings.Global.ANIMATOR_DURATION_SCALE, Settings.Global.TRANSITION_ANIMATION_SCALE).forEach {
            context.contentResolver.registerContentObserver(Settings.Global.getUriFor(it), false, observer)
        }
        manager.addTouchExplorationStateChangeListener(listener)
        onDispose {
            context.contentResolver.unregisterContentObserver(observer)
            manager.removeTouchExplorationStateChangeListener(listener)
        }
    }
    return scale
}

@Composable
internal fun DispatchChallengesSection(
    state: DispatchChallengesState?, online: Boolean, ledger: ChallengePresentationLedger,
    onRefresh: () -> Unit, onDetails: (String) -> Unit
) {
    val animationScale = systemChallengeAnimationScale()
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Mis retos", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
            TextButton(onClick = onRefresh, enabled = online && state?.loading != true) {
                Text(if (state?.loading == true) "Consultando…" else "Actualizar retos")
            }
        }
        val snapshot = state?.snapshot
        if (snapshot == null && state?.error.isNullOrBlank()) Text(
            if (!online) "Requiere conexión; no hay retos consultados en esta sesión."
            else if (state?.loading == true) "Consultando invitaciones propias…"
            else "Consulta propia en línea."
        )
        state?.error?.takeIf { it.isNotBlank() }?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        if (snapshot != null) {
            if (!online || state.error.isNotBlank()) Text("Última lectura · corte ${snapshot.asOf}; no confirma el avance actual.")
            if (snapshot.items.isEmpty()) Text("No tienes invitaciones de retos al corte ${snapshot.asOf}.")
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                snapshot.items.forEach { item ->
                    val key = challengePresentationKey(item)
                    val size = remember(key) { Animatable(1f) }
                    LaunchedEffect(key, animationScale, ledger) {
                        if (ledger.claim(key, if (online) animationScale else 0f)) {
                            size.snapTo(0.98f)
                            size.animateTo(1f, tween(320))
                        } else size.snapTo(1f)
                    }
                    Card(Modifier.width(300.dp).graphicsLayer { scaleX = size.value; scaleY = size.value }) {
                        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("Oportunidad de superar tu sueldo básico", style = MaterialTheme.typography.titleSmall)
                            Text("${item.branchName} · despacho #${item.routeId}")
                            Text(item.description, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            Text("Hasta ${item.deadline} · +${payrollDetailNumber(item.incrementPercent)}% propuesto")
                            Text(challengeAchievementText(item), style = MaterialTheme.typography.bodySmall)
                            TextButton(onClick = { onDetails(item.challengeId) }) { Text("Ver invitación y avance") }
                        }
                    }
                }
            }
        }
    }
}

@Composable
internal fun DispatchChallengeDialog(
    item: DispatchChallengeDto, asOf: String, stale: Boolean, onDismiss: () -> Unit
) {
    fun money(value: Double) = payrollDetailNumber(value)
    fun percentage(value: Double?) = value?.let { "${money(it)}%" } ?: "No calculable / meta sin porcentaje"
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Oportunidad de superar tu sueldo básico") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(item.description)
                Text("${item.branchName} · cartera #${item.branchId} · despacho #${item.routeId}")
                Text("Invitación: ${item.invitationDate} · fecha límite: ${item.deadline} · corte: $asOf (Colombia)")
                Text(when (item.status) {
                    "active" -> "Invitación activa"
                    "expired" -> "Reto vencido"
                    "closed" -> "Despacho cerrado"
                    else -> "Sin asignación vigente"
                })
                if (stale) Text("Última lectura; requiere conexión para confirmar el avance actual.")
                Text("Invitación, no garantía de ingresos. No crea bonos, pagos ni permisos.")
                Text(challengeAchievementText(item))
                Text("Incremento propuesto: ${money(item.incrementPercent)}%")
                Text("Metas del despacho: capital ${money(item.capitalGoal)} · recaudo ${money(item.collectionGoal)}")
                Text("Tu participación: ${money(item.allocation.weight)}% · tasa capital ${money(item.allocation.capitalRate)}% · tasa recaudo ${money(item.allocation.collectionRate)}%")
                Text("Avance individual neto", style = MaterialTheme.typography.titleSmall)
                val progress = item.progress
                Text("Capital atribuido: ${money(progress.creditedCapital)} / ${money(progress.capitalTarget)} · ${percentage(progress.capitalPercent)}")
                Text("Recaudo atribuido: ${money(progress.creditedCollection)} / ${money(progress.collectionTarget)} · ${percentage(progress.collectionPercent)}")
                Text("Los porcentajes del servidor pueden superar 100% o ser negativos por reversos; no se recortan.")
                Text("Sueldo propio · ${item.salary.startDate} al ${item.salary.endDate}", style = MaterialTheme.typography.titleSmall)
                if (!item.salary.configured) Text("Sin plan de sueldo configurado: no se inventa un básico.")
                Text("Sueldo básico al corte salarial del reto (${item.deadline}): ${money(item.salary.baseAmount)}")
                Text("Ese corte puede ser futuro: es referencia de la meta, no dinero ya ganado ni pendiente de pago hoy.")
                Text("Sueldo básico del período: ${money(item.salary.periodBaseAmount)}")
                Text("Sueldo básico pactado: ${money(item.salary.agreedBaseAmount)}")
                Text("Comisiones realizadas del período propio, todas las rutas una sola vez: ${money(progress.commissionAmount)}")
                Text("Objetivo de comisiones: ${money(progress.targetCommission)} · avance ${percentage(progress.commissionPercent)}")
                Text("No sumes básicos ni comisiones repetidos entre retos.")
                Text(challengeForecastText(item), style = MaterialTheme.typography.titleSmall)
                if (item.forecast.status == "available") {
                    val goal = item.goal
                    Text("Brecha de comisiones: ${money(goal.commissionGap)} · esta ruta ${money(goal.routeCommission)} · otras rutas ${money(goal.otherCommission)}")
                    Text("Capital requerido: ${goal.capitalRequired?.let(::money) ?: "No calculable con esta tasa"}")
                    Text("Recaudo requerido: ${goal.collectionRequired?.let(::money) ?: "No calculable con esta tasa"}")
                    Text("Comisiones proyectadas: ${money(goal.projectedCommission)}")
                    Text("Sueldo proyectado sin bonos: ${money(goal.projectedEarnedWithoutBonuses)}")
                    Text("Excedente estimado: ${money(goal.surplusAmount)} · ${percentage(goal.surplusPercent)}")
                    Text("Proyección solo de actividad objetivo restante; no confirma salario ni pago.")
                }
                item.forecast.collections?.let { collections ->
                    Text("Pronóstico de cuotas · estimado", style = MaterialTheme.typography.titleSmall)
                    if (collections.status == "available") {
                        Text("Cuotas previstas netas de adelantos: ${money(collections.dueAmount)}")
                        Text("Adelantos: ${money(collections.advanceAmount)}")
                        Text("Atrasos separados: ${money(collections.arrearsAmount)}")
                    } else Text("Cuotas no calculables con los datos disponibles; las cifras parciales no son una previsión completa.")
                    Text("Tarjetas: ${collections.cardCount} · con datos inválidos: ${collections.invalidCardCount}")
                    collections.invalidReasons.forEach { Text(it, color = MaterialTheme.colorScheme.error) }
                    collections.warnings.forEach { Text(it) }
                }
                item.forecast.warnings.forEach { Text(it) }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Cerrar") } }
    )
}
