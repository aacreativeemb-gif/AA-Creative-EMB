import React from 'react';
import {
  MessageSquare,
  Bot,
  Users,
  Ticket,
  Sliders,
  BarChart3,
  BookOpen,
  Mail,
  Zap,
  ShieldCheck,
  Sparkles,
  History,
  X
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string | null;
  highlight?: boolean;
}

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  unreadCount: number;
  openTicketsCount: number;
  /** Mobile drawer open state (ignored on desktop, sidebar is always visible there) */
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  unreadCount,
  openTicketsCount,
  isOpen,
  onClose
}) => {
  const navItems: NavItem[] = [
    { id: 'widget_testbench', label: 'Visitor Widget Preview', icon: MessageSquare, badge: null },
    { id: 'unified_inbox', label: 'Admin Chat', icon: Mail, badge: unreadCount > 0 ? unreadCount : null },
    { id: 'visitor_tracker', label: 'Live Visitor Tracking', icon: Users, badge: 'Live' },
    { id: 'visitor_history', label: 'Visitor History', icon: History, badge: null },
    { id: 'ai_admin', label: 'AI Support Agent & KB', icon: Bot, highlight: true },
    { id: 'ticketing', label: 'Tickets & SLA', icon: Ticket, badge: openTicketsCount > 0 ? openTicketsCount : null },
    { id: 'integrations', label: 'Gmail & WhatsApp', icon: Zap },
    { id: 'automations', label: 'Triggers', icon: Sliders },
    { id: 'knowledge_base', label: 'Knowledge Base', icon: BookOpen },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: ShieldCheck }
  ];

  const navList = (
    <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
      {navItems.map(item => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => {
              setActiveTab(item.id);
              onClose();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium rounded-lg transition text-left border ${
              isActive
                ? 'bg-blue-600/15 text-white border-blue-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-transparent'
            } ${item.highlight ? 'text-blue-300 font-semibold' : ''}`}
          >
            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-400' : ''} ${item.highlight ? 'text-blue-400' : ''}`} />
            <span className="flex-1 truncate">{item.label}</span>
            {item.highlight && <Sparkles className="w-3 h-3 text-amber-400 animate-spin shrink-0" />}
            {item.badge !== null && item.badge !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
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
    </nav>
  );

  return (
    <>
      {/* Desktop: always-visible sidebar column */}
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 bg-slate-900 border-r border-slate-800 h-full">
        {navList}
      </aside>

      {/* Mobile: slide-in drawer + backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed md:hidden top-0 left-0 z-50 h-screen w-72 max-w-[80vw] bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-200 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 font-bold text-sm text-blue-400">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <MessageSquare className="w-4 h-4" />
            </div>
            <span>Menu</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1" title="Close menu">
            <X className="w-5 h-5" />
          </button>
        </div>
        {navList}
      </aside>
    </>
  );
};
