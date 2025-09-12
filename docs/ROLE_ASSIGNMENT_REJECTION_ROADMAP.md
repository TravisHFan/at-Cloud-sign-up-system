# Role Assignment Rejection Flow Roadmap

Status: IMPLEMENTED (Phase 1 Complete)  
Last Updated: 2025-09-11

## 1. Objective

Implemented simplified rejection-only interaction model:

- Assignment email: shows ONLY the event's scheduled time in the event's stored time zone and a single Reject link.
- Acceptance: IMPLICIT (no action required).
- Rejection link: opens landing page where assignee must enter a required note (not persisted yet—transient for future notification path).
- On rejection: Registration removed (hard delete) and token becomes invalid (HTTP 410 on reuse / replay / expiry / invalid).
- Token validity: 14 days (configurable parameter in generator).
- Landing page displays Event Time (event TZ) and Viewer Local Time (browser) if different.

Explicitly deferred for later phases:

- Persisting user timezone.
- Dual timezone in email body.
- Acceptance confirmation endpoint.
- Persisting rejection note (audit retention policy unresolved).
- Real-time + system message emission to assigner (placeholder in service).
- Localization / i18n.

## 2. Success Criteria

- Rejection link works end‑to‑end (email → landing page → submission → notifications).
- Invalid / expired / replayed tokens consistently return 410 with a user-friendly page.
- Assignment removal is atomic & idempotent (second attempt cannot “half succeed”).
- Real-time event + system message delivered to assigner with rejection metadata (excluding the note from database persistence per scope; note may be embedded transiently in message payload depending on design decision—see Task 5.2).
- Test coverage: Unit + integration for critical paths (token validation, rejection flow, notification emission) + frontend page behavior tests.
- No regression to existing event or messaging flows.

## 3. High-Level Architecture Snapshot

Email → (User clicks Reject) → Browser loads `/assignments/reject?token=...` → (Optional: validate endpoint) → Displays event & local time → User enters note → POST reject → Backend validates token + deletes assignment + emits notifications → Frontend shows confirmation → Subsequent attempts yield 410.

## 4. Milestones & Deliverables

| Milestone | Description                         | Deliverables                                                   | Status      |
| --------- | ----------------------------------- | -------------------------------------------------------------- | ----------- |
| M1        | Token format & verification utility | Token generator + verifier + unit tests (valid/expired)        | ✅ Done     |
| M2        | Backend endpoints scaffold          | GET validate + POST reject                                     | ✅ Done     |
| M3        | Core rejection logic                | Assignment lookup, token validation, deletion, 410 error modes | ✅ Done     |
| M4        | Notifications layer (partial)       | Email path wired (real-time/system message deferred)           | ✅ Partial  |
| M5        | Email template update               | Rejection link + event time                                    | ✅ Done     |
| M6        | Frontend rejection page             | UI, validation, local time display, submit                     | ✅ Done     |
| M7        | Test suite (backend)                | Integration (happy, replay) + token util tests                 | ✅ Done     |
| M8        | Test suite (frontend)               | Page tests (happy, invalid/expired, gating)                    | ✅ Done     |
| M9        | Observability & logging             | Basic structured logs (expansion deferred)                     | ➡️ Deferred |
| M10       | Hardening & polish                  | Planned items tracked (rate limit, copy, i18n)                 | ➡️ Deferred |
| M11       | Final verification & merge          | All tests green (295 passing)                                  | ✅ Done     |

## 5. Detailed Task Breakdown

### 5.1 Token & Validation (Completed)

- Mechanism: JWT (HMAC secret env: `ROLE_ASSIGNMENT_REJECTION_SECRET`).
- `createRoleAssignmentRejectionToken`, `verifyRoleAssignmentRejectionToken` implemented.
- Distinguishes: valid, expired, invalid, wrong_type. Expired surfaces reason used by tests.
- Unit tests cover valid + expired + wrong type scenarios.

### 5.2 Backend Endpoints (Completed)

- GET validate + POST reject implemented.
- Enforces note presence (trim check). (Length limit optional — currently implicit; can add explicit max if needed.)
- Hard delete of registration (chosen approach).
- 410 Gone + code `ASSIGNMENT_REJECTION_TOKEN_INVALID` for invalid/expired/replay.
- Idempotent: replay validation or reject both return 410 after success.

### 5.3 Email Template Update (Completed)

- Single Reject link with token parameter.
- Event date/time displayed (event time zone only per decision log).
- Acceptance implicit copy included.
- Future: Could add snapshot test; current coverage via integration path.

### 5.4 Frontend Rejection Page (Completed)

- Route `/assignments/reject` implemented.
- Validates token; shows invalid state (alert) on 410.
- Displays event and local times (conditional rendering if different planned; current shows both unconditionally — future minor polish).
- Required note gating; button disabled until non-empty.
- Success confirmation state rendered after POST.
- Tests cover flows (happy, invalid/expired, gating).

### 5.5 Notifications & Messaging (Partial / Deferred)

- Email path integrated (Reject link generation).
- Real-time & system message emission not yet implemented (placeholder left in notification service) — NEXT PRIORITY.
- Decision pending on rejection note retention & inclusion.

### 5.6 Observability & Logging (Minimal)

- Basic error/info logs in controller.
- Enhancement: Add structured log object + metrics counters (deferred).

### 5.7 Testing (Backend) (Completed / Partial Coverage)

- Token util unit tests (valid & expired coverage; can extend for tampered/wrong_type later).
- Integration test implemented: happy path, replay, missing note path indirectly, invalid/expired handled in util tests; can add explicit tampered token test later.

### 5.8 Testing (Frontend) (Completed)

- Implemented page tests covering: happy path, invalid/expired, note gating.
- Local time duplicate hiding not implemented (future enhancement if required).

### 5.9 Documentation & Developer Experience (In Progress)

- This roadmap now reflects current implemented state.
- Option: add short mention to main README or API docs (deferred).

### 5.10 Hardening / Nice-to-Haves (Deferred)

- Rate limiting, copy polish, feature flag, metrics alerts remain future tasks.

## 6. Risks & Mitigations

| Risk                                                    | Impact                  | Mitigation                                                                                       |
| ------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------ |
| Token replay before assignment deletion commit          | Duplicate notifications | Make deletion & notification emission part of a single logical flow; idempotency check at start. |
| User expectation mismatch (they look for Accept button) | Support tickets         | Clear email wording “If you accept, no action is required.”                                      |
| Time formatting confusion (DST)                         | Miscommunication        | Rely on IANA tz; include short offset or abbreviation.                                           |
| Large rejection notes (attempted)                       | Payload bloat           | Enforce size limit & trim.                                                                       |
| Missing assignment (already removed manually)           | Broken UX               | 410 graceful page.                                                                               |

## 7. Metrics / Observability Targets

- Rejection success count (per day / per event).
- 410 invalid token count & reasons breakdown.
- Median time between assignment creation and rejection (optional analytics later).

## 8. Completion Checklist (Phase 1)

- [x] All core milestone tasks implemented (M1–M8 + M11).
- [x] Tests green (`npm test`: 295 passing, 64 files).
- [x] Documentation: roadmap updated (this file).
- [x] No blocking TODOs in shipped code for Phase 1.
- [ ] Manual end-to-end email click smoke in deployed/staging env (pending once deployed).

## 9. Changelog

- 2025-09-11: Phase 1 implementation complete — backend token flow, endpoints, email integration, frontend landing page, test suites green, factory adjustments.

## 10. Open Questions

- Rejection note retention: transient only vs persisted audit? (Need stakeholder decision.)
- Real-time/system message content: include note or just metadata? (Privacy vs utility.)
- Additional security: Add short-lived secondary nonce to mitigate token harvesting? Probably unnecessary given JWT exp + single-use semantics.
- Metrics scope: Which counters/dimensions are most actionable (per event type, per role type, latency to rejection)?

---

Maintain this file as the authoritative status reference. Future phases will append to Changelog and refine deferred areas.
