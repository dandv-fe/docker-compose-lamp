package com.backendcreditos.mobile.network

import android.content.Context
import com.backendcreditos.mobile.BuildConfig
import java.net.URI

class ServerConnectionSettings(context: Context) {
    private val preferences =
        context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    fun endpoint(): String =
        preferences.getString(KEY_ENDPOINT, null) ?: BuildConfig.GRAPHQL_ENDPOINT

    fun save(rawValue: String): String {
        val endpoint = normalizeGraphQlEndpoint(rawValue, BuildConfig.DEBUG)
        preferences.edit().putString(KEY_ENDPOINT, endpoint).apply()
        return endpoint
    }

    private companion object {
        const val PREFERENCES_NAME = "server_connection_settings"
        const val KEY_ENDPOINT = "graphql_endpoint"
    }
}

fun normalizeGraphQlEndpoint(rawValue: String, allowHttp: Boolean = false): String {
    val trimmed = rawValue.trim().trimEnd('/')
    require(trimmed.isNotEmpty()) { "Escribe el dominio del servidor." }
    val candidate = if ("://" in trimmed) trimmed else "https://$trimmed"
    val uri = runCatching { URI(candidate) }
        .getOrElse { throw IllegalArgumentException("El dominio o la URL no tienen un formato válido.") }
    require(uri.scheme.equals("https", ignoreCase = true) ||
        (allowHttp && uri.scheme.equals("http", ignoreCase = true))) {
        "La conexión de producción debe usar HTTPS."
    }
    require(!uri.host.isNullOrBlank() && uri.userInfo == null && uri.query == null && uri.fragment == null) {
        "Escribe un dominio o una URL HTTPS sin usuario, consulta ni fragmento."
    }
    val path = uri.path.orEmpty().ifBlank { "/graphql" }
    return URI(uri.scheme.lowercase(), null, uri.host, uri.port, path, null, null).toString()
}
