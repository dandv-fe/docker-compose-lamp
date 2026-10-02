package com.backendcreditos.mobile.location

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Looper
import android.os.SystemClock
import androidx.core.content.ContextCompat
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.withTimeoutOrNull
import java.net.URLEncoder

data class LocationFix(
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Int?,
    /** Seconds since Android measured it; > 0 only when we fell back to a recent cached fix. */
    val ageSeconds: Long = 0
)

sealed interface LocationLookup {
    data class Found(val fix: LocationFix) : LocationLookup
    data object ServicesOff : LocationLookup
    data object NoPermission : LocationLookup
    data object TimedOut : LocationLookup
}

fun hasLocationPermission(context: Context): Boolean =
    ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

private const val GOOD_ACCURACY_METERS = 25f
private const val MAX_CACHED_AGE_MILLIS = 2 * 60_000L

private fun Location.ageMillis(): Long =
    (SystemClock.elapsedRealtimeNanos() - elapsedRealtimeNanos) / 1_000_000

private fun Location.betterThan(other: Location?): Boolean {
    if (other == null) return true
    val mine = if (hasAccuracy()) accuracy else Float.MAX_VALUE
    val theirs = if (other.hasAccuracy()) other.accuracy else Float.MAX_VALUE
    return mine < theirs
}

private fun Location.toFix(): LocationFix = LocationFix(
    latitude = latitude,
    longitude = longitude,
    accuracyMeters = if (hasAccuracy()) accuracy.toInt() else null,
    ageSeconds = ageMillis() / 1000
)

/**
 * Listens to every enabled provider at once (GPS, Wi-Fi/cell network and, on Android 12+, the
 * fused provider). Indoors the satellite GPS alone often never answers, while the network
 * provider replies in a couple of seconds. Returns as soon as a fix is good enough
 * ([GOOD_ACCURACY_METERS]); otherwise, when time runs out, the best fix heard so far, or a
 * cached fix no older than two minutes.
 */
@SuppressLint("MissingPermission")
suspend fun currentLocation(context: Context, timeoutMillis: Long = 30_000): LocationLookup {
    if (!hasLocationPermission(context)) return LocationLookup.NoPermission
    val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    val candidates = buildList {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) add(LocationManager.FUSED_PROVIDER)
        add(LocationManager.GPS_PROVIDER)
        add(LocationManager.NETWORK_PROVIDER)
    }
    val providers = candidates.filter { provider ->
        runCatching { provider in manager.allProviders && manager.isProviderEnabled(provider) }.getOrDefault(false)
    }
    if (providers.isEmpty()) return LocationLookup.ServicesOff

    var best: Location? = null
    val updates = Channel<Location>(Channel.UNLIMITED)
    val listener = object : LocationListener {
        override fun onLocationChanged(location: Location) { updates.trySend(location) }
        @Deprecated("Required on API < 29")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit
        override fun onProviderEnabled(provider: String) = Unit
        override fun onProviderDisabled(provider: String) = Unit
    }
    try {
        providers.forEach { provider ->
            runCatching {
                manager.requestLocationUpdates(provider, 1_000L, 0f, listener, Looper.getMainLooper())
            }
        }
        withTimeoutOrNull(timeoutMillis) {
            for (location in updates) {
                if (location.betterThan(best)) best = location
                val current = best
                if (current != null && current.hasAccuracy() && current.accuracy <= GOOD_ACCURACY_METERS) break
            }
        }
    } finally {
        runCatching { manager.removeUpdates(listener) }
        updates.close()
    }
    best?.let { return LocationLookup.Found(it.toFix()) }

    val cached = providers.mapNotNull { provider -> runCatching { manager.getLastKnownLocation(provider) }.getOrNull() }
        .filter { it.ageMillis() <= MAX_CACHED_AGE_MILLIS }
        .minByOrNull { if (it.hasAccuracy()) it.accuracy else Float.MAX_VALUE }
    return cached?.let { LocationLookup.Found(it.toFix()) } ?: LocationLookup.TimedOut
}

fun geoUriForLocation(latitude: Double, longitude: Double, name: String): Uri {
    return Uri.parse(geoUriStringForLocation(latitude, longitude, name))
}

fun geoUriStringForLocation(latitude: Double, longitude: Double, name: String): String {
    val label = URLEncoder.encode(name.ifBlank { "Ubicación de cobro" }, "UTF-8").replace("+", "%20")
    return "geo:$latitude,$longitude?q=$latitude,$longitude($label)"
}
