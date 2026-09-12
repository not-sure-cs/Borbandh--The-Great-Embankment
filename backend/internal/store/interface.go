package store

import (
	"borbandh/backend/internal/models"
)

// Store defines the repository operations required across BorBandh AI.
// Both MemoryStore (in-memory test/demo) and PostgresStore (sqlc + PostGIS + TimescaleDB) implement this interface.
type Store interface {
	AddTelemetry(t models.NodeTelemetry) models.NodeTelemetry
	GetTelemetryHistory(nodeID string, limit int) []models.NodeTelemetry
	GetAllNodes() []models.EmbankmentNode
	GetNodeByID(nodeID string) (models.EmbankmentNode, bool)
	IngestReach(reach models.EmbankmentReach)
	GetReaches() []models.EmbankmentReach
	GetReach(id string) (models.EmbankmentReach, bool)
	IngestBreach(breach models.BreachRecord)
	GetBreaches() []models.BreachRecord
	IngestMacroReading(reading models.MacroEnvironmentalReading)
	GetLatestMacroReading(reachID string) (models.MacroEnvironmentalReading, bool)
	GetGeoJSON(stageDelta ...float64) map[string]interface{}
	AddAlertLog(a models.AlertLog) models.AlertLog
	GetAlertLogs(limit int) []models.AlertLog
	GetSystemStats() models.SystemStats
}
