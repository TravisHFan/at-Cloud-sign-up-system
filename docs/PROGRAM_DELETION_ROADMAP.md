# Program Deletion Feature — Design & Implementation Roadmap

## Overview

Add a Delete button to Program Details with two destructive options:

- Option A — Delete Program Only: Remove the program, keep linked events, and unlink their program association (programId = null).
- Option B — Delete Program and All Linked Events: Remove the program and all its events, applying the existing event-deletion cascade (registrations and guest registrations).

Server must enforce authorization; UI gating alone is insufficient.

## Backend Design

### Endpoint

- DELETE /api/programs/:id
- Auth: Admin only (Super Admin or Administrator). Use RoleUtils.isAdmin on req.user.role.
- Query param: deleteLinkedEvents=true|false (default false)

### Behaviors

- Unlink-only (default):

  - Event.updateMany({ programId: id }, { $set: { programId: null } })
  - Program.findByIdAndDelete(id)
  - Response: 200 { success: true, message: "Program deleted. Unlinked X related events.", unlinkedEvents: X }

- Cascade delete:
  - Fetch events where programId = id
  - For each, execute cascade deletion (registrations, guest registrations, pull from program.events defensively, delete event, invalidate caches)
  - Delete program
  - Response: 200 { success: true, message: "Program and N events deleted with cascades.", deletedEvents: N, deletedRegistrations, deletedGuestRegistrations }

### Event Cascade Service

Extract cascade steps from EventController.deleteEvent into a reusable service:

- EventCascadeService.deleteEventFully(eventId: string): Promise<{ deletedRegistrations: number; deletedGuestRegistrations: number }>
- Responsibilities:
  - Delete Registration and GuestRegistration by eventId
  - Pull event from Program.events if linked
  - Delete the Event
  - Invalidate CachePatterns for event and analytics
- EventController.deleteEvent remains responsible for permission checks and calls the service after checks. ProgramController uses this service for bulk cascade.

### Error handling & logging

- 400 invalid id, 401 unauthenticated, 403 unauthorized, 404 not found, 500 on internal errors.
- Log a correlated summary: programId, total events, total registrations/guest registrations deleted.
- In cascade, if a specific event fails deletion, continue others and report partial totals with a warning. (Future: wrap in Mongo transaction when available.)

## Frontend Design

### API Client

- ApiClient.deleteProgram(id, options?: { deleteLinkedEvents?: boolean })
- programService.remove(id, options)

### UI (Program Details)

- Show Delete button only for Admin/Super Admin (from useAuth/systemAuthorizationLevel).
- Modal: two options (A: Delete Program Only; B: Delete Program + N Linked Events). Display N via programService.listEventsPaged or listEvents count.
- On success: toast and navigate to programs list. On error: toast with details.
- Accessibility: role="dialog", aria-labelledby, focus management.

## Tests

### Backend

- Auth: 401 unauthenticated, 403 non-admin.
- Unlink-only: updates events, deletes program, returns unlinked count.
- Cascade: deletes events and cascades registrations/guest registrations; returns totals.
- Partial failures: returns partial counts with 200/207-like message (documented behavior TBD).

### Frontend

- Visibility by role.
- Modal interactions for both options, verifying correct query parameter usage.
- Navigation and success toast.
- Error handling path.

## Rollout

1. Implement EventCascadeService and refactor EventController to call it.
2. Update ProgramController.remove for query param + cascade.
3. Update ApiClient and programService.
4. Add UI modal + role gating.
5. Tests (backend + frontend).
6. Docs update and deployment notes.

---

Status: In progress
