# Program Deletion Feature — Design & Implementation Roadmap

## Overview

Add a Delete button to Program Details with two destructive options:

- Option A — Delete Program Only: Remove the program, keep linked events, and unlink their program association (programId = null).
- Option B — Delete Program and All Linked Events: Remove the program and all its events, applying the existing event-deletion cascade (registrations and guest registrations).

Server must enforce authorization; UI gating alone is insufficient.

## What’s implemented now

- Backend

  - EventCascadeService created to encapsulate full event deletion (registrations, guest registrations, program pull, event delete, cache invalidation).
  - ProgramController.remove now supports query param `deleteLinkedEvents` (default false) for unlink-only vs cascade deletion.
  - ProgramController.listEvents added and route wired as `GET /api/programs/:id/events`.
  - EventController.deleteEvent delegates cascade to EventCascadeService after auth/permission checks.
  - Routes updated; admin authorization enforced server-side.

- Frontend

  - ProgramDetail page shows an admin-only “Delete Program” button.
  - **Two-step confirmation process** to prevent accidental deletion:
    1. **Step 1**: Modal with two explicit options:
       - Option A: Delete Program Only (unlink linked events)
       - Option B: Delete Program & All Linked Events (cascade)
    2. **Step 2**: Final confirmation modal with warning icon and "This action cannot be undone" message
  - API client `programService.remove(id, { deleteLinkedEvents?: boolean })` issues query `?deleteLinkedEvents=true` when cascade is selected.
  - Accessible modals (role="dialog"), centered, with clear CTA labels and proper focus management. Navigates to Programs list after success.
  - Improved layout: action buttons moved below program title, program details display with icons (tag for type, calendar for period) matching EventDetail design.

- Tests
  - Backend tests updated to mock EventCascadeService and assert counts/behavior; all backend tests green.
  - Frontend ProgramDetail tests added/updated for both deletion modes with two-step confirmation flow; AuthContext mocked per test; all frontend tests green.
  - Delete modal tests validate both steps: option selection → "Continue" → final confirmation → "Yes, Delete".
  - Note: Use `npm test` at repo root to run the full suite per project conventions.

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

Status: **Core feature implemented and tested** (backend + frontend). All tests passing.

## Recent achievements

✅ **Two-step confirmation added** - Prevents accidental deletions with clear warning steps
✅ **UI layout improved** - Buttons repositioned, icons added to match EventDetail design  
✅ **Role authorization broadened** - Both "Administrator" and "Super Admin" can access delete functionality
✅ **Tests updated** - All deletion modal tests now validate the two-step confirmation flow

## Next steps (prioritized)

### High Priority (Production Readiness)

1. **UX polish and resilience** 🔥

   - Add success/error toasts for deletion operations (currently missing user feedback)
   - Improve loading states in modals (show spinner during deletion)
   - Add retry guidance for failed deletions
   - Ensure copy is i18n-ready for international users

2. **API documentation & types** 📚
   - Document DELETE `/api/programs/:id?deleteLinkedEvents=true|false` response shapes
   - Update TypeScript types to mirror actual API payloads
   - Add permission model documentation for admin authorization

### Medium Priority (Reliability & Observability)

3. **Audit logging & admin visibility** 📊

   - Log deletion actions (who, when, mode, event/registration counts) server-side
   - Surface deletion history in admin audit view for accountability
   - Track cascade sizes and alert on unusually large deletions

4. **Broader integration tests** 🧪
   - Cover `ProgramController.listEvents` edge cases (empty programs, mixed ownership)
   - Test `EventCascadeService` error scenarios (partial failures, network issues)
   - Add integration tests for the full deletion flow (no mocks)

### Lower Priority (Future Enhancements)

5. **E2E coverage** 🎭

   - Add Cypress/Playwright flows for both deletion modes
   - Test authorization enforcement end-to-end
   - Validate post-delete navigation and state management

6. **Observability & safeguards** 🛡️
   - Add metrics for cascade deletion sizes
   - Consider optional soft-delete/backup toggle for safety
   - Implement rate limiting for bulk deletion operations

Acceptance criteria for Next steps will be tracked alongside PRs and test additions to maintain our near-100% coverage goal.
