import React, { useState } from 'react';
import { Cpu, Zap, Play, Pause, Droplets, Compass, Volume2, Sparkles } from 'lucide-react';
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
    <div className="bg-white border border-gray-200/90 rounded-2xl p-6 sm:p-8 shadow-2xs space-y-6">
      
      {/* Panel Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                IoT Edge Telemetry Simulation Laboratory
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Stress-test ESP32 sensor thresholds, ML regression formulas, and automated SMS/WhatsApp alerts
              </p>
            </div>
          </div>
        </div>

        {/* Simulator Toggle */}
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleBackgroundSim}
            className={`px-4 py-2 rounded-full border text-xs font-medium flex items-center gap-2 transition-all ${
              isSimRunning
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-gray-100 text-gray-600 border-gray-200'
            }`}
          >
            {isSimRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isSimRunning ? 'Background Loop Active' : 'Loop Paused'}</span>
          </button>
        </div>
      </div>

      {resultMsg && (
        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{resultMsg}</span>
        </div>
      )}

      {/* Preset Scenarios Grid */}
      <div>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-3">
          1. Quick Scenario Injection (Stress Scenarios)
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button
            onClick={() => handleRunPreset('NORMAL')}
            className={`p-4 rounded-xl border text-left transition-all text-xs cursor-pointer shadow-2xs ${
              activeScenario === 'NORMAL'
                ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-100'
                : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold text-emerald-700 mb-1">Dry Baseline</div>
            <div className="text-xs text-gray-500">Moist: 35%, Tilt: 1°</div>
          </button>

          <button
            onClick={() => handleRunPreset('MONSOON_SURGE')}
            className={`p-4 rounded-xl border text-left transition-all text-xs cursor-pointer shadow-2xs ${
              activeScenario === 'MONSOON_SURGE'
                ? 'bg-amber-50 border-amber-500 text-amber-900 ring-2 ring-amber-100'
                : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold text-amber-700 mb-1">Monsoon Surge</div>
            <div className="text-xs text-gray-500">Moist: 78%, Tilt: 6.5°</div>
          </button>

          <button
            onClick={() => handleRunPreset('RAPID_TILT')}
            className={`p-4 rounded-xl border text-left transition-all text-xs cursor-pointer shadow-2xs ${
              activeScenario === 'RAPID_TILT'
                ? 'bg-amber-50 border-amber-500 text-amber-900 ring-2 ring-amber-100'
                : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold text-amber-700 mb-1">Berm Slumping</div>
            <div className="text-xs text-gray-500">Tilt: 18°, Fs &lt; 1.0</div>
          </button>

          <button
            onClick={() => handleRunPreset('PIPING_EROSION')}
            className={`p-4 rounded-xl border text-left transition-all text-xs cursor-pointer shadow-2xs ${
              activeScenario === 'PIPING_EROSION'
                ? 'bg-purple-50 border-purple-500 text-purple-900 ring-2 ring-purple-100'
                : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold text-purple-700 mb-1">Piping Seepage</div>
            <div className="text-xs text-gray-500">Audio RMS: 750 (High)</div>
          </button>

          <button
            onClick={() => handleRunPreset('FLASH_FLOOD')}
            className={`p-4 rounded-xl border text-left transition-all text-xs cursor-pointer shadow-2xs ${
              activeScenario === 'FLASH_FLOOD'
                ? 'bg-rose-50 border-rose-500 text-rose-900 ring-2 ring-rose-100'
                : 'bg-white border-gray-200 text-gray-700 hover:border-rose-300'
            }`}
          >
            <div className="font-semibold text-rose-700 mb-1">💥 Breach Disaster</div>
            <div className="text-xs text-gray-500">Moist: 95%, Tilt: 15°</div>
          </button>
        </div>
      </div>

      {/* Manual Sensor Parameter Sliders */}
      <div className="border-t border-gray-100 pt-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            2. Custom Sensor Parameter Sliders
          </span>
          <div className="text-xs font-mono">
            Predicted <b className="text-gray-900">F<sub>s</sub> = {calculatedFs.toFixed(3)}</b>{' '}
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ml-1 ${
              calculatedFs < 0.7 ? 'bg-rose-50 text-rose-700 border border-rose-200' : calculatedFs < 1.0 ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              {calculatedFs < 0.7 ? 'CRITICAL FAILURE' : calculatedFs < 1.0 ? 'ALERT WARNING' : 'SAFE'}
            </span>
          </div>
        </div>

        {/* Target Node Selector */}
        <div>
          <label className="block text-gray-700 text-xs mb-1.5 font-medium">Target Edge Node</label>
          <select
            value={targetNode}
            onChange={(e) => {
              setTargetNode(e.target.value);
              onSelectNode(e.target.value);
            }}
            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 shadow-2xs"
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
          <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200 space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-700 font-medium flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-sky-600" /> Soil Moisture
              </span>
              <span className="font-mono font-bold text-sky-700">{moisture.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="0.5"
              value={moisture}
              onChange={(e) => setMoisture(parseFloat(e.target.value))}
              className="w-full accent-blue-600 h-2 bg-gray-200 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-gray-400 font-mono">
              <span>0% (Dry)</span>
              <span>100% (Submerged)</span>
            </div>
          </div>

          {/* Tilt Slider */}
          <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200 space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-700 font-medium flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-amber-600" /> Structural Tilt
              </span>
              <span className="font-mono font-bold text-amber-700">{tilt.toFixed(1)}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="45"
              step="0.5"
              value={tilt}
              onChange={(e) => setTilt(parseFloat(e.target.value))}
              className="w-full accent-amber-500 h-2 bg-gray-200 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-gray-400 font-mono">
              <span>0° (Vertical)</span>
              <span>45° (Slump Failure)</span>
            </div>
          </div>

          {/* Audio RMS Slider */}
          <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200 space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-700 font-medium flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-purple-600" /> Acoustic Piping
              </span>
              <span className="font-mono font-bold text-purple-700">{audio.toFixed(0)} RMS</span>
            </div>
            <input
              type="range"
              min="0"
              max="1000"
              step="10"
              value={audio}
              onChange={(e) => setAudio(parseFloat(e.target.value))}
              className="w-full accent-purple-600 h-2 bg-gray-200 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-gray-400 font-mono">
              <span>0 (Silent)</span>
              <span>1000 (Violent Seepage)</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleManualIngest}
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
        >
          <Zap className="w-4 h-4" />
          <span>{loading ? 'Ingesting via HTTP...' : `Ingest Telemetry Packet -> ${targetNode}`}</span>
        </button>
      </div>

    </div>
  );
};
