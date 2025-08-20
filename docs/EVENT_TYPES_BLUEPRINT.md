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

### Workshop (new)

Top-level roles:

- zoom_host — Zoom Host — max: 1
- zoom_cohost — Zoom Co-host — max: 1
- spiritual_cover — Spiritual Cover — max: 1
- main_mentor — Main Mentor — max: 1
- co_coach — Co-coach — max: 4

Group roles (fixed groups A–F, each with two roles):

- group\_{A..F}\_leader — Group {A..F} Leader — max: 1
- group\_{A..F}\_participants — Group {A..F} Participants — max: 3

This yields 12 group role entries (2 per group × 6 groups).

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
  - For event creation/update that configures available roles or slot counts, the payload must:
    - Only include roles from the template for the selected eventType.
    - Not exceed template max per role.
    - For Workshop, group roles must be within A–F and exactly the defined pairs.
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
    { "key": "zoom_cohost", "label": "Zoom Co-host", "max": 1 },
    { "key": "spiritual_cover", "label": "Spiritual Cover", "max": 1 },
    { "key": "main_mentor", "label": "Main Mentor", "max": 1 },
    { "key": "co_coach", "label": "Co-coach", "max": 4 }
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
