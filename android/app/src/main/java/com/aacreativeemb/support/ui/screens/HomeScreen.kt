package com.aacreativeemb.support.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ConfirmationNumber
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import com.aacreativeemb.support.ui.theme.*
import com.aacreativeemb.support.ui.viewmodel.MainViewModel

enum class BottomTab(val title: String, val icon: ImageVector) {
    INBOX("Inbox", Icons.Default.Forum),
    LIVE_VISITORS("Live Visitors", Icons.Default.People),
    TICKETS("Tickets", Icons.Default.ConfirmationNumber),
    SETTINGS("Profile", Icons.Default.Person)
}

@Composable
fun HomeScreen(
    mainViewModel: MainViewModel,
    onNavigateToChat: (conversationId: String) -> Unit,
    onLogout: () -> Unit
) {
    var selectedTab by remember { mutableStateOf(BottomTab.INBOX) }

    val conversations by mainViewModel.conversations.collectAsState(initial = emptyList())
    val onlineVisitors by mainViewModel.onlineVisitors.collectAsState(initial = emptyList())
    val state by mainViewModel.currentState.collectAsState()

    val totalUnread = conversations.sumOf { it.unreadCountAgent }
    val onlineVisitorCount = onlineVisitors.size
    val openTicketsCount = state?.tickets?.count { it.status == "open" } ?: 0

    Scaffold(
        bottomBar = {
            NavigationBar(
                containerColor = Navy800,
                contentColor = White
            ) {
                BottomTab.entries.forEach { tab ->
                    val isSelected = selectedTab == tab
                    NavigationBarItem(
                        selected = isSelected,
                        onClick = { selectedTab = tab },
                        icon = {
                            BadgedBox(
                                badge = {
                                    when (tab) {
                                        BottomTab.INBOX -> if (totalUnread > 0) {
                                            Badge(containerColor = Rose500) { Text("$totalUnread") }
                                        }
                                        BottomTab.LIVE_VISITORS -> if (onlineVisitorCount > 0) {
                                            Badge(containerColor = Emerald500) { Text("$onlineVisitorCount") }
                                        }
                                        BottomTab.TICKETS -> if (openTicketsCount > 0) {
                                            Badge(containerColor = Amber500) { Text("$openTicketsCount") }
                                        }
                                        else -> {}
                                    }
                                }
                            ) {
                                Icon(
                                    imageVector = tab.icon,
                                    contentDescription = tab.title,
                                    tint = if (isSelected) Sky400 else Slate400
                                )
                            }
                        },
                        label = {
                            Text(
                                text = tab.title,
                                color = if (isSelected) Sky400 else Slate400,
                                style = MaterialTheme.typography.labelSmall
                            )
                        },
                        colors = NavigationBarItemDefaults.colors(
                            indicatorColor = Navy700
                        )
                    )
                }
            }
        },
        containerColor = Navy900
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .padding(innerPadding)
                .background(Navy900)
        ) {
            when (selectedTab) {
                BottomTab.INBOX -> InboxScreen(
                    mainViewModel = mainViewModel,
                    onConversationClick = onNavigateToChat
                )
                BottomTab.LIVE_VISITORS -> LiveVisitorsScreen(
                    mainViewModel = mainViewModel,
                    onStartChatWithVisitor = { convId ->
                        onNavigateToChat(convId)
                    }
                )
                BottomTab.TICKETS -> TicketsScreen(
                    mainViewModel = mainViewModel
                )
                BottomTab.SETTINGS -> SettingsScreen(
                    mainViewModel = mainViewModel,
                    onLogout = onLogout
                )
            }
        }
    }
}