# Public Event Publish & Share — Roadmap

This document defines the end-to-end plan to enable publishing events to a public, sanitized page that supports guest and user registrations without login, along with a Share button that generates short links.

## ✅ Confirmed assumptions

- Capacity is enforced per role; there are no role close dates today.
- Public page hides organizer-only content and all internal notes.
- Public page supports both:
  - Guests (no account) — register by providing basic contact info.
  - Existing users — can also register from the public page, without logging in. If their email matches an existing account, we will associate the registration with that account automatically.
- Short links expire when the event is unpublished or past the event end date.

## Scope

- Organizer can publish/unpublish an event.
- Public, unauthenticated URL serves a sanitized event page.
- Roles can be marked “Open to Public”; only those roles are visible/registerable on the public page.
- Guests and existing users can register from the public page without login.
- Share button provides a copy-friendly short URL for social/email/flyers.

---

## Data model changes

Event (new/updated fields):

- publish: boolean (default false)
- publishedAt: Date | null
- publicSlug: string (URL-safe, unique; generated once at first publish)
- roles[].openToPublic: boolean (default false)

ShortLink (new collection):

- key: string (6–8 char base62, unique)
- targetUrl: string (e.g., /p/:slug)
- eventId: string (for lifecycle management)
- createdBy: userId
- createdAt: Date
- expiresAt?: Date (set to event end or upon unpublish)

Indexes:

- Event.publicSlug unique
- ShortLink.key unique

Notes:

- Capacity continues to be enforced per role. No changes to close-date logic (non-existent).

---

## URL scheme

- Public event page: `/p/:slug`
  - Example: `https://app.example.com/p/mentor-circle-abc123`
- Short link redirect: `/s/:key` → 302 to `/p/:slug`
  - Example: `https://app.example.com/s/7fzKq`

SEO:

- Canonical URL: `/p/:slug`
- Robots: indexable for published events; 404/410 for unpublished/expired

---

## API design

Publishing lifecycle:

- POST `/api/events/:eventId/publish`

  - Body (optional): `{ }` (roles are toggled via roles API below)
  - Effects: generate `publicSlug` if absent; set `publish=true`, `publishedAt=now`
  - Requires: at least one role with `openToPublic=true` (otherwise 400)
  - Returns: sanitized PublicEvent payload

- POST `/api/events/:eventId/unpublish`
  - Effects: `publish=false`, may set `publishedAt=null`
  - Lifecycle: mark related short links expired (set `expiresAt=now`)

Role openness:

- PATCH `/api/events/:eventId/roles`
  - Body: `[{ roleId, openToPublic }]` (plus any other role edits)
  - Only organizers can update

Public event retrieval:

- GET `/api/public/events/:slug`
  - No auth
  - Returns strictly sanitized event payload:
    - `title`, `description` (sanitized), `start/end`, `location` (coarse: city/virtual), `flyerUrl`, optional `agenda`
    - `roles`: only where `openToPublic=true` with fields: `roleId`, `name`, `description` (sanitized), `price?`, `capacityRemaining`
  - Never include internal notes, emails, or admin-only data

Registration (public):

- POST `/api/public/events/:slug/register`
  - No auth
  - Body: `{ roleId, attendee: { name, email, phone? }, consent: { termsAccepted: boolean } }`
  - Validates:
    - Event is published
    - Role is `openToPublic`
    - Capacity available
  - Behavior:
    - If `email` matches existing user, associate registration to that user (no login required)
    - Otherwise create a guest registration
  - Returns: `{ status: 'ok', registrationId }`

Short links:

- POST `/api/public/short-links`

  - Auth: organizer of the event
  - Body: `{ eventId }`
  - Generates a short `key` pointing to `/p/:slug` and sets `expiresAt` to event end
  - Returns: `{ shortUrl: 'https://.../s/:key' }`

- GET `/api/public/short-links/:key`
  - 302 redirect to target
  - 410/404 if expired or event unpublished

---

## Sanitization, privacy, and security

- Whitelist-based serialization for public payloads; strip any fields not explicitly listed
- HTML sanitation for description/agenda: remove scripts/iframes/unsafe attrs
- No organizer emails or internal notes on the public page; use a contact form if needed (POST only)
- Registration anti-abuse:
  - Rate limit by IP and by email for `POST /register`
  - Optional: add a CAPTCHA/Turnstile (feature-flag)
- CSRF: less relevant without cookies; still use standard JSON-only endpoints
- Audit logs for publish/unpublish and public registrations

### AuditLog schema (backend, MongoDB)

Minimal schema for auditability of critical actions (publish/unpublish, public registrations). This is admin-only and separate from analytics/debug logs.

- Collection: `audit_logs`
- Initial event types (enum): `EventPublished`, `EventUnpublished`, `PublicRegistrationCreated`
- Document fields (initial set):

  - `_id`: ObjectId
  - `type`: string — one of the types above
  - `ts`: Date — event timestamp (UTC)
  - `requestId`: string — correlation ID for tracing
  - `ipCidr`: string — truncated client IP (e.g., IPv4 /24 or IPv6 /48)
  - `eventId`: ObjectId — referenced event
  - `actorUserId?`: ObjectId — the organizer performing the action (publish/unpublish); omitted for anonymous registrations
  - `roleId?`: ObjectId — present for registration events
  - `registrationId?`: ObjectId — present for registration events
  - `matchedUserId?`: ObjectId — if the email matched an existing account
  - `emailHash?`: string — SHA-256 of lowercase email (for dedupe without storing PII)
  - `capacityBefore?`: number — snapshot before registration (if available)
  - `capacityAfter?`: number — snapshot after registration (if available)

- Indexes:

  - `{ eventId: 1, type: 1, ts: -1 }` — primary query path by event and type
  - `{ ts: -1 }` — range queries by time
  - `{ registrationId: 1 }` — direct lookups for a specific registration
  - Optional: `{ actorUserId: 1, ts: -1 }` — organizer activity reviews

- Privacy notes:

  - Store `emailHash` instead of raw emails; never log tokens/cookies.
  - Truncate IPs to reduce sensitivity while enabling pattern detection.

- Retention & access:

  - Retain 12–24 months (policy-based). Clean up with a periodic job; avoid TTL initially to keep flexibility.
  - Expose read-only to admins via backend endpoints or internal tools; not available publicly.

- Out of scope (future):
  - `ShortLinkCreated`, `ShortLinkRedirect` audit entries; redirect activity is typically analytics, not audit.

---

## Frontend UX plan

Organizer (Create/Edit Event):

- Roles table/cards: add “Open to Public” checkbox
- Publish/Unpublish button with state indicator (Published / Draft)
- On Publish:
  - Validate at least one role is open to public; otherwise show blocking message
  - Show generated public URL and an inline action to “Generate Share Link”
- On Unpublish:
  - Public page becomes unavailable (404/410); short links expire
- Visuals: “Published” badge and `publishedAt` timestamp

Public Event Page (`/p/:slug`):

- Header: Title, date/time, location, flyer image (if present)
- Body: sanitized description; optional agenda
- Roles list:
  - Only roles with `openToPublic=true`
  - Show price (if applicable) and capacity remaining
  - “Register” button per role
- Registration form (inline or modal):
  - Fields: name, email, phone? (phone optional in our system)
  - Consent checkbox
  - Submit success screen with details
- Share button:
  - Opens a modal with the short URL in a read-only input
  - Copy-to-clipboard button
  - Optional share targets (Twitter/X, LinkedIn, Email)
- States & errors:
  - If slug not found or unpublished: friendly 404
  - If role full: show Full or disable CTA; consider waitlist in future

Logged-in users:

- If a session exists, the public page still renders the same
- Registration will associate to the logged-in user automatically; otherwise it will match by email to an existing account

---

## Emails & notifications

- Confirmation email to registrant (guest or user) with event details and role
- ICS attachment included

---

## Short-link behavior

- Key generation: server-side base62, length 6–8, collision-checked
- Target: `/p/:slug`
- Expiration: when event is unpublished or past end date (set `expiresAt`)
- Redirect behavior: 302 when active; 410/404 when expired
- Optional analytics: click count, lastVisitedAt

---

## Observability, rate limits, and performance

- Logs: publish/unpublish events, public registrations, short-link hits
- Metrics: counts for visits, registrations; error/failure rates
- Rate limits: safe defaults to protect `POST /register`
- Caching/CDN: short TTL for GET `/p/:slug`; purge on edits or unpublish

---

## Rollout & migration

1. Backend models & serialization (read-only public GET)
2. Public page (frontend) consuming sanitized GET
3. Registration endpoint + form submission
4. Organizer UI: role openToPublic + publish/unpublish controls
5. Short links + Share modal
6. Analytics and polish

Backfill: New fields default to `publish=false`; no data migration required for historical events.

Feature flags: Enable per environment; test in staging first.

---

## Testing roadmap

Unit tests (backend):

- Public serializer: fields whitelist and HTML sanitation
- Role openToPublic invariants
- Capacity enforcement
- Short-link key generator: format and uniqueness

Integration tests (backend):

- `POST /publish` → sets flags, returns sanitized payload; rejects with 400 when no roles open to public
- `GET /public/events/:slug` → 404 when unpublished; 200 with sanitized fields when published
- `POST /public/events/:slug/register` → validates openToPublic and capacity; creates registration as guest or associates to user by email
- Short links: create and redirect; 410/404 after unpublish/end

E2E (frontend):

- Organizer flow: mark roles open, publish event, see public URL, generate short URL
- Public flow: visit `/p/:slug`, see public roles, register as guest
- Logged-in user flow: visit public page and register (auto-associated)
- Share modal: generates short URL and copy works
- Unpublish → public page becomes unavailable

How to run tests:

- Repository tests: `npm test`
- Backend integration only:
  - `cd backend && npm run -s test:integration`
- Test DB: `mongodb://localhost:27017/atcloud-signup-test` (see repo instructions)

Coverage goals: broaden to near-100% for newly added modules; maintain quality-focused assertions.

---

## Acceptance criteria

- Organizer can publish/unpublish events
- Public page `/p/:slug` is accessible without login and displays only sanitized, allowed fields
- Only roles with `openToPublic=true` display on the public page and are registerable
- Public registration enforces capacity; guests and existing users (matched by email) both succeed without login
- Share button provides a short URL; redirects to public page; short link expires on unpublish or event end
- Tests added and passing for unit, integration, and e2e flows listed above

---

## Open decisions (default proposals)

- Capacity display on public page: show capacity remaining (default: ON)
- CAPTCHA/Turnstile: optional, feature-flagged (default: OFF initially)
- Organizer display name/contact: hide email; optionally provide a POST contact form later
- Public vs internal descriptions: start with single sanitized description; split later if needed

---

## Appendix: sample contracts (sketch)

Public event payload (GET `/api/public/events/:slug`):

```json
{
  "title": "Mentor Circle — JavaScript",
  "description": "...sanitized html...",
  "start": "2025-10-01T18:00:00Z",
  "end": "2025-10-01T19:30:00Z",
  "location": { "type": "virtual", "label": "Zoom" },
  "flyerUrl": "https://.../flyer.png",
  "roles": [
    {
      "roleId": "abc",
      "name": "Attendee",
      "description": "...sanitized...",
      "price": 0,
      "capacityRemaining": 12
    }
  ]
}
```

Public registration request (POST `/api/public/events/:slug/register`):

```json
{
  "roleId": "abc",
  "attendee": {
    "name": "Avery Doe",
    "email": "avery@example.com",
    "phone": "+1 555 0100"
  },
  "consent": { "termsAccepted": true }
}
```

Public registration response:

```json
{ "status": "ok", "registrationId": "reg_123" }
```

Short link creation (POST `/api/public/short-links`):

```json
{ "eventId": "evt_123" }
```

Short link response:

```json
{ "shortUrl": "https://app.example.com/s/7fzKq" }
```

---

## Milestones (suggested & status)

- M1 (COMPLETE ✅ Core public read capability):
  - ✅ Event model fields (`publish`, `publishedAt` – first publish preserved, `publicSlug`, `roles[].openToPublic`)
  - ✅ Public serializer (whitelist + sanitized + now async w/ real `capacityRemaining` aggregation)
  - ✅ Public GET endpoint `/api/public/events/:slug` with 404 for unpublished/missing
  - ✅ Initial integration tests (published/unpublished/missing slug)
  - ✅ Frontend placeholder public page `/p/:slug`
  - ✅ Slug generation utility + unit tests (collision fallback)
  - ✅ AuditLog model + publish/unpublish audit entries
  - ✅ Capacity remaining test after registration (dynamic aggregation)
  - ✅ Decision logged: preserve original `publishedAt` across unpublish/re-publish cycles
  - (Optional polish deferred) 404 UX & styling enhancements
- M2 (COMPLETE ✅ Organizer controls & role openness):
  - ✅ Backend lifecycle endpoints: `POST /api/events/:id/publish`, `POST /api/events/:id/unpublish` with validations (at least one open role)
  - ✅ Frontend organizer UI: Publish/Unpublish bar, status badges, copy public URL
  - ✅ Per-role `openToPublic` toggle in Event Detail (optimistic update + rollback on failure)
  - ✅ Display of per-role `capacityRemaining` in organizer view
  - ✅ Added API client methods `publishEvent` & `unpublishEvent`
  - ✅ Roadmap updated to reflect completion
  - (Moved) Targeted frontend publish UI tests → M5 scope (pending)
- M3 (COMPLETE ✅ Public registration & supporting fields):
  - ✅ Extended serializers & models to surface `flyerUrl` on public payloads
  - ✅ Role update merge logic now preserves `openToPublic` when omitted (regression tests stabilized & passing)
  - ✅ Agenda (event-level) sanitation path prepared; role-level agenda constraints added (future display TBD)
  - ✅ Pricing / cost fields surfaced internally (frontend pricing UI groundwork complete) — evaluation for public exposure deferred
  - ✅ Public registration endpoint implemented with capacity + duplicate idempotency (backend integration tests green)
  - ✅ Frontend public registration form (role select, attendee fields, consent) with happy + duplicate tests passing
  - ✅ ICS calendar attachment builder + unit tests; integrated into confirmation email send
  - ✅ Confirmation email template (HTML + text) with role & purpose, ICS attached
  - ✅ AuditLog enrichment: `requestId`, truncated `ipCidr` added to `PublicRegistrationCreated` metadata
  - ✅ Negative tests: capacity full, role not open, missing consent, duplicate after capacity full (completed 2025-09-26)
  - ✅ Rate limit & abuse protections (implemented during M5 rate limiting foundation)
- M4 (COMPLETE ✅ Short links core & sharing UX):
  - ✅ ShortLink model + base62 key generator (collision retries)
  - ✅ Idempotent creation endpoint `POST /api/public/short-links`
  - ✅ Status lookup endpoint `GET /api/public/short-links/:key`
  - ✅ Public redirect route `/s/:key` (302 active, 410 expired, 404 not found)
  - ✅ Expiry logic (event end date → fallback +30d)
  - ✅ In-memory metrics counters (created, resolve*, redirect*) + structured logging
  - ✅ Prometheus metrics scaffold (counters + resolve latency histogram) + unified `/metrics` (text & JSON) + backward compatible `/metrics/short-links`
  - ✅ Unpublish expire hook (bulk marks active short links expired, increments Prometheus expire counter)
  - ✅ Frontend Share Modal UI (copy-to-clipboard, expired messaging, refresh) + short link client util + `useShortLink` hook
  - ✅ Frontend Share Modal tests (active, expired, copy success, creation error) all green
  - ✅ Integration tests (idempotent creation, active/expired/not_found status, redirect variants) remain passing post‑metrics
  - ✅ Unit tests (service resolve, key generator collisions & constraints)
  - ✅ Documentation: `SHORT_LINKS_API.md` + roadmap updates
  - (Moved) Vanity/custom key support → M5 scope (pending design decision)
  - (Moved) Short link LRU cache (hit/miss metrics) → M5 scope
- M5 (IN PROGRESS ✅ Partial — Anti‑abuse & Performance Hardening):
  - ✅ Rate limiting foundation (public registration IP+email; short link creation per-user & per-IP)
  - ✅ Negative public registration tests (capacity full, closed role, missing consent, duplicate-after-full)
  - ✅ Unpublish short-link expiration (expire hook + integration test)
  - ✅ Share Modal + short link UX (delivered early in M4 scope)
  - ✅ Short link in‑memory LRU cache (positive + negative entries) with per-entry TTL + lazy stale eviction
  - ✅ Stale eviction Prometheus counter `short_link_cache_stale_evictions_total{reason="expired"}` + integration & unit test coverage
  - ✅ Test-only cache control hooks consolidated under exported `__TEST__` object (no accidental prod usage) + refactored consumers
    - ✅ Extended publish validation (purpose length, timeZone, zoomLink for Online, location for In‑person/Hybrid, at least one public role) with structured error responses
    - ✅ Fixed `publishedAt` preservation (remains first-publish timestamp across unpublish/re-publish)
      - ✅ Registration metrics instrumentation (`registration_attempts_total`, `registration_failures_total{reason}`) + structured validation failure logs (hashed/truncated identifiers)
      - ✅ Short link cache metrics (hits, misses, stale eviction, entries gauge) already integrated; verified presence
        - ✅ Public listing endpoint `GET /api/public/events` with pagination, filters (type, date range, q), weak ETag + in-process LRU cache (TTL 60s) and version bump invalidation on publish/unpublish
        - ✅ Listing capacity aggregation (per-page aggregate of open roles) optimized with single registration aggregation per page
  - ✅ Single-file backend test run support (`npm run test:backend -- tests/…file.test.ts`) for faster iteration
  - ✅ Cache documentation addendum (stale eviction semantics, metric definition)
  - ✅ Short link creation counters instrumented (`shortlink_create_attempts_total`, `shortlink_create_failures_total{reason=rate_limit_*}`) + integration test `short-links-create-metrics.integration.test.ts`
  - ⏳ Remaining: finalize documentation and consider additional failure reasons (validation/auth) before marking fully complete for registration side already partially covered.
  - ⏳ Vanity/custom key design decision (charset, reservation list, collision policy)
  - ⏳ E2E publish → share → redirect → register flow (asserts audit log & metrics increments)
  - ⏳ Security & abuse documentation (rate limit strategy, escalation playbook)
  - ⏳ Performance smoke tests (burst resolve p50/p95 baseline with & without cache)
  - ✅ Performance burst scripts: `perf-smoke.ts` (cold/warm) & `perf-burst.ts` (parallel p50/p95) added
  - ✅ Security & abuse monitoring doc (`SECURITY_ABUSE_MONITORING.md`) with metrics inventory & playbook
  - ⏳ Milestone M5 summary & roadmap/README updates

Note: Backend openToPublic role update tests currently timing out after merge; investigation active (suspected hook/db setup contention). Publish lifecycle 400-on-create issue resolved via validation ordering fix.

---

## Recent Achievements Log

| Date (UTC) | Area       | Summary                                                                                                      |
| ---------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| 2025-09-24 | Backend    | Added publish fields to Event schema & initial serializer utility                                            |
| 2025-09-24 | Backend    | Implemented public GET endpoint + integration tests                                                          |
| 2025-09-24 | Frontend   | Placeholder public page `/p/:slug`                                                                           |
| 2025-09-25 | Backend    | Added AuditLog model & lifecycle logging (publish/unpublish)                                                 |
| 2025-09-25 | Backend    | Converted serializer async with real capacity aggregation + tests                                            |
| 2025-09-25 | Backend    | Extracted slug generation utility + collision unit tests                                                     |
| 2025-09-25 | Backend    | Added lifecycle endpoints (publish/unpublish) w/ validation + integration tests                              |
| 2025-09-25 | Frontend   | Organizer Publish/Unpublish UI bar + public URL copy + role `openToPublic` toggles                           |
| 2025-09-25 | Frontend   | Capacity remaining surfaced in role cards (organizer view)                                                   |
| 2025-09-25 | Backend    | Stabilized `openToPublic` role update regression tests (preserve & toggle flows)                             |
| 2025-09-25 | Backend    | Added reusable `buildValidEventPayload` helper for integration tests                                         |
| 2025-09-25 | Backend    | Added flyerUrl integration & serialization tests                                                             |
| 2025-09-25 | Backend    | Hardened rate limit test for role assignment rejection (deterministic 429)                                   |
| 2025-09-25 | Backend    | Removed temporary debug instrumentation from integration tests                                               |
| 2025-09-26 | Backend    | Implemented public registration endpoint + full integration test suite (M3 core)                             |
| 2025-09-26 | Backend    | Added persistent AuditLog (`PublicRegistrationCreated`) for public registrations                             |
| 2025-09-26 | Backend    | Extracted shared helpers `createPublishedEvent` / `ensureCreatorUser`                                        |
| 2025-09-26 | Backend    | Added duplicate existing-user idempotent registration integration test                                       |
| 2025-09-26 | Backend    | Added `hashEmail` unit test (case + whitespace normalization)                                                |
| 2025-09-26 | Frontend   | Public registration form (role select, attendee fields, consent)                                             |
| 2025-09-26 | Frontend   | Confirmation email template (HTML + text) with role & purpose, ICS attached                                  |
| 2025-09-26 | Backend    | AuditLog enrichment: requestId, truncated ipCidr added to PublicRegistrationCreated metadata                 |
| 2025-09-26 | Frontend   | Share Modal UI + short link hook/util + copy/expired/error tests                                             |
| 2025-09-26 | Backend    | Prometheus metrics scaffold + unified /metrics (text & JSON) + histogram instrumentation                     |
| 2025-09-26 | Backend    | Unpublish expire hook expiring active short links + metrics counter                                          |
| 2025-09-26 | Backend    | Refactored registration: duplicate check precedes capacity (idempotent after full)                           |
| 2025-09-26 | Backend    | Added negative public registration tests (capacity full, closed role, missing consent, duplicate-after-full) |
| 2025-09-26 | Backend    | Added unpublish short-link expiration integration test (410 status & redirect)                               |
| 2025-09-26 | Full Suite | All backend tests green after negative tests & registration refactor                                         |
| 2025-09-26 | Backend    | Implemented sliding-window RateLimiterService + PublicAbuseMetricsService (in-memory)                        |
| 2025-09-26 | Backend    | Added public registration rate limiting middleware (per-IP & per-email) + integration tests (green)          |
| 2025-09-26 | Backend    | Added short link creation rate limiting middleware (per-user & per-IP) + integration tests (green)           |
| 2025-09-26 | Backend    | Added dedicated rate limit integration tests (email/IP registration; user/IP short link) all passing         |
| 2025-09-27 | Backend    | Implemented short link LRU cache (positive + negative caching with per-entry TTL & lazy stale eviction)      |
| 2025-09-27 | Backend    | Added Prometheus counter `short_link_cache_stale_evictions_total{reason="expired"}` + metric unit test       |
| 2025-09-27 | Backend    | Added focused stale eviction integration test (forces cache expiry, asserts 410 + counter increment)         |
| 2025-09-27 | Backend    | Wrapped test-only cache hooks in exported `__TEST__` object; updated all test references                     |
| 2025-09-27 | Tooling    | Enabled single-file backend test execution via arg pass-through (`npm run test:backend -- path`)             |
| 2025-09-27 | Docs       | Updated cache summary with stale eviction semantics & new metric definition                                  |

Last updated: 2025-09-26 (M1–M4 complete; M5 in progress — Rate limiting foundation delivered, Share Modal, Prometheus metrics & unpublish expiration earlier)

## Upcoming Focus (Remaining M5 Scope)

1. Registration Abuse Protections

- DONE: Implement IP + email rate limiting (sliding window) for public registration + per-user/IP for short link creation (integration tests green)
- TODO: Add Prometheus counters (`registration_attempts_total`, `registration_failures_total{reason}`, `shortlink_create_attempts_total`, `shortlink_create_failures_total{reason}`)
- TODO: Add structured log entries with hashed email/IP truncation for rate limit breaches

2. Short Link Performance & Reliability

- LRU in-memory cache for hot keys (TTL) + Prometheus hit/miss counters
- (Unpublish expiration integration test already in place)

3. Vanity Key Design

- Design doc: charset, length, collision & reservation rules (blocked words); decide ship vs defer

4. E2E Flow

- Publish → generate short link → redirect → public register → confirmation; asserts audit log + metrics increments

5. Security & Abuse Documentation

- Rate limit strategy, monitoring, escalation playbook

6. Performance Smoke Tests

- Burst resolve (warm vs cold cache) capturing p50/p95 latency (baseline only)

7. Documentation & Milestone Summary

- Roadmap & README updates (metrics section, share modal usage) + M5 wrap-up report

2. Share Modal Frontend

- Fetch or lazily create short link; optimistic UI with retry/backoff
- Copy-to-clipboard UX + toast; add minimal analytics event emission (share_clicked)

3. Expanded Test Coverage

- Edge cases: capacity full, missing consent, re-register with different casing in email, user→guest dedupe
- Negative notification suppression assertions (ensure zero system messages/emails when flag true) completed ✅
- Add explicit failure-path assertions for short link 410/404 (upcoming with M4)
- Add co-organizer notification presence/absence matrix when suppression toggled at creation vs edit (stretch)

4. E2E Scenario Draft

- Script: organizer publish → open public page → guest register → confirm ICS link rendered → verify AuditLog entry

5. Observability & Hardening

- Rate limiting stub for `POST /public/events/:slug/register` (IP + email sliding window)
- Optional bot mitigation toggle (Turnstile placeholder)
- Metrics: short link creation count, redirect count, redirect latency histogram
- Structured log fields for short-link redirects (key, hit, expiredFlag) + counter increments
- Health probe concept for short link keyspace saturation (warn at >70% estimated entropy usage)

## Immediate Next Steps (Execution Order)

1. Rate limiting middleware + metrics (public registration & short link creation)
2. Short link LRU cache + hit/miss metrics
3. Vanity key design doc & decision (ship vs defer)
4. E2E publish→share→register script (audit log + metrics assertions)
5. Security/abuse & performance docs + README updates
6. Performance smoke test harness & baseline numbers
7. Milestone M5 summary & close-out

### Short Link API (Implemented M4)

Endpoints:

1. POST `/api/public/short-links`

- Auth required.
- Body: `{ eventId: string }`
- Returns 201 with `{ created: true, data: { key, eventId, slug, expiresAt, url } }` when a new link is created.
- Returns 200 with `{ created: false, data: {...} }` when an active (non‑expired) link already exists (idempotent behavior).
- Error Codes:
  - 400: invalid eventId / not published / no public roles
  - 404: event not found
  - 500: unexpected failure

2. GET `/api/public/short-links/:key`

- Public status lookup (no auth).
- 200: `{ success: true, data: { status: "active", slug, eventId } }`
- 410: `{ success: false, status: "expired", message }`
- 404: `{ success: false, status: "not_found", message }`

3. GET `/s/:key`

- Public redirect.
- 302 -> `/public/events/:slug` when active.
- 410 plain text when expired.
- 404 plain text when not found.

Metrics (in‑memory prototype):
`ShortLinkMetricsService` counters: created, resolved_active, resolved_expired, resolved_not_found, redirect_active, redirect_expired, redirect_not_found.
Temp endpoint: `GET /metrics/short-links` returns `{ metrics: { ...counters } }` for debugging (to be secured / exported later).

Reference: See `SHORT_LINKS_API.md` for full specification.

Future Enhancements:

- Add latency histogram (Prometheus) for resolve & redirect.
- Add cache layer for hot key lookups.
- Auto-expire on event unpublish via domain event hook.
- Tests: happy path, idempotent reuse, expired, unpublished, unknown key

3. Share Modal Frontend

- Hook: useShortLink(eventId) (state: idle/loading/error/ready)
- Modal: copy interactions + fallback to canonical URL if service error

4. Expiry & Maintenance

- Daily sweep: mark or remove expired links; log count
- Future: TTL index switch guarded by env flag

5. Coverage Expansion

- Add short link redirect analytics test stub
- Add co-organizer suppression matrix (stretch)

6. Documentation

- API docs section for ShortLink create/redirect + error codes
- Update roadmap incrementally (mark M4 sub-items)

7. Observability

- Add structured logs + metrics counters (short_link.created, short_link.redirect.hit, short_link.redirect.expired)

## M4 Exit Criteria

- Short links create & redirect with correct HTTP codes.
- Share modal displays & copies short URL (tests cover copy success & fallback).
- Expired/unpublished events return 410/404 with integration tests.
- Collision handling verified by unit test.
- No regressions in public registration & suppression suites.

## Change Log (Recent Additions)

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2025-09-25 | Added public registration frontend form + tests (happy & duplicate)                                                                                                                                                                                                                                                                                                                                                  |
| 2025-09-25 | Added ICS builder + unit tests and integrated into confirmation email                                                                                                                                                                                                                                                                                                                                                |
| 2025-09-25 | Added styled confirmation email template (HTML + text)                                                                                                                                                                                                                                                                                                                                                               |
| 2025-09-25 | Enriched AuditLog with requestId and ipCidr for public registrations                                                                                                                                                                                                                                                                                                                                                 |
| 2025-09-26 | Added integration test: `backend/tests/integration/api/public-end-to-end-flow.integration.test.ts` covering publish → short link creation → redirect → public registration with assertions on: <ul><li>Metrics deltas (`short_link_created_total`, `short_link_redirect_total{status="active"}`, `registration_attempts_total`)</li><li>Audit log entries (`EventPublished`, `PublicRegistrationCreated`).</li></ul> |
| 2025-09-26 | Added lightweight performance smoke script: `backend/scripts/perf-smoke.ts` <ul><li>Measures cold vs warm timings for public slug detail, listing endpoint, and short link redirect.</li><li>Purpose: early detection of large regressions (not a benchmark).</li></ul>                                                                                                                                              |
