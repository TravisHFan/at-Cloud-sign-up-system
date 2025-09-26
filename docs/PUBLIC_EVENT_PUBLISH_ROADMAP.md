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
  - ⏳ Follow-up: targeted frontend tests for publish UI (in progress)
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
  - ⏳ Short link service scaffold (model + create/redirect endpoints) — NEXT (PRIORITIZED)
  - ⏳ Share modal UI & copy-to-clipboard tests — NEXT
  - ⏳ E2E flow stub (publish → visit public page → register → receive ICS) — NEXT
  - ⏳ Additional negative tests: capacity full, role not open, terms not accepted — PLANNED
  - ⏳ Rate limit + abuse protections (IP + email) — PLANNED
- M4 (NEXT): Short links + Share modal + redirect endpoint & expiry handling
- M5: Observability expansion, rate limits, anti-abuse hardening, final E2E & docs polish

Note: Backend openToPublic role update tests currently timing out after merge; investigation active (suspected hook/db setup contention). Publish lifecycle 400-on-create issue resolved via validation ordering fix.

---

## Recent Achievements Log

| Date (UTC) | Area       | Summary                                                                                                       |
| ---------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| 2025-09-24 | Backend    | Added publish fields to Event schema & initial serializer utility                                             |
| 2025-09-24 | Backend    | Implemented public GET endpoint + integration tests                                                           |
| 2025-09-24 | Frontend   | Placeholder public page `/p/:slug`                                                                            |
| 2025-09-25 | Backend    | Added AuditLog model & lifecycle logging (publish/unpublish)                                                  |
| 2025-09-25 | Backend    | Converted serializer async with real capacity aggregation + tests                                             |
| 2025-09-25 | Backend    | Extracted slug generation utility + collision unit tests                                                      |
| 2025-09-25 | Backend    | Added lifecycle endpoints (publish/unpublish) w/ validation + integration tests                               |
| 2025-09-25 | Frontend   | Organizer Publish/Unpublish UI bar + public URL copy + role `openToPublic` toggles                            |
| 2025-09-25 | Frontend   | Capacity remaining surfaced in role cards (organizer view)                                                    |
| 2025-09-25 | Backend    | Stabilized `openToPublic` role update regression tests (preserve & toggle flows)                              |
| 2025-09-25 | Backend    | Added reusable `buildValidEventPayload` helper for integration tests                                          |
| 2025-09-25 | Backend    | Added flyerUrl integration & serialization tests                                                              |
| 2025-09-25 | Backend    | Hardened rate limit test for role assignment rejection (deterministic 429)                                    |
| 2025-09-25 | Backend    | Removed temporary debug instrumentation from integration tests                                                |
| 2025-09-26 | Backend    | Implemented public registration endpoint + full integration test suite (M3 core)                              |
| 2025-09-26 | Backend    | Added persistent AuditLog (`PublicRegistrationCreated`) for public registrations                              |
| 2025-09-26 | Backend    | Extracted shared helpers `createPublishedEvent` / `ensureCreatorUser`                                         |
| 2025-09-26 | Backend    | Added duplicate existing-user idempotent registration integration test                                        |
| 2025-09-26 | Backend    | Added `hashEmail` unit test (case + whitespace normalization)                                                 |
| 2025-09-26 | Frontend   | Public registration form (role select, attendee fields, consent)                                              |
| 2025-09-26 | Frontend   | Confirmation email template (HTML + text) with role & purpose, ICS attached                                   |
| 2025-09-26 | Backend    | AuditLog enrichment: requestId, truncated ipCidr added to PublicRegistrationCreated metadata                  |
| 2025-09-27 | Backend    | Restored optional role fields (agenda/startTime/endTime) in create & merge flows; regression tests added      |
| 2025-09-27 | Backend    | Removed malformed legacy snippet causing TypeScript errors; reinstated recurring scheduling math              |
| 2025-09-27 | Backend    | Stabilized notification suppression integration tests (explicit test DB connect; parallel collection cleanup) |
| 2025-09-27 | Backend    | Added flyerUrl normalization & response mapping verification across integration tests                         |
| 2025-09-27 | Backend    | General TypeScript strictness pass—eliminated unsafe any casts in event controller notification blocks        |
| 2025-09-27 | Full Suite | All backend + frontend tests (unit + integration) passing after suppression + role agenda fixes               |

Last updated: 2025-09-27 (M1–M3 core complete; full suite green after suppression + role agenda regression fixes; NEXT: Short Links + Share Modal)

## Upcoming Focus (Next Iteration)

1. Short Links Backend Scaffold (IN PROGRESS PLANNING)

- Implement `ShortLink` model, POST create endpoint, GET redirect handler (302 & 410/404 logic)
- Integrate automatic expiry on unpublish/end-date via maintenance job
- Unit tests: key generator (base62 charset, length variance, collision retry), model validation
- Integration tests: create, redirect active, redirect expired/unpublished → 410/404

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

## Immediate Next Steps (Actionable Breakdown)

1. ShortLink Model & Key Utility

- Schema: key (unique, base62, len 6–8), eventId, targetSlug, createdBy, createdAt, expiresAt
- Helper: generateBase62Key (retry up to 5 on collision)
- Tests: charset compliance, collision retry, length distribution

2. Endpoints

- POST /api/public/short-links { eventId } — idempotent (return existing active)
- GET /api/public/short-links/:key → 302 active, 410 expired, 404 unknown/unpublished
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

| Date       | Change                                                                |
| ---------- | --------------------------------------------------------------------- |
| 2025-09-25 | Added public registration frontend form + tests (happy & duplicate)   |
| 2025-09-25 | Added ICS builder + unit tests and integrated into confirmation email |
| 2025-09-25 | Added styled confirmation email template (HTML + text)                |
| 2025-09-25 | Enriched AuditLog with requestId and ipCidr for public registrations  |
