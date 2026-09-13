import React, { forwardRef } from 'react';
import { Search, Filter, ShieldCheck, AlertTriangle, AlertCircle, X } from 'lucide-react';

export interface StationFilterState {
  searchQuery: string;
  riverBasin: string;
  district: string;
  riskTier: 'ALL' | 'SAFE' | 'WATCH' | 'CRITICAL';
}

interface StationFilterBarProps {
  filters: StationFilterState;
  onFilterChange: (filters: StationFilterState) => void;
  filteredCount: number;
  totalCount: number;
}

export const StationFilterBar = forwardRef<HTMLInputElement, StationFilterBarProps>(
  ({ filters, onFilterChange, filteredCount, totalCount }, ref) => {
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onFilterChange({ ...filters, searchQuery: e.target.value });
    };

    const handleBasinChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFilterChange({ ...filters, riverBasin: e.target.value });
    };

    const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFilterChange({ ...filters, district: e.target.value });
    };

    const handleRiskTierChange = (tier: 'ALL' | 'SAFE' | 'WATCH' | 'CRITICAL') => {
      onFilterChange({ ...filters, riskTier: tier });
    };

    const clearFilters = () => {
      onFilterChange({
        searchQuery: '',
        riverBasin: 'ALL',
        district: 'ALL',
        riskTier: 'ALL',
      });
    };

    const isFiltered =
      filters.searchQuery !== '' ||
      filters.riverBasin !== 'ALL' ||
      filters.district !== 'ALL' ||
      filters.riskTier !== 'ALL';

    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input with Cmd+K hint */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              ref={ref}
              type="text"
              value={filters.searchQuery}
              onChange={handleSearchChange}
              placeholder="Search station ID, zone name, river, or coordinates (Press Cmd+K)..."
              className="w-full pl-9 pr-16 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
              aria-label="Filter embankment telemetry stations"
            />
            <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-400 bg-slate-800 border border-slate-700 rounded shadow-sm">
                ⌘K
              </kbd>
            </div>
          </div>

          {/* Dropdown Filters: River Basin & District */}
          <div className="flex items-center gap-2">
            {/* River Basin Dropdown */}
            <select
              value={filters.riverBasin}
              onChange={handleBasinChange}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
              aria-label="Filter by River Basin"
            >
              <option value="ALL">All River Basins</option>
              <option value="Brahmaputra">Brahmaputra Basin</option>
              <option value="Barak">Barak Basin</option>
              <option value="Subansiri">Subansiri Reach</option>
            </select>

            {/* District Dropdown */}
            <select
              value={filters.district}
              onChange={handleDistrictChange}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
              aria-label="Filter by District"
            >
              <option value="ALL">All Districts</option>
              <option value="Majuli">Majuli Island</option>
              <option value="Golaghat">Golaghat (Kaziranga)</option>
              <option value="Kamrup">Kamrup Metro (Guwahati)</option>
              <option value="Dhubri">Dhubri (Border Reach)</option>
              <option value="Cachar">Cachar (Silchar)</option>
              <option value="Barpeta">Barpeta Reach</option>
            </select>

            {isFiltered && (
              <button
                onClick={clearFilters}
                className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg text-xs transition-colors"
                title="Reset all filters"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Bottom Row: Risk Tier Chips & Station Counter */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-xs">
          <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none py-0.5">
            <span className="text-[10px] font-mono uppercase text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Risk Tier:
            </span>

            <button
              onClick={() => handleRiskTierChange('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                filters.riskTier === 'ALL'
                  ? 'bg-slate-800 text-white border border-slate-700 font-semibold'
                  : 'bg-slate-950/60 text-slate-400 border border-slate-800/80 hover:text-slate-200'
              }`}
            >
              All Stations
            </button>

            <button
              onClick={() => handleRiskTierChange('SAFE')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                filters.riskTier === 'SAFE'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700 font-semibold'
                  : 'bg-slate-950/60 text-slate-400 border border-slate-800/80 hover:text-emerald-400'
              }`}
            >
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Safe (F<sub>s</sub> ≥ 1.0)</span>
            </button>

            <button
              onClick={() => handleRiskTierChange('WATCH')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                filters.riskTier === 'WATCH'
                  ? 'bg-amber-950 text-amber-300 border border-amber-700 font-semibold'
                  : 'bg-slate-950/60 text-slate-400 border border-slate-800/80 hover:text-amber-400'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>Watch (0.7 ≤ F<sub>s</sub> &lt; 1.0)</span>
            </button>

            <button
              onClick={() => handleRiskTierChange('CRITICAL')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                filters.riskTier === 'CRITICAL'
                  ? 'bg-rose-950 text-rose-300 border border-rose-700 font-semibold'
                  : 'bg-slate-950/60 text-slate-400 border border-slate-800/80 hover:text-rose-400'
              }`}
            >
              <AlertCircle className="w-3 h-3 text-rose-400" />
              <span>Critical Breach (F<sub>s</sub> &lt; 0.7)</span>
            </button>
          </div>

          <div className="text-[11px] font-mono text-slate-400">
            Showing <b className="text-white font-mono">{filteredCount}</b> of {totalCount} stations
          </div>
        </div>
      </div>
    );
  }
);

StationFilterBar.displayName = 'StationFilterBar';
