import React from 'react';
import {
  MessageSquare,
  Bot,
  Users,
  Ticket,
  Sliders,
  BarChart3,
  BookOpen,
  Code2,
  Mail,
  Zap,
  ShieldCheck,
  Building2,
  Sparkles
} from 'lucide-react';
import { Property, User } from '../types';

interface HeaderProps {
  properties: Property[];
  selectedProperty: Property;
  onSelectProperty: (p: Property) => void;
  currentUser: User;
  users: User[];
  onSelectUser: (u: User) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenEmbedModal: () => void;
  unreadCount: number;
  openTicketsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  properties,
  selectedProperty,
  onSelectProperty,
  currentUser,
  users,
  onSelectUser,
  activeTab,
  setActiveTab,
  onOpenEmbedModal,
  unreadCount,
  openTicketsCount
}) => {
  const navItems = [
    { id: 'widget_testbench', label: 'Visitor Widget Preview', icon: MessageSquare, badge: null },
    { id: 'unified_inbox', label: 'Unified Inbox', icon: Mail, badge: unreadCount > 0 ? unreadCount : null },
    { id: 'visitor_tracker', label: 'Live Visitor Tracking', icon: Users, badge: 'Live' },
    { id: 'ai_admin', label: 'AI Support Agent & KB', icon: Bot, highlight: true },
    { id: 'ticketing', label: 'Tickets & SLA', icon: Ticket, badge: openTicketsCount > 0 ? openTicketsCount : null },
    { id: 'integrations', label: 'Gmail & WhatsApp', icon: Zap },
    { id: 'automations', label: 'Triggers', icon: Sliders },
    { id: 'knowledge_base', label: 'Knowledge Base', icon: BookOpen },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: ShieldCheck }
  ];

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-md">
      {/* Top Bar: Property & Role controls */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold text-lg text-blue-400">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-inner">
              <MessageSquare className="w-5 h-5" />
            </div>
            <span>AA Creative Embroidery AI Platform</span>
          </div>

          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-slate-800">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select
              value={selectedProperty.id}
              onChange={e => {
                const found = properties.find(p => p.id === e.target.value);
                if (found) onSelectProperty(found);
              }}
              className="bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {properties.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Embed snippet button */}
          <button
            onClick={onOpenEmbedModal}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md text-xs font-medium transition shadow"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Get Embed Script</span>
          </button>

          {/* User / Agent switcher */}
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-5 h-5 rounded-full object-cover"
            />
            <select
              value={currentUser.id}
              onChange={e => {
                const found = users.find(u => u.id === e.target.value);
                if (found) onSelectUser(found);
              }}
              className="bg-transparent text-xs text-slate-200 focus:outline-none"
            >
              {users.map(u => (
                <option key={u.id} value={u.id} className="bg-slate-800 text-slate-200">
                  {u.name} ({u.role.toUpperCase()})
                </option>
              ))}
            </select>
            <span
              className={`w-2 h-2 rounded-full ${
                currentUser.status === 'online'
                  ? 'bg-emerald-400 animate-pulse'
                  : currentUser.status === 'away'
                  ? 'bg-amber-400'
                  : 'bg-slate-500'
              }`}
              title={`Agent status: ${currentUser.status}`}
            />
          </div>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 overflow-x-auto scrollbar-none border-t border-slate-800/80 pt-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-t-md transition whitespace-nowrap relative border-b-2 ${
                isActive
                  ? 'border-blue-500 bg-slate-800/80 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              } ${item.highlight ? 'text-blue-300 font-semibold' : ''}`}
            >
              <Icon className={`w-3.5 h-3.5 ${item.highlight ? 'text-blue-400' : ''}`} />
              <span>{item.label}</span>
              {item.highlight && <Sparkles className="w-3 h-3 text-amber-400 animate-spin" />}
              {item.badge !== null && item.badge !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    typeof item.badge === 'number'
                      ? 'bg-blue-600 text-white'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};
