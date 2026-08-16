package com.aacreativeemb.support.data.model

import com.google.gson.annotations.SerializedName

data class StateResponse(
    @SerializedName("users") val users: List<User> = emptyList(),
    @SerializedName("visitors") val visitors: List<Visitor> = emptyList(),
    @SerializedName("conversations") val conversations: List<Conversation> = emptyList(),
    @SerializedName("messages") val messages: Map<String, List<Message>> = emptyMap(),
    @SerializedName("tickets") val tickets: List<Ticket> = emptyList(),
    @SerializedName("departments") val departments: List<Department> = emptyList(),
    @SerializedName("aiSettings") val aiSettings: AiSettings? = null
)

data class User(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("email") val email: String,
    @SerializedName("userId") val userId: String? = null,
    @SerializedName("avatar") val avatar: String? = null,
    @SerializedName("role") val role: String = "agent", // "admin" or "agent"
    @SerializedName("status") val status: String = "offline", // "online", "away", "offline"
    @SerializedName("capacity") val capacity: Int = 8,
    @SerializedName("activeChatsCount") val activeChatsCount: Int = 0
)

data class Visitor(
    @SerializedName("id") val id: String,
    @SerializedName("propertyId") val propertyId: String = "prop_1",
    @SerializedName("name") val name: String = "Website Visitor",
    @SerializedName("email") val email: String = "",
    @SerializedName("ip") val ip: String = "",
    @SerializedName("location") val location: VisitorLocation = VisitorLocation(),
    @SerializedName("browser") val browser: String = "",
    @SerializedName("os") val os: String = "",
    @SerializedName("device") val device: String = "Desktop",
    @SerializedName("currentUrl") val currentUrl: String = "",
    @SerializedName("landingPage") val landingPage: String = "",
    @SerializedName("referrer") val referrer: String = "Direct",
    @SerializedName("visitsCount") val visitsCount: Int = 1,
    @SerializedName("pagesViewed") val pagesViewed: Int = 1,
    @SerializedName("timeOnSiteSeconds") val timeOnSiteSeconds: Long = 0,
    @SerializedName("status") val status: String = "offline", // "online", "idle", "offline"
    @SerializedName("lastActiveAt") val lastActiveAt: String = "",
    @SerializedName("firstSeenAt") val firstSeenAt: String? = null,
    @SerializedName("sessionStartedAt") val sessionStartedAt: String? = null,
    @SerializedName("leadCapturedAt") val leadCapturedAt: String? = null,
    @SerializedName("tags") val tags: List<String> = emptyList(),
    @SerializedName("notes") val notes: List<String> = emptyList()
)

data class VisitorLocation(
    @SerializedName("country") val country: String = "United Kingdom",
    @SerializedName("city") val city: String = "London",
    @SerializedName("flag") val flag: String = "🇬🇧"
)

data class Conversation(
    @SerializedName("id") val id: String,
    @SerializedName("propertyId") val propertyId: String = "prop_1",
    @SerializedName("visitorId") val visitorId: String,
    @SerializedName("channel") val channel: String = "website", // "website", "gmail", "whatsapp", "ticket"
    @SerializedName("departmentId") val departmentId: String? = null,
    @SerializedName("assignedAgentId") val assignedAgentId: String? = null,
    @SerializedName("isAiHandling") val isAiHandling: Boolean = true,
    @SerializedName("status") val status: String = "open", // "open", "queue", "pending", "escalated", "resolved", "closed", "closing"
    @SerializedName("priority") val priority: String = "normal", // "low", "normal", "high", "urgent"
    @SerializedName("subject") val subject: String = "",
    @SerializedName("lastMessageText") val lastMessageText: String = "",
    @SerializedName("lastMessageAt") val lastMessageAt: String = "",
    @SerializedName("unreadCountAgent") val unreadCountAgent: Int = 0,
    @SerializedName("unreadCountVisitor") val unreadCountVisitor: Int = 0,
    @SerializedName("sourceDetail") val sourceDetail: String? = null,
    @SerializedName("rating") val rating: Int? = null,
    @SerializedName("feedback") val feedback: String? = null
)

data class Message(
    @SerializedName("id") val id: String,
    @SerializedName("conversationId") val conversationId: String,
    @SerializedName("senderType") val senderType: String, // "visitor", "agent", "ai", "system"
    @SerializedName("senderId") val senderId: String = "",
    @SerializedName("senderName") val senderName: String = "",
    @SerializedName("text") val text: String,
    @SerializedName("timestamp") val timestamp: String,
    @SerializedName("attachments") val attachments: List<Any> = emptyList(),
    @SerializedName("channel") val channel: String = "website",
    @SerializedName("deliveryStatus") val deliveryStatus: String = "delivered"
)

data class Ticket(
    @SerializedName("id") val id: String,
    @SerializedName("ticketNumber") val ticketNumber: Int = 0,
    @SerializedName("conversationId") val conversationId: String? = null,
    @SerializedName("visitorId") val visitorId: String = "",
    @SerializedName("visitorName") val visitorName: String = "",
    @SerializedName("visitorEmail") val visitorEmail: String = "",
    @SerializedName("subject") val subject: String = "",
    @SerializedName("description") val description: String = "",
    @SerializedName("status") val status: String = "open", // "open", "pending", "resolved", "closed"
    @SerializedName("priority") val priority: String = "normal", // "low", "medium", "high", "urgent"
    @SerializedName("departmentId") val departmentId: String = "dept_support",
    @SerializedName("assignedAgentId") val assignedAgentId: String? = null,
    @SerializedName("tags") val tags: List<String> = emptyList(),
    @SerializedName("createdAt") val createdAt: String = "",
    @SerializedName("updatedAt") val updatedAt: String = ""
)

data class Department(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("description") val description: String = ""
)

data class AiSettings(
    @SerializedName("mode") val mode: String = "hybrid",
    @SerializedName("aiName") val aiName: String = "AA Support Specialist",
    @SerializedName("brandTone") val brandTone: String = "professional",
    @SerializedName("customGreeting") val customGreeting: String = ""
)

// --- Auth Requests & Responses ---
data class LoginRequest(
    @SerializedName("email") val email: String,
    @SerializedName("password") val password: String,
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("isGoogleAuth") val isGoogleAuth: Boolean = false
)

data class LoginResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("token") val token: String? = null,
    @SerializedName("user") val user: User? = null,
    @SerializedName("requires2FA") val requires2FA: Boolean? = null,
    @SerializedName("email") val email: String? = null,
    @SerializedName("message") val message: String? = null,
    @SerializedName("trustedDevice") val trustedDevice: Boolean? = null,
    @SerializedName("error") val error: String? = null
)

data class Verify2faRequest(
    @SerializedName("email") val email: String,
    @SerializedName("code") val code: String,
    @SerializedName("deviceId") val deviceId: String
)

// --- Action Requests ---
data class AgentMessageRequest(
    @SerializedName("conversationId") val conversationId: String,
    @SerializedName("agentId") val agentId: String,
    @SerializedName("text") val text: String,
    @SerializedName("attachments") val attachments: List<Any> = emptyList(),
    @SerializedName("autoPolish") val autoPolish: Boolean = true
)

data class AssignRequest(
    @SerializedName("conversationId") val conversationId: String,
    @SerializedName("agentId") val agentId: String
)

data class StatusRequest(
    @SerializedName("conversationId") val conversationId: String,
    @SerializedName("status") val status: String? = null,
    @SerializedName("priority") val priority: String? = null,
    @SerializedName("rating") val rating: Int? = null,
    @SerializedName("feedback") val feedback: String? = null
)

data class UserStatusRequest(
    @SerializedName("userId") val userId: String,
    @SerializedName("status") val status: String // "online", "away", "offline"
)

data class ConversationMessagesResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("conversation") val conversation: Conversation? = null,
    @SerializedName("messages") val messages: List<Message> = emptyList()
)

data class GenericResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("error") val error: String? = null,
    @SerializedName("message") val message: String? = null
)
