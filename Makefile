.PHONY: all run-backend run-frontend build-backend build-frontend test clean help

all: build-backend build-frontend

help:
	@echo "AeroHydro AI Embankment Monitoring System Commands:"
	@echo "  make run-backend    - Start Vanilla Go backend server on port 8080"
	@echo "  make run-frontend   - Start React Vite frontend dev server on port 5173"
	@echo "  make test           - Run all Go unit tests"
	@echo "  make build-backend  - Compile Go binary"
	@echo "  make build-frontend - Build React production static bundle"

run-backend:
	cd backend && go run ./cmd/server

run-frontend:
	cd frontend && npm run dev

test:
	cd backend && go test -v ./...

build-backend:
	cd backend && go build -o bin/server ./cmd/server

build-frontend:
	cd frontend && npm run build

clean:
	rm -rf backend/bin frontend/dist
