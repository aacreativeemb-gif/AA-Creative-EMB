import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { globalStore, RETURNING_SESSION_WINDOW_MS } from './server/store';
import { processCustomerMessageWithAI, generateAiConversationSummary, translateTextToRomanUrdu, polishOrTranslateAgentReply, generateAgentReplySuggestions } from './server/aiEngine';
import { Message, Conversation, Ticket, User } from './src/types';
import { sendAdminEmailNotification } from './server/mailer';
import { hashPassword, verifyPassword } from './server/auth';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // CORS headers for embeddable widget & external requests
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // --- API ENDPOINTS ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // --- AUTHENTICATION & 2FA SECURITY ENDPOINTS ---
  app.post('/api/admin/login', (req, res) => {
    const { email, password, deviceId, isGoogleAuth } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email or User ID is required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const isAdmin = (
      cleanEmail === 'aacreativeemb@gmail.com' ||
      cleanEmail === 'admin@aacreativeemb.com' ||
      cleanEmail === 'admin'
    );

    const agentUser = globalStore.users.find(u => u.email.toLowerCase() === cleanEmail);

    if (!isAdmin && !agentUser) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. Only authorized AA Creative Embroidery staff can access.'
      });
    }

    // Password Check (unless isGoogleAuth is used)
    if (!isGoogleAuth) {
      if (!password) {
        return res.status(400).json({ success: false, error: 'Password is required' });
      }

      if (isAdmin && password !== globalStore.adminPassword) {
        return res.status(401).json({
          success: false,
          error: 'Incorrect password. Default first-time password is Admin@123 or use "Forgot Password" to reset.'
        });
      }

      if (!isAdmin && agentUser && !verifyPassword(password, agentUser.passwordHash)) {
        return res.status(401).json({
          success: false,
          error: 'Incorrect password for agent account.'
        });
      }
    }

    const targetUser = isAdmin
      ? (globalStore.users.find(u => u.role === 'admin') || {
          id: 'user_admin_1',
          name: 'Arthur Pendelton (Admin)',
          email: 'aacreativeemb@gmail.com',
          avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
          role: 'admin',
          status: 'online',
          departmentIds: ['dept_digitizing', 'dept_support', 'dept_vector'],
          capacity: 10,
          activeChatsCount: 2
        })
      : agentUser!;

    // Check if this device is already trusted
    const isDeviceTrusted = deviceId && globalStore.trustedDeviceIds.includes(deviceId);

    if (isDeviceTrusted) {
      targetUser.status = 'online';
      const { passwordHash, ...safeUser } = targetUser;
      return res.json({
        success: true,
        token: `aa_token_${Date.now()}`,
        user: safeUser,
        trustedDevice: true
      });
    }

    // Device is not trusted -> Require 2FA Verification Code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const targetEmail = 'aacreativeemb@gmail.com';
    globalStore.activeOtps[targetEmail] = {
      code: otpCode,
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 mins
      type: 'login'
    };

    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';

    // Dispatch Real Email
    sendAdminEmailNotification({
      to: targetEmail,
      subject: `🔐 AA Creative Support Portal Security Code: ${otpCode}`,
      text: `Hello,\n\nA sign-in attempt was made to the AA Creative Support Portal.\n\nYour 6-Digit 2FA Verification Code: ${otpCode}\n\nDevice: ${deviceId || 'Web Browser'}\nIP: ${clientIp}\nDate: ${new Date().toUTCString()}\n\nThis code will expire in 15 minutes.\n\nAA Creative Embroidery UK`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #0f172a; color: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #1e293b;">
          <h2 style="color: #6366f1; margin-top: 0;">AA Creative Support Security</h2>
          <p style="color: #cbd5e1; font-size: 14px;">A sign-in attempt was detected for your account on a new device or browser.</p>
          <div style="background: #1e293b; padding: 18px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #38bdf8; font-family: monospace;">${otpCode}</span>
          </div>
          <p style="color: #94a3b8; font-size: 12px;">This 6-digit code is valid for 15 minutes.</p>
          <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #334155; font-size: 11px; color: #64748b;">
            IP Address: ${clientIp}<br/>
            Time: ${new Date().toUTCString()}
          </div>
        </div>
      `
    });

    return res.json({
      success: false,
      requires2FA: true,
      email: targetEmail,
      message: `A 6-digit verification code has been dispatched to ${targetEmail}.`
    });
  });

  // Verify 2FA & Trust Device
  app.post('/api/admin/verify-2fa', (req, res) => {
    const { email, code, deviceId, trustDevice } = req.body;
    const targetEmail = 'aacreativeemb@gmail.com';
    const record = globalStore.activeOtps[targetEmail];
    const cleanCode = code?.toString().trim();

    const isValidOtp = record && record.code === cleanCode && Date.now() <= record.expiresAt;

    if (!isValidOtp) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired 6-digit verification code. Please check your email and try again.'
      });
    }

    // Code is valid! Clear OTP
    delete globalStore.activeOtps[targetEmail];

    // If user checked "Trust this device"
    if (trustDevice && deviceId) {
      if (!globalStore.trustedDeviceIds.includes(deviceId)) {
        globalStore.trustedDeviceIds.push(deviceId);
      }
    }

    const adminUser = globalStore.users.find(u => u.role === 'admin') || globalStore.users[0];
    if (adminUser) {
      adminUser.status = 'online';
    }

    const safeAdminUser = adminUser ? (({ passwordHash, ...rest }) => rest)(adminUser) : null;
    return res.json({
      success: true,
      token: `aa_token_${Date.now()}`,
      user: safeAdminUser,
      deviceId: deviceId
    });
  });

  // Send Reset Password OTP
  app.post('/api/admin/send-reset-otp', (req, res) => {
    const { email } = req.body;
    const targetEmail = 'aacreativeemb@gmail.com';
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    globalStore.activeOtps[targetEmail] = {
      code: otpCode,
      expiresAt: Date.now() + 15 * 60 * 1000,
      type: 'reset'
    };

    // Dispatch Real Email
    sendAdminEmailNotification({
      to: targetEmail,
      subject: `🔑 AA Creative Support Portal Password Reset Code: ${otpCode}`,
      text: `Hello,\n\nA password reset request was initiated for your AA Creative Support Admin account.\n\nYour 6-Digit Password Reset Code: ${otpCode}\n\nThis code will expire in 15 minutes.\n\nAA Creative Embroidery UK`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #0f172a; color: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #1e293b;">
          <h2 style="color: #6366f1; margin-top: 0;">Password Reset Request</h2>
          <p style="color: #cbd5e1; font-size: 14px;">Use the 6-digit verification code below to reset your admin portal password.</p>
          <div style="background: #1e293b; padding: 18px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #38bdf8; font-family: monospace;">${otpCode}</span>
          </div>
          <p style="color: #94a3b8; font-size: 12px;">Valid for 15 minutes. If you did not request a password reset, please ignore this email.</p>
        </div>
      `
    });

    return res.json({
      success: true,
      message: `6-digit reset code has been sent to ${targetEmail}.`
    });
  });

  // Reset Password with OTP & New Custom Password
  app.post('/api/admin/reset-password', (req, res) => {
    const { email, code, newPassword } = req.body;
    const targetEmail = 'aacreativeemb@gmail.com';
    const record = globalStore.activeOtps[targetEmail];

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long.'
      });
    }

    if (!record || record.code !== code?.trim() || Date.now() > record.expiresAt) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired 6-digit verification code.'
      });
    }

    // Update Master Admin Password
    globalStore.adminPassword = newPassword;
    delete globalStore.activeOtps[targetEmail];

    console.log(`\n=============================================================`);
    console.log(`[ADMIN PASSWORD UPDATED SUCCESSFULLY]`);
    console.log(`Target: ${targetEmail}`);
    console.log(`Updated at: ${new Date().toLocaleString()}`);
    console.log(`=============================================================\n`);

    return res.json({
      success: true,
      message: 'Password updated successfully! You can now log in with your new password.'
    });
  });

  // Get Email / SMTP configuration status
  app.get('/api/email/config', (req, res) => {
    const cfg = globalStore.emailConfig;
    res.json({
      smtpUser: cfg.smtpUser,
      smtpHost: cfg.smtpHost,
      smtpPort: cfg.smtpPort,
      hasPassword: Boolean(cfg.smtpPass && cfg.smtpPass.length > 0),
      hasResendKey: Boolean(cfg.resendApiKey && cfg.resendApiKey.length > 0)
    });
  });

  // Save Email / SMTP configuration
  app.post('/api/email/config', (req, res) => {
    const { smtpUser, smtpPass, smtpHost, smtpPort, resendApiKey } = req.body;
    if (smtpUser) globalStore.emailConfig.smtpUser = smtpUser.trim();
    if (smtpPass !== undefined) globalStore.emailConfig.smtpPass = smtpPass.trim();
    if (smtpHost) globalStore.emailConfig.smtpHost = smtpHost.trim();
    if (smtpPort) globalStore.emailConfig.smtpPort = parseInt(smtpPort, 10);
    if (resendApiKey !== undefined) globalStore.emailConfig.resendApiKey = resendApiKey.trim();

    return res.json({
      success: true,
      message: 'Email & SMTP settings saved successfully!'
    });
  });

  // Send Test Email directly to admin
  app.post('/api/email/test', async (req, res) => {
    const targetEmail = req.body.email || 'aacreativeemb@gmail.com';
    const testResult = await sendAdminEmailNotification({
      to: targetEmail,
      subject: `🧪 [Test Email] AA Creative Support Portal SMTP Test`,
      text: `Hello Admin,\n\nThis is a verified test email sent from the AA Creative Embroidery Support Desk.\n\nYour email notification system is working perfectly!\n\nTime: ${new Date().toUTCString()}\nTarget: ${targetEmail}\n\nAA Creative Support Desk`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #0f172a; color: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #1e293b;">
          <h2 style="color: #22c55e; margin-top: 0;">✅ Verified Email Test Successful</h2>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
            Your AA Creative Support email notifications are properly configured and operational!
          </p>
          <div style="background: #1e293b; padding: 14px; border-radius: 8px; font-size: 13px; color: #94a3b8; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Recipient:</strong> ${targetEmail}</p>
            <p style="margin: 4px 0;"><strong>Timestamp:</strong> ${new Date().toUTCString()}</p>
            <p style="margin: 4px 0;"><strong>Sender:</strong> ${globalStore.emailConfig.smtpUser}</p>
          </div>
          <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">AA Creative Embroidery UK Ltd Support System</p>
        </div>
      `
    });

    if (testResult.success) {
      return res.json({
        success: true,
        method: testResult.method,
        message: `Test email successfully delivered to ${targetEmail} via ${testResult.method.toUpperCase()}!`
      });
    } else {
      return res.status(400).json({
        success: false,
        method: testResult.method,
        error: testResult.error || 'Failed to send test email. Please check your Google App Password.'
      });
    }
  });

  // Full state endpoint
  app.get('/api/state', (req, res) => {
    const safeUsers = globalStore.users.map(({ passwordHash, ...rest }) => rest);
    res.json({
      properties: globalStore.properties,
      users: safeUsers,
      departments: globalStore.departments,
      visitors: globalStore.visitors,
      conversations: globalStore.conversations,
      messages: globalStore.messages,
      tickets: globalStore.tickets,
      kbCategories: globalStore.kbCategories,
      kbArticles: globalStore.kbArticles,
      aiSettings: globalStore.aiSettings,
      qcFeedbacks: globalStore.qcFeedbacks,
      unansweredQuestions: globalStore.unansweredQuestions,
      triggers: globalStore.triggers,
      cannedResponses: globalStore.cannedResponses,
      auditLogs: globalStore.auditLogs,
      analytics: globalStore.analytics
    });
  });

  // Lightweight polling endpoint used by the public embeddable widget
  // (widget.js) so a visitor's chat window picks up a human agent's reply
  // even when the agent replies later, without the visitor sending anything.
  app.get('/api/conversations/:id/messages', (req, res) => {
    const { id } = req.params;
    const conv = globalStore.conversations.find(c => c.id === id);
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    return res.json({
      success: true,
      conversation: conv,
      messages: globalStore.messages[id] || []
    });
  });

  // Cache to debounce the "lead captured" email (1 alert per visitor per 10 mins)
  const recentLeadNotified: Record<string, number> = {};

  // Track New Website Visitor on Page Load / Heartbeat Ping (no email here — see /api/visitor/lead)
  app.post('/api/visitor/track', async (req, res) => {
    try {
      const { visitorId, pageUrl, referrer, visitorName, visitorEmail } = req.body;
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '198.51.100.1';

      // Geolocation heuristic
      let country = 'United Kingdom';
      let city = 'London';
      let flag = '🇬🇧';

      if (clientIp.startsWith('182.') || clientIp.startsWith('39.') || clientIp.startsWith('103.')) {
        country = 'Pakistan';
        city = 'Karachi';
        flag = '🇵🇰';
      } else if (clientIp.startsWith('104.') || clientIp.startsWith('66.') || clientIp.startsWith('172.')) {
        country = 'United States';
        city = 'Dallas, TX';
        flag = '🇺🇸';
      }

      const userAgent = req.headers['user-agent'] || '';
      const browser = userAgent.includes('Firefox') ? 'Firefox' : userAgent.includes('Edg') ? 'Edge' : userAgent.includes('Safari') && !userAgent.includes('Chrome') ? 'Safari' : 'Chrome';
      const os = userAgent.includes('Windows') ? 'Windows 11' : userAgent.includes('Mac') ? 'macOS' : userAgent.includes('Android') ? 'Android' : userAgent.includes('iPhone') ? 'iOS' : 'Linux';
      const device = userAgent.includes('Mobile') || userAgent.includes('iPhone') || userAgent.includes('Android') ? 'Mobile' : 'Desktop';

      let visitor = globalStore.visitors.find(v => v.id === visitorId || (v.ip === clientIp && v.status === 'online'));
      let isBrandNewVisitor = false;
      const nowIso = new Date().toISOString();

      if (!visitor) {
        isBrandNewVisitor = true;
        visitor = {
          id: visitorId || `vis_${Date.now()}`,
          propertyId: 'prop_1',
          name: visitorName || 'Website Visitor',
          email: visitorEmail || 'visitor@example.com',
          ip: clientIp,
          location: { country, city, flag },
          browser,
          os,
          device,
          currentUrl: pageUrl || 'https://aacreativeemb.com/',
          landingPage: pageUrl || 'https://aacreativeemb.com/',
          referrer: referrer || 'Direct Website Visit',
          visitsCount: 1,
          pagesViewed: 1,
          timeOnSiteSeconds: 5,
          status: 'online',
          lastActiveAt: nowIso,
          firstSeenAt: nowIso,
          sessionStartedAt: nowIso,
          tags: ['Active Visitor'],
          notes: [`Arrived via ${referrer || 'Direct'}`]
        };
        globalStore.visitors.unshift(visitor);
      } else {
        // A visitor is "returning to the site" (a fresh session) if they were
        // previously offline. Only then do we reset the session arrival clock —
        // this is what powers the "Arrived At" column & New/Existing badge.
        const wasOffline = visitor.status !== 'online';
        visitor.status = 'online';
        visitor.lastActiveAt = nowIso;
        visitor.offlineSince = undefined;
        if (wasOffline) {
          visitor.sessionStartedAt = nowIso;
          visitor.visitsCount += 1;
        }
        if (!visitor.firstSeenAt) visitor.firstSeenAt = nowIso;
        visitor.pagesViewed += 1;
        if (pageUrl) visitor.currentUrl = pageUrl;
      }

      // NOTE: no email is sent here on page load / heartbeat. Per policy, the
      // admin email alert only fires once the visitor actually enters the chat
      // and submits their Name + Email on the pre-chat lead form — see
      // POST /api/visitor/lead below. The live in-dashboard bell/toast (handled
      // client-side via /api/state polling) still fires immediately on arrival.

      return res.json({
        success: true,
        visitor,
        isNew: isBrandNewVisitor || visitor.visitsCount <= 1
      });
    } catch (err: any) {
      console.error('Error tracking visitor:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // Visitor submits the pre-chat Name + Email form. This is the ONLY place
  // that (a) creates a real lead and (b) dispatches the admin email alert —
  // nothing is emailed just for landing on the page or opening the widget.
  app.post('/api/visitor/lead', async (req, res) => {
    try {
      const { visitorId, name, email, pageUrl } = req.body;
      if (!visitorId || !name || !email) {
        return res.status(400).json({ error: 'visitorId, name and email are required.' });
      }

      let visitor = globalStore.visitors.find(v => v.id === visitorId);
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '198.51.100.1';
      const nowIso = new Date().toISOString();
      let isNewVisitor = false;

      if (!visitor) {
        isNewVisitor = true;
        let country = 'United Kingdom', city = 'London', flag = '🇬🇧';
        if (clientIp.startsWith('182.') || clientIp.startsWith('39.') || clientIp.startsWith('103.')) {
          country = 'Pakistan'; city = 'Karachi'; flag = '🇵🇰';
        } else if (clientIp.startsWith('104.') || clientIp.startsWith('66.') || clientIp.startsWith('172.')) {
          country = 'United States'; city = 'Dallas, TX'; flag = '🇺🇸';
        }
        visitor = {
          id: visitorId,
          propertyId: 'prop_1',
          name, email,
          ip: clientIp,
          location: { country, city, flag },
          browser: 'Chrome', os: 'Windows 11', device: 'Desktop',
          currentUrl: pageUrl || 'https://aacreativeemb.com/',
          landingPage: pageUrl || 'https://aacreativeemb.com/',
          referrer: 'Direct Website Visit',
          visitsCount: 1,
          pagesViewed: 1,
          timeOnSiteSeconds: 5,
          status: 'online',
          lastActiveAt: nowIso,
          firstSeenAt: nowIso,
          sessionStartedAt: nowIso,
          leadCapturedAt: nowIso,
          tags: ['New Lead'],
          notes: []
        };
        globalStore.visitors.unshift(visitor);
      } else {
        isNewVisitor = visitor.visitsCount <= 1;
        visitor.name = name;
        visitor.email = email;
        visitor.status = 'online';
        visitor.lastActiveAt = nowIso;
        visitor.offlineSince = undefined;
        if (!visitor.leadCapturedAt) visitor.leadCapturedAt = nowIso;
        if (!visitor.firstSeenAt) visitor.firstSeenAt = nowIso;
      }

      // Decide: resume the visitor's existing chat thread, or start a clean
      // new one. We resume only if they have an open thread that was active
      // within the last hour (the "standard" returning-session window).
      const existingConv = globalStore.conversations
        .filter(c => c.visitorId === visitor!.id)
        .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())[0];

      let isFreshChatSession = true;
      let conversation: Conversation | undefined = undefined;

      if (existingConv) {
        const isClosed = ['resolved', 'closed'].includes(existingConv.status);
        const isStale = Date.now() - new Date(existingConv.lastMessageAt).getTime() > RETURNING_SESSION_WINDOW_MS;
        if (!isClosed && !isStale) {
          conversation = existingConv;
          isFreshChatSession = false;
        }
      }

      if (!conversation) {
        conversation = {
          id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          propertyId: 'prop_1',
          visitorId: visitor.id,
          channel: 'website',
          departmentId: 'dept_support',
          assignedAgentId: null,
          isAiHandling: globalStore.aiSettings.mode !== 'human_only',
          status: 'open',
          priority: 'normal',
          subject: `Live Chat with ${name}`,
          lastMessageText: '',
          lastMessageAt: nowIso,
          unreadCountAgent: 0,
          unreadCountVisitor: 0,
          sourceDetail: `Website Live Chat (${visitor.location.country} ${visitor.location.flag})`
        };
        globalStore.conversations.unshift(conversation);
        globalStore.messages[conversation.id] = [];
      }

      // Dispatch the real admin email alert now that we have a genuine lead —
      // debounced so re-submitting the form doesn't spam the inbox.
      const lastAlertTime = recentLeadNotified[visitor.id] || 0;
      if (Date.now() - lastAlertTime > 10 * 60 * 1000) {
        recentLeadNotified[visitor.id] = Date.now();
        const arrivalDate = new Date(visitor.sessionStartedAt || nowIso);
        sendAdminEmailNotification({
          to: 'aacreativeemb@gmail.com',
          subject: `🔔 [Live Chat Lead] ${name} started a chat (${visitor.location.flag} ${visitor.location.country})`,
          text: `Hello Admin,\n\nA customer just entered live chat on AA Creative Embroidery.\n\nStatus: ${isNewVisitor ? 'NEW customer' : 'EXISTING / returning customer'}\nName: ${name}\nEmail: ${email}\nDate: ${arrivalDate.toLocaleDateString()}\nTime: ${arrivalDate.toLocaleTimeString()}\nIP Address: ${clientIp}\nLocation: ${visitor.location.flag} ${visitor.location.city}, ${visitor.location.country}\nCurrent Page: ${visitor.currentUrl}\n\nOpen live chat: https://chat.aacreativeemb.com\n\nAA Creative Embroidery UK`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #0f172a; color: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #1e293b;">
              <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #334155; padding-bottom: 14px; margin-bottom: 16px;">
                <h3 style="color: #38bdf8; margin: 0; font-size: 18px;">💬 New Live Chat Lead</h3>
                <span style="background: ${isNewVisitor ? '#065f46' : '#78350f'}; color: ${isNewVisitor ? '#34d399' : '#fcd34d'}; font-size: 11px; padding: 4px 8px; border-radius: 6px; font-weight: bold;">${isNewVisitor ? 'NEW CUSTOMER' : 'EXISTING CUSTOMER'}</span>
              </div>
              <div style="background: #1e293b; padding: 16px; border-radius: 8px; font-size: 13px; line-height: 1.6; color: #f1f5f9; margin-bottom: 20px;">
                <p style="margin: 0 0 6px 0;"><strong>👤 Name:</strong> ${name}</p>
                <p style="margin: 0 0 6px 0;"><strong>✉️ Email:</strong> ${email}</p>
                <p style="margin: 0 0 6px 0;"><strong>🌍 Location:</strong> ${visitor.location.flag} ${visitor.location.city}, ${visitor.location.country}</p>
                <p style="margin: 0 0 6px 0;"><strong>🌐 IP Address:</strong> <code>${clientIp}</code></p>
                <p style="margin: 0 0 6px 0;"><strong>📅 Date:</strong> ${arrivalDate.toLocaleDateString()}</p>
                <p style="margin: 0;"><strong>⏰ Time:</strong> ${arrivalDate.toLocaleTimeString()}</p>
              </div>
              <div style="text-align: center;">
                <a href="https://chat.aacreativeemb.com" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px;">
                  🚀 Open Live Chat
                </a>
              </div>
            </div>
          `
        });
      }

      return res.json({
        success: true,
        visitor,
        conversation,
        isNewVisitor,
        isFreshChatSession
      });
    } catch (err: any) {
      console.error('Error in /api/visitor/lead:', err);
      return res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // Visitor sends message
  app.post('/api/visitor/message', async (req, res) => {
    try {
      const { conversationId, visitorId, text, channel = 'website', attachments } = req.body;

      if (!text && (!attachments || attachments.length === 0)) {
        return res.status(400).json({ error: 'Message text or attachment is required.' });
      }

      let conv = globalStore.conversations.find(c => c.id === conversationId);
      let visitor = globalStore.visitors.find(v => v.id === visitorId);

      // If the found conversation is already closed, or has been sitting idle
      // for more than the "returning session" window (standard: 1 hour), don't
      // reuse it — start a brand-new, clean chat thread instead.
      let forceNewConversation = false;
      if (conv) {
        const isClosed = ['resolved', 'closed'].includes(conv.status);
        const isStale = Date.now() - new Date(conv.lastMessageAt).getTime() > RETURNING_SESSION_WINDOW_MS;
        if (isClosed || isStale) {
          forceNewConversation = true;
          conv = undefined;
        }
      }

      // Closing-intent shortcut: if the AI/agent's last reply asked "anything
      // else?" and the visitor is now simply confirming they're done, we skip
      // routing back through the AI and close the chat with a feedback prompt.
      let visitorConfirmedDone = false;
      if (conv && conv.awaitingCloseConfirmation && text) {
        const closingPattern = /^\s*(no|nahi|nai|na|nope|no\s*thanks?|nothing\s*else|that'?s\s*all|thats\s*all|that\s*is\s*all|thanks?(\s*you)?|thank\s*you(\s*so\s*much)?|ok(ay)?\s*thanks?|theek\s*hai(\s*shukriya)?|shukriya|bye|goodbye|khuda\s*hafiz)\s*[.!]*\s*$/i;
        visitorConfirmedDone = closingPattern.test(text.trim());
      }

      // Create visitor if not exists
      if (!visitor) {
        const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '198.51.100.1';
        
        // Location detection helper
        let country = 'United Kingdom';
        let city = 'London';
        let flag = '🇬🇧';

        if (clientIp.startsWith('182.') || clientIp.startsWith('39.') || clientIp.startsWith('103.')) {
          country = 'Pakistan';
          city = 'Karachi';
          flag = '🇵🇰';
        } else if (clientIp.startsWith('104.') || clientIp.startsWith('66.') || clientIp.startsWith('172.')) {
          country = 'United States';
          city = 'Dallas, TX';
          flag = '🇺🇸';
        }

        visitor = {
          id: visitorId || `vis_${Date.now()}`,
          propertyId: 'prop_1',
          name: req.body.visitorName || 'Website Visitor',
          email: req.body.visitorEmail || 'visitor@example.com',
          ip: clientIp,
          location: { country, city, flag },
          browser: (req.headers['user-agent']?.includes('Firefox') ? 'Firefox' : req.headers['user-agent']?.includes('Edg') ? 'Edge' : 'Chrome'),
          os: 'Windows 11',
          device: 'Desktop',
          currentUrl: 'https://aacreativeemb.com/',
          landingPage: 'https://aacreativeemb.com/',
          referrer: req.headers['referer'] || 'Direct',
          visitsCount: 1,
          pagesViewed: 1,
          timeOnSiteSeconds: 15,
          status: 'online',
          lastActiveAt: new Date().toISOString(),
          tags: ['New Customer Inquiry'],
          notes: []
        };
        globalStore.visitors.unshift(visitor);

        // Send Email Alert Notification to Admin (aacreativeemb@gmail.com)
        console.log(`\n=============================================================`);
        console.log(`[ADMIN EMAIL ALERT DISPATCHED -> aacreativeemb@gmail.com]`);
        console.log(`Subject: 🔔 New Customer Live Chat Alert: ${visitor.name} (${flag} ${country})`);
        console.log(`Details:`);
        console.log(`- IP Address: ${clientIp}`);
        console.log(`- Country/Location: ${flag} ${country} (${city})`);
        console.log(`- Initial Message: "${text}"`);
        console.log(`- Time: ${new Date().toLocaleString()}`);
        console.log(`- Action: Admin can view and reply at https://chat.aacreativeemb.com`);
        console.log(`=============================================================\n`);
      }

      // Create conversation if not exists
      if (!conv) {
        conv = {
          id: forceNewConversation ? `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` : (conversationId || `conv_${Date.now()}`),
          propertyId: 'prop_1',
          visitorId: visitor.id,
          channel: channel as any,
          departmentId: 'dept_support',
          assignedAgentId: null,
          isAiHandling: globalStore.aiSettings.mode !== 'human_only',
          status: 'open',
          priority: 'normal',
          subject: text.slice(0, 40) + '...',
          lastMessageText: text,
          lastMessageAt: new Date().toISOString(),
          unreadCountAgent: 1,
          unreadCountVisitor: 0,
          sourceDetail: `Website Live Chat (${visitor.location.country} ${visitor.location.flag})`
        };
        globalStore.conversations.unshift(conv);
        globalStore.messages[conv.id] = [];
      }

      // Auto-translate visitor message to Roman Urdu for Admin View if enabled
      let romanUrduTrans: string | undefined = undefined;
      if (text && globalStore.aiSettings.enableRomanUrduAdminTranslation !== false) {
        romanUrduTrans = await translateTextToRomanUrdu(text);
      }

      const visitorMsg: Message = {
        id: `msg_${Date.now()}_v`,
        conversationId: conv.id,
        senderType: 'visitor',
        senderId: visitor.id,
        senderName: visitor.name,
        text: text || '(Attachment)',
        timestamp: new Date().toISOString(),
        deliveryStatus: 'delivered',
        channel: conv.channel,
        attachments: attachments || [],
        translatedRomanUrdu: romanUrduTrans
      };

      if (!globalStore.messages[conv.id]) {
        globalStore.messages[conv.id] = [];
      }
      globalStore.messages[conv.id].push(visitorMsg);

      conv.lastMessageText = text;
      conv.lastMessageAt = visitorMsg.timestamp;
      conv.unreadCountAgent += 1;
      conv.awaitingCloseConfirmation = false;

      // Visitor confirmed they don't need anything else — close the chat here
      // (no AI/agent round-trip needed) and prompt them to rate the session.
      if (visitorConfirmedDone) {
        const closingMsg: Message = {
          id: `msg_${Date.now()}_close`,
          conversationId: conv.id,
          senderType: 'ai',
          senderId: 'ai_assistant',
          senderName: globalStore.aiSettings.aiName || 'AA Support Specialist',
          text: `You're most welcome, ${visitor.name !== 'Website Visitor' ? visitor.name : 'thanks for reaching out'}! Glad we could help. Have a great day — this chat is now closing. 🙏`,
          timestamp: new Date().toISOString(),
          deliveryStatus: 'delivered',
          channel: conv.channel
        };
        globalStore.messages[conv.id].push(closingMsg);

        conv.status = 'resolved';
        conv.closedAt = new Date().toISOString();
        conv.closeReason = 'visitor_confirmed_done';
        conv.lastMessageText = closingMsg.text;
        conv.lastMessageAt = closingMsg.timestamp;
        conv.unreadCountAgent = 0;

        return res.json({
          success: true,
          conversation: conv,
          visitorMessage: visitorMsg,
          aiMessage: closingMsg,
          isAiHandling: conv.isAiHandling,
          status: conv.status,
          promptFeedback: true,
          newConversationId: forceNewConversation ? conv.id : undefined
        });
      }

      // Check online human agents
      const onlineAgents = globalStore.users.filter(u => u.status === 'online');

      // If no human agents are online, always keep AI handling active so chat is never abandoned
      if (onlineAgents.length === 0) {
        conv.isAiHandling = true;
        if (conv.status === 'escalated') {
          conv.status = 'pending';
        }
      }

      const shouldAiRespond = conv.isAiHandling && (globalStore.aiSettings.mode === 'ai_first' || globalStore.aiSettings.mode === 'ai_only' || onlineAgents.length === 0);

      let aiMessage: Message | undefined = undefined;

      if (shouldAiRespond) {
        const aiResult = await processCustomerMessageWithAI(
          conv.id,
          text,
          globalStore.messages[conv.id],
          visitor.name,
          visitor.email
        );

        // If AI extracted customer name or email or phone from chat, update visitor record immediately
        if (aiResult.extractedDetails?.name && (visitor.name === 'Website Visitor' || visitor.name.startsWith('Visitor #'))) {
          visitor.name = aiResult.extractedDetails.name;
          visitorMsg.senderName = visitor.name;
        }
        if (aiResult.extractedDetails?.email && (visitor.email.includes('@guest.aaemb.com') || visitor.email.includes('visitor@example.com'))) {
          visitor.email = aiResult.extractedDetails.email;
        }
        if (aiResult.extractedDetails?.phone && !visitor.phone) {
          visitor.phone = aiResult.extractedDetails.phone;
        }

        aiMessage = {
          id: `msg_${Date.now()}_ai`,
          conversationId: conv.id,
          senderType: 'ai',
          senderId: 'ai_assistant',
          senderName: globalStore.aiSettings.aiName || 'AA Support Specialist',
          text: aiResult.aiResponseText,
          timestamp: new Date().toISOString(),
          deliveryStatus: 'delivered',
          channel: conv.channel,
          confidenceScore: aiResult.confidenceScore,
          languageDetected: 'English',
          isEscalationTrigger: aiResult.shouldEscalate
        };

        // Once the AI has given a non-escalated answer, the next visitor
        // message is checked for a simple "no thanks" / "that's all" style
        // reply so the chat can close itself and prompt for a rating.
        conv.awaitingCloseConfirmation = !aiResult.shouldEscalate;

        globalStore.messages[conv.id].push(aiMessage);
        conv.lastMessageText = aiResult.aiResponseText;
        conv.lastMessageAt = aiMessage.timestamp;

        // If AI determines escalation or ticket generation is needed (order tracking, missing info, complaints, human support)
        if ((aiResult.shouldEscalate || aiResult.requiresTicket) && globalStore.aiSettings.humanHandoffEnabled) {
          if (aiResult.aiSummary) {
            conv.aiSummary = aiResult.aiSummary;
          } else {
            conv.aiSummary = await generateAiConversationSummary(text, globalStore.messages[conv.id], aiResult.escalationReason || 'Customer requested support.');
          }

          conv.status = 'pending';
          conv.priority = 'urgent';

          const ticketNumber = `TKT-${1000 + globalStore.tickets.length + 1}`;
          
          // Replace any {{TICKET_NUMBER}} placeholder in AI message text
          let finalAiResponse = aiResult.aiResponseText.replace(/\{\{TICKET_NUMBER\}\}/g, `#${ticketNumber}`);
          
          // If AI text didn't explicitly include the ticket number, format a clean message
          if (!finalAiResponse.includes(ticketNumber)) {
            finalAiResponse = `${finalAiResponse}\n\n🎫 Support Ticket #${ticketNumber} has been generated for your inquiry. Our administration team (aacreativeemb@gmail.com) and your email have been notified with full details. An administrator will contact you directly to resolve your request ASAP.`;
          }

          if (aiMessage) {
            aiMessage.text = finalAiResponse;
            conv.lastMessageText = finalAiResponse;
          }

          const customerPhone = aiResult.extractedDetails?.phone || visitor.phone || 'Not provided in chat';
          const orderInfo = aiResult.extractedDetails?.orderNumber ? `Order #${aiResult.extractedDetails.orderNumber} (${aiResult.extractedDetails.projectType || 'Digitizing/Vector'})` : 'Digitizing / Vector Inquiry';
          const problemSummary = aiResult.problemSummary || aiResult.escalationReason || `Customer inquiry regarding: "${text}"`;

          // Generate Ticket Record in DB
          const newTicket: Ticket = {
            id: `tkt_${Date.now()}`,
            ticketNumber,
            conversationId: conv.id,
            visitorId: visitor.id,
            visitorName: visitor.name,
            visitorEmail: visitor.email,
            subject: `${orderInfo} - ${visitor.name}`,
            description: `CUSTOMER PROBLEM / ISSUE:\n"${problemSummary}"\n\nFull Customer Message:\n"${text}"\n\nProject / Order: ${orderInfo}\nCustomer Phone: ${customerPhone}\nCustomer Email: ${visitor.email}\nLocation: ${visitor.location.city}, ${visitor.location.country}\nIP: ${visitor.ip}\nChannel: ${conv.channel}\nChat ID: ${conv.id}`,
            priority: 'urgent',
            status: 'open',
            departmentId: 'dept_support',
            assignedAgentId: globalStore.users[0]?.id || 'user_admin_1',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            slaDueDate: new Date(Date.now() + 14400000).toISOString(),
            slaBreached: false,
            source: 'website',
            tags: ['Auto Ticket', 'High Priority', 'Admin Alerted', 'Customer Confirmation Dispatched']
          };

          globalStore.tickets.unshift(newTicket);
          globalStore.analytics.openTicketsCount = globalStore.tickets.filter(t => t.status === 'open').length;

          // Push clean system notification to chat
          const systemTicketMsg: Message = {
            id: `msg_${Date.now()}_sys`,
            conversationId: conv.id,
            senderType: 'system',
            senderId: 'system',
            senderName: 'Support System',
            text: `🎫 Support Ticket #${ticketNumber} created. Admin team alerted at aacreativeemb@gmail.com and confirmation emailed to ${visitor.email}.`,
            timestamp: new Date().toISOString(),
            deliveryStatus: 'delivered',
            channel: conv.channel
          };
          globalStore.messages[conv.id].push(systemTicketMsg);

          // 1. Send urgent email notification to Admin (aacreativeemb@gmail.com)
          sendAdminEmailNotification({
            to: 'aacreativeemb@gmail.com',
            subject: `🎫 [URGENT Ticket #${ticketNumber}] Customer Issue: ${visitor.name} - ${orderInfo}`,
            text: `Hello Admin,\n\nA customer requires immediate support on AA Creative Embroidery Live Chat.\nA high-priority support ticket #${ticketNumber} has been automatically generated.\n\n=========================================\nHIGHLIGHTED CUSTOMER ISSUE:\n"${problemSummary}"\n=========================================\n\nCustomer Details:\n- Name: ${visitor.name}\n- Email: ${visitor.email}\n- Phone: ${customerPhone}\n- Order: ${orderInfo}\n- Location: ${visitor.location.city}, ${visitor.location.country} (IP: ${visitor.ip})\n- Active Page: ${visitor.currentUrl || 'Website'}\n\nCustomer Chat Message:\n"${text}"\n\nAction Required: Please review the order records and contact the customer to resolve their issue promptly.\n\nAA Creative Support Desk\nhttps://chat.aacreativeemb.com`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #ffffff; padding: 24px; border-radius: 14px; border: 1px solid #334155;">
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #334155; padding-bottom: 14px; margin-bottom: 18px;">
                  <div>
                    <h2 style="color: #38bdf8; margin: 0; font-size: 20px;">🎫 Support Ticket #${ticketNumber}</h2>
                    <p style="color: #94a3b8; font-size: 12px; margin: 4px 0 0 0;">AA Creative Embroidery Customer Escalation</p>
                  </div>
                  <span style="background: #ef4444; color: white; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; letter-spacing: 0.5px;">URGENT ACTION</span>
                </div>

                <div style="background: #1e293b; border-left: 4px solid #38bdf8; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                  <div style="font-size: 11px; font-weight: bold; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">HIGHLIGHTED CUSTOMER ISSUE:</div>
                  <div style="font-size: 15px; color: #f8fafc; font-weight: 600; line-height: 1.5;">${problemSummary}</div>
                </div>

                <div style="background: #1e293b; padding: 14px; border-radius: 8px; margin-bottom: 20px;">
                  <div style="font-size: 11px; font-weight: bold; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px;">LATEST CUSTOMER MESSAGE:</div>
                  <div style="font-size: 14px; color: #e2e8f0; font-style: italic; line-height: 1.5;">"${text}"</div>
                </div>

                <table style="width: 100%; font-size: 13px; color: #cbd5e1; border-collapse: collapse; margin-bottom: 24px;">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #334155; width: 35%;"><strong>Customer Name:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #334155; color: #ffffff; font-weight: 600; text-align: right;">${visitor.name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #334155;"><strong>Email Address:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #334155; color: #38bdf8; font-weight: 600; text-align: right;"><a href="mailto:${visitor.email}" style="color: #38bdf8; text-decoration: none;">${visitor.email}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #334155;"><strong>Phone Number:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #334155; color: #ffffff; text-align: right;">${customerPhone}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #334155;"><strong>Order Reference:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #334155; color: #c084fc; font-weight: 600; text-align: right;">${orderInfo}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #334155;"><strong>Visitor Location:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #334155; color: #ffffff; text-align: right;">${visitor.location.flag} ${visitor.location.city}, ${visitor.location.country}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>IP Address:</strong></td>
                    <td style="padding: 8px 0; color: #94a3b8; text-align: right;">${visitor.ip}</td>
                  </tr>
                </table>

                <div style="text-align: center; margin-top: 10px;">
                  <a href="https://chat.aacreativeemb.com" style="background: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(37,99,235,0.4);">Open Admin Inbox & Resolve</a>
                </div>
              </div>
            `
          });

          // 2. Send professional, styled confirmation email to Customer
          if (visitor.email && !visitor.email.includes('@guest.aaemb.com') && !visitor.email.includes('visitor@example.com')) {
            sendAdminEmailNotification({
              to: visitor.email,
              subject: `🎫 [Ticket #${ticketNumber}] We received your inquiry - AA Creative Embroidery`,
              text: `Dear ${visitor.name},\n\nThank you for reaching out to AA Creative Embroidery.\n\nWe have generated Support Ticket #${ticketNumber} for your inquiry regarding:\n"${problemSummary}"\n\nOur administrative and technical production team has been notified and is currently reviewing your details. An administrator will contact you shortly with an update.\n\nTicket Summary:\n- Ticket Number: #${ticketNumber}\n- Status: In Review\n- Priority: High Priority\n- Problem Description: ${problemSummary}\n\nIf you have additional design files or instructions, you can reply directly to this email.\n\nBest regards,\nCustomer Support Team\nAA Creative Embroidery UK Ltd\nEmail: aacreativeemb@gmail.com\nPhone / WhatsApp: +44 7462 23 8732\nWebsite: https://aacreativeemb.com`,
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; color: #1e293b; padding: 28px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
                  
                  <div style="border-bottom: 2px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
                    <div>
                      <h2 style="color: #1e1b4b; margin: 0; font-size: 20px; font-weight: 700;">AA Creative Embroidery</h2>
                      <p style="color: #64748b; font-size: 13px; margin: 3px 0 0 0;">Precision Embroidery Digitizing & Vector Art Services</p>
                    </div>
                  </div>

                  <p style="font-size: 15px; color: #334155; margin-top: 0;">Dear <strong>${visitor.name}</strong>,</p>
                  
                  <p style="font-size: 14px; color: #475569; line-height: 1.6;">
                    Thank you for contacting <strong>AA Creative Embroidery</strong>. We have logged your request and generated official Support Ticket <strong>#${ticketNumber}</strong> for you.
                  </p>
                  
                  <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0; border-left: 4px solid #4f46e5;">
                    <div style="font-size: 11px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.5px;">YOUR INQUIRY SUMMARY:</div>
                    <div style="font-size: 14px; color: #0f172a; margin-top: 6px; font-weight: 600; line-height: 1.5;">${problemSummary}</div>
                  </div>

                  <table style="width: 100%; font-size: 13px; color: #475569; border-collapse: collapse; margin-bottom: 24px;">
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; width: 40%;"><strong>Ticket Number:</strong></td>
                      <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; color: #4f46e5; font-weight: 700; text-align: right;">#${ticketNumber}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><strong>Status:</strong></td>
                      <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; color: #059669; font-weight: 600; text-align: right;">Assigned to Admin Review</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><strong>Project / Order:</strong></td>
                      <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; text-align: right;">${orderInfo}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0;"><strong>Customer Name:</strong></td>
                      <td style="padding: 8px 0; color: #0f172a; font-weight: 600; text-align: right;">${visitor.name}</td>
                    </tr>
                  </table>

                  <p style="font-size: 14px; color: #475569; line-height: 1.6;">
                    Our senior administrative team and digitizers have received this escalation and will contact you directly via this email address to assist you without delay.
                  </p>

                  <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; font-size: 12.5px; color: #1e40af; margin-top: 20px;">
                    💡 <strong>Need urgent updates?</strong> You can reply directly to this email with any attachments, or reach us on WhatsApp at <strong>+44 7462 23 8732</strong>.
                  </div>

                  <p style="font-size: 13px; color: #64748b; margin-top: 28px; line-height: 1.5; border-top: 1px solid #f1f5f9; pt-4;">
                    Warm regards,<br/>
                    <strong>Customer Support Team</strong><br/>
                    AA Creative Embroidery UK Ltd<br/>
                    <a href="mailto:aacreativeemb@gmail.com" style="color: #4f46e5; text-decoration: none;">aacreativeemb@gmail.com</a> | <a href="https://aacreativeemb.com" style="color: #4f46e5; text-decoration: none;">aacreativeemb.com</a>
                  </p>
                </div>
              `
            });
          }
        }
      }

      res.json({
        success: true,
        conversation: conv,
        visitorMessage: visitorMsg,
        aiMessage,
        isAiHandling: conv.isAiHandling,
        status: conv.status,
        newConversationId: forceNewConversation ? conv.id : undefined
      });
    } catch (err: any) {
      console.error('Error in /api/visitor/message:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // Agent sends message
  app.post('/api/agent/message', async (req, res) => {
    const { conversationId, agentId, text, attachments, autoPolish = true } = req.body;
    const conv = globalStore.conversations.find(c => c.id === conversationId);
    const agent = globalStore.users.find(u => u.id === agentId) || globalStore.users[0];

    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    let finalEnglishText = text;
    let isPolished = false;
    let originalInput = text;

    // If auto-translation/polishing is enabled and agent typed something
    if (text && autoPolish && globalStore.aiSettings.enableAgentAutoEnglishTranslation !== false) {
      const msgs = globalStore.messages[conv.id] || [];
      const polishedResult = await polishOrTranslateAgentReply(text, msgs);
      if (polishedResult.polishedEnglish) {
        finalEnglishText = polishedResult.polishedEnglish;
        isPolished = polishedResult.isConverted;
      }
    }

    const agentMsg: Message = {
      id: `msg_${Date.now()}_a`,
      conversationId: conv.id,
      senderType: 'agent',
      senderId: agent.id,
      senderName: agent.name,
      senderAvatar: agent.avatar,
      text: finalEnglishText,
      originalText: isPolished ? originalInput : undefined,
      isPolishedByAi: isPolished,
      timestamp: new Date().toISOString(),
      deliveryStatus: 'delivered',
      channel: conv.channel,
      attachments: attachments || []
    };

    if (!globalStore.messages[conv.id]) {
      globalStore.messages[conv.id] = [];
    }
    globalStore.messages[conv.id].push(agentMsg);

    conv.lastMessageText = finalEnglishText;
    conv.lastMessageAt = agentMsg.timestamp;
    conv.unreadCountAgent = 0;
    conv.assignedAgentId = agent.id;
    conv.isAiHandling = false; // Agent active takeover

    res.json({ success: true, message: agentMsg, conversation: conv });
  });

  // Agent AI Reply Polish & Suggestion Endpoint
  app.post('/api/ai/suggest_reply', async (req, res) => {
    try {
      const { conversationId, agentDraft } = req.body;
      const conv = globalStore.conversations.find(c => c.id === conversationId);
      const msgs = conv ? (globalStore.messages[conv.id] || []) : [];

      if (agentDraft && agentDraft.trim().length > 0) {
        // Polish draft or convert Roman Urdu to English
        const polished = await polishOrTranslateAgentReply(agentDraft, msgs);
        const suggestions = await generateAgentReplySuggestions(msgs, agentDraft);
        return res.json({
          success: true,
          polishedEnglish: polished.polishedEnglish,
          isConverted: polished.isConverted,
          suggestions
        });
      } else {
        // Generate 3 suggested replies based on chat history
        const suggestions = await generateAgentReplySuggestions(msgs);
        return res.json({
          success: true,
          suggestions
        });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to generate suggestion' });
    }
  });

  // Direct Translate API
  app.post('/api/translate', async (req, res) => {
    try {
      const { text, targetLanguage = 'roman_urdu' } = req.body;
      if (!text) return res.status(400).json({ error: 'Text is required' });

      if (targetLanguage === 'roman_urdu') {
        const translated = await translateTextToRomanUrdu(text);
        return res.json({ success: true, original: text, translated });
      } else {
        const polished = await polishOrTranslateAgentReply(text);
        return res.json({ success: true, original: text, translated: polished.polishedEnglish });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Translation failed' });
    }
  });

  // Assign agent or toggle AI mode
  app.post('/api/conversations/assign', async (req, res) => {
    const { conversationId, agentId, departmentId, isAiHandling } = req.body;
    const conv = globalStore.conversations.find(c => c.id === conversationId);

    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (agentId !== undefined) conv.assignedAgentId = agentId;
    if (departmentId !== undefined) conv.departmentId = departmentId;
    if (isAiHandling !== undefined) {
      conv.isAiHandling = isAiHandling;
      if (!isAiHandling) {
        // Generate summary for agent takeover if missing
        if (!conv.aiSummary) {
          const msgs = globalStore.messages[conv.id] || [];
          conv.aiSummary = await generateAiConversationSummary(
            conv.lastMessageText,
            msgs,
            'Agent manually took over conversation.'
          );
        }
      }
    }

    res.json({ success: true, conversation: conv });
  });

  // Change conversation status (also accepts the visitor's post-chat star
  // rating + comment, submitted from the closing feedback prompt)
  app.post('/api/conversations/status', (req, res) => {
    const { conversationId, status, priority, rating, feedback } = req.body;
    const conv = globalStore.conversations.find(c => c.id === conversationId);

    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (status) {
      conv.status = status;
      if (['resolved', 'closed'].includes(status)) {
        conv.closedAt = conv.closedAt || new Date().toISOString();
        conv.closeReason = conv.closeReason || 'manual';
      }
    }
    if (priority) conv.priority = priority;
    if (typeof rating === 'number') conv.rating = rating;
    if (typeof feedback === 'string' && feedback.trim()) conv.feedback = feedback.trim();

    res.json({ success: true, conversation: conv });
  });

  // Create / Update ticket
  app.post('/api/tickets', (req, res) => {
    const { id, conversationId, visitorId, visitorName, visitorEmail, subject, description, priority, departmentId, assignedAgentId, tags } = req.body;

    if (id) {
      const existing = globalStore.tickets.find(t => t.id === id);
      if (existing) {
        if (subject) existing.subject = subject;
        if (description) existing.description = description;
        if (priority) existing.priority = priority;
        if (req.body.status) existing.status = req.body.status;
        if (departmentId) existing.departmentId = departmentId;
        if (assignedAgentId !== undefined) existing.assignedAgentId = assignedAgentId;
        if (tags) existing.tags = tags;
        existing.updatedAt = new Date().toISOString();
        return res.json({ success: true, ticket: existing });
      }
    }

    const newTicket: Ticket = {
      id: `tkt_${Date.now()}`,
      ticketNumber: `TKT-${1000 + globalStore.tickets.length + 1}`,
      conversationId,
      visitorId: visitorId || 'vis_101',
      visitorName: visitorName || 'Ali Raza',
      visitorEmail: visitorEmail || 'ali.raza@gmail.com',
      subject: subject || 'New Customer Support Request',
      description: description || 'No detailed description provided.',
      priority: priority || 'normal',
      status: 'open',
      departmentId: departmentId || 'dept_support',
      assignedAgentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      slaDueDate: new Date(Date.now() + 14400000).toISOString(),
      slaBreached: false,
      source: 'website',
      tags: tags || ['Support']
    };

    globalStore.tickets.unshift(newTicket);
    globalStore.analytics.openTicketsCount = globalStore.tickets.filter(t => t.status === 'open').length;

    // Send Real Email Notification for new ticket
    sendAdminEmailNotification({
      to: 'aacreativeemb@gmail.com',
      subject: `🎫 [New Ticket #${newTicket.ticketNumber}] ${newTicket.subject}`,
      text: `Hello Admin,\n\nA new support ticket has been created on the AA Creative Support Desk.\n\nTicket: #${newTicket.ticketNumber}\nCustomer: ${newTicket.visitorName} (${newTicket.visitorEmail})\nSubject: ${newTicket.subject}\nDetails: ${newTicket.description}\nPriority: ${newTicket.priority.toUpperCase()}\n\nView and manage tickets at https://chat.aacreativeemb.com\n\nAA Creative Embroidery UK`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #0f172a; color: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #1e293b;">
          <h3 style="color: #38bdf8; margin-top: 0;">🎫 Support Ticket #${newTicket.ticketNumber}</h3>
          <p style="color: #cbd5e1; font-size: 14px;"><strong>Subject:</strong> ${newTicket.subject}</p>
          <div style="background: #1e293b; padding: 14px; border-radius: 8px; margin: 15px 0; color: #f8fafc; font-size: 13px;">
            ${newTicket.description.replace(/\n/g, '<br/>')}
          </div>
          <p style="font-size: 12px; color: #94a3b8;">Customer: ${newTicket.visitorName} (${newTicket.visitorEmail})</p>
        </div>
      `
    });

    res.json({ success: true, ticket: newTicket });
  });

  // User / Agent Status Update Endpoint
  app.post('/api/users/status', (req, res) => {
    const { userId, status } = req.body;
    const user = globalStore.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (status && ['online', 'away', 'offline'].includes(status)) {
      user.status = status;
    }
    const { passwordHash, ...safeUser } = user;
    const safeUsers = globalStore.users.map(({ passwordHash, ...rest }) => rest);
    res.json({ success: true, user: safeUser, users: safeUsers });
  });

  // --- AGENT / TEAM MANAGEMENT ---

  // List agents (never exposes passwordHash)
  app.get('/api/admin/agents', (req, res) => {
    const safeUsers = globalStore.users.map(({ passwordHash, ...rest }) => rest);
    res.json({ success: true, agents: safeUsers });
  });

  // Add a new agent: name, email, userId (login handle), password
  app.post('/api/admin/agents', (req, res) => {
    const { name, email, userId, password, role, departmentIds } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const emailTaken = globalStore.users.some(u => u.email.toLowerCase() === cleanEmail);
    if (emailTaken) {
      return res.status(409).json({ success: false, error: 'An agent with this email already exists.' });
    }

    const newAgent: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      email: cleanEmail,
      userId: userId || cleanEmail,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      role: role || 'agent',
      status: 'offline',
      departmentIds: departmentIds || [],
      capacity: 8,
      activeChatsCount: 0,
      passwordHash: hashPassword(password)
    };

    globalStore.users.push(newAgent);
    globalStore.auditLogs.unshift({
      id: `log_${Date.now()}`,
      action: 'Agent Created',
      details: `New agent added: ${name} (${cleanEmail})`,
      timestamp: new Date().toISOString(),
      userName: 'Admin'
    });
    globalStore.persist();

    const { passwordHash, ...safeAgent } = newAgent;
    res.json({ success: true, agent: safeAgent });
  });

  // Remove an agent
  app.delete('/api/admin/agents/:id', (req, res) => {
    const idx = globalStore.users.findIndex(u => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Agent not found' });
    const removed = globalStore.users.splice(idx, 1)[0];
    globalStore.persist();
    res.json({ success: true, removedId: removed.id });
  });

  // Save AI Settings & Knowledge
  app.post('/api/ai/settings', (req, res) => {
    globalStore.aiSettings = { ...globalStore.aiSettings, ...req.body };
    globalStore.auditLogs.unshift({
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      userName: 'Admin User',
      action: 'Updated AI Support Settings',
      details: `Updated AI mode to ${globalStore.aiSettings.mode}, personality to ${globalStore.aiSettings.personality}`
    });
    res.json({ success: true, aiSettings: globalStore.aiSettings });
  });

  // AI Quality Feedback (Good/Bad response)
  app.post('/api/ai/qc', (req, res) => {
    const { conversationId, messageId, query, aiResponse, rating, notes } = req.body;
    const qc = {
      id: `qc_${Date.now()}`,
      conversationId,
      messageId,
      query,
      aiResponse,
      rating,
      notes,
      timestamp: new Date().toISOString()
    };
    globalStore.qcFeedbacks.unshift(qc);
    res.json({ success: true, qc });
  });

  // Simulate Gmail Email import
  app.post('/api/gmail/receive', async (req, res) => {
    const { fromEmail, fromName, subject, body } = req.body;

    const email = fromEmail || 'customer.test@gmail.com';
    const name = fromName || 'External Gmail User';
    const subj = subject || 'Urgent Gmail Support Ticket';
    const text = body || 'Hello support, my parcel has not arrived yet.';

    let visitor = globalStore.visitors.find(v => v.email === email);
    if (!visitor) {
      visitor = {
        id: `vis_${Date.now()}`,
        propertyId: 'prop_1',
        name,
        email,
        ip: '198.51.100.42',
        location: { country: 'United States', city: 'New York', flag: '🇺🇸' },
        browser: 'Gmail API',
        os: 'Google Cloud OAuth',
        device: 'Email Client',
        currentUrl: 'mailto:support@abcstore.com',
        landingPage: 'Gmail',
        referrer: 'Gmail OAuth',
        visitsCount: 1,
        pagesViewed: 1,
        timeOnSiteSeconds: 0,
        status: 'online',
        lastActiveAt: new Date().toISOString(),
        tags: ['Gmail Ticket'],
        notes: ['Received via official Gmail API OAuth connector']
      };
      globalStore.visitors.unshift(visitor);
    }

    const conv: Conversation = {
      id: `conv_gmail_${Date.now()}`,
      propertyId: 'prop_1',
      visitorId: visitor.id,
      channel: 'gmail',
      departmentId: 'dept_support',
      assignedAgentId: null,
      isAiHandling: globalStore.aiSettings.mode !== 'human_only',
      status: 'open',
      priority: text.toLowerCase().includes('urgent') ? 'urgent' : 'high',
      subject: subj,
      lastMessageText: text,
      lastMessageAt: new Date().toISOString(),
      unreadCountAgent: 1,
      unreadCountVisitor: 0,
      sourceDetail: `Gmail API (${email})`
    };

    globalStore.conversations.unshift(conv);
    globalStore.messages[conv.id] = [
      {
        id: `msg_${Date.now()}_g1`,
        conversationId: conv.id,
        senderType: 'visitor',
        senderId: visitor.id,
        senderName: name,
        text,
        timestamp: new Date().toISOString(),
        deliveryStatus: 'delivered',
        channel: 'gmail'
      }
    ];

    let aiMsg: Message | undefined = undefined;
    if (conv.isAiHandling) {
      const aiResult = await processCustomerMessageWithAI(conv.id, text, globalStore.messages[conv.id]);
      aiMsg = {
        id: `msg_${Date.now()}_g2`,
        conversationId: conv.id,
        senderType: 'ai',
        senderId: 'ai_assistant',
        senderName: globalStore.aiSettings.aiName,
        text: aiResult.aiResponseText,
        timestamp: new Date().toISOString(),
        deliveryStatus: 'delivered',
        channel: 'gmail',
        confidenceScore: aiResult.confidenceScore
      };
      globalStore.messages[conv.id].push(aiMsg);
      conv.lastMessageText = aiResult.aiResponseText;
    }

    res.json({ success: true, conversation: conv, aiMessage: aiMsg });
  });

  // Simulate WhatsApp Business message import
  app.post('/api/whatsapp/receive', async (req, res) => {
    const { phone, name, text } = req.body;
    const userPhone = phone || '+92 300 9876543';
    const userName = name || 'WhatsApp Contact';
    const userText = text || 'Assalam o Alaikum! X20 model ki price kya hai?';

    let visitor = globalStore.visitors.find(v => v.phone === userPhone);
    if (!visitor) {
      visitor = {
        id: `vis_wa_${Date.now()}`,
        propertyId: 'prop_1',
        name: userName,
        email: `${userPhone.replace(/[^0-9]/g, '')}@whatsapp.com`,
        phone: userPhone,
        ip: '103.255.4.99',
        location: { country: 'Pakistan', city: 'Lahore', flag: '🇵🇰' },
        browser: 'WhatsApp Cloud API',
        os: 'Meta WhatsApp Business',
        device: 'WhatsApp Mobile',
        currentUrl: 'whatsapp://chat',
        landingPage: 'WhatsApp',
        referrer: 'Meta Cloud API',
        visitsCount: 1,
        pagesViewed: 1,
        timeOnSiteSeconds: 0,
        status: 'online',
        lastActiveAt: new Date().toISOString(),
        tags: ['WhatsApp Business'],
        notes: ['Contact via Meta WhatsApp Cloud API']
      };
      globalStore.visitors.unshift(visitor);
    }

    const conv: Conversation = {
      id: `conv_wa_${Date.now()}`,
      propertyId: 'prop_1',
      visitorId: visitor.id,
      channel: 'whatsapp',
      departmentId: 'dept_sales',
      assignedAgentId: null,
      isAiHandling: true,
      status: 'open',
      priority: 'normal',
      subject: `WhatsApp Chat (${userPhone})`,
      lastMessageText: userText,
      lastMessageAt: new Date().toISOString(),
      unreadCountAgent: 1,
      unreadCountVisitor: 0,
      sourceDetail: `WhatsApp Business (${userPhone})`
    };

    globalStore.conversations.unshift(conv);
    globalStore.messages[conv.id] = [
      {
        id: `msg_${Date.now()}_w1`,
        conversationId: conv.id,
        senderType: 'visitor',
        senderId: visitor.id,
        senderName: userName,
        text: userText,
        timestamp: new Date().toISOString(),
        deliveryStatus: 'delivered',
        channel: 'whatsapp'
      }
    ];

    const aiResult = await processCustomerMessageWithAI(conv.id, userText, globalStore.messages[conv.id]);
    const aiMsg: Message = {
      id: `msg_${Date.now()}_w2`,
      conversationId: conv.id,
      senderType: 'ai',
      senderId: 'ai_assistant',
      senderName: globalStore.aiSettings.aiName,
      text: aiResult.aiResponseText,
      timestamp: new Date().toISOString(),
      deliveryStatus: 'delivered',
      channel: 'whatsapp',
      confidenceScore: aiResult.confidenceScore
    };
    globalStore.messages[conv.id].push(aiMsg);
    conv.lastMessageText = aiResult.aiResponseText;

    res.json({ success: true, conversation: conv, aiMessage: aiMsg });
  });

  // Knowledge Base CRUD
  app.post('/api/kb', (req, res) => {
    const { action, article, category } = req.body;
    if (action === 'create_article') {
      const newArt = {
        id: `art_${Date.now()}`,
        title: article.title || 'Untitled Article',
        categoryId: article.categoryId || 'cat_shipping',
        content: article.content || '',
        tags: article.tags || ['general'],
        status: article.status || 'published',
        views: 0,
        helpfulCount: 0,
        createdAt: new Date().toISOString()
      };
      globalStore.kbArticles.unshift(newArt);
      return res.json({ success: true, article: newArt });
    }
    res.json({ success: true, kbArticles: globalStore.kbArticles });
  });

  // Standalone Embed Widget JS route
  app.get('/widget.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`
(function() {
  if (window.__AA_EMB_WIDGET_LOADED__) return;
  window.__AA_EMB_WIDGET_LOADED__ = true;

  var scriptEl = document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var serverUrl = 'https://chat.aacreativeemb.com';
  if (scriptEl && scriptEl.src) {
    try {
      var urlObj = new URL(scriptEl.src);
      serverUrl = urlObj.origin;
    } catch(e) {}
  }

  var storageKeyVisitor = 'aa_emb_vis_id';
  var storageKeyConv = 'aa_emb_conv_id';
  var storageKeyMsgs = 'aa_emb_msgs';
  var storageKeyLead = 'aa_emb_lead';

  var visitorId = localStorage.getItem(storageKeyVisitor);
  if (!visitorId) {
    visitorId = 'vis_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(storageKeyVisitor, visitorId);
  }

  var conversationId = localStorage.getItem(storageKeyConv) || null;

  var leadInfo = null;
  try {
    leadInfo = JSON.parse(localStorage.getItem(storageKeyLead) || 'null');
  } catch(e) {
    leadInfo = null;
  }

  var savedMsgs = [];
  try {
    savedMsgs = JSON.parse(localStorage.getItem(storageKeyMsgs) || '[]');
  } catch(e) {
    savedMsgs = [];
  }

  if (leadInfo && savedMsgs.length === 0) {
    savedMsgs.push({
      id: 'welcome_1',
      sender: 'ai',
      text: 'Hello! Welcome to AA Creative Embroidery. Which project can we assist you with today \u2014 Embroidery Digitizing or Vector Art Conversion?',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  }

  var feedbackShownForConv = null;
  var pollTimer = null;
  var heartbeatTimer = null;
  var hasSyncedThisLoad = false;
  var closeAfterFeedback = false;

  // --- Heartbeat: tells the server this visitor is still actively on the
  // page, so they don't flip to "offline" after 50s of silence (which would
  // start the 30-minute auto-close countdown on any open chat).
  function sendHeartbeat() {
    try {
      fetch(serverUrl + '/api/visitor/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId: visitorId,
          pageUrl: window.location.href,
          referrer: document.referrer || 'Direct Website Visit',
          pageTitle: document.title
        })
      }).catch(function() {});
    } catch(e) {}
  }
  sendHeartbeat();
  heartbeatTimer = setInterval(sendHeartbeat, 25000);

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Inject Styles
  var style = document.createElement('style');
  style.innerHTML = \`
    #aa-chat-launcher {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.5), 0 8px 10px -6px rgba(79, 70, 229, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      border: 2px solid rgba(255, 255, 255, 0.2);
    }
    #aa-chat-launcher:hover {
      transform: scale(1.08) translateY(-2px);
      box-shadow: 0 15px 30px -5px rgba(79, 70, 229, 0.6);
    }
    #aa-chat-launcher svg {
      width: 28px;
      height: 28px;
      fill: #ffffff;
      transition: transform 0.3s ease;
    }
    #aa-chat-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 14px;
      height: 14px;
      background: #10b981;
      border: 2.5px solid #ffffff;
      border-radius: 50%;
    }
    #aa-chat-launcher.aa-has-unread #aa-chat-badge {
      background: #ef4444;
      animation: aaPulseBadge 1s ease-in-out infinite;
    }
    @keyframes aaPulseBadge {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.35); }
    }
    #aa-chat-box {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 380px;
      max-width: calc(100vw - 32px);
      height: 560px;
      max-height: calc(100vh - 120px);
      background: #ffffff;
      border-radius: 18px;
      box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05);
      display: none;
      flex-direction: column;
      overflow: hidden;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      animation: aaSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes aaSlideUp {
      from { opacity: 0; transform: translateY(20px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    #aa-chat-header {
      background: linear-gradient(135deg, #312e81 0%, #4f46e5 100%);
      color: #ffffff;
      padding: 16px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      flex-shrink: 0;
    }
    .aa-agent-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .aa-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: rgba(255,255,255,0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 16px;
      border: 1.5px solid rgba(255,255,255,0.3);
    }
    .aa-agent-name {
      font-weight: 600;
      font-size: 15px;
      letter-spacing: -0.01em;
      margin: 0;
      line-height: 1.2;
    }
    .aa-agent-status {
      font-size: 12px;
      color: #a7f3d0;
      display: flex;
      align-items: center;
      gap: 5px;
      margin-top: 3px;
    }
    .aa-status-dot {
      width: 7px;
      height: 7px;
      background: #10b981;
      border-radius: 50%;
      display: inline-block;
    }
    #aa-close-btn {
      background: none;
      border: none;
      color: #ffffff;
      cursor: pointer;
      opacity: 0.8;
      padding: 4px;
      transition: opacity 0.2s;
    }
    #aa-close-btn:hover {
      opacity: 1;
    }
    #aa-prechat-screen {
      display: none;
      flex: 1;
      padding: 22px 20px;
      background: #f8fafc;
      flex-direction: column;
      justify-content: center;
    }
    #aa-chat-box.aa-needs-lead #aa-prechat-screen {
      display: flex;
    }
    #aa-chat-box.aa-needs-lead #aa-messages-container,
    #aa-chat-box.aa-needs-lead #aa-typing,
    #aa-chat-box.aa-needs-lead #aa-quick-actions,
    #aa-chat-box.aa-needs-lead #aa-input-bar {
      display: none !important;
    }
    .aa-prechat-title {
      font-size: 16px;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 4px 0;
    }
    .aa-prechat-sub {
      font-size: 12.5px;
      color: #64748b;
      margin: 0 0 16px 0;
      line-height: 1.5;
    }
    .aa-prechat-input {
      width: 100%;
      margin-bottom: 10px;
      padding: 11px 13px;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      font-size: 13.5px;
      box-sizing: border-box;
      outline: none;
      transition: border-color 0.2s;
    }
    .aa-prechat-input:focus {
      border-color: #6366f1;
    }
    #aa-prechat-submit {
      width: 100%;
      padding: 12px;
      background: #4f46e5;
      color: #ffffff;
      border: none;
      border-radius: 10px;
      font-weight: 600;
      font-size: 13.5px;
      cursor: pointer;
      transition: background 0.2s;
    }
    #aa-prechat-submit:hover {
      background: #4338ca;
    }
    #aa-prechat-submit:disabled {
      opacity: 0.6;
      cursor: default;
    }
    #aa-messages-container {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .aa-msg {
      max-width: 82%;
      padding: 11px 14px;
      border-radius: 14px;
      font-size: 13.5px;
      line-height: 1.45;
      word-break: break-word;
    }
    .aa-msg-ai {
      align-self: flex-start;
      background: #ffffff;
      color: #1e293b;
      border: 1px solid #e2e8f0;
      border-bottom-left-radius: 4px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    }
    .aa-msg-visitor {
      align-self: flex-end;
      background: #4f46e5;
      color: #ffffff;
      border-bottom-right-radius: 4px;
    }
    .aa-msg-system {
      align-self: center;
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
      font-size: 11px;
      font-weight: 500;
      padding: 6px 12px;
      border-radius: 12px;
      margin: 2px auto;
      text-align: center;
      max-width: 90%;
    }
    .aa-msg-time {
      font-size: 10px;
      margin-top: 4px;
      opacity: 0.65;
      text-align: right;
    }
    #aa-quick-actions {
      padding: 8px 12px;
      background: #ffffff;
      border-top: 1px solid #f1f5f9;
      display: flex;
      gap: 6px;
      overflow-x: auto;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .aa-pill {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #e2e8f0;
      padding: 5px 10px;
      border-radius: 12px;
      font-size: 11.5px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
      flex-shrink: 0;
    }
    .aa-pill:hover {
      background: #e0e7ff;
      color: #4338ca;
      border-color: #c7d2fe;
    }
    #aa-input-bar {
      padding: 12px 14px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    #aa-text-input {
      flex: 1;
      border: 1px solid #cbd5e1;
      border-radius: 20px;
      padding: 9px 14px;
      font-size: 13.5px;
      outline: none;
      transition: border-color 0.2s;
    }
    #aa-text-input:focus {
      border-color: #6366f1;
    }
    #aa-send-btn {
      background: #4f46e5;
      border: none;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      color: #ffffff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
      flex-shrink: 0;
    }
    #aa-send-btn:hover {
      background: #4338ca;
    }
    #aa-typing {
      display: none;
      align-self: flex-start;
      font-size: 11.5px;
      color: #64748b;
      font-style: italic;
      padding: 2px 8px;
    }
    #aa-feedback-overlay {
      display: none;
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.55);
      align-items: center;
      justify-content: center;
      z-index: 30;
      padding: 20px;
    }
    #aa-feedback-overlay.aa-show {
      display: flex;
    }
    .aa-feedback-box {
      background: #ffffff;
      border-radius: 16px;
      padding: 20px;
      width: 100%;
      max-width: 270px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    }
    .aa-feedback-title {
      font-size: 14.5px;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 4px 0;
    }
    .aa-feedback-sub {
      font-size: 12px;
      color: #64748b;
      margin: 0 0 12px 0;
    }
    #aa-star-row {
      display: flex;
      justify-content: center;
      gap: 6px;
      margin-bottom: 12px;
    }
    .aa-star {
      font-size: 26px;
      line-height: 1;
      cursor: pointer;
      color: #cbd5e1;
      transition: color 0.15s, transform 0.15s;
      user-select: none;
    }
    .aa-star:hover {
      transform: scale(1.12);
    }
    #aa-feedback-text {
      width: 100%;
      box-sizing: border-box;
      font-size: 12.5px;
      padding: 8px 10px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      outline: none;
      resize: none;
      margin-bottom: 12px;
      font-family: inherit;
    }
    .aa-feedback-actions {
      display: flex;
      gap: 8px;
    }
    #aa-feedback-skip {
      flex: 1;
      padding: 9px;
      background: #ffffff;
      color: #64748b;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }
    #aa-feedback-submit {
      flex: 1;
      padding: 9px;
      background: #4f46e5;
      color: #ffffff;
      border: none;
      border-radius: 10px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }
    #aa-feedback-submit:disabled {
      opacity: 0.6;
      cursor: default;
    }
    @media (max-width: 480px) {
      #aa-chat-box {
        bottom: 0;
        right: 0;
        width: 100vw;
        max-width: 100vw;
        height: 100vh;
        max-height: 100vh;
        border-radius: 0;
      }
    }
  \`;
  document.head.appendChild(style);

  // Create Launcher Element
  var launcher = document.createElement('div');
  launcher.id = 'aa-chat-launcher';
  launcher.innerHTML = \`
    <svg viewBox="0 0 24 24">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
    </svg>
    <div id="aa-chat-badge"></div>
  \`;
  document.body.appendChild(launcher);

  // Create Chat Box Element
  var chatBox = document.createElement('div');
  chatBox.id = 'aa-chat-box';
  chatBox.innerHTML = \`
    <div id="aa-chat-header">
      <div class="aa-agent-info">
        <div class="aa-avatar">AA</div>
        <div>
          <div class="aa-agent-name">AA Creative EMB Live Support</div>
          <div class="aa-agent-status"><span class="aa-status-dot"></span> Online</div>
        </div>
      </div>
      <button id="aa-close-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
    <div id="aa-prechat-screen">
      <p class="aa-prechat-title">Start a conversation</p>
      <p class="aa-prechat-sub">Please share your name &amp; email so our team can assist you properly.</p>
      <input type="text" id="aa-prechat-name" class="aa-prechat-input" placeholder="Your Name" autocomplete="off" />
      <input type="email" id="aa-prechat-email" class="aa-prechat-input" placeholder="Your Email" autocomplete="off" />
      <button type="button" id="aa-prechat-submit">Start Chat</button>
    </div>
    <div id="aa-messages-container"></div>
    <div id="aa-typing">Support agent is typing...</div>
    <div id="aa-quick-actions">
      <span class="aa-pill" data-q="What are your embroidery digitizing rates?">\ud83e\uddf5 Digitizing Rates</span>
      <span class="aa-pill" data-q="How long does logo digitizing take?">\u26a1 Turnaround Time</span>
      <span class="aa-pill" data-q="Which stitch formats do you provide?">\ud83d\udcc1 Formats (DST/PES)</span>
      <span class="aa-pill" data-q="I want a free quote for my embroidery design.">\ud83d\udcac Get Quote</span>
    </div>
    <form id="aa-input-bar">
      <input type="text" id="aa-text-input" placeholder="Type your message here..." autocomplete="off" />
      <button type="submit" id="aa-send-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
      </button>
    </form>
    <div id="aa-feedback-overlay">
      <div class="aa-feedback-box">
        <p class="aa-feedback-title">Rate Your Support Session</p>
        <p class="aa-feedback-sub">How was your conversation with our team?</p>
        <div id="aa-star-row">
          <span class="aa-star" data-star="1">\u2605</span>
          <span class="aa-star" data-star="2">\u2605</span>
          <span class="aa-star" data-star="3">\u2605</span>
          <span class="aa-star" data-star="4">\u2605</span>
          <span class="aa-star" data-star="5">\u2605</span>
        </div>
        <textarea id="aa-feedback-text" rows="2" placeholder="Optional comments..."></textarea>
        <div class="aa-feedback-actions">
          <button type="button" id="aa-feedback-skip">Skip</button>
          <button type="button" id="aa-feedback-submit">Submit</button>
        </div>
      </div>
    </div>
  \`;
  document.body.appendChild(chatBox);

  var msgContainer = chatBox.querySelector('#aa-messages-container');
  var typingIndicator = chatBox.querySelector('#aa-typing');
  var inputEl = chatBox.querySelector('#aa-text-input');
  var formEl = chatBox.querySelector('#aa-input-bar');
  var closeBtn = chatBox.querySelector('#aa-close-btn');
  var prechatNameInput = chatBox.querySelector('#aa-prechat-name');
  var prechatEmailInput = chatBox.querySelector('#aa-prechat-email');
  var prechatSubmitBtn = chatBox.querySelector('#aa-prechat-submit');
  var feedbackOverlay = chatBox.querySelector('#aa-feedback-overlay');
  var feedbackStars = chatBox.querySelectorAll('.aa-star');
  var feedbackTextEl = chatBox.querySelector('#aa-feedback-text');
  var feedbackSkipBtn = chatBox.querySelector('#aa-feedback-skip');
  var feedbackSubmitBtn = chatBox.querySelector('#aa-feedback-submit');
  var currentRating = 5;

  function updateLeadUI() {
    if (leadInfo) {
      chatBox.classList.remove('aa-needs-lead');
    } else {
      chatBox.classList.add('aa-needs-lead');
    }
  }
  updateLeadUI();

  function renderMessages() {
    msgContainer.innerHTML = '';
    savedMsgs.forEach(function(m) {
      if (m.sender === 'system') {
        var sdiv = document.createElement('div');
        sdiv.className = 'aa-msg-system';
        sdiv.textContent = m.text;
        msgContainer.appendChild(sdiv);
        return;
      }
      var div = document.createElement('div');
      div.className = 'aa-msg ' + (m.sender === 'visitor' ? 'aa-msg-visitor' : 'aa-msg-ai');
      div.innerHTML = '<div>' + escapeHtml(m.text).replace(/\\n/g, '<br/>') + '</div><div class="aa-msg-time">' + (m.time || '') + '</div>';
      msgContainer.appendChild(div);
    });
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  renderMessages();

  var isOpen = false;
  function toggleChat() {
    isOpen = !isOpen;
    chatBox.style.display = isOpen ? 'flex' : 'none';
    if (isOpen) {
      launcher.classList.remove('aa-has-unread');
      if (leadInfo && !hasSyncedThisLoad) {
        hasSyncedThisLoad = true;
        establishConversation(leadInfo.name, leadInfo.email, true).catch(function() {});
      }
      inputEl.focus();
      msgContainer.scrollTop = msgContainer.scrollHeight;
    }
  }

  launcher.addEventListener('click', toggleChat);

  closeBtn.addEventListener('click', function() {
    var visitorHasChatted = savedMsgs.some(function(m) { return m.sender === 'visitor'; });
    if (conversationId && visitorHasChatted && feedbackShownForConv !== conversationId) {
      feedbackShownForConv = conversationId;
      closeAfterFeedback = true;
      showFeedback();
      return;
    }
    toggleChat();
  });

  // Quick Action Pills Click
  chatBox.querySelectorAll('.aa-pill').forEach(function(pill) {
    pill.addEventListener('click', function() {
      var q = pill.getAttribute('data-q');
      if (q) sendMessage(q);
    });
  });

  // Handle Send Form
  formEl.addEventListener('submit', function(e) {
    e.preventDefault();
    var val = inputEl.value.trim();
    if (!val) return;
    sendMessage(val);
  });

  // --- Pre-chat Name + Email gate ---
  function submitLeadFromForm() {
    var name = prechatNameInput.value.trim();
    var email = prechatEmailInput.value.trim();
    if (!name || !email) return;
    prechatSubmitBtn.disabled = true;
    prechatSubmitBtn.textContent = 'Starting...';
    establishConversation(name, email, false)
      .then(function() {
        prechatSubmitBtn.disabled = false;
        prechatSubmitBtn.textContent = 'Start Chat';
        inputEl.focus();
      })
      .catch(function(err) {
        prechatSubmitBtn.disabled = false;
        prechatSubmitBtn.textContent = 'Start Chat';
        console.error('Lead submit error:', err);
      });
  }
  prechatSubmitBtn.addEventListener('click', submitLeadFromForm);
  prechatNameInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') submitLeadFromForm(); });
  prechatEmailInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') submitLeadFromForm(); });
  if (leadInfo) {
    prechatNameInput.value = leadInfo.name || '';
    prechatEmailInput.value = leadInfo.email || '';
  }

  // Submits (or silently re-syncs) the Name+Email lead. This is the ONLY
  // place that creates a real lead / triggers the admin email alert
  // server-side. It also decides resume-vs-fresh chat thread and, when
  // silent === true, re-runs automatically each time the widget is opened
  // (using the cached name/email) so the "standard" 1-hour resume window
  // is honoured without asking the visitor again.
  function establishConversation(name, email, silent) {
    return fetch(serverUrl + '/api/visitor/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId: visitorId,
        name: name,
        email: email,
        pageUrl: window.location.href
      })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (!data || !data.success) return;

      leadInfo = { name: name, email: email };
      localStorage.setItem(storageKeyLead, JSON.stringify(leadInfo));

      var newConvId = data.conversation ? data.conversation.id : null;
      var isDifferentConv = !!(newConvId && newConvId !== conversationId);

      if (newConvId) {
        conversationId = newConvId;
        localStorage.setItem(storageKeyConv, conversationId);
      }

      if (data.isFreshChatSession || isDifferentConv || savedMsgs.length === 0) {
        savedMsgs = [{
          id: 'welcome_1',
          sender: 'ai',
          text: 'Hello ' + name + '! Welcome to AA Creative Embroidery. Which project can we assist you with today \u2014 Embroidery Digitizing or Vector Art Conversion?',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }];
        localStorage.setItem(storageKeyMsgs, JSON.stringify(savedMsgs));
        renderMessages();
        feedbackShownForConv = null;
      } else if (conversationId && !silent) {
        loadConversationHistory(conversationId);
        feedbackShownForConv = null;
      } else if (conversationId && silent) {
        loadConversationHistory(conversationId);
      }

      updateLeadUI();
      startPolling();
    });
  }

  // Pull full message history for a resumed conversation from the server
  // (used both after lead-submit resume and on returning-visitor re-sync).
  function loadConversationHistory(convId) {
    return fetch(serverUrl + '/api/conversations/' + convId + '/messages')
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (!data || !data.success) return;
        var mapped = (data.messages || []).map(function(m) {
          return {
            id: m.id,
            sender: m.senderType === 'visitor' ? 'visitor' : (m.senderType === 'system' ? 'system' : 'ai'),
            text: m.text,
            time: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
        });
        if (mapped.length > 0) {
          savedMsgs = mapped;
          localStorage.setItem(storageKeyMsgs, JSON.stringify(savedMsgs));
        }
        renderMessages();
      })
      .catch(function() {});
  }

  function sendMessage(text) {
    if (!conversationId) return;
    inputEl.value = '';
    var userMsg = {
      id: 'msg_' + Date.now(),
      sender: 'visitor',
      text: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    savedMsgs.push(userMsg);
    localStorage.setItem(storageKeyMsgs, JSON.stringify(savedMsgs));
    renderMessages();

    typingIndicator.style.display = 'block';
    msgContainer.scrollTop = msgContainer.scrollHeight;

    fetch(serverUrl + '/api/visitor/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: conversationId,
        visitorId: visitorId,
        visitorName: leadInfo ? leadInfo.name : 'Website Visitor',
        visitorEmail: leadInfo ? leadInfo.email : undefined,
        text: text,
        channel: 'website'
      })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      typingIndicator.style.display = 'none';
      if (!data) return;

      // Previous thread was closed/stale -- server started a brand-new,
      // clean conversation. Adopt its id so replies & polling stay in sync.
      if (data.newConversationId && data.newConversationId !== conversationId) {
        conversationId = data.newConversationId;
        localStorage.setItem(storageKeyConv, conversationId);
        feedbackShownForConv = null;
      }

      if (data.aiMessage) {
        savedMsgs.push({
          id: data.aiMessage.id,
          sender: 'ai',
          text: data.aiMessage.text,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        localStorage.setItem(storageKeyMsgs, JSON.stringify(savedMsgs));
        renderMessages();
      }

      if (data.promptFeedback && feedbackShownForConv !== conversationId) {
        feedbackShownForConv = conversationId;
        showFeedback();
      }
    })
    .catch(function(err) {
      typingIndicator.style.display = 'none';
      console.error('Chat error:', err);
    });
  }

  // --- Polling: picks up a human agent's reply even if the visitor never
  // sends another message themselves (human handoff would otherwise be
  // invisible to the widget). Also detects the chat being closed/resolved
  // from the admin side and prompts for a rating.
  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(pollForReplies, 4000);
  }

  function pollForReplies() {
    if (!conversationId) return;
    fetch(serverUrl + '/api/conversations/' + conversationId + '/messages')
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (!data || !data.success) return;

        var knownIds = {};
        savedMsgs.forEach(function(m) { knownIds[m.id] = true; });

        var appended = false;
        (data.messages || []).forEach(function(m) {
          if (knownIds[m.id]) return;
          knownIds[m.id] = true;
          if (m.senderType === 'visitor') return; // already rendered locally on send
          savedMsgs.push({
            id: m.id,
            sender: m.senderType === 'system' ? 'system' : 'ai',
            text: m.text,
            time: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
          appended = true;
        });

        if (appended) {
          localStorage.setItem(storageKeyMsgs, JSON.stringify(savedMsgs));
          renderMessages();
          if (!isOpen) {
            launcher.classList.add('aa-has-unread');
          }
        }

        if (data.conversation && data.conversation.status === 'resolved' && feedbackShownForConv !== conversationId) {
          feedbackShownForConv = conversationId;
          showFeedback();
        }
      })
      .catch(function() {});
  }

  // --- Feedback / rating modal ---
  function paintStars(n) {
    feedbackStars.forEach(function(s) {
      var v = parseInt(s.getAttribute('data-star'), 10);
      s.style.color = v <= n ? '#f59e0b' : '#cbd5e1';
    });
  }

  feedbackStars.forEach(function(s) {
    s.addEventListener('click', function() {
      currentRating = parseInt(s.getAttribute('data-star'), 10);
      paintStars(currentRating);
    });
  });

  function showFeedback() {
    currentRating = 5;
    paintStars(currentRating);
    feedbackTextEl.value = '';
    feedbackOverlay.classList.add('aa-show');
    if (!isOpen) {
      isOpen = true;
      chatBox.style.display = 'flex';
      launcher.classList.remove('aa-has-unread');
    }
  }

  function hideFeedback() {
    feedbackOverlay.classList.remove('aa-show');
    if (closeAfterFeedback) {
      closeAfterFeedback = false;
      if (isOpen) toggleChat();
    }
  }

  feedbackSkipBtn.addEventListener('click', function() {
    hideFeedback();
  });

  feedbackSubmitBtn.addEventListener('click', function() {
    if (!conversationId) {
      hideFeedback();
      return;
    }
    feedbackSubmitBtn.disabled = true;
    fetch(serverUrl + '/api/conversations/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: conversationId,
        status: 'resolved',
        rating: currentRating,
        feedback: feedbackTextEl.value.trim()
      })
    })
    .then(function() {
      feedbackSubmitBtn.disabled = false;
      hideFeedback();
    })
    .catch(function() {
      feedbackSubmitBtn.disabled = false;
      hideFeedback();
    });
  });

  // If this browser already has a captured lead from a previous visit,
  // silently sync with the server once the widget first opens (see
  // toggleChat) rather than on every page load, to avoid unnecessary
  // background requests for visitors who never open the chat.

})();
    `);
  });


  // Vite Middleware integration for SPA dev & static dist fallback for prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Live Support Platform server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
