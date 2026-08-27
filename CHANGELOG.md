# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.3.0] - 2026-08-27

### Added

- Unit test suite (`npm test`, Node's built-in `node:test` — no new dependencies): config env parsing (incl. `HTTP_RETRIES` edge cases), password hashing, auth payload, cache in-memory fallback (incl. the far-future TTL overflow regression), API-key generation/verification, `x-api-key` middleware, the `/api/auth/change-password` route, token lifecycle (cache, force refresh, in-flight dedup, 401-retry-once), and the proxy itself (endpoint selection without leaking the `endpoint` param upstream, JSON/multipart body pass-through, gzip error bodies, 404/405/415/504 handling, 1MB stream integrity, correlation log format) — all against an in-process fake upstream (`test/helpers/fake-upstream.js`).
- Integration tests (`test/integration/`): boots the real `src/index.js` app in-process (health/readiness lifecycle, API-key enforcement end-to-end, `x-api-key` not leaking upstream, web pages, upstream 404 through the real error handler) and a spawned-process `SIGTERM` test asserting in-flight requests drain to completion with exit code 0.
- CI runs `npm test` on Node 24 before building the image; `actions/checkout` bumped to v4.

### Changed

- `src/helper/keygen.js` key-file location can be overridden via the `API_KEY_FILE` environment variable (used by tests to point at a temp directory; production default unchanged).
- `src/index.js` `main()` is exported and returns the HTTP server; it only auto-runs when executed directly (`node src/index.js`) — production behavior unchanged.
- API-key generation/verification moved from the `uuid-apikey` dependency to a vendored byte-compatible implementation (`src/helper/api-key.js`, UUID ↔ Base32-Crockford with parity checksum, using `crypto.randomUUID()`). Verified against the original module with a 10,000-round fuzz (0 mismatches) and frozen known vectors in `test/fixtures/api-key-vectors.json`; keys already issued to callers keep verifying unchanged.

### Fixed

- `GET /favicon.ico` hung forever (handler set status 204 but never ended the response, and never called `next()`), holding a socket per request — caught by the new integration tests; now returns 204 immediately.

### Security

- Removed the `uuid-apikey` dependency, which pulled in `uuid@8.3.2` with two moderate advisories and no upstream fix — `npm audit` is now clean (0 vulnerabilities).

## [2.2.0] - 2026-08-27

### Added

- `GET /healthz` (liveness) and `GET /readyz` (readiness, 503 until both `mophic`/`fdh` tokens exist) endpoints; Docker healthcheck in `docker-compose.prod.yml` now probes `/healthz`.
- Request correlation logging — every proxied request logs one line `proxy: [<id>] <method> <path> -> <upstream-host> <status> <duration>ms` and all error logs for that request carry the same id.
- `HTTP_RETRIES` environment variable controlling axios retries on network errors/timeouts (default `1`).
- Graceful shutdown on `SIGTERM`/`SIGINT` — in-flight requests drain for up to 10s before exit, so CI redeploys no longer cut proxied requests mid-flight.
- README: upstream routing table (`endpoint` query parameter / `x-api-endpoint` header), caller notes (methods, content types, timeout budget), and health endpoint documentation.
- This changelog.

### Changed

- Upstream responses are now streamed to clients (`responseType: 'stream'` + pipe) instead of buffered whole in memory; error bodies are buffered back with a 1MB cap.
- Default network retries reduced from 3 to 1, keeping the worst-case request budget at ≈ 2 × `HTTP_TIMEOUT_MS` (~65s) so HIS callers time out first.
- Docker base image updated from `node:18.18-alpine` (EOL) to `node:24-alpine` (Active LTS).
- Bearer tokens are redacted (`Bearer ***`) before axios configs are written to logs.
- Dependency updates: axios 1.20.0, axios-retry 4.5.0 (import updated to the new default-export shape), jwt-decode 4.0.0 (import updated to named export), nodemon 3.1.14, express 4.22.2, form-data 4.0.6, formidable 3.5.4, morgan 1.11.0, query-string 7.1.3, uuid-apikey 1.5.3.

### Fixed

- Corrupted upstream error responses caused by forwarding `content-encoding`/`content-length` headers after axios had already decompressed the body — only `content-type` and `location` are forwarded now.
- JSON bodies larger than Express's 100KB default were rejected; the limit now follows `BODY_LIMIT` (default 6mb) matching the FDH doc's 5MB per request.
- Multipart uploads are capped at 60MB (FDH 16-files import allows 50MB total) and oversized uploads now return 413 instead of a 500 error page.
- Unsupported `Content-Type` returns 415 with a clear message; unsupported HTTP methods return 405.
- `POST /api/auth/change-password` validates `?app=` (must be `mophic` or `fdh`) instead of silently treating unknown values as `mophic`.
- The `x-api-key` query parameter is stripped before proxying so it never leaks upstream.
- In-memory cache TTL overflow for far-future expiries (Node `setTimeout` 32-bit limit) caused tokens to expire after 1ms; long TTLs now fall back to lazy expiry checks.
- Concurrent 401 responses no longer trigger duplicate token refresh requests (in-flight fetch promise is shared).
- EJS views directory is resolved from `__dirname`, so the server can start from any working directory.
- Unconsumed upstream streams (abandoned 401 response before retry, client disconnect mid-stream) are destroyed to release keep-alive sockets promptly.

## [2.1.1] - 2025-11-26

### Added

- `HTTP_TIMEOUT_MS` environment variable for upstream request timeouts.

### Changed

- Improved error handling around upstream calls.

## [2.1.0] - 2025-11-10

### Added

- Redis-backed token cache with automatic one-way fallback to an in-memory store when Redis is unavailable.

## [2.0.2] - 2025-11-10

### Changed

- Home page: MOPH API tag updated from `MOPH IC` to `FDH`.

## [2.0.1] - 2025-11-10

### Added

- Password change and token refresh functionality with improved error handling and API routing.
- CI/CD workflow publishing the image to GitHub Container Registry and redeploying via SSH on push to `main`.

### Changed

- Project renamed from `moph-ic-proxy` to `moph-api-proxy` across configurations.

## [2.0.0] - 2024-03-29

### Added

- Support for running MOPH IC and FDH token apps simultaneously.
- Upstream selection via the `x-api-endpoint` header (in addition to the `endpoint` query parameter).

### Changed

- Proxy accepts `GET`, `POST`, `PUT`, `PATCH`, `DELETE` methods.
- Axios resiliency and logging improvements (#5).

### Fixed

- Claim endpoints use the `fdh` token app instead of `mophic`.
- Login flow on the API key page.

## [1.7.2] - 2023-11-24

### Fixed

- Proxied form POSTs keep the client's content-type.

## [1.7.1] - 2023-11-24

### Added

- `multipart/form-data` proxying for FDH uploads.

### Changed

- Dockerfile Node.js version update.

## [1.7.0] - 2023-11-09

### Added

- Proxy for the MOPH Financial Data Hub (FDH).

## [1.6.0] - 2023-04-11

### Added

- Change username/password page and API key display page.

## [1.5.0] - 2023-03-20

### Changed

- Token requests use POST.

### Fixed

- Abort controller compatibility with older Node.js.
- Handling of missing tokens.

## [1.3.0] - 2023-01-05

### Added

- Proxies for MOPH PHR and MOPH Claim endpoints.

### Fixed

- Retries with a 501 status check when the JWT expires.

## [1.0.0] - 2021-04-30

### Added

- Initial release: Express proxy for the MOPH IC API with token management.

<!-- ลิงก์เปรียบเทียบเวอร์ชัน (อิงจาก git tag) -->

[Unreleased]: https://github.com/somprasongd/moph-api-proxy/compare/v2.3.0...HEAD
[2.3.0]: https://github.com/somprasongd/moph-api-proxy/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/somprasongd/moph-api-proxy/compare/v2.1.1...v2.2.0
[2.1.1]: https://github.com/somprasongd/moph-api-proxy/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/somprasongd/moph-api-proxy/compare/v2.0.1...v2.1.0
[2.0.1]: https://github.com/somprasongd/moph-api-proxy/releases/tag/v2.0.1
