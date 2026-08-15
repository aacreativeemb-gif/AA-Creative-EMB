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
  };
}

export async function processCustomerMessageWithAI(
  conversationId: string,
  userMessageText: string,
  previousMessages: Message[]
): Promise<AiProcessResult> {
  const settings = globalStore.aiSettings;
  const lowerText = userMessageText.toLowerCase().trim();

  // Extract potential phone or email from message
  const emailMatch = userMessageText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = userMessageText.match(/(?:\+?\d{1,4}[\s-]?)?\(?\d{2,5}\)?[\s-]?\d{3,5}[\s-]?\d{3,5}/);
  const orderMatch = userMessageText.match(/(?:order\s*(?:#|no\.?|num\.?|number)?\s*[:=]?\s*([0-9a-zA-Z-]+))/i);

  // Check online agents
  const onlineAgents = globalStore.users.filter(u => u.status === 'online');
  const isAnyAgentOnline = onlineAgents.length > 0;

  // 1. Check for hard escalation keywords or explicit ticket request
  const escalationKeywords = settings.escalationKeywords || ['agent', 'human', 'human agent', 'refund', 'complaint', 'manager', 'escalate', 'urgently', 'ticket', 'genrate ticket', 'generate ticket', 'live support', 'technical support'];
  const isExplicitHumanRequested = escalationKeywords.some(kw => lowerText.includes(kw.toLowerCase()));

  // Check if this is an order status query (e.g. "status of order", "order number3542", "track order")
  const isOrderQuery = lowerText.includes('order') || lowerText.includes('staus') || lowerText.includes('status') || lowerText.includes('track') || lowerText.includes('digitizing order') || lowerText.includes('vector order') || !!orderMatch;

  if (isExplicitHumanRequested || (isOrderQuery && (lowerText.includes('number') || lowerText.includes('#') || /\d{3,}/.test(lowerText)))) {
    const summary = await generateAiConversationSummary(userMessageText, previousMessages, isOrderQuery ? 'Customer inquiring about order status.' : 'Customer requested human/technical agent support.');
    
    let responseText = '';
    if (isAnyAgentOnline) {
      responseText = `Certainly! I am transferring your request to our online technical support specialist. An agent will connect with you in this chat momentarily.`;
    } else {
      responseText = `Our live technical support agent is currently busy assisting other clients. We have generated a support ticket for your inquiry and notified our administration team. Our admin will personally review your request and contact you as soon as possible (ASAP).`;
    }

    return {
      aiResponseText: responseText,
      confidenceScore: 95,
      shouldEscalate: true,
      escalationReason: isAnyAgentOnline 
        ? "Customer requested live agent support." 
        : "Customer requested live support/order status, but agents are busy/offline. Support ticket auto-generated.",
      languageDetected: 'English',
      isHumanRequested: isExplicitHumanRequested,
      aiSummary: summary,
      extractedDetails: {
        orderNumber: orderMatch ? orderMatch[1] : undefined,
        projectType: lowerText.includes('vector') ? 'vector' : lowerText.includes('digitiz') ? 'digitizing' : undefined,
        email: emailMatch ? emailMatch[0] : undefined,
        phone: phoneMatch ? phoneMatch[0] : undefined
      }
    };
  }

  // 2. Call Gemini model gemini-2.5-flash for intelligent response + confidence scoring
  if (process.env.GEMINI_API_KEY) {
    try {
      const systemPrompt = `You are a professional, friendly, and expert customer support specialist at '${settings.businessName}' (AA Creative Embroidery UK).
CRITICAL DIRECTIVES:
1. ALWAYS speak to the customer strictly as a real customer service executive / digitizing specialist in professional UK/US English.
2. NEVER speak or reply in Urdu or Roman Urdu to the customer. All customer responses MUST be in English.
3. NEVER say "I am an AI", "As an AI model", "I am a bot". Use "I", "we", "our team", and "our production digitizers".
4. When a customer asks about their order status or a specific project:
   - Ask clarifying details if not provided (e.g. whether it is an Embroidery Digitizing or Vector Art order).
   - If they need administrative verification or live human help and no agent is online, escalate so the system auto-generates a ticket.
5. For price quotes, guide them to upload their design artwork directly in chat, or email admin@aacreativeemb.com, or WhatsApp (+44 7462 23 8732).

BUSINESS KNOWLEDGE:
- Description: ${settings.description}
- Products & Pricing: ${settings.productsAndServices}
- Pricing & Taxes: ${settings.pricingInfo}
- FAQs: ${settings.faqsText}
- Return & Refund Policy: ${settings.returnRefundPolicy}
- Turnaround: 2-6 hours standard, 2-hour express rush available.
- Contact: admin@aacreativeemb.com, +44 7462 23 8732

Respond STRICTLY in JSON format matching the schema provided.`;

      const formattedHistory = previousMessages.slice(-6).map(m => `${m.senderName} (${m.senderType}): ${m.text}`).join('\n');
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
                description: 'The natural customer support response to send to the visitor in English.'
              },
              confidenceScore: {
                type: Type.NUMBER,
                description: 'Confidence score from 0 to 100.'
              },
              shouldEscalate: {
                type: Type.BOOLEAN,
                description: 'Set true if user asks for human, order tracking, complaint, or complex issue.'
              },
              escalationReason: {
                type: Type.STRING,
                description: 'Reason for escalation if applicable.'
              },
              customerSentiment: {
                type: Type.STRING,
                description: 'positive, neutral, frustrated, or angry.'
              },
              extractedIntent: {
                type: Type.STRING,
                description: 'Short summary of intent e.g. Order Tracking.'
              }
            },
            required: ['responseText', 'confidenceScore', 'shouldEscalate', 'customerSentiment', 'extractedIntent']
          }
        }
      });

      const jsonText = response.text || '{}';
      const parsed = JSON.parse(jsonText);

      const confidenceScore = parsed.confidenceScore ?? 85;
      const shouldEscalate = parsed.shouldEscalate || confidenceScore < settings.confidenceThreshold;

      let summary: AiSummary | undefined = undefined;
      if (shouldEscalate) {
        summary = {
          sentiment: parsed.customerSentiment || 'neutral',
          summary: `Customer intent: ${parsed.extractedIntent}. Message: "${userMessageText}"`,
          extractedIntent: parsed.extractedIntent || 'General Inquiry',
          confidenceScore: confidenceScore,
          recommendedAction: 'Review order details and contact customer.',
          escalationReason: parsed.escalationReason || (confidenceScore < settings.confidenceThreshold ? 'Low AI confidence score.' : 'Customer query.')
        };
      }

      return {
        aiResponseText: parsed.responseText || "Thank you for reaching out to AA Creative Embroidery! How can I help with your digitizing or vector project?",
        confidenceScore,
        shouldEscalate,
        escalationReason: parsed.escalationReason,
        languageDetected: 'English',
        isHumanRequested: false,
        aiSummary: summary,
        extractedDetails: {
          orderNumber: orderMatch ? orderMatch[1] : undefined,
          projectType: lowerText.includes('vector') ? 'vector' : lowerText.includes('digitiz') ? 'digitizing' : undefined,
          email: emailMatch ? emailMatch[0] : undefined,
          phone: phoneMatch ? phoneMatch[0] : undefined
        }
      };
    } catch (error) {
      console.error('Error executing Gemini AI response:', error);
    }
  }

  // Smart fallback if API key not available
  return getFallbackAiResponse(userMessageText, previousMessages);
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

function getFallbackAiResponse(userMessageText: string, previousMessages: Message[]): AiProcessResult {
  const lower = userMessageText.toLowerCase().trim();
  const onlineAgents = globalStore.users.filter(u => u.status === 'online');
  const isAnyAgentOnline = onlineAgents.length > 0;

  const emailMatch = userMessageText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = userMessageText.match(/(?:\+?\d{1,4}[\s-]?)?\(?\d{2,5}\)?[\s-]?\d{3,5}[\s-]?\d{3,5}/);
  const orderMatch = userMessageText.match(/(?:order\s*(?:#|no\.?|num\.?|number)?\s*[:=]?\s*([0-9a-zA-Z-]+))/i);

  // 1. Order status / Order inquiry detection
  if (lower.includes('order') || lower.includes('staus') || lower.includes('status') || lower.includes('track') || lower.includes('3541') || lower.includes('3542') || !!orderMatch) {
    let orderNumber = orderMatch ? orderMatch[1] : (userMessageText.match(/\d{3,}/)?.[0] || 'your order');
    let projectType = lower.includes('vector') ? 'Vector Art' : lower.includes('digitiz') ? 'Embroidery Digitizing' : 'Digitizing/Vector';

    if (isAnyAgentOnline) {
      return {
        aiResponseText: `I see you are inquiring about ${projectType} order #${orderNumber}. Let me switch you directly to our online technical support specialist now to check your production status.`,
        confidenceScore: 95,
        shouldEscalate: true,
        escalationReason: `Customer asking about ${projectType} order #${orderNumber}. Online agent available.`,
        languageDetected: 'English',
        isHumanRequested: true,
        extractedDetails: {
          orderNumber: orderNumber,
          projectType: lower.includes('vector') ? 'vector' : 'digitizing',
          email: emailMatch ? emailMatch[0] : undefined,
          phone: phoneMatch ? phoneMatch[0] : undefined
        }
      };
    } else {
      return {
        aiResponseText: `Our live technical support agent is currently busy assisting other clients. We have generated a support ticket for your inquiry regarding ${projectType} order #${orderNumber} and notified our administration team. Our admin will personally review your request and contact you as soon as possible (ASAP). Please make sure to leave your email or phone number if you haven't already.`,
        confidenceScore: 95,
        shouldEscalate: true,
        escalationReason: `Customer inquiring about order #${orderNumber}. Live agents busy/offline, auto-ticket generated.`,
        languageDetected: 'English',
        isHumanRequested: true,
        extractedDetails: {
          orderNumber: orderNumber,
          projectType: lower.includes('vector') ? 'vector' : 'digitizing',
          email: emailMatch ? emailMatch[0] : undefined,
          phone: phoneMatch ? phoneMatch[0] : undefined
        }
      };
    }
  }

  // 2. Pricing and Quote inquiries
  if (lower.includes('quote') || lower.includes('price') || lower.includes('cost') || lower.includes('rate') || lower.includes('how much')) {
    return {
      aiResponseText: "Our standard embroidery digitizing rates start from £4 / $5 for cap and left chest logos with 2-6 hour express turnaround. Vector art conversions start from £5 / $7. You can upload your design directly in this chat, or email admin@aacreativeemb.com / WhatsApp (+44 7462 23 8732) for an instant quote!",
      confidenceScore: 95,
      shouldEscalate: false,
      languageDetected: 'English',
      isHumanRequested: false
    };
  }

  // 3. File formats
  if (lower.includes('format') || lower.includes('dst') || lower.includes('pes') || lower.includes('emb') || lower.includes('exp') || lower.includes('jef') || lower.includes('vector') || lower.includes('eps') || lower.includes('ai') || lower.includes('svg')) {
    return {
      aiResponseText: "We provide all industry standard embroidery formats including Tajima DST, Brother PES, Wilcom EMB source files, Melco EXP, Janome JEF, and high-res vector files (AI, EPS, SVG, PDF) with a comprehensive stitch proof PDF sheet!",
      confidenceScore: 95,
      shouldEscalate: false,
      languageDetected: 'English',
      isHumanRequested: false
    };
  }

  // 4. Turnaround time
  if (lower.includes('turnaround') || lower.includes('time') || lower.includes('fast') || lower.includes('rush') || lower.includes('delivery') || lower.includes('how long')) {
    return {
      aiResponseText: "Our standard turnaround time is 2 to 6 hours. We also offer 2-hour super rush express delivery with no extra quality compromise!",
      confidenceScore: 95,
      shouldEscalate: false,
      languageDetected: 'English',
      isHumanRequested: false
    };
  }

  // 5. General greetings or help
  if (lower.includes('hi') || lower.includes('hello') || lower.includes('hey') || lower.includes('good morning') || lower.includes('good afternoon') || lower.includes('help')) {
    return {
      aiResponseText: "Hello! Welcome to AA Creative Embroidery. Which project can we assist you with today — Embroidery Digitizing or Vector Art Conversion?",
      confidenceScore: 90,
      shouldEscalate: false,
      languageDetected: 'English',
      isHumanRequested: false
    };
  }

  // Default helpful response
  return {
    aiResponseText: "Thank you for reaching out to AA Creative Embroidery! Are you looking for Embroidery Digitizing (DST, PES, EMB) or Vector Art Conversion (AI, EPS, SVG)? Let us know how we can help!",
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
