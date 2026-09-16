import React from 'react';
import { EmbankmentNode } from '../types';
import { 
  ShieldCheck, 
  AlertTriangle, 
  AlertCircle, 
  Battery, 
  Radio, 
  Droplets, 
  Compass, 
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
      <div className="bg-white border border-gray-200/90 rounded-2xl p-10 text-center text-gray-500 text-sm shadow-2xs">
        No embankment telemetry stations match the selected filters.
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200/90 rounded-2xl overflow-hidden shadow-2xs flex flex-col">
      {/* Header bar */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
            <Radio className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">
            Active Embankment Sensor Stations
          </h3>
        </div>
        <span className="text-xs text-gray-500 font-normal bg-gray-50 px-3 py-1 rounded-full border border-gray-200">
          Select station to view diagnostics
        </span>
      </div>

      {/* High-density Decluttered Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/70 text-xs font-medium text-gray-500 uppercase tracking-wider select-none">
              <th scope="col" className="py-3 px-4">Station / Reach</th>
              <th scope="col" className="py-3 px-4 text-center">F<sub>s</sub> Index</th>
              <th scope="col" className="py-3 px-4 text-right">Moisture</th>
              <th scope="col" className="py-3 px-4 text-right">Tilt</th>
              <th scope="col" className="py-3 px-4 text-right">Piping</th>
              <th scope="col" className="py-3 px-4 text-center">Battery</th>
              <th scope="col" className="py-3 px-2 text-center sr-only">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
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
                  className={`cursor-pointer transition-colors outline-none focus:bg-blue-50/40 ${
                    isSelected
                      ? 'bg-blue-50/80 text-gray-900 font-medium border-l-4 border-l-blue-600'
                      : 'hover:bg-gray-50/80 text-gray-700'
                  } ${isCritical ? 'bg-rose-50/40' : ''}`}
                >
                  {/* Station & Location */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-3">
                      <div className="shrink-0">
                        {isCritical ? (
                          <div className="p-1.5 rounded-lg bg-rose-100 text-rose-600">
                            <AlertCircle className="w-4 h-4" />
                          </div>
                        ) : isWarning ? (
                          <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                            <ShieldCheck className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-gray-900 text-xs">
                            {node.node_id}
                          </span>
                          <span className="text-xs text-gray-500 hidden sm:inline">
                            • {node.river} Reach
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate max-w-[180px] sm:max-w-[220px]">
                          {node.zone_name}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Factor of Safety Fs Badge */}
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`inline-block px-3 py-0.5 rounded-full font-mono font-semibold text-xs border ${
                        isCritical
                          ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                          : isWarning
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {fs.toFixed(2)}
                    </span>
                  </td>

                  {/* Soil Moisture */}
                  <td className="py-3.5 px-4 text-right font-mono text-xs">
                    <div className="flex items-center justify-end space-x-1 text-sky-700">
                      <Droplets className="w-3.5 h-3.5 opacity-60 hidden sm:inline" />
                      <span>{telemetry?.soil_moisture.toFixed(0) ?? 35}%</span>
                    </div>
                  </td>

                  {/* Tilt Angle */}
                  <td className="py-3.5 px-4 text-right font-mono text-xs">
                    <div className="flex items-center justify-end space-x-1 text-amber-700">
                      <Compass className="w-3.5 h-3.5 opacity-60 hidden sm:inline" />
                      <span>{telemetry?.tilt_angle.toFixed(1) ?? 1.0}°</span>
                    </div>
                  </td>

                  {/* Audio RMS */}
                  <td className="py-3.5 px-4 text-right font-mono text-xs text-purple-700">
                    <span>{telemetry?.audio_rms.toFixed(0) ?? 20}</span>
                  </td>

                  {/* Battery Voltage */}
                  <td className="py-3.5 px-4 text-center font-mono text-xs text-gray-600">
                    <div className="flex items-center justify-center space-x-1">
                      <Battery className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{node.battery_voltage.toFixed(1)}V</span>
                    </div>
                  </td>

                  {/* Action arrow */}
                  <td className="py-3.5 px-2 text-right">
                    <ChevronRight
                      className={`w-4 h-4 transition-transform ${
                        isSelected ? 'text-blue-600 translate-x-0.5' : 'text-gray-300'
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
