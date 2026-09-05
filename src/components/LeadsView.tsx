import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Users,
  Calendar,
  Download,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Search,
  Trash2
} from 'lucide-react';
import { Visitor } from '../types';

interface LeadsViewProps {
  leads: Visitor[];
  onDeleteLead?: (visitorId: string) => void;
  onClearAllLeads?: () => void;
}

const isRealLeadEmail = (email?: string) =>
  !!email && !email.includes('@guest.aaemb.com') && !email.includes('visitor@example.com');

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
};

export const LeadsView: React.FC<LeadsViewProps> = ({ leads, onDeleteLead, onClearAllLeads }) => {
  const [viewMode, setViewMode] = useState<'month' | 'all'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>(monthKey(new Date()));
  const [searchQuery, setSearchQuery] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Every visitor who came through the pre-chat lead form (has a real name +
  // email), newest first.
  const allLeads = useMemo(() => {
    return leads
      .filter(l => isRealLeadEmail(l.email))
      .slice()
      .sort((a, b) => {
        const ta = new Date(a.leadCapturedAt || a.firstSeenAt || 0).getTime();
        const tb = new Date(b.leadCapturedAt || b.firstSeenAt || 0).getTime();
        return tb - ta;
      });
  }, [leads]);

  const displayedLeads = useMemo(() => {
    let list = allLeads;
    if (viewMode === 'month') {
      list = list.filter(l => monthKey(new Date(l.leadCapturedAt || l.firstSeenAt || 0)) === selectedMonth);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        l =>
          l.name?.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q) ||
          (l.phone || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [allLeads, viewMode, selectedMonth, searchQuery]);

  // Months that actually have at least one lead, for the prev/next arrows
  // and so the month picker only ever lands on a month with data.
  const monthsWithLeads = useMemo(() => {
    const set = new Set(allLeads.map(l => monthKey(new Date(l.leadCapturedAt || l.firstSeenAt || 0))));
    return Array.from(set).sort();
  }, [allLeads]);

  const goToAdjacentMonth = (direction: -1 | 1) => {
    const idx = monthsWithLeads.indexOf(selectedMonth);
    if (idx === -1) {
      // Current month has no leads yet — just step the calendar by one month.
      const [y, m] = selectedMonth.split('-').map(Number);
      const d = new Date(y, m - 1 + direction, 1);
      setSelectedMonth(monthKey(d));
      return;
    }
    const nextIdx = idx + direction;
    if (nextIdx >= 0 && nextIdx < monthsWithLeads.length) {
      setSelectedMonth(monthsWithLeads[nextIdx]);
    }
  };

  const formatDateTime = (iso?: string) => {
    if (!iso) return { date: '—', time: '—' };
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const handleDownloadExcel = () => {
    const rows = displayedLeads.map(l => {
      const dt = formatDateTime(l.leadCapturedAt || l.firstSeenAt);
      return {
        Name: l.name || '',
        Phone: l.phone || '',
        Email: l.email || '',
        Date: dt.date,
        Time: dt.time
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Name: '', Phone: '', Email: '', Date: '', Time: '' }]);
    worksheet['!cols'] = [{ wch: 22 }, { wch: 18 }, { wch: 28 }, { wch: 14 }, { wch: 10 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');

    const filename = viewMode === 'all' ? `leads-all.xlsx` : `leads-${selectedMonth}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            Lead Capture
          </span>
          <h2 className="text-lg font-bold text-slate-800 mt-2 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Leads List
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Every visitor who shared their Name, Email &amp; Phone before starting a chat.
          </p>
        </div>

        <div className="flex items-center gap-3 text-center">
          <div className="bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
            <span className="text-xl font-black text-blue-600">{displayedLeads.length}</span>
            <p className="text-[11px] text-slate-500 font-medium">{viewMode === 'all' ? 'Total Leads' : 'This Month'}</p>
          </div>
        </div>
      </div>

      {/* Controls: month calendar / all-time toggle + search + export */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
          <button
            type="button"
            onClick={() => setViewMode('month')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md transition ${
              viewMode === 'month' ? 'bg-white text-blue-700 shadow-xs border border-slate-200' : 'text-slate-500'
            }`}
          >
            By Month
          </button>
          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md transition ${
              viewMode === 'all' ? 'bg-white text-blue-700 shadow-xs border border-slate-200' : 'text-slate-500'
            }`}
          >
            All Leads
          </button>
        </div>

        {viewMode === 'month' && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => goToAdjacentMonth(-1)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <input
                type="month"
                value={selectedMonth}
                max={monthKey(new Date())}
                onChange={e => setSelectedMonth(e.target.value)}
                className="bg-transparent outline-none text-xs font-semibold text-slate-700"
              />
            </div>
            <button
              type="button"
              onClick={() => goToAdjacentMonth(1)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="text-[11px] text-slate-400 hidden sm:inline">{monthLabel(selectedMonth)}</span>
          </div>
        )}

        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search name, email, or phone..."
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <button
          type="button"
          onClick={handleDownloadExcel}
          disabled={displayedLeads.length === 0}
          className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          Download Excel
        </button>

        {onClearAllLeads && (
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            disabled={allLeads.length === 0}
            title="Permanently delete all leads"
            className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            Clear Leads
          </button>
        )}
      </div>

      {/* Clear-all-leads confirmation */}
      {showClearConfirm && (
        <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 text-sm text-rose-900 space-y-3">
          <p className="font-semibold">Are you sure you want to delete / clear all leads? This permanently removes every captured lead (name, email, phone) and cannot be undone.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onClearAllLeads && onClearAllLeads();
                setShowClearConfirm(false);
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2 rounded-lg"
            >
              Yes, Clear All Leads
            </button>
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              className="bg-white border border-slate-300 text-slate-600 font-semibold text-xs px-4 py-2 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Leads Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            {viewMode === 'all' ? 'All Leads' : `Leads — ${monthLabel(selectedMonth)}`}
          </h3>
          <span className="text-xs text-slate-500 font-medium">{displayedLeads.length} lead{displayedLeads.length === 1 ? '' : 's'}</span>
        </div>

        {displayedLeads.length === 0 && (
          <div className="py-14 text-center px-4">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-500">No leads for this period yet.</p>
            <p className="text-xs text-slate-400 mt-1">
              {viewMode === 'month' ? 'Try another month, or switch to "All Leads".' : 'Leads will appear here as visitors start a chat.'}
            </p>
          </div>
        )}

        {displayedLeads.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="p-3">Name</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Time</th>
                  {onDeleteLead && <th className="p-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {displayedLeads.map(lead => {
                  const dt = formatDateTime(lead.leadCapturedAt || lead.firstSeenAt);
                  return (
                    <tr key={lead.id} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-800">{lead.name}</td>
                      <td className="p-3">
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {lead.phone || '—'}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {lead.email}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500">{dt.date}</td>
                      <td className="p-3 text-slate-500">{dt.time}</td>
                      {onDeleteLead && (
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Permanently delete the lead for ${lead.name}? This cannot be undone.`)) {
                                onDeleteLead(lead.id);
                              }
                            }}
                            title="Permanently delete this lead"
                            className="p-1.5 rounded-md border border-slate-200 text-slate-400 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-200 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
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
