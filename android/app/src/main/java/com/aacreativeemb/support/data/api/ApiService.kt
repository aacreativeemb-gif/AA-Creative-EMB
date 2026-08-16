package com.aacreativeemb.support.data.api

import com.aacreativeemb.support.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    // --- Authentication ---
    @POST("api/admin/login")
    suspend fun login(
        @Body request: LoginRequest
    ): Response<LoginResponse>

    @POST("api/admin/verify-2fa")
    suspend fun verify2fa(
        @Body request: Verify2faRequest
    ): Response<LoginResponse>

    // --- Main State Sync ---
    @GET("api/state")
    suspend fun getState(): Response<StateResponse>

    // --- Lightweight Chat Polling ---
    @GET("api/conversations/{id}/messages")
    suspend fun getConversationMessages(
        @Path("id") conversationId: String
    ): Response<ConversationMessagesResponse>

    // --- Send Message as Agent ---
    @POST("api/agent/message")
    suspend fun sendAgentMessage(
        @Body request: AgentMessageRequest
    ): Response<GenericResponse>

    // --- Assign Agent ---
    @POST("api/conversations/assign")
    suspend fun assignConversation(
        @Body request: AssignRequest
    ): Response<GenericResponse>

    // --- Update Conversation Status ---
    @POST("api/conversations/status")
    suspend fun updateConversationStatus(
        @Body request: StatusRequest
    ): Response<GenericResponse>

    // --- Update Agent Own Status (online, away, offline) ---
    @POST("api/users/status")
    suspend fun updateUserStatus(
        @Body request: UserStatusRequest
    ): Response<GenericResponse>

    // --- Create / Update Ticket ---
    @POST("api/tickets")
    suspend fun saveTicket(
        @Body ticket: Ticket
    ): Response<GenericResponse>
}
