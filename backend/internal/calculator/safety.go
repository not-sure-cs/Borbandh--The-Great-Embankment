package calculator

import (
	"math"
)

const (
	ThresholdSafe     = 1.0
	ThresholdCritical = 0.7
)

// CalculateFactorOfSafety implements the machine learning regression equation:
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
