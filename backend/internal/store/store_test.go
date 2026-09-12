package store

import (
	"sync"
	"testing"
	"time"

	"borbandh/backend/internal/models"
)

func TestStoreInitialization(t *testing.T) {
	s := NewStore()

	// Verify reaches seeded
	reaches := s.GetReaches()
	if len(reaches) < 5 {
		t.Errorf("Expected at least 5 default seeded reaches, got %d", len(reaches))
	}

	// Verify breaches seeded
	breaches := s.GetBreaches()
	if len(breaches) < 5 {
		t.Errorf("Expected at least 5 default seeded breaches, got %d", len(breaches))
	}

	// Verify stats
	stats := s.GetSystemStats()
	if stats.TotalMonitoredKm <= 0 {
		t.Errorf("Expected TotalMonitoredKm > 0, got %.2f", stats.TotalMonitoredKm)
	}
	if stats.TotalReaches != len(reaches) {
		t.Errorf("Expected TotalReaches=%d, got %d", len(reaches), stats.TotalReaches)
	}
	if stats.HistoricalBreachCount != len(breaches) {
		t.Errorf("Expected HistoricalBreachCount=%d, got %d", len(breaches), stats.HistoricalBreachCount)
	}
}

func TestStoreGeoJSONGeneration(t *testing.T) {
	s := NewStore()
	geo := s.GetGeoJSON()

	geoType, ok := geo["type"].(string)
	if !ok || geoType != "FeatureCollection" {
		t.Fatalf("Expected FeatureCollection, got %v", geo["type"])
	}

	features, ok := geo["features"].([]map[string]interface{})
	if !ok || len(features) == 0 {
		t.Fatalf("Expected non-empty features array")
	}

	var hasLine, hasBuffer, hasBreach bool
	for _, f := range features {
		props, pOk := f["properties"].(map[string]interface{})
		if !pOk {
			continue
		}
		fType, _ := props["type"].(string)
		switch fType {
		case "embankment_line":
			hasLine = true
		case "buffer_zone":
			hasBuffer = true
		case "breach_location":
			hasBreach = true
		}
	}

	if !hasLine {
		t.Errorf("GeoJSON missing embankment_line features")
	}
	if !hasBuffer {
		t.Errorf("GeoJSON missing buffer_zone features")
	}
	if !hasBreach {
		t.Errorf("GeoJSON missing breach_location features")
	}
}

func TestStoreConcurrentAccess(t *testing.T) {
	s := NewStore()
	var wg sync.WaitGroup

	// Concurrently read and ingest
	for i := 0; i < 20; i++ {
		wg.Add(3)

		// Goroutine 1: Ingest reach
		go func(idx int) {
			defer wg.Done()
			s.IngestReach(models.EmbankmentReach{
				ID:             "CONCURRENT-REACH",
				Name:           "Concurrent Reach",
				River:          "Brahmaputra",
				LengthKm:       10.0,
				CrestElevation: 80.0,
			})
		}(i)

		// Goroutine 2: Ingest breach
		go func(idx int) {
			defer wg.Done()
			s.IngestBreach(models.BreachRecord{
				ID:           "CONCURRENT-BREACH",
				LocationName: "Concurrent Breach Spot",
				Latitude:     26.5,
				Longitude:    93.0,
				BreachDate:   time.Now().Format("2006-01-02"),
			})
		}(i)

		// Goroutine 3: Read stats and GeoJSON
		go func() {
			defer wg.Done()
			_ = s.GetSystemStats()
			_ = s.GetGeoJSON()
		}()
	}

	wg.Wait()
}
