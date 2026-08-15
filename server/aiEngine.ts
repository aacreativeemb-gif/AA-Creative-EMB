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
}

export async function processCustomerMessageWithAI(
  conversationId: string,
  userMessageText: string,
  previousMessages: Message[]
): Promise<AiProcessResult> {
  const settings = globalStore.aiSettings;
  const lowerText = userMessageText.toLowerCase();

  // 1. Check for hard escalation keywords first
  const escalationKeywords = settings.escalationKeywords || ['agent', 'human', 'human agent', 'refund', 'complaint', 'gusa', 'manager', 'escalate', 'urgently'];
  const isExplicitHumanRequested = escalationKeywords.some(kw => lowerText.includes(kw.toLowerCase()));

  if (isExplicitHumanRequested) {
    const summary = await generateAiConversationSummary(userMessageText, previousMessages, 'Customer explicitly requested human agent assistance.');
    const whatsappInfo = settings.whatsappFallbackNumber || '+44 7462 23 8732';
    const emailInfo = settings.fallbackEmail || 'admin@aacreativeemb.com';

    return {
      aiResponseText: `Certainly! I am transferring your conversation to one of our senior UK digitizing specialists. An agent will connect with you shortly.\n\n⚡ For urgent orders or 5-minute response, feel free to contact us on WhatsApp (${whatsappInfo}) or email (${emailInfo})!`,
      confidenceScore: 95,
      shouldEscalate: true,
      escalationReason: "Customer requested human support agent ('" + userMessageText + "').",
      languageDetected: detectLanguage(userMessageText),
      isHumanRequested: true,
      aiSummary: summary
    };
  }

  // 2. Call Gemini model gemini-3.6-flash for intelligent response + confidence scoring
  if (!process.env.GEMINI_API_KEY) {
    // Fallback if API key not injected in environment
    return getFallbackAiResponse(userMessageText, previousMessages);
  }

  try {
    const systemPrompt = `You are '${settings.aiName}', an expert customer support AI agent for '${settings.businessName}'.
BUSINESS KNOWLEDGE & POLICIES:
- Description: ${settings.description}
- Products & Pricing: ${settings.productsAndServices}
- Pricing & Taxes: ${settings.pricingInfo}
- FAQs: ${settings.faqsText}
- Return & Refund Policy: ${settings.returnRefundPolicy}
- Shipping Info: ${settings.shippingInfo}
- Business Hours: ${settings.workingHours}
- Contact Info: ${settings.contactInfo}
- Custom Instructions: ${settings.customInstructions}

STRICT SAFETY & BEHAVIOR RULES:
1. Speak naturally, politely, and helpfully.
2. Automatically detect language. If user speaks Urdu, English, or Roman Urdu (e.g. "apka parcel kab tak pohanchy ga?"), respond in that EXACT same language/script style!
3. NEVER fabricate prices, fake order statuses, or unapproved refund promises.
4. If asked about a specific Order ID (e.g. #12345), acknowledge it politely and explain the delivery timeline based on shipping rules.
5. If you do not have enough info or confidence is low, set shouldEscalate: true and offer to connect to a human agent.
6. Calculate a confidence score between 0 and 100 based on how accurately the question is answered by the business knowledge.

Respond STRICTLY in JSON format matching the schema provided.`;

    const formattedHistory = previousMessages.slice(-6).map(m => `${m.senderName} (${m.senderType}): ${m.text}`).join('\n');

    const prompt = `Conversation History:\n${formattedHistory}\n\nLatest Customer Message: "${userMessageText}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            responseText: {
              type: Type.STRING,
              description: 'The natural customer support response to send to the visitor.'
            },
            confidenceScore: {
              type: Type.NUMBER,
              description: 'Confidence score from 0 to 100.'
            },
            shouldEscalate: {
              type: Type.BOOLEAN,
              description: 'Set true if user is angry, issue is complex, or confidence < 50.'
            },
            escalationReason: {
              type: Type.STRING,
              description: 'Reason for escalation if applicable.'
            },
            languageDetected: {
              type: Type.STRING,
              description: 'Detected language e.g. English, Roman Urdu, Urdu.'
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
          required: ['responseText', 'confidenceScore', 'shouldEscalate', 'languageDetected', 'customerSentiment', 'extractedIntent']
        }
      }
    });

    const jsonText = response.text || '{}';
    const parsed = JSON.parse(jsonText);

    const confidenceScore = parsed.confidenceScore ?? 85;
    const shouldEscalate = parsed.shouldEscalate || confidenceScore < settings.confidenceThreshold;
    const languageDetected = parsed.languageDetected || detectLanguage(userMessageText);

    let summary: AiSummary | undefined = undefined;
    if (shouldEscalate) {
      summary = {
        sentiment: parsed.customerSentiment || 'neutral',
        summary: `Customer intent: ${parsed.extractedIntent}. Message: "${userMessageText}"`,
        extractedIntent: parsed.extractedIntent || 'General Inquiry',
        confidenceScore: confidenceScore,
        recommendedAction: 'Provide human assistance or check order/policy details.',
        escalationReason: parsed.escalationReason || (confidenceScore < settings.confidenceThreshold ? 'Low AI confidence score.' : 'Complex customer query.')
      };
    }

    return {
      aiResponseText: parsed.responseText || "Thank you for reaching out! How else can I assist you?",
      confidenceScore,
      shouldEscalate,
      escalationReason: parsed.escalationReason,
      languageDetected,
      isHumanRequested: false,
      aiSummary: summary
    };
  } catch (error) {
    console.error('Error executing Gemini AI response:', error);
    return getFallbackAiResponse(userMessageText, previousMessages);
  }
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
        model: 'gemini-3.6-flash',
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
  const lower = userMessageText.toLowerCase();
  const lang = detectLanguage(userMessageText);

  let resp = "Thank you for contacting AA Creative Embroidery UK Ltd! Our AI digitizing assistant is checking your inquiry.";

  if (lower.includes('quote') || lower.includes('price') || lower.includes('cost') || lower.includes('rate')) {
    resp = "Our standard digitizing rates start from £4 to £8 ($5-$10) for left chest and cap logos with 2-6 hour express turnaround. Send your logo image to admin@aacreativeemb.com or WhatsApp (+44 7462 23 8732) for an instant quote!";
  } else if (lower.includes('format') || lower.includes('dst') || lower.includes('pes') || lower.includes('emb')) {
    resp = "We deliver Tajima (DST), Brother (PES), Wilcom (EMB source file), Melco (EXP/CND), Janome (JEF), Husqvarna (HUS), and Vector (AI, EPS, SVG, PDF) files with full PDF stitch-out proof sheets!";
  } else if (lower.includes('turnaround') || lower.includes('time') || lower.includes('fast') || lower.includes('rush')) {
    resp = "Standard digitizing delivery is 6 to 12 hours. Express rush delivery is available in 2 to 4 hours!";
  }

  return {
    aiResponseText: resp,
    confidenceScore: 85,
    shouldEscalate: false,
    languageDetected: lang,
    isHumanRequested: false
  };
}

export async function translateTextToRomanUrdu(text: string): Promise<string> {
  if (!text || text.trim().length === 0) return '';
  if (process.env.GEMINI_API_KEY) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
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
        model: 'gemini-3.6-flash',
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
        model: 'gemini-3.6-flash',
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
    "For urgent machine production, please upload your artwork or contact us on WhatsApp (+44 7462 23 8732) for immediate assistance!"
  ];
}
