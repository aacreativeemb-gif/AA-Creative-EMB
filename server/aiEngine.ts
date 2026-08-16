import { GoogleGenAI, Type } from '@google/genai';
import { globalStore } from './store';
import { AiSummary, Message } from '../src/types';

// Initialize Gemini SDK with User-Agent header as required
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build'
    }
  }
});

export interface AiProcessResult {
  aiResponseText: string;
  confidenceScore: number;
  shouldEscalate: boolean;
  requiresTicket?: boolean;
  problemSummary?: string;
  escalationReason?: string;
  languageDetected: string;
  isHumanRequested: boolean;
  aiSummary?: AiSummary;
  ticketSubject?: string;
  /** True if this was the visitor's very first-ever message in the conversation (a greeting reply, not an answer) — used so we don't prematurely arm the "anything else?" auto-close flow on the opening hello. */
  isFirstEverMessage?: boolean;
  extractedDetails?: {
    orderNumber?: string;
    projectType?: 'digitizing' | 'vector' | 'other';
    email?: string;
    phone?: string;
    name?: string;
  };
}

// Returns the correct currency pricing block based on the visitor's detected
// country: GBP for United Kingdom customers, USD (standard) for USA and every
// other country. This gets injected directly into the AI's knowledge so it
// never quotes the wrong currency.
function getPricingBlockForCountry(country?: string): string {
  const isUK = !!country && /united kingdom|^uk$|england|scotland|wales|northern ireland|britain/i.test(country);

  if (isUK) {
    return `PRICING (GBP — this customer is in the United Kingdom):
- Left Chest / Hat / Cap (up to 5") — £3.00
- Jacket Back / Complex Design — £5 to £15.00
- Vector Art Conversion — £3.00
- Complex Vector Art — £5 to £15.00

Bulk Discount Packages (GBP) — purchase at https://portal.aacreativeemb.com/login:
- Basic Package — £100 for 40 orders (Hat/Left Chest or any design up to 5")
- Standard Package — £240 for 80 orders (Hat/Left Chest or any design up to 5")
- Premium Package — £300 for 70 orders (Hat/Left Chest or any design up to 5")`;
  }

  return `PRICING (USD — standard rate for USA and all other countries):
- Left Chest / Hat / Cap (up to 5") — $5.00
- Jacket Back / Complex Design — $8 to $20
- Vector Art Conversion — $5.00
- Complex Vector Art — $8 to $20

Bulk Discount Packages (USD) — purchase at https://portal.aacreativeemb.com/login:
- Basic Package — $150 for 40 orders (Hat/Left Chest or any design up to 5")
- Standard Package — $240 for 80 orders (Hat/Left Chest or any design up to 5")
- Premium Package — $360 for 70 orders (Hat/Left Chest or any design up to 5")`;
}

// A reply "answered something" (pricing, turnaround, formats, a ticket
// number, etc.) if it contains concrete specifics like this — as opposed to
// a bare greeting or "which project can we help with?" qualifying message.
function looksLikeSubstantiveAnswer(text: string): boolean {
  return /[£$]\s?\d|\bDST\b|\bPES\b|\bEMB\b|\bEXP\b|\bJEF\b|turnaround|\d\s*(-|to)\s*\d?\s*hour|\bformat/i.test(text);
}

// Guarantees every non-escalated reply that actually answers something ends
// with a genuine "anything else?" question. The visitor's NEXT message is
// only ever treated as "chat is done, close it" if they were truly just
// asked this — so this function is what makes that downstream check
// safe/accurate instead of closing the chat the moment someone happens to
// say "thanks" right after a plain greeting.
function ensureClosingQuestion(responseText: string, isFirstEverMessage: boolean, shouldEscalate: boolean): string {
  if (shouldEscalate || !responseText) return responseText;
  // A first-ever message that's just a greeting/qualifying reply (no real
  // answer given yet) shouldn't be forced to ask "anything else?" — that
  // question only makes sense once something has actually been answered.
  if (isFirstEverMessage && !looksLikeSubstantiveAnswer(responseText)) return responseText;
  const alreadyAsks = /anything\s*else|kuch\s*(aur|or)|aur\s*kuch|kisi\s*aur\s*(cheez|chiz)|need\s*anything\s*more|help\s*you\s*with\s*(anything|something)\s*else/i.test(responseText);
  if (alreadyAsks) return responseText;
  return responseText.trim() + '\n\nIs there anything else I can help you with today?';
}

export async function processCustomerMessageWithAI(
  conversationId: string,
  userMessageText: string,
  previousMessages: Message[],
  visitorName?: string,
  visitorEmail?: string,
  visitorCountry?: string
): Promise<AiProcessResult> {
  const settings = globalStore.aiSettings;
  const lowerText = userMessageText.toLowerCase().trim();

  // Extract potential phone or email or order or name from message
  const emailMatch = userMessageText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = userMessageText.match(/(?:\+?\d{1,4}[\s-]?)?\(?\d{2,5}\)?[\s-]?\d{3,5}[\s-]?\d{3,5}/);
  const orderMatch = userMessageText.match(/(?:order\s*(?:#|no\.?|num\.?|number)?\s*[:=]?\s*([0-9a-zA-Z-]+))/i) || userMessageText.match(/(?:#\s*([0-9a-zA-Z-]+))/);
  const extractedOrderNum = orderMatch ? orderMatch[1] : (userMessageText.match(/\b\d{3,7}\b/)?.[0] || undefined);

  // Extract name if user states "my name is...", "i am...", "this is..."
  let extractedName: string | undefined = undefined;
  const namePattern = /(?:my name is|i am|this is|i'm|name:)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i;
  const nameMatch = userMessageText.match(namePattern);
  if (nameMatch && nameMatch[1]) {
    const rawName = nameMatch[1].trim();
    if (!['here', 'looking', 'interested', 'asking', 'inquiring', 'trying', 'wanting', 'writing'].includes(rawName.toLowerCase())) {
      extractedName = rawName;
    }
  }

  const isGuestEmail = !visitorEmail || visitorEmail.includes('@guest.aaemb.com') || visitorEmail.includes('visitor@example.com');
  const isGuestName = !visitorName || visitorName === 'Website Visitor' || visitorName === 'Visitor' || visitorName.startsWith('Visitor #');

  // Check how many messages exchanged
  const visitorMessagesCount = previousMessages.filter(m => m.senderType === 'visitor').length;
  // previousMessages already includes the current visitor message (it's
  // pushed to the store before this function is called), so a count of
  // exactly 1 means this is the very first thing the visitor has ever sent.
  const isFirstEverMessage = visitorMessagesCount <= 1;
  const pricingBlock = getPricingBlockForCountry(visitorCountry);

  // 2. Call Gemini model gemini-2.5-flash for intelligent conversational support & lead qualification
  if (process.env.GEMINI_API_KEY) {
    try {
      const systemPrompt = `You are a warm, genuinely helpful customer support specialist at '${settings.businessName}' (AA Creative Embroidery UK). You talk the way a real, experienced support agent would — naturally, conversationally, and with real attentiveness to what the customer is actually asking. Avoid sounding scripted or robotic.

HOW TO TALK:
- Match the customer's language and tone. If they write in English, reply in English. If they write in Urdu or Roman Urdu, reply in Roman Urdu — don't force English on someone who isn't using it.
- Read the actual message before responding — don't run through a fixed checklist regardless of what they said.
- Keep replies concise and easy to read (a few sentences, not a wall of text), unless the question genuinely needs more detail.
- Vary your phrasing — avoid repeating the exact same stock sentences across a conversation.
- It's fine to show a little warmth and personality, the way a helpful person would, without being over the top.

GETTING NAME & EMAIL:
- If it naturally fits (e.g. they're asking for a quote, want to place an order, or the conversation is moving toward next steps) and you don't already have their name/email (Customer Known Email: ${isGuestEmail ? 'Unknown' : visitorEmail}), ask for it once, naturally — not as a rigid rule tacked onto every single reply.
- Once they've shared their name, use it naturally in conversation going forward — don't over-thank them for it every time.

HANDLING ORDER STATUS / COMPLAINTS / HUMAN REQUESTS:
- If the customer asks about an existing order, has an urgent problem, explicitly asks for a human/agent, or the issue needs a real person's judgment:
  - Set "shouldEscalate": true and "requiresTicket": true
  - Set "problemSummary" to a clear, specific description of what they need
  - In your reply, let them know a support ticket has been created and the team has been notified — mention the team's email (aacreativeemb@gmail.com) if it helps
  - If you don't have their email yet, ask for it so they can get updates
  - If you do have it, just confirm they'll get a confirmation there

WRAPPING UP:
- Whenever you've actually answered what the customer needed and there's nothing pending (no ticket, no missing info you're waiting on), you MUST end your reply with a natural closing question such as "Is there anything else I can help you with today?" — every single answer-giving reply needs this, no exceptions, EXCEPT your very first greeting to a brand-new visitor (that first message is about finding out what they need, not wrapping up).
- If the customer then says "no" / "thanks" / "that's all" etc., that's your cue the conversation is over — a system process handles the goodbye and rating prompt automatically, so you don't need to say goodbye yourself.

HONESTY RULES:
- Never invent prices, turnaround times, or order status — only use what's in the business knowledge below.
- CRITICAL PRICING RULE: The "PRICING" section below is the ONLY source of truth for prices. If any price figure appears anywhere else in this knowledge (e.g. in service descriptions), IGNORE it — always quote numbers exactly as written in the PRICING section, matched to the customer's currency.
- If you genuinely don't know something, say so honestly and offer to loop in the team.
- You may refer to yourself as "I" or "our team" — you don't need to hide that you're an AI if directly and sincerely asked, but there's no need to volunteer it unprompted either. Never pretend to be a specific named human employee.
- Extract any email, phone, name, or order number the customer shares into the schema.

BUSINESS KNOWLEDGE:
- Description: ${settings.description}
- Products & Services: ${settings.productsAndServices}
- PRICING (authoritative — use these numbers only): ${pricingBlock}
- Turnaround: 2-6 hours standard, 2-hour super rush express available. Formats: DST, PES, EMB, EXP, JEF, Vector AI, EPS, SVG, PDF.
- Admin Email: aacreativeemb@gmail.com, Phone/WhatsApp: +44 7462 23 8732

Current Customer Status:
- Name: ${isGuestName ? 'Unknown (Not provided yet)' : visitorName}
- Email: ${isGuestEmail ? 'Unknown (Not provided yet)' : visitorEmail}
- Messages Exchanged: ${visitorMessagesCount}

Respond STRICTLY in JSON format matching the schema provided.`;

      const formattedHistory = previousMessages.slice(-8).map(m => `${m.senderName} (${m.senderType}): ${m.text}`).join('\n');
      const prompt = `Conversation History:\n${formattedHistory}\n\nLatest Customer Message: "${userMessageText}"`;

      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
        contents: prompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              responseText: {
                type: Type.STRING,
                description: 'The natural customer support response to send in English.'
              },
              confidenceScore: {
                type: Type.NUMBER,
                description: 'Confidence score from 0 to 100.'
              },
              shouldEscalate: {
                type: Type.BOOLEAN,
                description: 'Set true if user asks for order status, human agent, technical complaint, or ticket generation.'
              },
              requiresTicket: {
                type: Type.BOOLEAN,
                description: 'Set true if a support ticket should be created and emails sent to admin and customer.'
              },
              problemSummary: {
                type: Type.STRING,
                description: 'Detailed description of the customer problem for ticket and email notifications.'
              },
              escalationReason: {
                type: Type.STRING,
                description: 'Reason for escalation if applicable.'
              },
              extractedCustomerName: {
                type: Type.STRING,
                description: 'Extracted customer first/full name if mentioned.'
              },
              extractedEmail: {
                type: Type.STRING,
                description: 'Extracted customer email if provided.'
              },
              extractedPhone: {
                type: Type.STRING,
                description: 'Extracted customer phone if provided.'
              },
              extractedOrderNumber: {
                type: Type.STRING,
                description: 'Extracted order number if provided.'
              },
              customerSentiment: {
                type: Type.STRING,
                description: 'positive, neutral, frustrated, or angry.'
              },
              extractedIntent: {
                type: Type.STRING,
                description: 'Short summary of intent e.g. Lead Qualification, Order Tracking, Quote Inquiry.'
              }
            },
            required: ['responseText', 'confidenceScore', 'shouldEscalate', 'customerSentiment', 'extractedIntent']
          }
        }
      });

      const jsonText = response.text || '{}';
      const parsed = JSON.parse(jsonText);

      const confidenceScore = parsed.confidenceScore ?? 88;
      const shouldEscalate = parsed.shouldEscalate || confidenceScore < settings.confidenceThreshold;
      const requiresTicket = parsed.requiresTicket || shouldEscalate;

      const finalEmail = emailMatch ? emailMatch[0] : (parsed.extractedEmail || undefined);
      const finalPhone = phoneMatch ? phoneMatch[0] : (parsed.extractedPhone || undefined);
      const finalName = extractedName || (parsed.extractedCustomerName && parsed.extractedCustomerName !== 'Unknown' ? parsed.extractedCustomerName : undefined);
      const finalOrderNum = extractedOrderNum || (parsed.extractedOrderNumber || undefined);

      let summary: AiSummary | undefined = undefined;
      if (shouldEscalate) {
        summary = {
          sentiment: parsed.customerSentiment || 'neutral',
          summary: parsed.problemSummary || `Customer inquiry: ${parsed.extractedIntent}. Message: "${userMessageText}"`,
          extractedIntent: parsed.extractedIntent || 'Support Inquiry',
          confidenceScore: confidenceScore,
          recommendedAction: 'Review customer ticket and reply promptly via email or chat.',
          escalationReason: parsed.escalationReason || 'Customer query or ticket escalation.'
        };
      }

      return {
        aiResponseText: ensureClosingQuestion(
          parsed.responseText || "Thank you for reaching out to AA Creative Embroidery! How can we assist you with your digitizing or vector artwork today?",
          isFirstEverMessage,
          shouldEscalate
        ),
        confidenceScore,
        shouldEscalate,
        requiresTicket,
        problemSummary: parsed.problemSummary || `Customer inquiry: "${userMessageText}"`,
        escalationReason: parsed.escalationReason,
        languageDetected: 'English',
        isHumanRequested: false,
        isFirstEverMessage,
        aiSummary: summary,
        extractedDetails: {
          orderNumber: finalOrderNum,
          projectType: lowerText.includes('vector') ? 'vector' : lowerText.includes('digitiz') ? 'digitizing' : undefined,
          email: finalEmail,
          phone: finalPhone,
          name: finalName
        }
      };
    } catch (error) {
      console.error('Error executing Gemini AI response:', error);
    }
  }

  // Fallback Rule-Based Engine
  const fallbackResult = getFallbackAiResponse(userMessageText, previousMessages, visitorName, visitorEmail, visitorCountry);
  fallbackResult.aiResponseText = ensureClosingQuestion(fallbackResult.aiResponseText, isFirstEverMessage, fallbackResult.shouldEscalate);
  fallbackResult.isFirstEverMessage = isFirstEverMessage;
  return fallbackResult;
}

export async function generateAiConversationSummary(
  latestMessage: string,
  history: Message[],
  reason: string
): Promise<AiSummary> {
  const fullText = history.map(m => `${m.senderName}: ${m.text}`).join('\n') + `\nVisitor: ${latestMessage}`;

  if (process.env.GEMINI_API_KEY) {
    try {
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
        contents: `Analyze this customer support conversation and generate a concise internal handoff summary for a human agent.\nConversation:\n${fullText}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sentiment: { type: Type.STRING, description: 'positive, neutral, frustrated, angry' },
              summary: { type: Type.STRING, description: '2-sentence handoff summary' },
              extractedIntent: { type: Type.STRING, description: 'Short intent e.g. Order Delay' },
              recommendedAction: { type: Type.STRING, description: 'Action item for agent' },
              orderId: { type: Type.STRING, description: 'Order ID if mentioned' }
            },
            required: ['sentiment', 'summary', 'extractedIntent', 'recommendedAction']
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      return {
        sentiment: parsed.sentiment || 'neutral',
        summary: parsed.summary || `Customer needs help with: "${latestMessage}"`,
        extractedIntent: parsed.extractedIntent || 'Support Request',
        confidenceScore: 90,
        recommendedAction: parsed.recommendedAction || 'Review conversation history and respond to customer.',
        escalationReason: reason,
        extractedDetails: parsed.orderId ? { orderId: parsed.orderId } : undefined
      };
    } catch (e) {
      console.error('Failed to generate summary with Gemini:', e);
    }
  }

  return {
    sentiment: 'neutral',
    summary: `Customer requested assistance regarding: "${latestMessage}"`,
    extractedIntent: 'General Support Inquiry',
    confidenceScore: 80,
    recommendedAction: 'Check customer query and reply promptly.',
    escalationReason: reason
  };
}

function detectLanguage(text: string): string {
  const lower = text.toLowerCase();
  if (/[\u0600-\u06FF]/.test(text)) return 'Urdu (اردو)';
  if (lower.includes('pohanchy') || lower.includes('batao') || lower.includes('shukriya') || lower.includes('karo') || lower.includes('hai') || lower.includes('nahi') || lower.includes('kab')) {
    return 'Roman Urdu';
  }
  return 'English';
}

function getFallbackAiResponse(
  userMessageText: string,
  previousMessages: Message[],
  visitorName?: string,
  visitorEmail?: string,
  visitorCountry?: string
): AiProcessResult {
  const lower = userMessageText.toLowerCase().trim();
  const onlineAgents = globalStore.users.filter(u => u.status === 'online');
  const isAnyAgentOnline = onlineAgents.length > 0;

  const emailMatch = userMessageText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = userMessageText.match(/(?:\+?\d{1,4}[\s-]?)?\(?\d{2,5}\)?[\s-]?\d{3,5}[\s-]?\d{3,5}/);
  const orderMatch = userMessageText.match(/(?:order\s*(?:#|no\.?|num\.?|number)?\s*[:=]?\s*([0-9a-zA-Z-]+))/i);

  // Extract name if provided
  let extractedName: string | undefined = undefined;
  const nameMatch = userMessageText.match(/(?:my name is|i am|this is|i'm|name:)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
  if (nameMatch && nameMatch[1]) {
    const raw = nameMatch[1].trim();
    if (!['here', 'looking', 'interested', 'asking', 'inquiring'].includes(raw.toLowerCase())) {
      extractedName = raw;
    }
  }

  const isGuestEmail = !visitorEmail || visitorEmail.includes('@guest.aaemb.com') || visitorEmail.includes('visitor@example.com');
  const isGuestName = !visitorName || visitorName === 'Website Visitor' || visitorName === 'Visitor';

  // 1. Order status / Order inquiry detection / Human support / Ticket request
  if (lower.includes('order') || lower.includes('staus') || lower.includes('status') || lower.includes('track') || lower.includes('3541') || lower.includes('3542') || !!orderMatch || lower.includes('agent') || lower.includes('human') || lower.includes('ticket')) {
    let orderNumber = orderMatch ? orderMatch[1] : (userMessageText.match(/\d{3,}/)?.[0] || undefined);
    let orderDisplay = orderNumber ? `Order #${orderNumber}` : 'your order';
    let projectType = lower.includes('vector') ? 'Vector Art' : lower.includes('digitiz') ? 'Embroidery Digitizing' : 'Digitizing/Vector';

    const problemDesc = `Customer inquiry for ${projectType} ${orderDisplay}. Inquiry: "${userMessageText}"`;

    const greetingName = extractedName || (!isGuestName ? visitorName : '');
    const personalizedHello = greetingName ? `Thank you, ${greetingName}! ` : '';

    return {
      aiResponseText: `${personalizedHello}I have noted your inquiry regarding ${orderDisplay} and generated Support Ticket {{TICKET_NUMBER}} for you.\n\nOur administrative team has been notified immediately via high-priority email alert (aacreativeemb@gmail.com). We have also logged your request to send a confirmation directly to your email address. An administrator will review your order details and contact you directly to resolve this promptly.`,
      confidenceScore: 95,
      shouldEscalate: true,
      requiresTicket: true,
      problemSummary: problemDesc,
      escalationReason: problemDesc,
      languageDetected: 'English',
      isHumanRequested: true,
      extractedDetails: {
        orderNumber: orderNumber,
        projectType: lower.includes('vector') ? 'vector' : 'digitizing',
        email: emailMatch ? emailMatch[0] : undefined,
        phone: phoneMatch ? phoneMatch[0] : undefined,
        name: extractedName
      }
    };
  }

  // 2. If user provides name or email in response to inquiry
  if (emailMatch || extractedName) {
    const thankName = extractedName || (emailMatch ? 'there' : 'friend');
    return {
      aiResponseText: `Thank you for sharing your details! We have saved your contact information. How can we assist you with your project today? Feel free to share your artwork requirements, order number, or ask for a free quote.`,
      confidenceScore: 95,
      shouldEscalate: false,
      languageDetected: 'English',
      isHumanRequested: false,
      extractedDetails: {
        email: emailMatch ? emailMatch[0] : undefined,
        phone: phoneMatch ? phoneMatch[0] : undefined,
        name: extractedName
      }
    };
  }

  // 3. Pricing and Quote inquiries
  if (lower.includes('quote') || lower.includes('price') || lower.includes('cost') || lower.includes('rate') || lower.includes('how much') || lower.includes('digitiz') || lower.includes('vector')) {
    const askContact = isGuestEmail ? "\n\nMay I also know your name and email address so we can save your project specifications and send you your official quote sheet?" : "";
    return {
      aiResponseText: `Here are our current rates:\n\n${getPricingBlockForCountry(visitorCountry)}${askContact}`,
      confidenceScore: 95,
      shouldEscalate: false,
      languageDetected: 'English',
      isHumanRequested: false
    };
  }

  // 4. File formats
  if (lower.includes('format') || lower.includes('dst') || lower.includes('pes') || lower.includes('emb') || lower.includes('exp') || lower.includes('jef') || lower.includes('eps') || lower.includes('ai') || lower.includes('svg')) {
    return {
      aiResponseText: "We provide all industry standard embroidery formats including Tajima DST, Brother PES, Wilcom EMB source files, Melco EXP, Janome JEF, and high-res vector files (AI, EPS, SVG, PDF) with a comprehensive stitch proof PDF sheet!",
      confidenceScore: 95,
      shouldEscalate: false,
      languageDetected: 'English',
      isHumanRequested: false
    };
  }

  // 5. Turnaround time
  if (lower.includes('turnaround') || lower.includes('time') || lower.includes('fast') || lower.includes('rush') || lower.includes('delivery') || lower.includes('how long')) {
    return {
      aiResponseText: "Our standard turnaround time is 2 to 6 hours. We also offer 2-hour super rush express delivery with no extra quality compromise!",
      confidenceScore: 95,
      shouldEscalate: false,
      languageDetected: 'English',
      isHumanRequested: false
    };
  }

  // 6. Initial greeting (Hello! Welcome to AA Creative Embroidery...)
  if (lower.includes('hi') || lower.includes('hello') || lower.includes('hey') || lower.includes('good morning') || lower.includes('good afternoon') || lower.includes('help') || previousMessages.length <= 1) {
    return {
      aiResponseText: "Hello! Welcome to AA Creative Embroidery. Which project can we assist you with today — Embroidery Digitizing or Vector Art Conversion?",
      confidenceScore: 95,
      shouldEscalate: false,
      languageDetected: 'English',
      isHumanRequested: false
    };
  }

  // Default polite qualification
  return {
    aiResponseText: "Thank you for reaching out to AA Creative Embroidery! Are you looking for Embroidery Digitizing (DST, PES, EMB) or Vector Art Conversion (AI, EPS, SVG)? May I know your name and email address so we can save your project details?",
    confidenceScore: 85,
    shouldEscalate: false,
    languageDetected: 'English',
    isHumanRequested: false
  };
}

// ============================================================================
// OFFLINE SAFETY-NET TRANSLATOR (Roman Urdu -> English)
// ----------------------------------------------------------------------------
// This is used ONLY when Gemini is unreachable/misconfigured (e.g. missing
// GEMINI_API_KEY on a custom deployment outside AI Studio). It is a best-
// effort dictionary/phrase translator — not as good as Gemini, but it
// guarantees a customer NEVER sees raw, un-translated Roman Urdu, which is a
// hard business requirement (all customers are UK/USA and only read English).
// ============================================================================

// Common whole support-chat phrases, checked first (best quality when they match).
// Note: h(ai|ain|e|ein)? below matches all common spellings of "hai"/"hain"/"he"/"hein".
const ROMAN_URDU_PHRASE_MAP: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b(me|main)\s*ap(ki|ka|)\s*kia?\s*madad\s*kar\s*sakta\s*h[uo]n?\b\??/gi, replacement: 'How can I help you?' },
  { pattern: /\bkia\s*(mein\s*)?ap\s*ki\s*madad\s*kar\s*sakta\s*h[uo]n?\b\??/gi, replacement: 'How can I help you?' },
  { pattern: /\bassalam\s*o?\s*alaikum\b/gi, replacement: 'Hello' },
  { pattern: /\bwalaikum\s*(as)?salam\b/gi, replacement: 'Hello' },
  { pattern: /\bap\s*kaise\s*h(ai|ain|e|ein)?\b\??/gi, replacement: 'How are you?' },
  { pattern: /\bshukriya\b/gi, replacement: 'thank you' },
  { pattern: /\bmehrbani\b/gi, replacement: 'thank you' },
  { pattern: /\btheek\s*h(ai|ain|e|ein)?\b/gi, replacement: 'okay' },
  { pattern: /\bthek\s*h(ai|ain|e|ein)?\b/gi, replacement: 'okay' },
  { pattern: /\bkoi\s*masla\s*nahi[n]?\b/gi, replacement: 'no problem' },
  { pattern: /\bfikar\s*na\s*kar[ei]n\b/gi, replacement: "don't worry" },
  { pattern: /\bkitn[ei]\s*ghant[ei]\s*lagen\s*g[ei]\b\??/gi, replacement: 'how many hours will it take?' },
  { pattern: /\bprice\s*kitni\s*h(ai|ain|e|ein)?\b\??/gi, replacement: 'what is the price?' },
  { pattern: /\brate\s*kia\s*h(ai|ain|e|ein)?\b\??/gi, replacement: 'what is the rate?' },
  { pattern: /\bquote\s*bhej\s*(doon|deta|denge)\s*g[ae]\b/gi, replacement: 'I will send the quote' },
  { pattern: /\bthora\s*wait\s*kar[ei]n\b/gi, replacement: 'please wait a moment' },
  { pattern: /\border\s*confirm\s*h(ai|ain|e|ein)?\b/gi, replacement: 'the order is confirmed' },
  { pattern: /\bpayment\s*kar\s*d[ei]n\b/gi, replacement: 'please make the payment' },
  { pattern: /\blink\s*bhej\s*(raha|rahi)\s*h[uo]n\b/gi, replacement: 'I am sending the link' },
  { pattern: /\bap\s*ka\s*bohat?\s*shukriya\b/gi, replacement: 'thank you very much' },
  { pattern: /\bkoi\s*aur\s*madad\s*chahiye\b\??/gi, replacement: 'do you need any more help?' },
  { pattern: /\bji\s*bilkul\b/gi, replacement: 'yes, absolutely' },
  { pattern: /\bji\s*han\b/gi, replacement: 'yes' },
  { pattern: /\bji\s*nahi[n]?\b/gi, replacement: 'no' },
  // Longer/compound patterns
  { pattern: /\b(\d+)\s*ghant[ey]?\s*(mein|me)?\s*taiyar\s*ho\s*jaye\s*gi\b/gi, replacement: 'will be ready in $1 hours' },
  { pattern: /\bfile\s*taiyar\s*ho\s*jaye\s*gi\b/gi, replacement: 'the file will be ready' },
  { pattern: /\bkal\s*tak\s*ready\s*ho\s*jaye\s*g[ai]\b/gi, replacement: 'will be ready by tomorrow' },
  { pattern: /\bhum\s*check\s*kar\s*rahe\s*h(ai|ain|e|ein)?\b/gi, replacement: 'we are checking' },
  { pattern: /\b(mein|me)\s*(abhi\s*)?dekh\s*(raha|rahi)\s*h[uo]n\b/gi, replacement: 'I am checking now' },
  { pattern: /\bap\s*ka\s*design\s*mil\s*gaya\s*h(ai|ain|e|ein)?\b/gi, replacement: 'we have received your design' },
  { pattern: /\bdesign\s*mil\s*gaya\s*h(ai|ain|e|ein)?\b/gi, replacement: 'we have received your design' },
  { pattern: /\bwait\s*mat\s*kar[ei]n\b/gi, replacement: "you don't need to wait" },
  { pattern: /\bap\s*ko\s*bata\s*(doon|deta|denge)\s*g[ae]\b/gi, replacement: 'I will let you know' },
  { pattern: /\bkal\s*tak\s*mil\s*jaye\s*g[ai]\b/gi, replacement: 'you will receive it by tomorrow' }
];

// Word-by-word fallback dictionary for anything the phrase map doesn't catch.
// Unknown tokens (including English business terms like "digitizing", "DST",
// "quote", customer names, numbers) are left exactly as typed.
const ROMAN_URDU_WORD_MAP: Record<string, string> = {
  me: 'I', main: 'I', hum: 'we', ap: 'you', aap: 'you', apka: 'your', apki: 'your', apko: 'you', apke: 'your',
  aapka: 'your', aapki: 'your', aapko: 'you', aapke: 'your', ko: '',
  kia: 'what', kya: 'what', kaisay: 'how', kaise: 'how', kab: 'when', kahan: 'where', kyun: 'why', kyu: 'why',
  kar: 'do', karo: 'do', karain: 'please do', karen: 'please do', kiya: 'did', kijiye: 'please do',
  sakta: 'can', sakti: 'can', sakte: 'can',
  hu: 'am', hun: 'am', hai: 'is', hain: 'are', ho: 'are', tha: 'was', thi: 'was',
  madad: 'help', chahiye: 'need', zaroorat: 'need',
  shukriya: 'thank you', meherbani: 'thank you',
  theek: 'okay', thek: 'okay', acha: 'okay', accha: 'okay', bilkul: 'absolutely', zaroor: 'certainly',
  jaldi: 'quickly', abhi: 'right now', aj: 'today', aaj: 'today', kal: 'tomorrow', parso: 'day after tomorrow',
  price: 'price', rate: 'rate', quote: 'quote', paisay: 'money', paise: 'money',
  bhej: 'send', bhejo: 'send', bhejain: 'please send', bhejen: 'please send', bhijwa: 'send', dedo: 'give',
  file: 'file', ready: 'ready', taiyar: 'ready', hogi: 'will be', hoga: 'will be', hogaya: 'is done',
  ghante: 'hours', ghanty: 'hours', ghanta: 'hour', minute: 'minutes', second: 'seconds',
  wait: 'wait', intezar: 'wait', ruko: 'please wait',
  plz: 'please', please: 'please',
  sir: 'sir', madam: 'madam', bhai: '', dost: 'friend',
  nahi: 'no', nahin: 'no', nai: 'no', na: 'no', han: 'yes', haan: 'yes',
  ji: '', bilkl: 'sure',
  design: 'design', digitizing: 'digitizing', vector: 'vector', order: 'order', payment: 'payment', link: 'link',
  mil: 'received', gaya: '', gayi: '', dekh: 'check', dekhta: 'checking', dekhti: 'checking', dekhen: 'please check',
  problem: 'problem', masla: 'problem', koi: 'any',
  fikar: 'worry', chinta: 'worry',
  bohat: 'very', bahut: 'very', zyada: 'more', kam: 'less', thora: 'a little',
  confirm: 'confirmed', cancel: 'cancelled', complete: 'complete', pura: 'complete',
  welcome: 'welcome', khush: 'happy', amdeed: 'welcome',
  mein: 'in', jaye: '', rahe: 'ing', rahi: 'ing', raha: 'ing', kro: 'do'
};

// Rough heuristic to detect whether a piece of text is likely Roman Urdu
// (as opposed to already being plain English), so we know whether the
// fallback translator should even run.
function looksLikeRomanUrdu(text: string): boolean {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  let hits = 0;
  for (const w of words) {
    const clean = w.replace(/[^a-z]/g, '');
    if (ROMAN_URDU_WORD_MAP[clean] !== undefined) hits++;
  }
  return hits / words.length >= 0.3; // at least ~30% recognizably Roman Urdu
}

// Best-effort offline Roman Urdu -> English conversion, used only when
// Gemini can't be reached. Returns the original text unchanged if it
// doesn't look like Roman Urdu to begin with (already English).
function offlineTranslateRomanUrduToEnglish(text: string): { englishText: string; isConverted: boolean } {
  if (!text || !text.trim()) return { englishText: text, isConverted: false };

  if (!looksLikeRomanUrdu(text)) {
    return { englishText: text, isConverted: false };
  }

  let working = text;
  for (const { pattern, replacement } of ROMAN_URDU_PHRASE_MAP) {
    working = working.replace(pattern, replacement);
  }

  const rebuilt = working
    .split(/(\s+)/)
    .map(token => {
      if (/^\s+$/.test(token)) return token;
      const cleaned = token.replace(/[^a-zA-Z]/g, '').toLowerCase();
      const punctuation = token.match(/[.,!?]+$/)?.[0] || '';
      const mapped = ROMAN_URDU_WORD_MAP[cleaned];
      if (mapped !== undefined) {
        return mapped + punctuation;
      }
      return token; // keep unknown words (names, numbers, DST/PES, etc.) as-is
    })
    .join('')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const finalText = rebuilt.charAt(0).toUpperCase() + rebuilt.slice(1);
  return { englishText: finalText || text, isConverted: true };
}

export async function translateTextToRomanUrdu(text: string): Promise<string> {
  if (!text || text.trim().length === 0) return '';
  if (process.env.GEMINI_API_KEY) {
    try {
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
        contents: `Translate the following customer message into natural, easy-to-read Roman Urdu (Urdu written in Latin alphabet). Keep embroidery terms intact (DST, PES, EMB, 3D puff, cap, vector, quote, rate, turnaround).
Message to translate: "${text}"`,
        config: {
          systemInstruction: 'You are an English to Roman Urdu translator for a customer support admin dashboard. Respond with ONLY the translated Roman Urdu text without quotes.',
        }
      });
      return response.text?.trim() || text;
    } catch (err: any) {
      console.error('Error translating to Roman Urdu:', err?.message || err);
    }
  }
  return `(Roman Urdu) ${text}`;
}

export async function polishOrTranslateAgentReply(
  agentDraft: string,
  conversationHistory: Message[] = []
): Promise<{ polishedEnglish: string; isConverted: boolean }> {
  if (!agentDraft || agentDraft.trim().length === 0) {
    return { polishedEnglish: '', isConverted: false };
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      const historyStr = conversationHistory.slice(-4).map(m => `${m.senderName}: ${m.text}`).join('\n');
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
        contents: `Chat History:\n${historyStr}\n\nAgent Draft Input (may be Roman Urdu, broken/shorthand English, or Urdu): "${agentDraft}"\n\nTask: Polish or convert this agent reply into professional, grammatically correct British English for AA Creative Embroidery UK Ltd support chat.`,
        config: {
          systemInstruction: 'Respond in JSON with key "polishedEnglish" containing the clean professional English message, and key "isConverted" (boolean true if the input was Roman Urdu or broken English).',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              polishedEnglish: { type: Type.STRING },
              isConverted: { type: Type.BOOLEAN }
            },
            required: ['polishedEnglish', 'isConverted']
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      if (parsed.polishedEnglish) {
        return {
          polishedEnglish: parsed.polishedEnglish,
          isConverted: parsed.isConverted ?? true
        };
      }
    } catch (err: any) {
      console.error('Error polishing agent reply:', err?.message || err);
    }
  } else {
    console.warn('polishOrTranslateAgentReply: GEMINI_API_KEY is not set — using offline Roman Urdu fallback translator (lower quality than Gemini). Set GEMINI_API_KEY on this server for proper translation.');
  }

  // Safety net: never send raw, un-translated Roman Urdu to a customer just
  // because Gemini is unavailable — use the offline dictionary translator.
  const offline = offlineTranslateRomanUrduToEnglish(agentDraft);
  return { polishedEnglish: offline.englishText, isConverted: offline.isConverted };
}

export async function generateAgentReplySuggestions(
  conversationHistory: Message[],
  agentDraft?: string
): Promise<string[]> {
  if (process.env.GEMINI_API_KEY) {
    try {
      const historyStr = conversationHistory.slice(-6).map(m => `${m.senderName} (${m.senderType}): ${m.text}`).join('\n');
      const prompt = agentDraft && agentDraft.trim()
        ? `Customer Chat History:\n${historyStr}\n\nAgent Draft: "${agentDraft}"\n\nGenerate 3 polished professional British English reply options for AA Creative Embroidery UK Ltd.`
        : `Customer Chat History:\n${historyStr}\n\nGenerate 3 smart, helpful British English reply options for the support agent to send.`;

      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 professional British English response options'
              }
            },
            required: ['suggestions']
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
        return parsed.suggestions.slice(0, 3);
      }
    } catch (err) {
      console.error('Error generating AI agent suggestions:', err);
    }
  }

  return [
    "Thank you for reaching out to AA Creative Embroidery! I have reviewed your inquiry and we can process your digitizing with 2-4 hour express delivery.",
    "Our rates for left chest and cap digitizing start at £4 ($5) with Tajima DST, Brother PES, and Wilcom EMB source files included.",
    "Could you please share your design artwork and required dimensions so we can review the stitch count and send you an accurate quote?"
  ];
}
