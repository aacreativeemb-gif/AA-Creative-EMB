package com.aacreativeemb.support.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aacreativeemb.support.ui.theme.*
import com.aacreativeemb.support.ui.viewmodel.MainViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    mainViewModel: MainViewModel,
    onLogout: () -> Unit
) {
    val currentUser by mainViewModel.currentUser.collectAsState()
    val state by mainViewModel.currentState.collectAsState()

    var showLogoutDialog by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Navy900)
            .verticalScroll(rememberScrollState())
    ) {
        TopAppBar(
            title = {
                Text(
                    text = "Agent Profile & Settings",
                    style = MaterialTheme.typography.titleMedium,
                    color = White,
                    fontWeight = FontWeight.Bold
                )
            },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = Navy900)
        )

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Profile Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Navy800)
            ) {
                Column(
                    modifier = Modifier.padding(18.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier
                            .size(64.dp)
                            .clip(CircleShape)
                            .background(Indigo600),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = (currentUser?.name?.take(2) ?: "AA").uppercase(),
                            color = White,
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    Text(
                        text = currentUser?.name ?: "AA Support Agent",
                        style = MaterialTheme.typography.titleMedium,
                        color = White,
                        fontWeight = FontWeight.Bold
                    )

                    Text(
                        text = currentUser?.email ?: "aacreativeemb@gmail.com",
                        style = MaterialTheme.typography.bodySmall,
                        color = Slate400
                    )

                    Spacer(modifier = Modifier.height(6.dp))

                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Indigo600.copy(alpha = 0.2f))
                            .padding(horizontal = 8.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = "ROLE: ${currentUser?.role?.uppercase() ?: "ADMIN"}",
                            color = Sky400,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // Agent Status Switcher (Online / Away / Offline)
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Navy800)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Availability Status",
                        style = MaterialTheme.typography.titleSmall,
                        color = White,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Controls whether the web dashboard and AI handoff treat you as ready for incoming chats.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Slate400,
                        modifier = Modifier.padding(vertical = 4.dp)
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf("online", "away", "offline").forEach { status ->
                            val isSelected = currentUser?.status == status
                            Button(
                                onClick = { mainViewModel.setAgentStatus(status) },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (isSelected) {
                                        when (status) {
                                            "online" -> Emerald500
                                            "away" -> Amber500
                                            else -> Slate600
                                        }
                                    } else Navy700
                                )
                            ) {
                                Text(
                                    text = status.replaceFirstChar { it.uppercase() },
                                    color = if (isSelected) White else Slate300,
                                    fontSize = 12.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                )
                            }
                        }
                    }
                }
            }

            // Backend Connection Info
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Navy800)
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "System & Integration Health",
                        style = MaterialTheme.typography.titleSmall,
                        color = White,
                        fontWeight = FontWeight.Bold
                    )

                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.CloudDone, contentDescription = null, tint = Emerald500, modifier = Modifier.size(18.dp))
                        Text(
                            text = "Live Backend: chat.aacreativeemb.com",
                            color = Slate300,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }

                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.NotificationsActive, contentDescription = null, tint = Sky400, modifier = Modifier.size(18.dp))
                        Text(
                            text = "Local Notification Sync: Active (WorkManager + 5s Foreground Polling)",
                            color = Slate300,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }

                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.Shield, contentDescription = null, tint = Indigo500, modifier = Modifier.size(18.dp))
                        Text(
                            text = "AI Specialist: ${state?.aiSettings?.aiName ?: "AA Support Specialist"}",
                            color = Slate300,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }

            // Logout Button
            Button(
                onClick = { showLogoutDialog = true },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Rose500)
            ) {
                Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = null, tint = White)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Sign Out of Admin Client", color = White, fontWeight = FontWeight.Bold)
            }
        }
    }

    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            title = { Text("Sign Out?", color = White) },
            text = {
                Text(
                    "This will set your status to Offline on the live dashboard and clear your local session.",
                    color = Slate300
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showLogoutDialog = false
                        mainViewModel.logout {
                            onLogout()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Rose500)
                ) {
                    Text("Sign Out")
                }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutDialog = false }) {
                    Text("Cancel", color = Slate400)
                }
            },
            containerColor = Navy800
        )
    }
}
