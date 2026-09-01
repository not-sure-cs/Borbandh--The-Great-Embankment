package store

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/rand"
	"sync"
	"time"

	"aero_hydro/backend/internal/calculator"
	"aero_hydro/backend/internal/models"
)

// Store provides a thread-safe in-memory persistent data store using only the Go standard library.
type Store struct {
	mu           sync.RWMutex
	telemetry    []models.NodeTelemetry
	nodes        map[string]models.EmbankmentNode
	ledger       []models.ContractorLedger
	reports      []models.CitizenReport
	alerts       []models.AlertLog
	maxTelemetry int
}

// NewStore initializes the repository with default Assam embankment demonstration data.
func NewStore() *Store {
	s := &Store{
		telemetry:    make([]models.NodeTelemetry, 0, 1000),
		nodes:        make(map[string]models.EmbankmentNode),
		ledger:       make([]models.ContractorLedger, 0),
		reports:      make([]models.CitizenReport, 0),
		alerts:       make([]models.AlertLog, 0),
		maxTelemetry: 2000,
	}

	s.seedNodes()
	s.seedLedger()
	s.seedCitizenReports()
	s.seedInitialTelemetry()

	return s
}

func (s *Store) seedNodes() {
	defaultNodes := []models.EmbankmentNode{
		{
			NodeID:         "NODE-MAJULI-01",
			ZoneName:       "Majuli Island - Kamalabari Dyke",
			River:          "Brahmaputra",
			Latitude:       26.9452,
			Longitude:      94.1873,
			ElevationM:     84.5,
			BatteryVoltage: 4.12,
			FirmwareVer:    "ESPHome-AeroHydro-v1.4.2",
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
			FirmwareVer:    "ESPHome-AeroHydro-v1.4.2",
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
			FirmwareVer:    "ESPHome-AeroHydro-v1.4.2",
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
			FirmwareVer:    "ESPHome-AeroHydro-v1.4.2",
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
			FirmwareVer:    "ESPHome-AeroHydro-v1.4.2",
			LastSeen:       time.Now(),
		},
	}

	for _, n := range defaultNodes {
		s.nodes[n.NodeID] = n
	}
}

func (s *Store) seedLedger() {
	blocks := []struct {
		constituency string
		contractor   string
		budget       float64
		completion   string
		sector       string
		integrity    float64
		status       string
	}{
		{"Majuli", "Brahmaputra River Infra Ltd", 485.50, "2024-03-15", "Kamalabari Reach 1-4", 96.5, "VERIFIED"},
		{"Dibrugarh West", "Assam GeoTech Engineering", 620.00, "2023-11-20", "Town Protection Dyke Sec B", 91.2, "VERIFIED"},
		{"Tezpur", "Eastern Flood Defense Corp", 340.75, "2024-01-10", "Bhomoraguri Approach North", 88.0, "VERIFIED"},
		{"Jalukbari", "Saraighat Civils & Marine", 295.00, "2023-08-05", "Saraighat Right Bank Berm", 94.0, "VERIFIED"},
		{"Silchar", "Barak Valley Infrastructure", 510.20, "2024-04-30", "Bethukandi Dykes & Regulators", 79.5, "UNDER_REVIEW"},
	}

	prevHash := "0000000000000000000000000000000000000000000000000000000000000000"
	for idx, b := range blocks {
		now := time.Now().Add(-time.Duration(len(blocks)-idx) * 24 * 30 * time.Hour)
		recordID := fmt.Sprintf("LEDGER-ASSAM-2024-%03d", idx+1)
		
		dataToHash := fmt.Sprintf("%d:%s:%s:%f:%s:%s", idx+1, b.constituency, b.contractor, b.budget, b.completion, prevHash)
		h := sha256.Sum256([]byte(dataToHash))
		currHash := hex.EncodeToString(h[:])

		entry := models.ContractorLedger{
			ID:               recordID,
			Index:            idx + 1,
			Constituency:     b.constituency,
			ContractorName:   b.contractor,
			AllocatedBudget:  b.budget,
			CompletionDate:   b.completion,
			EmbankmentSector: b.sector,
			IntegrityScore:   b.integrity,
			Status:           b.status,
			PrevHash:         prevHash,
			HashSignature:    currHash,
			Timestamp:        now,
		}
		s.ledger = append(s.ledger, entry)
		prevHash = currHash
	}
}

func (s *Store) seedCitizenReports() {
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

func (s *Store) seedInitialTelemetry() {
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
func (s *Store) AddTelemetry(t models.NodeTelemetry) models.NodeTelemetry {
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
			FirmwareVer:    "ESPHome-AeroHydro-Auto",
			LastSeen:       t.CreatedAt,
			LastTelemetry:  &t,
		}
	}

	return t
}

// GetTelemetryHistory returns recent telemetry records optionally filtered by nodeID.
func (s *Store) GetTelemetryHistory(nodeID string, limit int) []models.NodeTelemetry {
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
func (s *Store) GetAllNodes() []models.EmbankmentNode {
	s.mu.RLock()
	defer s.mu.RUnlock()

	list := make([]models.EmbankmentNode, 0, len(s.nodes))
	for _, n := range s.nodes {
		list = append(list, n)
	}
	return list
}

// GetNodeByID returns an embankment node by its ID.
func (s *Store) GetNodeByID(nodeID string) (models.EmbankmentNode, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	n, ok := s.nodes[nodeID]
	return n, ok
}

// AddContractorLedger creates an immutable blockchain-style audit record with SHA-256 chaining.
func (s *Store) AddContractorLedger(entry models.ContractorLedger) models.ContractorLedger {
	s.mu.Lock()
	defer s.mu.Unlock()

	prevHash := "0000000000000000000000000000000000000000000000000000000000000000"
	index := 1
	if len(s.ledger) > 0 {
		last := s.ledger[len(s.ledger)-1]
		prevHash = last.HashSignature
		index = last.Index + 1
	}

	entry.ID = fmt.Sprintf("LEDGER-ASSAM-%d-%03d", time.Now().Year(), index)
	entry.Index = index
	entry.PrevHash = prevHash
	entry.Timestamp = time.Now()

	dataToHash := fmt.Sprintf("%d:%s:%s:%f:%s:%s", entry.Index, entry.Constituency, entry.ContractorName, entry.AllocatedBudget, entry.CompletionDate, prevHash)
	h := sha256.Sum256([]byte(dataToHash))
	entry.HashSignature = hex.EncodeToString(h[:])

	s.ledger = append(s.ledger, entry)
	return entry
}

// GetLedger returns all contractor audit records.
func (s *Store) GetLedger() []models.ContractorLedger {
	s.mu.RLock()
	defer s.mu.RUnlock()

	res := make([]models.ContractorLedger, len(s.ledger))
	copy(res, s.ledger)
	return res
}

// AddCitizenReport saves a new community report.
func (s *Store) AddCitizenReport(r models.CitizenReport) models.CitizenReport {
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
func (s *Store) GetCitizenReports() []models.CitizenReport {
	s.mu.RLock()
	defer s.mu.RUnlock()

	res := make([]models.CitizenReport, len(s.reports))
	copy(res, s.reports)
	return res
}

// AddAlertLog records an emergency notification dispatch.
func (s *Store) AddAlertLog(a models.AlertLog) models.AlertLog {
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
func (s *Store) GetAlertLogs(limit int) []models.AlertLog {
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
func (s *Store) GetSystemStats() models.SystemStats {
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

	for _, l := range s.ledger {
		stats.TotalLedgerBudget += l.AllocatedBudget
	}

	return stats
}
