# Event Types and Role Sets Revamp — Implementation Blueprint

Status: Approved blueprint for implementation
Owner: Platform Team (@Cloud)
Last updated: 2025-08-12

## Summary

We will standardize Event Types to a curated set and drive the Create New Event experience (and subsequent registration roles) from type-specific role-sets. This document defines the target Event Types, role-sets, validation rules, API/UI contracts, migration plan, and tests.

## Goals

- Allow only these Event Types: Conference, Mentor Circle, Webinar, Workshop.
- Remove all other legacy event types from the system.
- Drive the role-set shown in Create New Event from the selected Event Type.
- Keep the current role-set for Conference unchanged.
- Introduce well-defined role-sets for Webinar, Mentor Circle, and Workshop, with per-role max participants.
- Enforce max participants per role at the API and UI levels.

## Non-Goals

- Changing the existing Conference role-set (leave exactly as-is).
- Introducing a WYSIWYG role-set editor (future enhancement).

---

## Event Types (authoritative list)

- Conference (existing; role-set unchanged)
- Mentor Circle (new)
- Webinar (new)
- Workshop (new)

Any other type must be considered invalid and blocked at both backend and frontend.

---

## Role-Set Definitions (authoritative)

Notes:

- max denotes the maximum number of registered participants allowed for each role.
- key is the code-friendly identifier we’ll use in APIs/payloads.
- label is the human-friendly text shown in the UI.

### Conference

- Role-set: Use current configuration as-is (no change). Documented in code as the existing default for conference.

### Webinar (new)

- opening_prayer — Opening prayer — max: 1
- zoom_master — Zoom Master — max: 2
- moderator — MC or Moderator — max: 1
- speakers — Speakers — max: 4
- closing_prayer — Closing prayer — max: 1
- breakout_room_leads_e — Breakout Room Leads for E Circle — max: 2
- breakout_room_leads_m — Breakout Room Leads for M Circle — max: 2
- breakout_room_leads_b — Breakout Room Leads for B Circle — max: 2
- breakout_room_leads_a — Breakout Room Leads for A Circle — max: 2

### Mentor Circle (new)

- mentors — Mentors — max: 5
- class_representatives — Class Representatives — max: 2
- mentees — Mentees — max: 25

### Workshop (updated)

Top-level roles:

- zoom_host — Zoom Host — max: 1
- zoom_cohost — Zoom Co-host — max: 2
- spiritual_cover — Spiritual Adviser — max: 2
- opening_keynote_speaker — Opening Keynote Speaker — max: 2
- evaluators — Evaluators — max: 5
- closing_keynote_speaker — Closing Keynote Speaker — max: 2
- content_master — Content Master — max: 1
- meeting_timer — Meeting Timer — max: 1

Group roles (fixed groups A–F, each with two roles):

- group\_{A..F}\_leader — Group {A..F} Leader — max: 1
- group\_{A..F}\_participants — Group {A..F} Participants — max: 3

This yields 12 group role entries (2 per group × 6 groups) in addition to the updated top-level roles.

---

## Data Model and Validation

### Backend model updates

- EventType enum: restrict to ["Conference", "Mentor Circle", "Webinar", "Workshop"].
- RoleTemplate structure (internal):
  - key: string (e.g., "opening_prayer", "group_A_leader")
  - label: string
  - max: number (>=1)
  - group?: string (e.g., "A" for Workshop group roles)
- Event entity validation:
  - eventType must be one of the allowed values.
  - Format-dependent normalization (server-enforced on create and update):
    - If format === "Online": force `location` to literal "Online" regardless of client input.
    - If format === "In-person": strip Zoom fields (`zoomLink`, `zoomMeetingId`, `zoomPasscode`, `zoomHostKey`, etc.).
    - If format ∈ {"Online", "Hybrid Participation"}: allow Zoom fields; trim/normalize values.
  - For event creation/update that configures available roles or slot counts, the payload must:
    - Only include roles from the template for the selected eventType.
    - Not exceed template max per role.
    - For Workshop, group roles must be within A–F and exactly the defined pairs.
  - Additional field constraints:
    - `agenda` length must be between 20 and 2000 characters (inclusive); otherwise 400 with a field error.
    - Time validation is timezone-aware; start must be before end in the provided `timeZone` (conflicts are detected using wall-clock conversions).
  - Server returns 400 with precise field errors if constraints are violated.

### Source of truth for templates

- Centralize role-set templates in backend (TypeScript module), and expose read-only API for clients.
- Avoid duplicating template constants across services.

---

## API Contracts

Expose a read-only endpoint for UI to build the form dynamically:

- GET /api/events/templates
  - 200 OK
  - Body shape:
    {
    "types": [
    { "key": "Conference", "label": "Conference" },
    { "key": "Mentor Circle", "label": "Mentor Circle" },
    { "key": "Webinar", "label": "Webinar" },
    { "key": "Workshop", "label": "Workshop" }
    ],
    "roleSets": {
    "Conference": { "inheritExisting": true },
    "Mentor Circle": [
    { "key": "mentors", "label": "Mentors", "max": 5 },
    { "key": "class_representatives", "label": "Class Representatives", "max": 2 },
    { "key": "mentees", "label": "Mentees", "max": 25 }
    ],
    "Webinar": [
    { "key": "opening_prayer", "label": "Opening prayer", "max": 1 },
    { "key": "zoom_master", "label": "Zoom Master", "max": 2 },
    { "key": "moderator", "label": "MC or Moderator", "max": 1 },
    { "key": "speakers", "label": "Speakers", "max": 4 },
    { "key": "closing_prayer", "label": "Closing prayer", "max": 1 },
    { "key": "breakout_room_leads_e", "label": "Breakout Room Leads for E Circle", "max": 2 },
    { "key": "breakout_room_leads_m", "label": "Breakout Room Leads for M Circle", "max": 2 },
    { "key": "breakout_room_leads_b", "label": "Breakout Room Leads for B Circle", "max": 2 },
    { "key": "breakout_room_leads_a", "label": "Breakout Room Leads for A Circle", "max": 2 }
    ],
    "Workshop": {
    "topLevel": [
    { "key": "zoom_host", "label": "Zoom Host", "max": 1 },
    { "key": "zoom_cohost", "label": "Zoom Co-host", "max": 2 },
    { "key": "spiritual_cover", "label": "Spiritual Adviser", "max": 2 },
    { "key": "main_mentor", "label": "Main Mentor", "max": 2 },
    { "key": "co_coach", "label": "Co-coach", "max": 5 }
    ],
    "groups": [
    { "group": "A", "roles": [
    { "key": "group_A_leader", "label": "Group A Leader", "max": 1 },
    { "key": "group_A_participants", "label": "Group A Participants", "max": 3 }
    ]},
    { "group": "B", "roles": [
    { "key": "group_B_leader", "label": "Group B Leader", "max": 1 },
    { "key": "group_B_participants", "label": "Group B Participants", "max": 3 }
    ]},
    { "group": "C", "roles": [
    { "key": "group_C_leader", "label": "Group C Leader", "max": 1 },
    { "key": "group_C_participants", "label": "Group C Participants", "max": 3 }
    ]},
    { "group": "D", "roles": [
    { "key": "group_D_leader", "label": "Group D Leader", "max": 1 },
    { "key": "group_D_participants", "label": "Group D Participants", "max": 3 }
    ]},
    { "group": "E", "roles": [
    { "key": "group_E_leader", "label": "Group E Leader", "max": 1 },
    { "key": "group_E_participants", "label": "Group E Participants", "max": 3 }
    ]},
    { "group": "F", "roles": [
    { "key": "group_F_leader", "label": "Group F Leader", "max": 1 },
    { "key": "group_F_participants", "label": "Group F Participants", "max": 3 }
    ]}
    ]
    }
    }
    }

Event creation/update (example; adapt to current API):

- POST /api/events
- PATCH /api/events/:id
- Payload must include eventType and any role configuration consistent with the returned template. Backend validates upper bounds.

---

## Frontend Behavior (Create New Event page)

- Show Event Type select with allowed values only.
- When a type is selected:
  - Conference: render the existing (unchanged) role-set UI.
  - Webinar & Mentor Circle: render simple lists of roles with counters/slots up to max.
  - Workshop: render:
    - Top-level roles with counters up to max.
    - Six fixed groups (A–F), each with two lines: Group Leader (max 1) and Group Participants (max 3).
- Disable increment when the max is reached; show remaining available count per role.
- Validate on submit and show per-role error messages if limits exceeded (also rely on server validation).
- Prefer loading templates from the backend endpoint to avoid drift.

Accessibility & UX:

- Labels must be clear and keyboard navigable; include aria-describedby for error text.
- Maintain form state when switching types but warn users that changing types resets role-set input.

---

## Migration Plan

1. Code-level removal

- Replace existing EventType enum with the allowed set.
- Remove constants/usages of legacy types. Update switch/if branches accordingly.

2. Data migration

- For existing events in DB with disallowed types:
  - Set eventType to conference.
  - If stored role allocations are incompatible, keep them if they fit conference; otherwise, trim to limits and log a migration note.

3. API compatibility

- Ensure clients cannot create/update events with legacy types (400 with helpful message).
- Add a one-time admin audit script/report listing adjusted events.

Rollback:

- Keep a DB backup or export before running migration.

---

## Validation Rules (Backend)

- eventType ∈ {Conference, Mentor Circle, Webinar, Workshop}.
- Every requested role key must exist in the template for the selected eventType.
- requestedCount ≤ max for each role.
- Workshop-specific:
  - Only groups A–F.
  - Exactly the defined leader/participants roles per group.

HTTP status & error model:

- 400 Bad Request when invalid; include details per role key.

---

## Testing Strategy

Unit (backend):

- Template loader returns exact structures for each type.
- Validation rejects unknown role keys and overflows; accepts exact-max cases.

Integration (backend):

- GET /api/events/templates returns expected contract and values.
- POST/PATCH events with role payloads:
  - Accept within limits; reject when exceeding.
  - Workshop group validation (A–F only; correct roles per group).

Unit (frontend):

- Form renders correct roles after selecting each type.
- Counters clamp at max; error messages display on overflow.

E2E/UI (frontend):

- Creating events of each type shows appropriate role-set UI.
- Submitting over-max is blocked client-side and rejected server-side.

Regression:

- Conference flows remain unchanged (snapshot test the form for Conference).

---

## Implementation Checklist

Backend

- [ ] Add templates module for role-sets.
- [ ] Constrain EventType enum to the allowed set.
- [ ] Implement GET /api/events/templates.
- [ ] Enforce role validation in create/update handlers.
- [ ] Write unit/integration tests for templates + validation.
- [ ] Write DB migration script and run on staging.

Frontend

- [ ] Update Event Type select to allowed values only.
- [ ] Fetch templates from API and render dynamic role-set sections.
- [ ] Implement Workshop groups A–F UI with role rows and max limits.
- [ ] Form-level and per-role validation; error messaging.
- [ ] Unit and E2E tests for rendering and validation.

Operational

- [ ] Prepare migration report and comms.
- [ ] Release notes highlighting legacy type removal.

---

## Open Questions (resolve before code freeze)

- Do we need i18n display strings for new roles now, or can we add them post-MVP?
- For Conference, do we want to emit the role-set via the /templates endpoint for consistency, or keep "inheritExisting": true?

---

## Appendix: Canonical Role Keys

- Use lowercase snake_case keys.
- Workshop group keys: group_A_leader, group_A_participants, … through group_F_leader, group_F_participants.
- Labels are editable UI strings; keys are stable API identifiers.

---

## Addendum (2025-09): Universal Role Access Policy

Original gating logic (now removed) constrained which roles certain authorization levels (e.g. Participant vs Leader vs Admin) could self-register for or assign/invite. This introduced:

- Inconsistent user experience (silent filtering of roles in UI)
- Parallel logic paths in backend (signup vs assignment) that could drift
- Increased maintenance & test surface without materially improving safety

### New Policy

"Any authenticated user may register for, invite a user to, or assign a user into any event role, provided base safeguards pass."

Enforced safeguards that remain:

1. Capacity: Role cannot exceed `maxParticipants`.
2. Duplicate prevention: Same user cannot register twice for the same role.
3. Event status: Registration only allowed for upcoming (non-cancelled/non-ended) events per existing controller checks.
4. Standard validation: Role must exist on the event; event must exist and be readable by the actor.

Removed constraints:

- Authorization-level whitelists (participant-only roles, leader-only roles, etc.).
- Per-user role count limits inside a single event (users can now hold multiple distinct roles simultaneously).

### Rationale

Simplifies mental model and code paths while preserving core integrity constraints (capacity & uniqueness). Empowers flexible staffing of events where a single engaged contributor may legitimately cover multiple roles (e.g., Zoom Host + Speaker).

### Testing

Integration test `participant-multi-role.integration.test.ts` asserts a Participant can register sequentially for two roles. Existing registration tests still validate capacity, duplicates, and notifications.

### Future Considerations

- If operational misuse arises, introduce optional soft policy warnings rather than hard server rejections.
- Auditing layer (separate from gating) could flag unusually dense role concentration by a single account for analytics.

This addendum documents the intentional removal of legacy gating so future refactors avoid re-introducing outdated assumptions.

### Addendum (2025-09 late): Reintroduced Bounded Multi‑Role Participation (Max 3 Roles / User / Event)

Following a trial period of completely unlimited per-user role accumulation within an event, we observed emerging risk patterns (potential role hoarding, reduced clarity of responsibility in dense events). To balance flexibility with operational clarity, we reintroduced a lightweight cap: a single user may now hold up to **3 distinct roles in the same event**.

Key Properties:

1. Universal visibility & eligibility remain intact — no role filtering or authorization-based gating.
2. The cap is enforced only at the moment of attempting a 4th distinct role signup (or assignment on their behalf) and returns HTTP 400.
3. Existing registrations above the cap (if any were created during the unlimited window) are grandfathered; no retroactive pruning is performed.
4. The limit is currently a hard-coded constant (3). No per-event override yet (kept intentionally simple pending real-world feedback).

Backend Enforcement:

- Implemented inside `eventController.signUpForEvent` prior to lock acquisition for fast rejection. The system counts current successful registrations for `(userId, eventId)` across all roles. If count ≥ 3, respond: `400 { success: false, message: "Role limit reached for this event (maximum 3 roles per user)." }`.
- Assignment / invitation pathways that route through the same logic automatically inherit enforcement. If future pathways bypass this controller, they must replicate or delegate to a shared helper.

Frontend Adaptation:

- `EventDetail` sets `maxRolesForUser = 3` and derives `hasReachedMaxRoles` from the user's current role registrations (client view). The UI disables further signup actions and shows a concise explanatory message.
- Previous Infinity/sentinel logic removed for determinism; tests updated accordingly.

Testing:

- New integration test: `participant-three-role-cap.integration.test.ts` exercises 3 successful registrations followed by a 4th failure.
- Existing multi-role test continues to validate that holding more than one role (within the cap) is supported.

Rationale & Trade-offs:

- 3 roles is a pragmatic midpoint: covers legitimate multi-function volunteers (e.g., Tech + Speaker + Moderator) while discouraging over-centralization.
- Avoids complexity of per-event configurability until data justifies (could introduce an `event.settings.maxRolesPerUser` later with an upper safety ceiling of, e.g., 6).
- Keeps enforcement server-side only (UI mirrors state but cannot be trusted)—ensuring consistency under concurrent signup attempts.

Future Considerations:

- Introduce metrics (e.g., distribution of roles/user per event) to evaluate if the cap should be tunable or if warnings (as opposed to hard caps) are more appropriate.
- Provide an admin override flag for exceptional events requiring >3 multi-role assignments.
- Consolidate role-count logic into a shared domain service if additional controllers begin performing similar checks.

Operational Guidance:

- Support staff encountering a 4th-role request should advise the user to reallocate responsibilities or release an existing role slot to maintain clarity.

This addendum formalizes the bounded multi-role policy so future iterations remain aligned with the simplified universal access design while mitigating concentration risks.
