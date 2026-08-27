# MOPH Proxy API

Proxy service that manages authentication against the MOPH IC/FDH platforms, caches issued tokens, and forwards requests to the target APIs.

## Reference Documentation

- MOPH Immunization Center API – <https://docs.google.com/document/d/1Inyhfrte0pECsD8YoForTL2W8B2hOxezf0GpTGEjJr8/edit>
- EPIDEM Center API – <https://ddc.moph.go.th/viralpneumonia/file/g_surveillance/g_api_epidem_0165.pdf>
- MOPH-PHR API – <https://docs.google.com/document/d/1ZWCBJnxVCtjqmBGNjj1sLnYv11dVzUvnweui-26NDJ0/edit>
- MOPH Claim–NHSO (DMHT/EPI/dT Services) – <https://docs.google.com/document/d/1iiybB2y7NJkEhXTdS4DbYe3-Fs7aka7MlEns81lzODQ/edit>
- Financial Data Hub (FDH) – <https://drive.google.com/file/d/17XqRmSEOnXoJVwzmCwteuVdy-Gp_SUyW>
- Minimal Data Set (FDH Reservation) – <https://docs.google.com/document/d/1yDwflxOG_EG9HkEWbewfk446kmkGQ_2KiJhyqg2iY2E>

## Environment Variables

Set these variables through `nodemon.json`, shell exports, or the `moph-api-proxy.env` file used in production.

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| `MOPH_HCODE` | ✅ | – | Hospital code used in every request payload. The service refuses to start when missing. |
| `USE_API_KEY` | ❌ | `true` | Toggle API key validation middleware. Set to `false` only when another perimeter control exists. |
| `HTTP_TIMEOUT_MS` | ❌ | `30000` | Axios request timeout for upstream calls. Increase if PHR/IC endpoints routinely take longer than 15s. |
| `HTTP_RETRIES` | ❌ | `1` | Axios retries for network errors/timeouts (so the default worst case is 2 × `HTTP_TIMEOUT_MS` ≈ 65s, sized to stay under typical HIS client timeouts). Raise it only if a deployment must tolerate more upstream flakiness. |
| `BODY_LIMIT` | ❌ | `6mb` | Max JSON body size (FDH doc allows 5MB per request). Multipart uploads such as the 16-files import (`/api/v2/data_hub/16_files`, files totaling up to 50MB) are limited separately by the proxy at 60MB. |
| `APP_PORT` | ❌ | `3000` | Port used by the Express server. |
| `REDIS_HOST` | ❌ | `localhost` | Hostname of the Redis instance for caching tokens/payloads. Leave empty to force the in-memory cache (tokens reset on restart). Use Redis for production or any multi-instance deployment so tokens are shared. |
| `REDIS_PORT` | ❌ | `6379` | Redis TCP port. |
| `REDIS_PASSWORD` | ❌ | empty | Optional Redis password. |
| `MOPH_IC_API` | ❌ | `https://cvp1.moph.go.th` | Base URL for standard MOPH IC requests. |
| `MOPH_IC_AUTH` | ❌ | `https://cvp1.moph.go.th` | Auth endpoint used to retrieve MOPH IC tokens. |
| `MOPH_IC_AUTH_SECRET` | ❌ | `$jwt@moph#` | Secret key for hashing the MOPH IC credentials before requesting a token. |
| `FDH_API` | ❌ | `https://fdh.moph.go.th` | Base URL for FDH data requests. |
| `FDH_AUTH` | ❌ | `https://fdh.moph.go.th` | Auth endpoint for FDH token generation. |
| `FDH_AUTH_SECRET` | ❌ | `$jwt@moph#` | Secret key for hashing FDH credentials. |
| `MOPH_CLAIM_API` | ❌ | `https://claim-nhso.moph.go.th` | Base URL for the Claim (NHOS) endpoints. |
| `MOPH_PHR_API` | ❌ | `https://phr1.moph.go.th` | Base URL for the PHR endpoints. |
| `EPIDEM_API` | ❌ | `https://epidemcenter.moph.go.th/epidem` | Base URL for Epidem Center calls. |

> For UAT, replace the defaults with the relevant UAT hosts (for example, `https://uat-fdh.inet.co.th` for `FDH_API`).

## Development Setup

1. Copy `nodemon.example.json` to `nodemon.json` and fill in your environment variables.
2. (Recommended) Start Redis so tokens are shared across restarts:

   ```bash
   docker compose up -d
   ```

   The compose file starts Redis on `localhost:6379`, but the proxy only uses it when `REDIS_HOST` is set — add `"REDIS_HOST": "localhost"` to `nodemon.json`. Without it (or when Redis is unreachable) the application automatically falls back to the in-memory cache described below.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the dev server with auto reload:

   ```bash
   npm run dev
   ```

## Cache Backend

- Redis is the primary cache used to store tokens and the hashed payloads required to refresh them. This allows multiple proxy instances to share the same credentials and survive restarts.
- When Redis is not configured or becomes unreachable, the service automatically switches to an in-memory `Map` that mimics the Redis API.
- The in-memory mode is suitable for local development or single-instance deployments only. Tokens are wiped on restart and are **not** shared across containers, so keep Redis enabled in production.

## Production Deployment

1. Create `moph-api-proxy.env` with the environment values required by your deployment:

   ```env
   APP_PORT=3000
   MOPH_HCODE=your-hcode
   USE_API_KEY=true
   MOPH_IC_AUTH_SECRET=replace_me
   FDH_AUTH_SECRET=replace_me
   REDIS_HOST=redis
   REDIS_PORT=6379
   ```

   Add or override any of the variables listed earlier (API endpoints, passwords, etc.) as needed.
2. Create the shared Docker network (if not already created):

   ```bash
   docker network create webproxy
   ```

3. Deploy with the provided Compose files:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

4. After the container is running:
   - Visit `http://<server-ip>:<port>/change-password` to set the proxy username/password.
   - Visit `http://<server-ip>:<port>/api-key` to log in with your MOPH IC credentials and retrieve the generated API key.

> Note: `/change-password` and `/api-key` are authenticated with your MOPH credentials themselves (not the proxy API key). Because they accept passwords in plain HTTP bodies, run the proxy behind an HTTPS reverse proxy and restrict access with your network/firewall.
>
> On `SIGTERM`/`SIGINT` the server stops accepting new connections and drains in-flight requests for up to 10s before exiting, so redeploys (the CI pipeline restarts the container on every push to `main`) do not cut proxied requests mid-flight. The Docker healthcheck probes `/healthz`; use `/readyz` if a load balancer needs to know when the proxy is actually usable.

## Using the Proxy

Invoke downstream endpoints through `/api/<endpoint>` and include the API key unless you disabled the middleware:

```text
http://localhost:9090/api/ImmunizationTarget?x-api-key=YOUR_API_KEY&cid=1659900783037

# Without API key validation
http://localhost:9090/api/ImmunizationTarget?cid=1659900783037
```

- Replace `<endpoint>` with the actual MOPH IC API path.
- Append any query parameters (`cid`, etc.) required by the upstream API.
- Retrieve the generated API key through the `/api-key` route mentioned earlier.

### Routing to other upstreams

By default requests go to the MOPH IC API. Route to a different upstream with the `endpoint` query parameter (stripped before forwarding) or the `x-api-endpoint` header:

```text
http://localhost:9090/api/v1/opd/dm?endpoint=claim
```

| `endpoint` | Upstream host | Token app |
| --- | --- | --- |
| *(omitted)* | `cvp1.moph.go.th` (MOPH IC) | `mophic` |
| `epidem` | `epidemcenter.moph.go.th/epidem` | `mophic` |
| `phr` | `phr1.moph.go.th` | `mophic` |
| `claim` | `claim-nhso.moph.go.th` | `fdh` |
| `fdh` | `fdh.moph.go.th` | `fdh` |

> Paths are forwarded verbatim, so each request must use paths that exist on the selected host. FDH is the identity provider for the claim endpoints, but the claim APIs themselves live on `claim-nhso.moph.go.th` — an FDH path sent with `endpoint=claim` (or a `MOPH_CLAIM_API` mispointed at the FDH host) returns `404 Cannot POST ...` from upstream.

### Caller notes

- Methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE` — anything else gets `405`.
- Bodies: `application/json` (up to `BODY_LIMIT`, default 6mb) and `multipart/form-data` (60MB total per request) — other content types get `415`.
- On upstream timeout the proxy answers `504` with details; a failing call is bounded at ≈2 × `HTTP_TIMEOUT_MS` (≈65s with defaults) before the proxy gives up.

## Health Endpoints

- `GET /healthz` — liveness. Always returns `200` with `{ status, version, cache, uptime }` while the process can serve requests. Used by the Docker healthcheck.
- `GET /readyz` — readiness. Returns `200` only when both cached tokens (`mophic`, `fdh`) exist; `503` with `{ ready, tokens }` otherwise. A fresh deployment returns `503` until credentials are set via `/change-password`, which is the intended signal.
