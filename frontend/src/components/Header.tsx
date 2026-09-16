import React from 'react';
import { 
  Waves, 
  Activity, 
  MapPin, 
  Cpu, 
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
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-2xs">
      {/* 1. Civic Utility Bar */}
      <CivicTopBar connected={connected} />

      {/* 2. Main Brand Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 sm:h-20">
          
          {/* Logo & Platform Info */}
          <div className="flex items-center space-x-3.5">
            <div
              className={`p-2.5 rounded-2xl flex items-center justify-center transition-all ${
                hasCritical
                  ? 'bg-rose-50 text-rose-600 border border-rose-200 critical-pulse-box'
                  : 'bg-blue-50 text-blue-600 border border-blue-100 shadow-2xs'
              }`}
            >
              <Waves className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-xl tracking-tight text-[#202124] flex items-center gap-1">
                  BorBandh <span className="text-blue-600 font-bold">AI</span>
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-200 hidden xs:inline-block">
                  বৰবান্ধ • Assam Basin
                </span>
              </div>
              <p className="text-xs text-gray-500 font-normal hidden sm:block mt-0.5">
                Autonomous Embankment Resilience &amp; Earth Observation Platform
              </p>
            </div>
          </div>

          {/* Quick Search Jump Button (Cmd+K) - Google Rounded Pill */}
          <div className="hidden md:flex items-center">
            <button
              onClick={onFocusSearch}
              className="flex items-center space-x-3 px-4 py-2 rounded-full bg-gray-100/90 hover:bg-white border border-transparent hover:border-gray-300 text-sm text-gray-500 transition-all cursor-pointer group shadow-2xs"
              title="Click or press Cmd+K to search stations"
            >
              <Search className="w-4 h-4 text-gray-500 group-hover:text-blue-600 transition-colors" />
              <span className="group-hover:text-gray-900 transition-colors text-xs font-normal">
                Search stations, reaches, or rivers...
              </span>
              <kbd className="px-2 py-0.5 text-[10px] font-mono font-semibold text-gray-600 bg-white border border-gray-300 rounded-md shadow-2xs">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right Action: Simulate Breach Action Button */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onOpenSimModal}
              className="flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-medium bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>Simulate Breach</span>
            </button>
          </div>

        </div>

        {/* Navigation Tabs - Google Earth Engine Style with Blue Underline */}
        <nav aria-label="Platform Views" className="flex items-center space-x-6 border-t border-gray-100 overflow-x-auto pt-1 scrollbar-none text-sm">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`flex items-center space-x-2 py-3 px-1 transition-all border-b-2 whitespace-nowrap text-sm ${
              activeTab === 'dashboard'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 font-medium'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Overview &amp; Triage</span>
          </button>

          <button
            onClick={() => onSelectTab('map')}
            className={`flex items-center space-x-2 py-3 px-1 transition-all border-b-2 whitespace-nowrap text-sm ${
              activeTab === 'map'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 font-medium'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>GIS Map &amp; Satellites</span>
          </button>

          <button
            onClick={() => onSelectTab('simulator')}
            className={`flex items-center space-x-2 py-3 px-1 transition-all border-b-2 whitespace-nowrap text-sm ${
              activeTab === 'simulator'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 font-medium'
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
