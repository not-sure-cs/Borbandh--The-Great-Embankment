package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	"borbandh/backend/internal/alerting"
	"borbandh/backend/internal/cache"
	"borbandh/backend/internal/calculator"
	"borbandh/backend/internal/handlers"
	"borbandh/backend/internal/ingestion"
	"borbandh/backend/internal/middleware"
	"borbandh/backend/internal/ml"
	"borbandh/backend/internal/simulator"
	"borbandh/backend/internal/sse"
	"borbandh/backend/internal/store"
)

func main() {
	// Load environment configuration from .env file
	if err := godotenv.Load(); err != nil {
		// Fallback: If launched from backend/ subdirectory, load from parent directory
		if errParent := godotenv.Load("../.env"); errParent == nil {
			log.Println("[ENV] Successfully loaded environment configuration from ../.env")
		} else {
			log.Println("[ENV] Notice: No .env file found in working directory or parent. Using system environment.")
		}
	} else {
		log.Println("[ENV] Successfully loaded environment configuration from .env")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Println("==================================================================")
	log.Println("   BorBandh AI Embankment Monitoring System - Go Backend")
	log.Println("   Architecture: PostGIS + TimescaleDB + Redis 7 Pub/Sub")
	log.Println("==================================================================")

	// 1. Initialize Persistent Store (Dual-Mode: PostgresStore if DATABASE_URL/TIMESCALE_URL is set, else MemoryStore)
	var st store.Store
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = os.Getenv("TIMESCALE_URL")
	}
	if dbURL == "" {
		dbURL = os.Getenv("POSTGRES_URL")
	}
	if dbURL != "" {
		pgStore, err := store.NewPostgresStore(context.Background(), dbURL)
		if err != nil {
			log.Printf("[STORE WARNING] Failed to connect to PostgreSQL (%v). Falling back to MemoryStore.", err)
			st = store.NewStore()
		} else {
			st = pgStore
			defer pgStore.Close()
		}
	} else {
		log.Println("[STORE] No DATABASE_URL specified. Initializing in-memory fallback store.")
		st = store.NewStore()
	}

	// 2. Initialize Redis Caching & Distributed Pub/Sub Layer
	redisURL := os.Getenv("REDIS_URL")
	cacheSvc := cache.NewCacheService(redisURL)
	defer cacheSvc.Close()

	// 3. Initialize Emergency Alert Dispatcher (Twilio / WhatsApp Mock & Logs)
	disp := alerting.NewDispatcher(st)

	// 4. Initialize Standard Library SSE Real-Time Stream Broker
	broker := sse.NewBroker()

	// If Redis is active, subscribe to global telemetry Pub/Sub channel and route to local SSE clients
	if cacheSvc.IsActive() {
		cacheSvc.SubscribeTelemetry(context.Background(), func(data []byte) {
			broker.Broadcast("telemetry_raw", string(data))
		})
	}

	// 5. Initialize Native Pure-Go Machine Learning Subsystem (TFT-PINN + RobustScaler)
	// Zero Python runtime dependency: checkpoint loaded directly via Go archive/zip
	pthPath, err := ml.FindModelFile(os.Getenv("MODEL_PTH_PATH"))
	var activeMLEngine *ml.InferenceEngine
	if err != nil {
		log.Printf("[ML NOTICE] Model file best_tft_pinn_embankment.pth not found (%v). Using physics fallback.", err)
	} else {
		model, err := ml.LoadWeightsFromPTH(pthPath)
		if err != nil {
			log.Printf("[ML ERROR] Failed to load TFT-PINN weights from %s (%v). Using physics fallback.", pthPath, err)
		} else {
			scaler := ml.NewEmbankmentRobustScaler()
			activeMLEngine = ml.NewInferenceEngine(model, scaler)
			calculator.SetMLEngine(activeMLEngine)
			log.Printf("[ML ENGINE] Successfully initialized TFT-PINN embankment model from %s (98 tensors loaded, zero Python dependency).", pthPath)
		}
	}

	// 6. Initialize Data Ingestion Engine & Outbound API Data Collector
	ingestEngine := ingestion.NewIngestionEngine(st)
	collector := ingestion.NewDataCollector(ingestEngine, st)
	collector.Start(context.Background())

	// 7. Initialize Background IoT Telemetry Simulator
	sim := simulator.NewSimulator(st, disp, broker)
	sim.Start()

	// 8. Initialize Handlers and Register Routes on Standard http.ServeMux
	apiHandler := handlers.NewAPIHandler(st, broker, sim, activeMLEngine)
	mux := http.NewServeMux()
	apiHandler.RegisterRoutes(mux)

	// 8. Wrap with Middleware Chain (Recovery, CORS, Logger)
	handler := middleware.Chain(mux, middleware.Recovery, middleware.CORS, middleware.Logger)

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 0, // Set to 0 to support indefinite SSE streaming
		IdleTimeout:  60 * time.Second,
	}

	// 9. Start Server in Goroutine
	go func() {
		log.Printf("[SERVER] Listening on http://localhost:%s", port)
		log.Printf("[SERVER] Health endpoint: http://localhost:%s/api/v1/health", port)
		log.Printf("[SERVER] Real-time SSE stream: http://localhost:%s/api/v1/stream", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[FATAL] Server startup failed: %v", err)
		}
	}()

	// 10. Graceful Shutdown Listener
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM, syscall.SIGINT)

	sig := <-stopChan
	log.Printf("[SHUTDOWN] Received signal %v. Initiating graceful shutdown...", sig)

	sim.Stop()
	collector.Stop()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Printf("[SHUTDOWN ERROR] Force closed: %v", err)
	} else {
		log.Println("[SHUTDOWN] BorBandh Backend stopped gracefully.")
	}
	fmt.Println("Server terminated cleanly.")
}
