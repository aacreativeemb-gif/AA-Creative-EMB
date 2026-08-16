package com.aacreativeemb.support.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aacreativeemb.support.ui.theme.*
import com.aacreativeemb.support.ui.viewmodel.AuthUiState
import com.aacreativeemb.support.ui.viewmodel.AuthViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OtpScreen(
    email: String,
    message: String,
    authViewModel: AuthViewModel,
    onBack: () -> Unit,
    onVerificationSuccess: () -> Unit
) {
    var code by remember { mutableStateOf("") }
    val uiState by authViewModel.uiState.collectAsState()
    val focusManager = LocalFocusManager.current

    LaunchedEffect(uiState) {
        if (uiState is AuthUiState.Success) {
            onVerificationSuccess()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Security Verification", color = White) },
                navigationIcon = {
                    IconButton(onClick = {
                        authViewModel.resetState()
                        onBack()
                    }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Navy900)
            )
        },
        containerColor = Navy900
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Navy800)
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier
                            .size(56.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Indigo600.copy(alpha = 0.2f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Shield,
                            contentDescription = null,
                            tint = Sky400,
                            modifier = Modifier.size(32.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "Enter 6-Digit Code",
                        style = MaterialTheme.typography.titleLarge,
                        color = White,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = "A security verification code has been dispatched to:",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Slate400,
                        textAlign = TextAlign.Center
                    )

                    Text(
                        text = email,
                        style = MaterialTheme.typography.bodyMedium,
                        color = Sky400,
                        fontWeight = FontWeight.SemiBold,
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    // 6-digit Code Field
                    OutlinedTextField(
                        value = code,
                        onValueChange = { if (it.length <= 6) code = it },
                        placeholder = { Text("000000", color = Slate500) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        textStyle = LocalTextStyle.current.copy(
                            textAlign = TextAlign.Center,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 8.sp,
                            color = White
                        ),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Indigo500,
                            unfocusedBorderColor = Navy700,
                            focusedTextColor = White,
                            unfocusedTextColor = White
                        ),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.NumberPassword,
                            imeAction = ImeAction.Done
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = {
                                focusManager.clearFocus()
                                authViewModel.verify2fa(email, code)
                            }
                        )
                    )

                    if (uiState is AuthUiState.Error) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = (uiState as AuthUiState.Error).message,
                            color = Rose500,
                            style = MaterialTheme.typography.bodySmall,
                            textAlign = TextAlign.Center
                        )
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    Button(
                        onClick = {
                            focusManager.clearFocus()
                            authViewModel.verify2fa(email, code)
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Indigo600),
                        enabled = code.length == 6 && uiState !is AuthUiState.Loading
                    ) {
                        if (uiState is AuthUiState.Loading) {
                            CircularProgressIndicator(
                                color = White,
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text("Verify & Trust This Device", fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }
    }
}
