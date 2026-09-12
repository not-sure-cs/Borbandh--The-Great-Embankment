package ingestion

import (
	"context"
	"testing"
	"time"

	"borbandh/backend/internal/store"
)

func TestCWCClient(t *testing.T) {
	client := NewCWCClient()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	// Test Majuli Nematighat Station
	data, err := client.FetchGaugeTelemetry(ctx, "REACH-MAJULI-01")
	if err != nil {
		t.Fatalf("FetchGaugeTelemetry returned error: %v", err)
	}
	if data.StationCode != "015-LBDNE" {
		t.Errorf("Expected station 015-LBDNE, got %s", data.StationCode)
	}
	if data.WaterLevel <= 0 {
		t.Errorf("Expected valid water level, got %.2f", data.WaterLevel)
	}
	if data.DangerLevel != 85.04 {
		t.Errorf("Expected danger level 85.04m, got %.2f", data.DangerLevel)
	}
}

func TestOpenTopoClient(t *testing.T) {
	client := NewOpenTopoClient()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	coords := [][]float64{
		{94.1500, 26.9300},
		{94.2400, 26.9600},
	}
	profile, err := client.FetchReachDEMProfile(ctx, "REACH-MAJULI-01", coords)
	if err != nil {
		t.Fatalf("FetchReachDEMProfile returned error: %v", err)
	}
	if profile.MeanElevationM <= 0 {
		t.Errorf("Expected elevation > 0, got %.2f", profile.MeanElevationM)
	}
	if profile.SlopeDeg <= 0 {
		t.Errorf("Expected slope > 0, got %.2f", profile.SlopeDeg)
	}
	if profile.HANDM <= 0 {
		t.Errorf("Expected HAND > 0, got %.2f", profile.HANDM)
	}
}

func TestNASAGPMClient(t *testing.T) {
	client := NewNASAGPMClient()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rain, err := client.FetchPrecipitation(ctx, "REACH-MAJULI-01", 26.94, 94.18, 25.0)
	if err != nil {
		t.Fatalf("FetchPrecipitation returned error: %v", err)
	}
	if rain.DailyRainfallMm <= 0 {
		t.Errorf("Expected daily rainfall > 0, got %.2f", rain.DailyRainfallMm)
	}
	if rain.Rainfall72hMm <= rain.DailyRainfallMm {
		t.Errorf("Expected 72h rain >= daily rain, got daily=%.2f, 72h=%.2f", rain.DailyRainfallMm, rain.Rainfall72hMm)
	}
	if rain.AntecedentIndex <= 0 {
		t.Errorf("Expected positive AntecedentIndex, got %.2f", rain.AntecedentIndex)
	}
}

func TestCopernicusClient(t *testing.T) {
	client := NewCopernicusClient()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	// Test Silchar reach (vulnerable, high saturation)
	obs, err := client.FetchSatelliteObservations(ctx, "REACH-SILCHAR-05", 24.83, 92.77)
	if err != nil {
		t.Fatalf("FetchSatelliteObservations returned error: %v", err)
	}
	if obs.SARBackscatterDB >= 0 {
		t.Errorf("Expected negative SAR backscatter in dB, got %.2f", obs.SARBackscatterDB)
	}
	if obs.Sentinel1SceneID == "" {
		t.Errorf("Expected valid Sentinel1SceneID")
	}
}

func TestBhuvanClient(t *testing.T) {
	client := NewBhuvanClient()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	reaches, err := client.FetchStructuralVectors(ctx, "assam_embankments")
	if err != nil {
		t.Fatalf("FetchStructuralVectors returned error: %v", err)
	}
	// Offline fallback returns empty slice gracefully without panic
	if reaches == nil {
		t.Errorf("Expected non-nil slice from Bhuvan client")
	}
}

func TestDataCollectorEndToEnd(t *testing.T) {
	st := store.NewStore()
	engine := NewIngestionEngine(st)
	collector := NewDataCollector(engine, st)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 1. Poll All Reaches Now
	readings, err := collector.PollAllReachesNow(ctx)
	if err != nil {
		t.Fatalf("PollAllReachesNow failed: %v", err)
	}
	if len(readings) == 0 {
		t.Fatalf("Expected readings from all reaches, got 0")
	}

	// Verify each reading was ingested into the store
	for _, r := range readings {
		stored, found := st.GetLatestMacroReading(r.ReachID)
		if !found {
			t.Errorf("Reading for reach %s was not persisted in store", r.ReachID)
		}
		if stored.CalculatedFreeboardM == 0 && stored.CWCWaterLevelM == 0 {
			t.Errorf("Expected calculated freeboard and water level, got 0")
		}
	}

	// 2. Test Collector Background Worker Lifecycle
	collector.Start(ctx)
	time.Sleep(100 * time.Millisecond)
	collector.Stop()
}
