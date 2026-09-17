package simulator

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"sync"
	"time"

	"borbandh/backend/internal/alerting"
	"borbandh/backend/internal/calculator"
	"borbandh/backend/internal/models"
	"borbandh/backend/internal/sse"
	"borbandh/backend/internal/store"
)

// Simulator simulates real-world IoT telemetry for edge nodes.
type Simulator struct {
	mu          sync.RWMutex
	store       store.Store
	dispatcher  *alerting.Dispatcher
	broker      *sse.Broker
	isRunning   bool
	interval    time.Duration
	activeMode  string // NORMAL, MONSOON_SURGE, RAPID_TILT, PIPING_EROSION, FLASH_FLOOD
	cancelFunc  context.CancelFunc
}

func NewSimulator(st store.Store, disp *alerting.Dispatcher, br *sse.Broker) *Simulator {
	return &Simulator{
		store:      st,
		dispatcher: disp,
		broker:     br,
		interval:   5 * time.Second,
		activeMode: "NORMAL",
	}
}

// Start begins background telemetry generation.
func (s *Simulator) Start() {
	s.mu.Lock()
	if s.isRunning {
		s.mu.Unlock()
		return
	}
	s.isRunning = true
	ctx, cancel := context.WithCancel(context.Background())
	s.cancelFunc = cancel
	s.mu.Unlock()

	go s.loop(ctx)
	log.Println("[SIMULATOR] IoT node background telemetry stream started (Interval: 5s)")
}

// Stop pauses background generation.
func (s *Simulator) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.isRunning {
		return
	}
	s.isRunning = false
	if s.cancelFunc != nil {
		s.cancelFunc()
	}
	log.Println("[SIMULATOR] IoT node background telemetry stream paused")
}

// SetScenario dynamically triggers a stress simulation.
func (s *Simulator) SetScenario(scenario string, targetNode string) {
	s.mu.Lock()
	s.activeMode = scenario
	s.mu.Unlock()

	log.Printf("[SIMULATOR] Scenario switched to: %s (Target Node: %s)", scenario, targetNode)

	// Execute instant step
	s.tickNode(targetNode, scenario)
}

func (s *Simulator) loop(ctx context.Context) {
	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			nodes := s.store.GetAllNodes()
			for _, n := range nodes {
				s.mu.RLock()
				mode := s.activeMode
				s.mu.RUnlock()
				s.tickNode(n.NodeID, mode)
			}
		}
	}
}

func (s *Simulator) tickNode(nodeID string, mode string) {
	node, exists := s.store.GetNodeByID(nodeID)
	if !exists {
		return
	}

	var moist, tilt, audio float64

	switch mode {
	case "FLASH_FLOOD", "CRITICAL_BREACH":
		// Phase 6 extreme scenario: High saturation, rapid embankment slump, piping acoustic vibration
		moist = 92.0 + rand.Float64()*7.0   // 92 - 99%
		tilt = 14.5 + rand.Float64()*6.0    // 14.5 - 20.5 degrees
		audio = 450.0 + rand.Float64()*300.0 // 450 - 750 RMS
	case "MONSOON_SURGE":
		moist = 75.0 + rand.Float64()*12.0
		tilt = 6.0 + rand.Float64()*3.0
		audio = 180.0 + rand.Float64()*90.0
	case "RAPID_TILT":
		moist = 50.0 + rand.Float64()*10.0
		tilt = 16.0 + rand.Float64()*5.0
		audio = 90.0 + rand.Float64()*40.0
	case "PIPING_EROSION":
		moist = 80.0 + rand.Float64()*10.0
		tilt = 4.0 + rand.Float64()*2.0
		audio = 650.0 + rand.Float64()*250.0
	default: // NORMAL
		moist = 32.0 + rand.Float64()*15.0
		tilt = 1.0 + rand.Float64()*1.8
		audio = 15.0 + rand.Float64()*20.0
	}

	// Environmental macro conditions tailored to simulation mode
	var rain, ndwi, sar float64
	switch mode {
	case "FLASH_FLOOD", "CRITICAL_BREACH":
		rain = 68.0 + rand.Float64()*25.0
		ndwi = 0.55 + rand.Float64()*0.15
		sar = -21.0 - rand.Float64()*3.0 // low dB = specular water reflection / submergence
	case "MONSOON_SURGE":
		rain = 35.0 + rand.Float64()*15.0
		ndwi = 0.45 + rand.Float64()*0.10
		sar = -18.0 - rand.Float64()*2.0
	case "RAPID_TILT":
		rain = 12.0 + rand.Float64()*8.0
		ndwi = 0.34 + rand.Float64()*0.05
		sar = -14.5 - rand.Float64()*1.5
	case "PIPING_EROSION":
		rain = 20.0 + rand.Float64()*10.0
		ndwi = 0.40 + rand.Float64()*0.08
		sar = -17.0 - rand.Float64()*2.0
	default: // NORMAL
		rain = 1.0 + rand.Float64()*2.5
		ndwi = 0.30 + rand.Float64()*0.04
		sar = -13.2 + (rand.Float64()-0.5)*0.8
	}

	mlRes, _ := calculator.PredictNodeSafety(nodeID, moist, tilt, audio, rain, ndwi, sar)

	telemetry := models.NodeTelemetry{
		ID:             fmt.Sprintf("TEL-%d-%s", time.Now().UnixNano(), nodeID),
		NodeID:         nodeID,
		ZoneName:       node.ZoneName,
		SoilMoisture:   moist,
		TiltAngle:      tilt,
		AudioRMS:       audio,
		FactorOfSafety: mlRes.FactorOfSafety,
		ForecastFS:     mlRes.ForecastFS,
		PBreach:        mlRes.PBreach,
		FailureMode:    mlRes.FailureMode,
		FeatureWeights: mlRes.FeatureWeights,
		Status:         mlRes.Status,
		CreatedAt:      time.Now(),
	}

	saved := s.store.AddTelemetry(telemetry)

	// Broadcast over SSE
	s.broker.Broadcast("telemetry", saved)

	// Evaluate emergency alert
	if alerts := s.dispatcher.ProcessTelemetry(saved); len(alerts) > 0 {
		for _, alt := range alerts {
			s.broker.Broadcast("alert", alt)
		}
	}
}

// IngestManual processes a single incoming payload from an ESP32 or manual API call.
func (s *Simulator) IngestManual(payload models.TelemetryIngestPayload) models.NodeTelemetry {
	// Use regional default macro indices when ingesting standalone IoT packets
	rain := 1.075
	ndwi := 0.3212
	sar := -13.33

	mlRes, _ := calculator.PredictNodeSafety(payload.NodeID, payload.SoilMoisture, payload.TiltAngle, payload.AudioRMS, rain, ndwi, sar)

	zone := payload.ZoneName
	if zone == "" {
		if node, exists := s.store.GetNodeByID(payload.NodeID); exists {
			zone = node.ZoneName
		} else {
			zone = fmt.Sprintf("Field Sector - %s", payload.NodeID)
		}
	}

	telemetry := models.NodeTelemetry{
		ID:             fmt.Sprintf("TEL-%d-%s", time.Now().UnixNano(), payload.NodeID),
		NodeID:         payload.NodeID,
		ZoneName:       zone,
		SoilMoisture:   payload.SoilMoisture,
		TiltAngle:      payload.TiltAngle,
		AudioRMS:       payload.AudioRMS,
		FactorOfSafety: mlRes.FactorOfSafety,
		ForecastFS:     mlRes.ForecastFS,
		PBreach:        mlRes.PBreach,
		FailureMode:    mlRes.FailureMode,
		FeatureWeights: mlRes.FeatureWeights,
		Status:         mlRes.Status,
		CreatedAt:      time.Now(),
	}

	saved := s.store.AddTelemetry(telemetry)
	s.broker.Broadcast("telemetry", saved)

	if alerts := s.dispatcher.ProcessTelemetry(saved); len(alerts) > 0 {
		for _, alt := range alerts {
			s.broker.Broadcast("alert", alt)
		}
	}

	return saved
}
