# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An Express proxy in front of several MOPH (Thai Ministry of Public Health) APIs. It handles upstream authentication (token fetch/cache/refresh), API-key protection for callers, and transparently forwards requests to the right upstream. Node.js (CommonJS, no build step, no framework beyond Express). Code comments are written in Thai — keep that convention.

## Commands

```bash
npm run dev          # start dev server (nodemon src/index.js)
npm test             # run unit tests (node --test "test/unit/*.test.js")
docker compose up -d # start local Redis only (for token cache sharing)
```

- Dev config comes from `nodemon.json` (copy from `nodemon.example.json`). `MOPH_HCODE` is required — the process exits at startup without it (`src/config/index.js`).
- **Before every commit / tag**, update `CHANGELOG.md` (Keep a Changelog format) using `Added`/`Changed`/`Fixed`/`Removed`/`Security` sections:
  - On each commit: record user-facing changes under `[Unreleased]`.
  - On each release: move `[Unreleased]` entries under a new version heading with the date (matching the `package.json` bump), then create the git tag (`vX.Y.Z`).
- Body limits mirror the FDH docs: JSON up to `BODY_LIMIT` (default `6mb`, doc allows 5MB/request); multipart uploads (e.g. 16-files import `/api/v2/data_hub/16_files`, ≤50MB total) are capped at 60MB in the proxy (`src/api/proxy/index.js`).
- Unit tests live in `test/unit/*.test.js` and use Node's built-in `node:test` + `node:assert/strict` (no test framework dependency). Each file runs in its own process and modules read env at `require` time — so every file sets the env it needs at the top, **before** requiring `src/` (e.g. point `MOPH_IC_AUTH`/`MOPH_IC_API` at a fake upstream). `test/helpers/fake-upstream.js` is an in-process HTTP server that mimics the MOPH upstreams (`/token`, `/api/echo`, 401-once `/api/stale`, gzip error, slow, 1MB binary) and records every request it receives. `API_KEY_FILE` overrides where `keygen` stores the API-key file so tests never touch `.authorized_key/.access.key`. The files in `test/*.http` are VS Code REST Client requests for exercising a running server, not automated tests.
- Production: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d` (uses `moph-api-proxy.env`, image from ghcr.io). CI (`.github/workflows/cicd.yml`) builds/pushes the image and redeploys the dev server via SSH on every push to `main`.

## Architecture

### Request flow

1. `src/index.js` — `GET /healthz` (liveness: always 200; used by the Docker healthcheck) and `GET /readyz` (readiness: 503 until both `mophic`/`fdh` tokens exist in cache).
2. `src/web/` — EJS pages mounted next: home (endpoint list + docs links), `/change-password`, `/api-key`. Not behind API-key auth.
3. `src/middleware/use-auth.js` — when `USE_API_KEY=true`, requires `x-api-key` (header or query, verified against `.authorized_key/.access.key` via uuid-apikey; file persists in a Docker volume in prod). The query `x-api-key` is stripped before proxying.
4. `src/api/proxy/index.js` — single catch-all route. Selects the upstream via the `endpoint` query param or `x-api-endpoint` header, **deletes that param**, rebuilds the query string, and forwards. JSON bodies pass through; multipart is parsed with formidable and rebuilt with form-data (streams files); anything else → 415. All upstream calls use `responseType: 'stream'` and pipe to the client (never forward `content-length`); error bodies are buffered (1MB cap) back into `error.response.data` so the central handler can send them. Every request logs one correlation line `proxy: [<id>] <method> <path> -> <upstream-host> <status> <duration>ms` — grep the short id to follow a single request through the logs.
5. `src/index.js` — central error handler mirrors upstream status/body to the caller, forwarding only a safe subset of headers (`content-type`, `location`) since axios already decompressed the body (504 with details on timeout).
6. Graceful shutdown: on SIGTERM/SIGINT the server stops accepting connections, waits (max 10s) for in-flight requests, closes the cache connection, then exits — the CI redeploy does not cut proxied requests mid-flight.

### Upstream clients and token "apps" (`src/http/index.js`)

`getClient(endpoint)` returns one of five axios instances:

| endpoint   | base URL env       | default host                     | token app |
| ---------- | ------------------ | -------------------------------- | --------- |
| *(default)* | `MOPH_IC_API`      | `https://cvp1.moph.go.th`        | `mophic`  |
| `epidem`   | `EPIDEM_API`       | `https://epidemcenter.moph.go.th/epidem` | `mophic` |
| `phr`      | `MOPH_PHR_API`     | `https://phr1.moph.go.th`        | `mophic`  |
| `claim`    | `MOPH_CLAIM_API`   | `https://claim-nhso.moph.go.th`  | `fdh`     |
| `fdh`      | `FDH_API`          | `https://fdh.moph.go.th`         | `fdh`     |

Key subtlety: **FDH is the identity provider for the claim endpoints, but the claim APIs themselves live on `claim-nhso.moph.go.th`.** Pointing `MOPH_CLAIM_API` at `fdh.moph.go.th` produces `404 Cannot POST ...` from upstream (this has happened in production).

Tokens (`getToken`):
- Fetched via `POST /token?Action=get_moph_access_token` with `{user, password_hash, hospital_code}` — the password is HMAC-hashed with an app-specific secret (`MOPH_IC_AUTH_SECRET` / `FDH_AUTH_SECRET`).
- Two apps: `mophic` (shared by ic/epidem/phr) and `fdh` (claim/fdh). Cache keys: `<app>-auth-token` (TTL = exp − 60s) and `<app>-auth-payload` (the hashed credentials, so tokens refresh after restart without re-entering the password).
- Request interceptor injects `Bearer`; response interceptor retries once with a forced-refresh token on upstream 401 (PHR also on 501).
- Credentials are (re)set through `POST /api/auth/change-password?app=mophic|fdh`.
- `axios-retry` adds `HTTP_RETRIES` retries (default 1) for network errors/timeouts; HTTP status errors (like 404) are **not** retried. The default keeps the worst-case budget ≈ 2 × `HTTP_TIMEOUT_MS` so callers (HIS) time out first, not the proxy.

### Cache (`src/cache/index.js`)

Redis-first with a one-way fallback: if `REDIS_HOST` is unset or any Redis operation fails, the process permanently switches to an in-memory `Map` mimicking the Redis API (tokens then die on restart and are not shared between instances).

## Gotchas

- The proxy forwards the path verbatim — a 404 `Cannot POST <path>` response usually means the client used a path that doesn't exist on the selected upstream host (e.g. an FDH path with `endpoint=claim`), not a proxy routing bug.
- `query-string` v7 `stringify` handles rebuilding query params after `endpoint` removal; keep the strip-then-rebuild order or the `endpoint` param leaks upstream.
- Home page (`src/web/home/index.js`) is the de-facto registry of example endpoint paths per upstream — update it when upstreams change.
