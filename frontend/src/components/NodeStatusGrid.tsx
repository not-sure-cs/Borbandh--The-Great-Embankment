import React from 'react';
import { Radio, Battery, Signal, ArrowUpRight, AlertCircle, ShieldCheck, AlertTriangle } from 'lucide-react';
import { EmbankmentNode } from '../types';

interface NodeStatusGridProps {
  nodes: EmbankmentNode[];
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
}

export const NodeStatusGrid: React.FC<NodeStatusGridProps> = ({
  nodes,
  selectedNodeId,
  onSelectNode,
}) => {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            Active Embankment Sensor Stations
          </h3>
          <p className="text-xs text-slate-400">Assam State Flood Defense Network</p>
        </div>
        <span className="text-xs font-mono bg-cyan-950/80 text-cyan-300 px-2.5 py-1 rounded-lg border border-cyan-800">
          {nodes.length} Nodes Online
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {nodes.map((node) => {
          const isSelected = selectedNodeId === node.node_id;
          const telemetry = node.last_telemetry;
          const fs = telemetry?.factor_of_safety ?? 1.85;
          const status = telemetry?.status ?? 'SAFE';

          const isCritical = status === 'CRITICAL' || fs < 0.7;
          const isWarning = status === 'WARNING' || (fs >= 0.7 && fs < 1.0);

          return (
            <div
              key={node.node_id}
              onClick={() => onSelectNode(node.node_id)}
              className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'bg-slate-800/90 border-cyan-500 shadow-lg shadow-cyan-500/10'
                  : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
              } ${isCritical ? 'border-rose-500/80 critical-pulse-box' : ''}`}
            >
              {/* Top Row: Zone Name & Status Icon */}
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono font-semibold text-cyan-400 uppercase tracking-wider">
                    {node.node_id}
                  </span>
                  <h4 className="text-sm font-bold text-white leading-snug mt-0.5">
                    {node.zone_name}
                  </h4>
                  <p className="text-[11px] text-slate-400">{node.river} River Reach</p>
                </div>

                <div className={`p-1.5 rounded-lg border ${
                  isCritical 
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-bounce' 
                    : isWarning 
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' 
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                }`}>
                  {isCritical ? <AlertCircle className="w-4 h-4" /> : isWarning ? <AlertTriangle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                </div>
              </div>

              {/* Middle Metrics Row */}
              <div className="grid grid-cols-3 gap-2 my-3 pt-2.5 border-t border-slate-800/60 text-center">
                <div className="bg-slate-900/80 rounded-lg p-1.5 border border-slate-800/60">
                  <span className="text-[9px] text-slate-400 block uppercase">F<sub>s</sub> Index</span>
                  <span className={`text-xs font-mono font-bold ${
                    isCritical ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {fs.toFixed(2)}
                  </span>
                </div>
                <div className="bg-slate-900/80 rounded-lg p-1.5 border border-slate-800/60">
                  <span className="text-[9px] text-slate-400 block uppercase">Moist</span>
                  <span className="text-xs font-mono font-bold text-sky-400">
                    {telemetry?.soil_moisture.toFixed(0) ?? 35}%
                  </span>
                </div>
                <div className="bg-slate-900/80 rounded-lg p-1.5 border border-slate-800/60">
                  <span className="text-[9px] text-slate-400 block uppercase">Tilt</span>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {telemetry?.tilt_angle.toFixed(1) ?? 1.0}°
                  </span>
                </div>
              </div>

              {/* Bottom Node Meta: Battery & Signal */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
                <div className="flex items-center space-x-1.5">
                  <Battery className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{node.battery_voltage.toFixed(2)}V Solar</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Signal className="w-3.5 h-3.5 text-cyan-400" />
                  <span>ESP32 Wi-Fi</span>
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};
