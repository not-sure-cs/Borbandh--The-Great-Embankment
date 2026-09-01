package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"aero_hydro/backend/internal/middleware"
	"aero_hydro/backend/internal/models"
	"aero_hydro/backend/internal/simulator"
	"aero_hydro/backend/internal/sse"
	"aero_hydro/backend/internal/store"
)

// APIHandler bundles services to serve standard library HTTP endpoints.
type APIHandler struct {
	store     *store.Store
	broker    *sse.Broker
	simulator *simulator.Simulator
}

func NewAPIHandler(st *store.Store, br *sse.Broker, sim *simulator.Simulator) *APIHandler {
	return &APIHandler{
		store:     st,
		broker:    br,
		simulator: sim,
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
	mux.HandleFunc("/api/v1/ledger", h.HandleLedger)
	mux.HandleFunc("/api/v1/reports", h.HandleCitizenReports)
	mux.HandleFunc("/api/v1/alerts", h.ListAlerts)
	mux.HandleFunc("/api/v1/simulator/scenario", h.SetSimulatorScenario)
	mux.HandleFunc("/api/v1/simulator/toggle", h.ToggleSimulator)
	mux.HandleFunc("/api/v1/geo/embankments", h.GetGeoJSON)
}

func (h *APIHandler) Health(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		middleware.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "healthy",
		"system":    "AeroHydro AI Embankment Monitoring System",
		"region":    "Assam, India (Brahmaputra Basin)",
		"backend":   "100% Vanilla Go Standard Library",
		"version":   "1.0.0",
		"timestamp": fmt.Sprint(w.Header()),
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

func (h *APIHandler) HandleLedger(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		ledger := h.store.GetLedger()
		middleware.WriteJSON(w, http.StatusOK, ledger)

	case http.MethodPost:
		var entry models.ContractorLedger
		if err := middleware.ReadJSON(r, &entry); err != nil {
			middleware.WriteError(w, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		if entry.Constituency == "" || entry.ContractorName == "" {
			middleware.WriteError(w, http.StatusBadRequest, "constituency and contractor_name are required")
			return
		}

		saved := h.store.AddContractorLedger(entry)
		h.broker.Broadcast("ledger", saved)
		middleware.WriteJSON(w, http.StatusCreated, saved)

	default:
		middleware.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

func (h *APIHandler) HandleCitizenReports(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		reports := h.store.GetCitizenReports()
		middleware.WriteJSON(w, http.StatusOK, reports)

	case http.MethodPost:
		var report models.CitizenReport
		if err := middleware.ReadJSON(r, &report); err != nil {
			middleware.WriteError(w, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		if report.ReporterName == "" || report.EmbankmentZone == "" {
			middleware.WriteError(w, http.StatusBadRequest, "reporter_name and embankment_zone are required")
			return
		}

		saved := h.store.AddCitizenReport(report)
		h.broker.Broadcast("report", saved)
		middleware.WriteJSON(w, http.StatusCreated, saved)

	default:
		middleware.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

func (h *APIHandler) ListAlerts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		middleware.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if val, err := strconv.Atoi(l); err == nil && val > 0 {
			limit = val
		}
	}

	alerts := h.store.GetAlertLogs(limit)
	middleware.WriteJSON(w, http.StatusOK, alerts)
}

func (h *APIHandler) SetSimulatorScenario(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		middleware.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		Scenario string `json:"scenario"`
		NodeID   string `json:"node_id"`
	}

	if err := middleware.ReadJSON(r, &req); err != nil {
		middleware.WriteError(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}

	if req.Scenario == "" {
		req.Scenario = "FLASH_FLOOD"
	}
	if req.NodeID == "" {
		req.NodeID = "NODE-MAJULI-01"
	}

	h.simulator.SetScenario(strings.ToUpper(req.Scenario), req.NodeID)

	middleware.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success":  true,
		"scenario": req.Scenario,
		"node_id":  req.NodeID,
		"message":  fmt.Sprintf("Simulator scenario triggered: %s on %s", req.Scenario, req.NodeID),
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

	// Geospatial vector dataset representing target river embankment reach lines in Assam (Brahmaputra basin)
	// and their 50-meter spatial safety buffer zones per Phase 1 specification.
	geoJSON := map[string]interface{}{
		"type": "FeatureCollection",
		"features": []map[string]interface{}{
			// 1. Majuli Island Embankment Line
			{
				"type": "Feature",
				"properties": map[string]interface{}{
					"name":        "Majuli Kamalabari Reach",
					"river":       "Brahmaputra",
					"type":        "embankment_line",
					"length_km":   18.4,
					"vulnerable":  true,
					"active_node": "NODE-MAJULI-01",
				},
				"geometry": map[string]interface{}{
					"type": "LineString",
					"coordinates": [][]float64{
						{94.1500, 26.9300},
						{94.1700, 26.9400},
						{94.1873, 26.9452},
						{94.2100, 26.9550},
						{94.2400, 26.9600},
					},
				},
			},
			// 2. Majuli 50-meter Buffer Polygon
			{
				"type": "Feature",
				"properties": map[string]interface{}{
					"name":        "Majuli 50m Spatial Safety Buffer",
					"type":        "buffer_zone",
					"buffer_dist": "50 meters",
					"fillColor":   "#f59e0b",
				},
				"geometry": map[string]interface{}{
					"type": "Polygon",
					"coordinates": [][][]float64{
						{
							{94.1480, 26.9280},
							{94.1680, 26.9380},
							{94.1850, 26.9430},
							{94.2080, 26.9530},
							{94.2420, 26.9580},
							{94.2380, 26.9620},
							{94.2060, 26.9570},
							{94.1890, 26.9470},
							{94.1720, 26.9420},
							{94.1520, 26.9320},
							{94.1480, 26.9280},
						},
					},
				},
			},
			// 3. Dibrugarh Town Protection Dyke Line
			{
				"type": "Feature",
				"properties": map[string]interface{}{
					"name":        "Dibrugarh Town Protection Dyke",
					"river":       "Brahmaputra",
					"type":        "embankment_line",
					"length_km":   9.6,
					"vulnerable":  false,
					"active_node": "NODE-DIBRUGARH-02",
				},
				"geometry": map[string]interface{}{
					"type": "LineString",
					"coordinates": [][]float64{
						{94.8800, 27.4550},
						{94.8950, 27.4650},
						{94.9120, 27.4728},
						{94.9300, 27.4800},
					},
				},
			},
			// 4. Tezpur Bhomoraguri Embankment Line
			{
				"type": "Feature",
				"properties": map[string]interface{}{
					"name":        "Tezpur Bhomoraguri Guide Bund",
					"river":       "Brahmaputra",
					"type":        "embankment_line",
					"length_km":   6.2,
					"vulnerable":  false,
					"active_node": "NODE-TEZPUR-03",
				},
				"geometry": map[string]interface{}{
					"type": "LineString",
					"coordinates": [][]float64{
						{92.7750, 26.6200},
						{92.7926, 26.6338},
						{92.8100, 26.6450},
					},
				},
			},
			// 5. Guwahati Saraighat Wall Line
			{
				"type": "Feature",
				"properties": map[string]interface{}{
					"name":        "Guwahati Saraighat Flood Defense",
					"river":       "Brahmaputra",
					"type":        "embankment_line",
					"length_km":   5.8,
					"vulnerable":  false,
					"active_node": "NODE-GUWAHATI-04",
				},
				"geometry": map[string]interface{}{
					"type": "LineString",
					"coordinates": [][]float64{
						{91.6650, 26.1650},
						{91.6854, 26.1738},
						{91.7050, 26.1800},
					},
				},
			},
			// 6. Silchar Bethukandi Embankment Line
			{
				"type": "Feature",
				"properties": map[string]interface{}{
					"name":        "Silchar Bethukandi Dyke (Barak River)",
					"river":       "Barak",
					"type":        "embankment_line",
					"length_km":   12.1,
					"vulnerable":  true,
					"active_node": "NODE-SILCHAR-05",
				},
				"geometry": map[string]interface{}{
					"type": "LineString",
					"coordinates": [][]float64{
						{92.7550, 24.8150},
						{92.7789, 24.8333},
						{92.8050, 24.8450},
					},
				},
			},
		},
	}

	middleware.WriteJSON(w, http.StatusOK, geoJSON)
}
