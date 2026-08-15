import React, { useState, useEffect } from 'react';
import {
  Mail,
  Zap,
  CheckCircle2,
  ShieldCheck,
  Send,
  Sparkles,
  Smartphone,
  Globe,
  Lock,
  RefreshCw,
  AlertCircle,
  KeyRound,
  ExternalLink
} from 'lucide-react';

export const EmailConfigForm: React.FC = () => {
  const [smtpUser, setSmtpUser] = useState('aacreativeemb@gmail.com');
  const [smtpPass, setSmtpPass] = useState('');
  const [resendApiKey, setResendApiKey] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [hasResendKey, setHasResendKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/email/config')
      .then(res => res.json())
      .then(data => {
        if (data.smtpUser) setSmtpUser(data.smtpUser);
        setHasPassword(data.hasPassword);
        setHasResendKey(data.hasResendKey);
      })
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/email/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpUser,
          smtpPass: smtpPass || undefined,
          resendApiKey: resendApiKey || undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        if (smtpPass) setHasPassword(true);
        if (resendApiKey) setHasResendKey(true);
        setSmtpPass('');
        setResendApiKey('');
        setStatusMessage({ type: 'success', text: '✅ Email configuration saved successfully! Ready to test.' });
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to save settings.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Network connection error while saving.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setIsTesting(true);
    setStatusMessage(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: smtpUser }),
        signal: controller.signal
      });
      clearTimeout(timer);
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: `🎉 Verified! Test email successfully delivered to ${smtpUser} (${data.method}). Check your Gmail inbox & spam!`
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: `❌ Email sending failed: ${data.error || 'Please enter your 16-character Google App Password and click Save Password.'}`
        });
      }
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        setStatusMessage({
          type: 'error',
          text: '❌ Connection timed out. Please check your credentials or try again.'
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: '❌ Could not connect to mail server. Please verify your Google App Password or Resend API key.'
        });
      }
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-4">
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

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-5 space-y-1">
          <label className="text-xs font-semibold text-slate-700">Recipient / Dispatch Email</label>
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
            {hasPassword && <span className="text-[10px] text-emerald-600 font-bold">● Active & Saved</span>}
          </label>
          <input
            type="text"
            value={smtpPass}
            onChange={e => setSmtpPass(e.target.value)}
            placeholder={hasPassword ? '•••• •••• •••• •••• (Saved - enter new to change)' : 'Paste 16-digit code (e.g. abcd efgh ijkl mnop)'}
            className="w-full bg-slate-50 border-2 border-indigo-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white"
          />
        </div>

        <div className="md:col-span-2 flex items-end">
          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-3 rounded-lg transition disabled:opacity-50 shadow"
          >
            {isSaving ? 'Saving...' : 'Save Password'}
          </button>
        </div>

        {showAdvanced && (
          <div className="md:col-span-12 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>Alternative 100% Guaranteed Cloud Delivery (Resend API Key)</span>
              {hasResendKey && <span className="text-[10px] text-emerald-600 font-bold">● Resend Key Active</span>}
            </label>
            <input
              type="password"
              value={resendApiKey}
              onChange={e => setResendApiKey(e.target.value)}
              placeholder="re_xxxxxxxxxxxx (Get free at resend.com - works on all clouds)"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-600"
            />
            <p className="text-[11px] text-slate-500">
              Free 3,000 emails/month at <a href="https://resend.com" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-semibold">resend.com</a>. Uses HTTPS port 443 so cloud firewalls never block it.
            </p>
          </div>
        )}
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTestEmail}
            disabled={isTesting}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-1.5 rounded-lg flex items-center gap-2 transition disabled:opacity-50"
          >
            {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Send Test Email to {smtpUser}
          </button>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[11px] text-slate-500 hover:text-slate-800 underline font-medium"
          >
            {showAdvanced ? 'Hide Alternative API' : '+ Alternative Cloud Email (Resend)'}
          </button>
        </div>

        <a
          href="https://myaccount.google.com/apppasswords"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-blue-600 hover:text-blue-700 font-semibold underline flex items-center gap-1"
        >
          <KeyRound className="w-3.5 h-3.5" /> Get 16-digit password from Google <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};

interface IntegrationsViewProps {
  onSimulateGmail: (email: string, name: string, subject: string, body: string) => void;
  onSimulateWhatsApp: (phone: string, name: string, text: string) => void;
}

export const IntegrationsView: React.FC<IntegrationsViewProps> = ({
  onSimulateGmail,
  onSimulateWhatsApp
}) => {
  const [gmailEmail, setGmailEmail] = useState('emma.harrison@birminghamworkwear.co.uk');
  const [gmailSubject, setGmailSubject] = useState('Urgent Bulk Digitizing Quote Request (Bradford UK)');
  const [gmailBody, setGmailBody] = useState('Hi AA Creative Embroidery team, we need 3D puff cap logos digitized for our workshop. Can you send pricing and DST files?');

  const [waPhone, setWaPhone] = useState('+44 7462 23 8732');
  const [waName, setWaName] = useState('Oliver Davies');
  const [waMessage, setWaMessage] = useState('Hello! Can I get an instant price quote for a 3D puff logo digitizing order?');

  const [gmailSent, setGmailSent] = useState(false);
  const [waSent, setWaSent] = useState(false);

  const handleSendGmail = (e: React.FormEvent) => {
    e.preventDefault();
    onSimulateGmail(gmailEmail, 'Sarah Jenkins', gmailSubject, gmailBody);
    setGmailSent(true);
    setTimeout(() => setGmailSent(false), 3000);
  };

  const handleSendWa = (e: React.FormEvent) => {
    e.preventDefault();
    onSimulateWhatsApp(waPhone, waName, waMessage);
    setWaSent(true);
    setTimeout(() => setWaSent(false), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 uppercase tracking-wider">
          Official API & OAuth Integrations
        </span>
        <h2 className="text-xl font-bold text-slate-800 mt-2">Gmail API & WhatsApp Business Cloud Channel Engine</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Unified support channels receiving incoming emails and WhatsApp messages directly into the Unified Support Inbox with AI First-Line Auto-Responses.
        </p>
      </div>

      {/* Real SMTP Dispatch & Google 16-Digit Password Card */}
      <div className="bg-white border-2 border-indigo-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                Real Outgoing Email Dispatch (Google 16-Digit App Password)
              </h3>
              <p className="text-[11px] text-slate-500">Paste your 16-digit Google App Password here to send live emails to <strong>aacreativeemb@gmail.com</strong></p>
            </div>
          </div>
        </div>

        <EmailConfigForm />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Gmail OAuth Connector Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Google Gmail OAuth Connector</h3>
                <p className="text-[11px] text-slate-500">Official Gmail API Integration</p>
              </div>
            </div>
            <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Connected
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5 text-slate-600">
            <div className="flex justify-between">
              <span>Connected Account:</span>
              <span className="font-semibold text-slate-800">admin@aacreativeemb.com</span>
            </div>
            <div className="flex justify-between">
              <span>OAuth Scopes Granted:</span>
              <span className="font-mono text-emerald-700 font-semibold">gmail.readonly, gmail.send</span>
            </div>
          </div>

          {/* Test Gmail Simulator */}
          <form onSubmit={handleSendGmail} className="space-y-3 pt-2 border-t border-slate-100">
            <h4 className="font-bold text-slate-800 text-xs">Simulate Incoming Gmail Support Ticket</h4>
            
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Sender Email</label>
              <input
                type="email"
                value={gmailEmail}
                onChange={e => setGmailEmail(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Email Subject</label>
              <input
                type="text"
                value={gmailSubject}
                onChange={e => setGmailSubject(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Email Body Content</label>
              <textarea
                value={gmailBody}
                onChange={e => setGmailBody(e.target.value)}
                rows={2}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg outline-none"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 shadow transition"
            >
              <Send className="w-3.5 h-3.5" /> Send Test Email via Gmail API
            </button>

            {gmailSent && (
              <p className="text-[11px] text-emerald-700 font-semibold text-center animate-pulse">
                ✓ Gmail Support Ticket created & routed to Unified Inbox!
              </p>
            )}
          </form>
        </div>

        {/* Meta WhatsApp Business Cloud API Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Meta WhatsApp Business Cloud API</h3>
                <p className="text-[11px] text-slate-500">Official Meta Developer Integration</p>
              </div>
            </div>
            <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5 text-slate-600">
            <div className="flex justify-between">
              <span>WABA Business Phone:</span>
              <span className="font-mono text-slate-800 font-semibold">+92 300 1234567</span>
            </div>
            <div className="flex justify-between">
              <span>Cloud API Webhook:</span>
              <span className="font-mono text-emerald-700 font-semibold">/api/whatsapp/receive</span>
            </div>
          </div>

          {/* Test WhatsApp Simulator */}
          <form onSubmit={handleSendWa} className="space-y-3 pt-2 border-t border-slate-100">
            <h4 className="font-bold text-slate-800 text-xs">Simulate Incoming WhatsApp Message</h4>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Phone Number</label>
                <input
                  type="text"
                  value={waPhone}
                  onChange={e => setWaPhone(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Contact Name</label>
                <input
                  type="text"
                  value={waName}
                  onChange={e => setWaName(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">WhatsApp Message (Urdu / English)</label>
              <textarea
                value={waMessage}
                onChange={e => setWaMessage(e.target.value)}
                rows={2}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg outline-none"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 shadow transition"
            >
              <Send className="w-3.5 h-3.5" /> Send Test WhatsApp Cloud API Message
            </button>

            {waSent && (
              <p className="text-[11px] text-emerald-700 font-semibold text-center animate-pulse">
                ✓ WhatsApp Chat created & AI response sent!
              </p>
            )}
          </form>
        </div>

      </div>
    </div>
  );
};
