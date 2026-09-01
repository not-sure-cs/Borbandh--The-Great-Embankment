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

	"aero_hydro/backend/internal/alerting"
	"aero_hydro/backend/internal/handlers"
	"aero_hydro/backend/internal/middleware"
	"aero_hydro/backend/internal/simulator"
	"aero_hydro/backend/internal/sse"
	"aero_hydro/backend/internal/store"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Println("==================================================================")
	log.Println("   AeroHydro AI Embankment Monitoring System - Go Backend")
	log.Println("   Architecture: 100% Vanilla Go Standard Library (Zero Frameworks)")
	log.Println("==================================================================")

	// 1. Initialize Thread-Safe Persistent Store & Seed Data
	st := store.NewStore()

	// 2. Initialize Emergency Alert Dispatcher (Twilio / WhatsApp Mock & Logs)
	disp := alerting.NewDispatcher(st)

	// 3. Initialize Standard Library SSE Real-Time Stream Broker
	broker := sse.NewBroker()

	// 4. Initialize Background IoT Telemetry Simulator
	sim := simulator.NewSimulator(st, disp, broker)
	sim.Start()

	// 5. Initialize Handlers and Register Routes on Standard http.ServeMux
	apiHandler := handlers.NewAPIHandler(st, broker, sim)
	mux := http.NewServeMux()
	apiHandler.RegisterRoutes(mux)

	// 6. Wrap with Middleware Chain (Recovery, CORS, Logger)
	handler := middleware.Chain(mux, middleware.Recovery, middleware.CORS, middleware.Logger)

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 0, // Set to 0 to support indefinite SSE streaming
		IdleTimeout:  60 * time.Second,
	}

	// 7. Start Server in Goroutine
	go func() {
		log.Printf("[SERVER] Listening on http://localhost:%s", port)
		log.Printf("[SERVER] Health endpoint: http://localhost:%s/api/v1/health", port)
		log.Printf("[SERVER] Real-time SSE stream: http://localhost:%s/api/v1/stream", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[FATAL] Server startup failed: %v", err)
		}
	}()

	// 8. Graceful Shutdown Listener
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM, syscall.SIGINT)

	sig := <-stopChan
	log.Printf("[SHUTDOWN] Received signal %v. Initiating graceful shutdown...", sig)

	sim.Stop()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Printf("[SHUTDOWN ERROR] Force closed: %v", err)
	} else {
		log.Println("[SHUTDOWN] AeroHydro Backend stopped gracefully.")
	}
	fmt.Println("Server terminated cleanly.")
}
