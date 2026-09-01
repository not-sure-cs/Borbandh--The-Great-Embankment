import React, { useState, useEffect } from 'react';
import { 
  Waves, 
  Activity, 
  ShieldCheck, 
  AlertTriangle, 
  Radio, 
  FileSpreadsheet, 
  Users, 
  Cpu, 
  MapPin, 
  Zap
} from 'lucide-react';
import { SystemStats } from '../types';

interface HeaderProps {
  stats: SystemStats | null;
  connected: boolean;
  activeTab: 'dashboard' | 'map' | 'ledger' | 'citizen' | 'simulator';
  onSelectTab: (tab: 'dashboard' | 'map' | 'ledger' | 'citizen' | 'simulator') => void;
  onOpenSimModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  connected,
  activeTab,
  onSelectTab,
  onOpenSimModal,
}) => {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' }) + ' IST');
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const hasCritical = (stats?.critical_count ?? 0) > 0 || (stats?.min_factor_of_safety ?? 2) < 0.7;

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Logo & Platform Info */}
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
              hasCritical 
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 critical-pulse-box' 
                : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
            }`}>
              <Waves className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
                  Aero<span className="text-cyan-400">Hydro</span> AI
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Assam Basin
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Autonomous Embankment Resilience & Early Warning System
              </p>
            </div>
          </div>

          {/* Quick Metrics Badges */}
          <div className="hidden lg:flex items-center space-x-3 text-xs">
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center space-x-2">
              <span className="text-slate-400">Nodes Active:</span>
              <span className="font-semibold text-cyan-400 font-mono">{stats?.active_nodes ?? 5}</span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center space-x-2">
              <span className="text-slate-400">Status:</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span> {stats?.safe_count ?? 0} Safe
              </span>
              {(stats?.warning_count ?? 0) > 0 && (
                <span className="text-amber-400 font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span> {stats?.warning_count} Warn
                </span>
              )}
              {(stats?.critical_count ?? 0) > 0 && (
                <span className="text-rose-400 font-semibold flex items-center gap-1 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span> {stats?.critical_count} Breach
                </span>
              )}
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center space-x-2">
              <span className="text-slate-400">Time:</span>
              <span className="font-mono text-slate-200">{timeStr}</span>
            </div>
          </div>

          {/* Right Action: SSE Live Status & Simulator Trigger */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onOpenSimModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-500 to-rose-500 text-white hover:brightness-110 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Simulate Breach</span>
            </button>

            <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg text-xs">
              <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'}`}></span>
              <span className="text-slate-300 font-mono text-[11px] hidden sm:inline">
                {connected ? 'LIVE STREAM' : 'RECONNECTING'}
              </span>
            </div>
          </div>

        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1 sm:space-x-2 border-t border-slate-800/60 overflow-x-auto py-2 scrollbar-none text-xs sm:text-sm font-medium">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Overview & Gauges</span>
          </button>

          <button
            onClick={() => onSelectTab('map')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'map'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>GIS Map & Satellites</span>
          </button>

          <button
            onClick={() => onSelectTab('ledger')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'ledger'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Contractor Ledger</span>
          </button>

          <button
            onClick={() => onSelectTab('citizen')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'citizen'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Citizen Crowdsource</span>
          </button>

          <button
            onClick={() => onSelectTab('simulator')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'simulator'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>IoT Edge Lab</span>
          </button>
        </div>

      </div>
    </header>
  );
};
