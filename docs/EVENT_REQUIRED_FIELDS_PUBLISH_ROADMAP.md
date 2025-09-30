## Event Publish Required Fields Roadmap

Last updated: 2025-09-30 (notification email implemented + domain event emission + idempotency tests)

### Terminology Clarification

"Schema required" fields are those enforced at creation (cannot create the event without them). "Necessary fields for publishing" are maybe optional during draft creation but must be present (non-empty) before the event can be published or remain published. This roadmap uses the phrase "necessary fields (for publishing)" to distinguish from schema-level required fields.

### Objective

Enforce format-specific mandatory fields (Zoom + Meeting credentials + Location) for publishing events, surface clear validation to operators, include appropriate details in attendee confirmation emails, and auto-unpublish events that lose required data. Notify organizers of auto-unpublish.

---

### Business Rules (Confirmed)

1. Online events (to publish) need the following necessary fields: `zoomLink`, `meetingId`, `passcode`.
2. In-person events (to publish) need the following necessary field: `location`.
3. Hybrid (string value observed: `Hybrid Participation`) events (to publish) need: `location`, `zoomLink`, `meetingId`, `passcode`.
4. Whitespace-only counts as empty.
5. Publish is blocked if any necessary field for publishing is missing.
6. If a published event loses any necessary field for publishing (including by format change introducing new necessary fields) ⇒ auto-unpublish immediately.
7. If necessary fields for publishing remain non-empty but values change ⇒ stay published (no auto-unpublish, no automatic attendee notification).
8. Auto-unpublish triggers system message + email to organizer + co-organizers only.
9. Distinct backend error code on publish failure: `MISSING_REQUIRED_FIELDS`.
10. Registration confirmation emails must show only the relevant location / virtual sections per format.

---

### Field Names (from codebase)

```
location, zoomLink, meetingId, passcode
```

Event format strings encountered: `Online`, `In-person`, `Hybrid Participation`.

---

### Necessary Fields for Publishing Matrix

| Format               | Necessary Fields (for publishing)       |
| -------------------- | --------------------------------------- |
| Online               | zoomLink, meetingId, passcode           |
| In-person            | location                                |
| Hybrid Participation | location, zoomLink, meetingId, passcode |

Helper (planned): `getMissingNecessaryFieldsForPublish(event)` → `string[]`.

---

### Backend Work Plan

#### Phase 1: Core Validation

- Update `validateEventForPublish` (remove dependence on STRICT_VALIDATION for these publishing necessities).
- Add meetingId & passcode enforcement for Online/Hybrid; require location for In-person/Hybrid.
- Return per-field errors; aggregate response includes `code: MISSING_REQUIRED_FIELDS` if any necessary field missing.

#### Phase 2: Publish Endpoint (`eventController.publishEvent`)

- Before setting `publish=true`, call helper.
- If any necessary field missing: respond `422` JSON:

```json
{
  "success": false,
  "code": "MISSING_REQUIRED_FIELDS",
  "format": "Online",
  "missing": ["zoomLink", "meetingId"],
  "message": "Publish validation failed"
}
```

#### Phase 3: Update / Patch Logic

- After applying update but before save, if `event.publish === true`:
  - Recompute missing necessary fields.
  - If any → set `publish=false`, set `autoUnpublishedAt`, `autoUnpublishedReason="MISSING_REQUIRED_FIELDS"`.
  - Persist then emit system message + organizer/co-organizer email.
- Format change causing new necessary fields missing triggers same path.

#### Phase 4: Model & Response

- Extend Event schema (if not present): `autoUnpublishedAt?: Date`, `autoUnpublishedReason?: string`.
- Include new fields in ResponseBuilderService event payload.

#### Phase 5: Notifications

- System message type: `event_auto_unpublished` with payload `{ eventId, reason, missing: [] }`.
- Email Subject: `[Action Required] Event Unpublished – Missing Required Fields`.
- Email Body: list format + missing human-readable labels + CTA to edit.

#### Phase 6: Registration Confirmation Email Adjustments

- Ensure Online/Hybrid sections include _all_ virtual fields (Zoom link hyperlink, Meeting ID, Passcode) because they are guaranteed after publishing enforcement.
- Hybrid includes both location and virtual block.
- In-person includes only location.

#### Phase 7: Tests (Backend)

- Unit: helper permutations; publish validation per format.
- Integration:
  - Publish blocked (each format missing one necessary field).
  - Publish success when complete.
  - Auto-unpublish on clearing one necessary field.
  - Auto-unpublish on format change adding new unmet necessary fields.
  - Stay published on modifications with non-empty necessary values.
  - System message + email fired exactly once per auto-unpublish.
  - Confirmation email contains correct sections.
- Optional audit script: list currently published events violating new rules prior to rollout.

---

### Frontend Work Plan

#### Phase A: Utilities & Types

- Add mapping: `necessaryPublishFieldsByFormat`.
- Extend event type with `autoUnpublishedReason?`, `autoUnpublishedAt?`.

#### Phase B: Edit/Create UI

- Compute `missingNecessaryFields` reactively.
- Display inline banner: “To publish this Online event, add: Zoom Link, Meeting ID, Passcode.”
- Add required indicator near fields when missing.

#### Phase C: Publish Button

- Disabled state when missing necessary fields.
- Tooltip / helper listing missing labels.
- Catch backend `MISSING_REQUIRED_FIELDS` to show consolidated error if user bypassed UI.

#### Phase D: Auto-Unpublish Feedback

- If response transitions from published→unpublished with `autoUnpublishedReason === "MISSING_REQUIRED_FIELDS"`:
  - Show toast: “Event automatically unpublished: missing Zoom Link, Passcode.”
  - Optional persistent alert until resolved.

#### Phase E: Format Switch UX

- If currently published and new format introduces unmet necessary fields:
  - Immediate warning: “Switching to Hybrid will unpublish until Zoom Link, Meeting ID, Passcode, Location are provided.”

#### Phase F: Tests (Frontend)

- Unit: publish-necessary fields resolver per format.
- Component: publish disabled states & messaging.
- Format switch warning while published.
- Handling backend `MISSING_REQUIRED_FIELDS` error mapping.
- Auto-unpublish toast on simulated server response.

---

### Error / Response Contract

| Action                             | Status | Shape                                                                               |
| ---------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| Publish (missing necessary fields) | 422    | `{ success:false, code:"MISSING_REQUIRED_FIELDS", missing:[...], format, message }` |
| Auto-unpublish on update           | 200    | Event payload with `publish=false`, `autoUnpublishedReason`                         |

---

### Human-Readable Field Labels

```
zoomLink     -> Zoom Link
meetingId    -> Meeting ID
passcode     -> Passcode
location     -> Location
```

---

### Implementation Order Checklist

1. Backend helper + validateEventForPublish update
2. Publish endpoint enforcement (422 contract)
3. Update auto-unpublish logic + model fields
4. System message & email notification
5. Response builder adjustments
6. Registration confirmation email adjustments
7. Backend tests (unit + integration)
8. Frontend mapping + types (necessary publish fields)
9. UI gating (publish button + banner)
10. Auto-unpublish & format-switch warnings
11. Frontend tests
12. Optional audit script & deployment note

---

### Deployment Considerations

- Run audit (script or manual query) to identify already-published events missing newly enforced fields; notify owners before deploy.
- Deploy backend first (enforcement), then frontend (UI clarity). Frontend lag is acceptable—backend will still protect invariants.

---

### Future (Out-of-Scope / Parking Lot)

- Organizer self-service resend updated virtual details to all registrants.
- Analytics report of auto-unpublish incidents.
- Granular publish readiness score UI.

---

### Status Tracking (Updated)

| Item                                     | Status   | Notes                                                                                       |
| ---------------------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| Backend validation update                | COMPLETE | Phase 1: helper + enforcement merged.                                                       |
| Publish 422 contract                     | COMPLETE | Returns code + missing + format.                                                            |
| Auto-unpublish logic                     | COMPLETE | Integration tests cover Online/In-person/Hybrid removal.                                    |
| Format-change auto-unpublish             | COMPLETE | In-person -> Hybrid test confirms added required virtual fields cause unpublish.            |
| Auto-unpublish notification email        | COMPLETE | Real email content (CTA + missing list) implemented.                                        |
| System message dispatch (placeholder)    | TODO     | Socket/system message variant still pending; email portion done.                            |
| Response builder fields                  | COMPLETE | autoUnpublishedAt/Reason included in responses.                                             |
| Confirmation email adjustments           | COMPLETE | Integration test per format validates inclusion sections.                                   |
| Confirmation email negative assertions   | TODO     | Add explicit absence checks (no virtual fields for In-person, no location for Online).      |
| Backend tests (core)                     | COMPLETE | Publish gating + auto-unpublish + format-change + email content + notification idempotency. |
| Helper & assertion utilities             | COMPLETE | `publishFieldsForFormat`, `assertMissingFields422` in use.                                  |
| Matrix guardrail unit test               | COMPLETE | Prevents silent drift in necessary fields matrix.                                           |
| Domain event emission (auto-unpublish)   | COMPLETE | `EVENT_AUTO_UNPUBLISHED` emitted via central domainEvents emitter.                          |
| Idempotent notification guard            | COMPLETE | Verified: second update while unpublished does not resend notification.                     |
| Frontend required mapping                | TODO     | Not started.                                                                                |
| Publish UI gating                        | TODO     | Pending frontend work.                                                                      |
| Auto-unpublish toast                     | TODO     | After frontend consumes new fields / real-time event.                                       |
| Format switch warning                    | TODO     | Predictive unpublish risk messaging.                                                        |
| Frontend tests                           | TODO     | Blocked on UI implementation.                                                               |
| Audit script                             | OPTIONAL | Pending; to run before deployment to surface legacy violations.                             |
| Performance micro-benchmark (validation) | OPTIONAL | Measure helper overhead (low priority).                                                     |

---

### Achievements Added (Post Initial Rollout)

1. Consolidated necessary publish fields matrix via `NECESSARY_PUBLISH_FIELDS_BY_FORMAT` constant.
2. Added guardrail unit test ensuring matrix integrity (prevents accidental format drift).
3. Implemented consistent 422 publish failure contract with aggregate missing list + per-field errors.
4. Introduced test helper `publishFieldsForFormat` to remove duplication and reduce brittle literals.
5. Added assertion helper `assertMissingFields422` for clearer, DRY validation of error payloads.
6. Created auto-unpublish integration suite verifying unpublish when a required field (or newly required via format) is emptied post-publish for Online, In-person, Hybrid.
   6a. Added format-change auto-unpublish test (In-person → Hybrid) confirming transition introduces missing virtual fields and triggers unpublish.
7. Response builder now surfaces `autoUnpublishedAt` & `autoUnpublishedReason` for consumers.
8. Refactored existing publish gating tests to leverage helpers, reducing maintenance cost.
9. Implemented confirmation email content logic & integration test asserting correct per-format inclusion (Hybrid: both; Online: virtual only; In-person: location only).
10. Stabilized test environment by removing per-test DB connection closure (prevented intermittent ECONNRESET failures).
11. Added `sendEventAutoUnpublishNotification` stub enabling notification spy without failing tests.
12. Removed misplaced auto-unpublish notification block from `publishEvent` to prevent premature side-effects.
13. Corrected guest signup endpoint path in tests (`/api/events/:id/guest-signup`) eliminating 404 failures.
14. Replaced invalid event type literal with allowed type to ensure consistent creation in tests.
15. Hardened helper flow for roleId retrieval in confirmation email test (avoids undefined leading to 404).
16. Implemented real auto-unpublish notification email (actionable CTA + missing fields list) replacing stub body.
17. Added lightweight domain event system (`domainEvents`) emitting `EVENT_AUTO_UNPUBLISHED` for decoupled future consumers.
18. Added idempotency assurance test (no duplicate notification on subsequent edits while still unpublished).

---

### Next Backend Focus (Incremental)

1. System message dispatch: emit structured system message / socket broadcast for auto-unpublish aligning with planned `event_auto_unpublished` type.
2. Negative email assertions: extend confirmation email tests to assert absence of irrelevant sections (no virtual block for In-person, no location for Online).
3. Additional format transition coverage: Online → Hybrid (missing location) auto-unpublish test; Hybrid → In-person (should NOT auto-unpublish when removing virtual fields if they become unnecessary) invariance test.
4. Idempotency guard: ensure repeated updates while still missing fields don't resend notifications (test via double PATCH sequence).
5. Optional performance micro-benchmark for validation helper (baseline vs after potential refactors).
6. Audit script (pre-deploy) to list currently published events missing necessary fields (safety net for production data).

### Next Frontend Focus

1. Mapping & types: add `necessaryPublishFieldsByFormat` + extend Event type with `autoUnpublishedAt`, `autoUnpublishedReason`.
2. Publish readiness banner & disabled button state with missing fields list.
3. Format switch predictive warning (if switching introduces missing fields while published).
4. Auto-unpublish toast & persistent alert upon receiving an event update with `autoUnpublishedReason === "MISSING_REQUIRED_FIELDS"`.
5. Error contract handling: map 422 backend error to inline summary showing human-readable missing labels.
6. Tests: unit (field resolver), component (publish button gating), integration (format switch warning, auto-unpublish toast), e2e (happy publish flow per format).

### Coordination Notes

- Backend contracts for publish & auto-unpublish considered stable; frontend can proceed in parallel with notification pipeline work.
- Domain event emission (backend) should precede frontend real-time subscription to reduce churn.
- Notification email template reuse should leverage existing transactional email infrastructure once real pipeline implemented.

---

### Phase Summary (Current)

Core enforcement, auto-unpublish mechanics, format-change handling, and confirmation email content validation are complete and green across integration tests. A stub exists for notifications; remaining backend work centers on real notification delivery, domain event emission, and idempotency hardening. Frontend tasks (publish gating UI & reactive warnings) can safely begin using the current API contracts.
