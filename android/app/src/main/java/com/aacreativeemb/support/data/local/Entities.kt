package com.aacreativeemb.support.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

@Entity(tableName = "conversations")
data class ConversationEntity(
    @PrimaryKey val id: String,
    val visitorId: String,
    val visitorName: String,
    val visitorCountry: String,
    val visitorFlag: String,
    val channel: String,
    val status: String,
    val priority: String,
    val subject: String,
    val lastMessageText: String,
    val lastMessageAt: String,
    val unreadCountAgent: Int,
    val isAiHandling: Boolean,
    val assignedAgentId: String?,
    val rating: Int?,
    val feedback: String?
)

@Entity(tableName = "messages")
data class MessageEntity(
    @PrimaryKey val id: String,
    val conversationId: String,
    val senderType: String,
    val senderId: String,
    val senderName: String,
    val text: String,
    val timestamp: String,
    val channel: String
)

@Entity(tableName = "visitors")
data class VisitorEntity(
    @PrimaryKey val id: String,
    val name: String,
    val email: String,
    val ip: String,
    val country: String,
    val city: String,
    val flag: String,
    val currentUrl: String,
    val status: String,
    val visitsCount: Int,
    val timeOnSiteSeconds: Long,
    val lastActiveAt: String,
    val firstSeenAt: String?,
    val sessionStartedAt: String?,
    val tagsJson: String
)

class Converters {
    private val gson = Gson()

    @TypeConverter
    fun fromStringList(value: List<String>?): String {
        return gson.toJson(value ?: emptyList<String>())
    }

    @TypeConverter
    fun toStringList(value: String?): List<String> {
        if (value.isNullOrEmpty()) return emptyList()
        val type = object : TypeToken<List<String>>() {}.type
        return gson.fromJson(value, type)
    }
}
