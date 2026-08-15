import React, { useState } from 'react';
import { X, Copy, Check, Code2, Globe, Sparkles } from 'lucide-react';
import { Property } from '../types';

interface WidgetEmbedModalProps {
  property: Property;
  onClose: () => void;
}

export const WidgetEmbedModal: React.FC<WidgetEmbedModalProps> = ({ property, onClose }) => {
  const [copied, setCopied] = useState(false);

  const embedScript = `<!-- TawkAI Live Chat & AI Support Widget -->
<script>
  (function(w,d,s,l,i){
    w['TawkAIWidgetObject']=l;w[l]=w[l]||function(){(w[l].q=w[l].q||[]).push(arguments)};
    var f=d.getElementsByTagName(s)[0], j=d.createElement(s);j.async=true;
    j.src='${window.location.origin}/widget.js?property_id=${property.id}';
    f.parentNode.insertBefore(j,f);
  })(window,document,'script','tawkai');
</script>
<!-- End TawkAI Widget -->`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
        
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-base">
            <Code2 className="w-5 h-5" />
            <span>Install TawkAI Live Chat Widget</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Copy and paste this lightweight JavaScript snippet right before the closing <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600 font-mono">&lt;/body&gt;</code> tag on <strong>{property.domain}</strong> or any website to make live chat & AI support live instantly.
        </p>

        <div className="relative bg-slate-950 text-slate-200 font-mono text-xs p-4 rounded-xl overflow-x-auto shadow-inner border border-slate-800">
          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-sans font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied Snippet!' : 'Copy Snippet'}</span>
          </button>
          <pre className="whitespace-pre-wrap">{embedScript}</pre>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p>
            Once installed, your website visitors will see the live chat bubble with AI First-Line support, Roman Urdu / Urdu language detection, and automatic human agent fallback!
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-5 py-2 rounded-xl shadow transition"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
