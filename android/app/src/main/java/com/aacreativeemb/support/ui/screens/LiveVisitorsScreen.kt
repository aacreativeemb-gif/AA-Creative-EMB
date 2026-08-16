package com.aacreativeemb.support.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aacreativeemb.support.data.local.VisitorEntity
import com.aacreativeemb.support.ui.theme.*
import com.aacreativeemb.support.ui.viewmodel.MainViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LiveVisitorsScreen(
    mainViewModel: MainViewModel,
    onStartChatWithVisitor: (conversationId: String) -> Unit
) {
    val visitors by mainViewModel.visitors.collectAsState(initial = emptyList())
    val conversations by mainViewModel.conversations.collectAsState(initial = emptyList())
    val isRefreshing by mainViewModel.isRefreshing.collectAsState()

    val onlineCount = remember(visitors) { visitors.count { it.status == "online" } }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Navy900)
    ) {
        TopAppBar(
            title = {
                Column {
                    Text(
                        text = "Live Visitors Tracking",
                        style = MaterialTheme.typography.titleMedium,
                        color = White,
                        fontWeight = FontWeight.Bold
                    )
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(Emerald500)
                        )
                        Text(
                            text = "$onlineCount visitor(s) actively browsing website",
                            style = MaterialTheme.typography.bodySmall,
                            color = Emerald500,
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

        if (visitors.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "No Live Visitors Right Now",
                        style = MaterialTheme.typography.titleMedium,
                        color = Slate300
                    )
                    Text(
                        text = "As customers browse aacreativeemb.com, their live location and browsing page will appear here.",
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
                items(visitors, key = { it.id }) { visitor ->
                    val matchingConv = conversations.find { it.visitorId == visitor.id }

                    VisitorCard(
                        visitor = visitor,
                        hasActiveChat = matchingConv != null,
                        onChatClick = {
                            if (matchingConv != null) {
                                onStartChatWithVisitor(matchingConv.id)
                            }
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun VisitorCard(
    visitor: VisitorEntity,
    hasActiveChat: Boolean,
    onChatClick: () -> Unit
) {
    val isOnline = visitor.status == "online"

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Navy800)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            // Header Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(text = visitor.flag.ifBlank { "🇬🇧" }, fontSize = 20.sp)
                    Column {
                        Text(
                            text = "${visitor.city.ifBlank { "London" }}, ${visitor.country.ifBlank { "United Kingdom" }}",
                            style = MaterialTheme.typography.titleSmall,
                            color = White,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "IP: ${visitor.ip.ifBlank { "Hidden" }}",
                            style = MaterialTheme.typography.bodySmall,
                            color = Slate400,
                            fontSize = 11.sp
                        )
                    }
                }

                // Online/Offline status badge
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(if (isOnline) Emerald500.copy(alpha = 0.15f) else Slate700)
                        .padding(horizontal = 8.dp, vertical = 3.dp)
                ) {
                    Text(
                        text = if (isOnline) "🟢 ONLINE" else "OFFLINE",
                        color = if (isOnline) Emerald500 else Slate400,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Current URL Page
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Navy900, RoundedCornerShape(8.dp))
                    .padding(8.dp)
            ) {
                Icon(Icons.Default.Language, contentDescription = null, tint = Sky400, modifier = Modifier.size(16.dp))
                Text(
                    text = visitor.currentUrl.ifBlank { "/" },
                    color = Sky400,
                    style = MaterialTheme.typography.bodySmall,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Stats row & action
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Visits: ${visitor.visitsCount} • ${visitor.timeOnSiteSeconds}s on site",
                    color = Slate400,
                    style = MaterialTheme.typography.bodySmall,
                    fontSize = 11.sp
                )

                if (hasActiveChat) {
                    Button(
                        onClick = onChatClick,
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Indigo600),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Icon(Icons.Default.Chat, contentDescription = null, modifier = Modifier.size(14.dp), tint = White)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Open Chat", fontSize = 12.sp, color = White)
                    }
                }
            }
        }
    }
}
