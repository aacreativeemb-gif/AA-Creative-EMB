import React, { useState } from 'react';
import { ShieldCheck, Building2, Users, Code2, Plus, Lock, CheckCircle2 } from 'lucide-react';
import { Property, User as UserType, Department, AuditLog, CannedResponse } from '../types';

interface SettingsViewProps {
  properties: Property[];
  agents: UserType[];
  departments: Department[];
  cannedResponses: CannedResponse[];
  auditLogs: AuditLog[];
  onOpenEmbedModal: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  properties,
  agents,
  departments,
  cannedResponses,
  auditLogs,
  onOpenEmbedModal
}) => {
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 uppercase tracking-wider">
            Admin Settings
          </span>
          <h2 className="text-xl font-bold text-slate-800 mt-2">Platform Properties & Security Settings</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage multi-website properties, support team roles, canned shortcuts, and audit logs.
          </p>
        </div>

        <button
          onClick={onOpenEmbedModal}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow transition"
        >
          <Code2 className="w-4 h-4" /> Get Live Widget Embed Snippet
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Properties List */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
            <Building2 className="w-4 h-4 text-blue-600" /> Multi-Website Properties ({properties.length})
          </h3>
          <div className="space-y-2">
            {properties.map(p => (
              <div key={p.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex justify-between items-center">
                <div>
                  <p className="font-bold text-slate-800">{p.name}</p>
                  <p className="font-mono text-[10px] text-slate-500">{p.domain}</p>
                </div>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                  {p.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Agents & RBAC */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
            <Users className="w-4 h-4 text-emerald-600" /> Support Agents & Roles
          </h3>
          <div className="space-y-2">
            {agents.map(ag => (
              <div key={ag.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <img src={ag.avatar} alt={ag.name} className="w-7 h-7 rounded-full object-cover" />
                  <div>
                    <p className="font-bold text-slate-800">{ag.name}</p>
                    <p className="text-[10px] text-slate-500">{ag.email}</p>
                  </div>
                </div>
                <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                  {ag.role}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Audit Logs */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
        <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">System Audit Logs</h3>
        <div className="space-y-2 text-xs">
          {auditLogs.map(log => (
            <div key={log.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
              <div>
                <span className="font-bold text-slate-800">{log.userName}:</span> {log.action} — <span className="text-slate-500">{log.details}</span>
              </div>
              <span className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
