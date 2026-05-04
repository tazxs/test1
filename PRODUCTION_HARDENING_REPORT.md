# Production Hardening: Observability & Resilience Complete

## Summary

NalogAI now has Sentry error capture, structured JSON production logs, external API circuit breakers, and Redis-backed BullMQ notification processing.

## Health Metrics

- Backend health: [http://localhost:4000/api/health](http://localhost:4000/api/health)
- Production/frontend proxy health: `/api/health`

The health payload now includes:

- `observability.sentry` for backend Sentry initialization state.
- `observability.logging.format` and `observability.logging.userIdFilterable`.
- `observability.circuits[]` for Groq and eGov/ISNA breaker state, failures, rejects, timeouts, and latency.
- `notifications.queue` for BullMQ Redis connection, job counts, retry policy, cleanup caps, and the 64MB queue budget.

## Resilience Controls

- Groq calls and eGov/ISNA calls are protected by opossum circuit breakers.
- Repeated provider failures return `503` with `AI_SERVICE_ERROR` instead of hanging request handlers.
- Telegram and email sends are queued as compact BullMQ jobs.
- Notification jobs use 3 attempts with exponential backoff and capped completed/failed retention.
- Queue state is designed to stay under 64MB, which is 25% of the 256MB Redis production limit.

## Secret Handling

- Backend Sentry uses `SENTRY_DSN`.
- Frontend Sentry uses `VITE_SENTRY_DSN`.
- Optional source-map upload uses `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT`.
- No Sentry DSNs or tokens are hardcoded in source, Docker, or Nginx config.

## Verification

- Backend typecheck: `npm run typecheck --workspace=backend`
- Frontend typecheck: `npm run typecheck --workspace=frontend`
- Backend tests: `npm run test --workspace=backend -- --run`
- Frontend tests: `npm run test --workspace=frontend -- --run`
- Backend build: `npm run build --workspace=backend`
- Frontend build: `npm run build --workspace=frontend`
- Focused backend tests cover circuit breaker failure injection and notification queue retry/budget behavior.
- Focused frontend tests cover crash fallback rendering and Sentry capture.
- Live Redis durability check against `redis://127.0.0.1:6380`: job persisted as `waiting` after queue close/reopen and completed after worker restart.
