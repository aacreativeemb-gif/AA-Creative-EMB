import React from 'react';
import { Sliders, Zap, CheckCircle2, Plus, Play, ShieldAlert } from 'lucide-react';
import { TriggerRule } from '../types';

interface AutomationsViewProps {
  triggers: TriggerRule[];
  onToggleTrigger: (id: string) => void;
}

export const AutomationsView: React.FC<AutomationsViewProps> = ({ triggers, onToggleTrigger }) => {
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200 uppercase tracking-wider">
            Automations & Triggers Engine
          </span>
          <h2 className="text-xl font-bold text-slate-800 mt-2">Proactive Visitor & SLA Automation Rules</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure automated greeting popups, priority escalators, and SLA breach triggers.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {triggers.map(rule => (
          <div key={rule.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                {rule.name}
              </h3>
              <button
                onClick={() => onToggleTrigger(rule.id)}
                className={`text-xs font-bold px-3 py-1 rounded-full transition ${
                  rule.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {rule.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-2 border border-slate-200 font-mono">
              <div className="text-blue-700">
                <strong>WHEN:</strong> {rule.conditionType.toUpperCase()} = "{rule.conditionValue}"
              </div>
              <div className="text-emerald-700">
                <strong>THEN ACTION:</strong> {rule.actionType.toUpperCase()} ("{rule.actionValue}")
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
