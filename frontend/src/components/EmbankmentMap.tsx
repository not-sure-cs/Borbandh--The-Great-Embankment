import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { 
  ShieldAlert, 
  Satellite, 
  Mountain, 
  Moon, 
  Waves, 
  Flame, 
  Layers, 
  Sliders, 
  Compass, 
  AlertTriangle 
} from 'lucide-react';
import { EmbankmentNode, GeoJSONData, GeoFeature, SegmentRisk } from '../types';
import { api } from '../services/api';

interface EmbankmentMapProps {
  nodes: EmbankmentNode[];
  geoData: GeoJSONData | null;
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
}

type BasemapType = 'satellite' | 'topo' | 'dark';

export const EmbankmentMap: React.FC<EmbankmentMapProps> = ({
  nodes,
  geoData: initialGeoData,
  selectedNodeId,
  onSelectNode,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Basemap & Layer states
  const [selectedBasemap, setSelectedBasemap] = useState<BasemapType>('satellite');
  const [showBuffers, setShowBuffers] = useState(true);
  const [showSARLayer, setShowSARLayer] = useState(false);
  const [showBreachCorridor, setShowBreachCorridor] = useState(true);
  const [showInundation, setShowInundation] = useState(true);
  const [showHAND, setShowHAND] = useState(true);

  // Predictive Water Level Rise Simulation Stage
  const [stageDelta, setStageDelta] = useState<number>(0.0);
  const [activeGeoData, setActiveGeoData] = useState<GeoJSONData | null>(initialGeoData);
  const [isSimulating, setIsSimulating] = useState(false);

  // Synchronize initialGeoData if changed externally
  useEffect(() => {
    if (initialGeoData && stageDelta === 0) {
      setActiveGeoData(initialGeoData);
    }
  }, [initialGeoData, stageDelta]);

  // Fetch updated GeoJSON whenever water stage delta changes
  const handleStageDeltaChange = useCallback(async (delta: number) => {
    setStageDelta(delta);
    setIsSimulating(true);
    try {
      const data = await api.getGeoJSON(delta);
      setActiveGeoData(data);
    } catch (err) {
      console.error('Failed to fetch stage-simulated GeoJSON:', err);
    } finally {
      setIsSimulating(false);
    }
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Assam Brahmaputra & Barak Basins Center Coordinates
    const map = L.map(mapContainerRef.current, {
      center: [26.45, 93.30],
      zoom: 8,
      zoomControl: false,
      attributionControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Initial Google Satellite Hybrid Tile Layer
    const satTile = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    });
    satTile.addTo(map);
    baseTileLayerRef.current = satTile;

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Basemap Layer when user toggles
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
    }

    let newTile: L.TileLayer;
    if (selectedBasemap === 'satellite') {
      // Google Satellite Hybrid (High-res optical orthophoto + labels)
      newTile = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      });
    } else if (selectedBasemap === 'topo') {
      // Topographical Shaded Relief / Elevation Hillshade (Esri Elevation)
      newTile = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 18 }
      );
    } else {
      // Dark Tactical Basemap (CartoDB Voyager Dark)
      newTile = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        { maxZoom: 19 }
      );
    }

    newTile.addTo(map);
    baseTileLayerRef.current = newTile;
  }, [selectedBasemap]);

  // Render Overlays: Water Inundation, Breach Corridor, HAND Depressions, Buffers, IoT Nodes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // 1. Dynamic Predictive Water Level Rise Inundation Polygons (Overlay A)
    if (showInundation && activeGeoData && activeGeoData.features) {
      activeGeoData.features.forEach((feature) => {
        if (feature.properties.type === 'inundation_zone') {
          const polyCoords = (feature.geometry.coordinates[0] as [number, number][]).map(
            ([lng, lat]) => [lat, lng] as [number, number]
          );

          const depth = feature.properties.depth_m ?? 1.2;
          const depthClass = feature.properties.depth_class ?? 'MODERATE';

          let fillColor = '#38bdf8'; // Shallow Cyan
          let fillOpacity = 0.38;
          let strokeColor = '#0284c7';
          if (depthClass === 'DEEP') {
            fillColor = '#1e3a8a'; // Deep Navy Indigo
            fillOpacity = 0.72;
            strokeColor = '#1d4ed8';
          } else if (depthClass === 'MODERATE') {
            fillColor = '#0284c7'; // Cerulean
            fillOpacity = 0.52;
            strokeColor = '#0369a1';
          }

          const polygon = L.polygon(polyCoords, {
            color: strokeColor,
            weight: 1.5,
            fillColor: fillColor,
            fillOpacity: fillOpacity,
            dashArray: depthClass === 'SHALLOW' ? '3 3' : undefined,
          });

          polygon.bindPopup(`
            <div style="font-family: sans-serif; color: #0f172a; padding: 4px; min-width: 180px;">
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <span style="font-size: 14px;">🌊</span>
                <h4 style="margin: 0; font-weight: bold; font-size: 13px; color: #0284c7;">
                  Predicted Flood Inundation
                </h4>
              </div>
              <div style="font-size: 11px; space-y: 2px; border-top: 1px solid #e2e8f0; padding-top: 4px;">
                <div>Water Depth: <b>${depth.toFixed(1)} m</b> (${depthClass})</div>
                <div>Surge Delta: <b>+${feature.properties.stage_delta_m?.toFixed(1) ?? stageDelta.toFixed(1)} m Above Baseline</b></div>
                <div>Status: <span style="color: #0284c7; font-weight: bold;">Active Floodplain Submergence</span></div>
              </div>
            </div>
          `);

          group.addLayer(polygon);
        }
      });
    }

    // 2. HAND Low-Lying Countryside Depression Entrapment Zones (Behind Dykes)
    if (showHAND && activeGeoData && activeGeoData.features) {
      activeGeoData.features.forEach((feature) => {
        if (feature.properties.type === 'hand_depression') {
          const polyCoords = (feature.geometry.coordinates[0] as [number, number][]).map(
            ([lng, lat]) => [lat, lng] as [number, number]
          );

          const handElev = feature.properties.hand_m ?? 1.0;
          const polygon = L.polygon(polyCoords, {
            color: '#818cf8',
            weight: 1.5,
            dashArray: '5 5',
            fillColor: '#6366f1',
            fillOpacity: 0.25,
          });

          polygon.bindTooltip(`<b>${feature.properties.name}</b><br/>HAND: ${handElev.toFixed(1)}m (Entrapment Risk)`, {
            sticky: true,
          });

          polygon.bindPopup(`
            <div style="font-family: sans-serif; color: #0f172a; padding: 4px; min-width: 190px;">
              <h4 style="margin: 0 0 4px 0; font-weight: bold; color: #4338ca;">⛰️ Low-Lying Depression (HAND)</h4>
              <p style="margin: 0; font-size: 11px;">Relative Drainage Height: <b>${handElev.toFixed(1)} m</b></p>
              <p style="margin: 0; font-size: 11px;">Entrapment Risk: <b>${feature.properties.risk_rating ?? 'HIGH_ENTRAPMENT'}</b></p>
              <p style="margin: 4px 0 0 0; font-size: 10px; color: #64748b;">
                Low natural elevation behind dyke crest. Stagnant backwater accumulation expected during breach.
              </p>
            </div>
          `);

          group.addLayer(polygon);
        }
      });
    }

    // 3. 50m Spatial Safety Buffer Polygons
    if (showBuffers && activeGeoData && activeGeoData.features) {
      activeGeoData.features.forEach((feature) => {
        if (feature.properties.type === 'buffer_zone') {
          const polyCoords = (feature.geometry.coordinates[0] as [number, number][]).map(
            ([lng, lat]) => [lat, lng] as [number, number]
          );

          const riskTier = feature.properties.risk_tier ?? 'SAFE';
          const bufColor = riskTier === 'CRITICAL' ? '#ef4444' : riskTier === 'WATCH' ? '#f59e0b' : '#10b981';

          const polygon = L.polygon(polyCoords, {
            color: bufColor,
            weight: 1.5,
            dashArray: '4 4',
            fillColor: bufColor,
            fillOpacity: 0.16,
          });
          polygon.bindTooltip(`<b>${feature.properties.name}</b><br/>50m Lateral Buffer (${riskTier})`, { sticky: true });
          group.addLayer(polygon);
        }
      });
    }

    // 4. Embankment Centerlines with Segment Risk & Breach Probability Corridor ($P_{\text{breach}}$) (Overlay B)
    if (activeGeoData && activeGeoData.features) {
      activeGeoData.features.forEach((feature) => {
        if (feature.properties.type === 'embankment_line') {
          const segRisks = feature.properties.segment_risks;

          // If segment-level risks exist and corridor overlay is enabled, render individual colored segments
          if (showBreachCorridor && segRisks && segRisks.length > 0) {
            segRisks.forEach((seg: SegmentRisk) => {
              const segCoords = seg.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
              
              let segColor = '#10b981'; // Safe (Green)
              let segWeight = 4;
              let isPulse = false;

              if (seg.p_breach >= 0.70) {
                segColor = '#ef4444'; // Critical (Crimson Red)
                segWeight = 6;
                isPulse = true;
              } else if (seg.p_breach >= 0.35) {
                segColor = '#f59e0b'; // Watch (Amber)
                segWeight = 5;
              }

              const polyline = L.polyline(segCoords, {
                color: segColor,
                weight: segWeight,
                opacity: 0.95,
                className: isPulse ? 'animate-pulse' : undefined,
              });

              polyline.bindTooltip(
                `<b>${feature.properties.name} (Seg #${seg.segment_index})</b><br/>P(breach): <b>${(seg.p_breach * 100).toFixed(1)}%</b> [${seg.risk_tier}]`,
                { sticky: true }
              );

              polyline.bindPopup(`
                <div style="font-family: sans-serif; color: #0f172a; padding: 4px; min-width: 200px;">
                  <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; pb-1 mb-2;">
                    <h4 style="margin: 0; font-weight: bold; font-size: 13px; color: ${segColor};">
                      Segment #${seg.segment_index} Risk Assessment
                    </h4>
                    <span style="font-size: 10px; font-weight: bold; padding: 1px 6px; border-radius: 4px; background: ${segColor}20; color: ${segColor};">
                      ${seg.risk_tier}
                    </span>
                  </div>
                  <div style="font-size: 11px; line-height: 1.6;">
                    <div>Reach: <b>${feature.properties.name}</b></div>
                    <div>River: <b>${feature.properties.river}</b></div>
                    <div>Breach Probability: <b style="color: ${segColor}; font-size: 13px;">${(seg.p_breach * 100).toFixed(1)}%</b></div>
                    <div>Primary Failure Mechanism: <b>${seg.failure_mode}</b></div>
                    <div>Remaining Freeboard: <b>${seg.freeboard_m.toFixed(2)} m</b></div>
                    <div>Pore Saturation: <b>${seg.saturation_pct.toFixed(1)}%</b></div>
                  </div>
                </div>
              `);

              group.addLayer(polyline);
            });
          } else {
            // Default centerline view
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
                <p style="margin: 0; font-size: 11px;">P(Breach): <b>${((feature.properties.p_breach ?? 0.2) * 100).toFixed(1)}%</b></p>
                <p style="margin: 0; font-size: 11px;">Status: <b>${feature.properties.vulnerable ? 'Vulnerable' : 'Reinforced'}</b></p>
              </div>
            `);
            group.addLayer(line);
          }
        } else if (feature.properties.type === 'breach_location') {
          // Historical / Field Breach Point with glowing radar marker
          const coords = feature.geometry.coordinates as [number, number];
          const breachLng = coords[0];
          const breachLat = coords[1];
          const breachIcon = L.divIcon({
            className: 'custom-breach-pin',
            html: `
              <div style="
                width: 22px;
                height: 22px;
                background-color: #ef4444;
                border: 2px solid #ffffff;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 0 14px #ef4444;
              ">
                <span style="width: 7px; height: 7px; background-color: #ffffff; border-radius: 50%;"></span>
              </div>
            `,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          });
          const marker = L.marker([breachLat, breachLng], { icon: breachIcon });
          marker.bindPopup(`
            <div style="font-family: sans-serif; color: #0f172a; padding: 4px; min-width: 190px;">
              <h4 style="margin: 0 0 4px 0; font-weight: bold; color: #ef4444;">🚨 ${feature.properties.name}</h4>
              <p style="margin: 0; font-size: 11px;">River: <b>${feature.properties.river}</b></p>
              <p style="margin: 0; font-size: 11px;">Breach Date: <b>${feature.properties.breach_date ?? 'Historical'}</b></p>
              <p style="margin: 0; font-size: 11px;">Breach Width: <b>${feature.properties.breach_width_m ?? 'N/A'} m</b></p>
              <p style="margin: 0; font-size: 11px;">Peak Discharge: <b>${feature.properties.peak_discharge_m3s ?? 'N/A'} m³/s</b></p>
              <p style="margin: 0; font-size: 11px;">Failure Mechanism: <b>${feature.properties.failure_mechanism ?? 'Overtopping / Piping'}</b></p>
              <p style="margin: 0; font-size: 11px;">Status: <b>${feature.properties.remediation_status ?? 'UNDER_MONITORING'}</b></p>
            </div>
          `);
          group.addLayer(marker);
        }
      });
    }

    // 5. Sentinel-1 SAR Ground Saturation Overlay (Topography-Conformed)
    if (showSARLayer && activeGeoData && activeGeoData.features) {
      let foundSARFeatures = false;
      activeGeoData.features.forEach((feature) => {
        if (feature.properties.type === 'sar_saturation_zone') {
          foundSARFeatures = true;
          const polyCoords = (feature.geometry.coordinates[0] as [number, number][]).map(
            ([lng, lat]) => [lat, lng] as [number, number]
          );

          const moist = feature.properties.soil_moisture_pct ?? 48;
          const color = feature.properties.fillColor ?? '#0284c7';
          const sigma0 = feature.properties.sar_sigma0_db ?? -14.2;

          const polygon = L.polygon(polyCoords, {
            color: color,
            weight: 1.5,
            dashArray: '3 3',
            fillColor: color,
            fillOpacity: 0.28,
          });

          polygon.bindTooltip(
            `<b>Sentinel-1 SAR Riparian Saturation</b><br/>Backscatter σ°: <b>${sigma0.toFixed(1)} dB</b><br/>Soil Moisture: <b>${moist.toFixed(1)}%</b>`,
            { sticky: true }
          );
          group.addLayer(polygon);
        }
      });

      // Fallback only if no server-provided SAR polygons are available
      if (!foundSARFeatures) {
        nodes.forEach((node) => {
          const moist = node.last_telemetry?.soil_moisture ?? 35;
          const radiusMeters = 2500 + moist * 40;
          const color = moist > 70 ? '#ef4444' : moist > 50 ? '#f59e0b' : '#0284c7';

          const circle = L.circle([node.latitude, node.longitude], {
            radius: radiusMeters,
            color: color,
            weight: 1,
            dashArray: '2 2',
            fillColor: color,
            fillOpacity: 0.15,
          });
          circle.bindTooltip(`<b>Sentinel-1 SAR Radar</b><br/>Ground Saturation: ${moist.toFixed(1)}%`, { sticky: true });
          group.addLayer(circle);
        });
      }
    }

    // 6. Active IoT Node Telemetry Pins
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
  }, [
    nodes,
    activeGeoData,
    showBuffers,
    showSARLayer,
    showBreachCorridor,
    showInundation,
    showHAND,
    selectedNodeId,
    stageDelta,
    onSelectNode,
  ]);

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl relative flex flex-col h-[650px]">
      
      {/* Top Header: Title & Basemap Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800/80 pb-4 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <Satellite className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              Topological Embankment Digital Twin & Predictive Overlays
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
              Arch 3: Leaflet 2.5D Stack
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Google Satellite Hybrid + Elevation Hillshade • Dynamic Water Rise & Breach Probability ($P_{'{'}breach{'}'}$)
          </p>
        </div>

        {/* Basemap Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setSelectedBasemap('satellite')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              selectedBasemap === 'satellite'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Satellite className="w-3.5 h-3.5" />
            <span>Google Satellite</span>
          </button>

          <button
            onClick={() => setSelectedBasemap('topo')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              selectedBasemap === 'topo'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mountain className="w-3.5 h-3.5" />
            <span>Topo Hillshade</span>
          </button>

          <button
            onClick={() => setSelectedBasemap('dark')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              selectedBasemap === 'dark'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>Dark Tactical</span>
          </button>
        </div>
      </div>

      {/* Predictive Water Level Rise Simulator Controller */}
      <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3 mb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Stage Slider Controls */}
        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 min-w-[190px]">
            <Waves className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="text-xs font-bold text-slate-200">Water Stage Simulator:</span>
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
              stageDelta >= 3.0 ? 'bg-rose-950 text-rose-300 border border-rose-800' :
              stageDelta >= 1.5 ? 'bg-amber-950 text-amber-300 border border-amber-800' :
              'bg-cyan-950 text-cyan-300 border border-cyan-800'
            }`}>
              +{stageDelta.toFixed(1)}m {stageDelta === 0 ? '(Baseline)' : stageDelta >= 3.0 ? '(Danger Level)' : '(Warning Level)'}
            </span>
          </div>

          <div className="flex-1 flex items-center gap-3">
            <input
              type="range"
              min="0.0"
              max="5.0"
              step="0.5"
              value={stageDelta}
              onChange={(e) => handleStageDeltaChange(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            {isSimulating && (
              <span className="text-[10px] text-cyan-400 font-mono animate-pulse whitespace-nowrap">
                Computing Floodplain...
              </span>
            )}
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-1 text-[11px]">
          <span className="text-slate-500 mr-1 text-[10px] uppercase font-mono">Presets:</span>
          <button
            onClick={() => handleStageDeltaChange(0.0)}
            className={`px-2 py-1 rounded border font-mono transition-all ${
              stageDelta === 0.0 ? 'bg-cyan-900/50 text-cyan-200 border-cyan-500/50' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            0.0m
          </button>
          <button
            onClick={() => handleStageDeltaChange(1.5)}
            className={`px-2 py-1 rounded border font-mono transition-all ${
              stageDelta === 1.5 ? 'bg-amber-900/50 text-amber-200 border-amber-500/50' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            +1.5m (CWC WL)
          </button>
          <button
            onClick={() => handleStageDeltaChange(3.0)}
            className={`px-2 py-1 rounded border font-mono transition-all ${
              stageDelta === 3.0 ? 'bg-orange-900/50 text-orange-200 border-orange-500/50' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            +3.0m (CWC DL)
          </button>
          <button
            onClick={() => handleStageDeltaChange(5.0)}
            className={`px-2 py-1 rounded border font-mono transition-all ${
              stageDelta === 5.0 ? 'bg-rose-900/50 text-rose-200 border-rose-500/50' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            +5.0m (Overtopping)
          </button>
        </div>
      </div>

      {/* Layer Toggles Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setShowInundation(!showInundation)}
            className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 transition-all ${
              showInundation
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-sm'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            <Waves className="w-3.5 h-3.5" />
            <span>Water Inundation</span>
          </button>

          <button
            onClick={() => setShowBreachCorridor(!showBreachCorridor)}
            className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 transition-all ${
              showBreachCorridor
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Breach Probability Corridor (P_breach)</span>
          </button>

          <button
            onClick={() => setShowHAND(!showHAND)}
            className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 transition-all ${
              showHAND
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            <Mountain className="w-3.5 h-3.5" />
            <span>HAND Depressions</span>
          </button>

          <button
            onClick={() => setShowBuffers(!showBuffers)}
            className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 transition-all ${
              showBuffers
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>50m Buffer Zone</span>
          </button>

          <button
            onClick={() => setShowSARLayer(!showSARLayer)}
            className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 transition-all ${
              showSARLayer
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            <Satellite className="w-3.5 h-3.5" />
            <span>Sentinel-1 SAR Moisture</span>
          </button>
        </div>
      </div>

      {/* Leaflet Map Canvas Container */}
      <div className="relative flex-1 w-full rounded-xl overflow-hidden border border-slate-800">
        <div ref={mapContainerRef} className="w-full h-full" />
        
        {/* Floating Comprehensive Tactical GIS Legend */}
        <div className="absolute bottom-3 left-3 z-[500] bg-slate-950/90 backdrop-blur-md border border-slate-800 p-3 rounded-xl shadow-2xl text-[11px] space-y-2 font-mono pointer-events-none max-w-[260px]">
          <div className="font-sans font-bold text-slate-200 text-xs border-b border-slate-800 pb-1 flex items-center justify-between">
            <span>Tactical Map Legend</span>
            <span className="text-[10px] text-cyan-400 font-mono">Assam Basin</span>
          </div>

          {/* Breach Probability Gradient */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase font-sans">Embankment Breach Risk (P_breach)</div>
            <div className="flex items-center gap-2 text-emerald-400">
              <span className="w-3.5 h-1 bg-emerald-500 rounded"></span> P &lt; 35% Stable
            </div>
            <div className="flex items-center gap-2 text-amber-400">
              <span className="w-3.5 h-1.5 bg-amber-500 rounded"></span> 35% - 70% Toe Saturated / Watch
            </div>
            <div className="flex items-center gap-2 text-rose-400">
              <span className="w-3.5 h-2 bg-rose-500 rounded animate-pulse"></span> P &ge; 70% Imminent Breach Alert
            </div>
          </div>

          {/* Flood Inundation Depths */}
          <div className="space-y-1 border-t border-slate-800/80 pt-1.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase font-sans">Water Rise Inundation Depth</div>
            <div className="flex items-center gap-2 text-sky-300">
              <span className="w-2.5 h-2.5 rounded bg-sky-400/50 border border-sky-400"></span> Shallow (0.1 - 1.0m)
            </div>
            <div className="flex items-center gap-2 text-blue-300">
              <span className="w-2.5 h-2.5 rounded bg-blue-600/60 border border-blue-500"></span> Moderate (1.0 - 2.5m)
            </div>
            <div className="flex items-center gap-2 text-indigo-200">
              <span className="w-2.5 h-2.5 rounded bg-indigo-900/90 border border-indigo-700"></span> Deep Submergence (&gt;2.5m)
            </div>
          </div>

          {/* Features */}
          <div className="space-y-1 border-t border-slate-800/80 pt-1.5">
            <div className="flex items-center gap-2 text-indigo-300">
              <span className="w-2.5 h-2.5 rounded border border-dashed border-indigo-400 bg-indigo-500/20"></span> HAND Low-Lying Depression
            </div>
            <div className="flex items-center gap-2 text-rose-300">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 border border-white"></span> Historical Breach Point
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-900"></span> IoT Node Active
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
