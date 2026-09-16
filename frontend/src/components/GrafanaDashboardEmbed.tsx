import React, { useState, useEffect, useRef } from 'react';
import { 
  Maximize2, 
  Minimize2, 
  ExternalLink, 
  RefreshCw, 
  Clock, 
  Sliders, 
  AlertCircle,
  Activity,
  Layers
} from 'lucide-react';
import { EmbankmentNode } from '../types';

interface GrafanaDashboardEmbedProps {
  nodes: EmbankmentNode[];
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
  onOpenSimModal?: () => void;
}

export const GrafanaDashboardEmbed: React.FC<GrafanaDashboardEmbedProps> = ({
  nodes,
  selectedNodeId,
  onSelectNode,
  onOpenSimModal,
}) => {
  const [timeRange, setTimeRange] = useState<{ label: string; from: string; to: string }>({
    label: 'Last 1 Hour',
    from: 'now-1h',
    to: 'now',
  });
  const [refreshRate, setRefreshRate] = useState<string>('5s');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isGrafanaAvailable, setIsGrafanaAvailable] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Time-range presets
  const timePresets = [
    { label: 'Last 15m', from: 'now-15m', to: 'now' },
    { label: 'Last 1h', from: 'now-1h', to: 'now' },
    { label: 'Last 6h', from: 'now-6h', to: 'now' },
    { label: 'Last 24h', from: 'now-24h', to: 'now' },
    { label: 'Last 7d', from: 'now-7d', to: 'now' },
  ];

  // Refresh interval presets
  const refreshPresets = ['5s', '10s', '30s', '1m', 'off'];

  // Check Grafana availability
  useEffect(() => {
    let isMounted = true;
    const checkGrafana = async () => {
      try {
        // Try proxy first, then direct
        const res = await fetch('/grafana/api/health', { method: 'GET' }).catch(() => null);
        if (res && res.ok) {
          if (isMounted) setIsGrafanaAvailable(true);
          return;
        }
        const directRes = await fetch('http://localhost:3000/api/health', { method: 'GET', mode: 'no-cors' }).catch(() => null);
        if (directRes && isMounted) {
          setIsGrafanaAvailable(true);
          return;
        }
        if (isMounted) setIsGrafanaAvailable(false);
      } catch {
        if (isMounted) setIsGrafanaAvailable(false);
      }
    };

    checkGrafana();
    const interval = setInterval(checkGrafana, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Build high-performance kiosk mode URL
  const grafanaBase = 'http://localhost:3000';
  const dashboardPath = '/d/borbandh-resilience/borbandh-embankment-resilience-overview';
  const queryParams = new URLSearchParams({
    orgId: '1',
    kiosk: 'tv', // Full Kiosk TV mode eliminates all navigation and toolbar DOM overhead
    from: timeRange.from,
    to: timeRange.to,
    'var-node_id': selectedNodeId,
    theme: 'light',
  });
  if (refreshRate !== 'off') {
    queryParams.set('refresh', refreshRate);
  }

  const iframeUrl = `${grafanaBase}${dashboardPath}?${queryParams.toString()}`;
  const standaloneUrl = `${grafanaBase}${dashboardPath}?orgId=1&var-node_id=${selectedNodeId}`;

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`w-full flex flex-col transition-all duration-200 ${
        isFullscreen ? 'fixed inset-0 z-50 bg-white p-4 h-screen' : 'space-y-4'
      }`}
    >
      {/* React Civic Control Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        
        {/* Left: Station Filter & Architecture Badge */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-semibold text-gray-800 tracking-wide uppercase font-mono">
              Grafana Kiosk Engine
            </span>
          </div>

          <div className="h-4 w-px bg-gray-200 hidden sm:block"></div>

          {/* Station Selector Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Station:</span>
            <select
              value={selectedNodeId}
              onChange={(e) => onSelectNode(e.target.value)}
              className="bg-gray-50 hover:bg-gray-100 border border-gray-300 text-gray-800 text-xs font-semibold rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors cursor-pointer"
            >
              <option value="ALL">All Stations (Brahmaputra & Barak)</option>
              {nodes.map((node) => (
                <option key={node.node_id} value={node.node_id}>
                  {node.zone_name} ({node.node_id})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Time Range, Refresh, Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          
          {/* Time Range Selector */}
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg p-0.5">
            <Clock className="w-3.5 h-3.5 text-gray-500 ml-2" />
            <div className="flex items-center">
              {timePresets.map((preset) => (
                <button
                  key={preset.from}
                  onClick={() => setTimeRange(preset)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    timeRange.from === preset.from
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Auto-Refresh Dropdown */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1">
            <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
            <select
              value={refreshRate}
              onChange={(e) => setRefreshRate(e.target.value)}
              className="bg-transparent text-xs text-gray-700 font-medium focus:outline-none cursor-pointer"
            >
              {refreshPresets.map((rate) => (
                <option key={rate} value={rate}>
                  {rate === 'off' ? 'Off' : `Auto: ${rate}`}
                </option>
              ))}
            </select>
          </div>

          {/* IoT Stress Simulator Trigger Button */}
          {onOpenSimModal && (
            <button
              onClick={onOpenSimModal}
              className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Simulate Breach</span>
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            className="p-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 rounded-lg transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Standalone Grafana Link */}
          <a
            href={standaloneUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in Standalone Grafana Tab"
            className="p-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Embedded Grafana Kiosk Frame */}
      <div 
        className={`w-full bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm relative ${
          isFullscreen ? 'flex-1 h-[calc(100vh-80px)]' : 'h-[820px]'
        }`}
      >
        {/* Loading Spinner / Skeleton */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-xs flex flex-col items-center justify-center z-10 space-y-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-semibold text-gray-600">
              Loading Grafana Kiosk Analytics Dashboard...
            </p>
          </div>
        )}

        {/* Offline Fallback Banner if Docker / Grafana is not running */}
        {isGrafanaAvailable === false && (
          <div className="absolute inset-0 bg-amber-50/95 p-8 flex flex-col items-center justify-center text-center z-20 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 shadow-sm">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="max-w-md space-y-2">
              <h3 className="text-base font-bold text-gray-900">
                Grafana Container Offline or Starting Up
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                The BorBandh Grafana dashboard service is booting or needs to be started via Docker Compose.
              </p>
              <div className="bg-gray-900 text-gray-100 p-3 rounded-xl font-mono text-xs text-left shadow-inner">
                <p className="text-gray-400"># Start Grafana & TimescaleDB:</p>
                <p className="text-emerald-400">docker compose up -d grafana timescaledb</p>
              </div>
              <p className="text-[11px] text-gray-500">
                Direct URL: <a href={standaloneUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">http://localhost:3000</a>
              </p>
            </div>
          </div>
        )}

        {/* The Kiosk Mode Iframe */}
        <iframe
          src={iframeUrl}
          title="BorBandh Grafana Kiosk Dashboard"
          className="w-full h-full border-0"
          onLoad={() => setIsLoading(false)}
          allow="autoplay; fullscreen"
        />
      </div>
    </div>
  );
};
