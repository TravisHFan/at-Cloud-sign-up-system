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
- pricing:
  - `fullPriceTicket: number` (required, 0-2000 range, integer)
  - `classRepDiscount: number` (optional, 0-2000 range, integer, default 0)
  - `earlyBirdDiscount: number` (optional, 0-2000 range, integer, default 0)
- events: ObjectId[] referencing `Event` (denormalized convenience list; can be maintained on event create/update)
- createdBy (User ObjectId), timestamps

UserRefLite type mirrors what UI captures today (id, firstName, lastName, email, gender, avatar, roleInAtCloud/systemAuthorizationLevel). We'll store stable fields (userId ObjectId plus snapshot fields) to avoid historical drift.

Indexes:

- programType
- createdBy
- createdAt desc

### 2) Update `Event` model to include optional program link

Add optional fields:

- `programId?: ObjectId | null` referencing `Program`
- `mentorCircle?: string | null` for Mentor Circle events (E, M, B, A)
- `mentors?: UserRefLite[]` for Mentor Circle events (separate from organizers/co-organizers)

Notes:

- Keep optional to support independent events.
- Index on `programId` for program pages listing events.
- **Important distinction**: For Mentor Circle events, `mentors` field is separate from existing `organizer`/`coOrganizers` fields. Mentors provide guidance, while organizers handle event logistics.

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

- POST `/api/events` + PUT `/api/events/:id` accept optional `programId` (string | null) and optional `mentorCircle` (string | null)
- GET `/api/events` gains filter `programId` to fetch program events.
- DELETE `/api/events/:id` deletes the event AND must:
  - Delete all Registrations and GuestRegistrations for the event
  - If the event has `programId`, pull the event id from that Program's `events` array
- For Mentor Circle events: when `programId` and `mentorCircle` provided, snapshot the specified circle's mentors into the event's `mentors` field (separate from organizer/co-organizer fields)

Controller updates:

- On event create/update: if `programId` provided, validate existence and push/pull event `_id` in the referenced Program's `events` array (maintain bidirectional consistency). Wrap in try/catch. Session/transaction can be added later; sequential updates are fine for v1.
- On event delete: perform a cascading cleanup (registrations, guest registrations, and program.events pull) before responding success.

## Frontend Changes

### 1) Create/Edit Event forms

- Add a new field: "To which program does this event belong?"
- UI: a dropdown populated from `/api/programs` + first option: "This is an independent event. It does not belong to any program."
- **For Mentor Circle events only**: when program is selected, show additional dropdown "To which circle does this event belong?" with options: E Circle, M Circle, B Circle, A Circle
- **Mentor snapshot logic**: When circle is selected, populate the new `mentors` field (NOT organizer/co-organizer) with that circle's mentors from the selected program
- **Field separation**: Organizers/Co-organizers handle event logistics; Mentors provide guidance (separate UI sections)
- On submit, send `programId` (or null), `mentorCircle` (or null), and `mentors` array alongside other event fields.

### 2) Program pages

- Add Program Detail page route `/dashboard/programs/:id`
- Content: program header (title, type, flyer, introduction, period), **pricing section** (full price, discounts), mentor panels, and an Event list (table or cards) loaded from `/api/programs/:id/events` (or `/api/events?programId=...`).
- From list items, link to Event Detail.

### 3) Programs list integration

- From `Programs.tsx`, link each program card to its detail page.
- Optionally display pricing info on program cards (e.g., "From $X" after discounts).

### 4) Create/Edit Program forms

- Add pricing section with three number inputs:
  - **Full Price Ticket**: Required field, range 0-2000, integer validation
  - **Class Representative Discount**: Optional field, range 0-2000, integer validation, default 0
  - **Early-Bird Discount**: Optional field, range 0-2000, integer validation, default 0
- Show calculated final prices:
  - With Class Rep discount: `fullPriceTicket - classRepDiscount`
  - With Early Bird discount: `fullPriceTicket - earlyBirdDiscount`
  - With both discounts: `fullPriceTicket - classRepDiscount - earlyBirdDiscount`
- Validation: Ensure discounts don't exceed full price (final price ≥ 0)

### 5) Services

- Add `programService.ts` with methods: list, getById, create, update, remove, listEvents.
- Update `eventService` to accept `programId` in create/update payloads and to filter by `programId`.

## Validation & Types

Backend

- Program schema validation mirrors Event style (trim, maxlengths, enums, safe defaults, toJSON id transform).
- Event validation middleware updated to allow optional `programId` (ObjectId string or null), `mentorCircle` (string or null), and `mentors` (UserRefLite array or null).
- **Pricing validation**:
  - `fullPriceTicket`: required, integer, min 0, max 2000
  - `classRepDiscount`: optional, integer, min 0, max 2000, default 0
  - `earlyBirdDiscount`: optional, integer, min 0, max 2000, default 0
  - Business logic: `fullPriceTicket - classRepDiscount - earlyBirdDiscount >= 0`

Frontend

- Types for Program: align with backend response (id string, same fields including pricing fields).
- Event type extended with `programId?: string | null`, `mentorCircle?: string | null`, and `mentors?: UserRefLite[]`.
- Form validation: ensure dropdown value is either "independent" (maps to null) or a valid Program id from the fetched list.
- UI components: separate sections for organizers vs mentors in event forms and detail pages.
- **Pricing validation**:
  - Number inputs with min=0, max=2000, step=1
  - Real-time calculation of discounted prices
  - Validation error if combined discounts exceed full price

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
- **Pricing validation tests**:
  - Valid pricing: fullPrice=1000, classRep=100, earlyBird=200 → final price 700
  - Invalid pricing: fullPrice=100, classRep=80, earlyBird=50 → should fail (negative final price)
  - Edge cases: fullPrice=0 (valid), fullPrice=2000 (valid), discounts=2000 (valid if fullPrice >= 2000)
- Integration tests:
  - Create Program, Create Event linked to Program → Program.events contains event, Event.programId set
  - Update Event program → Program.events moved
  - Clear Event program → Program.events pulled
  - Program delete → events programId unset
  - Event delete → registrations and guest registrations deleted; Program.events pulled
- Frontend tests for form dropdown wiring, Program Detail event listing, and pricing calculations.

## Rollout Plan

1. Backend
   - Add Program model with pricing fields, index exports
   - Add routes/controller for programs with pricing validation
   - Extend Event model (programId + index)
   - Update validation and EventController create/update to handle linkage
2. Frontend
   - Add programService.ts
   - Update CreateEvent/EditEvent forms with dropdown
   - Add Program Detail page with pricing display and wire from Programs grid
   - Update Create/Edit Program forms with pricing section and validation
3. Docs & Ops
   - Update README/API docs
   - Add seeds with pricing examples (optional)

## Permission Requirements

- **Create Program**: Only Super Admin and Administrator roles allowed
- **Other users** see blurred page with authorization prompt:
  - "Create Program access requires @Cloud Administrator authorization"
  - "To create new programs, you'll need elevated permissions. Please contact your @Cloud Administrator to request access."
  - Reuse existing UI components for access restriction (look up codebase for blur/prompt patterns)

## Mentor Circle Event Integration

When creating events with type "Mentor Circle":

1. Show additional dropdown: "To which circle does this event belong?"
2. Options: E Circle, M Circle, B Circle, A Circle
3. **Snapshot behavior**: When circle is selected, copy that circle's mentor list from the linked program into the event's new `mentors` field
4. **UI Layout**: Show mentors in separate section from organizers/co-organizers (e.g., "Event Mentors" section below "Event Organizers")
5. **Field distinction**:
   - Organizers/Co-organizers: Handle event logistics and operations
   - Mentors: Provide guidance and expertise (populated from program's mentor circle)
6. For "Effective Communication Workshop" events: no additional fields or snapshotting needed

## Edit Program Workflow

1. **Program Detail page** must be built first with "Edit this Program" button
2. **Edit Program page** reuses Create New Program UI with pre-populated data
3. **Implementation order**: Program Detail → Edit Program page

## Event Detail Page Role Slot UI Enhancement

### Requirement

Redesign the event detail page role slots to use a structured 3-column layout under each role name:

### Current Layout

- Role name
- Registered users/guests list
- Dropdown button with capacity info

### New Layout Structure

```
┌─────────────────────────────────────────┐
│              ROLE NAME                  │
├─────────────┬─────────────┬─────────────┤
│   Agenda    │ Description │   Actions   │
│ Start-End   │   Role      │  Dropdown   │
│   Times     │ Description │ + Capacity  │
└─────────────┴─────────────┴─────────────┘
│        Registered Users/Guests          │
│           (unchanged from current)      │
└─────────────────────────────────────────┘
```

### Implementation Details

#### Backend Changes

1. **Extend Role Data Structure**: Add new fields to role schema:

   - `startTime?: string` - Role-specific start time (format: "HH:mm")
   - `endTime?: string` - Role-specific end time (format: "HH:mm")
   - These are separate from overall event start/end times
   - Optional fields (some roles may not have specific timing)

2. **API Updates**:
   - Update Event model schema to include new role time fields
   - Ensure create/update validation handles optional role timing
   - Update existing events migration (set null/undefined for existing roles)

#### Frontend Changes

1. **EventDetail.tsx Role Display**:

   - **Column 1 - Agenda**: Display role startTime-endTime (e.g., "10:00-11:30")
     - Show "Not specified" if times are not set
   - **Column 2 - Description**: Display existing role description field
   - **Column 3 - Actions**: Current dropdown button + capacity display (e.g., "2/5 spots")

2. **Responsive Design**:

   - Desktop: 3-column horizontal layout using CSS Grid or Flexbox
   - Mobile: Stack columns vertically (Agenda → Description → Actions)
   - Use responsive breakpoints (e.g., `md:grid-cols-3` in Tailwind)

3. **Create/Edit Event Forms**:
   - Add optional start/end time inputs for each role
   - Time picker components or simple HH:mm text inputs
   - Validation: End time must be after start time if both provided

#### CSS/Styling

- Maintain consistent spacing and typography
- Use existing design system colors and components
- Ensure proper mobile touch targets for action buttons
- Grid layout with proper gap spacing between columns

#### Testing

- Update unit tests for role schema changes
- Test responsive layout across device sizes
- Verify backward compatibility with existing events (no role times)

--

This roadmap aligns with current code conventions and minimizes disruption while enabling program-centric workflows.
