import React from 'react';
import { BarChart3, Download, TrendingUp, Clock, Bot, Headphones, CheckCircle2, MessageSquare } from 'lucide-react';
import { PlatformAnalytics } from '../types';

interface AnalyticsViewProps {
  analytics: PlatformAnalytics;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ analytics }) => {
  const handleExportCsv = () => {
    const csvContent = `Metric,Value
Total Conversations,${analytics.totalChats}
AI Resolved Conversations,${analytics.aiResolvedCount}
Human Handoff Conversations,${analytics.humanHandoffCount}
CSAT Rating,${analytics.csatPercentage}%
Average Response Time,${analytics.avgResponseTimeSeconds}s
Website Chat Volume,${analytics.channelBreakdown.website}
Gmail Volume,${analytics.channelBreakdown.gmail}
WhatsApp Volume,${analytics.channelBreakdown.whatsapp}`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'TawkAI_Platform_Analytics_Report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 uppercase tracking-wider">
            Reports & Insights
          </span>
          <h2 className="text-xl font-bold text-slate-800 mt-2">Platform Performance & Resolution Analytics</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Key metrics tracking AI First-Line resolution rates, human handoffs, customer satisfaction, and channel volumes.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition"
        >
          <Download className="w-4 h-4" /> Export CSV Report
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Conversations</span>
            <MessageSquare className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-800">{analytics.totalChats}</div>
          <p className="text-[10px] text-emerald-600 font-semibold">↑ 14% increase this week</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">AI First-Line Resolution Rate</span>
            <Bot className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-600">
            {Math.round((analytics.aiResolvedCount / analytics.totalChats) * 100)}%
          </div>
          <p className="text-[10px] text-slate-500">{analytics.aiResolvedCount} chats handled 100% by AI</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Customer Satisfaction (CSAT)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{analytics.csatPercentage}%</div>
          <p className="text-[10px] text-emerald-600 font-semibold">Based on 84 ratings</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Avg First Response Time</span>
            <Clock className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-600">{analytics.avgResponseTimeSeconds}s</div>
          <p className="text-[10px] text-slate-500">Instant AI + Fast Agent Handoff</p>
        </div>
      </div>

      {/* Channel Distribution Breakdown */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">
          Omnichannel Support Breakdown
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
            <span className="text-lg font-bold text-blue-800">{analytics.channelBreakdown.website}</span>
            <p className="text-xs text-blue-600 font-medium">Website Live Chat</p>
          </div>

          <div className="bg-red-50 p-3 rounded-xl border border-red-100">
            <span className="text-lg font-bold text-red-800">{analytics.channelBreakdown.gmail}</span>
            <p className="text-xs text-red-600 font-medium">Gmail Tickets</p>
          </div>

          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
            <span className="text-lg font-bold text-emerald-800">{analytics.channelBreakdown.whatsapp}</span>
            <p className="text-xs text-emerald-600 font-medium">WhatsApp Business</p>
          </div>

          <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
            <span className="text-lg font-bold text-purple-800">{analytics.channelBreakdown.ticket}</span>
            <p className="text-xs text-purple-600 font-medium">Escalated Tickets</p>
          </div>
        </div>
      </div>

    </div>
  );
};
