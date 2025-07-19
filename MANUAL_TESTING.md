# Manual Testing Guide for Real-Time System Messages

## Prerequisites

1. **Both servers must be running:**

   - Backend: `npm run dev` in `/backend` (port 5001)
   - Frontend: `npm run dev` in `/frontend` (port 5173)

2. **Test with multiple browser windows/tabs** to verify real-time synchronization

## Testing Scenarios

### Scenario 1: System Message Broadcasting

1. Open the application in **two browser windows/tabs**
2. Log in as different users in each window
3. Create a new system message from one user
4. **Expected Result:** The new message should appear instantly in both windows without refresh

### Scenario 2: Read Status Updates

1. In **Window 1:** Mark a system message as read
2. **Expected Result:**
   - Read status updates instantly in Window 1
   - Unread count decreases in Window 1
   - Other users' unread counts remain unchanged (user-specific)

### Scenario 3: Message Deletion

1. In **Window 1:** Delete a system message
2. **Expected Result:**
   - Message disappears instantly from Window 1
   - If other users had the message unread, it should also disappear from their lists
   - Unread counts adjust accordingly

### Scenario 4: Bell Notifications

1. Create a system message that generates bell notifications
2. **Expected Result:**
   - Bell notification appears instantly for all users
   - Bell count updates in real-time

### Scenario 5: Bell Notification Actions

1. In **Window 1:** Dismiss or interact with a bell notification
2. **Expected Result:**
   - Bell notification action completes instantly
   - Bell count updates without refresh

## Quick Verification Commands

### Check if servers are running:

```bash
# Check backend (should return WebSocket server info)
curl http://localhost:5001/api/health

# Check frontend (should load the app)
curl http://localhost:5173
```

### Network tab verification:

1. Open browser Developer Tools → Network tab
2. Look for WebSocket connection to `ws://localhost:5001`
3. You should see WebSocket frames being sent/received during operations

## Success Criteria

✅ **All operations complete without page refresh**
✅ **Changes appear instantly across multiple browser windows**
✅ **User-specific data (read status) remains isolated per user**
✅ **Global broadcasts (new messages) reach all connected users**
✅ **Bell notifications update in real-time**

## Troubleshooting

If real-time updates aren't working:

1. **Check WebSocket connection:**

   - Open browser console
   - Look for WebSocket connection messages
   - Verify no connection errors

2. **Verify JWT authentication:**

   - Ensure users are properly logged in
   - Check that JWT tokens are valid

3. **Check server logs:**
   - Look at backend terminal for WebSocket connection logs
   - Verify socket events are being emitted

## Technical Notes

- **WebSocket Events Used:**

  - `new_system_message` (broadcast to all users)
  - `system_message_update` (user-specific updates)
  - `bell_notification_update` (user-specific bell changes)
  - `unread_count_update` (user-specific count changes)

- **Authentication:** WebSocket connections are authenticated using JWT tokens
- **User Isolation:** Each user connects to their own socket room for private updates
- **Automatic Reconnection:** Frontend automatically reconnects if connection is lost
