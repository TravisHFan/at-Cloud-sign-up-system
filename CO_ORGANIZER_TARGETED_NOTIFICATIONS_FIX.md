# Co-Organizer Targeted Notifications Fix

## Problem Identified

The co-organizer notification system was sending:

- ✅ **Email notifications**: Correctly targeted to specific co-organizers
- ❌ **System messages**: Being sent to ALL users instead of just co-organizers
- ❌ **Bell notifications**: Being sent to ALL users instead of just co-organizers

## Root Cause

The `UnifiedMessageController.createSystemMessage()` method always creates messages for all users using `Message.createForAllUsers()`. There was no built-in support for targeted messages to specific users.

## Solution Implemented

### 1. Created New Targeted Message Method

Added `createTargetedSystemMessage()` method to `UnifiedMessageController`:

```typescript
static async createTargetedSystemMessage(
  messageData: {
    title: string;
    content: string;
    type?: string;
    priority?: string;
  },
  targetUserIds: string[],
  creator?: CreatorInfo
): Promise<any>
```

**Key Features:**

- Creates `new Message()` directly instead of using `createForAllUsers()`
- Only initializes `userStates` for target users
- Only emits WebSocket notifications to target users
- Only updates unread counts for target users

### 2. Updated Event Creation Flow

**Before:**

```typescript
// Used createSystemMessage() -> sent to ALL users
await UnifiedMessageController.createSystemMessage(mockReq, mockRes);
```

**After:**

```typescript
// Uses createTargetedSystemMessage() -> sent only to co-organizers
await UnifiedMessageController.createTargetedSystemMessage(
  {
    title: `Co-Organizer Assignment: ${event.title}`,
    content: "...",
    type: "assignment",
    priority: "high",
  },
  [coOrganizerUserId], // Only specific user
  creatorInfo
);
```

### 3. Updated Event Update Flow

Applied the same targeted message approach to event updates for newly added co-organizers.

## Technical Implementation

### Targeted Message Creation Process

1. **Create Message**: `new Message()` with empty `userStates` Map
2. **Add Target Users**: Only initialize states for specified `targetUserIds`
3. **Save Message**: Store to database with limited user states
4. **Real-time Notifications**:
   - `socketService.emitSystemMessageUpdate()` only to target users
   - `socketService.emitBellNotificationUpdate()` only to target users
   - `socketService.emitUnreadCountUpdate()` only to target users

### User State Initialization

Each target user gets:

```typescript
{
  isReadInSystem: false,
  isReadInBell: false,
  isRemovedFromBell: false,
  isDeletedFromSystem: false,
  // ... other tracking fields
}
```

## Verification Points

### Co-Organizer Notification Trio (Now Correctly Targeted)

When someone is assigned as co-organizer:

1. **📧 Email Notification**: ✅ Sent only to co-organizer
2. **💬 System Message**: ✅ Visible only to co-organizer
3. **🔔 Bell Notification**: ✅ Shows only to co-organizer

### Database State

- **Message document**: Only contains userStates for co-organizers
- **Other users**: Have no record of the message (invisible to them)

### WebSocket Events

- **System message updates**: Only emitted to co-organizer user IDs
- **Bell notifications**: Only emitted to co-organizer user IDs
- **Unread counts**: Only updated for co-organizers

## Testing Scenarios

### Event Creation with Co-Organizers

1. Create event with organizer details containing co-organizer userIds
2. ✅ Co-organizers receive targeted email + system message + bell notification
3. ✅ Other users only see general event creation announcement

### Event Update Adding Co-Organizers

1. Update existing event to add new co-organizers
2. ✅ Only newly added co-organizers receive targeted notifications
3. ✅ Existing users and co-organizers see no assignment messages

### Message Visibility Check

1. Co-organizer logs in: ✅ Sees assignment message in system messages and bell
2. Other user logs in: ✅ Does NOT see assignment message anywhere
3. Admin checks message: ✅ Only shows userStates for co-organizers

## Files Modified

- `/backend/src/controllers/unifiedMessageController.ts` - Added `createTargetedSystemMessage()` method
- `/backend/src/controllers/eventController.ts` - Updated co-organizer notification logic in `createEvent()` and `updateEvent()` methods

## Backend Console Logs

When working correctly, you'll see:

```
🔔 Sending co-organizer assignment notifications...
📧 Found X co-organizers to notify
✅ Co-organizer notification sent to [email]
✅ Co-organizer system message sent to [email]
✅ Processed X/Y co-organizer notifications
```

The co-organizer notification system now correctly implements **targeted notifications** - only the assigned co-organizers will see the system messages and bell notifications! 🎯
