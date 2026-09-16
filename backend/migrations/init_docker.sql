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

-- Convert to TimescaleDB hypertables
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        PERFORM create_hypertable('node_telemetry', 'time', if_not_exists => TRUE, chunk_time_interval => INTERVAL '7 days');
        PERFORM create_hypertable('macro_readings', 'time', if_not_exists => TRUE, chunk_time_interval => INTERVAL '14 days');
    END IF;
END $$;

-- 7. Seed Initial Baseline Stations & Reaches
INSERT INTO embankment_nodes (node_id, zone_name, river, geom, elevation_m, battery_voltage, firmware_ver, created_at, last_seen)
VALUES 
    ('NODE-MAJULI-01', 'Majuli Island - Kamalabari Dyke', 'Brahmaputra', ST_SetSRID(ST_MakePoint(94.1873, 26.9452), 4326), 84.50, 4.12, 'ESPHome-BorBandh-v1.4.2', NOW() - INTERVAL '30 days', NOW()),
    ('NODE-DIBRUGARH-02', 'Dibrugarh Town Protection Dyke', 'Brahmaputra', ST_SetSRID(ST_MakePoint(94.9120, 27.4728), 4326), 108.00, 4.05, 'ESPHome-BorBandh-v1.4.2', NOW() - INTERVAL '30 days', NOW()),
    ('NODE-TEZPUR-03', 'Tezpur Bhomoraguri Guide Bund', 'Brahmaputra', ST_SetSRID(ST_MakePoint(92.7926, 26.6338), 4326), 72.00, 4.18, 'ESPHome-BorBandh-v1.4.2', NOW() - INTERVAL '30 days', NOW()),
    ('NODE-GUWAHATI-04', 'Guwahati Saraighat Flood Defense', 'Brahmaputra', ST_SetSRID(ST_MakePoint(91.6854, 26.1738), 4326), 54.00, 4.10, 'ESPHome-BorBandh-v1.4.2', NOW() - INTERVAL '30 days', NOW()),
    ('NODE-SILCHAR-05', 'Silchar Bethukandi Dyke', 'Barak', ST_SetSRID(ST_MakePoint(92.7789, 24.8333), 4326), 26.50, 3.98, 'ESPHome-BorBandh-v1.4.2', NOW() - INTERVAL '30 days', NOW())
ON CONFLICT (node_id) DO NOTHING;

INSERT INTO embankment_reaches (id, name, river, district, length_km, crest_elevation, base_width_m, embankment_type, vulnerable, active_node_id, centerline, last_survey_date)
VALUES
    ('REACH-MAJULI-01', 'Majuli Kamalabari Reach', 'Brahmaputra', 'Majuli', 18.40, 86.50, 22.00, 'Earthen Bund with Boulder Pitching', TRUE, 'NODE-MAJULI-01', ST_SetSRID(ST_GeomFromText('LINESTRING(94.1350 26.9240, 94.1620 26.9370, 94.1873 26.9452, 94.2180 26.9560, 94.2510 26.9620)'), 4326), '2026-04-12'),
    ('REACH-DIBRUGARH-02', 'Dibrugarh Town Protection Dyke', 'Brahmaputra', 'Dibrugarh', 9.60, 110.00, 28.00, 'Reinforced Concrete Sluice & Boulder Apron', FALSE, 'NODE-DIBRUGARH-02', ST_SetSRID(ST_GeomFromText('LINESTRING(94.8650 27.4480, 94.8950 27.4650, 94.9120 27.4728, 94.9380 27.4815, 94.9520 27.4850)'), 4326), '2026-03-20'),
    ('REACH-TEZPUR-03', 'Tezpur Bhomoraguri Guide Bund', 'Brahmaputra', 'Sonitpur', 6.20, 71.50, 20.00, 'Earthen Bund with Stone Pitching', FALSE, 'NODE-TEZPUR-03', ST_SetSRID(ST_GeomFromText('LINESTRING(92.7600 26.6120, 92.7880 26.6290, 92.7926 26.6338, 92.8150 26.6470, 92.8280 26.6520)'), 4326), '2026-01-15'),
    ('REACH-GUWAHATI-04', 'Guwahati Saraighat Flood Defense', 'Brahmaputra', 'Kamrup Metropolitan', 5.80, 56.50, 18.00, 'Concrete Flood Wall & Sheet Piling', FALSE, 'NODE-GUWAHATI-04', ST_SetSRID(ST_GeomFromText('LINESTRING(91.6500 26.1580, 91.6780 26.1710, 91.6854 26.1738, 91.7080 26.1805, 91.7200 26.1820)'), 4326), '2026-02-10'),
    ('REACH-SILCHAR-05', 'Silchar Bethukandi Dyke', 'Barak', 'Cachar', 12.10, 27.20, 16.00, 'Earthen Dyke & Sluice Gate Regulator', TRUE, 'NODE-SILCHAR-05', ST_SetSRID(ST_GeomFromText('LINESTRING(92.7400 24.8050, 92.7680 24.8260, 92.7789 24.8333, 92.8050 24.8450, 92.8200 24.8490)'), 4326), '2026-05-01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO breach_records (id, reach_id, location_name, river, geom, breach_date, breach_width_m, peak_discharge_m3s, failure_mechanism, impact_description, remediation_status, severity)
VALUES
    ('BREACH-2022-SILCHAR', 'REACH-SILCHAR-05', 'Bethukandi Sluice Dyke, Barak River', 'Barak', ST_SetSRID(ST_MakePoint(92.7710, 24.8280), 4326), '2022-06-19', 85.00, 1250.00, 'Human Inundation Cut / Backflow Overtopping', 'Catastrophic inundation of Silchar urban district affecting 300k residents', 'RECONSTRUCTED_GEO_TUBES', 'CATASTROPHIC'),
    ('BREACH-2020-MAJULI', 'REACH-MAJULI-01', 'Kamalabari Dyke Segment 3, Majuli', 'Brahmaputra', ST_SetSRID(ST_MakePoint(94.1950, 26.9480), 4326), '2020-07-14', 45.00, 680.00, 'Subterranean Sand Boiling & Piping Erosion', 'Inundated agricultural wetlands in southern Majuli; emergency sandbagged', 'REINFORCED_BOULDER_APRON', 'SEVERE')
ON CONFLICT (id) DO NOTHING;

-- Seed initial telemetry history for the past 60 minutes
INSERT INTO node_telemetry (time, node_id, soil_moisture, tilt_angle, audio_rms, factor_of_safety, status)
SELECT 
    NOW() - (i || ' minutes')::INTERVAL,
    'NODE-MAJULI-01',
    42.0 + (5.0 * sin(i::float / 5.0)),
    1.1 + (0.3 * cos(i::float / 4.0)),
    140.0 + (25.0 * sin(i::float / 3.0)),
    1.72 - (0.05 * sin(i::float / 5.0)),
    'SAFE'
FROM generate_series(0, 60, 2) AS i;

INSERT INTO node_telemetry (time, node_id, soil_moisture, tilt_angle, audio_rms, factor_of_safety, status)
SELECT 
    NOW() - (i || ' minutes')::INTERVAL,
    'NODE-DIBRUGARH-02',
    38.0 + (4.0 * cos(i::float / 6.0)),
    0.9 + (0.2 * sin(i::float / 5.0)),
    120.0 + (18.0 * cos(i::float / 4.0)),
    1.84 - (0.04 * cos(i::float / 6.0)),
    'SAFE'
FROM generate_series(0, 60, 2) AS i;

INSERT INTO node_telemetry (time, node_id, soil_moisture, tilt_angle, audio_rms, factor_of_safety, status)
SELECT 
    NOW() - (i || ' minutes')::INTERVAL,
    'NODE-SILCHAR-05',
    58.0 + (6.0 * sin(i::float / 4.0)),
    2.1 + (0.4 * cos(i::float / 3.0)),
    260.0 + (40.0 * sin(i::float / 2.0)),
    1.28 - (0.08 * sin(i::float / 4.0)),
    'WATCH'
FROM generate_series(0, 60, 2) AS i;

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
FROM generate_series(0, 60, 5) AS i;

INSERT INTO alert_logs (id, node_id, zone_name, factor_of_safety, level, channel, recipient, message, sent_at)
VALUES
    ('ALT-DEMO-001', 'NODE-SILCHAR-05', 'Silchar Bethukandi Dyke', 1.28, 'WARNING', 'WHATSAPP_SIMULATED', '+91-94350-XXXXX (DDMA Cachar)', 'Advisory: Soil moisture elevated to 64% at Bethukandi Reach. Inspection team dispatched.', NOW() - INTERVAL '45 minutes')
ON CONFLICT (id) DO NOTHING;
