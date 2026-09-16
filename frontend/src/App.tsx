import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { GrafanaDashboardEmbed } from './components/GrafanaDashboardEmbed';
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
  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const [geoData, setGeoData] = useState<GeoJSONData | null>(null);

  // Initial Data Fetch
  const loadInitialData = async () => {
    try {
      const [statsData, nodesData, alertsData, geo] = await Promise.all([
        api.getStats().catch(() => null),
        api.getNodes().catch(() => []),
        api.getAlerts().catch(() => []),
        api.getGeoJSON().catch(() => null),
      ]);

      if (statsData) setStats(statsData);
      if (nodesData.length > 0) {
        setNodes(nodesData);
        if (!selectedNodeId) setSelectedNodeId(nodesData[0].node_id);
      }
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
      // Update active node list with latest telemetry
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

  const activeCriticalTelemetry = useMemo(() => {
    return nodes.find((n) => (n.last_telemetry?.factor_of_safety ?? 2.0) < 1.0)?.last_telemetry ?? null;
  }, [nodes]);

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#202124] flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      
      {/* Govt of Assam Civic Header */}
      <Header
        stats={stats}
        connected={connected}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenSimModal={() => setShowSimModal(true)}
      />

      {/* Real-time Emergency Alert Banner (Snaps into view on Fs < 1.0) */}
      <EmergencyAlertBanner
        alerts={alerts}
        activeCriticalTelemetry={activeCriticalTelemetry}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Tab 1: Primary Grafana Kiosk Analytics & Visual Dashboard */}
        {activeTab === 'dashboard' && (
          <GrafanaDashboardEmbed
            nodes={nodes}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onOpenSimModal={() => setShowSimModal(true)}
          />
        )}

        {/* Tab 2: Topographic GIS Satellite Leaflet Twin */}
        {activeTab === 'map' && (
          <div className="space-y-6">
            <EmbankmentMap
              nodes={nodes}
              geoData={geoData}
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

      {/* Simulator Modal (Triggered by Header or Dashboard Action Button) */}
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
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer"
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

      {/* Govt of Assam Civic Footer */}
      <footer className="border-t border-gray-200 bg-white py-6 text-center text-xs text-gray-500 font-sans mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-gray-800">BorBandh AI</span>
            <span>•</span>
            <span>Govt. of Assam • Water Resources Department</span>
          </div>
          <div className="flex items-center space-x-4 text-xs text-gray-500">
            <a 
              href="http://localhost:3000" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-blue-600 transition-colors"
            >
              Grafana Engine (:3000)
            </a>
            <span>•</span>
            <span>TimescaleDB &amp; PostGIS (:5433)</span>
            <span>•</span>
            <span>ISRO Bhuvan GIS</span>
            <span>•</span>
            <span>CWC Hydraulic Sensors</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
