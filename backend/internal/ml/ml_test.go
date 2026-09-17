package ml

import (
	"encoding/csv"
	"io"
	"math"
	"os"
	"strconv"
	"testing"
)

func TestRobustScaler(t *testing.T) {
	scaler := NewEmbankmentRobustScaler()

	// 1. Transforming center values must yield 0.0
	centerVals := []float64{31.785, 0.0, 85.8, 1.075, 0.3212, -13.33}
	scaledZeros, err := scaler.Transform(centerVals)
	if err != nil {
		t.Fatalf("Transform failed: %v", err)
	}

	for i, v := range scaledZeros {
		if math.Abs(v) > 1e-6 {
			t.Errorf("expected 0.0 at feature %d, got %f", i, v)
		}
	}

	// 2. Transforming center + scale must yield 1.0
	oneVals := []float64{
		31.785 + 2.56,
		0.0 + 27.27,
		85.8 + 28.525,
		1.075 + 2.3875,
		0.3212 + 0.03485,
		-13.33 + 0.7125,
	}
	scaledOnes, err := scaler.Transform(oneVals)
	if err != nil {
		t.Fatalf("Transform failed: %v", err)
	}

	for i, v := range scaledOnes {
		if math.Abs(v-1.0) > 1e-4 {
			t.Errorf("expected 1.0 at feature %d, got %f", i, v)
		}
	}

	// 3. Inverse transform check
	orig, err := scaler.InverseTransform(scaledOnes)
	if err != nil {
		t.Fatalf("InverseTransform failed: %v", err)
	}
	for i, v := range orig {
		if math.Abs(v-oneVals[i]) > 1e-5 {
			t.Errorf("expected %f at feature %d, got %f", oneVals[i], i, v)
		}
	}
}

func TestLoadWeightsAndInference(t *testing.T) {
	pthPath, err := FindModelFile("")
	if err != nil {
		t.Fatalf("PTH file not found: %v", err)
	}

	model, err := LoadWeightsFromPTH(pthPath)
	if err != nil {
		t.Fatalf("LoadWeightsFromPTH failed: %v", err)
	}

	if model == nil {
		t.Fatal("expected non-nil model")
	}

	scaler := NewEmbankmentRobustScaler()
	engine := NewInferenceEngine(model, scaler)

	// Test single step inference
	sampleFeatures := []float64{31.76, 0.0, 88.9, 0.56, 0.2882, -13.36}
	res, err := engine.PredictSingle(sampleFeatures)
	if err != nil {
		t.Fatalf("PredictSingle failed: %v", err)
	}

	if len(res.ForecastFS) != 24 {
		t.Fatalf("expected 24 forecast steps, got %d", len(res.ForecastFS))
	}

	if res.FactorOfSafety <= 0.0 || res.FactorOfSafety > 3.0 {
		t.Errorf("unexpected factor of safety: %f", res.FactorOfSafety)
	}

	if res.Status != "SAFE" && res.Status != "WARNING" && res.Status != "CRITICAL" {
		t.Errorf("unexpected status: %s", res.Status)
	}

	// Verify feature weights sum to ~1.0
	var sumWeights float64
	for _, w := range res.FeatureWeights {
		sumWeights += w
	}
	if math.Abs(sumWeights-1.0) > 0.05 {
		t.Errorf("expected feature weights to sum to ~1.0, got %f", sumWeights)
	}

	t.Logf("Single step inference succeeded:")
	t.Logf("  FactorOfSafety: %f", res.FactorOfSafety)
	t.Logf("  Status: %s", res.Status)
	t.Logf("  PBreach: %f", res.PBreach)
	t.Logf("  FailureMode: %s", res.FailureMode)
	t.Logf("  FeatureWeights: %+v", res.FeatureWeights)
	t.Logf("  24h Forecast: %v", res.ForecastFS[:5])
}

func TestBenchmarkTelemetryParity(t *testing.T) {
	pthPath, err := FindModelFile("")
	if err != nil {
		t.Fatalf("PTH file not found: %v", err)
	}

	model, err := LoadWeightsFromPTH(pthPath)
	if err != nil {
		t.Fatalf("LoadWeightsFromPTH failed: %v", err)
	}

	scaler := NewEmbankmentRobustScaler()
	engine := NewInferenceEngine(model, scaler)

	// Look for benchmark CSV in various locations
	candidates := []string{
		"../../pyscripts/benchmark_fea_embankment_telemetry.csv",
		"../pyscripts/benchmark_fea_embankment_telemetry.csv",
		"pyscripts/benchmark_fea_embankment_telemetry.csv",
		"/Users/knibirdgautam/Documents/CS_Coding_Projects/Go/BorBandh/pyscripts/benchmark_fea_embankment_telemetry.csv",
	}

	var csvPath string
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			csvPath = c
			break
		}
	}

	if csvPath == "" {
		t.Skip("benchmark CSV not found; skipping dataset parity test")
	}

	file, err := os.Open(csvPath)
	if err != nil {
		t.Fatalf("failed to open benchmark CSV: %v", err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	header, err := reader.Read()
	if err != nil {
		t.Fatalf("failed to read header: %v", err)
	}
	_ = header

	var totalError float64
	var count int

	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("error reading CSV: %v", err)
		}

		// timestamp,moisture,tilt,acoustic,rain_mm,ndwi,sar_backscatter,target_fs
		moist, _ := strconv.ParseFloat(record[1], 64)
		tilt, _ := strconv.ParseFloat(record[2], 64)
		acoustic, _ := strconv.ParseFloat(record[3], 64)
		rain, _ := strconv.ParseFloat(record[4], 64)
		ndwi, _ := strconv.ParseFloat(record[5], 64)
		sar, _ := strconv.ParseFloat(record[6], 64)
		targetFS, _ := strconv.ParseFloat(record[7], 64)

		feats := []float64{moist, tilt, acoustic, rain, ndwi, sar}
		res, err := engine.PredictSingle(feats)
		if err != nil {
			t.Fatalf("prediction failed on row %d: %v", count, err)
		}

		diff := math.Abs(res.FactorOfSafety - targetFS)
		totalError += diff
		count++

		// Test first 100 rows
		if count >= 100 {
			break
		}
	}

	mae := totalError / float64(count)
	t.Logf("Evaluated %d benchmark telemetry rows. Mean Absolute Error (MAE): %f", count, mae)

	if mae > 1.0 {
		t.Errorf("MAE unexpectedly high: %f", mae)
	}
}

func BenchmarkInferenceSpeed(b *testing.B) {
	pthPath, err := FindModelFile("")
	if err != nil {
		b.Fatalf("PTH file not found: %v", err)
	}

	model, err := LoadWeightsFromPTH(pthPath)
	if err != nil {
		b.Fatalf("LoadWeightsFromPTH failed: %v", err)
	}

	scaler := NewEmbankmentRobustScaler()
	engine := NewInferenceEngine(model, scaler)

	sampleFeatures := []float64{31.76, 0.0, 88.9, 0.56, 0.2882, -13.36}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = engine.PredictSingle(sampleFeatures)
	}
}
