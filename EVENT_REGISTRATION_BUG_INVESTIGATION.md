# 🔧 Event Registration System Bug Investigation

## 📋 Issue Description

**Problem**: When a user signs up for an event role, the registration is saved to the database but the frontend doesn't reflect the change in real-time.

**User Report**: "When sign up a role, the registrations collection in our system will create a new item, but in the frontend we cannot see the change."

## 🔍 Investigation Plan

### 1. Backend Event Signup Flow Analysis

✅ **EventController.signUpForEvent()** - Lines 761-980

- Creates registration record in database
- Calls `ResponseBuilderService.buildEventWithRegistrations()`
- Emits WebSocket event via `socketService.emitEventUpdate()`
- Returns updated event data

✅ **Real-time Update Code** - Lines 924-936

```typescript
// Emit real-time event update for signup
socketService.emitEventUpdate(id, "user_signed_up", {
  userId: req.user._id,
  roleId,
  roleName: targetRole.name,
  user: { ... },
  event: updatedEvent,
});
```

### 2. Frontend Event Update Flow Analysis

✅ **EventDetail.tsx Socket Integration** - Lines 285-380

- Sets up WebSocket connection with `socketService.connect()`
- Joins event room with `socketService.joinEventRoom(id)`
- Listens for "event_update" events
- Handles "user_signed_up" update type
- Updates local state with `setEvent(convertedEvent)`

✅ **API Service Integration** - Lines 402-450

- Calls `eventService.signUpForEvent()`
- Updates local state after successful API response
- Shows success notification

## 🐛 Potential Root Causes

### 1. WebSocket Connection Issues

- Socket service not connecting properly
- Event room not being joined
- WebSocket events not being emitted from backend
- Frontend not receiving WebSocket events

### 2. State Update Issues

- Local state not being updated correctly
- Event data conversion issues
- Race conditions between API response and WebSocket updates

### 3. Data Synchronization Issues

- ResponseBuilderService not returning updated registration data
- Database queries not reflecting recent changes
- Registration status not being "active"

## 🔧 Debug Steps

### Step 1: Check WebSocket Connection

```bash
# Check browser console for socket connection logs
console.log("📡 Socket connected:", socketService.isConnected());
console.log("📡 Socket events:", socketService.getEventListeners());
```

### Step 2: Monitor Backend Logs

```bash
# Check backend console for:
# - Registration creation logs
# - WebSocket emission logs
# - ResponseBuilderService query results
```

### Step 3: Database Verification

```bash
# Check MongoDB registrations collection after signup:
db.registrations.find({eventId: ObjectId("EVENT_ID")}).sort({registrationDate: -1})
```

### Step 4: Frontend State Debugging

```tsx
// Add logging in EventDetail.tsx handleEventUpdate
console.log("📡 Real-time event update received:", updateData);
console.log("🔄 Current event state before update:", event);
console.log("🔄 New event state after update:", convertedEvent);
```

## 🎯 Most Likely Issues

### Issue #1: WebSocket Events Not Reaching Frontend

**Symptoms**:

- Registration saves to database
- No real-time updates in frontend
- Manual refresh shows changes

**Fix**: Check socket connection and event room joining

### Issue #2: State Update Race Condition

**Symptoms**:

- API call succeeds but state not updated
- WebSocket event received but ignored
- Inconsistent UI updates

**Fix**: Ensure proper state management and update ordering

### Issue #3: Registration Data Not Populated

**Symptoms**:

- Registration record exists but empty currentSignups
- Role counts not updating
- User data not populated in registrations

**Fix**: Check ResponseBuilderService query and population

## 🔍 Next Steps

1. **Enable Debug Logging**: Add console logs to track the entire signup flow
2. **Test Socket Connection**: Verify WebSocket events are being sent/received
3. **Check Database State**: Confirm registration records are properly created
4. **Monitor API Responses**: Verify updated event data is returned correctly
5. **Test Manual Refresh**: See if data appears after page reload

## 📊 Expected vs Actual Behavior

### Expected:

1. User clicks signup → Registration saved → WebSocket event sent → Frontend updates → UI reflects change

### Actual:

1. User clicks signup → Registration saved → ❓ → Frontend unchanged → Manual refresh shows change

This suggests the issue is likely in the WebSocket communication or frontend state update handling.
