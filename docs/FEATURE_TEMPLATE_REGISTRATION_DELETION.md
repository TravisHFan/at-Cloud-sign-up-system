# Template Application with Registration Deletion Feature

**Date:** 2025-10-21  
**Status:** ✅ IMPLEMENTED (Core functionality complete)

## Overview

When applying a role template to an existing event on the Edit Event page, if the event has existing registrations, the system now shows a confirmation modal warning the user that all registrations (both user and guest) will be permanently deleted.

## User Flow

1. **User goes to Edit Event page** for an event with existing registrations
2. **User applies a role template** by clicking "Use Template" and selecting/confirming a template
3. **User clicks "Update Event"**
4. **System checks for registrations**: If template was applied AND event has registrations:
   - Shows confirmation modal with registration counts
   - Provides two options:
     - **Cancel**: Closes modal, no changes made
     - **Yes, remove all registrations and save**: Proceeds with deletion and update
5. **If user confirms**: All registrations deleted, event updated with new template roles
6. **If no registrations exist**: Event updated normally without modal

## Implementation Details

### Backend Changes

#### 1. New Helper Function (`eventController.ts`)

```typescript
private static async deleteAllRegistrationsForEvent(eventId: string): Promise<{
  deletedRegistrations: number;
  deletedGuestRegistrations: number;
}>
```

- Deletes all user registrations from `Registration` collection
- Deletes all guest registrations from `GuestRegistration` collection
- Logs deletion counts
- Throws error on failure (fail-fast to avoid partial state)

#### 2. Modified `updateEvent` Method

- Accepts new optional parameter: `forceDeleteRegistrations: boolean`
- **When `forceDeleteRegistrations = true`**:
  - Bypasses role deletion/capacity validation guards
  - Calls `deleteAllRegistrationsForEvent()` before updating event
  - Proceeds with event update after successful deletion
- **When `forceDeleteRegistrations = false or undefined`** (default):
  - Maintains existing validation behavior
  - Prevents role deletion if roles have registrations
  - Prevents capacity reduction below current registration count

#### 3. New Endpoint: `GET /api/events/:id/has-registrations`

- **Purpose**: Check if event has any registrations
- **Authentication**: Required
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "hasRegistrations": true,
      "userCount": 5,
      "guestCount": 3,
      "totalCount": 8
    }
  }
  ```
- **Route Placement**: Before `/:id` route to avoid matching conflicts

### Frontend Changes

#### 1. New Component: `RegistrationDeletionConfirmModal.tsx`

- Displays warning with registration breakdown
- Shows user count vs guest count
- Emphasizes permanent deletion in red text
- Two buttons:
  - **Cancel**: Closes modal, resets state
  - **Yes, remove all registrations and save**: Triggers deletion flow

#### 2. Modified `EditEvent.tsx`

**New State Variables:**

- `templateApplied: boolean` - Tracks if template was applied
- `templateRolesRef: useRef` - Stores template snapshot to detect manual edits
- `registrationDeletionModal: object` - Modal state with counts and pending form data

**Template Application Flow:**

- `setTemplateApplied(true)` when "Confirm Template" clicked
- `setTemplateApplied(false)` when:
  - Event loads
  - Roles are manually edited

**Modified `onSubmit` Function:**

```typescript
if (templateApplied && id) {
  const response = await eventService.hasRegistrations(id);
  if (response.hasRegistrations) {
    // Show modal, store form data
    setRegistrationDeletionModal({
      isOpen: true,
      ...response,
      pendingFormData: data,
    });
    return; // Stop submission
  }
}
// Continue with normal submission
```

**Modal Confirmation Handler:**

- Builds update payload from `pendingFormData`
- Adds `forceDeleteRegistrations: true` flag
- Calls `eventService.updateEvent()` with flag
- Shows success message mentioning registration removal
- Navigates back to event list

#### 3. Updated API Service (`api.ts`)

**New Method in `apiClient`:**

```typescript
async hasRegistrations(id: string): Promise<{
  hasRegistrations: boolean;
  userCount: number;
  guestCount: number;
  totalCount: number;
}>
```

**Export in `eventService`:**

```typescript
hasRegistrations: (id: string) => apiClient.hasRegistrations(id),
```

**Updated Type:**

```typescript
export type UpdateEventPayload = Record<string, unknown> & {
  organizerDetails: unknown[];
  forceDeleteRegistrations?: boolean; // NEW
};
```

## Edge Cases Handled

1. **No registrations exist**: Modal doesn't appear, normal update flow
2. **Template applied then manually edited**: `templateApplied` flag resets to false, no modal
3. **Template applied but user cancels modal**: Form data preserved, user can edit more
4. **API error during registration check**: Shows error notification, stops submission
5. **API error during deletion**: Shows error notification, form remains editable

## Security & Safety

- ✅ Backend validates `forceDeleteRegistrations` flag
- ✅ Only bypasses validation when flag explicitly set to `true`
- ✅ Deletion is atomic (both collections or neither)
- ✅ Requires authentication for has-registrations endpoint
- ✅ Frontend enforces confirmation before irreversible action
- ✅ Clear warning messaging emphasizing permanent deletion

## Testing TODO

**Backend Integration Tests** (Not yet implemented):

- [ ] Update event with template when no registrations exist (should work)
- [ ] Update event with template when registrations exist without force flag (should fail 409)
- [ ] Update event with `forceDeleteRegistrations=true` (should succeed and delete all)
- [ ] Verify both user AND guest registrations are deleted
- [ ] Test atomic behavior (failure should not partially delete)

**Frontend Tests** (Not yet implemented):

- [ ] Modal appears when template applied and registrations exist
- [ ] Cancel button closes modal without changes
- [ ] Confirm button triggers update with force flag
- [ ] Modal does NOT appear when no registrations exist
- [ ] Modal does NOT appear when roles manually edited (not from template)
- [ ] Modal shows correct registration counts

## Documentation TODO

- [ ] Update API documentation for PUT `/api/events/:id`
- [ ] Document new GET `/api/events/:id/has-registrations` endpoint
- [ ] Add examples and warnings about data loss
- [ ] Update user guide for template application

## Files Changed

### Backend

- `backend/src/controllers/eventController.ts` - Added helper function and modified updateEvent
- `backend/src/routes/events.ts` - Added has-registrations route

### Frontend

- `frontend/src/components/RegistrationDeletionConfirmModal.tsx` - New component
- `frontend/src/pages/EditEvent.tsx` - Added template tracking, modal, and confirmation flow
- `frontend/src/services/api.ts` - Added hasRegistrations method and forceDeleteRegistrations flag

## Next Steps

1. Write backend integration tests
2. Write frontend unit/integration tests
3. Update API documentation
4. User acceptance testing
5. Deploy to staging for QA

## Known Limitations

- Deletion is irreversible (by design)
- No "undo" functionality
- Users are not notified via email when their registrations are deleted
  - **Recommendation**: Consider adding email notification in future iteration

## Success Metrics

- Zero accidental data loss incidents
- High user confidence when applying templates
- Clear understanding of consequences before confirmation
