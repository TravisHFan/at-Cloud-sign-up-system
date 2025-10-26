# Program Deletion API Documentation

## Overview

The Program Deletion API provides two modes of operation for deleting programs in the @Cloud Event Signup System:

1. **Unlink-only mode** (default): Deletes the program but preserves linked events by setting their `programId` to `null`
2. **Cascade mode**: Deletes the program and all linked events, including their registrations and guest registrations

## Endpoints

### DELETE /programs/:id

Deletes a program with optional cascade deletion of linked events.

#### Authentication & Authorization

- **Authentication**: Required (valid JWT token)
- **Authorization**: Administrator or Super Admin role required
- **Security**: Uses role-based access control (RBAC)

#### Parameters

| Parameter            | Type    | Location | Required | Description                                                   |
| -------------------- | ------- | -------- | -------- | ------------------------------------------------------------- |
| `id`                 | string  | Path     | Yes      | MongoDB ObjectId of the program to delete                     |
| `deleteLinkedEvents` | boolean | Query    | No       | If `true`, cascade delete all linked events. Default: `false` |

#### Request Examples

```bash
# Unlink-only mode (default)
DELETE /programs/507f1f77bcf86cd799439011

# Cascade mode
DELETE /programs/507f1f77bcf86cd799439011?deleteLinkedEvents=true
```

#### Response Format

**Unlink-only mode response:**

```json
{
  "success": true,
  "message": "Program deleted. Unlinked 3 related events.",
  "unlinkedEvents": 3
}
```

**Cascade mode response:**

```json
{
  "success": true,
  "message": "Program and 3 events deleted with cascades.",
  "deletedEvents": 3,
  "deletedRegistrations": 15,
  "deletedGuestRegistrations": 8
}
```

#### Response Fields

| Field                       | Type    | Description                             | Mode        |
| --------------------------- | ------- | --------------------------------------- | ----------- |
| `success`                   | boolean | Always `true` for successful operations | Both        |
| `message`                   | string  | Human-readable operation summary        | Both        |
| `unlinkedEvents`            | number  | Count of events unlinked from program   | Unlink-only |
| `deletedEvents`             | number  | Count of events permanently deleted     | Cascade     |
| `deletedRegistrations`      | number  | Count of user registrations deleted     | Cascade     |
| `deletedGuestRegistrations` | number  | Count of guest registrations deleted    | Cascade     |

#### Error Responses

| Status | Error                                      | Description                  |
| ------ | ------------------------------------------ | ---------------------------- |
| 401    | `Authentication required.`                 | Missing or invalid JWT token |
| 403    | `Only Administrators can delete programs.` | User lacks required role     |
| 400    | `Invalid program ID.`                      | Malformed MongoDB ObjectId   |
| 500    | `Failed to delete program.`                | Database or server error     |

**Error response format:**

```json
{
  "success": false,
  "message": "Only Administrators can delete programs."
}
```

### GET /programs/:id/events

Retrieves all events linked to a specific program.

#### Parameters

| Parameter | Type   | Location | Required | Description                     |
| --------- | ------ | -------- | -------- | ------------------------------- |
| `id`      | string | Path     | Yes      | MongoDB ObjectId of the program |

#### Response Format

```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "title": "Weekly Leadership Meeting",
      "date": "2025-01-15",
      "time": "10:00",
      "programId": "507f1f77bcf86cd799439011",
      "type": "Meeting",
      "location": "Conference Room A"
    }
  ]
}
```

## Cascade Deletion Details

When `deleteLinkedEvents=true` is specified, the system performs these operations in sequence:

1. **Event Enumeration**: Find all events where `programId` matches the target program
2. **Registration Cleanup**: For each event, delete all user registrations
3. **Guest Registration Cleanup**: For each event, delete all guest registrations
4. **Event Deletion**: Delete the event documents themselves
5. **Program Deletion**: Delete the program document
6. **Cache Invalidation**: Clear relevant cached data

### Data Integrity

- Operations use database transactions where possible
- Cache invalidation ensures consistent data across the system
- Deletion counts are returned for audit purposes
- Failed operations are logged but don't prevent other deletions

## Frontend Integration

The frontend uses these endpoints through the `programService.remove()` method:

```typescript
// Unlink-only deletion
await programService.remove(programId);

// Cascade deletion
await programService.remove(programId, { deleteLinkedEvents: true });
```

### User Experience

- **Two-step confirmation**: Users must confirm both the deletion mode and final action
- **Loading states**: UI shows progress during deletion operations
- **Toast notifications**: Success/error feedback with operation details
- **Error handling**: Network errors, permission issues, and server errors are handled gracefully

## Performance Considerations

- **Cascade operations**: May take longer for programs with many linked events
- **Database load**: Multiple deletion operations per cascade event
- **Cache invalidation**: Affects system performance temporarily
- **Monitoring**: Operations are logged for performance analysis

## Security Notes

- All deletion operations require admin privileges
- User permissions are verified before any destructive operations
- Audit logs capture deletion events with user context
- No soft-delete option (deletions are permanent)

## TypeScript Types

Backend response types are defined in `/backend/src/types/api-responses.ts`:

```typescript
export interface ProgramDeletionResponse {
  success: true;
  message: string;
  unlinkedEvents?: number;
  deletedEvents?: number;
  deletedRegistrations?: number;
  deletedGuestRegistrations?: number;
}
```
