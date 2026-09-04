import React, { useState } from 'react';
import {
  MessageSquare,
  Mail,
  Ticket,
  Send,
  User,
  Bot,
  Sparkles,
  Phone,
  Globe,
  Clock,
  ShieldCheck,
  AlertCircle,
  Tag,
  Search,
  Zap,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Headphones,
  Paperclip,
  MoreVertical,
  ChevronRight,
  Trash2
} from 'lucide-react';
import { Conversation, Message, Visitor, CannedResponse, User as UserType } from '../types';

interface UnifiedInboxProps {
  conversations: Conversation[];
  activeConversation?: Conversation;
  onSelectConversation: (c: Conversation) => void;
  messages: Message[];
  visitors: Visitor[];
  cannedResponses: CannedResponse[];
  currentUser: UserType;
  onSendMessage: (text: string) => void;
  onToggleAi: (isAiHandling: boolean) => void;
  onChangeStatus: (status: any, priority?: any) => void;
  onAssignAgent: (agentId: string) => void;
  onDeleteConversation?: (id: string) => void;
  onClearAllChatHistory?: () => void;
}

export const UnifiedInbox: React.FC<UnifiedInboxProps> = ({
  conversations,
  activeConversation,
  onSelectConversation,
  messages,
  visitors,
  cannedResponses,
  currentUser,
  onSendMessage,
  onToggleAi,
  onChangeStatus,
  onAssignAgent,
  onDeleteConversation,
  onClearAllChatHistory
}) => {
  const [filterChannel, setFilterChannel] = useState<'live' | 'all' | 'website' | 'gmail' | 'whatsapp' | 'ticket'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [showCannedMenu, setShowCannedMenu] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [polishNotice, setPolishNotice] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleClearAll = () => {
    if (onClearAllChatHistory) onClearAllChatHistory();
    setShowClearConfirm(false);
  };

  const activeVisitor = visitors.find(v => v.id === activeConversation?.visitorId);

  const handleAiPolishOrSuggest = async () => {
    if (!activeConversation) return;
    setIsPolishing(true);
    setPolishNotice(null);
    try {
      const res = await fetch('/api/ai/suggest_reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConversation.id,
          agentDraft: inputText
        })
      });
      const data = await res.json();
      if (data.success) {
        if (inputText.trim().length > 0 && data.polishedEnglish) {
          setInputText(data.polishedEnglish);
          setPolishNotice(data.isConverted ? '✨ Roman Urdu / draft polished into professional British English!' : '✨ Polished into professional English!');
        }
        if (data.suggestions && data.suggestions.length > 0) {
          setSuggestions(data.suggestions);
          setShowSuggestions(true);
        }
      }
    } catch (e) {
      console.error('Error fetching AI suggestions:', e);
    } finally {
      setIsPolishing(false);
    }
  };

  const filteredConversations = conversations.filter(c => {
    if (filterChannel === 'live') {
      const vis = visitors.find(v => v.id === c.visitorId);
      if (!vis || vis.status !== 'online') return false;
    } else if (filterChannel !== 'all' && c.channel !== filterChannel) {
      return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        c.subject.toLowerCase().includes(query) ||
        c.lastMessageText.toLowerCase().includes(query) ||
        (c.sourceDetail && c.sourceDetail.toLowerCase().includes(query))
      );
    }
    return true;
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleInsertCanned = (canned: CannedResponse) => {
    setInputText(canned.content);
    setShowCannedMenu(false);
  };

  const getChannelBadge = (channel: string) => {
    switch (channel) {
      case 'website':
        return <span className="bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Website</span>;
      case 'gmail':
        return <span className="bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><Mail className="w-3 h-3" /> Gmail</span>;
      case 'whatsapp':
        return <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><Zap className="w-3 h-3" /> WhatsApp</span>;
      default:
        return <span className="bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><Ticket className="w-3 h-3" /> Ticket</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-120px)] min-h-[650px]">
      
      {/* 1. Conversations List Column */}
      <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl flex flex-col shadow-xs overflow-hidden">
        
        {/* Search & Channel Filter */}
        <div className="p-3 border-b border-slate-200 space-y-2.5 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search conversations, emails, WhatsApp..."
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {onClearAllChatHistory && (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                disabled={conversations.length === 0}
                title="Permanently clear all chat history"
                className="shrink-0 flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear History</span>
              </button>
            )}
          </div>

          {/* Clear-all confirmation */}
          {showClearConfirm && (
            <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-lg text-[11px] text-rose-900 space-y-2">
              <p className="font-semibold">Permanently delete ALL conversations & messages (website, Gmail, WhatsApp)? This cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-1.5 rounded-md"
                >
                  Yes, Clear Everything
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 bg-white border border-slate-300 text-slate-600 font-semibold py-1.5 rounded-md"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none text-xs">
            <button
              onClick={() => setFilterChannel('live')}
              className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition whitespace-nowrap flex items-center gap-1 ${
                filterChannel === 'live'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${filterChannel === 'live' ? 'bg-white' : 'bg-emerald-500'} ${visitors.some(v => v.status === 'online') ? 'animate-pulse' : ''}`} />
              Live Customer
              {visitors.filter(v => v.status === 'online').length > 0 && (
                <span className={`text-[9px] font-bold px-1.5 rounded-full ${filterChannel === 'live' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                  {visitors.filter(v => v.status === 'online').length}
                </span>
              )}
            </button>
            {(['all', 'website', 'gmail', 'whatsapp', 'ticket'] as const).map(ch => (
              <button
                key={ch}
                onClick={() => setFilterChannel(ch)}
                className={`px-2.5 py-1 rounded-md font-medium text-[11px] capitalize transition whitespace-nowrap ${
                  filterChannel === ch
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation Cards list */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No conversations match your filter.
            </div>
          ) : (
            filteredConversations.map(conv => {
              const isSelected = activeConversation?.id === conv.id;
              return (
                <div
                  key={conv.id}
                  onClick={() => onSelectConversation(conv)}
                  className={`p-3.5 cursor-pointer transition flex flex-col gap-1.5 ${
                    isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {getChannelBadge(conv.channel)}
                      {conv.priority === 'urgent' && (
                        <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded animate-pulse">
                          URGENT
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <h4 className="font-semibold text-slate-800 text-xs truncate">{conv.subject}</h4>
                  <p className="text-xs text-slate-500 line-clamp-1">{conv.lastMessageText}</p>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      {conv.isAiHandling ? (
                        <span className="text-blue-600 font-semibold flex items-center gap-1">
                          <Bot className="w-3 h-3" /> AI Active
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-semibold flex items-center gap-1">
                          <Headphones className="w-3 h-3" /> Agent
                        </span>
                      )}
                    </span>
                    <span className="font-medium text-slate-600">{conv.sourceDetail}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Active Chat Stream & Controls Column */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl flex flex-col shadow-xs overflow-hidden">
        {activeConversation ? (
          <>
            {/* Header / Handoff Control */}
            <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">{activeConversation.subject}</h3>
                <p className="text-[11px] text-slate-500">{activeConversation.sourceDetail}</p>
              </div>

              {/* AI Handoff & Close Chat Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onToggleAi(!activeConversation.isAiHandling)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition ${
                    activeConversation.isAiHandling
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {activeConversation.isAiHandling ? (
                    <>
                      <Bot className="w-3.5 h-3.5" />
                      <span>AI Handling (Takeover)</span>
                    </>
                  ) : (
                    <>
                      <Headphones className="w-3.5 h-3.5" />
                      <span>Agent Active (Hand to AI)</span>
                    </>
                  )}
                </button>

                {activeConversation.status !== 'resolved' ? (
                  <button
                    onClick={() => {
                      onChangeStatus('resolved');
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition shadow-2xs"
                    title="Close / Resolve this chat session"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Close Chat</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      onChangeStatus('open');
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition"
                    title="Re-open this chat session"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Re-open Chat</span>
                  </button>
                )}

                {onDeleteConversation && (
                  <button
                    onClick={() => {
                      if (window.confirm('Permanently delete this conversation and its messages? This cannot be undone.')) {
                        onDeleteConversation(activeConversation.id);
                      }
                    }}
                    title="Permanently delete this conversation"
                    className="px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-700 border border-slate-200 hover:border-rose-200 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Live Shadow Monitoring Banner */}
            {activeConversation.isAiHandling && (
              <div className="bg-blue-50 border-b border-blue-200 px-3.5 py-2 flex items-center justify-between text-xs text-blue-900 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
                  </span>
                  <span className="font-bold text-blue-950">AI First-Line Active:</span>
                  <span className="text-blue-800 text-[11px] hidden sm:inline">AI is entertaining visitor. You are observing live conversation.</span>
                </div>
                <button
                  onClick={() => onToggleAi(false)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-md shadow-2xs transition flex items-center gap-1"
                >
                  <Headphones className="w-3 h-3" /> Join Conversation
                </button>
              </div>
            )}

            {/* AI Summary Card (if handoff occurred) */}
            {activeConversation.aiSummary && (
              <div className="m-3 p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl text-xs space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between font-bold text-amber-900">
                  <span className="flex items-center gap-1.5 text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" /> AI Handoff Summary
                  </span>
                  <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded uppercase font-bold">
                    Sentiment: {activeConversation.aiSummary.sentiment}
                  </span>
                </div>
                <p className="text-amber-950 leading-relaxed">{activeConversation.aiSummary.summary}</p>
                <div className="text-[11px] text-amber-800 font-semibold border-t border-amber-200/60 pt-1 flex items-center justify-between">
                  <span>Intent: {activeConversation.aiSummary.extractedIntent}</span>
                  <span>Confidence: {activeConversation.aiSummary.confidenceScore}%</span>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
              {messages.map(msg => {
                const isVisitor = msg.senderType === 'visitor';
                const isAi = msg.senderType === 'ai';
                const isAgent = msg.senderType === 'agent';

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'} my-1`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5 px-1">
                      <span className="text-[10px] font-semibold text-slate-500">{msg.senderName}</span>
                      {isAi && <span className="text-[9px] bg-blue-100 text-blue-700 font-bold px-1 rounded">AI</span>}
                      {isAgent && <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1 rounded">Agent</span>}
                      <span className="text-[9px] text-slate-400">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div
                      className={`max-w-[85%] px-3.5 py-2 rounded-xl text-xs leading-relaxed shadow-2xs ${
                        isAgent
                          ? 'bg-emerald-700 text-white rounded-br-xs'
                          : isAi
                          ? 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                          : 'bg-blue-600 text-white rounded-bl-xs'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>

                    {/* Admin Roman Urdu Translation Card for Visitor English Messages */}
                    {isVisitor && (
                      <div className="mt-1.5 max-w-[85%] bg-amber-50/90 border border-amber-200 text-amber-950 rounded-lg p-2 text-[11px] shadow-2xs">
                        <div className="font-bold text-[10px] text-amber-800 flex items-center gap-1 mb-0.5">
                          <span>🇵🇰 Roman Urdu Admin Translation:</span>
                        </div>
                        <p className="font-mono text-amber-900 leading-snug">
                          {msg.translatedRomanUrdu || 'Translating to Roman Urdu...'}
                        </p>
                      </div>
                    )}

                    {/* Agent AI Polish Banner if agent message was converted/polished */}
                    {isAgent && msg.originalText && (
                      <div className="mt-1 text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md px-2 py-0.5 font-medium">
                        ✨ Auto-converted from agent draft: <span className="italic">"{msg.originalText}"</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* AI Suggested Options Popup */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-t border-blue-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between font-bold text-blue-900 text-[11px]">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" /> AI Recommended Responses:
                  </span>
                  <button onClick={() => setShowSuggestions(false)} className="text-slate-400 hover:text-slate-600 text-[10px]">
                    Dismiss
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  {suggestions.map((sug, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setInputText(sug);
                        setShowSuggestions(false);
                      }}
                      className="text-left bg-white hover:bg-blue-100/80 text-slate-800 p-2 rounded border border-blue-200 text-[11px] transition shadow-2xs"
                    >
                      💡 {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Polish Notice alert */}
            {polishNotice && (
              <div className="bg-emerald-50 border-t border-emerald-200 px-3 py-1.5 text-[11px] text-emerald-800 font-medium flex items-center justify-between">
                <span>{polishNotice}</span>
                <button onClick={() => setPolishNotice(null)} className="text-emerald-600 hover:text-emerald-900 font-bold">×</button>
              </div>
            )}

            {/* Canned Responses selector bar */}
            <div className="p-2 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium text-[11px]">Quick Canned Responses:</span>
              <div className="flex gap-1">
                {cannedResponses.map(cr => (
                  <button
                    key={cr.id}
                    onClick={() => handleInsertCanned(cr)}
                    className="bg-white hover:bg-blue-50 text-slate-700 border border-slate-300 font-mono text-[10px] px-2 py-0.5 rounded shadow-2xs transition"
                  >
                    {cr.shortcut}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Reply in Roman Urdu or English (AI will auto-polish into professional English)..."
                className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
              />

              {/* AI Polish / Suggest Button */}
              <button
                type="button"
                onClick={handleAiPolishOrSuggest}
                disabled={isPolishing}
                title="Polish Roman Urdu / Draft into British English or generate AI smart reply"
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold px-2.5 py-2 rounded-lg flex items-center gap-1 transition shadow-2xs disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 text-indigo-600 ${isPolishing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{inputText.trim() ? 'AI Polish' : 'AI Suggest'}</span>
              </button>

              <button
                type="submit"
                disabled={!inputText.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1 shadow transition"
              >
                <Send className="w-3.5 h-3.5" /> Reply
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
            Select a conversation from the left to view messages.
          </div>
        )}
      </div>

      {/* 3. CRM Visitor & Customer Profile Sidebar */}
      <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-4 shadow-xs overflow-y-auto space-y-4">
        {activeVisitor ? (
          <>
            <div className="text-center pb-3 border-b border-slate-200">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xl font-bold rounded-full flex items-center justify-center mx-auto mb-2 shadow">
                {activeVisitor.name[0]}
              </div>
              <h3 className="font-bold text-slate-800 text-sm">{activeVisitor.name}</h3>
              <p className="text-xs text-slate-500">{activeVisitor.email}</p>
              <div className="flex justify-center gap-1 mt-2">
                {activeVisitor.tags.map((tag, idx) => (
                  <span key={idx} className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded border border-slate-200 font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Visitor Details */}
            <div className="space-y-2.5 text-xs text-slate-700">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider text-slate-400">Visitor CRM Data</h4>
              
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Location:</span>
                <span className="font-semibold text-slate-800">{activeVisitor.location.flag} {activeVisitor.location.city}, {activeVisitor.location.country}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">IP Address:</span>
                <span className="font-mono text-slate-800">{activeVisitor.ip}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Device & OS:</span>
                <span className="font-semibold text-slate-800">{activeVisitor.device} ({activeVisitor.os})</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Total Visits:</span>
                <span className="font-semibold text-slate-800">{activeVisitor.visitsCount} visits</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Pages Viewed:</span>
                <span className="font-semibold text-slate-800">{activeVisitor.pagesViewed} pages</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Current Page:</span>
                <span className="font-mono text-[10px] text-blue-600 truncate max-w-[140px]">{activeVisitor.currentUrl}</span>
              </div>
            </div>

            {/* Agent Internal Notes */}
            <div className="pt-2">
              <h4 className="font-bold text-slate-800 text-xs mb-1">Internal Agent Notes</h4>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-900 space-y-1">
                {activeVisitor.notes.map((note, i) => (
                  <p key={i}>• {note}</p>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center text-slate-400 text-xs py-10">
            No visitor profile loaded.
          </div>
        )}
      </div>

    </div>
  );
};
