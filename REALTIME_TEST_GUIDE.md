# Real-Time WebSocket Test Guide

## 🎯 Overview

This guide will help you test the real-time functionality for system messages and bell notifications. Both servers are running and the WebSocket system is fully configured.

## ✅ Prerequisites

- Backend server running on http://localhost:5001
- Frontend server running on http://localhost:5173
- WebSocket authentication fixed (using JWT_ACCESS_SECRET)
- All 18 tests passing (including 6 real-time tests)

## 🧪 Test Scenarios

### Test 1: Real-Time System Message Broadcasting

**Setup**: Open two browser windows/tabs to http://localhost:5173

1. **Login** as different users in each tab (or same user in both)
2. **In Browser 1**: Navigate to Admin Panel → System Messages
3. **Create a new system message** (if you have admin access)
4. **Expected Result**: Browser 2 should instantly show the new message without refreshing

### Test 2: Mark Message as Read - Real-Time Updates

1. **Browser 1**: Go to Messages/Notifications page
2. **Browser 2**: Open the same page
3. **In Browser 1**: Click to mark a system message as read
4. **Expected Result**: Browser 2 should instantly show the message as read

### Test 3: Delete System Message - Instant Removal

1. **Browser 1**: Delete a system message (if you have permission)
2. **Expected Result**: Browser 2 should instantly remove the message from the list

### Test 4: Bell Notification Real-Time Updates

1. **Browser 1**: Click on a bell notification to mark it as read
2. **Browser 2**: Check the bell icon and notification count
3. **Expected Result**: Browser 2 should instantly update the read status and unread count

### Test 5: Multi-User Synchronization

1. **Login as User A** in Browser 1
2. **Login as User B** in Browser 2
3. **Admin creates a system message** targeting both users
4. **Expected Result**: Both browsers should instantly receive the new message

echo ""
echo "👥 Test 5: Multi-user Real-time (Advanced)"
echo "- Open the app in 2 different browser windows/tabs"
echo "- Log in as different users"
echo "- Create/modify messages in one window"
echo "- Expected: Changes appear instantly in both windows"

## 🐛 Debugging Steps

### 1. Check WebSocket Connection

Open browser DevTools → Network tab → Filter by "WS" (WebSocket)

- You should see a WebSocket connection to `ws://localhost:5001/socket.io/`
- Connection status should be "101 Switching Protocols"

### 2. Monitor Console Messages

**Frontend Console should show:**

- `🔌 Socket connected`
- `📨 Real-time system message update: ...` (when actions occur)
- `🔔 Real-time bell notification update: ...` (when actions occur)

**Backend Console should show:**

- `🔗 User [Name] connected ([socket-id])`
- `📨 Emitted [event] to user [id]: [data]`
- `🔔 Emitted bell [event] to user [id]: [data]`

### 3. Verify Authentication

In browser DevTools → Application tab → Local Storage

- Confirm JWT token is present
- Token should be valid and not expired

## 🎯 Success Criteria

✅ **No page refresh needed** for any system message operations  
✅ **Bell notifications update instantly**  
✅ **Unread counts adjust in real-time**  
✅ **Multi-user synchronization works**  
✅ **WebSocket connection stable**

## 🔧 Technical Details

### WebSocket Events:

- `new_system_message` - New messages broadcast to all users
- `system_message_update` - Read status, deletion updates
- `bell_notification_update` - Bell notification read status
- `unread_count_update` - Real-time unread count updates

### Authentication Flow:

1. Frontend sends JWT token with WebSocket connection
2. Backend validates token using JWT_ACCESS_SECRET
3. User joins their personal room for targeted updates
4. Real-time events are emitted to appropriate rooms

## 🚀 Ready to Test!

Both servers are running and the real-time system is fully operational. Open http://localhost:5173 in your browser and follow the test scenarios above.
