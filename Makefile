.PHONY: all run-backend run-frontend build-backend build-frontend test clean help migrate-up migrate-down sqlc-gen docker-up docker-down

all: build-backend build-frontend

help:
	@echo "BorBandh AI Embankment Monitoring System Commands:"
	@echo "  make run-backend    - Start Vanilla Go backend server on port 8080"
	@echo "  make run-frontend   - Start React Vite frontend dev server on port 5173"
	@echo "  make test           - Run all Go unit tests"
	@echo "  make build-backend  - Compile Go binary"
	@echo "  make build-frontend - Build React production static bundle"
	@echo "  make migrate-up     - Run Goose database migrations up"
	@echo "  make migrate-down   - Roll back last Goose migration"
	@echo "  make sqlc-gen       - Compile SQL queries into type-safe Go code with sqlc"
	@echo "  make docker-up      - Spin up PostgreSQL + PostGIS + TimescaleDB & Redis"
	@echo "  make docker-down    - Tear down Docker containers"

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

sqlc-gen:
	cd backend && sqlc generate

migrate-up:
	goose -dir backend/migrations postgres "5457{DATABASE_URL:-postgres://borbandh_app:borbandh_secure_password@localhost:5432/borbandh?sslmode=disable}" up

migrate-down:
	goose -dir backend/migrations postgres "5457{DATABASE_URL:-postgres://borbandh_app:borbandh_secure_password@localhost:5432/borbandh?sslmode=disable}" down

docker-up:
	docker compose up -d

docker-down:
	docker compose down
