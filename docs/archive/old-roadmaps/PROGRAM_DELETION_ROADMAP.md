# Program Deletion API — Specification

**Feature Status**: ✅ Production Ready  
**Last Updated**: 2025-10-08

This document specifies the Program Deletion API, including cascade behavior and authorization requirements.

---

## Overview

The Program Deletion API provides two deletion modes:

- **Unlink Only** (default): Delete program, set `Event.programId = null` for linked events
- **Cascade Delete**: Delete program and all linked events (including registrations)

---

## API Endpoint

### Delete Program

```
DELETE /api/programs/:id
```

**Authorization**: Admin only (Super Admin or Administrator)

**Query Parameters**:

- `deleteLinkedEvents` (boolean) — Cascade delete events (default: `false`)

**Headers**:

```
Authorization: Bearer <token>
```

---

## Deletion Modes

### Mode 1: Unlink Only (Default)

**Behavior**:

1. Set `programId = null` for all events where `programId = :id`
2. Delete the program document
3. Preserve all events and registrations

**Request**:

```http
DELETE /api/programs/prog123
```

**Response** (200):

```json
{
  "success": true,
  "message": "Program deleted. Unlinked 12 related events.",
  "unlinkedEvents": 12
}
```

---

### Mode 2: Cascade Delete

**Behavior**:

1. Find all events where `programId = :id`
2. For each event:
   - Delete all registrations (`Registration.eventId`)
   - Delete all guest registrations (`GuestRegistration.eventId`)
   - Remove event from program's events array (defensive)
   - Delete the event
   - Invalidate related caches
3. Delete the program document

**Request**:

```http
DELETE /api/programs/prog123?deleteLinkedEvents=true
```

**Response** (200):

```json
{
  "success": true,
  "message": "Program and 12 events deleted with cascades.",
  "deletedEvents": 12,
  "deletedRegistrations": 48,
  "deletedGuestRegistrations": 23
}
```

---

## Event Cascade Service

### Purpose

Centralized service for full event deletion with cascade handling.

### Interface

```typescript
class EventCascadeService {
  static async deleteEventFully(eventId: string): Promise<{
    deletedRegistrations: number;
    deletedGuestRegistrations: number;
  }>;
}
```

### Cascade Steps

1. Delete all `Registration` documents where `eventId = :id`
2. Delete all `GuestRegistration` documents where `eventId = :id`
3. Remove event ID from linked program's `events[]` array (if `programId` exists)
4. Delete the `Event` document
5. Invalidate cache patterns:
   - Event-specific caches
   - Analytics caches

### Usage

```typescript
// In ProgramController (cascade mode)
for (const event of linkedEvents) {
  const { deletedRegistrations, deletedGuestRegistrations } =
    await EventCascadeService.deleteEventFully(event._id);
  totalRegistrations += deletedRegistrations;
  totalGuestRegistrations += deletedGuestRegistrations;
}

// In EventController (single event deletion)
await EventCascadeService.deleteEventFully(eventId);
```

---

## Authorization

### Role Requirements

- User must be authenticated
- User role must be `Super Admin` or `Administrator`

### Implementation

```typescript
import { RoleUtils } from "../utils/role.utils";

if (!req.user || !RoleUtils.isAdmin(req.user.role)) {
  return res.status(403).json({
    success: false,
    message: "Unauthorized: Admin role required",
  });
}
```

---

## Error Responses

### 400 Bad Request

**Cause**: Invalid program ID format

```json
{
  "success": false,
  "message": "Invalid program ID"
}
```

---

### 401 Unauthorized

**Cause**: No authentication token provided

```json
{
  "success": false,
  "message": "Authentication required"
}
```

---

### 403 Forbidden

**Cause**: User is not Admin or Super Admin

```json
{
  "success": false,
  "message": "Unauthorized: Admin role required"
}
```

---

### 404 Not Found

**Cause**: Program ID does not exist

```json
{
  "success": false,
  "message": "Program not found"
}
```

---

### 500 Internal Server Error

**Cause**: Database error or cascade failure

```json
{
  "success": false,
  "message": "Failed to delete program"
}
```

**Note**: In cascade mode, partial failures continue processing and report partial totals. Future enhancement may include transaction rollback.

---

## Frontend Integration

### API Client

```typescript
// In programService
async remove(
  programId: string,
  options?: { deleteLinkedEvents?: boolean }
): Promise<void> {
  const params = options?.deleteLinkedEvents
    ? '?deleteLinkedEvents=true'
    : '';

  await apiClient.delete(`/api/programs/${programId}${params}`);
}
```

### UI Flow (Two-Step Confirmation)

**Step 1: Mode Selection Modal**

```
Title: "Delete Program"
Body:
  "This program has 12 linked events. Choose deletion mode:"

  [ ] Option A: Delete Program Only
      → Unlinks events, preserves event data

  [ ] Option B: Delete Program & All 12 Linked Events
      → Deletes program and all events with registrations

Buttons: [Cancel] [Continue]
```

**Step 2: Final Confirmation Modal**

```
Title: "⚠️ Confirm Deletion"
Body:
  "This action cannot be undone."
  [Selected option restated]

Buttons: [Cancel] [Yes, Delete]
```

### Role Visibility

```tsx
const { user } = useAuth();
const isAdmin = user?.role === "Super Admin" || user?.role === "Administrator";

{
  isAdmin && <button onClick={handleDelete}>Delete Program</button>;
}
```

---

## Logging & Audit

### Server-Side Logging

```typescript
logger.info("Program deletion initiated", {
  programId,
  userId: req.user._id,
  mode: deleteLinkedEvents ? "cascade" : "unlink",
  linkedEventsCount: events.length,
});

logger.info("Program deletion completed", {
  programId,
  deletedEvents,
  deletedRegistrations,
  deletedGuestRegistrations,
  duration: Date.now() - startTime,
});
```

### Recommended Audit Fields

- **Who**: User ID and email
- **When**: Timestamp
- **What**: Program ID, title, deletion mode
- **Impact**: Event count, registration count, guest registration count

---

## Testing

### Backend Tests

**Authorization**:

- ✅ 401 when unauthenticated
- ✅ 403 when non-admin user
- ✅ 200 when admin user

**Unlink Mode**:

- ✅ Sets `programId = null` for linked events
- ✅ Deletes program
- ✅ Returns correct `unlinkedEvents` count

**Cascade Mode**:

- ✅ Deletes all linked events
- ✅ Deletes all registrations for those events
- ✅ Deletes all guest registrations for those events
- ✅ Returns correct counts for deleted entities

**Error Handling**:

- ✅ 404 when program not found
- ✅ Handles partial cascade failures gracefully

### Frontend Tests

**Role Visibility**:

- ✅ Delete button hidden for non-admin users
- ✅ Delete button visible for admin users

**Modal Flow**:

- ✅ Step 1: Mode selection renders correctly
- ✅ Step 1: Event count displayed
- ✅ Step 2: Final confirmation renders after "Continue"
- ✅ API called with correct query parameter

**Success Path**:

- ✅ Toast notification shown
- ✅ Navigation to programs list

**Error Path**:

- ✅ Error toast with retry guidance
- ✅ Modal remains open on error

---

## Performance Considerations

### Cascade Deletion Performance

**Small Programs** (<10 events):

- Synchronous deletion acceptable
- Typical response time: <500ms

**Large Programs** (>50 events):

- Consider background job processing
- Implement progress tracking
- Add rate limiting

### Database Impact

**Unlink Mode**:

- Single `updateMany` operation
- O(n) where n = linked events

**Cascade Mode**:

- N individual deletions
- Consider batch operations for >100 events
- Future: Use MongoDB transactions for atomicity

---

## Security Considerations

### Authorization Enforcement

- ✅ Server-side role checks (never trust client-only gating)
- ✅ Role utility (`RoleUtils.isAdmin`) for consistent checks
- ✅ JWT token validation on every request

### Audit Trail

- 📋 Log all deletion operations for accountability
- 📋 Track deletion sizes for anomaly detection
- 📋 Alert on unusually large cascades (>100 events)

### Rate Limiting

- 📋 Consider rate limits for deletion endpoints
- 📋 Prevent abuse/accidental bulk deletions

---

## Future Enhancements

### High Priority

- [ ] Audit logging with admin visibility dashboard
- [ ] Broader integration tests for edge cases
- [ ] Metrics for cascade sizes and performance

### Medium Priority

- [ ] E2E tests for full deletion flow
- [ ] Background job processing for large cascades
- [ ] Soft-delete option with restore capability

### Low Priority

- [ ] Transaction-based cascade (MongoDB 4.0+)
- [ ] Deletion preview (dry-run mode)
- [ ] Scheduled deletion with grace period

---

## Related Documentation

- `PROGRAMS_COMPREHENSIVE_ROADMAP.md` — Program feature architecture
- `PROGRAM_DELETION_API.md` — This document
- `OBSERVABILITY.md` — Logging and monitoring standards

---

**Notes**:

- Cascade deletion is irreversible; ensure two-step confirmation enforced
- Consider backup/export before deleting large programs
- Monitor cascade performance in production; optimize if p95 latency >2s
