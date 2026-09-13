import React from 'react';
import { 
  Waves, 
  Activity, 
  ShieldCheck, 
  AlertTriangle, 
  Radio, 
  Cpu, 
  MapPin, 
  Zap,
  Search
} from 'lucide-react';
import { SystemStats } from '../types';
import { CivicTopBar } from './CivicTopBar';

interface HeaderProps {
  stats: SystemStats | null;
  connected: boolean;
  activeTab: 'dashboard' | 'map' | 'simulator';
  onSelectTab: (tab: 'dashboard' | 'map' | 'simulator') => void;
  onOpenSimModal: () => void;
  onFocusSearch?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  connected,
  activeTab,
  onSelectTab,
  onOpenSimModal,
  onFocusSearch,
}) => {
  const hasCritical = (stats?.critical_count ?? 0) > 0 || (stats?.min_factor_of_safety ?? 2) < 0.7;

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 shadow-2xl">
      {/* 1. Civic Utility Bar */}
      <CivicTopBar connected={connected} />

      {/* 2. Main Brand Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Logo & Platform Info */}
          <div className="flex items-center space-x-3">
            <div
              className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
                hasCritical
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 critical-pulse-box'
                  : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              }`}
            >
              <Waves className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight text-white flex items-center gap-1.5">
                  Bor<span className="text-cyan-400">Bandh</span>
                  <span className="text-xs text-slate-400 font-mono font-normal">AI</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-cyan-950 text-cyan-300 border border-cyan-800 hidden xs:inline-block">
                  বৰবান্ধ • Assam Basin
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Autonomous Embankment Resilience &amp; Early Warning System
              </p>
            </div>
          </div>

          {/* Quick Search Jump Button (Cmd+K) */}
          <div className="hidden md:flex items-center">
            <button
              onClick={onFocusSearch}
              className="flex items-center space-x-3 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-400 transition-all cursor-pointer group"
              title="Click or press Cmd+K to search stations"
            >
              <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors" />
              <span className="group-hover:text-slate-200 transition-colors">
                Jump to station or reach...
              </span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-400 bg-slate-800 border border-slate-700 rounded shadow-sm">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right Action: Simulate Breach & Quick Status Badges */}
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <button
              onClick={onOpenSimModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-500 to-rose-500 text-white hover:brightness-110 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Simulate Breach</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav aria-label="Platform Views" className="flex items-center space-x-1 sm:space-x-2 border-t border-slate-800/80 overflow-x-auto py-2 scrollbar-none text-xs sm:text-sm font-medium">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Overview &amp; Triage</span>
          </button>

          <button
            onClick={() => onSelectTab('map')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'map'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>GIS Map &amp; Satellites</span>
          </button>

          <button
            onClick={() => onSelectTab('simulator')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'simulator'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>IoT Simulation Lab</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
