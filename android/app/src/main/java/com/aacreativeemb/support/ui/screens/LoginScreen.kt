package com.aacreativeemb.support.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aacreativeemb.support.ui.theme.*
import com.aacreativeemb.support.ui.viewmodel.AuthUiState
import com.aacreativeemb.support.ui.viewmodel.AuthViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    authViewModel: AuthViewModel,
    onNavigateToOtp: (email: String, message: String) -> Unit,
    onLoginSuccess: () -> Unit
) {
    var email by remember { mutableStateOf("aacreativeemb@gmail.com") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }

    val uiState by authViewModel.uiState.collectAsState()
    val focusManager = LocalFocusManager.current

    LaunchedEffect(uiState) {
        when (val state = uiState) {
            is AuthUiState.Require2FA -> onNavigateToOtp(state.email, state.message)
            is AuthUiState.Success -> onLoginSuccess()
            else -> {}
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Navy900)
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // App Brand Header
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(Indigo600),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "AA",
                    color = White,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "AA Creative Support",
                style = MaterialTheme.typography.headlineMedium,
                color = White,
                fontWeight = FontWeight.Bold
            )

            Text(
                text = "Live Chat & AI Admin Portal",
                style = MaterialTheme.typography.bodyMedium,
                color = Slate400,
                modifier = Modifier.padding(top = 4.dp)
            )

            Spacer(modifier = Modifier.height(32.dp))

            // Card Container
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Navy800)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Agent Sign In",
                        style = MaterialTheme.typography.titleMedium,
                        color = White,
                        modifier = Modifier.align(Alignment.Start)
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Email Input
                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it },
                        label = { Text("Admin / Agent Email") },
                        leadingIcon = { Icon(Icons.Default.Email, contentDescription = null, tint = Slate400) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Indigo500,
                            unfocusedBorderColor = Navy700,
                            focusedTextColor = White,
                            unfocusedTextColor = White,
                            focusedLabelColor = Indigo500,
                            unfocusedLabelColor = Slate400
                        ),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Email,
                            imeAction = ImeAction.Next
                        ),
                        keyboardActions = KeyboardActions(
                            onNext = { focusManager.moveFocus(FocusDirection.Down) }
                        )
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // Password Input
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("Password") },
                        leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = Slate400) },
                        trailingIcon = {
                            IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                Icon(
                                    imageVector = if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                    contentDescription = null,
                                    tint = Slate400
                                )
                            }
                        },
                        visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Indigo500,
                            unfocusedBorderColor = Navy700,
                            focusedTextColor = White,
                            unfocusedTextColor = White,
                            focusedLabelColor = Indigo500,
                            unfocusedLabelColor = Slate400
                        ),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password,
                            imeAction = ImeAction.Done
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = {
                                focusManager.clearFocus()
                                authViewModel.login(email, password)
                            }
                        )
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    // Device ID indicator
                    Text(
                        text = "Device ID: ${authViewModel.deviceId}",
                        style = MaterialTheme.typography.bodySmall,
                        color = Slate500,
                        fontSize = 11.sp,
                        modifier = Modifier.align(Alignment.Start)
                    )

                    // Error Message Display
                    if (uiState is AuthUiState.Error) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = (uiState as AuthUiState.Error).message,
                            color = Rose500,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Navy900, RoundedCornerShape(8.dp))
                                .padding(8.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    // Login Button
                    Button(
                        onClick = {
                            focusManager.clearFocus()
                            authViewModel.login(email, password)
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Indigo600),
                        enabled = uiState !is AuthUiState.Loading
                    ) {
                        if (uiState is AuthUiState.Loading) {
                            CircularProgressIndicator(
                                color = White,
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text(
                                text = "Sign In to Admin Portal",
                                color = White,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "Connected to chat.aacreativeemb.com",
                color = Slate500,
                style = MaterialTheme.typography.bodySmall,
                fontSize = 12.sp
            )
        }
    }
}
