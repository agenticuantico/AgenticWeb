# AgenticWeb → AgentiCuantico bridge

AgenticWeb is the public interface. The AgentiCuantico API remains the operational brain.

## Request path

```
Browser / APK
  ↓
https://agenticuantico.dev.ar
  ↓
Cloudflare Worker
  ↓ /v1/* and /health
CORE_API_ORIGIN
  ↓
AgentiCuantico FastAPI
  ↓
brain → memory → model → verification
```

The Cloudflare Worker never contains the model secret or database. It only forwards the request to the configured core API origin.

## Cloudflare configuration

Set the Worker environment variable:

- `CORE_API_ORIGIN` = the HTTPS origin where the AgentiCuantico FastAPI service is actually running.

Do not put the origin in `app.js`, HTML, or public repository files.

The Worker returns a structured `503 core_api_not_configured` response until this value is configured. This is intentional: it prevents the public site from silently pointing at an invented or insecure backend.

## Core maintenance

The core exposes:

- `GET /health`
- `POST /v1/maintenance/improvement`

The maintenance endpoint requires `X-Maintenance-Key` in production. Set:

- `AGENTICUANTICO_MAINTENANCE_KEY`

The daily GitHub Actions workflow can call the endpoint with the repository secrets:

- `AQ_MAINTENANCE_URL`
- `AQ_MAINTENANCE_KEY`

The improvement cycle evaluates the current behavior and records explicit feedback-driven improvement actions. It does not silently modify neural model weights.

## Verification

```
GET https://agenticuantico.dev.ar/health
POST https://agenticuantico.dev.ar/v1/conversations/messages
Content-Type: application/json

{"message":"Hola","history":[]}
```

A successful chat response should contain `message`, `model`, `verified`, and `guest_memory`.

If the core is unavailable, the UI reports the connection error instead of pretending that the brain answered.
