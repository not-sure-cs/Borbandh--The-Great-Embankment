import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Header } from './components/Header';
import { MetricsSummaryRow } from './components/MetricsSummaryRow';
import { StationFilterBar, StationFilterState } from './components/StationFilterBar';
import { StationTableView } from './components/StationTableView';
import { StationInspector } from './components/StationInspector';
import { TelemetryChart } from './components/TelemetryChart';
import { EmbankmentMap } from './components/EmbankmentMap';
import { EmergencyAlertBanner } from './components/EmergencyAlertBanner';
import { IoTSimulatorPanel } from './components/IoTSimulatorPanel';
import { api, sseClient } from './services/api';
import { 
  NodeTelemetry, 
  EmbankmentNode, 
  AlertLog, 
  SystemStats, 
  GeoJSONData 
} from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map' | 'simulator'>('dashboard');
  const [showSimModal, setShowSimModal] = useState(false);
  const [connected, setConnected] = useState(false);

  // Core Data State
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [nodes, setNodes] = useState<EmbankmentNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('NODE-MAJULI-01');
  const [history, setHistory] = useState<NodeTelemetry[]>([]);
  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const [geoData, setGeoData] = useState<GeoJSONData | null>(null);

  // Station Filter State
  const [filters, setFilters] = useState<StationFilterState>({
    searchQuery: '',
    riverBasin: 'ALL',
    district: 'ALL',
    riskTier: 'ALL',
  });

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Initial Data Fetch
  const loadInitialData = async () => {
    try {
      const [statsData, nodesData, histData, alertsData, geo] = await Promise.all([
        api.getStats().catch(() => null),
        api.getNodes().catch(() => []),
        api.getTelemetryHistory().catch(() => []),
        api.getAlerts().catch(() => []),
        api.getGeoJSON().catch(() => null),
      ]);

      if (statsData) setStats(statsData);
      if (nodesData.length > 0) {
        setNodes(nodesData);
        if (!selectedNodeId) setSelectedNodeId(nodesData[0].node_id);
      }
      if (histData.length > 0) setHistory(histData);
      if (alertsData.length > 0) setAlerts(alertsData);
      if (geo) setGeoData(geo);
    } catch (err) {
      console.error('Error loading initial data:', err);
    }
  };

  useEffect(() => {
    loadInitialData();

    // Setup Real-time SSE Listeners
    sseClient.onStatusChange((status) => {
      setConnected(status);
    });

    sseClient.on('telemetry', (data: NodeTelemetry) => {
      // Update history
      setHistory((prev) => [...prev.slice(-300), data]);

      // Update active node list
      setNodes((prev) =>
        prev.map((n) =>
          n.node_id === data.node_id
            ? { ...n, last_telemetry: data, last_seen: data.created_at }
            : n
        )
      );

      // Refresh summary stats
      api.getStats().then(setStats).catch(() => {});
    });

    sseClient.on('alert', (alt: AlertLog) => {
      setAlerts((prev) => [alt, ...prev.slice(0, 100)]);
    });

    sseClient.connect();

    return () => {
      sseClient.disconnect();
    };
  }, []);

  // Global Keyboard Shortcut: Cmd + K / Ctrl + K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (activeTab !== 'dashboard') {
          setActiveTab('dashboard');
        }
        setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 50);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  const handleFocusSearch = () => {
    if (activeTab !== 'dashboard') {
      setActiveTab('dashboard');
    }
    setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 50);
  };

  // Filter nodes based on user filter choices
  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      // 1. Search query filter
      if (filters.searchQuery.trim() !== '') {
        const query = filters.searchQuery.toLowerCase();
        const matchesId = node.node_id.toLowerCase().includes(query);
        const matchesZone = node.zone_name.toLowerCase().includes(query);
        const matchesRiver = node.river.toLowerCase().includes(query);
        if (!matchesId && !matchesZone && !matchesRiver) {
          return false;
        }
      }

      // 2. River basin filter
      if (filters.riverBasin !== 'ALL') {
        if (!node.river.toLowerCase().includes(filters.riverBasin.toLowerCase())) {
          return false;
        }
      }

      // 3. District filter
      if (filters.district !== 'ALL') {
        if (!node.zone_name.toLowerCase().includes(filters.district.toLowerCase())) {
          return false;
        }
      }

      // 4. Risk tier filter
      if (filters.riskTier !== 'ALL') {
        const fs = node.last_telemetry?.factor_of_safety ?? 1.85;
        if (filters.riskTier === 'SAFE' && fs < 1.0) return false;
        if (filters.riskTier === 'WATCH' && (fs < 0.7 || fs >= 1.0)) return false;
        if (filters.riskTier === 'CRITICAL' && fs >= 0.7) return false;
      }

      return true;
    });
  }, [nodes, filters]);

  const selectedNode = useMemo(() => {
    const found = nodes.find((n) => n.node_id === selectedNodeId);
    return found ?? nodes[0] ?? null;
  }, [nodes, selectedNodeId]);

  const activeCriticalTelemetry = useMemo(() => {
    return nodes.find((n) => (n.last_telemetry?.factor_of_safety ?? 2.0) < 1.0)?.last_telemetry ?? null;
  }, [nodes]);

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#202124] flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      
      {/* Google Earth Engine Style Header */}
      <Header
        stats={stats}
        connected={connected}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenSimModal={() => setShowSimModal(true)}
        onFocusSearch={handleFocusSearch}
      />

      {/* Emergency Alert Banner (Visible on Fs < 1.0) */}
      <EmergencyAlertBanner
        alerts={alerts}
        activeCriticalTelemetry={activeCriticalTelemetry}
      />

      {/* Main Content Area - Generous Spacing & Decluttered Layout */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Tab 1: Overview & Geotechnical Station Triage (Split-View) */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* 1. Spacious Metrics & Summary KPI Row */}
            <MetricsSummaryRow
              stats={stats}
              nodes={nodes}
              totalAlertsCount={alerts.length}
            />

            {/* 2. Roomy Station Filter & Search Control Bar */}
            <StationFilterBar
              ref={searchInputRef}
              filters={filters}
              onFilterChange={setFilters}
              filteredCount={filteredNodes.length}
              totalCount={nodes.length}
            />

            {/* 3. Split-View Station Triage Layout with Ample Breathing Room */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column (5 cols): High-Density Telemetry Table & Trend Chart */}
              <div className="lg:col-span-6 xl:col-span-5 space-y-8">
                <StationTableView
                  nodes={filteredNodes}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                />

                <TelemetryChart
                  history={history}
                  selectedNodeId={selectedNodeId}
                />
              </div>

              {/* Right Column (7 cols): Deep Diagnostic Inspector */}
              <div className="lg:col-span-6 xl:col-span-7 space-y-8">
                <StationInspector
                  node={selectedNode}
                  alerts={alerts}
                  onOpenSimModal={() => setShowSimModal(true)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Full GIS Geospatial Map & Satellites */}
        {activeTab === 'map' && (
          <div className="space-y-8">
            <EmbankmentMap
              nodes={nodes}
              geoData={geoData}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />

            <StationTableView
              nodes={nodes}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />
          </div>
        )}

        {/* Tab 3: IoT Edge Telemetry Simulation Lab */}
        {activeTab === 'simulator' && (
          <div className="space-y-8">
            <IoTSimulatorPanel
              nodes={nodes}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />
          </div>
        )}

      </main>

      {/* Simulator Modal (Triggered by Header Action Button) */}
      {showSimModal && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-label="IoT Simulation Laboratory"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-3xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-900">
                IoT Edge Telemetry Simulation Lab
              </span>
              <button
                onClick={() => setShowSimModal(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              >
                Close [✕]
              </button>
            </div>
            <div className="p-6">
              <IoTSimulatorPanel
                nodes={nodes}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                onClose={() => setShowSimModal(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Google Earth Engine Style Footer */}
      <footer className="border-t border-gray-200 bg-white py-8 text-center text-xs text-gray-500 font-sans mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-medium text-gray-700">BorBandh AI</span>
            <span>•</span>
            <span>Govt. of Assam • Water Resources Department</span>
          </div>
          <div className="flex items-center space-x-4 text-xs text-gray-500">
            <a href="https://earthengine.google.com/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">
              Google Earth Engine Ingestion
            </a>
            <span>•</span>
            <span>ISRO Bhuvan GIS Link</span>
            <span>•</span>
            <span>CWC Hydraulic Sensors</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
