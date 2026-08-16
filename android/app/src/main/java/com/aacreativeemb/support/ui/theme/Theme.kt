package com.aacreativeemb.support.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DarkColorScheme = darkColorScheme(
    primary = Indigo500,
    onPrimary = White,
    secondary = Sky400,
    onSecondary = Navy900,
    background = Navy900,
    onBackground = White,
    surface = Navy800,
    onSurface = White,
    surfaceVariant = Navy700,
    onSurfaceVariant = Slate300
)

private val LightColorScheme = lightColorScheme(
    primary = Indigo600,
    onPrimary = White,
    secondary = Sky500,
    onSecondary = White,
    background = Slate50,
    onBackground = Slate900,
    surface = White,
    onSurface = Slate900,
    surfaceVariant = Slate100,
    onSurfaceVariant = Slate600
)

@Composable
fun AACreativeSupportTheme(
    darkTheme: Boolean = true, // Default to sleek dark navy theme
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.background.toArgb()
            window.navigationBarColor = colorScheme.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
