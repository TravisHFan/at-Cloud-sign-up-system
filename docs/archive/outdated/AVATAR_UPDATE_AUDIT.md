# Avatar Update System Audit

**Date:** 2025-10-11  
**Purpose:** Audit all avatar display locations and implement eventual avatar update mechanism

---

## Executive Summary

The Management page table has **real-time avatar updates** using `getAvatarUrlWithCacheBust()`. However, all other avatar displays throughout the app use `getAvatarUrl()` without cache busting, which may show stale avatars until the page is refreshed and data is refetched.

---

## Current Avatar Utilities

### `getAvatarUrl(customAvatar, gender)`

- Used in most places
- Returns avatar URL without cache busting
- Will show stale avatars if data is cached

### `getAvatarUrlWithCacheBust(customAvatar, gender)`

- Used ONLY in Management page table
- Adds `?t={timestamp}` to force fresh image loads
- Ensures real-time avatar updates

---

## All Avatar Display Locations

### ✅ 1. **Management Page Table** (`frontend/src/components/management/UserTable.tsx`)

- **Status:** ✅ Has real-time updates
- **Method:** Uses `getAvatarUrlWithCacheBust()`
- **Lines:** 111-118, 138-145, 276-283, 303-310
- **Notes:** This is the reference implementation

### 2. **System Messages - Message Sender** (`frontend/src/pages/SystemMessages.tsx`)

- **Status:** ❌ No real-time updates
- **Method:** Uses `getAvatarUrl()`
- **Lines:** 830-836 (in message cards), 1003-1011 (in create form preview)
- **Context:** Shows sender avatar on each system message card
- **Impact:** Medium - users see message senders frequently

### 3. **Event Detail - Organizer** (`frontend/src/pages/EventDetail.tsx`)

- **Status:** ❌ No real-time updates
- **Method:** Uses `getAvatarUrl()`
- **Lines:** 2505-2512
- **Context:** Shows main organizer in event details
- **Impact:** High - visible on every event detail page

### 4. **Event Detail - Co-organizers** (`frontend/src/components/events/EventPreview.tsx`)

- **Status:** ❌ No real-time updates
- **Method:** Uses `getAvatarUrl()`
- **Lines:** 281-288 (organizer avatars in preview)
- **Context:** Shows co-organizers in event preview/detail
- **Impact:** High - multiple organizers shown per event

### 5. **Event Detail - Role Registrations** (`frontend/src/components/events/EventRoleSignup.tsx`)

- **Status:** ❌ No real-time updates
- **Method:** Uses `getAvatarUrl()`
- **Lines:** 752-759
- **Context:** Shows participant avatars in role signup sections
- **Impact:** Very High - shows all registered participants

### 6. **Organizer Selection Component** (`frontend/src/components/events/OrganizerSelection.tsx`)

- **Status:** ❌ No real-time updates
- **Method:** Uses `getAvatarUrl()`
- **Lines:** 325-331 (organizer card), 450-454 (search results), 485-489 (available users)
- **Context:** Used when creating/editing events and programs
- **Impact:** Medium - used during event/program creation

### 7. **Program Detail - Mentors** (`frontend/src/pages/ProgramDetail.tsx`)

- **Status:** ❌ No real-time updates
- **Method:** Uses `getAvatarUrl()`
- **Lines:** 690-697, 736-745
- **Context:** Shows mentor avatars in program details (general mentors and circle-specific mentors)
- **Impact:** High - visible on program detail pages

### 8. **Mentors Picker Component** (`frontend/src/components/events/MentorsPicker.tsx`)

- **Status:** ❌ No real-time updates
- **Method:** Uses `getAvatarUrl()`
- **Lines:** 265-269 (selected mentors), 393-400 (available mentors in dropdown)
- **Context:** Used when selecting mentors for events/programs
- **Impact:** Medium - used during mentor circle event creation

### 9. **Create/Edit Event Pages** (`frontend/src/pages/CreateEvent.tsx`, `frontend/src/pages/EditEvent.tsx`)

- **Status:** ❌ No real-time updates
- **Method:** Uses `getAvatarUrl()` (via OrganizerSelection component)
- **Context:** Shows organizers/co-organizers during event creation/editing
- **Impact:** Medium - used frequently by event creators

### 10. **Create/Edit Program Pages** (`frontend/src/pages/CreateNewProgram.tsx`, `frontend/src/pages/EditProgram.tsx`)

- **Status:** ❌ No real-time updates
- **Method:** Uses `getAvatarUrl()` (via OrganizerSelection component)
- **Lines:** CreateNewProgram: 554, 585, 609, 633, 657 (mentor selections for circles)
- **Context:** Shows mentors for different circles during program creation/editing
- **Impact:** Medium - used during program setup

### 11. **Guest Confirmation Page** (`frontend/src/pages/GuestConfirmation.tsx`)

- **Status:** ❌ No real-time updates (assumed)
- **Method:** Likely uses `getAvatarUrl()` if organizer avatars are shown
- **Context:** Shows organizer info to guests confirming attendance
- **Impact:** Low - guest-facing page

### 12. **Avatar Upload Component** (`frontend/src/components/profile/AvatarUpload.tsx`)

- **Status:** ✅ Uses `getAvatarUrlWithCacheBust()` for preview
- **Method:** Uses `getAvatarUrlWithCacheBust()`
- **Lines:** 36-41
- **Context:** Shows avatar preview during profile editing
- **Impact:** N/A - this is the upload interface itself

---

## Current Data Flow

### When Avatar is Uploaded:

1. User uploads avatar via Profile page
2. Backend saves avatar and returns new avatar URL
3. Frontend updates local user state
4. Management table shows new avatar immediately (cache busting)
5. **Other locations:** Continue showing old avatar until:
   - Page is refreshed
   - Component remounts
   - Data is refetched from API

### The Problem:

Most avatar displays rely on data fetched at component mount time:

- Event details fetch event data once
- System messages fetch messages once (with pagination)
- Program details fetch program data once
- These fetched objects include user avatars at fetch time

If a user uploads a new avatar AFTER the data is fetched, the old avatar remains visible in these locations until:

- User manually refreshes the page
- User navigates away and back
- Component refetches data (rare)

---

## Root Causes

### 1. **No Cache Busting in Most Places**

- Most avatar displays use `getAvatarUrl()` without timestamp
- Browser caches the image at the old URL
- Even if data refetches, cached image persists

### 2. **Stale Data in Component State**

- Avatar URLs are embedded in fetched data structures
- Components don't refetch data after avatar changes
- No mechanism to invalidate cached data

### 3. **No Real-time Update Mechanism**

- No WebSocket notifications for avatar updates
- No polling to check for avatar changes
- No shared state management for user avatars

---

## Proposed Solutions

### Option 1: **Universal Cache Busting** (Simplest)

**Implementation:**

- Replace all `getAvatarUrl()` calls with `getAvatarUrlWithCacheBust()`
- Force fresh image loads everywhere

**Pros:**

- Simple implementation
- Works immediately
- No backend changes needed
- Consistent behavior across app

**Cons:**

- Defeats browser caching (more bandwidth)
- Doesn't solve stale data in component state
- Still requires page refresh to see updates

### Option 2: **Smart Cache Invalidation** (Recommended)

**Implementation:**

1. Create avatar version tracking system
2. Store avatar version/timestamp in user object
3. Use version as cache key: `avatar.jpg?v={version}`
4. When avatar updates, increment version
5. Refetch/invalidate affected data

**Pros:**

- Leverages browser caching efficiently
- Solves stale data problem
- Eventual consistency guaranteed

**Cons:**

- Requires backend changes
- More complex implementation
- Need to update data fetching logic

### Option 3: **Hybrid Approach** (Balanced)

**Implementation:**

1. Use `getAvatarUrlWithCacheBust()` for high-impact locations:
   - Event detail organizers/participants
   - System message senders
   - Program mentors
2. Keep `getAvatarUrl()` for low-impact locations:
   - Creation/edit forms
   - Dropdowns/selectors

**Pros:**

- Balances performance and freshness
- Simple to implement
- Solves most visible issues

**Cons:**

- Inconsistent behavior
- Still doesn't guarantee updates without refresh

### Option 4: **Add Refetch Mechanism** (Most Comprehensive)

**Implementation:**

1. Add avatar update event to WebSocket
2. When user uploads avatar, broadcast update
3. Components subscribe to avatar updates
4. On update event, refetch affected data OR update local state
5. Use cache busting for images

**Pros:**

- True real-time updates
- Most user-friendly
- Consistent across all locations

**Cons:**

- Most complex implementation
- Requires WebSocket infrastructure
- Backend changes needed

---

## Recommended Implementation Strategy

### Phase 1: Quick Win (Option 1 + Refetch)

1. Replace `getAvatarUrl()` with `getAvatarUrlWithCacheBust()` in all high-impact locations
2. Add manual refetch button or auto-refetch on navigation
3. Document locations for users

**Timeline:** 1-2 hours  
**Impact:** Medium - requires manual refresh but guarantees fresh avatars

### Phase 2: Proper Solution (Option 2)

1. Add `avatarVersion` field to User model
2. Update avatar upload to increment version
3. Modify avatar URLs to use version: `?v={version}`
4. Update data fetching to include version

**Timeline:** 4-6 hours  
**Impact:** High - automatic eventual consistency

### Phase 3: Real-time Updates (Option 4)

1. Add WebSocket event for avatar updates
2. Implement avatar update listeners in components
3. Update local state or refetch on avatar change
4. Test across all locations

**Timeline:** 8-12 hours  
**Impact:** Very High - true real-time updates

---

## Next Steps

1. ✅ Audit complete - all locations identified
2. ⏳ Choose implementation approach
3. ⏳ Implement Phase 1 (quick fix)
4. ⏳ Test avatar updates across locations
5. ⏳ Implement Phase 2 (proper solution)
6. ⏳ Consider Phase 3 (real-time) for future enhancement

---

## Testing Checklist

After implementing solution:

- [ ] Management table shows updated avatar immediately
- [ ] System message sender avatars update eventually
- [ ] Event detail organizer avatars update eventually
- [ ] Event detail participant avatars update eventually
- [ ] Program mentor avatars update eventually
- [ ] Co-organizer avatars in event preview update eventually
- [ ] Organizer selection component shows updated avatars
- [ ] Mentor picker component shows updated avatars
- [ ] Guest confirmation page shows updated organizer avatar
- [ ] Avatar upload preview works correctly
