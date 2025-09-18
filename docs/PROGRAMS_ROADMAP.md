# Programs Feature Roadmap

Last updated: 2025-09-18

This document analyzes requirements and outlines the technical plan to add Programs to the system, link events to programs, and surface program-driven UX across backend and frontend.

## Goals

- Introduce a new Programs collection to store program metadata and mentors.
- Allow events to optionally belong to a program (or be independent).
- Enable selecting a program in Create/Edit Event forms.
- Provide Program pages that list events belonging to that program.

## Current State (Audit)

Backend

- Tech: Express + Mongoose + TypeScript
- Models present: `Event`, `User`, `Registration`, `GuestRegistration`, `Message` (see `backend/src/models` and `backend/src/models/index.ts`).
- `Event` schema includes organizer fields, flyerUrl, roles, status, etc. No program reference yet.
- Routes: `backend/src/routes/events.ts` wires extensive endpoints for events. No program endpoints yet.
- Controllers: `backend/src/controllers/eventController.ts` handles create, update, read, etc. No program logic yet.

Frontend

- Pages: `CreateEvent.tsx`, `EditEvent.tsx`, `EventDetail.tsx` exist.
- Programs UI added: `Programs.tsx`, `CreateNewProgram.tsx` (mentors-only UI implemented per product spec).
- API services: `frontend/src/services/api` contains service modules (eventService, fileService, etc.). No `programService` yet.

## Data Model Design

### 1) New `Program` collection

Mongoose schema (summary):

- id (virtual from \_id)
- title (string, required)
- programType (enum: 'EMBA Mentor Circles' | 'Effective Communication Workshops')
- hostedBy (string, default '@Cloud Marketplace Ministry')
- period: startYear, startMonth, endYear, endMonth (strings for consistency with UI)
- introduction (string)
- flyerUrl (string, optional)
- mentors structure:
  - For Effective Communication Workshops: `mentors: [UserRefLite]`
  - For EMBA Mentor Circles: `mentorsByCircle: { E: [UserRefLite], M: [UserRefLite], B: [UserRefLite], A: [UserRefLite] }`
- events: ObjectId[] referencing `Event` (denormalized convenience list; can be maintained on event create/update)
- createdBy (User ObjectId), timestamps

UserRefLite type mirrors what UI captures today (id, firstName, lastName, email, gender, avatar, roleInAtCloud/systemAuthorizationLevel). We'll store stable fields (userId ObjectId plus snapshot fields) to avoid historical drift.

Indexes:

- programType
- createdBy
- createdAt desc

### 2) Update `Event` model to include optional program link

Add optional field:

- `programId?: ObjectId | null` referencing `Program`

Notes:

- Keep optional to support independent events.
- Index on `programId` for program pages listing events.

## API Surface

### Program endpoints (new)

- POST `/api/programs` — create program
- GET `/api/programs` — list programs (filters: type, year range, text search by title)
- GET `/api/programs/:id` — get program detail (include basic program info; events will be fetched via query or populated)
- PUT `/api/programs/:id` — update program (mentors, metadata, flyerUrl, etc.)
- DELETE `/api/programs/:id` — delete program (soft delete optional; if hard delete, unset `programId` on events)
- GET `/api/programs/:id/events` — list events for program (server-side paginate)

Permissions:

- Align with `CREATE_EVENT`/leader/admin roles. For v1 we can reuse leader/admin checks; we can introduce `CREATE_PROGRAM`/`MANAGE_PROGRAM` later.

### Event endpoints (existing; changes)

- POST `/api/events` + PUT `/api/events/:id` accept optional `programId` (string | null)
- GET `/api/events` gains filter `programId` to fetch program events.
- DELETE `/api/events/:id` deletes the event AND must:
  - Delete all Registrations and GuestRegistrations for the event
  - If the event has `programId`, pull the event id from that Program's `events` array

Controller updates:

- On event create/update: if `programId` provided, validate existence and push/pull event `_id` in the referenced Program's `events` array (maintain bidirectional consistency). Wrap in try/catch. Session/transaction can be added later; sequential updates are fine for v1.
- On event delete: perform a cascading cleanup (registrations, guest registrations, and program.events pull) before responding success.

## Frontend Changes

### 1) Create/Edit Event forms

- Add a new field: "To which program does this event belong?"
- UI: a dropdown populated from `/api/programs` + first option: "This is an independent event. It does not belong to any program."
- On submit, send `programId` (or null) alongside other event fields.

### 2) Program pages

- Add Program Detail page route `/dashboard/programs/:id`
- Content: program header (title, type, flyer, introduction, period), mentor panels, and an Event list (table or cards) loaded from `/api/programs/:id/events` (or `/api/events?programId=...`).
- From list items, link to Event Detail.

### 3) Programs list integration

- From `Programs.tsx`, link each program card to its detail page.

### 4) Services

- Add `programService.ts` with methods: list, getById, create, update, remove, listEvents.
- Update `eventService` to accept `programId` in create/update payloads and to filter by `programId`.

## Validation & Types

Backend

- Program schema validation mirrors Event style (trim, maxlengths, enums, safe defaults, toJSON id transform).
- Event validation middleware updated to allow optional `programId` (ObjectId string or null).

Frontend

- Types for Program: align with backend response (id string, same fields). Event type extended with `programId?: string | null`.
- Form validation: ensure dropdown value is either "independent" (maps to null) or a valid Program id from the fetched list.

## Data Flow & Consistency

- On Event create/update with `programId`, update Program.events accordingly.
- On Event update clearing `programId`, pull event from previous program's events.
- On Event delete:
  - Remove all associated Registrations and GuestRegistrations
  - If `programId` is set, pull the event id from Program.events
- On Program delete, unset `programId` on all events and clear Program.events (or cascade; choose v1 policy: unset event links).

## Edge Cases

- Program exists but user lacks permission to associate: reject with 403.
- Program deleted after selection but before event save: controller validates and returns 400.
- Large event lists per program: paginate and index `programId`.
- Migration: existing events remain independent (no programId).

## Testing Strategy

- Unit tests for Program model and controller utilities.
- Integration tests:
  - Create Program, Create Event linked to Program → Program.events contains event, Event.programId set
  - Update Event program → Program.events moved
  - Clear Event program → Program.events pulled
  - Program delete → events programId unset
  - Event delete → registrations and guest registrations deleted; Program.events pulled
- Frontend tests for form dropdown wiring and Program Detail event listing.

## Rollout Plan

1. Backend
   - Add Program model, index exports
   - Add routes/controller for programs
   - Extend Event model (programId + index)
   - Update validation and EventController create/update to handle linkage
2. Frontend
   - Add programService.ts
   - Update CreateEvent/EditEvent forms with dropdown
   - Add Program Detail page and wire from Programs grid
3. Docs & Ops
   - Update README/API docs
   - Add seeds (optional)

## Open Questions

- Permissions granularity for Programs (v1 can mirror Event create/manage permissions).
- Whether to snapshot mentor lists at event time (not required; kept at program level for now).

---

This roadmap aligns with current code conventions and minimizes disruption while enabling program-centric workflows.
