package com.aacreativeemb.support.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface ConversationDao {

    @Query("SELECT * FROM conversations ORDER BY lastMessageAt DESC")
    fun getAllConversations(): Flow<List<ConversationEntity>>

    @Query("SELECT * FROM conversations WHERE id = :convId LIMIT 1")
    suspend fun getConversationById(convId: String): ConversationEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertConversations(conversations: List<ConversationEntity>)

    @Query("UPDATE conversations SET status = :status WHERE id = :convId")
    suspend fun updateStatus(convId: String, status: String)

    @Query("DELETE FROM conversations")
    suspend fun clearAll()
}

@Dao
interface MessageDao {

    @Query("SELECT * FROM messages WHERE conversationId = :convId ORDER BY timestamp ASC")
    fun getMessagesForConversation(convId: String): Flow<List<MessageEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMessages(messages: List<MessageEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMessage(message: MessageEntity)

    @Query("DELETE FROM messages WHERE conversationId = :convId")
    suspend fun clearForConversation(convId: String)
}

@Dao
interface VisitorDao {

    @Query("SELECT * FROM visitors ORDER BY lastActiveAt DESC")
    fun getAllVisitors(): Flow<List<VisitorEntity>>

    @Query("SELECT * FROM visitors WHERE status = 'online' ORDER BY lastActiveAt DESC")
    fun getOnlineVisitors(): Flow<List<VisitorEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertVisitors(visitors: List<VisitorEntity>)

    @Query("DELETE FROM visitors")
    suspend fun clearAll()
}
