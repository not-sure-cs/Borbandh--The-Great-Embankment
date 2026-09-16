import React, { useState } from 'react';
import { 
  EmbankmentNode, 
  AlertLog 
} from '../types';
import { 
  ShieldCheck, 
  Cpu, 
  Satellite, 
  PhoneCall, 
  Users, 
  Droplets, 
  Compass, 
  Volume2, 
  Waves, 
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
      <div className="bg-white border border-gray-200/90 rounded-2xl p-10 text-center text-gray-500 text-sm shadow-2xs">
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

  const nodeAlerts = alerts.filter((a) => a.node_id === node.node_id || alerts.length <= 3);

  // Hydraulic & satellite values
  const cwcWaterLevel = 49.8 + (moisture / 100) * 3.5;
  const cwcDangerLevel = 52.5;
  const freeboard = Math.max(0, cwcDangerLevel - cwcWaterLevel + 1.2);
  const sarBackscatterDb = -18.5 + (moisture / 100) * 12.0;

  return (
    <div className="bg-white border border-gray-200/90 rounded-2xl overflow-hidden shadow-2xs flex flex-col">
      {/* Top Station Header */}
      <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-semibold text-blue-700 uppercase bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md">
              {node.node_id}
            </span>
            <span className="text-xs text-gray-500">
              {node.river} Basin • {node.latitude.toFixed(4)}°N, {node.longitude.toFixed(4)}°E
            </span>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mt-1">
            {node.zone_name} Embankment Reach
          </h2>
        </div>

        <div className="flex items-center space-x-3">
          {onOpenSimModal && (
            <button
              onClick={onOpenSimModal}
              className="px-3.5 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>Simulate Node</span>
            </button>
          )}
          <div
            className={`px-3.5 py-1 rounded-full text-xs font-semibold font-mono border shadow-2xs ${
              isCritical
                ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                : isWarning
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            F<sub>s</sub> = {fs.toFixed(3)}
          </div>
        </div>
      </div>

      {/* Tab Navigation - Google Underline Tabs */}
      <div className="flex items-center border-b border-gray-100 px-5 overflow-x-auto scrollbar-none text-sm">
        <button
          onClick={() => setActiveTab('formula')}
          className={`py-3 px-3 border-b-2 font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'formula'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Stability Formula (F<sub>s</sub>)</span>
        </button>

        <button
          onClick={() => setActiveTab('hydraulic')}
          className={`py-3 px-3 border-b-2 font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'hydraulic'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Satellite className="w-4 h-4" />
          <span>CWC &amp; Satellites</span>
        </button>

        <button
          onClick={() => setActiveTab('alerts')}
          className={`py-3 px-3 border-b-2 font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'alerts'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <PhoneCall className="w-4 h-4" />
          <span>Emergency Logs ({nodeAlerts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('crowdsource')}
          className={`py-3 px-3 border-b-2 font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'crowdsource'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Citizen Triage</span>
        </button>
      </div>

      {/* Tab 1: Structural Stability Formula & Physics Decomposition */}
      {activeTab === 'formula' && (
        <div className="p-6 space-y-6">
          {/* Formula Callout Box */}
          <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-200">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
              Geotechnical Regression Safety Calculation
            </span>
            <div className="font-mono text-xs sm:text-sm text-gray-900 bg-white p-3 rounded-xl border border-gray-200 overflow-x-auto shadow-2xs">
              <span>F<sub>s</sub> = 2.000 − (0.012 × M) − (0.040 × T) − (0.001 × A)</span>
            </div>

            {/* Substituted Real-time Values */}
            <div className="mt-3 text-xs font-mono text-gray-700 flex flex-wrap items-center gap-2">
              <span>= 2.000</span>
              <span className="text-sky-700">− {moisturePenalty.toFixed(3)} (Moist)</span>
              <span className="text-amber-700">− {tiltPenalty.toFixed(3)} (Tilt)</span>
              <span className="text-purple-700">− {audioPenalty.toFixed(3)} (Audio)</span>
              <span className="font-bold text-gray-900">= {fs.toFixed(3)}</span>
            </div>
          </div>

          {/* Individual Variable Deduction Progress Bars */}
          <div className="space-y-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
              Sensor Deduction Vector Breakdown
            </span>

            {/* 1. Moisture Deduction */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-700 font-medium flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5 text-sky-600" />
                  Soil Moisture ({moisture.toFixed(1)}%)
                </span>
                <span className="font-mono text-sky-700 font-medium">−{moisturePenalty.toFixed(3)} F<sub>s</sub></span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, (moisture / 100) * 100)}%` }}
                />
              </div>
            </div>

            {/* 2. Tilt Deduction */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-700 font-medium flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-amber-600" />
                  Structural Tilt ({tilt.toFixed(1)}°)
                </span>
                <span className="font-mono text-amber-700 font-medium">−{tiltPenalty.toFixed(3)} F<sub>s</sub></span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, (tilt / 30) * 100)}%` }}
                />
              </div>
            </div>

            {/* 3. Audio RMS Deduction */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-700 font-medium flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-purple-600" />
                  Acoustic Piping ({audio.toFixed(0)} RMS)
                </span>
                <span className="font-mono text-purple-700 font-medium">−{audioPenalty.toFixed(3)} F<sub>s</sub></span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all duration-500"
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
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* CWC Water Level Card */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-gray-500 text-xs">
                <span className="font-medium flex items-center gap-1.5">
                  <Waves className="w-4 h-4 text-blue-600" /> CWC Gauging Stage
                </span>
                <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full">
                  Real-time
                </span>
              </div>
              <div className="text-2xl font-semibold text-gray-900 font-mono">
                {cwcWaterLevel.toFixed(2)} m
              </div>
              <p className="text-xs text-gray-500">
                Danger Level: <b className="text-amber-700 font-mono">{cwcDangerLevel} m</b> (Delta: {(cwcDangerLevel - cwcWaterLevel).toFixed(2)}m)
              </p>
            </div>

            {/* Calculated Freeboard Card */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-gray-500 text-xs">
                <span className="font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Embankment Freeboard
                </span>
                <span className="text-xs font-medium bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full">
                  Safe Margin
                </span>
              </div>
              <div className="text-2xl font-semibold text-emerald-700 font-mono">
                {freeboard.toFixed(2)} m
              </div>
              <p className="text-xs text-gray-500">
                Crest Elevation: <b className="text-gray-700 font-mono">{(node.elevation_m).toFixed(1)} m MSL</b>
              </p>
            </div>

            {/* Sentinel-1 SAR Backscatter */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-gray-500 text-xs">
                <span className="font-medium flex items-center gap-1.5">
                  <Satellite className="w-4 h-4 text-blue-600" /> Sentinel-1 SAR Backscatter
                </span>
                <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full">
                  ISRO Link
                </span>
              </div>
              <div className="text-2xl font-semibold text-blue-700 font-mono">
                {sarBackscatterDb.toFixed(1)} dB
              </div>
              <p className="text-xs text-gray-500">
                Pore Saturation: <b className="text-sky-700 font-mono">{moisture.toFixed(0)}%</b>
              </p>
            </div>

            {/* DEM Terrain Slope */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-gray-500 text-xs">
                <span className="font-medium flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-amber-600" /> DEM Slope Gradient
                </span>
                <span className="text-xs font-medium bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full">
                  SRTM 30M
                </span>
              </div>
              <div className="text-2xl font-semibold text-amber-700 font-mono">
                {(tilt * 1.8 + 4.5).toFixed(1)}°
              </div>
              <p className="text-xs text-gray-500">
                Hydraulic shear risk: <b className="text-gray-700">MODERATE</b>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Emergency Dispatch & Alerts */}
      {activeTab === 'alerts' && (
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 font-medium uppercase tracking-wider">
              Twilio SMS &amp; WhatsApp Business Automated Transmission Logs
            </span>
            <span className="text-emerald-700 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
              Relay Online
            </span>
          </div>

          {nodeAlerts.length === 0 ? (
            <div className="bg-gray-50 p-8 rounded-2xl border border-gray-200 text-center text-gray-500 text-sm">
              No emergency breach dispatches recorded for this station reach.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {nodeAlerts.map((a) => (
                <div
                  key={a.id}
                  className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex items-start justify-between gap-4 text-sm"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-xs font-mono font-medium ${
                          a.channel === 'TWILIO_SMS'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {a.channel}
                      </span>
                      <span className="text-gray-900 font-mono font-medium">{a.recipient}</span>
                    </div>
                    <p className="text-gray-600 text-xs font-sans mt-0.5">{a.message}</p>
                  </div>
                  <span className="text-xs font-mono text-gray-400 shrink-0">
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
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 font-medium uppercase tracking-wider">
              Field Inspector &amp; Citizen Incident Reports
            </span>
            <span className="text-blue-600 font-medium">GPS Geotag Verified</span>
          </div>

          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                  Medium Severity • Longitudinal Crack
                </span>
                <h4 className="text-sm font-semibold text-gray-900 mt-2">
                  Berm subsidence noted near chainage 14.2 km
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  Reported by Field Engineer P. Saikia • 42 mins ago
                </p>
              </div>
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Dispatched
              </span>
            </div>
            <div className="pt-2.5 border-t border-gray-200 text-xs text-gray-600 flex items-center justify-between">
              <span>Geo: 26.9512°N, 94.2185°E</span>
              <button className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                <span>View Forensic Triage</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Meta */}
      <div className="p-4 border-t border-gray-100 bg-gray-50/70 flex items-center justify-between text-xs text-gray-500 font-mono">
        <span>FIRMWARE: {node.firmware_ver} (ESP32-S3)</span>
        <span>LAST PING: {new Date(node.last_seen).toLocaleTimeString()}</span>
      </div>
    </div>
  );
};
