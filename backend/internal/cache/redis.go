package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

// CacheService wraps Redis client with fail-open graceful bypass.
type CacheService struct {
	client *redis.Client
	active bool
}

// NewCacheService initializes the Redis client or falls back to direct bypass mode.
func NewCacheService(redisURL string) *CacheService {
	if redisURL == "" {
		log.Println("[Cache] Redis URL not configured. Operating in direct bypass mode.")
		return &CacheService{active: false}
	}

	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Printf("[Cache] Invalid Redis URL (%v). Bypassing cache.", err)
		return &CacheService{active: false}
	}

	opts.PoolSize = 50
	opts.MinIdleConns = 10
	opts.DialTimeout = 3 * time.Second
	opts.ReadTimeout = 1 * time.Second
	opts.WriteTimeout = 1 * time.Second

	rdb := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Printf("[Cache] Redis ping failed (%v). Running without cache.", err)
		return &CacheService{active: false}
	}

	log.Println("[Cache] Connected to Redis 7 successfully.")
	return &CacheService{client: rdb, active: true}
}

func (c *CacheService) IsActive() bool {
	return c.active
}

func (c *CacheService) Close() {
	if c.active && c.client != nil {
		_ = c.client.Close()
	}
}

// GetOrSetGeoJSON caches heavy GeoJSON payloads for 10 minutes.
func (c *CacheService) GetOrSetGeoJSON(ctx context.Context, stageDelta float64, fallback func() map[string]interface{}) map[string]interface{} {
	if !c.active {
		return fallback()
	}

	cacheKey := fmt.Sprintf("geo:embankments:delta:%.1f", stageDelta)

	// 1. Check Cache Hit
	val, err := c.client.Get(ctx, cacheKey).Bytes()
	if err == nil {
		var result map[string]interface{}
		if json.Unmarshal(val, &result) == nil {
			return result
		}
	}

	// 2. Cache Miss: compute from store
	data := fallback()

	// 3. Set Cache (Async)
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		if raw, err := json.Marshal(data); err == nil {
			_ = c.client.Set(bgCtx, cacheKey, raw, 10*time.Minute).Err()
		}
	}()

	return data
}

// InvalidateGeoJSON clears cached GeoJSON whenever reaches or breach data update.
func (c *CacheService) InvalidateGeoJSON(ctx context.Context) {
	if !c.active {
		return
	}
	keys, err := c.client.Keys(ctx, "geo:embankments:delta:*").Result()
	if err == nil && len(keys) > 0 {
		_ = c.client.Del(ctx, keys...).Err()
	}
}

// ShouldDispatchAlert checks atomic lock preventing SMS spam (SET lock NX EX 600s).
// Returns true if alert should be sent; returns false if debounced within window.
func (c *CacheService) ShouldDispatchAlert(ctx context.Context, nodeID string, debounceWindow time.Duration) bool {
	if !c.active {
		return true // Fail-open: always send alerts if cache offline
	}

	lockKey := fmt.Sprintf("alert:debounce:%s", nodeID)
	acquired, err := c.client.SetNX(ctx, lockKey, "1", debounceWindow).Result()
	if err != nil {
		return true // Fail-open for safety
	}

	return acquired
}

// PublishTelemetry broadcasts telemetry pings to distributed backend cluster for SSE fanout.
func (c *CacheService) PublishTelemetry(ctx context.Context, payload interface{}) error {
	if !c.active {
		return nil
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return c.client.Publish(ctx, "channel:telemetry:stream", raw).Err()
}

// SubscribeTelemetry listens for distributed telemetry events to push to local SSE clients.
func (c *CacheService) SubscribeTelemetry(ctx context.Context, onMessage func(data []byte)) {
	if !c.active {
		return
	}

	pubsub := c.client.Subscribe(ctx, "channel:telemetry:stream")
	ch := pubsub.Channel()

	go func() {
		for msg := range ch {
			onMessage([]byte(msg.Payload))
		}
	}()
}
