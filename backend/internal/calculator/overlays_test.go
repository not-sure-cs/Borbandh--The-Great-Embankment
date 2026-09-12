package calculator

import (
	"testing"

	"borbandh/backend/internal/models"
)

func TestCalculateSegmentBreachProbabilities(t *testing.T) {
	reach := models.EmbankmentReach{
		ID:             "REACH-TEST-01",
		Name:           "Test Embankment Reach",
		CrestElevation: 85.0,
		Vulnerability:  true,
		Coordinates: [][]float64{
			{94.18, 26.94},
			{94.20, 26.96},
			{94.22, 26.98},
		},
	}

	// 1. Normal safe conditions
	normalTelemetry := &models.NodeTelemetry{
		SoilMoisture: 35.0,
		TiltAngle:    0.8,
	}
	normalSegs := CalculateSegmentBreachProbabilities(reach, 82.0, 84.0, 1.0, normalTelemetry)
	if len(normalSegs) != 2 {
		t.Fatalf("expected 2 segments, got %d", len(normalSegs))
	}
	if normalSegs[0].PBreach > 0.70 {
		t.Errorf("expected normal conditions to have low/moderate breach probability, got %f", normalSegs[0].PBreach)
	}

	// 2. Critical surge / high saturation conditions
	criticalTelemetry := &models.NodeTelemetry{
		SoilMoisture: 92.0,
		TiltAngle:    8.5,
	}
	criticalSegs := CalculateSegmentBreachProbabilities(reach, 84.9, 84.0, 18.0, criticalTelemetry)
	if len(criticalSegs) != 2 {
		t.Fatalf("expected 2 segments, got %d", len(criticalSegs))
	}
	if criticalSegs[0].PBreach < 0.70 {
		t.Errorf("expected critical conditions to trigger critical P_breach (>=0.70), got %f", criticalSegs[0].PBreach)
	}
	if criticalSegs[0].RiskTier != "CRITICAL" {
		t.Errorf("expected CRITICAL tier, got %s", criticalSegs[0].RiskTier)
	}
}

func TestGenerateInundationPolygons(t *testing.T) {
	reaches := []models.EmbankmentReach{
		{
			ID:   "REACH-TEST-01",
			Name: "Test Reach",
			Coordinates: [][]float64{
				{94.18, 26.94},
				{94.20, 26.96},
				{94.22, 26.98},
			},
		},
	}

	zones := GenerateInundationPolygons(reaches, 1.5)
	if len(zones) != 1 {
		t.Fatalf("expected 1 inundation zone, got %d", len(zones))
	}
	if zones[0].DepthClass != "MODERATE" {
		t.Errorf("expected MODERATE depth class for 1.5m delta, got %s", zones[0].DepthClass)
	}
	if len(zones[0].Polygon[0]) < 4 {
		t.Errorf("expected closed polygon with >= 4 vertices, got %d", len(zones[0].Polygon[0]))
	}

	// Check extreme stage
	deepZones := GenerateInundationPolygons(reaches, 4.0)
	if deepZones[0].DepthClass != "DEEP" {
		t.Errorf("expected DEEP depth class for 4.0m delta, got %s", deepZones[0].DepthClass)
	}
}

func TestGenerateHANDDepressionPolygons(t *testing.T) {
	reaches := []models.EmbankmentReach{
		{
			ID:   "REACH-TEST-01",
			Name: "Test Reach",
			Coordinates: [][]float64{
				{94.18, 26.94},
				{94.20, 26.96},
				{94.22, 26.98},
			},
		},
	}

	depressions := GenerateHANDDepressionPolygons(reaches)
	if len(depressions) != 1 {
		t.Fatalf("expected 1 depression, got %d", len(depressions))
	}
	if depressions[0].HANDM <= 0 {
		t.Errorf("expected positive HAND elevation, got %f", depressions[0].HANDM)
	}
	if len(depressions[0].Polygon[0]) < 10 {
		t.Errorf("expected circular polygon ring, got %d vertices", len(depressions[0].Polygon[0]))
	}
}
