package com.aacreativeemb.support

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.navigation.compose.rememberNavController
import com.aacreativeemb.support.ui.navigation.AppNavHost
import com.aacreativeemb.support.ui.navigation.NavRoutes
import com.aacreativeemb.support.ui.theme.AACreativeSupportTheme
import com.aacreativeemb.support.ui.viewmodel.AuthViewModel
import com.aacreativeemb.support.ui.viewmodel.MainViewModel

class MainActivity : ComponentActivity() {

    private val authViewModel: AuthViewModel by viewModels()
    private val mainViewModel: MainViewModel by viewModels()

    private val requestNotificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ ->
        // Permission handled
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        askNotificationPermission()

        val deepLinkedConvId = intent?.getStringExtra("EXTRA_CONVERSATION_ID")

        setContent {
            AACreativeSupportTheme(darkTheme = true) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val navController = rememberNavController()
                    val startDestination = if (authViewModel.isAuthenticated) {
                        NavRoutes.HOME
                    } else {
                        NavRoutes.LOGIN
                    }

                    AppNavHost(
                        navController = navController,
                        authViewModel = authViewModel,
                        mainViewModel = mainViewModel,
                        startDestination = startDestination
                    )

                    // If launched via notification deep link
                    if (!deepLinkedConvId.isNullOrEmpty() && authViewModel.isAuthenticated) {
                        navController.navigate(NavRoutes.chatRoute(deepLinkedConvId))
                    }
                }
            }
        }
    }

    override fun onStart() {
        super.onStart()
        if (authViewModel.isAuthenticated) {
            mainViewModel.setAgentStatus("online")
            mainViewModel.startStatePolling()
        }
    }

    override fun onStop() {
        super.onStop()
        if (authViewModel.isAuthenticated) {
            mainViewModel.setAgentStatus("away")
            mainViewModel.stopStatePolling()
        }
    }

    private fun askNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                requestNotificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }
}