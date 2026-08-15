import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { globalStore } from './server/store';
import { processCustomerMessageWithAI, generateAiConversationSummary, translateTextToRomanUrdu, polishOrTranslateAgentReply, generateAgentReplySuggestions } from './server/aiEngine';
import { Message, Conversation, Ticket } from './src/types';

async function startServer() {
  const app = express();
  const PORT = 3000;

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

      if (!isAdmin && agentUser && password !== 'Admin@123' && password !== globalStore.adminPassword) {
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
      return res.json({
        success: true,
        token: `aa_token_${Date.now()}`,
        user: targetUser,
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

    console.log(`\n=============================================================`);
    console.log(`[2FA SECURITY CODE DISPATCHED -> ${targetEmail}]`);
    console.log(`Subject: 🔐 AA Creative Portal 2FA Verification Code: ${otpCode}`);
    console.log(`Attempted Account: ${cleanEmail}`);
    console.log(`Device ID: ${deviceId || 'New Unregistered Device'}`);
    console.log(`IP Address: ${clientIp}`);
    console.log(`Verification Code: ${otpCode} (Valid for 15 minutes)`);
    console.log(`=============================================================\n`);

    return res.json({
      success: false,
      requires2FA: true,
      email: targetEmail,
      otpPreview: otpCode,
      message: `A 6-digit verification code has been sent to ${targetEmail}.`
    });
  });

  // Verify 2FA & Trust Device
  app.post('/api/admin/verify-2fa', (req, res) => {
    const { email, code, deviceId, trustDevice } = req.body;
    const targetEmail = 'aacreativeemb@gmail.com';
    const record = globalStore.activeOtps[targetEmail];

    if (!record || record.code !== code?.trim() || Date.now() > record.expiresAt) {
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

    const adminUser = globalStore.users.find(u => u.role === 'admin') || {
      id: 'user_admin_1',
      name: 'Arthur Pendelton (Admin)',
      email: 'aacreativeemb@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      role: 'admin',
      status: 'online',
      departmentIds: ['dept_digitizing', 'dept_support', 'dept_vector'],
      capacity: 10,
      activeChatsCount: 2
    };

    return res.json({
      success: true,
      token: `aa_token_${Date.now()}`,
      user: adminUser,
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

    console.log(`\n=============================================================`);
    console.log(`[PASSWORD RESET OTP DISPATCHED -> ${targetEmail}]`);
    console.log(`Subject: 🔑 AA Creative Portal Password Reset Code: ${otpCode}`);
    console.log(`Requested Email: ${email || targetEmail}`);
    console.log(`Reset Code: ${otpCode} (Valid for 15 minutes)`);
    console.log(`=============================================================\n`);

    return res.json({
      success: true,
      otpPreview: otpCode,
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

  // Full state endpoint
  app.get('/api/state', (req, res) => {
    res.json({
      properties: globalStore.properties,
      users: globalStore.users,
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

  // Visitor sends message
  app.post('/api/visitor/message', async (req, res) => {
    try {
      const { conversationId, visitorId, text, channel = 'website', attachments } = req.body;

      if (!text && (!attachments || attachments.length === 0)) {
        return res.status(400).json({ error: 'Message text or attachment is required.' });
      }

      let conv = globalStore.conversations.find(c => c.id === conversationId);
      let visitor = globalStore.visitors.find(v => v.id === visitorId);

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
          id: conversationId || `conv_${Date.now()}`,
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

      // Check online human agents
      const onlineAgents = globalStore.users.filter(u => u.status === 'online');
      const shouldAiRespond = conv.isAiHandling && (globalStore.aiSettings.mode === 'ai_first' || globalStore.aiSettings.mode === 'ai_only' || onlineAgents.length === 0);

      let aiMessage: Message | undefined = undefined;

      if (shouldAiRespond) {
        const aiResult = await processCustomerMessageWithAI(
          conv.id,
          text,
          globalStore.messages[conv.id]
        );

        aiMessage = {
          id: `msg_${Date.now()}_ai`,
          conversationId: conv.id,
          senderType: 'ai',
          senderId: 'ai_assistant',
          senderName: globalStore.aiSettings.aiName || 'AI Support Assistant',
          text: aiResult.aiResponseText,
          timestamp: new Date().toISOString(),
          deliveryStatus: 'delivered',
          channel: conv.channel,
          confidenceScore: aiResult.confidenceScore,
          languageDetected: aiResult.languageDetected,
          isEscalationTrigger: aiResult.shouldEscalate
        };

        globalStore.messages[conv.id].push(aiMessage);
        conv.lastMessageText = aiResult.aiResponseText;
        conv.lastMessageAt = aiMessage.timestamp;

        // If AI determines escalation needed (human requested or low confidence)
        if (aiResult.shouldEscalate && globalStore.aiSettings.humanHandoffEnabled) {
          conv.isAiHandling = false;
          conv.status = 'escalated';
          conv.priority = 'urgent';

          if (aiResult.aiSummary) {
            conv.aiSummary = aiResult.aiSummary;
          } else {
            conv.aiSummary = await generateAiConversationSummary(text, globalStore.messages[conv.id], aiResult.escalationReason || 'Customer requested human support.');
          }

          // Assign available online agent if any
          if (onlineAgents.length > 0 && !conv.assignedAgentId) {
            conv.assignedAgentId = onlineAgents[0].id;
          }

          const systemHandoffMsg: Message = {
            id: `msg_${Date.now()}_sys`,
            conversationId: conv.id,
            senderType: 'system',
            senderId: 'system',
            senderName: 'System Handoff',
            text: `⚡ Smart Escalation Triggered: ${aiResult.escalationReason || 'Conversation transferred to human support team.'}`,
            timestamp: new Date().toISOString(),
            deliveryStatus: 'delivered',
            channel: conv.channel
          };
          globalStore.messages[conv.id].push(systemHandoffMsg);
        }
      }

      res.json({
        success: true,
        conversation: conv,
        visitorMessage: visitorMsg,
        aiMessage,
        isAiHandling: conv.isAiHandling,
        status: conv.status
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

  // Change conversation status
  app.post('/api/conversations/status', (req, res) => {
    const { conversationId, status, priority } = req.body;
    const conv = globalStore.conversations.find(c => c.id === conversationId);

    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (status) conv.status = status;
    if (priority) conv.priority = priority;

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
    res.json({ success: true, ticket: newTicket });
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

  var visitorId = localStorage.getItem(storageKeyVisitor);
  if (!visitorId) {
    visitorId = 'vis_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(storageKeyVisitor, visitorId);
  }

  var conversationId = localStorage.getItem(storageKeyConv);
  if (!conversationId) {
    conversationId = 'conv_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(storageKeyConv, conversationId);
  }

  var savedMsgs = [];
  try {
    savedMsgs = JSON.parse(localStorage.getItem(storageKeyMsgs) || '[]');
  } catch(e) {
    savedMsgs = [];
  }

  if (savedMsgs.length === 0) {
    savedMsgs.push({
      id: 'welcome_1',
      sender: 'ai',
      text: 'Hi & Welcome to AA Creative Embroidery! 🧵\\nHow can I help you today? Feel free to ask about digitizing rates, turnaround times, or vector art conversion.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
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
    <div id="aa-messages-container"></div>
    <div id="aa-typing">Support agent is typing...</div>
    <div id="aa-quick-actions">
      <span class="aa-pill" data-q="What are your embroidery digitizing rates?">🧵 Digitizing Rates</span>
      <span class="aa-pill" data-q="How long does logo digitizing take?">⚡ Turnaround Time</span>
      <span class="aa-pill" data-q="Which stitch formats do you provide?">📁 Formats (DST/PES)</span>
      <span class="aa-pill" data-q="I want a free quote for my embroidery design.">💬 Get Quote</span>
    </div>
    <form id="aa-input-bar">
      <input type="text" id="aa-text-input" placeholder="Type your message here..." autocomplete="off" />
      <button type="submit" id="aa-send-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
      </button>
    </form>
  \`;
  document.body.appendChild(chatBox);

  var msgContainer = chatBox.querySelector('#aa-messages-container');
  var typingIndicator = chatBox.querySelector('#aa-typing');
  var inputEl = chatBox.querySelector('#aa-text-input');
  var formEl = chatBox.querySelector('#aa-input-bar');
  var closeBtn = chatBox.querySelector('#aa-close-btn');

  function renderMessages() {
    msgContainer.innerHTML = '';
    savedMsgs.forEach(function(m) {
      var div = document.createElement('div');
      div.className = 'aa-msg ' + (m.sender === 'visitor' ? 'aa-msg-visitor' : 'aa-msg-ai');
      div.innerHTML = '<div>' + m.text.replace(/\\n/g, '<br/>') + '</div><div class="aa-msg-time">' + (m.time || '') + '</div>';
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
      inputEl.focus();
      msgContainer.scrollTop = msgContainer.scrollHeight;
    }
  }

  launcher.addEventListener('click', toggleChat);
  closeBtn.addEventListener('click', toggleChat);

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

  function sendMessage(text) {
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
        visitorName: 'Website Visitor',
        text: text,
        channel: 'website'
      })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      typingIndicator.style.display = 'none';
      if (data && data.aiMessage) {
        savedMsgs.push({
          id: data.aiMessage.id,
          sender: 'ai',
          text: data.aiMessage.text,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        localStorage.setItem(storageKeyMsgs, JSON.stringify(savedMsgs));
        renderMessages();
      }
    })
    .catch(function(err) {
      typingIndicator.style.display = 'none';
      console.error('Chat error:', err);
    });
  }

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
