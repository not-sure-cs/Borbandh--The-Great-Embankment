package ml

import (
	"errors"
	"math"
)

// Feature indices for clarity
const (
	FeatureMoisture       = 0
	FeatureTilt           = 1
	FeatureAcoustic       = 2
	FeatureRainMM         = 3
	FeatureNDWI           = 4
	FeatureSARBackscatter = 5
	NumFeatures           = 6
)

// FeatureNames maps the 6 feature indices to human-readable names.
var FeatureNames = [NumFeatures]string{
	"moisture",
	"tilt",
	"acoustic",
	"rain_mm",
	"ndwi",
	"sar_backscatter",
}

// RobustScaler implements Scikit-learn's RobustScaler:
// x_scaled = (x - center) / scale
type RobustScaler struct {
	Center []float64
	Scale  []float64
}

// NewEmbankmentRobustScaler returns the fitted scaler from robust_scaler_embankment_tft.pkl.
// Parameters were fitted on benchmark_fea_embankment_telemetry.csv:
// center_: [31.785, 0.0, 85.8, 1.075, 0.3212, -13.33]
// scale_:  [2.56, 27.27, 28.525, 2.3875, 0.03485, 0.7125]
func NewEmbankmentRobustScaler() *RobustScaler {
	return &RobustScaler{
		Center: []float64{31.785, 0.0, 85.8, 1.075, 0.3212, -13.33},
		Scale:  []float64{2.56, 27.27, 28.525, 2.3875, 0.03485, 0.7125},
	}
}

// Transform scales a 6-element feature vector.
func (s *RobustScaler) Transform(features []float64) ([]float64, error) {
	if len(features) != NumFeatures {
		return nil, errors.New("invalid feature vector length; expected 6")
	}

	scaled := make([]float64, NumFeatures)
	for i := 0; i < NumFeatures; i++ {
		scale := s.Scale[i]
		if math.Abs(scale) < 1e-12 {
			scale = 1.0
		}
		val := (features[i] - s.Center[i]) / scale
		// Clamp numerical outliers to [-10, 10] range for neural network stability
		if val > 10.0 {
			val = 10.0
		} else if val < -10.0 {
			val = -10.0
		}
		scaled[i] = val
	}
	return scaled, nil
}

// InverseTransform maps scaled values back to original units.
func (s *RobustScaler) InverseTransform(scaled []float64) ([]float64, error) {
	if len(scaled) != NumFeatures {
		return nil, errors.New("invalid scaled vector length; expected 6")
	}

	orig := make([]float64, NumFeatures)
	for i := 0; i < NumFeatures; i++ {
		orig[i] = scaled[i]*s.Scale[i] + s.Center[i]
	}
	return orig, nil
}
