-- name: GetAllReaches :many
SELECT id, name, river, district, length_km, crest_elevation, base_width_m,
       embankment_type, vulnerable, active_node_id,
       ST_AsGeoJSON(centerline)::text AS centerline_geojson,
       ST_AsGeoJSON(buffer_50m)::text AS buffer_geojson,
       last_survey_date
FROM embankment_reaches
ORDER BY id ASC;

-- name: InsertReach :exec
INSERT INTO embankment_reaches (id, name, river, district, length_km, crest_elevation, base_width_m,
                                embankment_type, vulnerable, active_node_id, centerline, buffer_50m, last_survey_date)
VALUES (@id, @name, @river, @district, @length_km, @crest_elevation, @base_width_m,
        @embankment_type, @vulnerable, @active_node_id, ST_GeomFromGeoJSON(@centerline_json::text), ST_GeomFromGeoJSON(@buffer_json::text), @last_survey_date)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    vulnerable = EXCLUDED.vulnerable,
    last_survey_date = EXCLUDED.last_survey_date;
