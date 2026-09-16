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

  // Gauge angle calculation (semi-circle from -90deg to +90deg, mapping Fs from 0.0 to 2.0)
  const clampedFs = Math.max(0, Math.min(2.0, fs));
  const progressRatio = clampedFs / 2.0;
  const rotationDeg = -90 + progressRatio * 180;

  // Status styling in Google color palette
  const getTheme = () => {
    if (isCritical) {
      return {
        bg: 'bg-rose-50/50 border-rose-300 ring-2 ring-rose-100',
        badge: 'bg-rose-50 text-rose-700 border-rose-200',
        label: 'CRITICAL FAILURE IMMINENT',
        glow: 'critical-pulse-box',
        colorHex: '#d93025',
      };
    }
    if (isWarning) {
      return {
        bg: 'bg-amber-50/50 border-amber-300 ring-2 ring-amber-100',
        badge: 'bg-amber-50 text-amber-800 border-amber-200',
        label: 'SATURATION & SLUMP WARNING',
        glow: 'shadow-sm',
        colorHex: '#f9ab00',
      };
    }
    return {
      bg: 'bg-white border-gray-200/90',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      label: 'STRUCTURALLY STABLE',
      glow: 'shadow-2xs',
      colorHex: '#1e8e3e',
    };
  };

  const theme = getTheme();

  return (
    <div className={`relative rounded-2xl p-6 border transition-all duration-500 flex flex-col h-full min-h-[420px] ${theme.bg} ${theme.glow}`}>
      
      {/* Top Header */}
      <div className="w-full flex items-center justify-between border-b border-gray-100 pb-3">
        <div>
          <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">
            Live Stability Index
          </span>
          <h3 className="text-base font-semibold text-gray-900 truncate max-w-[220px]">
            {selectedNodeName}
          </h3>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border flex items-center gap-1.5 ${theme.badge}`}>
          {isCritical ? (
            <AlertCircle className="w-3.5 h-3.5 animate-bounce" />
          ) : isWarning ? (
            <AlertTriangle className="w-3.5 h-3.5" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5" />
          )}
          <span>{theme.label}</span>
        </div>
      </div>

      <div className="mt-auto flex flex-col justify-end">
        {/* Radial Gauge SVG */}
        <div className="relative w-72 h-40 mt-4 mx-auto flex items-center justify-center overflow-hidden">
          <svg viewBox="0 0 200 110" className="w-full h-full">
          {/* Background Arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="18"
            strokeLinecap="round"
          />

          {/* Critical Arc (0.0 to 0.7) */}
          <path
            d="M 20 100 A 80 80 0 0 1 76 34"
            fill="none"
            stroke="#d93025"
            strokeWidth="18"
            strokeLinecap="round"
            className="opacity-70"
          />

          {/* Warning Arc (0.7 to 1.0) */}
          <path
            d="M 76 34 A 80 80 0 0 1 100 20"
            fill="none"
            stroke="#f9ab00"
            strokeWidth="18"
            strokeLinecap="round"
            className="opacity-70"
          />

          {/* Safe Arc (1.0 to 2.0) */}
          <path
            d="M 100 20 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#1e8e3e"
            strokeWidth="18"
            strokeLinecap="round"
            className="opacity-70"
          />

          {/* Threshold Tick at 1.0 (Emergency Line) */}
          <line
            x1="100"
            y1="5"
            x2="100"
            y2="25"
            stroke="#64748b"
            strokeWidth="2.5"
            strokeDasharray="2 2"
          />

          {/* Needle Pointer */}
          <g transform={`rotate(${rotationDeg} 100 100)`} className="transition-transform duration-500 ease-out">
            <polygon points="97,100 103,100 100,22" fill={theme.colorHex} />
            <circle cx="100" cy="100" r="8" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="4" fill="#202124" />
          </g>
        </svg>

          {/* Value Overlay */}
          <div className="absolute bottom-0 text-center flex flex-col items-center">
            <span className="text-4xl font-bold tracking-tight font-mono text-gray-900">
              {fs.toFixed(3)}
            </span>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Factor of Safety (F<sub>s</sub>)
            </span>
          </div>
        </div>

        {/* Threshold Legend Labels */}
        <div className="w-full flex justify-between px-4 text-xs text-gray-500 font-mono mt-2">
          <span className="text-rose-600 font-medium">0.0 (Collapse)</span>
          <span className="text-amber-700 font-semibold">1.0 (Alert Threshold)</span>
          <span className="text-emerald-700 font-medium">2.0 (Reinforced)</span>
        </div>
      </div>

      {/* Regression Variable Breakdown */}
      <div className="w-full grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-gray-100">
        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex flex-col items-center">
          <div className="flex items-center space-x-1 text-gray-500 text-xs font-medium">
            <Droplets className="w-3.5 h-3.5 text-sky-600" />
            <span>Moisture</span>
          </div>
          <span className="text-sm font-mono font-semibold text-gray-800 mt-1">
            {telemetry?.soil_moisture.toFixed(1) ?? '35.0'}%
          </span>
        </div>

        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex flex-col items-center">
          <div className="flex items-center space-x-1 text-gray-500 text-xs font-medium">
            <Compass className="w-3.5 h-3.5 text-amber-600" />
            <span>Tilt</span>
          </div>
          <span className="text-sm font-mono font-semibold text-gray-800 mt-1">
            {telemetry?.tilt_angle.toFixed(1) ?? '1.2'}°
          </span>
        </div>

        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex flex-col items-center">
          <div className="flex items-center space-x-1 text-gray-500 text-xs font-medium">
            <Volume2 className="w-3.5 h-3.5 text-purple-600" />
            <span>Piping RMS</span>
          </div>
          <span className="text-sm font-mono font-semibold text-gray-800 mt-1">
            {telemetry?.audio_rms.toFixed(0) ?? '25'}
          </span>
        </div>
      </div>

    </div>
  );
};
