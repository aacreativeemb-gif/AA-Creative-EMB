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

enum class VisitorViewMode { LIVE_TODAY, HISTORY_3MO }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LiveVisitorsScreen(
    mainViewModel: MainViewModel,
    onStartChatWithVisitor: (conversationId: String) -> Unit
) {
    val allVisitors by mainViewModel.visitors.collectAsState(initial = emptyList())
    val conversations by mainViewModel.conversations.collectAsState(initial = emptyList())
    val isRefreshing by mainViewModel.isRefreshing.collectAsState()

    var viewMode by remember { mutableStateOf(VisitorViewMode.LIVE_TODAY) }

    // "Live" = visitors who arrived today only. "History" = arrivals within
    // the last 3 months. Mirrors the same split on the web admin dashboard.
    val visitors = remember(allVisitors, viewMode) {
        val now = java.util.Calendar.getInstance()
        when (viewMode) {
            VisitorViewMode.LIVE_TODAY -> allVisitors.filter { v ->
                val d = parseIsoDate(v.sessionStartedAt ?: v.firstSeenAt)
                d != null && isSameLocalDay(d, now.time)
            }
            VisitorViewMode.HISTORY_3MO -> {
                val cutoff = java.util.Calendar.getInstance().apply { add(java.util.Calendar.MONTH, -3) }.time
                allVisitors.filter { v ->
                    val d = parseIsoDate(v.sessionStartedAt ?: v.firstSeenAt)
                    d != null && d >= cutoff
                }
            }
        }.sortedByDescending { parseIsoDate(it.sessionStartedAt ?: it.firstSeenAt)?.time ?: 0L }
    }

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
                        text = if (viewMode == VisitorViewMode.LIVE_TODAY) "Live Visitors Tracking" else "Visitor History",
                        style = MaterialTheme.typography.titleMedium,
                        color = White,
                        fontWeight = FontWeight.Bold
                    )
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(if (viewMode == VisitorViewMode.LIVE_TODAY) Emerald500 else Sky400)
                        )
                        Text(
                            text = if (viewMode == VisitorViewMode.LIVE_TODAY)
                                "$onlineCount visitor(s) actively browsing website"
                            else
                                "${visitors.size} visitor(s) in the last 3 months",
                            style = MaterialTheme.typography.bodySmall,
                            color = if (viewMode == VisitorViewMode.LIVE_TODAY) Emerald500 else Sky400,
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

        // Live Today / 3-Month History toggle
        TabRow(
            selectedTabIndex = viewMode.ordinal,
            containerColor = Navy900,
            contentColor = Sky400,
            divider = {}
        ) {
            Tab(
                selected = viewMode == VisitorViewMode.LIVE_TODAY,
                onClick = { viewMode = VisitorViewMode.LIVE_TODAY },
                text = { Text("Live (Today)", fontSize = 12.sp, fontWeight = FontWeight.SemiBold) }
            )
            Tab(
                selected = viewMode == VisitorViewMode.HISTORY_3MO,
                onClick = { viewMode = VisitorViewMode.HISTORY_3MO },
                text = { Text("History (3mo)", fontSize = 12.sp, fontWeight = FontWeight.SemiBold) }
            )
        }

        if (visitors.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = if (viewMode == VisitorViewMode.LIVE_TODAY) "No Visitors Today Yet" else "No Visitor History Yet",
                        style = MaterialTheme.typography.titleMedium,
                        color = Slate300
                    )
                    Text(
                        text = if (viewMode == VisitorViewMode.LIVE_TODAY)
                            "As customers browse aacreativeemb.com today, their live location and browsing page will appear here."
                        else
                            "Visitor sessions from the last 3 months will appear here as they happen.",
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
                        Text(
                            text = "Arrived: ${formatArrivalTime(visitor.firstSeenAt)}",
                            style = MaterialTheme.typography.bodySmall,
                            color = Slate500,
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

/**
 * Parses the server's ISO-8601 timestamp strings (e.g.
 * "2026-08-17T04:15:36.123Z") into a java.util.Date in UTC, used both for
 * display formatting and for the Live (today) / History (3mo) date filters.
 */
private fun parseIsoDate(iso: String?): java.util.Date? {
    if (iso.isNullOrBlank()) return null
    return try {
        val cleaned = iso.trim().removeSuffix("Z")
        try {
            java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS", java.util.Locale.US)
                .apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }
                .parse(cleaned)
        } catch (e: Exception) {
            java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US)
                .apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }
                .parse(cleaned)
        }
    } catch (e: Exception) {
        null
    }
}

/** True when two dates fall on the same calendar day in the device's local timezone. */
private fun isSameLocalDay(a: java.util.Date, b: java.util.Date): Boolean {
    val calA = java.util.Calendar.getInstance().apply { time = a }
    val calB = java.util.Calendar.getInstance().apply { time = b }
    return calA.get(java.util.Calendar.YEAR) == calB.get(java.util.Calendar.YEAR) &&
        calA.get(java.util.Calendar.DAY_OF_YEAR) == calB.get(java.util.Calendar.DAY_OF_YEAR)
}

/**
 * Formats the server's ISO-8601 "firstSeenAt" timestamp (e.g.
 * "2026-08-17T04:15:36.123Z") into a short, readable date + time such as
 * "17 Aug, 04:15 AM", shown in the device's local timezone -- matching the
 * "Arrived At" column on the web Live Visitor Tracking page.
 */
private fun formatArrivalTime(iso: String?): String {
    val parsedDate = parseIsoDate(iso) ?: return "Just now"
    return try {
        java.text.SimpleDateFormat("dd MMM, hh:mm a", java.util.Locale.US).format(parsedDate)
    } catch (e: Exception) {
        "Just now"
    }
}
