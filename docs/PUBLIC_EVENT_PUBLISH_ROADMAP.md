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

## Milestones (suggested)

- M1: Public serializer + GET `/api/public/events/:slug` + read-only public page
- M2: Role openness UI + publish/unpublish endpoints & controls
- M3: Public registration backend + frontend form
- M4: Short links + Share modal
- M5: Observability, rate limits, polish; finalize tests and docs

---

Last updated: 2025-09-24
