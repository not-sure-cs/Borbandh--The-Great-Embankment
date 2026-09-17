package ml

import (
	"errors"
	"math"
	"sync"
)

// BaselineFactorOfSafety is the limit equilibrium factor of safety (FS = 1.0).
// In PINN training, the network predicts residual safety deviation Delta FS relative to limit equilibrium.
const BaselineFactorOfSafety = 1.0

// PredictionResult encapsulates the comprehensive ML + PINN physics safety analysis.
type PredictionResult struct {
	FactorOfSafety float64            `json:"factor_of_safety"` // Next-hour predicted Fs (t+1)
	ForecastFS     []float64          `json:"forecast_fs"`      // 24-step trajectory (t+1..t+24)
	Status         string             `json:"status"`           // SAFE, WARNING, CRITICAL
	PBreach        float64            `json:"p_breach"`         // Failure probability [0.0, 1.0]
	FailureMode    string             `json:"failure_mode"`     // Dominant physical mechanism
	FeatureWeights map[string]float64 `json:"feature_weights"`  // Explainable VSN importance weights
}

// InferenceEngine coordinates scaling, sequence buffering, and neural network inference.
type InferenceEngine struct {
	mu           sync.RWMutex
	scaler       *RobustScaler
	model        *TFTPINNModel
	nodeWindows  map[string][][]float32 // nodeID -> sliding sequence of scaled feature vectors
	maxWindowLen int
}

// NewInferenceEngine instantiates an inference engine with the given model and scaler.
func NewInferenceEngine(model *TFTPINNModel, scaler *RobustScaler) *InferenceEngine {
	if scaler == nil {
		scaler = NewEmbankmentRobustScaler()
	}
	return &InferenceEngine{
		scaler:       scaler,
		model:        model,
		nodeWindows:  make(map[string][][]float32),
		maxWindowLen: 24, // 24-hour temporal lookback window
	}
}

// Predict processes a single multi-variate reading for a station, updates its temporal context, and runs inference.
// features must contain [moisture, tilt, acoustic, rain_mm, ndwi, sar_backscatter].
func (e *InferenceEngine) Predict(nodeID string, rawFeatures []float64) (*PredictionResult, error) {
	if len(rawFeatures) != NumFeatures {
		return nil, errors.New("raw features must contain exactly 6 features")
	}

	scaled64, err := e.scaler.Transform(rawFeatures)
	if err != nil {
		return nil, err
	}

	scaled32 := make([]float32, NumFeatures)
	for i, v := range scaled64 {
		scaled32[i] = float32(v)
	}

	e.mu.Lock()
	window := e.nodeWindows[nodeID]
	window = append(window, scaled32)
	if len(window) > e.maxWindowLen {
		window = window[len(window)-e.maxWindowLen:]
	}
	e.nodeWindows[nodeID] = window
	// Make local copy of window for thread-safe inference outside lock
	windowCopy := make([][]float32, len(window))
	for i := range window {
		windowCopy[i] = append([]float32(nil), window[i]...)
	}
	e.mu.Unlock()

	return e.predictSequence(windowCopy)
}

// PredictSingle runs one-off inference on a single observation with sequence length 1.
func (e *InferenceEngine) PredictSingle(rawFeatures []float64) (*PredictionResult, error) {
	if len(rawFeatures) != NumFeatures {
		return nil, errors.New("raw features must contain exactly 6 features")
	}

	scaled64, err := e.scaler.Transform(rawFeatures)
	if err != nil {
		return nil, err
	}

	step := make([]float32, NumFeatures)
	for i, v := range scaled64 {
		step[i] = float32(v)
	}

	seq := [][]float32{step}
	return e.predictSequence(seq)
}

// PredictCustomWindow runs inference on an arbitrary sequence of historical raw feature readings.
func (e *InferenceEngine) PredictCustomWindow(rawWindow [][]float64) (*PredictionResult, error) {
	if len(rawWindow) == 0 {
		return nil, errors.New("raw window cannot be empty")
	}

	seq := make([][]float32, len(rawWindow))
	for t, raw := range rawWindow {
		scaled64, err := e.scaler.Transform(raw)
		if err != nil {
			return nil, err
		}
		step := make([]float32, NumFeatures)
		for i, v := range scaled64 {
			step[i] = float32(v)
		}
		seq[t] = step
	}

	return e.predictSequence(seq)
}

func (e *InferenceEngine) predictSequence(seq [][]float32) (*PredictionResult, error) {
	if e.model == nil {
		return nil, errors.New("model not loaded in inference engine")
	}

	deltaForecast, weights, err := e.model.ForwardSequence(seq)
	if err != nil {
		return nil, err
	}

	// Physics-Informed conversion: FS = Baseline (1.0) + DeltaFS
	fsImmediate := BaselineFactorOfSafety + deltaForecast[0]
	if fsImmediate < 0.1 {
		fsImmediate = 0.1
	} else if fsImmediate > 2.5 {
		fsImmediate = 2.5
	}
	fsImmediate = math.Round(fsImmediate*1000) / 1000

	// 24-step forecast trajectory
	forecastClean := make([]float64, len(deltaForecast))
	for i, deltaVal := range deltaForecast {
		fsVal := BaselineFactorOfSafety + deltaVal
		if fsVal < 0.1 {
			fsVal = 0.1
		} else if fsVal > 2.5 {
			fsVal = 2.5
		}
		forecastClean[i] = math.Round(fsVal*1000) / 1000
	}

	// Map explainable feature weights
	weightsMap := make(map[string]float64)
	for i, name := range FeatureNames {
		if i < len(weights) {
			weightsMap[name] = math.Round(weights[i]*10000) / 10000
		}
	}

	// Evaluate geotechnical physics constraints
	status, pBreach, failureMode := EvaluatePhysics(fsImmediate, weightsMap)

	return &PredictionResult{
		FactorOfSafety: fsImmediate,
		ForecastFS:     forecastClean,
		Status:         status,
		PBreach:        pBreach,
		FailureMode:    failureMode,
		FeatureWeights: weightsMap,
	}, nil
}

// EvaluatePhysics determines status, breach probability, and failure mode.
func EvaluatePhysics(fs float64, weights map[string]float64) (status string, pBreach float64, failureMode string) {
	// Status Classification
	if fs >= 1.0 {
		status = "SAFE"
	} else if fs >= 0.7 {
		status = "WARNING"
	} else {
		status = "CRITICAL"
	}

	// Breach probability via smooth logistic response anchored around critical slope failure (FS = 1.0)
	// P = 1 / (1 + exp(5.5 * (FS - 0.95)))
	exponent := 5.5 * (fs - 0.95)
	pBreach = 1.0 / (1.0 + math.Exp(exponent))
	pBreach = math.Round(pBreach*1000) / 1000
	if pBreach > 0.99 {
		pBreach = 0.99
	} else if pBreach < 0.01 {
		pBreach = 0.01
	}

	// Failure Mode attribution from explainable VSN importance weights
	seepageScore := weights["moisture"] + weights["sar_backscatter"]
	overtoppingScore := weights["rain_mm"] + weights["ndwi"]
	slumpScore := weights["tilt"] + weights["acoustic"]

	if seepageScore >= overtoppingScore && seepageScore >= slumpScore {
		failureMode = "Piping & Sand Boiling Seepage"
	} else if overtoppingScore >= seepageScore && overtoppingScore >= slumpScore {
		failureMode = "Crest Overtopping & Surface Erosion"
	} else {
		failureMode = "Toe Scour & Rotational Slope Slump"
	}

	return status, pBreach, failureMode
}
