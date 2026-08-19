import React, { useState } from 'react';
import {
  Users,
  Globe,
  Monitor,
  Smartphone,
  ExternalLink,
  MessageSquare,
  Clock,
  Search,
  Tag,
  ShieldCheck,
  Zap,
  XCircle,
  CheckCircle2
} from 'lucide-react';
import { Visitor, Conversation } from '../types';

interface VisitorTrackerProps {
  visitors: Visitor[];
  conversations?: Conversation[];
  onStartChatWithVisitor: (visitor: Visitor) => void;
  onCloseChat?: (visitorId: string) => void;
  /** 'live' = today's visitors only (default). 'history' = up to 3 months of past visitors. */
  variant?: 'live' | 'history';
}

export const VisitorTracker: React.FC<VisitorTrackerProps> = ({
  visitors,
  conversations = [],
  onStartChatWithVisitor,
  onCloseChat,
  variant = 'live'
}) => {
  const isHistory = variant === 'history';
  const uniqueCountries = new Set(visitors.map(v => v.location?.country).filter(Boolean)).size;
  const [closingId, setClosingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const formatArrival = (iso?: string) => {
    if (!iso) return { date: '—', time: '—' };
    const d = new Date(iso);
    if (isNaN(d.getTime())) return { date: '—', time: '—' };
    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    };
  };

  const handleClose = async (vis: Visitor) => {
    setClosingId(vis.id);
    try {
      if (onCloseChat) {
        await onCloseChat(vis.id);
      } else {
        const conv = conversations.find(c => c.visitorId === vis.id);
        if (conv) {
          await fetch('/api/conversations/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversationId: conv.id, status: 'resolved' })
          });
        }
      }
      setNotice(`✅ Live chat session for ${vis.name} closed successfully.`);
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setNotice('❌ Failed to close chat.');
    } finally {
      setClosingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* Alert Notice */}
      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-emerald-700 hover:text-emerald-950">✕</button>
        </div>
      )}

      {/* Overview Stats Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border uppercase tracking-wider ${
              isHistory
                ? 'text-blue-600 bg-blue-50 border-blue-200'
                : 'text-emerald-600 bg-emerald-50 border-emerald-200'
            }`}
          >
            {isHistory ? '3-Month Visitor History' : 'Live Real-time Tracker'}
          </span>
          <h2 className="text-lg md:text-xl font-bold text-slate-800 mt-2">
            {isHistory ? 'Past Website Visitors' : "Today's Website Visitors"}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isHistory
              ? 'Browse every visitor who arrived on the site over the last 3 months.'
              : "Monitor today's incoming website traffic, current active pages, country origin, and initiate or close proactive support chats."}
          </p>
        </div>

        <div className="flex items-center gap-3 md:gap-4 text-center">
          <div className="bg-slate-50 px-3.5 md:px-4 py-2 rounded-xl border border-slate-200">
            <span className="text-xl md:text-2xl font-black text-emerald-600">
              {isHistory ? visitors.length : visitors.filter(v => v.status === 'online').length}
            </span>
            <p className="text-[11px] text-slate-500 font-medium">
              {isHistory ? 'Total Visitors' : 'Online Visitors'}
            </p>
          </div>
          <div className="bg-slate-50 px-3.5 md:px-4 py-2 rounded-xl border border-slate-200">
            <span className="text-xl md:text-2xl font-black text-blue-600">{uniqueCountries}</span>
            <p className="text-[11px] text-slate-500 font-medium">Countries</p>
          </div>
        </div>
      </div>

      {/* Visitor Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            {isHistory ? 'Visitor History Log' : "Today's Visitor Session Stream"}
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            {isHistory ? `Last 3 months · ${visitors.length} visitor${visitors.length === 1 ? '' : 's'}` : 'Auto-refresh active'}
          </span>
        </div>

        {visitors.length === 0 && (
          <div className="py-14 text-center px-4">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-500">
              {isHistory ? 'No visitor history in the last 3 months yet.' : 'No visitors on the site today yet.'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {isHistory ? 'New visitor sessions will appear here as they happen.' : 'New visitors arriving today will show up here automatically.'}
            </p>
          </div>
        )}

        {visitors.length > 0 && (
        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full min-w-[860px] text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <th className="p-3">Visitor Name & Info</th>
                <th className="p-3">Arrived At</th>
                <th className="p-3">Location & IP</th>
                <th className="p-3">Current Active URL</th>
                <th className="p-3">Device & OS</th>
                <th className="p-3">Time On Site</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {visitors.map(vis => {
                const activeConv = conversations.find(c => c.visitorId === vis.id && c.status !== 'resolved');
                return (
                  <tr key={vis.id} className="hover:bg-slate-50 transition">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                            {vis.name[0]}
                          </div>
                          <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${vis.status === 'online' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-slate-800">{vis.name}</p>
                            {activeConv && (
                              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded">
                                In Chat
                              </span>
                            )}
                            <span
                              className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${
                                vis.visitsCount <= 1
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              {vis.visitsCount <= 1 ? 'New' : 'Existing'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">{vis.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="font-semibold text-slate-800">
                        {formatArrival(vis.sessionStartedAt || vis.firstSeenAt).date}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {formatArrival(vis.sessionStartedAt || vis.firstSeenAt).time}
                      </p>
                    </td>

                    <td className="p-3">
                      <div className="font-medium text-slate-800 flex items-center gap-1.5">
                        <span className="text-base">{vis.location.flag}</span>
                        <span>{vis.location.city}, {vis.location.country}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{vis.ip}</p>
                    </td>

                    <td className="p-3 max-w-[200px]">
                      <p className="font-mono text-blue-600 text-[11px] truncate" title={vis.currentUrl}>
                        {vis.currentUrl}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Referrer: {vis.referrer}</p>
                    </td>

                    <td className="p-3">
                      <div className="font-medium text-slate-800 flex items-center gap-1">
                        {vis.device.includes('Mobile') ? <Smartphone className="w-3.5 h-3.5 text-slate-500" /> : <Monitor className="w-3.5 h-3.5 text-slate-500" />}
                        <span>{vis.device}</span>
                      </div>
                      <p className="text-[10px] text-slate-400">{vis.browser} on {vis.os}</p>
                    </td>

                    <td className="p-3">
                      <div className="font-semibold text-slate-800 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{Math.floor(vis.timeOnSiteSeconds / 60)}m {vis.timeOnSiteSeconds % 60}s</span>
                      </div>
                      <p className="text-[10px] text-slate-400">{vis.pagesViewed} pages viewed</p>
                    </td>

                    <td className="p-3 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => onStartChatWithVisitor(vis)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-lg font-semibold text-xs inline-flex items-center gap-1 shadow-2xs transition"
                          title="Open or start live chat with visitor"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{activeConv ? 'Open Chat' : 'Start Chat'}</span>
                        </button>

                        {!isHistory && (
                          <button
                            onClick={() => handleClose(vis)}
                            disabled={closingId === vis.id}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1.5 rounded-lg font-semibold text-xs inline-flex items-center gap-1 transition disabled:opacity-50"
                            title="Close / End live chat session"
                          >
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>{closingId === vis.id ? 'Closing...' : 'Close Chat'}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
};

