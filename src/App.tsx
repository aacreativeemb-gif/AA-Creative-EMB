import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
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

  // Sound Notification & Real-time Live Visitor Alert State
  const prevVisitorCountRef = useRef<number | null>(null);
  const knownVisitorIdsRef = useRef<Set<string>>(new Set());
  const [liveToast, setLiveToast] = useState<{ title: string; subtitle: string; time: string; visitorId?: string } | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  // Fetch full state from backend Express server
  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();

      setProperties(data.properties || []);
      if (!selectedProperty && data.properties?.length > 0) {
        setSelectedProperty(data.properties[0]);
      }

      setUsers(data.users || []);
      if (!currentUser && data.users?.length > 0) {
        setCurrentUser(data.users[0]);
      }

      setDepartments(data.departments || []);
      
      const newVisitorsList: Visitor[] = data.visitors || [];
      
      // Sound alert trigger if new visitor arrives while admin dashboard is open
      if (prevVisitorCountRef.current !== null && newVisitorsList.length > 0) {
        const brandNewVisitor = newVisitorsList.find(v => !knownVisitorIdsRef.current.has(v.id));
        if (brandNewVisitor) {
          // Play 1-Second Ding Tone
          soundFx.playDing('visitor');
          
          // Show interactive live toast
          setLiveToast({
            title: `🔔 New Visitor Arrived on Website!`,
            subtitle: `${brandNewVisitor.name} (${brandNewVisitor.location.flag} ${brandNewVisitor.location.city}, ${brandNewVisitor.location.country}) is browsing ${brandNewVisitor.currentUrl}`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            visitorId: brandNewVisitor.id
          });
        }
      }

      // Record known IDs
      newVisitorsList.forEach(v => knownVisitorIdsRef.current.add(v.id));
      prevVisitorCountRef.current = newVisitorsList.length;

      setVisitors(newVisitorsList);
      setConversations(data.conversations || []);
      setMessages(data.messages || {});
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

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
      <Header
        properties={properties}
        selectedProperty={selectedProperty}
        onSelectProperty={p => setSelectedProperty(p)}
        currentUser={currentUser}
        users={users}
        onSelectUser={u => setCurrentUser(u)}
        onUpdateUserStatus={async (userId, status) => {
          try {
            const res = await fetch('/api/users/status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, status })
            });
            const data = await res.json();
            if (data.success) {
              fetchState();
            }
          } catch (err) {
            console.error('Failed to update status:', err);
          }
        }}
        activeTab={activeTab}
        setActiveTab={tab => setActiveTab(tab)}
        onOpenEmbedModal={() => setShowEmbedModal(true)}
        unreadCount={unreadCount}
        openTicketsCount={openTicketsCount}
        onLogout={() => {
          localStorage.removeItem('aa_admin_token');
          localStorage.removeItem('aa_admin_user');
          setIsAuthenticated(false);
          setCurrentUser(null);
        }}
      />

      <main className="flex-1">
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
            visitors={visitors}
            conversations={conversations}
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
          />
        )}
      </main>

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
                <span className="text-[10px] text-slate-400 font-mono">{liveToast.time}</span>
              </div>
              <p className="text-xs text-slate-200 mt-1 line-clamp-2 leading-relaxed">
                {liveToast.subtitle}
              </p>

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
