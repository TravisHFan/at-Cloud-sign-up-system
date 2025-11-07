# Guest Invitation Tracking

## Overview

The system now tracks **who invited each guest** to provide better accountability and targeted notifications.

## Two Guest Registration Flows

### 1. Authenticated User Invites Guest (Leader/Admin)

**Flow:**

1. Leader/Admin logs in and navigates to event detail page
2. Clicks "Add Guest" and fills in guest details
3. System creates `GuestRegistration` with `invitedBy` set to the authenticated user's ID

**Result:**

- `invitedBy` field = User ID of the inviter
- Decline notifications go to **the inviter**

**Use Cases:**

- Leader invites team members to an event
- Admin adds guest speakers
- Organizer invites external participants

---

### 2. Guest Self-Registers (Public Event Page)

**Flow:**

1. Guest visits public event page (no authentication)
2. Fills in their own details and submits
3. System creates `GuestRegistration` with `invitedBy` = `undefined`

**Result:**

- `invitedBy` field = `undefined` / `null`
- Decline notifications go to **event organizers** (from `event.organizerDetails[]`)

**Use Cases:**

- Open public events where anyone can register
- Community events with self-service registration
- Workshops where guests sign up directly

---

## Database Schema Changes

### GuestRegistration Model

```typescript
{
  // ... existing fields ...

  // NEW: Invitation Tracking
  invitedBy?: mongoose.Types.ObjectId;  // Optional, references User model
}
```

**Properties:**

- **Type**: `ObjectId` reference to `User` collection
- **Optional**: `true` (not all guests are invited by authenticated users)
- **Indexed**: `true` (for efficient queries)
- **Default**: `undefined`

---

## Decline Notification Logic

When a guest declines an invitation, the system determines the notification recipient using this priority:

### Priority Order

```
1. invitedBy (if exists)
   ↓
2. event.createdBy (fallback for self-registrations or old records)
   ↓
3. event.organizerDetails[] (email notification only, as current behavior)
```

### Decision Tree

```
Has invitedBy?
├─ YES → Send notification to inviter
│         ✅ System message to inviter
│         ✅ Email to inviter (event-role-rejected template)
│
└─ NO → Is this a self-registration or old record?
        ├─ Self-registration → Send to organizers
        │                      ✅ Email to all organizerDetails[]
        │                      ✅ System message to event.createdBy
        │
        └─ Old record → Send to event creator
                        ✅ System message to event.createdBy
                        ✅ Email to organizerDetails[]
```

---

## Implementation Details

### Route Configuration

```typescript
// backend/src/routes/guests.ts
router.post(
  "/:eventId/guest-signup",
  authenticateOptional, // ← Allows both authenticated and anonymous requests
  sanitizeGuestBody,
  guestRegistrationValidation,
  handleValidationErrors,
  GuestController.registerGuest
);
```

**Why `authenticateOptional`?**

- Authenticated requests: `req.user` exists → `invitedBy` is set
- Anonymous requests: `req.user` is `undefined` → `invitedBy` remains `undefined`
- Single endpoint handles both flows seamlessly

---

### Controller Logic

```typescript
// backend/src/controllers/guest/GuestRegistrationController.ts
const guestRegistration = new GuestRegistration({
  // ... other fields ...
  invitedBy: req.user?.id
    ? new mongoose.Types.ObjectId(req.user.id)
    : undefined,
});
```

---

### Decline Notification Logic

```typescript
// backend/src/controllers/guest/GuestDeclineController.ts
let assignerUserId: string | undefined;

// Priority 1: Check invitedBy
if (doc.invitedBy) {
  assignerUserId = String(doc.invitedBy);
} else {
  // Priority 2: Fallback to event.createdBy
  assignerUserId = String(event.createdBy);
}

// Send notification to assignerUserId
await TrioNotificationService.createTrio({
  email: {
    /* email to assignerUserId */
  },
  systemMessage: {
    /* system message for assignerUserId */
  },
  recipients: [assignerUserId],
});
```

---

## Backwards Compatibility

### Existing Guest Registrations

**Scenario**: Guest registrations created before this feature was implemented

**Behavior:**

- `invitedBy` field = `undefined` (not set)
- Decline notifications → sent to `event.createdBy` (current behavior)
- No migration needed
- No breaking changes

### Migration Strategy

**Option 1: No Migration (Recommended)**

- Leave existing records as-is
- Only new registrations have `invitedBy`
- System handles both gracefully via fallback logic

**Option 2: Backfill with Event Creator**

```javascript
// If needed in the future
await GuestRegistration.updateMany(
  { invitedBy: { $exists: false } },
  { $set: { invitedBy: null } }
);
```

---

## Testing

### Test Scenarios

1. **Leader invites guest → guest declines**

   - ✅ Leader receives decline notification
   - ✅ Event creator does NOT receive notification
   - ✅ `invitedBy` is set correctly

2. **Guest self-registers → guest declines**

   - ✅ Event organizers receive email
   - ✅ Event creator receives system message
   - ✅ `invitedBy` is `undefined`

3. **Old guest record (no invitedBy) → guest declines**
   - ✅ Falls back to event creator
   - ✅ No errors or crashes
   - ✅ Backwards compatible

---

## Future Enhancements

### Potential Features

1. **UI Indicator**: Show "Invited by [Name]" in guest list

   ```tsx
   {
     guest.invitedBy && (
       <span className="text-sm text-gray-500">
         Invited by {guest.invitedBy.firstName} {guest.invitedBy.lastName}
       </span>
     );
   }
   ```

2. **Query Endpoint**: Get all guests invited by a specific user

   ```typescript
   GET /api/users/:userId/invited-guests
   ```

3. **Analytics**: Track invitation acceptance rates by inviter

   ```typescript
   const stats = await GuestRegistration.aggregate([
     { $match: { invitedBy: userId } },
     {
       $group: {
         _id: "$migrationStatus",
         count: { $sum: 1 },
       },
     },
   ]);
   ```

4. **Bulk Import**: When admin bulk-imports guests, set `invitedBy` to the admin

---

## API Impact

### No Breaking Changes

- Existing API consumers continue to work without modifications
- `invitedBy` is optional in responses
- Public event registration still works for anonymous users

### Response Format

```json
{
  "success": true,
  "data": {
    "registration": {
      "id": "...",
      "fullName": "John Doe",
      "email": "john@example.com",
      "invitedBy": "64a1b2c3d4e5f6789012345a" // ← NEW (optional)
    }
  }
}
```

---

## Security Considerations

### Authorization

- **Public self-registration**: No auth required (as before)
- **Invited guest registration**: Inviter must have event access
- **Decline notification**: Only sent to inviter, not publicly visible

### Privacy

- Guest email is never shared with inviter in decline notification
- Only guest name and role are included in notification
- `invitedBy` field not exposed in public API responses

---

## Summary

✅ **Problem Solved**: Decline notifications now go to the correct person (inviter vs organizer)

✅ **Two Flows Supported**: Authenticated invitation + Public self-registration

✅ **Backwards Compatible**: Existing data works without migration

✅ **Zero Breaking Changes**: All existing API calls work as before

✅ **Future-Ready**: Foundation for invitation analytics and UI features
