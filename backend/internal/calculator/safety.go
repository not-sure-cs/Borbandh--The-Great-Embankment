package calculator

import (
	"math"
	"sync"

	"borbandh/backend/internal/ml"
)

const (
	ThresholdSafe     = 1.0
	ThresholdCritical = 0.7
)

var (
	mlMu      sync.RWMutex
	mlEngine  *ml.InferenceEngine
)

// SetMLEngine injects the active pure-Go TFT-PINN inference engine into the calculator.
func SetMLEngine(engine *ml.InferenceEngine) {
	mlMu.Lock()
	defer mlMu.Unlock()
	mlEngine = engine
}

// GetMLEngine returns the configured ML inference engine, if available.
func GetMLEngine() *ml.InferenceEngine {
	mlMu.RLock()
	defer mlMu.RUnlock()
	return mlEngine
}

// PredictNodeSafety performs full 6-channel ML inference combining IoT telemetry and macro variables.
func PredictNodeSafety(nodeID string, moisture, tilt, audio, rainMM, ndwi, sarBackscatter float64) (*ml.PredictionResult, error) {
	engine := GetMLEngine()
	if engine == nil {
		// Fallback to baseline calculation
		fs := CalculateFactorOfSafety(moisture, tilt, audio)
		stat := EvaluateStatus(fs)
		var pBreach float64
		if fs >= 1.0 {
			pBreach = 0.05
		} else if fs >= 0.7 {
			pBreach = 0.45
		} else {
			pBreach = 0.88
		}
		return &ml.PredictionResult{
			FactorOfSafety: fs,
			ForecastFS:     []float64{fs},
			Status:         stat,
			PBreach:        pBreach,
			FailureMode:    "Heuristic Fallback",
			FeatureWeights: map[string]float64{
				"moisture": 0.4,
				"tilt":     0.4,
				"acoustic": 0.2,
			},
		}, nil
	}

	features := []float64{moisture, tilt, audio, rainMM, ndwi, sarBackscatter}
	if nodeID != "" {
		return engine.Predict(nodeID, features)
	}
	return engine.PredictSingle(features)
}

// CalculateFactorOfSafety implements the baseline regression equation:
// Fs = 2.0 - (0.012 * Moisture) - (0.04 * Tilt) - (0.001 * Audio)
func CalculateFactorOfSafety(moisturePercent, tiltDegrees, audioRMS float64) float64 {
	// Clamp sensor input ranges to physical limits
	if moisturePercent < 0 {
		moisturePercent = 0
	} else if moisturePercent > 100 {
		moisturePercent = 100
	}

	if tiltDegrees < 0 {
		tiltDegrees = 0
	} else if tiltDegrees > 90 {
		tiltDegrees = 90
	}

	if audioRMS < 0 {
		audioRMS = 0
	}

	fs := 2.0 - (0.012 * moisturePercent) - (0.04 * tiltDegrees) - (0.001 * audioRMS)

	// Round to 3 decimal places for stability
	return math.Round(fs*1000) / 1000
}

// EvaluateStatus determines the structural integrity classification.
// Fs >= 1.0 -> SAFE
// 0.7 <= Fs < 1.0 -> WARNING
// Fs < 0.7 -> CRITICAL
func EvaluateStatus(fs float64) string {
	if fs >= ThresholdSafe {
		return "SAFE"
	}
	if fs >= ThresholdCritical {
		return "WARNING"
	}
	return "CRITICAL"
}

// RequiresEmergencyAlert returns true if safety score is below the emergency threshold (< 1.0).
func RequiresEmergencyAlert(fs float64) bool {
	return fs < ThresholdSafe
}
