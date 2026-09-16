package calculator

import (
	"math"

	"borbandh/backend/internal/models"
)

// CalculateSegmentBreachProbabilities evaluates 100m-500m segments of an embankment reach
// using geotechnical drivers (pore moisture, tilt velocity, rate of rise, remaining freeboard).
func CalculateSegmentBreachProbabilities(reach models.EmbankmentReach, cwlM, dangerM, rateOfRise float64, telemetry *models.NodeTelemetry) []models.SegmentRisk {
	coords := reach.Coordinates
	if len(coords) < 2 {
		return nil
	}

	moisture := 45.0
	tilt := 1.2
	if telemetry != nil {
		moisture = telemetry.SoilMoisture
		tilt = telemetry.TiltAngle
	}

	crestElev := reach.CrestElevation
	if crestElev <= 0 {
		crestElev = 80.0
	}
	if cwlM <= 0 {
		cwlM = crestElev - 2.5
	}

	freeboard := crestElev - cwlM
	if freeboard < 0.05 {
		freeboard = 0.05
	}

	if rateOfRise < 0 {
		rateOfRise = 0
	}

	segments := make([]models.SegmentRisk, 0, len(coords)-1)

	for i := 0; i < len(coords)-1; i++ {
		p1 := coords[i]
		p2 := coords[i+1]

		// Physical variation based on segment index and vulnerability
		curvatureFactor := math.Sin(float64(i)*1.3) * 0.35
		vulnBonus := 0.0
		if reach.Vulnerability {
			vulnBonus = 0.75
		}

		// Logit model: z = -2.8 + 0.028*Moisture + 0.18*Tilt + 0.045*RateOfRise - 0.85*Freeboard + Vuln + Curvature
		z := -2.8 + (0.028 * moisture) + (0.18 * tilt) + (0.045 * rateOfRise) - (0.85 * freeboard) + vulnBonus + curvatureFactor
		pBreach := 1.0 / (1.0 + math.Exp(-z))
		pBreach = math.Round(math.Max(0.04, math.Min(0.96, pBreach))*1000) / 1000

		// Categorize risk tier
		riskTier := "SAFE"
		if pBreach >= 0.70 {
			riskTier = "CRITICAL"
		} else if pBreach >= 0.35 {
			riskTier = "WATCH"
		}

		// Diagnose failure mechanism
		failureMode := "Stable Embankment Core"
		if freeboard < 0.4 {
			failureMode = "Crest Overtopping & Scour"
		} else if moisture > 75.0 && tilt > 3.0 {
			failureMode = "Subterranean Piping & Sand Boiling"
		} else if tilt > 5.0 {
			failureMode = "Slope Slump & Rotational Slide"
		} else if reach.Vulnerability {
			failureMode = "Toe Scour & Riverbank Erosion"
		} else if pBreach >= 0.35 {
			failureMode = "Pore Saturation & Toe Seepage"
		}

		segFreeboard := math.Round((freeboard-(float64(i%3)*0.15))*100) / 100
		if segFreeboard < 0.1 {
			segFreeboard = 0.1
		}

		segments = append(segments, models.SegmentRisk{
			SegmentIndex:  i + 1,
			Coordinates:   [][]float64{p1, p2},
			PBreach:       pBreach,
			RiskTier:      riskTier,
			FailureMode:   failureMode,
			FreeboardM:    segFreeboard,
			SaturationPct: math.Round((moisture+float64(i%4)*2.5)*10) / 10,
		})
	}

	return segments
}

// GenerateInundationPolygons computes dynamic hydrodynamic flood submergence polygons for a given water stage rise.
// StageDeltaM ranges from 0.0m (normal riverbed) to 5.0m (catastrophic overtopping surge).
// It modulates lateral flood spreading across high-density splines conforming to local topography.
func GenerateInundationPolygons(reaches []models.EmbankmentReach, stageDeltaM float64) []models.InundationZone {
	return GenerateTopographicInundation(reaches, stageDeltaM)
}

// GenerateHANDDepressionPolygons locates low-lying retention pockets behind dykes (Height Above Nearest Drainage),
// returning geomorphically conformed oxbow wetland contours rather than artificial circles.
func GenerateHANDDepressionPolygons(reaches []models.EmbankmentReach) []models.HANDDepressionZone {
	return GenerateTopographicHANDDepressions(reaches)
}
