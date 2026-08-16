package com.aacreativeemb.support.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aacreativeemb.support.data.local.MessageEntity
import com.aacreativeemb.support.ui.theme.*
import com.aacreativeemb.support.ui.viewmodel.MainViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    conversationId: String,
    mainViewModel: MainViewModel,
    onBack: () -> Unit
) {
    var inputText by remember { mutableStateOf("") }
    var autoPolish by remember { mutableStateOf(true) }

    val activeMessages by mainViewModel.activeMessages.collectAsState()
    val conversations by mainViewModel.conversations.collectAsState(initial = emptyList())
    val isSending by mainViewModel.isSendingMessage.collectAsState()

    val currentConv = remember(conversations, conversationId) {
        conversations.find { it.id == conversationId }
    }

    val listState = rememberLazyListState()

    LaunchedEffect(conversationId) {
        mainViewModel.openConversation(conversationId)
    }

    LaunchedEffect(activeMessages.size) {
        if (activeMessages.isNotEmpty()) {
            listState.animateScrollToItem(activeMessages.size - 1)
        }
    }

    DisposableEffect(conversationId) {
        onDispose {
            mainViewModel.closeActiveConversation()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                text = currentConv?.visitorFlag ?: "🇬🇧",
                                fontSize = 16.sp
                            )
                            Text(
                                text = currentConv?.visitorName ?: "Live Customer",
                                style = MaterialTheme.typography.titleSmall,
                                color = White,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Text(
                            text = "Channel: ${currentConv?.channel?.replaceFirstChar { it.uppercase() } ?: "Website"} • Status: ${currentConv?.status ?: "Open"}",
                            style = MaterialTheme.typography.bodySmall,
                            color = Slate400,
                            fontSize = 11.sp
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = White)
                    }
                },
                actions = {
                    // Assign to Me
                    IconButton(onClick = { mainViewModel.assignToMe() }) {
                        Icon(Icons.Default.PersonAdd, contentDescription = "Assign to Me", tint = Sky400)
                    }
                    // Close Chat (Uses "closing" flow)
                    IconButton(onClick = { mainViewModel.updateStatus("closing") }) {
                        Icon(Icons.Default.CheckCircle, contentDescription = "Close Chat", tint = Emerald500)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Navy800)
            )
        },
        containerColor = Navy900
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // AI / Human Status Banner
            Surface(
                color = if (currentConv?.isAiHandling == true) Indigo600.copy(alpha = 0.2f) else Emerald500.copy(alpha = 0.2f),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (currentConv?.isAiHandling == true)
                            "🤖 AI Specialist is currently answering this chat"
                        else
                            "👤 You / Human Agent are actively handling this chat",
                        color = if (currentConv?.isAiHandling == true) Sky400 else Emerald500,
                        style = MaterialTheme.typography.bodySmall,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )

                    if (currentConv?.status == "closing") {
                        Text(
                            text = "Awaiting Final Goodbye",
                            color = Amber500,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // Message Stream
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                contentPadding = PaddingValues(vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(activeMessages, key = { it.id }) { msg ->
                    MessageBubble(msg = msg)
                }
            }

            // Input Bar
            Surface(
                color = Navy800,
                modifier = Modifier.fillMaxWidth(),
                tonalElevation = 4.dp
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = inputText,
                        onValueChange = { inputText = it },
                        placeholder = { Text("Type reply as human agent...", color = Slate500, fontSize = 13.sp) },
                        modifier = Modifier.weight(1f),
                        maxLines = 4,
                        shape = RoundedCornerShape(20.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Navy900,
                            unfocusedContainerColor = Navy900,
                            focusedBorderColor = Indigo500,
                            unfocusedBorderColor = Navy700,
                            focusedTextColor = White,
                            unfocusedTextColor = White
                        )
                    )

                    IconButton(
                        onClick = {
                            if (inputText.isNotBlank()) {
                                val textToSend = inputText
                                inputText = ""
                                mainViewModel.sendMessage(textToSend, autoPolish = autoPolish)
                            }
                        },
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(Indigo600),
                        enabled = inputText.isNotBlank() && !isSending
                    ) {
                        if (isSending) {
                            CircularProgressIndicator(
                                color = White,
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp
                            )
                        } else {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.Send,
                                contentDescription = "Send",
                                tint = White,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun MessageBubble(msg: MessageEntity) {
    val isVisitor = msg.senderType == "visitor"
    val isSystem = msg.senderType == "system"
    val isAi = msg.senderType == "ai"
    val isAgent = msg.senderType == "agent"

    if (isSystem) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = msg.text,
                color = Amber500,
                style = MaterialTheme.typography.bodySmall,
                fontSize = 11.sp,
                modifier = Modifier
                    .background(Amber500.copy(alpha = 0.15f), RoundedCornerShape(8.dp))
                    .padding(horizontal = 10.dp, vertical = 4.dp)
            )
        }
        return
    }

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = if (isAgent) Alignment.End else Alignment.Start
    ) {
        // Sender Name & Role Label
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
        ) {
            Text(
                text = when {
                    isVisitor -> msg.senderName.ifBlank { "Customer" }
                    isAi -> "🤖 AA Support Specialist (AI)"
                    else -> "👤 ${msg.senderName.ifBlank { "Agent" }}"
                },
                style = MaterialTheme.typography.labelSmall,
                color = when {
                    isVisitor -> Slate400
                    isAi -> Sky400
                    else -> Emerald500
                },
                fontSize = 11.sp
            )
        }

        // Bubble
        Surface(
            shape = RoundedCornerShape(
                topStart = 14.dp,
                topEnd = 14.dp,
                bottomStart = if (isAgent) 14.dp else 2.dp,
                bottomEnd = if (isAgent) 2.dp else 14.dp
            ),
            color = when {
                isAgent -> Indigo600
                isAi -> Navy800
                else -> Navy700
            },
            modifier = Modifier.widthIn(max = 290.dp)
        ) {
            Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                Text(
                    text = msg.text,
                    style = MaterialTheme.typography.bodyMedium,
                    color = White,
                    fontSize = 13.5.sp
                )
            }
        }
    }
}
