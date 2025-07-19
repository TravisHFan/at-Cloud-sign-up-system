/\*\*

- System Messages & Bell Notifications Testing Strategy Documentation
-
- This document outlines the comprehensive testing strategy for the System Messages
- and Bell Notification system covering all 10 requirements.
  \*/

# System Messages & Bell Notifications Testing Strategy

## Overview

Based on the analysis of your requirements and existing codebase, I recommend a **layered testing approach** that will systematically identify and resolve the bugs in your System Messages and Bell Notification system.

## Testing Architecture

### 1. Backend Integration Tests ✅ (Created)

**File**: `/backend/tests/integration/system-messages/comprehensive-system-messages.test.ts`

**Coverage**:

- ✅ Requirement 1: System Messages read/unread status toggle
- ✅ Requirement 2: User-specific permanent deletion
- ✅ Requirement 3: Five message types with unique handling
- ✅ Requirement 4: Role-based message creation (non-Participant only)
- ✅ Requirement 5: Bell notification read/unread with remove button logic
- ✅ Requirement 6: Bell notification removal (independent from system messages)
- ✅ Requirement 7: Persistence across sessions
- ✅ Requirement 8: Auto-sync between system messages and bell notifications
- ✅ Requirement 9: Auto-delete bell notifications when system message deleted
- ✅ Requirement 10: Navigation support (correct ID mapping)

### 2. Frontend Component Tests (Recommended Structure)

#### A. System Messages Page Tests

```typescript
// /frontend/src/test/pages/SystemMessages.test.tsx

describe("SystemMessages Page - Requirement Coverage", () => {
  // Requirement 1: Read/Unread Toggle
  test("should toggle message read status when clicked");
  test("should display unread messages with visual indicators");
  test("should persist read status after page refresh");

  // Requirement 2: User-Specific Deletion
  test("should show delete confirmation dialog");
  test("should delete message only for current user");
  test("should remove message from user's list after deletion");

  // Requirement 3: Message Type Icons
  test("should render announcement icon for announcement messages");
  test("should render maintenance icon for maintenance messages");
  test("should render update icon for update messages");
  test("should render warning icon for warning messages");
  test("should render user icon for auth_level_change messages");

  // Requirement 4: Role-Based Creation
  test("should show create button for Administrator role");
  test("should show create button for Moderator role");
  test("should hide create button for Participant role");
  test("should validate message creation form");
  test("should send message to all users after creation");
});
```

#### B. Bell Notification Dropdown Tests

```typescript
// /frontend/src/test/components/NotificationDropdown.test.tsx

describe("NotificationDropdown - Requirement Coverage", () => {
  // Requirement 5: Bell Notification Read/Unread
  test("should display unread count badge");
  test("should show unread notifications with visual indicators");
  test("should mark notification as read when clicked");
  test("should show remove button only for read notifications");
  test("should display creator information correctly");

  // Requirement 6: Independent Removal
  test("should remove notification from bell list when remove button clicked");
  test("should not affect system message when bell notification removed");
  test("should hide remove button for unread notifications");

  // Requirement 10: Navigation
  test("should navigate to system messages page when notification clicked");
  test("should highlight correct message in system messages page");
  test("should maintain notification ID for navigation");
});
```

#### C. Integration Tests

```typescript
// /frontend/src/test/integration/SystemMessagesIntegration.test.tsx

describe("System Messages & Bell Notifications Integration", () => {
  // Requirement 8: Auto-sync
  test("should sync system message read status to bell notification");
  test("should sync bell notification read status to system message");
  test("should maintain independent removal states");

  // Requirement 9: Auto-delete on System Message Deletion
  test("should remove bell notification when system message deleted");
  test("should handle cascading deletion correctly");

  // Requirement 7: Persistence
  test("should maintain all states after page refresh");
  test("should recover state after browser restart");
  test("should handle offline/online scenarios");
});
```

### 3. Service Layer Unit Tests

#### A. System Message Service Tests

```typescript
// /frontend/src/test/services/systemMessageService.test.ts

describe("SystemMessageService", () => {
  test("getSystemMessages - should fetch user-specific messages");
  test("markAsRead - should update read status");
  test("markAsUnread - should update unread status");
  test("deleteSystemMessage - should delete for current user only");
  test("createSystemMessage - should broadcast to all users");
});
```

#### B. Notification Service Tests

```typescript
// /frontend/src/test/services/notificationService.test.ts

describe("NotificationService", () => {
  test("getNotifications - should fetch bell notifications");
  test("markAsRead - should mark notification as read");
  test("deleteNotification - should remove from bell list only");
  test("markAllAsRead - should mark all notifications as read");
});
```

### 4. End-to-End Tests (Critical User Journeys)

```typescript
// /tests/e2e/system-messages-e2e.test.ts

describe("System Messages E2E Tests", () => {
  test("Complete user journey: Create → Read → Delete system message");
  test("Complete bell notification journey: Receive → Read → Remove");
  test("Cross-user isolation: User A actions don't affect User B");
  test("Role-based access: Participant cannot create messages");
  test("Sync behavior: System message read affects bell notification");
  test("Navigation: Bell notification click leads to correct system message");
});
```

## Running the Tests

### Backend Tests

```bash
cd backend
npm test -- comprehensive-system-messages.test.ts
```

### Frontend Tests (When Implemented)

```bash
cd frontend
npm test -- SystemMessages.test.tsx
npm test -- NotificationDropdown.test.tsx
npm test -- integration/
```

### Full Test Suite

```bash
# Run all tests
npm run test:all

# Run specific requirement tests
npm run test:requirement-1  # Read/Unread functionality
npm run test:requirement-5  # Bell notifications
npm run test:integration   # Cross-system sync
```

## Bug Detection Strategy

### Phase 1: Isolation Testing

1. **Run backend integration tests** to verify API behavior
2. **Test individual frontend components** in isolation
3. **Verify service layer** functionality

### Phase 2: Integration Testing

1. **Test cross-component communication**
2. **Verify state synchronization**
3. **Test user role permissions**

### Phase 3: End-to-End Validation

1. **Test complete user workflows**
2. **Verify persistence across sessions**
3. **Test edge cases and error scenarios**

## Expected Benefits

1. **Systematic Bug Discovery**: Tests will reveal exactly where the system breaks
2. **Regression Prevention**: Future changes won't break existing functionality
3. **Documentation**: Tests serve as living documentation of requirements
4. **Confidence**: Comprehensive coverage ensures system reliability
5. **Debugging Speed**: Failed tests pinpoint exact issue locations

## Recommendation

I strongly recommend starting with the **backend integration tests** I've created, as they will:

1. **Validate your API endpoints** are working correctly
2. **Test database state management** for all requirements
3. **Verify role-based access control**
4. **Confirm persistence mechanisms**
5. **Test cross-user isolation**

Then gradually add frontend tests to ensure the UI layer correctly uses the backend APIs.

This approach will systematically uncover the root causes of your System Messages and Bell Notification bugs while building a robust test foundation for future development.
