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
      <div className="bg-white border border-gray-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
        {/* Top Row: Search Input + Basin/District Dropdowns */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          
          {/* Rounded Google Search Input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              ref={ref}
              type="text"
              value={filters.searchQuery}
              onChange={handleSearchChange}
              placeholder="Search station ID, reach name, river, or coordinates (Press Cmd+K)..."
              className="w-full pl-10 pr-16 py-2.5 bg-gray-50/80 border border-gray-200 rounded-full text-sm text-gray-800 placeholder-gray-400 hover:bg-white hover:border-gray-300 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all shadow-2xs"
              aria-label="Filter embankment telemetry stations"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-semibold text-gray-400 bg-white border border-gray-200 rounded shadow-2xs">
                ⌘K
              </kbd>
            </div>
          </div>

          {/* Dropdown Filters */}
          <div className="flex items-center gap-3">
            {/* River Basin Dropdown */}
            <select
              value={filters.riverBasin}
              onChange={handleBasinChange}
              className="bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-full px-4 py-2.5 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 cursor-pointer shadow-2xs transition-all font-medium"
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
              className="bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-full px-4 py-2.5 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 cursor-pointer shadow-2xs transition-all font-medium"
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
                className="p-2 text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-full text-xs transition-colors"
                title="Reset all filters"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

        </div>

        {/* Bottom Row: Risk Tier Chips & Station Counter */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 text-xs">
          <div className="flex items-center space-x-2 overflow-x-auto scrollbar-none py-0.5">
            <span className="text-xs font-medium text-gray-500 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Risk Status:
            </span>

            <button
              onClick={() => handleRiskTierChange('ALL')}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                filters.riskTier === 'ALL'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              All Stations
            </button>

            <button
              onClick={() => handleRiskTierChange('SAFE')}
              className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                filters.riskTier === 'SAFE'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Safe (F<sub>s</sub> ≥ 1.0)</span>
            </button>

            <button
              onClick={() => handleRiskTierChange('WATCH')}
              className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                filters.riskTier === 'WATCH'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Watch (0.7 ≤ F<sub>s</sub> &lt; 1.0)</span>
            </button>

            <button
              onClick={() => handleRiskTierChange('CRITICAL')}
              className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                filters.riskTier === 'CRITICAL'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Critical Breach (F<sub>s</sub> &lt; 0.7)</span>
            </button>
          </div>

          <div className="text-xs text-gray-500 font-normal">
            Showing <b className="text-gray-900 font-semibold">{filteredCount}</b> of {totalCount} stations
          </div>
        </div>

      </div>
    );
  }
);

StationFilterBar.displayName = 'StationFilterBar';
