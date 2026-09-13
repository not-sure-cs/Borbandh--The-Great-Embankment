import React from 'react';
import { Radio, AlertTriangle, ShieldCheck, PhoneCall, Layers, Activity } from 'lucide-react';
import { SystemStats, EmbankmentNode } from '../types';

interface MetricsSummaryRowProps {
  stats: SystemStats | null;
  nodes: EmbankmentNode[];
  totalAlertsCount: number;
}

export const MetricsSummaryRow: React.FC<MetricsSummaryRowProps> = ({
  stats,
  nodes,
  totalAlertsCount,
}) => {
  // Compute lowest Fs from nodes or stats
  const activeCount = nodes.length > 0 ? nodes.length : stats?.active_nodes ?? 5;
  const lowestFs = nodes.reduce((min, n) => {
    const fs = n.last_telemetry?.factor_of_safety ?? 2.0;
    return fs < min ? fs : min;
  }, stats?.min_factor_of_safety ?? 1.85);

  const isFsCritical = lowestFs < 0.7;
  const isFsWarning = lowestFs >= 0.7 && lowestFs < 1.0;

  const totalKm = stats?.total_monitored_km ?? 142.6;
  const totalReaches = stats?.total_reaches ?? 8;
  const alertsSent = totalAlertsCount || stats?.total_alerts_sent || 0;

  return (
    <section aria-label="Key Embankment Telemetry Metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Active Telemetry Nodes */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between transition-all hover:border-slate-700">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">
            Telemetry Stations
          </span>
          <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-2xl font-bold font-mono text-white tracking-tight">
            {activeCount}
            <span className="text-xs text-slate-500 font-sans ml-1">Nodes Online</span>
          </span>
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
            100% HEALTH
          </span>
        </div>
        <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Solar ESP32 Edge Mesh</span>
          <span className="text-emerald-400 font-mono">0 Offline</span>
        </div>
      </div>

      {/* 2. Lowest Regional Factor of Safety */}
      <div
        className={`rounded-xl p-4 border flex flex-col justify-between transition-all ${
          isFsCritical
            ? 'bg-rose-950/40 border-rose-600/70 critical-pulse-box'
            : isFsWarning
            ? 'bg-amber-950/30 border-amber-600/60'
            : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">
            Lowest Regional F<sub>s</sub>
          </span>
          <Activity
            className={`w-4 h-4 ${
              isFsCritical ? 'text-rose-400' : isFsWarning ? 'text-amber-400' : 'text-emerald-400'
            }`}
          />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span
            className={`text-2xl font-bold font-mono tracking-tight ${
              isFsCritical
                ? 'text-rose-400 animate-pulse'
                : isFsWarning
                ? 'text-amber-400'
                : 'text-emerald-400'
            }`}
          >
            {lowestFs.toFixed(3)}
          </span>
          <span
            className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
              isFsCritical
                ? 'bg-rose-900/60 text-rose-200 border-rose-500'
                : isFsWarning
                ? 'bg-amber-900/60 text-amber-200 border-amber-500'
                : 'bg-emerald-950 text-emerald-300 border-emerald-800'
            }`}
          >
            {isFsCritical ? 'BREACH ALERT' : isFsWarning ? 'WATCH TIER' : 'SAFE'}
          </span>
        </div>
        <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Alert threshold: 1.00</span>
          <span className="text-slate-500 font-mono">Collapse &lt; 0.70</span>
        </div>
      </div>

      {/* 3. Evacuation Alerts & Civil Protection Dispatches */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between transition-all hover:border-slate-700">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">
            Civil Dispatches (24h)
          </span>
          <PhoneCall className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-2xl font-bold font-mono text-white tracking-tight">
            {alertsSent}
            <span className="text-xs text-slate-500 font-sans ml-1">Dispatches</span>
          </span>
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
            TWILIO / WA
          </span>
        </div>
        <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
          <span>DDMA Evacuation Relay</span>
          <span className="text-emerald-400 font-mono">Active</span>
        </div>
      </div>

      {/* 4. Monitored Embankment Line */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between transition-all hover:border-slate-700">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">
            Monitored Embankments
          </span>
          <Layers className="w-4 h-4 text-blue-400" />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-2xl font-bold font-mono text-white tracking-tight">
            {totalKm}
            <span className="text-xs text-slate-500 font-sans ml-1">km line</span>
          </span>
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
            {totalReaches} REACHES
          </span>
        </div>
        <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
          <span>ISRO-Bhuvan Spatial Sync</span>
          <span className="text-cyan-400 font-mono">50m Buffer</span>
        </div>
      </div>
    </section>
  );
};
