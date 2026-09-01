package middleware

import (
	"encoding/json"
	"log"
	"net/http"
	"time"
)

// ResponseWriter wrapper to capture HTTP status codes for logging.
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// Chain combines multiple standard library http.Handler middlewares.
func Chain(h http.Handler, middlewares ...func(http.Handler) http.Handler) http.Handler {
	for i := len(middlewares) - 1; i >= 0; i-- {
		h = middlewares[i](h)
	}
	return h
}

// CORS wraps an http.Handler with Cross-Origin Resource Sharing headers.
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// Logger wraps an http.Handler to log method, path, and duration.
func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		
		next.ServeHTTP(rw, r)
		
		log.Printf("[HTTP] %s %s | %d | %v", r.Method, r.URL.Path, rw.statusCode, time.Since(start))
	})
}

// Recovery catches panics and returns a 500 JSON response gracefully.
func Recovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("[PANIC RECOVERED] %v", err)
				WriteJSON(w, http.StatusInternalServerError, map[string]string{
					"error": "Internal server error",
				})
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// WriteJSON sends a JSON response with proper Content-Type header.
func WriteJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("[JSON ENCODE ERROR] %v", err)
	}
}

// ReadJSON decodes JSON request body into a target struct.
func ReadJSON(r *http.Request, target interface{}) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(target)
}

// WriteError sends a standard error JSON response.
func WriteError(w http.ResponseWriter, status int, message string) {
	WriteJSON(w, status, map[string]interface{}{
		"error":   true,
		"message": message,
	})
}
