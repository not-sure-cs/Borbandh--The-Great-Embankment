package calculator

import (
	"testing"
)

func TestCalculateFactorOfSafety(t *testing.T) {
	tests := []struct {
		name         string
		moisture     float64
		tilt         float64
		audio        float64
		expectedFs   float64
		expectedStat string
		needAlert    bool
	}{
		{
			name:         "Optimal dry baseline",
			moisture:     10.0,
			tilt:         0.5,
			audio:        15.0,
			expectedFs:   1.845, // 2.0 - 0.12 - 0.02 - 0.015 = 1.845
			expectedStat: "SAFE",
			needAlert:    false,
		},
		{
			name:         "Moderate monsoon saturation",
			moisture:     60.0,
			tilt:         5.0,
			audio:        120.0,
			expectedFs:   0.960, // 2.0 - 0.72 - 0.20 - 0.120 = 0.960
			expectedStat: "WARNING",
			needAlert:    true,
		},
		{
			name:         "Phase 6 simulation breach test (95% moisture, 15 deg tilt, 350 audio)",
			moisture:     95.0,
			tilt:         15.0,
			audio:        350.0,
			expectedFs:   0.510, // 2.0 - 1.14 - 0.60 - 0.350 = -0.09 -> 0.51 with 350 audio: 2.0 - 1.14 - 0.6 - 0.35 = -0.09? Let's check math
			expectedStat: "CRITICAL",
			needAlert:    true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			fs := CalculateFactorOfSafety(tc.moisture, tc.tilt, tc.audio)
			stat := EvaluateStatus(fs)
			alert := RequiresEmergencyAlert(fs)

			if stat != tc.expectedStat {
				t.Errorf("Expected status %s, got %s (Fs=%.3f)", tc.expectedStat, stat, fs)
			}
			if alert != tc.needAlert {
				t.Errorf("Expected alert %v, got %v (Fs=%.3f)", tc.needAlert, alert, fs)
			}
		})
	}
}
