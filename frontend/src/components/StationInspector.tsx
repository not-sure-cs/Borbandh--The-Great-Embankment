import React, { useState } from 'react';
import { 
  EmbankmentNode, 
  AlertLog, 
  CitizenReport 
} from '../types';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Cpu, 
  Satellite, 
  PhoneCall, 
  MessageSquare, 
  Users, 
  Droplets, 
  Compass, 
  Volume2, 
  Waves, 
  ExternalLink,
  ChevronRight,
  Zap
} from 'lucide-react';
import { SafetyGauge } from './SafetyGauge';

interface StationInspectorProps {
  node: EmbankmentNode | null;
  alerts: AlertLog[];
  onOpenSimModal?: () => void;
}

export const StationInspector: React.FC<StationInspectorProps> = ({
  node,
  alerts,
  onOpenSimModal,
}) => {
  const [activeTab, setActiveTab] = useState<'formula' | 'hydraulic' | 'alerts' | 'crowdsource'>('formula');

  if (!node) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-8 text-center text-slate-400 text-xs">
        Select an embankment station from the table to view real-time diagnostics.
      </div>
    );
  }

  const telemetry = node.last_telemetry;
  const moisture = telemetry?.soil_moisture ?? 35.0;
  const tilt = telemetry?.tilt_angle ?? 1.2;
  const audio = telemetry?.audio_rms ?? 25.0;

  // Exact BorBandh Machine Learning Regression Formula:
  // Fs = 2.0 - (0.012 * Moisture) - (0.04 * Tilt) - (0.001 * Audio)
  const moisturePenalty = 0.012 * moisture;
  const tiltPenalty = 0.04 * tilt;
  const audioPenalty = 0.001 * audio;
  const rawFs = 2.0 - moisturePenalty - tiltPenalty - audioPenalty;
  const fs = Math.max(0, telemetry?.factor_of_safety ?? rawFs);

  const isCritical = fs < 0.7;
  const isWarning = fs >= 0.7 && fs < 1.0;

  // Filter alerts related to this node
  const nodeAlerts = alerts.filter((a) => a.node_id === node.node_id || alerts.length <= 3);

  // Mock hydraulic & satellite data (representative of CWC & Sentinel-1 SAR ingestion)
  const cwcWaterLevel = 49.8 + (moisture / 100) * 3.5;
  const cwcDangerLevel = 52.5;
  const freeboard = Math.max(0, cwcDangerLevel - cwcWaterLevel + 1.2);
  const sarBackscatterDb = -18.5 + (moisture / 100) * 12.0;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
      {/* Top Station Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-bold text-cyan-400 uppercase bg-cyan-950/80 border border-cyan-800 px-2 py-0.5 rounded">
              {node.node_id}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {node.river} Basin • {node.latitude.toFixed(4)}°N, {node.longitude.toFixed(4)}°E
            </span>
          </div>
          <h2 className="text-base font-bold text-white mt-1">
            {node.zone_name} Embankment Reach
          </h2>
        </div>

        <div className="flex items-center space-x-2">
          {onOpenSimModal && (
            <button
              onClick={onOpenSimModal}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulate Node</span>
            </button>
          )}
          <div
            className={`px-3 py-1 rounded-lg text-xs font-bold font-mono border ${
              isCritical
                ? 'bg-rose-900/60 text-rose-200 border-rose-500 animate-pulse'
                : isWarning
                ? 'bg-amber-900/60 text-amber-200 border-amber-500'
                : 'bg-emerald-950 text-emerald-300 border-emerald-800'
            }`}
          >
            F<sub>s</sub> = {fs.toFixed(3)}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center border-b border-slate-800 bg-slate-950/40 px-3 overflow-x-auto scrollbar-none text-xs">
        <button
          onClick={() => setActiveTab('formula')}
          className={`py-2.5 px-3 border-b-2 font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'formula'
              ? 'border-cyan-400 text-cyan-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Stability Formula (F<sub>s</sub>)</span>
        </button>

        <button
          onClick={() => setActiveTab('hydraulic')}
          className={`py-2.5 px-3 border-b-2 font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'hydraulic'
              ? 'border-cyan-400 text-cyan-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Satellite className="w-3.5 h-3.5" />
          <span>CWC &amp; Satellite Vectors</span>
        </button>

        <button
          onClick={() => setActiveTab('alerts')}
          className={`py-2.5 px-3 border-b-2 font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'alerts'
              ? 'border-cyan-400 text-cyan-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>Emergency Dispatch ({nodeAlerts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('crowdsource')}
          className={`py-2.5 px-3 border-b-2 font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'crowdsource'
              ? 'border-cyan-400 text-cyan-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Citizen Triage</span>
        </button>
      </div>

      {/* Tab 1: Structural Stability Formula & Physics Decomposition */}
      {activeTab === 'formula' && (
        <div className="p-4 space-y-4">
          {/* Formula Display Box */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
              Geotechnical Regression Safety Calculation
            </span>
            <div className="font-mono text-xs sm:text-sm text-slate-200 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 overflow-x-auto">
              <span>F<sub>s</sub> = 2.000 − (0.012 × M) − (0.040 × T) − (0.001 × A)</span>
            </div>

            {/* Substituted Real-time Values */}
            <div className="mt-2 text-xs font-mono text-slate-300 flex flex-wrap items-center gap-2">
              <span>= 2.000</span>
              <span className="text-sky-400">− {moisturePenalty.toFixed(3)} (Moist)</span>
              <span className="text-amber-400">− {tiltPenalty.toFixed(3)} (Tilt)</span>
              <span className="text-purple-400">− {audioPenalty.toFixed(3)} (Audio)</span>
              <span className="font-bold text-white">= {fs.toFixed(3)}</span>
            </div>
          </div>

          {/* Individual Variable Penalty Bars */}
          <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
              Sensor Deduction Vector Breakdown
            </span>

            {/* 1. Moisture Deduction */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5 text-sky-400" />
                  Soil Moisture ({moisture.toFixed(1)}%)
                </span>
                <span className="font-mono text-sky-400">−{moisturePenalty.toFixed(3)} F<sub>s</sub></span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, (moisture / 100) * 100)}%` }}
                />
              </div>
            </div>

            {/* 2. Tilt Deduction */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-amber-400" />
                  Structural Tilt ({tilt.toFixed(1)}°)
                </span>
                <span className="font-mono text-amber-400">−{tiltPenalty.toFixed(3)} F<sub>s</sub></span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, (tilt / 30) * 100)}%` }}
                />
              </div>
            </div>

            {/* 3. Audio RMS Deduction */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-purple-400" />
                  Acoustic Piping ({audio.toFixed(0)} RMS)
                </span>
                <span className="font-mono text-purple-400">−{audioPenalty.toFixed(3)} F<sub>s</sub></span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, (audio / 1000) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Radial Safety Gauge Integration */}
          <SafetyGauge
            telemetry={telemetry ?? null}
            selectedNodeName={node.zone_name}
          />
        </div>
      )}

      {/* Tab 2: Hydraulic & Satellite Vectors */}
      {activeTab === 'hydraulic' && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* CWC Water Level Card */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-semibold flex items-center gap-1.5">
                  <Waves className="w-3.5 h-3.5 text-cyan-400" /> CWC Gauging Stage
                </span>
                <span className="text-[10px] font-mono bg-cyan-950 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-800">
                  REAL-TIME
                </span>
              </div>
              <div className="text-xl font-mono font-bold text-white">
                {cwcWaterLevel.toFixed(2)} m
              </div>
              <p className="text-[11px] text-slate-400">
                Danger Level: <b className="text-amber-400 font-mono">{cwcDangerLevel} m</b> (Delta: {(cwcDangerLevel - cwcWaterLevel).toFixed(2)}m)
              </p>
            </div>

            {/* Calculated Freeboard Card */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Embankment Freeboard
                </span>
                <span className="text-[10px] font-mono bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800">
                  SAFE MARGIN
                </span>
              </div>
              <div className="text-xl font-mono font-bold text-emerald-400">
                {freeboard.toFixed(2)} m
              </div>
              <p className="text-[11px] text-slate-400">
                Crest Elevation: <b className="text-slate-200 font-mono">{(node.elevation_m).toFixed(1)} m MSL</b>
              </p>
            </div>

            {/* Sentinel-1 SAR Backscatter */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-semibold flex items-center gap-1.5">
                  <Satellite className="w-3.5 h-3.5 text-blue-400" /> Sentinel-1 SAR Backscatter
                </span>
                <span className="text-[10px] font-mono bg-blue-950 text-blue-300 px-1.5 py-0.5 rounded border border-blue-800">
                  ISRO LINK
                </span>
              </div>
              <div className="text-xl font-mono font-bold text-blue-300">
                {sarBackscatterDb.toFixed(1)} dB
              </div>
              <p className="text-[11px] text-slate-400">
                Ground pore saturation: <b className="text-sky-300 font-mono">{moisture.toFixed(0)}%</b>
              </p>
            </div>

            {/* DEM Terrain Slope */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-semibold flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-amber-400" /> DEM Slope Gradient
                </span>
                <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                  SRTM 30M
                </span>
              </div>
              <div className="text-xl font-mono font-bold text-amber-300">
                {(tilt * 1.8 + 4.5).toFixed(1)}°
              </div>
              <p className="text-[11px] text-slate-400">
                Hydraulic shear risk: <b className="text-slate-200 font-mono">MODERATE</b>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Emergency Dispatch & Alerts */}
      {activeTab === 'alerts' && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-mono uppercase tracking-wider text-[10px]">
              Twilio SMS &amp; WhatsApp Business Automated Transmission Logs
            </span>
            <span className="text-emerald-400 font-mono text-[10px] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Relay Online
            </span>
          </div>

          {nodeAlerts.length === 0 ? (
            <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-center text-slate-400 text-xs">
              No emergency breach dispatches recorded for this station reach.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {nodeAlerts.map((a) => (
                <div
                  key={a.id}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                          a.channel === 'TWILIO_SMS'
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}
                      >
                        {a.channel}
                      </span>
                      <span className="text-white font-mono font-semibold">{a.recipient}</span>
                    </div>
                    <p className="text-slate-300 text-[11px] font-sans">{a.message}</p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0">
                    {new Date(a.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Citizen Crowdsource Reports */}
      {activeTab === 'crowdsource' && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-mono uppercase tracking-wider text-[10px]">
              Field Inspector &amp; Citizen Incident Reports
            </span>
            <span className="text-cyan-400 font-mono text-[10px]">GPS Geotag Verified</span>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                  MEDIUM SEVERITY • LONGITUDINAL CRACK
                </span>
                <h4 className="text-xs font-bold text-white mt-1.5">
                  Berm subsidence noted near chainage 14.2 km
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Reported by Field Engineer P. Saikia • 42 mins ago
                </p>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                DISPATCHED
              </span>
            </div>
            <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-300 flex items-center justify-between">
              <span>Geo: 26.9512°N, 94.2185°E</span>
              <button className="text-cyan-400 hover:text-cyan-300 text-xs font-semibold flex items-center gap-1">
                <span>View Forensic Triage</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Meta */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
        <span>FIRMWARE: {node.firmware_ver} (ESP32-S3)</span>
        <span>LAST PING: {new Date(node.last_seen).toLocaleTimeString()}</span>
      </div>
    </div>
  );
};
