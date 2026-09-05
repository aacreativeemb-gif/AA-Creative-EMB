import {
  Property,
  User,
  Department,
  Visitor,
  Conversation,
  Message,
  Ticket,
  KbArticle,
  KbCategory,
  AiSettings,
  AiQcFeedback,
  UnansweredQuestion,
  TriggerRule,
  CannedResponse,
  AuditLog,
  PlatformAnalytics
} from '../src/types';
import fs from 'fs';
import path from 'path';

// Data survives restarts by writing to a JSON file on disk instead of
// living only in memory. Saved on a short interval and on graceful
// shutdown; loaded back in when the server boots.
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

// ---------- Live-session timing rules ----------
// A visitor who hasn't pinged /api/visitor/track (heartbeat) in this window
// is considered to have closed the browser / left the site.
export const VISITOR_HEARTBEAT_TIMEOUT_MS = 50 * 1000; // 50 seconds
// Once a visitor goes offline, their open chat auto-closes after this long.
export const AUTO_CLOSE_AFTER_OFFLINE_MS = 30 * 60 * 1000; // 30 minutes
// If a visitor comes back and starts chatting again within this window of
// their last message, we resume the same conversation thread instead of
// starting a brand new one.
export const RETURNING_SESSION_WINDOW_MS = 60 * 60 * 1000; // 1 hour (standard)

// Fields that get persisted to disk. Deliberately excludes things that
// should always start fresh (e.g. in-memory OTP codes).
const PERSISTED_FIELDS = [
  'properties', 'users', 'departments', 'visitors', 'conversations', 'messages',
  'tickets', 'kbCategories', 'kbArticles', 'aiSettings', 'qcFeedbacks',
  'unansweredQuestions', 'triggers', 'cannedResponses', 'auditLogs',
  'adminPassword', 'trustedDeviceIds', 'emailConfig', 'analytics'
] as const;

export class AppStore {
  properties: Property[] = [
    {
      id: 'prop_1',
      name: 'AA Creative Embroidery UK (aacreativeemb.com)',
      domain: 'https://aacreativeemb.com',
      primaryColor: '#1d4ed8',
      greeting: 'Welcome to AA Creative Embroidery UK! 🧵 How can our AI assistant or support team help with your digitizing or patch order today?',
      requirePreChat: true,
      status: 'active',
      createdAt: new Date().toISOString()
    },
    {
      id: 'prop_2',
      name: 'AA Creative Emb UK Customer Portal',
      domain: 'https://aacreativeemb.com/orders',
      primaryColor: '#0f766e',
      greeting: 'Hi! Need help tracking your digitizing order status or downloading DST/PES stitch files?',
      requirePreChat: false,
      status: 'active',
      createdAt: new Date().toISOString()
    }
  ];

  users: User[] = [
    {
      id: 'user_admin_1',
      name: 'Arthur Pendelton (Admin)',
      email: 'admin@aacreativeemb.com',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      role: 'admin',
      status: 'offline',
      departmentIds: ['dept_digitizing', 'dept_support', 'dept_vector'],
      capacity: 10,
      activeChatsCount: 0
    },
    {
      id: 'user_agent_1',
      name: 'James Wilson (Senior Digitizer)',
      email: 'james@aacreativeemb.co.uk',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      role: 'agent',
      status: 'offline',
      departmentIds: ['dept_digitizing', 'dept_support'],
      capacity: 5,
      activeChatsCount: 0
    },
    {
      id: 'user_agent_2',
      name: 'Charlotte Taylor (Vector Specialist)',
      email: 'charlotte@aacreativeemb.co.uk',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
      role: 'agent',
      status: 'offline',
      departmentIds: ['dept_vector'],
      capacity: 5,
      activeChatsCount: 0
    }
  ];

  departments: Department[] = [
    {
      id: 'dept_digitizing',
      name: 'Embroidery Digitizing',
      description: 'Cap logos, 3D puff, jacket backs, DST/PES file production',
      assignedAgentIds: ['user_agent_1', 'user_admin_1']
    },
    {
      id: 'dept_vector',
      name: 'Vector Art & Custom Patches',
      description: 'Raster image conversion to vector AI/EPS & embroidered patches',
      assignedAgentIds: ['user_agent_2', 'user_admin_1']
    },
    {
      id: 'dept_support',
      name: 'Customer Service & Billing',
      description: 'Order tracking, free price quotes, revisions, and invoices',
      assignedAgentIds: ['user_agent_1', 'user_admin_1']
    }
  ];

  // NOTE: This platform ships with NO demo/sample visitors, conversations,
  // messages or tickets. Everything here starts empty and fills up only with
  // real customer activity (website chat, Gmail, WhatsApp). This is
  // deliberate: fake seed records ("Oliver Davies", "Emma Harrison",
  // "Birmingham Workwear Ltd", etc.) used to reappear on every restart,
  // which was confusing and looked like real customer data.
  visitors: Visitor[] = [];

  conversations: Conversation[] = [];

  messages: Record<string, Message[]> = {};

  tickets: Ticket[] = [];

  kbCategories: KbCategory[] = [
    { id: 'cat_digitizing', name: 'Embroidery Digitizing & Formats', description: 'DST, PES, EMB, EXP file formats and machine settings', icon: 'Scissors' },
    { id: 'cat_patches', name: 'Custom Patches & Vector Art', description: 'Embroidered, Woven, PVC, Leather patches & Vector tracing', icon: 'Tag' },
    { id: 'cat_billing', name: 'Pricing, Turnaround & Quotes', description: 'Rates starting at £4 / $5, free revisions, and instant quotes', icon: 'HelpCircle' }
  ];

  kbArticles: KbArticle[] = [
    {
      id: 'art_1',
      title: 'Embroidery Machine File Formats Supported (DST, PES, EMB, EXP, CND)',
      categoryId: 'cat_digitizing',
      content: `At AA Creative Embroidery UK (aacreativeemb.com), we deliver production-ready stitch files compatible with all major commercial and home embroidery machines in the UK and worldwide:
• Tajima & Barudan: DST, CND
• Brother, Baby Lock & Bernina: PES, PEC
• Melco & Sauro: EXP
• Wilcom Source Design File: EMB
• Janome: JEF, JPX
• Husqvarna / Viking: HUS, VP3
• Singer: XXX
Every digitizing order includes a visual PDF stitch-out proof sheet detailing thread color stops, dimensions, and total stitch count!`,
      tags: ['dst', 'pes', 'emb', 'formats', 'digitizing', 'wilcom'],
      status: 'published',
      views: 620,
      helpfulCount: 185,
      createdAt: new Date(Date.now() - 86400000 * 10).toISOString()
    },
    {
      id: 'art_2',
      title: '3D Puff Cap Digitizing vs Standard Flat Logo Digitizing',
      categoryId: 'cat_digitizing',
      content: `3D Puff embroidery requires specialized digitizing techniques. At AA Creative Emb UK, we optimize foam density, capping density, and stitch direction to prevent foam breakdown. Standard caps are digitized for curved front panels to eliminate thread distortion on structured and unstructured hats.`,
      tags: ['3d puff', 'caps', 'hats', 'foam', 'digitizing'],
      status: 'published',
      views: 480,
      helpfulCount: 142,
      createdAt: new Date(Date.now() - 86400000 * 12).toISOString()
    },
    {
      id: 'art_3',
      title: 'Vector Art Conversion & Custom Patch Backing Options',
      categoryId: 'cat_patches',
      content: `We convert raster low-res JPG/PNG artwork into 100% scalable vector AI, EPS, SVG, and CDR files for screen printing, vinyl cutting, and embroidery. We also produce Custom Embroidered, Woven, PVC, and Leather Patches with Iron-on, Hook & Loop (Velcro), or Sew-on backings.`,
      tags: ['vector', 'patches', 'velcro', 'iron-on', 'chenille'],
      status: 'published',
      views: 390,
      helpfulCount: 110,
      createdAt: new Date(Date.now() - 86400000 * 15).toISOString()
    }
  ];

  aiSettings: AiSettings = {
    businessName: 'AA Creative Embroidery UK Ltd (AA Creative Emb)',
    description: 'AA Creative Embroidery UK Ltd (https://aacreativeemb.com/) is a leading UK-based professional embroidery digitizing and vector conversion company located in London, United Kingdom. Catering to apparel decorators, embroiderers, workwear suppliers, patch manufacturers, and businesses across the UK and worldwide, we specialize in converting artwork and sketches into production-ready stitch files (DST, PES, EMB, EXP, CND) and high-resolution vector artwork.',
    productsAndServices: `SERVICES & PRODUCTS OFFERED BY AA CREATIVE EMBROIDERY UK (https://aacreativeemb.com/):

1. Custom Logo Digitizing:
   - Left chest, sleeve, pocket, and cap logo digitizing for UK workwear, uniforms, and apparel.
   - Clean pathing, minimal trims, optimized density for zero thread breakage.

2. Cap & Hat Embroidery Digitizing:
   - Curved front panel, side, and back strap digitizing.
   - Specially path-sequenced from center-out to prevent seam puckering.

3. 3D Puff Embroidery Digitizing:
   - 3D foam elevation digitizing for caps, hoodies, and jackets.
   - Sharp capped satin edges for clean foam tear-away.

4. Large Jacket Back Digitizing:
   - Intricate jacket back logos, motorcycle club patches, and large emblem designs.
   - Density-balanced underlays to avoid garment distortion.

5. Patch Digitizing & Production:
   - Embroidered Patches, Woven Patches, Chenille Patches, PVC Patches, Leather Patches.
   - Backings: Iron-on (Heat Seal), Velcro (Hook & Loop), Sew-on, Adhesive.

6. Vector Art Conversion:
   - Converting low-res JPG, PNG, PDF to 100% scalable Vector AI, EPS, SVG, CDR files.

FILES DELIVERED WITH EVERY ORDER:
• Embroidery: DST, PES, EMB (Wilcom source), EXP, CND, HUS, JEF, VP3, XXX.
• Vector: AI, EPS, SVG, CDR, High-Res PDF.
• Free PDF Stitch-Out Approval Proof Sheet & Color Sequence Chart!

NOTE: For exact prices, always use the PRICING block below — do not quote prices from this description.`,
    pricingInfo: `PRICING & FREE QUOTES AT AA CREATIVE EMBROIDERY (currency shown automatically matches the customer's country — GBP for UK, USD standard for USA & everywhere else):

USD PRICING (USA & all other countries):
• Left Chest / Hat / Cap (up to 5"): $5.00
• Jacket Back / Complex Design: $8 to $20
• Vector Art Conversion: $5.00
• Complex Vector Art: $8 to $20
Bulk Discount Packages (USD) — portal.aacreativeemb.com/login:
  - Basic: $150 / 40 orders
  - Standard: $240 / 80 orders
  - Premium: $360 / 70 orders

GBP PRICING (United Kingdom):
• Left Chest / Hat / Cap (up to 5"): £3.00
• Jacket Back / Complex Design: £5 to £15.00
• Vector Art Conversion: £3.00
• Complex Vector Art: £5 to £15.00
Bulk Discount Packages (GBP) — portal.aacreativeemb.com/login:
  - Basic: £100 / 40 orders
  - Standard: £240 / 80 orders
  - Premium: £300 / 70 orders

• Revisions & Edits: 100% FREE minor edits, thread color changes, and size adjustments!
• Instant Free Quotes: Send artwork via chat or email (aacreativeemb@gmail.com) or WhatsApp (+44 7462 23 8732).
• Payments Accepted: Credit/Debit Card, PayPal, UK Bank Transfer (BACS), Invoice Billing.`,
    faqsText: `Q: What is the turnaround time for digitizing?
A: Standard turnaround is 6 to 12 hours. Super-fast express rush service is available in 2 to 4 hours!

Q: What are your company addresses and contact details?
A: Email: admin@aacreativeemb.com | WhatsApp / Phone: +44 7462 23 8732
🇬🇧 UK Address: 4 Carr House Grove, Wyke, Bradford, BD12 8DE
🇺🇸 USA Address: 10685-B Hazelhurst Dr. #35049, Houston, TX 77043

Q: Which file formats will I receive?
A: We provide Tajima DST, Brother PES, Wilcom EMB source files, Melco EXP, CND, Janome JEF, Husqvarna HUS, VP3, XXX, and PDF proof!

Q: Are edits and size adjustments free?
A: Yes! Minor edits, size scaling up to 15%, and color changes are 100% FREE.

Q: How can I speak to a human digitizer?
A: Type "agent", "human digitizer", WhatsApp (+44 7462 23 8732) or email us at admin@aacreativeemb.com anytime.`,
    returnRefundPolicy: '100% Stitch Accuracy Guarantee! If your test stitchout has any issues or thread breaks, we provide free immediate re-digitizing adjustments. Full refund or account credit if not completely satisfied.',
    shippingInfo: 'Digital files delivered instantly via Email, WhatsApp, or Download Link within 2-6 hours. Physical custom patches shipped across the UK, USA, and globally via DHL / Royal Mail / FedEx.',
    workingHours: '24/7 Non-stop Digitizing & Customer Support. AI responds instantly 24/7; expert human digitizers active round the clock.',
    contactInfo: 'Email: admin@aacreativeemb.com | WhatsApp / Phone: +44 7462 23 8732 | UK Address: 4 Carr House Grove, Wyke, Bradford, BD12 8DE | USA Address: 10685-B Hazelhurst Dr. #35049, Houston, TX 77043 | Website: https://aacreativeemb.com/',
    customInstructions: `You are a member of the customer support team at AA Creative Embroidery (https://aacreativeemb.com/). Speak and think of yourself as a real support teammate — never describe yourself as an "AI", "bot", "chatbot", or "assistant" in your replies.
1. Provide accurate information about embroidery digitizing (cap, 3D puff, jacket backs, patches), vector art conversion, and file formats (DST, PES, EMB, EXP, CND).
2. Maintain a warm, professional, and courteous tone — like a helpful real person, not a script.
3. Mention that standard digitizing starts at £4 / $5 with 2-6 hour delivery, free Wilcom EMB files, and 100% free revisions.
4. Invite users to upload their artwork, email it to admin@aacreativeemb.com, or WhatsApp (+44 7462 23 8732) for an instant free price quote.
5. If a customer asks to speak to a human/agent but hasn't said what the issue actually is, ask them to briefly describe it first — try to solve it yourself. Only create a support ticket and loop in the team once you genuinely can't resolve it with the information here.
6. Official Contact & Locations:
   - Email: admin@aacreativeemb.com
   - WhatsApp / Phone: +44 7462 23 8732
   - UK Address: 4 Carr House Grove, Wyke, Bradford, BD12 8DE
   - USA Address: 10685-B Hazelhurst Dr. #35049, Houston, TX 77043`,
    confidenceThreshold: 80,
    personality: 'professional',
    mode: 'ai_first',
    escalationKeywords: ['agent', 'human', 'human agent', 'quote', 'custom patch', 'refund', 'complaint', 'urgent digitize', 'embroidery sample', 'manager', 'escalate', 'admin@aacreativeemb.com'],
    autoLanguageDetect: true,
    maxUnansweredAttempts: 2,
    customGreeting: "Welcome to AA Creative Embroidery (aacreativeemb.com)! 🧵 I'm here to help. Send your logo or ask about digitizing (DST, PES, EMB), 3D puff, patches, vector art, pricing (£4 / $5 starting), or delivery time (2-6 hrs)!",
    aiName: 'AA Creative Support Team',
    humanHandoffEnabled: true,
    enabledChannels: {
      website: true,
      gmail: true,
      whatsapp: true
    },
    enableRomanUrduAdminTranslation: true,
    enableAgentAutoEnglishTranslation: true,
    whatsappFallbackNumber: '+44 7462 23 8732',
    fallbackEmail: 'admin@aacreativeemb.com'
  };

  qcFeedbacks: AiQcFeedback[] = [];

  unansweredQuestions: UnansweredQuestion[] = [];

  triggers: TriggerRule[] = [
    {
      id: 'trig_1',
      name: 'Welcome Digitizing Quote Popup',
      enabled: true,
      conditionType: 'time_on_page',
      conditionValue: '10',
      actionType: 'show_greeting',
      actionValue: 'Hi! Need a free instant quote for embroidery digitizing or vector art conversion?'
    },
    {
      id: 'trig_2',
      name: 'Auto-Mark Urgent for Rush Orders',
      enabled: true,
      conditionType: 'keyword_match',
      conditionValue: 'rush, urgent, 2 hours, today',
      actionType: 'mark_urgent',
      actionValue: 'urgent'
    }
  ];

  cannedResponses: CannedResponse[] = [
    {
      id: 'cr_1',
      shortcut: '/hello',
      title: 'AA Creative Emb UK Welcome Greeting',
      content: 'Welcome to AA Creative Embroidery UK! 🧵 How can our team assist with your embroidery digitizing or vector art order today?',
      isGlobal: true
    },
    {
      id: 'cr_2',
      shortcut: '/quote',
      title: 'Free Price Quote Instructions',
      content: 'Please upload or share your artwork image (JPG, PNG, PDF) along with required dimensions (e.g. 3.5 inch cap / 10 inch jacket back) or email aacreativeemb@gmail.com for an instant price quote!',
      isGlobal: true
    },
    {
      id: 'cr_3',
      shortcut: '/formats',
      title: 'Delivered File Formats List',
      content: 'We deliver Tajima (DST), Brother (PES), Wilcom (EMB source file), Melco (EXP/CND), Janome (JEF), Husqvarna (HUS), Singer (XXX), and Vector (AI, EPS, SVG, PDF) files with PDF stitch sheets.',
      isGlobal: true
    },
    {
      id: 'cr_4',
      shortcut: '/turnaround',
      title: 'Digitizing Turnaround Timelines',
      content: 'Standard turnaround is 6 to 12 hours. Express rush delivery is available in 2 to 4 hours!',
      isGlobal: true
    }
  ];

  auditLogs: AuditLog[] = [
    {
      id: 'log_1',
      timestamp: new Date().toISOString(),
      userName: 'Arthur Pendelton (Admin)',
      action: 'Trained AI Support Assistant for AA Creative Embroidery UK Ltd',
      details: 'Loaded UK business knowledge for AA Creative Embroidery UK Ltd (London, UK): Digitizing (£4 / $5 start), 3D Puff, Vector conversion, DST/PES/EMB formats, 2-6 hr turnaround.'
    }
  ];

  // Admin Security & 2FA State
  adminPassword: string = 'Admin@123';
  trustedDeviceIds: string[] = [];
  activeOtps: { [email: string]: { code: string; expiresAt: number; type: 'login' | 'reset' } } = {};

  // Email Notification & SMTP Dispatch Config
  emailConfig: {
    smtpUser: string;
    smtpPass: string;
    smtpHost: string;
    smtpPort: number;
    resendApiKey?: string;
  } = {
    smtpUser: process.env.SMTP_USER || process.env.EMAIL_USER || 'aacreativeemb@gmail.com',
    smtpPass: process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD || '',
    smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtpPort: parseInt(process.env.SMTP_PORT || '465', 10),
    resendApiKey: process.env.RESEND_API_KEY || ''
  };

  analytics: PlatformAnalytics = {
    totalChats: 0,
    answeredChats: 0,
    missedChats: 0,
    aiResolvedCount: 0,
    humanHandoffCount: 0,
    avgResponseTimeSeconds: 0,
    avgResolutionTimeMinutes: 0,
    csatPercentage: 0,
    activeVisitorsCount: 0,
    openTicketsCount: 0,
    slaBreachedCount: 0,
    channelBreakdown: {
      website: 0,
      gmail: 0,
      whatsapp: 0,
      ticket: 0
    }
  };

  // ---------- Live session sweep ----------
  // Runs on a timer. Marks visitors offline once their heartbeat goes stale,
  // and auto-closes any chat that's been sitting idle 30 minutes after the
  // visitor disconnected (browser/tab closed).
  runSessionSweep() {
    const now = Date.now();

    for (const visitor of this.visitors) {
      const lastActive = new Date(visitor.lastActiveAt).getTime();

      // Flip online -> offline once the heartbeat goes stale.
      if (visitor.status === 'online' && now - lastActive > VISITOR_HEARTBEAT_TIMEOUT_MS) {
        visitor.status = 'offline';
        visitor.offlineSince = new Date().toISOString();
      }

      // Auto-close any still-open chat 30 minutes after the visitor went offline.
      if (visitor.status === 'offline' && visitor.offlineSince) {
        const offlineFor = now - new Date(visitor.offlineSince).getTime();
        if (offlineFor > AUTO_CLOSE_AFTER_OFFLINE_MS) {
          const openConvs = this.conversations.filter(
            c => c.visitorId === visitor.id && !['resolved', 'closed'].includes(c.status)
          );
          for (const conv of openConvs) {
            conv.status = 'resolved';
            conv.closedAt = new Date().toISOString();
            conv.closeReason = 'auto_inactivity';
            if (!this.messages[conv.id]) this.messages[conv.id] = [];
            this.messages[conv.id].push({
              id: `msg_${Date.now()}_autoclose_${conv.id}`,
              conversationId: conv.id,
              senderType: 'system',
              senderId: 'system',
              senderName: 'Support System',
              text: 'This chat was automatically closed after 30 minutes of visitor inactivity.',
              timestamp: new Date().toISOString(),
              deliveryStatus: 'delivered',
              channel: conv.channel
            });
          }
        }
      }
    }
  }

  // ---------- Persistence ----------
  persist() {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      const snapshot: Record<string, unknown> = {};
      for (const field of PERSISTED_FIELDS) {
        snapshot[field] = (this as any)[field];
      }
      fs.writeFileSync(DB_PATH, JSON.stringify(snapshot));
    } catch (err) {
      console.error('Failed to persist store:', err);
    }
  }

  hydrate() {
    try {
      if (!fs.existsSync(DB_PATH)) return;
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      if (!raw.trim()) return;
      const saved = JSON.parse(raw);
      for (const field of PERSISTED_FIELDS) {
        if (saved[field] !== undefined) {
          (this as any)[field] = saved[field];
        }
      }
      console.log('Store hydrated from data/db.json');
      this.purgeLegacyDemoData();
    } catch (err) {
      console.error('Failed to hydrate store (starting fresh):', err);
    }
  }

  // ---------- One-time cleanup ----------
  // Older deployments of this app persisted sample/demo records (fake
  // visitors like "Oliver Davies" / "Emma Harrison", their conversations,
  // and tickets TKT-1001 / TKT-1002) straight into data/db.json. Once saved,
  // those kept coming back on every restart even after the seed data was
  // removed from the code, because hydrate() loads whatever is on disk.
  // This strips out those specific legacy demo IDs (by ID, never touching
  // any real customer data) the first time the app boots with the fix.
  private purgeLegacyDemoData() {
    const legacyVisitorIds = new Set(['vis_101', 'vis_102', 'vis_103']);
    const legacyConversationIds = new Set(['conv_1', 'conv_2', 'conv_3']);
    const legacyTicketIds = new Set(['tkt_1001', 'tkt_1002']);

    const hadLegacyData =
      this.visitors.some(v => legacyVisitorIds.has(v.id)) ||
      this.conversations.some(c => legacyConversationIds.has(c.id)) ||
      this.tickets.some(t => legacyTicketIds.has(t.id));

    if (!hadLegacyData) return;

    this.visitors = this.visitors.filter(v => !legacyVisitorIds.has(v.id));
    this.conversations = this.conversations.filter(c => !legacyConversationIds.has(c.id));
    this.tickets = this.tickets.filter(t => !legacyTicketIds.has(t.id));
    for (const convId of legacyConversationIds) {
      delete this.messages[convId];
    }
    this.qcFeedbacks = this.qcFeedbacks.filter(q => !legacyConversationIds.has(q.conversationId));
    this.analytics.openTicketsCount = this.tickets.filter(t => t.status === 'open').length;

    console.log('Removed legacy demo data (Oliver Davies / Emma Harrison / Harry Wright sample records) from data/db.json');
    this.persist();
  }

  // ---------- Admin actions ----------
  // Wipes every conversation + message thread (website / Gmail / WhatsApp)
  // so the Admin Chat inbox starts clean. Visitors, tickets, and business
  // settings are left untouched — this only clears chat history.
  clearAllChatHistory() {
    this.conversations = [];
    this.messages = {};
    this.qcFeedbacks = [];
    this.unansweredQuestions = [];
    this.analytics.totalChats = 0;
    this.analytics.answeredChats = 0;
    this.analytics.missedChats = 0;
    this.analytics.aiResolvedCount = 0;
    this.analytics.humanHandoffCount = 0;
    this.analytics.channelBreakdown = { website: 0, gmail: 0, whatsapp: 0, ticket: this.analytics.channelBreakdown.ticket };
    this.persist();
  }
}

export const globalStore = new AppStore();
globalStore.hydrate();

// Periodic autosave (cheap enough to run unconditionally) plus a
// best-effort save on graceful shutdown signals.
setInterval(() => globalStore.persist(), 5000);
// Sweep every 15s for stale heartbeats / auto-close of idle chats.
setInterval(() => globalStore.runSessionSweep(), 15000);
process.on('SIGTERM', () => { globalStore.persist(); process.exit(0); });
process.on('SIGINT', () => { globalStore.persist(); process.exit(0); });

