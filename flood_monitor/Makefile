.PHONY: up down build migrate logs restart clean

up:
	docker compose --env-file .env.docker up -d

down:
	docker compose down

build:
	docker compose --env-file .env.docker build

migrate:
	docker compose --env-file .env.docker run --rm migrate

logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

logs-detection:
	docker compose logs -f detection

restart:
	docker compose --env-file .env.docker restart

restart-backend:
	docker compose --env-file .env.docker restart backend

clean:
	docker compose down -v
	docker system prune -f

dev:
	docker compose -f docker-compose.dev.yml up

dev-down:
	docker compose -f docker-compose.dev.yml down

status:
	docker compose ps