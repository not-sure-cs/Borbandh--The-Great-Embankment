package ingestion

import (
	"math"
	"testing"
	"time"

	"borbandh/backend/internal/models"
	"borbandh/backend/internal/store"
)

func TestGenerate50mBuffer(t *testing.T) {
	line := [][]float64{
		{94.1500, 26.9300},
		{94.1700, 26.9400},
		{94.1873, 26.9452},
	}

	poly := Generate50mBuffer(line)
	if len(poly) == 0 {
		t.Fatalf("Expected valid polygon ring, got empty")
	}

	ring := poly[0]
	if len(ring) < 4 {
		t.Errorf("Expected at least 4 vertices for closed buffer polygon, got %d", len(ring))
	}

	// Verify polygon is closed: first vertex == last vertex
	first := ring[0]
	last := ring[len(ring)-1]
	if math.Abs(first[0]-last[0]) > 1e-6 || math.Abs(first[1]-last[1]) > 1e-6 {
		t.Errorf("Buffer polygon is not closed: first=%v, last=%v", first, last)
	}
}

func TestHaversineAndLength(t *testing.T) {
	// Guwahati (26.1738, 91.6854) to Tezpur (26.6338, 92.7926)
	dist := CalculateHaversineDistanceKm(26.1738, 91.6854, 26.6338, 92.7926)
	if dist < 110.0 || dist > 140.0 {
		t.Errorf("Expected Guwahati-Tezpur distance ~120-130 km, got %.2f km", dist)
	}

	line := [][]float64{
		{91.6854, 26.1738},
		{92.7926, 26.6338},
	}
	length := CalculatePolylineLengthKm(line)
	if math.Abs(length-dist) > 0.1 {
		t.Errorf("Expected polyline length %.2f, got %.2f", dist, length)
	}
}

func TestProcessSARBackscatter(t *testing.T) {
	// Dry soil (>= -6 dB)
	water, score := ProcessSARBackscatter(-5.0)
	if water || score != 0.0 {
		t.Errorf("Expected dry soil (water=false, score=0.0), got water=%v, score=%.3f", water, score)
	}

	// Saturated open water (< -14 dB)
	water, score = ProcessSARBackscatter(-17.5)
	if !water || score < 0.6 {
		t.Errorf("Expected open water detection, got water=%v, score=%.3f", water, score)
	}

	// Submerged radar specular reflection (<= -24 dB)
	water, score = ProcessSARBackscatter(-26.0)
	if !water || score != 1.0 {
		t.Errorf("Expected fully submerged max score 1.0, got water=%v, score=%.3f", water, score)
	}
}

func TestProcessOpticalIndices(t *testing.T) {
	// Water surface: Green high (0.25), SWIR very low (0.02)
	mndwi, _ := ProcessOpticalIndices(0.25, 0.05, 0.04, 0.02)
	if mndwi <= 0.5 {
		t.Errorf("Expected high positive MNDWI for water body, got %.3f", mndwi)
	}

	// Dense vegetation on embankment slope: NIR high (0.45), Red low (0.05)
	_, ndvi := ProcessOpticalIndices(0.08, 0.05, 0.45, 0.10)
	if ndvi <= 0.7 {
		t.Errorf("Expected high positive NDVI for grass cover, got %.3f", ndvi)
	}
}

func TestProcessHydraulicDriver(t *testing.T) {
	crest := 86.5
	cwl := 85.0
	dl := 85.5
	prevCWL := 84.8
	deltaHours := 2.0 // rose 20 cm in 2 hours -> 10 cm/hr

	freeboard, rateOfRise, warning := ProcessHydraulicDriver(crest, cwl, dl, prevCWL, deltaHours)
	if math.Abs(freeboard-1.5) > 0.01 {
		t.Errorf("Expected freeboard 1.5m, got %.2f", freeboard)
	}
	if math.Abs(rateOfRise-10.0) > 0.1 {
		t.Errorf("Expected rate of rise 10.0 cm/hr, got %.2f", rateOfRise)
	}
	if warning {
		t.Errorf("Expected no warning under normal freeboard and sub-danger level")
	}

	// Test Overtopping Warning condition: freeboard < 0.5m
	_, _, warnCritical := ProcessHydraulicDriver(crest, 86.2, dl, prevCWL, deltaHours)
	if !warnCritical {
		t.Errorf("Expected warning when freeboard is 0.3m (< 0.5m)")
	}

	// Test Rapid Surge rate: > 12 cm/hr (rose 40 cm in 2 hours -> 20 cm/hr)
	_, rateSurge, warnSurge := ProcessHydraulicDriver(crest, 85.0, dl, 84.6, deltaHours)
	if rateSurge != 20.0 || !warnSurge {
		t.Errorf("Expected surge warning at 20 cm/hr, got rate=%.1f, warn=%v", rateSurge, warnSurge)
	}
}

func TestProcessPrecipitation(t *testing.T) {
	// Day 1: 50 mm, prev API 0
	api1, alert1 := ProcessPrecipitation(50.0, 0.0)
	if api1 != 50.0 || alert1 {
		t.Errorf("Expected API=50.0, alert=false, got api=%.1f, alert=%v", api1, alert1)
	}

	// Day 2: Heavy monsoon rain 80 mm (> 64.5 mm)
	api2, alert2 := ProcessPrecipitation(80.0, api1)
	expectedAPI2 := 80.0 + 0.85*50.0 // 122.5
	if math.Abs(api2-expectedAPI2) > 0.1 || !alert2 {
		t.Errorf("Expected API=%.1f, alert=true, got api=%.1f, alert=%v", expectedAPI2, api2, alert2)
	}
}

func TestIngestionEnginePipeline(t *testing.T) {
	st := store.NewStore()
	engine := NewIngestionEngine(st)

	// 1. Ingest Reach
	reach := models.EmbankmentReach{
		ID:             "TEST-REACH-01",
		Name:           "Test Brahmaputra Reach",
		River:          "Brahmaputra",
		District:       "Jorhat",
		CrestElevation: 85.0,
		BaseWidthM:     20.0,
		Vulnerability:  true,
		Coordinates: [][]float64{
			{94.10, 26.85},
			{94.15, 26.90},
			{94.20, 26.95},
		},
	}

	savedReach, err := engine.ProcessAndIngestReach(reach)
	if err != nil {
		t.Fatalf("Failed to ingest reach: %v", err)
	}
	if savedReach.LengthKm <= 0 {
		t.Errorf("Expected auto-calculated length > 0, got %.2f", savedReach.LengthKm)
	}
	if len(savedReach.BufferPolygon) == 0 {
		t.Errorf("Expected auto-generated 50m buffer polygon")
	}

	// Verify reach was stored
	retrieved, found := st.GetReach("TEST-REACH-01")
	if !found || retrieved.Name != "Test Brahmaputra Reach" {
		t.Errorf("Reach not found in store")
	}

	// 2. Ingest Breach with auto reach association
	breach := models.BreachRecord{
		ID:               "TEST-BREACH-01",
		LocationName:     "Test Field Breach Spot",
		River:            "Brahmaputra",
		Latitude:         26.902,
		Longitude:        94.151,
		BreachWidthM:     50.0,
		PeakDischargeM3s: 500.0,
		FailureMechanism: "Piping & Seepage",
		Severity:         "SEVERE",
	}

	savedBreach, err := engine.ProcessAndIngestBreach(breach)
	if err != nil {
		t.Fatalf("Failed to ingest breach: %v", err)
	}
	if savedBreach.ReachID != "TEST-REACH-01" {
		t.Errorf("Expected breach to auto-associate with nearest reach TEST-REACH-01, got %s", savedBreach.ReachID)
	}

	// 3. Ingest Macro Reading
	reading := models.MacroEnvironmentalReading{
		ReachID:          "TEST-REACH-01",
		Timestamp:        time.Now(),
		SARBackscatterDB: -16.5, // water detected
		OpticalMNDWI:     0.35,
		OpticalNDVI:      0.22,
		DEMSlopeDeg:      24.0,
		DEMElevationHAND: 1.1,
		Rainfall72hMm:    110.0,
		CWCWaterLevelM:   84.6, // Crest is 85.0 -> Freeboard 0.4m -> warning!
		CWCDangerLevelM:  84.5,
	}

	savedReading, err := engine.IngestMacroReading(reading, 84.2, 1.0)
	if err != nil {
		t.Fatalf("Failed to ingest macro reading: %v", err)
	}
	if !savedReading.SARWaterDetected {
		t.Errorf("Expected SAR water detection at -16.5 dB")
	}
	if math.Abs(savedReading.CalculatedFreeboardM-0.4) > 0.01 {
		t.Errorf("Expected freeboard 0.4m, got %.2f", savedReading.CalculatedFreeboardM)
	}
	if !savedReading.HydraulicWarning {
		t.Errorf("Expected hydraulic warning flag when freeboard is 0.4m (< 0.5m) and CWL >= DL")
	}
}
