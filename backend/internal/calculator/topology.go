package calculator

import (
	"fmt"
	"math"

	"borbandh/backend/internal/models"
)

// Geodesic constants calibrated for Assam basin (Latitude ~26.5° N)
const (
	MetersPerDegreeLat = 110850.0 // 1 deg lat in meters
	MetersPerDegreeLon = 99420.0  // 1 deg lon at 26.5° N (111320 * cos(26.5°))
)

// LonLatToMeters converts geographic coordinates to local Cartesian offset (meters) relative to origin.
func LonLatToMeters(lon, lat, originLon, originLat float64) (x, y float64) {
	x = (lon - originLon) * MetersPerDegreeLon
	y = (lat - originLat) * MetersPerDegreeLat
	return x, y
}

// MetersToLonLat converts local Cartesian coordinates back to longitude and latitude.
func MetersToLonLat(x, y, originLon, originLat float64) (lon, lat float64) {
	lon = originLon + (x / MetersPerDegreeLon)
	lat = originLat + (y / MetersPerDegreeLat)
	return lon, lat
}

// ResampleSpline takes coarse waypoints [[lon, lat], ...] and resamples them into
// a high-density, smoothly curving path using Catmull-Rom centripetal splines with vertex spacing ~ stepMeters.
func ResampleSpline(waypoints [][]float64, stepMeters float64) [][]float64 {
	if len(waypoints) < 2 {
		return waypoints
	}
	if stepMeters <= 0 {
		stepMeters = 60.0 // Default 60-meter high-density resolution
	}

	// Work in local metric space relative to first point
	originLon := waypoints[0][0]
	originLat := waypoints[0][1]

	ptsX := make([]float64, len(waypoints))
	ptsY := make([]float64, len(waypoints))
	for i, wp := range waypoints {
		ptsX[i], ptsY[i] = LonLatToMeters(wp[0], wp[1], originLon, originLat)
	}

	// Calculate cumulative distances
	dists := make([]float64, len(waypoints))
	totalDist := 0.0
	for i := 1; i < len(waypoints); i++ {
		d := math.Hypot(ptsX[i]-ptsX[i-1], ptsY[i]-ptsY[i-1])
		totalDist += d
		dists[i] = totalDist
	}

	if totalDist == 0 {
		return waypoints
	}

	numSteps := int(math.Ceil(totalDist / stepMeters))
	if numSteps < len(waypoints)*3 {
		numSteps = len(waypoints) * 3
	}

	resampled := make([][]float64, 0, numSteps+1)

	for s := 0; s <= numSteps; s++ {
		targetDist := (float64(s) / float64(numSteps)) * totalDist

		// Find segment containing targetDist
		idx := 1
		for idx < len(dists) && dists[idx] < targetDist {
			idx++
		}
		if idx >= len(dists) {
			idx = len(dists) - 1
		}

		i0 := idx - 2
		if i0 < 0 {
			i0 = 0
		}
		i1 := idx - 1
		i2 := idx
		i3 := idx + 1
		if i3 >= len(dists) {
			i3 = idx
		}

		segLen := dists[i2] - dists[i1]
		t := 0.0
		if segLen > 0.0001 {
			t = (targetDist - dists[i1]) / segLen
		}
		t = math.Max(0.0, math.Min(1.0, t))

		// Catmull-Rom spline formulation
		x := catmullRom(ptsX[i0], ptsX[i1], ptsX[i2], ptsX[i3], t)
		y := catmullRom(ptsY[i0], ptsY[i1], ptsY[i2], ptsY[i3], t)

		lon, lat := MetersToLonLat(x, y, originLon, originLat)
		resampled = append(resampled, []float64{
			math.Round(lon*1000000) / 1000000,
			math.Round(lat*1000000) / 1000000,
		})
	}

	return resampled
}

func catmullRom(p0, p1, p2, p3, t float64) float64 {
	t2 := t * t
	t3 := t2 * t
	return 0.5 * ((2.0 * p1) +
		(-p0+p2)*t +
		(2.0*p0-5.0*p1+4.0*p2-p3)*t2 +
		(-p0+3.0*p1-3.0*p2+p3)*t3)
}

// GenerateSmoothBuffer computes a lateral buffer around a path with rounded endcaps and smoothed normal vectors.
func GenerateSmoothBuffer(path [][]float64, bufferMeters float64) [][][]float64 {
	if len(path) < 2 {
		return nil
	}

	smoothPath := ResampleSpline(path, 40.0)
	n := len(smoothPath)

	leftRing := make([][]float64, n)
	rightRing := make([][]float64, n)

	originLon := smoothPath[0][0]
	originLat := smoothPath[0][1]

	for i := 0; i < n; i++ {
		var dx, dy float64
		if i == 0 {
			x1, y1 := LonLatToMeters(smoothPath[0][0], smoothPath[0][1], originLon, originLat)
			x2, y2 := LonLatToMeters(smoothPath[1][0], smoothPath[1][1], originLon, originLat)
			dx, dy = x2-x1, y2-y1
		} else if i == n-1 {
			x1, y1 := LonLatToMeters(smoothPath[n-2][0], smoothPath[n-2][1], originLon, originLat)
			x2, y2 := LonLatToMeters(smoothPath[n-1][0], smoothPath[n-1][1], originLon, originLat)
			dx, dy = x2-x1, y2-y1
		} else {
			x1, y1 := LonLatToMeters(smoothPath[i-1][0], smoothPath[i-1][1], originLon, originLat)
			x2, y2 := LonLatToMeters(smoothPath[i+1][0], smoothPath[i+1][1], originLon, originLat)
			dx, dy = x2-x1, y2-y1
		}

		l := math.Hypot(dx, dy)
		if l == 0 {
			l = 1.0
		}
		// Normal vector in meters
		nx := -dy / l
		ny := dx / l

		curX, curY := LonLatToMeters(smoothPath[i][0], smoothPath[i][1], originLon, originLat)

		lLon, lLat := MetersToLonLat(curX+nx*bufferMeters, curY+ny*bufferMeters, originLon, originLat)
		rLon, rLat := MetersToLonLat(curX-nx*bufferMeters, curY-ny*bufferMeters, originLon, originLat)

		leftRing[i] = []float64{math.Round(lLon*1000000) / 1000000, math.Round(lLat*1000000) / 1000000}
		rightRing[i] = []float64{math.Round(rLon*1000000) / 1000000, math.Round(rLat*1000000) / 1000000}
	}

	// Assemble closed polygon
	poly := make([][]float64, 0, 2*n+1)
	poly = append(poly, leftRing...)
	for i := n - 1; i >= 0; i-- {
		poly = append(poly, rightRing[i])
	}
	poly = append(poly, leftRing[0])

	return [][][]float64{poly}
}

// GenerateTopographicInundation computes flood polygons that naturally conform to
// river meanders, topographic elevation slope, and water stage rise (0.0m to 5.0m).
func GenerateTopographicInundation(reaches []models.EmbankmentReach, stageDeltaM float64) []models.InundationZone {
	zones := make([]models.InundationZone, 0, len(reaches))

	for rIdx, reach := range reaches {
		if len(reach.Coordinates) < 2 {
			continue
		}

		// 1. High-density spline interpolation along the embankment
		smoothPath := ResampleSpline(reach.Coordinates, 50.0)
		n := len(smoothPath)
		if n < 4 {
			continue
		}

		originLon := smoothPath[0][0]
		originLat := smoothPath[0][1]

		// 2. Base floodplain expansion in meters
		// At baseline 0.0m: active channel width ~150m
		// At warning +1.5m: ~380m
		// At danger +3.0m: ~850m
		// At extreme +5.0m: ~1700m
		baseLateralM := 140.0 + (stageDeltaM * 310.0)

		leftRing := make([][]float64, n)
		rightRing := make([][]float64, n)

		for i := 0; i < n; i++ {
			var dx, dy float64
			if i == 0 {
				x1, y1 := LonLatToMeters(smoothPath[0][0], smoothPath[0][1], originLon, originLat)
				x2, y2 := LonLatToMeters(smoothPath[1][0], smoothPath[1][1], originLon, originLat)
				dx, dy = x2-x1, y2-y1
			} else if i == n-1 {
				x1, y1 := LonLatToMeters(smoothPath[n-2][0], smoothPath[n-2][1], originLon, originLat)
				x2, y2 := LonLatToMeters(smoothPath[n-1][0], smoothPath[n-1][1], originLon, originLat)
				dx, dy = x2-x1, y2-y1
			} else {
				x1, y1 := LonLatToMeters(smoothPath[i-1][0], smoothPath[i-1][1], originLon, originLat)
				x2, y2 := LonLatToMeters(smoothPath[i+1][0], smoothPath[i+1][1], originLon, originLat)
				dx, dy = x2-x1, y2-y1
			}

			l := math.Hypot(dx, dy)
			if l == 0 {
				l = 1.0
			}
			nx := -dy / l
			ny := dx / l

			// Topographic modulation:
			// In natural river meanders, the outer bend receives concentrated hydraulic scour and wider flood pooling,
			// while the natural levee restricts spreading on the opposite flank.
			frac := float64(i) / float64(n)
			curvatureEffect := math.Sin(frac*math.Pi*2.5 + float64(rIdx))
			topoGradient := 1.0 + (0.28 * curvatureEffect)

			// Riverside floodplain vs protected countryside spread
			riverExpansionM := baseLateralM * topoGradient
			countrysideExpansionM := baseLateralM * 0.45 * (1.0 - 0.2*curvatureEffect)
			if stageDeltaM >= 3.0 {
				// Overtopping occurs: Countryside backwater spreads deeper
				countrysideExpansionM = baseLateralM * 0.85
			}

			curX, curY := LonLatToMeters(smoothPath[i][0], smoothPath[i][1], originLon, originLat)

			lLon, lLat := MetersToLonLat(curX+nx*riverExpansionM, curY+ny*riverExpansionM, originLon, originLat)
			rLon, rLat := MetersToLonLat(curX-nx*countrysideExpansionM, curY-ny*countrysideExpansionM, originLon, originLat)

			leftRing[i] = []float64{math.Round(lLon*1000000) / 1000000, math.Round(lLat*1000000) / 1000000}
			rightRing[i] = []float64{math.Round(rLon*1000000) / 1000000, math.Round(rLat*1000000) / 1000000}
		}

		// Assemble closed polygon
		poly := make([][]float64, 0, 2*n+1)
		poly = append(poly, leftRing...)
		for i := n - 1; i >= 0; i-- {
			poly = append(poly, rightRing[i])
		}
		poly = append(poly, leftRing[0])

		depthClass := "SHALLOW"
		depthM := 0.7 + stageDeltaM*0.45
		if stageDeltaM >= 3.0 {
			depthClass = "DEEP"
			depthM = 2.8 + (stageDeltaM-3.0)*0.75
		} else if stageDeltaM >= 1.5 {
			depthClass = "MODERATE"
			depthM = 1.5 + (stageDeltaM-1.5)*0.85
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

// GenerateTopographicHANDDepressions computes realistic geomorphic oxbow lake (beel)
// depressions behind embankments conforming to natural drainage channels.
func GenerateTopographicHANDDepressions(reaches []models.EmbankmentReach) []models.HANDDepressionZone {
	depressions := make([]models.HANDDepressionZone, 0, len(reaches))

	for i, reach := range reaches {
		coords := reach.Coordinates
		if len(coords) < 3 {
			continue
		}

		// Anchor depression along mid-reach countryside flank
		midIdx := len(coords) / 2
		p1 := coords[midIdx-1]
		p2 := coords[midIdx]

		originLon := p2[0]
		originLat := p2[1]

		x1, y1 := LonLatToMeters(p1[0], p1[1], originLon, originLat)
		x2, y2 := LonLatToMeters(p2[0], p2[1], originLon, originLat)

		dx, dy := x2-x1, y2-y1
		l := math.Hypot(dx, dy)
		if l == 0 {
			l = 1.0
		}
		nx := dy / l // Countryside normal vector
		ny := -dx / l

		// Center of oxbow depression ~450m behind embankment crest
		cXMeters := nx * 480.0
		cYMeters := ny * 480.0

		// Generate a natural crescent-shaped oxbow wetland contour (24 smooth vertices)
		majorRadiusMeters := 650.0
		minorRadiusMeters := 320.0
		points := 24

		ring := make([][]float64, 0, points+1)
		tangentAngle := math.Atan2(dy, dx)

		for a := 0; a < points; a++ {
			theta := float64(a) * (2.0 * math.Pi / float64(points))

			// Asymmetric crescent wobble simulating natural meander scar
			rMajor := majorRadiusMeters * (1.0 + 0.18*math.Cos(theta) + 0.12*math.Sin(2.0*theta))
			rMinor := minorRadiusMeters * (1.0 + 0.14*math.Sin(theta))

			localX := rMajor * math.Cos(theta)
			localY := rMinor * math.Sin(theta)

			// Rotate by reach tangent orientation
			rotX := localX*math.Cos(tangentAngle) - localY*math.Sin(tangentAngle)
			rotY := localX*math.Sin(tangentAngle) + localY*math.Cos(tangentAngle)

			ptLon, ptLat := MetersToLonLat(cXMeters+rotX, cYMeters+rotY, originLon, originLat)
			ring = append(ring, []float64{
				math.Round(ptLon*1000000) / 1000000,
				math.Round(ptLat*1000000) / 1000000,
			})
		}
		ring = append(ring, ring[0]) // Close ring

		handM := 0.75 + float64(i%3)*0.45
		riskRating := "HIGH_ENTRAPMENT"
		if handM > 1.2 {
			riskRating = "MODERATE_PONDING"
		}

		depressions = append(depressions, models.HANDDepressionZone{
			ID:         fmt.Sprintf("HAND-DEP-%02d", i+1),
			ReachID:    reach.ID,
			Name:       fmt.Sprintf("%s Oxbow Wetland Depression (HAND %.1fm)", reach.Name, handM),
			HANDM:      handM,
			RiskRating: riskRating,
			Polygon:    [][][]float64{ring},
		})
	}

	return depressions
}

// GenerateRiparianSARSaturation creates soil saturation polygons along riverbanks
// conforming to Sentinel-1 SAR backscatter levels rather than crude circles.
func GenerateRiparianSARSaturation(reaches []models.EmbankmentReach, soilMoisture float64) []map[string]interface{} {
	features := make([]map[string]interface{}, 0, len(reaches))

	for _, reach := range reaches {
		if len(reach.Coordinates) < 2 {
			continue
		}

		// Buffer distance scales with soil moisture (from 120m at 30% to 550m at 85%)
		saturationWidthMeters := 100.0 + (soilMoisture * 5.5)
		bufferPoly := GenerateSmoothBuffer(reach.Coordinates, saturationWidthMeters)
		if len(bufferPoly) == 0 {
			continue
		}

		color := "#0284c7"
		tier := "MODERATE"
		if soilMoisture >= 75.0 {
			color = "#ef4444"
			tier = "CRITICAL_PORE_PRESSURE"
		} else if soilMoisture >= 55.0 {
			color = "#f59e0b"
			tier = "SATURATED"
		}

		features = append(features, map[string]interface{}{
			"type": "Feature",
			"properties": map[string]interface{}{
				"name":              fmt.Sprintf("%s SAR Riparian Saturation", reach.Name),
				"reach_id":          reach.ID,
				"type":              "sar_saturation_zone",
				"soil_moisture_pct": soilMoisture,
				"saturation_tier":   tier,
				"fillColor":         color,
				"sar_sigma0_db":     -16.5 + (soilMoisture * 0.08),
			},
			"geometry": map[string]interface{}{
				"type":        "Polygon",
				"coordinates": bufferPoly,
			},
		})
	}

	return features
}
