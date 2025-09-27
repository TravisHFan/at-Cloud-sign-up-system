# Short Links API (Milestone M4)

Public-friendly short URLs for published events. Provides idempotent creation, status lookup, and redirect behavior.

## Overview

A short link is a compact key mapping to a published event's public slug. Links expire automatically (event end date if available; else +30 days). Expired links return HTTP 410. Unknown keys return 404.

## Data Model (MongoDB `ShortLink`)

- `key` (string, unique, base62 6-8 chars)
- `eventId` (ObjectId reference)
- `targetSlug` (string) – the event's `publicSlug`
- `expiresAt` (Date)
- `isExpired` (boolean) – server-side forced expiration / fast check
- `createdBy` (ObjectId user id)
- Timestamps: `createdAt`

## Key Generation

Base62 random with retry-on-collision (default 5 attempts). Length randomized 6–8 characters to reduce synchronized collision risk.

## Endpoints

### 1. POST `/api/public/short-links`

Creates or returns existing active short link (idempotent).

Auth: Required (creator / authorized user). In tests a bearer token stub injects a user.

Body:

```json
{ "eventId": "<eventObjectId>" }
```

Responses:

- 201 Created

```json
{
  "success": true,
  "created": true,
  "data": {
    "key": "abc123",
    "eventId": "...",
    "slug": "my-event",
    "expiresAt": "2025-03-01T10:00:00.000Z",
    "url": "/s/abc123"
  }
}
```

- 200 OK (Existing)

```json
{ "success": true, "created": false, "data": { ...same fields } }
```

- 400 Bad Request: invalid id / not published / no public roles
- 404 Not Found: event does not exist
- 500 Internal Error

### 2. GET `/api/public/short-links/:key`

Status lookup (no auth). Useful for front-end preflight before redirect logic.

Responses:

- 200 Active

```json
{
  "success": true,
  "data": { "status": "active", "slug": "my-event", "eventId": "..." }
}
```

- 410 Expired

```json
{ "success": false, "status": "expired", "message": "Short link expired" }
```

- 404 Not Found

```json
{ "success": false, "status": "not_found", "message": "Short link not found" }
```

### 3. GET `/s/:key`

Public redirect. Returns relative path for the public event page.

- 302 -> `/public/events/:slug`
- 410 -> `Short link expired` (plain text)
- 404 -> `Short link not found` (plain text)

## Expiration Logic

1. Primary: event end date/time (if present) -> expiresAt
2. Fallback: now + 30 days
3. Force expire: unpublish event trigger (future enhancement) or manual `expireAllForEvent` call.

## Service Behaviors

- `getOrCreateForEvent(eventId, userId)` – validates publish & at least one `openToPublic` role; idempotent.
- `resolveKey(key)` – tri-state: active | expired | not_found.
- `expireAllForEvent(eventId)` – marks all active keys expired (used for future unpublish hook).

## Metrics (In-Memory Prototype)

Counters (unstable interface; for internal debugging only):

- created
- resolved_active
- resolved_expired
- resolved_not_found
- redirect_active
- redirect_expired
- redirect_not_found

Temporary endpoint: `GET /metrics/short-links` → `{ success: true, metrics: { ... } }`.

Migration path: Replace with Prometheus client exposing `/metrics` or push to external telemetry platform, plus add latency histograms.

## Error Handling Patterns

- Domain validation errors -> 400
- Missing event -> 404
- Expired vs not found differentiation -> 410 vs 404 (SEO / caching semantics)

## Testing Summary

- Unit: key generation (collision retries, base62) & service logic (idempotent, resolve states, expiry computation).
- Integration: creation idempotency, unpublished/no-public-role rejection, active status, expired status, unknown key, redirect behaviors (302/410/404).

## Future Enhancements

- Cache hot keys (e.g., LRU) to skip DB hit on active lookups.
- Background job to sweep & mark expired documents.
- Prometheus metrics & alerting on high 404/410 ratios.
- Optional custom key reservation (vanity URLs) with collision prevention.
- Share Modal UI (front-end) embedding copy button + preview.

## Changelog (Milestone M4)

- Added `ShortLink` model & indexes.
- Implemented base62 key generator with collision retry.
- Implemented `ShortLinkService` (idempotent creation, resolve, bulk expire).
- Added controller & routes + root redirect `/s/:key`.
- Added integration & unit test coverage.
- Added lightweight metrics service & instrumentation.
- Extended publishing roadmap doc and created this API reference.
