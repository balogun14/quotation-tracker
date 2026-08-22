# Quotely

Rental-business quotation tracking: shared workspaces, branded PDF quotes,
follow-up automation, public accept/decline links, and multi-currency reporting.

## Repository layout

- `src/` — React/Vite frontend (prototype; being connected to the API).
- `server/` — TypeScript/Express backend (`/api/v1`), background job worker,
  SQLite via Drizzle.
- `docs/` — `prd-backend.md` (requirements) and `operations.md` (ops runbook).
- `scripts/backup.sh` — encrypted off-host daily backup (age + rclone).
- `docker-compose.yml` — api + worker containers on a single VPS.

## Backend quick start

Requirements: Node 24+, npm.

```sh
cd server
npm ci
npm run typecheck
npm test            # vitest (NODE_ENV=test)
npm run dev         # tsx watch, API on http://localhost:3000
```

In a second terminal, start the job worker:

```sh
cd server
npm run worker
```

OpenAPI spec: `GET http://localhost:3000/api/v1/openapi.json`.

Set `NODE_ENV=test` when running tests from a shell that defaults to
`production` — the config layer refuses the dev-only default `JWT_SECRET` in
production mode.

## Docker deployment

Build and run the full stack (API + worker, shared `./data` volume):

```sh
docker compose up -d --build
curl http://localhost:3000/health
```

Configuration: copy `server/.env.example` to `.env` (repo root), set
`JWT_SECRET`, `PUBLIC_BASE_URL`, `CORS_ORIGIN`, and optionally
`EMAIL_PROVIDER=resend` + `RESEND_API_KEY`. See `docs/operations.md` for
deployment, backups, restore, and monitoring.
