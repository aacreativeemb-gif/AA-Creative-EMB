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
        visitor = {
          id: visitorId || `vis_${Date.now()}`,
          propertyId: 'prop_1',
          name: req.body.visitorName || 'Website Visitor',
          email: req.body.visitorEmail || 'visitor@example.com',
          ip: '182.185.12.98',
          location: { country: 'Pakistan', city: 'Karachi', flag: '🇵🇰' },
          browser: 'Chrome 122',
          os: 'Windows 11',
          device: 'Desktop',
          currentUrl: 'https://example.com/',
          landingPage: 'https://example.com/',
          referrer: 'Direct',
          visitsCount: 1,
          pagesViewed: 1,
          timeOnSiteSeconds: 45,
          status: 'online',
          lastActiveAt: new Date().toISOString(),
          tags: ['New Visitor'],
          notes: []
        };
        globalStore.visitors.unshift(visitor);
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
  console.log("ABC Store Live Chat & AI Support Widget Initialized.");
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
