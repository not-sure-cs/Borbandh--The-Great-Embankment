-- BorBandh TimescaleDB Schema & Initial Seed
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 1. Embankment Physical Nodes
CREATE TABLE IF NOT EXISTS embankment_nodes (
    node_id VARCHAR(64) PRIMARY KEY,
    zone_name VARCHAR(128) NOT NULL,
    river VARCHAR(64) NOT NULL,
    latitude NUMERIC(9, 6) NOT NULL,
    longitude NUMERIC(9, 6) NOT NULL,
    elevation_m NUMERIC(6, 2) NOT NULL,
    battery_voltage NUMERIC(4, 2) DEFAULT 4.20,
    firmware_ver VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Embankment Reaches
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
    last_survey_date DATE NOT NULL
);

-- 3. High-Frequency IoT Node Telemetry (TimescaleDB Hypertable)
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

-- 4. Macro Environmental Readings (TimescaleDB Hypertable)
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

-- 5. Dispatched Emergency Evacuation Alert Logs
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

-- Convert to Hypertables
SELECT create_hypertable('node_telemetry', 'time', if_not_exists => TRUE, chunk_time_interval => INTERVAL '7 days');
SELECT create_hypertable('macro_readings', 'time', if_not_exists => TRUE, chunk_time_interval => INTERVAL '14 days');

-- Seed Stations
INSERT INTO embankment_nodes (node_id, zone_name, river, latitude, longitude, elevation_m, battery_voltage, firmware_ver, created_at, last_seen)
VALUES 
    ('NODE-MAJULI-01', 'Majuli Island - Kamalabari Dyke', 'Brahmaputra', 26.9452, 94.1873, 84.50, 4.12, 'ESPHome-BorBandh-v1.4.2', NOW() - INTERVAL '30 days', NOW()),
    ('NODE-DIBRUGARH-02', 'Dibrugarh Town Protection Dyke', 'Brahmaputra', 27.4728, 94.9120, 108.00, 4.05, 'ESPHome-BorBandh-v1.4.2', NOW() - INTERVAL '30 days', NOW()),
    ('NODE-TEZPUR-03', 'Tezpur Bhomoraguri Guide Bund', 'Brahmaputra', 26.6338, 92.7926, 72.00, 4.18, 'ESPHome-BorBandh-v1.4.2', NOW() - INTERVAL '30 days', NOW()),
    ('NODE-GUWAHATI-04', 'Guwahati Saraighat Flood Defense', 'Brahmaputra', 26.1738, 91.6854, 54.00, 4.10, 'ESPHome-BorBandh-v1.4.2', NOW() - INTERVAL '30 days', NOW()),
    ('NODE-SILCHAR-05', 'Silchar Bethukandi Dyke', 'Barak', 24.8333, 92.7789, 26.50, 3.98, 'ESPHome-BorBandh-v1.4.2', NOW() - INTERVAL '30 days', NOW())
ON CONFLICT (node_id) DO NOTHING;

INSERT INTO embankment_reaches (id, name, river, district, length_km, crest_elevation, base_width_m, embankment_type, vulnerable, active_node_id, last_survey_date)
VALUES
    ('REACH-MAJULI-01', 'Majuli Kamalabari Reach', 'Brahmaputra', 'Majuli', 18.40, 86.50, 22.00, 'Earthen Bund with Boulder Pitching', TRUE, 'NODE-MAJULI-01', '2026-04-12'),
    ('REACH-DIBRUGARH-02', 'Dibrugarh Town Protection Dyke', 'Brahmaputra', 'Dibrugarh', 9.60, 110.00, 28.00, 'Reinforced Concrete Sluice & Boulder Apron', FALSE, 'NODE-DIBRUGARH-02', '2026-03-20'),
    ('REACH-TEZPUR-03', 'Tezpur Bhomoraguri Guide Bund', 'Brahmaputra', 'Sonitpur', 6.20, 71.50, 20.00, 'Earthen Bund with Stone Pitching', FALSE, 'NODE-TEZPUR-03', '2026-01-15'),
    ('REACH-GUWAHATI-04', 'Guwahati Saraighat Flood Defense', 'Brahmaputra', 'Kamrup Metropolitan', 5.80, 56.50, 18.00, 'Concrete Flood Wall & Sheet Piling', FALSE, 'NODE-GUWAHATI-04', '2026-02-10'),
    ('REACH-SILCHAR-05', 'Silchar Bethukandi Dyke', 'Barak', 'Cachar', 12.10, 27.20, 16.00, 'Earthen Dyke & Sluice Gate Regulator', TRUE, 'NODE-SILCHAR-05', '2026-05-01')
ON CONFLICT (id) DO NOTHING;

-- Seed Historical Telemetry Series (Last 120 Minutes at 2-Minute Cadence)
INSERT INTO node_telemetry (time, node_id, soil_moisture, tilt_angle, audio_rms, factor_of_safety, status)
SELECT 
    NOW() - (i || ' minutes')::INTERVAL,
    'NODE-MAJULI-01',
    42.0 + (5.0 * sin(i::float / 5.0)),
    1.1 + (0.3 * cos(i::float / 4.0)),
    140.0 + (25.0 * sin(i::float / 3.0)),
    1.72 - (0.05 * sin(i::float / 5.0)),
    'SAFE'
FROM generate_series(0, 120, 2) AS i;

INSERT INTO node_telemetry (time, node_id, soil_moisture, tilt_angle, audio_rms, factor_of_safety, status)
SELECT 
    NOW() - (i || ' minutes')::INTERVAL,
    'NODE-DIBRUGARH-02',
    38.0 + (4.0 * cos(i::float / 6.0)),
    0.9 + (0.2 * sin(i::float / 5.0)),
    120.0 + (18.0 * cos(i::float / 4.0)),
    1.84 - (0.04 * cos(i::float / 6.0)),
    'SAFE'
FROM generate_series(0, 120, 2) AS i;

INSERT INTO node_telemetry (time, node_id, soil_moisture, tilt_angle, audio_rms, factor_of_safety, status)
SELECT 
    NOW() - (i || ' minutes')::INTERVAL,
    'NODE-SILCHAR-05',
    58.0 + (6.0 * sin(i::float / 4.0)),
    2.1 + (0.4 * cos(i::float / 3.0)),
    260.0 + (40.0 * sin(i::float / 2.0)),
    1.28 - (0.08 * sin(i::float / 4.0)),
    'WATCH'
FROM generate_series(0, 120, 2) AS i;

INSERT INTO node_telemetry (time, node_id, soil_moisture, tilt_angle, audio_rms, factor_of_safety, status)
SELECT 
    NOW() - (i || ' minutes')::INTERVAL,
    'NODE-TEZPUR-03',
    35.0 + (3.0 * sin(i::float / 6.0)),
    0.8 + (0.2 * cos(i::float / 5.0)),
    110.0 + (15.0 * sin(i::float / 4.0)),
    1.91 - (0.03 * sin(i::float / 6.0)),
    'SAFE'
FROM generate_series(0, 120, 2) AS i;

INSERT INTO node_telemetry (time, node_id, soil_moisture, tilt_angle, audio_rms, factor_of_safety, status)
SELECT 
    NOW() - (i || ' minutes')::INTERVAL,
    'NODE-GUWAHATI-04',
    44.0 + (4.0 * cos(i::float / 7.0)),
    1.2 + (0.3 * sin(i::float / 4.0)),
    135.0 + (20.0 * cos(i::float / 3.0)),
    1.68 - (0.04 * cos(i::float / 7.0)),
    'SAFE'
FROM generate_series(0, 120, 2) AS i;

-- Seed Macro Environmental Readings
INSERT INTO macro_readings (time, reach_id, sar_backscatter_db, sar_water_detected, optical_mndwi, optical_ndvi, cwc_water_level_m, cwc_danger_level_m, freeboard_m, rate_of_rise_cm_h, rainfall_72h_mm, hydraulic_warning)
SELECT
    NOW() - (i || ' minutes')::INTERVAL,
    'REACH-MAJULI-01',
    -14.8 + (1.2 * sin(i::float / 8.0)),
    FALSE,
    0.34,
    0.48,
    84.20 + (0.4 * sin(i::float / 10.0)),
    85.50,
    2.30 - (0.4 * sin(i::float / 10.0)),
    1.8,
    46.5,
    FALSE
FROM generate_series(0, 120, 5) AS i;

-- Seed Alert Logs
INSERT INTO alert_logs (id, node_id, zone_name, factor_of_safety, level, channel, recipient, message, sent_at)
VALUES
    ('ALT-DEMO-001', 'NODE-SILCHAR-05', 'Silchar Bethukandi Dyke', 1.28, 'WARNING', 'WHATSAPP_SIMULATED', '+91-94350-XXXXX (DDMA Cachar)', 'Advisory: Soil moisture elevated to 64% at Bethukandi Reach. Inspection team dispatched.', NOW() - INTERVAL '45 minutes'),
    ('ALT-DEMO-002', 'NODE-SILCHAR-05', 'Silchar Bethukandi Dyke', 1.15, 'CRITICAL', 'WHATSAPP_SIMULATED', '+91-94350-XXXXX (DDMA Cachar)', 'Emergency: Micro-acoustic shear spikes detected. Factor of safety approaching critical threshold 1.0.', NOW() - INTERVAL '12 minutes')
ON CONFLICT (id) DO NOTHING;
