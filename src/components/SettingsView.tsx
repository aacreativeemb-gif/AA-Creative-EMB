import React, { useState, useEffect } from 'react';
import { ShieldCheck, Building2, Users, Code2, Lock, Mail, Send, CheckCircle2, AlertCircle, KeyRound, ExternalLink, RefreshCw } from 'lucide-react';
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
  const [smtpUser, setSmtpUser] = useState('aacreativeemb@gmail.com');
  const [smtpPass, setSmtpPass] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/email/config')
      .then(res => res.json())
      .then(data => {
        if (data.smtpUser) setSmtpUser(data.smtpUser);
        setHasPassword(data.hasPassword);
      })
      .catch(() => {});
  }, []);

  const handleSaveEmailConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/email/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpUser,
          smtpPass: smtpPass || undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        if (smtpPass) setHasPassword(true);
        setSmtpPass('');
        setStatusMessage({ type: 'success', text: 'Email & SMTP settings saved successfully!' });
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to save settings.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Network connection error while saving.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    setIsTesting(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: smtpUser })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: `✅ Test email successfully dispatched to ${smtpUser}! Check your inbox/spam folder.`
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: `❌ Email sending failed: ${data.error || 'Please enter your 16-character Google App Password below.'}`
        });
      }
    } catch {
      setStatusMessage({
        type: 'error',
        text: '❌ Could not connect to mail server. Please verify your Google App Password.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 uppercase tracking-wider">
            Admin Settings
          </span>
          <h2 className="text-xl font-bold text-slate-800 mt-2">Platform Properties & Security Settings</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage email notifications (Gmail/SMTP), support team roles, properties, and security.
          </p>
        </div>

        <button
          onClick={onOpenEmbedModal}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow transition"
        >
          <Code2 className="w-4 h-4" /> Get Live Widget Embed Snippet
        </button>
      </div>

      {/* Email / SMTP Notification System */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                Email Dispatch & SMTP Notification Center
                {hasPassword ? (
                  <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Configured
                  </span>
                ) : (
                  <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Requires Google App Password
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500">
                Ticket alerts, customer inquiries, and 2FA login verification codes are dispatched to this email.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSendTestEmail}
            disabled={isTesting}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            {isTesting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Send Test Email to {smtpUser}
          </button>
        </div>

        {statusMessage && (
          <div className={`p-3 rounded-lg text-xs font-medium border flex items-start gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>{statusMessage.text}</div>
          </div>
        )}

        {/* Configuration Form */}
        <form onSubmit={handleSaveEmailConfig} className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-5 space-y-1">
            <label className="text-xs font-semibold text-slate-700">Admin Dispatch Email (Gmail)</label>
            <input
              type="email"
              value={smtpUser}
              onChange={e => setSmtpUser(e.target.value)}
              required
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
              placeholder="aacreativeemb@gmail.com"
            />
          </div>

          <div className="md:col-span-5 space-y-1">
            <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>Google 16-Digit App Password</span>
              {hasPassword && <span className="text-[10px] text-emerald-600 font-normal">● Saved securely</span>}
            </label>
            <input
              type="password"
              value={smtpPass}
              onChange={e => setSmtpPass(e.target.value)}
              placeholder={hasPassword ? '•••••••••••••••• (Leave blank to keep current)' : 'e.g. abcd efgh ijkl mnop'}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
            />
          </div>

          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-3 rounded-lg transition disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>

        {/* Step-by-Step Instructions to get Google App Password */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-600 space-y-2">
          <p className="font-bold text-slate-800 flex items-center gap-1.5">
            <KeyRound className="w-4 h-4 text-amber-500" />
            How to enable real Gmail delivery in 1 minute:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-600">
            <li>Open your Google Account: <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-blue-600 font-bold underline inline-flex items-center gap-0.5">Google App Passwords <ExternalLink className="w-3 h-3" /></a></li>
            <li>Create an App named <strong>AA Support Desk</strong> and click <strong>Create</strong>.</li>
            <li>Copy the 16-letter password shown (e.g. <code>abcd efgh ijkl mnop</code>) and paste it into the field above, then click <strong>Save Settings</strong>.</li>
          </ol>
          <p className="text-[11px] text-slate-500 border-t border-slate-200 pt-1.5">
            💡 <strong>Note:</strong> You can also set <code>SMTP_USER=aacreativeemb@gmail.com</code> and <code>SMTP_PASS=your_16_letter_app_password</code> in Render Environment Variables.
          </p>
        </div>
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

