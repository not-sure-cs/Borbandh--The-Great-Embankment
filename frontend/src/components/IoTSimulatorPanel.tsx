import React, { useState } from 'react';
import { Cpu, Zap, Play, Pause, AlertTriangle, Droplets, Compass, Volume2, ShieldAlert, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import { EmbankmentNode } from '../types';

interface IoTSimulatorPanelProps {
  nodes: EmbankmentNode[];
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
  onClose?: () => void;
}

export const IoTSimulatorPanel: React.FC<IoTSimulatorPanelProps> = ({
  nodes,
  selectedNodeId,
  onSelectNode,
  onClose,
}) => {
  const [moisture, setMoisture] = useState(95.0);
  const [tilt, setTilt] = useState(15.0);
  const [audio, setAudio] = useState(450.0);
  const [targetNode, setTargetNode] = useState(selectedNodeId || 'NODE-MAJULI-01');
  const [isSimRunning, setIsSimRunning] = useState(true);
  const [activeScenario, setActiveScenario] = useState<string>('FLASH_FLOOD');
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState('');

  // Live Formula Preview
  const calculatedFs = Math.max(0, 2.0 - 0.012 * moisture - 0.04 * tilt - 0.001 * audio);

  const handleRunPreset = async (scenarioKey: string) => {
    setActiveScenario(scenarioKey);
    setLoading(true);
    try {
      let m = 35.0, t = 1.2, a = 20.0;
      if (scenarioKey === 'FLASH_FLOOD') {
        m = 95.0; t = 15.0; a = 480.0;
      } else if (scenarioKey === 'MONSOON_SURGE') {
        m = 78.0; t = 6.5; a = 180.0;
      } else if (scenarioKey === 'RAPID_TILT') {
        m = 55.0; t = 18.0; a = 80.0;
      } else if (scenarioKey === 'PIPING_EROSION') {
        m = 85.0; t = 4.5; a = 750.0;
      }
      setMoisture(m);
      setTilt(t);
      setAudio(a);

      await api.triggerScenario(scenarioKey, targetNode);
      setResultMsg(`Scenario "${scenarioKey}" injected! Watch the gauge snap in real time.`);
      setTimeout(() => setResultMsg(''), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualIngest = async () => {
    setLoading(true);
    try {
      await api.ingestTelemetry({
        node_id: targetNode,
        soil_moisture: moisture,
        tilt_angle: tilt,
        audio_rms: audio,
      });
      setResultMsg(`Custom telemetry injected for ${targetNode}! Fs=${calculatedFs.toFixed(3)}`);
      setTimeout(() => setResultMsg(''), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleBackgroundSim = async () => {
    const nextState = !isSimRunning;
    setIsSimRunning(nextState);
    await api.toggleSimulator(nextState ? 'start' : 'stop');
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
      
      {/* Panel Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                IoT Edge Telemetry Simulation Laboratory
              </h3>
              <p className="text-xs text-slate-400">
                Test ESP32 sensor thresholds, ML regression formulas, and automated SMS/WhatsApp alerts
              </p>
            </div>
          </div>
        </div>

        {/* Simulator Toggle */}
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleBackgroundSim}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              isSimRunning
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {isSimRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isSimRunning ? 'Background Loop Active' : 'Loop Paused'}</span>
          </button>
        </div>
      </div>

      {resultMsg && (
        <div className="p-3 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-xs font-mono flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{resultMsg}</span>
        </div>
      )}

      {/* Preset Scenarios Grid (Phase 6 Test Scenarios) */}
      <div>
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2.5">
          1. Quick Scenario Injection (Phase 6 Stress Scenarios)
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <button
            onClick={() => handleRunPreset('NORMAL')}
            className={`p-3 rounded-xl border text-left transition-all text-xs cursor-pointer ${
              activeScenario === 'NORMAL'
                ? 'bg-emerald-950/40 border-emerald-500 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="font-bold text-emerald-400 mb-0.5">Dry Baseline</div>
            <div className="text-[10px] text-slate-400">Moist: 35%, Tilt: 1°</div>
          </button>

          <button
            onClick={() => handleRunPreset('MONSOON_SURGE')}
            className={`p-3 rounded-xl border text-left transition-all text-xs cursor-pointer ${
              activeScenario === 'MONSOON_SURGE'
                ? 'bg-amber-950/40 border-amber-500 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="font-bold text-amber-400 mb-0.5">Monsoon Surge</div>
            <div className="text-[10px] text-slate-400">Moist: 78%, Tilt: 6.5°</div>
          </button>

          <button
            onClick={() => handleRunPreset('RAPID_TILT')}
            className={`p-3 rounded-xl border text-left transition-all text-xs cursor-pointer ${
              activeScenario === 'RAPID_TILT'
                ? 'bg-amber-950/40 border-amber-500 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="font-bold text-amber-400 mb-0.5">Berm Slumping</div>
            <div className="text-[10px] text-slate-400">Tilt: 18°, Fs &lt; 1.0</div>
          </button>

          <button
            onClick={() => handleRunPreset('PIPING_EROSION')}
            className={`p-3 rounded-xl border text-left transition-all text-xs cursor-pointer ${
              activeScenario === 'PIPING_EROSION'
                ? 'bg-purple-950/40 border-purple-500 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="font-bold text-purple-400 mb-0.5">Piping Seepage</div>
            <div className="text-[10px] text-slate-400">Audio RMS: 750 (High)</div>
          </button>

          <button
            onClick={() => handleRunPreset('FLASH_FLOOD')}
            className={`p-3 rounded-xl border text-left transition-all text-xs cursor-pointer ${
              activeScenario === 'FLASH_FLOOD'
                ? 'bg-rose-950/40 border-rose-500 text-white critical-pulse-box'
                : 'bg-slate-950 border-slate-800 text-rose-400 hover:border-rose-700'
            }`}
          >
            <div className="font-bold text-rose-400 mb-0.5">💥 Breach Disaster</div>
            <div className="text-[10px] text-slate-400">Moist: 95%, Tilt: 15°</div>
          </button>
        </div>
      </div>

      {/* Manual Sensor Parameter Sliders */}
      <div className="border-t border-slate-800/80 pt-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            2. Custom Sensor Parameter Sliders
          </span>
          <div className="text-xs font-mono">
            Predicted <b className="text-cyan-400">F<sub>s</sub> = {calculatedFs.toFixed(3)}</b>{' '}
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              calculatedFs < 0.7 ? 'bg-rose-500/20 text-rose-300' : calculatedFs < 1.0 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
            }`}>
              {calculatedFs < 0.7 ? 'CRITICAL FAILURE' : calculatedFs < 1.0 ? 'ALERT WARNING' : 'SAFE'}
            </span>
          </div>
        </div>

        {/* Target Node Selector */}
        <div>
          <label className="block text-slate-400 text-xs mb-1 font-medium">Target Edge Node</label>
          <select
            value={targetNode}
            onChange={(e) => {
              setTargetNode(e.target.value);
              onSelectNode(e.target.value);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            {nodes.map((n) => (
              <option key={n.node_id} value={n.node_id}>
                {n.node_id} ({n.zone_name})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Soil Moisture Slider */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5 text-sky-400" /> Soil Moisture
              </span>
              <span className="font-mono font-bold text-sky-400">{moisture.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="0.5"
              value={moisture}
              onChange={(e) => setMoisture(parseFloat(e.target.value))}
              className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0% (Dry)</span>
              <span>100% (Submerged)</span>
            </div>
          </div>

          {/* Tilt Slider */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-amber-400" /> Structural Tilt
              </span>
              <span className="font-mono font-bold text-amber-400">{tilt.toFixed(1)}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="45"
              step="0.5"
              value={tilt}
              onChange={(e) => setTilt(parseFloat(e.target.value))}
              className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0° (Vertical)</span>
              <span>45° (Slump Failure)</span>
            </div>
          </div>

          {/* Audio RMS Slider */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 text-purple-400" /> Acoustic Piping
              </span>
              <span className="font-mono font-bold text-purple-400">{audio.toFixed(0)} RMS</span>
            </div>
            <input
              type="range"
              min="0"
              max="1000"
              step="10"
              value={audio}
              onChange={(e) => setAudio(parseFloat(e.target.value))}
              className="w-full accent-purple-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0 (Silent)</span>
              <span>1000 (Violent Seepage)</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleManualIngest}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs transition-all flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/20 cursor-pointer"
        >
          <Zap className="w-4 h-4" />
          <span>{loading ? 'Ingesting via HTTP...' : `Ingest Telemetry Packet -> ${targetNode}`}</span>
        </button>
      </div>

    </div>
  );
};
