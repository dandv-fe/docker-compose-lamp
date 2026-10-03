package com.backendcreditos.mobile

import android.content.Context

object PortfolioDisplaySettings {
    private const val PREFERENCES_NAME = "portfolio_display_settings"
    private const val KEY_ALWAYS_SHOW_SEARCH = "always_show_search"

    fun alwaysShowSearch(context: Context): Boolean =
        context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
            .getBoolean(KEY_ALWAYS_SHOW_SEARCH, true)

    fun setAlwaysShowSearch(context: Context, enabled: Boolean) {
        context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_ALWAYS_SHOW_SEARCH, enabled)
            .apply()
    }
}
