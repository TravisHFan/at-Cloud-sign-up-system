# Role Assignment Notification Prompt Feature

## Overview

When a user with organizer privileges clicks "Assign User" on a role slot, the system now shows a confirmation dialog asking whether to send notifications to the assignee.

## User Flow

1. **Organizer clicks "Assign User"** - Opens the user search modal
2. **Organizer selects a user** - Shows the notification prompt dialog
3. **Notification confirmation** - Dialog asks: "Do you want to notify the invited user by email and system message?"
4. **Options available:**
   - **Yes** (default) - Notify the user and let them decide whether to attend
   - **No** - Assign the role without sending notifications
5. **Organizer clicks "Confirm"** - Assignment proceeds with selected notification preference
6. **Assignment complete** - User is assigned to the role with or without notifications

## Technical Implementation

### Frontend Changes

- **NotificationPromptModal** (`frontend/src/components/common/NotificationPromptModal.tsx`)

  - New modal component for confirmation dialog
  - Default selection is "Yes" to preserve current behavior
  - Clean, accessible UI with radio buttons and descriptions

- **EventRoleSignup** (`frontend/src/components/events/EventRoleSignup.tsx`)

  - Updated to show notification prompt instead of directly assigning users
  - Added notification prompt modal state management
  - Updated `onAssignUser` callback signature to include `sendNotifications` parameter

- **EventDetail** (`frontend/src/pages/EventDetail.tsx`)

  - Updated to handle the new `sendNotifications` parameter
  - Passes notification preference to the API call

- **API Service** (`frontend/src/services/api.ts`)
  - Updated `assignUserToRole` method to accept `sendNotifications` parameter
  - Sends `suppressNotifications: true` when notifications should be skipped

### Backend Changes

- **EventController** (`backend/src/controllers/eventController.ts`)
  - Updated `assignUserToRole` method to handle `suppressNotifications` parameter
  - Conditionally skips notification sending when `suppressNotifications` is true
  - Preserves existing notification flow when notifications are enabled

## API Changes

### Request Body

The assignment endpoint now accepts an optional `suppressNotifications` field:

```typescript
{
  userId: string;
  roleId: string;
  notes?: string;
  specialRequirements?: string;
  suppressNotifications?: boolean;  // NEW
}
```

### Behavior

- When `suppressNotifications` is `true`: Assignment happens silently without email or system messages
- When `suppressNotifications` is `false` or `undefined`: Existing notification behavior (email + system message)

## Backward Compatibility

- Default behavior is preserved (notifications are sent)
- Existing API calls without the new parameter continue to work as before
- UI defaults to "Yes" (send notifications) to maintain current user expectations

## Testing

The feature can be tested by:

1. Starting both frontend and backend development servers
2. Navigating to an event detail page as an organizer
3. Clicking "Assign User" on any role
4. Selecting a user and observing the notification prompt
5. Testing both "Yes" and "No" options to verify behavior

## Future Enhancements

- Could add user preference settings for default notification behavior
- Could extend to other assignment types (co-organizers, etc.)
- Could add notification history/audit trail
