package handlers

import (
	"encoding/csv"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"strconv"
	"time"

	"borbandh/backend/internal/calculator"
	"borbandh/backend/internal/middleware"
	"borbandh/backend/internal/ml"
	"borbandh/backend/internal/models"
	"borbandh/backend/internal/simulator"
	"borbandh/backend/internal/sse"
	"borbandh/backend/internal/store"
)

// APIHandler bundles services to serve standard library HTTP endpoints.
type APIHandler struct {
	store     store.Store
	broker    *sse.Broker
	simulator *simulator.Simulator
	mlEngine  *ml.InferenceEngine
}

func NewAPIHandler(st store.Store, br *sse.Broker, sim *simulator.Simulator, mle *ml.InferenceEngine) *APIHandler {
	return &APIHandler{
		store:     st,
		broker:    br,
		simulator: sim,
		mlEngine:  mle,
	}
}

// RegisterRoutes registers all endpoints on a standard library http.ServeMux.
func (h *APIHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/health", h.Health)
	mux.HandleFunc("/api/v1/stats", h.Stats)
	mux.HandleFunc("/api/v1/telemetry/ingest", h.IngestTelemetry)
	mux.HandleFunc("/api/v1/telemetry/history", h.TelemetryHistory)
	mux.HandleFunc("/api/v1/telemetry/nodes", h.ListNodes)
	mux.HandleFunc("/api/v1/stream", h.broker.ServeHTTP)
	mux.HandleFunc("/api/v1/reports", h.HandleCitizenReports)
	mux.HandleFunc("/api/v1/alerts", h.ListAlerts)
	mux.HandleFunc("/api/v1/simulator/scenario", h.SetSimulatorScenario)
	mux.HandleFunc("/api/v1/simulator/toggle", h.ToggleSimulator)
	mux.HandleFunc("/api/v1/geo/embankments", h.GetGeoJSON)

	// Machine Learning endpoints
	mux.HandleFunc("/api/v1/ml/predict", h.PredictSafety)
	mux.HandleFunc("/api/v1/ml/benchmark", h.RunBenchmark)
}

func (h *APIHandler) Health(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		middleware.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"status":          "healthy",
		"system":          "BorBandh AI Embankment Monitoring System",
		"region":          "Assam, India (Brahmaputra Basin)",
		"backend":         "100% Vanilla Go Standard Library",
		"ml_infrastructure": "Native Pure-Go TFT-PINN Inference (Zero Python Runtime)",
		"version":         "1.0.0",
		"timestamp":       time.Now().Format(time.RFC3339),
	})
}

func (h *APIHandler) Stats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		middleware.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	stats := h.store.GetSystemStats()
	middleware.WriteJSON(w, http.StatusOK, stats)
}

func (h *APIHandler) IngestTelemetry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		middleware.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var payload models.TelemetryIngestPayload
	if err := middleware.ReadJSON(r, &payload); err != nil {
		middleware.WriteError(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}

	if payload.NodeID == "" {
		middleware.WriteError(w, http.StatusBadRequest, "node_id is required")
		return
	}

	saved := h.simulator.IngestManual(payload)
	middleware.WriteJSON(w, http.StatusCreated, saved)
}

func (h *APIHandler) TelemetryHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		middleware.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	nodeID := r.URL.Query().Get("node_id")
	limitStr := r.URL.Query().Get("limit")
	limit := 100
	if limitStr != "" {
		if val, err := strconv.Atoi(limitStr); err == nil && val > 0 {
			limit = val
		}
	}

	history := h.store.GetTelemetryHistory(nodeID, limit)
	middleware.WriteJSON(w, http.StatusOK, history)
}

func (h *APIHandler) ListNodes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		middleware.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	nodes := h.store.GetAllNodes()
	middleware.WriteJSON(w, http.StatusOK, nodes)
}

func (h *APIHandler) HandleCitizenReports(w http.ResponseWriter, r *http.Request) {
	middleware.WriteJSON(w, http.StatusOK, map[string]string{"message": "Citizen reports active"})
}

func (h *APIHandler) ListAlerts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		middleware.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	logs := h.store.GetAlertLogs(50)
	middleware.WriteJSON(w, http.StatusOK, logs)
}

func (h *APIHandler) SetSimulatorScenario(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		middleware.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		Scenario   string `json:"scenario"`
		TargetNode string `json:"target_node,omitempty"`
	}
	if err := middleware.ReadJSON(r, &req); err != nil {
		middleware.WriteError(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}

	h.simulator.SetScenario(req.Scenario, req.TargetNode)
	middleware.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success":     true,
		"scenario":    req.Scenario,
		"target_node": req.TargetNode,
	})
}

func (h *APIHandler) ToggleSimulator(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		middleware.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		Action string `json:"action"` // "start" or "stop"
	}
	_ = middleware.ReadJSON(r, &req)

	if req.Action == "stop" {
		h.simulator.Stop()
	} else {
		h.simulator.Start()
	}

	middleware.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"action":  req.Action,
	})
}

func (h *APIHandler) GetGeoJSON(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		middleware.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	stageDelta := 0.0
	if stageParam := r.URL.Query().Get("stage_delta"); stageParam != "" {
		if val, err := strconv.ParseFloat(stageParam, 64); err == nil {
			stageDelta = val
		}
	}

	geoJSON := h.store.GetGeoJSON(stageDelta)
	middleware.WriteJSON(w, http.StatusOK, geoJSON)
}

// PredictSafety provides real-time TFT-PINN inference for a node or ad-hoc sensor parameters.
func (h *APIHandler) PredictSafety(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodPost {
		middleware.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	nodeID := r.URL.Query().Get("node_id")

	// Feature defaults based on training data medians
	moisture := 31.785
	tilt := 0.0
	acoustic := 85.8
	rain := 1.075
	ndwi := 0.3212
	sar := -13.33

	if nodeID != "" {
		if node, exists := h.store.GetNodeByID(nodeID); exists && node.LastTelemetry != nil {
			moisture = node.LastTelemetry.SoilMoisture
			tilt = node.LastTelemetry.TiltAngle
			audio := node.LastTelemetry.AudioRMS
			if audio > 0 {
				acoustic = audio
			}
		}
	}

	// Query parameter overrides
	q := r.URL.Query()
	if val, err := strconv.ParseFloat(q.Get("moisture"), 64); err == nil {
		moisture = val
	}
	if val, err := strconv.ParseFloat(q.Get("tilt"), 64); err == nil {
		tilt = val
	}
	if val, err := strconv.ParseFloat(q.Get("acoustic"), 64); err == nil {
		acoustic = val
	}
	if val, err := strconv.ParseFloat(q.Get("audio"), 64); err == nil {
		acoustic = val
	}
	if val, err := strconv.ParseFloat(q.Get("rain_mm"), 64); err == nil {
		rain = val
	}
	if val, err := strconv.ParseFloat(q.Get("ndwi"), 64); err == nil {
		ndwi = val
	}
	if val, err := strconv.ParseFloat(q.Get("sar_backscatter"), 64); err == nil {
		sar = val
	}

	start := time.Now()
	res, err := calculator.PredictNodeSafety(nodeID, moisture, tilt, acoustic, rain, ndwi, sar)
	elapsedUs := time.Since(start).Microseconds()

	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, fmt.Sprintf("ML inference error: %v", err))
		return
	}

	middleware.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"node_id":          nodeID,
		"factor_of_safety": res.FactorOfSafety,
		"forecast_fs":      res.ForecastFS,
		"status":           res.Status,
		"p_breach":         res.PBreach,
		"failure_mode":     res.FailureMode,
		"feature_weights":  res.FeatureWeights,
		"input_features": map[string]float64{
			"moisture":        moisture,
			"tilt":            tilt,
			"acoustic":        acoustic,
			"rain_mm":         rain,
			"ndwi":            ndwi,
			"sar_backscatter": sar,
		},
		"inference_time_us": elapsedUs,
		"runtime_engine":   "Pure Go (Zero Python Dependency)",
	})
}

// RunBenchmark runs validation against benchmark_fea_embankment_telemetry.csv.
func (h *APIHandler) RunBenchmark(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		middleware.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	candidates := []string{
		"pyscripts/benchmark_fea_embankment_telemetry.csv",
		"../pyscripts/benchmark_fea_embankment_telemetry.csv",
		"../../pyscripts/benchmark_fea_embankment_telemetry.csv",
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
		middleware.WriteError(w, http.StatusNotFound, "benchmark_fea_embankment_telemetry.csv not found")
		return
	}

	file, err := os.Open(csvPath)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to open CSV: %v", err))
		return
	}
	defer file.Close()

	reader := csv.NewReader(file)
	_, _ = reader.Read() // skip header

	limit := 100
	if lStr := r.URL.Query().Get("limit"); lStr != "" {
		if val, err := strconv.Atoi(lStr); err == nil && val > 0 && val <= 1000 {
			limit = val
		}
	}

	var totalMAE float64
	var maxError float64
	count := 0
	samples := make([]map[string]interface{}, 0, 5)

	benchStart := time.Now()

	for {
		rec, err := reader.Read()
		if err == io.EOF || count >= limit {
			break
		}
		if err != nil {
			break
		}

		moist, _ := strconv.ParseFloat(rec[1], 64)
		tilt, _ := strconv.ParseFloat(rec[2], 64)
		audio, _ := strconv.ParseFloat(rec[3], 64)
		rain, _ := strconv.ParseFloat(rec[4], 64)
		ndwi, _ := strconv.ParseFloat(rec[5], 64)
		sar, _ := strconv.ParseFloat(rec[6], 64)
		targetFS, _ := strconv.ParseFloat(rec[7], 64)

		res, err := calculator.PredictNodeSafety("", moist, tilt, audio, rain, ndwi, sar)
		if err != nil {
			continue
		}

		errAbs := math.Abs(res.FactorOfSafety - targetFS)
		totalMAE += errAbs
		if errAbs > maxError {
			maxError = errAbs
		}

		if count < 5 {
			samples = append(samples, map[string]interface{}{
				"timestamp":   rec[0],
				"target_fs":   targetFS,
				"pred_fs":     res.FactorOfSafety,
				"abs_error":   math.Round(errAbs*1000) / 1000,
				"status":      res.Status,
				"forecast_fs": res.ForecastFS[:5],
			})
		}
		count++
	}

	totalDuration := time.Since(benchStart)
	var avgUs float64
	if count > 0 {
		avgUs = float64(totalDuration.Microseconds()) / float64(count)
	}

	mae := 0.0
	if count > 0 {
		mae = math.Round((totalMAE/float64(count))*10000) / 10000
	}

	middleware.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"benchmark_dataset":       "benchmark_fea_embankment_telemetry.csv",
		"records_evaluated":       count,
		"mean_absolute_error":     mae,
		"max_absolute_error":      math.Round(maxError*10000) / 10000,
		"total_duration_ms":       float64(totalDuration.Microseconds()) / 1000.0,
		"avg_latency_per_eval_us": math.Round(avgUs*10) / 10,
		"samples":                 samples,
		"runtime_engine":          "Pure Go (Zero Python Dependency)",
	})
}
