-- name: InsertNode :exec
INSERT INTO embankment_nodes (node_id, zone_name, river, geom, elevation_m, battery_voltage, firmware_ver, last_seen)
VALUES (@node_id, @zone_name, @river, ST_SetSRID(ST_MakePoint(@longitude::float8, @latitude::float8), 4326), @elevation_m, @battery_voltage, @firmware_ver, @last_seen)
ON CONFLICT (node_id) DO UPDATE SET
    zone_name = EXCLUDED.zone_name,
    battery_voltage = EXCLUDED.battery_voltage,
    last_seen = EXCLUDED.last_seen;

-- name: GetNode :one
SELECT node_id, zone_name, river, ST_X(geom) AS longitude, ST_Y(geom) AS latitude,
       elevation_m, battery_voltage, firmware_ver, created_at, last_seen
FROM embankment_nodes
WHERE node_id = @node_id;

-- name: ListNodes :many
SELECT node_id, zone_name, river, ST_X(geom) AS longitude, ST_Y(geom) AS latitude,
       elevation_m, battery_voltage, firmware_ver, created_at, last_seen
FROM embankment_nodes
ORDER BY node_id ASC;
