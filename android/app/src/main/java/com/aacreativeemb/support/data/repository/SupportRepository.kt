package com.aacreativeemb.support.data.repository

import android.content.Context
import android.util.Log
import com.aacreativeemb.support.data.api.ApiClient
import com.aacreativeemb.support.data.local.*
import com.aacreativeemb.support.data.model.*
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext

private const val TAG = "SupportRepository"

class SupportRepository(context: Context) {

    private val api = ApiClient.getInstance(context)
    private val db = AppDatabase.getInstance(context)
    private val prefs = PreferencesManager(context)
    private val gson = Gson()

    private val _currentState = MutableStateFlow<StateResponse?>(null)
    val currentState = _currentState.asStateFlow()

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing = _isRefreshing.asStateFlow()

    // Human-readable reason the last sync failed (network error, server error,
    // parsing error, etc.) — null when the last sync succeeded. The UI shows
    // this as a banner instead of silently staying empty forever.
    private val _syncError = MutableStateFlow<String?>(null)
    val syncError = _syncError.asStateFlow()

    // Local cached flows
    val localConversations: Flow<List<ConversationEntity>> = db.conversationDao().getAllConversations()
    val localVisitors: Flow<List<VisitorEntity>> = db.visitorDao().getAllVisitors()
    val localOnlineVisitors: Flow<List<VisitorEntity>> = db.visitorDao().getOnlineVisitors()

    fun getLocalMessages(conversationId: String): Flow<List<MessageEntity>> {
        return db.messageDao().getMessagesForConversation(conversationId)
    }

    /**
     * Polls /api/state and updates Room DB cache + in-memory state
     */
    suspend fun syncState(): Result<StateResponse> = withContext(Dispatchers.IO) {
        try {
            _isRefreshing.value = true
            val response = api.getState()
            if (response.isSuccessful && response.body() != null) {
                val state = response.body()!!
                _currentState.value = state
                _syncError.value = null

                // Cache in Room DB
                val visitorMap = state.visitors.associateBy { it.id }

                val convEntities = state.conversations.map { c ->
                    val vis = visitorMap[c.visitorId]
                    ConversationEntity(
                        id = c.id,
                        visitorId = c.visitorId,
                        visitorName = vis?.name ?: "Website Visitor",
                        visitorCountry = vis?.location?.country ?: "United Kingdom",
                        visitorFlag = vis?.location?.flag ?: "🇬🇧",
                        channel = c.channel,
                        status = c.status,
                        priority = c.priority,
                        subject = c.subject,
                        lastMessageText = c.lastMessageText,
                        lastMessageAt = c.lastMessageAt,
                        unreadCountAgent = c.unreadCountAgent,
                        isAiHandling = c.isAiHandling,
                        assignedAgentId = c.assignedAgentId,
                        rating = c.rating,
                        feedback = c.feedback
                    )
                }
                db.conversationDao().insertConversations(convEntities)

                val visitorEntities = state.visitors.map { v ->
                    VisitorEntity(
                        id = v.id,
                        name = v.name,
                        email = v.email,
                        ip = v.ip,
                        country = v.location.country,
                        city = v.location.city,
                        flag = v.location.flag,
                        currentUrl = v.currentUrl,
                        status = v.status,
                        visitsCount = v.visitsCount,
                        timeOnSiteSeconds = v.timeOnSiteSeconds,
                        lastActiveAt = v.lastActiveAt,
                        firstSeenAt = v.firstSeenAt,
                        sessionStartedAt = v.sessionStartedAt,
                        tagsJson = gson.toJson(v.tags)
                    )
                }
                db.visitorDao().insertVisitors(visitorEntities)

                // Cache recent messages
                val allMessages = state.messages.flatMap { (convId, msgList) ->
                    msgList.map { m ->
                        MessageEntity(
                            id = m.id,
                            conversationId = convId,
                            senderType = m.senderType,
                            senderId = m.senderId,
                            senderName = m.senderName,
                            text = m.text,
                            timestamp = m.timestamp,
                            channel = m.channel
                        )
                    }
                }
                if (allMessages.isNotEmpty()) {
                    db.messageDao().insertMessages(allMessages)
                }

                Result.success(state)
            } else {
                val errorBody = try { response.errorBody()?.string() } catch (e: Exception) { null }
                val msg = "Server returned ${response.code()} ${response.message()}${if (!errorBody.isNullOrBlank()) " — $errorBody" else ""}"
                Log.e(TAG, "syncState failed: $msg")
                _syncError.value = msg
                Result.failure(Exception(msg))
            }
        } catch (e: Exception) {
            val msg = "${e.javaClass.simpleName}: ${e.message ?: "Could not reach https://chat.aacreativeemb.com — check internet connection"}"
            Log.e(TAG, "syncState exception", e)
            _syncError.value = msg
            Result.failure(e)
        } finally {
            _isRefreshing.value = false
        }
    }

    /**
     * Rapid per-conversation polling for active chat screen
     */
    suspend fun syncConversationMessages(conversationId: String): Result<List<Message>> = withContext(Dispatchers.IO) {
        try {
            val response = api.getConversationMessages(conversationId)
            if (response.isSuccessful && response.body() != null && response.body()!!.success) {
                val data = response.body()!!
                val messages = data.messages

                val entities = messages.map { m ->
                    MessageEntity(
                        id = m.id,
                        conversationId = conversationId,
                        senderType = m.senderType,
                        senderId = m.senderId,
                        senderName = m.senderName,
                        text = m.text,
                        timestamp = m.timestamp,
                        channel = m.channel
                    )
                }
                db.messageDao().insertMessages(entities)

                data.conversation?.let { c ->
                    db.conversationDao().updateStatus(c.id, c.status)
                }

                Result.success(messages)
            } else {
                Result.failure(Exception("Failed to fetch messages"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Send message as Agent
     */
    suspend fun sendAgentMessage(
        conversationId: String,
        agentId: String,
        text: String,
        autoPolish: Boolean = true
    ): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val req = AgentMessageRequest(
                conversationId = conversationId,
                agentId = agentId,
                text = text,
                autoPolish = autoPolish
            )
            val response = api.sendAgentMessage(req)
            if (response.isSuccessful && response.body()?.success == true) {
                // Instantly re-sync to get the new message
                syncConversationMessages(conversationId)
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Failed to send message"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Assign conversation to agent
     */
    suspend fun assignConversation(conversationId: String, agentId: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val response = api.assignConversation(AssignRequest(conversationId, agentId))
            if (response.isSuccessful && response.body()?.success == true) {
                syncState()
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Failed to assign chat"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Update conversation status ("closing", "resolved", "open", "pending", "escalated")
     */
    suspend fun updateConversationStatus(
        conversationId: String,
        status: String,
        rating: Int? = null,
        feedback: String? = null
    ): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val response = api.updateConversationStatus(
                StatusRequest(
                    conversationId = conversationId,
                    status = status,
                    rating = rating,
                    feedback = feedback
                )
            )
            if (response.isSuccessful && response.body()?.success == true) {
                db.conversationDao().updateStatus(conversationId, status)
                syncState()
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Failed to update status"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Update logged-in agent status (online, away, offline)
     */
    suspend fun updateUserStatus(userId: String, status: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val response = api.updateUserStatus(UserStatusRequest(userId, status))
            if (response.isSuccessful) {
                // Update local user representation
                val currentUser = prefs.getCurrentUser()
                if (currentUser != null && currentUser.id == userId) {
                    prefs.saveCurrentUser(currentUser.copy(status = status))
                }
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to update status"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Save Ticket
     */
    suspend fun saveTicket(ticket: Ticket): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val response = api.saveTicket(ticket)
            if (response.isSuccessful && response.body()?.success == true) {
                syncState()
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Failed to save ticket"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
