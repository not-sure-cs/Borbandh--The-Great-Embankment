import React, { useState } from 'react';
import { LineChart, Activity, Droplets, Compass, Volume2 } from 'lucide-react';
import { NodeTelemetry } from '../types';

interface TelemetryChartProps {
  history: NodeTelemetry[];
  selectedNodeId: string;
}

export const TelemetryChart: React.FC<TelemetryChartProps> = ({
  history,
  selectedNodeId,
}) => {
  const [metric, setMetric] = useState<'fs' | 'moisture' | 'tilt' | 'audio'>('fs');

  // Filter history for selected node
  const filtered = history.filter(h => !selectedNodeId || h.node_id === selectedNodeId);
  const dataPoints = filtered.slice(-30); // Last 30 points

  if (dataPoints.length === 0) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center h-80 text-slate-500">
        <Activity className="w-8 h-8 mb-2 animate-spin text-cyan-500" />
        <p className="text-sm">Awaiting telemetry stream packets...</p>
      </div>
    );
  }

  // Determine Y-axis range based on active metric
  let minY = 0;
  let maxY = 2.0;
  let unit = '';
  let color = '#10b981';
  let title = 'Factor of Safety Trend';

  if (metric === 'fs') {
    minY = 0.0;
    maxY = 2.0;
    unit = ' Fs';
    color = '#06b6d4';
    title = 'Factor of Safety (Fs) Time Series';
  } else if (metric === 'moisture') {
    minY = 0;
    maxY = 100;
    unit = '%';
    color = '#38bdf8';
    title = 'Soil Moisture Saturation (%)';
  } else if (metric === 'tilt') {
    minY = 0;
    maxY = 30;
    unit = '°';
    color = '#f59e0b';
    title = 'Embankment Structural Tilt (Degrees)';
  } else if (metric === 'audio') {
    minY = 0;
    maxY = 1000;
    unit = ' RMS';
    color = '#c084fc';
    title = 'Acoustic Piping Flow Vibration (RMS)';
  }

  const getVal = (item: NodeTelemetry) => {
    switch (metric) {
      case 'moisture': return item.soil_moisture;
      case 'tilt': return item.tilt_angle;
      case 'audio': return item.audio_rms;
      default: return item.factor_of_safety;
    }
  };

  // SVG dimensions
  const width = 600;
  const height = 220;
  const paddingX = 45;
  const paddingY = 25;

  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;

  // Build SVG polyline points
  const points = dataPoints.map((d, index) => {
    const val = getVal(d);
    const x = paddingX + (index / Math.max(1, dataPoints.length - 1)) * chartW;
    const clampedVal = Math.max(minY, Math.min(maxY, val));
    const y = height - paddingY - ((clampedVal - minY) / (maxY - minY)) * chartH;
    return { x, y, val, time: new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) };
  });

  const polylineStr = points.map(p => `${p.x},${p.y}`).join(' ');

  // Emergency threshold line Y for Fs metric (Fs = 1.0)
  const thresholdY = metric === 'fs' ? height - paddingY - ((1.0 - minY) / (maxY - minY)) * chartH : null;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
      
      {/* Chart Top Header & Metric Selectors */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center space-x-2">
          <LineChart className="w-5 h-5 text-cyan-400" />
          <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
        </div>

        {/* Tab buttons */}
        <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setMetric('fs')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              metric === 'fs' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            F<sub>s</sub> Safety
          </button>
          <button
            onClick={() => setMetric('moisture')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              metric === 'moisture' ? 'bg-sky-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Moisture
          </button>
          <button
            onClick={() => setMetric('tilt')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              metric === 'tilt' ? 'bg-amber-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tilt
          </button>
          <button
            onClick={() => setMetric('audio')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              metric === 'audio' ? 'bg-purple-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Piping Audio
          </button>
        </div>
      </div>

      {/* SVG Multi-Line Trend Chart */}
      <div className="relative w-full mt-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-56 overflow-visible">
          
          {/* Horizontal Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = paddingY + ratio * chartH;
            const gridVal = (maxY - ratio * (maxY - minY)).toFixed(1);
            return (
              <g key={i}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="#1e293b"
                  strokeDasharray="3 3"
                />
                <text
                  x={paddingX - 8}
                  y={y + 4}
                  fill="#64748b"
                  fontSize="10"
                  textAnchor="end"
                  fontFamily="monospace"
                >
                  {gridVal}
                </text>
              </g>
            );
          })}

          {/* Emergency Alert Threshold Line (1.0) */}
          {thresholdY !== null && (
            <g>
              <line
                x1={paddingX}
                y1={thresholdY}
                x2={width - paddingX}
                y2={thresholdY}
                stroke="#ef4444"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <text
                x={width - paddingX + 5}
                y={thresholdY + 3}
                fill="#ef4444"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace"
              >
                1.0 Alert
              </text>
            </g>
          )}

          {/* Fill Gradient Area under curve */}
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          <polygon
            points={`${points[0]?.x ?? paddingX},${height - paddingY} ${polylineStr} ${points[points.length - 1]?.x ?? width - paddingX},${height - paddingY}`}
            fill="url(#chartGradient)"
          />

          {/* The Data Polyline */}
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polylineStr}
          />

          {/* Data Nodes */}
          {points.map((p, i) => (
            <g key={i} className="group cursor-pointer">
              <circle
                cx={p.x}
                y={p.y}
                r="4"
                fill="#0f172a"
                stroke={color}
                strokeWidth="2"
                className="transition-transform group-hover:scale-150"
              />
            </g>
          ))}
        </svg>
      </div>

      {/* Footer Timestamps */}
      <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mt-2 px-2">
        <span>{points[0]?.time ?? 'Start'}</span>
        <span className="text-slate-400">Stream Sampling (Every 5s)</span>
        <span className="text-cyan-400 font-bold">{points[points.length - 1]?.time ?? 'Latest'}</span>
      </div>

    </div>
  );
};
