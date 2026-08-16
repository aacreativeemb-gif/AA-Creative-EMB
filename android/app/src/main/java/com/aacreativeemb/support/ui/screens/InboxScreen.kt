package com.aacreativeemb.support.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aacreativeemb.support.data.local.ConversationEntity
import com.aacreativeemb.support.ui.theme.*
import com.aacreativeemb.support.ui.viewmodel.MainViewModel

enum class InboxFilter(val label: String) {
    LIVE("Live Customers"),
    ALL("All Chats"),
    WEBSITE("Website"),
    GMAIL("Gmail"),
    WHATSAPP("WhatsApp")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InboxScreen(
    mainViewModel: MainViewModel,
    onConversationClick: (conversationId: String) -> Unit
) {
    var selectedFilter by remember { mutableStateOf(InboxFilter.ALL) }
    var searchQuery by remember { mutableStateOf("") }

    val conversations by mainViewModel.conversations.collectAsState(initial = emptyList())
    val onlineVisitors by mainViewModel.onlineVisitors.collectAsState(initial = emptyList())
    val isRefreshing by mainViewModel.isRefreshing.collectAsState()
    val currentUser by mainViewModel.currentUser.collectAsState()

    val onlineVisitorIds = remember(onlineVisitors) { onlineVisitors.map { it.id }.toSet() }

    val filteredConversations = remember(conversations, selectedFilter, searchQuery, onlineVisitorIds) {
        conversations.filter { conv ->
            val matchesFilter = when (selectedFilter) {
                InboxFilter.LIVE -> onlineVisitorIds.contains(conv.visitorId)
                InboxFilter.ALL -> true
                InboxFilter.WEBSITE -> conv.channel == "website"
                InboxFilter.GMAIL -> conv.channel == "gmail"
                InboxFilter.WHATSAPP -> conv.channel == "whatsapp"
            }

            val matchesSearch = if (searchQuery.isBlank()) true else {
                conv.visitorName.contains(searchQuery, ignoreCase = true) ||
                        conv.lastMessageText.contains(searchQuery, ignoreCase = true) ||
                        conv.subject.contains(searchQuery, ignoreCase = true)
            }

            matchesFilter && matchesSearch
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Navy900)
    ) {
        // Header
        TopAppBar(
            title = {
                Column {
                    Text(
                        text = "Unified Admin Chat",
                        style = MaterialTheme.typography.titleMedium,
                        color = White,
                        fontWeight = FontWeight.Bold
                    )
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(
                                    when (currentUser?.status) {
                                        "online" -> Emerald500
                                        "away" -> Amber500
                                        else -> Slate500
                                    }
                                )
                        )
                        Text(
                            text = "Agent: ${currentUser?.name ?: "Support"} (${currentUser?.status?.capitalize() ?: "Online"})",
                            style = MaterialTheme.typography.bodySmall,
                            color = Slate400,
                            fontSize = 11.sp
                        )
                    }
                }
            },
            actions = {
                IconButton(onClick = { mainViewModel.refresh() }) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = "Refresh",
                        tint = if (isRefreshing) Sky400 else Slate300
                    )
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = Navy900)
        )

        // Search Bar
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Search chats by customer name or message...", color = Slate500, fontSize = 13.sp) },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = Slate400) },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 6.dp),
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = Navy800,
                unfocusedContainerColor = Navy800,
                focusedBorderColor = Indigo500,
                unfocusedBorderColor = Navy700,
                focusedTextColor = White,
                unfocusedTextColor = White
            )
        )

        // Horizontal Filter Chips
        ScrollableTabRow(
            selectedTabIndex = selectedFilter.ordinal,
            containerColor = Navy900,
            contentColor = Sky400,
            edgePadding = 16.dp,
            divider = {}
        ) {
            InboxFilter.values().forEach { filter ->
                Tab(
                    selected = selectedFilter == filter,
                    onClick = { selectedFilter = filter },
                    text = {
                        Text(
                            text = filter.label,
                            fontWeight = if (selectedFilter == filter) FontWeight.Bold else FontWeight.Normal,
                            color = if (selectedFilter == filter) Sky400 else Slate400
                        )
                    }
                )
            }
        }

        // Conversation List
        if (filteredConversations.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "No Conversations Found",
                        style = MaterialTheme.typography.titleMedium,
                        color = Slate300,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = "Incoming customer messages will automatically appear here.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Slate500,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(filteredConversations, key = { it.id }) { conv ->
                    ConversationCard(
                        conversation = conv,
                        isOnline = onlineVisitorIds.contains(conv.visitorId),
                        onClick = { onConversationClick(conv.id) }
                    )
                }
            }
        }
    }
}

@Composable
fun ConversationCard(
    conversation: ConversationEntity,
    isOnline: Boolean,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Navy800)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    // Flag & Online dot
                    Box {
                        Text(text = conversation.visitorFlag, fontSize = 18.sp)
                        if (isOnline) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .clip(CircleShape)
                                    .background(Emerald500)
                                    .align(Alignment.BottomEnd)
                            )
                        }
                    }

                    Text(
                        text = conversation.visitorName,
                        style = MaterialTheme.typography.titleSmall,
                        color = White,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                // Channel & Status Badges
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    // Channel
                    Text(
                        text = conversation.channel.toUpperCase(),
                        color = Sky400,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier
                            .background(Sky400.copy(alpha = 0.15f), RoundedCornerShape(4.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    )

                    // Unread Badge
                    if (conversation.unreadCountAgent > 0) {
                        Box(
                            modifier = Modifier
                                .clip(CircleShape)
                                .background(Rose500)
                                .padding(horizontal = 7.dp, vertical = 2.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "${conversation.unreadCountAgent}",
                                color = White,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            // Last message preview
            Text(
                text = conversation.lastMessageText.ifBlank { "No messages yet" },
                style = MaterialTheme.typography.bodySmall,
                color = if (conversation.unreadCountAgent > 0) White else Slate400,
                fontWeight = if (conversation.unreadCountAgent > 0) FontWeight.SemiBold else FontWeight.Normal,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Footer info: AI/Human handle & status
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // AI / Agent indicator
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = if (conversation.isAiHandling) "🤖 AI Specialist" else "👤 Human Agent",
                        color = if (conversation.isAiHandling) Sky400 else Emerald500,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium
                    )
                }

                // Status indicator
                Text(
                    text = when (conversation.status) {
                        "open" -> "Active"
                        "escalated" -> "⚡ Escalated"
                        "closing" -> "Closing..."
                        "resolved" -> "Resolved"
                        else -> conversation.status
                    },
                    color = when (conversation.status) {
                        "open" -> Emerald500
                        "escalated" -> Rose500
                        "closing" -> Amber500
                        else -> Slate400
                    },
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}
