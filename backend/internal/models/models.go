package models

import (
	"time"
)

// NodeTelemetry represents an IoT telemetry reading from an embankment sensor node.
type NodeTelemetry struct {
	ID             string    `json:"id"`
	NodeID         string    `json:"node_id"`
	ZoneName       string    `json:"zone_name"`
	SoilMoisture   float64   `json:"soil_moisture"`   // 0 - 100%
	TiltAngle      float64   `json:"tilt_angle"`      // 0 - 90 degrees
	AudioRMS       float64   `json:"audio_rms"`        // 0 - 1000 RMS vibration
	FactorOfSafety float64            `json:"factor_of_safety"`          // ML regression / PINN calculated Fs
	ForecastFS     []float64          `json:"forecast_fs,omitempty"`     // 24-step multi-horizon forecast (t+1..t+24)
	PBreach        float64            `json:"p_breach,omitempty"`        // Calibrated failure probability [0.0 - 1.0]
	FailureMode    string             `json:"failure_mode,omitempty"`    // Dominant physical failure mechanism
	FeatureWeights map[string]float64 `json:"feature_weights,omitempty"` // VSN explainability importance weights
	Status         string             `json:"status"`                    // SAFE, WARNING, CRITICAL
	CreatedAt      time.Time          `json:"created_at"`
}

// TelemetryIngestPayload is the incoming payload from ESP32 / ESPHome webhook or simulator.
type TelemetryIngestPayload struct {
	NodeID       string  `json:"node_id"`
	ZoneName     string  `json:"zone_name,omitempty"`
	SoilMoisture float64 `json:"soil_moisture"`
	TiltAngle    float64 `json:"tilt_angle"`
	AudioRMS     float64 `json:"audio_rms"`
}

// EmbankmentReach represents a physical or segmented reach of an embankment.
type EmbankmentReach struct {
	ID             string        `json:"id"`
	Name           string        `json:"name"`
	River          string        `json:"river"`
	District       string        `json:"district"`
	LengthKm       float64       `json:"length_km"`
	CrestElevation float64       `json:"crest_elevation_m"`
	BaseWidthM     float64       `json:"base_width_m"`
	EmbankmentType string        `json:"embankment_type"` // Earthen Bund, Boulder Pitched, Geo-Tube, Concrete Parapet
	Vulnerability  bool          `json:"vulnerability"`
	ActiveNodeID   string        `json:"active_node_id,omitempty"`
	Coordinates    [][]float64   `json:"coordinates"`    // [[lng, lat], ...]
	BufferPolygon  [][][]float64 `json:"buffer_polygon"` // [[[lng, lat], ...]]
	LastSurveyDate string        `json:"last_survey_date"`
	SegmentRisks   []SegmentRisk `json:"segment_risks,omitempty"`
}

// SegmentRisk represents granular breach probability and risk attributes for an embankment segment.
type SegmentRisk struct {
	SegmentIndex  int         `json:"segment_index"`
	Coordinates   [][]float64 `json:"coordinates"` // [[lng, lat], [lng, lat]]
	PBreach       float64     `json:"p_breach"`      // 0.0 to 1.0
	RiskTier      string      `json:"risk_tier"`     // SAFE, WATCH, CRITICAL
	FailureMode   string      `json:"failure_mode"`  // Overtopping, Piping & Sand Boiling, Toe Scour & Erosion, Slope Slump
	FreeboardM    float64     `json:"freeboard_m"`
	SaturationPct float64     `json:"saturation_pct"`
}

// InundationZone represents dynamic flood submergence polygons at a given water level stage rise.
type InundationZone struct {
	StageDeltaM float64       `json:"stage_delta_m"` // 0.0, 1.5, 3.0, 5.0
	DepthClass  string        `json:"depth_class"`   // SHALLOW, MODERATE, DEEP
	DepthM      float64       `json:"depth_m"`
	Polygon     [][][]float64 `json:"polygon"`       // GeoJSON polygon coordinates [[[lng, lat], ...]]
}

// HANDDepressionZone represents low-lying backwater entrapment bowls behind dykes (Height Above Nearest Drainage).
type HANDDepressionZone struct {
	ID         string        `json:"id"`
	ReachID    string        `json:"reach_id"`
	Name       string        `json:"name"`
	HANDM      float64       `json:"hand_m"`      // Relative elevation difference in meters
	RiskRating string        `json:"risk_rating"` // HIGH_ENTRAPMENT, MODERATE_PONDING
	Polygon    [][][]float64 `json:"polygon"`
}

// BreachRecord represents a documented historical failure or field-reported breach incident.
type BreachRecord struct {
	ID                string  `json:"id"`
	ReachID           string  `json:"reach_id"`
	LocationName      string  `json:"location_name"`
	River             string  `json:"river"`
	Latitude          float64 `json:"latitude"`
	Longitude         float64 `json:"longitude"`
	BreachDate        string  `json:"breach_date"`
	BreachWidthM      float64 `json:"breach_width_m"`
	PeakDischargeM3s  float64 `json:"peak_discharge_m3s"`
	FailureMechanism  string  `json:"failure_mechanism"` // Piping & Seepage, Crest Overtopping, Toe Scour & Bank Slump
	ImpactDescription string  `json:"impact_description"`
	RemediationStatus string  `json:"remediation_status"` // REINFORCED, RECONSTRUCTED_GEO_TUBES, UNDER_MONITORING
	Severity          string  `json:"severity"`           // MODERATE, SEVERE, CATASTROPHIC
}

// MacroEnvironmentalReading contains ingested hydrometeorological and satellite indices.
type MacroEnvironmentalReading struct {
	ReachID                 string    `json:"reach_id"`
	Timestamp               time.Time `json:"timestamp"`
	SARBackscatterDB        float64   `json:"sar_backscatter_db"`       // Sentinel-1 σ0 VV (dB)
	SARWaterDetected        bool      `json:"sar_water_detected"`       // Flagged when σ0 < -14.0 dB
	OpticalMNDWI            float64   `json:"optical_mndwi"`            // Sentinel-2 MNDWI (-1.0 to 1.0)
	OpticalNDVI             float64   `json:"optical_ndvi"`             // Sentinel-2 NDVI (0.0 to 1.0)
	DEMSlopeDeg             float64   `json:"dem_slope_deg"`            // Copernicus DEM Slope
	DEMElevationHAND        float64   `json:"dem_elevation_hand"`       // Height Above Nearest Drainage (m)
	Rainfall72hMm           float64   `json:"rainfall_72h_mm"`          // NASA GPM IMERG 72h precipitation
	AntecedentPrecipIndex   float64   `json:"antecedent_precip_index"`  // Accumulated API index
	CWCWaterLevelM          float64   `json:"cwc_water_level_m"`        // Central Water Commission stage (CWL)
	CWCDangerLevelM         float64   `json:"cwc_danger_level_m"`       // CWC Danger Level (DL)
	CalculatedFreeboardM    float64   `json:"calculated_freeboard_m"`   // Embankment Crest - CWL
	WaterLevelRateOfRiseCmH float64   `json:"water_rate_of_rise_cm_h"`  // Δh/Δt in cm/hour
	HydraulicWarning        bool      `json:"hydraulic_warning"`        // Overtopping hazard or Freeboard < 0.5m
}

// CitizenReport represents a crowdsourced visual crack/seepage report with GPS evidence.
type CitizenReport struct {
	ID             string    `json:"id"`
	ReporterName   string    `json:"reporter_name"`
	Phone          string    `json:"phone"`
	EmbankmentZone string    `json:"embankment_zone"`
	Latitude       float64   `json:"latitude"`
	Longitude      float64   `json:"longitude"`
	CrackSeverity  string    `json:"crack_severity"` // LOW, MEDIUM, HIGH, CATASTROPHIC
	Description    string    `json:"description"`
	PhotoData      string    `json:"photo_data,omitempty"` // base64 data url or image reference
	Status         string    `json:"status"`               // PENDING_INSPECTION, CONFIRMED, DISPATCHED, RESOLVED
	CreatedAt      time.Time `json:"created_at"`
}

// AlertLog records automated emergency notifications dispatched via SMS / WhatsApp.
type AlertLog struct {
	ID             string    `json:"id"`
	NodeID         string    `json:"node_id"`
	ZoneName       string    `json:"zone_name"`
	FactorOfSafety float64   `json:"factor_of_safety"`
	Level          string    `json:"level"` // WARNING, CRITICAL_EVACUATION
	Channel        string    `json:"channel"` // TWILIO_SMS, WHATSAPP_API, SIREN_RELAY
	Recipient      string    `json:"recipient"`
	Message        string    `json:"message"`
	SentAt         time.Time `json:"sent_at"`
}

// EmbankmentNode represents physical metadata for an edge telemetry station in Assam.
type EmbankmentNode struct {
	NodeID         string         `json:"node_id"`
	ZoneName       string         `json:"zone_name"`
	River          string         `json:"river"`
	Latitude       float64        `json:"latitude"`
	Longitude      float64        `json:"longitude"`
	ElevationM     float64        `json:"elevation_m"`
	BatteryVoltage float64        `json:"battery_voltage"`
	FirmwareVer    string         `json:"firmware_ver"`
	LastSeen       time.Time      `json:"last_seen"`
	LastTelemetry  *NodeTelemetry `json:"last_telemetry,omitempty"`
}

// SimulationScenario describes a preconfigured physical event for testing.
type SimulationScenario struct {
	Scenario string `json:"scenario"` // NORMAL, MONSOON_SURGE, RAPID_TILT, PIPING_EROSION, FLASH_FLOOD
	NodeID   string `json:"node_id,omitempty"`
}

// SystemStats provides real-time aggregated metrics for the dashboard header.
type SystemStats struct {
	ActiveNodes       int       `json:"active_nodes"`
	SafeCount         int       `json:"safe_count"`
	WarningCount      int       `json:"warning_count"`
	CriticalCount     int       `json:"critical_count"`
	MinFactorOfSafety float64   `json:"min_factor_of_safety"`
	AvgFactorOfSafety float64   `json:"avg_factor_of_safety"`
	TotalAlertsSent       int       `json:"total_alerts_sent"`
	TotalReports          int       `json:"total_reports"`
	TotalMonitoredKm      float64   `json:"total_monitored_km"`
	TotalReaches          int       `json:"total_reaches"`
	HistoricalBreachCount int       `json:"historical_breach_count"`
	ServerTime            time.Time `json:"server_time"`
}
