package com.backendcreditos.mobile

import android.content.Context
import com.backendcreditos.mobile.network.MobileAppPolicyDto
import java.net.URI
import java.security.MessageDigest

internal fun validateMobileAppPolicy(policy: MobileAppPolicyDto) {
    require(policy.minimumVersionCode > 0 && policy.latestVersionCode >= policy.minimumVersionCode) {
        "El servidor devolvió una política de versiones inválida."
    }
    require(policy.latestVersionName.isNotBlank()) { "Falta el nombre de la versión publicada." }
    if (policy.downloadUrl.isNotEmpty()) {
        val uri = URI(policy.downloadUrl)
        require(uri.scheme == "https" && !uri.host.isNullOrBlank() && uri.userInfo == null) {
            "La descarga de la actualización debe usar un enlace HTTPS válido."
        }
    }
    require(policy.minimumVersionCode == 1 || policy.downloadUrl.isNotEmpty()) {
        "Una actualización obligatoria necesita un enlace de descarga HTTPS."
    }
}

internal fun updateRequired(policy: MobileAppPolicyDto?, installedCode: Int): Boolean =
    policy != null && installedCode < policy.minimumVersionCode

internal fun updateAvailable(policy: MobileAppPolicyDto?, installedCode: Int): Boolean =
    policy != null && installedCode < policy.latestVersionCode

class MobileUpdateStore(context: Context, private val endpoint: () -> String) {
    private val preferences = context.getSharedPreferences("mobile-version-policy", Context.MODE_PRIVATE)
    private fun prefix(): String = MessageDigest.getInstance("SHA-256")
        .digest(endpoint().toByteArray()).joinToString("") { "%02x".format(it.toInt() and 0xff) }

    fun policy(): MobileAppPolicyDto? {
        val key = prefix()
        if (!preferences.contains("$key.minimum")) return null
        return MobileAppPolicyDto(
            preferences.getInt("$key.latest", 0),
            preferences.getInt("$key.minimum", 0),
            preferences.getString("$key.name", "").orEmpty(),
            preferences.getString("$key.url", "").orEmpty(),
            preferences.getString("$key.message", "").orEmpty()
        ).also(::validateMobileAppPolicy)
    }

    fun save(policy: MobileAppPolicyDto) {
        validateMobileAppPolicy(policy)
        val key = prefix()
        preferences.edit()
            .putInt("$key.latest", policy.latestVersionCode)
            .putInt("$key.minimum", policy.minimumVersionCode)
            .putString("$key.name", policy.latestVersionName)
            .putString("$key.url", policy.downloadUrl)
            .putString("$key.message", policy.message)
            .apply()
    }

    fun assertNewWritesAllowed() {
        require(!updateRequired(policy(), BuildConfig.VERSION_CODE)) {
            "Actualiza la APK para crear cambios. Puedes enviar tus pendientes desde la Cola."
        }
    }
}
