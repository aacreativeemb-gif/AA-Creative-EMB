import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Paperclip,
  Smile,
  Bot,
  User,
  ShieldCheck,
  Star,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Globe,
  Headphones
} from 'lucide-react';
import { Property, Conversation, Message, AiSettings } from '../types';

interface VisitorWidgetProps {
  property: Property;
  aiSettings: AiSettings;
  activeConversation?: Conversation;
  messages: Message[];
  onSendMessage: (text: string, attachments?: any[]) => void;
  onEscalate: () => void;
  onEndChat: (rating?: number, feedback?: string) => void;
  isAiHandling: boolean;
  onlineAgentCount: number;
}

export const VisitorWidget: React.FC<VisitorWidgetProps> = ({
  property,
  aiSettings,
  activeConversation,
  messages,
  onSendMessage,
  onEscalate,
  onEndChat,
  isAiHandling,
  onlineAgentCount
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [inputMessage, setInputMessage] = useState('');
  const [visitorName, setVisitorName] = useState('Ali Raza');
  const [visitorEmail, setVisitorEmail] = useState('ali.raza@gmail.com');
  const [hasStartedChat, setHasStartedChat] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState('Roman Urdu / English');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleStartChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorName.trim() || !visitorEmail.trim()) return;
    setHasStartedChat(true);
    if (messages.length === 0) {
      onSendMessage(`Hello! My name is ${visitorName}. I need assistance.`);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    const textToSend = inputMessage;
    setInputMessage('');
    
    // Quick client language detection display hint
    if (textToSend.match(/[\u0600-\u06FF]/)) setDetectedLanguage('Urdu (اردو)');
    else if (textToSend.toLowerCase().match(/(pohanchy|batao|karo|nahi|hai|bhai|bhej|mila)/)) setDetectedLanguage('Roman Urdu');
    else setDetectedLanguage('English');

    setIsTyping(true);
    onSendMessage(textToSend);

    setTimeout(() => {
      setIsTyping(false);
    }, 1200);
  };

  const handleQuickPrompt = (promptText: string) => {
    setInputMessage('');
    setIsTyping(true);
    onSendMessage(promptText);
    setTimeout(() => {
      setIsTyping(false);
    }, 1200);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Testbench Control Instructions Panel */}
      <div className="md:col-span-1 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            Live Preview & Testbench
          </span>
          <h2 className="text-lg font-bold text-slate-800 mt-2">Embeddable Visitor Widget</h2>
          <p className="text-xs text-slate-600 mt-1">
            This widget simulates how live visitors experience support on <strong>{property.domain}</strong>.
          </p>
        </div>

        <div className="space-y-2 border-t border-slate-100 pt-3">
          <label className="text-xs font-semibold text-slate-700">Simulate Digitizing & Multilingual Prompts:</label>
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => handleQuickPrompt('Hello! Need 3D puff cap logo digitizing rate for Tajima DST file in London')}
              className="text-left text-xs bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 p-2 rounded-lg border border-slate-200 transition"
            >
              🧵 <strong>English Inquiry:</strong> "Cap 3D puff DST file rates?"
            </button>
            <button
              onClick={() => handleQuickPrompt('mujhe cap digitizing rates or DST file kitni jaldi milegi?')}
              className="text-left text-xs bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 p-2 rounded-lg border border-slate-200 transition"
            >
              🇵🇰 <strong>Roman Urdu:</strong> "cap digitizing rates kitni jaldi milegi?"
            </button>
            <button
              onClick={() => handleQuickPrompt('bohat urgent hai, agent se baat karwao foran!')}
              className="text-left text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 p-2 rounded-lg border border-amber-200 transition"
            >
              ⚡ <strong>Urgent Handoff & WhatsApp Suggest:</strong> "urgent agent se baat karwao"
            </button>
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-2 border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-medium">Handling State:</span>
            <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${isAiHandling ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {isAiHandling ? '🤖 AI First-Line Support' : '👤 Human Agent Active'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-medium">Online Agents:</span>
            <span className="font-semibold text-slate-800">{onlineAgentCount} Available</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-medium">Detected Language:</span>
            <span className="font-semibold text-slate-800 flex items-center gap-1">
              <Globe className="w-3 h-3 text-blue-500" /> {detectedLanguage}
            </span>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={onEscalate}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-2 shadow transition"
          >
            <Headphones className="w-4 h-4" />
            <span>Simulate Manual Agent Request</span>
          </button>
        </div>
      </div>

      {/* Widget Simulator Window */}
      <div className="md:col-span-2 flex flex-col items-center justify-center">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col h-[580px] relative">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center font-bold text-white shadow">
                  {isAiHandling ? <Bot className="w-6 h-6 text-white" /> : <User className="w-6 h-6 text-white" />}
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-blue-600 rounded-full" />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight flex items-center gap-1.5">
                  {aiSettings.businessName}
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                </h3>
                <p className="text-[11px] text-blue-100 flex items-center gap-1 mt-0.5">
                  {isAiHandling ? (
                    <>
                      <Bot className="w-3 h-3 text-blue-200" />
                      <span>{aiSettings.aiName} (AI First-Line)</span>
                    </>
                  ) : (
                    <>
                      <Headphones className="w-3 h-3 text-emerald-300" />
                      <span>Connected with Human Support Agent</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowRatingModal(true)}
                className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
                title="End & Rate Chat"
              >
                <Star className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {!hasStartedChat ? (
              <form onSubmit={handleStartChat} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 mt-4">
                <h4 className="font-bold text-slate-800 text-sm">Start Live Chat Support</h4>
                <p className="text-xs text-slate-500">{aiSettings.customGreeting}</p>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Your Name</label>
                  <input
                    type="text"
                    value={visitorName}
                    onChange={e => setVisitorName(e.target.value)}
                    required
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ali Raza"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Email Address</label>
                  <input
                    type="email"
                    value={visitorEmail}
                    onChange={e => setVisitorEmail(e.target.value)}
                    required
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="ali.raza@gmail.com"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2.5 rounded-lg shadow transition"
                >
                  Start Conversation
                </button>
              </form>
            ) : (
              <>
                {/* Greeting Banner */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-900 flex items-start gap-2.5 shadow-none">
                  <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-blue-950">Official Customer Support Channel</p>
                    <p className="text-[11px] text-blue-800 mt-0.5">{aiSettings.customGreeting}</p>
                  </div>
                </div>

                {/* Queue Position badge if escalated */}
                {!isAiHandling && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs text-emerald-800 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Headphones className="w-3.5 h-3.5 text-emerald-600" />
                      Human Agent Connected
                    </span>
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded">
                      #1 in Line
                    </span>
                  </div>
                )}

                {/* Messages Stream */}
                {messages.map(msg => {
                  const isVisitor = msg.senderType === 'visitor';
                  const isSystem = msg.senderType === 'system';
                  const isAi = msg.senderType === 'ai';

                  if (isSystem) {
                    return (
                      <div key={msg.id} className="text-center my-2">
                        <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1 rounded-full font-medium inline-block shadow-2xs">
                          {msg.text}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isVisitor ? 'items-end' : 'items-start'} my-1.5`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5 px-1">
                        <span className="text-[10px] font-semibold text-slate-500">
                          {msg.senderName}
                        </span>
                        {isAi && (
                          <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-bold">
                            AI
                          </span>
                        )}
                        <span className="text-[9px] text-slate-400">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div
                        className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-2xs ${
                          isVisitor
                            ? 'bg-blue-600 text-white rounded-br-xs'
                            : isAi
                            ? 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                            : 'bg-emerald-700 text-white rounded-bl-xs'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                        {msg.confidenceScore && (
                          <div className="mt-1 pt-1 border-t border-slate-100 text-[9px] text-slate-400 flex items-center justify-between">
                            <span>Confidence: {msg.confidenceScore}%</span>
                            {msg.languageDetected && <span>{msg.languageDetected}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Typing Indicator */}
                {isTyping && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs my-2 px-2">
                    <Bot className="w-4 h-4 text-blue-500 animate-bounce" />
                    <span className="italic text-[11px] text-slate-500">AI Support Agent is typing...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Message Input Form */}
          {hasStartedChat && (
            <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
              <button
                type="button"
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition"
                title="Attach document/image"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                placeholder="Type message in English, Urdu or Roman Urdu..."
                className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim()}
                className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl shadow transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Rating Modal overlay */}
          {showRatingModal && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-20">
              <div className="bg-white rounded-2xl p-5 w-full max-w-xs text-center space-y-3 shadow-xl">
                <h4 className="font-bold text-slate-800 text-sm">Rate Your Support Session</h4>
                <p className="text-xs text-slate-500">How was your conversation with our team?</p>
                <div className="flex justify-center gap-2 py-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`p-1.5 rounded-lg transition ${
                        rating && rating >= star ? 'text-amber-400 scale-110' : 'text-slate-300'
                      }`}
                    >
                      <Star className="w-6 h-6 fill-current" />
                    </button>
                  ))}
                </div>
                <textarea
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  placeholder="Optional comments..."
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-none"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowRatingModal(false)}
                    className="w-1/2 text-xs py-2 border border-slate-300 rounded-lg text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      onEndChat(rating || 5, feedbackText);
                      setShowRatingModal(false);
                    }}
                    className="w-1/2 text-xs py-2 bg-blue-600 text-white font-semibold rounded-lg shadow"
                  >
                    Submit Rating
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
