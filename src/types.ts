export type ChannelType = 'website' | 'gmail' | 'whatsapp' | 'ticket';
export type PriorityType = 'low' | 'normal' | 'high' | 'urgent';
export type ConversationStatus = 'queue' | 'open' | 'pending' | 'escalated' | 'resolved' | 'closed';
export type TicketStatus = 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';
export type UserRole = 'superadmin' | 'admin' | 'supervisor' | 'agent' | 'viewer';
export type AgentStatus = 'online' | 'away' | 'offline';
export type AiMode = 'ai_first' | 'human_first' | 'ai_only' | 'human_only' | 'outside_hours_only';
export type AiPersonality = 'professional' | 'friendly' | 'formal' | 'casual' | 'sales' | 'technical';

export interface Property {
  id: string;
  name: string;
  domain: string;
  primaryColor: string;
  greeting: string;
  requirePreChat: boolean;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  status: AgentStatus;
  departmentIds: string[];
  capacity: number;
  activeChatsCount: number;
  passwordHash?: string;
  userId?: string;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  assignedAgentIds: string[];
}

export interface Visitor {
  id: string;
  propertyId: string;
  name: string;
  email: string;
  phone?: string;
  ip: string;
  location: {
    country: string;
    city: string;
    flag: string;
  };
  browser: string;
  os: string;
  device: string;
  currentUrl: string;
  landingPage: string;
  referrer: string;
  visitsCount: number;
  pagesViewed: number;
  timeOnSiteSeconds: number;
  status: 'online' | 'idle' | 'offline';
  lastActiveAt: string;
  tags: string[];
  notes: string[];
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'document' | 'file';
  size: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderType: 'visitor' | 'agent' | 'ai' | 'system';
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  timestamp: string;
  deliveryStatus: 'sent' | 'delivered' | 'read';
  channel: ChannelType;
  attachments?: Attachment[];
  confidenceScore?: number;
  languageDetected?: string;
  isEscalationTrigger?: boolean;
  translatedRomanUrdu?: string;
  translatedEnglish?: string;
  originalText?: string;
  isPolishedByAi?: boolean;
}

export interface AiSummary {
  sentiment: 'positive' | 'neutral' | 'frustrated' | 'angry';
  summary: string;
  extractedIntent: string;
  confidenceScore: number;
  recommendedAction: string;
  escalationReason?: string;
  extractedDetails?: {
    orderId?: string;
    productName?: string;
    contactPreferred?: string;
  };
}

export interface Conversation {
  id: string;
  propertyId: string;
  visitorId: string;
  channel: ChannelType;
  departmentId?: string;
  assignedAgentId?: string | null;
  isAiHandling: boolean;
  status: ConversationStatus;
  priority: PriorityType;
  subject: string;
  lastMessageText: string;
  lastMessageAt: string;
  unreadCountAgent: number;
  unreadCountVisitor: number;
  rating?: number;
  feedback?: string;
  aiSummary?: AiSummary;
  sourceDetail?: string; // e.g., "From: customer@gmail.com" or "+92 300 1234567"
  queuePosition?: number;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  conversationId?: string;
  visitorId: string;
  visitorName: string;
  visitorEmail: string;
  subject: string;
  description: string;
  priority: PriorityType;
  status: TicketStatus;
  departmentId: string;
  assignedAgentId?: string;
  createdAt: string;
  updatedAt: string;
  slaDueDate: string;
  slaBreached: boolean;
  source: ChannelType;
  tags: string[];
}

export interface KbCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface KbArticle {
  id: string;
  title: string;
  categoryId: string;
  content: string;
  tags: string[];
  status: 'draft' | 'published';
  views: number;
  helpfulCount: number;
  createdAt: string;
}

export interface AiSettings {
  businessName: string;
  description: string;
  productsAndServices: string;
  pricingInfo: string;
  faqsText: string;
  returnRefundPolicy: string;
  shippingInfo: string;
  workingHours: string;
  contactInfo: string;
  customInstructions: string;
  confidenceThreshold: number; // e.g. 80
  personality: AiPersonality;
  mode: AiMode;
  escalationKeywords: string[];
  autoLanguageDetect: boolean;
  maxUnansweredAttempts: number;
  customGreeting: string;
  aiName: string;
  humanHandoffEnabled: boolean;
  enabledChannels: {
    website: boolean;
    gmail: boolean;
    whatsapp: boolean;
  };
  enableRomanUrduAdminTranslation?: boolean;
  enableAgentAutoEnglishTranslation?: boolean;
  whatsappFallbackNumber?: string;
  fallbackEmail?: string;
}

export interface AiQcFeedback {
  id: string;
  conversationId: string;
  messageId: string;
  query: string;
  aiResponse: string;
  rating: 'good' | 'bad';
  notes?: string;
  timestamp: string;
}

export interface UnansweredQuestion {
  id: string;
  query: string;
  count: number;
  lastAskedAt: string;
  status: 'pending' | 'resolved';
}

export interface TriggerRule {
  id: string;
  name: string;
  enabled: boolean;
  conditionType: 'time_on_page' | 'keyword_match' | 'urgent_priority' | 'sla_timeout';
  conditionValue: string;
  actionType: 'show_greeting' | 'mark_urgent' | 'notify_supervisor' | 'send_email';
  actionValue: string;
}

export interface CannedResponse {
  id: string;
  shortcut: string; // e.g. "/hello"
  title: string;
  content: string;
  isGlobal: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  action: string;
  details: string;
}

export interface PlatformAnalytics {
  totalChats: number;
  answeredChats: number;
  missedChats: number;
  aiResolvedCount: number;
  humanHandoffCount: number;
  avgResponseTimeSeconds: number;
  avgResolutionTimeMinutes: number;
  csatPercentage: number;
  activeVisitorsCount: number;
  openTicketsCount: number;
  slaBreachedCount: number;
  channelBreakdown: {
    website: number;
    gmail: number;
    whatsapp: number;
    ticket: number;
  };
}
