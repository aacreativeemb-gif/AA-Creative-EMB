# AA Creative Support — Native Android Admin App

A native Android client (Kotlin, Jetpack Compose, Material 3, minSdk 26) for **AA Creative Embroidery UK Ltd** live-chat customer support backend.

Live Backend: `https://chat.aacreativeemb.com`

---

## 📱 Features

1. **Secure Admin Authentication & 2FA Flow**:
   - `POST /api/admin/login` with persistent UUID `deviceId` in `EncryptedSharedPreferences`.
   - 6-digit OTP verification screen (`POST /api/admin/verify-2fa`) when required.
   - Remembers and trusts verified devices.

2. **Real-Time Data Sync**:
   - **Foreground**: `GET /api/state` polling every 5–8 seconds.
   - **Active Chat Screen**: `GET /api/conversations/:id/messages` rapid polling every 3.5 seconds.
   - **Local Cache**: Room Database for instant offline / slow connection inbox loading.

3. **Live Chat Management**:
   - Agent replying via `POST /api/agent/message` (automatically transitions handling from AI to human).
   - "Assign to Me" (`POST /api/conversations/assign`).
   - "Close Chat" with polite closing flow (`POST /api/conversations/status` with `"closing"`).
   - Visual distinction for Visitor, AI Specialist, Agent, and System messages.

4. **Live Visitor Tracking**:
   - Live country flags (🇬🇧, 🇺🇸, etc.), cities, IPs, and active page URLs matching the web portal.

5. **Background Sync & Local Push Notifications**:
   - WorkManager periodic polling detects incoming unread messages or new online website visitors.
   - High-priority sound notification with deep link into the specific conversation.
   - *(Note: True zero-delay background push when the app process is completely killed by the OS will require adding Firebase Cloud Messaging [FCM] to the Node.js backend as a future server-side enhancement).*

---

## 🛠️ How to Open & Run in Android Studio

1. Open **Android Studio** (Hedgehog / Iguana / Jellyfish or newer).
2. Choose **File > Open** and select the `/android` directory.
3. Allow Gradle to sync dependencies.
4. Run on an Android Device or Emulator running Android 8.0+ (API 26+).
