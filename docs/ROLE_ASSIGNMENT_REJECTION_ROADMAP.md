# Role Assignment Rejection Flow Roadmap

Status: DRAFT (tracking live)  
Last Updated: 2025-09-11

## 1. Objective

Implement a simplified role-assignment interaction model:

- Assignment email shows ONLY the event's scheduled time in the event's stored time zone.
- Acceptance is IMPLICIT (no action required).
- A single Rejection link in the email opens a landing page where the assignee must supply a rejection note (note is transient: not stored in DB; only propagated to assigner via system + real‑time notification and optionally email).
- On rejection the assignment is deleted (or marked removed) and cannot be reused; the link becomes invalid (410 Gone).
- Token validity: 14 days.
- Rejection landing page (client) also shows the user’s local time (computed in browser) alongside the event time.

Out of Scope (explicitly deferred):

- Storing user timezone.
- Dual timezone display in the email itself.
- Acceptance confirmation endpoint.
- Persisting the rejection note content.
- Multi-language / localization.

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

| Milestone | Description                         | Deliverables                                                        | Target | Status                                |
| --------- | ----------------------------------- | ------------------------------------------------------------------- | ------ | ------------------------------------- |
| M1        | Token format & verification utility | Rejection token generator + verifier tests                          | Day 1  | 🚧 (scaffold added)                   |
| M2        | Backend endpoints scaffold          | `GET validate` + `POST reject` (no logic)                           | Day 1  | 🚧 (routes + controller placeholders) |
| M3        | Core rejection logic                | Assignment lookup, token validation, deletion, error modes          | Day 2  | ☐                                     |
| M4        | Notifications layer                 | Real-time emit + system message creation                            | Day 2  | ☐                                     |
| M5        | Email template update               | Single Rejection CTA + event time only                              | Day 2  | ☐                                     |
| M6        | Frontend rejection page             | UI, token validation request, local time rendering, form submission | Day 3  | ☐                                     |
| M7        | Test suite (backend)                | Unit + integration (happy, expired, replay, missing note)           | Day 3  | ☐                                     |
| M8        | Test suite (frontend)               | Page rendering, invalid token, submit gating                        | Day 3  | ☐                                     |
| M9        | Observability & logging             | Structured events, 410 tracking                                     | Day 4  | ☐                                     |
| M10       | Hardening & polish                  | Rate limits (optional), copy review, docs                           | Day 4  | ☐                                     |
| M11       | Final verification & merge          | Coverage review, regression check                                   | Day 4  | ☐                                     |

## 5. Detailed Task Breakdown

### 5.1 Token & Validation

- [ ] Decide token mechanism (JWT vs signed opaque). (Default: JWT with HMAC secret.)
- [ ] Implement `createRejectionToken(assignmentId, assigneeId, exp)`.
- [ ] Implement `verifyRejectionToken(token)` returning structured result (valid, expired, invalid, mismatch).
- [ ] Unit tests (valid, expired, tampered payload, wrong type).

### 5.2 Backend Endpoints

- [ ] `GET /api/role-assignments/reject/validate` (query: token) → 200 or 410.
- [ ] `POST /api/role-assignments/reject` body: `{ token, note }`.
- [ ] Enforce note: non-empty, trimmed, length ≤ 1000.
- [ ] Assignment deletion (or status transition). Decide storage semantics: full delete vs soft flag. (Default: full delete.)
- [ ] 410 error schema standardization `{ code: "ASSIGNMENT_REJECTION_TOKEN_INVALID" }`.
- [ ] Ensure duplicate / replay attempts return 410.

### 5.3 Email Template Update

- [ ] Modify role assignment email: remove Accept instructions; add one “Reject this assignment” button.
- [ ] Display event date/time in event.timeZone (abbrev or offset) with consistent formatting.
- [ ] Footer line: “If you accept, no action is required.”
- [ ] Link structure: `${BASE_URL}/assignments/reject?token=...`.
- [ ] Snapshot / rendering test.

### 5.4 Frontend Rejection Page

- [ ] Route (e.g., `/assignments/reject`).
- [ ] Parse token from querystring.
- [ ] Invoke validate endpoint; handle loading, success, invalid (410) state.
- [ ] Display Event Time (Event TZ) + Local Time (client tz). Hide duplicate if identical.
- [ ] Note textarea (required, live character count, min length hint).
- [ ] Submit handler → POST rejection.
- [ ] Success panel + navigation link(s).
- [ ] Accessibility: proper labels, focus management on error & success.
- [ ] Vitest/RTL tests.

### 5.5 Notifications & Messaging

- [ ] WebSocket emit event name `roleAssignment.rejected` with payload: `{ assignmentId, eventId, role, note, rejectedBy }`.
- [ ] System message creation (category constant). Decide if rejection note is included in system message body (transient vs stored). (Per scope: do NOT persist note; if included, ensure ephemeral or exclude; confirm final approach.)
- [ ] Optional email to assigner (stretch): toggle via feature flag.

### 5.6 Observability & Logging

- [ ] Structured log: `role_assignment_rejected` (include assignmentId, eventId, rejectedBy, assignerId, noteLength, timestamp).
- [ ] Metric counter (if metrics infra exists) increment on successful rejection.
- [ ] 410 occurrences logged with reason (expired, replay, missing assignment).

### 5.7 Testing (Backend)

- [ ] Token util unit tests.
- [ ] Rejection endpoint integration tests:
  - [ ] Happy path
  - [ ] Expired token
  - [ ] Tampered token
  - [ ] Replay (after success)
  - [ ] Missing note
  - [ ] Assignment already removed pre-use

### 5.8 Testing (Frontend)

- [ ] Valid token renders details + note form.
- [ ] Invalid token → invalid panel.
- [ ] Submit disabled until note present.
- [ ] Success state after mock POST.
- [ ] Local time equality hides duplicate block.

### 5.9 Documentation & Developer Experience

- [ ] Update `README.md` (brief feature mention) or internal docs index linking to this roadmap.
- [ ] Add API endpoint reference doc (if consistent with repo conventions) describing request/response examples.

### 5.10 Hardening / Nice-to-Haves (Optional)

- [ ] Basic rate limiting on rejection POST to mitigate spam.
- [ ] Copy review for user-facing texts.
- [ ] Feature flag guard (env var) for early rollout.
- [ ] Monitoring alert threshold for unusually high rejection rates.

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

## 8. Completion Checklist

- [ ] All milestone tasks checked.
- [ ] Tests green (backend + frontend) via `npm test` (root) with no coverage regression in unrelated areas.
- [ ] Documentation updated.
- [ ] No TODO markers left in new code (unless tracked issues created).
- [ ] Manual smoke test of email → reject flow.

## 9. Changelog (Fill as We Progress)

- (pending)

## 10. Open Questions (Track & Resolve)

- Should system message include the rejection note text if not persisted elsewhere? (Default: ephemeral only—decide before implementing Task 5.5.)
- Soft delete vs hard delete for assignment? (Default chosen: hard delete.)
- Include optional email notification to assigner post-rejection? (Default: later / optional.)

---

Maintain this file as the single source of truth for progress. Update statuses and append to the Changelog section as milestones complete.
