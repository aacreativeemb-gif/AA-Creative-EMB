package com.aacreativeemb.support.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.aacreativeemb.support.data.api.ApiClient
import com.aacreativeemb.support.data.local.PreferencesManager
import com.aacreativeemb.support.data.model.LoginRequest
import com.aacreativeemb.support.data.model.User
import com.aacreativeemb.support.data.model.Verify2faRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class AuthUiState {
    object Idle : AuthUiState()
    object Loading : AuthUiState()
    data class Require2FA(val email: String, val message: String) : AuthUiState()
    data class Success(val user: User) : AuthUiState()
    data class Error(val message: String) : AuthUiState()
}

class AuthViewModel(application: Application) : AndroidViewModel(application) {

    private val api = ApiClient.getInstance(application)
    private val prefs = PreferencesManager(application)

    private val _uiState = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val uiState = _uiState.asStateFlow()

    val deviceId: String get() = prefs.getDeviceId()
    val currentUser: User? get() = prefs.getCurrentUser()
    val isAuthenticated: Boolean get() = !prefs.getAuthToken().isNullOrEmpty() && prefs.getCurrentUser() != null

    fun login(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) {
            _uiState.value = AuthUiState.Error("Please enter your email and password.")
            return
        }

        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            try {
                val req = LoginRequest(
                    email = email.trim(),
                    password = password,
                    deviceId = prefs.getDeviceId(),
                    isGoogleAuth = false
                )
                val response = api.login(req)
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!

                    if (body.requires2FA == true) {
                        _uiState.value = AuthUiState.Require2FA(
                            email = body.email ?: email,
                            message = body.message ?: "A 6-digit verification code has been dispatched to your email."
                        )
                    } else if (body.success && body.user != null) {
                        prefs.saveAuthToken(body.token)
                        prefs.saveCurrentUser(body.user)
                        prefs.setTrustedDevice(body.trustedDevice == true)
                        _uiState.value = AuthUiState.Success(body.user)
                    } else {
                        _uiState.value = AuthUiState.Error(body.error ?: "Invalid credentials.")
                    }
                } else {
                    _uiState.value = AuthUiState.Error("Server error: ${response.code()}")
                }
            } catch (e: Exception) {
                _uiState.value = AuthUiState.Error(e.localizedMessage ?: "Connection error. Please check your internet.")
            }
        }
    }

    fun verify2fa(email: String, code: String) {
        if (code.isBlank() || code.length < 6) {
            _uiState.value = AuthUiState.Error("Please enter the complete 6-digit code.")
            return
        }

        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            try {
                val req = Verify2faRequest(
                    email = email.trim(),
                    code = code.trim(),
                    deviceId = prefs.getDeviceId()
                )
                val response = api.verify2fa(req)
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    if (body.success && body.user != null) {
                        prefs.saveAuthToken(body.token)
                        prefs.saveCurrentUser(body.user)
                        prefs.setTrustedDevice(true)
                        _uiState.value = AuthUiState.Success(body.user)
                    } else {
                        _uiState.value = AuthUiState.Error(body.error ?: "Invalid verification code.")
                    }
                } else {
                    _uiState.value = AuthUiState.Error("Verification failed (${response.code()})")
                }
            } catch (e: Exception) {
                _uiState.value = AuthUiState.Error(e.localizedMessage ?: "Network error during verification.")
            }
        }
    }

    fun resetState() {
        _uiState.value = AuthUiState.Idle
    }
}
