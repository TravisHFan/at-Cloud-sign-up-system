# Mentor Circle Event Mentors — Design & Implementation Roadmap

## Overview

Goal: When creating a new Event of type “Mentor Circle,” and a Circle (E/M/B/A) is chosen, auto-show a Mentors field (positioned after Co-organizer and before Purpose). Pre-populate it with mentors inherited from the selected Program’s circle. The user can remove inherited mentors and add more mentors for this single event only. Program-level mentors remain unchanged, and future edits at Program level do not retroactively modify previously created events.

This roadmap reflects the confirmed requirements and defines UX, data model, validation, API changes, and test coverage.

## Key Decisions (confirmed)

- Program selection is required and appears above Event Type.
- If Program = “Not part of a program,” Event Type only shows: “Conference” and “Webinar.” “Mentor Circle” and “Effective Communication Workshop” are hidden.
- If Event Type = “Mentor Circle” and a Circle (E/M/B/A) is selected, we show a Mentors field:
  - Position: after Co-organizer, before Purpose.
  - Pre-populated with the Program’s mentors for the selected circle.
  - The user may remove inherited mentors for this event.
  - The user may add mentors to this event via an “Add Mentors” action.
  - Changes apply only to this event (no effect on Program mentors).
- Source for “Add Mentors”: all mentor-eligible users, defined as users with roles: Super Admin, Administrator, Leader, or Guest Expert (i.e., higher than Participant).
- We introduce an event-level mentors field only for “Mentor Circle” typed events.
- Program-level changes after events are created do not affect those existing events.

## UX & UI Behavior

1. Form structure

- Program selector (required) above Event Type.
- Event Type options filtered based on Program:
  - If Program is “Not part of a program”: only “Conference” and “Webinar”.
  - Otherwise: include “Mentor Circle” and “Effective Communication Workshop” as usual.

2. Mentors field (visible only when Event Type = Mentor Circle)

- Placement: after Co-organizer, before Purpose.
- Initial value: inherited from Program.mentorsByCircle[SelectedCircle].
- User actions:
  - Remove any mentor (chip/list remove action).
  - Add mentors via a searchable multi-select (“Add Mentors”).
    - Data source: all mentor-eligible users (Super Admin, Administrator, Leader, Guest Expert).
    - Prevent duplicates, show clear labels (name + role), and support keyboard navigation.
- Changing Circle during event creation:
  - Assumption: Show a confirmation dialog that switching circles will re-inherit mentors from the new circle and replace the inherited set.
  - Preserve any “manually added” mentors (if still mentor-eligible) to minimize accidental loss. Deduplicate.
- Changing Program during event creation:
  - Show a confirmation dialog that switching programs resets inherited mentors based on the new Program + selected circle.
  - Preserve manually added mentors when possible (eligible users only), deduplicated.

3. Accessibility & Visuals

- Use accessible labels and descriptions (aria-label/aria-describedby).
- The Add Mentors control should support keyboard interactions and clear focus states.
- Chips/pills with remove buttons must be screen-reader friendly.

## Data Model

Event (new/updated fields)

- mentorIds?: ObjectId[]
  - Applies only when event.type === 'Mentor Circle'.
  - Represents the final, event-owned list of mentors (inherited + manual additions − removals).
- circle: 'E' | 'M' | 'B' | 'A' (required for Mentor Circle events — existing field if already present; otherwise add)
- programId: ObjectId (required for Mentor Circle events)

Program (existing)

- mentorsByCircle: { E: ObjectId[]; M: ObjectId[]; B: ObjectId[]; A: ObjectId[] }

Validation rules

- If type = Mentor Circle: programId and circle are required.
- If type = Mentor Circle and mentorIds is omitted by the client, the server will default mentorIds from Program.mentorsByCircle[circle] at creation time.
- Enforce deduplication of mentorIds.
- Enforce role eligibility server-side (mentorIds must belong to users with roles: Super Admin, Administrator, Leader, Guest Expert). Requests including ineligible user IDs should be rejected with 400.

## API Changes

Reads

- GET /api/programs/:id (already returns mentorsByCircle; ensure it’s available to the Create Event form).
- GET /api/users?roles=super-admin,administrator,leader,guest-expert&search=... (use existing user search endpoint if present; otherwise add a role-filtered search to support Add Mentors UI).

Writes

- POST /api/events
  - Accepts body including: { type, programId, circle, mentorIds?, ... }
  - If type = Mentor Circle and mentorIds missing, server fills from Program.mentorsByCircle[circle].
  - Validates eligibility and deduplicates mentorIds.
  - Returns created event with mentorIds populated.

Server defaults and invariants

- Mentor Circle events must have mentorIds persisted at creation (either client-provided or server-derived) to decouple from future Program changes.
- Updates to Program mentorsByCircle do not modify existing events.

## Backend Implementation Plan

1. Schema & Types

- Update Event schema (TypeScript + Mongoose) to include `mentorIds?: ObjectId[]` and `circle` for Mentor Circle.
- Update shared types so frontend knows about `mentorIds` for Mentor Circle events.

2. Controller logic (create event)

- Validate: if type = Mentor Circle, require programId and circle.
- If mentorIds missing: load Program and set mentorIds = mentorsByCircle[circle] || [].
- Filter to eligible roles (reject otherwise). Deduplicate.
- Save event with mentorIds.

3. Security & Permissions

- Reuse existing create-event auth checks.
- Role eligibility for mentorIds is a server-side validation; do not rely solely on the UI filter.

## Frontend Implementation Plan

1. Form changes (Create Event)

- Move Program selector above Event Type and make it required.
- Filter Event Type options when Program is “Not part of a program.”
- When Event Type = Mentor Circle:
  - Ensure Circle selector is visible/required.
  - Show Mentors field after Co-organizer and before Purpose.
  - Pre-populate mentors from Program.mentorsByCircle[circle].
  - Allow remove and Add Mentors (multi-select from eligible users).
  - On circle or program change, show confirmation and re-inherit; preserve manual additions when possible.

2. State management

- Track mentors as two sets under the hood for clarity: `inheritedMentorIds` and `customMentorIds`.
- The submitted payload uses `mentorIds = unique(inheritedMentorIds ∪ customMentorIds)`.
- On circle/program change: recompute inheritedMentorIds from Program; keep customMentorIds (filter for eligibility and dedupe).

3. UX details

- Show badges/avatars for mentors; include role in label where useful.
- Provide empty-state helper text when no mentors are found for the selected circle.
- Error toasts on failed searches/additions; inline validation on submission.

## Validation & Error Handling

- Client-side:
  - If Event Type = Mentor Circle and Program/Circle missing, block submission and highlight fields.
  - Prevent duplicate mentors and show inline feedback.
- Server-side:
  - Validate presence of programId/circle.
  - Validate all mentorIds are eligible roles; return 400 with details on first invalid userId.
  - Ensure mentorIds are persisted even if the client omits them (server default from Program).

## Edge Cases & Assumptions

- Program mentors for the selected circle are empty: show Mentors field empty with Add Mentors control enabled.
- Changing Circle or Program in the form:
  - Confirmation dialog; re-inherit inherited mentors from the new source.
  - Preserve manual additions when possible; deduplicate.
- Existing events are not backfilled if Program mentors later change.
- If a manually added mentor later becomes ineligible (role change) before save, validation fails with a clear message.
- Assumption: During event creation, when switching circles, we preserve custom mentors and re-inherit the new circle list. This is a deliberate UX choice to minimize accidental data loss.

## Testing Plan

Frontend

- Unit tests for Create Event form:
  - Program required and Event Type filtering when “Not part of a program.”
  - Mentor Circle flow shows Mentors field after Co-organizer and before Purpose.
  - Pre-population from Program.mentorsByCircle by circle.
  - Remove mentor(s), add mentor(s) from eligible search, and deduping.
  - Switching circle/program triggers confirmation and re-inheritance; preserves manual additions.
  - Submission posts mentorIds as expected.

Backend

- Unit/integration tests for POST /api/events:
  - Mentor Circle requires programId and circle.
  - Server default mentorIds from Program if omitted.
  - Eligibility validation for mentorIds; rejects ineligible users.
  - Existing events keep mentorIds unchanged when Program mentors are later updated.

## Rollout

1. Backend: Schema + controller updates, shared types, and tests.
2. Frontend: Form restructuring, mentors widget, data flow, and tests.
3. Optional: Feature flag for progressive rollout.
4. Documentation: Update user-facing help and developer docs.

## Open Questions (to confirm later if needed)

- Search source: If no role-filtered user search exists, we’ll add a roles filter to the existing user search endpoint. Otherwise reuse what we have.
- Display: Do we want to surface mentor avatars in chips? (Default plan is name + role; avatars optional.)

---

Status: Planned. This document reflects agreed behavior and safe defaults. Assumptions are documented above and can be adjusted with minimal code changes.
