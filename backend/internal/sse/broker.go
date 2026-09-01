package sse

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
)

// Event represents an SSE message with an optional event name and JSON payload.
type Event struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// Broker manages active client connections and broadcasts real-time events.
type Broker struct {
	mu         sync.Mutex
	clients    map[chan Event]bool
	register   chan chan Event
	unregister chan chan Event
	broadcast  chan Event
}

// NewBroker creates and starts the SSE event broker.
func NewBroker() *Broker {
	b := &Broker{
		clients:    make(map[chan Event]bool),
		register:   make(chan chan Event),
		unregister: make(chan chan Event),
		broadcast:  make(chan Event, 64),
	}

	go b.run()
	return b
}

func (b *Broker) run() {
	for {
		select {
		case ch := <-b.register:
			b.mu.Lock()
			b.clients[ch] = true
			b.mu.Unlock()
			log.Printf("[SSE] Client connected. Total active listeners: %d", len(b.clients))

		case ch := <-b.unregister:
			b.mu.Lock()
			if _, ok := b.clients[ch]; ok {
				delete(b.clients, ch)
				close(ch)
			}
			b.mu.Unlock()
			log.Printf("[SSE] Client disconnected. Total active listeners: %d", len(b.clients))

		case ev := <-b.broadcast:
			b.mu.Lock()
			for ch := range b.clients {
				select {
				case ch <- ev:
				default:
					// Non-blocking drop if client is lagging
				}
			}
			b.mu.Unlock()
		}
	}
}

// Broadcast dispatches an event to all connected dashboard clients.
func (b *Broker) Broadcast(eventType string, payload interface{}) {
	b.broadcast <- Event{
		Type:    eventType,
		Payload: payload,
	}
}

// ServeHTTP handles the SSE connection stream using standard library http.Flusher.
func (b *Broker) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported by client", http.StatusInternalServerError)
		return
	}

	// SSE response headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	clientChan := make(chan Event, 16)
	b.register <- clientChan

	// Notify initial connection
	fmt.Fprintf(w, "event: connected\ndata: {\"status\":\"connected\"}\n\n")
	flusher.Flush()

	defer func() {
		b.unregister <- clientChan
	}()

	notify := r.Context().Done()

	for {
		select {
		case <-notify:
			return
		case ev, ok := <-clientChan:
			if !ok {
				return
			}
			data, err := json.Marshal(ev.Payload)
			if err != nil {
				continue
			}
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", ev.Type, string(data))
			flusher.Flush()
		}
	}
}
