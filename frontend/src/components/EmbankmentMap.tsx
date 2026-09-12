import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Layers, Eye, ShieldAlert, Satellite, MapPin, Compass } from 'lucide-react';
import { EmbankmentNode, GeoJSONData } from '../types';

interface EmbankmentMapProps {
  nodes: EmbankmentNode[];
  geoData: GeoJSONData | null;
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
}

export const EmbankmentMap: React.FC<EmbankmentMapProps> = ({
  nodes,
  geoData,
  selectedNodeId,
  onSelectNode,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const [showBuffers, setShowBuffers] = useState(true);
  const [showSARLayer, setShowSARLayer] = useState(true);
  const [selectedLayer, setSelectedLayer] = useState<'streets' | 'satellite'>('satellite');

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Assam center coordinates (Brahmaputra Valley)
    const map = L.map(mapContainerRef.current, {
      center: [26.45, 93.30],
      zoom: 8,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Dark CartoDB tile layer
    const darkTiles = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; OpenStreetMap &copy; CARTO | ISRO Bhuvan GeoJSON',
        maxZoom: 19,
      }
    );
    darkTiles.addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update GeoJSON and Node Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // 1. Draw Embankment Vector Lines & 50m Spatial Buffer Polygons
    if (geoData && geoData.features) {
      geoData.features.forEach((feature) => {
        if (feature.properties.type === 'buffer_zone' && showBuffers) {
          // 50m Spatial Buffer Polygon (Phase 1 Felt.com spec)
          const polyCoords = (feature.geometry.coordinates[0] as [number, number][]).map(
            ([lng, lat]) => [lat, lng] as [number, number]
          );
          const polygon = L.polygon(polyCoords, {
            color: '#f59e0b',
            weight: 1.5,
            dashArray: '4 4',
            fillColor: '#f59e0b',
            fillOpacity: 0.15,
          });
          polygon.bindTooltip(`<b>${feature.properties.name}</b><br/>50m Buffer Zone`, { sticky: true });
          group.addLayer(polygon);
        } else if (feature.properties.type === 'embankment_line') {
          // Embankment Centerline
          const lineCoords = (feature.geometry.coordinates as [number, number][]).map(
            ([lng, lat]) => [lat, lng] as [number, number]
          );
          const line = L.polyline(lineCoords, {
            color: feature.properties.vulnerable ? '#ef4444' : '#06b6d4',
            weight: 4,
            opacity: 0.85,
          });
          line.bindPopup(`
            <div style="font-family: sans-serif; color: #0f172a; padding: 4px;">
              <h4 style="margin: 0 0 4px 0; font-weight: bold;">${feature.properties.name}</h4>
              <p style="margin: 0; font-size: 11px;">River: <b>${feature.properties.river}</b></p>
              <p style="margin: 0; font-size: 11px;">Length: <b>${feature.properties.length_km} km</b></p>
              <p style="margin: 0; font-size: 11px;">Status: <b>${feature.properties.vulnerable ? 'High Risk' : 'Reinforced'}</b></p>
            </div>
          `);
          group.addLayer(line);
        } else if (feature.properties.type === 'breach_location') {
          // Historical / Field Breach Point
          const coords = feature.geometry.coordinates as [number, number];
          const breachLng = coords[0];
          const breachLat = coords[1];
          const breachIcon = L.divIcon({
            className: 'custom-breach-pin',
            html: `
              <div style="
                width: 20px;
                height: 20px;
                background-color: #ef4444;
                border: 2px solid #ffffff;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 0 12px #ef4444;
              ">
                <span style="width: 6px; height: 6px; background-color: #ffffff; border-radius: 50%;"></span>
              </div>
            `,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          });
          const marker = L.marker([breachLat, breachLng], { icon: breachIcon });
          marker.bindPopup(`
            <div style="font-family: sans-serif; color: #0f172a; padding: 4px; min-width: 180px;">
              <h4 style="margin: 0 0 4px 0; font-weight: bold; color: #ef4444;">${feature.properties.name}</h4>
              <p style="margin: 0; font-size: 11px;">River: <b>${feature.properties.river}</b></p>
              <p style="margin: 0; font-size: 11px;">Date: <b>${feature.properties.breach_date ?? 'Historical'}</b></p>
              <p style="margin: 0; font-size: 11px;">Breach Width: <b>${feature.properties.breach_width_m ?? 'N/A'} m</b></p>
              <p style="margin: 0; font-size: 11px;">Failure Mechanism: <b>${feature.properties.failure_mechanism ?? 'Overtopping / Piping'}</b></p>
              <p style="margin: 0; font-size: 11px;">Status: <b>${feature.properties.remediation_status ?? 'UNDER_MONITORING'}</b></p>
            </div>
          `);
          group.addLayer(marker);
        }
      });
    }

    // 2. Draw Sentinel-1 SAR GRD Soil Saturation Heat Ring Overlay
    if (showSARLayer) {
      nodes.forEach((node) => {
        const moist = node.last_telemetry?.soil_moisture ?? 35;
        const radiusMeters = 6000 + moist * 80;
        const color = moist > 70 ? '#ef4444' : moist > 50 ? '#f59e0b' : '#0284c7';

        const circle = L.circle([node.latitude, node.longitude], {
          radius: radiusMeters,
          color: color,
          weight: 1,
          dashArray: '2 2',
          fillColor: color,
          fillOpacity: 0.12,
        });
        circle.bindTooltip(`<b>Sentinel-1 SAR Radar</b><br/>Ground Saturation: ${moist.toFixed(1)}%`, { sticky: true });
        group.addLayer(circle);
      });
    }

    // 3. Draw Edge Telemetry Node Markers
    nodes.forEach((node) => {
      const isSelected = selectedNodeId === node.node_id;
      const fs = node.last_telemetry?.factor_of_safety ?? 1.85;
      const isCritical = fs < 0.7;
      const isWarning = fs >= 0.7 && fs < 1.0;

      const markerColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981';

      const customIcon = L.divIcon({
        className: 'custom-node-pin',
        html: `
          <div style="
            width: ${isSelected ? '28px' : '22px'};
            height: ${isSelected ? '28px' : '22px'};
            background-color: ${markerColor};
            border: 3px solid #0f172a;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 ${isCritical ? '20px #ef4444' : '10px rgba(0,0,0,0.5)'};
            transition: all 0.3s;
          ">
            <span style="width: 6px; height: 6px; background-color: #ffffff; border-radius: 50%;"></span>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([node.latitude, node.longitude], { icon: customIcon });
      marker.on('click', () => onSelectNode(node.node_id));
      marker.bindPopup(`
        <div style="font-family: sans-serif; color: #0f172a; min-width: 160px; padding: 2px;">
          <h4 style="margin: 0; font-weight: bold; font-size: 13px;">${node.zone_name}</h4>
          <span style="font-size: 10px; color: #64748b; font-family: monospace;">${node.node_id}</span>
          <div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid #e2e8f0; font-size: 11px;">
            <div>Factor of Safety: <b style="color: ${markerColor};">${fs.toFixed(2)}</b></div>
            <div>Moisture: <b>${node.last_telemetry?.soil_moisture.toFixed(0) ?? 35}%</b></div>
            <div>Tilt Angle: <b>${node.last_telemetry?.tilt_angle.toFixed(1) ?? 1.2}°</b></div>
          </div>
        </div>
      `);
      group.addLayer(marker);
    });

  }, [nodes, geoData, showBuffers, showSARLayer, selectedNodeId]);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl relative flex flex-col h-[520px]">
      
      {/* Map Header & GIS Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4 mb-4">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Satellite className="w-5 h-5 text-cyan-400" />
            Geospatial Embankment Baseline & Sentinel SAR Radar
          </h3>
          <p className="text-xs text-slate-400">
            ISRO Bhuvan Vector Geometries & Cloud-Penetrating Sentinel-1 SAR
          </p>
        </div>

        {/* Layer Toggles */}
        <div className="flex items-center space-x-2 text-xs">
          <button
            onClick={() => setShowBuffers(!showBuffers)}
            className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-all ${
              showBuffers
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>50m Spatial Buffer</span>
          </button>

          <button
            onClick={() => setShowSARLayer(!showSARLayer)}
            className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-all ${
              showSARLayer
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            <Satellite className="w-3.5 h-3.5" />
            <span>Sentinel-1 SAR Radar</span>
          </button>
        </div>
      </div>

      {/* Leaflet Map Canvas Container */}
      <div className="relative flex-1 w-full rounded-xl overflow-hidden border border-slate-800">
        <div ref={mapContainerRef} className="w-full h-full" />
        
        {/* Floating Map Legend */}
        <div className="absolute bottom-4 left-4 z-[500] bg-slate-950/90 backdrop-blur-md border border-slate-800 p-3 rounded-xl shadow-xl text-xs space-y-1.5 font-mono pointer-events-none">
          <div className="font-sans font-bold text-slate-200 text-[11px] mb-1">GIS Map Legend</div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-3 h-1 bg-cyan-400 rounded"></span> Embankment Vector Line
          </div>
          <div className="flex items-center gap-2 text-amber-400">
            <span className="w-3 h-1 border-t-2 border-dashed border-amber-400"></span> 50m Spatial Buffer Zone
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> IoT Node (Safe)
          </div>
          <div className="flex items-center gap-2 text-rose-400">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span> IoT Node (Critical Alert)
          </div>
          <div className="flex items-center gap-2 text-rose-300">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 border border-white"></span> Historical Breach Site
          </div>
        </div>
      </div>

    </div>
  );
};
