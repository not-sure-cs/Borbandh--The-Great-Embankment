package ingestion

import (
	"errors"
	"math"
	"time"

	"borbandh/backend/internal/models"
	"borbandh/backend/internal/store"
)

// IngestionEngine coordinates data ingestion and processing for structural, satellite, terrain, and hydraulic inputs.
type IngestionEngine struct {
	store *store.Store
}

// NewIngestionEngine creates a new processing pipeline bound to the in-memory store.
func NewIngestionEngine(st *store.Store) *IngestionEngine {
	return &IngestionEngine{store: st}
}

// --- 1. Structural & Spatial Ingestion Processors ---

// Generate50mBuffer generates a closed 50-meter lateral spatial buffer polygon around a centerline polyline.
// Coordinates are in [longitude, latitude] pairs.
func Generate50mBuffer(centerline [][]float64) [][][]float64 {
	if len(centerline) < 2 {
		return [][][]float64{}
	}

	// Approximate conversion at Assam latitude (~26.5° N):
	// 1° Latitude  ≈ 110,850 meters -> 50m ≈ 0.000451°
	// 1° Longitude ≈ 111,320 * cos(26.5°) ≈ 99,620 meters -> 50m ≈ 0.000502°
	const latOffset50m = 0.000451
	const lonOffset50m = 0.000502

	leftSide := make([][]float64, 0, len(centerline))
	rightSide := make([][]float64, 0, len(centerline))

	for i := 0; i < len(centerline); i++ {
		var dx, dy float64
		if i == 0 {
			dx = centerline[1][0] - centerline[0][0]
			dy = centerline[1][1] - centerline[0][1]
		} else if i == len(centerline)-1 {
			dx = centerline[i][0] - centerline[i-1][0]
			dy = centerline[i][1] - centerline[i-1][1]
		} else {
			dx = centerline[i+1][0] - centerline[i-1][0]
			dy = centerline[i+1][1] - centerline[i-1][1]
		}

		lenSeg := math.Hypot(dx, dy)
		if lenSeg == 0 {
			lenSeg = 0.00001
		}

		// Perpendicular normal vector: (-dy, dx)
		nx := -dy / lenSeg
		ny := dx / lenSeg

		leftSide = append(leftSide, []float64{
			centerline[i][0] + nx*lonOffset50m,
			centerline[i][1] + ny*latOffset50m,
		})

		rightSide = append(rightSide, []float64{
			centerline[i][0] - nx*lonOffset50m,
			centerline[i][1] - ny*latOffset50m,
		})
	}

	// Construct closed polygon loop: leftSide forward, then rightSide backward, closing at start
	polygonRing := make([][]float64, 0, len(leftSide)+len(rightSide)+1)
	polygonRing = append(polygonRing, leftSide...)

	for i := len(rightSide) - 1; i >= 0; i-- {
		polygonRing = append(polygonRing, rightSide[i])
	}

	// Close polygon
	polygonRing = append(polygonRing, []float64{leftSide[0][0], leftSide[0][1]})

	return [][][]float64{polygonRing}
}

// CalculateHaversineDistanceKm calculates the great-circle distance between two GPS coordinates in kilometers.
func CalculateHaversineDistanceKm(lat1, lon1, lat2, lon2 float64) float64 {
	const earthRadiusKm = 6371.0
	dLat := (lat2 - lat1) * (math.Pi / 180.0)
	dLon := (lon2 - lon1) * (math.Pi / 180.0)

	rLat1 := lat1 * (math.Pi / 180.0)
	rLat2 := lat2 * (math.Pi / 180.0)

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Sin(dLon/2)*math.Sin(dLon/2)*math.Cos(rLat1)*math.Cos(rLat2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthRadiusKm * c
}

// CalculatePolylineLengthKm computes total length of a coordinate sequence in kilometers.
func CalculatePolylineLengthKm(coords [][]float64) float64 {
	if len(coords) < 2 {
		return 0.0
	}
	var total float64
	for i := 0; i < len(coords)-1; i++ {
		dist := CalculateHaversineDistanceKm(coords[i][1], coords[i][0], coords[i+1][1], coords[i+1][0])
		total += dist
	}
	return total
}

// ProcessAndIngestReach validates structural properties, computes length if missing, generates 50m buffers, and persists.
func (e *IngestionEngine) ProcessAndIngestReach(reach models.EmbankmentReach) (models.EmbankmentReach, error) {
	if reach.ID == "" {
		return reach, errors.New("reach ID cannot be empty")
	}
	if len(reach.Coordinates) < 2 {
		return reach, errors.New("reach must contain at least 2 coordinate points")
	}

	if reach.LengthKm <= 0 {
		reach.LengthKm = math.Round(CalculatePolylineLengthKm(reach.Coordinates)*10) / 10
	}

	if len(reach.BufferPolygon) == 0 {
		reach.BufferPolygon = Generate50mBuffer(reach.Coordinates)
	}

	if reach.LastSurveyDate == "" {
		reach.LastSurveyDate = time.Now().Format("2006-01-02")
	}

	e.store.IngestReach(reach)
	return reach, nil
}

// ProcessAndIngestBreach validates and associates a historical or field breach record.
func (e *IngestionEngine) ProcessAndIngestBreach(breach models.BreachRecord) (models.BreachRecord, error) {
	if breach.ID == "" {
		return breach, errors.New("breach ID cannot be empty")
	}
	if breach.Latitude == 0 || breach.Longitude == 0 {
		return breach, errors.New("breach coordinates are required")
	}

	// Auto-associate with nearest reach if ReachID is empty
	if breach.ReachID == "" {
		reaches := e.store.GetReaches()
		minDist := math.MaxFloat64
		nearestID := ""
		for _, r := range reaches {
			for _, coord := range r.Coordinates {
				dist := CalculateHaversineDistanceKm(breach.Latitude, breach.Longitude, coord[1], coord[0])
				if dist < minDist {
					minDist = dist
					nearestID = r.ID
				}
			}
		}
		if nearestID != "" && minDist < 25.0 {
			breach.ReachID = nearestID
		}
	}

	if breach.BreachDate == "" {
		breach.BreachDate = time.Now().Format("2006-01-02")
	}

	e.store.IngestBreach(breach)
	return breach, nil
}

// --- 2. Satellite SAR & Optical Ingestion Processors ---

// ProcessSARBackscatter evaluates Sentinel-1 C-band σ0 (dB).
// Open water specular reflection occurs at σ0 < -14.0 dB.
// Saturation score ranges from 0.0 (dry, >= -6 dB) to 1.0 (fully submerged, <= -24 dB).
func ProcessSARBackscatter(sigma0VV float64) (waterDetected bool, saturationScore float64) {
	waterDetected = sigma0VV < -14.0

	// Normalize between -24.0 dB (submerged) and -6.0 dB (dry soil)
	if sigma0VV <= -24.0 {
		saturationScore = 1.0
	} else if sigma0VV >= -6.0 {
		saturationScore = 0.0
	} else {
		saturationScore = (-6.0 - sigma0VV) / (-6.0 - (-24.0))
	}
	return waterDetected, math.Round(saturationScore*1000) / 1000
}

// ProcessOpticalIndices calculates MNDWI and NDVI from Sentinel-2 MSI surface reflectance.
// Green (B03), Red (B04), NIR (B08), SWIR (B11).
func ProcessOpticalIndices(green, red, nir, swir float64) (mndwi float64, ndvi float64) {
	// MNDWI = (Green - SWIR) / (Green + SWIR)
	denomMNDWI := green + swir
	if denomMNDWI > 0.0001 {
		mndwi = (green - swir) / denomMNDWI
	} else {
		mndwi = -1.0
	}

	// NDVI = (NIR - Red) / (NIR + Red)
	denomNDVI := nir + red
	if denomNDVI > 0.0001 {
		ndvi = (nir - red) / denomNDVI
	} else {
		ndvi = 0.0
	}

	mndwi = math.Max(-1.0, math.Min(1.0, math.Round(mndwi*1000)/1000))
	ndvi = math.Max(-1.0, math.Min(1.0, math.Round(ndvi*1000)/1000))
	return mndwi, ndvi
}

// --- 3. Hydraulic Driver Processors (CWC Gauges) ---

// ProcessHydraulicDriver computes freeboard, rate of rise (cm/hr), and hydraulic warning state.
func ProcessHydraulicDriver(crestElevM, cwlM, dangerLevelM, prevCWLM, deltaHours float64) (freeboard float64, rateOfRiseCmH float64, warning bool) {
	freeboard = math.Round((crestElevM-cwlM)*100) / 100

	if deltaHours > 0 {
		rateOfRiseCmH = math.Round(((cwlM-prevCWLM)*100.0/deltaHours)*10) / 10
	}

	// Warning triggers: Freeboard < 0.5m, CWL exceeding Danger Level, or surge rate > 12 cm/hr
	warning = (freeboard < 0.5) || (cwlM >= dangerLevelM) || (rateOfRiseCmH > 12.0)
	return freeboard, rateOfRiseCmH, warning
}

// --- 4. Precipitation Ingestion Processor (GPM IMERG) ---

// ProcessPrecipitation computes updated Antecedent Precipitation Index (API).
// API_t = P_t + k * API_{t-1}, where k = 0.85 (monsoon soil memory).
func ProcessPrecipitation(dailyRainMm, prevAPI float64) (api float64, heavyRainAlert bool) {
	api = math.Round((dailyRainMm+0.85*prevAPI)*10) / 10
	// IMD Heavy Rain threshold: > 64.5 mm/day
	heavyRainAlert = dailyRainMm >= 64.5 || api > 120.0
	return api, heavyRainAlert
}

// IngestMacroReading processes and stores a combined hydrometeorological reading for a target reach.
func (e *IngestionEngine) IngestMacroReading(raw models.MacroEnvironmentalReading, prevCWL float64, deltaHours float64) (models.MacroEnvironmentalReading, error) {
	if raw.ReachID == "" {
		return raw, errors.New("reach ID is required for macro reading")
	}

	reach, found := e.store.GetReach(raw.ReachID)
	crest := 85.0
	if found && reach.CrestElevation > 0 {
		crest = reach.CrestElevation
	}

	// 1. Process SAR backscatter
	waterDetected, _ := ProcessSARBackscatter(raw.SARBackscatterDB)
	raw.SARWaterDetected = waterDetected

	// 2. Process Hydraulic Driver
	freeboard, rateOfRise, warning := ProcessHydraulicDriver(crest, raw.CWCWaterLevelM, raw.CWCDangerLevelM, prevCWL, deltaHours)
	raw.CalculatedFreeboardM = freeboard
	raw.WaterLevelRateOfRiseCmH = rateOfRise
	raw.HydraulicWarning = warning

	if raw.Timestamp.IsZero() {
		raw.Timestamp = time.Now()
	}

	e.store.IngestMacroReading(raw)
	return raw, nil
}
