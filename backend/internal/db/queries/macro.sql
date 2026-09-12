-- name: InsertMacroReading :exec
INSERT INTO macro_readings (time, reach_id, sar_backscatter_db, sar_water_detected,
                            optical_mndwi, optical_ndvi, cwc_water_level_m, cwc_danger_level_m,
                            freeboard_m, rate_of_rise_cm_h, rainfall_72h_mm, hydraulic_warning)
VALUES (@time, @reach_id, @sar_backscatter_db, @sar_water_detected,
        @optical_mndwi, @optical_ndvi, @cwc_water_level_m, @cwc_danger_level_m,
        @freeboard_m, @rate_of_rise_cm_h, @rainfall_72h_mm, @hydraulic_warning);

-- name: GetLatestMacroReadingForReach :one
SELECT time, reach_id, sar_backscatter_db, sar_water_detected,
       optical_mndwi, optical_ndvi, cwc_water_level_m, cwc_danger_level_m,
       freeboard_m, rate_of_rise_cm_h, rainfall_72h_mm, hydraulic_warning
FROM macro_readings
WHERE reach_id = @reach_id
ORDER BY time DESC
LIMIT 1;
