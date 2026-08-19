import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { VisitorWidget } from './components/VisitorWidget';
import { UnifiedInbox } from './components/UnifiedInbox';
import { VisitorTracker } from './components/VisitorTracker';
import { AiAdminPanel } from './components/AiAdminPanel';
import { TicketingView } from './components/TicketingView';
import { IntegrationsView } from './components/IntegrationsView';
import { AutomationsView } from './components/AutomationsView';
import { KnowledgeBaseView } from './components/KnowledgeBaseView';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsView } from './components/SettingsView';
import { WidgetEmbedModal } from './components/WidgetEmbedModal';
import { AdminAuth } from './components/AdminAuth';
import { soundFx } from './utils/audio';
import { Bell, Volume2, X, Users, MessageSquare } from 'lucide-react';

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
} from './types';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem('aa_admin_token');
  });
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('aa_admin_user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [activeConversationId, setActiveConversationId] = useState<string>('conv_1');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [kbCategories, setKbCategories] = useState<KbCategory[]>([]);
  const [kbArticles, setKbArticles] = useState<KbArticle[]>([]);
  const [aiSettings, setAiSettings] = useState<AiSettings | null>(null);
  const [qcFeedbacks, setQcFeedbacks] = useState<AiQcFeedback[]>([]);
  const [unansweredQuestions, setUnansweredQuestions] = useState<UnansweredQuestion[]>([]);
  const [triggers, setTriggers] = useState<TriggerRule[]>([]);
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);

  const [activeTab, setActiveTab] = useState<string>('widget_testbench');
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Sound Notification & Real-time Live Visitor Alert State
  const prevVisitorCountRef = useRef<number | null>(null);
  const knownVisitorIdsRef = useRef<Set<string>>(new Set());
  const [liveToast, setLiveToast] = useState<{
    title: string;
    subtitle: string;
    time: string;
    date: string;
    ip: string;
    isNew: boolean;
    visitorId?: string;
  } | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(soundFx.isAudioMuted);
  const toggleAudioMute = () => {
    soundFx.isAudioMuted = !soundFx.isAudioMuted;
    if (soundFx.isAudioMuted) soundFx.stopRinging();
    setIsAudioMuted(soundFx.isAudioMuted);
  };

  // Tracks every message ID we've already seen, so we only ring the 10s bell
  // for genuinely NEW visitor messages (not on first load / page refresh).
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedMessagesOnceRef = useRef(false);
  const currentUserRef = useRef<User | null>(null);
  currentUserRef.current = currentUser;
  const selectedPropertyRef = useRef<Property | null>(null);
  selectedPropertyRef.current = selectedProperty;

  // Fetch full state from backend Express server
  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();

      setProperties(data.properties || []);
      if (!selectedPropertyRef.current && data.properties?.length > 0) {
        setSelectedProperty(data.properties[0]);
      }

      setUsers(data.users || []);
      // Keep the logged-in / selected agent's data (esp. online/away/offline
      // status) in sync with the backend on every poll, instead of only
      // setting it once — otherwise a status change or manually switching to
      // a non-default agent gets silently reverted back to the first agent
      // on the very next 4s refresh.
      if (data.users?.length > 0) {
        const cu = currentUserRef.current;
        if (cu) {
          const fresh = data.users.find((u: User) => u.id === cu.id);
          if (fresh) {
            setCurrentUser(fresh);
            localStorage.setItem('aa_admin_user', JSON.stringify(fresh));
          }
        } else {
          setCurrentUser(data.users[0]);
        }
      }

      setDepartments(data.departments || []);
      
      const newVisitorsList: Visitor[] = data.visitors || [];
      
      // Sound alert trigger if new visitor arrives while admin dashboard is open
      if (prevVisitorCountRef.current !== null && newVisitorsList.length > 0) {
        const brandNewVisitor = newVisitorsList.find(v => !knownVisitorIdsRef.current.has(v.id));
        if (brandNewVisitor) {
          // Play 1-Second Ding Tone
          soundFx.playDing('visitor');

          const arrivalDate = new Date(brandNewVisitor.sessionStartedAt || brandNewVisitor.firstSeenAt || Date.now());
          const isNewCustomer = (brandNewVisitor.visitsCount || 1) <= 1;

          // Show interactive live toast with exact date/time, IP & New/Existing badge
          setLiveToast({
            title: `🔔 New Visitor Arrived on Website!`,
            subtitle: `${brandNewVisitor.name} (${brandNewVisitor.location.flag} ${brandNewVisitor.location.city}, ${brandNewVisitor.location.country}) is browsing ${brandNewVisitor.currentUrl}`,
            time: arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            date: arrivalDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
            ip: brandNewVisitor.ip,
            isNew: isNewCustomer,
            visitorId: brandNewVisitor.id
          });
        }
      }

      // Record known IDs
      newVisitorsList.forEach(v => knownVisitorIdsRef.current.add(v.id));
      prevVisitorCountRef.current = newVisitorsList.length;

      setVisitors(newVisitorsList);
      setConversations(data.conversations || []);

      const newMessagesMap: Record<string, Message[]> = data.messages || {};

      // Sound alert for new visitor messages:
      // - The visitor's VERY FIRST message in a conversation rings the 10s
      //   bell, but only while this admin's own status is "online" (gives
      //   the human agent time to notice and get ready to reply).
      // - Every message AFTER that just plays a single 1-second ding, so the
      //   agent knows a reply/follow-up came in without the long alert.
      if (hasLoadedMessagesOnceRef.current) {
        let hasNewFirstMessage = false;
        let hasNewFollowupMessage = false;
        Object.values(newMessagesMap).forEach(msgList => {
          const visitorMsgsInConv = (msgList || []).filter(m => m.senderType === 'visitor');
          (msgList || []).forEach(m => {
            if (m.senderType !== 'visitor') return;
            if (knownMessageIdsRef.current.has(m.id)) return;
            const isFirstInConv = visitorMsgsInConv.length > 0 && visitorMsgsInConv[0].id === m.id;
            if (isFirstInConv) {
              hasNewFirstMessage = true;
            } else {
              hasNewFollowupMessage = true;
            }
          });
        });
        if (hasNewFirstMessage && currentUserRef.current?.status === 'online') {
          soundFx.ringBell('message', 10);
        } else if (hasNewFollowupMessage) {
          soundFx.playDing('message');
        }
      }
      Object.values(newMessagesMap).forEach(msgList => {
        (msgList || []).forEach(m => knownMessageIdsRef.current.add(m.id));
      });
      hasLoadedMessagesOnceRef.current = true;

      setMessages(newMessagesMap);
      setTickets(data.tickets || []);
      setKbCategories(data.kbCategories || []);
      setKbArticles(data.kbArticles || []);
      setAiSettings(data.aiSettings || null);
      setQcFeedbacks(data.qcFeedbacks || []);
      setUnansweredQuestions(data.unansweredQuestions || []);
      setTriggers(data.triggers || []);
      setCannedResponses(data.cannedResponses || []);
      setAuditLogs(data.auditLogs || []);
      setAnalytics(data.analytics || null);

      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch app state:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 4000);
    return () => clearInterval(interval);
  }, []);

  const activeConversation = conversations.find(c => c.id === activeConversationId) || conversations[0];
  const activeMessages = activeConversation ? messages[activeConversation.id] || [] : [];

  // Visitor sends message (widget)
  const handleVisitorSendMessage = async (text: string, attachments?: any[]) => {
    try {
      const res = await fetch('/api/visitor/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConversation?.id,
          visitorId: activeConversation?.visitorId,
          text,
          attachments
        })
      });
      const data = await res.json();
      if (data.success) {
        // Server started a brand-new clean chat thread (visitor's previous
        // session was closed/stale) — follow it so the testbench UI keeps
        // showing the active conversation instead of a dead one.
        if (data.newConversationId) {
          setActiveConversationId(data.newConversationId);
        }
        fetchState();
      }
    } catch (e) {
      console.error('Error sending visitor message:', e);
    }
  };

  // Agent sends message (inbox)
  const handleAgentSendMessage = async (text: string) => {
    if (!activeConversation || !currentUser) return;
    try {
      const res = await fetch('/api/agent/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConversation.id,
          agentId: currentUser.id,
          text
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchState();
      }
    } catch (e) {
      console.error('Error sending agent message:', e);
    }
  };

  // Toggle AI handling vs Agent
  const handleToggleAi = async (isAiHandling: boolean) => {
    if (!activeConversation) return;
    try {
      const res = await fetch('/api/conversations/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConversation.id,
          isAiHandling
        })
      });
      const data = await res.json();
      if (data.success) fetchState();
    } catch (e) {
      console.error('Error toggling AI mode:', e);
    }
  };

  // Close / Resolve Chat
  const handleCloseChat = async (visitorIdOrConvId: string) => {
    try {
      let convId = visitorIdOrConvId;
      const conv = conversations.find(c => c.visitorId === visitorIdOrConvId || c.id === visitorIdOrConvId);
      if (conv) convId = conv.id;

      await fetch('/api/conversations/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: convId,
          status: 'resolved'
        })
      });
      fetchState();
    } catch (e) {
      console.error('Error closing chat:', e);
    }
  };

  // Escalate conversation
  const handleEscalate = async () => {
    if (!activeConversation) return;
    try {
      const res = await fetch('/api/conversations/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConversation.id,
          isAiHandling: false
        })
      });
      await fetch('/api/conversations/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConversation.id,
          status: 'escalated',
          priority: 'urgent'
        })
      });
      fetchState();
    } catch (e) {
      console.error('Error escalating conversation:', e);
    }
  };

  // Create ticket
  const handleCreateTicket = async (ticketData: Partial<Ticket>) => {
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketData)
      });
      const data = await res.json();
      if (data.success) fetchState();
    } catch (e) {
      console.error('Error creating ticket:', e);
    }
  };

  // Save AI Settings
  const handleSaveAiSettings = async (settingsUpdate: Partial<AiSettings>) => {
    try {
      const res = await fetch('/api/ai/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsUpdate)
      });
      const data = await res.json();
      if (data.success) fetchState();
    } catch (e) {
      console.error('Error updating AI settings:', e);
    }
  };

  // Simulate Gmail incoming
  const handleSimulateGmail = async (fromEmail: string, fromName: string, subject: string, body: string) => {
    try {
      const res = await fetch('/api/gmail/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromEmail, fromName, subject, body })
      });
      const data = await res.json();
      if (data.success) {
        if (data.conversation?.id) setActiveConversationId(data.conversation.id);
        fetchState();
      }
    } catch (e) {
      console.error('Error simulating Gmail:', e);
    }
  };

  // Simulate WhatsApp incoming
  const handleSimulateWhatsApp = async (phone: string, name: string, text: string) => {
    try {
      const res = await fetch('/api/whatsapp/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, text })
      });
      const data = await res.json();
      if (data.success) {
        if (data.conversation?.id) setActiveConversationId(data.conversation.id);
        fetchState();
      }
    } catch (e) {
      console.error('Error simulating WhatsApp:', e);
    }
  };

  if (!isAuthenticated) {
    return (
      <AdminAuth
        onAuthenticated={(user) => {
          setCurrentUser(user);
          setIsAuthenticated(true);
        }}
      />
    );
  }

  if (loading || !selectedProperty || !currentUser || !aiSettings || !analytics) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-400">Loading TawkAI Platform & AI Engine...</p>
      </div>
    );
  }

  const unreadCount = conversations.reduce((acc, c) => acc + (c.unreadCountAgent || 0), 0);
  const openTicketsCount = tickets.filter(t => t.status !== 'resolved' && t.status !== 'closed').length;
  const onlineAgentCount = users.filter(u => u.status === 'online').length;

  // --- Live Visitor Tracking (today only) vs Visitor History (last 3 months) ---
  const isSameLocalDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const now = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const visitorArrival = (v: Visitor) => new Date(v.sessionStartedAt || v.firstSeenAt || v.lastActiveAt || 0);

  const todaysVisitors = visitors
    .filter(v => {
      const d = visitorArrival(v);
      return !isNaN(d.getTime()) && isSameLocalDay(d, now);
    })
    .sort((a, b) => visitorArrival(b).getTime() - visitorArrival(a).getTime());

  const historyVisitors = visitors
    .filter(v => {
      const d = visitorArrival(v);
      return !isNaN(d.getTime()) && d >= threeMonthsAgo && d <= now;
    })
    .sort((a, b) => visitorArrival(b).getTime() - visitorArrival(a).getTime());

  return (
    <div className="h-screen bg-slate-100 text-slate-800 flex flex-col font-sans overflow-hidden">
      <Header
        properties={properties}
        selectedProperty={selectedProperty}
        onSelectProperty={p => setSelectedProperty(p)}
        currentUser={currentUser}
        users={users}
        onSelectUser={u => {
          setCurrentUser(u);
          localStorage.setItem('aa_admin_user', JSON.stringify(u));
        }}
        onUpdateUserStatus={async (userId, status) => {
          try {
            const res = await fetch('/api/users/status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, status })
            });
            const data = await res.json();
            if (data.success) {
              if (data.user && currentUserRef.current?.id === userId) {
                setCurrentUser(data.user);
                localStorage.setItem('aa_admin_user', JSON.stringify(data.user));
              }
              fetchState();
            }
          } catch (err) {
            console.error('Failed to update status:', err);
          }
        }}
        onOpenEmbedModal={() => setShowEmbedModal(true)}
        isAudioMuted={isAudioMuted}
        onToggleAudioMute={toggleAudioMute}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        onLogout={() => {
          localStorage.removeItem('aa_admin_token');
          localStorage.removeItem('aa_admin_user');
          setIsAuthenticated(false);
          setCurrentUser(null);
        }}
      />

      <div className="flex flex-1 min-h-0">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={tab => setActiveTab(tab)}
          unreadCount={unreadCount}
          openTicketsCount={openTicketsCount}
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />

      <main className="flex-1 min-w-0 overflow-y-auto">
        {activeTab === 'widget_testbench' && (
          <VisitorWidget
            property={selectedProperty}
            aiSettings={aiSettings}
            activeConversation={activeConversation}
            messages={activeMessages}
            onSendMessage={handleVisitorSendMessage}
            onEscalate={handleEscalate}
            onEndChat={() => fetchState()}
            isAiHandling={activeConversation?.isAiHandling ?? true}
            onlineAgentCount={onlineAgentCount}
          />
        )}

        {activeTab === 'unified_inbox' && (
          <UnifiedInbox
            conversations={conversations}
            activeConversation={activeConversation}
            onSelectConversation={c => setActiveConversationId(c.id)}
            messages={activeMessages}
            visitors={visitors}
            cannedResponses={cannedResponses}
            currentUser={currentUser}
            onSendMessage={handleAgentSendMessage}
            onToggleAi={handleToggleAi}
            onChangeStatus={(st, pr) => {
              fetch('/api/conversations/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversationId: activeConversation?.id, status: st, priority: pr })
              }).then(() => fetchState());
            }}
            onAssignAgent={agentId => {
              fetch('/api/conversations/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversationId: activeConversation?.id, agentId })
              }).then(() => fetchState());
            }}
          />
        )}

        {activeTab === 'visitor_tracker' && (
          <VisitorTracker
            visitors={todaysVisitors}
            conversations={conversations}
            variant="live"
            onStartChatWithVisitor={vis => {
              const conv = conversations.find(c => c.visitorId === vis.id);
              if (conv) setActiveConversationId(conv.id);
              setActiveTab('unified_inbox');
            }}
            onCloseChat={handleCloseChat}
          />
        )}

        {activeTab === 'visitor_history' && (
          <VisitorTracker
            visitors={historyVisitors}
            conversations={conversations}
            variant="history"
            onStartChatWithVisitor={vis => {
              const conv = conversations.find(c => c.visitorId === vis.id);
              if (conv) setActiveConversationId(conv.id);
              setActiveTab('unified_inbox');
            }}
            onCloseChat={handleCloseChat}
          />
        )}

        {activeTab === 'ai_admin' && (
          <AiAdminPanel
            aiSettings={aiSettings}
            onSaveAiSettings={handleSaveAiSettings}
            qcFeedbacks={qcFeedbacks}
            unansweredQuestions={unansweredQuestions}
          />
        )}

        {activeTab === 'ticketing' && (
          <TicketingView
            tickets={tickets}
            agents={users}
            departments={departments}
            onCreateTicket={handleCreateTicket}
            onUpdateTicketStatus={(id, status) => {
              fetch('/api/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status })
              }).then(() => fetchState());
            }}
          />
        )}

        {activeTab === 'integrations' && (
          <IntegrationsView
            onSimulateGmail={handleSimulateGmail}
            onSimulateWhatsApp={handleSimulateWhatsApp}
          />
        )}

        {activeTab === 'automations' && (
          <AutomationsView
            triggers={triggers}
            onToggleTrigger={id => {
              setTriggers(triggers.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t));
            }}
          />
        )}

        {activeTab === 'knowledge_base' && (
          <KnowledgeBaseView
            articles={kbArticles}
            categories={kbCategories}
            onCreateArticle={(title, content, categoryId, tags) => {
              fetch('/api/kb', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create_article', article: { title, content, categoryId, tags } })
              }).then(() => fetchState());
            }}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView analytics={analytics} />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            properties={properties}
            agents={users}
            departments={departments}
            cannedResponses={cannedResponses}
            auditLogs={auditLogs}
            onOpenEmbedModal={() => setShowEmbedModal(true)}
            onAgentsChanged={fetchState}
          />
        )}
      </main>
      </div>

      {/* Floating Live Visitor Sound & Arrival Notification Toast */}
      {liveToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-slate-900 border border-blue-500/50 shadow-2xl rounded-2xl p-4 text-white animate-bounce-short">
          <div className="flex items-start justify-between gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-500/30">
              <Bell className="w-5 h-5 animate-wiggle" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm text-blue-300 flex items-center gap-1.5">
                  <span>{liveToast.title}</span>
                </p>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    liveToast.isNew ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {liveToast.isNew ? 'NEW' : 'EXISTING'}
                </span>
              </div>
              <p className="text-xs text-slate-200 mt-1 line-clamp-2 leading-relaxed">
                {liveToast.subtitle}
              </p>
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400 font-mono">
                <span>{liveToast.date} · {liveToast.time}</span>
                <span>IP: {liveToast.ip}</span>
              </div>

              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800">
                <button
                  onClick={() => {
                    setActiveTab('visitor_tracker');
                    setLiveToast(null);
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1 shadow-xs"
                >
                  <Users className="w-3.5 h-3.5" /> View Visitor
                </button>
                <button
                  onClick={() => soundFx.playDing('visitor')}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg transition flex items-center gap-1"
                  title="Test Sound Tone"
                >
                  <Volume2 className="w-3.5 h-3.5 text-blue-400" /> Ding 1s
                </button>
                <button
                  onClick={() => setLiveToast(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg ml-auto text-xs"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEmbedModal && (
        <WidgetEmbedModal
          property={selectedProperty}
          onClose={() => setShowEmbedModal(false)}
        />
      )}
    </div>
  );
}
