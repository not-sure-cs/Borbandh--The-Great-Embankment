import React, { useState } from 'react';
import { AlertCircle, BellRing, PhoneCall, MessageSquare, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';
import { AlertLog, NodeTelemetry } from '../types';

interface EmergencyAlertBannerProps {
  alerts: AlertLog[];
  activeCriticalTelemetry: NodeTelemetry | null;
}

export const EmergencyAlertBanner: React.FC<EmergencyAlertBannerProps> = ({
  alerts,
  activeCriticalTelemetry,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!activeCriticalTelemetry && alerts.length === 0) {
    return null;
  }

  const latest = alerts[0];
  const fs = activeCriticalTelemetry ? activeCriticalTelemetry.factor_of_safety : latest?.factor_of_safety ?? 0.5;
  const isBreach = fs < 0.7;

  return (
    <div className={`w-full border-b transition-all duration-300 ${
      isBreach
        ? 'bg-rose-950/90 border-rose-600/80 text-white critical-pulse-box'
        : 'bg-amber-950/80 border-amber-600/60 text-amber-100'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        
        {/* Main Alert Message Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-xl border ${
              isBreach 
                ? 'bg-rose-600 text-white border-rose-400 animate-bounce' 
                : 'bg-amber-500 text-slate-950 border-amber-300'
            }`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold tracking-wide uppercase text-xs sm:text-sm">
                  {isBreach ? 'CRITICAL EMBANKMENT FAILURE IMMINENT' : 'EMERGENCY SEEPAGE & INSTABILITY WARNING'}
                </span>
                <span className="bg-black/40 px-2 py-0.5 rounded font-mono text-xs font-bold">
                  F<sub>s</sub> = {fs.toFixed(3)}
                </span>
              </div>
              <p className="text-xs opacity-90 mt-0.5">
                {activeCriticalTelemetry
                  ? `Automated early-warning triggered at ${activeCriticalTelemetry.zone_name} (Node: ${activeCriticalTelemetry.node_id}). Moisture: ${activeCriticalTelemetry.soil_moisture.toFixed(0)}%, Tilt: ${activeCriticalTelemetry.tilt_angle.toFixed(1)}°.`
                  : latest?.message ?? 'Emergency alert active.'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2 text-xs font-mono">
              <span className="px-2 py-1 rounded bg-black/40 border border-white/10 flex items-center gap-1">
                <PhoneCall className="w-3 h-3 text-cyan-300" /> Twilio DDMA SMS Active
              </span>
              <span className="px-2 py-1 rounded bg-black/40 border border-white/10 flex items-center gap-1">
                <MessageSquare className="w-3 h-3 text-emerald-300" /> WhatsApp Evac Sent
              </span>
            </div>

            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg bg-black/30 hover:bg-black/50 text-white transition-all text-xs flex items-center gap-1"
            >
              <span>{expanded ? 'Hide Logs' : 'View Logs'}</span>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Expandable Notification Dispatch Logs */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-white/15 space-y-2 text-xs font-mono">
            <div className="font-sans font-bold text-xs uppercase tracking-wider text-slate-200">
              Live Emergency Notification Transmission Log (Twilio SMS & WhatsApp Business API)
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {alerts.slice(0, 8).map((a) => (
                <div key={a.id} className="p-2 rounded bg-black/40 border border-white/10 flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        a.channel === 'TWILIO_SMS' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {a.channel}
                      </span>
                      <span className="font-semibold text-white">{a.recipient}</span>
                    </div>
                    <p className="text-[11px] opacity-80 font-sans">{a.message}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {new Date(a.sent_at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
