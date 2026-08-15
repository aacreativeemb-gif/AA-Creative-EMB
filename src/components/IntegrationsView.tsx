import React, { useState } from 'react';
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
  RefreshCw
} from 'lucide-react';

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
