package store

import (
	"fmt"
	"math"
	"math/rand"
	"sync"
	"time"

	"borbandh/backend/internal/calculator"
	"borbandh/backend/internal/models"
)

// Store provides a thread-safe in-memory persistent data store using only the Go standard library.
type MemoryStore struct {
	mu            sync.RWMutex
	telemetry     []models.NodeTelemetry
	nodes         map[string]models.EmbankmentNode
	reaches       map[string]models.EmbankmentReach
	breaches      []models.BreachRecord
	macroReadings map[string]models.MacroEnvironmentalReading
	reports       []models.CitizenReport
	alerts        []models.AlertLog
	maxTelemetry  int
}

// NewStore initializes the repository with default Assam embankment demonstration data.
func NewStore() *MemoryStore {
	return NewMemoryStore()
}

func NewMemoryStore() *MemoryStore {
	s := &MemoryStore{
		telemetry:     make([]models.NodeTelemetry, 0, 1000),
		nodes:         make(map[string]models.EmbankmentNode),
		reaches:       make(map[string]models.EmbankmentReach),
		breaches:      make([]models.BreachRecord, 0),
		macroReadings: make(map[string]models.MacroEnvironmentalReading),
		reports:       make([]models.CitizenReport, 0),
		alerts:        make([]models.AlertLog, 0),
		maxTelemetry:  2000,
	}

	s.seedNodes()
	s.seedStructuralData()
	s.seedCitizenReports()
	s.seedInitialTelemetry()

	return s
}

func (s *MemoryStore) seedNodes() {
	defaultNodes := []models.EmbankmentNode{
		{
			NodeID:         "NODE-MAJULI-01",
			ZoneName:       "Majuli Island - Kamalabari Dyke",
			River:          "Brahmaputra",
			Latitude:       26.9452,
			Longitude:      94.1873,
			ElevationM:     84.5,
			BatteryVoltage: 4.12,
			FirmwareVer:    "ESPHome-BorBandh-v1.4.2",
			LastSeen:       time.Now(),
		},
		{
			NodeID:         "NODE-DIBRUGARH-02",
			ZoneName:       "Dibrugarh Protection Dyke - Sector 3",
			River:          "Brahmaputra",
			Latitude:       27.4728,
			Longitude:      94.9120,
			ElevationM:     108.0,
			BatteryVoltage: 4.05,
			FirmwareVer:    "ESPHome-BorBandh-v1.4.2",
			LastSeen:       time.Now(),
		},
		{
			NodeID:         "NODE-TEZPUR-03",
			ZoneName:       "Tezpur Bhomoraguri Embankment",
			River:          "Brahmaputra",
			Latitude:       26.6338,
			Longitude:      92.7926,
			ElevationM:     68.2,
			BatteryVoltage: 3.98,
			FirmwareVer:    "ESPHome-BorBandh-v1.4.2",
			LastSeen:       time.Now(),
		},
		{
			NodeID:         "NODE-GUWAHATI-04",
			ZoneName:       "Guwahati Saraighat Flood Wall",
			River:          "Brahmaputra",
			Latitude:       26.1738,
			Longitude:      91.6854,
			ElevationM:     54.0,
			BatteryVoltage: 4.18,
			FirmwareVer:    "ESPHome-BorBandh-v1.4.2",
			LastSeen:       time.Now(),
		},
		{
			NodeID:         "NODE-SILCHAR-05",
			ZoneName:       "Silchar Bethukandi Sluice Embankment",
			River:          "Barak",
			Latitude:       24.8333,
			Longitude:      92.7789,
			ElevationM:     25.1,
			BatteryVoltage: 3.89,
			FirmwareVer:    "ESPHome-BorBandh-v1.4.2",
			LastSeen:       time.Now(),
		},
	}

	for _, n := range defaultNodes {
		s.nodes[n.NodeID] = n
	}
}

func create50mBuffer(centerline [][]float64) [][][]float64 {
	if len(centerline) < 2 {
		return [][][]float64{}
	}
	const latOff = 0.000451
	const lonOff = 0.000502
	left := make([][]float64, len(centerline))
	right := make([][]float64, len(centerline))

	for i := 0; i < len(centerline); i++ {
		var dx, dy float64
		if i == 0 {
			dx = centerline[1][0] - centerline[0][0]
			dy = centerline[1][1] - centerline[0][1]
		} else if i == len(centerline)-1 {
			dx = centerline[i][0] - centerline[i-1][0]
			dy = centerline[i][1] - centerline[i-1][1]
		} else {
			dx = centerline[i+1][0] - centerline[i-1][0]
			dy = centerline[i+1][1] - centerline[i-1][1]
		}
		l := math.Hypot(dx, dy)
		if l == 0 {
			l = 0.0001
		}
		nx := -dy / l
		ny := dx / l
		left[i] = []float64{centerline[i][0] + nx*lonOff, centerline[i][1] + ny*latOff}
		right[i] = []float64{centerline[i][0] - nx*lonOff, centerline[i][1] - ny*latOff}
	}

	ring := make([][]float64, 0, len(left)+len(right)+1)
	ring = append(ring, left...)
	for i := len(right) - 1; i >= 0; i-- {
		ring = append(ring, right[i])
	}
	ring = append(ring, []float64{left[0][0], left[0][1]})
	return [][][]float64{ring}
}

func (s *MemoryStore) seedStructuralData() {
	defaultReaches := []models.EmbankmentReach{
		{
			ID:             "REACH-MAJULI-01",
			Name:           "Majuli Kamalabari Reach",
			River:          "Brahmaputra",
			District:       "Majuli",
			LengthKm:       18.4,
			CrestElevation: 86.5,
			BaseWidthM:     22.0,
			EmbankmentType: "Earthen Bund with Boulder Pitching & Porcupines",
			Vulnerability:  true,
			ActiveNodeID:   "NODE-MAJULI-01",
			Coordinates: [][]float64{
				{94.1500, 26.9300},
				{94.1700, 26.9400},
				{94.1873, 26.9452},
				{94.2100, 26.9550},
				{94.2400, 26.9600},
			},
			LastSurveyDate: "2026-04-12",
		},
		{
			ID:             "REACH-DIBRUGARH-02",
			Name:           "Dibrugarh Town Protection Dyke",
			River:          "Brahmaputra",
			District:       "Dibrugarh",
			LengthKm:       9.6,
			CrestElevation: 110.0,
			BaseWidthM:     28.0,
			EmbankmentType: "Reinforced Concrete Sluice & Boulder Apron",
			Vulnerability:  false,
			ActiveNodeID:   "NODE-DIBRUGARH-02",
			Coordinates: [][]float64{
				{94.8800, 27.4550},
				{94.8950, 27.4650},
				{94.9120, 27.4728},
				{94.9300, 27.4800},
			},
			LastSurveyDate: "2026-03-20",
		},
		{
			ID:             "REACH-TEZPUR-03",
			Name:           "Tezpur Bhomoraguri Guide Bund",
			River:          "Brahmaputra",
			District:       "Sonitpur",
			LengthKm:       6.2,
			CrestElevation: 71.5,
			BaseWidthM:     20.0,
			EmbankmentType: "Earthen Bund with Stone Pitching",
			Vulnerability:  false,
			ActiveNodeID:   "NODE-TEZPUR-03",
			Coordinates: [][]float64{
				{92.7750, 26.6200},
				{92.7926, 26.6338},
				{92.8100, 26.6450},
			},
			LastSurveyDate: "2026-01-15",
		},
		{
			ID:             "REACH-GUWAHATI-04",
			Name:           "Guwahati Saraighat Flood Defense",
			River:          "Brahmaputra",
			District:       "Kamrup Metropolitan",
			LengthKm:       5.8,
			CrestElevation: 56.5,
			BaseWidthM:     18.0,
			EmbankmentType: "Concrete Flood Wall & Sheet Piling",
			Vulnerability:  false,
			ActiveNodeID:   "NODE-GUWAHATI-04",
			Coordinates: [][]float64{
				{91.6650, 26.1650},
				{91.6854, 26.1738},
				{91.7050, 26.1800},
			},
			LastSurveyDate: "2026-02-10",
		},
		{
			ID:             "REACH-SILCHAR-05",
			Name:           "Silchar Bethukandi Dyke",
			River:          "Barak",
			District:       "Cachar",
			LengthKm:       12.1,
			CrestElevation: 27.2,
			BaseWidthM:     16.0,
			EmbankmentType: "Earthen Dyke & Sluice Gate Regulator",
			Vulnerability:  true,
			ActiveNodeID:   "NODE-SILCHAR-05",
			Coordinates: [][]float64{
				{92.7550, 24.8150},
				{92.7789, 24.8333},
				{92.8050, 24.8450},
			},
			LastSurveyDate: "2026-05-01",
		},
		{
			ID:             "REACH-MATMORA-06",
			Name:           "Matmora Mega Geo-Tube Dyke",
			River:          "Brahmaputra / Subansiri",
			District:       "Lakhimpur",
			LengthKm:       5.0,
			CrestElevation: 92.0,
			BaseWidthM:     30.0,
			EmbankmentType: "Multi-Tiered Geo-Textile Tubes with Sand Infill",
			Vulnerability:  false,
			Coordinates: [][]float64{
				{94.4800, 27.1200},
				{94.5100, 27.1400},
				{94.5350, 27.1650},
			},
			LastSurveyDate: "2026-03-05",
		},
	}

	for _, r := range defaultReaches {
		r.BufferPolygon = create50mBuffer(r.Coordinates)
		s.reaches[r.ID] = r
	}

	s.breaches = []models.BreachRecord{
		{
			ID:                "BREACH-2022-SILCHAR",
			ReachID:           "REACH-SILCHAR-05",
			LocationName:      "Bethukandi Sluice Dyke, Barak River",
			River:             "Barak",
			Latitude:          24.8280,
			Longitude:         92.7710,
			BreachDate:        "2022-06-19",
			BreachWidthM:      85.0,
			PeakDischargeM3s:  1250.0,
			FailureMechanism:  "Seepage Piping & Sluice Embankment Cut",
			ImpactDescription: "Inundated 80% of Silchar municipality for 11 days; catastrophic breach event.",
			RemediationStatus: "REINFORCED",
			Severity:          "CATASTROPHIC",
		},
		{
			ID:                "BREACH-2008-MATMORA",
			ReachID:           "REACH-MATMORA-06",
			LocationName:      "Matmora Embankment Reach, Dhakuakhana",
			River:             "Brahmaputra",
			Latitude:          27.1350,
			Longitude:         94.5050,
			BreachDate:        "2008-07-14",
			BreachWidthM:      320.0,
			PeakDischargeM3s:  4800.0,
			FailureMechanism:  "Overtopping & Severe Toe Scour",
			ImpactDescription: "Severe flooding across Lakhimpur & Dhemaji districts; prompted modern geo-tube reconstruction.",
			RemediationStatus: "RECONSTRUCTED_GEO_TUBES",
			Severity:          "CATASTROPHIC",
		},
		{
			ID:                "BREACH-2012-MAJULI",
			ReachID:           "REACH-MAJULI-01",
			LocationName:      "Kamalabari Section Spur 3",
			River:             "Brahmaputra",
			Latitude:          26.9420,
			Longitude:         94.1750,
			BreachDate:        "2012-09-21",
			BreachWidthM:      110.0,
			PeakDischargeM3s:  2100.0,
			FailureMechanism:  "Crest Subsidence & Slumping",
			ImpactDescription: "Threatened island core monastery infrastructure; emergency boulder pitching deployed.",
			RemediationStatus: "REINFORCED",
			Severity:          "SEVERE",
		},
		{
			ID:                "BREACH-2004-TEZPUR",
			ReachID:           "REACH-TEZPUR-03",
			LocationName:      "Bhomoraguri Approach North",
			River:             "Brahmaputra",
			Latitude:          26.6300,
			Longitude:         92.7850,
			BreachDate:        "2004-08-02",
			BreachWidthM:      45.0,
			PeakDischargeM3s:  950.0,
			FailureMechanism:  "Piping & Foundation Boiling",
			ImpactDescription: "Toe boiling mitigated by reverse sand filter and porcupine spurs.",
			RemediationStatus: "REINFORCED",
			Severity:          "MODERATE",
		},
		{
			ID:                "BREACH-2020-DHEMAJI",
			ReachID:           "REACH-MATMORA-06",
			LocationName:      "Jiadhal Confluence Flood Bund",
			River:             "Brahmaputra Basin",
			Latitude:          27.4200,
			Longitude:         94.5600,
			BreachDate:        "2020-05-28",
			BreachWidthM:      65.0,
			PeakDischargeM3s:  1100.0,
			FailureMechanism:  "Heavy Siltation & Sudden Overtopping",
			ImpactDescription: "Flash river siltation choked channel capacity causing sudden embankment overflow.",
			RemediationStatus: "UNDER_MONITORING",
			Severity:          "SEVERE",
		},
	}
}

func (s *MemoryStore) seedCitizenReports() {
	s.reports = []models.CitizenReport{
		{
			ID:             "REP-20260901-001",
			ReporterName:   "Pabitra Das",
			Phone:          "+91 98640 11234",
			EmbankmentZone: "Majuli Island - Kamalabari",
			Latitude:       26.9460,
			Longitude:      94.1880,
			CrackSeverity:  "MEDIUM",
			Description:    "Noticed a 15-meter longitudinal fissure along the river-facing crest after yesterday's high tide surge.",
			Status:         "CONFIRMED",
			CreatedAt:      time.Now().Add(-3 * time.Hour),
		},
		{
			ID:             "REP-20260901-002",
			ReporterName:   "Bipul Saikia",
			Phone:          "+91 94350 78901",
			EmbankmentZone: "Dibrugarh Protection Dyke",
			Latitude:       27.4735,
			Longitude:      94.9135,
			CrackSeverity:  "LOW",
			Description:    "Minor toe-seepage observed near spur #4. Water clarity is transparent (no heavy sediment piping yet).",
			Status:         "PENDING_INSPECTION",
			CreatedAt:      time.Now().Add(-1 * time.Hour),
		},
	}
}

func (s *MemoryStore) seedInitialTelemetry() {
	// Seed historical data points for the past 2 hours
	now := time.Now()
	for i := 24; i >= 0; i-- {
		t := now.Add(-time.Duration(i*5) * time.Minute)
		for nodeID, node := range s.nodes {
			// Base normal values
			moist := 35.0 + rand.Float64()*12.0
			tilt := 1.0 + rand.Float64()*1.5
			audio := 20.0 + rand.Float64()*15.0

			// Make Silchar slightly more saturated
			if nodeID == "NODE-SILCHAR-05" {
				moist += 20.0
				tilt += 2.0
				audio += 40.0
			}

			fs := calculator.CalculateFactorOfSafety(moist, tilt, audio)
			status := calculator.EvaluateStatus(fs)

			entry := models.NodeTelemetry{
				ID:             fmt.Sprintf("TEL-%d-%s", t.UnixNano(), nodeID),
				NodeID:         nodeID,
				ZoneName:       node.ZoneName,
				SoilMoisture:   moist,
				TiltAngle:      tilt,
				AudioRMS:       audio,
				FactorOfSafety: fs,
				Status:         status,
				CreatedAt:      t,
			}

			s.telemetry = append(s.telemetry, entry)
			
			// Update node last telemetry
			n := s.nodes[nodeID]
			nCopy := entry
			n.LastTelemetry = &nCopy
			n.LastSeen = t
			s.nodes[nodeID] = n
		}
	}
}

// AddTelemetry records a new telemetry reading, updates node status, and trims buffer.
func (s *MemoryStore) AddTelemetry(t models.NodeTelemetry) models.NodeTelemetry {
	s.mu.Lock()
	defer s.mu.Unlock()

	if t.ID == "" {
		t.ID = fmt.Sprintf("TEL-%d-%s", time.Now().UnixNano(), t.NodeID)
	}
	if t.CreatedAt.IsZero() {
		t.CreatedAt = time.Now()
	}

	s.telemetry = append(s.telemetry, t)
	if len(s.telemetry) > s.maxTelemetry {
		s.telemetry = s.telemetry[len(s.telemetry)-s.maxTelemetry:]
	}

	if node, exists := s.nodes[t.NodeID]; exists {
		tCopy := t
		node.LastTelemetry = &tCopy
		node.LastSeen = t.CreatedAt
		s.nodes[t.NodeID] = node
	} else {
		// Auto-register discovered node
		s.nodes[t.NodeID] = models.EmbankmentNode{
			NodeID:         t.NodeID,
			ZoneName:       t.ZoneName,
			River:          "Brahmaputra Basin",
			Latitude:       26.5000 + (rand.Float64()-0.5)*1.5,
			Longitude:      93.5000 + (rand.Float64()-0.5)*2.0,
			ElevationM:     60.0,
			BatteryVoltage: 4.10,
			FirmwareVer:    "ESPHome-BorBandh-Auto",
			LastSeen:       t.CreatedAt,
			LastTelemetry:  &t,
		}
	}

	return t
}

// GetTelemetryHistory returns recent telemetry records optionally filtered by nodeID.
func (s *MemoryStore) GetTelemetryHistory(nodeID string, limit int) []models.NodeTelemetry {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if limit <= 0 || limit > 500 {
		limit = 100
	}

	var results []models.NodeTelemetry
	for i := len(s.telemetry) - 1; i >= 0; i-- {
		t := s.telemetry[i]
		if nodeID == "" || t.NodeID == nodeID {
			results = append(results, t)
			if len(results) >= limit {
				break
			}
		}
	}

	// Reverse to chronological order
	for i, j := 0, len(results)-1; i < j; i, j = i+1, j-1 {
		results[i], results[j] = results[j], results[i]
	}

	return results
}

// GetAllNodes returns all registered edge telemetry nodes.
func (s *MemoryStore) GetAllNodes() []models.EmbankmentNode {
	s.mu.RLock()
	defer s.mu.RUnlock()

	list := make([]models.EmbankmentNode, 0, len(s.nodes))
	for _, n := range s.nodes {
		list = append(list, n)
	}
	return list
}

// GetNodeByID returns an embankment node by its ID.
func (s *MemoryStore) GetNodeByID(nodeID string) (models.EmbankmentNode, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	n, ok := s.nodes[nodeID]
	return n, ok
}

// IngestReach stores or updates an embankment reach.
func (s *MemoryStore) IngestReach(reach models.EmbankmentReach) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.reaches[reach.ID] = reach
}

// GetReaches returns all monitored embankment reaches.
func (s *MemoryStore) GetReaches() []models.EmbankmentReach {
	s.mu.RLock()
	defer s.mu.RUnlock()

	res := make([]models.EmbankmentReach, 0, len(s.reaches))
	for _, r := range s.reaches {
		res = append(res, r)
	}
	return res
}

// GetReach returns a specific embankment reach by ID.
func (s *MemoryStore) GetReach(id string) (models.EmbankmentReach, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	r, ok := s.reaches[id]
	return r, ok
}

// IngestBreach saves a new or historical embankment breach record.
func (s *MemoryStore) IngestBreach(breach models.BreachRecord) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.breaches = append([]models.BreachRecord{breach}, s.breaches...)
}

// GetBreaches returns all documented historical and field breach records.
func (s *MemoryStore) GetBreaches() []models.BreachRecord {
	s.mu.RLock()
	defer s.mu.RUnlock()

	res := make([]models.BreachRecord, len(s.breaches))
	copy(res, s.breaches)
	return res
}

// IngestMacroReading saves a multi-source hydrometeorological reading for a reach.
func (s *MemoryStore) IngestMacroReading(reading models.MacroEnvironmentalReading) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.macroReadings[reading.ReachID] = reading
}

// GetLatestMacroReading retrieves the latest macro reading for a reach.
func (s *MemoryStore) GetLatestMacroReading(reachID string) (models.MacroEnvironmentalReading, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	r, ok := s.macroReadings[reachID]
	return r, ok
}

// GetGeoJSON generates a complete OGC GeoJSON FeatureCollection dynamically containing:
// 1. Embankment centerlines with P_breach & segment risk corridor breakdown (LineString)
// 2. 50-meter spatial safety buffer polygons with dynamic risk color (Polygon)
// 3. Historical breach locations (Point)
// 4. Dynamic hydrodynamic water level inundation polygons for simulated stage rise (Polygon)
// 5. Low-lying depression entrapment zones (HAND hazard mask) (Polygon)
func (s *MemoryStore) GetGeoJSON(stageDelta ...float64) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	delta := 0.0
	if len(stageDelta) > 0 {
		delta = stageDelta[0]
	}

	features := make([]map[string]interface{}, 0, len(s.reaches)*3+len(s.breaches)+12)
	reachList := make([]models.EmbankmentReach, 0, len(s.reaches))

	// 1. Embankment Centerlines with Segment Risk & Breach Probability
	for _, r := range s.reaches {
		reachList = append(reachList, r)

		var latestTelemetry *models.NodeTelemetry
		if r.ActiveNodeID != "" {
			if node, ok := s.nodes[r.ActiveNodeID]; ok && node.LastTelemetry != nil {
				latestTelemetry = node.LastTelemetry
			}
		}

		reading := s.macroReadings[r.ID]
		segments := calculator.CalculateSegmentBreachProbabilities(r, reading.CWCWaterLevelM, reading.CWCDangerLevelM, reading.WaterLevelRateOfRiseCmH, latestTelemetry)

		// Aggregate reach-level metrics
		maxPBreach := 0.15
		avgPBreach := 0.15
		riskTier := "SAFE"
		failureMode := "Stable Embankment Core"
		if len(segments) > 0 {
			sum := 0.0
			for _, seg := range segments {
				sum += seg.PBreach
				if seg.PBreach > maxPBreach {
					maxPBreach = seg.PBreach
					failureMode = seg.FailureMode
				}
			}
			avgPBreach = math.Round((sum/float64(len(segments)))*1000) / 1000
			if maxPBreach >= 0.70 {
				riskTier = "CRITICAL"
			} else if maxPBreach >= 0.35 {
				riskTier = "WATCH"
			}
		}

		freeboard := r.CrestElevation - reading.CWCWaterLevelM
		if reading.CalculatedFreeboardM > 0 {
			freeboard = reading.CalculatedFreeboardM
		}

		// Embankment Centerline Feature
		features = append(features, map[string]interface{}{
			"type": "Feature",
			"properties": map[string]interface{}{
				"reach_id":         r.ID,
				"name":             r.Name,
				"river":            r.River,
				"district":         r.District,
				"type":             "embankment_line",
				"length_km":        r.LengthKm,
				"crest_elevation":  r.CrestElevation,
				"base_width_m":     r.BaseWidthM,
				"embankment_type":  r.EmbankmentType,
				"vulnerable":       r.Vulnerability,
				"active_node":      r.ActiveNodeID,
				"last_survey_date": r.LastSurveyDate,
				"p_breach":         maxPBreach,
				"avg_p_breach":     avgPBreach,
				"risk_tier":        riskTier,
				"failure_mode":     failureMode,
				"freeboard_m":      math.Round(freeboard*100) / 100,
				"segment_risks":    segments,
			},
			"geometry": map[string]interface{}{
				"type":        "LineString",
				"coordinates": r.Coordinates,
			},
		})

		// 50m Spatial Buffer Polygon
		if len(r.BufferPolygon) > 0 {
			bufColor := "#10b981"
			if riskTier == "CRITICAL" {
				bufColor = "#ef4444"
			} else if riskTier == "WATCH" {
				bufColor = "#f59e0b"
			}
			features = append(features, map[string]interface{}{
				"type": "Feature",
				"properties": map[string]interface{}{
					"reach_id":    r.ID,
					"name":        fmt.Sprintf("%s 50m Buffer", r.Name),
					"type":        "buffer_zone",
					"buffer_dist": "50 meters",
					"fillColor":   bufColor,
					"p_breach":    maxPBreach,
					"risk_tier":   riskTier,
				},
				"geometry": map[string]interface{}{
					"type":        "Polygon",
					"coordinates": r.BufferPolygon,
				},
			})
		}
	}

	// 2. Historical Breach Points
	for _, b := range s.breaches {
		features = append(features, map[string]interface{}{
			"type": "Feature",
			"properties": map[string]interface{}{
				"breach_id":          b.ID,
				"reach_id":           b.ReachID,
				"name":               b.LocationName,
				"river":              b.River,
				"type":               "breach_location",
				"breach_date":        b.BreachDate,
				"breach_width_m":     b.BreachWidthM,
				"peak_discharge_m3s": b.PeakDischargeM3s,
				"failure_mechanism":  b.FailureMechanism,
				"remediation_status": b.RemediationStatus,
				"severity":           b.Severity,
			},
			"geometry": map[string]interface{}{
				"type":        "Point",
				"coordinates": []float64{b.Longitude, b.Latitude},
			},
		})
	}

	// 3. Dynamic Hydrodynamic Inundation Polygons (Predictive Water Level Rise)
	inundationZones := calculator.GenerateInundationPolygons(reachList, delta)
	for _, z := range inundationZones {
		fillColor := "#38bdf8"
		if z.DepthClass == "DEEP" {
			fillColor = "#1e3a8a"
		} else if z.DepthClass == "MODERATE" {
			fillColor = "#0284c7"
		}
		features = append(features, map[string]interface{}{
			"type": "Feature",
			"properties": map[string]interface{}{
				"name":          fmt.Sprintf("Inundation Zone (+%.1fm)", z.StageDeltaM),
				"type":          "inundation_zone",
				"stage_delta_m": z.StageDeltaM,
				"depth_class":   z.DepthClass,
				"depth_m":       z.DepthM,
				"fillColor":     fillColor,
			},
			"geometry": map[string]interface{}{
				"type":        "Polygon",
				"coordinates": z.Polygon,
			},
		})
	}

	// 4. HAND Low-Lying Depression Entrapment Zones (Behind Dykes)
	depressions := calculator.GenerateHANDDepressionPolygons(reachList)
	for _, d := range depressions {
		features = append(features, map[string]interface{}{
			"type": "Feature",
			"properties": map[string]interface{}{
				"name":        d.Name,
				"reach_id":    d.ReachID,
				"type":        "hand_depression",
				"hand_m":      d.HANDM,
				"risk_rating": d.RiskRating,
				"fillColor":   "#818cf8",
			},
			"geometry": map[string]interface{}{
				"type":        "Polygon",
				"coordinates": d.Polygon,
			},
		})
	}

	return map[string]interface{}{
		"type":     "FeatureCollection",
		"features": features,
	}
}

// AddCitizenReport saves a new community report.
func (s *MemoryStore) AddCitizenReport(r models.CitizenReport) models.CitizenReport {
	s.mu.Lock()
	defer s.mu.Unlock()

	r.ID = fmt.Sprintf("REP-%s-%03d", time.Now().Format("20060102"), len(s.reports)+1)
	r.CreatedAt = time.Now()
	if r.Status == "" {
		r.Status = "PENDING_INSPECTION"
	}

	s.reports = append([]models.CitizenReport{r}, s.reports...)
	return r
}

// GetCitizenReports returns all community crack and seepage reports.
func (s *MemoryStore) GetCitizenReports() []models.CitizenReport {
	s.mu.RLock()
	defer s.mu.RUnlock()

	res := make([]models.CitizenReport, len(s.reports))
	copy(res, s.reports)
	return res
}

// AddAlertLog records an emergency notification dispatch.
func (s *MemoryStore) AddAlertLog(a models.AlertLog) models.AlertLog {
	s.mu.Lock()
	defer s.mu.Unlock()

	a.ID = fmt.Sprintf("ALT-%d", time.Now().UnixNano())
	a.SentAt = time.Now()
	s.alerts = append([]models.AlertLog{a}, s.alerts...)
	if len(s.alerts) > 100 {
		s.alerts = s.alerts[:100]
	}
	return a
}

// GetAlertLogs returns recent alert dispatch logs.
func (s *MemoryStore) GetAlertLogs(limit int) []models.AlertLog {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if limit <= 0 || limit > len(s.alerts) {
		limit = len(s.alerts)
	}

	res := make([]models.AlertLog, limit)
	copy(res, s.alerts[:limit])
	return res
}

// GetSystemStats computes live high-level telemetry summary.
func (s *MemoryStore) GetSystemStats() models.SystemStats {
	s.mu.RLock()
	defer s.mu.RUnlock()

	stats := models.SystemStats{
		ActiveNodes:       len(s.nodes),
		ServerTime:        time.Now(),
		TotalAlertsSent:   len(s.alerts),
		TotalReports:      len(s.reports),
		MinFactorOfSafety: 2.0,
	}

	var sumFs float64
	var count int

	for _, n := range s.nodes {
		if n.LastTelemetry != nil {
			count++
			fs := n.LastTelemetry.FactorOfSafety
			sumFs += fs
			if fs < stats.MinFactorOfSafety {
				stats.MinFactorOfSafety = fs
			}

			switch n.LastTelemetry.Status {
			case "SAFE":
				stats.SafeCount++
			case "WARNING":
				stats.WarningCount++
			case "CRITICAL":
				stats.CriticalCount++
			}
		}
	}

	if count > 0 {
		stats.AvgFactorOfSafety = sumFs / float64(count)
	}

	for _, r := range s.reaches {
		stats.TotalMonitoredKm += r.LengthKm
	}
	stats.TotalMonitoredKm = math.Round(stats.TotalMonitoredKm*10) / 10
	stats.TotalReaches = len(s.reaches)
	stats.HistoricalBreachCount = len(s.breaches)

	return stats
}
