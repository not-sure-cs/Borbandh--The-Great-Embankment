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

export interface ContractorLedger {
  id: string;
  index: number;
  constituency: string;
  contractor_name: string;
  allocated_budget: number; // Lakhs INR
  completion_date: string;
  embankment_sector: string;
  integrity_score: number;
  status: 'VERIFIED' | 'UNDER_REVIEW' | 'BREACH_AUDIT';
  prev_hash: string;
  hash_signature: string;
  timestamp: string;
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
  total_ledger_budget: number;
  server_time: string;
}

export interface GeoFeature {
  type: 'Feature';
  properties: {
    name: string;
    river?: string;
    type: 'embankment_line' | 'buffer_zone';
    length_km?: number;
    vulnerable?: boolean;
    active_node?: string;
    buffer_dist?: string;
    fillColor?: string;
  };
  geometry: {
    type: 'LineString' | 'Polygon';
    coordinates: any;
  };
}

export interface GeoJSONData {
  type: 'FeatureCollection';
  features: GeoFeature[];
}
