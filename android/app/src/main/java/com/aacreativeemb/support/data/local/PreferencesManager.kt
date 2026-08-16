package com.aacreativeemb.support.data.local

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.aacreativeemb.support.data.model.User
import com.google.gson.Gson
import java.util.UUID

class PreferencesManager(context: Context) {

    private val prefs: SharedPreferences = try {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        EncryptedSharedPreferences.create(
            context,
            "aa_support_secure_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    } catch (e: Exception) {
        // Fallback for emulators with crypto provider quirks
        context.getSharedPreferences("aa_support_prefs_fallback", Context.MODE_PRIVATE)
    }

    private val gson = Gson()

    companion object {
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_AUTH_TOKEN = "auth_token"
        private const val KEY_CURRENT_USER = "current_user"
        private const val KEY_IS_TRUSTED = "is_trusted_device"
    }

    /**
     * Returns a persistent random UUID deviceId generated once and stored securely.
     */
    fun getDeviceId(): String {
        var deviceId = prefs.getString(KEY_DEVICE_ID, null)
        if (deviceId.isNullOrEmpty()) {
            deviceId = "android_" + UUID.randomUUID().toString().replace("-", "").take(16)
            prefs.edit().putString(KEY_DEVICE_ID, deviceId).apply()
        }
        return deviceId
    }

    fun saveAuthToken(token: String?) {
        prefs.edit().putString(KEY_AUTH_TOKEN, token).apply()
    }

    fun getAuthToken(): String? {
        return prefs.getString(KEY_AUTH_TOKEN, null)
    }

    fun saveCurrentUser(user: User?) {
        if (user == null) {
            prefs.edit().remove(KEY_CURRENT_USER).apply()
        } else {
            prefs.edit().putString(KEY_CURRENT_USER, gson.toJson(user)).apply()
        }
    }

    fun getCurrentUser(): User? {
        val json = prefs.getString(KEY_CURRENT_USER, null) ?: return null
        return try {
            gson.fromJson(json, User::class.java)
        } catch (e: Exception) {
            null
        }
    }

    fun setTrustedDevice(trusted: Boolean) {
        prefs.edit().putBoolean(KEY_IS_TRUSTED, trusted).apply()
    }

    fun isTrustedDevice(): Boolean {
        return prefs.getBoolean(KEY_IS_TRUSTED, false)
    }

    fun clearSession() {
        prefs.edit()
            .remove(KEY_AUTH_TOKEN)
            .remove(KEY_CURRENT_USER)
            .apply()
    }
}
