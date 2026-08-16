package com.aacreativeemb.support.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.aacreativeemb.support.data.local.ConversationEntity
import com.aacreativeemb.support.data.local.MessageEntity
import com.aacreativeemb.support.data.local.PreferencesManager
import com.aacreativeemb.support.data.local.VisitorEntity
import com.aacreativeemb.support.data.model.*
import com.aacreativeemb.support.data.repository.SupportRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class MainViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = SupportRepository(application)
    private val prefs = PreferencesManager(application)

    val currentUser: StateFlow<User?> = MutableStateFlow(prefs.getCurrentUser()).asStateFlow()
    val currentState: StateFlow<StateResponse?> = repository.currentState
    val isRefreshing: StateFlow<Boolean> = repository.isRefreshing

    // Room DB cached streams
    val conversations: Flow<List<ConversationEntity>> = repository.localConversations
    val visitors: Flow<List<VisitorEntity>> = repository.localVisitors
    val onlineVisitors: Flow<List<VisitorEntity>> = repository.localOnlineVisitors

    // Active chat state
    private val _activeConversationId = MutableStateFlow<String?>(null)
    val activeConversationId = _activeConversationId.asStateFlow()

    private val _activeMessages = MutableStateFlow<List<MessageEntity>>(emptyList())
    val activeMessages = _activeMessages.asStateFlow()

    private val _isSendingMessage = MutableStateFlow(false)
    val isSendingMessage = _isSendingMessage.asStateFlow()

    private var pollingJob: Job? = null
    private var activeChatPollingJob: Job? = null

    init {
        startStatePolling()
    }

    /**
     * Start background polling loop for /api/state every 6 seconds
     */
    fun startStatePolling() {
        pollingJob?.cancel()
        pollingJob = viewModelScope.launch {
            while (isActive) {
                repository.syncState()
                delay(6000)
            }
        }
    }

    fun stopStatePolling() {
        pollingJob?.cancel()
        pollingJob = null
    }

    /**
     * Set active conversation & start rapid polling (3 seconds) for the chat screen
     */
    fun openConversation(conversationId: String) {
        _activeConversationId.value = conversationId
        activeChatPollingJob?.cancel()

        // Observe local DB messages for this conversation
        viewModelScope.launch {
            repository.getLocalMessages(conversationId).collect { msgs ->
                _activeMessages.value = msgs
            }
        }

        // Rapid 3s polling for active chat
        activeChatPollingJob = viewModelScope.launch {
            while (isActive) {
                repository.syncConversationMessages(conversationId)
                delay(3500)
            }
        }
    }

    fun closeActiveConversation() {
        _activeConversationId.value = null
        activeChatPollingJob?.cancel()
        activeChatPollingJob = null
        _activeMessages.value = emptyList()
    }

    /**
     * Send message from Agent
     */
    fun sendMessage(text: String, autoPolish: Boolean = true) {
        val convId = _activeConversationId.value ?: return
        val user = prefs.getCurrentUser() ?: return
        if (text.isBlank()) return

        viewModelScope.launch {
            _isSendingMessage.value = true
            repository.sendAgentMessage(
                conversationId = convId,
                agentId = user.id,
                text = text.trim(),
                autoPolish = autoPolish
            )
            _isSendingMessage.value = false
        }
    }

    /**
     * Update conversation status (e.g., "closing", "resolved", "open", "pending", "escalated")
     */
    fun updateStatus(status: String) {
        val convId = _activeConversationId.value ?: return
        viewModelScope.launch {
            repository.updateConversationStatus(convId, status)
        }
    }

    /**
     * Assign conversation to currently logged-in agent
     */
    fun assignToMe() {
        val convId = _activeConversationId.value ?: return
        val user = prefs.getCurrentUser() ?: return
        viewModelScope.launch {
            repository.assignConversation(convId, user.id)
        }
    }

    /**
     * Toggle Agent Online / Away / Offline Status
     */
    fun setAgentStatus(status: String) {
        val user = prefs.getCurrentUser() ?: return
        viewModelScope.launch {
            repository.updateUserStatus(user.id, status)
        }
    }

    /**
     * Manual refresh
     */
    fun refresh() {
        viewModelScope.launch {
            repository.syncState()
            _activeConversationId.value?.let { convId ->
                repository.syncConversationMessages(convId)
            }
        }
    }

    /**
     * Save / Update Ticket
     */
    fun saveTicket(ticket: Ticket, onComplete: () -> Unit) {
        viewModelScope.launch {
            repository.saveTicket(ticket)
            onComplete()
        }
    }

    /**
     * Logout
     */
    fun logout(onComplete: () -> Unit) {
        viewModelScope.launch {
            val user = prefs.getCurrentUser()
            if (user != null) {
                repository.updateUserStatus(user.id, "offline")
            }
            prefs.clearSession()
            stopStatePolling()
            activeChatPollingJob?.cancel()
            onComplete()
        }
    }
}
