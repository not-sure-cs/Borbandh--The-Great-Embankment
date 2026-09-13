import React from 'react';
import { EmbankmentNode } from '../types';
import { 
  ShieldCheck, 
  AlertTriangle, 
  AlertCircle, 
  Battery, 
  Signal, 
  Radio, 
  Droplets, 
  Compass, 
  Volume2,
  ChevronRight
} from 'lucide-react';

interface StationTableViewProps {
  nodes: EmbankmentNode[];
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
}

export const StationTableView: React.FC<StationTableViewProps> = ({
  nodes,
  selectedNodeId,
  onSelectNode,
}) => {
  if (nodes.length === 0) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-8 text-center text-slate-400 text-xs">
        No embankment telemetry stations match the selected filters.
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
      {/* Header bar */}
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center space-x-2">
          <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Live Embankment Station Feed
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
          Click station to inspect diagnostics
        </span>
      </div>

      {/* High-density Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950 text-[10px] font-mono uppercase text-slate-400 tracking-wider select-none">
              <th scope="col" className="py-2.5 px-3 font-semibold">Station / Zone</th>
              <th scope="col" className="py-2.5 px-3 font-semibold text-center">F<sub>s</sub> Index</th>
              <th scope="col" className="py-2.5 px-3 font-semibold text-right">Moisture</th>
              <th scope="col" className="py-2.5 px-3 font-semibold text-right">Tilt</th>
              <th scope="col" className="py-2.5 px-3 font-semibold text-right">Acoustic</th>
              <th scope="col" className="py-2.5 px-3 font-semibold text-center">Battery</th>
              <th scope="col" className="py-2.5 px-2 text-center sr-only">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {nodes.map((node) => {
              const isSelected = node.node_id === selectedNodeId;
              const telemetry = node.last_telemetry;
              const fs = telemetry?.factor_of_safety ?? 1.85;
              const status = telemetry?.status ?? (fs < 0.7 ? 'CRITICAL' : fs < 1.0 ? 'WARNING' : 'SAFE');
              const isCritical = status === 'CRITICAL' || fs < 0.7;
              const isWarning = status === 'WARNING' || (fs >= 0.7 && fs < 1.0);

              return (
                <tr
                  key={node.node_id}
                  onClick={() => onSelectNode(node.node_id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectNode(node.node_id);
                    }
                  }}
                  tabIndex={0}
                  role="row"
                  aria-selected={isSelected}
                  className={`cursor-pointer transition-colors outline-none focus:bg-slate-800/80 ${
                    isSelected
                      ? 'bg-slate-800/90 text-white font-medium border-l-4 border-l-cyan-400'
                      : 'hover:bg-slate-800/50 text-slate-300'
                  } ${isCritical ? 'bg-rose-950/20' : ''}`}
                >
                  {/* Station & Location */}
                  <td className="py-3 px-3">
                    <div className="flex items-center space-x-2">
                      <div className="shrink-0">
                        {isCritical ? (
                          <div className="p-1 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40">
                            <AlertCircle className="w-3.5 h-3.5 animate-bounce" />
                          </div>
                        ) : isWarning ? (
                          <div className="p-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="p-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono font-bold text-xs text-white">
                            {node.node_id}
                          </span>
                          <span className="text-[10px] text-slate-400 hidden sm:inline">
                            • {node.river}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate max-w-[160px] sm:max-w-[200px]">
                          {node.zone_name}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Factor of Safety Fs Badge */}
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-xs border ${
                        isCritical
                          ? 'bg-rose-900/60 text-rose-300 border-rose-500 animate-pulse'
                          : isWarning
                          ? 'bg-amber-900/60 text-amber-300 border-amber-500'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      }`}
                    >
                      {fs.toFixed(2)}
                    </span>
                  </td>

                  {/* Soil Moisture */}
                  <td className="py-3 px-3 text-right font-mono">
                    <div className="flex items-center justify-end space-x-1 text-sky-400">
                      <Droplets className="w-3 h-3 text-sky-400 opacity-60 hidden sm:inline" />
                      <span>{telemetry?.soil_moisture.toFixed(0) ?? 35}%</span>
                    </div>
                  </td>

                  {/* Tilt Angle */}
                  <td className="py-3 px-3 text-right font-mono">
                    <div className="flex items-center justify-end space-x-1 text-amber-400">
                      <Compass className="w-3 h-3 text-amber-400 opacity-60 hidden sm:inline" />
                      <span>{telemetry?.tilt_angle.toFixed(1) ?? 1.0}°</span>
                    </div>
                  </td>

                  {/* Audio RMS */}
                  <td className="py-3 px-3 text-right font-mono text-purple-300">
                    <span>{telemetry?.audio_rms.toFixed(0) ?? 20}</span>
                  </td>

                  {/* Battery & Signal */}
                  <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-400">
                    <div className="flex items-center justify-center space-x-1">
                      <Battery className="w-3 h-3 text-emerald-400" />
                      <span>{node.battery_voltage.toFixed(1)}V</span>
                    </div>
                  </td>

                  {/* Action arrow */}
                  <td className="py-3 px-2 text-right">
                    <ChevronRight
                      className={`w-4 h-4 transition-transform ${
                        isSelected ? 'text-cyan-400 translate-x-0.5' : 'text-slate-600'
                      }`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
