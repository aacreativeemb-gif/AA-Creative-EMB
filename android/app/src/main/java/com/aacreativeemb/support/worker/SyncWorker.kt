package com.aacreativeemb.support.worker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.*
import com.aacreativeemb.support.MainActivity
import com.aacreativeemb.support.R
import com.aacreativeemb.support.data.api.ApiClient
import com.aacreativeemb.support.data.local.AppDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

class SyncWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        const val CHANNEL_ID = "aa_support_alerts"
        private const val WORK_NAME = "aa_support_periodic_sync"

        fun schedulePeriodicSync(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val workRequest = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.LINEAR, 30, TimeUnit.SECONDS)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                workRequest
            )
        }
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val api = ApiClient.getInstance(context)
            val db = AppDatabase.getInstance(context)

            val response = api.getState()
            if (!response.isSuccessful || response.body() == null) {
                return@withContext Result.retry()
            }

            val state = response.body()!!

            // Check for unread messages
            val unreadConvs = state.conversations.filter { it.unreadCountAgent > 0 }
            if (unreadConvs.isNotEmpty()) {
                val totalUnread = unreadConvs.sumOf { it.unreadCountAgent }
                val topConv = unreadConvs.first()
                val visitor = state.visitors.find { it.id == topConv.visitorId }
                val visitorName = visitor?.name ?: "Website Customer"

                showNotification(
                    notificationId = 1001,
                    title = "💬 $totalUnread New Message(s) from $visitorName",
                    message = topConv.lastMessageText.ifBlank { "Customer is waiting for support." },
                    conversationId = topConv.id
                )
            }

            // Check for active online visitors
            val liveVisitors = state.visitors.filter { it.status == "online" }
            if (liveVisitors.isNotEmpty()) {
                val topVis = liveVisitors.first()
                val lastSeenSeconds = (System.currentTimeMillis() - try {
                    java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US)
                        .parse(topVis.lastActiveAt)?.time ?: System.currentTimeMillis()
                } catch (e: Exception) {
                    System.currentTimeMillis()
                }) / 1000

                if (lastSeenSeconds < 90) {
                    showNotification(
                        notificationId = 1002,
                        title = "👀 Live Visitor on Website: ${topVis.name}",
                        message = "${topVis.location.flag} ${topVis.location.city}, ${topVis.location.country} is browsing ${topVis.currentUrl}",
                        conversationId = null
                    )
                }
            }

            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    private fun showNotification(
        notificationId: Int,
        title: String,
        message: String,
        conversationId: String?
    ) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val audioAttributes = android.media.AudioAttributes.Builder()
                .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()

            val channel = NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.notification_channel_name),
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = context.getString(R.string.notification_channel_desc)
                enableLights(true)
                enableVibration(true)
                // On Android 8+ (Oreo), a notification's sound is only
                // honoured if it's set HERE on the channel -- calling
                // .setSound() on the individual Notification.Builder below
                // is silently ignored once a channel exists. Setting it
                // explicitly here (instead of relying on the OS default)
                // guarantees the ding plays consistently across devices.
                setSound(soundUri, audioAttributes)
            }
            notificationManager.createNotificationChannel(channel)
        }

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            if (!conversationId.isNullOrEmpty()) {
                putExtra("EXTRA_CONVERSATION_ID", conversationId)
            }
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setSound(soundUri)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        notificationManager.notify(notificationId, notification)
    }
}
