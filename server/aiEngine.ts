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
  extractedDetails?: {
    orderNumber?: string;
    projectType?: 'digitizing' | 'vector' | 'other';
    email?: string;
    phone?: string;
    name?: string;
  };
}

export async function processCustomerMessageWithAI(
  conversationId: string,
  userMessageText: string,
  previousMessages: Message[],
  visitorName?: string,
  visitorEmail?: string
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

  // 2. Call Gemini model gemini-2.5-flash for intelligent conversational support & lead qualification
  if (process.env.GEMINI_API_KEY) {
    try {
      const systemPrompt = `You are a professional, polite, and expert customer support specialist at '${settings.businessName}' (AA Creative Embroidery UK).

CRITICAL INTERACTION FLOW:
1. GREETING & PROJECT INQUIRY:
   - When a visitor first starts chatting (greeting / hello / new query), warmly welcome them:
     "Hello! Welcome to AA Creative Embroidery. Which project can we assist you with today — Embroidery Digitizing or Vector Art Conversion?"
2. POLITE LEAD QUALIFICATION (ASK NAME & EMAIL):
   - When the customer explains what project or question they have, answer/acknowledge their project politely and then warmly ask for their Name and Email address so we can save their details and send them proof/quote updates:
     "May I know your name and email address so we can save your project details and send you your quote/updates directly?"
3. TICKET CREATION & ESCALATION:
   - When a customer asks about an order status (e.g. order #3541), has an urgent technical problem, requests a human agent, asks for a refund/change, or provides their issue:
     - Set "shouldEscalate": true
     - Set "requiresTicket": true
     - Set "problemSummary": clear, comprehensive description of the customer's problem/request
     - In "responseText", address them by name (if known), inform them that Support Ticket {{TICKET_NUMBER}} has been created, our administration team has been notified via email (aacreativeemb@gmail.com), and an automated confirmation email has been dispatched to their email address with full ticket details.

GENERAL RULES:
- ALWAYS speak in professional UK/US English.
- NEVER speak or reply in Urdu/Roman Urdu to the customer. All customer responses MUST be in English.
- NEVER say "I am an AI", "As an AI model", or "I am a bot". Use "I", "we", "our team", and "our production digitizers".
- Extract any email, phone, name, or order number provided in the chat into the schema.

BUSINESS KNOWLEDGE:
- Description: ${settings.description}
- Products & Pricing: ${settings.productsAndServices}
- Pricing: Cap & Left chest digitizing from £4 / $5 (2-6 hour express). Vector art from £5 / $7.
- Turnaround: 2-6 hours standard, 2-hour super rush express available. Formats: DST, PES, EMB, EXP, JEF, Vector AI, EPS, SVG, PDF.
- Admin Email: aacreativeemb@gmail.com, Phone/WhatsApp: +44 7462 23 8732

Current Customer Info:
- Known Name: ${isGuestName ? 'Unknown' : visitorName}
- Known Email: ${isGuestEmail ? 'Unknown' : visitorEmail}
- Messages Exchanged: ${visitorMessagesCount}

Respond STRICTLY in JSON format matching the schema provided.`;

      const formattedHistory = previousMessages.slice(-8).map(m => `${m.senderName} (${m.senderType}): ${m.text}`).join('\n');
      const prompt = `Conversation History:\n${formattedHistory}\n\nLatest Customer Message: "${userMessageText}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
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
        aiResponseText: parsed.responseText || "Thank you for reaching out to AA Creative Embroidery! How can we assist you with your digitizing or vector artwork today?",
        confidenceScore,
        shouldEscalate,
        requiresTicket,
        problemSummary: parsed.problemSummary || `Customer inquiry: "${userMessageText}"`,
        escalationReason: parsed.escalationReason,
        languageDetected: 'English',
        isHumanRequested: false,
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
  return getFallbackAiResponse(userMessageText, previousMessages, visitorName, visitorEmail);
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
        model: 'gemini-2.5-flash',
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
  visitorEmail?: string
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
      aiResponseText: `Our standard embroidery digitizing rates start from £4 / $5 for cap and left chest logos with 2-6 hour express turnaround. Vector art conversions start from £5 / $7 with Tajima DST, PES, EMB, and vector AI/EPS formats included.${askContact}`,
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

export async function translateTextToRomanUrdu(text: string): Promise<string> {
  if (!text || text.trim().length === 0) return '';
  if (process.env.GEMINI_API_KEY) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Translate the following customer message into natural, easy-to-read Roman Urdu (Urdu written in Latin alphabet). Keep embroidery terms intact (DST, PES, EMB, 3D puff, cap, vector, quote, rate, turnaround).
Message to translate: "${text}"`,
        config: {
          systemInstruction: 'You are an English to Roman Urdu translator for a customer support admin dashboard. Respond with ONLY the translated Roman Urdu text without quotes.',
        }
      });
      return response.text?.trim() || text;
    } catch (err) {
      console.error('Error translating to Roman Urdu:', err);
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
        model: 'gemini-2.5-flash',
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
    } catch (err) {
      console.error('Error polishing agent reply:', err);
    }
  }

  return { polishedEnglish: agentDraft, isConverted: false };
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
        model: 'gemini-2.5-flash',
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
