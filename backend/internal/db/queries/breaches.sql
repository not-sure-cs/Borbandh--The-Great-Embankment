-- name: ListBreaches :many
SELECT id, reach_id, location_name, river, ST_X(geom) AS longitude, ST_Y(geom) AS latitude,
       breach_date, breach_width_m, peak_discharge_m3s, failure_mechanism, impact_description,
       remediation_status, severity
FROM breach_records
ORDER BY breach_date DESC;

-- name: InsertBreach :exec
INSERT INTO breach_records (id, reach_id, location_name, river, geom, breach_date, breach_width_m,
                            peak_discharge_m3s, failure_mechanism, impact_description, remediation_status, severity)
VALUES (@id, @reach_id, @location_name, @river, ST_SetSRID(ST_MakePoint(@longitude::float8, @latitude::float8), 4326), @breach_date, @breach_width_m,
        @peak_discharge_m3s, @failure_mechanism, @impact_description, @remediation_status, @severity)
ON CONFLICT (id) DO NOTHING;
