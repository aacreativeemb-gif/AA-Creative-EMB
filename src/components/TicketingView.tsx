import React, { useState } from 'react';
import {
  Ticket as TicketIcon,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  Tag,
  Search,
  Filter,
  ShieldAlert
} from 'lucide-react';
import { Ticket, User as UserType, Department } from '../types';

interface TicketingViewProps {
  tickets: Ticket[];
  agents: UserType[];
  departments: Department[];
  onCreateTicket: (ticket: Partial<Ticket>) => void;
  onUpdateTicketStatus: (id: string, status: any) => void;
}

export const TicketingView: React.FC<TicketingViewProps> = ({
  tickets,
  agents,
  departments,
  onCreateTicket,
  onUpdateTicketStatus
}) => {
  const [showModal, setShowModal] = useState(false);
  const [subject, setSubject] = useState('');
  const [visitorName, setVisitorName] = useState('Ali Raza');
  const [visitorEmail, setVisitorEmail] = useState('ali.raza@gmail.com');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('high');

  const statusTabs: { value: 'open' | 'in_progress' | 'resolved' | 'closed'; label: string }[] = [
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' }
  ];
  const [activeStatusTab, setActiveStatusTab] = useState<'open' | 'in_progress' | 'resolved' | 'closed'>('open');
  const filteredTickets = tickets.filter(t => t.status === activeStatusTab);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    onCreateTicket({
      subject,
      visitorName,
      visitorEmail,
      description,
      priority,
      departmentId: departments[0]?.id || 'dept_support'
    });
    setShowModal(false);
    setSubject('');
    setDescription('');
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'urgent':
        return <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase animate-pulse">URGENT SLA</span>;
      case 'high':
        return <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">HIGH</span>;
      case 'normal':
        return <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">NORMAL</span>;
      default:
        return <span className="bg-slate-400 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">LOW</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200 uppercase tracking-wider">
            SLA & Support Tickets
          </span>
          <h2 className="text-xl font-bold text-slate-800 mt-2">Support Ticket Management Pipeline</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track escalation tickets, monitor Service Level Agreement (SLA) timers, and assign support agents.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition"
        >
          <Plus className="w-4 h-4" /> Create Ticket
        </button>
      </div>

      {/* Status Filter Tabs: Open / In Progress / Resolved / Closed */}
      <div className="bg-white border border-slate-200 rounded-xl p-1.5 shadow-xs flex flex-wrap items-center gap-1.5">
        {statusTabs.map(tab => {
          const count = tickets.filter(t => t.status === tab.value).length;
          const isActive = activeStatusTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveStatusTab(tab.value)}
              className={`flex-1 min-w-[110px] text-xs font-bold px-3 py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
                isActive
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Ticket List Cards */}
      {filteredTickets.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-14 text-center px-4 shadow-xs">
          <TicketIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-500">No {statusTabs.find(t => t.value === activeStatusTab)?.label} tickets</p>
          <p className="text-xs text-slate-400 mt-1">Tickets moved to this status will show up here.</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTickets.map(tkt => (
          <div key={tkt.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {tkt.ticketNumber}
                </span>
                {getPriorityBadge(tkt.priority)}
              </div>
              <span className={`text-xs font-bold capitalize px-2.5 py-0.5 rounded-full ${
                tkt.status === 'in_progress'
                  ? 'bg-amber-100 text-amber-800'
                  : tkt.status === 'resolved'
                  ? 'bg-emerald-100 text-emerald-800'
                  : tkt.status === 'closed'
                  ? 'bg-slate-200 text-slate-700'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {tkt.status.replace('_', ' ')}
              </span>
            </div>

            <h3 className="font-bold text-slate-800 text-sm">{tkt.subject}</h3>
            <p className="text-xs text-slate-600">{tkt.description}</p>

            <div className="bg-slate-50 p-2.5 rounded-lg text-xs space-y-1 text-slate-600">
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="font-semibold text-slate-800">{tkt.visitorName} ({tkt.visitorEmail})</span>
              </div>
              <div className="flex justify-between">
                <span>SLA Due Date:</span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(tkt.slaDueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex gap-1">
                {tkt.tags.map((tag, i) => (
                  <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-medium">
                    {tag}
                  </span>
                ))}
              </div>

              <select
                value={tkt.status}
                onChange={e => onUpdateTicketStatus(tkt.id, e.target.value)}
                className="text-xs bg-white border border-slate-300 rounded-md px-2 py-1 font-semibold text-slate-700 outline-none"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* New Ticket Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreate} className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Create New Support Ticket</h3>
            
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Customer Name</label>
              <input
                type="text"
                value={visitorName}
                onChange={e => setVisitorName(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Customer Email</label>
              <input
                type="email"
                value={visitorEmail}
                onChange={e => setVisitorEmail(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Ticket Subject</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Expedited Order #12345 Request"
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Priority Level</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-1/2 py-2 text-xs font-semibold border border-slate-300 rounded-lg text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-1/2 py-2 text-xs font-bold bg-blue-600 text-white rounded-lg shadow"
              >
                Create Ticket
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
