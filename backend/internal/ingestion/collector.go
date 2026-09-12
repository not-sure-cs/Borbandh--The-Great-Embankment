package ingestion

import (
	"context"
	"log"
	"sync"
	"time"

	"borbandh/backend/internal/models"
	"borbandh/backend/internal/store"
)

// DataCollector orchestrates outbound API collectors across all data providers:
// 1. CWC River Gauges
// 2. OpenTopography Copernicus DEM
// 3. NASA GPM IMERG Rainfall
// 4. Copernicus CDSE (Sentinel-1 SAR & Sentinel-2 Optical)
// 5. ISRO Bhuvan Vector Geometries
type DataCollector struct {
	engine           *IngestionEngine
	store            *store.Store
	cwcClient        *CWCClient
	openTopoClient   *OpenTopoClient
	nasaGPMClient    *NASAGPMClient
	copernicusClient *CopernicusClient
	bhuvanClient     *BhuvanClient
	pollInterval     time.Duration
	mu               sync.Mutex
	isRunning        bool
	cancelFunc       context.CancelFunc
}

// NewDataCollector initializes all outbound API clients and binds them to the ingestion engine.
func NewDataCollector(engine *IngestionEngine, st *store.Store) *DataCollector {
	return &DataCollector{
		engine:           engine,
		store:            st,
		cwcClient:        NewCWCClient(),
		openTopoClient:   NewOpenTopoClient(),
		nasaGPMClient:    NewNASAGPMClient(),
		copernicusClient: NewCopernicusClient(),
		bhuvanClient:     NewBhuvanClient(),
		pollInterval:     15 * time.Minute,
	}
}

// PollReach executes a full multi-source outbound collection cycle for a single reach.
func (dc *DataCollector) PollReach(ctx context.Context, reach models.EmbankmentReach) (*models.MacroEnvironmentalReading, error) {
	lat := 26.5
	lon := 93.0
	if len(reach.Coordinates) > 0 {
		lon = reach.Coordinates[0][0]
		lat = reach.Coordinates[0][1]
	}

	// 1. Fetch live or calibrated CWC river stage gauge reading
	cwcData, err := dc.cwcClient.FetchGaugeTelemetry(ctx, reach.ID)
	if err != nil {
		return nil, err
	}

	// 2. Fetch Copernicus Sentinel-1 SAR & Sentinel-2 Optical observations
	satData, err := dc.copernicusClient.FetchSatelliteObservations(ctx, reach.ID, lat, lon)
	if err != nil {
		return nil, err
	}

	// 3. Fetch OpenTopography Copernicus 30m DEM terrain slope & HAND
	demData, err := dc.openTopoClient.FetchReachDEMProfile(ctx, reach.ID, reach.Coordinates)
	if err != nil {
		return nil, err
	}

	// 4. Fetch NASA GPM IMERG catchment precipitation
	prevReading, _ := dc.store.GetLatestMacroReading(reach.ID)
	prevAPI := 0.0
	prevCWL := cwcData.WaterLevel - 0.05
	deltaHours := 1.0

	if prevReading.AntecedentPrecipIndex > 0 {
		prevAPI = prevReading.AntecedentPrecipIndex
		prevCWL = prevReading.CWCWaterLevelM
		if !prevReading.Timestamp.IsZero() {
			deltaHours = time.Since(prevReading.Timestamp).Hours()
			if deltaHours <= 0 {
				deltaHours = 1.0
			}
		}
	}

	rainData, err := dc.nasaGPMClient.FetchPrecipitation(ctx, reach.ID, lat, lon, prevAPI)
	if err != nil {
		return nil, err
	}

	// 5. Assemble unified macro environmental payload
	raw := models.MacroEnvironmentalReading{
		ReachID:               reach.ID,
		Timestamp:             time.Now(),
		SARBackscatterDB:      satData.SARBackscatterDB,
		OpticalMNDWI:          satData.OpticalMNDWI,
		OpticalNDVI:           satData.OpticalNDVI,
		DEMSlopeDeg:           demData.SlopeDeg,
		DEMElevationHAND:      demData.HANDM,
		Rainfall72hMm:         rainData.Rainfall72hMm,
		AntecedentPrecipIndex: rainData.AntecedentIndex,
		CWCWaterLevelM:        cwcData.WaterLevel,
		CWCDangerLevelM:       cwcData.DangerLevel,
	}

	// 6. Ingest into Processing Engine (evaluates freeboard, surge rate, water detection, warnings)
	processed, err := dc.engine.IngestMacroReading(raw, prevCWL, deltaHours)
	if err != nil {
		return nil, err
	}

	return &processed, nil
}

// PollAllReachesNow triggers an immediate collection sweep across all reaches in the store.
func (dc *DataCollector) PollAllReachesNow(ctx context.Context) ([]models.MacroEnvironmentalReading, error) {
	reaches := dc.store.GetReaches()
	results := make([]models.MacroEnvironmentalReading, 0, len(reaches))

	for _, r := range reaches {
		reading, err := dc.PollReach(ctx, r)
		if err != nil {
			log.Printf("[Collector] Error polling reach %s: %v", r.ID, err)
			continue
		}
		results = append(results, *reading)
	}

	return results, nil
}

// Start launches the background periodic polling routine.
func (dc *DataCollector) Start(parentCtx context.Context) {
	dc.mu.Lock()
	if dc.isRunning {
		dc.mu.Unlock()
		return
	}
	ctx, cancel := context.WithCancel(parentCtx)
	dc.cancelFunc = cancel
	dc.isRunning = true
	dc.mu.Unlock()

	go func() {
		log.Printf("[Collector] Starting outbound API data collection background worker (interval: %v)", dc.pollInterval)
		
		// Initial collection sweep on startup
		_, _ = dc.PollAllReachesNow(ctx)

		ticker := time.NewTicker(dc.pollInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				log.Println("[Collector] Stopped outbound data collector background worker")
				return
			case <-ticker.C:
				log.Println("[Collector] Running scheduled multi-source outbound collection cycle...")
				_, _ = dc.PollAllReachesNow(ctx)
			}
		}
	}()
}

// Stop terminates the background polling worker.
func (dc *DataCollector) Stop() {
	dc.mu.Lock()
	defer dc.mu.Unlock()
	if !dc.isRunning {
		return
	}
	if dc.cancelFunc != nil {
		dc.cancelFunc()
	}
	dc.isRunning = false
}
