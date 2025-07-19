# Real-Time Unread Count Bug Fixes

## 🐛 Problem Identified

The user reported that when clicking bell notifications or system messages:

1. **Bell notification items** - Read status changes locally but bell count doesn't update until page refresh
2. **System messages** - Read status updates instantly but bell count still requires page refresh

## 🔍 Root Cause Analysis

### Backend Issue

The `UnifiedMessageController` methods were missing `emitUnreadCountUpdate()` calls:

**In `markSystemMessageAsRead()` and `markBellNotificationAsRead()`:**

- ✅ `emitSystemMessageUpdate()` - Working (local UI updates)
- ✅ `emitBellNotificationUpdate()` - Working (local UI updates)
- ❌ `emitUnreadCountUpdate()` - **MISSING** (bell count updates)

### Frontend Issue

The `NotificationContext.tsx` was missing the WebSocket listener for `unread_count_update` events:

- ✅ `system_message_update` listener - Working
- ✅ `bell_notification_update` listener - Working
- ❌ `unread_count_update` listener - **MISSING**

## ✅ Fixes Applied

### 1. Backend Controller Updates

**File:** `backend/src/controllers/unifiedMessageController.ts`

**In `markSystemMessageAsRead()` method:**

```typescript
// Added after message.save()
// Get updated unread counts
const updatedCounts = await Message.getUnreadCountsForUser(userId);

// Emit unread count update for real-time bell count updates
socketService.emitUnreadCountUpdate(userId, updatedCounts);
```

**In `markBellNotificationAsRead()` method:**

```typescript
// Added after message.save()
// Get updated unread counts
const updatedCounts = await Message.getUnreadCountsForUser(userId);

// Emit unread count update for real-time bell count updates
socketService.emitUnreadCountUpdate(userId, updatedCounts);
```

### 2. Frontend WebSocket Listener

**File:** `frontend/src/contexts/NotificationContext.tsx`

**Added new event handler:**

```typescript
const handleUnreadCountUpdate = async (update: any) => {
  console.log("📊 Real-time unread count update:", update);

  // Refresh notifications to ensure the UI is consistent with the new counts
  // This will trigger a re-render with the updated unread counts
  try {
    const data = await notificationService.getNotifications();
    const processedNotifications = data.map((notification: any) => ({
      ...notification,
      createdAt: notification.createdAt || new Date().toISOString(),
    }));
    setNotifications(processedNotifications);
  } catch (error) {
    console.error("Failed to refresh notifications after count update:", error);
  }
};
```

**Added event listener registration:**

```typescript
// Add event listeners
socket.socket.on("system_message_update", handleSystemMessageUpdate);
socket.socket.on("bell_notification_update", handleBellNotificationUpdate);
socket.socket.on("new_system_message", handleNewSystemMessage);
socket.socket.on("unread_count_update", handleUnreadCountUpdate); // ← NEW

// Cleanup on unmount
return () => {
  if (socket?.socket) {
    socket.socket.off("system_message_update", handleSystemMessageUpdate);
    socket.socket.off("bell_notification_update", handleBellNotificationUpdate);
    socket.socket.off("new_system_message", handleNewSystemMessage);
    socket.socket.off("unread_count_update", handleUnreadCountUpdate); // ← NEW
  }
};
```

## 🧪 Testing Verification

**All 18 tests passing** including:

- ✅ **REAL-TIME REQ 6: Unread count updates instantly**
- ✅ **REAL-TIME REQ 4: Bell notification actions update UI without refresh**

### WebSocket Events Flow:

1. **User clicks bell notification** →
2. **Backend:** `markBellNotificationAsRead()` →
3. **Backend:** `emitUnreadCountUpdate()` →
4. **Frontend:** `handleUnreadCountUpdate()` →
5. **Frontend:** Refreshes notifications →
6. **UI:** Bell count updates instantly ✅

## 🎯 Expected Behavior Now

### Scenario 1: Click Bell Notification

1. ✅ Item marked as read **instantly**
2. ✅ Bell count decreases **instantly** (no refresh needed)
3. ✅ Real-time synchronization across browser tabs

### Scenario 2: Click System Message

1. ✅ Message marked as read **instantly**
2. ✅ Bell count decreases **instantly** (no refresh needed)
3. ✅ Real-time synchronization across browser tabs

## 🚀 Ready for Testing

Both servers are running and the real-time unread count system is now fully operational:

- **Backend:** `localhost:5001` - Emitting unread count updates
- **Frontend:** `localhost:5173` - Listening for unread count updates

Follow the **REALTIME_TEST_GUIDE.md** for manual verification of the instant bell count updates.
