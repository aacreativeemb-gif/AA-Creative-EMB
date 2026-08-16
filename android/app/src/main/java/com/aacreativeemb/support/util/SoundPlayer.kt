package com.aacreativeemb.support.util

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.util.Log

/**
 * Plays a short "ding" (the device's default notification sound) while the
 * app is open in the foreground -- this is the Android equivalent of the
 * "1s Ding Sound" that plays on the web admin dashboard whenever a new
 * visitor arrives or a new message comes in.
 *
 * This is intentionally separate from SyncWorker's notification sound:
 * SyncWorker only fires in the background (every 15 minutes, an Android OS
 * limit for periodic work) and shows a system notification with sound.
 * This SoundPlayer fires instantly (within ~6 seconds, matching the
 * foreground polling interval) while the app is actually open, so the
 * agent hears it live -- just like the web dashboard.
 */
object SoundPlayer {
    private const val TAG = "SoundPlayer"
    private var mediaPlayer: MediaPlayer? = null

    fun playDing(context: Context) {
        try {
            // Stop/release any ding still playing from a previous trigger
            // before starting a new one.
            mediaPlayer?.release()
            mediaPlayer = null

            val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: return

            val player = MediaPlayer()
            mediaPlayer = player

            player.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
            player.setDataSource(context, soundUri)
            player.setOnCompletionListener {
                it.release()
                if (mediaPlayer === it) mediaPlayer = null
            }
            player.setOnErrorListener { mp, _, _ ->
                mp.release()
                if (mediaPlayer === mp) mediaPlayer = null
                true
            }
            player.prepare()
            player.start()
        } catch (e: Exception) {
            // A failed ding should never crash the sync loop -- just log it.
            Log.w(TAG, "Could not play ding sound: ${e.message}")
        }
    }
}
