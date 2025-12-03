# OpenBudget Local Budgets Viewer (Docker)

This project provides:
- PostgreSQL with auto schema init
- Backend (Node.js + Express) with **config-driven ETL** for the OpenBudget API
- Frontend (React + Mapbox) for basic region selection and budget visualization

## Run

1) Copy envs:
```
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```
Edit `.env` to set `POSTGRES_PASSWORD`.
Set `REACT_APP_MAPBOX_TOKEN` in `frontend/.env`.

2) Build & run:
```
docker-compose up --build
```
- Frontend: http://localhost:3000
- Backend:  http://localhost:5000/api

## Trigger ETL
```
curl -X POST http://localhost:5000/api/sync/openbudget -H "Content-Type: application/json" -d '{"year": 2025}'
```

## Configure real endpoints
Update **backend/src/sync/endpoints.json** with routes from the official Swagger:
`https://api.openbudget.gov.ua/swagger-ui.html` (or your Confluence page).

Raw responses are stored in `api_raw` for debugging.
