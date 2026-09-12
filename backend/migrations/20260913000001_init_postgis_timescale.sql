-- +goose Up
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 1. Embankment Physical Nodes
CREATE TABLE IF NOT EXISTS embankment_nodes (
    node_id VARCHAR(64) PRIMARY KEY,
    zone_name VARCHAR(128) NOT NULL,
    river VARCHAR(64) NOT NULL,
    geom GEOMETRY(Point, 4326) NOT NULL,
    elevation_m NUMERIC(6, 2) NOT NULL,
    battery_voltage NUMERIC(4, 2) DEFAULT 4.20,
    firmware_ver VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nodes_geom ON embankment_nodes USING GIST(geom);

-- 2. Embankment Reaches (Spatial Lines & Buffers)
CREATE TABLE IF NOT EXISTS embankment_reaches (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    river VARCHAR(64) NOT NULL,
    district VARCHAR(64) NOT NULL,
    length_km NUMERIC(6, 2) NOT NULL,
    crest_elevation NUMERIC(6, 2) NOT NULL,
    base_width_m NUMERIC(6, 2) NOT NULL,
    embankment_type VARCHAR(64) NOT NULL,
    vulnerable BOOLEAN DEFAULT FALSE,
    active_node_id VARCHAR(64) REFERENCES embankment_nodes(node_id),
    centerline GEOMETRY(LineString, 4326) NOT NULL,
    buffer_50m GEOMETRY(Polygon, 4326),
    last_survey_date DATE NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reaches_centerline ON embankment_reaches USING GIST(centerline);
CREATE INDEX IF NOT EXISTS idx_reaches_buffer ON embankment_reaches USING GIST(buffer_50m);

-- 3. High-Frequency IoT Node Telemetry
CREATE TABLE IF NOT EXISTS node_telemetry (
    time TIMESTAMPTZ NOT NULL,
    node_id VARCHAR(64) NOT NULL REFERENCES embankment_nodes(node_id),
    soil_moisture NUMERIC(5, 2) NOT NULL,
    tilt_angle NUMERIC(5, 2) NOT NULL,
    audio_rms NUMERIC(7, 2) NOT NULL,
    factor_of_safety NUMERIC(4, 3) NOT NULL,
    status VARCHAR(16) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_telemetry_node_time ON node_telemetry(node_id, time DESC);

-- 4. Macro Environmental Readings (Satellite & CWC River Stage)
CREATE TABLE IF NOT EXISTS macro_readings (
    time TIMESTAMPTZ NOT NULL,
    reach_id VARCHAR(64) NOT NULL REFERENCES embankment_reaches(id),
    sar_backscatter_db NUMERIC(5, 2),
    sar_water_detected BOOLEAN DEFAULT FALSE,
    optical_mndwi NUMERIC(4, 3),
    optical_ndvi NUMERIC(4, 3),
    cwc_water_level_m NUMERIC(6, 2),
    cwc_danger_level_m NUMERIC(6, 2),
    freeboard_m NUMERIC(6, 2),
    rate_of_rise_cm_h NUMERIC(5, 2),
    rainfall_72h_mm NUMERIC(6, 2),
    hydraulic_warning BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_macro_reach_time ON macro_readings(reach_id, time DESC);

-- 5. Historical & Field Breach Events
CREATE TABLE IF NOT EXISTS breach_records (
    id VARCHAR(64) PRIMARY KEY,
    reach_id VARCHAR(64) REFERENCES embankment_reaches(id),
    location_name VARCHAR(128) NOT NULL,
    river VARCHAR(64) NOT NULL,
    geom GEOMETRY(Point, 4326) NOT NULL,
    breach_date DATE NOT NULL,
    breach_width_m NUMERIC(6, 2) NOT NULL,
    peak_discharge_m3s NUMERIC(8, 2) NOT NULL,
    failure_mechanism VARCHAR(128) NOT NULL,
    impact_description TEXT,
    remediation_status VARCHAR(64) NOT NULL,
    severity VARCHAR(16) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_breaches_geom ON breach_records USING GIST(geom);

-- 6. Dispatched Emergency Evacuation Alert Logs
CREATE TABLE IF NOT EXISTS alert_logs (
    id VARCHAR(64) PRIMARY KEY,
    node_id VARCHAR(64) REFERENCES embankment_nodes(node_id),
    zone_name VARCHAR(128) NOT NULL,
    factor_of_safety NUMERIC(4, 3) NOT NULL,
    level VARCHAR(32) NOT NULL,
    channel VARCHAR(32) NOT NULL,
    recipient VARCHAR(64) NOT NULL,
    message TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alerts_sent_at ON alert_logs(sent_at DESC);

-- Convert to TimescaleDB hypertables if timescaledb is loaded
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        PERFORM create_hypertable('node_telemetry', 'time', if_not_exists => TRUE, chunk_time_interval => INTERVAL '7 days');
        PERFORM create_hypertable('macro_readings', 'time', if_not_exists => TRUE, chunk_time_interval => INTERVAL '14 days');
    END IF;
END $$;

-- +goose Down
DROP TABLE IF EXISTS alert_logs;
DROP TABLE IF EXISTS breach_records;
DROP TABLE IF EXISTS macro_readings;
DROP TABLE IF EXISTS node_telemetry;
DROP TABLE IF EXISTS embankment_reaches;
DROP TABLE IF EXISTS embankment_nodes;
