-- name: InsertNodeTelemetry :exec
INSERT INTO node_telemetry (time, node_id, soil_moisture, tilt_angle, audio_rms, factor_of_safety, status)
VALUES (@time, @node_id, @soil_moisture, @tilt_angle, @audio_rms, @factor_of_safety, @status);

-- name: GetLatestTelemetryForNode :one
SELECT time, node_id, soil_moisture, tilt_angle, audio_rms, factor_of_safety, status
FROM node_telemetry
WHERE node_id = @node_id
ORDER BY time DESC
LIMIT 1;

-- name: GetRecentTelemetryHistory :many
SELECT time, node_id, soil_moisture, tilt_angle, audio_rms, factor_of_safety, status
FROM node_telemetry
WHERE (@node_id::text = '' OR node_id = @node_id)
ORDER BY time DESC
LIMIT @limit_count;
