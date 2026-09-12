import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SafetyGauge } from './components/SafetyGauge';
import { TelemetryChart } from './components/TelemetryChart';
import { NodeStatusGrid } from './components/NodeStatusGrid';
import { EmbankmentMap } from './components/EmbankmentMap';
import { CitizenReportForm } from './components/CitizenReportForm';
import { CitizenReportFeed } from './components/CitizenReportFeed';
import { EmergencyAlertBanner } from './components/EmergencyAlertBanner';
import { IoTSimulatorPanel } from './components/IoTSimulatorPanel';
import { api, sseClient } from './services/api';
import { 
  NodeTelemetry, 
  EmbankmentNode, 
  CitizenReport, 
  AlertLog, 
  SystemStats, 
  GeoJSONData 
} from './types';
import { Radio, Activity, MapPin, Users, Cpu, ShieldAlert } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map' | 'citizen' | 'simulator'>('dashboard');
  const [showSimModal, setShowSimModal] = useState(false);
  const [connected, setConnected] = useState(false);

  // Core Data State
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [nodes, setNodes] = useState<EmbankmentNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('NODE-MAJULI-01');
  const [history, setHistory] = useState<NodeTelemetry[]>([]);
  const [reports, setReports] = useState<CitizenReport[]>([]);
  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const [geoData, setGeoData] = useState<GeoJSONData | null>(null);

  // Initial Data Fetch
  const loadInitialData = async () => {
    try {
      const [statsData, nodesData, histData, reportsData, alertsData, geo] = await Promise.all([
        api.getStats().catch(() => null),
        api.getNodes().catch(() => []),
        api.getTelemetryHistory().catch(() => []),
        api.getCitizenReports().catch(() => []),
        api.getAlerts().catch(() => []),
        api.getGeoJSON().catch(() => null),
      ]);

      if (statsData) setStats(statsData);
      if (nodesData.length > 0) {
        setNodes(nodesData);
        if (!selectedNodeId) setSelectedNodeId(nodesData[0].node_id);
      }
      if (histData.length > 0) setHistory(histData);
      if (reportsData.length > 0) setReports(reportsData);
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

    sseClient.on('report', (rep: CitizenReport) => {
      setReports((prev) => [rep, ...prev]);
      api.getStats().then(setStats).catch(() => {});
    });

    sseClient.connect();

    return () => {
      sseClient.disconnect();
    };
  }, []);

  const selectedNode = nodes.find((n) => n.node_id === selectedNodeId) ?? nodes[0];
  const activeCriticalTelemetry = nodes.find((n) => (n.last_telemetry?.factor_of_safety ?? 2.0) < 1.0)?.last_telemetry ?? null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-white">
      
      {/* Platform Header */}
      <Header
        stats={stats}
        connected={connected}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenSimModal={() => setShowSimModal(true)}
      />

      {/* Emergency Alert Banner (Visible on Fs < 1.0) */}
      <EmergencyAlertBanner
        alerts={alerts}
        activeCriticalTelemetry={activeCriticalTelemetry}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            
            {/* Top Row: Radial Safety Gauge + Multi-Series Trend Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4">
                <SafetyGauge
                  telemetry={selectedNode?.last_telemetry ?? null}
                  selectedNodeName={selectedNode?.zone_name}
                />
              </div>
              <div className="lg:col-span-8">
                <TelemetryChart
                  history={history}
                  selectedNodeId={selectedNodeId}
                />
              </div>
            </div>

            {/* Middle Row: Active Station Cards */}
            <NodeStatusGrid
              nodes={nodes}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />

            {/* Bottom Row: Quick GIS Snapshot & Recent Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7">
                <EmbankmentMap
                  nodes={nodes}
                  geoData={geoData}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                />
              </div>
              <div className="lg:col-span-5">
                <CitizenReportFeed reports={reports} />
              </div>
            </div>

          </div>
        )}

        {activeTab === 'map' && (
          <div className="space-y-6">
            <EmbankmentMap
              nodes={nodes}
              geoData={geoData}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />
            <NodeStatusGrid
              nodes={nodes}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />
          </div>
        )}

        {activeTab === 'citizen' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6">
              <CitizenReportForm onSuccess={loadInitialData} />
            </div>
            <div className="lg:col-span-6">
              <CitizenReportFeed reports={reports} />
            </div>
          </div>
        )}

        {activeTab === 'simulator' && (
          <IoTSimulatorPanel
            nodes={nodes}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />
        )}

      </main>

      {/* Simulator Modal (Triggered by Header Button) */}
      {showSimModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-2xl">
            <div className="flex justify-end p-2">
              <button
                onClick={() => setShowSimModal(false)}
                className="bg-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold"
              >
                Close Lab [✕]
              </button>
            </div>
            <IoTSimulatorPanel
              nodes={nodes}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              onClose={() => setShowSimModal(false)}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>BorBandh AI • Assam State Embankment Protection Network</span>
          <span>100% Vanilla Go Standard Library Backend + React TypeScript Frontend</span>
        </div>
      </footer>

    </div>
  );
};
