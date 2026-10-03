package com.backendcreditos.mobile.ui.theme

import android.app.Activity
import android.content.Context
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat

enum class ThemeMode {
    SYSTEM,
    LIGHT,
    DARK
}

enum class TextScale(val multiplier: Float) {
    STANDARD(1f),
    LARGE(1.15f),
    EXTRA_LARGE(1.30f)
}

class ThemePreferences(context: Context) {
    private val preferences =
        context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    fun read(): ThemeMode =
        preferences.getString(KEY_THEME_MODE, null)
            ?.let { value -> ThemeMode.entries.firstOrNull { it.name == value } }
            ?: ThemeMode.SYSTEM

    fun save(mode: ThemeMode) {
        preferences.edit().putString(KEY_THEME_MODE, mode.name).apply()
    }

    fun readTextScale(): TextScale =
        preferences.getString(KEY_TEXT_SCALE, null)
            ?.let { value -> TextScale.entries.firstOrNull { it.name == value } }
            ?: TextScale.STANDARD

    fun saveTextScale(scale: TextScale) {
        preferences.edit().putString(KEY_TEXT_SCALE, scale.name).apply()
    }

    private companion object {
        const val PREFERENCES_NAME = "appearance_settings"
        const val KEY_THEME_MODE = "theme_mode"
        const val KEY_TEXT_SCALE = "text_scale"
    }
}

private val LightColors = lightColorScheme(
    primary = Color(0xFF006B5E),
    onPrimary = Color.White,
    primaryContainer = Color(0xFF9EF2E1),
    onPrimaryContainer = Color(0xFF00201B),
    secondary = Color(0xFF4B635D),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFCDE8E0),
    onSecondaryContainer = Color(0xFF07201B),
    tertiary = Color(0xFF426277),
    onTertiary = Color.White,
    tertiaryContainer = Color(0xFFC6E7FF),
    onTertiaryContainer = Color(0xFF001E2D),
    error = Color(0xFFBA1A1A),
    onError = Color.White,
    errorContainer = Color(0xFFFFDAD6),
    onErrorContainer = Color(0xFF410002),
    background = Color(0xFFF7FAF8),
    onBackground = Color(0xFF171D1B),
    surface = Color(0xFFF7FAF8),
    onSurface = Color(0xFF171D1B),
    surfaceVariant = Color(0xFFDAE5E1),
    onSurfaceVariant = Color(0xFF3F4946),
    outline = Color(0xFF6F7976),
    outlineVariant = Color(0xFFBEC9C5)
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF82D5C5),
    onPrimary = Color(0xFF00382F),
    primaryContainer = Color(0xFF005047),
    onPrimaryContainer = Color(0xFF9EF2E1),
    secondary = Color(0xFFB1CCC4),
    onSecondary = Color(0xFF1C352F),
    secondaryContainer = Color(0xFF334B45),
    onSecondaryContainer = Color(0xFFCDE8E0),
    tertiary = Color(0xFFA9CCE4),
    onTertiary = Color(0xFF103447),
    tertiaryContainer = Color(0xFF294A5E),
    onTertiaryContainer = Color(0xFFC6E7FF),
    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
    errorContainer = Color(0xFF93000A),
    onErrorContainer = Color(0xFFFFDAD6),
    background = Color(0xFF0F1513),
    onBackground = Color(0xFFDEE4E1),
    surface = Color(0xFF0F1513),
    onSurface = Color(0xFFDEE4E1),
    surfaceVariant = Color(0xFF3F4946),
    onSurfaceVariant = Color(0xFFBEC9C5),
    outline = Color(0xFF89938F),
    outlineVariant = Color(0xFF3F4946)
)

private val CreditShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(30.dp)
)

@Composable
fun CreditTheme(
    mode: ThemeMode,
    textScale: TextScale,
    content: @Composable () -> Unit
) {
    val darkTheme = when (mode) {
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }
    val colors = if (darkTheme) DarkColors else LightColors
    val view = LocalView.current
    val systemDensity = LocalDensity.current
    val accessibleDensity = Density(
        density = systemDensity.density,
        fontScale = systemDensity.fontScale * textScale.multiplier
    )

    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colors.surface.toArgb()
            window.navigationBarColor = colors.surface.toArgb()
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = !darkTheme
                isAppearanceLightNavigationBars = !darkTheme
            }
        }
    }

    CompositionLocalProvider(LocalDensity provides accessibleDensity) {
        MaterialTheme(
            colorScheme = colors,
            typography = Typography(),
            shapes = CreditShapes,
            content = content
        )
    }
}
