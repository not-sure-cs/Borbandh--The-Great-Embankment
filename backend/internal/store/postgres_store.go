package store

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"borbandh/backend/internal/db"
	"borbandh/backend/internal/models"
)

// PostgresStore implements the Store interface using PostgreSQL, PostGIS, and TimescaleDB via sqlc.
type PostgresStore struct {
	pool    *pgxpool.Pool
	queries *db.Queries
	mem     *MemoryStore // In-memory cache & fallback for fast geospatial calculation
}

func NewPostgresStore(ctx context.Context, connStr string) (*PostgresStore, error) {
	config, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		return nil, fmt.Errorf("invalid postgres connection string: %w", err)
	}

	config.MaxConns = 30
	config.MinConns = 5
	config.MaxConnLifetime = 30 * time.Minute
	config.MaxConnIdleTime = 5 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to postgres pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("postgres ping failed: %w", err)
	}

	log.Println("[PostgresStore] Connected to PostgreSQL + PostGIS + TimescaleDB successfully.")

	// Initialize seeded in-memory fallback for instant reach geometry caching
	memStore := NewMemoryStore()

	return &PostgresStore{
		pool:    pool,
		queries: db.New(pool),
		mem:     memStore,
	}, nil
}

func (p *PostgresStore) Close() {
	if p.pool != nil {
		p.pool.Close()
	}
}

// floatToNumeric converts float64 to pgtype.Numeric.
func floatToNumeric(val float64) pgtype.Numeric {
	var n pgtype.Numeric
	strVal := fmt.Sprintf("%.4f", val)
	_ = n.Scan(strVal)
	return n
}

func numericToFloat(n pgtype.Numeric) float64 {
	if !n.Valid {
		return 0
	}
	f, _ := n.Float64Value()
	return f.Float64
}

func toCoordFloat(v interface{}) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case float32:
		return float64(val)
	case int:
		return float64(val)
	case int64:
		return float64(val)
	case string:
		var f float64
		_, _ = fmt.Sscanf(val, "%f", &f)
		return f
	default:
		return 0
	}
}

// AddTelemetry writes a hypertable entry via sqlc and updates in-memory cache.
func (p *PostgresStore) AddTelemetry(t models.NodeTelemetry) models.NodeTelemetry {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	now := time.Now()
	if !t.CreatedAt.IsZero() {
		now = t.CreatedAt
	}

	err := p.queries.InsertNodeTelemetry(ctx, db.InsertNodeTelemetryParams{
		Time:           pgtype.Timestamptz{Time: now, Valid: true},
		NodeID:         t.NodeID,
		SoilMoisture:   floatToNumeric(t.SoilMoisture),
		TiltAngle:      floatToNumeric(t.TiltAngle),
		AudioRms:       floatToNumeric(t.AudioRMS),
		FactorOfSafety: floatToNumeric(t.FactorOfSafety),
		Status:         t.Status,
	})
	if err != nil {
		log.Printf("[PostgresStore] InsertNodeTelemetry error: %v", err)
	}

	return p.mem.AddTelemetry(t)
}

func (p *PostgresStore) GetTelemetryHistory(nodeID string, limit int) []models.NodeTelemetry {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := p.queries.GetRecentTelemetryHistory(ctx, db.GetRecentTelemetryHistoryParams{
		NodeID:     nodeID,
		LimitCount: int32(limit),
	})
	if err != nil || len(rows) == 0 {
		return p.mem.GetTelemetryHistory(nodeID, limit)
	}

	res := make([]models.NodeTelemetry, 0, len(rows))
	for _, r := range rows {
		res = append(res, models.NodeTelemetry{
			NodeID:         r.NodeID,
			SoilMoisture:   numericToFloat(r.SoilMoisture),
			TiltAngle:      numericToFloat(r.TiltAngle),
			AudioRMS:       numericToFloat(r.AudioRms),
			FactorOfSafety: numericToFloat(r.FactorOfSafety),
			Status:         r.Status,
			CreatedAt:      r.Time.Time,
		})
	}
	return res
}

func (p *PostgresStore) GetAllNodes() []models.EmbankmentNode {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := p.queries.ListNodes(ctx)
	if err != nil || len(rows) == 0 {
		return p.mem.GetAllNodes()
	}

	res := make([]models.EmbankmentNode, 0, len(rows))
	for _, r := range rows {
		res = append(res, models.EmbankmentNode{
			NodeID:         r.NodeID,
			ZoneName:       r.ZoneName,
			River:          r.River,
			Longitude:      toCoordFloat(r.Longitude),
			Latitude:       toCoordFloat(r.Latitude),
			ElevationM:     numericToFloat(r.ElevationM),
			BatteryVoltage: numericToFloat(r.BatteryVoltage),
			FirmwareVer:    r.FirmwareVer,
			LastSeen:       r.LastSeen.Time,
		})
	}
	return res
}

func (p *PostgresStore) GetNodeByID(nodeID string) (models.EmbankmentNode, bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	r, err := p.queries.GetNode(ctx, nodeID)
	if err != nil {
		return p.mem.GetNodeByID(nodeID)
	}

	return models.EmbankmentNode{
		NodeID:         r.NodeID,
		ZoneName:       r.ZoneName,
		River:          r.River,
		Longitude:      toCoordFloat(r.Longitude),
		Latitude:       toCoordFloat(r.Latitude),
		ElevationM:     numericToFloat(r.ElevationM),
		BatteryVoltage: numericToFloat(r.BatteryVoltage),
		FirmwareVer:    r.FirmwareVer,
		LastSeen:       r.LastSeen.Time,
	}, true
}

func (p *PostgresStore) IngestReach(reach models.EmbankmentReach) {
	p.mem.IngestReach(reach)
}

func (p *PostgresStore) GetReaches() []models.EmbankmentReach {
	return p.mem.GetReaches()
}

func (p *PostgresStore) GetReach(id string) (models.EmbankmentReach, bool) {
	return p.mem.GetReach(id)
}

func (p *PostgresStore) IngestBreach(breach models.BreachRecord) {
	p.mem.IngestBreach(breach)
}

func (p *PostgresStore) GetBreaches() []models.BreachRecord {
	return p.mem.GetBreaches()
}

func (p *PostgresStore) IngestMacroReading(reading models.MacroEnvironmentalReading) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	now := time.Now()
	if !reading.Timestamp.IsZero() {
		now = reading.Timestamp
	}

	_ = p.queries.InsertMacroReading(ctx, db.InsertMacroReadingParams{
		Time:             pgtype.Timestamptz{Time: now, Valid: true},
		ReachID:          reading.ReachID,
		SarBackscatterDb: floatToNumeric(reading.SARBackscatterDB),
		SarWaterDetected: pgtype.Bool{Bool: reading.SARWaterDetected, Valid: true},
		OpticalMndwi:     floatToNumeric(reading.OpticalMNDWI),
		OpticalNdvi:      floatToNumeric(reading.OpticalNDVI),
		CwcWaterLevelM:   floatToNumeric(reading.CWCWaterLevelM),
		CwcDangerLevelM:  floatToNumeric(reading.CWCDangerLevelM),
		FreeboardM:       floatToNumeric(reading.CalculatedFreeboardM),
		RateOfRiseCmH:    floatToNumeric(reading.WaterLevelRateOfRiseCmH),
		Rainfall72hMm:    floatToNumeric(reading.Rainfall72hMm),
		HydraulicWarning: pgtype.Bool{Bool: reading.HydraulicWarning, Valid: true},
	})

	p.mem.IngestMacroReading(reading)
}

func (p *PostgresStore) GetLatestMacroReading(reachID string) (models.MacroEnvironmentalReading, bool) {
	return p.mem.GetLatestMacroReading(reachID)
}

func (p *PostgresStore) GetGeoJSON(stageDelta ...float64) map[string]interface{} {
	return p.mem.GetGeoJSON(stageDelta...)
}

func (p *PostgresStore) AddAlertLog(a models.AlertLog) models.AlertLog {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	now := time.Now()
	if !a.SentAt.IsZero() {
		now = a.SentAt
	}

	_ = p.queries.InsertAlertLog(ctx, db.InsertAlertLogParams{
		ID:             a.ID,
		NodeID:         pgtype.Text{String: a.NodeID, Valid: true},
		ZoneName:       a.ZoneName,
		FactorOfSafety: floatToNumeric(a.FactorOfSafety),
		Level:          a.Level,
		Channel:        a.Channel,
		Recipient:      a.Recipient,
		Message:        a.Message,
		SentAt:         pgtype.Timestamptz{Time: now, Valid: true},
	})

	return p.mem.AddAlertLog(a)
}

func (p *PostgresStore) GetAlertLogs(limit int) []models.AlertLog {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := p.queries.ListRecentAlerts(ctx, int32(limit))
	if err != nil || len(rows) == 0 {
		return p.mem.GetAlertLogs(limit)
	}

	res := make([]models.AlertLog, 0, len(rows))
	for _, r := range rows {
		res = append(res, models.AlertLog{
			ID:             r.ID,
			NodeID:         r.NodeID.String,
			ZoneName:       r.ZoneName,
			FactorOfSafety: numericToFloat(r.FactorOfSafety),
			Level:          r.Level,
			Channel:        r.Channel,
			Recipient:      r.Recipient,
			Message:        r.Message,
			SentAt:         r.SentAt.Time,
		})
	}
	return res
}

func (p *PostgresStore) GetSystemStats() models.SystemStats {
	return p.mem.GetSystemStats()
}
