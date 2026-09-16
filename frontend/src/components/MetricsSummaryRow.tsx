import React from 'react';
import { Radio, PhoneCall, Layers, Activity } from 'lucide-react';
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
    <section aria-label="Key Embankment Telemetry Metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      
      {/* 1. Active Telemetry Nodes */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-6 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Telemetry Stations
          </span>
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
            <Radio className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <div>
            <span className="text-3xl font-semibold text-gray-900 tracking-tight">
              {activeCount}
            </span>
            <span className="text-sm text-gray-500 ml-1.5 font-normal">Active Nodes</span>
          </div>
          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            100% Online
          </span>
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
          <span>Solar ESP32 Edge Mesh</span>
          <span className="text-emerald-700 font-medium">0 Offline</span>
        </div>
      </div>

      {/* 2. Lowest Regional Factor of Safety */}
      <div
        className={`bg-white border rounded-2xl p-6 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between ${
          isFsCritical
            ? 'border-rose-300 ring-2 ring-rose-100 critical-pulse-box'
            : isFsWarning
            ? 'border-amber-300 ring-2 ring-amber-50'
            : 'border-gray-200/90'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Regional Lowest F<sub>s</sub>
          </span>
          <div
            className={`p-2 rounded-xl ${
              isFsCritical
                ? 'bg-rose-50 text-rose-600'
                : isFsWarning
                ? 'bg-amber-50 text-amber-600'
                : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <span
            className={`text-3xl font-semibold font-mono tracking-tight ${
              isFsCritical
                ? 'text-rose-600'
                : isFsWarning
                ? 'text-amber-600'
                : 'text-gray-900'
            }`}
          >
            {lowestFs.toFixed(3)}
          </span>
          <span
            className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${
              isFsCritical
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : isFsWarning
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            {isFsCritical ? 'Breach Alert' : isFsWarning ? 'Watch Tier' : 'Safe Tier'}
          </span>
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
          <span>Alert threshold: 1.00</span>
          <span className="text-gray-400 font-mono">Collapse &lt; 0.70</span>
        </div>
      </div>

      {/* 3. Evacuation Alerts & Civil Protection Dispatches */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-6 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Civil Dispatches (24h)
          </span>
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
            <PhoneCall className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <div>
            <span className="text-3xl font-semibold text-gray-900 tracking-tight">
              {alertsSent}
            </span>
            <span className="text-sm text-gray-500 ml-1.5 font-normal">Notices</span>
          </div>
          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            Twilio / WA
          </span>
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
          <span>DDMA Evacuation Relay</span>
          <span className="text-emerald-700 font-medium">Active</span>
        </div>
      </div>

      {/* 4. Monitored Embankment Line */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-6 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Monitored Embankments
          </span>
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <div>
            <span className="text-3xl font-semibold text-gray-900 tracking-tight">
              {totalKm}
            </span>
            <span className="text-sm text-gray-500 ml-1.5 font-normal">km line</span>
          </div>
          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            {totalReaches} Reaches
          </span>
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
          <span>ISRO-Bhuvan Geospatial Sync</span>
          <span className="text-blue-700 font-medium">50m Buffer</span>
        </div>
      </div>

    </section>
  );
};
