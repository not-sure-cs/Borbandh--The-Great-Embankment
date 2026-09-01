# AeroHydro AI: Autonomous Embankment Resilience & Early Warning Platform

An enterprise-grade IoT early-warning and resilience platform designed for river embankments in flood-prone regions (such as Assam's Brahmaputra and Barak basins).

## System Architecture

- **Backend (`/backend`)**:
  - **100% Vanilla Go Standard Library** (`net/http`, `sync`, `encoding/json`, `crypto/sha256`, `time`, `os/signal`). Zero external runtime frameworks (No Gin, Chi, Echo, or ORMs).
  - Machine Learning regression safety calculation engine:
    $$\text{Factor of Safety } (F_s) = 2.0 - (0.012 \times \text{Moisture}) - (0.04 \times \text{Tilt}) - (0.001 \times \text{Audio})$$
  - Real-time Server-Sent Events (SSE) broadcasting over `net/http` Flusher.
  - Automated Emergency Alert Router (simulating Twilio SMS & WhatsApp Business API evacuation notices when $F_s < 1.0$).
  - Immutable Contractor Accountability Audit Ledger with SHA-256 block chaining.
  - Background IoT telemetry simulator with scenario stress testing.

- **Frontend (`/frontend`)**:
  - Modern dashboard built with React 18, Vite, TypeScript, and Tailwind CSS.
  - **Dynamic Radial Safety Gauge**: Displays real-time $F_s$ score and automatically snaps to bright red with pulsating aura on $F_s < 1.0$.
  - **Interactive Geospatial Leaflet Map**: Renders ISRO Bhuvan embankment reach lines, 50-meter spatial safety buffer zones, Sentinel-1 SAR ground saturation overlays, and live sensor pins.
  - **Multi-Series Time-Series Telemetry Charts**: Real-time tracking of Moisture (%), Tilt (°), Acoustic RMS, and $F_s$.
  - **Contractor Audit Ledger Table**: Public accountability tracking with cryptographic hash verification.
  - **Citizen Crowdsource Reporting Portal**: GPS coordinate grabber and observation triage for field inspection teams.
  - **Interactive IoT Simulator Panel**: Ingest custom sensor values or trigger extreme breach scenarios.

- **Edge Firmware (`/backend/esphome/embankment_node.yaml`)**:
  - Declarative ESPHome firmware for ESP32 with capacitive soil moisture (GPIO34), MPU6050 I2C accelerometer, and INMP441 acoustic piping sensor (GPIO35).

---

## Quick Start Guide

### 1. Start the Go Backend Server
```bash
cd /Users/knibirdgautam/Documents/CS_Coding_Projects/Go/Aero_Hydro/backend
go run ./cmd/server
```
The server will start on `http://localhost:8080` (Health check: `http://localhost:8080/api/v1/health`).

### 2. Start the React Frontend Dashboard
```bash
cd /Users/knibirdgautam/Documents/CS_Coding_Projects/Go/Aero_Hydro/frontend
npm run dev
```
Open your browser at `http://localhost:5173`.

---

## Verification & Testing

### Run Backend Unit Tests
```bash
cd /Users/knibirdgautam/Documents/CS_Coding_Projects/Go/Aero_Hydro/backend
go test -v ./...
```

### Build Production Bundles
```bash
make build-backend
make build-frontend
```
