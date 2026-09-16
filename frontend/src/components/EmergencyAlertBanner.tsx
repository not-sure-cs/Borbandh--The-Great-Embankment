import React, { useState } from 'react';
import { PhoneCall, MessageSquare, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';
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
    <div 
      role="alert"
      aria-live="assertive"
      className={`w-full border-b transition-all duration-300 ${
        isBreach
          ? 'bg-rose-50 border-rose-200 text-rose-950 critical-pulse-box'
          : 'bg-amber-50 border-amber-200 text-amber-950'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        
        {/* Main Alert Message Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className={`p-2.5 rounded-xl border shrink-0 ${
              isBreach 
                ? 'bg-rose-600 text-white border-rose-500 animate-bounce shadow-2xs' 
                : 'bg-amber-500 text-white border-amber-400 shadow-2xs'
            }`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="font-bold tracking-tight text-xs sm:text-sm text-gray-900 uppercase">
                  {isBreach ? 'Critical Embankment Failure Imminent' : 'Emergency Seepage & Instability Warning'}
                </span>
                <span className="bg-white px-2.5 py-0.5 rounded-full font-mono text-xs font-bold border border-gray-200 text-gray-900 shadow-2xs">
                  F<sub>s</sub> = {fs.toFixed(3)}
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-0.5 font-normal">
                {activeCriticalTelemetry
                  ? `Automated early-warning triggered at ${activeCriticalTelemetry.zone_name} (${activeCriticalTelemetry.node_id}). Moisture: ${activeCriticalTelemetry.soil_moisture.toFixed(0)}%, Tilt: ${activeCriticalTelemetry.tilt_angle.toFixed(1)}°.`
                  : latest?.message ?? 'Emergency alert active.'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2 text-xs font-medium">
              <span className="px-3 py-1 rounded-full bg-white border border-gray-200 shadow-2xs flex items-center gap-1.5 text-blue-700">
                <PhoneCall className="w-3.5 h-3.5" /> Twilio DDMA SMS Active
              </span>
              <span className="px-3 py-1 rounded-full bg-white border border-gray-200 shadow-2xs flex items-center gap-1.5 text-emerald-700">
                <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Evac Sent
              </span>
            </div>

            <button
              onClick={() => setExpanded(!expanded)}
              className="px-3 py-1.5 rounded-full bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 transition-all text-xs font-medium flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              <span>{expanded ? 'Hide Logs' : 'View Logs'}</span>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Expandable Notification Dispatch Logs */}
        {expanded && (
          <div className="mt-4 pt-3.5 border-t border-gray-200/80 space-y-2.5 text-xs font-mono">
            <div className="font-sans font-semibold text-xs uppercase tracking-wider text-gray-700">
              Live Emergency Notification Transmission Log (Twilio SMS &amp; WhatsApp Business API)
            </div>
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {alerts.slice(0, 8).map((a) => (
                <div key={a.id} className="p-3 rounded-xl bg-white border border-gray-200 flex items-start justify-between gap-4 shadow-2xs">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        a.channel === 'TWILIO_SMS' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {a.channel}
                      </span>
                      <span className="font-semibold text-gray-900">{a.recipient}</span>
                    </div>
                    <p className="text-xs text-gray-600 font-sans">{a.message}</p>
                  </div>
                  <span className="text-[11px] text-gray-400 shrink-0 font-mono">
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
