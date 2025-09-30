## Event Publish Required Fields Roadmap

Last updated: 2025-09-29

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

### Status Tracking (to update during implementation)

| Item                           | Status   | Notes                                  |
| ------------------------------ | -------- | -------------------------------------- |
| Backend validation update      | COMPLETE | Phase 1: helper + enforcement merged.  |
| Publish 422 contract           | COMPLETE | Returns code + missing + format.       |
| Auto-unpublish logic           | TODO     | Next phase.                            |
| System message + email         | TODO     | Pending after auto-unpublish core.     |
| Response builder fields        | TODO     | Will add autoUnpublished fields.       |
| Confirmation email adjustments | TODO     | Blocked on enforcement rollout.        |
| Backend tests                  | COMPLETE | Unit + integration for publish gating. |
| Frontend required mapping      | TODO     | Not started.                           |
| Publish UI gating              | TODO     | Pending frontend work.                 |
| Auto-unpublish toast           | TODO     | After auto-unpublish backend.          |
| Format switch warning          | TODO     | After gating foundation.               |
| Frontend tests                 | TODO     | After UI implementation.               |
| Audit script                   | OPTIONAL | Defer until just before deployment.    |

---

### All Open Questions Resolved

All clarifications addressed; no outstanding questions.

---

### Phase 1 Implementation Note

Phase 1 completed (2025-09-29):

- Added `NECESSARY_PUBLISH_FIELDS_BY_FORMAT` & `getMissingNecessaryFieldsForPublish`.
- Updated `validateEventForPublish` to always enforce necessary publish fields and include aggregate `MISSING_REQUIRED_FIELDS` error.
- Modified publish endpoint to return 422 with contract `{ success:false, code:"MISSING_REQUIRED_FIELDS", format, missing, message }`.
- Added unit + integration tests (publish gating) – all passing.

Next target: Auto-unpublish logic (Phase 3 in Backend plan) including model field additions and notification pipeline.

### Ready for Execution

Proceed with auto-unpublish implementation (Phase 3) unless priorities shift.
