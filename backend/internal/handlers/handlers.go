package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"borbandh/backend/internal/middleware"
	"borbandh/backend/internal/models"
	"borbandh/backend/internal/simulator"
	"borbandh/backend/internal/sse"
	"borbandh/backend/internal/store"
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
		"system":    "BorBandh AI Embankment Monitoring System",
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

	geoJSON := h.store.GetGeoJSON()
	middleware.WriteJSON(w, http.StatusOK, geoJSON)
}
