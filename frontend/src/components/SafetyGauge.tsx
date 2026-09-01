import React from 'react';
import { AlertCircle, ShieldCheck, AlertTriangle, Droplets, Compass, Volume2 } from 'lucide-react';
import { NodeTelemetry } from '../types';

interface SafetyGaugeProps {
  telemetry: NodeTelemetry | null;
  selectedNodeName?: string;
}

export const SafetyGauge: React.FC<SafetyGaugeProps> = ({
  telemetry,
  selectedNodeName = 'Assam Embankment Probe'
}) => {
  const fs = telemetry ? telemetry.factor_of_safety : 1.85;
  const isCritical = fs < 0.7;
  const isWarning = fs >= 0.7 && fs < 1.0;
  const isSafe = fs >= 1.0;

  // Gauge angle calculation (semi-circle from -90deg to +90deg, mapping Fs from 0.0 to 2.0)
  // Clamped between 0 and 2.0
  const clampedFs = Math.max(0, Math.min(2.0, fs));
  const progressRatio = clampedFs / 2.0; // 0 to 1
  const rotationDeg = -90 + progressRatio * 180; // -90 to +90

  // Status color styles
  const getTheme = () => {
    if (isCritical) {
      return {
        bg: 'bg-rose-950/40 border-rose-600/50',
        text: 'text-rose-400',
        badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        label: 'CRITICAL FAILURE IMMINENT',
        glow: 'critical-pulse-box',
        colorHex: '#ef4444',
      };
    }
    if (isWarning) {
      return {
        bg: 'bg-amber-950/30 border-amber-600/40',
        text: 'text-amber-400',
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        label: 'SATURATION & SLUMP WARNING',
        glow: 'shadow-[0_0_25px_rgba(245,158,11,0.3)]',
        colorHex: '#f59e0b',
      };
    }
    return {
      bg: 'bg-slate-900/80 border-slate-800',
      text: 'text-emerald-400',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      label: 'STRUCTURALLY STABLE',
      glow: 'shadow-xl',
      colorHex: '#10b981',
    };
  };

  const theme = getTheme();

  return (
    <div className={`relative rounded-2xl p-6 border transition-all duration-500 flex flex-col items-center justify-between ${theme.bg} ${theme.glow}`}>
      
      {/* Top Header */}
      <div className="w-full flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div>
          <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
            Live Stability Index
          </span>
          <h3 className="text-base font-bold text-white truncate max-w-[220px]">
            {selectedNodeName}
          </h3>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border flex items-center gap-1.5 ${theme.badge}`}>
          {isCritical ? (
            <AlertCircle className="w-3.5 h-3.5 animate-bounce" />
          ) : isWarning ? (
            <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5" />
          )}
          <span>{theme.label}</span>
        </div>
      </div>

      {/* Radial Gauge SVG */}
      <div className="relative w-64 h-36 mt-4 flex items-center justify-center overflow-hidden">
        <svg viewBox="0 0 200 110" className="w-full h-full">
          {/* Background Arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#1e293b"
            strokeWidth="18"
            strokeLinecap="round"
          />

          {/* Critical Arc (0.0 to 0.7) */}
          <path
            d="M 20 100 A 80 80 0 0 1 76 34"
            fill="none"
            stroke="#ef4444"
            strokeWidth="18"
            strokeLinecap="round"
            className="opacity-40"
          />

          {/* Warning Arc (0.7 to 1.0) */}
          <path
            d="M 76 34 A 80 80 0 0 1 100 20"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="18"
            strokeLinecap="round"
            className="opacity-40"
          />

          {/* Safe Arc (1.0 to 2.0) */}
          <path
            d="M 100 20 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#10b981"
            strokeWidth="18"
            strokeLinecap="round"
            className="opacity-40"
          />

          {/* Threshold Tick at 1.0 (Emergency Line) */}
          <line
            x1="100"
            y1="5"
            x2="100"
            y2="25"
            stroke="#f8fafc"
            strokeWidth="2.5"
            strokeDasharray="2 2"
          />

          {/* Needle Pointer */}
          <g transform={`rotate(${rotationDeg} 100 100)`} className="transition-transform duration-500 ease-out">
            <polygon points="97,100 103,100 100,22" fill={theme.colorHex} />
            <circle cx="100" cy="100" r="8" fill="#f8fafc" />
            <circle cx="100" cy="100" r="4" fill="#0f172a" />
          </g>
        </svg>

        {/* Value Overlay */}
        <div className="absolute bottom-0 text-center flex flex-col items-center">
          <span className="text-3xl font-extrabold tracking-tight font-mono text-white">
            {fs.toFixed(3)}
          </span>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
            Factor of Safety (F<sub>s</sub>)
          </span>
        </div>
      </div>

      {/* Threshold Legend Labels */}
      <div className="w-full flex justify-between px-4 text-[10px] text-slate-400 font-mono mt-1">
        <span className="text-rose-400">0.0 (Collapse)</span>
        <span className="text-amber-400 font-bold">1.0 (Alert Threshold)</span>
        <span className="text-emerald-400">2.0 (Reinforced)</span>
      </div>

      {/* Regression Variable Breakdown */}
      <div className="w-full grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80">
        <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800 flex flex-col items-center">
          <div className="flex items-center space-x-1 text-slate-400 text-[11px]">
            <Droplets className="w-3.5 h-3.5 text-cyan-400" />
            <span>Moisture</span>
          </div>
          <span className="text-sm font-mono font-bold text-slate-200 mt-0.5">
            {telemetry?.soil_moisture.toFixed(1) ?? '35.0'}%
          </span>
        </div>

        <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800 flex flex-col items-center">
          <div className="flex items-center space-x-1 text-slate-400 text-[11px]">
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>Tilt</span>
          </div>
          <span className="text-sm font-mono font-bold text-slate-200 mt-0.5">
            {telemetry?.tilt_angle.toFixed(1) ?? '1.2'}°
          </span>
        </div>

        <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800 flex flex-col items-center">
          <div className="flex items-center space-x-1 text-slate-400 text-[11px]">
            <Volume2 className="w-3.5 h-3.5 text-purple-400" />
            <span>Piping RMS</span>
          </div>
          <span className="text-sm font-mono font-bold text-slate-200 mt-0.5">
            {telemetry?.audio_rms.toFixed(0) ?? '25'}
          </span>
        </div>
      </div>

    </div>
  );
};
