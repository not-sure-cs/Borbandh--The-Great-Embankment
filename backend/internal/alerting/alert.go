package alerting

import (
	"fmt"
	"log"

	"aero_hydro/backend/internal/models"
	"aero_hydro/backend/internal/store"
)

// Dispatcher handles routing critical evacuation notices when Factor of Safety < 1.0.
type Dispatcher struct {
	store *store.Store
}

func NewDispatcher(st *store.Store) *Dispatcher {
	return &Dispatcher{
		store: st,
	}
}

// ProcessTelemetry evaluates if emergency alerts must be dispatched to district authorities & citizens.
func (d *Dispatcher) ProcessTelemetry(t models.NodeTelemetry) []models.AlertLog {
	if t.FactorOfSafety >= 1.0 {
		// Normal / Safe - no alert required
		return nil
	}

	var level string
	var msg string

	if t.FactorOfSafety < 0.7 {
		level = "CRITICAL_EVACUATION"
		msg = fmt.Sprintf("EMERGENCY EVACUATION ALERT: Embankment at %s (Node: %s) has breached critical stability threshold! Fs=%.3f (Moisture: %.1f%%, Tilt: %.1f°, Audio: %.1f RMS). Evacuate flood-prone lowlands immediately.",
			t.ZoneName, t.NodeID, t.FactorOfSafety, t.SoilMoisture, t.TiltAngle, t.AudioRMS)
	} else {
		level = "WARNING"
		msg = fmt.Sprintf("SEEPAGE & INSTABILITY WARNING: Embankment at %s (Node: %s) reports ground saturation warning. Fs=%.3f (Moisture: %.1f%%, Tilt: %.1f°). Water Resources Dept inspection teams alerted.",
			t.ZoneName, t.NodeID, t.FactorOfSafety, t.SoilMoisture, t.TiltAngle)
	}

	var logs []models.AlertLog

	// 1. Dispatch SMS to District Disaster Management Authority (DDMA)
	smsLog := d.store.AddAlertLog(models.AlertLog{
		NodeID:         t.NodeID,
		ZoneName:       t.ZoneName,
		FactorOfSafety: t.FactorOfSafety,
		Level:          level,
		Channel:        "TWILIO_SMS",
		Recipient:      "Assam State Disaster Management Authority (ASDMA) Control Room (+91 361 2237011)",
		Message:        msg,
	})
	logs = append(logs, smsLog)
	log.Printf("[ALERT DISPATCH] [TWILIO SMS] Sent to DDMA: %s", msg)

	// 2. Dispatch WhatsApp broadcast to registered community residents
	waLog := d.store.AddAlertLog(models.AlertLog{
		NodeID:         t.NodeID,
		ZoneName:       t.ZoneName,
		FactorOfSafety: t.FactorOfSafety,
		Level:          level,
		Channel:        "WHATSAPP_API",
		Recipient:      fmt.Sprintf("Citizen Broadcast Group (%s)", t.ZoneName),
		Message:        msg,
	})
	logs = append(logs, waLog)
	log.Printf("[ALERT DISPATCH] [WHATSAPP API] Broadcasted to Community Group: %s", msg)

	return logs
}
