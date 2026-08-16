package com.aacreativeemb.support.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aacreativeemb.support.data.model.Ticket
import com.aacreativeemb.support.ui.theme.*
import com.aacreativeemb.support.ui.viewmodel.MainViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TicketsScreen(
    mainViewModel: MainViewModel
) {
    val state by mainViewModel.currentState.collectAsState()
    val isRefreshing by mainViewModel.isRefreshing.collectAsState()
    val tickets = remember(state) { state?.tickets ?: emptyList() }

    var showCreateDialog by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Navy900)
    ) {
        TopAppBar(
            title = {
                Text(
                    text = "Support Tickets (${tickets.size})",
                    style = MaterialTheme.typography.titleMedium,
                    color = White,
                    fontWeight = FontWeight.Bold
                )
            },
            actions = {
                IconButton(onClick = { showCreateDialog = true }) {
                    Icon(Icons.Default.Add, contentDescription = "Create Ticket", tint = Sky400)
                }
                IconButton(onClick = { mainViewModel.refresh() }) {
                    Icon(
                        Icons.Default.Refresh,
                        contentDescription = "Refresh",
                        tint = if (isRefreshing) Sky400 else Slate300
                    )
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = Navy900)
        )

        if (tickets.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "No Tickets Found",
                        style = MaterialTheme.typography.titleMedium,
                        color = Slate300
                    )
                    Text(
                        text = "Customer email inquiries and digitizing quotes will be cataloged here.",
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
                items(tickets, key = { it.id }) { ticket ->
                    TicketCard(ticket = ticket)
                }
            }
        }
    }

    if (showCreateDialog) {
        CreateTicketDialog(
            onDismiss = { showCreateDialog = false },
            onCreate = { newTicket ->
                mainViewModel.saveTicket(newTicket) {
                    showCreateDialog = false
                }
            }
        )
    }
}

@Composable
fun TicketCard(ticket: Ticket) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Navy800)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "#${ticket.ticketNumber.takeIf { it > 0 } ?: ticket.id.takeLast(4)} • ${ticket.subject.ifBlank { "Support Inquiry" }}",
                    style = MaterialTheme.typography.titleSmall,
                    color = White,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f)
                )

                // Priority Badge
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(
                            when (ticket.priority) {
                                "urgent" -> Rose500.copy(alpha = 0.2f)
                                "high" -> Amber500.copy(alpha = 0.2f)
                                else -> Indigo600.copy(alpha = 0.2f)
                            }
                        )
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = ticket.priority.toUpperCase(),
                        color = when (ticket.priority) {
                            "urgent" -> Rose500
                            "high" -> Amber500
                            else -> Sky400
                        },
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = ticket.description.ifBlank { "No detailed description" },
                style = MaterialTheme.typography.bodySmall,
                color = Slate400,
                maxLines = 2
            )

            Spacer(modifier = Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Customer: ${ticket.visitorName.ifBlank { ticket.visitorEmail.ifBlank { "Guest" } }}",
                    color = Slate500,
                    style = MaterialTheme.typography.bodySmall,
                    fontSize = 11.sp
                )

                Text(
                    text = "Status: ${ticket.status.capitalize()}",
                    color = if (ticket.status == "open") Emerald500 else Slate400,
                    style = MaterialTheme.typography.bodySmall,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

@Composable
fun CreateTicketDialog(
    onDismiss: () -> Unit,
    onCreate: (Ticket) -> Unit
) {
    var subject by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var priority by remember { mutableStateOf("normal") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New Support Ticket", color = White) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = subject,
                    onValueChange = { subject = it },
                    label = { Text("Subject") },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = White,
                        unfocusedTextColor = White
                    )
                )
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Customer Email") },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = White,
                        unfocusedTextColor = White
                    )
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description / Quote notes") },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = White,
                        unfocusedTextColor = White
                    )
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val ticket = Ticket(
                        id = "",
                        subject = subject,
                        visitorEmail = email,
                        description = description,
                        priority = priority
                    )
                    onCreate(ticket)
                },
                enabled = subject.isNotBlank() && email.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = Indigo600)
            ) {
                Text("Create Ticket")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = Slate400)
            }
        },
        containerColor = Navy800
    )
}
