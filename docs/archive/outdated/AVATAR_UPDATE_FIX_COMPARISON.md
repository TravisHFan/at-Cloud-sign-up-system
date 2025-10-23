# Avatar Update Fix - Code Pattern Comparison

## Problem Summary

After implementing real-time avatar updates via WebSocket, some pages updated avatars correctly while others did not:

- ✅ **Working**: Management Page, EventDetail Page
- ❌ **Not Working**: ProgramDetail Page, SystemMessages Page

## Root Cause Analysis

### Why Management Page Works

The Management page uses `useManagementFilters` hook which **directly listens to WebSocket events** and **reloads data**:

```typescript
// In frontend/src/hooks/useManagementFilters.ts
useEffect(() => {
  if (!socket) return;

  const handleUserUpdate = (data) => {
    console.log("Real-time user update received:", data);
    // Refresh the current page with current filters
    handleRefresh(); // ← Reloads user data from API
  };

  socket.on("user_update", handleUserUpdate);

  return () => {
    socket.off("user_update", handleUserUpdate);
  };
}, [socket, handleRefresh]);
```

**Key Pattern**: Listen to WebSocket → Reload data from API

### Why EventDetail Page Works

EventDetail uses `useAvatarUpdates()` hook, but it works because:

1. The hook increments a counter on avatar updates
2. This triggers a re-render
3. Avatar URLs use `getAvatarUrlWithCacheBust()` with timestamps
4. Browser fetches fresh images even if data isn't reloaded

**Key Pattern**: Listen to updates → Force re-render → Cache-busting URLs fetch fresh images

However, this only works for **in-memory data that gets re-rendered**. If avatar URLs are stored in component state, they remain stale.

### Why ProgramDetail and SystemMessages Didn't Work

Both pages were calling `useAvatarUpdates()` but **not using the return value**:

```typescript
// ❌ Before - Just calling the hook
useAvatarUpdates(); // Counter increments but isn't used
```

The avatar URLs were stored in component state (`program` object, `pagedMessages` array) and never refreshed when avatars were updated.

## The Fix

### Pattern 1: Capture Counter and Add to Dependencies

For pages that fetch data in useEffect, add `avatarUpdateCounter` as a dependency:

```typescript
// ✅ After - Capture counter and use in dependencies
const avatarUpdateCounter = useAvatarUpdates();

useEffect(() => {
  // ... fetch program data ...
}, [id, serverPaginationEnabled, limit, sortDir, avatarUpdateCounter]);
//                                                 ^^^^^^^^^^^^^^^^^^^
//                                                 Triggers reload on avatar updates
```

### Pattern 2: Dedicated Avatar Update Effect

For pages with complex state management, add a separate useEffect:

```typescript
// ✅ After - Dedicated effect for avatar updates
const avatarUpdateCounter = useAvatarUpdates();

useEffect(() => {
  if (avatarUpdateCounter > 0) {
    loadPage(currentPage); // Reload current page
  }
}, [avatarUpdateCounter]);
```

## Fixed Files

### 1. SystemMessages.tsx

**Before:**

```typescript
useAvatarUpdates(); // Not used
```

**After:**

```typescript
const avatarUpdateCounter = useAvatarUpdates();

// Reload current page when any user's avatar is updated
useEffect(() => {
  if (avatarUpdateCounter > 0) {
    loadPage(currentPage);
  }
}, [avatarUpdateCounter]);
```

### 2. ProgramDetail.tsx

**Before:**

```typescript
useAvatarUpdates(); // Not used

useEffect(() => {
  // ... fetch program ...
}, [id, serverPaginationEnabled, limit, sortDir]);
```

**After:**

```typescript
const avatarUpdateCounter = useAvatarUpdates();

useEffect(() => {
  // ... fetch program ...
}, [id, serverPaginationEnabled, limit, sortDir, avatarUpdateCounter]);
//                                                 ^^^^^^^^^^^^^^^^^^^
//                                                 Added dependency
```

## How It Works Now

1. **User uploads avatar** → Backend updates database and emits WebSocket event
2. **WebSocket event received** → `useAvatarUpdates()` hook increments counter
3. **Counter changes** → Triggers useEffect in consuming components
4. **Component reloads data** → Fresh avatar URLs fetched from database
5. **UI updates** → New avatar displayed with cache-busting timestamp

## Testing Checklist

- [ ] Upload avatar in Profile page
- [ ] Verify Management table shows new avatar immediately
- [ ] Verify SystemMessages shows new avatar for message senders
- [ ] Verify EventDetail shows new avatar for organizers/participants
- [ ] Verify ProgramDetail shows new avatar for mentors
- [ ] All updates should happen **without manual page refresh**

## Best Practices

### ✅ DO

- **Always capture the return value** of `useAvatarUpdates()` if you need to reload data
- **Add `avatarUpdateCounter` to useEffect dependencies** that fetch user data
- **Use dedicated effects** for avatar updates when state management is complex
- **Test real-time updates** across all pages after implementation

### ❌ DON'T

- Don't call `useAvatarUpdates()` and ignore the return value if you have stale data
- Don't assume cache-busting alone will fix stale data in component state
- Don't forget to reload data when avatar URLs are embedded in objects/arrays

## Related Files

- `/frontend/src/hooks/useAvatarUpdates.ts` - WebSocket listener hook
- `/frontend/src/pages/SystemMessages.tsx` - System messages with sender avatars
- `/frontend/src/pages/ProgramDetail.tsx` - Program details with mentor avatars
- `/frontend/src/pages/EventDetail.tsx` - Event details with participant avatars
- `/frontend/src/hooks/useManagementFilters.ts` - Management page real-time updates
- `/backend/src/controllers/userController.ts` - Avatar upload with WebSocket emission
