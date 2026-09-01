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
	FactorOfSafety float64   `json:"factor_of_safety"` // ML regression calculated Fs
	Status         string    `json:"status"`           // SAFE, WARNING, CRITICAL
	CreatedAt      time.Time `json:"created_at"`
}

// TelemetryIngestPayload is the incoming payload from ESP32 / ESPHome webhook or simulator.
type TelemetryIngestPayload struct {
	NodeID       string  `json:"node_id"`
	ZoneName     string  `json:"zone_name,omitempty"`
	SoilMoisture float64 `json:"soil_moisture"`
	TiltAngle    float64 `json:"tilt_angle"`
	AudioRMS     float64 `json:"audio_rms"`
}

// ContractorLedger represents an immutable audit record of embankment infrastructure works.
type ContractorLedger struct {
	ID               string    `json:"id"`
	Index            int       `json:"index"`
	Constituency     string    `json:"constituency"`
	ContractorName   string    `json:"contractor_name"`
	AllocatedBudget  float64   `json:"allocated_budget"` // In Lakhs INR
	CompletionDate   string    `json:"completion_date"`
	EmbankmentSector string    `json:"embankment_sector"`
	IntegrityScore   float64   `json:"integrity_score"` // 0 - 100%
	Status           string    `json:"status"`          // VERIFIED, UNDER_REVIEW, BREACH_AUDIT
	PrevHash         string    `json:"prev_hash"`
	HashSignature    string    `json:"hash_signature"` // SHA-256 block hash
	Timestamp        time.Time `json:"timestamp"`
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
	TotalAlertsSent   int       `json:"total_alerts_sent"`
	TotalReports      int       `json:"total_reports"`
	TotalLedgerBudget float64   `json:"total_ledger_budget"`
	ServerTime        time.Time `json:"server_time"`
}
