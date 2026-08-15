import React, { useState } from 'react';
import {
  Bot,
  Sliders,
  BookOpen,
  Sparkles,
  ShieldAlert,
  Save,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  Plus,
  Trash2,
  Globe,
  Settings,
  Sparkle
} from 'lucide-react';
import { AiSettings, AiQcFeedback, UnansweredQuestion } from '../types';

interface AiAdminPanelProps {
  aiSettings: AiSettings;
  onSaveAiSettings: (settings: Partial<AiSettings>) => void;
  qcFeedbacks: AiQcFeedback[];
  unansweredQuestions: UnansweredQuestion[];
}

export const AiAdminPanel: React.FC<AiAdminPanelProps> = ({
  aiSettings,
  onSaveAiSettings,
  qcFeedbacks,
  unansweredQuestions
}) => {
  const [formState, setFormState] = useState<AiSettings>(aiSettings);
  const [newKeyword, setNewKeyword] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'knowledge' | 'behavior' | 'qc'>('knowledge');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveAiSettings(formState);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return;
    if (!formState.escalationKeywords.includes(newKeyword.trim().toLowerCase())) {
      setFormState({
        ...formState,
        escalationKeywords: [...formState.escalationKeywords, newKeyword.trim().toLowerCase()]
      });
    }
    setNewKeyword('');
  };

  const handleRemoveKeyword = (kw: string) => {
    setFormState({
      ...formState,
      escalationKeywords: formState.escalationKeywords.filter(k => k !== kw)
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 text-white p-6 rounded-2xl shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-blue-400 bg-blue-900/60 px-3 py-1 rounded-full border border-blue-500/30 flex items-center gap-1.5 w-max">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            AI First-Line Customer Support System
          </span>
          <h1 className="text-2xl font-black mt-2 flex items-center gap-2">
            AI Agent Configuration & Knowledge Engine
          </h1>
          <p className="text-xs text-blue-200 mt-1 max-w-2xl">
            Configure approved business knowledge, Roman Urdu/Urdu multilingual behavior, confidence threshold rules, and smart escalation triggers.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="bg-blue-500 hover:bg-blue-400 text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition"
        >
          <Save className="w-4 h-4" /> Save All AI Settings
        </button>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          AI Customer Support Knowledge and Settings successfully updated and active on server!
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs">
        <button
          onClick={() => setActiveTab('knowledge')}
          className={`px-4 py-2.5 font-bold rounded-t-xl transition border-b-2 ${
            activeTab === 'knowledge'
              ? 'border-blue-600 text-blue-600 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          📚 Approved Business Knowledge Source
        </button>
        <button
          onClick={() => setActiveTab('behavior')}
          className={`px-4 py-2.5 font-bold rounded-t-xl transition border-b-2 ${
            activeTab === 'behavior'
              ? 'border-blue-600 text-blue-600 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          ⚙️ Behavior, Escalation & Confidence
        </button>
        <button
          onClick={() => setActiveTab('qc')}
          className={`px-4 py-2.5 font-bold rounded-t-xl transition border-b-2 ${
            activeTab === 'qc'
              ? 'border-blue-600 text-blue-600 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          🔍 AI Quality Control & Unanswered Log ({unansweredQuestions.length})
        </button>
      </div>

      {/* Tab 1: Knowledge Source */}
      {activeTab === 'knowledge' && (
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">
              Business Profile & Products
            </h3>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Business Name</label>
              <input
                type="text"
                value={formState.businessName}
                onChange={e => setFormState({ ...formState, businessName: e.target.value })}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Products & Services Knowledge</label>
              <textarea
                value={formState.productsAndServices}
                onChange={e => setFormState({ ...formState, productsAndServices: e.target.value })}
                rows={5}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Pricing & Payment Rules</label>
              <textarea
                value={formState.pricingInfo}
                onChange={e => setFormState({ ...formState, pricingInfo: e.target.value })}
                rows={3}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">
              FAQs, Shipping & Return Policies
            </h3>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Approved FAQs</label>
              <textarea
                value={formState.faqsText}
                onChange={e => setFormState({ ...formState, faqsText: e.target.value })}
                rows={4}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Return & Refund Policy Rules</label>
              <textarea
                value={formState.returnRefundPolicy}
                onChange={e => setFormState({ ...formState, returnRefundPolicy: e.target.value })}
                rows={2}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Shipping & Courier Details</label>
              <textarea
                value={formState.shippingInfo}
                onChange={e => setFormState({ ...formState, shippingInfo: e.target.value })}
                rows={2}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Custom Instructions (Roman Urdu / Language Rules)</label>
              <textarea
                value={formState.customInstructions}
                onChange={e => setFormState({ ...formState, customInstructions: e.target.value })}
                rows={3}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </form>
      )}

      {/* Tab 2: Behavior & Escalation */}
      {activeTab === 'behavior' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">
              AI Support Mode & Confidence Threshold
            </h3>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">AI Operating Mode</label>
              <select
                value={formState.mode}
                onChange={e => setFormState({ ...formState, mode: e.target.value as any })}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ai_first">AI-First Support (AI responds first, escalates to human on request/low confidence)</option>
                <option value="human_first">Human-First Support (Agents handle, AI assists with summaries)</option>
                <option value="ai_only">AI-Only Mode (AI handles 100% of chats)</option>
                <option value="outside_hours_only">AI Outside Business Hours Only</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-700">AI Confidence Score Threshold</label>
                <span className="font-bold text-blue-600 text-xs">{formState.confidenceThreshold}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={95}
                value={formState.confidenceThreshold}
                onChange={e => setFormState({ ...formState, confidenceThreshold: Number(e.target.value) })}
                className="w-full accent-blue-600"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                If the AI's internal response confidence falls below <strong>{formState.confidenceThreshold}%</strong>, it will automatically escalate the conversation to a human agent.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">AI Personality / Tone</label>
              <select
                value={formState.personality}
                onChange={e => setFormState({ ...formState, personality: e.target.value as any })}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 capitalize"
              >
                {['professional', 'friendly', 'formal', 'casual', 'sales', 'technical'].map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Admin Roman Urdu & Agent Translation Settings */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <h4 className="font-bold text-slate-800 text-xs text-blue-900 uppercase tracking-wider">
                🇵🇰 Roman Urdu Admin Translator & Polish Rules
              </h4>

              <label className="flex items-start gap-2 cursor-pointer bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <input
                  type="checkbox"
                  checked={formState.enableRomanUrduAdminTranslation !== false}
                  onChange={e => setFormState({ ...formState, enableRomanUrduAdminTranslation: e.target.checked })}
                  className="mt-0.5 accent-blue-600"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800 block">Admin Roman Urdu Auto-Translation</span>
                  <span className="text-slate-500 text-[11px]">When visitor replies in English, display a Roman Urdu translation directly below the message in the Admin Inbox.</span>
                </div>
              </label>

              <label className="flex items-start gap-2 cursor-pointer bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <input
                  type="checkbox"
                  checked={formState.enableAgentAutoEnglishTranslation !== false}
                  onChange={e => setFormState({ ...formState, enableAgentAutoEnglishTranslation: e.target.checked })}
                  className="mt-0.5 accent-blue-600"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800 block">Agent Auto-English Polish Engine</span>
                  <span className="text-slate-500 text-[11px]">If agent replies in Roman Urdu or rough English, AI auto-converts it into flawless British English for the visitor.</span>
                </div>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">WhatsApp Urgent Fallback Number</label>
                  <input
                    type="text"
                    value={formState.whatsappFallbackNumber || '+44 7462 23 8732'}
                    onChange={e => setFormState({ ...formState, whatsappFallbackNumber: e.target.value })}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Urgent Fallback Email</label>
                  <input
                    type="text"
                    value={formState.fallbackEmail || 'admin@aacreativeemb.com'}
                    onChange={e => setFormState({ ...formState, fallbackEmail: e.target.value })}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">
              Human Agent Escalation Keywords
            </h3>
            <p className="text-xs text-slate-500">
              When a customer message contains any of these keywords (in English, Urdu or Roman Urdu), the system will immediately trigger a <strong>Smart Escalation</strong> and hand off to a human agent.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={newKeyword}
                onChange={e => setNewKeyword(e.target.value)}
                placeholder="Add escalation keyword (e.g. insan, gusa, refund)..."
                className="flex-1 text-xs p-2 border border-slate-300 rounded-lg outline-none"
              />
              <button
                type="button"
                onClick={handleAddKeyword}
                className="bg-blue-600 text-white text-xs px-3 py-2 rounded-lg font-semibold flex items-center gap-1 shadow"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-2">
              {formState.escalationKeywords.map(kw => (
                <span
                  key={kw}
                  className="bg-amber-50 text-amber-900 border border-amber-200 text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-medium"
                >
                  {kw}
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(kw)}
                    className="text-amber-700 hover:text-red-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: QC & Unanswered Log */}
      {activeTab === 'qc' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h3 className="font-bold text-slate-800 text-sm mb-3">AI Response Quality Control Log</h3>
            <div className="space-y-3">
              {qcFeedbacks.map(qc => (
                <div key={qc.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">Query: "{qc.query}"</span>
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${qc.rating === 'good' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                      {qc.rating.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-slate-600 font-mono text-[11px]">{qc.aiResponse}</p>
                  {qc.notes && <p className="text-slate-500 italic text-[11px] pt-1">Note: {qc.notes}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h3 className="font-bold text-slate-800 text-sm mb-2">Unanswered Questions Log</h3>
            <p className="text-xs text-slate-500 mb-3">Questions where the AI requested human fallback. Click "Add to Knowledge Base" to teach the AI!</p>
            <div className="space-y-2">
              {unansweredQuestions.map(uq => (
                <div key={uq.id} className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs flex items-center justify-between">
                  <div>
                    <p className="font-bold text-amber-950">"{uq.query}"</p>
                    <p className="text-[10px] text-amber-800 mt-0.5">Asked {uq.count} times by visitors</p>
                  </div>
                  <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-semibold text-xs shadow-2xs">
                    + Add to Knowledge Base
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
