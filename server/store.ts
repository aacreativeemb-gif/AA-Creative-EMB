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

  visitors: Visitor[] = [
    {
      id: 'vis_101',
      propertyId: 'prop_1',
      name: 'Oliver Davies',
      email: 'oliver.davies@londonthreads.co.uk',
      phone: '+44 20 7946 0912',
      ip: '185.125.190.45',
      location: { country: 'United Kingdom', city: 'London', flag: '🇬🇧' },
      browser: 'Chrome 122',
      os: 'macOS Sonoma',
      device: 'Desktop',
      currentUrl: 'https://aacreativeemb.com/cap-digitizing',
      landingPage: 'https://aacreativeemb.com/',
      referrer: 'Google Search UK',
      visitsCount: 3,
      pagesViewed: 6,
      timeOnSiteSeconds: 340,
      status: 'online',
      lastActiveAt: new Date().toISOString(),
      firstSeenAt: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
      sessionStartedAt: new Date(Date.now() - 340000).toISOString(),
      tags: ['UK Apparel', '3D Puff Cap', 'Rush Delivery'],
      notes: ['London apparel decorator requesting 3D puff cap logo digitizing with 2-hour rush delivery.']
    },
    {
      id: 'vis_102',
      propertyId: 'prop_1',
      name: 'Emma Harrison',
      email: 'emma@birminghamworkwear.co.uk',
      phone: '+44 121 496 0188',
      ip: '212.58.244.70',
      location: { country: 'United Kingdom', city: 'Birmingham', flag: '🇬🇧' },
      browser: 'Safari 17',
      os: 'macOS Sonoma',
      device: 'Desktop',
      currentUrl: 'https://aacreativeemb.com/patch-digitizing',
      landingPage: 'https://aacreativeemb.com/',
      referrer: 'Direct',
      visitsCount: 5,
      pagesViewed: 8,
      timeOnSiteSeconds: 520,
      status: 'online',
      lastActiveAt: new Date().toISOString(),
      firstSeenAt: new Date(Date.now() - 9 * 24 * 3600000).toISOString(),
      sessionStartedAt: new Date(Date.now() - 520000).toISOString(),
      tags: ['UK Workwear', 'Bulk Digitizing', 'VIP Client'],
      notes: ['Requires 40 jacket back embroidery digitizing designs weekly. Requested UK VAT invoice.']
    },
    {
      id: 'vis_103',
      propertyId: 'prop_1',
      name: 'Harry Wright',
      email: 'harry@manchestersports.co.uk',
      phone: '+44 161 496 0234',
      ip: '81.149.12.98',
      location: { country: 'United Kingdom', city: 'Manchester', flag: '🇬🇧' },
      browser: 'Edge 121',
      os: 'Windows 11',
      device: 'Desktop',
      currentUrl: 'https://aacreativeemb.com/vector-art-conversion',
      landingPage: 'https://aacreativeemb.com/',
      referrer: 'WhatsApp Support',
      visitsCount: 2,
      pagesViewed: 4,
      timeOnSiteSeconds: 180,
      status: 'online',
      lastActiveAt: new Date().toISOString(),
      firstSeenAt: new Date(Date.now() - 1 * 24 * 3600000).toISOString(),
      sessionStartedAt: new Date(Date.now() - 180000).toISOString(),
      tags: ['Vector Conversion', 'UK Client'],
      notes: ['Sent low-res PNG logo for vector redraw in EPS/AI format for Manchester sports shop.']
    }
  ];

  conversations: Conversation[] = [
    {
      id: 'conv_1',
      propertyId: 'prop_1',
      visitorId: 'vis_101',
      channel: 'website',
      departmentId: 'dept_digitizing',
      assignedAgentId: 'user_agent_1',
      isAiHandling: false,
      status: 'escalated',
      priority: 'urgent',
      subject: 'Cap Logo 3D Puff Digitizing - Express Delivery (London, UK)',
      lastMessageText: 'Hello! We need a cap logo digitized with 3D puff for Tajima machines in London. What are your rates and how fast can we get the DST file?',
      lastMessageAt: new Date(Date.now() - 60000).toISOString(),
      unreadCountAgent: 1,
      unreadCountVisitor: 0,
      sourceDetail: 'Website Live Chat (London, UK 🇬🇧)',
      queuePosition: 1,
      aiSummary: {
        sentiment: 'positive',
        summary: 'UK client Oliver asked for 3D puff cap digitizing price and Tajima DST delivery timeframe. AI quoted £4-£8 ($5-$10) and 2-4 hr express delivery, then connected to senior digitizer.',
        extractedIntent: 'Cap 3D Puff Digitizing Inquiry',
        confidenceScore: 95,
        recommendedAction: 'Ask customer to upload logo artwork file and confirm cap frame size (2.25 inch height).',
        escalationReason: 'Customer requested human digitizer for rush order confirmation.',
        extractedDetails: {
          productName: '3D Puff Cap Digitizing',
          contactPreferred: 'Live Chat / Email'
        }
      }
    },
    {
      id: 'conv_2',
      propertyId: 'prop_1',
      visitorId: 'vis_102',
      channel: 'gmail',
      departmentId: 'dept_support',
      assignedAgentId: null,
      isAiHandling: true,
      status: 'open',
      priority: 'high',
      subject: 'UK Corporate Workwear - Weekly Bulk Digitizing Account Inquiry',
      lastMessageText: 'Hi AA Creative Emb team, we manage a custom embroidery and workwear shop in Birmingham, UK. We need 30-50 logo designs digitized weekly. Do you supply Wilcom EMB source files?',
      lastMessageAt: new Date(Date.now() - 300000).toISOString(),
      unreadCountAgent: 1,
      unreadCountVisitor: 0,
      sourceDetail: 'Gmail API (aacreativeemb@gmail.com)',
      aiSummary: {
        sentiment: 'positive',
        summary: 'Birmingham workwear owner requesting bulk digitizing trade account (30-50 designs/week) with Wilcom EMB source files included.',
        extractedIntent: 'Bulk Digitizing Trade Account & Pricing',
        confidenceScore: 94,
        recommendedAction: 'Offer £4 flat rate ($5) for bulk account and attach sample EMB/DST digitizing proof.'
      }
    },
    {
      id: 'conv_3',
      propertyId: 'prop_1',
      visitorId: 'vis_103',
      channel: 'whatsapp',
      departmentId: 'dept_vector',
      assignedAgentId: 'user_admin_1',
      isAiHandling: true,
      status: 'open',
      priority: 'normal',
      subject: 'Vector Redraw Request for Manchester Sports Apparel',
      lastMessageText: 'Good afternoon! How much do you charge to convert a low-res PNG into a vector file for printing?',
      lastMessageAt: new Date(Date.now() - 600000).toISOString(),
      unreadCountAgent: 0,
      unreadCountVisitor: 0,
      sourceDetail: 'WhatsApp Business (+44 161 496 0234)'
    }
  ];

  messages: Record<string, Message[]> = {
    conv_1: [
      {
        id: 'msg_101',
        conversationId: 'conv_1',
        senderType: 'visitor',
        senderId: 'vis_101',
        senderName: 'Oliver Davies',
        text: 'Hello! We need a cap logo digitized with 3D puff for Tajima machines in London. What are your rates and how fast can we get the DST file?',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        deliveryStatus: 'read',
        channel: 'website',
        languageDetected: 'English',
        translatedRomanUrdu: 'Hello! Humey London me Tajima machines k liye 3D puff cap logo digitize karwana hai. Aap ke rates kya hain aur DST file kitni jaldi mil sakti hai?'
      },
      {
        id: 'msg_102',
        conversationId: 'conv_1',
        senderType: 'ai',
        senderId: 'ai_assistant',
        senderName: 'AA Creative Digitizing AI',
        text: 'Hello Oliver! Welcome to AA Creative Embroidery UK (aacreativeemb.com). Our standard rate for cap 3D puff digitizing is £4 to £8 ($5-$10) with 2 to 4 hour express delivery. We provide Tajima DST, Brother PES, and Wilcom EMB source files with a full PDF stitch-out proof sheet! Feel free to attach your artwork image.',
        timestamp: new Date(Date.now() - 280000).toISOString(),
        deliveryStatus: 'read',
        channel: 'website',
        confidenceScore: 96
      },
      {
        id: 'msg_103',
        conversationId: 'conv_1',
        senderType: 'visitor',
        senderId: 'vis_101',
        senderName: 'Oliver Davies',
        text: 'Brilliant! We have a tight deadline today. Can I speak to a digitizer agent to confirm the frame size?',
        timestamp: new Date(Date.now() - 60000).toISOString(),
        deliveryStatus: 'delivered',
        channel: 'website',
        isEscalationTrigger: true,
        languageDetected: 'English',
        translatedRomanUrdu: 'Zabardast! Aaj hamara deadline bohat tight hai. Kya main frame size confirm karne k liye senior digitizer agent se baat kar sakta hoon?'
      },
      {
        id: 'msg_104',
        conversationId: 'conv_1',
        senderType: 'system',
        senderId: 'system',
        senderName: 'System Handoff',
        text: '⚡ Smart Escalation Triggered: Customer requested senior digitizer agent. Conversation transferred to James Wilson (Senior Digitizer) with AI summary.',
        timestamp: new Date(Date.now() - 50000).toISOString(),
        deliveryStatus: 'delivered',
        channel: 'website'
      }
    ],
    conv_2: [
      {
        id: 'msg_201',
        conversationId: 'conv_2',
        senderType: 'visitor',
        senderId: 'vis_102',
        senderName: 'Emma Harrison',
        text: 'Hi AA Creative Emb team, we manage a custom embroidery and workwear shop in Birmingham, UK. We need 30-50 logo designs digitized weekly. Do you supply Wilcom EMB source files?',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        deliveryStatus: 'delivered',
        channel: 'gmail',
        translatedRomanUrdu: 'Hi AA Creative Emb team, hum Birmingham UK me custom embroidery aur workwear shop manage karte hain. Humey weekly 30-50 logos digitize karwane hain. Kya aap Wilcom EMB source file bhi dete hain?'
      },
      {
        id: 'msg_202',
        conversationId: 'conv_2',
        senderType: 'ai',
        senderId: 'ai_assistant',
        senderName: 'AA Creative Digitizing AI',
        text: 'Hello Emma! Thank you for contacting AA Creative Embroidery UK (aacreativeemb.com). Yes! We provide full Wilcom EMB source files, DST, PES, EXP, and PDF color sequence sheets with every order. For a volume of 30-50 designs per week, we offer an exclusive UK trade account rate of £4 flat ($5) per left-chest/cap logo with 100% free minor revisions and a 2-6 hour delivery turnaround.',
        timestamp: new Date(Date.now() - 250000).toISOString(),
        deliveryStatus: 'delivered',
        channel: 'gmail',
        confidenceScore: 95
      }
    ],
    conv_3: [
      {
        id: 'msg_301',
        conversationId: 'conv_3',
        senderType: 'visitor',
        senderId: 'vis_103',
        senderName: 'Harry Wright',
        text: 'Good afternoon! How much do you charge to convert a low-res PNG into a vector file for printing?',
        timestamp: new Date(Date.now() - 600000).toISOString(),
        deliveryStatus: 'delivered',
        channel: 'whatsapp'
      },
      {
        id: 'msg_302',
        conversationId: 'conv_3',
        senderType: 'ai',
        senderId: 'ai_assistant',
        senderName: 'AA Creative Digitizing AI',
        text: 'Good afternoon Harry! Our vector art conversion rate is £4 to £8 ($5-$10). You will receive print-ready AI, EPS, SVG, and High-Res PDF files within 2 to 4 hours. Send over your image or email aacreativeemb@gmail.com and we will prepare a proof sample right away!',
        timestamp: new Date(Date.now() - 580000).toISOString(),
        deliveryStatus: 'delivered',
        channel: 'whatsapp',
        confidenceScore: 98
      }
    ]
  };

  tickets: Ticket[] = [
    {
      id: 'tkt_1001',
      ticketNumber: 'TKT-1001',
      conversationId: 'conv_1',
      visitorId: 'vis_101',
      visitorName: 'Oliver Davies',
      visitorEmail: 'oliver.davies@londonthreads.co.uk',
      subject: 'Urgent 3D Puff Cap Digitizing Order - Order #AAC-8821 (London, UK)',
      description: 'Customer requested 2-hour rush digitizing delivery for 3D puff cap logo in Tajima DST format for London embroidery workshop.',
      priority: 'urgent',
      status: 'in_progress',
      departmentId: 'dept_digitizing',
      assignedAgentId: 'user_agent_1',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date().toISOString(),
      slaDueDate: new Date(Date.now() + 7200000).toISOString(),
      slaBreached: false,
      source: 'website',
      tags: ['Cap Digitizing', '3D Puff', 'Rush Order', 'DST', 'London UK']
    },
    {
      id: 'tkt_1002',
      ticketNumber: 'TKT-1002',
      conversationId: 'conv_2',
      visitorId: 'vis_102',
      visitorName: 'Emma Harrison',
      visitorEmail: 'emma@birminghamworkwear.co.uk',
      subject: 'Birmingham Workwear Ltd - UK Bulk Digitizing Trade Account Setup',
      description: 'UK commercial client inquiry for 30-50 weekly digitizing designs with Wilcom EMB source files and monthly invoicing.',
      priority: 'high',
      status: 'open',
      departmentId: 'dept_support',
      assignedAgentId: undefined,
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
      slaDueDate: new Date(Date.now() + 14400000).toISOString(),
      slaBreached: false,
      source: 'gmail',
      tags: ['UK Client', 'Bulk Account', 'Custom Invoice', 'Birmingham']
    }
  ];

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

1. Custom Logo Digitizing (£4 - £8 / $5 - $10):
   - Left chest, sleeve, pocket, and cap logo digitizing for UK workwear, uniforms, and apparel.
   - Clean pathing, minimal trims, optimized density for zero thread breakage.

2. Cap & Hat Embroidery Digitizing (£4 - £7 / $5 - $8):
   - Curved front panel, side, and back strap digitizing.
   - Specially path-sequenced from center-out to prevent seam puckering.

3. 3D Puff Embroidery Digitizing (£6 - £10 / $8 - $12):
   - 3D foam elevation digitizing for caps, hoodies, and jackets.
   - Sharp capped satin edges for clean foam tear-away.

4. Large Jacket Back Digitizing (£12 - £28 / $15 - $35):
   - Intricate jacket back logos, motorcycle club patches, and large emblem designs.
   - Density-balanced underlays to avoid garment distortion.

5. Patch Digitizing & Production (£8 - £20 / $10 - $25):
   - Embroidered Patches, Woven Patches, Chenille Patches, PVC Patches, Leather Patches.
   - Backings: Iron-on (Heat Seal), Velcro (Hook & Loop), Sew-on, Adhesive.

6. Vector Art Conversion (£4 - £8 / $5 - $10):
   - Converting low-res JPG, PNG, PDF to 100% scalable Vector AI, EPS, SVG, CDR files.

FILES DELIVERED WITH EVERY ORDER:
• Embroidery: DST, PES, EMB (Wilcom source), EXP, CND, HUS, JEF, VP3, XXX.
• Vector: AI, EPS, SVG, CDR, High-Res PDF.
• Free PDF Stitch-Out Approval Proof Sheet & Color Sequence Chart!`,
    pricingInfo: `PRICING & FREE QUOTES AT AA CREATIVE EMBROIDERY:
• Small Logos & Cap Digitizing: £4 - £8 ($5 - $10)
• Large Jacket Back Designs: £12 - £28 ($15 - $35) based on stitch count & complexity
• Vector Art Conversion: £4 - £8 ($5 - $10)
• Revisions & Edits: 100% FREE minor edits, thread color changes, and size adjustments!
• Instant Free Quotes: Send artwork via chat or email (admin@aacreativeemb.com) or WhatsApp (+44 7462 23 8732) for a 15-minute quote.
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
    customInstructions: `You are 'AA Creative Digitizing AI', the expert AI customer support assistant for AA Creative Embroidery (https://aacreativeemb.com/).
1. Provide accurate information about embroidery digitizing (cap, 3D puff, jacket backs, patches), vector art conversion, and file formats (DST, PES, EMB, EXP, CND).
2. Maintain a professional, polite, and courteous tone.
3. Mention that standard digitizing starts at £4 / $5 with 2-6 hour delivery, free Wilcom EMB files, and 100% free revisions.
4. Invite users to upload their artwork, email it to admin@aacreativeemb.com, or WhatsApp (+44 7462 23 8732) for an instant free price quote.
5. Official Contact & Locations:
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
    customGreeting: "Welcome to AA Creative Embroidery (aacreativeemb.com)! 🧵 I'm your AI Digitizing Assistant. Send your logo or ask about digitizing (DST, PES, EMB), 3D puff, patches, vector art, pricing (£4 / $5 starting), or delivery time (2-6 hrs)!",
    aiName: 'AA Creative Digitizing AI',
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

  qcFeedbacks: AiQcFeedback[] = [
    {
      id: 'qc_1',
      conversationId: 'conv_1',
      messageId: 'msg_102',
      query: 'Hello! We need a cap logo digitized with 3D puff for Tajima machines in London. What are your rates and how fast can we get the DST file?',
      aiResponse: 'Hello Oliver! Welcome to AA Creative Embroidery UK (aacreativeemb.com). Our standard rate for cap 3D puff digitizing is £4 to £8 ($5-$10) with 2 to 4 hour express delivery...',
      rating: 'good',
      notes: 'Handled UK 3D puff digitizing inquiry with precise pricing, file format details, and turnaround times.',
      timestamp: new Date(Date.now() - 280000).toISOString()
    }
  ];

  unansweredQuestions: UnansweredQuestion[] = [
    {
      id: 'uq_1',
      query: 'Do you digitize specialized Chenille embroidery patches for UK school varsity jackets?',
      count: 5,
      lastAskedAt: new Date(Date.now() - 43200000).toISOString(),
      status: 'pending'
    }
  ];

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
    totalChats: 184,
    answeredChats: 180,
    missedChats: 4,
    aiResolvedCount: 142,
    humanHandoffCount: 38,
    avgResponseTimeSeconds: 8,
    avgResolutionTimeMinutes: 3.2,
    csatPercentage: 98,
    activeVisitorsCount: 16,
    openTicketsCount: 2,
    slaBreachedCount: 0,
    channelBreakdown: {
      website: 112,
      gmail: 42,
      whatsapp: 26,
      ticket: 4
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
    } catch (err) {
      console.error('Failed to hydrate store (starting fresh):', err);
    }
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

