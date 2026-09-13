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

  // Keep selected node valid
  const selectedNode = useMemo(() => {
    const found = nodes.find((n) => n.node_id === selectedNodeId);
    return found ?? nodes[0] ?? null;
  }, [nodes, selectedNodeId]);

  const activeCriticalTelemetry = useMemo(() => {
    return nodes.find((n) => (n.last_telemetry?.factor_of_safety ?? 2.0) < 1.0)?.last_telemetry ?? null;
  }, [nodes]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-slate-950 font-sans">
      
      {/* Platform Header with Civic Top Bar */}
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

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Tab 1: Overview & Geotechnical Station Triage (Split-View) */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* 1. Metrics & Summary KPI Row */}
            <MetricsSummaryRow
              stats={stats}
              nodes={nodes}
              totalAlertsCount={alerts.length}
            />

            {/* 2. Station Filter & Search Control Bar */}
            <StationFilterBar
              ref={searchInputRef}
              filters={filters}
              onFilterChange={setFilters}
              filteredCount={filteredNodes.length}
              totalCount={nodes.length}
            />

            {/* 3. Split-View Station Triage Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column (5 cols): High-Density Telemetry Table & Trend Chart */}
              <div className="lg:col-span-6 xl:col-span-5 space-y-6">
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

              {/* Right Column (7 cols): Deep Diagnostic Inspector & GIS Reach Preview */}
              <div className="lg:col-span-6 xl:col-span-7 space-y-6">
                <StationInspector
                  node={selectedNode}
                  alerts={alerts}
                  onOpenSimModal={() => setShowSimModal(true)}
                />

                <EmbankmentMap
                  nodes={nodes}
                  geoData={geoData}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Full GIS Geospatial Map & Satellites */}
        {activeTab === 'map' && (
          <div className="space-y-6">
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
          <div className="space-y-6">
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
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="flex justify-between items-center p-3 border-b border-slate-800 bg-slate-950/60">
              <span className="text-xs font-mono font-bold text-slate-300">
                EDGE SIMULATION LAB MODAL
              </span>
              <button
                onClick={() => setShowSimModal(false)}
                className="bg-slate-800 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg text-xs font-mono font-bold"
              >
                Close [✕]
              </button>
            </div>
            <div className="p-4">
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

      {/* Utilitarian Civic Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-6 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Govt. of Assam • Water Resources Department | BorBandh AI Defense Network</span>
          <span>CWC Hydrological Sync • Sentinel-1 SAR Backscatter • 100% Go Backend</span>
        </div>
      </footer>
    </div>
  );
};
