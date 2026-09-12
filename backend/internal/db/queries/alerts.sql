-- name: InsertAlertLog :exec
INSERT INTO alert_logs (id, node_id, zone_name, factor_of_safety, level, channel, recipient, message, sent_at)
VALUES (@id, @node_id, @zone_name, @factor_of_safety, @level, @channel, @recipient, @message, @sent_at);

-- name: ListRecentAlerts :many
SELECT id, node_id, zone_name, factor_of_safety, level, channel, recipient, message, sent_at
FROM alert_logs
ORDER BY sent_at DESC
LIMIT @limit_count;
