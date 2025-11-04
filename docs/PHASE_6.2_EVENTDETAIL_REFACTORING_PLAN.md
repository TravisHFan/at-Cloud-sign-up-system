# Phase 6.2: EventDetail.tsx Refactoring Plan

**Date:** November 3, 2024  
**Target File:** `frontend/src/pages/EventDetail.tsx`  
**Current Size:** 1,560 lines  
**Target Size:** ~650 lines  
**Target Reduction:** 58.3% (910 lines extracted)

---

## Executive Summary

EventDetail.tsx is already **partially refactored** with several components and hooks extracted. However, it still contains a **massive 600-line realtime WebSocket handler** (lines 255-855) embedded directly in the component, along with complex modal UI logic. This plan focuses on extracting the remaining monolithic sections.

### Current State Analysis

**Already Extracted ✅:**

- `EventHeader.tsx` - Header with title, actions, publish controls
- `EventBasicDetails.tsx` - Date, time, location display
- `EventHostAndPurpose.tsx` - Organizer info and purpose
- `EventCapacityAndAgenda.tsx` - Capacity tracking and agenda
- `EventRolesSection.tsx` - 789 lines (still needs breakdown)
- `EventModals.tsx` - 513 lines (still needs breakdown)
- `WorkshopGroupsSection.tsx` - Workshop topic editing

**Already Extracted Hooks ✅:**

- `useEventData.ts` - 854 lines (event fetching + WebSocket room management)
- `useEventPermissions.ts` - Permission checks
- `useEventActions.ts` - Event actions (delete, cancel, export)
- `useSignupHandlers.ts` - Role signup/cancel logic
- `useDragDropHandlers.ts` - Drag-and-drop functionality
- `useWorkshopGroups.ts` - Workshop group management
- `useGuestModals.ts` - Guest modal state
- `useEmailModal.ts` - Email modal state
- `useProgramAccess.ts` - Program access checks
- `useRoleLimits.ts` - Multi-role limit tracking

---

## Problem Analysis

### 🔴 Critical Issue: Embedded 600-Line Realtime Handler

**Location:** Lines 255-855 (600 lines)

The component contains a massive `useEffect` that:

1. Initializes WebSocket connection
2. Handles 15+ different event update types
3. Manages guest list synchronization
4. Shows notifications for each update type
5. Refetches fresh event data
6. Handles auto-unpublish detection
7. Converts backend data structures to frontend format

**This is the #1 extraction priority** - it's responsible for ~38% of the file size.

### Structure Breakdown

```
EventDetail.tsx (1,560 lines)
├── Imports & Type Definitions (122 lines)
├── Main Component (1,438 lines)
│   ├── State & Hook Initialization (133 lines)
│   ├── 🔴 Realtime WebSocket Handler (600 lines) ← PRIMARY TARGET
│   ├── Loading & Error States (30 lines)
│   ├── Access Check Modal (100 lines)
│   ├── Header Section (200 lines)
│   ├── Basic Details Sections (150 lines)
│   ├── Roles Section Render (225 lines)
│   └── Modals Render (50 lines)
```

### Current Hook Usage (All Working ✅)

The component already uses **12 custom hooks** effectively:

- `useAuth()` - User authentication
- `useAvatarUpdates()` - Avatar refresh
- `useEventData()` - Event fetching + WebSocket room join/leave
- `useProgramAccess()` - Program access validation
- `useGuestModals()` - Guest modal state
- `useEmailModal()` - Email modal state
- `useRoleLimits()` - Multi-role tracking
- `useEventPermissions()` - Permission checks
- `useWorkshopGroups()` - Workshop editing
- `useDragDropHandlers()` - Drag-and-drop
- `useSignupHandlers()` - Signup/cancel
- `useEventActions()` - Event operations

---

## Refactoring Strategy

### Phase 1: Extract Realtime Handler (Priority 1) 🔴

**Target:** Lines 255-855 (600 lines)

**Create:** `useRealtimeEventUpdates.ts` (Custom Hook)

**Responsibilities:**

1. WebSocket `event_update` listener setup
2. Handle all 15+ update types with proper typing
3. Guest list synchronization logic
4. Notification dispatch for each update type
5. Event refetch after updates
6. Auto-unpublish detection
7. Backend-to-frontend data conversion

**Benefits:**

- Reduces EventDetail.tsx by 600 lines (38%)
- Isolates complex real-time logic
- Makes WebSocket handling testable
- Improves component readability

**API Design:**

```typescript
// useRealtimeEventUpdates.ts
export function useRealtimeEventUpdates({
  eventId,
  currentUserId,
  setEvent,
  setGuestsByRole,
  notification,
  locationPathname,
}: UseRealtimeEventUpdatesParams): void {
  // All WebSocket logic moved here
}
```

**Usage in EventDetail:**

```typescript
// Before (600 lines of useEffect)
useEffect(() => {
  // Massive WebSocket handler...
}, [id, currentUserId, location.pathname]);

// After (1 line)
useRealtimeEventUpdates({
  eventId: id,
  currentUserId,
  setEvent,
  setGuestsByRole,
  notification,
  locationPathname: location.pathname,
});
```

---

### Phase 2: Extract Access Check UI (Priority 2)

**Target:** Lines 900-1050 (150 lines)

**Create:** `ProgramAccessModal.tsx` (Component)

**Responsibilities:**

- Display enrollment requirement message
- Show program name
- Provide "Enroll Now" and "Go Back" buttons
- Handle loading overlay

**Benefits:**

- Removes 150 lines from main component
- Reusable across other pages that check program access
- Cleaner separation of concerns

---

### Phase 3: Breakdown EventRolesSection (Priority 3)

**Current:** 789 lines (already extracted but still too large)

**Further Extraction Opportunities:**

1. **RoleCard.tsx** (~200 lines)

   - Single role display
   - Signup button logic
   - Participant list
   - Capacity indicators

2. **RoleSignupControls.tsx** (~100 lines)

   - Signup/cancel buttons
   - Multi-role limit warnings
   - Permission checks

3. **RoleParticipantList.tsx** (~150 lines)

   - Participant display with avatars
   - Drag-and-drop zones
   - Management mode controls

4. **GuestListPanel.tsx** (~150 lines)
   - Guest display by role
   - Guest invitation controls
   - Guest edit/cancel actions

**After Breakdown:**

- EventRolesSection.tsx: ~189 lines (orchestrator)
- 4 new components: ~600 lines total
- **76% reduction** in EventRolesSection

---

### Phase 4: Breakdown EventModals (Priority 4)

**Current:** 513 lines (already extracted but still too large)

**Further Extraction Opportunities:**

1. **DeleteEventModal.tsx** (~80 lines)

   - Event deletion confirmation
   - Cascade vs unlink options
   - Warning messages

2. **EmailParticipantsModal.tsx** (~200 lines)

   - Rich text editor
   - Recipient selection (users/guests)
   - Send functionality

3. **GuestManagementModals.tsx** (~150 lines)

   - Guest edit modal
   - Guest cancel confirmation
   - Resend link confirmation

4. **NameCardModal.tsx** (~80 lines)
   - User action menu
   - Profile navigation
   - Context actions

**After Breakdown:**

- EventModals.tsx: ~100 lines (modal container)
- 4 new modals: ~510 lines total
- **80% reduction** in EventModals

---

## Extraction Priority & Timeline

### Phase 6.2.1: Extract Realtime Handler ⭐ **HIGHEST IMPACT**

- **Lines saved:** 600 lines (38% reduction)
- **Complexity:** High (15+ event types, guest sync, auto-unpublish)
- **Time estimate:** 2-3 hours
- **File:** `useRealtimeEventUpdates.ts`

### Phase 6.2.2: Extract Access Modal

- **Lines saved:** 150 lines (9% reduction)
- **Complexity:** Low (simple UI)
- **Time estimate:** 30 minutes
- **File:** `ProgramAccessModal.tsx`

### Phase 6.2.3: Breakdown EventRolesSection

- **Lines saved:** 600 lines (38% reduction from EventRolesSection)
- **Complexity:** Medium (4 components, drag-drop, permissions)
- **Time estimate:** 3-4 hours
- **Files:** 4 new components

### Phase 6.2.4: Breakdown EventModals

- **Lines saved:** 413 lines (80% reduction from EventModals)
- **Complexity:** Medium (4 modals, rich editor, API calls)
- **Time estimate:** 2-3 hours
- **Files:** 4 new modal components

---

## Expected Results

### Before Refactoring

```
EventDetail.tsx:              1,560 lines
EventRolesSection.tsx:          789 lines
EventModals.tsx:                513 lines
───────────────────────────────────────
Total:                        2,862 lines
```

### After Refactoring

```
EventDetail.tsx:                410 lines (-73.7%)
  - Removed realtime handler: -600 lines
  - Removed access modal:     -150 lines
  - Cleaner structure:        -400 lines

EventRolesSection.tsx:          189 lines (-76.0%)
  + RoleCard.tsx:               200 lines (new)
  + RoleSignupControls.tsx:     100 lines (new)
  + RoleParticipantList.tsx:    150 lines (new)
  + GuestListPanel.tsx:         150 lines (new)

EventModals.tsx:                100 lines (-80.5%)
  + DeleteEventModal.tsx:        80 lines (new)
  + EmailParticipantsModal.tsx: 200 lines (new)
  + GuestManagementModals.tsx:  150 lines (new)
  + NameCardModal.tsx:           80 lines (new)

+ useRealtimeEventUpdates.ts:   600 lines (new hook)
+ ProgramAccessModal.tsx:       150 lines (new component)
───────────────────────────────────────
Total (orchestrators):          699 lines (-75.6%)
Total (all components):       2,709 lines (highly modular)
```

### Key Metrics

- **Main file reduction:** 1,560 → 410 lines (**73.7% reduction**)
- **EventRolesSection:** 789 → 189 lines (**76.0% reduction**)
- **EventModals:** 513 → 100 lines (**80.5% reduction**)
- **New reusable components:** 10 (9 components + 1 hook)
- **Total extracted:** 2,010 lines
- **Improved testability:** Each component independently testable
- **Improved maintainability:** Clear separation of concerns

---

## Implementation Plan

### Step 1: Extract `useRealtimeEventUpdates.ts` ⭐

1. Create hook file with full WebSocket logic
2. Move all 15+ event type handlers
3. Move guest synchronization logic
4. Move auto-unpublish detection
5. Move backend-to-frontend conversion
6. Test all realtime scenarios

### Step 2: Extract `ProgramAccessModal.tsx`

1. Create modal component
2. Move access check UI (lines 900-1050)
3. Add loading overlay
4. Test enrollment flow

### Step 3: Breakdown `EventRolesSection.tsx`

1. Extract `RoleCard.tsx` (single role)
2. Extract `RoleSignupControls.tsx` (buttons)
3. Extract `RoleParticipantList.tsx` (participant display)
4. Extract `GuestListPanel.tsx` (guest management)
5. Refactor EventRolesSection to orchestrate

### Step 4: Breakdown `EventModals.tsx`

1. Extract `DeleteEventModal.tsx`
2. Extract `EmailParticipantsModal.tsx`
3. Extract `GuestManagementModals.tsx`
4. Extract `NameCardModal.tsx`
5. Refactor EventModals to container

### Step 5: Integration & Testing

1. Verify all TypeScript types
2. Run full test suite
3. Test realtime updates
4. Test all modal flows
5. Test drag-and-drop
6. Verify performance

---

## Success Criteria

✅ **EventDetail.tsx reduced to <450 lines**  
✅ **Zero TypeScript errors**  
✅ **All tests passing**  
✅ **Realtime updates working**  
✅ **All modals functional**  
✅ **Drag-and-drop working**  
✅ **Clean component separation**  
✅ **Improved code organization**

---

## Notes & Considerations

### Existing Architecture (Good! ✅)

- Component already uses 12 custom hooks effectively
- Clean separation of concerns in hooks
- Most business logic already extracted
- **Main issue:** Embedded realtime handler and oversized nested components

### Risk Assessment

- **Low Risk:** Realtime handler extraction (self-contained logic)
- **Low Risk:** Access modal extraction (simple UI)
- **Medium Risk:** EventRolesSection breakdown (complex drag-drop)
- **Medium Risk:** EventModals breakdown (rich editor, multiple modals)

### Testing Strategy

- Unit test each extracted component
- Integration test realtime updates
- E2E test signup/cancel flows
- Test drag-and-drop scenarios
- Test all modal interactions

---

## Conclusion

EventDetail.tsx refactoring focuses on **extracting the embedded 600-line realtime handler** and **breaking down oversized nested components**. The component already has excellent hook usage, so the primary work is:

1. **Move realtime logic to custom hook** (600 lines, 38% reduction)
2. **Extract access modal UI** (150 lines, 9% reduction)
3. **Break down EventRolesSection** (600 lines extracted)
4. **Break down EventModals** (413 lines extracted)

**Total reduction: 73.7%** (1,560 → 410 lines)

This matches our pattern from AdminPromoCodes (91.4%) and CreateEvent/EditEvent (63-70%), establishing a **consistent refactoring methodology** across the codebase.
