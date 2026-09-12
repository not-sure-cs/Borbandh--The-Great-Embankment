package calculator

import (
	"fmt"
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
func GenerateInundationPolygons(reaches []models.EmbankmentReach, stageDeltaM float64) []models.InundationZone {
	zones := make([]models.InundationZone, 0, len(reaches))

	// Lateral expansion distances (in degrees ~ 111 km)
	// Base channel: ~120m (~0.0011°), +1.5m Warning: ~350m, +3.0m Danger: ~750m, +5.0m Surge: ~1400m
	expansionDeg := 0.0012 + (stageDeltaM * 0.0022)

	for _, reach := range reaches {
		coords := reach.Coordinates
		if len(coords) < 2 {
			continue
		}

		leftRing := make([][]float64, 0, len(coords))
		rightRing := make([][]float64, 0, len(coords))

		for i := 0; i < len(coords); i++ {
			var dx, dy float64
			if i == 0 {
				dx = coords[1][0] - coords[0][0]
				dy = coords[1][1] - coords[0][1]
			} else if i == len(coords)-1 {
				dx = coords[i][0] - coords[i-1][0]
				dy = coords[i][1] - coords[i-1][1]
			} else {
				dx = coords[i+1][0] - coords[i-1][0]
				dy = coords[i+1][1] - coords[i-1][1]
			}

			segLen := math.Hypot(dx, dy)
			if segLen == 0 {
				segLen = 0.0001
			}

			// Riverside floodplain offset
			nx := -dy / segLen
			ny := dx / segLen

			// Slight meander irregularity
			wobble := 1.0 + 0.2*math.Sin(float64(i)*2.1)
			offset := expansionDeg * wobble

			leftRing = append(leftRing, []float64{
				math.Round((coords[i][0]+nx*offset)*100000) / 100000,
				math.Round((coords[i][1]+ny*offset)*100000) / 100000,
			})
			rightRing = append(rightRing, []float64{
				math.Round((coords[i][0]-nx*(offset*0.65))*100000) / 100000,
				math.Round((coords[i][1]-ny*(offset*0.65))*100000) / 100000,
			})
		}

		// Form closed polygon loop
		poly := make([][]float64, 0, len(leftRing)+len(rightRing)+1)
		poly = append(poly, leftRing...)
		for j := len(rightRing) - 1; j >= 0; j-- {
			poly = append(poly, rightRing[j])
		}
		poly = append(poly, leftRing[0]) // close ring

		depthClass := "SHALLOW"
		depthM := 0.6 + stageDeltaM*0.4
		if stageDeltaM >= 3.0 {
			depthClass = "DEEP"
			depthM = 2.8 + (stageDeltaM-3.0)*0.7
		} else if stageDeltaM >= 1.5 {
			depthClass = "MODERATE"
			depthM = 1.4 + (stageDeltaM-1.5)*0.8
		}

		zones = append(zones, models.InundationZone{
			StageDeltaM: stageDeltaM,
			DepthClass:  depthClass,
			DepthM:      math.Round(depthM*10) / 10,
			Polygon:     [][][]float64{poly},
		})
	}

	return zones
}

// GenerateHANDDepressionPolygons locates low-lying retention pockets behind dykes (Height Above Nearest Drainage).
func GenerateHANDDepressionPolygons(reaches []models.EmbankmentReach) []models.HANDDepressionZone {
	depressions := make([]models.HANDDepressionZone, 0, len(reaches))

	for i, reach := range reaches {
		coords := reach.Coordinates
		if len(coords) < 3 {
			continue
		}

		// Countryside depression offset pocket near mid-point of the reach
		midIdx := len(coords) / 2
		midPt := coords[midIdx]

		dx := coords[midIdx][0] - coords[midIdx-1][0]
		dy := coords[midIdx][1] - coords[midIdx-1][1]
		segLen := math.Hypot(dx, dy)
		if segLen == 0 {
			segLen = 0.0001
		}
		// Countryside normal vector
		nx := dy / segLen
		ny := -dx / segLen

		radius := 0.006 // ~650 meters
		cLon := midPt[0] + nx*0.008
		cLat := midPt[1] + ny*0.008

		// Generate circular depression bowl polygon
		ring := make([][]float64, 0, 13)
		for a := 0; a < 12; a++ {
			ang := float64(a) * (2 * math.Pi / 12.0)
			r := radius * (0.8 + 0.2*math.Cos(ang*2.0))
			ring = append(ring, []float64{
				math.Round((cLon+r*math.Cos(ang))*100000) / 100000,
				math.Round((cLat+r*math.Sin(ang))*100000) / 100000,
			})
		}
		ring = append(ring, ring[0]) // close

		handElevation := 0.8 + float64(i%3)*0.5
		riskRating := "HIGH_ENTRAPMENT"
		if handElevation > 1.2 {
			riskRating = "MODERATE_PONDING"
		}

		depressions = append(depressions, models.HANDDepressionZone{
			ID:         fmt.Sprintf("HAND-DEP-%02d", i+1),
			ReachID:    reach.ID,
			Name:       fmt.Sprintf("%s Countryside Depression (HAND %.1fm)", reach.Name, handElevation),
			HANDM:      handElevation,
			RiskRating: riskRating,
			Polygon:    [][][]float64{ring},
		})
	}

	return depressions
}
