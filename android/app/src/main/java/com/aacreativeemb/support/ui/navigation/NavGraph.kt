package com.aacreativeemb.support.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.aacreativeemb.support.ui.screens.*
import com.aacreativeemb.support.ui.viewmodel.AuthViewModel
import com.aacreativeemb.support.ui.viewmodel.MainViewModel
import java.net.URLDecoder
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

object NavRoutes {
    const val LOGIN = "login"
    const val OTP = "otp/{email}/{message}"
    const val HOME = "home"
    const val CHAT = "chat/{conversationId}"

    fun otpRoute(email: String, message: String): String {
        val encEmail = URLEncoder.encode(email, StandardCharsets.UTF_8.toString())
        val encMsg = URLEncoder.encode(message, StandardCharsets.UTF_8.toString())
        return "otp/$encEmail/$encMsg"
    }

    fun chatRoute(conversationId: String): String {
        return "chat/$conversationId"
    }
}

@Composable
fun AppNavHost(
    navController: NavHostController,
    authViewModel: AuthViewModel,
    mainViewModel: MainViewModel,
    startDestination: String = NavRoutes.LOGIN
) {
    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        // Login Screen
        composable(NavRoutes.LOGIN) {
            LoginScreen(
                authViewModel = authViewModel,
                onNavigateToOtp = { email, msg ->
                    navController.navigate(NavRoutes.otpRoute(email, msg))
                },
                onLoginSuccess = {
                    navController.navigate(NavRoutes.HOME) {
                        popUpTo(NavRoutes.LOGIN) { inclusive = true }
                    }
                }
            )
        }

        // OTP Screen
        composable(
            route = NavRoutes.OTP,
            arguments = listOf(
                navArgument("email") { type = NavType.StringType },
                navArgument("message") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val encEmail = backStackEntry.arguments?.getString("email") ?: ""
            val encMsg = backStackEntry.arguments?.getString("message") ?: ""
            val email = URLDecoder.decode(encEmail, StandardCharsets.UTF_8.toString())
            val message = URLDecoder.decode(encMsg, StandardCharsets.UTF_8.toString())

            OtpScreen(
                email = email,
                message = message,
                authViewModel = authViewModel,
                onBack = { navController.popBackStack() },
                onVerificationSuccess = {
                    navController.navigate(NavRoutes.HOME) {
                        popUpTo(NavRoutes.LOGIN) { inclusive = true }
                    }
                }
            )
        }

        // Main Home Screen
        composable(NavRoutes.HOME) {
            HomeScreen(
                mainViewModel = mainViewModel,
                onNavigateToChat = { convId ->
                    navController.navigate(NavRoutes.chatRoute(convId))
                },
                onLogout = {
                    navController.navigate(NavRoutes.LOGIN) {
                        popUpTo(NavRoutes.HOME) { inclusive = true }
                    }
                }
            )
        }

        // Live Chat Detail Screen
        composable(
            route = NavRoutes.CHAT,
            arguments = listOf(
                navArgument("conversationId") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val convId = backStackEntry.arguments?.getString("conversationId") ?: ""
            ChatScreen(
                conversationId = convId,
                mainViewModel = mainViewModel,
                onBack = { navController.popBackStack() }
            )
        }
    }
}
