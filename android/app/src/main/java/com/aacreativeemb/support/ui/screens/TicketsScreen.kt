package com.aacreativeemb.support.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aacreativeemb.support.data.model.Ticket
import com.aacreativeemb.support.ui.theme.*
import com.aacreativeemb.support.ui.viewmodel.MainViewModel

/** The 4 supported ticket lifecycle states, shown as filter tabs on this screen. */
enum class TicketStatusFilter(val label: String, val value: String) {
    OPEN("Open", "open"),
    IN_PROGRESS("In Progress", "in_progress"),
    RESOLVED("Resolved", "resolved"),
    CLOSED("Closed", "closed")
}

private fun ticketStatusLabel(status: String): String =
    TicketStatusFilter.entries.find { it.value == status }?.label
        ?: status.replace('_', ' ').replaceFirstChar { it.uppercase() }

private fun ticketStatusColor(status: String): Color = when (status) {
    "open" -> Sky400
    "in_progress" -> Amber500
    "resolved" -> Emerald500
    "closed" -> Slate400
    else -> Slate400
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TicketsScreen(
    mainViewModel: MainViewModel
) {
    val state by mainViewModel.currentState.collectAsState()
    val isRefreshing by mainViewModel.isRefreshing.collectAsState()
    val allTickets = remember(state) { state?.tickets ?: emptyList() }

    var showCreateDialog by remember { mutableStateOf(false) }
    var selectedFilter by remember { mutableStateOf(TicketStatusFilter.OPEN) }

    val filteredTickets = remember(allTickets, selectedFilter) {
        allTickets.filter { it.status == selectedFilter.value }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Navy900)
    ) {
        TopAppBar(
            title = {
                Text(
                    text = "Support Tickets (${allTickets.size})",
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

        // Open / In Progress / Resolved / Closed filter tabs
        ScrollableTabRow(
            selectedTabIndex = selectedFilter.ordinal,
            containerColor = Navy900,
            contentColor = Sky400,
            edgePadding = 12.dp,
            divider = {}
        ) {
            TicketStatusFilter.entries.forEach { filter ->
                val count = allTickets.count { it.status == filter.value }
                Tab(
                    selected = selectedFilter == filter,
                    onClick = { selectedFilter = filter },
                    text = {
                        Text(
                            text = "${filter.label} ($count)",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                )
            }
        }

        if (filteredTickets.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "No ${selectedFilter.label} Tickets",
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
                items(filteredTickets, key = { it.id }) { ticket ->
                    TicketCard(
                        ticket = ticket,
                        onStatusChange = { newStatus ->
                            mainViewModel.updateTicketStatus(ticket, newStatus)
                        }
                    )
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
fun TicketCard(ticket: Ticket, onStatusChange: (String) -> Unit) {
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
                val ticketNumberLabel: String =
                    if (ticket.ticketNumber.isNotBlank()) ticket.ticketNumber else ticket.id.takeLast(4)
                val subjectLabel: String =
                    if (ticket.subject.isNotBlank()) ticket.subject else "Support Inquiry"

                Text(
                    text = "#$ticketNumberLabel • $subjectLabel",
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
                        text = ticket.priority.uppercase(),
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

            val descriptionLabel: String =
                if (ticket.description.isNotBlank()) ticket.description else "No detailed description"

            Text(
                text = descriptionLabel,
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
                val customerLabel: String = when {
                    ticket.visitorName.isNotBlank() -> ticket.visitorName
                    ticket.visitorEmail.isNotBlank() -> ticket.visitorEmail
                    else -> "Guest"
                }

                Text(
                    text = "Customer: $customerLabel",
                    color = Slate500,
                    style = MaterialTheme.typography.bodySmall,
                    fontSize = 11.sp,
                    modifier = Modifier.weight(1f)
                )

                // Tap to change status: Open / In Progress / Resolved / Closed
                var menuExpanded by remember { mutableStateOf(false) }
                Box {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(ticketStatusColor(ticket.status).copy(alpha = 0.15f))
                            .clickable { menuExpanded = true }
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = ticketStatusLabel(ticket.status),
                            color = ticketStatusColor(ticket.status),
                            style = MaterialTheme.typography.bodySmall,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Icon(
                            Icons.Default.ArrowDropDown,
                            contentDescription = "Change status",
                            tint = ticketStatusColor(ticket.status),
                            modifier = Modifier.size(16.dp)
                        )
                    }

                    DropdownMenu(
                        expanded = menuExpanded,
                        onDismissRequest = { menuExpanded = false }
                    ) {
                        TicketStatusFilter.entries.forEach { filter ->
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        text = filter.label,
                                        color = if (filter.value == ticket.status) ticketStatusColor(filter.value) else Slate900,
                                        fontWeight = if (filter.value == ticket.status) FontWeight.Bold else FontWeight.Normal
                                    )
                                },
                                onClick = {
                                    menuExpanded = false
                                    if (filter.value != ticket.status) onStatusChange(filter.value)
                                }
                            )
                        }
                    }
                }
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
