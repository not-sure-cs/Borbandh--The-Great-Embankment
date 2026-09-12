package cache

import (
	"context"
	"testing"
	"time"
)

func TestCacheService_FailOpenMode(t *testing.T) {
	// Initialize with empty URL to trigger bypass mode
	cs := NewCacheService("")
	if cs.IsActive() {
		t.Fatalf("Expected cache service to be inactive with empty URL")
	}
	defer cs.Close()

	ctx := context.Background()

	// 1. Test GetOrSetGeoJSON fallback
	called := false
	fallback := func() map[string]interface{} {
		called = true
		return map[string]interface{}{"type": "FeatureCollection"}
	}
	res := cs.GetOrSetGeoJSON(ctx, 1.5, fallback)
	if !called {
		t.Errorf("Expected fallback to be called when cache is inactive")
	}
	if res["type"] != "FeatureCollection" {
		t.Errorf("Expected fallback result, got %v", res)
	}

	// 2. Test ShouldDispatchAlert fail-open guarantee
	dispatch := cs.ShouldDispatchAlert(ctx, "NODE-TEST-01", 10*time.Minute)
	if !dispatch {
		t.Errorf("Expected ShouldDispatchAlert to return true (fail-open) when cache is inactive")
	}

	// 3. Test InvalidateGeoJSON does not panic
	cs.InvalidateGeoJSON(ctx)

	// 4. Test PublishTelemetry does not fail
	err := cs.PublishTelemetry(ctx, map[string]string{"status": "ok"})
	if err != nil {
		t.Errorf("PublishTelemetry returned unexpected error: %v", err)
	}

	// 5. Test SubscribeTelemetry does not block or fail
	cs.SubscribeTelemetry(ctx, func(data []byte) {})
}

func TestCacheService_InvalidURL(t *testing.T) {
	cs := NewCacheService("redis://invalid-host-that-does-not-exist:6379")
	if cs.IsActive() {
		t.Fatalf("Expected cache service to be inactive with invalid host")
	}
	defer cs.Close()
}
