export interface NodeTelemetry {
  id: string;
  node_id: string;
  zone_name: string;
  soil_moisture: number; // %
  tilt_angle: number; // degrees
  audio_rms: number; // RMS
  factor_of_safety: number; // Fs
  status: 'SAFE' | 'WARNING' | 'CRITICAL';
  created_at: string;
}

export interface EmbankmentNode {
  node_id: string;
  zone_name: string;
  river: string;
  latitude: number;
  longitude: number;
  elevation_m: number;
  battery_voltage: number;
  firmware_ver: string;
  last_seen: string;
  last_telemetry?: NodeTelemetry;
}

export interface EmbankmentReach {
  id: string;
  name: string;
  river: string;
  district: string;
  length_km: number;
  crest_elevation_m: number;
  base_width_m: number;
  embankment_type: string;
  vulnerability: boolean;
  active_node_id?: string;
  coordinates: [number, number][];
  buffer_polygon?: [number, number][][];
  last_survey_date: string;
}

export interface BreachRecord {
  id: string;
  reach_id: string;
  location_name: string;
  river: string;
  latitude: number;
  longitude: number;
  breach_date: string;
  breach_width_m: number;
  peak_discharge_m3s: number;
  failure_mechanism: string;
  impact_description: string;
  remediation_status: string;
  severity: 'MODERATE' | 'SEVERE' | 'CATASTROPHIC';
}

export interface MacroEnvironmentalReading {
  reach_id: string;
  timestamp: string;
  sar_backscatter_db: number;
  sar_water_detected: boolean;
  optical_mndwi: number;
  optical_ndvi: number;
  dem_slope_deg: number;
  dem_elevation_hand: number;
  rainfall_72h_mm: number;
  antecedent_precip_index: number;
  cwc_water_level_m: number;
  cwc_danger_level_m: number;
  calculated_freeboard_m: number;
  water_rate_of_rise_cm_h: number;
  hydraulic_warning: boolean;
}

export interface CitizenReport {
  id: string;
  reporter_name: string;
  phone: string;
  embankment_zone: string;
  latitude: number;
  longitude: number;
  crack_severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CATASTROPHIC';
  description: string;
  photo_data?: string;
  status: 'PENDING_INSPECTION' | 'CONFIRMED' | 'DISPATCHED' | 'RESOLVED';
  created_at: string;
}

export interface AlertLog {
  id: string;
  node_id: string;
  zone_name: string;
  factor_of_safety: number;
  level: 'WARNING' | 'CRITICAL_EVACUATION';
  channel: 'TWILIO_SMS' | 'WHATSAPP_API' | 'SIREN_RELAY';
  recipient: string;
  message: string;
  sent_at: string;
}

export interface SystemStats {
  active_nodes: number;
  safe_count: number;
  warning_count: number;
  critical_count: number;
  min_factor_of_safety: number;
  avg_factor_of_safety: number;
  total_alerts_sent: number;
  total_reports: number;
  total_monitored_km?: number;
  total_reaches?: number;
  historical_breach_count?: number;
  server_time: string;
}

export interface SegmentRisk {
  segment_index: number;
  coordinates: [number, number][];
  p_breach: number;
  risk_tier: 'SAFE' | 'WATCH' | 'CRITICAL';
  failure_mode: string;
  freeboard_m: number;
  saturation_pct: number;
}

export interface GeoFeature {
  type: 'Feature';
  properties: {
    name: string;
    reach_id?: string;
    river?: string;
    district?: string;
    type: 'embankment_line' | 'buffer_zone' | 'breach_location' | 'inundation_zone' | 'hand_depression' | 'sar_saturation_zone';
    length_km?: number;
    crest_elevation?: number;
    vulnerable?: boolean;
    active_node?: string;
    buffer_dist?: string;
    fillColor?: string;
    breach_id?: string;
    breach_date?: string;
    breach_width_m?: number;
    peak_discharge_m3s?: number;
    failure_mechanism?: string;
    remediation_status?: string;
    severity?: string;
    // Predictive Overlays & Breach Corridor Properties
    p_breach?: number;
    avg_p_breach?: number;
    risk_tier?: 'SAFE' | 'WATCH' | 'CRITICAL';
    failure_mode?: string;
    freeboard_m?: number;
    segment_risks?: SegmentRisk[];
    stage_delta_m?: number;
    depth_class?: 'SHALLOW' | 'MODERATE' | 'DEEP';
    depth_m?: number;
    hand_m?: number;
    risk_rating?: string;
    soil_moisture_pct?: number;
    sar_sigma0_db?: number;
    saturation_tier?: string;
  };
  geometry: {
    type: 'LineString' | 'Polygon' | 'Point';
    coordinates: any;
  };
}

export interface GeoJSONData {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

